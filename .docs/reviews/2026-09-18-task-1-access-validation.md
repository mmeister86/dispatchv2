# TASK-1 – Tatsächliche Zugangstests

**Datum:** 18. September 2026. **Status:** Teilnachweise erbracht; TASK-1 bleibt In Progress.

Der Nutzer hat alle Provider-Tests zusammen bis **10 EUR** autorisiert, lokale Zugangswerte eingetragen, Cloudflare angemeldet und R2 aktiviert. Nach dem Azure-Test hat er `vertex/gemini-3.5-flash-lite@eu` ausdrücklich für weitere Tests ausgewählt; die neuen Aufrufe verwenden den Requesty-EU-Gateway. Die lokale Konfiguration bleibt von Git ausgeschlossen. Keine X-Inhalte wurden an Modelle übermittelt; keine Posts veröffentlicht. Modelltests verwenden ausschließlich synthetische Eingaben beziehungsweise eine öffentliche Dokumentationssuche.

Maschinenlesbarer Nachweis: [access-checks-2026-09-18.json](evidence/task-1/access-checks-2026-09-18.json). Die [ausgeführten Probe-Skripte](evidence/task-1/probe-source/dispatch_provider_probe.py) sind ohne Credentials archiviert; sie sind Arbeitsnachweise mit lokalen Pfaden, keine produktive Integration. Die archivierte Diagnosenausgabe wurde auf synthetischen Content und Tool Calls begrenzt; opake Reasoning-Signaturen sind ausgeschlossen.

## 1. Ergebnisübersicht

| Prüfung | Ergebnis | Was damit nicht belegt ist |
|---|---|---|
| Requesty authentifizierter Katalog | HTTP 200, 691 Chatmodelle; gewählte Vertex-EU-Route vorhanden | Modellzugang für jeden anderen Anwendungsfall |
| Vertex EU Text / Schema / Tool Call | Alle drei HTTP 200; erwarteter Text, Schemaobjekt und Funktionsargumente validiert | AI-SDK-Integration, Toolausführung, redaktionelle Qualität |
| Vertex EU native Suche | Zwei HTTP-200-Streams mit jeweils einer Quelle; gezielte Folgefrage liefert Quellentitel `cloudflare.com` und erwarteten Preis | Aufgelöstes Linkziel und Aussage-Quellen-Zuordnung; vollständige EU-Verarbeitung der Suche |
| Azure Luna Text | HTTP 200, erwartetes `READY` | Qualität längerer redaktioneller Aufgaben |
| Azure Luna Schema | HTTP 200; konkretes Objekt entspricht dem strikten Schema | Universelle Schemaunterstützung, Refusal-/Fehlerfälle |
| Azure Luna Tool Call | HTTP 200; erwarteter Funktionsname und valide Argumente, `finish_reason=tool_calls` | Toolausführung/-Roundtrip, Domain-Autorisierung |
| Embeddings | `openai/text-embedding-3-small`, HTTP 200, ein endlicher Vektor mit 1536 Dimensionen | Verarbeitung echter Quellen, SDK-Integration, Löschpfad |
| Native Suche, Messages/Haiku | HTTP 200, aber keine extrahierten Quellen/Zitate | Suchfähigkeit für diesen Aufruf nicht erfolgreich nachgewiesen |
| Native Suche, Streaming/Sonar | HTTP 200, 26 Chunks, Text und 18 Quellen mit URL/Titel zurückgegeben | Korrekte Zuordnung jeder Aussage zu einer Quelle, Retrievalqualität, AI-SDK-Weitergabe |
| X User-Lookup | App-Bearer, HTTP 200, eine Ressource | User-OAuth2 und App-Eigentümer-/Scopeprüfung |
| X Recent Search | App-Bearer, HTTP 200, drei Ergebnisse | Full Archive, Pagination, Nutzung/Löschung der Inhalte |
| X geografische Trends | App-Bearer, HTTP 200, ein Trend | Personalisierte Trends, andere WOEIDs und Quoten |
| Convex Daten-URL | HTTP 200 am Origin | Authentifizierte Datenbank-/Funktionsprüfung |
| Convex Site-URL | HTTP 404 am Root | Existenz oder Funktion konkreter HTTP-/Auth-Routen |
| Cloudflare/R2 | Login gültig; nach Aktivierung Bucketzugang erfolgreich | S3-Credentials für Convex, Browseruploads, Publishing |
| R2 Remote-Roundtrip | PUT + GET und SHA256-Vergleich bestanden | Unveränderliche Finalisierung, Bytevalidierung echter Medien |

Die Requesty-Tests liefen direkt über HTTPS. Das ist kein Test der gemeinsam gepinnten AI-SDK-/Convex-Agent-Integration.

## 2. Modellentscheidung und Fehlerabgrenzung

Zuvor geprüfte Route: **`azure/gpt-5.6-luna@germanywestcentral`**. Der authentifizierte Katalog nennt 0,22 USD/Mio. Inputtokens, 0,022 USD/Mio. gecachter Inputtokens und 1,32 USD/Mio. Outputtokens. Rückgabe-Modellname der Testantworten: `gpt-5.6-luna`. Die drei Tests hatten jeweils höchstens 512 Ausgabetokens. Die Azure-Region im Routennamen ist kein eigenständiger Nachweis über sämtliche Gateway-, Log- und Empfängerstandorte.

Vor dem Wechsel: `lyceum/deepseek-v4.1-flash` bestand den Texttest, lieferte bei den konkreten Schema-/Tool-Konfigurationen jedoch nur `reasoning_content`, keinen `content` beziehungsweise `tool_calls`. Das trat auch in der einmaligen Diagnosewiederholung auf. Ein Kontrolltest mit `openai/gpt-4.1-nano` bestand beide Fälle. Dieser Befund grenzt das Problem auf die getestete Route/Konfiguration ein; er beweist keine allgemeine Unfähigkeit aller DeepSeek-Routen.

Azure Luna hat im Katalog **`supports_web_search=false`**. Für D03 ist `perplexity/sonar` daher ein gesonderter getesteter Suchkandidat über Requesty. Im erfolgreichen Test: `/v1/chat/completions`, `stream=true`, `stream_options.include_usage=true`, `tools=[{"type":"web_search"}]`, `max_tokens=256`. Quellen kamen als `choices[].delta.web_search.content` zurück; das separate `citations`-Feld blieb leer. Eine Integration darf sich deshalb nicht allein auf `citations` verlassen. Der vorherige Messages-Test mit Haiku war kein erfolgreicher Quellennachweis und bleibt als Fehlversuch dokumentiert. [Requesty Web Search](https://docs.requesty.ai/features/web-search)

**D03 ist seit der Nutzerklärung vom 19.09.2026 vertagt:** Die endgültige LLM-Providerentscheidung wird später geklärt; EU-Vorgabe und dokumentierte offene Nachweise bleiben bestehen. Vertex EU ist nun der vom Nutzer gewählte Testkandidat für Generierung und native Suche. Sonar und die getestete OpenAI-Embedding-Route bleiben historische technische Nachweise; ihre EU-Verarbeitung ist nicht belegt und ihr Produkteinsatz nicht freigegeben. Vor weiterer Auswahl sind EU-Verarbeitung der gesamten Kette, Quellenbindung, Rechte, Fehlerbehandlung und tatsächliche Suchgebühren nachzuweisen. Siehe [Arbeitsvorgabe](../decisions/provider-capabilities.md).

### Vertex EU: aktueller Testkandidat

Fünf begrenzte Aufrufe mit `vertex/gemini-3.5-flash-lite@eu` über `https://router.eu.requesty.ai/v1`, jeweils `max_tokens=512`, ohne konfigurierten Fallback. Text, striktes JSON-Schema und angeforderter Tool Call bestehen. Modellantwort: `gemini-3.5-flash-lite`. Der authentifizierte Katalog nennt Websuche, Schema und Tool Calling als unterstützt sowie 0,33 USD/Mio. Input-, 0,033 USD/Mio. Cache-Input- und 2,75 USD/Mio. Outputtokens.

Die native Suche verwendet `tools=[{"type":"web_search"}]` mit Streaming. Beide Antworten liefern Text, einen regulär abgeschlossenen Stream und jeweils eine Quelle unter `delta.web_search.content`. Die erste Frage nach der offiziellen R2-Preisseite liefert den Quellentitel `filebase.com`; eine einzige gezielte Wiederholung mit `site:developers.cloudflare.com/r2/pricing/` liefert `cloudflare.com`. Beide Antworten enthalten den erwarteten Preis `0.015`. Die Quellen-URLs sind Google-Grounding-Redirects; deren Ziel wurde nicht aufgelöst. In der Evidenz werden nur Titel/Host gespeichert. Das `citations`-Feld ist leer; der Test erkennt keine der geprüften Inline-Zitatformen. Damit ist native Suche mit Quellenmetadaten belegt, aber keine belastbare Aussage-Quellen-Zuordnung oder garantierte Domainbeschränkung. Die Folgefrage ist ein Prompt, kein technisch erzwungener Domainfilter.

Die lokale Testkonfiguration und Vorlage wurden auf das gewählte Modell und den EU-Gateway gesetzt. Diese Variablen sind noch keine produktive SDK-Integration. Historische Probes verwendeten den globalen Gateway; sie werden nicht erneut ausgeführt. Die neue Probe ist auf den EU-Gateway festgelegt. Eine organisationsweite Routing-/Logging-Konfiguration wurde nicht verändert. [Requesty EU Routing](https://docs.requesty.ai/features/eu-routing)

**Separate Sucheinschränkung:** Google dokumentiert für Search Grounding bis zu drei Tage Speicherung abgeleiteter Suchanfragen und mitgegebenen Kontexts; dies lässt sich für diese Funktion nicht abschalten. Das Katalogfeld für Modell-Retention darf daher nicht als Zero-Retention-Nachweis für die Suche gelesen werden. EU-Inferenz und EU-Gateway belegen nicht automatisch den Standort des Search-Backends und seiner Logs. Vor Kundendaten müssen Requesty/Google diesen Pfad sowie die anwendbaren Verträge bestätigen. Auch die Nutzungs-/Speicherbedingungen für Grounded Results und Links sind vor Dispatchs produktiver Research-/Publishing-Nutzung zu prüfen. [Google Retention](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention), [Google Service Terms, Abschnitt 20(k)](https://cloud.google.com/terms/service-terms)

## 3. X-Zugang und noch fehlender OAuth2-Pfad

**Nachtrag vom 19.09.2026:** Laut Nutzer wurde der V1-X-Login über Clerk abgewickelt. Er kann daher keine bestehenden `X_USER_ACCESS_TOKEN`/`X_USER_REFRESH_TOKEN` bereitstellen; eine manuelle Nachlieferung wird nicht erwartet. Diese Felder dürfen vorerst leer bleiben. Der noch ausstehende User-Auth-Nachweis benötigt einen neuen autorisierten Login-Durchlauf im vorgesehenen V2-Verbindungsflow. Aus dem V1-Clerk-Login wird keine vorhandene V2-X-Autorisierung abgeleitet.

Einmalige Tests ohne Pagination/Expansions:

- `GET /2/users/by/username/XDevelopers`
- `GET /2/tweets/search/recent?query=from%3AXDevelopers&max_results=10`
- `GET /2/trends/by/woeid/1?max_trends=1`

Verwendet wurde ausschließlich der App-Bearer aus der lokalen Datei. Posttexte, Userdaten und Trendinhalte wurden nicht in die Evidenz übernommen. Die nachgewiesenen Ressourcenanzahlen belegen keine Vertragsfreigabe für Modellverarbeitung oder Langzeitspeicherung.

**OAuth1 und OAuth2 unterscheiden:** `X_CONSUMER_KEY` und zugehöriges Consumer Secret sind nicht `X_CLIENT_ID`/OAuth2 Client Secret. Die Client-ID und User-Access-/Refresh-Tokens waren bei der Prüfung leer. Das bereits eingetragene `X_CLIENT_SECRET` wurde nicht verwendet; seine Herkunft muss eindeutig die OAuth2-Konfiguration sein. Vorhandene Secrets wurden nicht umbenannt oder rotiert.

Nächster Schritt: OAuth2 User Authentication Settings der X-App mit zum späteren Testflow passender Callback-URL konfigurieren, Client-ID und gegebenenfalls Client Secret lokal ergänzen, anschließend PKCE und User-Autorisierung testen. Read-/Refresh-Scopes: `tweet.read users.read offline.access`; Publishing zusätzlich `tweet.write`, Medien je Endpunkt separat. Keine Callback-URL ohne zugehörigen lokalen Empfänger erfinden. [X OAuth2](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)

## 4. R2-Bucket und Roundtrip

Wrangler 4.134.0 bestätigte zunächst den Login; R2 meldete noch `10042` (nicht aktiviert). Nach Nutzeraktivierung lieferte die Bucketliste erfolgreich keine vorhandenen Buckets. Danach angelegt:

- Bucket: **`dispatch-v2-dev`**, Standard Storage, Location Hint `weur`.
- `r2.dev`: deaktiviert; keine Custom Domain verbunden.
- CORS: keine Konfiguration vorhanden (`10059`); Browserupload noch nicht eingerichtet.
- Objekt: `task-1/synthetic-roundtrip-2026-09-18.txt`, **66 Bytes**, ausschließlich synthetischer Text.
- Remote-PUT und Remote-GET: erfolgreich, Bytes identisch.
- SHA256: `c59c10557d927d06f9c744504e08f272276c665a6368030fa61ef0ee085d9ce8`.

Befehle:

```sh
npx --yes wrangler@4.134.0 r2 bucket create dispatch-v2-dev --location weur --storage-class Standard
npx --yes wrangler@4.134.0 r2 bucket dev-url get dispatch-v2-dev
npx --yes wrangler@4.134.0 r2 bucket domain list dispatch-v2-dev
npx --yes wrangler@4.134.0 r2 bucket cors list dispatch-v2-dev
npx --yes wrangler@4.134.0 r2 object put dispatch-v2-dev/task-1/synthetic-roundtrip-2026-09-18.txt --remote --file /tmp/dispatch-r2-probe.txt --content-type text/plain
npx --yes wrangler@4.134.0 r2 object get dispatch-v2-dev/task-1/synthetic-roundtrip-2026-09-18.txt --remote --file /tmp/dispatch-r2-probe-downloaded.txt
```

Bucket und synthetisches Testobjekt bleiben für Folgetests bestehen. Die zuvor leeren lokalen Variablen `CLOUDFLARE_ACCOUNT_ID` und `R2_TEST_BUCKET` wurden aus dem geprüften Konto ergänzt. Ein Location Hint ist keine vertragliche EU-Jurisdiktionsfestlegung. Staging-/Produktionsbuckets wurden nicht angelegt. Wrangler-Remotezugriff ersetzt keine S3-Credentials oder signierte Browseruploads. Die Finalisierung nach ADR-001 und der R2→Convex→X-Pfad bleiben offen. [R2 CLI](https://developers.cloudflare.com/r2/reference/wrangler-commands/)

## 5. Verbrauch und Budget

| Position | Betrag / Nachweis |
|---|---|
| Requesty | **0,02046827 USD**, Summe der gemeldeten `usage.cost` aus 17 Antworten einschließlich Fehl-/Kontrolltests |
| Davon neue Vertex-EU-Tests | **0,00033627 USD** aus drei Basistests und zwei Suchtests; Suchgebühren nicht vollständig abgeglichen |
| X | Etwa **0,035 USD** aus einem User, drei Posts und einem Trend nach öffentlicher Preistabelle; **Schätzung**, kein Rechnungswert |
| X reservierter Testhöchstwert | 0,070 USD bei maximal zehn Suchresultaten; keine Pagination |
| Embedding | 5 Tokens; kein Kostenfeld. Katalogbasierte Schätzung 0,00000010 USD |
| R2 | Ein 66-Byte-Objekt, Remote-PUT/GET und Verwaltungsoperationen; tatsächliche Abrechnung noch nicht geprüft |
| Gesamtfreigabe | 10 EUR; keine Aufladung, kein Planupgrade und keine zusätzliche Zahlungsbuchung ausgelöst |

Der Sonar-Test meldet `usage.cost=0.000057`, was rechnerisch 1 USD pro Million der gemeldeten 57 Tokens entspricht. Ob Suchgebühren oder Gatewayaufschläge separat anfallen, ist damit **nicht** geklärt. Auch die übrigen `usage.cost`-Werte sind keine vollständig abgeglichene Rechnung. Deshalb keinen exakten Euro-Restbetrag ausweisen. Die bisher ausgeführten Kleinsttests liegen nach bekannten Tarifen weit unter dem Gesamtbudget. [Requesty Cost Tracking](https://docs.requesty.ai/features/cost-tracking), [X Pricing](https://docs.x.com/x-api/getting-started/pricing)

## 6. Offene Nachweise

1. X OAuth2-Client/PKCE und neuer autorisierter Login-Durchlauf für User-Tokens, danach Refresh/Revoke (keine Token-Nachlieferung aus V1 erwartet); definierter Testaccount und konkrete freigegebene Publishing-Inhalte.
2. X Medien, eigene Metriken, Quellenentfernung/Sperrungsabgleich inklusive Frist und Preis; Datenrechte vor Verarbeitung echter X-Inhalte. D16 unverändert offen.
3. GitHub-App-Private-Key-Datei beziehungsweise nutzbare App-Authentifizierung; Repository-Isolation und Eventtests. Persönlicher `gh`-Login genügt dafür nicht.
4. Convex autorisierter Dev-Funktions-/Auth-Durchstich und tatsächliche AI-SDK-/Agent-/Workflow-Integration.
5. Begrenzte R2-S3-Zugänge, private Umgebungsbuckets, Browser-CORS/Presigning, sichere Finalisierung und Medienpublisher.
6. D03-/LLM-Providerentscheidung auf Nutzerwunsch vertagt; Quellenzuordnung im tatsächlichen Adapter weiterhin ungetestet; Rechnungsabgleich einschließlich Suchgebühren.

TASK-1 wird erst nach den Pflichtnachweisen beziehungsweise ausdrücklich beschlossenen Umfangsänderungen und manueller Nutzerabnahme geschlossen.
