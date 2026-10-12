---
id: TASK-33.1
title: 'Dateninventar und sicheren Workspace-Export liefern (P09.03, Teil 1)'
status: Done
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-12'
labels:
  - p09
  - r3
  - teilpaket
  - jev
milestone: m-3
dependencies:
  - TASK-26
  - TASK-29
  - TASK-30
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-33
priority: medium
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.03. Verantwortung: convex/operations/export.ts und .docs/decisions/data-inventory.md.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Jev-Assessments/Caches, Usage, Frage-/Modell-/Formelreferenzen, kontrollierte Eval-Daten sowie eingeführte Routing-/Verifier- und Debug-Daten inventarisieren. Zweck, Empfänger, EU-Datenpfad, Aufbewahrung und Löschwege einschließlich Provider-Kopien dokumentieren; exportierbare nutzerbezogene Ergebnisse ohne Secrets bereitstellen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Inventar erfasst Zweck, Besitzer, Weitergabe, Retention und Löschweg aller bis P08 eingeführten Domain- und Komponentendaten.
- [x] #2 Autorisierter Export enthält Inhalte, Quellen, Pläne, Präferenzen und relevante Agent-/Workflow-Daten, jedoch keine Provider-Secrets.
- [x] #3 Fremde Workspace-/Account-IDs werden abgelehnt; große Exporte sind kontrolliert ausführbar.
- [x] #4 Autorisierter Export und Dateninventar enthalten eingeführte Jev-Ergebnisse/Metadaten und erklären Provider-Aufbewahrung, ohne Secrets oder fremde Workspace-Daten offenzulegen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [x] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Vorhandene self/versions-Verträge und vollständiges Dateninventar erhalten.
2. Eigene gespeicherte Benachrichtigungspräferenzen und berechtigte Research-Abschlussmetadaten als separaten begrenzten erlaubten Export ergänzen; Abwesenheit als null, keine erfundenen Defaults und keine Scheduler-/Auth-IDs in der Datei.
3. Native Einstellungen um scope-/session-geschützten Download ergänzen; aktuelle Original-Quellenbeweise für Abschlussmetadaten wiederverwenden.
4. Verbleibende gemeinsame/private Domain-/Komponentenfamilien nach Read-only-Ownership-Matrix ergänzen; keine Complete-Behauptung aus Teil-Export.
5. Native Isolation/Legacy-/Wire-Grenzen und UI-Handoff prüfen; getrennte SPEC/QUALITY und abschließende Gesamtabdeckung dokumentieren.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/data. Export includes local workspace, accounts/content/plans/media/preferences and scoped local feature settings; progress/download UI. Grenze: No backend/component export or provider secrets exist in this app. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only Preflight auf master 5b76d52 mit 85/85 tatsächlich committed Domain-Tabellen, installierten Agent/Workflow/Workpool/BetterAuth-Daten, direkten R2-Objektpfaden, exakten Index-/Ownership-/Secret-/Cleanup-Lücken dokumentiert: .docs/reviews/task-33-data-inventory-preflight.md. Drei laufende TASK-46.1 Tabellen gesondert pending. Vollständiger Export/Löschkoordinator/gesetzliche Retention/Restore weiterhin unimplementiert bzw. unbelegt; kein AC- oder Done-Abschluss durch Quellinventar. Finalen46/47/49/50/67/68-Graph bei Einführung fortschreiben.

Read-only current inventory delta adopted: .docs/reviews/task-33-36-current-inventory-delta.md. Actual schema85->104:19 additions, none removed; scoped/native ownership and missing-root export/disposition/restore gaps recorded. Reconcile final accepted67.2 and future68/32 edges before implementation. This is preparation, no source/test/export/erase/restore/legal acceptance; ACs remain open.

2026-10-07 ROOT: Native Export-Vorbereitung als PROPOSAL_ONLY übernommen: .docs/reviews/task-33.1-current-native-export-source-plan.md (SHA256 b7f4f2cda12a7d7073388d611dd15f3a8a65731bc39419daa6d7ac9774498a5b). Root liest vollständigen Bericht, reduzierte semantische Receipt-Projektion nach anfänglicher Trunkierung, tatsächlichen CLI-Beschreibung/AC/DoD/Notes-Bereich und Reader-Helfer. 314 originale fremde Nicht-Generated-Pfade, 6 Inputs, 7 Artefakte verifiziert; 25 per-Read-Before/After-Beobachtungen, 23 stabile Bereiche mechanisch gegen aktuelle Hashes und rekonstruierte Bereichsbytes, zwei bewegliche Schema-Beobachtungen nur historisch. Kein Fullbody-Read aller Source-Dateien durch Root behauptet. Proof /tmp/dispatch-33.1-current-native-export-source-plan-root-verification.json. Natives Original-Actor/Session-Job, serverseitige begrenzte Chunks und konkret konsumierte Source-Copy-Bindungen vorgeschlagen; erste Self-Familien sind keine Erfüllung des gesamten Exportvertrags. Unsupported Workspace-wide-Scope explizit ablehnen, Admin keine private Actor-Übersteuerung, authentifizierter Chunkabruf statt scheinbar sofort widerrufbarer Signed-URLs. Job/Chunk/Index-Zahlen erst bei tatsächlichem Umfang finalisieren, keine allgemeine 104-Tabellen-Registry. Keine Source-, Provider-, Daten-, Test-/Export-/Lösch-/Restore-/Rechtsabnahme. Reconcile final TASK-31/32/35/68 vor Source; alle AC/DoD und manuelles Done offen.

Root read complete current minimal first-unit critique and cache/session reconciliation: .docs/reviews/task-33.1-first-unit-yagni-critique.md (235ba7b3…) and task-33.1-export-request-scope-reconciliation.md (311b698b…). Proposed selected-workspace self-profile only via live authenticated boundedquery+CloudBlob; no jobs/chunks/schema/storage/Agent/provider. Explicit partial coverage/unsupportedfamilies, no Adminprivateoverride, oversizedlegacyfailwhole, currentactiveworkspace/verifiedidentity/ownpreference exactindex. Freshperclickkey needed (actualConvexReactClient.query canreuse sameargs cache), expectedAuthId checkedagainstactualderiveduser; native-derived session/auth/key correlation stayswire-only and OUT ofdownloadeddata. ExistingnativeScope remount+ticketcleanup protectsobservedABA; no instantaneousrevocation ofauthorizedinflight/downloadedbytes claim, SDKbuffers transientnotappcache. Fourappsingle-rowreads plus actualAuthcomponentoverhead—not4totalqueries. CurrentConvex ctx7 library+docs2commands outside sandbox thenpinned1.46.0 sourcecorroboration. All34332.2frozen/head/human unchanged. Source/taskchildrelease and native/browser/export/fullinventory/manual acceptance pending; parentACs remainopen.

Erste neue Export-Einheit eingefroren: preferences-Query und NativePreferencesExport in fünf Source-/Testpfaden; 66 gezielte Tests und beide Typechecks PASS. Root-Vite-Produktionsbuild PASS (bestehende Chunkwarnungen). Fresh SPEC läuft; tatsächliche Browser-Handoff-Kontrollen werden im vorhandenen operations.browser.mjs ergänzt. Noch keine Gesamtexport-AC-Abnahme, kein Done und kein Commit; Git-Index benötigt sandboxseitige Eskalation.

Neue Präferenz-/Summary-Export-Einheit technisch geprüft: fresh SPEC66/66 und getrennte QUALITY66/66 PASS, beide Typechecks und RootProduktionsbuild PASS. Tatsächlicher App/Store/CSS-Browserlauf PASS mit vier heruntergeladenen JSON-Dateien für Owner/Admin/Editor/Viewer; nullable gespeicherte Settings, exakte Correlation/ABA/Quellenfrist/64KiB und Fehler-URL-Cleanup geprüft. Browsermocktransport ausdrücklich getrennt von hostedConvex; provider[]/errors[]. Frozenbrowserhash c703ac951cf0df6d9dfb787796d5fca57bd6ebdba609795ff033d1889d28fdab. Bestehende self/versions und Demo unverändert. Parent-ACs bleiben wegen weiterer Exportfamilien offen; manuellerDoneoffen.

Commit aeb256d enthält ausschließlich sechs geprüfte eigene Pfade. Dauerhafter Validierungsbericht .docs/reviews/task-33-preferences-export-validation.md. Nächster frischer Implementer shared_archive bearbeitet gemeinsame Content-/Editorial-/Planungsarchive nach Unit2; Parentstatus InProgress, keine weiteren ACs oder Donebehauptung.

2026-10-09: Gemeinsamer Archivexport für19 Inhalts-/Redaktions-/Planungsfamilien technisch akzeptiert und als033214d committet. Aktuelle Owner/Admin-/Session-/Workspace-Bindung vor nativer Ein-Kandidaten-Seite, explizite DTOs, Original-/aktuelle Quellenproofs,64KiB und keine Secrets; UI First/Next/Restart mit ABA-/Handoff-Sperren. Frischer SPEC und separater QUALITY PASS, unabhängig38/38 aggregierte Exporttests, implementer144/144 verwandte native Tests und3/3 ausgewählte Recurring-Prüfungen. Voller gemounteter Operations-Browser mit Mock-Transport PASS; repräsentativer Draft-JSON/Next, kein Live-Provider. Nachweis .docs/reviews/task-33-shared-archive-validation.md. Private/Research/Agent/Workflow/Intelligence/Auth/Medien- und weitere Records-Familien sowie globale Löschung/Retention folgen; Parent-ACs/Done unverändert offen.

Private Archive Unit3: 91 native Tests sowie TypeScript/Build/browserbasierte JSON-Downloads grün. Frischer SPEC-Review verlangt drei Ergänzungen: gespeicherte Evidence-Akteure, leere weiterlaufende Chat-Operation-Seiten bei eindeutigem Quellenverlust, Originalkonfiguration legitimer blockierter Research-Aufträge. Reparaturen beim ursprünglichen Implementer; QUALITY und Übernahme erst danach. Browsertransport ist ausdrücklich gemockt; echte Komponenten separat nativ geprüft.

Unit3 übernommen: eb32ad6, zehn bounded eigene Chat-/Research-/Agent-/Workflow-Archivleser. SPEC nach drei reparierten Lücken PASS, getrennte QUALITY APPROVE; beide Reviewer prüften unabhängig 26/26 private native Tests und acht Dateihashes. Insgesamt 97 relevante Tests, beide TypeScript-Projekte, Format/Build und echte Browser-JSON-Downloads mit gemocktem Transport grün. Eigene Evidence-Akteure, Quellenverlust-Fortsetzung und blockierte Originalkonfiguration geprüft. Restliche Facharchive sowie Löschung/Retention weiter offen; kein Done.

Unit4A läuft: 15 feste Jev-/Profil-/Stilbereiche, eigene Request-/Routing-/Verifier-Historie für alle vier aktuellen Rollen mit unveränderten Quellenrechten; gemeinsame Fachdeklarationen Owner/Admin. 30 native Archivtests aktuell grün, finale Regression/Browser/Typen/Build folgen vor SPEC/QUALITY. Fünf minimale Indizes: eigener workspacegebundener Verifier-Index plus vier Workspace-/Actor-Indizes ohne Operationsschlüssel, da native Cursor sonst geheime Indexanteile enthalten könnten. Drei reine bestehende Fixture-Extraktionen statt Kopien. Noch kein Freeze, keine Übernahme oder Parent-AC-Abnahme.

Unit 4A source frozen: 30 archive and 280 related native tests pass; 8 selected style tests pass, 25 stress cases deliberately excluded. Both typechecks, build, formatting, targeted and complete mounted operations browser pass (transport mocked). Fresh SPEC underway, distinct QUALITY pending. 4B measurement preflight covers all calibration model variants and original publication knowledge; one safe account-prefix discovery index planned. Parent export acceptance remains open.

Independent 4A SPEC: 207 related native checks passed and three fixture AST relocations are exact, but five real reproductions found four defects: saved algorithm/audience foreign references, original analyzer policy lineage, normalized downloaded answer values, and routing model provenance. Original writer repairing these with RED/GREEN cases; no SPEC approval or scope commit yet. Distinct QUALITY follows repaired freeze.

4A repaired freeze in 17 paths: five independent reproductions and 43 native archive cases pass; 293 related checks, analyzer4, selectedstyle8, both typechecks/build/format and targeted mounted native-shaped JSON answers/provenance pass. Existing analyzer receipt proof exported unchanged, no current execution gate added. Fresh SPEC repair re-review underway; distinct QUALITY and commit pending. Previous full browser is historical pre-repair evidence, final targeted browser separately records repairs.

Independent repaired SPEC PASS for4A: unchanged five reproductions5/5 and archive+analyzer47/47 pass, all17freezehashes match, full analyzer AST parity and three native fixture relocations confirmed. Fresh distinct QUALITY dispatched; next source writer remains gated on its approval. No Done or deployment.

Unit4A accepted and locally committed2158440 after repaired SPEC PASS and distinct QUALITY APPROVE. QUALITY independently verified26archive+7style tests,17freezehashes and fixture/analyzer AST parity; root checked exactstaging and diff. Durable validation .docs/reviews/task-33-intelligence-a-validation.md. Fresh4B1 writer now implements eight history/metrics/original first-send knowledge families; calibration/experiments4B2 and finance4C follow. ParentAC/Done remains open.

4B1 Mess-/History-Archiv: acht Familien implementiert, 157 zugehörige native Tests gemeldet. Unabhängige SPEC-Prüfung des eingefrorenen Standes hat zwei reproduzierte P1-Fehler gefunden (ursprüngliche Metric-Budgetzuordnung und Kalibrierungs-Fingerprint bei abgelaufenem Pin). Original-Implementierungsagent repariert mit nativen Regressionen; erneute SPEC und separates QUALITY-Review stehen aus. Keine AC als vollständig bestätigt; Status bleibt In Progress.

4B1 reparierter Neun-Dateien-Stand: unabhängiges SPEC PASS (fünf gültige eigene Reproduktionen + 27 native Exportfälle; zwei frühere History-Repros wegen ungültigem null-Patch-Testaufbau ausdrücklich zurückgezogen und korrekt ersetzt). Originalagent meldet 166 relevante native Tests, beide Typechecks und Formatierung bestanden. Frischer separater QUALITY-Agent prüft jetzt; Commit/AC-Freigabe noch ausstehend.

4B1 akzeptiert und lokal exakt neun Quelldateien als eca1227 committed. Vollständige unabhängige SPEC/QUALITY plus günstige finale Delta-Prüfungen schließen fünf konkrete Findungs-Reparaturen ab. Final 29 native Exporttests und zwei unabhängige QUALITY-Repros grün; Backend-Typecheck. Frühere 166 relevante Tests/Browser-/Build-Nachweise ausdrücklich auf damalige eingefrorene Stände begrenzt. Restliche Exportfamilien weiter offen; wegen Nutzer-Aufwandsgrenze zunächst unabhängige Lösch-Fundamentierung vorgezogen.

2026-10-10: Export-Restfamilien, zehn Finanzvarianten, Kalibrierung/Experimente, operative Records, eigene Identity-Metadaten und Originaldateien integriert. Strikte DTOs, native Quellen-/Actor-/Session-Bindungen und kontrollierte Pagination. R2≤32MiB, Agent-Dateien≤8MiB/Inline≤64KiB; externe/unbelegte Referenzen ausdrücklich unavailable. Keine globalen Secrets oder fremden privaten Threads. UI verdrahtet, Inventar ergänzt; manuelle Nutzerabnahme offen.
2026-10-12: Auf ausdrückliche Nutzeranweisung geschlossen; technische ACs belegt, frische gezielte Export-Tests 167/167 PASS. Manuelles Done per Nutzerbestätigung 2026-10-12.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Vollständiger autorisierter Exportumfang in bounded Familien ergänzt; native Quellen-/Actor-/Session-Prüfungen und strikte DTOs verhindern Secret-/Fremddatenexport. Einstellungen enthalten Archive, eigene Identity-Metadaten, R2-Originale bis32MiB und eigene Agent-Originale bis8MiB/Inline64KiB. Externe/unbelegte Anhangreferenzen und größere Dateien bleiben ausdrücklich unavailable. Dateninventar aktualisiert. Integrierter Abschlusslauf506/506 Tests, Typecheck/Build und native Browser-Recovery bestanden. Manuelle Nutzerabnahme und Deployment offen.
<!-- SECTION:FINAL_SUMMARY:END -->
