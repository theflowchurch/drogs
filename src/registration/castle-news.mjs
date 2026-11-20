// Office, 19 Nov: news on Kuriake Castle's main page, three short articles.
// Each has its own page at /news/<slug>/, with no links or buttons (office, 19 Nov).
export const CASTLE_NEWS = [
  {
    slug: '2027-renewal',
    title: '2027 renewal is now open',
    summary: 'Registration renewal for the 2027 Roll of Good Standing is now open to bishops and pastors participating in the fellowship.',
    image: 'assets/news/renewal.webp',
    body: [
      'Registration renewal for the 2027 Roll of Good Standing is now open to bishops and pastors participating in the fellowship. Renewing each year keeps a minister’s licence current and their name on the Roll.',
      'You can renew online through your church’s page or the Kuriake Castle registration page. You will need your details and a recent photo in official attire.',
      'A pastor’s bishop confirms that the pastor serves under them, and the Kuriake Castle office confirms each bishop. Once your registration has been confirmed, your name appears on the Roll of Good Standing for 2027.',
      'Renewal is registration within the fellowship; it is not an appointment to church office, which remains with each denomination or group. If you do not renew, your name will not appear on the 2027 Roll after the registration deadline.',
    ],
    links: [['Renew online', 'signup'], ['Licensing and Registration', 'licensing']],
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
    summary: 'Churches and ministers participating in the fellowship serve in many nations across Africa, Europe, the Americas and the islands.',
    image: 'assets/news/fellowship.webp',
    body: [
      'The fellowship of Kuriake Castle reaches far beyond Ghana. Churches and ministers belonging to participating denominations and groups serve in more than a hundred countries.',
      'Bishops and pastors of the fellowship serve across Africa, Europe, North and South America, Asia and the Middle East, and on islands of the Caribbean and the Pacific.',
      'The participating denominations and groups remain independently governed, united through shared faith, fellowship and mission: to bring the gospel of Jesus Christ to the world.',
    ],
    links: [],
  },
];
export const castleNews = (slug) => CASTLE_NEWS.find((n) => n.slug === slug);
