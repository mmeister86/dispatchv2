# Dispatch UI — 4. Oktober 2026

TASK-69 implementiert sämtliche UI-Anteile unabhängig vom Milestone. Der Nutzer hat direkte Arbeit auf master, Best-Guess-Entscheidungen, pnpm und shadcn/ui autorisiert. Echte Recherche, Veröffentlichung und KI sind ausgeschlossen. Bestehende Dateien und Credentials werden nicht verändert oder benutzt.

## Gestaltung und Informationsarchitektur

Empfehlung: eine zusammenhängende interaktive Mock-App statt voneinander isolierter Prototypen. Ein statisches Click-Dummy wäre schneller, würde aber Freigabe-/Versions-/Planungsregeln nicht prüfbar machen; echte Backends würden den Auftrag überschreiten. React/TypeScript/Vite, shadcn/ui und lokaler Browserzustand bilden deshalb die Grundlage.

Helle redaktionelle Arbeitsoberfläche, warme Neutralfarben, gedecktes Orange, Manrope für Überschriften und DM Sans für Inhalt. Schmale Navigation, dichtes aber lesbares Layout, beschriftete Statusindikatoren, sichtbarer Account-Kontext, Dark Mode und mobile Navigation. Keine externen Font-/Bilddienste nötig.

Navigation: Übersicht, Kalender, Entwürfe, Ideen, Recherche, Signale, Agent, Analytics, Medien, Team, Einstellungen. Ergänzende Ansichten für Pläne, Experimente, Wiederverwertung, Frühindikatoren, Betrieb und öffentliche Produkt-/Hilfe-/Auth-Seiten.

## Gemeinsamer Zustand

Workspace- und Account-Zuordnung, Draft-Versionen, Freigaben, geplante Snapshots, Ideen und Medien werden lokal gespeichert. Einstellungen und ergänzende Module speichern ihren Mock-Zustand ebenfalls lokal. Der Demo-Hinweis bleibt sichtbar. Ein Workspace-Wechsel darf keine fremden Inhalte anzeigen. Speicherung ist kein Nachweis serverseitiger Sicherheit.

## Interaktionsregeln

Idee annehmen erzeugt keine Freigabe. Bearbeitung, Accountwechsel und Medienänderung erzeugen eine neue ungeprüfte Version. Freigabe gehört zu einer konkreten Version und einem Account. Ein Termin referenziert einen Snapshot und wird nicht still durch neue Bearbeitung ersetzt. Planung und Freigabe bleiben getrennte Aktionen; selektive Planannahme erzeugt genau die ausgewählten Termine. Ein unbekannter Versand-Ausgang benötigt erst simulierten Abgleich. Veröffentlichte Inhalte können nicht verschoben werden.

Mock-Analyse verändert keinen Inhalt. Übernahme zeigt einen Diff und erzeugt eine neue Version. Scores sind markierte Beispieldaten mit fehlenden Dimensionen, Quellen-/Versionsstand und Unsicherheit. Chat, Research, Generation, Billing und Publishing verwenden ausschließlich lokale feste Demo-Ergebnisse.

## Prüfung

Version-/Account-/Freigabe-/Planungs-Invarianten werden als Unit-Tests geprüft; Browser-Tests prüfen Navigation, Persistenz, selektive Annahme, Tastaturabläufe und mobile Ansichten. Automatisierte Accessibility-Prüfung plus sichtbare Browserkontrolle ersetzen keine repräsentative Nutzer- oder Screenreader-Abnahme. Backlog-Originaltasks bleiben mit dokumentiertem UI-Teil offen; Done erst nach ausdrücklicher Nutzerbestätigung.
