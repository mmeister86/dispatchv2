---
id: TASK-5
title: Authentifizierung und Workspace-Isolation umsetzen (P01.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p01
  - r0
milestone: m-0
dependencies:
  - TASK-4
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P01.02.
Phase: P01 – Anwendung, Identität und persönlicher Kontext.

**Abhängigkeit:** P01.01. **Dateien:** `convex/auth.ts`, `convex/auth.config.ts`, `convex/convex.config.ts`, `convex/http.ts`, `convex/users.ts`, `convex/workspaces.ts`, `convex/lib/authz.ts`, `src/features/auth/client.ts`, Auth-Routen; Tests `convex/workspaces.test.ts`, `tests/e2e/auth.spec.ts`.

- E-Mail/Passwort, Verifikation, Reset und GitHub-Login einrichten; Google bleibt optionaler zusätzlicher Login.
- Die Convex-Better-Auth-Integration für React/Vite verwenden: kompatible Better-Auth-Version, Component-Adapter, Auth-Konfiguration, `crossDomain`/`crossDomainClient`, `convexClient`, `ConvexBetterAuthProvider`, erlaubte Origins und HTTP-Routen mit CORS. Convex-Client-URL und Auth-/HTTP-Site-URL unterscheiden; Social-Login-Callbacks auf der Auth-Site registrieren.
- Den E-Mail-Versand für Verifikation und Reset bereits hier als funktionierende Grundlage bereitstellen; P09.02 ergänzt später Zustellüberwachung und Präferenzen. Die unverifizierte Beispielkonfiguration des Quickstarts ist keine Produktvorgabe.
- Domain-User und Default-Workspace idempotent anlegen, Owner-Mitgliedschaft atomar erstellen.
- Zentrale Prüfungen für User, Workspace-Rolle und workspacegleiche Referenzen implementieren.
- Logout, Session-Ablauf, Rückkehr zur angefragten Route und verständliche Fehlerzustände gestalten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Wiederholte erste Requests erzeugen keine doppelten Workspaces.
- [ ] #2 ein zweiter Nutzer kann IDs fremder Entwürfe, Medien, Runs und Accounts weder lesen noch verändern.
- [ ] #3 GitHub-Login gewährt keinen Repository-Zugriff.
- [ ] #4 Login, Reload, Logout, Verifikation und Reset funktionieren über die tatsächlichen Frontend-/Auth-Domains einschließlich verweigerter fremder Origins.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
