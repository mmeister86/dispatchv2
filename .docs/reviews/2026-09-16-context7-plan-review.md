# Abschließender Dokumentationsabgleich des Dispatch-Gesamtplans

**Datum:** 16. September 2026

**Gegenstand:** [Gesamtplan](../dispatch-end-to-end-implementation-plan.md) und [ADR-001](../decisions/001-convex-domain-r2-media.md).

**Ergebnis:** Die gewählte Architektur ist auf Dokumentationsebene tragfähig. Der Abgleich ergab konkrete Ergänzungen bei Integration, Wiederaufnahme, Datenlebenszyklus und Paketabhängigkeiten; sie wurden in den Gesamtplan übernommen. Ein Wechsel der bestätigten Aufteilung Convex/R2 ist daraus nicht erforderlich.

## 1. Methode und Reichweite

Context7 wurde über `npx ctx7@latest` außerhalb der Netzwerk-Sandbox aufgerufen. Alle drei Aufrufe waren erfolgreich; es gab keinen Quotenfehler:

| Schritt | Context7-Aufruf | Tatsächlich gelieferte Abdeckung |
|---|---|---|
| 1 | `library Convex` mit ausführlicher Frage zur Gesamtarchitektur | Auflösung offizieller Convex-Dokumentation sowie Agent, Workflow, Workpool und R2 |
| 2 | `docs /websites/convex_dev` | React-Client/Auth-Anbindung, Workflow-Typisierung, Transaktionalität von Scheduling und weiterführende offizielle Dokumentationspfade |
| 3 | `docs /get-convex/r2` | Signierte Uploads, Metadatenabgleich, Upload-/Löschprüfungen und Grenzen der Komponentenverantwortung |

Die Context7-Auszüge beantworteten die breite Architekturfrage nicht vollständig. Fehlende Details wurden unmittelbar in offiziellen Leitfäden, Komponenten-Repositories und Provider-Dokumentationen nachgelesen. Die Abdeckung wird deshalb nicht als vollständige Context7-Prüfung sämtlicher Bibliotheken ausgegeben.

Zwei unabhängige Reviews prüften zusätzlich Provider-Verträge sowie interne Abhängigkeiten und Freigabe-/Lifecycle-Regeln. Die Ergebnisse wurden mit dem Gesamtplan abgeglichen; ausschließlich Dokumentation wurde geändert.

## 2. Übernommene Befunde

| Bereich | Befund und Korrektur | Stelle im Gesamtplan |
|---|---|---|
| Paketkompatibilität | Gemeinsam getestete Versionen und Peer Dependencies für Convex-Komponenten, Better Auth, AI SDK und Requesty festlegen. Ein Entwicklungszweig oder beliebige aktuelle Einzelversionen ersetzen diesen Nachweis nicht. | P00.01, P01.01, §18.3 |
| Authentifizierung | React/Vite benötigt die spezifische Convex-Better-Auth-Anbindung einschließlich Cross-Domain-Plugins, CORS, HTTP-/Auth-Konfiguration und korrekter Callback-Domain. Verifikations-/Reset-Mailversand wird bereits mit Auth bereitgestellt. | P01.02, §18.5 |
| Abbruch | Laufende Actions können nach einem Workflow-Abbruch abschließen. Dauerhafte Sperren verhindern nachgelagerte Content-/Planungsschritte; bereits externe Effekte und Verbrauch bleiben abzugleichen. | §4.4, §6.1, P05.03 |
| Wiederholungen und Kosten | Doppelte Buchung desselben Versuchs wird verhindert; echte zusätzliche Aufrufe bleiben kostenpflichtig. Retry-Ebenen erhalten ein gemeinsames Budget, Publishing keine pauschalen automatischen Wiederholungen. | §4.4, P03.03, P05.01, P10.01 |
| R2-Abschluss | Ein Komponenten-Callback ist keine erfolgreiche Dateivalidierung. Uploadsession, Workspace, Metadatenabgleich und spätere Lese-/Löschzugriffe bleiben Domain-Aufgaben. | §5.7, P02.03 |
| Medien-/Runtime-Grenzen | Große Dateien und lange Verarbeitungswartezeiten dürfen keine unbegrenzte Einzel-Action voraussetzen. Gewählte Runtime, begrenzte Übertragung und dauerhafte Warte-/Wiederaufnahmeschritte werden praktisch geprüft. | P00.01, P03.03, §18.3 |
| Komponenten-Retention | Workflow-Journale sowie Agent-Komponentendaten ausdrücklich in Bereinigung und Löschung aufnehmen; dauerhafte Veröffentlichungsnachweise getrennt sichern. | P09.03, §15.2 |
| GitHub-Recovery | Schnelle Bestätigung erst nach dauerhafter Erfassung; ausgefallene Zustellungen über eigenen Recovery-Pfad nachholen. | P04.02 |
| Recherche-Lifecycle | Datenverwendungsprüfung vor erste Modellverarbeitung vorziehen. Provider-seitige Quellenentfernungen erreichen bereits in der Recherche Evidenz, Caches und Agent-Kontext. | P00.01, P06.02, P09.03, §15.4 |
| Benachrichtigungen/Billing | E-Mail-Fehler differenzieren und dauerhaft deduplizieren; externe Stripe-Lifecycle-Änderungen in Vertragstests aufnehmen. | P09.02, P10.02 |
| Ablaufabhängigkeiten | R7 benötigt nur den ersten Zusatzkanal; Quellen-/Profilpflege wartet nicht auf Account-Kalibrierung. Zahlungsbezogene Abnahme der Produktseiten setzt P10.02 voraus. | Release-Tabelle, P11.04, P10.03 |

Zusätzlich wurden die Komponentenregistrierung, das SPA-Routing und ein vorhandenes Textfragment in der Modultabelle bereinigt beziehungsweise präzisiert. Die 62 Arbeitspakete und der Produktumfang bleiben erhalten.

## 3. Entscheidende Primärquellen

- **Convex + Better Auth:** Der React/Vite-Leitfaden nennt die konkrete Integration und eine passende Better-Auth-Version. Diese Version wird bei Umsetzung erneut gegen die gewählte Komponentenfassung geprüft. [React/Vite-Leitfaden](https://labs.convex.dev/better-auth/framework-guides/react)
- **Convex Agent:** Agent-Aufrufe lassen sich in Workflow-Schritte einbetten; stabile Nachrichtenreferenzen und kleine Schrittargumente unterstützen die Wiederaufnahme. Paket-Metadaten zeigen die Abhängigkeit zur jeweiligen AI-SDK-Generation. [Agent Workflows](https://docs.convex.dev/agents/workflows), [Paketmetadaten des Entwicklungszweigs](https://github.com/get-convex/agent/blob/main/package.json)
- **Convex Workflow:** Der dokumentierte Lifecycle begründet die ergänzten Abbruch-, Retry- und Bereinigungsregeln. Die native Transaktionalität ist keine Garantie für beliebige externe API-Effekte. [Workflow-Dokumentation](https://github.com/get-convex/workflow)
- **Convex Limits:** Laufzeit, Arbeitsspeicher und Dokumentgrenzen hängen von Funktion beziehungsweise Runtime ab. Der Plan hält datierte Prüfwerte fest; die Medienverarbeitung braucht einen praktischen Nachweis. [Limits](https://docs.convex.dev/production/state/limits)
- **Convex R2:** Direkter Upload, Metadatensynchronisation und eigene Zugriffsprüfungen sind dokumentiert. Die unveränderliche Dispatch-Finalisierung ist ein zusätzlicher Domain-Vertrag. [R2-Komponente](https://github.com/get-convex/r2)
- **Cloudflare R2:** Signierte URLs können bis zum Ablauf erneut verwendet werden und sind an den S3-Endpunkt gebunden. Damit ist die bereits beschlossene Trennung temporärer/finaler Objekte weiterhin erforderlich. [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- **Cloudflare Frontend:** SPA-Routing ist für statische Assets dokumentiert; tatsächliche Deep Links bleiben Teil der Abnahme. [SPA-Routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- **GitHub:** Fehlgeschlagene Webhooks werden nicht automatisch erneut zugestellt. Eine erfolgreiche Antwort wird innerhalb von zehn Sekunden erwartet. [Recovery](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries), [Webhook Best Practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- **X:** Die bereits dokumentierten Grenzen zu Quote-Posts, privaten Metriken und Medien wurden bestätigt. Provider-Regeln begründen zusätzlich einen Quellen-Lifecycle; daraus wird keine pauschale Aussage gegen jede Modellinferenz abgeleitet. [Create Post](https://docs.x.com/x-api/posts/create-post), [Metrics](https://docs.x.com/x-api/fundamentals/metrics), [Media](https://docs.x.com/x-api/media/quickstart/media-upload-chunked), [Developer Guidelines](https://docs.x.com/developer-guidelines)
- **Requesty:** AI-SDK-Integration, Embeddings und Websuche sind dokumentiert. Adapter, Modell, strukturierte Ausgaben und Quellenmetadaten müssen zusammen getestet werden. [AI SDK](https://docs.requesty.ai/frameworks/vercel-ai-sdk), [Embeddings](https://docs.requesty.ai/api-reference/endpoint/embeddings-create), [Websuche](https://docs.requesty.ai/features/web-search)
- **Resend:** Zustellung und permanente Fehler sind eigene Ereignisse; Idempotency Keys haben ein begrenztes Zeitfenster. [Ereignisse](https://resend.com/docs/webhooks/event-types), [Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- **Stripe:** Managed Payments unterstützt den vorgesehenen SaaS-Lebenszyklus grundsätzlich; konkrete Zulassung und extern ausgelöste Änderungen bleiben zu prüfen. [Managed Payments](https://docs.stripe.com/payments/managed-payments), [Lebenszyklus](https://docs.stripe.com/payments/managed-payments/how-it-works)

## 4. Weiterhin erforderliche Nachweise

Dieser Review ersetzt P00 nicht. Vor der jeweiligen Umsetzung bleiben insbesondere erforderlich:

1. Tatsächliche X-App-Berechtigungen, Quoten, Token-Erneuerung, Suche, Trends, Metriken und Medienveröffentlichung mit dem vorgesehenen Account.
2. Installierbare, gemeinsam funktionierende Paketkombination einschließlich Better Auth, Convex Agent, AI SDK und Requesty-Modellen.
3. Direkter R2-Upload einschließlich Validierung, unveränderlicher Finalisierung, großer Dateien, Wiederaufnahme, Löschung und anschließendem X-Upload.
4. Praktisch erreichbarer Quellenabgleich und die erlaubte Datenverwendung je Provider und Verarbeitungszweck.
5. Gemessene Kosten der realen Verarbeitungspfade, Stripe-Zulassung sowie Deployment-/Recovery-Nachweise.

Rybbit, konkrete UI-Paketversionen und spätere Plattformadapter wurden nicht vollständig auf ihre APIs geprüft. Der Gesamtplan enthält dafür keine bereits getestete Integrationszusage.

## 5. Abschlusskontrolle

Die Dokumentationskontrolle umfasst lokale Markdown-Verweise, eindeutige Arbeitspaket-IDs, bestehende Paketverweise, Codeblock-Abschlüsse und die Diff-Prüfung. Keine Anwendung wurde gebaut, getestet oder deployed; Backlog-Implementierungsaufgaben wurden nicht angelegt oder abgeschlossen.
