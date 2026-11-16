/** Nationalities offered in the form, as ISO 3166-1 alpha-3 codes (CZE, SVK, DEU…), which are
 *  stored with each athlete and shown in the start list. Each maps to its alpha-2 code, which
 *  Intl.DisplayNames needs for the name in the page language.
 *
 *  A realistic list, not every territory: Europe, its neighbours, and the countries that
 *  students commonly come from, e.g. on Erasmus. Add a line here when someone needs another
 *  country; organisers can store any three-letter code in Supabase by hand.
 *
 *  ISO differs from IOC sports codes for some countries: DEU, not GER; NLD, not NED;
 *  CHE, not SUI. XKX (Kosovo) is not in ISO 3166 yet but is widely used. */
// prettier-ignore
export const countries = {
  // European Union
  AUT: 'AT', BEL: 'BE', BGR: 'BG', CYP: 'CY', CZE: 'CZ', DEU: 'DE', DNK: 'DK', ESP: 'ES',
  EST: 'EE', FIN: 'FI', FRA: 'FR', GRC: 'GR', HRV: 'HR', HUN: 'HU', IRL: 'IE', ITA: 'IT',
  LTU: 'LT', LUX: 'LU', LVA: 'LV', MLT: 'MT', NLD: 'NL', POL: 'PL', PRT: 'PT', ROU: 'RO',
  SVK: 'SK', SVN: 'SI', SWE: 'SE',
  // Rest of Europe
  ALB: 'AL', AND: 'AD', BIH: 'BA', BLR: 'BY', CHE: 'CH', GBR: 'GB', ISL: 'IS', LIE: 'LI',
  MCO: 'MC', MDA: 'MD', MKD: 'MK', MNE: 'ME', NOR: 'NO', RUS: 'RU', SMR: 'SM', SRB: 'RS',
  TUR: 'TR', UKR: 'UA', XKX: 'XK',
  // Caucasus and Central Asia
  ARM: 'AM', AZE: 'AZ', GEO: 'GE', KAZ: 'KZ', KGZ: 'KG', TJK: 'TJ', TKM: 'TM', UZB: 'UZ',
  // Middle East and North Africa
  ARE: 'AE', DZA: 'DZ', EGY: 'EG', IRN: 'IR', IRQ: 'IQ', ISR: 'IL', JOR: 'JO', LBN: 'LB',
  MAR: 'MA', SAU: 'SA', SYR: 'SY', TUN: 'TN',
  // Rest of Asia
  BGD: 'BD', CHN: 'CN', IDN: 'ID', IND: 'IN', JPN: 'JP', KOR: 'KR', LKA: 'LK', MNG: 'MN',
  MYS: 'MY', NPL: 'NP', PAK: 'PK', PHL: 'PH', SGP: 'SG', THA: 'TH', TWN: 'TW', VNM: 'VN',
  // Americas
  ARG: 'AR', BRA: 'BR', CAN: 'CA', CHL: 'CL', COL: 'CO', CUB: 'CU', ECU: 'EC', MEX: 'MX',
  PER: 'PE', URY: 'UY', USA: 'US', VEN: 'VE',
  // Africa and Oceania
  AUS: 'AU', ETH: 'ET', GHA: 'GH', KEN: 'KE', NGA: 'NG', NZL: 'NZ', ZAF: 'ZA',
} as const

export type CountryCode = keyof typeof countries

export const countryCodes = Object.keys(countries) as [CountryCode, ...CountryCode[]]

/** Shown first in the picker: most athletes come from here. */
export const commonCountries: readonly CountryCode[] = ['CZE', 'SVK']
