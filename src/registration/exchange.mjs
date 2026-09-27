// Indicative local-currency amounts on the payment screen. The office is paid
// in USD; the converted figure only helps someone recognise roughly what their
// bank or mobile-money provider will move, and is always labelled as indicative.
export const RATES_URL = "https://open.er-api.com/v6/latest/USD";
export const RATES_KEY = "drogs-registration-rates";
export const RATES_MAX_AGE = 12 * 60 * 60 * 1000;
export const countryKey = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(and|the|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const CURRENCIES = {
  GHS: ["ghana"],
  NGN: ["nigeria"],
  KES: ["kenya"],
  UGX: ["uganda"],
  TZS: ["tanzania"],
  RWF: ["rwanda"],
  BIF: ["burundi"],
  ZAR: ["south africa"],
  ZMW: ["zambia"],
  ZWG: ["zimbabwe"],
  MWK: ["malawi"],
  MZN: ["mozambique"],
  BWP: ["botswana"],
  NAD: ["namibia"],
  LSL: ["lesotho"],
  SZL: ["eswatini", "swaziland"],
  AOA: ["angola"],
  CVE: ["cape verde", "cabo verde"],
  GMD: ["gambia"],
  GNF: ["guinea"],
  LRD: ["liberia"],
  SLE: ["sierra leone"],
  ETB: ["ethiopia"],
  SSP: ["south sudan"],
  SDG: ["sudan"],
  SOS: ["somalia"],
  DJF: ["djibouti"],
  ERN: ["eritrea"],
  KMF: ["comoros"],
  MGA: ["madagascar"],
  MUR: ["mauritius"],
  SCR: ["seychelles"],
  MRU: ["mauritania"],
  STN: ["sao tome principe", "sao tome"],
  CDF: ["drc", "congo kinshasa", "congo democratic republic"],
  XAF: [
    "cameroon",
    "gabon",
    "chad",
    "central african republic",
    "congo brazzaville",
    "equatorial guinea",
  ],
  XOF: [
    "benin",
    "burkina faso",
    "cote divoire",
    "cote divoire ivory coast",
    "ivory coast",
    "mali",
    "niger",
    "senegal",
    "togo",
    "guinea bissau",
  ],
  MAD: ["morocco", "western sahara"],
  DZD: ["algeria"],
  TND: ["tunisia"],
  LYD: ["libya"],
  EGP: ["egypt"],
  USD: [
    "united states",
    "usa",
    "us",
    "america",
    "ecuador",
    "el salvador",
    "panama",
    "puerto rico",
  ],
  CAD: ["canada"],
  MXN: ["mexico"],
  GBP: [
    "uk",
    "united kingdom",
    "england",
    "scotland",
    "wales",
    "northern ireland",
    "britain",
    "great britain",
  ],
  EUR: [
    "austria",
    "belgium",
    "cyprus",
    "estonia",
    "finland",
    "france",
    "germany",
    "greece",
    "ireland",
    "italy",
    "latvia",
    "lithuania",
    "luxembourg",
    "malta",
    "netherlands",
    "holland",
    "portugal",
    "slovakia",
    "slovenia",
    "spain",
    "croatia",
    "guadeloupe",
    "martinique",
    "monaco",
    "andorra",
  ],
  CHF: ["switzerland", "liechtenstein"],
  NOK: ["norway"],
  SEK: ["sweden"],
  DKK: ["denmark"],
  PLN: ["poland"],
  CZK: ["czechia", "czech"],
  HUF: ["hungary"],
  RON: ["romania"],
  TRY: ["turkey", "turkiye"],
  UAH: ["ukraine"],
  RUB: ["russia", "russian federation"],
  AUD: ["australia"],
  NZD: ["new zealand"],
  FJD: ["fiji"],
  PGK: ["papua new guinea"],
  SBD: ["solomon islands"],
  VUV: ["vanuatu"],
  WST: ["samoa"],
  TOP: ["tonga"],
  XCD: [
    "antigua",
    "antigua barbuda",
    "dominica",
    "grenada",
    "st kitts nevis",
    "st kitts",
    "st lucia",
    "st vincent",
    "st vincent grenadines",
    "anguilla",
    "montserrat",
  ],
  BBD: ["barbados"],
  BSD: ["bahamas"],
  BMD: ["bermuda"],
  JMD: ["jamaica"],
  TTD: ["trinidad tobago", "trinidad"],
  GYD: ["guyana"],
  SRD: ["suriname"],
  BZD: ["belize"],
  HTG: ["haiti"],
  DOP: ["dominican republic"],
  CUP: ["cuba"],
  NIO: ["nicaragua"],
  CRC: ["costa rica"],
  GTQ: ["guatemala"],
  HNL: ["honduras"],
  BRL: ["brazil"],
  CLP: ["chile"],
  COP: ["colombia"],
  PEN: ["peru"],
  BOB: ["bolivia"],
  PYG: ["paraguay"],
  UYU: ["uruguay"],
  ARS: ["argentina"],
  VES: ["venezuela"],
  INR: ["india"],
  PKR: ["pakistan"],
  BDT: ["bangladesh"],
  LKR: ["sri lanka"],
  NPR: ["nepal"],
  MMK: ["myanmar", "burma"],
  THB: ["thailand"],
  KHR: ["cambodia"],
  LAK: ["laos"],
  VND: ["vietnam"],
  MYR: ["malaysia"],
  SGD: ["singapore"],
  BND: ["brunei"],
  IDR: ["indonesia"],
  PHP: ["philippines"],
  CNY: ["china"],
  HKD: ["hong kong"],
  MOP: ["macau", "macao"],
  TWD: ["taiwan"],
  JPY: ["japan"],
  KRW: ["korea", "south korea", "korea republic"],
  MNT: ["mongolia"],
  KZT: ["kazakhstan"],
  AFN: ["afghanistan"],
  AED: ["united arab emirates", "uae", "emirates", "dubai"],
  SAR: ["saudi arabia", "saudi"],
  QAR: ["qatar"],
  KWD: ["kuwait"],
  BHD: ["bahrain"],
  OMR: ["oman"],
  JOD: ["jordan"],
  LBP: ["lebanon"],
  ILS: ["israel"],
  IQD: ["iraq"],
  IRR: ["iran"],
};
export const COUNTRY_CURRENCY = Object.fromEntries(
  Object.entries(CURRENCIES).flatMap(([code, names]) =>
    names.map((name) => [countryKey(name), code]),
  ),
);
export const currencyFor = (country) =>
  COUNTRY_CURRENCY[countryKey(country)] || "";
// A rate is only usable if the provider succeeded and actually quotes it.
export function rateFor(rates, currency) {
  const value = rates?.rates?.[currency];
  return currency && currency !== "USD" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}
export function localAmount(usd, rate, currency, locale = "en-GB") {
  if (!rate) return "";
  const value = usd * rate;
  // Whole units above 100: nobody transfers 1,150.37 cedis.
  const digits = value >= 100 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}
export async function loadRates(fetcher = fetch, store = globalThis.localStorage) {
  try {
    const cached = JSON.parse(store?.getItem(RATES_KEY) || "null");
    if (cached && Date.now() - cached.fetchedAt < RATES_MAX_AGE) return cached;
  } catch {}
  try {
    const response = await fetcher(RATES_URL, { cache: "no-store" });
    const data = await response.json();
    if (data?.result !== "success" || !data.rates) throw Error("no rates");
    const value = {
      rates: data.rates,
      updated: data.time_last_update_utc || "",
      fetchedAt: Date.now(),
    };
    store?.setItem(RATES_KEY, JSON.stringify(value));
    return value;
  } catch {
    // No rate is better than a wrong one: the screen falls back to USD only.
    return null;
  }
}
