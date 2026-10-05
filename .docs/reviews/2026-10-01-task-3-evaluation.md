# TASK-3 – Bewertung von Informationsarchitektur und Kerninteraktionen

Stand: 1. Oktober 2026. Auftrag: TASK-1 und TASK-2 auf Done setzen, TASK-3 auswerten.

## Ergebnis

TASK-3 bleibt **To Do**. Die Abhängigkeit TASK-2 ist abgeschlossen. Fachliche Grundlagen sind vorhanden; die drei Abnahmekriterien sind noch nicht nachgewiesen. Eine Auswertung ist keine Freigabe der Design- oder UI-Implementierung.

Zwei unabhängige, ausschließlich lesende Reviews wurden zusammengeführt: Fach-/Release-Verträge sowie Designartefakte/Startfähigkeit. Beide bestätigen dieselben wesentlichen Lücken.

## Nachweisstand

| Kriterium | Bewertung | Fehlender Nachweis |
|---|---|---|
| AC1: Kerninteraktionen vor UI-Implementierung verständlich und freigegeben | Offen | Geprüfte Abläufe/Prototypen, Gestaltungsentscheidungen und Produktinhaber-Freigabe |
| AC2: Annahme, Inhaltsfreigabe und tatsächliche Terminierung unterscheidbar | Fachlich vorbereitet, UX-Nachweis offen | Sichtbare Aktionen, Versions-/Accountbindung und dokumentierte Verständnisprüfung |
| AC3: Gleiche Designprüfung vor Team-/Multi-Channel-Ausbau | Prüfpflicht genannt, Ausgestaltung offen | Dokumentiertes zukünftiges Designgate mit Verantwortlichkeit und Prüfkriterien |

Die vorgesehenen Dateien `.docs/decisions/experience-design.md` und `.docs/design/core-flows.md` fehlen. Die Repository-Dateiliste enthält keine alternativen Prototypen oder implementierte Anwendungs-UI. Die vorhandene `.docs/schema.ts` ist kein Interaktionsnachweis.

Es fehlen außerdem eine Zustandsmatrix je Kernansicht für Leerzustand, Laden, Teilerfolg, Fehler, fehlende Rechte und Wiederaufnahme, abgestimmte visuelle Entscheidungen sowie Protokolle repräsentativer Nutzerprüfungen.

## Verbindliche Grundlage und Umfangslücke

Der [Domain-Vertrag](../decisions/domain-contracts.md#4-entwurfsversion-freigabe-und-geplanter-inhalt) trennt Quelle/Idee, Arbeitsversion, konkrete Freigabe, Termin und bestätigte Veröffentlichung. Planannahme erzeugt keine verdeckte Freigabe. Freigabe gilt nur für die konkrete Version und den konkreten Account.

Die [Planregeln](../decisions/domain-contracts.md#52-plan-und-planelemente) verlangen bei Annahme erneute Prüfung von Freigabe, Slot und Aktualität. Zwei angenommene von drei Vorschlägen ergeben genau zwei Termine. Die [Publishing-Regeln](../decisions/domain-contracts.md#6-publishing-teilerfolg-und-fehlerwiederaufnahme) unterscheiden bestätigten Erfolg, Teilerfolg und unbekannten Ausgang; ein Timeout erlaubt keine blinde Wiederholung.

**Umfangslücke:** TASK-3 und P00.03 nennen Analyzer, Dispatch Score und J07 noch nicht ausdrücklich. Nach dem [Release-Vertrag](../decisions/release-scope.md#2-einzige-definition-des-dispatch-mvp) gehören sie bereits zu R2. Der Composer-Entwurf muss daher freiwillige Analyse, erklärbaren Score, höchstens drei priorisierte Empfehlungen, sichtbaren Diff und Übernahme in eine neue Version abdecken. Die neue Version erbt keine Freigabe und ersetzt keine geplante ältere Version. Analyseausfall, Unsicherheit und Kosten benötigen verständliche Zustände.

Die Scoreformel und das Dimensionsmapping werden in TASK-27 entschieden; TASK-3 gestaltet deren Darstellung. Team-/Mehrkanaloberflächen sind jetzt nicht vollständig zu gestalten, ihre spätere Prüfung muss jedoch als Gate dokumentiert werden.

## Empfohlener nächster Arbeitsumfang

1. Umfang auf R0–R2 konkretisieren und J07 ausdrücklich in den Designumfang aufnehmen.
2. `experience-design.md` erstellen: Navigation, Objektübergänge, visuelle Richtung, Dichte, Typografie, Statusdarstellung, Hell/Dunkel, responsive Prioritäten und spätere Designgates.
3. `core-flows.md` erstellen: Onboarding, Composer einschließlich Intelligence, Research Inbox, Agent-Chat und Kalender als klar beschriebene oder klickbare Prototypen mit Zustandsmatrix.
4. J01–J08 und frühe J12-Sperrungen anhand konkreter Szenarien prüfen; offene Regeln sichtbar als Entscheidungsbedarf führen.
5. Produktinhaber-Review und repräsentative Nutzerprüfung dokumentieren. AC erst nach Nachweis abhaken; Done erst nach ausdrücklicher Bestätigung.

Offen zu klären: UI-/Content-Sprachen (D01), Gestaltungsrichtung, Dichte, Typografie, Farben/Statussystem und responsive Prioritäten. DST-/Reiseverhalten, Slotkonflikte und Recherchefrische bleiben an den vorhandenen Entscheidungstoren; Designvarianten dürfen sie nicht still entscheiden. Die vertagte Providerwahl muss für reine Designarbeit nicht vorgezogen werden; echte Providerverarbeitung bleibt an ihre Aktivierungstore gebunden.

## Konkrete Abnahmefälle

- Quelle oder Idee annehmen und anschließend erkennen, dass damit noch keine Inhaltsfreigabe oder Terminierung erfolgt ist.
- Zwei von drei Vorschlägen annehmen und genau zwei tatsächliche Termine erkennen.
- Version 7 geplant lassen, während Version 8 bearbeitet, analysiert und separat freigegeben wird; Austausch erst ausdrücklich durchführen.
- J07: Analyse ändert keinen Text; Diff prüfen und Empfehlung als neue, zunächst ungeprüfte Version übernehmen.
- Analyseausfall bei sonst gültigem freigegebenem Inhalt verstehen, ohne fehlende Intelligence-Nachweise als vollständige MVP-Abnahme auszulegen.
- Teilthread und unbekannten Schreibausgang unterscheiden; nur sicher ausstehende Beiträge wiederaufnehmen.
- Leere Recherche, Quellenausfall, Budgetende und veraltete Evidenz unterscheiden.
- Account-Disconnect oder fehlende Rechte erkennen und sicher wiederaufnehmen.

Nutzer sollen Quelle, Arbeitsversion, freigegebene Version, tatsächlichen Termin und bestätigte Veröffentlichung korrekt benennen können. Ergänzend Tastaturbedienung, mobile Prioritäten und Statusverständnis ohne alleinige Farbcodierung prüfen.

## Durchgeführte Prüfung und Grenzen

Repository-Dateiliste, TASK-3/P00.03, Domain-Vertrag und Release-Vertrag gelesen; zwei unabhängige Reviews konsolidiert. Keine Anwendungstests, Provideraufrufe, Prototypentests oder Nutzerprüfungen durchgeführt. TASK-3 erhält nur Bewertungsnotizen und diesen Bericht als Referenz; Status und offene AC bleiben erhalten.

TASK-1 und TASK-2 wurden am 01.10.2026 auf ausdrückliche Nutzeranweisung per Backlog-CLI geschlossen. Offene AC2–5 und Aktivierungstore aus TASK-1 bleiben dokumentiert. Der Statuswechsel ist kein zusätzlicher technischer oder EU-only-Nachweis. Historische Prüfberichte vom September behalten ihren damaligen Stand.
