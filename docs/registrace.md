# Registrace CWO 2026: nastavení a správa

Návod pro organizátory a správce webu. Popisuje nastavení služeb, běžnou správu, startovní listinu, zálohy a opravy chyb.

## Jak to funguje

```
Prohlížeč ──POST──▶ /api/* (Vercel Functions) ──▶ Supabase Postgres
                         └──▶ Resend (e-maily)
pg_cron v Supabase ──každý večer──▶ snímek startovky
GitHub Actions ──každou noc──▶ záloha do privátního repa
```

- Formulář na webu posílá data jen na vlastní API (`api/`). Prohlížeč se k databázi nepřipojuje, takže z webu nejde nic přečíst ani přepsat.
- Jedna faktura patří 1–4 lidem: týmu, nebo několika jednotlivcům, třeba z jednoho klubu. Na fakturu jde víc registrací, dohromady nejvýš `invoiceMaxAthletes` (4) lidí, a stejný člověk (stejný e-mail, nebo jméno a datum narození) na ní nemůže být dvakrát. Při změně registrace se podle faktury a e-mailu najdou všechny registrace na faktuře, ve kterých ten e-mail je.
- Napříč celou databází má závodník s totožným jménem, příjmením, datem narození **a** e-mailem nejvýš jednu aktivní registraci. Jména se porovnávají bez rozdílů ve velikosti písmen, s normalizovaným Unicode a mezerami; diakritika se zachovává. E-mail se ořízne a převede na malá písmena. Samotný shodný e-mail nebo jméno mimo stejnou fakturu nestačí ke sloučení různých lidí. Duplicitní zápis se odmítne, nic se automaticky nepřepisuje.
- **Změna registrace:** faktura i původní kód fungují spolu s e-mailem. Přidání CWO k AM ČR vyžaduje zaplacenou fakturu a tričko; přidání AM ČR k CWO vyžaduje školu. Jde o aktualizaci původního závodníka, nikoliv další registraci. Původní kód zůstane platný i po doplnění faktury. Stejně lze během registrace opravit školu a tričko; jméno, kontakty, fakturu, složení týmu a zrušení účasti řeší pořadatel.
- Všichni závodníci z jednoho požadavku se mění v jedné transakci. Databáze znovu ověří přístup, aktuální účast, povinné údaje a kapacitu faktury pod zámky. Při chybě se neuloží ani část požadavku. Opakování stejné úspěšné změny nic znovu nevytváří ani neposílá další e-mail.
- Při chybě serveru, spojení, validace nebo plné faktuře se vyplněný formulář zachová. Nová registrace navíc dál používá stávající lokální koncept, který se smaže až po potvrzeném uložení. Když selže pouze e-mail po úspěšném zápisu, web ukáže uloženou registraci s upozorněním, nikoliv neúspěšné uložení.
- Pravidla formuláře jsou v jednom souboru [src/lib/registration/schema.ts](../src/lib/registration/schema.ts). Používá je prohlížeč i server.
- Každá změna v tabulkách `registrations` a `athletes` se ukládá do `audit_log`, ať ji udělalo API, nebo někdo v dashboardu. Proto jde každou chybu vrátit.

| Termín                 | Co se děje                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| 1. 11. – 15. 12.       | registrace na webu                                               |
| 1. 11. – 15. 12.       | přidání CWO/AM ČR, úprava školy a trička u existující registrace |
| 7. 12. – 15. 12.       | změna hmotnostní kategorie a dvojboje                            |
| 6. 12. ve 23:59        | první snímek startovky, zobrazí se od 7. 12.                     |
| denně 23:59 do 16. 12. | aktualizace startovky                                            |
| 16. 12. ve 23:59       | finální startovka, zobrazí se 17. 12. se štítkem „Finální“       |

Termíny jsou v [src/config/registration.ts](../src/config/registration.ts). Server je hlídá sám, frontend je jen zobrazuje. Časy startovky nastavuje plán `cwo-startlist` v migraci.

## Prostředí: dev a produkce

| Prostředí    | Adresa                                                                                     | Databáze                   | Přepínače    |
| ------------ | ------------------------------------------------------------------------------------------ | -------------------------- | ------------ |
| **Produkce** | czechweightliftingopen.cz (větev `main`)                                                   | `cwo-prod`                 | `production` |
| **Dev**      | [cwo-2026-git-dev-cwo2.vercel.app](https://cwo-2026-git-dev-cwo2.vercel.app) (větev `dev`) | `cwo-dev`                  | `testing`    |
| **Lokálně**  | `vercel dev`                                                                               | `cwo-dev` (z `.env.local`) | `testing`    |

- Vercel je napojený na GitHub. **Push do `main` se nasadí rovnou na produkci**, push do `dev` (nebo jiné větve) vytvoří preview s databází `cwo-dev`.
- Dev adresa je stálá a **veřejná**, aby ji mohli zkoušet i kolegové bez účtu ve Vercelu: ochrana preview nasazení (Vercel Authentication) je vypnutá. Vyhledávače preview nasazení neindexují. Dev web má nahoře žlutý pruh „Testovací verze“, aby si ho nikdo nespletl s ostrou registrací.
- Dev databáze `cwo-dev` proto nesmí obsahovat skutečná osobní data. Po zkoušce obnovy ze zálohy produkce dev hned vyčisti.
- Postup: práce jde do `dev`, otestuje se na dev adrese a pak se `dev` mergne do `main`.
- Databázi vybírají proměnné prostředí ve Vercelu (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`). Přepínače vybírá `VERCEL_ENV` na serveru a `VITE_DEPLOY_ENV=production` (nastavené jen pro produkci) na stránce.

## Přepínače: co je vidět a co je otevřené

[src/config/features.ts](../src/config/features.ts) má dva configy, jeden pro každé prostředí:

```ts
const production = {
  registrationSection: 'on', // sekce Registrace v menu a na stránce
  registrationForm: 'auto', // registrační formulář
  editForm: 'auto', // změna kategorie a dvojboje
  startlist: 'auto', // sekce Startovní listina
}
const testing = {
  registrationSection: 'on',
  registrationForm: 'on',
  editForm: 'on',
  startlist: 'on',
}
```

- `'auto'`: podle termínů (registrace 1. 11. – 15. 12., změny 7. – 15. 12., startovka od 7. 12.).
- `'on'`: zobrazeno nebo otevřeno hned, bez ohledu na datum.
- `'off'`: skryto nebo zavřeno. `editForm: 'off'` zavře všechny změny. `registrationForm: 'off'` zavře nové registrace, přidávání soutěží a úpravy školy/trička; kategorie a dvojboj se dále řídí `editForm`.

Na produkci je sekce Registrace vidět hned (postup a startovné). Formuláře a tlačítko „Registrace“ v úvodu se objeví samy 1. 11., do té doby sekce ukazuje, kdy se registrace otevře. Startovka se objeví sama 7. 12. Na devu je vidět a jde vyzkoušet všechno hned. Kód je v obou prostředích stejný.

Skrytá sekce zmizí ze stránky i z menu a čísla ostatních sekcí se posunou. Formuláře se podle stejného souboru otevírají i na serveru: `registrationForm: 'on'` znamená, že registraci jde opravdu odeslat. Po změně stačí změnu nasadit (merge do `main`).

## Jednorázové nastavení

### 1. Supabase (zdarma, 2 projekty)

1. Na [supabase.com](https://supabase.com) založ projekty `cwo-dev` (vývoj a náhledy) a `cwo-prod` (ostrý web). Region: Central EU (Frankfurt).
   Při zakládání nech **Enable Data API** zapnuté, **Automatically expose new tables** vypni a **Enable automatic RLS** zapni. Migrace přidělí práva jen roli `service_role`, pod kterou běží API.
2. V každém projektu otevři **SQL Editor**, vlož celý obsah [supabase/migrations/20261022000000_registration.sql](../supabase/migrations/20261022000000_registration.sql) a spusť ho. Se Supabase CLI to jde i takto: `supabase link --project-ref <ref>` a potom `supabase db push`.
3. Kontrola: v **Table Editor** jsou tabulky `registrations`, `athletes`, `audit_log`, `email_log`, `lookup_attempts`, `startlist_snapshots`. V SQL editoru `select * from cron.job;` vrátí úlohu `cwo-startlist`.
4. **Project Settings → API**: zkopíruj Project URL a **secret** klíč (`sb_secret_…`, ve starším rozhraní `service_role`). Klíč nikdy nepatří do kódu ani do proměnných `VITE_…`.

Free tier se po 7 dnech bez aktivity uspí. Noční záloha se k databázi připojuje každý den, takže k tomu nedojde.

### 2. Resend (zdarma: 3 000 e-mailů měsíčně, 100 denně)

1. Na [resend.com](https://resend.com) přidej doménu `czechweightliftingopen.cz` (**Domains → Add domain**, region EU).
2. Resend ukáže DNS záznamy. **DNS domény spravuje Webglobe**, ne Vercel, takže je přidá ten, kdo má přístup do administrace Webglobe:
   - TXT `resend._domainkey` (DKIM),
   - MX a TXT (SPF) pro subdoménu `send`,
   - doporučený TXT `_dmarc` s hodnotou `v=DMARC1; p=none;`.

   Existující pošta na Webglobe (MX a SPF hlavní domény) se **nemění**.

3. Po ověření domény vytvoř API klíč s oprávněním **Sending access**.

Než bude doména ověřená, posílá Resend jen na e-mail účtu. Pro testování na `cwo-dev` to stačí.

### 3. Vercel: proměnné prostředí

**Project `cwo-2026` → Settings → Environment Variables:**

| Proměnná              | Production | Preview a Development |
| --------------------- | ---------- | --------------------- |
| `SUPABASE_URL`        | cwo-prod   | cwo-dev               |
| `SUPABASE_SECRET_KEY` | cwo-prod   | cwo-dev               |
| `RESEND_API_KEY`      | klíč       | klíč                  |

Odesílatel (`info@czechweightliftingopen.cz`) a volitelná adresa pro odpovědi (Reply-To) jsou v `emailSettings` v [src/config/registration.ts](../src/config/registration.ts). Dokud není doména v Resendu ověřená, jde na dev a preview nastavit `EMAIL_FROM=onboarding@resend.dev`; Resend pak posílá jen na e-mail svého účtu. Odpovědi na potvrzení chodí do schránky `info@` u Webglobe, takže ta musí existovat. Resend z ní jen odesílá a do schránky nezasahuje, takže jde dál používat i pro jiné e-maily.

Po změně proměnných je potřeba nové nasazení. Šablona je v [.env.example](../.env.example). Lokálně: `vercel env pull .env.local` a potom `vercel dev`.

### 4. Zálohy a zkouška obnovy (GitHub, zdarma)

Nastaveno 22. 10. 2026:

- Zálohy jdou do **privátního** repa [czechweightliftingopenadmin-dev/cwo-2026-backups](https://github.com/czechweightliftingopenadmin-dev/cwo-2026-backups), do složek `prod/<datum>/` a `dev/<datum>/`.
- Každá záloha obsahuje:
  - `database.sql.gz`: schéma a data, pro dohledání,
  - `data.sql.gz`: jen data, pro obnovu,
  - `registrace.csv` a `audit_log.csv`, které jdou otevřít v Excelu.
- Skripty jsou v [scripts/backup/](../scripts/backup/) a stejně jdou spustit i lokálně (Docker, `postgres:17`).
- Workflow do repa se zálohami zapisuje přes **deploy klíč** s právem zápisu jen do tohoto repa. Na rozdíl od tokenu nevyprší.
- V repu `cwo-2026` jsou v **Settings → Secrets and variables → Actions** tyto secrets:
  - `SUPABASE_DB_URL` (`cwo-prod`) a `SUPABASE_DB_URL_DEV` (`cwo-dev`): session pooler connection string včetně hesla,
  - `BACKUP_REPO`: `czechweightliftingopenadmin-dev/cwo-2026-backups`,
  - `BACKUP_DEPLOY_KEY`: soukromá část deploy klíče.
- Po změně hesla databáze aktualizuj příslušný `SUPABASE_DB_URL…`. Při úniku klíče smaž deploy klíč v repu se zálohami, vygeneruj nový (`ssh-keygen -t ed25519`), veřejnou část přidej jako deploy klíč s právem zápisu a soukromou ulož do `BACKUP_DEPLOY_KEY`.

| Workflow                       | Kdy běží                         | Co dělá                                                                                      |
| ------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| **Back up registrations**      | každou noc ve 3:30               | záloha `cwo-prod`                                                                            |
|                                | ručně (Run workflow, `target`)   | záloha `cwo-prod` nebo `cwo-dev`                                                             |
|                                | push do `dev`, který mění zálohy | záloha `cwo-dev` a **kontrola obnovy**: tutéž zálohu obnoví do `cwo-dev` a porovná otisk dat |
| **Restore drill into cwo-dev** | ručně (`source`, `date`)         | obnoví vybranou zálohu (dev nebo prod) do `cwo-dev`. Produkce se nikdy nemění.               |

Ruční spuštění (Run workflow) jde až ve chvíli, kdy jsou workflow ve větvi `main`. Na větvi `dev` je zkouší push.

### 5. Odkaz na přihlášku

`applicationFormUrl` v [src/config/registration.ts](../src/config/registration.ts) vede na [Google přihlášku CWO 2026](https://forms.gle/sq6Bbdaxo1xmtaJN7). Postup má dva hlavní kroky:

Tlačítko „Registrace“ v úvodním banneru odscrolluje do sekce Registrace, kde se cesta rozdělí:

1. **Přihláška a platba:** závodník vyplní Google formulář, dostane fakturu a zaplatí ji podle pokynů. Hlavní tlačítko v prvním kroku vede přímo na Google formulář v nové kartě, takže se sem může vrátit.
2. **Doplnění údajů na webu:** po zaplacení zadá číslo faktury a údaje k závodu do našeho formuláře. Odeslání Google přihlášky tento krok nenahrazuje. Tlačítko „Už mám zaplaceno — doplnit údaje“ vede k tomuto kroku; odkaz u popisu přepne i ze záložky změn zpět na nový formulář.

Samotné AM ČR zůstává bez Google přihlášky a faktury: závodník použije rovnou náš formulář. Účast i v CWO vyžaduje oba kroky. Náš formulář kontroluje formát čísla faktury; neověřuje úhradu v účetnictví.

Externí přihláška je dostupná přes tlačítka během přihlašovacího období. Doplnění údajů zůstává dostupné až do uzavření našeho formuláře; stávající termíny i přepínače se nemění. Texty postupu jsou česky i anglicky v `src/locales/`.

### 6. Dostupnost Supabase bez testovacích registrací

[Supabase Free může projekt pozastavit při nízké aktivitě za posledních 7 dní](https://supabase.com/docs/guides/platform/free-project-pausing). Několik databázových požadavků denně podle dokumentace obvykle stačí; samotný požadavek jednou za 5 dní není spolehlivá záruka. Placený tarif uspávání kvůli neaktivitě nepoužívá.

Workflow **Check database availability** v [.github/workflows/database-health.yml](../.github/workflows/database-health.yml) každých 6 hodin ověří čtení tabulky `registrations` v `cwo-prod` i `cwo-dev`. Dotaz funguje i v prázdné databázi, přečte nejvýš jeden řádek a výsledek nezapisuje do logu. Spojení má vynucený režim pouze pro čtení. Nevznikají falešní závodníci, e-maily ani záznamy v auditu či startovce. Používá existující secrets `SUPABASE_DB_URL` a `SUPABASE_DB_URL_DEV`, stejně jako zálohy.

Plán se aktivuje až po začlenění workflow do výchozí větve `main`; potom jde spustit i ručně přes **Actions → Check database availability → Run workflow**. Po třech neúspěšných pokusech běh selže. Už pozastavený projekt je potřeba nejprve ručně obnovit v Supabase Dashboardu. Pravidelné čtení pomáhá udržet aktivitu a kontrolovat dostupnost, ale nenahrazuje záruky placeného tarifu. Kontroluj také, že GitHub plánované běhy dál spouští.

## Test před spuštěním

Na dev adrese (větev `dev`, databáze `cwo-dev`, všechny přepínače zapnuté):

1. Zaregistruj jednotlivce, tým se 3 a se 4 členy a AM ČR bez faktury.
2. Zkontroluj e-maily a záznamy v `registrations_overview` a `email_log`.
3. Zaregistruj na stejnou fakturu dva jednotlivce, pak téhož člověka znovu (stejný e-mail nebo jméno a datum narození) a nakonec pátého člověka. Druhý a třetí pokus musí skončit hláškou.
4. V záložce Změna registrace změň kategorii a dvojboj a zkontroluj e-mail se změnou.
5. V SQL editoru spusť `select publish_startlist_snapshot();` a zkontroluj startovku.
6. Spusť zálohu devu (**Back up registrations**, `target: dev`) a potom **Restore drill into cwo-dev** se `source: dev`. Data musí zůstat stejná.

## Běžná správa

### Kde jsou data

- **Table Editor → `registrations_overview`**: všechno v jedné tabulce, jeden řádek na závodníka. **Export → CSV** se otevře v Excelu i Google Sheets.
- `registrations`: jedna registrace (jednotlivec nebo tým), faktura, kód, stav a interní poznámka `note`.
- `athletes`: závodníci.
- `email_log`: odeslané a neodeslané e-maily.

### Úpravy

Závodník použije záložku **Změna registrace**, fakturu nebo původní kód a svůj e-mail. Všichni nalezení členové týmu se zobrazí samostatně. Už přidané soutěže se nedají odškrtnout; před uložením je možné nově vybranou soutěž zase odškrtnout. Faktura se zadává jen při přidání CWO k původní registraci bez CWO. Už uložená faktura se tímto formulářem nepřepisuje.

- **Oprava údajů** (jméno, e-mail, výměna člena týmu): uprav řádek v `athletes` v Table Editoru. Změna se zapíše do `audit_log` se zdrojem `dashboard`.
- **Zrušení registrace**: v `registrations` nastav `status` na `cancelled`. **Nemaž řádky.** Zrušená registrace zmizí ze startovky a uvolní svá místa na faktuře.
- **Nový e-mail s potvrzením** (po neúspěšném odeslání nebo po opravě): `npm run email:resend -- 12345678`, případně s kódem `AM-ABCD-EFGH`. Potřebuje `.env.local` s produkčními klíči.
- **Neodeslané e-maily**: `select * from email_log where status = 'failed' order by created_at desc;`

### Startovní listina

- Snímek se dělá automaticky. Ruční zveřejnění, třeba po opravě chyby: `select publish_startlist_snapshot();`, finální verze: `select publish_startlist_snapshot(true);`.
- Web zobrazuje vždy poslední snímek. Data se do něj dostanou až dalším snímkem, takže je čas chyby opravit dřív, než se ukážou veřejně.
- Kontrola plánovače: `select * from cron.job_run_details order by start_time desc limit 5;`

### Změna termínů

1. Uprav data v [src/config/registration.ts](../src/config/registration.ts) a nasaď web.
2. Pokud se mění startovka, uprav i plán v SQL editoru:
   ```sql
   select cron.schedule('cwo-startlist', '59 22 6-16 12 *',
     $$select public.publish_startlist_snapshot(
       (now() at time zone 'Europe/Prague')::date >= date '2026-12-16')$$);
   ```
   Čas je v UTC. V prosinci platí 22:59 UTC = 23:59 v Praze.

## Když se něco pokazí

### Vrácení jedné změny

1. Najdi změnu v historii:
   ```sql
   select id, table_name, action, source, changed_at, old_data, new_data
   from audit_log order by id desc limit 50;
   ```
   Hledat jde i podle závodníka: `where old_data ->> 'last_name' = 'Nováková'`.
2. Vrať stav před ní: `select restore_from_audit(<id>);`

Smazanou registraci vracej v pořadí: nejdřív řádek `registrations` (`action = 'DELETE'`), potom její řádky `athletes`.

### Hromadná chyba

- Před každou hromadnou úpravou spusť zálohu ručně: **Actions → Back up registrations → Run workflow**.
- Rychlá obnova několika řádků: CSV z privátního repa (`registrace.csv`, `audit_log.csv`).
- Úplná obnova produkce ze zálohy (jen data, schéma zůstává z migrací). Napřed si obnovu vyzkoušej na devu přes **Restore drill into cwo-dev** se `source: prod`. Pak lokálně:
  ```sh
  docker run --rm -e DB_URL="<connection string cwo-prod>" -v "$PWD/scripts/backup:/scripts:ro" \
    -v "<složka se zálohou>:/backup:ro" postgres:17 bash /scripts/restore.sh '$DB_URL' /backup
  ```
  Obnova nahradí všechna data registrací v jedné transakci.
- Když je zničený celý projekt: založ nový, nahraj migrace (`supabase db push`), obnov data stejným příkazem a ve Vercelu přepni `SUPABASE_URL` a `SUPABASE_SECRET_KEY` na nový projekt.

### Nouzové zavření registrace

V [src/config/features.ts](../src/config/features.ts) nastav v configu `production` hodnotu `registrationForm: 'off'` (případně i `editForm: 'off'`) a nasaď (push do `main`, v nouzi `vercel deploy --prod --scope cwo2`). Server od té chvíle registrace odmítá.

## Ochrana a soukromí

- Změna registrace vyžaduje číslo faktury nebo kód registrace **a** e-mail některého závodníka v registraci. Při neúspěchu server neprozradí, která z těch dvou věcí nesedí. Pokusy jsou omezené na 10 za 15 minut z jedné adresy.
- O každé změně přijde e-mail všem závodníkům v registraci.
- Startovka obsahuje jen jméno, pohlaví, kategorii, dvojboj, tým, školu a soutěž. Kontakty ani datum či rok narození nezveřejňuje (snímek v databázi rok narození má, API ho vynechává).
- Skryté pole formuláře zachytí jednoduché boty. Server jim odpoví jako úspěch, ale nic neuloží.

## Nasazení změn registrací a ochrany duplicit

1. Před změnou schématu udělej zálohu. Nejdřív ověř změnu na `cwo-dev`.
2. Aplikuj novou migraci [20261030000000_registration_changes.sql](../supabase/migrations/20261030000000_registration_changes.sql) po předchozích migracích. Pro dev ji workflow **Back up registrations** po pushi změn migrace nebo zálohovacích skriptů zavede automaticky: nejdřív uloží zálohu do privátního repozitáře, spustí SQL v jedné transakci, udělá novou zálohu a ověří obnovu. Použije výhradně `SUPABASE_DB_URL_DEV`. Skript [apply-registration-changes.sh](../scripts/backup/apply-registration-changes.sh) již zavedenou funkci a unikátní index rozpozná a migraci neopakuje. Produkční schéma se tím nemění. Při zavádění nové verze pošli nejdřív zpětně kompatibilní databázovou migraci, počkej na úspěšné dokončení workflow a až potom pošli nové API a web. Pro produkci aplikuj SQL zvlášť před mergem aplikace do `main`. Pokud používáš evidenci migrací Supabase CLI, u ručně aplikovaného SQL ji také slaď. Samotný deploy webu schéma neaktualizuje.
3. Pokud migrace ohlásí `Duplicate active athletes exist`, zastaví se. Projdi shodné jméno, příjmení, datum narození a e-mail v `registrations_overview`; ověř, která registrace má zůstat aktivní. Nic automaticky nemaž ani neslučuj. U týmu nepozastavuj celou registraci bez kontroly ostatních členů. Po ručním vyřešení migraci zopakuj.
4. Vyzkoušej AM ČR → CWO, CWO → AM ČR, kód i fakturu s e-mailem, chybné přihlášení, plnou fakturu a opakované odeslání. Ověř, že zůstává stejný identifikátor závodníka a jeden řádek ve startovce. Změny se ve veřejné startovce objeví až v dalším snímku.
5. Ověř zálohu a obnovu. Nový sloupec `athletes.registration_active` je odvozený z `registrations.status`: ručně ho neměň. Triggery jej udržují i při změně stavu v dashboardu a obnově z auditu. Aktualizovaný `restore.sh` jej po načtení zálohy přepočítá v rámci téže transakce; funguje i se staršími zálohami bez tohoto sloupce. Obnova s konfliktními aktivními identitami bezpečně selže a vrátí celou transakci.

Databázový unikátní index `athletes_active_identity_key` chrání i souběžná odeslání a přímé úpravy v dashboardu. Zrušená registrace identitu uvolní; její opětovná aktivace narazí na chybu, pokud už existuje jiná aktivní registrace stejného člověka. Funkce pro změny a načítání soukromých údajů jsou dostupné pouze serverové roli `service_role`.
