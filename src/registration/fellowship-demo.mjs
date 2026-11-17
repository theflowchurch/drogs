// The bishops' sign-up demonstration (/orderofbishopsingoodstanding/signup/test/,
// office 17 Nov): every step filled in with Bishop Andrew Kwaku Osei's public
// roll details (Pacific Islands Missionary Church, Suva, Fiji), so the office can
// show the process without anyone signing up. The email, code, phone and dates of
// birth are samples. It runs in the browser only: nothing is saved or sent.
export const FELLOWSHIP_DEMO = {
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
