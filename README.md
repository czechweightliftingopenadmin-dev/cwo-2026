# Czech Weightlifting Open 2026

Úvodní web pro CWO 2026. React, TypeScript (strict), Vite a Tailwind CSS. CZ/EN, dark/light režim, vertikální navigace, překlápěcí odpočet, mapa místa konání, registrace závodníků a startovní listina. Backend tvoří Vercel Functions v `api/` se Supabase a Resend. Bez fotografií minulých ročníků.

## Spuštění

Použij Node.js 24 LTS a npm.

```sh
npm ci
npm run dev
```

Web se spustí na `http://localhost:8080` a automaticky se otevře ve výchozím prohlížeči. Pokud je port 8080 obsazený, server ohlásí chybu místo přepnutí na jiný port. Prohlížečové testy sestaví produkční build a spustí nad ním `vite preview` na portu 4173 bez automatického otevírání prohlížeče.

## Kontroly a sestavení

```sh
npm run typecheck
npm run format:check
npm test
npm run build
npm run preview
```

Produkční soubory vzniknou v `dist/`. Pro testy v Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

GitHub Actions kontroluje formátování, typy, funkční testy, build a desktopovou i mobilní verzi v prohlížeči. Kód sjednotíš pomocí `npm run format`. Projekt zatím nemá automatické nasazení.

## Nasazení na Vercel

Web je veřejně dostupný na [czechweightliftingopen.cz](https://czechweightliftingopen.cz) i [www.czechweightliftingopen.cz](https://www.czechweightliftingopen.cz). Obě domény jsou přiřazené k projektu `cwo-2026` v týmu `cwo2`, takže další produkční nasazení aktualizuje i tyto adresy. Funguje také [cwo-2026.vercel.app](https://cwo-2026.vercel.app). Původní projekt `cwo-web-lepsi` zůstává dostupný na [cwo-web-lepsi-one.vercel.app](https://cwo-web-lepsi-one.vercel.app).

Konfigurace v `vercel.json` nastavuje Vite, instalaci přes `npm ci`, build přes `npm run build` a výstup `dist/`. Pro další ruční nasazení se přihlas do Vercel CLI účtem s přístupem k týmu a spusť:

```sh
vercel link --yes --project cwo-2026 --scope cwo2
vercel deploy --prod --scope cwo2
```

Místní propojení v `.vercel/` a soubory `.env.*` jsou ignorované Gitem. Vercel je napojený na GitHub: **push do `main` se nasadí na produkci**, push do `dev` na stálou dev adresu [cwo-2026-git-dev-cwo2.vercel.app](https://cwo-2026-git-dev-cwo2.vercel.app) s testovací databází. Podrobnosti jsou v [docs/registrace.md](docs/registrace.md).

## Registrace

Formulář, změnu registrace a startovní listinu obsluhují funkce v `api/`. Data ukládají do Supabase, potvrzení posílají přes Resend. Prohlížeč se k databázi nepřipojuje. Pravidla validace sdílí web i server v `src/lib/registration/schema.ts`, termíny, ceny a seznam škol jsou v `src/config/registration.ts`. Které sekce a formuláře jsou vidět nebo otevřené, přepíná `src/config/features.ts` (`'auto'` podle termínů, `'on'`, `'off'`). Databázi popisuje migrace v `supabase/migrations/`; testy ji spouštějí v PGlite (Postgres v paměti).

Nastavení služeb, správa dat, startovka, zálohy a obnova po chybě jsou popsané v [docs/registrace.md](docs/registrace.md). Lokální vývoj s API: `vercel env pull .env.local` a potom `vercel dev`. Samotné `npm run dev` spustí jen web; formulář se zobrazí, ale odeslání selže.

## Práce na jiném počítači

Tajné hodnoty nejsou v Gitu. Na novém počítači:

```sh
git clone https://github.com/czechweightliftingopenadmin-dev/cwo-2026.git
cd cwo-2026
git checkout dev
npm ci
npx vercel login                                  # účet czechweightliftingopenadmin-dev
npx vercel link --yes --project cwo-2026 --scope cwo2
npx vercel env pull .env.local                    # adresa a klíč dev databáze
npx vercel dev                                    # web i API, databáze cwo-dev
```

`.env.example` je šablona proměnných bez hodnot a je v Gitu. `.env.local` obsahuje skutečné hodnoty, Git ho ignoruje a existuje jen na daném počítači. `vercel env pull` ho přepíše, takže hesla databází si drž ve správci hesel a případně je do něj po stažení vlož znovu. Hesla jsou potřeba jen pro migrace (`npx supabase login` a `npx supabase link`) a ruční obnovu ze zálohy.

## Úpravy obsahu a vzhledu

- `src/config/event.ts`: rok, termín, název, město, adresa, souřadnice a CZ/EN název místa. Termín je 21.–22. 12. 2026. `dates.startsAt` nastavuje cíl odpočtu na 21. prosince v 00:00 českého času; neuvádí čas zahájení programu. `dates.endsAt` je půlnoc po posledním dni soutěže a `dates.timeZone` zajišťuje správné zobrazení data i návštěvníkům ze zahraničí. Při `dates: null` se odpočet skryje a zobrazí se oznámení termínu.
- `src/locales/cs.ts` a `src/locales/en.ts`: všechny texty a přístupné názvy ovládání. Anglické překlady mají stejnou strukturu kontrolovanou TypeScriptem.
- `src/config/competition.ts`: hmotnostní kategorie IWF pro seniory a juniory platné od 1. 8. 2026 a odkazy na pravidla. Texty soutěžních kategorií navazují na loňský web, včetně podmínek věku, otevření a slučování kategorií a členství ČSV pro AMČR.
- `src/styles.css`: designové tokeny pro oba režimy, rozvržení, CSS grafika a responzivní varianty. Bitcount Single a Inter se načítají lokálně z Fontsource včetně českých znaků.
- `public/favicon.ico`: původní favicon z [loňského webu](https://github.com/czechweightliftingopenadmin-dev/cwo_web_lepsi/blob/main/public/favicon.ico), převzatá beze změn. Odkaz je v `index.html`.
- Pro vlastní grafiku dej export do `public/artwork/` a v konfiguraci nastav například `bannerBackground: '/artwork/banner.webp'`. Obrázek je samostatná vrstva pozadí banneru; obsah a navigace zůstávají v HTML. Soubor musíš přidat do repozitáře. Použij grafiku bez vestavěných textů, které by se opakovaly nebo nešly přeložit.

## Chování navigace

Zavřený pás ukazuje název po písmenech ve svislých sloupcích. Iniciály C, W, O jsou o 20 % větší; modré jsou jen iniciály a rok. Na desktopu má pás stejnou šířku jako otevřená navigace a přechod mění pouze průhlednost a posun jednotlivých vrstev. Tlačítko menu zachovává stejnou výšku v obou stavech. Na počítači se menu otevře najetím myši nebo fokusem klávesnice. První kliknutí jej připne, další zavře. Na dotykových zařízeních funguje klepnutí na tlačítko i název. Escape, kliknutí mimo panel a výběr sekce jej zavřou. Výběr sekce přesune fokus do obsahu. Na mobilu menu překrývá stránku, neposouvá ji.

Animace respektují `prefers-reduced-motion`. Jazyk a vzhled se ukládají pod klíči `cwo:language` a `cwo:theme`; při nedostupném localStorage ovládání funguje pro aktuální návštěvu. Výchozí jazyk je čeština a vzhled dark. Uložený vzhled se aplikuje ještě před prvním vykreslením.

## Mapa a odpočet

Odpočet používá stejnou knihovnu jako loňský web: `@leenguyen/react-flip-clock-countdown`, s vlastními CSS proměnnými pro barvy a velikost a číslicemi v Bitcount Single. Je hlavním prvkem banneru: na desktopu zabírá 88 % šířky obsahu, na mobilu 94 % a čtyři jednotky se skládají do dvou řádků. Překlopení trvá 300 ms a zvýšená perspektiva omezuje vystupování karet z plochy. Po dosažení termínu se zobrazí stav probíhající soutěže; po skončení stav skončené soutěže. Animace respektují omezení pohybu.

Mapa používá OpenLayers a OpenStreetMap jako loňský web. Načítá se až při zobrazení sekce, má samostatný JS balík, styly pro oba režimy, vlastní značku a ovládání přiblížení. Kolečka myši neposouvají mapu během scrollování stránky. Zůstává viditelná atribuce OpenStreetMap i externí odkaz pro případ výpadku dlaždic. Prohlížečové testy dlaždice nahrazují místní odpovědí, takže nezávisí na externí službě. Souřadnice vycházejí z loňského webu; adresa je ověřena podle [mapy FSpS MU](https://www.fsps.muni.cz/mapa). Při změně místa aktualizuj adresu i souřadnice.

Sekce „O soutěži“ obsahuje pravidla a soutěžní řád ČSV: stejné PDF z roku 2019 jako loňský web, uložené v `public/documents/csv-technicka-a-soutezni-pravidla-2019.pdf`. Vydání je uvedeno přímo u odkazu; vedle něj je odkaz na aktuální pravidla na oficiálním webu IWF. Při aktualizaci PDF změň soubor, cestu v `src/config/competition.ts` i označení vydání v obou překladech.

Galerie, harmonogram, propozice AMČR, kontakty a loga partnerů se doplní později. Loňský web zůstává samostatný a tento projekt jej nemění.
