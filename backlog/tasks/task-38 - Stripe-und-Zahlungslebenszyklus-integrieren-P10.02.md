---
id: TASK-38
title: Stripe und Zahlungslebenszyklus integrieren (P10.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-07 13:50'
labels:
  - p10
  - r4
milestone: m-4
dependencies:
  - TASK-37
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P10.02.
Phase: P10 – Kommerzielles SaaS und öffentliche Veröffentlichung.

**Abhängigkeit:** P10.01 und bestätigte Verfügbarkeit des gewählten Stripe-Angebots. **Dateien:** `convex/billing/stripe.ts`, Billing-Webhooks in `convex/http.ts`, `src/features/settings/billing.tsx`; Test `convex/billing/stripe.test.ts`.

- Stripe Managed Payments auf tatsächliche Eignung, Länder-/Produktverfügbarkeit und Abrechnungsanforderungen prüfen; das Domainmodell bleibt unabhängig.
- Checkout, Vertragsverwaltung und Kündigung integrieren.
- Signierte, doppelte und in anderer Reihenfolge eintreffende Webhooks korrekt verarbeiten; regelmäßig Provider-Zustand abgleichen.
- Auch außerhalb von Dispatch ausgelöste Kündigungen, Erstattungen und gegebenenfalls Kundendatenlöschungen des gewählten Stripe-Angebots in die Vertragstests aufnehmen.
- Zahlungsbelege und Benachrichtigungen über den jeweils zuständigen Provider bereitstellen; Aufgaben für Steuer-/Rechtsprüfung dokumentieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D11: Stripe-Angebot nach tatsächlicher Verfügbarkeit und fachlicher Prüfung wählen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Doppelte oder verspätete Events stellen keinen alten Tarif wieder her.
- [ ] #2 verfehlte Webhooks sind abgleichbar.
- [ ] #3 eine Kündigung hat den erklärten Effekt auf Rechte und geplante Termine.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/billing. Review local plan changes, cancellation/reactivation, failure/trial/grace scenarios and illustrative invoice download. Grenze: No Stripe checkout, payments, contract, tax receipt, refunds or webhooks. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root hat vollständigen /tmp/dispatch-continuation-37-38-seams.md gelesen: keineStripeDependency/Config/Webhook/Checkout/ReconcileCron vorhanden. KleinsterPfad concreteNativeBinding/OutboundCommand/InboundID+DigestReceipt+sameEntitlementApply mit unavailableUI, konkrete offering/SDK/signature erstoffiziellecurrentDocs+nächsteActualConfig. RawSignature/Environment/StoredCustomerScope→durableReceipt→ack; ArrivalTime/EventID keineProviderRevision, staleCanonicalResponse/CASallein reichtnicht—ingressgeneration/restrictiveCancelDeleteFence+actualCanonicalProof. Renewal setztOriginalProviderHolds nichtzurück; externCancel/Refund/Delete undlateFinance bleibenreconcilefähigohneProduktReaktivierung. D11ManagedPayments nurcandidate, nooffer/defaultprice/secrets/providerActivation/mail; manual/Done offen.

Root adopted readonly current delta /tmp/dispatch-37-38-current-native-reconciliation.md SHA a29180e3522c084be4324eedfefb2947c4e660c3fd32feda721cc8ad9fde2d25 after full report/semantic receipt;41 unowned source+2 input before/after sha/bytes exact. Actual seven financing families include new own-content-embedding and jev-intent-router; six createRun call sites in five modules. Team49 actual accept has new-member CAS and personal-workspace bootstrap; Research pause withdraws material and must not become payment pause. Preserve original three distinct budgets, once-per-attempt original currency, known0 versus enteredunknown, late settlement and publishing checkpoints across payment/role/source loss. Native Billing/Stripe absent; D10 tariff/units/trial/migration/grace and D11 actual offering/config stay open, never Demo defaults. Moving68.1 excluded, captured tool output digests qualified (no underlying persisted logs for independent root recomputation). No tests/source release/config/provider/billing/manual acceptance; allAC/DoD remain open.
<!-- SECTION:NOTES:END -->
