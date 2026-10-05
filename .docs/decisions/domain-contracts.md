# Fachliche Verträge: Inhalte, Freigaben, Planung und Ausführung

Vertragsstand: 19. September 2026 · TASK-2 / P00.02 · Abschluss auf ausdrückliche Nutzeranweisung am 1. Oktober 2026. Offene Entscheidungen und Aktivierungstore bleiben verbindlich.

## 1. Status und Geltungsbereich

Dieses Dokument konkretisiert die fachlichen Invarianten aus dem [Gesamtplan](../dispatch-end-to-end-implementation-plan.md), insbesondere §§4–6 und 15–16. Die [Release-Zuordnung und das Entscheidungsregister](release-scope.md) bestimmen Umfang, Verantwortliche und Entscheidungstore. Es entstehen hier keine Anwendung, Providerfreigabe oder erledigten Implementierungsnachweise.

Die Kennzeichnungen sind bewusst getrennt:

- **Bestätigt:** ausdrückliche Nutzerentscheidung. Das betrifft D17 (Convex für Produktdaten/Abläufe, R2 für Medien), die EU-only-Vorgabe aus TASK-1 und D04 vom 19.09.2026 (Analyzer, Dispatch Score und J07 bereits Dispatch-MVP/R2).
- **Übernommen:** bestehende fachliche Invariante des Gesamtplans; Bestandteil dieser TASK-2-Vertragsfassung zur Abnahme, keine Behauptung einer separaten früheren Nutzerbestätigung.
- **Präzisierung zur Abnahme:** hier konkretisierte Operation, Transition oder Beispiel. Insbesondere Transitionstabellen sind vorgeschlagene vollständiger beschriebene Verträge, kein bereits implementiertes Verhalten.
- **Offen:** verbleibende Entscheidung mit eigenem Tor. Eine TASK-2-Abnahme beschließt solche markierten Optionen nicht automatisch.

Historische PRD-/V1-Vorgaben zu Convex Storage, nur einem Agenten oder Wochenplanung erst nach dem MVP sind durch den Gesamtplan beziehungsweise [ADR-001](001-convex-domain-r2-media.md) ersetzt. D04 ersetzt dessen frühere Beta-Zuordnung der Intelligence. Es gibt genau ein Dispatch-MVP: R2 gemäß Release-Vertrag.

## 2. Zuständigkeit und Autorität

**Übernommen:** Convex hält den maßgeblichen Business-Zustand. Workflows steuern Zeitplanung, Wiederaufnahme und externe Effekte. Provider-Adapter kapseln Suche, Modelle, Publishing und weitere Integrationen. R2 hält Medienbytes; Metadaten, Rechte und Referenzen bleiben in Convex.

| Beteiligter | Erlaubte Verantwortung | Grenze |
|---|---|---|
| Mensch mit Domain-Berechtigung | Konkrete Version für konkreten Account freigeben, widerrufen, Termine annehmen oder ändern | Jede Operation prüft Workspace, Account und aktuelle Rechte |
| Content Agent / generatives LLM | Kontext lesen, recherchieren lassen, Ideen/Versionen erzeugen, Überarbeitung und Pläne vorschlagen, Ergebnisse erklären | Keine menschliche Freigabe erzeugen, keine allgemeinen Datenbank-Schreibwerkzeuge |
| Research Agent | Begrenzten versionierten Auftrag über freigegebene Suchadapter ausführen, Evidenz und Perspektiven liefern | Keine freigegebenen Versionen oder Termine ändern; ohne Aktivierung/Auftrag inaktiv |
| Jev hinter internem Adapter | Semantische Assessments für Analyzer; spätere separat aktivierte Klassifikation/Verifikation | Keine Orchestrierung, Freigabe, Terminentscheidung, Authentifizierung oder Abrechnung |
| Convex-Domain und Workflow | Rechte, deterministische Regeln, Scoreberechnung, Persistenz, Claims, Budgets und Wiederaufnahme | Modelloutput ist Eingabe zur Validierung, keine Autorität |
| Publishing-Adapter | Autorisierte konkrete externe Schreiboperation ausführen und Ergebnis zurückgeben | Keine autonome Auswahl von Inhalt, Account oder Veröffentlichungszeit |

**Bestätigte Regionsvorgabe:** Vor echten Kundendaten muss der zulässige EU-Datenpfad für Modell-, Such-, Embedding-, Gateway-, Logging-, Cache-, Speicher- und Unterauftragnehmerverarbeitung nachgewiesen sein. Jev wird davon nicht ausgenommen. Synthetische Funktionstests, ein regionaler Modellname oder ein R2-Location-Hint genügen nicht. Keine automatische Ausweichroute in andere Regionen. D03 bleibt auf Nutzerwunsch vertagt; die Dokumentation entscheidet keinen Provider. Maßgeblich bleibt der [TASK-1-Nachweisstand](provider-capabilities.md).

Inferenz, Speicherung, Embeddings, Statistik und Training sind getrennte Zwecke. Eine Erlaubnis für einen Zweck gilt nicht automatisch für andere. Quellen und Modellantworten sind untrusted input und ändern niemals Rechte oder Workspace-Grenzen.

## 3. Workspace, Account und Verknüpfung

**Übernommen:** Der Server löst die authentifizierte Identität in einen Domain-User und dessen Workspace-Mitgliedschaft auf. Jede referenzierte Entität muss zum berechtigten Workspace gehören. Vom Client oder Agenten übergebene IDs allein beweisen keine Berechtigung. Account-Capabilities werden pro Funktion geprüft; verbunden bedeutet beispielsweise nicht automatisch recherchierbar, medienfähig oder für bestimmte Metriken berechtigt.

**Präzisierung zur Abnahme:** Eine Wiederverbindung aktualisiert Zugang und nachgewiesene Capabilities desselben eindeutig identifizierten Provider-Accounts. Sie darf keine gespeicherten Inhaltsfreigaben auf einen anderen Provider-Account umhängen. Ein Accountwechsel ist eine neue Zielauswahl mit eigener Freigabe. Disconnect sperrt neue betroffene Aufrufe und Jobs; bereits abgesendete Requests werden abgeglichen. Wiederverbindung allein löst keine pauschale Wiederholung unklarer Veröffentlichungen aus.

**Implementierungsentscheidung D06, 2026-10-05, TASK-10/P03.01:** Innerhalb der vom Nutzer übertragenen Entscheidungsfreiheit gilt ein aktiver Publishing-Workspace je Provider-Identität. Eine neue Bindung in einem anderen Workspace verlangt zunächst einen autorisierten Disconnect in der bisherigen Verwaltung und danach einen expliziten frischen OAuth-Vorgang. Ein Konflikt bewirkt keine Übernahme und legt keine fremden Workspace-Daten offen. Inhaltsversionen, Freigaben, Historie und Planungen werden nicht übertragen; Wiederverbindung im alten Workspace darf eine neue aktive Bindung nicht überschreiben. Geteilte Verwaltung und automatische Cross-Tenant-Verknüpfung sind nicht gewählt. Die technische Umsetzung folgt in TASK-10; dies ist noch kein Live-Zugangsnachweis.

**Implementierungsentscheidung D05, 2026-10-05, TASK-14/P04.01:** Private Repositories sind ausschließlich nach ausdrücklicher Auswahl durch Owner/Admin im jeweiligen Workspace nutzbar. Repository-Zugriff, Monitoring und redaktionelle Content-Erzeugung bleiben getrennte Berechtigungen. Private Änderungen erlauben zunächst nur begrenzte, nachvollziehbare Ereignismetadaten und ausdrücklich als kommunizierbar markierten Projektkontext; GitHub-Login erteilt keine dieser Berechtigungen. Datei-/Diff-Kontext und Modellweitergabe benötigen eine gesonderte zweckgebundene Zustimmung pro Repository und den nachgewiesenen zulässigen Verarbeitungsweg. Secrets, vollständige Repository-Kopien und nicht freigegebene private Details werden nicht übernommen. Auswahl oder Zugangsentzug sperrt neue Aufträge; bereits abgeleitete Inhalte benötigen die spätere Quellen-/Löschkontrolle. Diese Entscheidung nutzt die übertragene Gestaltungsfreiheit, aktiviert jedoch weder private Quellen noch einen Modellpfad und ersetzt keine Live-/EU-Nachweise.

**Präzisierung D05 für TASK-16, 2026-10-05:** Eine aktuelle berechtigte Person kann ein einzelnes historisches, signiert empfangenes Signal ausdrücklich für eine neue begrenzte Kontextprüfung auswählen. Dafür werden die unveränderliche Repository-Identität, Installation, Name und Sichtbarkeit gegen die aktuell ausgewählte Quelle und ihre geltenden Zwecke geprüft. Der neue Auftrag hält den konkreten historischen Signalbezug, die aktuelle Quellengeneration, Zustimmung und tatsächliche Person fest. Ursprüngliche Ereignisgeneration, Admission-Reihenfolge, Fakten und Recovery-Herkunft bleiben unverändert; es entsteht keine rückwirkende Freigabe aller alten Ereignisse. Geladener und gefilterter Kontext benötigt vor Modellweitergabe eine ausdrückliche Freigabe der konkreten begrenzten Inhalte mit Hash und aktuellem Quellenbezug. Widerruf sperrt weitere Reads, Modellaufrufe und neue abgeleitete Inhalte; sichere nachlaufende Usage bleibt abgleichbar.

Der erste Datei-/Diff-Aufrufer verwendet die tatsächlichen unveränderlichen Before-/After-SHAs eines nicht gelöschten Push-Signals und ausdrücklich ausgewählte begrenzte Pfade. Ein Release-Tag ist kein vom Ereignis nachgewiesener Commit-SHA. Release-Fakten oder kommunizierbare Angaben dürfen nur als entsprechend begrenzter Kontext dienen; fehlt die Grundlage, bleibt die Kontextlücke sichtbar. Diese Festlegung ist eine delegierte Implementierungsentscheidung und aktiviert weder private GitHub-Verarbeitung noch einen Modellprovider.

| Beispiel | Erwartetes Verhalten |
|---|---|
| Nutzer gehört Workspace A an und übergibt Asset oder Account aus B | Operation verweigern; keine fremden Inhalte oder Secrets offenlegen |
| Account A ist verbunden, sein Zugang erlaubt aber die angefragte Suche nicht | Fähigkeit als nicht verfügbar/offen anzeigen; keine Rechercheberechtigung erfinden |
| Version 7 ist für Account A freigegeben; Ziel soll B werden | Neue Freigabe für B erforderlich, auch innerhalb desselben Workspace |
| Reconnect liefert eine andere Provider-Identität | Nicht als bloße Token-Erneuerung behandeln; Accountbindung und Freigabe neu prüfen |

## 4. Entwurfsversion, Freigabe und geplanter Inhalt

**Übernommen:** Eine erstellte Entwurfsversion ist unveränderlich. Sie umfasst Text, Thread-Reihenfolge, Medienreferenzen und veröffentlichungsrelevante Metadaten wie Alt-Text. Die referenzierten Medienbytes sind ebenfalls unveränderlich. Freigabe gilt exakt für `(workspaceId, draftVersionId, socialAccountId)` und erfasst freigebende Person, Zeitpunkt und gegebenenfalls Widerruf. Nur `ready`-Assets dürfen freigegeben werden.

Arbeitsversion, Freigabe, Termin und externe Veröffentlichung sind getrennte Sachverhalte. Ein globales `draft.status = approved` ersetzt keinen Freigabenachweis. Analyse, Score, Quellenannahme, Planansicht und eine unbestimmte Zustimmung im Chat sind keine Freigabe. Planannahme darf eine Freigabe nicht verdeckt erzeugen. Eine kombinierte UI-Aktion müsste beide ausdrücklichen Entscheidungen und den konkreten Versions-/Accountbezug sichtbar machen.

| Operation / fachlicher Übergang | Voraussetzungen und Ergebnis | Status |
|---|---|---|
| Arbeitsinhalt → neue Version | Neue unveränderliche Version; ältere Versionen und Termine bleiben unverändert | Übernommen |
| Keine gültige Freigabe → gültige Freigabe | Autorisierte Person bestätigt konkrete Version/Account; Referenzen und Medien gültig | Übernommen |
| Gültige Freigabe → widerrufene Freigabe | Widerruf dokumentieren; neuer Publishing-Start darf sie nicht verwenden | Übernommen / Präzisierung |
| Neue Version nach Freigabe | Keine Freigabe vererben; bestehende Freigabe gilt weiterhin nur ihrer alten Version | Übernommen |
| Geplante alte Version → geplante neue Version | Ausdrücklicher Austausch, neue gültige Freigabe, erneute Terminprüfung und neue Ausführungsgeneration | Präzisierung zur Abnahme, D07 |

**Beispiel D07:** Version 7 ist freigegeben und für Dienstag geplant. Der Nutzer erzeugt Version 8. Anzeige: „Neue Arbeitsversion vorhanden; geplant bleibt Version 7.“ Erst Freigabe von Version 8 und ausdrücklicher Austausch ersetzen den Termininhalt. Ändern von Alt-Text oder Thread-Reihenfolge folgt derselben Regel.

**Präzisierung zur Abnahme:** Freigabewiderruf und Publishing-Start müssen über atomare Domain-Entscheidungen geordnet werden. Vor weiteren Thread-Schreibschritten werden Sperren und erforderliche Freigabe erneut geprüft. Ein bereits abgesendeter externer Aufruf lässt sich nicht zurückholen; sein Ergebnis bleibt abzugleichen und sichtbar. Widerruf darf daher keine Zusage erzeugen, bereits gesendete Inhalte seien verhindert oder gelöscht.

## 5. Termine, Zeitzonen und Kalenderpläne

**Übernommen:** Der Kalender referenziert konkrete freigegebene Versionen. Planung berücksichtigt lokale Zeitzone, Nutzerzeitfenster, Zielaccounts, vorhandene Termine, Quellenmix, Freigabestatus, Medienbereitschaft und Recherchefrische. Termine dürfen nicht still überschrieben werden. Rescheduling erhöht die Ausführungsgeneration; ein alter Scheduler-Aufruf ist danach wirkungslos. Bloßes Verschieben innerhalb erlaubter Zeiträume verändert den Inhalt nicht; Recherchegültigkeit wird trotzdem neu geprüft.

### 5.1 Zeitmodell als ausdrücklicher Vorschlag

**Offen – vor TASK-11/P03.02:** Der Gesamtplan fordert Zeitzonen, entscheidet aber noch nicht die DST-/Reisestrategie. Vorschlag zur Entscheidung durch Matthias: Zeitpunkt als eindeutigen UTC-Instant speichern, zusätzlich IANA-Zone und gewählte lokale Eingabe nachvollziehbar halten; bei mehrdeutiger Uhrzeit die konkrete Instanz ausdrücklich wählen lassen, bei nicht existenter Uhrzeit eine gültige Alternative verlangen. Ein Wechsel der Profilzeitzone würde bestehende Instants nicht automatisch verschieben; eine ausdrückliche Neuplanung würde die Generation erhöhen. Dies ist noch keine beschlossene Produktregel. Wiederkehrende lokale Zeitfenster werden getrennt von bereits angenommenen Einzelterminen festgelegt.

| Prüffall | Sicherer Vertragskern | Noch zu entscheidendes Verhalten |
|---|---|---|
| Berlin, 19.09.2026 09:00 | Eindeutigen Zeitpunkt und verwendete Zone nachvollziehbar anzeigen; entspricht an diesem Datum 07:00 UTC | Darstellung beim späteren Profilzeitzonenwechsel |
| Berlin, 29.03.2026 02:30 | Uhrzeit existiert wegen Sommerzeitwechsel nicht; kein unsichtbares anderes Versandversprechen | Vorschlag: gültige neue Uhrzeit verlangen |
| Berlin, 25.10.2026 02:30 | Zwei mögliche Instants: 00:30 oder 01:30 UTC; Auswahl muss eindeutig sein | Vorschlag: beide mit UTC-Offset anbieten |
| Reise von Berlin nach New York nach Terminannahme | Kein stiller Austausch von Inhalt oder Account | Bestehenden Instant beibehalten versus bewusst lokale Uhrzeit neu planen |

### 5.2 Plan und Planelemente

**Übernommen:** Ein Plan hat `proposed`, `partially_accepted`, `accepted`, `rejected` oder `expired`. Jedes Element hat einen eigenen Status. Annahme prüft Account, konkrete Version/Freigabe, Slot und Aktualität erneut. Doppelte oder parallele Annahmen erzeugen höchstens einen Termin je angenommenem Planelement.

**Präzisierung zur Abnahme:** Die folgenden Element- und Aggregationsregeln konkretisieren diese Zustandsliste. Ein angenommener Plan ist keine zweite Quelle der Terminausführung; erzeugte Termine haben ihren eigenen Lifecycle.

| Ausgang | Aktion | Folgezustand / Wirkung |
|---|---|---|
| Element `proposed` | Mit gültiger Freigabe, Slot und Frische annehmen | `accepted`; atomare Zuordnung genau eines Termins |
| Element `proposed` | Ablehnen / Gültigkeit läuft ab | `rejected` / `expired`; kein Termin |
| Element `accepted` | Dieselbe Annahme wiederholen | Unverändert; vorhandenen Termin zurückgeben |
| Plan ohne angenommene Elemente | Vorschläge liegen vor | `proposed` |
| Plan mit mindestens einem, aber nicht allen angenommenen Elementen | Teilmenge annehmen; übrige offen, abgelehnt oder abgelaufen | `partially_accepted` |
| Plan mit allen Elementen angenommen | Letztes Element annehmen | `accepted` |
| Plan ohne Annahme | Gesamten Plan ausdrücklich ablehnen / Angebotsgültigkeit endet | `rejected` / `expired`; keine Termine |
| Abgelehnter/abgelaufener Vorschlag | Erneut planen lassen | Neuer Vorschlag mit erneuter Prüfung; kein stilles Wiederaufleben |

**Beispiel:** Drei vorgeschlagene Beiträge, zwei ausdrücklich freigegeben und angenommen → genau zwei Termine, Plan `partially_accepted`. Zwei gleichzeitige Klicks auf denselben Vorschlag erzeugen einen Termin. Sind nur zwei gute Themen vorhanden, werden keine drei irrelevanten Posts ergänzt, um eine angefragte Fünferwoche zu füllen.

**Offen:** Was einen Slotkonflikt ausmacht (identischer Instant, Mindestabstand, Accountfrequenz), muss für TASK-24/25 festgelegt werden. Neue Annahmefehler überschreiben keine bereits akzeptierten Elemente. Ein abgelaufener Planvorschlag storniert keine schon erzeugten Termine.

## 6. Publishing, Teilerfolg und Fehlerwiederaufnahme

**Übernommen:** Zustände sind `scheduled`, `publishing`, `partially_published`, `published`, `failed`, `reconciliation_required`, `cancelled`. Statusänderungen erfolgen ausschließlich durch Domain-Operationen. Ein Job beansprucht atomar eine gültige Ausführungsgeneration. Pro Thread-Position bleiben Operation-ID, Versuche, externe ID und Fortschritt dauerhaft zugeordnet. Vor dem externen Aufruf wird dessen Versuch erfasst; nach bestätigtem Erfolg die externe ID, bevor der nächste Beitrag startet.

**Präzisierung zur Abnahme:** Nachstehende Transitionen trennen gesicherten Fehler von unbekanntem Ergebnis. Ausführung einer nächsten Position bleibt zusätzlich an aktuelle Rechte, Freigabe, Medien, Lifecycle und Policy gebunden.

| Ausgang | Ereignis / Voraussetzung | Folgezustand und Wirkung |
|---|---|---|
| `scheduled` | Aktuelle Generation atomar beansprucht; Startprüfungen gültig | `publishing` |
| `scheduled` | Autorisiert verschieben / stornieren | `scheduled` mit höherer Generation / `cancelled` mit entwerteter Generation |
| `scheduled` | Startprüfung schlägt fehl | `failed` mit konkretem Grund; keine externe Schreiboperation |
| `publishing` | Alle Elemente bestätigt erfolgreich | `published`; externe IDs vollständig gespeichert |
| `publishing` | Gesicherter Fehler, kein Element veröffentlicht, kein offener Versuch | `failed` |
| `publishing` | Gesicherter Fehler/Stop nach mindestens einem Erfolg, weitere Elemente offen | `partially_published`; bestätigte IDs und ausstehende Positionen sichtbar |
| `publishing` | Timeout/Abbruch nach möglicherweise wirksamem Aufruf oder offener Versuch nach Prozessverlust | `reconciliation_required`; keine unkontrollierte weitere Schreiboperation |
| `reconciliation_required` | Ausgang bleibt mehrdeutig | Unverändert pausieren; konkrete Wiederherstellungsoptionen anbieten |
| `reconciliation_required` | Alle Positionen als erfolgreich abgeglichen | `published` |
| `reconciliation_required` | Alle offenen Versuche geklärt, verbleibende Positionen sicher ungesendet | `partially_published` bei bekanntem Teilerfolg, sonst `failed`; Ergebnisse sichern |
| `failed` / `partially_published` | Autorisierte Wiederaufnahme, kein unklarer Versuch, erneute Prüfungen gültig | `scheduled` mit neuer Generation; bekannte Erfolge behalten, nur ausstehende Positionen ausführen |
| `publishing` | Abbruchsignal | Keine neuen Schritte; laufende Versuche erst abgleichen; danach `cancelled`, `partially_published` oder bei Unklarheit `reconciliation_required` |
| `partially_published` | Nutzer beendet weitere Ausführung | `cancelled` mit erhaltenem Teilerfolg; veröffentlichte Inhalte bleiben sichtbar |
| `failed` | Nutzer storniert endgültig | `cancelled`; keine weiteren automatischen Versuche |

Ein Abbruchwunsch während `reconciliation_required` wird gespeichert, beseitigt aber nicht die ungeklärten Effekte. Nach Abgleich verhindert er die Fortsetzung; bestätigte Erfolge bleiben erhalten. `published` oder `cancelled` wird nicht durch einen alten Scheduler-Aufruf reaktiviert. Externes Löschen ist eine eigene ausdrücklich bestätigte Aktion und kein Rollback des Publishing-Zustands.

**Beispiel Thread:** Position 1 erfolgreich; Position 2 könnte veröffentlicht sein, aber die Antwort fehlt. Position 3 startet nicht. Der Lauf benötigt Abgleich von Position 2. Findet der Abgleich den bestätigten Post, wird dessen ID gespeichert; nur Position 3 bleibt offen. Ist der Ausgang nicht eindeutig auflösbar, bleibt die Veröffentlichung pausiert. Eine fehlende lokale ID beweist niemals, dass Position 2 nicht veröffentlicht wurde.

**Beispiel Generation:** Termin mit Generation 4 wird auf Mittwoch verschoben und erhält Generation 5. Der alte Dienstagsjob darf weder Generation 4 beanspruchen noch einen Post senden. Konkurrierende Claims für Generation 5 ergeben genau einen aktiven Claim. Das ist keine absolute Exactly-once-Garantie für fremde APIs.

## 7. Research-Vertrag und Frische

**Übernommen:** Ein Auftrag fixiert Account, Profilversion, Anlass, Such-/Ereigniszeitfenster, Sprachen, Quellenarten, Themen, Ausschlüsse, Umfang, Frist und Budget. Profiländerungen gelten für neue Läufe. Gesperrte Workspaces und entzogene Zugänge verhindern weitere Aufrufe auch bei alten Profilversionen.

**Implementierungsentscheidung D02, 2026-10-05, TASK-20:** Neue reale Research-Profile beginnen ohne aktivierten Zeitplan und ohne automatisch erteiltes kostenpflichtiges Budget. Manuelle, geplante und spätere Content-Agent-Aufträge verwenden denselben begrenzten Auftrag mit unveränderlicher Profilversion. Ein täglicher oder anderer periodischer Lauf verlangt eine ausdrückliche aktuelle Aktivierung und erfüllt dieselben Verarbeitungs-, Preis- und Budgetprüfungen wie ein manueller Lauf. Der Nutzer setzt ein endliches Auftragslimit in der tatsächlich freigegebenen Abrechnungswährung; das ersetzt weder Provider-, Workspace- noch Accountdeckung. Es gibt keine stillschweigende EUR-Umrechnung, keine aus Demo-Werten übernommene Quote und keinen als gemessen ausgegebenen Startbetrag. Pro Profil läuft höchstens ein aktiver Auftrag; doppelte Zustellung derselben geplanten Ausführung erzeugt keinen weiteren Auftrag. Diese delegierte Anfangsregel erlaubt die Implementierung, aktiviert aber keinen Provider und behauptet kein gemessenes Betriebsbudget.

Evidenz speichert Quellenkennung/kanonische URL, Veröffentlichungs- und Beobachtungszeit sowie ein gegebenenfalls abweichendes Ereignisdatum. Ergebnis enthält Thema, Zusammenfassung, eigene Interpretation, Quellen, Relevanz, Neuigkeit, Unsicherheit, Verfallszeit und mögliche Perspektiven. Große Rohantworten und vollständige fremde Webseiten werden nicht unbegrenzt in Domain-Dokumenten archiviert. Quellenlöschung und Sperrung müssen auch Ableitungen berücksichtigen; der konkrete zulässige Quellenbetrieb bleibt TASK-1-Gate.

### 7.1 Laufzustände

**Präzisierung zur Abnahme:** Die Zustände stammen aus §5.5; Vorrangregeln bei Budgetende/Abbruch und Teilergebnissen werden hier vorgeschlagen. Teilergebnisse und Endgrund bleiben getrennte gespeicherte Angaben, damit ein Status keine bereits geleistete Arbeit verdeckt.

| Ausgang | Ereignis | Ergebnis |
|---|---|---|
| `queued` | Berechtigter begrenzter Auftrag beginnt | `running` |
| `queued` | Abbruch / kein Budget für Start | `cancelled` / `budget_exhausted` |
| `running` | Auftrag fachlich vollständig bearbeitet | `completed`, auch bei null passenden Themen |
| `running` | Nutzbare Ergebnisse, aber technischer Teil des Auftrags nicht vollständig | `partial` mit verbleibenden Lücken |
| `running` | Technischer Fehler ohne nutzbares Ergebnis | `failed` |
| `running` | Weitere nötige Schritte nicht finanzierbar | `budget_exhausted`; vorhandene Ergebnisse erhalten, keine neue kostenpflichtige Anfrage |
| `running` | Nutzer stoppt | `cancelled`; vorhandene Ergebnisse und nachlaufende Kosten abgleichen |
| Endzustand | Erneute Recherche erforderlich | Neuen begrenzten Auftrag verknüpfen; keinen ganzen Lauf blind wiederholen |

Wiederaufnahme eines unterbrochenen technischen Schritts innerhalb eines noch laufenden Auftrags hält Auftrags-, Nachrichten- und Domain-Referenzen stabil. Sie ist keine Neuausführung sämtlicher bereits erfolgreicher Schritte.

Research-Item-Verarbeitungsstatus und redaktionelle Behandlung bleiben unabhängig. Archivieren eines Ergebnisses macht einen erfolgreichen Lauf nicht zu `failed`. Zwei syndizierte Kopien sind keine zwei unabhängigen Quellen. Hohe Gesamtreaktionen ohne zeitliche Vergleichsdaten erlauben „aktuell diskutiert“, nicht „steigender Trend“.

### 7.2 Aktualität und Beispiele

**Übernommen:** Mindestens eine belastbare Quelle; bei umstrittenen oder folgenreichen Aussagen unabhängige Bestätigung suchen und verbleibende Unsicherheit sichtbar halten. Frischekritische Themen werden vor Versand erneut geprüft oder in redaktionellen Review zurückgestellt. Freigabe allein überstimmt keine abgelaufene Recherchegültigkeit.

**Implementierungsentscheidung D08, 2026-10-05, TASK-22.1/24/25:** Ergebnisse unterscheiden zeitkritische, kontextabhängige und zeitunabhängige Aussagen sowie unbekannte Frische. Veröffentlichungs-, Ereignis- und Beobachtungszeit bleiben getrennt; erneutes Abrufen verschiebt kein altes Ereignisdatum. Eine begründete endliche Gültigkeit benötigt den tatsächlichen Quellenbezug und die versionierte, für diesen Zweck geltende Frischeregel; ein Modellvorschlag allein aktiviert oder verlängert sie nicht. Fehlt diese Grundlage, bleibt das Ergebnis prüfbedürftig und ist kein automatischer Versandnachweis. Es gilt keine universelle 24-/48-Stunden-Frist und keine aus dem Suchzeitfenster abgeleitete Restgültigkeit.

Zeitkritische oder inzwischen abgelaufene Aussagen benötigen vor Versand eine erneute begrenzte Prüfung der konkreten Evidenz. Entfernte, gesperrte, unerreichbare oder nicht überprüfbare Quellen liefern keine erfolgreiche Erneuerung; die Lücke bleibt sichtbar und betroffene Inhalte gehen in Review. Eine bestätigte unveränderte Aussage erhält einen eigenen nachvollziehbaren Prüfnachweis mit Quellenstand, tatsächlicher Person oder zulässigem Prüfpfad und neuer begründeter Gültigkeit. Eine geänderte Aussage erzeugt eine neue Ergebnis-/Inhaltsversion und neue menschliche Freigabe. Weder Terminverschiebung noch wiederhergestellte Daten, Quellenkopien oder alte Freigaben erneuern die Frische. Die Anfangsregel nutzt die delegierte Entscheidung; konkrete gemessene Klassengrenzen und zulässige Providerprüfung bleiben Aktivierungsnachweise.

| Beispiel | Erwartetes Verhalten |
|---|---|
| Profil v3 läuft, Nutzer speichert v4 | Lauf hält v3; neue Läufe verwenden v4. Nutzer kann v3 abbrechen |
| Kein relevantes Thema gefunden, Suche korrekt abgeschlossen | `completed` mit null Themen, kein technischer Fehler |
| Websuche erfolgreich, X-Suche technisch fehlgeschlagen | `partial`, sofern verwertbare Ergebnisse vorliegen; Lücke sichtbar |
| Budget endet nach zwei brauchbaren Themen | Vorgeschlagene Vorrangregel: `budget_exhausted`, zwei Ergebnisse bleiben erhalten |
| Quelle hat beispielhaft `expiresAt` Dienstag 12:00; Versand auf Mittwoch verschoben | Neue Frischeprüfung/Review erforderlich; diese Beispielzeit legt keine allgemeine TTL fest |
| Frischeprüfung korrigiert eine Tatsachenbehauptung im Post | Neue Inhaltsversion und neue Freigabe; bestehenden freigegebenen Text nicht verändern |
| Frischeprüfung bestätigt unveränderte Aussage | Eigenen Prüfnachweis und begründete endliche Gültigkeit am tatsächlichen Quellenstand speichern; alten Nachweis nicht überschreiben |

## 8. Medien-Lifecycle

**Bestätigte Architektur D17; übernommene Invarianten aus ADR-001:** `mediaAssets` sind Workspace-Entitäten in Convex. Temporäre Browser-Uploads und endgültige Objekte sind getrennt. Der kontrollierte Abschluss validiert tatsächlich gespeicherte finale Bytes, MIME-Typ, Größe, Dimensionen und Inhaltsprüfsumme; ETag ist nicht ungeprüft eine Inhaltsprüfsumme. Signierte URLs sind kurzlebige Transportmittel, keine dauerhaften Draft-Referenzen und keine allgemeinen Logdaten.

| Ausgang | Ereignis / Prüfung | Folgezustand |
|---|---|---|
| `uploading` | Autorisierte Uploadsession wird abgeschlossen | `validating` |
| `validating` | Neues finales Objekt erstellt und endgültige Bytes erfolgreich geprüft | `ready` |
| `uploading` / `validating` | Upload oder Prüfung endgültig fehlgeschlagen | `failed`; kontrollierte Bereinigung |
| `ready` | Inhalt ändern | Neues Asset/neue Version, kein Überschreiben des bestehenden Objekts |
| `uploading` / `validating` / `ready` / `failed` | Autorisierte Löschung unter Beachtung bestehender Referenzen | `deleting`; neue Referenzen und Publishing-Claims gesperrt |
| `deleting` | Bekannte Objekte entfernt; nötige Nachbereinigung nach Uploadberechtigungsablauf erfolgt | `deleted`; erforderlicher Lösch-/Abgleichnachweis bleibt gemäß Lifecycle-Policy |

Die Tabelle ist eine **Präzisierung zur Abnahme**; Architektur und Sicherheitsinvarianten stammen aus ADR-001. R2 und Convex besitzen keine gemeinsame Transaktion. Schritte müssen idempotent wiederholbar sein; paralleler Abschluss erzeugt nicht mehrere sichtbare Assets. Workspace-Löschung sperrt außerdem Finalisierungen. Ein noch gültiger temporärer Upload-Link darf weder finale Bytes verändern noch unbegrenzt verwaiste Objekte hinterlassen. Referenzierte Assets werden bei normaler Löschung nicht still aus geplanten Inhalten entfernt.

## 9. Intelligence und bewusste Übernahme

**Bestätigt D04:** Analyzer, Dispatch Score und J07 gehören zu R2. Analyse bleibt pro Post freiwillig; ihre zeitweilige Nichtverfügbarkeit blockiert einen sonst gültigen menschlich freigegebenen Post nicht. Sie ersetzt aber keinen R2-Abnahmenachweis: Ein nicht freigegebener Jev-Datenpfad erlaubt weder Kundendatenaufrufe noch die stillschweigende Abnahme eines reduzierten MVP.

**Übernommen / präzisiert zur Abnahme:** Analyse ist an konkrete Draft-Version, Account, Algorithmusprofil, verfügbares Audience-Profil, Fragen-/Promptstand, Modell-/Providerstand und Scoreformelversion gebunden. Ergebnisse nennen Zeitpunkt, Datenbasis, Unsicherheit und Kostenstatus. Cache und Analysen bleiben Workspace-isoliert. Fehlende Audience-Daten oder Metriken sind keine erfundenen neutralen Messwerte und keine Null.

Es gibt **einen Dispatch Score von 0–100**, eine erklärbare Heuristik, keine Reichweiten- oder Viralitätsgarantie. Die sieben ursprünglichen Dimensionen sind Audience Fit, Share Potential, Conversation Potential, Follow Potential, Dwell Potential, Discovery Potential und Content Health. Der [Jev-Leitfaden](../JEV_INTEGRATION.md) zeigt dagegen eine andere beispielhafte Gewichtung aus Hook, Clarity, Discussion, Originality, CTA, Structure und Historical Fit. Das sind nicht zwei parallel einzuführende Produkt-Scores.

**Offen – TASK-27:** Mapping der sieben Dimensionen auf tatsächlich ermittelte Signale, fehlende Daten, Normalisierung, eine konkrete versionierte Formel und deren Darstellung müssen vor Implementierung des Scores entschieden und geprüft werden. TASK-2 genehmigt weder die historischen Prozentwerte noch einen pauschalen Ersatzwert für fehlenden Historical/Audience Fit. Gleichnamige Scores mit unterschiedlichen Formeln dürfen nicht unkommentiert verglichen werden; Versionsvergleiche benötigen identische Analysebedingungen oder sichtbare Einschränkungen.

| Aktion | Wirkung auf Inhalt und Autorität |
|---|---|
| Version 7 analysieren | Assessment zu Version 7; Text, Freigabe und Termin unverändert |
| Empfehlung anzeigen | Höchstens drei priorisierte Vorschläge, nachvollziehbare Begründung; keine automatische Änderung |
| Empfehlung bewusst übernehmen | Sichtbarer Diff und neue Version 8; keine geerbte Freigabe, kein stiller Austausch des geplanten Inhalts |
| Analyzer nicht verfügbar | Sichtbarer Nichtverfügbarkeitszustand; kein erfundener Score oder anderer ungeprüfter Provider |
| Spätere Verifikation/Routing aktivieren | Eigene R5-Policy und Nachweise; niemals menschliche Freigabe oder Domain-Rechte ersetzen |

## 10. Budget, Abbruch und Wiederholung

**Übernommen:** Jeder Run besitzt ID, Tenant-Kontext, Prompt-/Modellversion, Budget, Tool-Schrittgrenze, Timeout und Abbruchsignal. Agentenübergabe ist ein gespeicherter Auftrag, keine unbegrenzte gegenseitige Unterhaltung. Globale Provider-Limits, Workspace-Kontingente und Account-Limits bleiben getrennt; Research verbraucht keine reservierte Publishing-Kapazität.

| Fall | Vertrag |
|---|---|
| Neuer kostenpflichtiger Versuch | Vor Aufruf Budget reservieren und Versuch eindeutig erfassen |
| Zweimal zugestellte Verbrauchsmeldung zu Versuch A | Genau eine Verbrauchsbuchung; bestehende Buchung nicht verdoppeln |
| Tatsächlicher erneuter Provideraufruf B | Eigener Versuch, neue Budgetdeckung; kann erneut Kosten verursachen |
| Antwort ohne belastbare Usage | Kostenstatus als offen halten und abgleichen; nicht ungeprüft kostenlos buchen |
| SDK-Retry plus Workflow-Retry | Eine gemeinsame Versuch-/Kostenobergrenze; keine multiplizierten unsichtbaren Retry-Schleifen |
| Nutzer stoppt Run oder Workspace wird gesperrt | Dauerhaft sperren; vor jedem weiteren Tool-/Provider-Schritt erneut prüfen |
| Bereits laufender Request nach Stop liefert Ergebnis | Ergebnis und Kosten abgleichen; keine neue Agentenschleife daraus starten |

Konkrete Kostenlimits, Retry-Anzahl und Timeoutwerte werden beim betroffenen Paket aus Messungen festgelegt. Sie sind hier keine erfundenen Providerkonstanten. Diagnosefristen von sieben/30 Tagen im Gesamtplan bleiben Beispiele; verbindliche Retention und Betriebsziele gehören zu D15.

## 11. Prüf- und Entscheidungstore

Die Tabellen und Beispiele sind prüfbare Sollverträge, keine ausgeführten Tests. Die Umsetzung braucht insbesondere konkurrierende Claims/Annahmen, Versions- und Accountwechsel, Widerruf während eines Runs, offene Provider-Versuche, Teilthreads, abgelaufene Recherche und unveränderliche Medien als Abnahmefälle.

| Offen / zu bestätigen | Verantwortlicher und Tor |
|---|---|
| TASK-2-Fachvertrag einschließlich hier präzisierter Transitionen und D07 | Matthias; manuelle TASK-2-Abnahme, anschließend Umsetzung in zuständigen Tasks |
| D06 Account über mehrere Workspaces, Übernahme/Wechsel | Unter übertragener Entscheidungsfreiheit 2026-10-05 gewählt: ein aktiver Workspace, autorisierter Disconnect vor frischem OAuth; technische Umsetzung TASK-10 |
| Zeitzonen-/DST-/Reisestrategie | Matthias; TASK-11 vor P03.02 |
| Slotkonflikte, Gültigkeitsklassen und Nachprüfung D08 | Matthias; TASK-22.1/24/25 vor betroffenen P06.03-/P07-Funktionen |
| D02 Research-Frequenz und Startbudget | Delegierte Anfangsregel: manuell, Zeitplan inaktiv, kein erteiltes Budget; tatsächliche Verarbeitungs-/Preisfreigabe und explizite endliche Limits vor TASK-20-Aktivierung |
| EU-Datenpfade, tatsächliche Capabilities und getrennte Verarbeitungszwecke | Matthias mit erforderlicher Beratung; TASK-1 und jeweiliger Integrations-Task vor Kundendaten/externen Effekten |
| Eine Scoreformel und Dimensionsmapping | Matthias; TASK-27 vor TASK-28, Analyzer-Aktivierungsnachweise vor R2-Abnahme |
| D15 konkrete Retention/Recovery/Betriebsziele | Matthias; sichere Anfangsregeln vor Datennutzung, verbindliche Betriebsziele vor GA |

Die vollständigen D01–D17 einschließlich späterer Portfolio- und Autonomieentscheidungen stehen im [Release-Vertrag](release-scope.md). TASK-2 wurde auf ausdrückliche Nutzeranweisung am 01.10.2026 auf Done gesetzt. Offene Provider-Nachweise und spätere Entscheidungstore werden durch Dokumentabnahme nicht erledigt.
