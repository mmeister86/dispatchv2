---
id: TASK-33.2
title: 'Wiederaufnehmbare Account- und Workspace-Löschung umsetzen (P09.03, Teil 2)'
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
  - TASK-33.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-33
priority: medium
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.03. Verantwortung: convex/operations/deletion.ts und deletion.test.ts; Ausbau des betreuten R2-Basisbetriebs.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Assessment-/Cache-/Entscheidungsdaten und nutzerbezogene Eval-/Debug-Daten in Account-/Workspace-Löschung aufnehmen. Laufende Analysen beenden oder ihre Antworten verwerfen; Wiederholung und Wiederaufnahme dürfen entfernte Daten nicht reaktivieren.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Löschung sperrt neue Arbeit, stoppt Jobs, entfernt Tokens und verhindert späte Neuanlage durch laufende Actions.
- [x] #2 R2-Objekte, Metadaten, Agent-Memory, Embeddings und abgeleitete Modelle werden mit dauerhaftem Fortschritt bereinigt; fehlende Objekte sind idempotenter Erfolg.
- [x] #3 Account-Löschung entfernt keine fremden gemeinsamen Workspaces; alleinige Owner wählen Übergabe oder bewusste Workspace-Löschung.
- [x] #4 Ein während der Löschung laufender Jev-Aufruf kann nachträglich weder Cache noch Assessment neu anlegen; wiederholte Löschung bleibt idempotent.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [x] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Native öffentliche Begin/Resume/Status-APIs mit Originalautorität und Lifecycle-Fence.
2. Dauerhafte bounded Phasen stop/components/objects/rows/auth/verify mit Revision/Retry.
3. Gepinnte scoped Agent-Datei-Claims und Workflow-Residuals; exakte App-Storage/R2-Receipts vor Parentverlust.
4. Account-private Daten entfernen, optionale Personenverweise anonymisieren und gemeinsame Businessdaten erhalten.
5. Native Integrationstests, Browser-Bootstrap-Gate, Typecheck/Build; Done erst nach manueller Nutzerabnahme.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/data, /team. Owner-only workspace deletion, explicit confirmation; account deletion and owner-transfer path; local failure/retry preview. Grenze: No durable distributed deletion jobs or remote credential/storage cleanup. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only Lifecycle-Preflight abgeschlossen: vollständige disjunkte104-Matrix mit tatsächlichen Indizes und21 notwendigemissing Workspace-Präfixen als .docs/reviews/task-33-deletion-dispositions-preflight.md gesichert. Noch keine Löschimplementierung/Liveaudit-Abnahme; technische Arbeit läuft zunächst33.1-Exportfamilien. Nutzer30Tageoperationalbestätigt, keine erfundene Legal-/Provider-/Backup-Frist.

2026-10-09: Exakter104-Tabellen-Dispositionenplan und serieller Foundation/Coordinator/Retention/UI-Vertrag liegen unter .docs/reviews/task-33-deletion-implementation-preflight.md. Read-only Dev-Audit accurate-lion-749 05:28:51–57UTC:14 ungenutzte Agent-/Workflow-Tabellen leer, kein Produktions-/Zukunftsnachweis. Workflow0.4.8-Cleanup-Lücke Events/onCompleteFailures erfordert engen reproduzierbaren Patch mit Scope-/Late-Callback-Proofs. Gepinntes pnpm12.8.1 wurde außerhalb Sandbox normal verifiziert; kein Integritäts-Bypass. Auth-Ownership/Admission-Fences werden separat präzisiert, bevor öffentliche Löschung freigeschaltet wird. Noch keine globale Löschung/Done-Abnahme.

Auth-Preflight konkretisiert: bevorzugt ein reproduzierbarer Fix am gepinnten BetterAuth-Komponenten-Writer, der auch Legacy-Aufrufe ohne optionale Hooks prüft. Aktuelle native Hooks erteilen einmalige, exakt gebundene Account-/Session-Write-Freigaben; neue nie zugelassene Auth-Wurzeln werden atomar journalisiert und begrenzt bereinigt. Contentfreie Replay-Sperren erlauben bewusst neue Generationen, ohne verspäteten alten Callback zuzulassen. Keine absolute Hosted-Timeout-Annahme, kein user.userId-Carrier. Noch keine Auth-Implementierung oder Löschabnahme; Pflichtfixtures und Source-/Dist-Patchparität folgen in Unit6B. Aktueller Dev-GitHub-Login false belegt keine historische Abwesenheit.

Agent-Dateien: Native Thread-Löschung dekrementiert Referenzen, entfernt aber weder Dateimetadaten noch app-_storage-Bytes. Koordinator muss ursprüngliche Thread/Message/File/Storage/Hash-Kanten vor Parentverlust dauerhaft sichern, fremde echte Dedupe-Referenzen erhalten und Nullreferenz-Metadaten plus Bytes separat nachweisbar löschen. Anomalien/Orphans nicht erzwingen. Aktueller Textmodell-Vertrag wird in bestehenden Generate-/Stream-Wrappern vor SDK-Speicherung gegen unerwartete File-Ausgabe geschlossen, bei unveränderter korrekter Kostensettlung; Source/TDD folgt Unit6A. Historischer14-Leertabellen-Dev-Audit bleibt nur datierte Evidenz, keine allgemeine physische Löschbescheinigung.

Kostenbegrenzt vorgezogen: frischer Standardmodell-Implementer baut aktuelle persistierte Lifecycle-Sperren, sichere Account-/Workspace-Vorschau, dauerhafte intern vorbereitete Löschjobs und eigenständig identitätsautorisierten Status. Öffentlicher destruktiver Start bleibt aus, bis ein funktionierender Executor vorhanden ist. Keine weitere Voranalyse; Native Kernfälle, direkte Caller und Typechecks statt Gesamt-/Browserwiederholung.

6A akzeptiert und als 6de8b2f lokal committed: 116 direkte native Tests, beide Typechecks, Format; unabhängige SPEC 36 Tests/10 Hashes und separate QUALITY APPROVE ohne Wiederholung. Echte Bereinigung noch offen: intern vorbereitete Jobs bleiben blockiert/fence/0 ohne öffentlichen Start. Standardmodell implementiert jetzt den gewählten nativen Auth-Commit-Guard in genau einer gepinnten Komponente plus aktuelle Zulassungs-/Erasure-Integration; keine erneute Voranalyse.

2026-10-10: 6B accepted exact11-source commit9d8ca84: fixed native Auth guard/current request JWT OAuth proofs, repeated deletion cooldown fixed, bounded sealed-job Auth purge/root-last primitives. 28 native + 2 fresh source/dist parity/both TS/format/offline reproducible patch PASS; separate SPEC and QUALITY accepted. Public destructive start/coordinator/end-to-end erasure remain unimplemented. User explicitly stops at clean checkpoint; In Progress/manual Done pending.

Restumsetzung: funktionierender Koordinator und identitätsautorisiertes mine vor Bootstrap ergänzt. Native Komponentenbereinigung darf Originalfile-Beweise nicht verlieren; deletionArtifacts ist dafür dauerhafte bounded Ownership-Queue. 15 fokussierte native Löschtests vor Komponentenpatch bestanden; vollständige Abnahme noch offen.

2026-10-10: Dauerhafter bounded Executor mit stop/components/objects/rows/auth/verify, echten R2-Receipts, scoped Agent-Datei-Claims/Storage-Löschung und Workflow-Residuals integriert. Shared-Account-Löschung erhält fremde Geschäftsdaten, entfernt private Actor-Zeilen und optionale Personenverweise. Bereits fehlender Workflow-Root idempotent. Ungeklärte externe Effekte/Ownership bleiben sicher wartend oder blockiert. Native Status-UI verhindert Workspace-Bootstrap während Löschung;41 kombinierte Lifecycle-Tests und Browser-Recovery bestanden. Manuelle Abnahme offen.

2026-10-12: Auf ausdrückliche Nutzeranweisung geschlossen; technische ACs belegt, frische gezielte Lösch-Tests 44/44 PASS. Manuelles Done per Nutzerbestätigung 2026-10-12.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Native wiederaufnehmbare Löschung mit festen Autoritäts-/Lifecycle-Gates, bounded Executor, echten R2-Receipts, Agent-Datei-Claims und App-Storage-Löschung sowie Workflow-Residuals implementiert. Shared-Account-Löschung entfernt private Daten/optionale Personenverweise, erhält gemeinsame Inhalte und notwendige inhaltsfreie Sperren. Späte Producer, unresolved external outcomes und unklare Ownership erzeugen echte wait/block-Zustände. Fehlende Workflow-Roots werden idempotent weiter bereinigt. Finale Lifecycle-Gruppe41/41, gesamte Integration506/506, Typecheck/Build und native Recovery/Deletion-Browserprüfung bestanden. Keine Live-Account-Löschung; manuelle Nutzerabnahme offen.
<!-- SECTION:FINAL_SUMMARY:END -->
