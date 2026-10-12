# Task 33 Closure Plan

Goal: backlog TASK-33 inkl. aller Subtasks abschließen (Status Done), nachdem die Implementierung bereits in aa575de integriert ist. Keine neue Feature-Implementierung; nur frische Evidenz-Verifikation, Backlog-Abschluss und Commits.
Spec: backlog/tasks/task-33*.md (ACs dort sind bindend), .docs/plans/2026-10-08-task-33-implementation.md.

## Global Constraints
- Preserve pre-existing working tree edits; no main/master implementation. Work on branch codex/backend-research-summaries.
- Current user/selected workspace/session/source authority precedes payloads, private ownership remains separate from Owner/Admin rights.
- Bound pages and wire bytes, never call capped UI lists a complete archive.
- Never lose original R2 locators before a durable deletion outcome; fail safely on unknown provider effects.
- User selected operational 30-day retention; do not invent legal/provider/backup facts.
- Nutzeranweisung vom 2026-10-12 "schließe backlog Task 33 inkl. seiner Subtasks ab" gilt als ausdrückliche manuelle Done-Bestätigung (DOD #2) für alle 7 Tasks.
- Keine Push-/Deploy-Aktion. Nur lokale Commits der Backlog-Dateien (+ dieses Plan-Dokuments im Final-Commit).
- Tests gezielt ausführen (betroffene operations-Dateien), kein pauschaler Full-Suite-Lauf ohne konkreten Anlass; Typecheck `pnpm typecheck` einmal je Task, wenn Evidenz es verlangt.
- Backlog-Format wahren: `status: Done`, `updated_date: '2026-10-12'`, DOD-Checkboxen nur mit belegter Evidenz abhaken, eine knappe Abschlussnotiz in Implementation Notes ergänzen.

## Task 1: TASK-33.1 inkl. 33.1.1/33.1.2/33.1.3 verifizieren und schließen
Dateien (nur diese editieren): backlog/tasks/task-33.1 - *.md, backlog/tasks/task-33.1.1 - *.md, backlog/tasks/task-33.1.2 - *.md, backlog/tasks/task-33.1.3 - *.md (exakte Dateinamen per ls ermitteln).
- Prüfe: alle ACs in den 4 Dateien sind [x]; Final Summaries vorhanden; Evidenz in .docs/reviews/task-33.1.1-validation.md, task-33.1.2-inventory-validation.md, task-33.1.3-validation.md, task-33-intelligence-a-validation.md, task-33-measurement-history-validation.md, task-33-shared-archive-validation.md, task-33-private-archive-validation.md existiert.
- Frische Verifikation: gezielte Export-Tests ausführen (z. B. `pnpm vitest run convex/operations/export.test.ts convex/operations/exportShared.test.ts convex/operations/exportPrivate.test.ts convex/operations/exportIntelligence.test.ts convex/operations/exportMeasurements.test.ts` — nur existierende Dateien verwenden, Liste per ls convex/operations/ ermitteln) und Ergebnis zählen.
- Setze in allen 4 Dateien status: Done, updated_date '2026-10-12', DOD #1 und #2 auf [x] (DOD #2 mit Verweis Nutzerbestätigung 2026-10-12), ergänze je eine Abschlussnotiz-Zeile in den Implementation Notes.
- Commit: `docs(backlog): close TASK-33.1 export family` mit nur diesen 4 Dateien.

## Task 2: TASK-33.2 verifizieren und schließen
Datei: backlog/tasks/task-33.2 - *.md.
- Prüfe ACs [x], Final Summary vorhanden.
- Frische Verifikation: `pnpm vitest run convex/operations/deletion.test.ts` (falls existent, sonst tatsächliche Deletion-Testdateien per grep ermitteln) ausführen und zählen.
- Gleiche Done-/DOD-/Notiz-Behandlung wie Task 1. Commit: `docs(backlog): close TASK-33.2 deletion`.

## Task 3: TASK-33.3 verifizieren und schließen
Datei: backlog/tasks/task-33.3 - *.md.
- Prüfe ACs [x], Final Summary vorhanden.
- Frische Verifikation: Retention-Tests ausführen (per grep nach retention-Testdateien suchen, z. B. convex/operations/retention*.test.ts) und zählen.
- Gleiche Done-/DOD-/Notiz-Behandlung. Commit: `docs(backlog): close TASK-33.3 retention`.

## Task 4: TASK-33 Parent schließen und integrierte Abnahme belegen
Datei: backlog/tasks/task-33 - *.md (Parent, nicht 33.1/33.2/33.3).
- Prüfe: Kinder 33.1/33.2/33.3 sind Done (grep status in deren Dateien), Parent-ACs [x].
- Integrierte Verifikation: `pnpm typecheck` ausführen; gezielte operations-Testdateien aus Tasks 1-3 gemeinsam laufen lassen (gleiche Kommandos, Ergebnis gesamt zählen).
- Setze Parent status: Done, DOD [x]/[x], Abschlussnotiz mit Verweis auf Kinder-Done + Nutzerbestätigung 2026-10-12.
- Commit: `docs(backlog): close TASK-33` inkl. Parent-Datei und diesem Plan-Dokument.
