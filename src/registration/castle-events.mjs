// Kuriake Castle's own pages (office, 19 Nov): the licensing authority's main page
// and the ceremonies and gatherings the castle hosts. The text is a first draft
// for the office to correct; each event is one entry here.
export const CASTLE_EVENTS = [
  {
    slug: 'weddings', title: 'Weddings', short: 'Holy matrimony in a setting of history and reverence.',
    lead: 'Celebrate the covenant of marriage within the walls of an ecclesiastical castle, before God, family and the church.',
    offer: ['Wedding ceremonies officiated by a licensed bishop or pastor of your own denomination', 'A ceremony space and grounds for photographs', 'Receptions and wedding breakfasts', 'Pre-marriage counselling arranged with your officiating minister', 'Rehearsals and planning visits ahead of the day'],
    note: 'Your officiating minister must be licensed and in good standing for the year of the wedding.',
  },
  {
    slug: 'funerals', title: 'Funerals and Memorial Services', short: 'Dignified services to honour a life of faith.',
    lead: 'A place of peace and dignity to give thanks for a life, comfort the bereaved and commend a loved one to God.',
    offer: ['Funeral and burial services led by the family’s minister', 'Memorial and thanksgiving services', 'Space for family gatherings and the receiving of guests', 'Order-of-service planning with the family'],
    note: 'Arrangements can often be made at short notice. Please contact the office as early as possible.',
  },
  {
    slug: 'conferences', title: 'Conferences', short: 'Gatherings for ministry, leadership and teaching.',
    lead: 'Hosts church conferences, leadership summits and ministers’ gatherings.',
    offer: ['Main sessions and plenary gatherings', 'Breakout rooms for workshops and seminars'],
    note: 'Tell us the expected number of delegates and the days you need, and the office will advise on availability.',
  },
  {
    slug: 'meetings', title: 'Meetings', short: 'Board, committee and leadership meetings.',
    lead: 'Private, well-appointed rooms for church boards, committees and leadership teams to meet, pray and decide.',
    offer: ['Board and committee rooms', 'Leadership and planning sessions', 'Discreet, confidential surroundings'],
    note: 'Regular meetings can be booked as a series.',
  },
  {
    slug: 'ecclesiasticalmeetings', title: 'Ecclesiastical Meetings and Councils', short: 'Synods, councils and convocations of the church.',
    lead: 'The castle is home to the headquarters of many churches and missions, and a natural meeting place for the councils that govern them.',
    offer: ['Synods, councils and general assemblies', 'Bishops’ councils and episcopal gatherings', 'Convocations of clergy'],
    note: 'Ecclesiastical bodies served by the licensing authority are welcome to hold their councils here.',
  },
  {
    slug: 'consecrations', title: 'Consecrations and Ordinations', short: 'Setting apart bishops, pastors and ministers.',
    lead: 'Services of consecration, ordination and installation, held with the order and solemnity the occasion deserves.',
    offer: ['Consecration of bishops', 'Ordination of reverends and pastors', 'Installation and commissioning services', 'Licensing services for newly appointed ministers'],
    note: 'Those consecrated or ordained should register with the licensing authority so that they appear on the Roll of Good Standing.',
  },
  {
    slug: 'retreats', title: 'Retreats and Prayer Gatherings', short: 'Time apart for prayer, rest and renewal.',
    lead: 'Quiet days, prayer retreats and times of renewal for ministers, leaders and congregations.',
    offer: ['Ministers’ and leaders’ retreats', 'Prayer and fasting days', 'Quiet days and reflection', 'Church and ministry team retreats'],
    note: 'Retreats can be shaped around your group’s own programme of prayer and teaching.',
  },
  {
    slug: 'thanksgiving', title: 'Thanksgiving and Dedication Services', short: 'Giving thanks to God for milestones and blessings.',
    lead: 'Mark a church anniversary, the dedication of a child or a family milestone with a service of thanksgiving.',
    offer: ['Child dedications and naming ceremonies', 'Church and ministry anniversaries', 'Family thanksgiving services', 'Receptions after the service'],
    note: 'Services are led by your own licensed minister, or one can be arranged for you.',
  },
];
export const castleEvent = (slug) => CASTLE_EVENTS.find((e) => e.slug === slug) || null;
export const ENQUIRY_KINDS = [...CASTLE_EVENTS.map((e) => e.title), 'The Licensing Authority', 'Something else'];
