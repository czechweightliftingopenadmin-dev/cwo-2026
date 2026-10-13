// IWF senior/junior categories effective from 1 August 2026:
// https://iwf.sport/2025/11/03/bodyweight-categories-for-the-2028-olympics-in-los-angeles-are-defined/
export const bodyweightCategories = {
  women: ['49', '53', '57', '61', '69', '77', '86', '+86'],
  men: ['60', '65', '70', '75', '85', '95', '110', '+110'],
} as const

export const rulesDocuments = {
  csv: '/documents/csv-technicka-a-soutezni-pravidla-2019.pdf',
  iwf: 'https://iwf.sport/weightlifting_/rules/',
} as const
