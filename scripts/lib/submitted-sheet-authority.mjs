// Continuity is only an identity/portrait index. No old profile detail can
// cross this boundary into a record built from the current submitted sheets.
export function continuityAssets(data) {
  const pick = ({ id, name, bishop, image }) => ({ id, name, bishop, image });
  return { bishops: (data.bishops || []).map(pick), pastors: (data.pastors || []).map(pick) };
}

export function nonPastoralRank(row) {
  return /^(?:minister\s*shepherd|shepherd|elder|ms)\.?$/i.test(String(row.rawRank || '').trim());
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function submissionDate(sheet) {
  const match = String(sheet.folder || '').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  return match ? Date.UTC(Number(match[3]), MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()), Number(match[1])) : 0;
}
export const newerSubmission = (previous, incoming) => !previous || submissionDate(incoming) >= submissionDate(previous) ? incoming : previous;

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
