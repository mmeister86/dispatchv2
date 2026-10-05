---
id: TASK-5
title: Authentifizierung und Workspace-Isolation umsetzen (P01.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 09:29'
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
- [x] #1 Wiederholte erste Requests erzeugen keine doppelten Workspaces.
- [ ] #2 ein zweiter Nutzer kann IDs fremder Entwürfe, Medien, Runs und Accounts weder lesen noch verändern.
- [ ] #3 GitHub-Login gewährt keinen Repository-Zugriff.
- [ ] #4 Login, Reload, Logout, Verifikation und Reset funktionieren über die tatsächlichen Frontend-/Auth-Domains einschließlich verweigerter fremder Origins.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Better Auth Component mit Email-Verifikation und Reset sowie optionalem GitHub-Login konfigurieren.
2. User/Owner/Default-Workspace atomar und idempotent anlegen; jede Domainoperation serverseitig autorisieren.
3. UI-Session-Gate, Rückkehrroute, Login/Logout/Reload umsetzen.
4. Isolation und Auth über tatsächliche Dev-Domains prüfen; fehlende Providerkonfiguration dokumentieren.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /login, /signup, /verify, /reset-password. Local login/registration, email confirmation/reset flow previews, GitHub sign-in button and error/session-expired scenarios. Grenze: No real authentication, account creation, OAuth, email delivery or server-side tenant isolation. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Atomare idempotente Provisionierung und zentrale Authz geprüft; isolierte echte Auth-HTTP-Handler inklusive Verifikation, JWT, Reset und Session-Widerruf getestet. Auth-Rücksprung und drei reale UI-Moduswechsel unabhängig geprüft (test:e2e:auth 3/3). Live Inbox/GitHub-OAuth und Tenant-Negatives für kommende Domains bleiben offen. Tasks bleiben In Progress.
<!-- SECTION:NOTES:END -->
