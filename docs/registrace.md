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
- Pravidla formuláře jsou v jednom souboru [src/lib/registration/schema.ts](../src/lib/registration/schema.ts). Používá je prohlížeč i server.
- Každá změna v tabulkách `registrations` a `athletes` se ukládá do `audit_log`, ať ji udělalo API, nebo někdo v dashboardu. Proto jde každou chybu vrátit.

| Termín                 | Co se děje                                                 |
| ---------------------- | ---------------------------------------------------------- |
| 1. 11. – 15. 12.       | registrace na webu                                         |
| 7. 12. – 15. 12.       | změna hmotnostní kategorie a dvojboje                      |
| 6. 12. ve 23:59        | první snímek startovky, zobrazí se od 7. 12.               |
| denně 23:59 do 16. 12. | aktualizace startovky                                      |
| 16. 12. ve 23:59       | finální startovka, zobrazí se 17. 12. se štítkem „Finální“ |

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
  registrationSection: 'auto', // sekce Registrace v menu a na stránce
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
- `'off'`: skryto nebo zavřeno.

Na produkci tak registrace ani startovka zatím nejsou vidět a objeví se samy v termínu. Na devu je vidět a jde vyzkoušet všechno hned. Kód je v obou prostředích stejný.

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

Do `applicationFormUrl` v [src/config/registration.ts](../src/config/registration.ts) vlož odkaz na Google Form. Dokud je prázdný, tlačítko se nezobrazí.

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
- Startovka obsahuje jen jméno, ročník, pohlaví, kategorii, dvojboj, tým, školu a soutěž. Kontakty ani datum narození nezveřejňuje.
- Skryté pole formuláře zachytí jednoduché boty. Server jim odpoví jako úspěch, ale nic neuloží.
