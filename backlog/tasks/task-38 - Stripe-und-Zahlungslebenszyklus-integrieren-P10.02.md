---
id: TASK-38
title: Stripe und Zahlungslebenszyklus integrieren (P10.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
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
<!-- SECTION:NOTES:END -->
