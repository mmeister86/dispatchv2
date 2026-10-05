# TASK-1: Technische Kompatibilität, Laufzeitgrenzen und Medienpfad

Stand: 18.09.2026. Dokumentations-, Registry- und veröffentlichte Quellcodeprüfung sowie isolierte strikte npm-Lockfileauflösung. Keine Projektinstallation, kein Deployment, keine authentifizierte Providerprüfung, keine Modellverarbeitung. **Eine npm-Peer-Schnittmenge ist kein erfolgreicher Build und kein Runtime-Nachweis.**

## Versionsmatrix: konkreter Prüfkandidat A

Die nachfolgenden Versionen sind veröffentlicht; Registry-Metadaten inklusive optionaler Peers, Engines und Publikationsdatum liegen in `evidence/task-1/npm-metadata.json`. Versionsbezogene Primärquelle jeweils `https://registry.npmjs.org/<Paket>/<Version>`.

| Paket | Exakte Kandidatenversion | Entscheidende veröffentlichte Anforderungen |
|---|---:|---|
| convex | 1.46.0 | Node >=20; React 18/19 optional |
| @convex-dev/better-auth | 0.12.5 | convex ^1.25.0; better-auth >=1.6.11 <1.7.0; React ^18.3.1 oder ^19 |
| better-auth | 1.6.33 | React/DOM 18 oder19 optional; zod ^4.3.6 als Dependency |
| @convex-dev/agent | 0.6.4 | ai ^6.0.35; convex ^1.24.8; helpers ^0.1.103; provider-utils ^4.0.6 |
| @convex-dev/workflow | 0.4.8 | convex ^1.36.1; helpers ^0.1.99; workpool ^0.4.4 |
| @convex-dev/workpool | 0.4.12 | convex ^1.36.1; helpers ^0.1.94 |
| @convex-dev/r2 | 0.10.2 | convex ^1.24.8; React/DOM18/19 optional; AWS SDK S3 ^3.1030.0 als Dependency |
| ai | 6.0.286 | zod ^3.25.76 oder ^4.1.8; provider exakt3.0.16; provider-utils exakt4.0.51 |
| @requesty/ai-sdk | 3.6.1 | vite ^7.1.7 (nicht als optional deklariert); zod ^3.25.76 oder ^4; provider ^3; provider-utils ^4.0.41 |
| @ai-sdk/provider | 3.0.16 | Node >=18 |
| @ai-sdk/provider-utils | 4.0.51 | Node >=18.17; zod ^3.25.76 oder ^4.1.8 |
| convex-helpers | 0.1.124 | convex ^1.43.0; optionale Peers für React, TS, Zod etc. |
| zod | 4.6.5 | erfüllt obige Schnittmenge |
| react / react-dom | 19.3.0 / 19.3.0 | react-dom verlangt React ^19.3.0 |
| vite | 7.3.6 | Node ^20.19.0 oder >=22.12.0 |
| @vitejs/plugin-react | 5.2.0 | Vite4.2/5/6/7/8; Node ^20.19.0 oder >=22.12.0 |

Node22 >=22.12 für Build/CI als Kandidat; Convex-Node-Runtime ausdrücklich auf22 konfigurieren. Ein exakter Node-Patch und das Anwendungs-Lockfile sind beim Integrationsspike festzuschreiben; das isolierte Prüf-Lockfile ist unten archiviert. Optionale Framework-/Datenbank-Peers bedeuten nicht, dass Vue, Svelte, Prisma und PostgreSQL zusätzlich installiert werden sollen.

**Warum kein unabhängig gewähltes latest:** better-auth1.7.5 verletzt den Peer-Bereich der Convex-Komponente0.12.5. Vite8.3.0 verletzt Requesty3.6.1s Vite-Peer. Agent0.7.3 fordert ai^7/provider^4/provider-utils^5 und Node>=22; Requesty3.6.1 verwendet provider^3/provider-utils^4. Unterschiedliche Providergenerationen sind ohne Adapter-/Typeprüfung keine erwiesene Runtime-Inkompatibilität; Kandidat A hält sie bewusst auf derselben Generation. AI7 plus generischer OpenAI-kompatibler Adapter wäre ein separat zu prüfender Kandidat B, kein stiller Austausch.

**Konkretes Restrisiko Auth:** [offenes Upstream-Issue420](https://github.com/get-convex/better-auth/issues/420) meldet Typefehler für ConvexBetterAuthProvider0.12.5 mit better-auth1.6.22 nach Änderung der Clienttypen. Es wurde nicht gegen1.6.33 reproduziert. Deshalb Kandidat A **mit bestandener npm-Peerauflösung, aber ohne Type-/Runtimeprüfung**, Auth-Type-/Loginprobe zwingend offen; kein Downgrade auf eine frühere Version als vermeintliche Lösung. Primärmetadaten: [Convex BA](https://registry.npmjs.org/@convex-dev/better-auth/0.12.5), [BA1.6.33](https://registry.npmjs.org/better-auth/1.6.33), [Agent0.6.4](https://registry.npmjs.org/@convex-dev/agent/0.6.4), [Requesty3.6.1](https://registry.npmjs.org/@requesty/ai-sdk/3.6.1), [AI6](https://registry.npmjs.org/ai/6.0.286).

## Dokumentierte Runtime-/Datenlimits

Quelle: [Convex Limits](https://docs.convex.dev/production/state/limits), am18.09.2026 gelesen. Nicht ältere pauschale Aussagen wie „alle Actions10 Minuten“ übernehmen.

| Grenze | Dokumentierter Wert |
|---|---|
| Query/Mutation Ausführung | 1Sekunde eigener Code; Datenbankoperationen ausgenommen |
| Convex-Runtime Action | 30Minuten;64MiB RAM |
| Node-Runtime Action | 10Minuten;512MiB RAM |
| Dokument | 1MiB;1024Felder;16Verschachtelungsebenen;8192Arrayelemente |
| Funktionsargumente | 16MiB, Node-Action nur5MiB |
| Rückgabewert | 16MiB |
| HTTP-Action Antwort | 20MiB; kein spezifisches Requestlimit, praktische RAM-/Zeitgrenzen bleiben |
| Geplanter Aufruf Argumente | 4MiB; Summe pro planender Mutation16MiB |
| Transaktion Lesen/Schreiben | jeweils16MiB |

Die [Runtime-Dokumentation](https://docs.convex.dev/functions/runtimes) nennt Node20 als Default und unterstützt20/22/24. Node-Dateien müssen getrennt bleiben; Queries/Mutations gehören nicht in `use node`-Dateien. Medienbytes nicht als Convex-Dokument, Actionargument oder Workflowzustand transportieren. Nur Asset-/Objektreferenzen und begrenzte Metadaten persistieren; große Daten direkt aus R2 laden und Verarbeitung messen.

## React/Vite auf Cloudflare

[Offizieller React/Vite-Auth-Guide](https://labs.convex.dev/better-auth/framework-guides/react) beschreibt ConvexBetterAuthProvider, serverseitig crossDomain+convex Plugins, clientseitig crossDomainClient+convexClient, feste trustedOrigins und CORS-Registrierung der Convex-HTTP-Routen. Auth bleibt in Convex. Site-URL (`*.convex.site`) und Daten-URL (`*.convex.cloud`) sind getrennt; Preview-Origin und OAuth-Redirect explizit prüfen.

[Cloudflare Build-Konfiguration](https://developers.cloudflare.com/pages/configuration/build-configuration/) dokumentiert React(Vite): `npm run build`, Ausgabe `dist`. Damit ist statisches Frontendhosting dokumentiert, kein realer Build nachgewiesen. Cloudflare [empfiehlt neue Projekte auf Workers](https://developers.cloudflare.com/pages/framework-guides/); das Hostingziel ist noch zu wählen. Statische Assets auf Cloudflare erfordern keine Verlagerung von Geschäftslogik/Publishing aus Convex. ADR-001 begründet weiterhin keinen zusätzlichen Medien-Worker. Secrets bleiben Convex-/CI-seitig; nur öffentliche URLs sind VITE-Variablen.

## R2: Grenzen und Lücke zwischen Komponentenkomfort und ADR-001

[R2 Limits](https://developers.cloudflare.com/r2/platform/limits/): Tabelle nennt5GiB Einzelupload, praktisch präzisiert die Fußnote5MiB weniger; maximal10.000Multipartteile; Objektmaximalgröße4.995TiB nach Fußnote; pro Objektschlüssel1Schreiboperation/Sekunde; Metadaten8192Bytes; Schlüssel1024Bytes. Diese Plattformmaxima sind keine Dispatch-Produktlimits oder X-Medienlimits. Kleine Bilder/GIFs und größtes freigegebenes Video müssen separat anhand tatsächlichen X-Zugangs getestet werden; Größen-/Codec-/Dauerlimit als Produktvertrag steht noch aus.

[Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) gelten für eine Operation und einen Objektschlüssel; sie lassen sich bis zum Ablauf mehrfach verwenden. Signierter Content-Type bindet nur den Header, beweist nicht die tatsächlichen Bytes. CORS ersetzt keine Autorisierung.

**Veröffentlichten Quellcode0.10.2 geprüft:** [npm-Tarball](https://registry.npmjs.org/@convex-dev/r2/-/r2-0.10.2.tgz). `src/client/index.ts`: generateUploadUrl signiert PUT nur für Bucket+Key, ohne eigene ContentType-/Längen-/TTL-Option; clientApi.syncMetadata akzeptiert key und ruft onUpload **vor** dem geplanten Metadatenabruf auf. `src/component/lib.ts`: syncMetadata verwendet HeadObject und speichert dessen Angaben; keine vollständige Byteprüfung/Dimensionsermittlung/Finalisierung. Der [Komponenten-Guide](https://github.com/get-convex/r2) beschreibt signierte URLs, Uploadhooks und Metadata-Sync; daraus folgt nicht die Erfüllung der ADR-Invarianten.

Vorgeschlagener, noch unimplementierter Ablauf passend ADR-001:

1. Convex autorisiert Nutzer+Workspace+Kontingent und persistiert uploadIntent mit Ablauf, temporärem Schlüssel und Zustand; privater Bucket je Umgebung.
2. Browser erhält ausschließlich eingeschränkten PUT auf temporären Schlüssel. Custom Wrapper/Signer prüft Ownership und setzt gewünschte Ablauf-/Headerregeln; niemals eine Clientberechtigung für finalen Schlüssel.
3. Server beansprucht Finalisierung idempotent, erstellt separaten finalen Schlüssel und kopiert/überträgt dorthin. **Die final gespeicherten Bytes** prüfen; ein vorab geprüftes temporäres Objekt kann während gültiger Uploadberechtigung ersetzt werden. Header/ETag nicht als Inhaltsbeweis behandeln.
4. Tatsächliche Größe, Typ, Dimensionen, Prüfsumme und Plattformtauglichkeit feststellen; erst danach Asset ready. Wiederholungs-/Abbruchzustände persistieren; ein zweiter Finalisierer darf kein zweites sichtbares Asset veröffentlichen.
5. Vorschauen per autorisierter kurzlebiger GET-URL; Draft/Freigabe referenziert ConvexAsset-ID, keinen Ablauf-Link. Löschung, abgelaufene Uploadrechte, verspätet erneut geschriebene temporäre Objekte und verwaiste finale Objekte nachbereinigen.

## Publisherpfad und offene Nachweise

Convex-Workflow prüft freigegebene Inhaltsversion und ready-Asset → Action liest finales R2-Objekt → X-Upload mit benötigten Teilen/Processingpolling → Provider-Media-ID+Expiry+Uploadzustand speichern → eigentlicher Post nach Checkpoint. Noch keine X-API-Fähigkeit im eigenen Zugang bewiesen. Streaming/Rangedownload/Teilgrößen sind gegen Convex-RAM und Timeout sowie X-Uploadregeln zu messen; vollständiges Puffern großer Videos ist kein validierter Pfad. Erst ein nachgewiesener Engpass rechtfertigt alternativen Transferdienst/Worker.

Notwendige Kostenmessung: R2 temporär+final gespeichert, PUT/Kopier-/Multipartoperationen, HEAD/GET/LIST, abgebrochene Multipartuploads, Vorschau-/Publisherabrufe; Convex Actiondauer×RAM, Funktions-/Workflow-/Retryanzahl und tatsächlicher Medienverkehr. R2-Egressfreiheit allein beweist keinen kostenlosen Gesamtablauf.

Offene Tests: Typecheck inklusive AuthProvider; Browserlogin/-logout/-refresh; Convex Deploy/Node22-Smoke; Agent+Requesty Text/Stream/Tool/Schema und getrennt Embeddings; Workflow Retry/Replay; private CORS-Uploads und nicht erlaubter Workspacezugriff; Manipulation des temporären Objekts nach Finalisierung; mehrfacher Finalisierer; kaputte Datei/falscher Typ/Übergröße; Abbruch+Cleanup+Workspace-Löschung; reale finale Bytes→X→Post und Kostenmessung. Diese Runtime-/Integrationstests wurden nicht ausgeführt; die separate erfolgreiche Paketauflösung ist unten dokumentiert.

## Context7-Nachweis

Jeweils außerhalb Sandbox, erst library dann docs, keine Quota-/Netzfehler:

- `npx ctx7@latest library Convex <detaillierte Frage>` → `/websites/convex_dev`; docs lieferte Agent/Workflow-/Runtime-Verweise.
- `npx ctx7@latest library 'Convex R2' <detaillierte Frage>` → `/get-convex/r2`; docs belegte Signer, Hooks und HeadObject-Sync.

Primärquellen und Registry wurden ergänzend direkt gelesen, weil konkrete Versionen, aktuelle Limits und Reihenfolge onUpload/Metadata nicht allein aus allgemeinen Snippets folgen.

## Durchgeführter isolierter Paketauflösungstest

Dauerhafte Belege: [Registry-Metadaten](evidence/task-1/npm-metadata.json), [Manifest](evidence/task-1/package.json), [Lockfile](evidence/task-1/package-lock.json), [Ausgabe](evidence/task-1/npm-result.log).

Am18.09.2026 anschließend in `/tmp/dispatch-task1-peer-check` den vollständigen Kandidaten A aus obiger Matrix mit exakten direkten Pins geprüft:

`npm install --package-lock-only --ignore-scripts --strict-peer-deps --no-audit --no-fund`

Ergebnis: **Exit0**, `up to date in 26s`, Lockfile erstellt. Manifest: `evidence/task-1/package.json`; Lockfile: `evidence/task-1/package-lock.json`; Ausgabe: `evidence/task-1/npm-result.log`. Ausführungsumgebung: Node26.8.2, npm11.19.1, Lockfileformat3,204 Paket-Einträge. Keine node_modules-Installation und keine Lifecycle-Skripte. Damit ist die gemeinsame npm-Peerauflösung nachgewiesen. Typecheck, Transitiv-Enginecheck auf der vorgesehenen Node22-Runtime, Security-Audit, tatsächliche Convex-Bündelung und Provider-Runtime bleiben offen. Die Matrix darf jetzt als „strikte Paketauflösung bestanden, Type/Runtime ungeprüft“ geführt werden.
