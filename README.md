# Czech Weightlifting Open 2026

Úvodní web pro CWO 2026. React, TypeScript (strict), Vite a Tailwind CSS. Vlastní komponenty, CZ/EN, dark/light režim a rozbalovací vertikální navigace. Bez backendu a bez fotografií minulých ročníků.

## Spuštění

Použij Node.js 24 LTS a npm.

```sh
npm ci
npm run dev
```

Vite vypíše lokální adresu, standardně `http://127.0.0.1:5173`.

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

- `src/config/event.ts`: rok, termín, název, město a CZ/EN název místa. Dokud je `date: null`, web oznamuje, že termín bude doplněn.
- `src/locales/cs.ts` a `src/locales/en.ts`: všechny texty a přístupné názvy ovládání. Anglické překlady mají stejnou strukturu kontrolovanou TypeScriptem.
- `src/styles.css`: designové tokeny pro oba režimy, rozvržení, CSS grafika a responzivní varianty. Bitcount Single a Inter se načítají lokálně z Fontsource včetně českých znaků.
- Pro vlastní grafiku dej export do `public/artwork/` a v konfiguraci nastav například `bannerBackground: '/artwork/banner.webp'`. Obrázek je samostatná vrstva pozadí banneru; obsah a navigace zůstávají v HTML. Soubor musíš přidat do repozitáře. Použij grafiku bez vestavěných textů, které by se opakovaly nebo nešly přeložit.

## Chování navigace

Zavřený pás ukazuje název po písmenech ve svislých sloupcích. Na počítači se otevře najetím myši nebo fokusem klávesnice. První kliknutí jej připne, další zavře. Na dotykových zařízeních funguje klepnutí. Escape, kliknutí mimo panel a výběr sekce jej zavřou. Výběr sekce přesune fokus do obsahu. Menu překrývá stránku, neposouvá ji.

Animace respektují `prefers-reduced-motion`. Jazyk a vzhled se ukládají pod klíči `cwo:language` a `cwo:theme`; při nedostupném localStorage ovládání funguje pro aktuální návštěvu. Výchozí jazyk je čeština a vzhled dark. Uložený vzhled se aplikuje ještě před prvním vykreslením.

Registrace, galerie, startovní listiny, harmonogram, dokumenty, kontakty a loga partnerů nejsou součástí první verze. Termín a další podklady se doplní později. Loňský web zůstává samostatný a tento projekt jej nemění.
