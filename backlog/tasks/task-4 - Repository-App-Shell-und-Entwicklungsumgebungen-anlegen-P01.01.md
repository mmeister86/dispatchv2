---
id: TASK-4
title: 'Repository, App-Shell und Entwicklungsumgebungen anlegen (P01.01)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p01
  - r0
milestone: m-0
dependencies:
  - TASK-2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P01.01.
Phase: P01 – Anwendung, Identität und persönlicher Kontext.

**Abhängigkeit:** P00.02. **Dateien:** `package.json`, Lockfile, `vite.config.ts`, `vitest.config.ts`, `src/main.tsx`, `src/router.tsx`, `src/routes/__root.tsx`, `convex/schema.ts`, `.env.example`, `README.md`.

- Vorhandenen Git-Stand prüfen, nur falls nötig initialisieren; Konfiguration und geheime lokale Werte sauber trennen.
- Frontend und Convex mit den geprüften Versionen verbinden; Routing, Styling und wiederverwendbare UI-Basis einrichten.
- Benötigte Convex-Komponenten in `convex/convex.config.ts` registrieren und generierte Typen als Voraussetzung der Integrationen bereitstellen. Für das statische Cloudflare-Frontend SPA-Fallback und direkte Navigation auf Auth-/Workspace-Routen konfigurieren.
- Lokale Entwicklung, Test/Staging und Produktion logisch und hinsichtlich Provider-Zugängen trennen.
- Lint, Typecheck, Domain-Tests und Build als dokumentierte Skripte und CI-Prüfungen anlegen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Leere App startet.
- [ ] #2 Build und Typecheck bestehen.
- [ ] #3 öffentliche Bundle-Konfiguration enthält keine Server-Secrets.
- [ ] #4 eine direkte Navigation auf eine Unterroute funktioniert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: / and all application routes. React 19 / TypeScript / Vite 8 app shell, shadcn/ui primitives, reusable components and direct client routing. Grenze: No Convex registration, cloud deployment, production domains or secret-bearing backend. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
