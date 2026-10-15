# Release-Vertrag und Entscheidungsregister

Vertragsstand: 19. September 2026 · TASK-2 / P00.02 · Abschluss auf ausdrückliche Nutzeranweisung am 1. Oktober 2026. Offene Entscheidungen und Aktivierungstore bleiben verbindlich.

## 1. Verbindlichkeit und Änderung D04

Die ausdrückliche Nutzerentscheidung vom 19.09.2026 lautet: **„Intelligence soll bereits in den Dispatch-MVP/R2“**. Damit ersetzt D04 die bisherige Empfehlung „Intelligence erst in der Beta“. Vorgezogen werden P08.01–P08.03: Profile, Jev Post Analyzer, Dispatch Score und die bewusste Übernahme von Empfehlungen (J07). P08.04 (Performance-Messgrundlage) bleibt R3; Kalibrierung bleibt R5.

Dieses Dokument ist die maßgebliche Release-Zuordnung für den [Gesamtplan](../dispatch-end-to-end-implementation-plan.md), die [Backlog-Roadmap](../backlog-roadmap.md) und den [JEV-Leitfaden](../JEV_INTEGRATION.md). Die [fachlichen Verträge](domain-contracts.md) beschreiben die zugehörigen Invarianten. Historische PRD-/V1-Texte und frühere Task-Notizen sind keine konkurrierenden Release-Zusagen. Die Arbeitspaketnummer P08 bleibt erhalten; sie bestimmt nicht die Ausführungsreihenfolge.

Bestätigt sind D04, die Speicherentscheidung D17 und die bereits in TASK-1 festgehaltene EU-only-Vorgabe. Die übrigen Entscheidungen werden unten ausdrücklich als offen oder teilweise konkretisiert geführt. Die Beauftragung dieser Dokumentation ist keine Freigabe der gesamten Anwendung, aller Provider oder zusätzlicher Kanäle. TASK-2 wurde auf ausdrückliche Nutzeranweisung am 01.10.2026 auf Done gesetzt.

## 2. Einzige Definition des Dispatch-MVP

**Der Dispatch-MVP ist R2: Ein Einzelanwender kann auf X manuelle Inhalte, Inhalte aus eigener GitHub-Arbeit und Inhalte aus eigenständiger X-/Web-Recherche erstellen, mit erklärbarer Intelligence analysieren und gezielt verbessern, konkrete Versionen menschlich freigeben, Kalenderpläne selektiv annehmen und zuverlässig veröffentlichen.**

Das Abnahmetor umfasst J01–J08 sowie den frühen Sicherheitsanteil von J12. GitHub und Recherche müssen unabhängig nutzbar sein. J07 umfasst Analyzer, Dispatch Score, höchstens drei priorisierte Empfehlungen, sichtbaren Diff und neue Version nach Übernahme. Kosten, Quellen, Unsicherheit und Fehler müssen verständlich sein. TASK-63 liefert den notwendigen Basisbetrieb; TASK-26 führt die gemeinsame MVP-Abnahme durch.

Die Analyse ist im MVP verfügbar, aber ihre Nutzung ist pro Post freiwillig. Ein temporärer Analyseausfall darf einen ansonsten gültigen, menschlich freigegebenen Post nicht blockieren. **Diese Ausfallregel ist keine Erlaubnis, R2 ohne nachgewiesene Intelligence als vollständig abzunehmen.** Ist der Jev-Datenpfad nicht freigegeben, bleiben Kundendatenaufrufe gesperrt; eine Produktabnahme mit reduziertem Umfang braucht eine neue ausdrückliche Entscheidung des Produktinhabers. Ein anderer Analyseprovider ist kein automatischer Fallback.

Es gibt keine implizite autonome Veröffentlichung: Analyse, Score, Chat-Zustimmung ohne konkreten Versions-/Accountbezug, Planansicht und Quellenannahme sind keine Inhaltsfreigaben. Zeitsteuerung führt zuvor ausdrücklich freigegebene Inhalte aus. Optionale Autonomie bleibt ein gesondertes R9-Vorhaben.

## 3. Release-Stufen

Die Stufen bauen fachlich aufeinander auf. Unabhängige Entwicklungsarbeiten können parallel laufen; kein Release darf seine Pflichtnachweise überspringen.

| Release | Enthaltener Umfang | Abnahmetor |
|---|---|---|
| R0 – Grundlage | P00–P01: Machbarkeit, Authentifizierung, Workspace-Isolation, Account-Kontext | TASK-1–6; offene Providerpfade bleiben sichtbar |
| R1 – interne/private Publishing-Alpha | P02–P03: manueller X-Loop, Medien, Versionen, Freigabe, Kalender, Wiederaufnahme | J01, J02, J08; TASK-13; interne Testaccounts, kein vollständiges MVP-Versprechen |
| R2 – Dispatch-MVP | R1 plus P04–P07, **P08.01–P08.03**, früher P09-Basisbetrieb | J01–J08 und früher J12-Anteil; TASK-26 nach TASK-29 und TASK-63 |
| R3 – private Beta | R2 plus P08.04 und konsolidiertes P09 | TASK-64: erste zulässige Messdaten, vollständiger J12, Datenkontrollen, Zugänglichkeit, Onboarding, Recovery |
| R4 – kommerzielles X-Produkt / GA | P10 | TASK-40: Billing, Entitlements, Support, Betriebsziele und reale Kosten; vollständige Datenschutz-/Providerprüfung |
| R5 – lernendes Produkt | P11–P12, TASK-67/68 | J09; Kalibrierung mit Evaluation/Rollback; getrennte Aktivierung von Routing und Verifikation |
| R6 – Teamprodukt | P13.01–P13.02; Kundenräume P13.03 optional | J10: Rollen, Kommentare und versionsbezogene Freigaben |
| R7 – mehrere Kanäle | P14.01–P14.03; weitere Kanäle P14.04 optional | J11 für X und genau den ausgewählten weiteren Kanal; TASK-53.1 entscheidet die Auswahl |
| R8 – ausgewähltes Endprodukt | Ausgewählte P15-Pakete | TASK-65 wählt das Portfolio, TASK-66 nimmt alle eingeführten Module zusammen ab |
| R9 – optionale Autonomie | P16, standardmäßig deaktiviert | D13 plus eigene Policy-Freigabe, Schattenbetrieb, Kill Switch und begrenzter Pilot |

Weder GA noch Endprodukt erfordern automatisch R9. Ein LinkedIn- oder Bluesky-Beispiel im JEV-Leitfaden ersetzt kein Kanal-Auswahltor.

## 4. J01–J12: überprüfbare Zuordnung

| Ablauf | Erste vollständige Release-Stufe | Konkreter Nachweis / Folgeausbau |
|---|---|---|
| J01 – Einstieg und X verbinden | R1 (Grundlagen R0) | E-Mail-Bestätigung, Workspace, autorisierter V2-X-Login und erster Entwurf; V1-/Clerk-Login ist kein V2-Nachweis |
| J02 – Entwurf bis Veröffentlichung | R1 | Medien finalisieren, exakte Version/Account freigeben, planen, veröffentlichen |
| J03 – eigene GitHub-Arbeit | R2 | Ausgewähltes Repository → Signal → belegte Idee → editierbarer Entwurf |
| J04 – proaktive Recherche | R2 | Aktiviertes Profil → begrenzter Lauf → aktuelles Thema → Idee, ohne GitHub-Anschluss |
| J05 – Recherche im Chat | R2 | Gleicher Evidenz-/Aktualitätsvertrag wie J04; Quellen und eigene Interpretation getrennt |
| J06 – Wochenplanung | R2 | Zwei angenommene von drei Vorschlägen erzeugen genau zwei Termine; Freigabe und Slotannahme werden geprüft |
| J07 – Intelligence und Übernahme | **R2 (D04)** | Analyse verändert keinen Text; Übernahme erzeugt neue Version ohne geerbte Freigabe oder stillen Terminaustausch |
| J08 – Publishing wiederaufnehmen | R1 | Teilthread und unklarer Schreibausgang werden sichtbar abgeglichen; kein blindes erneutes Senden |
| J09 – Feedback und Lernen | R5 | Redaktionelles Feedback ab R2, zulässige Metriken ab R3; belastbare Account-Empfehlungen und bestätigte Lernvorschläge ab R5 |
| J10 – Zusammenarbeit | R6 | Einladung, Rolle, Kommentar und Freigabe; Tenant-Isolation bereits R0 |
| J11 – Plattformvarianten | R7 | Separate Versionen, Freigaben und Termine für X und ausgewählten Kanal; LinkedIn bleibt Kandidat |
| J12 – trennen/löschen | R3 vollständig; Pflichtbasis spätestens R2 | Disconnect stoppt betroffene Jobs ab Einführung jeder Integration; TASK-63 sichert Sperrung und dokumentierten manuellen Löschweg vor MVP; TASK-33 liefert vollständige Datenkontrollen und Wiederaufnahme |

Mit jedem neu eingeführten Modul wird J12 auf dessen Daten und Jobs erweitert. Der spätere Self-Service-Ausbau verschiebt keine notwendige Sperrung oder sichere Löschung aus dem frühen Betrieb.

## 5. Jev: Funktionsumfang und Aktivierung

„MVP“ im JEV-Leitfaden bezeichnet den ersten Jev-Funktionsumfang. Er wird durch D04 **innerhalb von R2** geliefert und ist kein zweites Produkt-MVP.

| Funktion | Release / Tasks | Aktivierungsvoraussetzung |
|---|---|---|
| Profile und Analysevertrag | R2 / TASK-27 | Geprüfte Quellen-/Profilstände, Mapping bisheriger Dimensionen, eine versionierte Scoreformel |
| Post Analyzer + Dispatch Score | R2 / TASK-28.1–28.3 und TASK-28 | Verifizierter Providerzugang, zulässiger EU-Datenpfad, begrenzte Aufrufe, validierte Assessments, isolierter Cache, Kosten-/Fehlerzustände |
| Empfehlungen, Diff, Übernahme | R2 / TASK-29 | Bestehende Versions-/Freigabeverträge; J07-Abnahme in TASK-26 |
| Messgrundlage | R3 / TASK-30 | Tatsächlich verfügbare Metriken und zulässige Datenverwendung; fehlende Werte sind keine Null |
| Intent-Routing | R5 / TASK-67 | Eigene Policy, Confidence-Grenzen und Tests; keine Publikations- oder Terminentscheidung |
| Output-Verifikation, begrenzte Nachbesserung | R5 / TASK-68 | Begrenzte Schleifen, eigenständige Aktivierung, Budget, sichtbarer Reviewzustand; keine menschliche Freigabe ersetzen |
| Kalibrierung | R5 / TASK-43.1–43.3 | Zulässige Lernziele, zeitlich getrennte Evaluation, Schattenbetrieb, Aktivierungsentscheidung und Rollback |
| Network Fit | R7 / TASK-54 | Nur tatsächlich ausgewählte und integrierte Kanäle; keine kanalübergreifende Freigabe |
| Erweitertes Recycling | Nach R2 / R5 TASK-46 bzw. ausgewähltes R8-Portfolio TASK-58 | Historie/Datenrechte bzw. Portfolioentscheidung; jede neue Variante bleibt freigabepflichtig |

Jev liefert semantische Bewertungen hinter einem internen Adapter. Generative LLMs schreiben, recherchieren und erklären. Convex orchestriert, persistiert und wendet deterministische Geschäftsregeln an. Provider-Adapter veröffentlichen. Jev entscheidet weder Veröffentlichung noch Authentifizierung, Abrechnung oder Termine; ein zusätzliches autonomes Agentenframework ist nicht vorgesehen.

Der Dispatch Score ist eine erklärbare Inhaltsheuristik von 0–100, keine Reichweitenprognose. Die ursprünglichen sieben Dimensionen und die abweichende Beispielformel im Jev-Guide werden in TASK-27 auf **einen** versionierten Analysevertrag abgebildet; TASK-2 genehmigt keine der Formeln ungeprüft. Fehlende Audience-Daten ergeben keinen erfundenen Audience-Fit. Analysebedingungen müssen bei Versionsvergleichen übereinstimmen.

## 6. Entscheidungsregister D01–D17

**Entscheidungsverantwortlicher für alle Produktentscheidungen ist Matthias als Produktinhaber.** Die technische Vorbereitung und Nachweisführung übernimmt der Bearbeiter des jeweiligen Backlog-Tasks; erforderliche Rechts-/Datenschutzberatung wird als Mitwirkung benannt, ohne eine bereits beauftragte Person zu erfinden. „Tor“ bedeutet: Der betroffene Umsetzungsteil oder seine Aktivierung darf erst nach dokumentierter Entscheidung beginnen. Unabhängige Vertragsarbeit bleibt möglich.

| ID | Gegenstand und Status | Entscheidung / noch zu klärender Vorschlag | Verantwortlicher; Vorbereitung | Entscheidungstor |
|---|---|---|---|---|
| D01 | Erstnutzer/Sprachen – offen | Builder zuerst; genaue UI-/Content-Sprachen festlegen | Matthias; TASK-6 | Vor P01.03 |
| D02 | Research-Anfangsregel gewählt 05.10.2026; Betriebsbudget offen | Neue Profile manuell/ohne Zeitplan und ohne erteiltes Budget; periodische Läufe nur ausdrücklich aktiviert, endliche Auftragslimits in tatsächlicher Preiswährung zusätzlich zu drei Budgetdeckungen; keine Demo-Quote oder erfundene EUR-Umrechnung | Delegierte technische Entscheidung; TASK-20/1, konkrete Preis-/Verarbeitungsnachweise bleiben erforderlich | Keine automatische Provider-/Budgetaktivierung; Betriebsgrenzen erst aus tatsächlichen Nachweisen und Messung |
| D03 | Modell-/Suchpfad – **vertagt** | Endgültige Providerwahl auf Nutzerwunsch vom 19.09.2026 später; bisherige synthetische Tests sind keine Freigabe | Matthias; TASK-1/17/21, Datenschutzberatung | Vor betroffener Modell-/Suchverarbeitung mit Kundendaten; EU-only bleibt Voraussetzung |
| D04 | Intelligence im Release – **bestätigt 19.09.2026** | Analyzer, Score und J07 bereits im Dispatch-MVP/R2 | Matthias; TASK-2/27–29 | Entscheidung erfolgt; Aktivierungsnachweise vor TASK-26 |
| D05 | Private Repositories – Implementierungsumfang gewählt 05.10.2026 | Explizite Workspace-Auswahl; Zugriff, Monitoring und Content getrennt; begrenzte Ereignismetadaten/kommunizierbarer Projektkontext; einzelne historische Signale nur mit neuer aktueller Kontextzulassung bei unveränderter Herkunft; private Datei-/Diff-Modellweitergabe separat hashgebunden zustimmen und zulässigen Pfad nachweisen | Delegierte technische Entscheidung; TASK-14/16, Datenschutzberatung für Nachweise | Keine automatische Aktivierung; konkrete Repository-Zustimmung und Live-/EU-Nachweise bleiben vor privater Verarbeitung erforderlich |
| D06 | Implementierungsentscheidung 2026-10-05 unter übertragener Freiheit | Ein aktiver Publishing-Workspace pro Provider-Identität; autorisierter Disconnect vor frischem OAuth im neuen Workspace, keine Daten-/Freigabeübernahme | Umsetzung TASK-10 | Kein automatischer Cross-Tenant-Link; Live-Zugang separat nachweisen |
| D07 | Geplanten Post bearbeiten – Vertrag zur Abnahme | Geplante Version bleibt; Austausch erst nach neuer Freigabe und expliziter Aktion | Matthias; TASK-8/11 | Vor P02.02; bei TASK-2-Abnahme Vertragspräzisierung prüfen |
| D08 | Recherche-Anfangsregel gewählt 05.10.2026; gemessene Grenzen offen | Zeitkritisch/kontextabhängig/zeitunabhängig/unbekannt getrennt; endliche begründete Gültigkeit aus tatsächlichem Quellenstand und versionierter Zweckregel, unbekannt oder unerreichbar bleibt Review; neue Prüfung erzeugt eigenen Nachweis, geänderte Aussage neue Version/Freigabe; keine universelle TTL | Delegierte technische Entscheidung; TASK-22.1/24/25, konkrete Nachweise bleiben erforderlich | Keine automatische Provideraktivierung oder Frischeverlängerung; Quellenentzug/Frische vor Planung und Versand prüfen |
| D09 | Erster weiterer Kanal – offen | LinkedIn zuerst prüfen, Auswahl nach Zugang/Nachfrage | Matthias; TASK-53.1 | Vor Implementierung des zusätzlichen Adapters in P14.02 |
| D10 | Preise/Quoten/Kulanz – offen | Unit Economics abwarten; keine überraschende Löschung bestehender Termine | Matthias; TASK-37 | Vor P10.01 |
| D11 | Stripe-Angebot – offen | Managed Payments ist nur Kandidat; Domain unabhängig halten | Matthias; TASK-38, Rechts-/Steuerberatung nach Bedarf | Vor P10.02 |
| D12 | Lernverfahren/Datenrechte – offen je Zweck | Beschreibende Statistik zuerst; Inferenz, Messung, Embeddings und Training getrennt prüfen | Matthias; TASK-1/27/30/43, Datenschutzberatung | Vor jeweiliger Verarbeitung; R2-Analyse vor Aktivierung, Messung vor P08.04, Kalibrierung vor P11.03 |
| D13 | Autonome Veröffentlichung – nicht freigegeben | Standard aus; eigene begrenzte Policy erforderlich | Matthias; TASK-61/62 | Vor P16; kein früherer Release aktiviert sie |
| D14 | Endprodukt-Portfolio – offen | Mindestens ein weiterer Kanal im Zielbild; konkrete Quellen-/Medienauswahl aus Nachfrage | Matthias; TASK-65 | Vor jeweiligem P14-/P15-Ausbau |
| D15 | Betriebsziele/Retention – offen | RPO/RTO, Aufbewahrungsfristen und Alarme aus Pilot-/Restore-Nachweisen festlegen | Matthias; TASK-31/33/36/40 | Sichere Anfangsregeln vor Datennutzung; verbindliche Betriebsziele vor GA |
| D16 | Besondere X-Fähigkeiten – nicht freigegeben | Quote-Posts und Sonderfähigkeiten erst nach echtem Zugangsnachweis zusagen | Matthias; TASK-1/10/12 | P00.01/P03 vor Zusage und Nutzung |
| D17 | Speicheraufteilung – **bestätigt** | Convex: Produktdaten/Metadaten/Abläufe; R2: Medienbytes | Matthias; [ADR-001](001-convex-domain-r2-media.md), TASK-9/12/33 | Architektur entschieden; konkrete Regionen/Zugänge separat nachweisen |

## 7. Offene Voraussetzungen aus TASK-1

- TASK-1 steht auf ausdrückliche Nutzeranweisung vom 01.10.2026 auf Done. Seine offenen Nachweise und Aktivierungstore bleiben erhalten; TASK-2 dokumentiert den Zielvertrag, ohne fehlende Machbarkeit oder Freigaben als erledigt zu behandeln.
- X-User-Auth und Refresh werden im vorgesehenen V2-Verbindungsflow nachgewiesen. Manuell nachzuliefernde User-Tokens sind nicht mehr Voraussetzung dieser Dokumentarbeit.
- Endgültige LLM-/Such-/Embedding-Auswahl bleibt vertagt. Keine erneute Providerentscheidung ist für diesen Vertrag erforderlich.
- EU-only umfasst die im Projekt festgelegten Modell-, Gateway-, Logging-, Cache-, Speicher- und Unterauftragnehmerpfade. Ein regionaler Modellname, ein synthetischer Funktionstest oder ein R2-Location-Hint ist kein durchgängiger Nachweis. DPA/SCC ersetzen ihn nicht. Kein automatischer Regionswechsel.
- TypeSafe-Zugang, aktuelle API-/SDK-/Preisnachweise und zulässige Datenverarbeitung bleiben TASK-1-Nachweise. Das frühere R3-Aktivierungstor rückt wegen D04 für Analyzer/Score vor die R2-Abnahme.

## 8. Prüfung und Abnahme

TASK-2 prüft Dokumentkonsistenz: J01–J12 vollständig zugeordnet, D01–D17 mit Verantwortlichem/Tor erfasst, nur eine MVP-Definition, Jev-Grenzen und Providerblocker sichtbar, Backlog ohne Abhängigkeitszyklus. Es wurden dadurch keine Anwendungstests, Provider-Smokes oder Rechtsfreigaben erbracht.

Manuelle Abnahme: Release-Tabelle und J-Zuordnung lesen; D04-Vorziehung einschließlich Aktivierungstor bestätigen; Domain-Beispiele auf gewünschtes Verhalten prüfen; offene Entscheidungen mit Toren akzeptieren. Erst nach ausdrücklicher Bestätigung darf TASK-2 auf Done wechseln. Offene Entscheidungen mit späterem Tor werden dadurch nicht automatisch beschlossen.
