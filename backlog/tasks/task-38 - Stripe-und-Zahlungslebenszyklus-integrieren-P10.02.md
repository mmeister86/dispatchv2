---
id: TASK-38
title: Lemon Squeezy und Zahlungslebenszyklus integrieren (P10.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-09 05:55'
labels:
  - p10
  - r4
milestone: m-4
dependencies:
  - TASK-37
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
documentation:
  - 'https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments'
  - 'https://docs.lemonsqueezy.com/guides/developer-guide/customer-portal'
  - 'https://docs.lemonsqueezy.com/guides/developer-guide/webhooks'
  - 'https://docs.lemonsqueezy.com/help/webhooks/signing-requests'
  - 'https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object'
priority: medium
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P10.02.
Phase: P10 – Kommerzielles SaaS und öffentliche Veröffentlichung.

**Ausgangslage:** Der Nutzer besitzt bereits einen genehmigten Lemon-Squeezy-Shop aus Dispatch v1. Wiederverwendet werden nur der Shop und dessen bereits erteilte Freigabe; für v2 wird er mit neuen Produkten und Abo-Varianten umgebaut. Es gibt keine zu übernehmenden Bestandsabos; auch das einzige v1-Testabo wird nicht übernommen. Shop-Neuanlage, erneute Provider-Auswahl, Wiederverwendung alter Varianten und Kunden-/Abo-Migration sind kein Bestandteil dieser Aufgabe. Die frühere Stripe-/Managed-Payments-Planung wird durch diese Taskfassung ersetzt.

**Abhängigkeit:** P10.01 / TASK-37 sowie bestätigter v2-Produktkatalog und Zuordnung der bestehenden Shop-IDs und neuen Produkt-/Varianten-IDs. **Geplante Dateien:** `convex/billing/lemonSqueezy.ts`, Billing-Webhooks in `convex/http.ts`, vorhandene Billing-Oberfläche unter `src/features/settings/`; Test `convex/billing/lemonSqueezy.test.ts`. Tatsächliche Dateipfade vor Implementierung mit dem aktuellen Repository abgleichen.

- Bestehenden genehmigten Shop anhand seiner Shop-ID als Ziel konfigurieren und nach bestätigtem D10-Katalog für v2 umbauen: neue Produkte, wiederkehrende Abo-Varianten und Abrechnungsintervalle einrichten. Die neuen IDs und v2-Webhook-Endpunkte dokumentieren. Alte v1-Produkte, Webhook-Verbindungen und das Testabo müssen nicht als v1-Integration weiter betrieben werden; sie sind keine Grundlage für v2-Zugänge. Keine Bestandsmigration implementieren.
- API-Zugang und Webhook-Signing-Secret ausschließlich serverseitig konfigurieren. Test-/Live-Modus, Shop- und Varianten-Allowlist getrennt prüfen; bei fehlender Konfiguration zeigt die UI den nicht verfügbaren Billing-Zustand statt Demo-Erfolg.
- Hosted Checkout serverseitig für den berechtigten Workspace und die bestätigte Variante erzeugen. Die Zuordnung in `checkout_data.custom` aus geprüftem Server-Kontext setzen und lokal nachweisbar speichern; `meta.custom_data` aus Webhooks gegen diese Zuordnung validieren. Client-IDs, E-Mail-Adressen oder die Checkout-Rückleitung allein gewähren keine Rechte.
- Lemon-Squeezy-Kundenportal für den zugeordneten Kunden bereitstellen; autorisierte Portal-Links bei Bedarf frisch vom Provider beziehen. Tarifwechsel, Kündigung und Wiederaufnahme mit klaren Wirksamkeitszeitpunkten und den in TASK-37 beschlossenen Produktregeln abbilden.
- `X-Signature` über den unveränderten Request-Body mit dem Signing-Secret (HMAC-SHA256) prüfen. Erst nach Signatur-, Modus-, Shop- und Zuordnungsprüfung einen dauerhaften Empfangsbeleg speichern und HTTP 200 bestätigen; Verarbeitung mit eigenem Retry-/Fehlerstatus fortsetzen. Idempotenz anhand tatsächlich vorhandener Payload-/Ressourcenmerkmale definieren; eine Subscription-ID allein ist kein eindeutiges Ereignis und eine globale Event-ID darf nicht vorausgesetzt werden.
- Relevante Subscription- und Payment-Ereignisse für Erstellung, Änderung, Verlängerung, Zahlungsfehler/-erholung, Kündigung, Wiederaufnahme, Ablauf und gegebenenfalls Pause verarbeiten; Erstattungen von Orders und Subscription-Zahlungen berücksichtigen. Doppelte, verspätete und anders geordnete Events dürfen keine älteren Rechte reaktivieren. Verpasste Ereignisse durch periodischen und gezielten API-Abgleich korrigieren; Webhook- und Abgleichspfad nutzen dieselbe Entitlement-Anwendung.
- Auch im Lemon-Squeezy-Portal/Dashboard ausgelöste Tarifwechsel, Kündigungen und Erstattungen testen. Externe Kundendatenlöschungen soweit vom Provider unterstützt im Abgleich und in Vertragstests berücksichtigen; fehlende Ereignisse oder Löschmöglichkeiten als konkrete Grenze dokumentieren und mit den Löschregeln aus TASK-33 abstimmen. Ereignisse alter v1-Produkte und des v1-Testabos verändern keinen v2-Workspace. Kunden und Abos für v2 werden über die neuen Angebote angelegt; eine Übernahme aus v1 entfällt gemäß TASK-37.
- Belege und Zahlungsbenachrichtigungen über Lemon Squeezy zugänglich machen; Dispatch-Betriebsbenachrichtigungen davon trennen. Zuständigkeiten des Merchant of Record und verbleibende Betreiberpflichten dokumentieren; erforderliche Steuer-/Rechtsprüfung bleibt eine gesonderte fachliche Prüfung.
- Bei Zahlungsausfall, Kündigung, Erstattung oder Workspace-Löschung die beschlossenen Rechte-/Kulanzregeln und Publishing-Checkpoints erhalten. Ausstehende Kostenreservierungen und spätere Abrechnung bleiben unabhängig vom aktuellen Abo-Status abgleichbar; eine Verlängerung setzt bestehende Kosten-Holds nicht zurück und reaktiviert keinen gelöschten Workspace.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Umschreibung ist keine Implementierungs- oder Live-Freigabe.

Entscheidungen:
- D11: Providerwahl und Shop-Nutzung durch Nutzerwunsch bestätigt: Lemon Squeezy im bereits genehmigten Shop, mit neuen v2-Produkten und Abo-Varianten. Keine Übernahme vorhandener v1-Kunden/Abos, einschließlich des Testabos. Konkrete Shop-/Varianten-Konfiguration und Ausschluss alter v1-Ereignisse sind vor Implementierung nachzuweisen.
- D10 bleibt offen: v2-Preise, Quoten, Testphase, Kulanz und Tarifwechsel ausdrücklich beschließen; keine Demo-Defaults übernehmen. Die Entscheidung gegen Bestandsmigration steht bereits fest.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Doppelte, verspätete oder anders geordnete Lemon-Squeezy-Events und konkurrierende Abgleiche stellen keinen alten Tarif wieder her und reaktivieren keinen gelöschten Workspace.
- [ ] #2 Verpasste Webhooks und Fehler nach bestätigtem Empfang sind durch Wiederholung und API-Abgleich behebbar; Webhook- und Abgleichspfad liefern dieselben Entitlements ohne doppelte Buchung.
- [ ] #3 Kündigung, Ablauf, Tarifwechsel, Testphase, Zahlungsfehler/-erholung und Erstattung haben den dokumentierten Effekt auf Rechte und geplante Termine; Provider-Enddatum und Dispatch-Kulanz werden getrennt berücksichtigt.
- [ ] #4 Der bereits genehmigte Shop wird mit neuen v2-Produkten und Abo-Varianten umgebaut; Shop-ID, neue Produkt-/Varianten-IDs, Abrechnungsintervalle und getrennte Test-/Live-Konfiguration sind dokumentiert. Alte v1-Varianten und das Testabo werden nicht übernommen.
- [ ] #5 Nur berechtigte Workspace-Verwalter erhalten Checkout-/Portal-Zugriff für ihre bestätigte Zuordnung. Eine Rückleitungs-URL, fremde Client-IDs, unbekannte oder alte v1-Varianten und Ereignisse des v1-Testabos schalten keine v2-Rechte frei.
- [ ] #6 Ungültige Signaturen und falsche Shop-/Modus-Zuordnungen verändern keine Billing-Daten; gültige Webhooks werden erst nach dauerhaftem Empfang mit HTTP 200 bestätigt. API-Schlüssel und Signing-Secrets erscheinen weder im Client noch in Logs.
- [ ] #7 Hosted Checkout und Kundenportal der neuen v2-Angebote sowie externe Kündigung, Tarifwechsel und Erstattung sind im Testmodus mit nachgewiesenen Entitlement-Effekten geprüft. Neue v2-Abos funktionieren ohne Kunden-/Abo-Migration; das alte Testabo gewährt keine v2-Rechte.
- [ ] #8 Zahlungsbelege und Provider-Benachrichtigungen sind über Lemon Squeezy erreichbar; bei fehlender Provider-Konfiguration ist Billing sichtbar nicht verfügbar. Ausstehende Kostenreservierungen und spätere Abrechnung bleiben bei Abo-/Rechteverlust korrekt abgleichbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehenden genehmigten Shop als Ziel bestätigen und nach D10 neue v2-Produkte, Abo-Varianten und Abrechnungsintervalle planen; keine Bestandsmigration oder Übernahme des v1-Testabos vorsehen.
2. Aktuelle Lemon-Squeezy-Dokumentation und Repository-Pfade prüfen; getrennte Test-/Live-Konfiguration, neue Produkt-/Varianten-IDs und v2-Webhook-Anbindung für den umgebauten Shop planen.
3. Hosted Checkout und Kundenportal für die neuen v2-Angebote mit serverseitiger Autorisierung und sicherer Workspace-Zuordnung an die vorhandene Billing-Oberfläche anbinden.
4. Signaturprüfung, dauerhaften Empfang, idempotente Lifecycle-Verarbeitung und API-Abgleich mit der Entitlement-Domain aus TASK-37 umsetzen; alte v1-Varianten und das Testabo ausschließen.
5. Testmodus-Vertragstests für neue v2-Abos, Lifecycle, externe Änderungen, Ausschluss alter v1-Ereignisse, Wiederholungen und verspätete Events durchführen; manuelle Abnahme und separate Live-Freigabe vorbereiten.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/billing. Review local plan changes, cancellation/reactivation, failure/trial/grace scenarios and illustrative invoice download. Grenze: No Stripe checkout, payments, contract, tax receipt, refunds or webhooks. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root hat vollständigen /tmp/dispatch-continuation-37-38-seams.md gelesen: keineStripeDependency/Config/Webhook/Checkout/ReconcileCron vorhanden. KleinsterPfad concreteNativeBinding/OutboundCommand/InboundID+DigestReceipt+sameEntitlementApply mit unavailableUI, konkrete offering/SDK/signature erstoffiziellecurrentDocs+nächsteActualConfig. RawSignature/Environment/StoredCustomerScope→durableReceipt→ack; ArrivalTime/EventID keineProviderRevision, staleCanonicalResponse/CASallein reichtnicht—ingressgeneration/restrictiveCancelDeleteFence+actualCanonicalProof. Renewal setztOriginalProviderHolds nichtzurück; externCancel/Refund/Delete undlateFinance bleibenreconcilefähigohneProduktReaktivierung. D11ManagedPayments nurcandidate, nooffer/defaultprice/secrets/providerActivation/mail; manual/Done offen.

Root adopted readonly current delta /tmp/dispatch-37-38-current-native-reconciliation.md SHA a29180e3522c084be4324eedfefb2947c4e660c3fd32feda721cc8ad9fde2d25 after full report/semantic receipt;41 unowned source+2 input before/after sha/bytes exact. Actual seven financing families include new own-content-embedding and jev-intent-router; six createRun call sites in five modules. Team49 actual accept has new-member CAS and personal-workspace bootstrap; Research pause withdraws material and must not become payment pause. Preserve original three distinct budgets, once-per-attempt original currency, known0 versus enteredunknown, late settlement and publishing checkpoints across payment/role/source loss. Native Billing/Stripe absent; D10 tariff/units/trial/migration/grace and D11 actual offering/config stay open, never Demo defaults. Moving68.1 excluded, captured tool output digests qualified (no underlying persisted logs for independent root recomputation). No tests/source release/config/provider/billing/manual acceptance; allAC/DoD remain open.

Umplanung 2026-10-09 auf ausdrücklichen Nutzerwunsch: Lemon Squeezy ersetzt Stripe als Billing-Provider. Der Nutzer besitzt bereits einen genehmigten Shop aus Dispatch v1; dieser wird als Ausgangsbasis wiederverwendet. Frühere Stripe-/Managed-Payments-Verweise im referenzierten Plan und in bisherigen Notizen sind historischer Stand; für die geplante Billing-Integration gilt diese Taskfassung. Nur Backlog-Umschreibung: keine Implementierung, Provider-Konfiguration, Migration oder Live-Aktivierung durchgeführt. Status, Abhängigkeiten und offene Abnahme bleiben unverändert.

Klarstellung des Nutzers vom 2026-10-09: Es gibt keine zu übernehmenden Bestandsabos außer einem v1-Testabo, das ebenfalls nicht übernommen wird. Wiederverwendet werden ausschließlich der bestehende Lemon-Squeezy-Shop und dessen bereits erteilte Freigabe. Der Shop wird für v2 mit neuen Produkten und Abo-Varianten umgebaut. Wiederverwendung alter Produktvarianten, Bestandsinventarisierung für eine Migration, Abo-/Kundenmigration und v1-Bestandsschutz sind kein Umsetzungsscope. Diese Klarstellung ersetzt die entsprechenden Annahmen der vorherigen Umplanung; Preise, Quoten und Kulanz aus D10 bleiben offen. Nur Task-Beschreibung, AC und Plan angepasst; keine Änderung im Live-Shop und keine Löschung oder Kündigung des Testabos durchgeführt.
<!-- SECTION:NOTES:END -->
