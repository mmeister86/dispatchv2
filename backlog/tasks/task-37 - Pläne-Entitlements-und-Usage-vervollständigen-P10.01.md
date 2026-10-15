---
id: TASK-37
title: 'Pläne, Entitlements und Usage vervollständigen (P10.01)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-09 05:55'
labels:
  - p10
  - r4
milestone: m-4
dependencies:
  - TASK-64
  - TASK-17
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P10.01.
Phase: P10 – Kommerzielles SaaS und öffentliche Veröffentlichung.

**Abhängigkeit:** P09, frühe Budget-Domain aus P05.01. **Dateien:** `convex/billing/entitlements.ts`, `convex/billing/usageLedger.ts`, `convex/billing/plans.ts`; Test `convex/billing/entitlements.test.ts`.

- Produkte nach Fähigkeiten und Limits modellieren: Accounts, Repositories, Research, AI, geplante Posts, Teamplätze und Speicher.
- Rechte serverseitig prüfen; UI nutzt dieselben erklärbaren Grenzen, ist aber nicht die Durchsetzungsinstanz.
- Reservierung und tatsächlichen Verbrauch bei Parallelität, Abbruch und Wiederholung konsistent führen.
- Downgrade, Testphase, überzogene Limits und Zahlungsprobleme als konkrete Zustandsregeln definieren.
- Billing-Provider ist Lemon Squeezy (TASK-38). Wiederverwendet werden der bestehende Shop aus Dispatch v1 und dessen bereits erteilte Freigabe; für v2 werden neue Produkte und Abo-Varianten eingerichtet. Das Domainmodell für Pläne, Entitlements und Usage bleibt providerunabhängig; die bestehenden Shop-IDs und neuen Produkt-/Varianten-IDs werden je Test-/Live-Modus explizit auf v2-Pläne und Abrechnungsintervalle abgebildet. Preise und Limits nicht aus Mock-Daten ableiten.
- Bestandsentscheidung bestätigt: Es gibt keine zu übernehmenden v1-Abos; das einzige vorhandene Testabo wird ebenfalls nicht übernommen. v2-Zugang entsteht ausschließlich über die neuen v2-Angebote. Keine Kunden-/Abo-Migration, Übernahme alter Varianten oder Bestandspreise vorsehen; das v1-Testabo und alte Varianten gewähren keine v2-Rechte.

**Vorgeschlagene Produktregel:** Neue kostenpflichtige Research-/AI-Läufe stoppen bei fehlender Berechtigung. Bereits freigegebene Termine werden während einer klar kommunizierten Kulanzfrist weiter bedient; danach pausieren sie sichtbar. Umfang und Dauer werden vor GA entschieden, nicht im Code versteckt.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D10: Preise, Quoten und Kulanz auf Basis realer Unit Economics entscheiden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gleichzeitige Agent-Läufe überschreiten das vereinbarte Budget nicht unbemerkt.
- [ ] #2 derselbe Verbrauchsbeleg wird nicht doppelt gebucht, tatsächlich neue Provider-Versuche bleiben als Kosten sichtbar.
- [ ] #3 Eine mögliche Kulanz gegenüber Kunden ist eine gesonderte Billing-Regel.
- [ ] #4 ein Downgrade löscht keine Nutzerinhalte.
- [ ] #5 Neue Lemon-Squeezy-Produkte und Abo-Varianten im bereits genehmigten Shop sind getrennt nach Test-/Live-Modus eindeutig auf v2-Pläne und Abrechnungsintervalle abgebildet; unbekannte oder alte v1-Varianten gewähren keine Rechte.
- [ ] #6 Es werden keine v1-Kunden oder Abos übernommen. Das vorhandene v1-Testabo gewährt keine v2-Rechte; v2-Billing benötigt keine Bestandsmigration und startet mit den neuen Angeboten.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/billing. Mock plan and quota usage, trial/active/limit/payment/grace/expired status previews; preserved contents on local downgrade. Grenze: No server-side entitlement enforcement, actual usage ledger or real billing grace policy. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root hat /tmp/dispatch-continuation-37-38-seams.md vollständig gelesen. Aktuell keine nativeBilling/Trial/Subscription-Domain; SettingsCloudzeigt nochDemoDefaults mit rejectedLocalWrites. Tatsächliche fünf paidOwner-Familien teilen changeLiability(admission=true): dort künftig trustedCapability/ScopeResolver vorCounterAdmission; Reconcile/lateUnknownHold bleibt unabhängig von aktuellerTrial/Payment/Role. OAuthFinalize/NewAccount, repoIncrementalSelect, MediaReserve, nativeResearchAdmit/ProfileFire, sharedScheduleTransaction/FirstWrite/Restart/SendPreflight sind echteCommercialAdmissionSeams. 100Account undandereEngineeringCaps keineEntitlements. Später final46EmbeddingOwner/final49SeatAccept ergänzen, nichtfivefamiliesalsvollständigspäterausgeben. D10Catalog/Units/Trial/Grace/MigrationGrant nichtausDemoübernehmen; currentbeta migration muss ausdrücklichdefiniertbleiben. Read-only/no freshTests/source/config/provider; final48ffbeforesourceimplementationreconcile.

Root adopted readonly current delta /tmp/dispatch-37-38-current-native-reconciliation.md SHA a29180e3522c084be4324eedfefb2947c4e660c3fd32feda721cc8ad9fde2d25 after full report/semantic receipt;41 unowned source+2 input before/after sha/bytes exact. Actual seven financing families include new own-content-embedding and jev-intent-router; six createRun call sites in five modules. Team49 actual accept has new-member CAS and personal-workspace bootstrap; Research pause withdraws material and must not become payment pause. Preserve original three distinct budgets, once-per-attempt original currency, known0 versus enteredunknown, late settlement and publishing checkpoints across payment/role/source loss. Native Billing/Stripe absent; D10 tariff/units/trial/migration/grace and D11 actual offering/config stay open, never Demo defaults. Moving68.1 excluded, captured tool output digests qualified (no underlying persisted logs for independent root recomputation). No tests/source release/config/provider/billing/manual acceptance; allAC/DoD remain open.

Umplanung 2026-10-09 auf ausdrücklichen Nutzerwunsch: Lemon Squeezy ersetzt Stripe als Billing-Provider. Der Nutzer besitzt bereits einen genehmigten Shop aus Dispatch v1; dieser wird als Ausgangsbasis wiederverwendet. Frühere Stripe-/Managed-Payments-Verweise im referenzierten Plan und in bisherigen Notizen sind historischer Stand; für die geplante Billing-Integration gilt diese Taskfassung. Nur Backlog-Umschreibung: keine Implementierung, Provider-Konfiguration, Migration oder Live-Aktivierung durchgeführt. Status, Abhängigkeiten und offene Abnahme bleiben unverändert.

Klarstellung des Nutzers vom 2026-10-09: Es gibt keine zu übernehmenden Bestandsabos außer einem v1-Testabo, das ebenfalls nicht übernommen wird. Wiederverwendet werden ausschließlich der bestehende Lemon-Squeezy-Shop und dessen bereits erteilte Freigabe. Der Shop wird für v2 mit neuen Produkten und Abo-Varianten umgebaut. Wiederverwendung alter Produktvarianten, Bestandsinventarisierung für eine Migration, Abo-/Kundenmigration und v1-Bestandsschutz sind kein Umsetzungsscope. Diese Klarstellung ersetzt die entsprechenden Annahmen der vorherigen Umplanung; Preise, Quoten und Kulanz aus D10 bleiben offen. Nur Task-Beschreibung, AC und Plan angepasst; keine Änderung im Live-Shop und keine Löschung oder Kündigung des Testabos durchgeführt.
<!-- SECTION:NOTES:END -->
