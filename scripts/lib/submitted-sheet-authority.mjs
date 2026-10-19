// Only assets belonging to the audited current submitted roster are carried
// forward. These cannot supply profile details or add people to a sheet.
export function submittedRosterAssets(data) {
  const pick = ({ id, name, submittedName, bishop, image }) => ({ id, name: submittedName || name, bishop, image });
  return { bishops: (data.bishops || []).map(pick), pastors: (data.pastors || []).map(pick) };
}

export function nonPastoralRank(row) {
  // A dated office approval can promote a current submitted row while its
  // original spreadsheet rank and personal details remain intact.
  const approval = row.officePastorApproval;
  if (typeof approval?.source === 'string' && approval.source.trim() && ['Pastor', 'Rev.', 'Lady Rev.', 'Apostle'].includes(approval.title)) return false;
  return /^(?:minister\s*shepherd|shepherd|elder|ms)\.?$/i.test(String(row.rawRank || '').trim());
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function submissionDate(sheet) {
  const match = String(sheet.folder || '').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  return match ? Date.UTC(Number(match[3]), MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()), Number(match[1])) : 0;
}
export const newerSubmission = (previous, incoming) => !previous || submissionDate(incoming) >= submissionDate(previous) ? incoming : previous;

const ownerWords = value => String(value || '').toLowerCase().replace(/\b(?:bishop|mother|episcopal sister|rev|reverend)\b/g, ' ').match(/\p{L}+/gu) || [];
export function submittedFileOwner(file) {
  return String(file).replace(/\.xlsx$/i, '').replace(/_/g, ' ').replace(/\s+(?:first love|flc|pastors)\b.*$/i, '')
    .replace(/[-_ ]*(?:updated|completed|filled|fiilled|copy|data|\(\d+\)).*$/i, '');
}
export function selectSubmittedBishop(rows, owner) {
  const wanted = ownerWords(owner);
  const matches = rows.filter(row => {
    const actual = ownerWords(row.name);
    return Math.min(wanted.length, actual.length) >= 2 &&
      (wanted.every(word => actual.includes(word)) || actual.every(word => wanted.includes(word)));
  });
  // A copied bishop row must never replace a uniquely identified owner's row.
  return matches.length === 1 ? matches[0] : rows.length === 1 ? rows[0] : null;
}

export function joinSplitBishopDetails(row, next, map) {
  if (!map || !next || map.name === undefined || map.rank === undefined) return null;
  if (!/^full\s*name$/i.test(String(row[map.name] || '').trim()) ||
      !/^(?:bishop|mother|episcopal sister)$/i.test(String(row[map.rank] || '').trim())) return null;
  const name = String(next[map.name] || '').trim();
  if (ownerWords(name).length < 2 || next.some((value, column) => column !== map.name && String(value || '').trim())) return null;
  // Some submissions put the name alone immediately below the personal details.
  return row.map((value, column) => column === map.name ? name : value);
}

export function submittedBirthKeys(value) {
  const text = String(value || '').toLowerCase().trim();
  const numbers = (text.match(/\d+/g) || []).map(Number);
  const month = MONTHS.findIndex(m => text.includes(m));
  const key = (day, month, year) => day >= 1 && day <= 31 && month >= 1 && month <= 12
    ? `${day}-${month}-${String(year).slice(-2).padStart(2, '0')}` : null;
  let keys = [];
  if (month >= 0 && numbers.length >= 2) {
    const year = numbers.find(n => n > 31) ?? numbers.at(-1);
    keys = [key(numbers.find(n => n <= 31), month + 1, year)];
  } else if (numbers.length === 3) {
    const [a, b, c] = numbers;
    keys = a >= 1000 ? [key(c, b, a)] : [key(a, b, c), key(b, a, c)];
  }
  return [...new Set(keys.filter(Boolean))];
}

// Workbooks sometimes repeat their title/group banners between two tables.
// These are metadata even when a pastor column map has already been found.
export function submittedSheetBanner(row) {
  const filled = row.map(value => String(value || '').trim()).filter(Boolean);
  if (filled.length > 2) return null;
  const text = filled.join(' ');
  if (/^(bishop|episcopal sister|mother)\s/i.test(text)) return { kind: 'bishop', titleRow: text.replace(/^(bishop|episcopal sister|mother)\s+/i, '').trim() };
  if (/\s·/.test(text)) {
    const [group, denomination] = text.split(/\s*·\s*/);
    return { kind: 'group', group, denomination };
  }
  return null;
}
