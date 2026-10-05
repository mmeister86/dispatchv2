---
id: TASK-1
title: Provider-Zugänge und Kostenmodell prüfen (P00.01)
status: Done
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-01 10:34'
labels:
  - p00
  - r0
  - jev
milestone: m-0
dependencies: []
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P00.01.
Phase: P00 – Machbarkeit und Produktverträge.

**Abhängigkeit:** keine. **Dateien:** `.docs/decisions/provider-capabilities.md`, `.docs/decisions/unit-economics.md`.

- Für X Auth, eigene Posts, Medien, Suche, Trends, Token-Erneuerung und verfügbare Metriken mit dem tatsächlichen App-Zugang prüfen.
- Vor der ersten Modellverarbeitung erlaubte Datenkategorien, Inferenz, Speicherung, Embeddings und Weitergabe an Gateway/Modellprovider dokumentieren. Für gespeicherte X-Quellen einen mit dem App-Zugang verfügbaren Entfernungs-/Sperrungsabgleich samt Fristen und Kosten nachweisen; Training später separat freigeben.
- GitHub-App-Berechtigungen auf ausgewählte Repositories und notwendige Events begrenzen.
- Requesty-Modellzugang, strukturierte Ausgaben, Tool Calls, Embeddings und Websuche getrennt prüfen; bei fehlender nativer Suche einen austauschbaren Suchadapter festlegen.
- Convex-Komponenten, Better-Auth-Integration, Ausführungsgrenzen und Cloudflare-Deployment anhand aktueller Dokumentation validieren.
- Eine gemeinsam kompatible Versionsmatrix für Convex, Better Auth samt Convex-Komponente, Agent, Workflow, R2, AI SDK und Requesty-Adapter festlegen; veröffentlichte Paket-Metadaten und Peer Dependencies prüfen, nicht unabhängig alle Pakete auf `latest` setzen. Konkrete Runtime-, Dokument-, Argument- und Mediengrenzen dokumentieren.
- Cloudflare-R2-Zugänge, private Buckets je Umgebung, direkte autorisierte Uploads, Finalisierung und Abruf durch den X-Publisher nachweisen; Medienverkehr und R2-Operationen in die Kostenmessung aufnehmen.
- Kosten pro aktivem Workspace für wenig, typische und hohe Nutzung mit gemessenen Einheiten modellieren; fehlende Tarife als Prüfpunkt markieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D03: Websuche und Fallback festlegen.
- D16: Quote-Posts/spezielle X-Fähigkeiten nur nach tatsächlichem Zugang.
- D17 bestätigt: Convex-Domain und R2-Medien gemäß ADR-001.

### JEV-Abgleich vom 18.09.2026

TypeSafe/Jev als zusätzlichen semantischen Provider prüfen: SDK/API und Node-/Convex-Kompatibilität, gepinnte Version, strukturierte Antwortformate, eigener Zugang, Limits, aktuelle Preis-/Usage-Semantik und Kosten für Analyse/Retry getrennt nachweisen. Tarifangaben aus dem Guide sind unbestätigte Ausgangspunkte.

Die in den bestehenden Notizen dokumentierte EU-only-Vorgabe gilt auch hier für Inferenz, Logging, Cache, Speicherung und Unterauftragnehmer. DPA, SCC und eine Nicht-Trainingszusage ersetzen keinen durchgängigen EU-Nachweis. Vor ersten Kundendaten DPA/Unterauftragnehmerliste, Datenkategorien, Zweck, Retention/Löschung, erforderliche Transferprüfung und Datenschutzhinweise dokumentieren. Bis zur Freigabe bleibt TypeSafe für Kundendaten deaktiviert; kein automatischer Regions- oder Providerwechsel. Offene Jev-Punkte dürfen als explizite Aktivierungstore geführt werden. Seit D04 vom 19.09.2026 gehören Analyzer und Score zum R2-Pflichtumfang: fehlende Freigaben verhindern dessen vollständige Abnahme, nicht die unabhängige Vertragsarbeit oder zulässige manuelle Publishing-Funktionen. Ein reduzierter MVP erfordert eine ausdrückliche Umfangsentscheidung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Eine datierte Capability-Matrix unterscheidet technisch dokumentiert, im eigenen Zugang getestet und nicht verfügbar.
- [ ] #2 Jede Pflichtfunktion hat einen nutzbaren Pfad oder einen ausdrücklich beschlossenen reduzierten Umfang.
- [ ] #3 Keine Veröffentlichung eines Recherche-Versprechens ohne passenden Zugang.
- [ ] #4 Eine datierte TypeSafe-Matrix trennt dokumentierte, tatsächlich getestete und ungeklärte Fähigkeiten sowie aktuelle Preis-/Usage-Annahmen.
- [ ] #5 Der TypeSafe-Datenpfad wird gegen die bestehende EU-only-Vorgabe bewertet; ohne dokumentierte Freigabe bleiben Kundendatenaufrufe deaktiviert und der offene Aktivierungsblocker ist sichtbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [x] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Aktuelle offizielle Provider-Dokumentation und veröffentlichte Paket-Metadaten prüfen.
2. Datierte Capability-Matrix mit getrennten Dokumentations- und Zugangsnachweisen erstellen.
3. Kostenmodell mit drei Nutzungsszenarien, Messgrößen und offenen Tarifen erstellen.
4. Nach Klärung vorhandener Zugänge und Testbudget reale Durchstiche durchführen; D03/D16 zur Entscheidung vorlegen.
5. Ergebnisse prüfen und Akzeptanzkriterien nur bei tatsächlichem Nachweis abhaken; Done erst nach Nutzerabnahme.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-18: Start durch Nutzer beauftragt. Öffentliche Dokumentations- und Metadatenprüfung läuft. Vorhandene Provider-Zugänge und Budget für kostenpflichtige Tests angefragt. Homebrew-CLI 1.52.0 startet wegen ungültiger Signatur nicht; separate npm-CLI derselben Version funktioniert. Keine Änderung an Taskdateien außerhalb der CLI.

2026-09-18 Nutzerklärung: X eingerichtet, Requesty vorhanden, GitHub-App aus V1 vorhanden, Convex-Instanz angelegt, Cloudflare/R2 noch nicht eingerichtet. Gesamtbudget für Testaufrufe ausdrücklich bis 10 EUR freigegeben. Lokaler Pfad zu V1 bzw. Testzugängen angefragt. Öffentliche Dokumentation und strikte isolierte npm-Peerauflösung abgeschlossen; Account-Capabilities weiterhin ungetestet. gh auth status außerhalb Sandbox erfolgreich (persönlicher CLI-Zugang, kein GitHub-App-Nachweis).

2026-09-18 Zwischenstand: .docs/decisions/provider-capabilities.md, unit-economics.md und technischer Prüfbericht samt Registry-/Lockfile-Belegen erstellt. AC1 nach Dokumentprüfung erfüllt; AC2, AC3 und DoD bleiben offen. Strikte npm-Peerauflösung bestanden (17 direkte Pins, 204 Lockfile-Einträge); keine Type-/Runtime-/Provider-Smokes. Unabhängige Reviews zu Kosten und Technik eingearbeitet; Formeln, relative Links, JSON, Pins und Git-Diff geprüft.
Nutzer: V1 nicht auf diesem Rechner, Zugangswerte werden zusammengestellt. GitHub-Personallogin gültig; Wrangler 4.134.0 nicht authentifiziert. Leere .env.provider-check.local mit Modus0600 angelegt, Git-Ignore verifiziert; versionierte Beispielvorlage enthält keine Secrets. Kein kostenpflichtiger Providerverbrauch (0 EUR); bestätigtes Gesamtbudget10 EUR. Nächster Schritt: Zugangswerte lokal eintragen und Cloudflare anmelden; dann getrennte Capability-Smokes und D03/D16-Entscheidungen. Status bleibt In Progress; keine Done-Freigabe eingeholt.

2026-09-18 Zugangstests: Nutzer hat lokale Zugangswerte ergänzt, Wrangler angemeldet und R2 aktiviert. Hauptmodell vom Nutzer auf azure/gpt-5.6-luna@germanywestcentral geändert. Text, konkretes striktes JSON-Schema und Tool-Call-Argumente bestehen per HTTPS; AI SDK/Agent noch ungetestet. Vorherige DeepSeek-Route scheiterte im konkreten Schema-/Tool-Test (nur reasoning_content); GPT-4.1-nano Kontrolltests bestanden. Embeddings: 1536 endliche Dimensionen. Native Suche: Haiku-Messages ohne Quellenbeleg, Sonar-Streaming liefert URLs/Titel; Zuordnung/SDK/volle Suchgebühren offen.
X App-Bearer: User-Lookup1 Ressource, Recent Search3 Ergebnisse und WOEID1-Trends1 Ergebnis jeweils HTTP200. Keine Veröffentlichung, keine Weitergabe von X-Inhalten an Modelle. OAuth2 Client-ID und User-Tokens fehlen; Consumer Credentials nicht verwechseln. GitHub-App-PEM-Pfad fehlt; Convex bisher nur Origin erreichbar.
Privater R2-Bucket dispatch-v2-dev (Standard, weur-Hint) erstellt, r2.dev deaktiviert, keine Custom Domains, CORS nicht eingerichtet. Remote-PUT/GET eines synthetischen66-Byte-Objekts mit identischer SHA256; Objekt bleibt für Folgetests. Lokale leere Cloudflare-Account-/Bucketfelder ergänzt. Browser-Presigning, Finalisierung, Medienpublisher und Umgebungsisolation noch offen.
Gemeldete Requesty usage.cost zusammen0.020132USD; X circa0.035USD nur geschätzt. Kein vollständiger Rechnungsabgleich, Such-/R2-Kosten offen. Gesamtbudget weiterhin10EUR. Neuer Bericht .docs/reviews/2026-09-18-task-1-access-validation.md mit bereinigter JSON-Evidenz. D03-Modell/Suchpfadentscheidung sowie fehlende OAuth2-/GitHub-App-Werte beim Nutzer angefragt. Status bleibt In Progress; keine Done-Freigabe.

2026-09-18 Nutzerklärung zur DSGVO: EU-gehostete Modellverarbeitung ist vorerst Vorgabe. Andere Regionen, auch für US-Kunden, erst nach rechtlicher Beratung und ausdrücklicher Entscheidung. Azure-Luna Germany West Central bleibt gewählt; der Funktionsnachweis ist keine Datenschutz-/EU-Kettenfreigabe. Gateway/Logging/Cache/Unterauftragnehmer, Embeddings und Suche ebenfalls auf EU-Verarbeitung prüfen; keine automatischen Fallbacks auf andere Regionen. Vorherige D03-Frage Azure+Sonar überholt; Sonar und OpenAI-Embedding nur historische synthetische Tests, kein freigegebener Produktpfad. D03 und Embedding-Auswahl bleiben offen. Auch Convex-/R2-/Betriebsregion vor Kundendaten prüfen; weur-Location-Hint des Testbuckets ist kein EU-Jurisdiktionsnachweis. Keine weiteren kostenpflichtigen Provideraufrufe in diesem Schritt.

Vertex-EU-Folgetest am 18.09.2026 auf ausdrücklichen Nutzerwunsch: Testmodell vertex/gemini-3.5-flash-lite@eu und Requesty-EU-Gateway lokal gesetzt. Drei synthetische Basistests (Text, JSON-Schema, Tool Call) bestanden. Zwei native Suchstreams liefern je eine Quelle: zunächst filebase.com, gezielte site:-Folgefrage cloudflare.com; erwarteter Preis jeweils enthalten. Inline-Aussage/Quellenbindung und aufgelöstes Linkziel nicht nachgewiesen. Fünf Aufrufe melden zusammen 0,00033627 USD, kumulativ 17 Requesty-Antworten 0,02046827 USD; Suchgebühren/Rechnung nicht abgeglichen. Google Search Grounding speichert laut aktueller Primärquelle Suchqueries/Kontext bis drei Tage, nicht abschaltbar; EU-only-Suchdatenpfad ungeklärt. Nur synthetische/öffentliche Tests, kein Fallback, keine Kundendaten. Berichte und Evidenz aktualisiert; D03 und bestehende Pflichtnachweise offen, Status In Progress.

2026-09-18 JEV-Backlog-Abgleich: TypeSafe-Prüfung und EU-only-Aktivierungstor ergänzt. Vorhandene Nachweise, AC1 und bisheriger Fortschritt bleiben erhalten. Keine neuen Provideraufrufe, keine technische oder datenschutzrechtliche Freigabe durch diese Planungsänderung.

2026-09-19 Nutzerklärung: X-Login in V1 wurde über Clerk abgewickelt; X_USER_ACCESS_TOKEN und X_USER_REFRESH_TOKEN können nicht manuell bereitgestellt werden und werden nicht mehr als Nachlieferung angefordert. Felder dürfen vorerst leer bleiben. Der offene User-Auth-/Refresh-Nachweis benötigt einen neuen autorisierten Login-Durchlauf im vorgesehenen V2-Verbindungsflow; keine V2-Autorisierung aus dem V1-Login ableiten. Endgültige LLM-Providerentscheidung und zugehörige D03-Suchpfadklärung auf Nutzerwunsch vertagt; derzeit keine Entscheidung dazu anfordern. Vertex EU bleibt lediglich getesteter Kandidat, bestehende EU-Vorgabe und offene Nachweise bleiben erhalten. Berichte/Vorlagenkommentare aktualisiert, keine Provideraufrufe oder Credential-Änderungen. TASK-1 bleibt In Progress.

2026-09-19 D04 in TASK-2 geändert: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Die TypeSafe-Nachweise sind dadurch vor R2-Aktivierung/-Abnahme erforderlich. Die vertagte Providerwahl und sämtliche bisherigen Test-/Freigabegrenzen bleiben erhalten; keine neuen Provideraufrufe.

2026-10-01: Nutzer weist ausdrücklich an, TASK-1 auf Done zu setzen. Abschluss des Prüf-/Dokumentationsstands bestätigt; keine neuen technischen Tests oder Providerfreigaben. Offene AC2–5 und Aktivierungstore bleiben bewusst ungeprüft und verbindlich: Provider-/Suchpfadentscheidung, eigener V2-X-Login samt Refresh, TypeSafe-Nachweise und EU-only-Freigaben. Der Statusabschluss ersetzt keinen Funktionsnachweis und keine Freigabe für Kundendaten oder vollständige R2-Abnahme.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Provider-Prüfstand, Zugangstests und Kostenmodell dokumentiert. Auf ausdrückliche Nutzeranweisung vom 01.10.2026 abgeschlossen. Offene technische und EU-only-Nachweise bleiben gemäß Capability-Matrix und bisherigen Notizen als Aktivierungstore bestehen; AC2–5 wurden nicht nachträglich als erfüllt markiert.
<!-- SECTION:FINAL_SUMMARY:END -->
