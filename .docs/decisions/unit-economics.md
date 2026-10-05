# TASK-1 – Kostenmodell pro aktivem Workspace

**Stand:** 18. September 2026. **Status:** Arbeitsmodell; keine gemessene Wirtschaftlichkeit und keine Preisfreigabe.

Gehört zu [Provider-Fähigkeiten](provider-capabilities.md) und [ADR-001](001-convex-domain-r2-media.md). Einheit: USD pro Monat, vor Steuern. Ein aktiver Workspace führt im Monat mindestens eine Produktaktion aus. Grundkosten werden über alle aktiven Workspaces verteilt; Freikontingente gelten je Provider-Abrechnungskonto und dürfen nicht für jeden Workspace erneut abgezogen werden.

## 1. Datierte Preisbasis

| Position | Öffentlich dokumentierter Preis | Noch zu prüfen |
|---|---:|---|
| X Post lesen | 0,005 USD je zurückgeliefertem Post | App-Tarif, Fehlerabrechnung und Ressourcen-Deduplizierung |
| X Post erstellen ohne / mit URL | 0,015 / 0,200 USD je Request | URL-Klassifikation, Thread-Teile jeweils einzeln |
| X User lesen / Trends | 0,010 USD je Ressource / Request | Tatsächlich benötigte Endpunkte und Zugang |
| X Media Metadata | 0,005 USD je Request | Zusätzliche Upload-/Verarbeitungsoperationen separat erfassen |
| Requesty | Modellverbrauch plus 5 % im öffentlichen Pay-as-you-go-Angebot | Gewählte Modelle, Suchtools, Embeddings, Cache und tatsächlicher Vertrag |
| R2 Standard Speicher | 0,015 USD je GB-Monat | Temporäre, finale und verwaiste Objekte gemeinsam messen |
| R2 Standard Class A / B | 4,50 / 0,36 USD je Million Operationen | Multipart, Copy, HEAD und Vorschau zählen |
| R2 Internet-Egress | 0 USD | Ausführung und Transfer anderer Dienste bleiben separat |
| Convex Professional Grundpreis | 25 USD je Entwickler/Monat | Plan, Region und Entwicklerzahl offen |
| Convex Professional Mehrverbrauch, US East | Calls 2 USD/Mio.; Actions 0,30 USD/GB-h; DB 0,20 USD/GB; DB-I/O 0,20 USD/GB; Egress 0,12 USD/GB | Andere Region/Plan kann abweichen; Suchspeicher und Suchabfragen ergänzen |
| Cloudflare statische Assets | Direkte statische Requests kostenlos | Worker-Aufrufe sind gesondert; Paid Worker ab 5 USD/Monat |

Quellen, abgerufen am Stichtag: [X Pricing](https://docs.x.com/x-api/getting-started/pricing), [Requesty Pricing](https://www.requesty.ai/pricing), [R2 Pricing](https://developers.cloudflare.com/r2/pricing/), [Convex Pricing](https://www.convex.dev/pricing), [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/).

X Owned Reads zu 0,001 USD setzen für die gelisteten Endpunkte voraus, dass der authentifizierte Nutzer der Eigentümer der Developer-App ist. Das ist keine allgemeine SaaS-Kundenvergünstigung. Die tägliche UTC-Deduplizierung ist laut X eine weiche Garantie; zunächst konservativ ohne Rabatt planen und später Rechnungswerte einsetzen. [X Pricing](https://docs.x.com/x-api/getting-started/pricing)

## 2. Drei Nutzungsszenarien

**Alle folgenden Mengen sind ausdrücklich Annahmen, keine Messwerte.** „Typisch“ ist eine Planungshypothese, bis Pilotdaten vorliegen. Ein Post bedeutet einen einzelnen Thread-Teil. Der Quellenbestand ist der durchschnittlich täglich zu prüfende Bestand, nicht die Zahl neu gefundener Posts.

| Größe / Monat | Wenig | Typisch | Hoch |
|---|---:|---:|---:|
| Veröffentlichte Einzelposts | 10 | 40 | 120 |
| Davon mit URL | 5 | 20 | 60 |
| Neue X-Recherche-Ressourcen | 200 | 2.000 | 20.000 |
| Gespeicherte X-Quellen im täglichen Abgleich | 100 | 500 | 2.000 |
| Post-Lookup-Polling: angenommene zurückgelieferte Post-Objekte bei 30 täglichen Prüfungen | 3.000 | 15.000 | 60.000 |
| Metrik-Reads (Annahme: drei je Einzelpost) | 30 | 120 | 360 |
| Modell-Inputtokens, Mio. | 0,10 | 1,00 | 5,00 |
| Modell-Outputtokens, Mio. | 0,02 | 0,20 | 1,00 |
| Embedding-Tokens, Mio. | 0,02 | 0,20 | 1,00 |
| Websuchaufrufe, inklusive Modell-intern ausgelöster Aufrufe | 10 | 100 | 500 |
| R2 GB-Monate | 0,25 | 2 | 20 |
| R2 Class-A- / Class-B-Operationen | 100 / 1.000 | 1.000 / 10.000 | 10.000 / 100.000 |
| Convex Calls / Action GB-h | 10.000 / 0,1 | 100.000 / 1 | 1.000.000 / 10 |
| Convex DB GB / DB-I/O GB / Egress GB | 0,01 / 0,1 / 0,05 | 0,1 / 1 / 0,5 | 1 / 10 / 5 |

Tägliches Polling ist hier eine **Kostensensitivität, kein nachgewiesen ausreichender Compliance-Pfad**. Fristbeginn, Benachrichtigungen, Sperrungen, Rate Limits und ausgefallene Prüfläufe müssen im realen Zugang geklärt werden. Ein kleiner gespeicherter Bestand, kürzere Retention oder ein verfügbarer Ereignisstrom verändern die Rechnung erheblich. Der Preis von 0,005 USD gilt hier nur für zurückgelieferte Post-Objekte; User-Abgleich, Batch Compliance und Streams benötigen eigene Tarife und sind nicht durch diese Rechnung bepreist.

## 3. Nachrechenbare Teilkosten

```text
X_Publishing = (Posts - URL_Posts) * 0.015 + URL_Posts * 0.200
X_Reads = (Recherche_Ressourcen + Quellenabgleich_Ressourcen + Metrik_Ressourcen) * 0.005
R2_Attribution = GB_Monate * 0.015 + Class_A / 1e6 * 4.50 + Class_B / 1e6 * 0.36
Convex_Attribution = Calls / 1e6 * 2 + Action_GBh * 0.30
                   + DB_GB * 0.20 + DB_IO_GB * 0.20 + Egress_GB * 0.12
```

| Teilkosten in USD | Wenig | Typisch | Hoch |
|---|---:|---:|---:|
| X Publishing | 1,075 | 4,300 | 12,900 |
| X Recherche | 1,000 | 10,000 | 100,000 |
| X Post-Lookup-Polling | 15,000 | 75,000 | 300,000 |
| X Metrik-Reads | 0,150 | 0,600 | 1,800 |
| R2 anteilige Nutzung | 0,00456 | 0,03810 | 0,38100 |
| Convex anteilige Nutzung | 0,078 | 0,780 | 7,800 |
| **Berechnete Provider-Teilkosten ohne KI/Websuche** | **17,30756** | **90,71810** | **422,88100** |

Diese Summe ist **weder Gesamtpreis noch Rechnung oder gemessene Prognose**: Sie enthält keine Modell-/Suchkosten, Grundkosten, X-User-/Trend-/Medienoperationen, Retries oder weitere Betriebskosten. Mengen können sich überschneiden; vorläufig wird kein Deduplizierungsrabatt angenommen.

Für R2 und Convex zeigt die Tabelle eine lineare Kostenattribution ohne Freikontingente. Die echte Rechnung entsteht auf Kontoebene: Freimengen einmal abziehen, anschließend die jeweiligen Rundungsregeln anwenden. R2 dokumentiert aufgerundete Abrechnungseinheiten und im Standard-Tier 10 GB-Monate, 1 Mio. Class A sowie 10 Mio. Class B kostenlos. Die linearen Bruchteile sind deshalb keine Rechnungsvorhersage. [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

## 4. Vollständige Kostenformel und offene Tarife

```text
C_Workspace = C_X + C_AI + C_Websuche + C_R2 + C_Convex
            + C_Hosting_variabel + C_Email + C_Monitoring + C_Backup
            + C_Zahlungsgebühren + C_Support + Fixkosten / aktive_Workspaces

C_AI = Summe tatsächlich abgerechneter Modellversuche
     + Summe tatsächlich abgerechneter Embedding-Versuche
```

`C_Websuche` enthält nur Gebühren, die nicht bereits im erfassten Request-Gesamtpreis enthalten sind; native Suchgebühren niemals doppelt zählen.

Für eine Vorabschätzung mit Basistarifen je Million Tokens:

```text
C_AI_Schätzung = 1.05 * (Input_Mio * p_input + Output_Mio * p_output + Embedding_Mio * p_embed)
```

Das 1,05 gilt nur, wenn die Ausgangspreise den Gatewayaufschlag noch nicht enthalten und der Vertrag dem öffentlichen Pay-as-you-go-Angebot entspricht. Auf bereits abgerechnete `usage.cost` nicht nochmals 5 % aufschlagen. Cache-Lese-/Schreibpreise, Reasoning und lange Kontexte getrennt berücksichtigen; fehlende Tarife bleiben unbekannt statt null. [Requesty Pricing](https://www.requesty.ai/pricing), [Cost Tracking](https://docs.requesty.ai/features/cost-tracking)

| Offene Eingabe | Erforderlicher Nachweis |
|---|---|
| Modell-ID und Routingroute | Organisationsfreigabe, Funktionstest, datierter Preis je Input/Output/Cache/Embedding |
| Websuche und Fallback | Anbieter/Modell, tatsächlich ausgelöste Suchtools, Gebühren und Quellenrückgabe |
| X Medien, Trends, Compliance | App-Konsole und isolierte abrechenbare Versuche; Bulk-/Stream-Kosten falls zugänglich |
| Convex Plan/Region | Konkreter Vertrag; Search-Storage/Queries, Agent-/Workflow-Retention, Backups |
| Hosting, E-Mail, Monitoring | Tatsächlich gewählte Tarife; zusätzliche Worker nur bei begründetem Bedarf |
| Fixkostenverteilung | Zahl aktiver Workspaces und Entwickler, Dev-/Staging-Verbrauch |
| Produktpreis / Zielmarge | Entscheidung des Produktinhabers; keine Rentabilitätszusage vorher |

## 5. Messplan für die Zugangstests

Je Versuch erfassen: Datum, Umgebung, pseudonyme Workspace-ID, Run-ID, Attempt-ID, Provider-Request-ID, Operation, konkrete Modell-/Adapterversion, Menge samt Einheit, Dauer, Status, Retry-Grund, Preisquelle/-datum, geschätzte und abgerechnete USD. Keine Tokens, signierten URLs, Prompts oder privaten Quelltexte in Kostenlogs.

1. Rechnungs-/Usage-Stand vor jedem isolierten Test dokumentieren. Kostenlimit und Abbruchschwelle vor dem ersten kostenpflichtigen Aufruf festlegen.
2. Einfache Modellantwort, strukturiertes Ergebnis, folgenloser Tool Call, synthetisches Embedding und Websuche getrennt testen. Chat-Completions liefern laut Doku `usage.cost`; bei Streaming `include_usage` prüfen. Verlorene Abschluss-Chunks über den Usage-Export abgleichen. Embedding-Kosten gesondert verifizieren. [Cost Tracking](https://docs.requesty.ai/features/cost-tracking), [Embeddings](https://docs.requesty.ai/api-reference/endpoint/embeddings-create)
3. Nach Freigabe ein Text-, URL- und Medien-Publishing auf dem benannten Testaccount messen. Request-Zahl pro Thread, Uploadteil, Statuspoll und Wiederholungsversuch zählen.
4. R2-Browserupload → Finalisierung → Publisherabruf → X-Upload messen: reale Bytes, Class A/B, Action-Zeit und -Speicher sowie Convex-Egress. Vorschauen separat erfassen.
5. Quellenabgleich inklusive entfernter/gesperrter Quelle und ausgefallenem Lauf testen. Bestand, Prüfintervall, Frist und Rechnungswirkung zusammen auswerten.
6. Provider-Exports mit eigenen Attempt-IDs abgleichen. Wiederholte Buchung derselben Providerleistung deduplizieren; echte zusätzliche Versuche bleiben Kosten. Nicht bestätigte Verbrauchswerte als unbekannt markieren.

**Aktueller Messstand:** Erste reale Kleinsttests sind im [Zugangstestbericht](../reviews/2026-09-18-task-1-access-validation.md) und in der [bereinigten Evidenz](../reviews/evidence/task-1/access-checks-2026-09-18.json) erfasst. Requesty meldet zusammen 0,02046827 USD; X ist mit circa 0,035 USD anhand der Ressourcenmengen geschätzt. Embedding-/R2-Abrechnung, Suchgebühren und möglicher Gatewayaufschlag bleiben gesondert abzugleichen. Dies sind noch keine gemessenen Monatskosten eines Workspaces. Die drei Szenarien oben bleiben Hypothesen. Nutzerbudget: insgesamt maximal 10 EUR, keine automatische Aufladung.

Für die zuvor getestete Azure-Luna-Route nennt der authentifizierte Katalog 0,22 USD/Mio. Inputtokens, 0,022 USD/Mio. gecachter Inputtokens und 1,32 USD/Mio. Outputtokens. Das Embedding-Modell text-embedding-3-small nennt 0,02 USD/Mio. Inputtokens. Sonar meldet Tokenkosten, die vollständige Suchgebühr ist noch nicht belegt. Deshalb werden die Szenarien noch nicht zu Gesamtpreisen vervollständigt.

**Regionale Vorgabe nach Nutzerklärung:** Sonar-/OpenAI-Embedding-Testpreise und Convex-US-East-Referenzpreise sind keine freigegebene EU-Produktkalkulation. EU-Routen und die tatsächliche Convex-/Speicherregion müssen vor der Gesamtkalkulation einschließlich Gateway, Logging und Empfängern geprüft werden. Andere Regionen bleiben bis zur rechtlichen Beratung und ausdrücklichen Nutzerentscheidung offen.

**Aktueller Vertex-EU-Testkandidat:** `vertex/gemini-3.5-flash-lite@eu`: 0,33 USD/Mio. Input-, 0,033 USD/Mio. Cache-Input- und 2,75 USD/Mio. Outputtokens laut authentifiziertem Requesty-Katalog. Fünf EU-Gateway-Aufrufe melden zusammen 0,00033627 USD. Native Suchgebühren sind damit noch nicht vollständig abgeglichen; keine Gesamtpreis- oder EU-Compliance-Zusage daraus ableiten.
