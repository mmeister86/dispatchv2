# Dispatch – Backlog-Roadmap

Stand: 1. Oktober 2026. Quellen: [End-to-End-Plan](dispatch-end-to-end-implementation-plan.md), insbesondere §§8–16, und [JEV-Integration](JEV_INTEGRATION.md).

**89 Tasks in zehn Release-Milestones und 17 Phasen, davon 87 offen:** 62 Plan-Arbeitspakete, 21 Unteraufgaben für sieben große Pakete, vier ergänzende Gate-/Entscheidungstasks und zwei JEV-Erweiterungen. Übergeordnete Pakete und Unteraufgaben werden in der Anzahl getrennt gezählt; daraus lässt sich kein Aufwand ableiten.

**TASK-1 und TASK-2 stehen auf ausdrückliche Nutzeranweisung vom 01.10.2026 auf Done, 87 Aufgaben auf To Do.** Offene Kriterien und Aktivierungstore aus TASK-1 bleiben sichtbar; der Statusabschluss erbringt keine fehlenden Provider- oder EU-Nachweise. Der frühere JEV-Abgleich aktualisierte 26 bestehende Aufgaben und ergänzte fünf neue. Offene Provider-, Produkt- und Datenschutzfreigaben bleiben erforderlich.

## Milestones

| Milestone | Phasen | Tasks inkl. Unteraufgaben |
|---|---|---:|
| [R0 – Tragfähige Grundlage](../backlog/milestones/m-0%20-%20r0-%E2%80%93-tragf%C3%A4hige-grundlage.md) | P00, P01 | 6 |
| [R1 – Interne Publishing-Alpha](../backlog/milestones/m-1%20-%20r1-%E2%80%93-interne-publishing-alpha.md) | P02, P03 | 10 |
| [R2 – Dispatch-MVP](../backlog/milestones/m-2%20-%20r2-%E2%80%93-dispatch-mvp.md) | P04, P05, P06, P07, P08.01–03, P09 | 23 |
| [R3 – Private Beta](../backlog/milestones/m-3%20-%20r3-%E2%80%93-private-beta.md) | P08.04, P09 | 14 |
| [R4 – Kommerzielles X-Produkt](../backlog/milestones/m-4%20-%20r4-%E2%80%93-kommerzielles-x-produkt.md) | P10 | 4 |
| [R5 – Lernendes Produkt](../backlog/milestones/m-5%20-%20r5-%E2%80%93-lernendes-produkt.md) | P11, P12, JEV-Erweiterungen | 13 |
| [R6 – Teamprodukt](../backlog/milestones/m-6%20-%20r6-%E2%80%93-teamprodukt.md) | P13 | 3 |
| [R7 – Kanalübergreifendes Produkt](../backlog/milestones/m-7%20-%20r7-%E2%80%93-kanal%C3%BCbergreifendes-produkt.md) | P14 | 7 |
| [R8 – Ausgebautes Endprodukt](../backlog/milestones/m-8%20-%20r8-%E2%80%93-ausgebautes-endprodukt.md) | P15 | 7 |
| [R9 – Optionale kontrollierte Autonomie](../backlog/milestones/m-9%20-%20r9-%E2%80%93-optionale-kontrollierte-autonomie.md) | P16 | 2 |

## Abhängigkeiten und Umfang

- **MVP-Basisbetrieb:** [TASK-63](../backlog/tasks/task-63%20-%20Sicheren-Basisbetrieb-vor-der-MVP-Abnahme-nachweisen.md) liefert die frühen P09-Pflichten vor [TASK-26](../backlog/tasks/task-26%20-%20Dispatch-MVP-anhand-realer-Redaktionsarbeit-abnehmen-P07.03.md). Die spätere P09-Konsolidierung bleibt in R3; es besteht kein Rückwärtszyklus über die Beta.
- **Abnahmen:** MVP in [TASK-26](../backlog/tasks/task-26%20-%20Dispatch-MVP-anhand-realer-Redaktionsarbeit-abnehmen-P07.03.md), Beta in [TASK-64](../backlog/tasks/task-64%20-%20Private-Beta-anhand-der-Nutzerabl%C3%A4ufe-und-Betriebs%C3%BCbungen-abnehmen.md), GA in [TASK-40](../backlog/tasks/task-40%20-%20GA-Gate-durchf%C3%BChren-P10.04.md), Endprodukt in [TASK-66](../backlog/tasks/task-66%20-%20Das-ausgew%C3%A4hlte-Endprodukt-%C3%BCber-alle-eingef%C3%BChrten-Module-abnehmen.md).
- **Portfolio:** [TASK-65](../backlog/tasks/task-65%20-%20Erweiterungsportfolio-f%C3%BCr-das-Endprodukt-verbindlich-ausw%C3%A4hlen.md) entscheidet, welche P15-Pakete tatsächlich umgesetzt werden. Dabei werden nur die ausgewählten Tasks als zusätzliche Voraussetzungen des Endprodukt-Gates eingetragen. Die Vorausplanung behauptet diese Auswahl noch nicht.
- **Optional:** P13.03, P14.04, P15.05 sowie ganz P16. Alle P15-Pakete tragen zusätzlich `portfolio-kandidat`. Nicht gewählte Optionen blockieren weder MVP/GA noch das Endprodukt-Gate.
- **Große Pakete:** P03.03, P06.03, P08.02, P09.03, P09.06, P11.03 und P14.02 haben jeweils drei echte Unteraufgaben. Ihr übergeordneter Task hält den vollständigen Vertrag und wartet auf deren integrierte Abnahme.
- **Parallelität:** Release-Nummern sind keine zusätzlichen pauschalen Sperren. P11-Datensammlung kann neben Billing laufen; reine Profilpflege P11.04 wartet nicht auf Kalibrierung. Team- und Kanalentwicklung können nach den konkreten Voraussetzungen parallel erfolgen.
- **Spätere Adapter:** P14.02 wählt genau einen Kanal; LinkedIn ist ein Kandidat. P14.04 und P15.02 verlangen vor Coding je ausgewähltem Provider eine konkretisierte Unteraufgabe. Nicht freigegebene Plattformen und Quellen sind keine zugesagten Integrationen.
- **Planungsdetails:** Technische Dateipfade, fachliche Schritte, ursprüngliche Abhängigkeitshinweise und offene Entscheidungen stehen in den Tasks. Prioritäten sind vorgeschlagene Ausführungsprioritäten; Termine und Verantwortliche wurden nicht erfunden.
- **JEV-Reihenfolge:** R2 enthält nach D04 vom 19.09.2026 bereits Post Analyzer + Dispatch Score in TASK-28.1–28.3 und der Composer-Darstellung in TASK-29. TASK-67 (Intent-Routing) und TASK-68 (Output-Verifikation) sind als nachgelagerte R5-Erweiterungen eingeordnet; die Release-Zuordnung steht im [TASK-2-Vertrag](decisions/release-scope.md). Sie blockieren weder R2 noch das Analyzer-MVP-Gate. Network Fit wird in TASK-54 für tatsächlich freigegebene Kanäle ergänzt. Jev steuert weder Publishing noch Orchestrierung.
- **JEV-Datenfreigabe:** Die bestehende EU-only-Vorgabe aus TASK-1 gilt auch für TypeSafe. DPA/SCC und Nicht-Training sind kein EU-Nachweis. Ohne dokumentierte Freigabe bleiben Kundendatenaufrufe deaktiviert; bereits ein MVP mit reduziertem Umfang benötigt eine ausdrückliche Entscheidung.
- **JEV-Qualität:** Assessments sind an Workspace, Account, exakte Inhaltsversion und Netzwerk gebunden. Cache-Schlüssel berücksichtigen alle genutzten Kontexte und Versionen. Publish-Snapshots bewahren den damaligen Analysezustand. Dispatch kalibriert eigene Gewichte/Policies; Jev wird nicht trainiert.

## Aufgaben nach Release und Phase

### R0 – Tragfähige Grundlage

#### P00 – Machbarkeit und Produktverträge

| Planreferenz | Task | Umfang |
|---|---|---|
| P00.01 | [TASK-1](../backlog/tasks/task-1%20-%20Provider-Zug%C3%A4nge-und-Kostenmodell-pr%C3%BCfen-P00.01.md) – Provider-Zugänge und Kostenmodell prüfen (P00.01) | Planpaket |
| P00.02 | [TASK-2](../backlog/tasks/task-2%20-%20Fachliche-Vertr%C3%A4ge-und-Release-Umfang-fixieren-P00.02.md) – Fachliche Verträge und Release-Umfang fixieren (P00.02) | Planpaket |
| P00.03 | [TASK-3](../backlog/tasks/task-3%20-%20Informationsarchitektur-und-zentrale-Interaktionen-gestalten-P00.03.md) – Informationsarchitektur und zentrale Interaktionen gestalten (P00.03) | Planpaket |

#### P01 – Anwendung, Identität und persönlicher Kontext

| Planreferenz | Task | Umfang |
|---|---|---|
| P01.01 | [TASK-4](../backlog/tasks/task-4%20-%20Repository-App-Shell-und-Entwicklungsumgebungen-anlegen-P01.01.md) – Repository, App-Shell und Entwicklungsumgebungen anlegen (P01.01) | Planpaket |
| P01.02 | [TASK-5](../backlog/tasks/task-5%20-%20Authentifizierung-und-Workspace-Isolation-umsetzen-P01.02.md) – Authentifizierung und Workspace-Isolation umsetzen (P01.02) | Planpaket |
| P01.03 | [TASK-6](../backlog/tasks/task-6%20-%20Onboarding-Profile-und-Navigation-bauen-P01.03.md) – Onboarding, Profile und Navigation bauen (P01.03) | Planpaket |

### R1 – Interne Publishing-Alpha

#### P02 – Entwürfe, Versionen, Freigaben und Medien

| Planreferenz | Task | Umfang |
|---|---|---|
| P02.01 | [TASK-7](../backlog/tasks/task-7%20-%20Content-Domain-und-Composer-entwickeln-P02.01.md) – Content-Domain und Composer entwickeln (P02.01) | Planpaket |
| P02.02 | [TASK-8](../backlog/tasks/task-8%20-%20Versionsgebundene-Freigaben-einf%C3%BChren-P02.02.md) – Versionsgebundene Freigaben einführen (P02.02) | Planpaket |
| P02.03 | [TASK-9](../backlog/tasks/task-9%20-%20R2-Medienverwaltung-mit-Inhaltsbindung-umsetzen-P02.03.md) – R2-Medienverwaltung mit Inhaltsbindung umsetzen (P02.03) | Planpaket |

#### P03 – X-Verbindung, zuverlässiges Publishing und Kalender

| Planreferenz | Task | Umfang |
|---|---|---|
| P03.01 | [TASK-10](../backlog/tasks/task-10%20-%20X-OAuth-und-Capability-Status-implementieren-P03.01.md) – X-OAuth und Capability-Status implementieren (P03.01) | Planpaket |
| P03.02 | [TASK-11](../backlog/tasks/task-11%20-%20Scheduler-und-Freigabepr%C3%BCfung-bauen-P03.02.md) – Scheduler und Freigabeprüfung bauen (P03.02) | Planpaket |
| P03.03 | [TASK-12](../backlog/tasks/task-12%20-%20Publisher-mit-Einzelpost-Checkpoints-und-Abgleich-bauen-P03.03.md) – Publisher mit Einzelpost-Checkpoints und Abgleich bauen (P03.03) | Planpaket |
| P03.03, Teil 1 | [TASK-12.1](../backlog/tasks/task-12.1%20-%20Finalisierte-Medien-sicher-f%C3%BCr-X-vorbereiten-P03.03-Teil-1.md) – Finalisierte Medien sicher für X vorbereiten (P03.03, Teil 1) | Unteraufgabe |
| P03.03, Teil 2 | [TASK-12.2](../backlog/tasks/task-12.2%20-%20Thread-Beitr%C3%A4ge-mit-dauerhaften-Versand-Checkpoints-ver%C3%B6ffentlichen-P03.03-Teil-2.md) – Thread-Beiträge mit dauerhaften Versand-Checkpoints veröffentlichen (P03.03, Teil 2) | Unteraufgabe |
| P03.03, Teil 3 | [TASK-12.3](../backlog/tasks/task-12.3%20-%20Unklare-Publishing-Ausg%C3%A4nge-abgleichen-und-Teilthreads-fortsetzen-P03.03-Teil-3.md) – Unklare Publishing-Ausgänge abgleichen und Teilthreads fortsetzen (P03.03, Teil 3) | Unteraufgabe |
| P03.04 | [TASK-13](../backlog/tasks/task-13%20-%20Kalender-und-erste-betriebliche-R%C3%BCckmeldung-liefern-P03.04.md) – Kalender und erste betriebliche Rückmeldung liefern (P03.04) | Planpaket |

### R2 – Dispatch-MVP

#### P04 – GitHub und Arbeitssignale

| Planreferenz | Task | Umfang |
|---|---|---|
| P04.01 | [TASK-14](../backlog/tasks/task-14%20-%20GitHub-App-und-Repository-Auswahl-anbinden-P04.01.md) – GitHub-App und Repository-Auswahl anbinden (P04.01) | Planpaket |
| P04.02 | [TASK-15](../backlog/tasks/task-15%20-%20Webhooks-und-Signal-Ingestion-idempotent-umsetzen-P04.02.md) – Webhooks und Signal-Ingestion idempotent umsetzen (P04.02) | Planpaket |
| P04.03 | [TASK-16](../backlog/tasks/task-16%20-%20Signale-anreichern-und-verst%C3%A4ndlich-darstellen-P04.03.md) – Signale anreichern und verständlich darstellen (P04.03) | Planpaket |

#### P05 – Agent-Grundlage, Content Agent und Chat

| Planreferenz | Task | Umfang |
|---|---|---|
| P05.01 | [TASK-17](../backlog/tasks/task-17%20-%20Modellzugang-Budgets-und-sichere-Tool-Vertr%C3%A4ge-implementieren-P05.01.md) – Modellzugang, Budgets und sichere Tool-Verträge implementieren (P05.01) | Planpaket |
| P05.02 | [TASK-18](../backlog/tasks/task-18%20-%20Ideen-und-Content-Agent-aufbauen-P05.02.md) – Ideen und Content Agent aufbauen (P05.02) | Planpaket |
| P05.03 | [TASK-19](../backlog/tasks/task-19%20-%20Persistenten-Chat-und-nachvollziehbare-Agent-Arbeit-liefern-P05.03.md) – Persistenten Chat und nachvollziehbare Agent-Arbeit liefern (P05.03) | Planpaket |

#### P06 – Eigenständiger proaktiver Recherche-Agent

| Planreferenz | Task | Umfang |
|---|---|---|
| P06.01 | [TASK-20](../backlog/tasks/task-20%20-%20Research-Profile-Zeitsteuerung-und-Auftr%C3%A4ge-bauen-P06.01.md) – Research-Profile, Zeitsteuerung und Aufträge bauen (P06.01) | Planpaket |
| P06.02 | [TASK-21](../backlog/tasks/task-21%20-%20X-und-Websuche-als-getrennte-Adapter-anschlie%C3%9Fen-P06.02.md) – X- und Websuche als getrennte Adapter anschließen (P06.02) | Planpaket |
| P06.03 | [TASK-22](../backlog/tasks/task-22%20-%20Research-Agent-Evidenz-und-Themencluster-implementieren-P06.03.md) – Research Agent, Evidenz und Themencluster implementieren (P06.03) | Planpaket |
| P06.03, Teil 1 | [TASK-22.1](../backlog/tasks/task-22.1%20-%20Research-Evidenz-und-G%C3%BCltigkeitsvertrag-implementieren-P06.03-Teil-1.md) – Research-Evidenz und Gültigkeitsvertrag implementieren (P06.03, Teil 1) | Unteraufgabe |
| P06.03, Teil 2 | [TASK-22.2](../backlog/tasks/task-22.2%20-%20Begrenzten-Research-Workflow-und-Themencluster-bauen-P06.03-Teil-2.md) – Begrenzten Research-Workflow und Themencluster bauen (P06.03, Teil 2) | Unteraufgabe |
| P06.03, Teil 3 | [TASK-22.3](../backlog/tasks/task-22.3%20-%20Recherchequalit%C3%A4t-und-Angriffsresistenz-evaluieren-P06.03-Teil-3.md) – Recherchequalität und Angriffsresistenz evaluieren (P06.03, Teil 3) | Unteraufgabe |
| P06.04 | [TASK-23](../backlog/tasks/task-23%20-%20Research-Inbox-und-%C3%9Cbergabe-in-Content-umsetzen-P06.04.md) – Research Inbox und Übergabe in Content umsetzen (P06.04) | Planpaket |

#### P07 – Kalenderbewusste Planung aus beiden Quellen

| Planreferenz | Task | Umfang |
|---|---|---|
| P07.01 | [TASK-24](../backlog/tasks/task-24%20-%20Pl%C3%A4ne-und-Vorschlagslogik-erstellen-P07.01.md) – Pläne und Vorschlagslogik erstellen (P07.01) | Planpaket |
| P07.02 | [TASK-25](../backlog/tasks/task-25%20-%20Selektive-Annahme-und-sichere-Ausf%C3%BChrung-erm%C3%B6glichen-P07.02.md) – Selektive Annahme und sichere Ausführung ermöglichen (P07.02) | Planpaket |
| P07.03 | [TASK-26](../backlog/tasks/task-26%20-%20Dispatch-MVP-anhand-realer-Redaktionsarbeit-abnehmen-P07.03.md) – Dispatch-MVP anhand realer Redaktionsarbeit abnehmen (P07.03) | Planpaket |

#### P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität

| Planreferenz | Task | Umfang |
|---|---|---|
| G-R2 | [TASK-63](../backlog/tasks/task-63%20-%20Sicheren-Basisbetrieb-vor-der-MVP-Abnahme-nachweisen.md) – Sicheren Basisbetrieb vor der MVP-Abnahme nachweisen | Gate / Entscheidung |

#### P08.01–P08.03 – Intelligence im Dispatch-MVP (D04)

| Planreferenz | Task | Umfang |
|---|---|---|
| P08.01 | [TASK-27](../backlog/tasks/task-27%20-%20Versionierte-Algorithmus-und-Audience-Profile-erstellen-P08.01.md) – Versionierte Algorithmus- und Audience-Profile erstellen (P08.01) | Planpaket |
| P08.02 | [TASK-28](../backlog/tasks/task-28%20-%20Begrenzte-Pre-Publish-Analyse-implementieren-P08.02.md) – Begrenzte Pre-Publish-Analyse implementieren (P08.02) | Planpaket |
| P08.02, Teil 1 | [TASK-28.1](../backlog/tasks/task-28.1%20-%20Jev-Adapter-mit-begrenzten-Aufrufen-und-Betriebsflags-implementieren-P08.02-Teil-1.md) – Jev-Adapter mit begrenzten Aufrufen und Betriebsflags implementieren (P08.02, Teil 1) | Unteraufgabe |
| P08.02, Teil 2 | [TASK-28.2](../backlog/tasks/task-28.2%20-%20Jev-Post-Analyzer-und-reproduzierbaren-Dispatch-Score-implementieren-P08.02-Teil-2.md) – Jev-Post-Analyzer und reproduzierbaren Dispatch Score implementieren (P08.02, Teil 2) | Unteraufgabe |
| P08.02, Teil 3 | [TASK-28.3](../backlog/tasks/task-28.3%20-%20Jev-Assessments-versionsgebunden-speichern-und-isoliert-cachen-P08.02-Teil-3.md) – Jev-Assessments versionsgebunden speichern und isoliert cachen (P08.02, Teil 3) | Unteraufgabe |
| P08.03 | [TASK-29](../backlog/tasks/task-29%20-%20Empfehlungen-Vergleich-und-%C3%9Cbernahme-gestalten-P08.03.md) – Empfehlungen, Vergleich und Übernahme gestalten (P08.03) | Planpaket |

### R3 – Private Beta

#### P08.04 – Messgrundlage

| Planreferenz | Task | Umfang |
|---|---|---|
| P08.04 | [TASK-30](../backlog/tasks/task-30%20-%20Messgrundlage-bereits-in-der-Beta-schaffen-P08.04.md) – Messgrundlage bereits in der Beta schaffen (P08.04) | Planpaket |

#### P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität

| Planreferenz | Task | Umfang |
|---|---|---|
| P09.01 | [TASK-31](../backlog/tasks/task-31%20-%20Betriebsereignisse-Alerts-und-Wiederherstellung-konsolidieren-P09.01.md) – Betriebsereignisse, Alerts und Wiederherstellung konsolidieren (P09.01) | Planpaket |
| P09.02 | [TASK-32](../backlog/tasks/task-32%20-%20Benachrichtigungen-zuverl%C3%A4ssig-und-konfigurierbar-machen-P09.02.md) – Benachrichtigungen zuverlässig und konfigurierbar machen (P09.02) | Planpaket |
| P09.03 | [TASK-33](../backlog/tasks/task-33%20-%20Export-L%C3%B6schung-und-Retention-umsetzen-P09.03.md) – Export, Löschung und Retention umsetzen (P09.03) | Planpaket |
| P09.03, Teil 1 | [TASK-33.1](../backlog/tasks/task-33.1%20-%20Dateninventar-und-sicheren-Workspace-Export-liefern-P09.03-Teil-1.md) – Dateninventar und sicheren Workspace-Export liefern (P09.03, Teil 1) | Unteraufgabe |
| P09.03, Teil 2 | [TASK-33.2](../backlog/tasks/task-33.2%20-%20Wiederaufnehmbare-Account-und-Workspace-L%C3%B6schung-umsetzen-P09.03-Teil-2.md) – Wiederaufnehmbare Account- und Workspace-Löschung umsetzen (P09.03, Teil 2) | Unteraufgabe |
| P09.03, Teil 3 | [TASK-33.3](../backlog/tasks/task-33.3%20-%20Retention-Quellenl%C3%B6schung-und-Datenkontrollen-vervollst%C3%A4ndigen-P09.03-Teil-3.md) – Retention, Quellenlöschung und Datenkontrollen vervollständigen (P09.03, Teil 3) | Unteraufgabe |
| P09.04 | [TASK-34](../backlog/tasks/task-34%20-%20Zug%C3%A4nglichkeit-UX-und-Performance-pr%C3%BCfen-P09.04.md) – Zugänglichkeit, UX und Performance prüfen (P09.04) | Planpaket |
| P09.05 | [TASK-35](../backlog/tasks/task-35%20-%20Produktanalytics-und-Pilotmessung-einf%C3%BChren-P09.05.md) – Produktanalytics und Pilotmessung einführen (P09.05) | Planpaket |
| P09.06 | [TASK-36](../backlog/tasks/task-36%20-%20Deployment-Migrationen-und-Recovery-abnehmen-P09.06.md) – Deployment, Migrationen und Recovery abnehmen (P09.06) | Planpaket |
| P09.06, Teil 1 | [TASK-36.1](../backlog/tasks/task-36.1%20-%20Getrennte-Deployment-Umgebungen-und-Release-Smokes-einrichten-P09.06-Teil-1.md) – Getrennte Deployment-Umgebungen und Release-Smokes einrichten (P09.06, Teil 1) | Unteraufgabe |
| P09.06, Teil 2 | [TASK-36.2](../backlog/tasks/task-36.2%20-%20Schema-und-Workflow-Migrationen-wiederaufnehmbar-gestalten-P09.06-Teil-2.md) – Schema- und Workflow-Migrationen wiederaufnehmbar gestalten (P09.06, Teil 2) | Unteraufgabe |
| P09.06, Teil 3 | [TASK-36.3](../backlog/tasks/task-36.3%20-%20Restore-samt-R2-und-Provider-Abgleich-praktisch-erproben-P09.06-Teil-3.md) – Restore samt R2- und Provider-Abgleich praktisch erproben (P09.06, Teil 3) | Unteraufgabe |
| G-R3 | [TASK-64](../backlog/tasks/task-64%20-%20Private-Beta-anhand-der-Nutzerabl%C3%A4ufe-und-Betriebs%C3%BCbungen-abnehmen.md) – Private Beta anhand der Nutzerabläufe und Betriebsübungen abnehmen | Gate / Entscheidung |

### R4 – Kommerzielles X-Produkt

#### P10 – Kommerzielles SaaS und öffentliche Veröffentlichung

| Planreferenz | Task | Umfang |
|---|---|---|
| P10.01 | [TASK-37](../backlog/tasks/task-37%20-%20Pl%C3%A4ne-Entitlements-und-Usage-vervollst%C3%A4ndigen-P10.01.md) – Pläne, Entitlements und Usage vervollständigen (P10.01) | Planpaket |
| P10.02 | [TASK-38](../backlog/tasks/task-38%20-%20Stripe-und-Zahlungslebenszyklus-integrieren-P10.02.md) – Stripe und Zahlungslebenszyklus integrieren (P10.02) | Planpaket |
| P10.03 | [TASK-39](../backlog/tasks/task-39%20-%20Marketing-Hilfe-und-Support-produktf%C3%A4hig-machen-P10.03.md) – Marketing, Hilfe und Support produktfähig machen (P10.03) | Planpaket |
| P10.04 | [TASK-40](../backlog/tasks/task-40%20-%20GA-Gate-durchf%C3%BChren-P10.04.md) – GA-Gate durchführen (P10.04) | Planpaket |

### R5 – Lernendes Produkt

#### P11 – Performance Feedback und Account Intelligence

| Planreferenz | Task | Umfang |
|---|---|---|
| P11.01 | [TASK-41](../backlog/tasks/task-41%20-%20Messpipeline-ausbauen-und-historischen-Kontext-importieren-P11.01.md) – Messpipeline ausbauen und historischen Kontext importieren (P11.01) | Planpaket |
| P11.02 | [TASK-42](../backlog/tasks/task-42%20-%20Account-Baselines-und-Performance-Ansichten-entwickeln-P11.02.md) – Account-Baselines und Performance-Ansichten entwickeln (P11.02) | Planpaket |
| P11.03 | [TASK-43](../backlog/tasks/task-43%20-%20Kalibrierung-mit-Kontrollgruppe-und-Rollback-einf%C3%BChren-P11.03.md) – Kalibrierung mit Kontrollgruppe und Rollback einführen (P11.03) | Planpaket |
| P11.03, Teil 1 | [TASK-43.1](../backlog/tasks/task-43.1%20-%20Zul%C3%A4ssige-Lernziele-und-zeitlich-getrennte-Referenzdaten-definieren-P11.03-Teil-1.md) – Zulässige Lernziele und zeitlich getrennte Referenzdaten definieren (P11.03, Teil 1) | Unteraufgabe |
| P11.03, Teil 2 | [TASK-43.2](../backlog/tasks/task-43.2%20-%20Kalibrierung-gegen-eine-feste-Baseline-im-Schattenbetrieb-messen-P11.03-Teil-2.md) – Kalibrierung gegen eine feste Baseline im Schattenbetrieb messen (P11.03, Teil 2) | Unteraufgabe |
| P11.03, Teil 3 | [TASK-43.3](../backlog/tasks/task-43.3%20-%20Modellaktivierung-und-R%C3%BCckfall-auf-die-Baseline-absichern-P11.03-Teil-3.md) – Modellaktivierung und Rückfall auf die Baseline absichern (P11.03, Teil 3) | Unteraufgabe |
| P11.04 | [TASK-44](../backlog/tasks/task-44%20-%20Algorithmuswissen-kontrolliert-aktualisieren-P11.04.md) – Algorithmuswissen kontrolliert aktualisieren (P11.04) | Planpaket |

#### P12 – Persönliche Stimme, strategische Planung und kontinuierliche Verbesserung

| Planreferenz | Task | Umfang |
|---|---|---|
| P12.01 | [TASK-45](../backlog/tasks/task-45%20-%20Content-Pillars-und-korrigierbare-Style-Profiles-einf%C3%BChren-P12.01.md) – Content Pillars und korrigierbare Style Profiles einführen (P12.01) | Planpaket |
| P12.02 | [TASK-46](../backlog/tasks/task-46%20-%20Historische-%C3%84hnlichkeit-und-intelligente-Redaktionsplanung-erg%C3%A4nzen-P12.02.md) – Historische Ähnlichkeit und intelligente Redaktionsplanung ergänzen (P12.02) | Planpaket |
| P12.03 | [TASK-47](../backlog/tasks/task-47%20-%20Begrenzte-Experimente-und-Lernkontrolle-bauen-P12.03.md) – Begrenzte Experimente und Lernkontrolle bauen (P12.03) | Planpaket |
| P12.04 | [TASK-48](../backlog/tasks/task-48%20-%20Mehrere-Accounts-sicher-im-redaktionellen-Alltag-unterst%C3%BCtzen-P12.04.md) – Mehrere Accounts sicher im redaktionellen Alltag unterstützen (P12.04) | Planpaket |

#### JEV – Unterstützte Entscheidungen und Verifikation

| Planreferenz | Task | Umfang |
|---|---|---|
| JEV §§17–18 | [TASK-67](../backlog/tasks/task-67%20-%20Jev-Intent-Routing-f%C3%BCr-die-Content-Erzeugung-erg%C3%A4nzen.md) – Jev-Intent-Routing für die Content-Erzeugung ergänzen | Erweiterung nach Analyzer-MVP |
| JEV §§19–20 | [TASK-68](../backlog/tasks/task-68%20-%20Generierte-Inhalte-mit-Jev-pr%C3%BCfen-und-begrenzt-nachbessern.md) – Generierte Inhalte mit Jev prüfen und begrenzt nachbessern | Erweiterung nach Intent-Routing |

### R6 – Teamprodukt

#### P13 – Teams, Rollen und Kundenkontexte

| Planreferenz | Task | Umfang |
|---|---|---|
| P13.01 | [TASK-49](../backlog/tasks/task-49%20-%20Einladungen-und-belastbare-Rollenmatrix-umsetzen-P13.01.md) – Einladungen und belastbare Rollenmatrix umsetzen (P13.01) | Planpaket |
| P13.02 | [TASK-50](../backlog/tasks/task-50%20-%20Kommentare-Zuweisungen-und-Freigaberegeln-erg%C3%A4nzen-P13.02.md) – Kommentare, Zuweisungen und Freigaberegeln ergänzen (P13.02) | Planpaket |
| P13.03 | [TASK-51](../backlog/tasks/task-51%20-%20Mehrere-Kunden-und-Markenr%C3%A4ume-optional-ausbauen-P13.03.md) – Mehrere Kunden- und Markenräume optional ausbauen (P13.03) | Optional |

### R7 – Kanalübergreifendes Produkt

#### P14 – Multi-Channel Publishing und plattformspezifische Intelligence

| Planreferenz | Task | Umfang |
|---|---|---|
| P14.01 | [TASK-52](../backlog/tasks/task-52%20-%20Provider-Vertrag-aus-bew%C3%A4hrtem-X-Verhalten-herausl%C3%B6sen-P14.01.md) – Provider-Vertrag aus bewährtem X-Verhalten herauslösen (P14.01) | Planpaket |
| P14.02 | [TASK-53](../backlog/tasks/task-53%20-%20Einen-zus%C3%A4tzlichen-Kanal-vollst%C3%A4ndig-liefern-P14.02.md) – Einen zusätzlichen Kanal vollständig liefern (P14.02) | Planpaket |
| P14.02, Teil 1 | [TASK-53.1](../backlog/tasks/task-53.1%20-%20Zus%C3%A4tzlichen-Kanal-anhand-realer-Zug%C3%A4nge-ausw%C3%A4hlen-P14.02-Teil-1.md) – Zusätzlichen Kanal anhand realer Zugänge auswählen (P14.02, Teil 1) | Unteraufgabe |
| P14.02, Teil 2 | [TASK-53.2](../backlog/tasks/task-53.2%20-%20Den-ausgew%C3%A4hlten-Plattformadapter-vollst%C3%A4ndig-implementieren-P14.02-Teil-2.md) – Den ausgewählten Plattformadapter vollständig implementieren (P14.02, Teil 2) | Unteraufgabe |
| P14.02, Teil 3 | [TASK-53.3](../backlog/tasks/task-53.3%20-%20Kanalvarianten-und-vollst%C3%A4ndigen-Multi-Channel-Loop-abnehmen-P14.02-Teil-3.md) – Kanalvarianten und vollständigen Multi-Channel-Loop abnehmen (P14.02, Teil 3) | Unteraufgabe |
| P14.03 | [TASK-54](../backlog/tasks/task-54%20-%20Gemeinsamen-Kalender-und-mehrkanalige-Analyse-erg%C3%A4nzen-P14.03.md) – Gemeinsamen Kalender und mehrkanalige Analyse ergänzen (P14.03) | Planpaket |
| P14.04 | [TASK-55](../backlog/tasks/task-55%20-%20Weitere-Plattformen-nach-dem-gleichen-vollst%C3%A4ndigen-Gate-ausbauen-P14.04.md) – Weitere Plattformen nach dem gleichen vollständigen Gate ausbauen (P14.04) | Optional |

### R8 – Ausgebautes Endprodukt

#### P15 – Weitere Arbeitsquellen, Wiederverwertung und Medien

| Planreferenz | Task | Umfang |
|---|---|---|
| P15.01 | [TASK-56](../backlog/tasks/task-56%20-%20GitHub-Signale-erweitern-P15.01.md) – GitHub-Signale erweitern (P15.01) | Portfolio-Kandidat |
| P15.02 | [TASK-57](../backlog/tasks/task-57%20-%20Zus%C3%A4tzliche-Quellen-%C3%BCber-wiederverwendbare-Ingestion-anbinden-P15.02.md) – Zusätzliche Quellen über wiederverwendbare Ingestion anbinden (P15.02) | Portfolio-Kandidat |
| P15.03 | [TASK-58](../backlog/tasks/task-58%20-%20Blog-und-Newsletter-Wiederverwertung-bauen-P15.03.md) – Blog- und Newsletter-Wiederverwertung bauen (P15.03) | Portfolio-Kandidat |
| P15.04 | [TASK-59](../backlog/tasks/task-59%20-%20Generierte-Bilder-und-erweiterte-Videoarbeit-erg%C3%A4nzen-P15.04.md) – Generierte Bilder und erweiterte Videoarbeit ergänzen (P15.04) | Portfolio-Kandidat |
| P15.05 | [TASK-60](../backlog/tasks/task-60%20-%20Optionale-Wettbewerbs-und-Themenfr%C3%BChindikatoren-pr%C3%BCfen-P15.05.md) – Optionale Wettbewerbs- und Themenfrühindikatoren prüfen (P15.05) | Portfolio-Kandidat |
| G-PORTFOLIO | [TASK-65](../backlog/tasks/task-65%20-%20Erweiterungsportfolio-f%C3%BCr-das-Endprodukt-verbindlich-ausw%C3%A4hlen.md) – Erweiterungsportfolio für das Endprodukt verbindlich auswählen | Gate / Entscheidung |
| G-R8 | [TASK-66](../backlog/tasks/task-66%20-%20Das-ausgew%C3%A4hlte-Endprodukt-%C3%BCber-alle-eingef%C3%BChrten-Module-abnehmen.md) – Das ausgewählte Endprodukt über alle eingeführten Module abnehmen | Gate / Entscheidung |

### R9 – Optionale kontrollierte Autonomie

#### P16 – Optionale kontrollierte Autonomie

| Planreferenz | Task | Umfang |
|---|---|---|
| P16.01 | [TASK-61](../backlog/tasks/task-61%20-%20Begrenzte-Autonomie-Policies-spezifizieren-und-umsetzen-P16.01.md) – Begrenzte Autonomie-Policies spezifizieren und umsetzen (P16.01) | Optional |
| P16.02 | [TASK-62](../backlog/tasks/task-62%20-%20Schattenbetrieb-Kill-Switch-und-begrenzten-Pilot-durchf%C3%BChren-P16.02.md) – Schattenbetrieb, Kill Switch und begrenzten Pilot durchführen (P16.02) | Optional |

## Mit der CLI arbeiten

```sh
backlog milestone list --plain
backlog task list --milestone m-0 --plain
backlog task list --labels p06 --plain
backlog task list --parent TASK-12 --plain
backlog task list --ready --plain
backlog task TASK-1 --plain
backlog board
backlog doctor
```

**Aktueller fachlicher Einstieg:** TASK-3 „Informationsarchitektur und zentrale Interaktionen gestalten (P00.03)“; die Abhängigkeit TASK-2 ist abgeschlossen. Die [Bewertung vom 01.10.2026](reviews/2026-10-01-task-3-evaluation.md) dokumentiert fehlende Designartefakte und den erforderlichen R2-Intelligence-Umfang. Providerwahl und Aktivierungsnachweise aus TASK-1 bleiben offen. Die Bereitschaftsanzeige prüft technische Task-Abhängigkeiten; erforderliche Produkt-, Daten- und Providerfreigaben stehen zusätzlich in den Beschreibungen.

Tasks ausschließlich mit der Backlog-CLI bearbeiten. Den konkreten Implementierungsplan beim tatsächlichen Arbeitsbeginn per `backlog task edit <ID> --plan ...` hinterlegen; Fortschritt und Nachweise per CLI pflegen. Keine eigenständige Umstellung auf `Done`.

## Prüfung der Übertragung

- Alle 62 Pxx.yy-Pakete des Quellplans sind genau einmal als übergeordnete beziehungsweise eigenständige Planaufgabe vorhanden.
- Alle 89 Tasks haben Milestone, Phasen- oder JEV-Label, Akzeptanzkriterien, Quellenreferenz und eine ausdrückliche Nutzerbestätigung als Abschlussbedingung.
- Die gespeicherten Abhängigkeiten und Eltern-Kind-Zuordnungen wurden gegen die geplante Struktur geprüft.
- `backlog doctor` meldet keine doppelten IDs, Selbstabhängigkeiten oder Abhängigkeitszyklen.
- Pflicht-Gates haben keine unbedingten Abhängigkeiten auf optionale Portfolio-Pakete. Die Auswahlentscheidung ergänzt später die tatsächlich bestellten Erweiterungen.

## JEV-Abgleich am 18. September 2026

- Bestehende Aufgaben über die Backlog-CLI angepasst: TASK-1, 2, 17, 18, 27–31, 33, 33.1–33.3, 35, 41–43, 43.1–43.3, 46, 52, 53.3, 54, 58 und 64.
- Neu angelegt: TASK-28.1–28.3, TASK-67 und TASK-68; alle auf To Do, keine Akzeptanzkriterien vorweggenommen.
- Vorhandene Status, Kriterien/DoD, Notizen, Pläne, Prioritäten und Release-Zuordnungen erhalten; Abhängigkeiten des Analyzer-Pakets um seine Unteraufgaben ergänzt.
- SDK-Syntax, Preise und TypeSafe-Verarbeitung sind noch zu prüfende Implementierungs-/Aktivierungstore, keine durch diese Dokumentpflege bestätigten Fakten.

## D04-Änderung am 19. September 2026

- Nutzerentscheidung: Intelligence bereits in R2. TASK-27, TASK-28, TASK-28.1–28.3 und TASK-29 wechseln von m-3/r3 nach m-2/r2.
- TASK-27 wartet auf TASK-1/7 statt auf TASK-26. TASK-26 wartet nun auf TASK-29 und den um Intelligence erweiterten TASK-63-Basisbetrieb; TASK-64 ausdrücklich auf TASK-26.
- J01–J08 gehören zur MVP-Abnahme. P08.04 bleibt R3; Routing, Verifikation und Kalibrierung bleiben R5.
- Fachliche Quelle: [Release-Vertrag](decisions/release-scope.md), [Domain-Vertrag](decisions/domain-contracts.md). Bestehende Implementierungsstände und Nutzer-Abnahmetore bleiben erhalten.
- Die installierte Backlog-CLI unterstützt keine Bearbeitung bestehender Milestone-Beschreibungen. Die alten Kurztexte in m-2/m-3 sind deshalb historische Zusammenfassungen; maßgeblich sind dieser Vertrag, die obige Tabelle und die aktualisierten Task-Zuordnungen. Keine Milestones wurden gelöscht oder neu angelegt.
