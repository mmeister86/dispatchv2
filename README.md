# Dispatch · Convex foundation

React/Vite-Oberfläche mit realer Better-Auth-Anmeldung und normalisierten Convex-Daten für Benutzer, Workspaces, Mitgliedschaften und Profile. Der Standardmodus enthält keine vorbefüllten Social-Accounts. Die vorhandene UI-Demo bleibt ausdrücklich optional.

## Starten

```sh
pnpm install
cp -n .env.example .env.local
pnpm dev
```

Ohne konfigurierte Convex-Verbindung öffnen sich die öffentlichen Seiten; geschützte Routen zeigen die fehlende Konfiguration. Für den realen Workspace die öffentlichen URLs der vorhandenen Entwicklungsdeployment in `.env.local` eintragen. Die Datei wird ignoriert. Die App ist unter `http://localhost:5173` erreichbar; für eine lokale SITE_URL wird ausschließlich der Alias `127.0.0.1` am selben Port zusätzlich erlaubt.

## Backend und Anmeldung

Auf der **Convex-Deployment**, niemals als `VITE_*`, konfigurieren:

- `SITE_URL`: exakte Frontend-Origin, lokal `http://localhost:5173`.
- `BETTER_AUTH_SECRET`: zufälliges Secret mit mindestens 32 Zeichen.
- `RESEND_API_KEY` und optional `AUTH_EMAIL_FROM`: verifizierter Resend-Absender. Ohne `AUTH_EMAIL_FROM` wird `Dispatch <onboarding@resend.dev>` verwendet; dieser Testabsender darf nur an die vom Resend-Konto erlaubten Empfänger senden. Echte Zustellung an beliebige Nutzer ist damit noch nicht abgenommen.
- Optional `GITHUB_CLIENT_ID` und `GITHUB_CLIENT_SECRET`: separate GitHub-OAuth-App für **Anmeldung**; Callback `https://<deployment>.convex.site/api/auth/callback/github`. GitHub-App-ID/Installation für Repository-Zugriff ersetzen diese OAuth-Credentials nicht. Ohne beide Variablen bleibt die Social-Anmeldung sichtbar deaktiviert.

```sh
pnpm exec convex dev --once
```

E-Mail/Passwort erfordert eine bestätigte E-Mail. Verifikation und Passwort-Reset verwenden echte Better-Auth-Endpunkte und Resend. Reset-Links sind einmalig; ein erfolgreicher Reset widerruft bestehende Sitzungen. Nach Login bleibt der angeforderte interne Pfad erhalten. Logout beendet die Serversitzung. Keine Repository- oder Publishing-Berechtigung entsteht durch GitHub-Login.

Die erste verifizierte Anmeldung legt Benutzer, Standard-Workspace, Owner-Mitgliedschaft und Profil in **einer idempotenten Transaktion** an. Sprache, Zeitzone, Projekt, Zielgruppe, Tonalität, Themen und Onboarding-Fortschritt werden in getrennten Tabellen gespeichert. Rollen werden aus serverseitigen Mitgliedschaften abgeleitet. Queries/Mutationen prüfen Identität, Workspace, Rolle und fremde Referenzen zentral in `convex/lib/authorization.ts`.

Die vorhandene Navigation und Seitengestaltung bleiben bestehen. Übersicht, Profil, Workspaces und Onboarding sind im realen Modus nutzbar; weitere Module zeigen bis zu ihrer Backend-Anbindung einen klaren Leerzustand. Die Übergangs-APIs `setState`, `mutate`, `createDraft` und `ideaToDraft` bestätigen im realen Modus keine Speicherung. Neue Module müssen explizite, **awaitete** Convex-Commands erhalten. Kein gesamter Client-AppState wird als autoritativer Blob gespeichert; Modul-Businessdaten werden nicht aus lokalem Demo-Speicher eingelesen.

Better Auth 1.6.33 ist gepatcht und mit der Peer-Range der Convex-Komponente 0.12.5 kompatibel. Deren generischer React-Typ verliert unter dieser Version `getSession`; zwei schmale Typadapter in `src/lib/auth-client.ts` erhalten ausschließlich die tatsächlich verwendeten Client-Methoden und alle übrigen Provider-Props. Kein Laufzeitverhalten wird ersetzt. Entfernen, sobald die upstream Deklaration korrigiert ist.

## Prüfen

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:bundle
pnpm audit --prod
pnpm test:e2e
```

Foundation-Tests prüfen atomare/idempotente Initialisierung, persistente Profile, fremde Workspaces/Referenzen, Viewer-Rechte, widerrufene Mitgliedschaften, unbestätigte/abgelaufene Sitzungen und die realen Auth-HTTP-Handler einschließlich Verifikation und Passwort-Reset. Der E-Mail-Transport wird nur in diesen isolierten Tests gemockt. Der Bundle-Check schützt vor Importen von serverseitiger Secret-Konfiguration. Browserregressionen starten explizit mit `VITE_DEMO_MODE=true` auf Port 5174; sie sind keine Abnahme des realen Providers. Die GitHub-Actions-CI installiert mit gefrorenem Lockfile und prüft Formatierung, beide TypeScript-Projekte, Tests, Build und Secret-Bundle ohne Deployment-Credentials. Production-Hosting muss für direkte Unterrouten auf `index.html` zurückfallen; Vite dev/preview tun dies bereits.

## Isolierte UI-Demo

```sh
VITE_DEMO_MODE=true pnpm dev
```

Dieser ausdrücklich aktivierte Modus nutzt lokale Beispieldaten und Simulationen. Er dient bestehenden UI-Regressionsprüfungen; ein Backendfehler aktiviert ihn niemals automatisch.

## Ausprobieren

- Übersicht, Entwürfe und Composer: Einzelbeiträge und Threads, Medien/Alttext, Versionen, Kommentare, explizite Account-Freigaben, Änderungsvergleich und Kanalvarianten.
- Kalender: Woche, Monat und Agenda; Terminwahl mit Zeitzone und Zeitumstellung; Snapshot-Wechsel, Storno, Teilthread-Recovery und Abgleich unbekannter Ergebnisse.
- Signale, Ideen, Recherche und Agent: feste Beispieldaten, editierbare Profile, lokale Verläufe, Abbruch/Wiederaufnahme und idempotente Übergabe in ungeprüfte Entwürfe.
- Planvorschläge: unabhängige Reviews/Freigaben und ausschließlich ausgewählte Slots übernehmen.
- Analytics, Medien und Studio: bekannte/unbekannte Messwerte, Scope/Zeitraum, Beispielimport, lokale Uploads, referenzierte Medienversionen, feste Bild-/Video-Workflows.
- Experimente, Repurpose und Trends: Rechtebestätigung, kanalspezifische Übergaben, Review, Schwellenwerte, Backtest und Unsicherheit.
- Team, Workspaces, Einstellungen und Betrieb: Rollen und Review-Stufen, lokale Integrationen und Quellen, Strategiehistorie, Budgets/Billing, Benachrichtigungen, Datenexport/Löschung, Stop-Schalter, Kalibrierung/Algorithmusreview und Rollback.
- Öffentliche Demo-Seiten: Landingpage, Login, Signup, Verifikation, Passwort-Reset, Onboarding, Hilfe und Rechtstexte.

⌘K/Ctrl+K öffnet die Suche; ⌘S/Ctrl+S speichert im Composer. Desktop und mobile Navigation, helles/dunkles Design sowie reduzierte Bewegung werden unterstützt.

## Scope und Daten

Im ausdrücklich aktivierten **Demo-Modus** sind alle Provider, Rechercheergebnisse, Analysen, Agent-Antworten, Messwerte, Abrechnungen und Veröffentlichungsereignisse simuliert. Es gibt keine echte Recherche, KI-Aufrufe, OAuth-Verbindungen, Mails, Social-Posts, Zahlungen oder Hintergrundjobs. Externe URLs in Eingaben werden nicht abgerufen. Auth- und Rollenwechsel sind Demo-Zustände und kein Sicherheitsbackend. Hilfs- und Rechtstexte sind gekennzeichnete Entwürfe.

Zustände und kleine hochgeladene Dateien werden im `localStorage` des jeweiligen Browsers gespeichert. Fehler beim Speichern werden angezeigt; der gemeinsame Zustand wird erst nach erfolgreicher Speicherung übernommen. Workspace-Daten sind getrennt. Bereits geplante Texte und Medien bleiben als versionierte Snapshots erhalten; neue Texte, Medien oder Ziel-Accounts benötigen eigene Freigaben. Wiederaufnahme betrifft ausschließlich explizit geprüfte offene Snapshot-Beiträge.

Installationsläufe verwenden die ignorierten Projekt-Caches und pnpm-Store im Repository (`.cache`, `.pnpm-store`). Die folgenden Demo-Prüfungen verwenden keine realen Provider-Aufrufe.

## Prüfen

```sh
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Die Browserprüfungen nutzen auf macOS vorhandenes Google Chrome. Alternativ `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` auf eine vorhandene Chromium-Binary setzen. Sie prüfen direkte URLs, Kernabläufe, Rechte/Reviews, lokale Persistenz, Mock-Module, Mobilansichten und Axe/WCAG. Screenshots liegen unter `.docs/reviews/evidence/task-69/`.

Details: [Backlog-Abdeckung](.docs/ui-backlog-coverage.md), [UI-Kernabläufe](.docs/design/core-flows.md), [Implementierungsplan](.docs/design/ui-implementation-plan.md) und [QA-Nachweis](.docs/reviews/task-69-ui-validation.md).

Ursprungstasks und TASK-69 bleiben bis zur ausdrücklichen manuellen Nutzerabnahme **In Progress**; gemischte Backend-Aufgaben werden durch diese UI-Demo nicht geschlossen.
