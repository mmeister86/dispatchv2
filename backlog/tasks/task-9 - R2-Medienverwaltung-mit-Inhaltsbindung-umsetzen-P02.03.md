---
id: TASK-9
title: R2-Medienverwaltung mit Inhaltsbindung umsetzen (P02.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 11:01'
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
- [ ] #1 Fremde Asset-IDs und clientseitig untergeschobene Objektschlüssel werden abgelehnt.
- [ ] #2 Eine weiterhin gültige Upload-URL kann keinen finalisierten Inhalt überschreiben.
- [ ] #3 Nur geprüfte `ready`-Assets sind freigabefähig.
- [ ] #4 ein ersetztes Asset ändert keine geplante Version.
- [ ] #5 Unterbrechung zwischen R2-Operation und Convex-Update ist wiederaufnehmbar.
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
<!-- SECTION:NOTES:END -->
