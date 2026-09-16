# Dispatch – Product Requirements Document

**Produkt:** Dispatch  
**Domain:** `usedispat.ch`  
**Dokumenttyp:** Product Requirements Document  
**Status:** Initiale Produktspezifikation  
**Primäre Plattform:** Web  
**Primärer Social-Media-Kanal:** X / Twitter  
**Langfristige Plattformstrategie:** Multi-Channel Social Publishing  
**Zielgruppe V1:** Entwickler, Indie Hacker, Gründer und technisch orientierte Creator

---

# 1. Executive Summary

Dispatch ist ein AI-gestütztes Social-Media-Planning- und Publishing-Tool mit initialem Schwerpunkt auf X.

Im Gegensatz zu klassischen Social-Media-Schedulern beginnt Dispatch nicht erst beim Verfassen eines Posts. Das Produkt beobachtet kontinuierlich relevante Signale aus der Arbeit des Nutzers und aus dessen Umfeld, beispielsweise:

- GitHub Commits und Pushes
- Releases und Pull Requests
- aktuelle X-Trends
- relevante X-Posts
- aktuelle Web-Themen
- manuelle Notizen
- Unterhaltungen mit dem Dispatch-Agenten
- Performance bereits veröffentlichter Inhalte

Diese Signale werden durch einen AI-Agenten bewertet und miteinander in Beziehung gesetzt. Daraus entstehen Content-Ideen, konkrete Post-Entwürfe und schließlich ein geplanter Content-Kalender.

Der zentrale Produktfluss lautet:

**Signal → Research → Idea → Draft → Approval → Schedule → Publish → Performance → neues Signal**

Dispatch soll sich dadurch langfristig nicht wie ein klassisches Social-Media-Tool anfühlen, sondern wie ein persönliches Content Operating System.

Die erste Version fokussiert sich auf Einzelanwender und X. Die technische Architektur soll jedoch von Beginn an Workspaces, mehrere Social Accounts und weitere Publishing-Plattformen ermöglichen.

---

# 2. Vision

Dispatch soll die Lücke zwischen dem tatsächlichen Arbeiten eines Nutzers und dessen öffentlicher Kommunikation schließen.

Ein Entwickler sollte nicht nach einem produktiven Arbeitstag überlegen müssen:

> „Was könnte ich heute posten?“

Dispatch soll bereits erkannt haben:

- was entwickelt wurde,
- welche Änderungen relevant sind,
- welche Themen gerade diskutiert werden,
- welche eigenen Projekte dazu passen,
- welche Content-Themen zuletzt verwendet wurden,
- und wann im bestehenden Kalender Platz für einen neuen Post ist.

Das Produkt soll daraus eigenständig sinnvolle Vorschläge erstellen.

Langfristig lautet die Vision:

> Dispatch understands what you are working on, what your audience currently cares about and what you should talk about next.

---

# 3. Problem Statement

Content-Erstellung ist insbesondere für Entwickler, Gründer und Indie Hacker fragmentiert.

Die eigentliche Arbeit findet beispielsweise in:

- GitHub,
- IDEs,
- Produktmanagement-Tools,
- Chats,
- Recherche,
- Kundenfeedback

statt.

Social-Media-Kommunikation findet davon getrennt statt.

Der Nutzer muss daher regelmäßig:

1. überlegen, was interessant genug für einen Post ist,
2. vergangene Arbeit rekonstruieren,
3. aktuelle Themen recherchieren,
4. daraus einen geeigneten Angle entwickeln,
5. einen Post schreiben,
6. einen geeigneten Veröffentlichungszeitpunkt finden,
7. den Post veröffentlichen,
8. später seine Performance bewerten.

Bestehende Scheduler lösen überwiegend die letzten drei Punkte.

Dispatch soll insbesondere die Schritte davor automatisieren.

---

# 4. Product Principles

## 4.1 Signals before Content

Ein GitHub Commit ist kein Post.

Ein Trend ist kein Post.

Ein Artikel ist kein Post.

Alle externen Ereignisse werden zunächst als **Content Signals** betrachtet.

Erst die Kombination aus Relevanz, Kontext, Research und Content-Strategie entscheidet darüber, ob daraus Content entsteht.

---

## 4.2 Human-controlled autonomy

Dispatch darf selbständig:

- recherchieren,
- Signale analysieren,
- Ideen erzeugen,
- Entwürfe erstellen,
- Content-Pläne vorschlagen.

Autonome Veröffentlichung soll jedoch eine explizite Workspace-Einstellung sein.

Default für V1:

**Human approval required.**

---

## 4.3 Explainable AI

Der Nutzer soll nachvollziehen können, warum der Agent einen Content-Vorschlag gemacht hat.

Beispiel:

> Dieser Vorschlag basiert auf deinem heutigen GitHub Push in `lemonspace`, einem aktuell stark diskutierten Thema zu AI Agents und deinem Content Pillar „Building in Public“.

---

## 4.4 Provider Independence

Die Kernlogik darf nicht direkt von einem einzelnen LLM- oder Payment-Provider abhängig sein.

Beispiele:

- Requesty abstrahiert LLM-Anbieter.
- Billing wird intern über eigene Subscription- und Entitlement-Daten modelliert.
- Social Platforms werden über Provider-spezifische Integrationen angebunden.

---

## 4.5 Privacy by Design

Dispatch soll insbesondere für europäische Nutzer datensparsam aufgebaut werden.

Es sollen nur Daten gespeichert werden, die für konkrete Produktfunktionen notwendig sind.

---

# 5. Goals

## 5.1 Primary Goals

V1 soll einem Nutzer ermöglichen:

1. einen Dispatch-Account anzulegen,
2. einen Workspace zu erstellen,
3. einen X-Account zu verbinden,
4. GitHub zu verbinden,
5. ausgewählte Repositories überwachen zu lassen,
6. automatisch Content Signals aus GitHub-Aktivität zu erzeugen,
7. aktuelle Themen über Web und X zu recherchieren,
8. mit einem AI-Agenten über Content zu sprechen,
9. Content-Ideen automatisch erstellen zu lassen,
10. X-Posts und Threads automatisch generieren zu lassen,
11. diese Entwürfe zu bearbeiten,
12. Posts über einen grafischen Kalender zu planen,
13. Medien hinzuzufügen,
14. Posts automatisch zum geplanten Zeitpunkt auf X zu veröffentlichen.

---

# 6. Non-Goals für V1

Nicht Bestandteil der ersten Version sind:

- LinkedIn Publishing
- Bluesky Publishing
- Mastodon Publishing
- Instagram Publishing
- Facebook Publishing
- TikTok Publishing
- komplexe Team-Freigabeworkflows
- Social Inbox
- Reply Management
- Community Management
- vollständige Wettbewerbsanalyse
- vollautonome Social-Media-Steuerung
- umfangreiche CRM-Funktionen
- eigener LLM-Provider
- eigener E-Mail-Service
- eigener Payment Stack

Diese Funktionen sollen durch das Domainmodell nicht verhindert werden, werden aber nicht für den initialen Release implementiert.

---

# 7. Target Users

## 7.1 Primary Persona: Builder

Typische Nutzer:

- Softwareentwickler
- Indie Hacker
- SaaS-Gründer
- AI Builder
- technische Creator

Eigenschaften:

- arbeitet regelmäßig in GitHub,
- möchte online sichtbarer werden,
- hat wenig Interesse an klassischem Social-Media-Management,
- möchte über eigene Arbeit sprechen,
- möchte nicht täglich Content recherchieren,
- nutzt AI bereits aktiv.

---

## 7.2 Secondary Persona: Founder / Creator

Nutzer, die regelmäßig Inhalte veröffentlichen, jedoch nicht ausschließlich über Softwareentwicklung.

Dispatch kann hier beispielsweise aus:

- manuellen Notizen,
- Web-Recherche,
- X-Trends,
- bisherigen Posts

Content entwickeln.

---

# 8. Jobs to be Done

Der Nutzer möchte Dispatch verwenden, um:

> Wenn ich an meinen Projekten arbeite, automatisch relevante Content-Ideen daraus entstehen zu lassen.

> Wenn relevante Themen auf X entstehen, schnell erkennen zu können, ob diese zu meinen Projekten und Themen passen.

> Wenn ich nächste Woche Content veröffentlichen möchte, einen sinnvollen Wochenplan vorgeschlagen zu bekommen.

> Wenn ich einen Post veröffentlichen möchte, nicht bei einem leeren Textfeld beginnen zu müssen.

> Wenn mein Content Agent Vorschläge erstellt, nachvollziehen zu können, warum er diese erstellt.

---

# 9. Core Product Loop

```text
External Event
     ↓
Content Signal
     ↓
Signal Evaluation
     ↓
Optional Research
     ↓
Content Idea
     ↓
Draft
     ↓
Review / Edit
     ↓
Schedule
     ↓
Publish
     ↓
Performance
     ↓
Future Agent Context
```

Dieser Loop bildet die zentrale Domainlogik des Produkts.

---

# 10. User Journey

## Phase 1 – Onboarding

Der Nutzer:

1. registriert sich,
2. bestätigt seine E-Mail-Adresse,
3. erstellt automatisch einen Default Workspace,
4. verbindet seinen X-Account,
5. verbindet optional GitHub,
6. wählt relevante GitHub-Repositories aus,
7. definiert grundlegende Content-Präferenzen.

Danach gelangt der Nutzer zum Dashboard.

---

## Phase 2 – Signals

Dispatch erkennt beispielsweise:

> Push auf `lemonspace`

Der Push wird als `contentSignal` gespeichert.

Der Workflow analysiert:

- Commit Messages
- veränderte Dateien
- Diff-Zusammenfassung
- Repository-Kontext
- potenzielle Nutzerrelevanz

Danach erhält das Signal Scores für:

- relevance
- novelty
- confidence

---

## Phase 3 – Idea Generation

Ein ausreichend relevantes Signal kann durch den Content Agent verarbeitet werden.

Beispiel:

GitHub Signal:

> Added AI-based report generation

X Research:

> Agentic workflows werden aktuell stark diskutiert.

Content Idea:

> Was ich beim Aufbau eines AI-Agenten für Lemonspace gelernt habe.

---

## Phase 4 – Drafting

Aus einer Idea entsteht ein Draft.

Formate V1:

- Single X Post
- X Thread

Der Nutzer kann:

- Text bearbeiten,
- AI-Überarbeitung auslösen,
- Medien hinzufügen,
- den Draft verwerfen,
- den Draft freigeben.

---

## Phase 5 – Planning

Der Nutzer kann den Draft:

- manuell planen,
- per Drag & Drop im Kalender verschieben,
- durch den Agenten einplanen lassen.

---

## Phase 6 – Publishing

Zum geplanten Zeitpunkt startet Convex einen Publishing Workflow.

Der Workflow:

1. lädt die freigegebene Draft-Version,
2. validiert X Credentials,
3. lädt erforderliche Medien hoch,
4. veröffentlicht den Post beziehungsweise Thread,
5. speichert die externe X Post ID,
6. aktualisiert den Status.

---

# 11. Functional Requirements

# 11.1 Authentication

Dispatch verwendet Better Auth.

Unterstützte Login-Verfahren für V1:

- E-Mail + Passwort
- GitHub OAuth
- optional Google OAuth

Funktionen:

- Registrierung
- Login
- Logout
- E-Mail-Verifikation
- Password Reset
- Session Management

Wichtig:

GitHub Authentication und GitHub Repository Integration sind technisch getrennte Funktionen.

---

# 11.2 Workspaces

Jeder Nutzer erhält bei Registrierung einen Default Workspace.

Beispiel:

`Matthias's Workspace`

Ein Workspace ist der zentrale Tenant des Systems.

Nahezu alle Produktdaten gehören einem Workspace.

V1 Rollen:

- owner
- admin
- editor
- viewer

V1 kann zunächst nur den Owner aktiv verwenden. Das Datenmodell muss Teams jedoch unterstützen.

---

# 11.3 GitHub Integration

Dispatch verwendet eine GitHub App.

Der Nutzer kann:

- GitHub verbinden,
- GitHub Organisation oder persönlichen Account auswählen,
- Zugriff auf bestimmte Repositories erlauben,
- einzelne Repositories für Dispatch aktivieren oder deaktivieren.

V1 Events:

- Push
- Release

Optional nach V1:

- Pull Request
- Issue
- Discussion

---

# 11.4 GitHub Signal Processing

Bei einem relevanten GitHub Webhook:

1. Webhook validieren
2. Event deduplizieren
3. Repository identifizieren
4. Content Signal anlegen
5. GitHub Kontext nachladen
6. Änderungen analysieren
7. Signal zusammenfassen
8. Relevanz bewerten
9. bei ausreichender Relevanz Content-Agent triggern

Nicht jeder Commit erzeugt automatisch einen Draft.

---

# 11.5 X Integration

Der Nutzer verbindet seinen X Account über OAuth.

Erforderliche Möglichkeiten:

- Account lesen
- Posts veröffentlichen
- X-Recherche durchführen
- Trends abrufen
- Refresh Token verwenden

Token Lifecycle muss serverseitig verwaltet werden.

Bei abgelaufenem oder ungültigem Token:

`socialAccount.status = reauth_required`

Der Nutzer wird in der Anwendung und optional per E-Mail informiert.

---

# 11.6 Research

Dispatch unterstützt zwei Research-Arten.

## Web Research

Mögliche Quellen:

- Requesty Model mit nativer Websuche
- Tool-based Search

Ergebnis:

- Zusammenfassung
- Quellen
- Relevanz
- mögliche Content-Angles

## X Research

Research kann enthalten:

- X Trends
- Recent Search
- relevante Posts
- Engagement-Signale
- wiederkehrende Themen

Research-Ergebnisse werden als `researchItems` gespeichert.

---

# 11.7 Research Inbox

Eine dedizierte UI zeigt interessante Research-Ergebnisse.

Ein Research Item enthält:

- Topic
- Summary
- Quellen
- Relevance Score
- mögliche Content Angles

Nutzeraktionen:

- Idea erstellen
- ignorieren
- archivieren
- Agent dazu befragen

---

# 11.8 Content Signals

Signal-Typen:

- `github_push`
- `github_release`
- `github_pull_request`
- `x_trend`
- `web_topic`
- `manual_note`
- `conversation`
- `performance_signal`

Signalstatus:

- new
- processed
- ignored
- archived

Optionale Scores:

- relevanceScore
- noveltyScore
- confidenceScore

---

# 11.9 Content Ideas

Eine Idea repräsentiert die strategische Ebene zwischen Signal und Text.

Eine Idea enthält:

- Titel
- Angle
- Beschreibung
- Quellsignale
- Research
- Priorität
- Status

Status:

- suggested
- accepted
- rejected
- drafted
- archived

---

# 11.10 Drafts

Ein Draft ist ein konkretes Social-Media-Artefakt.

V1 Plattform:

- X

V1 Formate:

- single
- thread

Status:

- draft
- needs_review
- approved
- rejected
- scheduled
- published

---

# 11.11 Draft Versioning

Jede relevante Textänderung erzeugt eine Draft Version.

Dadurch können später verglichen werden:

- Agent Original
- User Edit
- veröffentlichte Version

Ein `scheduledPost` referenziert immer eine konkrete `draftVersion`.

Dadurch dürfen nachträgliche Änderungen nicht unbeabsichtigt einen bereits geplanten Post verändern.

---

# 11.12 Media Assets

Medien werden über Convex Storage gespeichert.

V1 unterstützte Medientypen:

- Bilder
- GIF
- X-kompatible Videos

Media Asset Metadata:

- Storage ID
- MIME Type
- Filename
- File Size
- Dimensions
- Alt Text
- Source

Sources:

- upload
- generated
- github
- external

---

# 11.13 Calendar

Dispatch besitzt einen grafischen Content-Kalender.

Views:

- Week
- Month

Optional:

- Agenda/List

Der Kalender zeigt:

- Drafts
- Scheduled Posts
- Published Posts

Elemente sollen per Drag & Drop verschoben werden können.

Das Verschieben eines geplanten Posts aktualisiert:

`scheduledFor`

und plant den Convex Job neu.

---

# 11.14 Scheduling

Jeder Scheduled Post enthält:

- Draft
- konkrete Draft-Version
- Social Account
- Scheduling Zeitpunkt
- Timezone
- Status

Status:

- scheduled
- publishing
- published
- failed
- cancelled

---

# 11.15 Publishing

Publishing erfolgt über einen durable Convex Workflow.

Single Post:

1. Draft Version laden
2. Account validieren
3. Media vorbereiten
4. X API aufrufen
5. Ergebnis speichern

Thread:

1. ersten Post veröffentlichen
2. externe ID speichern
3. nächsten Post als Reply veröffentlichen
4. Vorgang fortsetzen
5. Thread Ergebnis speichern

Publishing muss idempotent ausgelegt werden.

Ein Retry darf nicht versehentlich doppelte Posts veröffentlichen.

---

# 12. AI Agent

Der zentrale Agent wird als `Content Agent` implementiert.

V1 verwendet bewusst keinen komplexen Multi-Agent-Ansatz.

---

## 12.1 Agent Capabilities

Der Content Agent kann unter anderem:

- GitHub Signals lesen
- Repository-Kontext abrufen
- Content Calendar lesen
- bestehende Drafts lesen
- Research durchführen
- X durchsuchen
- X Trends analysieren
- Content Ideas erstellen
- Drafts erstellen
- Drafts überarbeiten
- Content planen
- Approval anfordern

---

## 12.2 Agent Tooling

Beispieltools:

```text
getRecentSignals
getGithubContext
getRepositoryChanges

searchWeb
searchX
getXTrends

getCalendar
getPreviousPosts

createContentIdea
createDraft
updateDraft

scheduleDraft
requestApproval
```

Tools werden serverseitig über Convex implementiert.

---

# 13. Agent Workflows

Agent und Workflow haben unterschiedliche Verantwortlichkeiten.

## Agent

Entscheidet:

- was relevant ist,
- welche Informationen benötigt werden,
- welche Tools aufgerufen werden,
- welchen Content Angle er vorschlägt.

## Workflow

Verantwortet:

- Durability
- Retries
- Scheduling
- State
- Fehlerbehandlung

Beispiel GitHub Workflow:

```text
Webhook
→ saveSignal
→ loadGitHubContext
→ summarizeChanges
→ evaluateSignal
→ callContentAgent
→ saveIdeas
```

---

# 14. Agent Chat

Dispatch enthält einen persistenten Agent Chat.

Beispielanfragen:

> Plane mir nächste Woche fünf Posts.

> Gibt es heute interessante AI-Themen?

> Schreib mir einen Post über den heutigen StackDex Commit.

> Der zweite Entwurf klingt zu werblich. Schreib ihn persönlicher.

> Verschiebe den Post am Donnerstag auf Freitag.

Der Agent muss über Tools echte Produktaktionen ausführen können.

---

# 15. Agent Memory und Context

Der Agent erhält Workspace-spezifischen Kontext.

Beispiele:

- Content Preferences
- bisherige Posts
- relevante GitHub Projekte
- User Feedback
- angenommene Drafts
- verworfene Drafts
- überarbeitete Drafts

Perspektivisch:

- Content Pillars
- Style Profiles
- Performance Signals

---

# 16. Content Planning

Eine spätere V1.x-Funktion soll komplette Zeiträume planen können.

Beispiel:

> Plane meine nächste Woche.

Agent berücksichtigt:

- vorhandenen Kalender
- aktuelle Signale
- Research
- Themenvielfalt
- Posting-Frequenz
- vorherige Posts

Ergebnis ist zunächst ein Planvorschlag.

---

# 17. Data Model V1

V1 Kernentitäten:

```text
users
workspaces
memberships

integrations
repositories
socialAccounts

contentSignals
researchItems
contentIdeas

drafts
draftVersions
mediaAssets

scheduledPosts
publishedPosts

agentRuns
systemEvents
```

---

# 18. Entity Relationships

```text
User
  ↓
Membership
  ↓
Workspace
  │
  ├── Integration
  │      ├── Repository
  │      └── SocialAccount
  │
  ├── ContentSignal
  │        ↓
  ├── ResearchItem
  │        ↓
  ├── ContentIdea
  │        ↓
  ├── Draft
  │        ↓
  ├── DraftVersion
  │        ↓
  ├── ScheduledPost
  │        ↓
  └── PublishedPost
```

---

# 19. Tenant Isolation

`workspaceId` ist die zentrale Tenant-Grenze.

Alle Workspace-bezogenen Serverfunktionen müssen:

1. authentifizierten User bestimmen,
2. Membership prüfen,
3. Workspace Scope erzwingen.

Ein User darf niemals durch Client-Parameter auf Daten fremder Workspaces zugreifen können.

---

# 20. Technology Stack

## Frontend

- Vite
- React
- TypeScript
- TanStack Router
- Tailwind CSS
- shadcn/ui

---

## Hosting

- Cloudflare

Produkt:

`usedispat.ch`

Anwendung:

`app.usedispat.ch`

---

## Backend

- Convex Cloud

Verwendung für:

- Realtime Database
- Queries
- Mutations
- Actions
- HTTP Actions
- Scheduler
- Workflows
- Agent State
- Rate Limiting
- Storage

---

## Authentication

- Better Auth
- Convex Integration

---

## AI

- Convex Agent
- Convex Workflows
- Vercel AI SDK
- Requesty

Requesty dient als Model Gateway.

Mögliche Models:

- OpenAI
- Anthropic
- Google
- weitere Requesty Provider

---

## Social

- X API

---

## Source Integration

- GitHub App
- GitHub Webhooks
- GitHub API

---

## Payments

- Stripe
- Stripe Managed Payments

---

## Transactional Email

- Resend

---

## Analytics

- Rybbit

Verwendung für:

- Pageviews
- Product Events
- Funnels
- Retention
- User Journeys
- Session Replay
- grundlegendes Client Error Tracking

---

# 21. Product Analytics Events

V1 sollte mindestens folgende Events tracken:

```text
signup_completed
workspace_created

github_connected
repository_enabled

x_connected

signal_created
research_started
research_completed

idea_created
idea_accepted
idea_rejected

draft_created
draft_edited
draft_approved
draft_rejected

post_scheduled
post_rescheduled
post_published
post_publish_failed

agent_chat_started
agent_plan_created

subscription_started
subscription_cancelled
```

Keine sensiblen Content-Inhalte sollen unnötig an Rybbit übertragen werden.

---

# 22. Agent Observability

Agent Runs werden zusätzlich in Convex protokolliert.

Ein Agent Run enthält:

- Workspace
- Trigger
- Purpose
- Model
- Status
- Start
- Ende
- Token Usage
- Estimated Cost
- Fehler

Beispiele für Trigger:

- user_message
- github_signal
- research
- scheduled_planning
- manual

---

# 23. System Events

Technische Events werden strukturiert erfasst.

Sources:

- github
- x
- stripe
- requesty
- resend
- agent
- system

Severity:

- info
- warning
- error
- critical

---

# 24. Transactional Emails

Resend wird für alle transaktionalen E-Mails verwendet.

V1:

- E-Mail-Verifikation
- Password Reset
- X Reauthentication erforderlich
- Scheduled Post fehlgeschlagen

Später:

- Weekly Content Summary
- Workspace Invitation
- Billing Notifications

---

# 25. Billing

Billing ist nicht zwingend erforderlich für den privaten Alpha-Betrieb, das Domainmodell soll SaaS jedoch unterstützen.

Provider:

Stripe Managed Payments.

Interne Planstruktur soll von Stripe entkoppelt sein.

Beispiel:

```text
free
pro
team
```

Produktfeatures werden nicht direkt über `plan === "pro"` geprüft.

Stattdessen werden Entitlements verwendet.

Beispiel:

```text
aiGeneration
xResearch
agentPlanning
maxRepositories
maxScheduledPosts
```

---

# 26. Background Jobs

Background Processing läuft über Convex.

Anwendungsfälle:

- GitHub Signal Processing
- Research
- AI Generation
- Publishing
- Retry
- Token Refresh
- später Analytics Sync

Es soll für V1 kein zusätzlicher Queue-Service eingeführt werden.

---

# 27. Rate Limiting

Rate Limits werden providerbezogen behandelt.

Beispiele:

```text
x_publish
x_search
x_trends
github_api
requesty
```

Ein Rate Limit eines Providers darf andere Workflows möglichst nicht blockieren.

---

# 28. Security

## Secrets

Folgende Secrets dürfen ausschließlich serverseitig vorliegen:

- GitHub App Private Key
- GitHub Webhook Secret
- X Client Secret
- X Access/Refresh Tokens
- Requesty API Key
- Stripe Secret
- Stripe Webhook Secret
- Resend API Key

Keine Secrets dürfen im Vite Bundle landen.

---

## OAuth Tokens

OAuth Tokens müssen:

- ausschließlich serverseitig gespeichert,
- niemals an den Browser ausgeliefert,
- bei Revocation invalidiert,
- bei Ablauf erneuert

werden.

---

# 29. Privacy / GDPR

Dispatch wird datensparsam konzipiert.

Grundsätze:

- minimale personenbezogene Daten
- keine unnötigen Tracking Provider
- kein Verkauf von User-Daten
- transparenter Einsatz von AI
- einfache Account-Löschung
- einfache Workspace-Löschung
- Entfernung verbundener Integrationen
- Löschung gespeicherter OAuth Credentials
- definierte Retention für System Logs

Rybbit wird insbesondere wegen seiner datensparsamen Produktanalytics verwendet.

---

# 30. Reliability Requirements

Publishing ist eine kritische Produktfunktion.

Deshalb gelten besondere Anforderungen.

## Must Have

- Publishing Workflow darf nach temporären Fehlern fortgesetzt werden.
- API Rate Limits müssen respektiert werden.
- ein Retry darf keinen doppelten X Post erzeugen.
- fehlgeschlagene Posts müssen sichtbar sein.
- Fehlerursache muss nachvollziehbar sein.
- Nutzer muss erneut veröffentlichen können.
- abgelaufene X Credentials müssen erkannt werden.

---

# 31. Performance

Die Anwendung soll sich wie eine lokale SaaS-Anwendung anfühlen.

TanStack Router soll unter anderem Link Prefetching verwenden.

Convex Realtime soll Datenänderungen direkt in der Oberfläche aktualisieren.

Ziel:

- Navigation ohne wahrnehmbare Full Page Reloads
- optimistische UI, wo sinnvoll
- schnelle Kalenderinteraktion
- Draft Editing ohne unnötige Netzwerklatenz

---

# 32. Core Routes

V1 Routing:

```text
/
├── landing
│
├── login
├── signup
│
└── app
    ├── overview
    ├── calendar
    ├── drafts
    │    └── $draftId
    ├── ideas
    ├── signals
    ├── research
    │    └── $researchId
    ├── agent
    └── settings
         ├── general
         ├── github
         ├── social
         └── billing
```

---

# 33. Dashboard

Das Dashboard soll einen schnellen Überblick liefern.

V1 Widgets:

- nächste geplante Posts
- aktuelle Drafts
- neue Signals
- aktuelle Research Topics
- GitHub Activity
- Agent Suggestions

---

# 34. Main Navigation

Empfohlene Hauptnavigation:

```text
Overview

Calendar
Drafts
Ideas
Research

Agent

Settings
```

Signals können zunächst Bestandteil von Overview/Ideas sein und müssen nicht zwingend permanent in der Hauptnavigation erscheinen.

---

# 35. MVP Definition

Ein MVP gilt als vollständig, wenn folgender End-to-End-Prozess funktioniert:

### Flow A – Manual Publishing

```text
Signup
→ Connect X
→ Create Draft
→ Schedule
→ Publish automatically
```

### Flow B – GitHub Content

```text
Connect GitHub
→ Push Code
→ Webhook received
→ Signal created
→ Agent creates Draft suggestion
→ User approves
→ Schedule
→ Publish
```

### Flow C – Research

```text
Research topic
→ Web/X Research
→ Research Item
→ Agent creates Idea
→ Draft
→ Schedule
```

### Flow D – Agent

```text
"Plane mir nächste Woche 3 Posts"
→ Agent reads signals
→ researches topics
→ creates ideas
→ creates drafts
→ proposes schedule
```

---

# 36. MVP Phases

## Phase 0 – Foundation

Implementieren:

- Vite
- React
- TypeScript
- TanStack Router
- Tailwind
- shadcn/ui
- Convex
- Better Auth
- Workspace

Ziel:

Authenticated application shell.

---

## Phase 1 – X Core

Implementieren:

- X OAuth
- Social Account
- Draft
- Draft Version
- Scheduler
- X Publishing
- Error States

Ziel:

Dispatch funktioniert bereits als X Scheduler.

---

## Phase 2 – Calendar

Implementieren:

- Weekly View
- Monthly View
- Drag & Drop
- Rescheduling
- Draft Status

Ziel:

vollständiger manueller Publishing Workflow.

---

## Phase 3 – GitHub

Implementieren:

- GitHub App
- Repository Selection
- Webhooks
- Content Signals
- Signal Processing

Ziel:

Arbeit in GitHub fließt automatisch in Dispatch.

---

## Phase 4 – AI Agent

Implementieren:

- Requesty
- Vercel AI SDK
- Convex Agent
- Agent Threads
- Agent Runs
- Tools
- Draft Generation

Ziel:

GitHub Signal → AI Draft.

---

## Phase 5 – Research

Implementieren:

- Web Research
- X Search
- Trends
- Research Items
- Sources
- Agent Research Tools

Ziel:

Agent kann externe aktuelle Themen berücksichtigen.

---

## Phase 6 – Content Planning

Implementieren:

- Agent Calendar Access
- multi-post planning
- Konflikterkennung
- Content-Vorschläge

Ziel:

> Plane mir meine nächste Woche.

---

## Phase 7 – SaaS

Implementieren:

- Stripe Managed Payments
- Subscription
- Entitlements
- Usage Tracking
- Upgrade Flow

Ziel:

Dispatch kann öffentlich als SaaS angeboten werden.

---

# 37. Acceptance Criteria

## Authentication

- Nutzer kann sich registrieren.
- Nutzer kann sich anmelden.
- Nutzer kann sich abmelden.
- geschützte Routes sind ohne Session nicht erreichbar.

## Workspace

- Registrierung erzeugt einen Workspace.
- User ist Workspace Owner.
- Serverfunktionen prüfen Membership.

## X

- Nutzer kann X verbinden.
- Account wird sichtbar angezeigt.
- Token Refresh funktioniert.
- Reauth wird erkannt.

## Draft

- Nutzer kann Draft erstellen.
- Draft kann bearbeitet werden.
- Änderungen erzeugen Versionen.
- Draft kann genehmigt werden.

## Calendar

- geplanter Draft erscheint im Kalender.
- Drag & Drop verändert Zeitpunkt.
- geplante Version bleibt unverändert referenziert.

## Publishing

- X Post wird zum geplanten Zeitpunkt veröffentlicht.
- Erfolg erzeugt `publishedPost`.
- Fehler erzeugt sichtbaren Failed State.
- Retry erzeugt keine Duplikate.

## GitHub

- User kann GitHub verbinden.
- User kann Repository auswählen.
- Push wird erkannt.
- Content Signal wird erzeugt.
- irrelevante Pushes müssen keinen Draft erzeugen.

## AI

- Agent kann Signal lesen.
- Agent kann Research auslösen.
- Agent kann Idea erzeugen.
- Agent kann Draft erzeugen.
- Agent kann Kalender lesen.
- Agent kann auf Nutzeranweisung Draft verändern.

---

# 38. Success Metrics

Für eine private Alpha beziehungsweise frühe SaaS-Version sind besonders relevant:

## Activation

Anteil neuer Nutzer, die innerhalb der ersten Session:

- X verbinden
- ersten Draft erstellen
- ersten Post planen

## Integration Activation

Anteil aktiver Nutzer, die:

- GitHub verbinden
- mindestens ein Repository aktivieren

## AI Value

- AI Draft Acceptance Rate
- durchschnittliche Edit-Distanz zwischen AI Draft und Final Draft
- Rejection Rate
- Agent Suggestions → Scheduled Post Conversion

## Product Usage

- Scheduled Posts pro aktivem Nutzer
- veröffentlichte Posts pro Woche
- Agent Sessions pro Woche
- Research Sessions pro Woche

## Reliability

- Publishing Success Rate
- Publishing Retry Rate
- GitHub Webhook Processing Success Rate

---

# 39. AI Quality Metrics

Langfristig sollen AI-Vorschläge messbar verbessert werden.

Wichtige Signale:

```text
draft accepted without edit
draft accepted after small edit
draft heavily edited
draft rejected

idea accepted
idea rejected

post scheduled
post cancelled
```

Diese Daten können später verwendet werden, um Agent Instructions und Prompts zu evaluieren.

---

# 40. Risks

## X API Cost

Research kann durch viele API Reads teuer werden.

Mitigation:

- aggressive Filterung
- Caching
- gezielte Searches
- Limits pro Workspace
- Usage Tracking

---

## AI Cost

Unkontrollierte Agent-Loops können hohe Kosten verursachen.

Mitigation:

- maximale Tool Steps
- Token Limits
- Model Routing
- Usage Tracking
- Budget pro Agent Run

---

## Agent Hallucinations

Agent darf keine Produktzustände erfinden.

Mitigation:

- Produktdaten ausschließlich über Tools
- strukturierte Tool Outputs
- keine impliziten Schreiboperationen
- Server Validation

---

## Autonomous Publishing

Falscher AI Content könnte veröffentlicht werden.

Mitigation:

Default:

`requireApproval = true`

---

## External API Instability

GitHub, X, Requesty oder Stripe können temporär ausfallen.

Mitigation:

- durable Workflows
- Retry Policies
- System Events
- sichtbar degradierter Zustand

---

# 41. Future Extensions

Mögliche spätere Erweiterungen:

## Platforms

- LinkedIn
- Bluesky
- Mastodon
- Threads

## Content

- Image Generation
- Video Content
- Blog Repurposing
- Newsletter Repurposing

## Integrations

- Linear
- Notion
- Slack
- Discord
- Product Hunt
- RSS

## Intelligence

- Content Pillars
- Style Learning
- Performance Learning
- Audience Modeling
- Competitor Research
- Trending Topic Prediction
- optimal Posting Time

## Collaboration

- Team Workspaces
- Approval Workflows
- Comments
- Roles
- Clients

---

# 42. Architectural Principles

Während der Implementierung gelten folgende Regeln:

### 1. Convex ist Source of Truth

Keine parallele Business-State-Datenbank auf Cloudflare.

### 2. Cloudflare hostet primär das Frontend

Cloudflare soll nicht ohne konkreten Grund zu einem zweiten Backend werden.

### 3. Workspaces sind Tenant-Grenzen

Keine Domain-Entity gehört implizit einem User.

### 4. External IDs bleiben externe IDs

Provider IDs ersetzen keine Convex Domain IDs.

### 5. Draft-Versionen sind immutable

Scheduling referenziert konkrete Versionen.

### 6. AI schreibt über Domain APIs

Agenten dürfen Domain State nicht unkontrolliert verändern.

### 7. Signals sind keine Posts

Event Ingestion und Content Creation bleiben getrennte Prozesse.

### 8. Durable Workflows für externe Side Effects

Publishing, Research und Integrationsverarbeitung sollen wiederaufnehmbar sein.

### 9. Provider Limits sind Teil der Domain

Rate Limits und Kosten dürfen nicht erst nachträglich betrachtet werden.

### 10. YAGNI

Neue Infrastruktur wird erst eingeführt, wenn ein konkretes Problem sie verlangt.

---

# 43. Final V1 Architecture

```text
                        usedispat.ch
                             │
                             ▼
                    Cloudflare Hosting
                             │
             ┌───────────────┴───────────────┐
             │                               │
          Vite                          React UI
             │                               │
             ├── TanStack Router             │
             ├── Tailwind                    │
             └── shadcn/ui                   │
                             │
                             ▼
                       Convex Cloud
                             │
      ┌───────────────┬──────┼──────┬────────────────┐
      │               │      │      │                │
 Better Auth       Database Agent Workflow       Storage
      │                       │      │
      │                       │      ├── Scheduling
      │                       │      ├── Retry
      │                       │      └── Publishing
      │                       │
      │                       ▼
      │                 Vercel AI SDK
      │                       │
      │                    Requesty
      │
      ├────────── GitHub App
      ├────────── X API
      ├────────── Stripe
      └────────── Resend

Analytics:
Rybbit

Observability:
Rybbit
Convex Logs
agentRuns
systemEvents
```

---

# 44. Product Definition

Dispatch ist kein AI-Textegenerator mit Kalender.

Dispatch ist ein System, das:

**versteht, woran der Nutzer arbeitet, erkennt, worüber aktuell gesprochen wird, daraus passende Content-Möglichkeiten ableitet und diese von der Idee bis zur Veröffentlichung begleitet.**

Die zentrale Differenzierung entsteht durch die Verbindung aus:

**Work Signals + Live Research + Personal Context + Agentic Planning + Publishing**

Der Scheduler ist dabei nicht das Produkt selbst, sondern die letzte Stufe eines deutlich größeren Content Workflows.