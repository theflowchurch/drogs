import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { applyAction, directoryPeople, overlayReferences, normalName, parseDob, catalogOf, REFERENCE_FIELDS } from '../registration/model.mjs';
import { nonPastoralRank, submittedSheetBanner, submittedBirthKeys } from '../../scripts/lib/submitted-sheet-authority.mjs';
import { HttpError } from './auth.mjs';

export const managementPeople = (state, references) => directoryPeople({ ...state, hidden: [] }, references).filter(p => !p.id.startsWith('new:'));
export const personRevision = person => createHash('sha256').update(JSON.stringify(person)).digest('hex');
const domainAction = (...args) => { try { return applyAction(...args); } catch (error) { throw error instanceof HttpError ? error : new HttpError(400, error.message); } };
const normalizedWords = value => normalName(value).split(' ').filter(Boolean).sort();
function relatedName(a, b) {
  const A = normalizedWords(a), B = normalizedWords(b);
  return A.length >= 2 && B.length >= 2 && (A.every(w => B.includes(w)) || B.every(w => A.includes(w)));
}
function sameBirthday(person, dob) {
  if (!dob) return null;
  const known = person.dob ? submittedBirthKeys(person.dob) : person.dobKeys || [];
  if (!known.length) return null;
  return submittedBirthKeys(dob).some(k => known.includes(k));
}
export function possibleDuplicates(people, fields, exceptId) {
  return people.filter(p => p.id !== exceptId && p.role === fields.role && relatedName(p.name, fields.name) && sameBirthday(p, fields.dob) !== false);
}
export function annotateApiAudit(state, actor, from) {
  for (const entry of state.audit.slice(from)) Object.assign(entry, { apiKeyId: actor.apiKeyId, apiKeyName: actor.apiKeyName });
  return state;
}
export function changePerson(state, actor, references, { id, fields: input = {}, bishopId, allowDuplicate = false }) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new HttpError(400, 'Supply a fields object.');
  const unknown = Object.keys(input).filter(k => !REFERENCE_FIELDS.includes(k));
  if (unknown.length) throw new HttpError(400, `Unknown fields: ${unknown.join(', ')}. Upload photos through the photo endpoint.`);
  const fields = Object.fromEntries(Object.entries(input).map(([k,v]) => {
    if (v !== null && typeof v !== 'string') throw new HttpError(400, `${k} must be text or null.`);
    return [k, String(v ?? '').trim()];
  }));
  if (typeof allowDuplicate !== 'boolean') throw new HttpError(400, 'allowDuplicate must be boolean.');
  const current = managementPeople(state, references), previous = id && current.find(p => p.id === id);
  if (id && !previous) throw new HttpError(404, 'Current person not found.');
  if (fields.dob) {
    const dob = parseDob(fields.dob);
    if (!dob) throw new HttpError(400, 'Use an ISO birthday or day/month/year.');
    fields.dob = dob;
  }
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw new HttpError(400, 'Use a valid email address.');
  const role = fields.role || previous?.role;
  if (!['pastor','bishop'].includes(role)) throw new HttpError(400, 'Choose bishop or pastor.');
  if (previous?.role === 'bishop' && role !== 'bishop') throw new HttpError(400, 'A current bishop cannot be added under another bishop as a pastor.');
  let overseer;
  if (bishopId !== undefined) {
    overseer = current.find(p => p.id === bishopId && p.role === 'bishop');
    if (!overseer) throw new HttpError(400, 'Choose a current bishop or lay president by bishopId.');
  } else if (fields.bishop) {
    const matches = current.filter(p => p.role === 'bishop' && normalName(p.name) === normalName(fields.bishop));
    if (matches.length !== 1) throw new HttpError(400, 'Choose the supervising bishop using bishopId.');
    overseer = matches[0];
  }
  if (role === 'pastor' && current.some(p => p.role === 'bishop' && normalName(p.name) === normalName(fields.name || previous?.name))) throw new HttpError(400, 'A current bishop cannot be created as a pastor.');
  if (role === 'bishop' && (overseer || fields.bishop)) throw new HttpError(400, 'Bishops cannot be assigned under bishops.');
  if (role === 'pastor' && !id && !overseer) throw new HttpError(400, 'New pastors require a current bishopId.');
  if (overseer) Object.assign(fields, { bishop: overseer.name, organization: overseer.organization, group: overseer.group, denomination: overseer.denomination });
  if (role === 'bishop' && !fields.title && (fields.organization || fields.gender) && (fields.gender || previous?.gender) === 'female') fields.title = (fields.organization || previous?.organization) === 'United Denominations' ? 'Episcopal Sister' : 'Mother';
  if (role === 'bishop' && previous?.role === 'pastor') { fields.bishop = ''; fields.title ||= (fields.gender || previous.gender) === 'female' ? 'Mother' : 'Bishop'; }
  const effective = { ...previous, ...fields, role };
  if (!catalogOf(state).organizations.includes(effective.organization)) throw new HttpError(400, 'Choose an organization from the current catalog.');
  if (role === 'pastor' && /bishop|mother|episcopal|lay president/i.test(effective.title || '')) throw new HttpError(400, 'A pastor cannot have a bishop title.');
  if (!effective.name || effective.name.trim().split(/\s+/).length < 2) throw new HttpError(400, 'Enter the full name.');
  if (effective.title && !['Bishop','Mother','Episcopal Sister','Lay President','Pastor','Rev.','Lady Rev.','Apostle'].includes(effective.title)) throw new HttpError(400, 'Use a supported title.');
  if (!allowDuplicate && (!id || fields.name !== undefined || fields.dob !== undefined)) {
    const duplicates = possibleDuplicates(current, effective, id);
    if (duplicates.length) throw new HttpError(409, `Possible duplicate: ${duplicates.map(p => `${p.name} (${p.id})`).join(', ')}. Update that referenceId, supply a distinct birthday, or explicitly set allowDuplicate for a confirmed namesake.`);
  }
  let next = state;
  const from = state.audit.length;
  if (!id) {
    next = domainAction(next, actor, 'addReference', { fields: { ...fields, role } }, undefined, references);
    id = next.audit.at(-1).detail.id;
  }
  next = domainAction(next, actor, 'editReference', { referenceId: id, fields }, undefined, references);
  if (overseer) {
    const linked = new Set(next.profiles.filter(p => p.referenceId === id).map(p => p.id));
    for (const r of next.registrations.filter(r => r.data.referenceId === id || linked.has(r.userId))) {
      const [first, ...last] = overseer.name.split(' ');
      Object.assign(r.data, { bishopId: overseer.id, bishopName: overseer.name, bishopFirstName: first, bishopLastName: last.join(' ') });
    }
    for (const row of next.rosters.filter(r => r.referenceId === id || linked.has(r.pastorId))) row.bishopId = overseer.id;
  }
  if (previous?.role === 'bishop' && ['organization','group','denomination'].some(k => fields[k] !== undefined && fields[k] !== previous[k])) {
    // Changing a bishop's organization changes the whole current oversight,
    // including linked registrations, instead of leaving pastors on another site.
    for (const child of current.filter(p => p.role === 'pastor' && p.bishop === previous.name))
      next = changePerson(next, actor, references, { id: child.id, bishopId: id, fields: {} }).state;
  }
  return { state: annotateApiAudit(next, actor, from), person: managementPeople(next, references).find(p => p.id === id) };
}

const columnAliases = {
  name: /^(full\s*name(?:\s*\(.*)?|name|pastor(?:s)?\s*name)$/, firstName: /^first\s*name$/, lastName: /^(last\s*name|surname)$/,
  referenceId: /^(reference\s*id|person\s*id|id)$/, dob: /^(date\s*of\s*birth|dob|birthday)$/, gender: /^(gender|sex|male\s*\/\s*female)$/,
  title: /^(rank|title|rev\s*\/\s*pastor)$/, email: /^e-?mail(?:\s*address)?$/, phone: /^(phone|telephone|whatsapp|contact|mobile|number)(?:\s*(number|no\.?))?$/,
  city: /^(city|area\s*of\s*residence)$/, country: /^country$/, branch: /^(branch|church)$/,
  yearAppointed: /^(year\s*appointed|pastoral\s*appointment)$/, yearOrdained: /^(year\s*ordained|ordination)$/,
};
export function workbookPastors(bytes) {
  let book;
  try { book = XLSX.read(bytes, { type: 'buffer', cellDates: false, cellFormula: false, cellHTML: false, sheetRows: 1200 }); }
  catch { throw new HttpError(400, 'The spreadsheet could not be opened. Send XLSX or CSV.'); }
  const rows = [], skipped = [];
  for (const sheet of book.SheetNames.filter(s => !/removed/i.test(s))) {
    let columns;
    const grid = XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1, raw: true, defval: '' });
    if (grid.length >= 1200) throw new HttpError(400, 'Split the workbook into smaller sheets (at most 500 pastor rows per import).');
    for (const [index, rawValues] of grid.entries()) {
      const values = rawValues.map(v => v instanceof Date ? v.toISOString().slice(0,10) : v);
      if (!values.some(v => String(v).trim())) continue;
      const mapped = {};
      values.slice(0, 100).forEach((v,i) => { const h = String(v).trim().toLowerCase().replace(/\s*\(.*\)\s*$/, ''); for (const [k,re] of Object.entries(columnAliases)) if (re.test(h)) mapped[k] = i; });
      if (mapped.name !== undefined || mapped.firstName !== undefined) { columns = mapped; continue; }
      if (!columns || submittedSheetBanner(values.map(String))) continue;
      const row = Object.fromEntries(Object.entries(columns).map(([k,i]) => {
        let value = values[i];
        if (k === 'dob' && typeof value === 'number') {
          const date = XLSX.SSF.parse_date_code(value, { date1904: Boolean(book.Workbook?.WBProps?.date1904) });
          if (!date) throw new HttpError(400, `Invalid Excel birthday on ${sheet}, row ${index+1}.`);
          value = `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
        }
        return [k, String(value ?? '').trim()];
      }));
      row.name ||= [row.firstName, row.lastName].filter(Boolean).join(' ');
      row.name = row.name.replace(/^[\s\d.)-]+/, '').replace(/^(bishop|rev\.?|reverend|pastor|ps\.?|lp\.?|lr\.?)\s+/i, '').trim();
      delete row.firstName; delete row.lastName;
      if (!row.name || row.name.split(/\s+/).length < 2 || /pastors?\s+under|^no\s+pastors?/i.test(row.name)) continue;
      if (/bishop|mother|episcopal/i.test(row.title || '') || nonPastoralRank({ rawRank: row.title })) { skipped.push({ sheet, row: index+1, name: row.name, reason: 'Not a pastor row' }); continue; }
      if (row.title) row.title = /rev/i.test(row.title) ? (/^f/i.test(row.gender) ? 'Lady Rev.' : 'Rev.') : /apostle/i.test(row.title) ? 'Apostle' : 'Pastor';
      if (row.gender) row.gender = /^f/i.test(row.gender) ? 'female' : /^m/i.test(row.gender) ? 'male' : row.gender;
      for (const k of Object.keys(row)) if (!row[k]) delete row[k];
      rows.push(row);
    }
  }
  if (!rows.length) throw new HttpError(400, 'No pastor rows found. Include a Name or Full Name column.');
  if (rows.length > 500) throw new HttpError(400, 'Import at most 500 pastor rows at a time.');
  return { rows, skipped };
}
export function importPastors(state, actor, references, { bishopId, rows, allowNew = false, moveExisting = false }) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new HttpError(400, 'Supply 1–500 pastor rows.');
  const bishop = managementPeople(state, references).find(p => p.id === bishopId && p.role === 'bishop');
  if (!bishop) throw new HttpError(400, 'Choose a current bishopId.');
  const outcomes = []; let next = structuredClone(state);
  for (const [index, raw] of rows.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, `Invalid row ${index+1}.`);
    const { referenceId, ...fields } = raw;
    const current = managementPeople(next, references);
    if (fields.role === 'bishop' || current.some(p => p.role === 'bishop' && normalName(p.name) === normalName(fields.name))) {
      outcomes.push({ row: index+1, name: fields.name, status: 'skipped', reason: 'Bishops are never imported as pastors' }); continue;
    }
    if (fields.dob) {
      const dob = parseDob(fields.dob); if (!dob) throw new HttpError(400, `Invalid birthday on row ${index+1}. Use ISO or day/month/year.`); fields.dob = dob;
    }
    let matches = referenceId ? current.filter(p => p.id === referenceId) : current.filter(p => p.role === 'pastor' && normalName(p.name) === normalName(fields.name) && sameBirthday(p, fields.dob) !== false);
    if (referenceId && !matches.length) throw new HttpError(404, `Unknown referenceId on row ${index+1}.`);
    if (matches.length > 1) throw new HttpError(409, `Ambiguous name on row ${index+1}: ${fields.name}. Supply referenceId.`);
    const previous = matches[0];
    if (previous && previous.role !== 'pastor') throw new HttpError(400, `Row ${index+1} is a bishop, not a pastor.`);
    if (previous && previous.bishop !== bishop.name && !moveExisting) throw new HttpError(409, `Row ${index+1}: ${previous.name} is under ${previous.bishop}. Set moveExisting explicitly to move this person.`);
    if (!previous && !allowNew) throw new HttpError(409, `Row ${index+1}: ${fields.name} is new. Set allowNew explicitly to add new pastors.`);
    const change = changePerson(next, actor, references, { id: previous?.id, bishopId, fields: { ...fields, role: 'pastor' } }); next = change.state;
    outcomes.push({ row: index+1, id: change.person.id, name: change.person.name, status: previous ? 'updated' : 'created' });
  }
  return { state: next, outcomes };
}
