---
id: TASK-33
title: 'Export, Löschung und Retention umsetzen (P09.03)'
status: Done
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-12'
labels:
  - p09
  - r3
  - arbeitspaket
  - jev
milestone: m-3
dependencies:
  - TASK-26
  - TASK-29
  - TASK-30
  - TASK-33.1
  - TASK-33.2
  - TASK-33.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P09.03.
Phase: P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität.

**Abhängigkeit:** P01–P08-Datenmodell. **Dateien:** `convex/operations/export.ts`, `convex/operations/deletion.ts`, `convex/operations/retention.ts`, `src/features/settings/data-controls.tsx`, `.docs/decisions/data-inventory.md`; Test `convex/operations/deletion.test.ts`.

- Dateninventar mit Zweck, Besitzer, Provider-Weitergabe, Aufbewahrung und Löschweg erstellen.
- Account-/Workspace-Export mit Inhalten, Quellenbezügen, Planungen und relevanten Präferenzen bereitstellen.
- Wiederaufnehmbare Löschung bauen: Workspace sperren, Jobs stoppen, Tokens entfernen, Storage, Agent-Memory, Embeddings und abgeleitete Modelle bereinigen.
- Abgeschlossene Workflow-Journale und Agent-Komponentendaten ausdrücklich in Retention, Export und Löschung aufnehmen; nicht automatisch verschwindende Komponenten-Daten nach dem Diagnose-/Abgleichfenster bereinigen. Benötigte Publishing-Nachweise zuvor in der Domain sichern.
- Temporäre Uploads und finale R2-Objekte mit dem Convex-Löschfortschritt abgleichen; Metadaten nicht vor gesichertem Objektverweis/Löschauftrag entfernen. Bereits fehlende Objekte als idempotenten Erfolg behandeln und verwaiste Dateien nach Unterbrechungen bereinigen.
- Provider-seitige Entfernungen und Sperrungen aus P06 ebenso wie Nutzerlöschungen bis in gespeicherte Quellenkopien, Caches und Agent-Kontexte verfolgen; veraltete Evidenz nicht erneut aus Backups oder Wiederholungen aktivieren.
- Bei Account-Löschung persönliche Mitgliedschaften und Identität entfernen; gemeinsame Workspaces nicht ohne deren eigene Berechtigung löschen. Für alleinige Eigentümer zuvor Übergabe oder bewusste Workspace-Löschung anbieten.
- Provider-seitige Datenkopien, Backups und gegebenenfalls rechtlich aufzubewahrende Abrechnungsdaten getrennt behandeln und verständlich erklären.
- Das Entfernen einer Integration von der Löschung bereits öffentlicher Posts unterscheiden.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Großes Paket: Die zugeordneten Unteraufgaben liefern die Implementierung in begrenzten Schritten. Dieses übergeordnete Ticket hält den vollständigen Planvertrag und wird erst nach integrierter Abnahme aller Unteraufgaben geschlossen.

### JEV-Abgleich vom 18.09.2026

Das Daten-Lifecycle-Paket umfasst zusätzlich Jev-Assessments, Analyse-Caches, Entscheidungs-/Verifikationsergebnisse sobald eingeführt, Usage, kontrollierte Eval-Daten und optionale Debug-Rohantworten. TASK-33.1–33.3 liefern Inventar/Export, wiederaufnehmbare Löschung und Retention. Die Provider-/EU-only-Freigabe gehört vor die erste Übertragung in TASK-1; dieses spätere Self-Service-Paket ersetzt sie nicht.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Löschung während laufender Recherche/Publikation verhindert neue Arbeit.
- [x] #2 Wiederholungen reaktivieren den Workspace nicht.
- [x] #3 Export enthält keine Provider-Secrets.
- [x] #4 Der Betreiber kann den Abschluss nachweisen, ohne Inhalte unnötig zu behalten.
- [x] #5 Alle bis zum Release eingeführten Jev-Daten und Jobs sind durch Inventar, autorisierten Export, Löschung und Retention abgedeckt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [x] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehenden akzeptierten Checkpoint fortsetzen, keine neuen Preflight- oder Freeze-Dokumente.
2. Export-Restfamilien und Originalmedien durch Export-Implementer; Löschkoordinator durch Lifecycle-Implementer; Retention durch Retention-Implementer in disjunkten Dateien ergänzen.
3. Root integriert native Datenkontrollen und API-Codegen.
4. Einmal gezielte Tests je Änderung, Typecheck/Build und begrenzte unabhängige SPEC/QUALITY-Prüfung.
5. Nur belegte ACs abhaken, manuelle Nutzerabnahme für Done einholen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/data, /team. Active-workspace JSON export, retention preferences, scoped deletion confirmation/error/retry; account identity/membership deletion preserves shared contents. Grenze: No server data inventory, provider/R2 deletion, backups or legal retention execution. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Incrementelles reales Intelligence/Kalibrierungsinventar ergänzt: .docs/decisions/data-inventory.md (Quellstand43.3 582ecf0). Algorithm/Audience/Selection/Receipts, tatsächliche Jev/Performance-Vorfahren, calibrationPurposes/References/Models einschließlich finite Monitoring/Activation/Rollback/spentTombstones/Controls und publicationKnowledge.projection samt Scope/Akteuren/Purpose-Generation/Horizonten/providerWeitergabe/immediateMask/physischemCleanup/erhaltenenFinancialPublishing-Eltern. Kein vollständiger Workspace-Export, Account-/Workspace-Erasure, Audit-Aufbewahrungsentscheid oder33-Abnahmezertifikat.44-Varianten werden erst am tatsächlichen geprüften Schema aufgenommen;45Vertrag dokumentiert geplante neueEdges. Restore darf Consent/Model/Pins nicht erneuern oder spentIDs weglassen.

TASK44 Inventar-Erweiterung vorbereitet: Root hat actual intelligenceSourceUpdates union/check/proposal/evaluation, optionale algorithmProfiles.update-Verweise und aktuelle Eval-Actor-Proofs vollständig gelesen. .docs/decisions/data-inventory.md dokumentiert actor/key/intent, base/check/proposal/eval/profile graph, public HTTPS forwarding, bounded attempts versus separate lawful retention. Noch pending fresh SPEC/QUALITY/exaktesEUDev; kein vollständiger Export/Löschlauf oder TASK33-Abnahme.

TASK-44-Graph jetzt softwareakzeptiert an7427f01 und exaktesEUDev UTC15:15:11 verifiziert; .docs/decisions/data-inventory.md und .docs/reviews/task-44-source-updates-validation.md reconciled. Vollständige OriginalCheck→Proposal→Evaluation→DerivedProfile/ActorEdges und unknownCounterUnbestätigtheit erhalten; weder Lifecycleinventar noch Export/ErasurePolicy vollständig abgenommen. Keine Done-Änderung.

Root hat read-only /tmp/dispatch-continuation-33-36-seams.md vollständig gelesen: nochkeinOperationsExport/Delete/RetentionBackend, UserLifecycle/Bootstrap kannfehlendenUser reprovisionieren, Actor/freeText und before/resultEdges brauchen eigeneErasureProofs. PrivateNativeChatOwnership, parent-onlyResearchCopyBindings, actualAgent/WorkflowArtefakte, R2readyFinal/latePUT und unknownPublishing/FinanceEltern dürfen nicht pauschal gelöschtwerden. InheritedGithubcontext maskiertCurrentProof, privateExcerpt/SummaryPhysischeGraphCleanup bislang explizitdeferred; 45+ neueDerivatives dürfen dieseDeferral nicht übernehmen. Bericht baseline7a1494c, laufender48 wedergeprüftnochgeändert; keinefrischenTests/LifecycleAbnahme.

2026-10-08: Nutzer hat die vollständige Implementierung von TASK-33 einschließlich aller Subtasks mit subagent-driven-development ausdrücklich beauftragt. Aktuelle Basis 36fffeb auf codex/backend-research-summaries; bestehende uncommittete Task-/Review-/zcodeignore-Änderungen bleiben erhalten. Initialer Gesamttest läuft. Export- und Lifecycle-Preflight getrennt beauftragt.

Nutzerentscheidung 2026-10-08: gewünschte betriebliche Aufbewahrung 30 Tage. Dies ist keine erfundene gesetzliche Frist; ungeklärte externe Effekte benötigen gesonderte inhaltsfreie Sperren/Abgleich bis zur sicheren Auflösung. Baseline: beide Typechecks PASS; vollständiger nativer Vitest-Lauf 1582 PASS/1 Timeout (vor Änderungen, bestehender disjoint26-styleProfiles mixed=true Test nach900000ms). Keine neue Regression behauptet.

2026-10-09: Nutzer meldet 80% Wochenquote und 24h Aufwand; ausdrücklich Restumsetzung mit deutlich begrenztem Aufwand gewählt. Keine weiteren Voranalysen, günstigere Modelle, gezielte statt pauschal wiederholter Prüfungen. Erforderlicher Umfang und Datenschutz-/Datenverlustschutz bleiben. Aktuelles 4B1-QUALITY mit zwei konkreten Archivkonsistenz-Findings wird gezielt in zwei Dateien repariert.

2026-10-10: Nutzer fordert ausdrücklich Jetzt mit sauberem Zwischenstand beenden. Geprüfter Auth-Teil 9d8ca84 gesichert, frischer SPEC nach behobenem Repeat-Deletion-Finding und getrenntes QUALITY APPROVE. 28 focused native + 2 fresh source/dist parity, beide TS, Format und frozen offline Patch-Reproduktion bestanden. Ziel wird pausiert; keine neue Umsetzung, kein Done, keine unbewiesenen ACs. Zwischenstand/offene Arbeiten: .docs/reviews/task-33-checkpoint.md. Weiter offen: tatsächlicher Löschkoordinator/Komponenten/R2, 30-Tage-Retention, verbleibende Exporte/Originalbytes, native Lösch-UI und integrierte Abnahme.

2026-10-10: Nutzer beauftragt Wiederaufnahme und vollständige Restumsetzung mit engen Zeit-/Tokenmaßstab. Ziel: erste integrierte Restumsetzung innerhalb ca. 30 Minuten, keine endlosen Review-/Dokumentationsschleifen; Sicherheits-/Löschvollständigkeit bleibt verbindlich. Drei begrenzte Arbeitsstränge, bestehende Nachweise wiederverwenden.

2026-10-10: Umsetzung integriert: paginierte sichere Exporte inkl. Identity/Originale, native Datenkontrollen, dauerhafter Löschkoordinator, scoped Agent/Workflow-Patches und 30-Tage-Retention. Build und vollständiger App-/Backend-Typecheck bestehen. Löschung/Retention/Komponenten41 Tests und native Workspace-Recovery-Browserprüfung bestehen. Abschlussprüfung repariert alte Jev-Nullhorizont-/Cleanup-Budget-Erwartungen ohne Lockerung der Runtime-Proofs. Keine weitere Umfangserweiterung nach Nutzerhinweis auf150min. Kein Deployment und kein Done ohne vorgeschriebene manuelle Nutzerabnahme.

Abschlusskorrektur: pauschaler30-Tage-Cap auf gespeicherte redaktionelle Assessments und Kalibrierungsnachweise würde den akzeptierten28-Tage-Qualifikations-/Monitoring-Pfad deaktivieren. Deshalb bleiben deren originale zweck-/quellengebundene Fristen bestehen; Diagnose-/Ausführungskopien, Routing/Verifier und Agent/Workflow bleiben betrieblich begrenzt. Keine Quellenfrist wird verlängert. UI/Inventar erklären diese Unterscheidung.

2026-10-12 Abschluss: Kinder TASK-33.1 (inkl. 33.1.1/33.1.2/33.1.3), TASK-33.2, TASK-33.3 sind Done (2c2e557, 4b69590, 4119a5d); Nutzerbestätigung 2026-10-12 "schließe backlog Task 33 inkl. seiner Subtasks ab" gilt als manuelle Done-Bestätigung (DOD #2) für alle 7 Tasks. Integrierte Abnahme: pnpm typecheck PASS; 221/221 gezielte operations-Tests in 16 Dateien (11 Export, 4 Deletion/Erasure/Admission, Retention) PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Export, Löschung und Retention einschließlich Unteraufgaben lokal integriert. Sichere paginierte Business-/Private-/Jev-/Kalibrierungs-/Finanz-/Identitätsarchive und Originaldateien, native Datenkontrollen, dauerhafter Löschkoordinator sowie scoped Agent/Workflow-Residuals und Storage-Claims. Quellenverlust propagiert; gemeinsame Geschäftsdaten bleiben bei Account-Löschung erhalten. Betriebskopien30Tage, gespeicherte Assessments/Kalibrierung mit originalen zweckgebundenen Fristen. Finale integrierte Prüfung:506/506 Tests in22 Dateien, kompletter App-/Backend-Typecheck, Build, Diff-/Formatprüfung und tatsächlicher Workspace-Recovery/Deletion-Browsertest bestanden. Bekannte Prüfgrenzen: kein Live-R2/Provider-/Backup-Erasure, kein Deployment, keine komplette22+ Anwendungssuite; externe Outcomes/unklare Legacy-Ownership bleiben sicher blockiert. Build zeigt Chunk-Warnungen, Convex-Test Node-Timer-Warnungen bei30-Tage-Jobs; keine Testfehler. Technische AC geprüft; DOD/manuelles Done offen.
<!-- SECTION:FINAL_SUMMARY:END -->
