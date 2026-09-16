# ADR-001 – Convex für Produktdaten und Abläufe, Cloudflare R2 für Medien

**Status:** Vom Produktinhaber bestätigt

**Datum:** 16. September 2026

**Geltungsbereich:** Speicher- und Backend-Aufteilung; keine Freigabe zum Beginn der Implementierung

## Entscheidung

Dispatch verwendet:

- **Cloudflare:** Hosting der Weboberfläche.
- **Convex Cloud:** Produktdaten, Medienmetadaten, Berechtigungen, Agent-Zustände, Recherche, Kalender, Freigaben, Scheduling und Publishing-Workflows.
- **Cloudflare R2:** Binäre Medien wie Bilder, GIFs und Videos, einschließlich später generierter Medien.

Die Bestätigung lautet: „Convex für Produktdaten und Abläufe, R2 für Medien“.

## Begründung

Convex bleibt der integrierte Unterbau für den vorgesehenen Produktloop. R2 übernimmt Dateien, deren Größe und Auslieferungsvolumen unabhängig von den eigentlichen Produktdatensätzen wachsen können. So lässt sich der Medienverkehr gezielt auslagern, ohne ein zweites Backend für Geschäftslogik und eine zusätzliche Datenbank einzuführen.

Ein vollständiges Backend aus Cloudflare Workers, D1 und Workflows wurde als Alternative betrachtet, aber für diese Architekturentscheidung nicht gewählt. Die Entscheidung beruht auf Entwicklungsaufwand und Kostenstruktur; Compliance und DSGVO waren nicht Gegenstand dieses Vergleichs.

## Daten- und Zugriffspfad

1. Convex prüft den angemeldeten Nutzer, Workspace, Uploadgrenzen und Kontingent.
2. Der Browser erhält eine begrenzte Uploadberechtigung für einen temporären R2-Objektbereich und überträgt die Datei direkt.
3. Ein serverseitig kontrollierter Abschluss erstellt ein neues finales Objekt und validiert die tatsächlich dort gespeicherten Bytes. Browser-Uploadberechtigungen gelten niemals für diesen finalen Schlüssel; reguläre Produktfunktionen überschreiben finale Objekte nicht.
4. Convex setzt das zugehörige Asset nach erfolgreicher Prüfung auf `ready` und speichert den finalen Objektverweis samt validierten Metadaten.
5. Der Composer referenziert die Convex-Asset-ID. Autorisierte Vorschauen werden möglichst direkt über R2 ausgeliefert.
6. Der Publisher lädt das endgültige Medium bei Bedarf aus R2 und überträgt es nach den Anforderungen der jeweiligen Social-Plattform. Provider-Media-IDs sind getrennte, gegebenenfalls ablaufende Werte.

Kurzlebige signierte URLs werden bei Bedarf neu ausgestellt. Sie sind keine dauerhaften Referenzen im Entwurf und dürfen nicht in allgemeinen Logs landen. R2-Credentials bleiben serverseitig.

## Datenmodell und Invarianten

- `mediaAssets` bleibt in Convex mit eigener Domain-ID und `workspaceId`.
- Die bisherige Bindung an `Id<"_storage">` wird bei Umsetzung durch `storageProvider = "r2"`, einen serverseitigen Bucket-Verweis und finalen Objektschlüssel ersetzt.
- Validierter Dateityp, Größe, Dimensionen und Inhaltsprüfsumme werden gespeichert; Status und Uploadfortschritt sind explizit.
- Nur vollständig validierte Assets dürfen freigegeben und veröffentlicht werden.
- Änderungen erzeugen ein neues finales Objekt und eine neue Entwurfsversion. Ein noch gültiger Upload-Link darf eine bereits freigegebene Datei nicht verändern.
- Medienbezogene veröffentlichungsrelevante Angaben wie Alt-Text bleiben an die freigegebene Inhaltsversion gebunden.
- R2 und Convex besitzen keine gemeinsame Transaktion. Finalisierung, Abgleich und Löschung werden wiederholbar und mit gespeicherten Zwischenschritten umgesetzt. Parallele Finalisierungen erzeugen nicht mehrere sichtbare Assets.
- Eine Löschung sperrt neue Referenzen und konkurrierende Publishing-Claims; eine Workspace-Löschung sperrt auch neue Finalisierungen. Nicht referenzierte temporäre und verwaiste Objekte erhalten einen kontrollierten Bereinigungspfad. Löschmarkierungen und eine Nachbereinigung nach Ablauf erteilter Uploadberechtigungen erfassen auch zwischenzeitlich erneut hochgeladene temporäre Objekte.
- Ein Convex-Datenbank-Backup sichert nicht automatisch die R2-Medien. Restore und Medienverfügbarkeit müssen gemeinsam geprüft werden.

## Konsequenzen für den Plan

Die Entscheidung ist im [Gesamtplan](../dispatch-end-to-end-implementation-plan.md) verankert:

- P00.01: R2-Zugang, Transferpfade und Kosten praktisch prüfen.
- P02.03: Direkte Uploads, Validierung, Finalisierung, Vorschau und Bereinigung.
- P03.03: R2-Abruf und anschließender Plattform-Upload im Publisher.
- P09.03: Koordinierte Daten-/Objektlöschung.
- P09.06: Getrennte Umgebungen und gemeinsame Recovery-Prüfung.

Die ursprünglichen Medienvorgaben in PRD §11.12, V1-Plan Ticket 3.1 und `.docs/schema.ts` sind durch diese Entscheidung überholt. Sie bleiben als Ausgangsdokumente erhalten; ihre Convex-Storage-Bindung ist kein aktueller Implementierungsauftrag.

## Kosten und offene Implementierungsprüfungen

Die Aufteilung beseitigt weder Convex-Datenbankkosten noch Agent-/Workflow-Ausführungskosten. R2 hat eigene Speicher- und Operationskosten. Muss der Publisher Medien durch eine Convex Action an die Social-Plattform übertragen, wird dieser tatsächliche Ausführungs- und Transferpfad gesondert gemessen.

Vor Umsetzung werden die vorhandene Convex-R2-Komponente, Uploadgrenzen, sichere Finalisierung, große/abgebrochene Uploads und der Medien-Upload zu X getestet. Ein zusätzlicher Cloudflare Worker wird nur bei einem nachgewiesenen technischen Bedarf eingeführt; die gewählte Aufteilung verlangt ihn nicht automatisch.

Technische Referenzen: [Convex R2 Component](https://github.com/get-convex/r2), [R2 Pricing](https://developers.cloudflare.com/r2/pricing/).
