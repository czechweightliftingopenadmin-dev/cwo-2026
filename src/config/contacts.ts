/** Organizers shown in the Contact section, in the order of last year's site.
 *  Each role is translated in the locales under contact.roles. */
export const contacts = [
  {
    role: 'director',
    name: 'Mgr. Tereza Králová, Ph.D.',
    instagram: 'tekihammer',
    email: 'teki@email.cz',
  },
  {
    role: 'marketing',
    name: 'Mgr. Martin Kutý',
    instagram: 'coach_kuty_therapist',
    email: 'kuty.martin@seznam.cz',
  },
  {
    role: 'content',
    name: 'Ing. Tomáš Malcher',
    instagram: 'tommalcher.photo',
    email: 'malchertomm@gmail.com',
  },
] as const

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`
