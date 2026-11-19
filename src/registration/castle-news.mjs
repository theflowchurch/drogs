// Office, 19 Nov: news on Kuriake Castle's main page, three short articles.
// Each has its own page at /news/<slug>/, with no links or buttons (office, 19 Nov).
export const CASTLE_NEWS = [
  {
    slug: '2027-renewal',
    title: '2027 renewal is now open',
    summary: 'Bishops and pastors can now renew their licence for 2027 to remain on the Roll of Good Standing.',
    image: 'assets/news/renewal.webp',
    body: [
      'Renewal for 2027 is now open. Every bishop and pastor who wishes to remain on the Roll of Good Standing must renew their licence each year.',
      'You can renew online through your church’s page or the Kuriake Castle registration page. You will need your details and a recent photo in official attire.',
      'Pastors are confirmed by their bishop. Once your registration has been confirmed, your name appears on the Roll of Good Standing for 2027.',
    ],
    links: [],
  },
  {
    slug: 'kuriake-castle-declaration',
    title: 'The Kuriake Castle Declaration',
    summary: 'The shared principles of our fellowship of denominations and groups.',
    image: 'assets/news/declaration.webp',
    body: [
      'The Kuriake Castle Declaration took effect on 15 September 2026. It sets out the nature of the fellowship between the denominations and groups that take part in Kuriake Castle.',
      'Kuriake Castle is a voluntary fellowship, united in faith, doctrine and mission. Each denomination and group keeps its own name and its own governing body, and manages its own leadership, property and finances.',
      'Kuriake Castle offers fellowship, encouragement and advice when it is asked for. It has no authority over the internal affairs of any denomination, group or local church.',
    ],
    links: [],
  },
  {
    slug: 'search-our-register',
    title: 'Search our register',
    summary: 'Anyone can check whether a bishop or pastor is licensed and in good standing.',
    image: 'assets/news/check.webp',
    body: [
      'Churches and members of the public can check whether a bishop or pastor holds a valid licence and is in good standing.',
      'The Roll of Good Standing is now out. Our registers list every bishop and pastor in good standing, from A to Z, and can be searched by name.',
      'A minister in good standing has renewed their licence for the current year and their registration has been confirmed. If a name is not on the register, the minister may not have renewed yet.',
    ],
    links: [],
  },
];
export const castleNews = (slug) => CASTLE_NEWS.find((n) => n.slug === slug);
