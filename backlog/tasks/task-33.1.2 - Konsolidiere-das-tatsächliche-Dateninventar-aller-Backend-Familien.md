---
id: TASK-33.1.2
title: Konsolidiere das tatsächliche Dateninventar aller Backend-Familien
status: In Progress
assignee: []
created_date: '2026-10-07 22:42'
updated_date: '2026-10-10 13:23'
labels: []
dependencies: []
parent_task_id: TASK-33.1
priority: high
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ergänze den bisher inkrementellen Inventarbericht um eine aktuelle, quellengestützte Matrix aller104Anwendungstabellen und der tatsächlich installierten Auth/Agent/Workflow/Workpool- und getrennten R2/Komponenten-Dateispeicher. Benenne Zweck, Eigentümer/Privatsphäre, Weitergabe, originale/aktuelle Aufbewahrungsgrenzen, konkrete Bereinigung und reale fehlende globale Export/Lösch/Restore-Pfade; keine rechtlichen oder Provider-Nachweise erfinden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Alle104nativen Schema-Deklarationen sind disjunkt und vollständig zugeordnet; jede Familie enthält belegten Zweck, Besitzer/Privacy, Weitergabe, Retention und vorhandenen/fehlenden Löschweg mit tatsächlichen Source-Verweisen.
- [x] #2 Installierte BetterAuth/Agent/Workflow/Workpool-Tabellen und R2 sowie Agent-Dateispeicher sind getrennt aufgenommen; Credential/Token/Provider/Internal-Felder werden ausdrücklich vom Business-Export ausgeschlossen.
- [x] #3 Aktuell akzeptierte68.2/68.3/31.1/32.2/33.1.1/35.1-Felder und reine Projektionen sind korrekt reconciled; laufende32.3 wird als noch nicht akzeptiert gekennzeichnet. Kein All-Export/All-Erasure/Restore/gesetzlicheRetention-Claim.
- [x] #4 Unabhängige genaue Schema-Abdeckung/Source-Guard und Dokumentprüfung sind festgehalten; historische Hinweise bleiben erhalten, neue Matrix verweist auf konkrete nächste Pflichtimplementierungen. ManualDone bleibt offen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Alle technischen ACs sind überprüft, der konkrete Stand committed und erforderliche Dev-Synchronisierung dokumentiert.
- [ ] #2 Der Nutzer hat nach eigener Prüfung ausdrücklich bestätigt, dass dieser Task als Done markiert werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Akzeptierten349Source-Stand4a22190 gegen deklarierte104Schemafamilien und installierte Komponenten erheben. 2. data-inventory um konkrete104-Familien/Komponenten/R2-Matrix ergänzen; historische Addenda erhalten, laufende32.3 separat unakzeptiert markieren. 3. Belegte Eigentümer/Privacy/Weitergabe/originale und aktuelle Retention/konkrete Cleanup- und fehlende Export-Erasure-Restore-Pfade dokumentieren. 4. Root zählt unabhängige Schema-Abdeckung, liest alle Änderungen und prüft Source-Guards; eigener Dokumentcommit, keine Provider-/Legal-/ManualDone-Behauptung.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dokumentationsownership ausschließlich .docs/decisions/data-inventory.md bei repair_preflight; bounded_repair ist alleiniger32.3Sourcewriter. Immutable Inventarbasis4a22190/349hashes; laufendeSchemaänderung darf nicht als akzeptiert behandelt werden. Vollständige eigentliche Export/Lösch/Retention-Implementierung bleibt weiter erforderlich.

Technische Dokumentprüfung bestanden:104uniqueexakteSchemadeklarationen, historischeByteserhalten,31schema/importHashprovenance und13installedcomponentHashprovenance,339protectedalteNongens+5gens/humanexact. RoothatvollständigeMatrix undindependentQUALITYPASSgelesen;Review/Validationin.docs/reviews/task-33.1.2-inventory-{quality,validation}.md. Moving32.3ausAkzeptanzbasis4a22190ausgeschlossen. KeineTests/Provider/Deployment/LifecycleImplementierungbehauptet. Commitwartetauf32.3FixedHEADGates;manualDoneoffen.

Konsolidierte 104-Tabellen-Matrix und Komponenten durch getrennte QUALITY und Root geprüft. Akzeptierter TASK-32.3-Nachtrag anhand immutable cb5f5ef ergänzt; ursprüngliche Matrix unverändert. Dokumentationscommit, keine Live-Erasure/Restore/Exportvollständigkeit behauptet. Done benötigt ausdrückliche manuelle Nutzerbestätigung.

2026-10-10: Inventar um final integrierte Export-/Deletion-/Retention-Abdeckung und gepinnte Agent-/Workflow-Claims erweitert. Historische Gaps durch aktuellen Addendum präzisiert. Parent-Integration506/506 Tests bestanden; manuelles Done weiterhin offen.
<!-- SECTION:NOTES:END -->
