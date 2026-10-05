# TASK-1 – Provider-Zugänge und technische Machbarkeit

**Prüfdatum:** 18. September 2026. **Status:** Dokumentationsprüfung und erste reale Zugangstests; Pflichtnachweise und Produktentscheidungen weiterhin offen.

**Aktueller Zugangstestbericht:** [Ergebnisse vom 18.09.2026](../reviews/2026-09-18-task-1-access-validation.md). Aktueller Testkandidat Vertex EU besteht Text/Schema/Tool Calls und liefert native Suchquellen; Quellenzuordnung und EU-Suchdatenpfad bleiben offen. Azure, Embeddings und Sonar bleiben historische Funktionstests. X-Bearer-Lesetests und privater R2-CLI-Roundtrip bestehen. Diese Teilnachweise ersetzen keine OAuth2-, SDK- oder Publishing-Abnahme.

Grundlage: [P00.01 im Gesamtplan](../dispatch-end-to-end-implementation-plan.md), [ADR-001](001-convex-domain-r2-media.md) und [Kostenmodell](unit-economics.md). Der Nutzer hat den Beginn von TASK-1 beauftragt. Dieser Bericht gibt weder Folgeimplementierungen noch D03/D16 frei.

## 1. Nachweisstufen und aktueller Stand

- **Dokumentiert:** Aktuelle offizielle Dokumentation oder veröffentlichte Paketmetadaten beschreiben einen Pfad.
- **Im eigenen Zugang getestet:** Konkreter App-/Account-Test mit Datum, Umgebung, Ergebnis und Messbeleg. Erste Teiltests sind unten mit ihrem konkreten Umfang eingetragen.
- **Nicht verfügbar:** Explizite Tarif-/Produktgrenze oder reproduzierter Zugangsfehler; Geltungsbereich angeben.
- **Offen:** Zugang, Vertrag oder Test fehlt. Offen ist keine bewiesene Nichtverfügbarkeit.

Der Nutzer hat Zugangswerte lokal hinterlegt, Cloudflare angemeldet und R2 aktiviert. Kostenpflichtige Tests sind insgesamt bis maximal 10 EUR freigegeben. Die lokale Datei `.env.provider-check.local` bleibt von Git ausgeschlossen und besitzt Modus 0600. Sie enthält nach dem Durchstich auch den geprüften Cloudflare-Account und `dispatch-v2-dev` als Testbucket. Keine Keys werden in Berichten gespeichert.

Persönlicher GitHub-CLI-Login ist gültig, ersetzt aber keinen App-Nachweis. X-OAuth2-Client-ID sowie der GitHub-App-Private-Key-Pfad sind nach bisherigem Prüfstand offen. **Nutzerklärung vom 19.09.2026:** Der X-Login in V1 lief über Clerk; der Nutzer kann keine X-User-Access-/Refresh-Tokens liefern. Diese werden nicht mehr als nachzuliefernde Zugangswerte angefordert. Der User-Kontext ist durch einen neuen autorisierten Login-Durchlauf im vorgesehenen V2-Verbindungsflow herzustellen und anschließend zu prüfen. Vorhandenes X-Consumer-Secret nicht mit einem OAuth2-Client-Secret verwechseln. [Vorlage](../../.env.provider-check.example)

Die realen Tests nutzen synthetische Daten und begrenzte öffentliche Leseabfragen; X-Inhalte wurden nicht gespeichert oder an Modelle weitergereicht. Kein Post wurde veröffentlicht. Runtime-Smokes für die vollständige Anwendung bleiben offen.

### Verbindliche Arbeitsvorgabe zur Region (Nutzerklärung, 18.09.2026)

Der Betreiber sitzt in der EU und wählt vorerst EU-gehostete Modellverarbeitung. Eine spätere Nutzung anderer Regionen, auch für US-Kunden, bleibt bis zu seiner rechtlichen Beratung und anschließenden ausdrücklichen Entscheidung offen. Die technische Anbieterarchitektur soll austauschbar bleiben; daraus folgt keine Freigabe anderer Regionen oder automatischer Fallbacks.

Diese Vorgabe umfasst Generierung, Embeddings und Websuche sowie deren Gateway-, Logging-, Cache- und Unterauftragnehmerpfade. Keine automatische Ausweitung auf andere Regionen. Der Nutzer hat anschließend `vertex/gemini-3.5-flash-lite@eu` ausdrücklich für synthetische Tests mit nativer Suche ausgewählt. Diese laufen über `https://router.eu.requesty.ai/v1`; der technische Erfolg belegt noch keine EU-Verarbeitung der vollständigen Requesty-/Provider-/Suchkette. Diese muss vor echten Kundendaten belegt werden.

Sonar und das zuvor getestete `openai/text-embedding-3-small` sind nur historische technische Testnachweise mit synthetischen Eingaben beziehungsweise öffentlicher Dokumentationssuche. Ihr EU-Verarbeitungsnachweis fehlt; sie sind unter dieser Vorgabe **nicht für den Produkteinsatz freigegeben**. Die vorherige D03-Frage zu Azure+Sonar ist durch diese Nutzerklärung überholt. D03 und die Embedding-Auswahl bleiben offen, bis passende EU-Pfade geprüft sind.

Für die Beratung festhalten: Ein EU-Unternehmen unterliegt für seine einschlägige Verarbeitung personenbezogener Daten grundsätzlich der DSGVO; ein US-Kunde schafft keine automatische Ausnahme. Die DSGVO verlangt nicht pauschal EU-Hosting, sondern stellt auch Anforderungen an zulässige Drittlandübermittlungen. Entscheidend sind konkreter Datenfluss, Rollen, Empfänger und Verträge; dies ist eine allgemeine Einordnung, keine Freigabe des Dispatch-Anwendungsfalls. [EU-Informationen zur DSGVO](https://europa.eu/youreurope/business/governance-and-sustainability/digital-and-data-compliance/data-protection-gdpr/index_en.htm), [EDPB-Leitlinien zu Drittlandübermittlungen](https://www.edpb.europa.eu/documents/guideline/guidelines-052021-on-the-interplay-between-the-application-of-article-3-and-the_en)

Auch die EU-Vorgaben für Convex, Medien und Betrieb sind vor Kundendaten zu prüfen. Der bestehende synthetische R2-Testbucket mit Location Hint `weur` hat noch keine festgelegte EU-Jurisdiktion; aus seiner Erstellung wird keine Freigabe zur Speicherung von Kundendaten abgeleitet.

## 2. Datierte Capability-Matrix

| Provider / Fähigkeit | Dokumentierter Pfad | Eigener Zugang | Grenze / notwendiger Nachweis |
|---|---|---|---|
| X Auth und Refresh | OAuth2 Authorization Code + PKCE; `offline.access` für Refresh | Offen | Scopes, Rotation, Widerruf und Reconnect testen |
| X eigene Posts / Threads | `POST /2/tweets`, Antworten als einzelne Posts | Offen | Text, Selbstantwort, Lesen, Löschen und Kosten |
| X echte Quotes | `quote_tweet_id` | Offen | Laut Doku unter Self-Service nicht verfügbar; Enterprise erforderlich; D16 offen |
| X Medien | Upload, Finalisierung, Processing-Status, Post mit Media-ID | Offen | Gesamter R2→Publisher→X-Pfad; Mediengrenzen aus Abschnitt 5 |
| X Suche | Recent (7 Tage), Full Archive gesondert | Recent getestet: HTTP 200, 3 Ergebnisse | Tarif, Pagination, Felder und Budget testen |
| X Trends | Geografische Trends per WOEID | WOEID 1 getestet: HTTP 200 | Separater Zugangstest; keine personalisierte Trendzusage |
| X Metriken | Public; eigene Non-public/Organic/Promoted eingeschränkt | Offen | Eigener User Context; private Metriken für Posts innerhalb 30 Tagen; fehlend ≠ null |
| X Quellenabgleich | Batch Compliance für Post-/User-IDs dokumentiert | Offen | Entitlement, Frist, Sperrungen/Löschung und Kosten nachweisen |
| GitHub App | Ausgewählte Repositories; minimale Leserechte und Webhooks | Offen | Nicht ausgewähltes Repository verweigern; Entzug wirksam |
| Requesty Modellzugang | Modellkatalog und organisationsbezogene Freigaben | Vertex EU: Katalog und Texttest bestanden | Konkrete Modell-ID/Route und Rate-/Spendlimits |
| Requesty strukturierte Ausgabe | `json_schema` und `json_object` modellabhängig | Vertex EU: konkreter Schema-Test bestanden | Striktes Schema, Abbruch/Refusal und lokale Validierung getrennt testen |
| Requesty Tool Calls | Modellabhängige Funktionsaufrufe | Vertex EU: Funktionsname/Argumente geprüft | Folgenloser Test; Argumentvalidierung und Ausgabezuordnung |
| Requesty Embeddings | Separater `/v1/embeddings`-Endpunkt | Synthetischer Test: 1536 Dimensionen | Modell, Dimension, Kosten und Datenrechte separat |
| Requesty Websuche | Native Suche für unterstützte Modelle, Quellenmetadaten | Vertex EU: zwei Suchstreams mit Quellenmetadaten; Inline-Zuordnung nicht nachgewiesen | Adapter muss URLs/Titel und Zuordnung erhalten; D03 offen |
| Convex + Better Auth | React/Vite-Integration dokumentiert | Offen | Kompatible Paketkombination, Cross-Domain/CORS und Sessionprobe |
| Convex Agent / Workflow | Komponenten mit persistenten Abläufen | Offen | Adaptergeneration, Wiederaufnahme, Abbruch und Verbrauch |
| Cloudflare Frontend | Statische React/Vite-SPA | Offen | Build, Routing/Deep-Link, Auth-Callbacks in tatsächlicher Umgebung |
| R2 private Medien | Signierte Uploads und getrennte Domain-Finalisierung | Privater CLI-Roundtrip mit SHA256 bestanden; Browser/Finalisierung offen | Private Buckets je Umgebung, unveränderliche finale Bytes und Publisherabruf |

Primärquellen: [X OAuth](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), [Posts](https://docs.x.com/x-api/posts/create-post), [Suche](https://docs.x.com/x-api/posts/search/introduction), [Trends](https://docs.x.com/x-api/trends/trends-by-woeid/introduction), [Metriken](https://docs.x.com/x-api/fundamentals/metrics), [Compliance](https://docs.x.com/x-api/compliance/batch-compliance/introduction), [Requesty Schema](https://docs.requesty.ai/features/structured-outputs), [Embeddings](https://docs.requesty.ai/api-reference/endpoint/embeddings-create), [Websuche](https://docs.requesty.ai/features/web-search), [Better Auth React](https://labs.convex.dev/better-auth/framework-guides/react), [SPA-Routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

## 3. Datenverwendung vor dem ersten Modellaufruf

Diese Tabelle ist ein Prüfvertrag, keine pauschale rechtliche Freigabe. Technischer API-Zugang und erlaubter Verarbeitungszweck sind getrennte Nachweise.

| Datenkategorie | Speicherung | Inferenz / Weitergabe | Embeddings | Training |
|---|---|---|---|---|
| Synthetische Testdaten ohne Fremdrechte | Für Testbelege möglich | Für begrenzte Zugangstests innerhalb des bestätigten 10-EUR-Gesamtbudgets vorgesehen | Separater synthetischer Test | Kein Bestandteil von TASK-1 |
| Direkt eingegebene eigene Entwürfe | Workspacegebunden, Herkunft erfassen | Rechte, Requesty-Route und Modellbedingungen vor echten Inhalten prüfen | Zweck/Retention/Löschung klären | Separat entscheiden |
| Über X geladene eigene Posts/Metriken | X-Bedingungen und Aktualität beachten | Accountzustimmung ersetzt keine Prüfung der X-Nutzungsbedingungen | Ungeklärt | Keine Freigabe |
| Fremde öffentliche X-Quellen | Nur mit nachgewiesenem Quellen-Lifecycle | Vor Nachweis von Use Case und Empfängerkette keine Übermittlung | Vor Nachweis keine Erzeugung | Keine Freigabe |
| Geschützte X-Inhalte / DMs | Nicht als Dispatch-Recherche vorgesehen | Nicht vorgesehen | Nicht vorgesehen | Nicht vorgesehen |
| Private GitHub-Inhalte | Auswahl/Workspace-Isolation und Retention erforderlich | Nur ausdrücklich zugelassene Kategorien; Geheimnisse ausschließen | Separat freigeben | Keine Freigabe |
| Zusammenfassungen und Vektoren | Herkunft und Löschbezug behalten | Nicht automatisch von Quellbedingungen befreit | Löschbarkeit mit Quelle verknüpfen | Keine Freigabe |

Das [X Developer Agreement](https://docs.x.com/developer-terms/agreement) begrenzt Weiterverarbeitung und untersagt den beschriebenen Einsatz von X-Daten zum Training/Fine-Tuning von Foundation-/Frontier-Modellen. Daraus lässt sich weder eine Freigabe noch ein pauschales Verbot jeder Inferenz ableiten. Die konkrete App-Nutzung, Speicherung, Embeddings und Gateway-/Modellweitergabe sind jeweils offen.

Die [Developer Policy](https://docs.x.com/developer-terms/policy) verlangt die Aktualisierung/Entfernung gespeicherter Daten und nennt spätestens 24 Stunden nach einer entsprechenden Anfrage. Die [Guidelines](https://docs.x.com/developer-guidelines) formulieren vereinfachte Fristen und andere Weitergabelimits. Bei Abweichungen keine weitergehenden Rechte aus Guidelines ableiten; verbindlichen Vertrag und genehmigten Use Case klären.

**Vorgeschlagener Quellenbetrieb:** Verfügbarkeit vor Anzeige/Modellverarbeitung prüfen; wiederkehrende Prüfungen mit Reserve für Laufzeit/Retry planen; bei überfälligem Nachweis Quelle sperren. Löschung/Sperrung muss Evidenz, Zusammenfassungen, Vektoren, Caches, Logs und Empfänger erreichen. Ein Ereignisstrom für eigene Accounts deckt fremde Recherchequellen nicht automatisch ab. Polling/Batch ist erst nach nachgewiesener Abdeckung, Frist und Kosten ein nutzbarer Pfad. Betriebsvorschlag noch nicht freigegeben.

Requesty unterscheidet Payload-Logging je Schlüssel, Organisationsregeln und irreversibles organisationsweites ZDR. Gateway-ZDR belegt nicht die Bedingungen jedes nachgelagerten Modellproviders. Vor echten Daten die konkrete Route, Logging-/Cache-Einstellungen, Region, Empfänger, Aufbewahrungsfristen und Löschmöglichkeiten dokumentieren. Einstellungen wurden nicht verändert. [Requesty Data Privacy](https://docs.requesty.ai/features/data-privacy)

## 4. Minimaler GitHub- und Requesty-Prüfumfang

GitHub V1: `Contents: read`, erforderliches `Metadata: read`, Installation ausschließlich auf ausgewählten Repositories. `push` und `release` auswerten, Releases auf Veröffentlichung filtern. Installation-/Repository-Entzug muss weitere Verarbeitung sperren. Zusätzliche Pull-Request-/Issue-Rechte sind für diesen V1-Pfad nicht erforderlich. Installation-Tokens gezielt begrenzen und nach Ablauf neu erstellen. Fehlgeschlagene Webhooks werden nicht automatisch wiederholt; der spätere Eingang benötigt Signaturprüfung, dauerhafte Erfassung, Deduplizierung und Recovery. [Berechtigungen](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app), [Events](https://docs.github.com/en/webhooks/webhook-events-and-payloads), [Installation-Tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app), [Recovery](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries)

Requesty: Katalogflags sind Vorbedingungen, keine Tests. Für die gewählte Kombination jeweils separat nachweisen: Textantwort, striktes Schema, folgenloser Tool Call, Embedding und Websuche. `supports_json_schema` ist stärker als bloßes JSON; Quellmetadaten dürfen beim Adapter nicht verloren gehen. Kosten und fehlende Usage-Antworten mit Provider-Abrechnung abgleichen. [Modellkatalog](https://docs.requesty.ai/api-reference/endpoint/models-chat-list), [Schema](https://docs.requesty.ai/features/structured-outputs), [Kosten](https://docs.requesty.ai/features/cost-tracking)

**D03 – auf Nutzerwunsch vom 19.09.2026 vertagt:** Die endgültige LLM-Providerentscheidung und die zugehörige Suchpfadklärung werden später fortgesetzt; aktuell ist hierzu keine Nutzerantwort erforderlich. Die EU-Vorgabe bleibt bestehen. Vertex EU ist der aktuelle Testkandidat. Native Suche funktioniert im Kleinsttest; Search-Log-Retention bis drei Tage und ungeklärte Datenregion sind separate offene Punkte (Details im Zugangstestbericht). Websuche hinter einem austauschbaren Adapter, der Quellen-URL, Titel, Abrufzeit, zugehörige Aussage, Provider und Kostenstatus liefert. Native Requesty-Suche nur nach erfolgreichem Quellen-/Adaptertest auswählen. Bei Fehlschlag einen externen Suchanbieter gesondert auf Zugang, Rechte, Quellenqualität und Preis prüfen. Nur Pfade mit nachgewiesener EU-Verarbeitung kommen vorerst infrage; Sonar ist mangels dieses Nachweises nicht ausgewählt. Ein reduzierter Rechercheumfang braucht eine ausdrückliche Entscheidung.

**D16 – Vorschlag zur Entscheidung:** Echte Quote-Posts erst nach Enterprise-/Accountnachweis zulassen. Ein normaler URL-Post ist eine eigene Funktion und kein stillschweigend gleichwertiger Ersatz.

## 5. Versions-, Runtime- und Medienprüfung

Die konkrete Kandidatenmatrix und Metadatennachweise werden im ergänzenden [technischen Prüfbericht](../reviews/2026-09-18-task-1-technical-validation.md) festgehalten. Vor Freigabe der Integration sind nach Installation Typecheck und Runtime-Smokes zu ergänzen. Eine gemeinsam installierbare Version ist noch keine getestete Integration.

X dokumentiert bis zu vier Bilder oder ein GIF oder ein Video pro Post. Der Chunked-Upload-Leitfaden nennt typischerweise 5 MB für Bilder, 15 MB für GIFs und höchstens 8 MB je Uploadsegment (empfohlen höchstens 5 MB). Dokumentierte Videoobergrenzen: Standard 20 Minuten/8 GB, Premium/verifiziert 125 Minuten/16 GB. Das sind keine freigegebenen Dispatch-Produktlimits; Codec, Dauer, Zugang und begrenzten Publisher-Transfer praktisch prüfen. [Create Post](https://docs.x.com/x-api/posts/create-post), [Chunked Upload](https://docs.x.com/x-api/media/quickstart/media-upload-chunked)

Für R2 gilt ADR-001: temporärer Browser-Schlüssel → getrenntes finales Objekt → Prüfung der finalen Bytes → `ready` in Convex. Signierte URLs sind wiederverwendbar, solange gültig; sie dürfen nie einen final freigegebenen Schlüssel beschreiben. Ein Komponenten-Callback oder HEAD-Metadatenabgleich beweist keine Inhaltsvalidierung. Große Medien benötigen begrenzten Transfer, dauerhafte Checkpoints und wiederaufnehmbare Wartezeiten. [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [R2-Komponente](https://github.com/get-convex/r2)

## 6. Konkrete Zugangstests und Belegformat

Jeder Test benötigt Datum, Umgebung, pseudonyme App-/Accountreferenz, Scope/Tarif, Paket-/Modellversion, Operation, erwartetes und tatsächliches Ergebnis, Statuscode/Request-ID, Zeit und Kosten. Geheimnisse und signierte URLs redigieren. „Im eigenen Zugang getestet“ erst nach einem solchen Beleg setzen.

| ID | Test | Erfolgskriterium |
|---|---|---|
| T01 | X User lesen → Refresh → erneut lesen; Widerruf | Accountidentität stabil; Rotation/Fehler nachvollziehbar |
| T02 | Text, Selbstantwort, Bild und kurzes Video auf Testaccount | Publizierte IDs, Processing und Kosten belegt; nur freigegebene Testinhalte |
| T03 | Gedeckelte Suche, Trends, eigene/öffentliche Metriken | Verfügbare Felder, Grenzen und Rechnungswirkung getrennt dokumentiert |
| T04 | Gespeicherte Testquelle entfernen; Schutz/Sperrung prüfen | Vorgesehener Abgleich erkennt Status innerhalb festgelegter Frist; Ableitungen gesperrt/gelöscht |
| T05 | GitHub Repository A erlaubt, B nicht; Entzug | Keine Daten aus B; Push/Release und Entzug korrekt |
| T06 | Requesty fünf separate synthetische Fähigkeitstests | Schema, Toolzuordnung, Dimension, Quellen und Usage jeweils geprüft |
| T07 | R2 Upload/Finalize/Retry/Publisherabruf | Private Buckets; erneuter temporärer Upload verändert finale Prüfsumme nicht |
| T08 | Paket-/Auth-/Deployment-Durchstich | Strikte Installation, Typecheck, Login, Session, Workflow und SPA-Deep-Link |
| T09 | Monatskosten aus Versuchseinheiten hochrechnen | Messwerte ersetzen Annahmen, fehlende Tarife explizit, Rechnung abgeglichen |

T02 benötigt den benannten Testaccount und freigegebene Inhalte; T01–T09 benötigen je nach Provider passende Zugänge. Das Gesamtbudget von maximal 10 EUR ist freigegeben; Weitere Aufrufe warten auf die jeweils fehlenden Zugänge sowie die nötigen Daten-/Testinhalts- und EU-Verarbeitungsnachweise. Die öffentliche Dokumentationsprüfung bleibt davon unabhängig.

## 7. Abnahmestand und nächste Entscheidungen

| Task-Kriterium | Stand |
|---|---|
| AC1 Datierte Capability-Matrix mit Nachweisstufen | Ersttests und offene Account-/Integrationstests getrennt dokumentiert |
| AC2 Jede Pflichtfunktion nutzbar oder Reduktion ausdrücklich beschlossen | **Offen**: tatsächliche Zugänge, Quellenrechte/-abgleich, Versionstest, D03/D16 |
| AC3 Keine unbelegte Recherche-Zusage veröffentlicht | In diesem Arbeitsschritt eingehalten; Produkt-/Marketingprüfung vor Veröffentlichung erneut erforderlich |
| DoD Tests und manuelle Abnahme | Erste Teiltests bestanden; verbleibende Provider-/Integrationstests und Nutzerabnahme offen |
| Done-Freigabe | Nicht angefragt, solange die fachlichen Nachweise fehlen |

Noch benötigt: fehlende X-/GitHub-App-Authentifizierung, konkrete Pläne, Testaccount, X-Use-Case-/Datenrechte-Nachweis und Entscheidung zu D16. Die LLM-Providerentscheidung einschließlich D03 ist auf Nutzerwunsch vertagt; bestehende Prüfpunkte bleiben dokumentiert. TASK-1 steht auf ausdrückliche Nutzeranweisung vom 01.10.2026 auf Done; der dokumentierte Teilnachweis und die offenen Aktivierungstore werden dadurch nicht zu vollständigen Freigaben.

## 8. Recherchemethodik

Context7 wurde außerhalb der Sandbox genutzt: für Requesty zuerst `library Requesty`, danach `docs /websites/requesty_ai`; für X und GitHub entsprechend Library-Auflösung vor Docs. Der technische Prüfbericht dokumentiert seine Abfragen separat. Originaldokumentation und veröffentlichte npm-Metadaten ergänzen die Auszüge. Kein Accountnachweis wurde aus Dokumentation abgeleitet. Das Kostenmodell unterscheidet veröffentlichte Preise, angenommene Mengen und noch fehlende Messwerte.
