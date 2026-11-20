// Office, 19 Nov: news on Kuriake Castle's main page, three short articles.
// Each has its own page at /news/<slug>/, with no links or buttons (office, 19 Nov).
export const CASTLE_NEWS = [
  {
    slug: '2027-renewal',
    title: '2027 renewal is now open',
    summary: 'Registration renewal for the 2027 Roll of Good Standing is now open to bishops and pastors participating in the fellowship.',
    image: 'assets/news/renewal.webp',
    body: [
      'Registration renewal for the 2027 Roll of Good Standing is now open to bishops and pastors participating in the fellowship. Every bishop and pastor who wishes to remain on the Roll of Good Standing must renew their licence each year.',
      'You can renew online through your church’s page or the Kuriake Castle registration page. You will need your details and a recent photo in official attire.',
      'Pastors are confirmed by their bishop. Once your registration has been confirmed, your name appears on the Roll of Good Standing for 2027.',
    ],
    links: [['Renew online', 'signup']],
  },
  {
    // Office, 20 Nov: in place of the Declaration and register articles.
    slug: 'events-at-kuriake-castle',
    title: 'Events at Kuriake Castle',
    summary: 'The castle hosts weddings, conferences, ordinations and other church gatherings.',
    image: 'assets/news/events.webp',
    body: [
      'Kuriake Castle welcomes churches, ministries and families for the occasions that matter most in the life of the church.',
      'The castle hosts weddings, thanksgiving services and dedications, as well as funerals and memorial services held with dignity and care.',
      'Churches and ministries can also hold conferences and retreats, board meetings and councils, and services of consecration and ordination.',
    ],
    links: [],
  },
  {
    slug: 'our-fellowship-around-the-world',
    title: 'The fellowship around the world',
    summary: 'Churches and ministers participating in the fellowship serve across more than 100 countries and territories.',
    image: 'assets/news/fellowship.webp',
    body: [
      'The fellowship of Kuriake Castle reaches far beyond Ghana. Churches and ministers participating in the fellowship serve across more than 100 countries and territories.',
      'Bishops and pastors of the fellowship serve across Africa, Europe, North and South America, Asia and the Middle East, and on islands of the Caribbean and the Pacific.',
      'The participating denominations and groups remain independently governed, united through shared faith, fellowship and mission: to bring the gospel of Jesus Christ to the world.',
    ],
    links: [],
  },
];
export const castleNews = (slug) => CASTLE_NEWS.find((n) => n.slug === slug);
