---
id: TASK-1
title: Provider-Zugänge und Kostenmodell prüfen (P00.01)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
labels:
  - p00
  - r0
milestone: m-0
dependencies: []
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine datierte Capability-Matrix unterscheidet technisch dokumentiert, im eigenen Zugang getestet und nicht verfügbar.
- [ ] #2 Jede Pflichtfunktion hat einen nutzbaren Pfad oder einen ausdrücklich beschlossenen reduzierten Umfang.
- [ ] #3 Keine Veröffentlichung eines Recherche-Versprechens ohne passenden Zugang.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
