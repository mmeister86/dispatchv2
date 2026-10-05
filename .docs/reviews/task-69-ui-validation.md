# TASK-69 · UI-Validierung

Stand: 4. Oktober 2026. Direkt auf `master`, keine zusätzlichen Branches oder Worktrees. Alle Ergebnisse beziehen sich auf die lokale Mock-Anwendung, nicht auf Produktionsbetrieb oder reale Provider.

## Abdeckung

75 UI-relevante Ursprungstasks sind einzeln in [ui-backlog-coverage.md](../ui-backlog-coverage.md) ihren Oberflächen zugeordnet. Die übrigen 14 Tasks betreffen Backend, reale Daten-/Provider-Verträge oder Release-/Produktionsabnahmen. TASK-69 dokumentiert die gemeinsame Umsetzung. Alle 75 Ursprungstasks wurden ausschließlich per Backlog-CLI mit UI-Nachweisen versehen und auf `In Progress` gesetzt. Gemischte Backend-Kriterien wurden nicht abgehakt. Die explizite manuelle Nutzerabnahme steht aus.

[Maschinenlesbare Zuordnung](task-69-backlog-mapping.json).

## Verifikation

- `pnpm typecheck`: strikter TypeScript-Check erfolgreich.
- `pnpm build`: Produktionsbuild erfolgreich; lokale Schriftdateien und getrennte Lazy-Chunks für ergänzende Module.
- `pnpm test`: 17 Modelltests erfolgreich. Versions-/Account-Freigaben, Snapshot-Erhalt, neue Medien, erforderliche Review-Stufen, selektive/idempotente Planung, Rollen, Konflikte, Zeitumstellung, getrennte Workspaces, widerrufene Freigaben, exakte Teilthread-Recovery, Kanalwechsel und Verbindungsabbruch.
- `pnpm test:e2e`: 31 von 31 dauerhaften Chrome-Browserprüfungen im gemeinsamen endgültigen Lauf erfolgreich (1,9 Minuten). Enthält 35 direkte URLs, Kernabläufe, alle ergänzenden Produktmodule, Team-/Verwaltungsabläufe und Datenlöschung mit simuliertem Fehler/Wiederaufnahme.
- Axe: alle 32 Hauptansichten auf WCAG 2 A/AA und WCAG 2.1 A/AA geprüft; keine `serious`- oder `critical`-Verstöße im geprüften Ausgangszustand.
- Dark Mode: Theme-Persistenz und Lesbarkeit zusätzlich auf sechs zentralen bzw. öffentlichen Ansichten mit Axe geprüft. Direkte URLs und Navigation verwenden dieselbe gespeicherte Auswahl.
- Mobil: Navigation und zentrale Oberflächen bei 390 × 844 px geprüft; keine horizontale Überbreite in den geprüften Ansichten. Produkt-/Verwaltungsansichten wurden zusätzlich durch die jeweiligen Modulprüfungen kontrolliert.
- Tastatur: Ctrl/Cmd+S, Ctrl/Cmd+K, Suchfokus, Escape und Dialog-Fokusrückgabe; ungespeicherte Bearbeitungen bleiben auch bei Menü-Navigation, Account-Kontext und Browser-Zurück geschützt.
- Quota-Fehler: Speichern wird abgebrochen, Arbeitszustand bleibt ungespeichert; fehlgeschlagene Varianten-/Plan-Erstellung navigiert nicht zu fehlenden Entwürfen und erzeugt keine verwaisten Vorschlagsreferenzen.
- Der URL-Smoke-Test beobachtet sämtliche Browser-Requests und weist keine HTTP-Anfragen außerhalb des lokalen Dev-Servers nach.
- `pnpm exec prettier --check src tests vite.config.ts playwright.config.ts`: Formatierung geprüft. `git diff --check`: keine Whitespace-Fehler.

Automatische Prüfungen ersetzen keine vollständige Screenreader- oder manuelle Produktionsabnahme. Die Axe-Prüfung gilt für sichtbare Ausgangszustände; zusätzliche Dialog-/Fehlerzustände werden durch gezielte Ablaufprüfungen abgedeckt, nicht als vollständige WCAG-Zertifizierung behauptet.

## Review und behobene Befunde

Unabhängiges Spec- und Code-Review führten unter anderem zu folgenden Korrekturen:

1. Analysezustände sind an Entwurf, Version und Account gebunden; Empfehlungen erhalten den Aussagekontext und erfordern einen bewussten Diff-Review.
2. Geplante Texte/Medien und ihre konkrete Autorisierung bleiben unverändert, wenn sich die Arbeitsversion ändert. Snapshot-Wechsel prüfen Rollen, Zeitpunkt, Account, Freigabe und Slot-Konflikte erneut.
3. Ein Accountwechsel erfordert Storno und separate Neuplanung; Inhalte für LinkedIn können keinen X-Snapshot überschreiben. LinkedIn-Threads erhalten eine explizite Zusammenführungsaktion statt einer stillen Umwandlung.
4. Teilthreads werden anhand der konkreten alten Snapshot-Version fortgesetzt. Widerrufene Freigaben und fehlende Review-Stufen blockieren; unklare Ausgänge werden zuerst abgeglichen.
5. Workspace-Review-Regeln werden auch vor neu erzeugten Planvorschlägen übernommen. Änderungen an Review-Regeln stoppen ausstehende geplante Slots.
6. Verbindungsabbruch setzt wartende Slots auf einen erklärten Fehler; erneute Verbindung startet sie nicht automatisch. Unklare und teilweise abgeschlossene Historien bleiben erhalten.
7. Gemeinsame Mutationen speichern synchron vor der Zustandsübernahme und verwenden die jeweils neueste Version. Ideenübergabe und Ziel-Account-Erstellung sind atomare gemeinsame Mutationen. Lokale Modulzustände rollen bei Quota-Fehlern zurück.
8. Der Router schützt alle tatsächlichen Seitenwechsel, einschließlich History und Profilmenü. Bestätigungen für Kontextwechsel geben keine spätere beliebige Navigation frei.
9. Kontolöschung erhält gemeinsam genutzte Workspace-Inhalte und anonymisiert Autorennamen in Kommentaren, Reviews, Freigabehistorie und Snapshot-Autorisierung.
10. Kontrast, responsive Grid-Breiten, Progressbar-Namen sowie Fokusrückgabe kontrolliert geöffneter shadcn-Dialoge/Sheets wurden anhand konkreter fehlgeschlagener Tests korrigiert.

11. Der Vite-Datei-Watcher ignoriert Test-Traces, Reports, Dokumentation, Backlog und Projekt-Caches. Dadurch lösen gespeicherte Playwright-HTML-Artefakte keine sich selbst wiederholenden Seitenneuladungen aus. Der historische Import-Test wurde nach dem nachgewiesenen Reload-Loop erneut gezielt geprüft.

## Visuelle Belege

- [Übersicht Desktop](evidence/task-69/overview-desktop.png)
- [Composer Desktop](evidence/task-69/composer-desktop.png)
- [Übersicht Mobile](evidence/task-69/overview-mobile.png)

Die aktuelle Übersicht und der Composer wurden außerdem im Codex-In-App-Browser kontrolliert.

## Grenzen und Arbeitsverzeichnis

Alle Analysen, Rechercheläufe, Chats, Metriken, OAuth-Zustände, Checkout-Vorschauen, Publikationsereignisse und Hintergrundaufträge sind Simulationen. Keine vorhandenen Provider-Schlüssel wurden verwendet. Lokale Uploads werden weder übertragen noch transkribiert/gerendert; Bild-/Video-Studioausgaben sind explizite Beispiele.

Bestehende uncommittete Dokument-/Backlog-Änderungen wurden erhalten. Es wurden keine Commits, Pushes oder zusätzlichen Branches erstellt. pnpm-Store und Cache sind nun über `pnpm-workspace.yaml` auf dieses Repository festgelegt; `pnpm config get store-dir` bestätigt den Projektpfad. Beim ersten Installationslauf hat pnpm die alte `.npmrc`-Store-Einstellung ignoriert und den übergeordneten Standard-Store verwendet. Dieser gemeinsam genutzte Cache wurde nicht nachträglich gelöscht. Frühere temporäre Agent-Prüfharnesses lagen unter `/tmp`; dauerhafte Tests, Quellen und Belege liegen im Repository.

Die verbleibenden manuellen Abnahmefälle stehen in der Abdeckungsdokumentation. Erst nach ausdrücklicher Bestätigung nach manueller Prüfung dürfen TASK-69 oder Ursprungstasks auf `Done` gesetzt werden.
