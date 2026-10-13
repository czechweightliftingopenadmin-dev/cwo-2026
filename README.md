# Czech Weightlifting Open 2026

Úvodní web pro CWO 2026. React, TypeScript (strict), Vite a Tailwind CSS. CZ/EN, dark/light režim, vertikální navigace, překlápěcí odpočet a mapa místa konání. Bez backendu a bez fotografií minulých ročníků.

## Spuštění

Použij Node.js 24 LTS a npm.

```sh
npm ci
npm run dev
```

Web se spustí na `http://localhost:8080` a automaticky se otevře ve výchozím prohlížeči. Pokud je port 8080 obsazený, server ohlásí chybu místo přepnutí na jiný port. Prohlížečové testy používají vlastní server na portu 4173 bez automatického otevírání prohlížeče.

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

## Úpravy obsahu a vzhledu

- `src/config/event.ts`: rok, termín, název, město, adresa, souřadnice a CZ/EN název místa. Termín je 21.–22. 12. 2026. `dates.startsAt` nastavuje cíl odpočtu na 21. prosince v 00:00 českého času; neuvádí čas zahájení programu. `dates.endsAt` je půlnoc po posledním dni soutěže a `dates.timeZone` zajišťuje správné zobrazení data i návštěvníkům ze zahraničí. Při `dates: null` se odpočet skryje a zobrazí se oznámení termínu.
- `src/locales/cs.ts` a `src/locales/en.ts`: všechny texty a přístupné názvy ovládání. Anglické překlady mají stejnou strukturu kontrolovanou TypeScriptem.
- `src/config/competition.ts`: hmotnostní kategorie IWF pro seniory a juniory platné od 1. 8. 2026 a odkazy na pravidla. Texty soutěžních kategorií navazují na loňský web, včetně podmínek věku, otevření a slučování kategorií a členství ČSV pro AMČR.
- `src/styles.css`: designové tokeny pro oba režimy, rozvržení, CSS grafika a responzivní varianty. Bitcount Single a Inter se načítají lokálně z Fontsource včetně českých znaků.
- `public/favicon-2026.png` a `public/favicon-2026.ico`: minimalistický vzpěrač s činkou z tyrkysových a růžových teček, navazující na loňský motiv. ICO obsahuje velikosti 16, 32, 48, 64 a 256 px; zdroj a zadání úpravy jsou v [docs/favicon.md](docs/favicon.md).
- Pro vlastní grafiku dej export do `public/artwork/` a v konfiguraci nastav například `bannerBackground: '/artwork/banner.webp'`. Obrázek je samostatná vrstva pozadí banneru; obsah a navigace zůstávají v HTML. Soubor musíš přidat do repozitáře. Použij grafiku bez vestavěných textů, které by se opakovaly nebo nešly přeložit.

## Chování navigace

Zavřený pás ukazuje název po písmenech ve svislých sloupcích. Iniciály C, W, O jsou o 20 % větší; modré jsou jen iniciály a rok. Na desktopu má pás stejnou šířku jako otevřená navigace a přechod mění pouze průhlednost a posun jednotlivých vrstev. Tlačítko menu zachovává stejnou výšku v obou stavech. Na počítači se menu otevře najetím myši nebo fokusem klávesnice. První kliknutí jej připne, další zavře. Na dotykových zařízeních funguje klepnutí na tlačítko i název. Escape, kliknutí mimo panel a výběr sekce jej zavřou. Výběr sekce přesune fokus do obsahu. Na mobilu menu překrývá stránku, neposouvá ji.

Animace respektují `prefers-reduced-motion`. Jazyk a vzhled se ukládají pod klíči `cwo:language` a `cwo:theme`; při nedostupném localStorage ovládání funguje pro aktuální návštěvu. Výchozí jazyk je čeština a vzhled dark. Uložený vzhled se aplikuje ještě před prvním vykreslením.

## Mapa a odpočet

Odpočet používá stejnou knihovnu jako loňský web: `@leenguyen/react-flip-clock-countdown`, s vlastními CSS proměnnými pro barvy a velikost a číslicemi v Bitcount Single. Je hlavním prvkem banneru: na desktopu zabírá 88 % šířky obsahu, na mobilu 94 % a čtyři jednotky se skládají do dvou řádků. Překlopení trvá 300 ms a zvýšená perspektiva omezuje vystupování karet z plochy. Po dosažení termínu se zobrazí stav probíhající soutěže; po skončení stav skončené soutěže. Animace respektují omezení pohybu.

Mapa používá OpenLayers a OpenStreetMap jako loňský web. Načítá se až při zobrazení sekce, má samostatný JS balík, styly pro oba režimy, vlastní značku a ovládání přiblížení. Kolečka myši neposouvají mapu během scrollování stránky. Zůstává viditelná atribuce OpenStreetMap i externí odkaz pro případ výpadku dlaždic. Prohlížečové testy dlaždice nahrazují místní odpovědí, takže nezávisí na externí službě. Souřadnice vycházejí z loňského webu; adresa je ověřena podle [mapy FSpS MU](https://www.fsps.muni.cz/mapa). Při změně místa aktualizuj adresu i souřadnice.

Sekce „O soutěži“ obsahuje pravidla a soutěžní řád ČSV: stejné PDF z roku 2019 jako loňský web, uložené v `public/documents/csv-technicka-a-soutezni-pravidla-2019.pdf`. Vydání je uvedeno přímo u odkazu; vedle něj je odkaz na aktuální pravidla na oficiálním webu IWF. Při aktualizaci PDF změň soubor, cestu v `src/config/competition.ts` i označení vydání v obou překladech.

Registrace, galerie, startovní listiny, harmonogram, propozice AMČR, kontakty a loga partnerů se doplní později. Loňský web zůstává samostatný a tento projekt jej nemění.
