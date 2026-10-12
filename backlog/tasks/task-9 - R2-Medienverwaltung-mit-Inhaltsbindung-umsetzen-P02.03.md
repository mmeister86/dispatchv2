---
id: TASK-9
title: R2-Medienverwaltung mit Inhaltsbindung umsetzen (P02.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-07 15:09'
labels:
  - p02
  - r1
milestone: m-1
dependencies:
  - TASK-7
  - TASK-1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P02.03.
Phase: P02 – Entwürfe, Versionen, Freigaben und Medien.

**Abhängigkeit:** P02.01, R2-Durchstich aus P00.01. **Dateien:** `convex/media/assets.ts`, `convex/media/r2.ts`, `convex/media/uploads.ts`, `convex/media/validation.ts`, `convex/media/cleanup.ts`, `src/features/drafts/media-uploader.tsx`; Tests `convex/media/assets.test.ts`, `convex/media/uploads.test.ts`.

- Convex-Domain-ID und R2-Objektverweis trennen; den Medienvertrag aus Abschnitt 5.7 implementieren. Die Convex-R2-Komponente als Integrationshilfe auf diese Anforderungen prüfen.
- Nach Workspace- und Kontingentprüfung begrenzte Uploadberechtigungen ausgeben; Medienbytes direkt in den temporären R2-Bereich übertragen und den final übernommenen Inhalt serverseitig prüfen.
- Den Metadatenabgleich an die serverseitig angelegte Uploadsession binden; ein clientseitiger Abschluss oder Komponenten-Callback darf nicht unmittelbar `ready` setzen. CORS, tatsächliche Uploadgrößenbegrenzung und gegebenenfalls Multipart-Abbruch getrennt nachweisen.
- Dateityp, Dateigröße, tatsächlichen Medientyp, Dimensionen, Inhaltsprüfsumme und Alt-Text validieren; Abschluss und Wiederholung dürfen keinen doppelten oder nachträglich veränderbaren finalen Inhalt erzeugen.
- Bilder, GIFs und unterstützte Videos gemäß tatsächlicher X-Fähigkeiten verarbeiten; asynchrone Provider-Verarbeitung einplanen.
- Medienreferenzen in Versionen fixieren, Austausch als neue Version behandeln.
- Autorisierte Vorschauen direkt aus R2 ausliefern; abgelaufene Lese-URLs bei Bedarf erneuern, statt sie dauerhaft im Draft zu speichern.
- Nicht abgeschlossene Uploads und verwaiste R2-Objekte bereinigen; referenzierte Assets und während Finalisierung/Löschung laufende Vorgänge durch Status-/Referenzprüfungen schützen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fremde Asset-IDs und clientseitig untergeschobene Objektschlüssel werden abgelehnt.
- [ ] #2 Eine weiterhin gültige Upload-URL kann keinen finalisierten Inhalt überschreiben.
- [x] #3 Nur geprüfte `ready`-Assets sind freigabefähig.
- [x] #4 ein ersetztes Asset ändert keine geplante Version.
- [x] #5 Unterbrechung zwischen R2-Operation und Convex-Update ist wiederaufnehmbar.
- [ ] #6 große Uploads besitzen Fortschritt und Abbruch.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehende Asset- und unveränderliche Versionsverträge übernehmen; aktuelle R2-Dokumentation und EU-Konfiguration prüfen.
2. Workspace-gebundene Uploadsessions, temporäre Browser-Uploads und serverseitig geprüfte unveränderliche Finalisierung implementieren.
3. Medien-UI mit Fortschritt, Abbruch, Alt-Text, autorisierten erneuerbaren Vorschauen und sichtbaren Konfigurationshinweisen verbinden.
4. Fremdzugriff, Replay, laufende Finalisierung, Referenzen und Wiederaufnahme mit gezielten Tests prüfen; vorhandene UI-Regressionsprüfungen ausführen.
5. Entwicklungsbackend aktualisieren und regelmäßig auf master committen; echte EU-R2- und Benutzerabnahme separat dokumentieren.

2026-10-07 Uploadfehler localhost: 1. EU-Jurisdiktion und CORS live lesend abgleichen. 2. Separaten privaten dispatch-eu-Bucket anlegen und CORS ausschließlich für localhost:5173 und 127.0.0.1:5173 mit PUT/GET/HEAD einrichten. 3. Bestehende S3-Zugangsdaten gegen neuen Bucket prüfen; nur bei funktionierendem Zugriff Convex-Bucketbindung umstellen. 4. Preflight und Upload verifizieren; bei fehlender EU-Tokenberechtigung konkreten Credential-Handoff dokumentieren. Bestehender Bucket und Medien bleiben erhalten; kein Done ohne Nutzerabnahme.

2026-10-07 Geisterbereinigung: Fünf konkret benannte deleting-Assets samt Sessions und Referenzen live prüfen. Zwei historische dispatch/EU-Sessions sind abgelaufen und unreferenziert; ursprünglichen EU-Namespace per Cloudflare prüfen. Bestehende interne cleanup.receipt mit kurzfristig ursprünglicher Bucket-Konfiguration ausführen, danach Konfiguration in finally auf dispatch-eu zurückstellen; keine gespeicherten Bindings ändern. Drei aktuelle dispatch-eu-Sessions erst nach Grant+60s und Leaseablauf über reguläre cleanupR2.run bereinigen. Abschließend nur fertiges Bild und korrekt freigegebenes Kontingent verifizieren.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /media, /drafts/:id. Local file validation/upload progress/cancel/retry, image/video previews, media selection and alt text; referenced alt-text edits make new media/content versions. Grenze: No R2 URLs, server finalization, checksums, multipart upload or provider media processing. Demo limits: 2 MB/file, 3 MB total. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Nutzerentscheidung: Fehlende EU-R2-S3-Zugangsdaten zunächst mit sichtbaren Konfigurationshinweisen behandeln. Keine geheimen Werte im Chat; kein Ersatz durch nicht belegten weur-Location-Hint. Implementierung folgt nach unabhängiger Prüfung des Editorial-Vertrags.

Implementierung nach unabhängiger Editorial-SPEC/QUALITY PASS f041927 gestartet (Root-Plancommit e188453). Eigener TASK-9-Implementer übernimmt bestehenden mediaAssets-Vertrag, servereigene Sessions, unveränderliche finale Objekte, indexierte Versionsreferenzen und Workspace-Lifecycle-Barriere. Aktuelle offizielle R2-Dokumentation via Context7 geprüft; X-Alt-Text-Metadaten sind pro freigegebener Version auf1000Zeichen begrenzt. Echte EU-R2-Credentials/CORS-/Runtime-Abnahme bleiben wie vom Nutzer gewünscht separat offen.

TASK-9 code is frozen for independent SPEC review at 33663d3. Implementer reports 58 unit checks, typecheck, formatting, build, seeded bundle security and two UI regressions passing; configured Convex dev updated 2026-10-05 12:32:36. Private temporary upload grants, conditional immutable final bytes/readback, indexed historical references, lifecycle barriers, paginated library and version-bound alt metadata implemented. Actual EU-jurisdiction bucket credentials, origin CORS, live size/signature/runtime/race evidence and authenticated manual acceptance remain open. Status remains In Progress; no automatic Done.

Independent root full browser regression at frozen media code33663d3: pnpm test:e2e completed 34/34 tests in 2.0m on isolated5174. SPEC reviewer reproduced duplicate-PNG-header predecode-bound bypass and composer/history media lookup gaps; acceptance stays open while fixes and re-review proceed.

Three SPEC defects corrected and source frozen atf381e39 for independent re-review: strict predecode PNG metadata/header checks; paginated Composer inventory; authorized historical descriptors merged through actual store with exact-alt restore. Committed checks reproduced defects before fixing. Implementer reports62 unit checks and4 targeted browser checks plus typecheck/lint/build/bundle passed; Dev updated12:44:09. Root independently pnpm audit --prod: no known vulnerabilities. SPEC re-review and subsequent QUALITY still pending, actual EU-R2/CORS/runtime/manual acceptance still open.

Independent SPEC PASS atf381e39:20 committed targetedchecks plus2 updated original counterexamples passed. Reviewer confirmed PNG limits beforedecode, paginated first-attachment inventory and authorized bounded historical descriptors with exact-alt restoration. Fresh independent QUALITY review nowrunning, including an unverified StrictMode mounted-ref concern; no next provider implementer until QUALITY passes. Actual live/manual acceptance unchanged and statusInProgress.

Independent QUALITY review reproduced P2 in actual MediaLibrary under ReactStrictMode: effect cleanup marks mountedfalse without setup reset, so successful delete suppresses feedback/finally and remains busy. Isolated5174 browser fixture and screenshot captured without source or real provider writes; serverclosed. Review continues on frozenf381e39 before scoped correction and re-review. No automatic Done.

Partial QUALITY review also reproduced P1 MP4 predecode-bound gap with two small safe fixtures: opaque dref entries are recursively parsed by MP4Box, bypassing advertised child sample-count/depth limits. Worker assigned strict supported self-contained entry validation before library parsing and negative regressions, plus confirmed StrictMode correction. Review agent was interrupted by an automated content filter; no completed QUALITY/PASS claimed. Fresh full independent review required after corrections; no large exhaustion fixtures or real provider writes.

QUALITY corrections frozen a51f9ed after tests-first1e494b1: actual StrictMode mounted lifecycle and supported MP4 dref/AAC descriptor predecode checks corrected. Only2 production files; no schema/jobs/dependencies added. Worker reports64 unit checks,8 targeted byte checks, actual media lifecycle browser success/failure/unmount/workspace checks, type/lint/build/bundle passed; valid synthetic H264/AAC FFmpeg decode passes. Configured Dev updated12:58:28. Renewed SPEC running, fresh complete QUALITY follows; actual EU-R2/manual gates remain open.

Independent renewed SPEC PASSa51f9ed:22 targeted unit checks and actual MediaLibrary lifecycle browser passed, including StrictMode success/failure and late unmount/workspace outcomes. Reviewer verified supported bounded MP4 metadata forms before library parsing and valid fixtures, no schema/jobs/dependency changes. Fresh complete QUALITY audit nowrunning; external EU-R2/CORS/runtime/manual gates remain open and taskInProgress.

Fresh complete QUALITY NEEDS WORKa51f9ed: MP4 aggregate allocation/track/table limits must run before library parsing; inherited MIME lookup admitted unsupported type; prepare replay signs old bucket after configuration drift; native file input remount clears selected visible filename. Small safe counterexamples and actual browser checks reproduced. Prior corrections/core backend flows hold;22 targeted/lifecycle and additional async upload/preview checks pass. Worker assigned four root corrections; narrow physical account namespace follow-up pending. No live/provider acceptance claim or Done.

Storage-binding follow-up confirmed same root includes Cloudflare account drift at unchanged bucket name: old keys can reach a different physical endpoint and cleanup receipt can refer to the wrong namespace. Shared scoped fix persists normalized nonsecret accountId+bucket on session/asset and checks all Prepare/Finish/Preview/Cleanup paths; legacy unknown binding fails closed, same-namespace key rotation stays valid. Synthetic frozen-config evidence only, no provider calls. Worker incorporates this into current correction and updates inventory after freeze.

Scoped corrections frozen fe3af37 after tests-first20ca2d4/c9f8154 and productionf67946b: pre-parser whole-file MP4 allocation/track/table budgets, strict own MIME lookup, Account-ID+Bucket on session/asset across signing/finalization/preview/cleanup/receipt, explicit legacy reconciliation and same-namespace credential rotation, stable native filename/current-buffer-safe success clear. Worker reports70 unit checks/11files plus original reviewer3checks, type/lint/build/bundle and actual lifecycle/upload browser scripts PASS; configured Dev updated13:20:22 without R2 object effects. Independent SPEC then full QUALITY pending. Metadata inventory updated; real EU-R2/CORS/runtime/manual gates remain open. Status In Progress, no automatic Done.

Independent final SPEC PASS on productionfe3af37 (root docs218966e):4 targeted files28/28 plus actual test:media-lifecycle/test:media-upload PASS sequential5174, closed. Valid H264/AAC/preparse allocation caps, own MIME, normalized fullnamespace guards including receipt/legacy/rotation, nativefilename/currentbuffer verified. No provider calls,5173 untouched. Independent complete QUALITY re-review running; actualEU-R2/manual gates remain open.

Independent final QUALITY PASSfe3af37:28 targeted+3 original+3 additional receipt/binding checks=34, actualtest:media-upload PASS. No remaining critical/important/minor findings in reviewed code. Accountdrift/missingbinding blocksreceipt/quota; same-namespace rotation allows exactly-once release; productionfrozen/no provider effects. AC1/3/4/5 verified with isolated domain/byte/race tests. AC2 liveimmutablegrant and AC6 actuallargeupload remain unchecked; realEU-R2/CORS/runtime/manual gates open. TASK-9 code-stage reviewed; status stays In Progress until explicit manual user confirmation.

2026-10-07: Nutzer meldet MEDIA_TRANSFER_FAILED beim direkten Browser-PUT auf localhost:5173 trotz grüner Konfigurationsprüfung. Read-only Codeprüfung: status konstruiert nur S3Client, kein R2-Netzwerkzugriff; Transfer fasst HTTP/CORS/Timeout zusammen. Live-Bucket-/CORS-Prüfung begonnen, keine Secrets ausgegeben und keine Medien verändert.

2026-10-07 Live-Diagnose und Infrastrukturkorrektur: Convex konfiguriert R2_MEDIA_BUCKET=dispatch und EU_CONFIRMED=true. dispatch existiert nur in Default-Jurisdiktion (Location EEUR), EU-API meldet 10006, Standard-S3 GET auf nicht existenten Schlüssel meldet NoSuchKey, EU-S3 AccessDenied. dispatch hat keine CORS-Regeln (10059). Privaten neuen Bucket dispatch-eu mit --jurisdiction eu angelegt; CORS ausschließlich http://localhost:5173 und http://127.0.0.1:5173, PUT/GET/HEAD, Content-Type, MaxAge300 gesetzt. Live signierte PUT-Preflights: beide lokalen Origins 204 mit passenden Allow-Headers/Methods; fremde Origin 403 ohne Allow-Origin. Vorhandene S3-Schlüssel dürfen dispatch-eu nicht lesen (GetObject AccessDenied403). Konkreter Handoff: Nutzer muss EU-R2-S3-Zugang mit Object Read & Write für dispatch-eu erstellen/freigeben und in Convex Dev R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY sicher ersetzen sowie R2_MEDIA_BUCKET=dispatch-eu setzen. Keine Schlüsselwerte in Chat; aktuelle Binding nicht vor gültigem Zugriff umgestellt. Keine existierenden Dateien/Buckets gelöscht, keine realen Datei-Uploads ausgelöst. End-to-End-Upload noch offen; Task bleibt In Progress.

2026-10-07 17:00 Europe/Berlin: Zwei Alt-Sessions ks78n2e70zyg6514yy867yfytd8ft1gw/ks73gegd1nx4cegfjx4yaqt1g98fvd9b nach erneuter Cloudflare-EU-API-Abwesenheitsbestätigung10006 und Live-Prüfung von cancelled/deleting, Grant/Leaseablauf, korrekten deterministischen Keys, Größe/Workspace/Sessionbindung und fehlenden Referenzen über bestehende cleanup.receipt abgeschlossen. R2_MEDIA_BUCKET in try/finally kurz dispatch, danach wieder dispatch-eu; keine gespeicherten Namespacewerte geändert und keine Code-/Schema-Pushes. Browser bestätigt beide verschwunden, korrektes PNG weiterhin ready. Drei neue deleting-Sessions warten regulär bis spätestens17:08:24 auf Grant+60s/Leaseablauf; abschließende reguläre Bereinigung und Kontingentabgleich stehen aus.

2026-10-07 17:05 Europe/Berlin: Reguläre media/cleanupR2:run nach Ablauf der ersten zwei neuen EU-Sessions erfolgreich: k57dwqxye8xzjyxf3w3cqzr1a98ftgbh und k57a25xav4j2yfcky84x18j7058fthw1 deleted. Insgesamt4/5 Geister entfernt. Live-Kontingent jetzt2 Assets/2117890Bytes = erfolgreiches PNG1002663Bytes + letzte Reservierung1115227Bytes. Letzte Session ks73t1f595qpm3ze4pka698acd8ftzw1 wird ab17:08:24.881 freigegeben; erneuter regulärer Lauf und Schlussprüfung folgen.

2026-10-07 17:08 Europe/Berlin: Alle5 Geister vollständig bereinigt. Letzte reguläre cleanupR2:run nach17:08:24 erfolgreich. Abschließende assert-basierte readonly Liveprüfung: genau5 deleted, genau1 live/ready, mediaAssetCount=1, mediaReservedBytes=1002663=Größe des erhaltenen PNG. Browser-AX bestätigt alle3 verbleibenden Placeholderkarten verschwunden; screenshot /tmp/dispatch-media-clean.png. Keine Produktionscode-/Schemaänderungen, keine fremden lokalen Änderungen deployed. Nutzerhinweis: manuelles Löschen temporärer Objekte alleine räumt DB/Kontingent nicht auf. TASK-9 bleibt In Progress bis explizite Nutzerabnahme.
<!-- SECTION:NOTES:END -->
