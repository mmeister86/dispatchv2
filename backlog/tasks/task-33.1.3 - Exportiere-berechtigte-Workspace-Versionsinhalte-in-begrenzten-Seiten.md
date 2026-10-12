---
id: TASK-33.1.3
title: Exportiere berechtigte Workspace-Versionsinhalte in begrenzten Seiten
status: In Progress
assignee: []
created_date: '2026-10-07 23:23'
updated_date: '2026-10-10 13:23'
labels: []
dependencies: []
parent_task_id: TASK-33.1
priority: high
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ergänze den tatsächlichen Workspace-Export um paginierte gemeinsame Draft-Versionsinhalte mit einem tenant-first Index. Jede Seite prüft aktuelle Owner/Admin- und Quellenrechte; keine privaten Ursprungsgraphen, Secrets oder Medienbytes. Begrenzte Scan-Fortsetzung ist kein vollständiger atomarer Workspace-Export. Umsetzung erst nach konkreter Sourcefreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Native selektierte Workspace-Pagination verwendet genau einen begründeten Versionsindex, aktuelle verifizierte Own-Scope/Owner-Admin-Rechte und native Cursor; kein fremder Workspace oder Account gelangt vor Kandidatenfenster und Payload.
- [x] #2 Exportierter Inhalt ist explizit allowlisted und durch aktuellen Draft-Root sowie retained Quellenbeweis gedeckt; bekannte unexportierbare Inhalte geben keine Skeletons, Gründe oder Auslassungszahlen zurück. Unerwartete DB-, Ressourcen-, Ancestry- und Wirefehler brechen die Seite ab.
- [x] #3 Gemeinsame native Lese-/Byte-/DTO-Budgets einschließlich Auth und Quellenarbeit sind gemessen und erzwungen; echte Fortsetzung, Creation-Time-Auswahlgrenze und pro-Seite-Beobachtung werden von Vollständigkeit und atomarem Snapshot getrennt.
- [x] #4 Reale native Isolation/Quelle/Rootless/Cap/mehrseitige und ZeroIO-Kontrollen erhalten den eigenen Profil-Export; eingeführter UI-Download ist bounded und Scope-fenced. Frische Reviews, Root-Gates, Commit und exaktes EUDev sind belegt; übrige Familien und Komponenten bleiben explizit offen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Sourcefreigabe: genau eine native Versionskandidatin pro Anfrage, bestehender Walk32, explizite gemeinsame Business-Felder und Root/Account-Proof.
2. Native gesamte Query-Transaktionsgrenzen statt künstlicher128-Reads-Grenze; UTF8-Wire und Download64KiB, tatsächliche registered Metrics und Producer-Kontrollen.
3. Native Cursor/finite Creation-Time-Auswahlgrenze, Download je Seite mit live Scope/Nonce/Horizon/ABA-Fence, ehrliche Teilabdeckung.
4. Fresh SPEC, getrennte QUALITY, Root-Gates, Sourcecommit und exaktes bestehendes EUDev; Done nur nach manueller Nutzerbestätigung.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-only Vorbereitung /tmp/dispatch-33.1-workspace-export-next-audit.md und /tmp/dispatch-33.1-workspace-export-index-clarification.md auf immutable cb5f5ef. Root bevorzugt direkte Workspace-Version-Pagination statt temporärem Named-Draft-Endpoint. Bekannte Verluste dürfen nur unter explizit freigegebener tenant-business-progress-Grenze ohne Payload/Skeleton/Auslassungszahl übersprungen werden; keine strict-hidden-count-invariance behaupten. Native Geschichte zeigt bereits redigierte gemeinsame Versionsmetadaten, Rootless-Inhalte benötigen trotzdem expliziten Rootbeweis. Aktuelle offizielle Convex-Dokumentation per Context7 library +2docs eingeholt: Indexreihenfolge und QueryCtx/MutationCtx same snapshot; ActionCtx und separate Seiten haben separate Transaktionen. Creation-Time-Auswahlgrenze ist kein Commit-Order-Snapshot. Noch keine Sourcefreigabe oder Umsetzung.

Root liest immutable Reader-Privacy-Audit195b3e und konkretisiert geplanten Scope: bereits gemeinsam gespeicherte Draft-Versionstexte mit bestehenden retained Source-Minima, zusätzlichem aktuellem verifiziertem Owner/Admin/Session/ausgewähltem Workspace sowie explizitem Root/Account-Beweis. Keine private Archive-Rechte aus Owner/Admin ableiten; keine raw Chat/targeted Research/Provenienz/Personen/Medien/Secrets, keine Behauptung frei von privat abgeleitetem gemeinsamem Text. Eigene private Archive später je tatsächlichem Reader-Grant. .docs/reviews/task-33.1.3-shared-content-policy.md ist Planung, keine Sourcefreigabe; konkrete Budgets/Consumer erst nach akzeptierter32.4 messen/freigeben.

Root read-only Page-Budget-Preflight cbd6cd55 vollständig gelesen: .docs/reviews/task-33.1.3-page-budget-preflight.md. Vier Kandidaten/sharedwalk32 kann einzeln gültige Ancestry zusammen ablehnen; sogar ein gültiger Kontext-/Run-Graph kann128 Reads überschreiten. Geplant kleinster Page1/Walk32 ohne neue Cache/Walker; keine universelle128/512KiB-Garantie. Positive bekannte Flags/Root-/Accountverluste separat, mehrdeutige helper Errors/Foreign/Ancestry/Ressourcen ganzeSeite fail. Konkrete native Limits und Producer-Controls vor Sourcefreigabe; kein runtime-/Export-Abnahmebeleg aus statischem Audit.

Root Sourcefreigabe auf ec7d59da30e0a8096b31275f579061f51e54d60a: sechs existierende Sourcepfade laut /tmp/dispatch-33.1.3-baseline.json, eigener Profil-Export unverändert. Ein public workspaceQuery versions im vorhandenen Exportmodul, ein draftVersions[workspaceId]-Index, eine Kandidatin/Standardwalk32, keine neue Walker/Cache/Komponenten/Dependencies. Native Plattformlimits umfassen äußere Auth und Quellenarbeit, Fehler propagieren; konkrete Messungen ersetzen keine universelle Graph-Liveness-Garantie. Aktuelle Context7-Dokumentation: nested transactionLimits können nur senken und verbrauchte Overages zählen; kein Zero-Overshoot-Anspruch. Nur positive Flags/fehlender Root/fehlender eigener Account/finite abgelaufener Horizon dürfen ganze Payload auslassen; fremde Bindungen, mehrdeutige Helperfehler, Ancestry/Ressourcen/Wire fail. Consumer lädt maximal eine gemeinsame Business-Version je Seite, keine Ursprungsarchive/Medien/Personen/Secrets. Weitere Exportfamilien/Komponenten/atomarer Gesamtexport bleiben offen.

Technisch abgenommen: Source169fdd175d1dd0cc17101af71d1e966188ccef9c/exaktesEUDev471/+1publicversions, alle470altenValidator/Type/Visibility/5HTTPunverändert. Writer17, Root178/6freeze1 qualifiedruntimeunchangedfinal3, frischeSPEC207/5qualifiedpriorruntime undfreshQUALITY207/5final3;283actualstyled/245originalretained. 25realnativeProducerknoten166q/docs56931Bread787wirezeroqueryeffects; syntheticmodeloutputs/queuedprovider nicht ausgeführt. Source355/5generated/344protected/humanzcodeignoreunverändert. HistorischeScreenshot/Clock/FormatREDs erhalten, minimalcapturewaitrepair/freshformal1280/390clean. .docs/reviews/task-33.1.3-validation.md. Manueller Done-Status offen; weitereParentExportfamilien/Archive/Erasure/Retention bleiben offen.

2026-10-10: Parent-Integration506/506 gezielte Tests und Typecheck/Build bestanden. Akzeptierter paginierter Versions-Export integriert, Original-Medienreferenzen und separate Byte-Exporte ergänzt. Manuelles Done weiterhin offen.
<!-- SECTION:NOTES:END -->
