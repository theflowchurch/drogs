// The bishops' sign-up demonstration (/orderofbishopsingoodstanding/signup/test/,
// office 17 Nov): every step filled in with Bishop Andrew Kwaku Osei's public
// roll details (Pacific Islands Missionary Church, Suva, Fiji), so the office can
// show the process without anyone signing up. The email, code, phone and dates of
// birth are samples. It runs in the browser only: nothing is saved or sent.
const BISHOPS_DEMO = {
  storage: 'drogs-fellowship-demo-v1',
  email: 'andrew.osei@example.com',
  code: '482915',
  details: {
    role: 'bishop', title: 'Bishop', gender: 'male',
    name: 'Andrew Kwaku Osei', firstName: 'Andrew Kwaku', lastName: 'Osei',
    referenceId: 'B10',
    organization: 'United Denominations', denomination: 'Pacific Islands Missionary Church',
    country: 'Fiji', city: 'Suva', church: 'Suva',
    phone: '+679 700 1234', dob: '1975-06-15',
    yearAppointed: '2005', yearOrdained: '2012', yearConsecrated: '2021',
    photo: 'assets/portraits/B10-f97f0391.webp', photoConfirmed: true,
  },
  // A sample receipt, already chosen on the Payment step, so the demonstration
  // can carry on past payment.
  payment: { proof: 'assets/organisations/demo-receipt.webp', transactionId: 'DEMO-48291537' },
  pastors: [
    { name: 'Rhys Dompreh', dob: '1984-03-12' },
    { name: 'Ema Dompreh', dob: '1986-07-21' },
    { name: 'Linda Osei', dob: '1979-11-02' },
    { name: 'Stella Moko', dob: '1990-01-18' },
    { name: 'Mataiasi Lomu Tavo', dob: '1982-09-05' },
    { name: 'Siteri Vuli', dob: '1988-04-27' },
  ],
};

// The pastors' sign-up demonstration (/orderofpastorsingoodstanding/signup/test/,
// office 17 Nov): Rev. Rhys Dompreh, one of Bishop Andrew Kwaku Osei's pastors in
// Suva, Fiji. Bishop Osei's own registration is set up first, in this browser
// only, so he can be chosen as the overseeing bishop.
const PASTORS_DEMO = {
  storage: 'drogs-fellowship-demo-pastors-v1',
  email: 'rhys.dompreh@example.com',
  code: '615204',
  details: {
    role: 'pastor', title: 'Rev.', gender: 'male',
    name: 'Rhys Dompreh', firstName: 'Rhys', lastName: 'Dompreh',
    referenceId: 'S711a8c4d',
    organization: 'United Denominations', denomination: 'Pacific Islands Missionary Church',
    country: 'Fiji', city: 'Suva', church: 'Suva',
    phone: '+679 700 5678', dob: '1984-03-12',
    yearAppointed: '2016', yearOrdained: '2022',
    photo: 'assets/portraits/S711a8c4d-cae5664b.webp', photoConfirmed: true,
    bishopId: 'B10', bishopFirstName: 'Andrew Kwaku', bishopLastName: 'Osei',
  },
  payment: { proof: 'assets/organisations/demo-receipt-pastor.webp', transactionId: 'DEMO-61520493' },
  pastors: [],
  seed: [
    { actor: { id: 'demo-bishop-andrew', email: 'andrew.osei@example.com' }, action: 'save', payload: { ...BISHOPS_DEMO.details, email: 'andrew.osei@example.com' } },
    { actor: { id: 'demo-bishop-andrew', email: 'andrew.osei@example.com' }, action: 'submit', payload: { ...BISHOPS_DEMO.details, email: 'andrew.osei@example.com', consentedAt: '2026-11-17T10:00:00.000Z' } },
  ],
};
export const FELLOWSHIP_DEMOS = { bishops: BISHOPS_DEMO, pastors: PASTORS_DEMO };
export const FELLOWSHIP_DEMO = BISHOPS_DEMO;
