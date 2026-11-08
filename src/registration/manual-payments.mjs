// Registration destinations supplied by the Kuriake office, not FLOW offerings.
export const REGISTRATION_BANK = { name: 'Ecobank', branch: 'St Johns branch', accountName: 'KURIAKE CASTLE LBG', accountNumber: '1441005268161', country: 'Ghana' };
export const REGISTRATION_MOMO = { name: 'KURIAKE CASTLE LBG', number: '+233 59 202 4923', network: 'MTN Mobile Money' };
export const REMITTANCE_APPS = [
  ['WorldRemit', 'https://www.worldremit.com/', 'worldremit.com.png'],
  ['Remitly', 'https://www.remitly.com/', 'remitly.com.png'],
  ['Taptap Send', 'https://www.taptapsend.com/', 'taptapsend.com.png'],
];
export const inGhana = country => ['ghana', 'gh'].includes(String(country || '').trim().toLowerCase());
export const paymentReady = record => record?.payment === 'verified' || (record?.payment === 'pending' && Boolean(record.proof));
