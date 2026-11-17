// The bishops' sign-up shared from the Organisations and Councils pages (office,
// 14 Nov): its own look under the DHMM name, with no Kuriake Castle name, logo,
// photograph or video. It writes to the same records and office as every other
// sign-up; only the payment page keeps Kuriake, the name of the account.
export const FELLOWSHIP = {
  path: 'bishops',
  name: 'Worldwide Fellowship of Bishops',
  shortName: 'Worldwide Fellowship of Bishops',
  logo: 'assets/organisations/dhmm-logo-white.webp',
};
// Office, 17 Nov: the sign-up lives at /orderofbishopsingoodstanding/signup/ (the
// old /bishops/signup/ forwards there). FELLOWSHIP.path stays the key the server
// uses to brand the sign-in code email.
export const fellowshipSignupPath = (base = '') => `${base}/orderofbishopsingoodstanding/signup/`;
