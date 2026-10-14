// Explain the current submitted-sheet reconciliation without asking the office
// to interpret raw spreadsheet row counts as additional people to import.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const report = JSON.parse(readFileSync(new URL('../data/reports/roll-build.json', import.meta.url), 'utf8'));
const sheets = JSON.parse(readFileSync(new URL('../data/bishop-submissions.json', import.meta.url), 'utf8'));
const destination = resolve(process.argv[2] || '.context');
mkdirSync(destination, { recursive: true });
const csv = rows => rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
const category = (fate, name, bishop) => name.trim().toLowerCase() === bishop.trim().toLowerCase() || /own row|bishop on|titled .*not a pastor/i.test(fate) ? 'Bishop or leader row excluded'
  : /twice|one person with/i.test(fate) ? 'Duplicate row; one person retained'
  : /unclaimed/i.test(fate) ? 'Assignment awaiting confirmation'
  : /ruled to|already on the roll/i.test(fate) ? 'Assigned under another leader'
  : /ranked|removed/i.test(fate) ? 'Non-pastoral row excluded' : 'Other exclusion';
const summary = [['Bishop', 'Submitted rows', 'Unique pastors under this bishop', 'Bishop or leader rows excluded', 'Duplicate rows excluded', 'Worksheet headings excluded', 'Assigned under another leader', 'Non-pastoral rows excluded', 'Assignment awaiting confirmation', 'Unexplained missing rows', 'Unexpected extra people', 'Action remaining', 'Latest submitted file', 'Source folder']];
const details = [['Bishop', 'Submitted file', 'Source folder', 'Imported row reference', 'Name on row', 'Category', 'Explanation']];
const actions = [['Bishop or pastor', 'Issue', 'Action required', 'Source file']];
for (const r of report.reconcile) {
  const counts = new Map();
  for (const x of r.notUnder) { const type = category(x.fate, x.name, r.bishop); counts.set(type, (counts.get(type) || 0) + 1); details.push([r.bishop, r.file, r.folder, x.row, x.name, type, x.fate]); }
  const sheet = sheets.find(s => s.file === r.file && s.folder === r.folder);
  for (const x of sheet?.metadataRows || []) {
    const type = x.kind === 'bishop' ? 'Bishop or leader row excluded' : 'Worksheet heading excluded';
    counts.set(type, (counts.get(type) || 0) + 1);
    details.push([r.bishop, r.file, r.folder, x.row, x.name, type, 'Repeated worksheet heading; excluded from people']);
  }
  const copied = report.rowBelongsToAnother.find(s => s.file === r.file);
  const notes = [];
  if (sheet && !sheet.pastors.length && !sheet.noPastors && !/no pastors/i.test(sheet.folder)) {
    notes.push('Confirm no pastors, or submit the missing pastor list');
    actions.push([r.bishop, 'Empty list without a no-pastors declaration', notes.at(-1), r.file]);
  }
  if (copied) {
    notes.push(`Correct bishop details: row currently names ${copied.bishopRowNames}; mismatched details excluded`);
    actions.push([r.bishop, `Personal-details row names ${copied.bishopRowNames}`, notes.at(-1), r.file]);
  }
  if (sheet && !sheet.pastors.length && /no pastors/i.test(sheet.folder)) notes.push('No pastors submitted: office no-pastors batch; no older list imported');
  if (counts.get('Assignment awaiting confirmation')) notes.push('Confirm the disputed pastor assignment; see row explanations');
  const problems = report.reconcileProblems.filter(p => p.bishop === r.bishop);
  summary.push([r.bishop, r.sheetRows + (sheet?.metadataRows?.length || 0), r.onRoll, counts.get('Bishop or leader row excluded') || 0, counts.get('Duplicate row; one person retained') || 0, counts.get('Worksheet heading excluded') || 0, counts.get('Assigned under another leader') || 0, counts.get('Non-pastoral row excluded') || 0, counts.get('Assignment awaiting confirmation') || 0, problems.length, r.extra.length, notes.join('; ') || 'None: current sheet reconciled', r.file, r.folder]);
}
for (const c of report.conflicts) actions.push([c.name, `Claimed by ${c.claims.map(x => x.bishop).join(' and ')}`, 'Confirm the correct bishop; retained once as Unclaimed', c.claims.map(x => x.file).join('; ')]);
for (const [file, rows] of [['Latest submitted spreadsheet audit.csv', summary], ['Submitted row explanations.csv', details], ['Remaining source corrections.csv', actions]]) {
  writeFileSync(resolve(destination, file), '\uFEFF' + csv(rows));
  console.log(`${file}: ${rows.length - 1} rows`);
}
