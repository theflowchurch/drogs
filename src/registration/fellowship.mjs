// The sign-ups shared from the Order of Bishops and Order of Pastors pages
// (office, 14 and 17 Nov): their own look under the DHMM name, with no Kuriake
// Castle name, logo, photograph or video. They write to the same records and
// office as every other sign-up; only the payment page keeps Kuriake, the name
// of the account. `path` is the key the server uses to brand the code email.
export const FELLOWSHIPS = {
  bishops: {
    path: 'bishops', role: 'bishop',
    name: 'Worldwide Fellowship of Bishops', shortName: 'Worldwide Fellowship of Bishops',
    logo: 'assets/organisations/dhmm-logo-white.webp',
    signup: '/orderofbishopsingoodstanding/signup/',
  },
  pastors: {
    path: 'pastors', role: 'pastor',
    name: 'Worldwide Fellowship of Pastors', shortName: 'Worldwide Fellowship of Pastors',
    logo: 'assets/organisations/dhmm-logo-white.webp',
    signup: '/orderofpastorsingoodstanding/signup/',
  },
};
export const FELLOWSHIP = FELLOWSHIPS.bishops;
export const fellowshipOf = key => FELLOWSHIPS[key] || null;
export const fellowshipByPath = path => Object.values(FELLOWSHIPS).find(f => f.path === path) || null;
export const fellowshipSignupPath = (base = '', f = FELLOWSHIP) => `${base}${f.signup}`;
