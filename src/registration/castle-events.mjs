// Kuriake Castle's own pages (office, 19 Nov): the licensing authority's main page
// and the ceremonies and gatherings the castle hosts. Each event is one entry here.
// Office, 19 Nov: eight events combined into five, and "and" written out.
export const CASTLE_EVENTS = [
  {
    slug: 'weddings', title: 'Weddings, Thanksgiving and Dedications', short: 'Marriages, milestones and dedications in a setting of history and reverence.',
    lead: 'Celebrate the covenant of marriage, give thanks for a milestone or dedicate a child within the walls of an ecclesiastical castle, before God, family and the church.',
    offer: ['Wedding ceremonies officiated by a licensed bishop or pastor of your own denomination', 'A ceremony space and grounds for photographs', 'Receptions and wedding breakfasts', 'Pre-marriage counselling arranged with your officiating minister', 'Rehearsals and planning visits ahead of the day', 'Child dedications and naming ceremonies', 'Church and ministry anniversaries', 'Family thanksgiving services'],
    note: 'Services are led by your own licensed minister, who must be in good standing for the year of the service.',
  },
  {
    slug: 'funerals', title: 'Funerals and Memorial Services', short: 'Dignified services to honour a life of faith.',
    lead: 'A place of peace and dignity to give thanks for a life, comfort the bereaved and commend a loved one to God.',
    offer: ['Funeral and burial services led by the family’s minister', 'Memorial and thanksgiving services', 'Space for family gatherings and the receiving of guests', 'Order-of-service planning with the family'],
    note: 'Arrangements can often be made at short notice. Please contact the office as early as possible.',
  },
  {
    slug: 'conferences', title: 'Conferences and Retreats', short: 'Gatherings for ministry and teaching, and time apart for prayer.',
    lead: 'Hosts church conferences, leadership summits and ministers’ gatherings, as well as retreats for prayer, rest and renewal.',
    offer: ['Main sessions and plenary gatherings', 'Breakout rooms for workshops and seminars', 'Ministers’ and leaders’ retreats', 'Prayer and fasting days', 'Quiet days and reflection', 'Church and ministry team retreats'],
    note: 'Tell us the expected number of people and the days you need, and the office will advise on availability.',
  },
  {
    slug: 'meetings', title: 'Meetings and Councils', short: 'Board meetings, synods and councils of the church.',
    lead: 'Private rooms for church boards, committees and leadership teams, and a meeting place for the synods and councils that govern the churches.',
    offer: ['Board and committee rooms', 'Leadership and planning sessions', 'Synods, councils and general assemblies', 'Bishops’ councils and episcopal gatherings', 'Convocations of clergy', 'Discreet, confidential surroundings'],
    note: 'Regular meetings can be booked as a series.',
  },
  {
    slug: 'consecrations', title: 'Consecrations and Ordinations', short: 'Setting apart bishops, pastors and ministers.',
    lead: 'Services of consecration, ordination and installation, held with the order and solemnity the occasion deserves.',
    offer: ['Consecration of bishops', 'Ordination of reverends and pastors', 'Installation and commissioning services', 'Licensing services for newly appointed ministers'],
    note: 'Those consecrated or ordained should register with the licensing authority so that they appear on the Roll of Good Standing.',
  },
];
export const castleEvent = (slug) => CASTLE_EVENTS.find((e) => e.slug === slug) || null;
export const ENQUIRY_KINDS = [...CASTLE_EVENTS.map((e) => e.title), 'The Licensing Authority', 'Something else'];
