# Dispatch — X Algorithm Intelligence

**Product & Technical Specification**  
Version 0.1 · Stand: 14. September 2026

## 1. Ziel und Kontext

Dispatch soll nicht nur Social-Media-Posts erstellen, planen und veröffentlichen. Für X soll Dispatch zusätzlich verstehen, welche Eigenschaften eines Posts dessen Chance auf Distribution im „For You“-Feed erhöhen oder reduzieren können.

Das öffentlich zugängliche Repository `xai-org/x-algorithm` beschreibt die aktuelle For-You-Pipeline von X. Daraus lässt sich kein garantierter „Virality Hack“ ableiten: X rankt personalisiert pro Viewer, experimentiert laufend und veröffentlicht bewusst nicht alle Anti-Gaming- und Safety-Regeln. Die veröffentlichten Komponenten liefern aber eine belastbare Grundlage für ein produktseitiges **Algorithm-Intelligence-System**.

Das Ziel lautet daher:

> **Create → Predict → Improve → Publish → Measure → Learn**

Dispatch soll vor der Veröffentlichung die erwartbare Qualität eines Posts für Discovery und Engagement einschätzen, konkrete Verbesserungen vorschlagen und nach der Veröffentlichung aus den realen Account-Ergebnissen lernen.

## 2. Was der aktuelle X-Algorithmus für Dispatch bedeutet

### 2.1 Candidate Retrieval kommt vor Ranking

Der For-You-Feed wird aus In-Network- und Out-of-Network-Kandidaten aufgebaut. Out-of-Network-Kandidaten werden unter anderem über **Phoenix Retrieval** und **SimClusters** gefunden. Phoenix verwendet Viewer- und Post-Repräsentationen; SimClusters nutzt Cluster aus Engagement-Beziehungen.

**Konsequenz für Dispatch:** Ein Post muss nicht nur „engaging“ sein. Er muss semantisch und thematisch zu den Nutzern passen, die erreicht werden sollen. Deshalb ist **Audience Fit** ein eigener Primärfaktor.

### 2.2 Ranking ist personalisierte Multi-Action-Prediction

Phoenix prognostiziert für jeden Viewer Wahrscheinlichkeiten bzw. kontinuierliche Werte für verschiedene Aktionen. Der RankingScorer kombiniert diese Vorhersagen zu einem Score.

Vereinfacht:

`Final Score = Σ (weight_i × P(action_i))`

Die Gewichte gelten **nicht für rohe Engagement-Zahlen**. Ein veröffentlichtes Gewicht von 20 für „Copy Link“ bedeutet nicht, dass ein Copy-Link-Share zwanzig Likes „wert“ wäre. Es skaliert die für einen konkreten Viewer prognostizierte Wahrscheinlichkeit dieser Aktion.

### 2.3 Aktuell sichtbare Signale

Die öffentlichen Produktions-Defaults im Repository zeigen u. a. folgende positive Gewichte:

| Signal | Default-Gewicht |
|---|---:|
| Share via Copy Link | 20.0 |
| Reply | 5.0 |
| Share via DM | 5.0 |
| Quote | 5.0 |
| Follow Author | 4.0 |
| Share | 2.0 |
| Repost | 1.0 |
| Favorite / Like | 0.5 |
| Click | 0.4 |
| Open Link | 0.2 |
| Video Open | 0.07 |
| Dwell | 0.05 |
| Photo Expand | 0.05 |

Negative Signale besitzen starke negative Gewichte, u. a. `Not Interested`, `Block Author`, `Mute Author`, `Report` und `Not Dwelled`.

**Produktimplikation:** Dispatch darf nicht auf Likes optimieren. Der wichtigere Zielraum ist:

- Audience Fit
- Conversation
- Sharing
- Follow Conversion
- meaningful Dwell
- niedrige Negative-Feedback-Wahrscheinlichkeit

### 2.4 Weitere relevante Mechanismen

Aktuell sichtbare Mechanismen im Repository:

- **Author Diversity:** weitere Posts desselben Authors im Kandidatenpool werden mit einem abnehmenden Faktor versehen.
- **Out-of-Network Discount:** Out-of-Network-Kandidaten erhalten derzeit standardmäßig einen Faktor unter 1; der öffentliche Default liegt bei 0,75.
- **New-Author / Cold-Start Mechanismen:** X kann Posts von Autoren mit wenigen Impressionen gezielt in bestimmte Positionen heben.
- **48h Age Filter:** Posts älter als 48 Stunden werden in der beschriebenen For-You-Pipeline vor dem Ranking herausgefiltert.
- **Visibility Filtering:** Ranking und Sichtbarkeit sind getrennte Systeme. Safety-, Spam- und Account-Labels können Reichweite unabhängig vom Ranking begrenzen.

## 3. Produktkonzept: Algorithm Intelligence

**Algorithm Intelligence** ist eine eigene Dispatch-Schicht zwischen Composer und Publishing.

Sie besteht aus vier Funktionen:

1. **Algorithm Profile** — versionierte, nachvollziehbare Beschreibung der bekannten Ranking- und Retrieval-Signale einer Plattform.
2. **Pre-Publish Prediction** — Analyse des Entwurfs vor Veröffentlichung.
3. **Post-Publish Learning** — Performance-Snapshots und account-spezifische Kalibrierung.
4. **Optimization UX** — konkrete, erklärbare Verbesserungsvorschläge statt automatischem Umschreiben ohne Zustimmung.

### 3.1 Kernprinzip

Dispatch versucht in V1 **nicht**, Phoenix nachzubauen. Das wäre ohne X-interne Viewer-Historien und Modellgewichte weder realistisch noch sinnvoll.

V1 beantwortet stattdessen:

> „Wie gut ist dieser Post — gemessen an den öffentlich bekannten Distributionsmechanismen und an der historischen Performance dieses Accounts — darauf vorbereitet, die gewünschte Zielgruppe zu erreichen und wertvolle Reaktionen auszulösen?“

## 4. Dispatch Reach Score

### 4.1 Score-Struktur

Der Composer erhält einen Score von 0–100 mit erklärbaren Teilwerten:

| Dimension | Zweck | V1-Gewichtung im Dispatch Score |
|---|---|---:|
| Audience Fit | thematische Passung zur Zielgruppe | 25 % |
| Share Potential | Wahrscheinlichkeit, dass Inhalte weitergegeben werden | 20 % |
| Conversation Potential | echte Reply-/Quote-Anlässe | 15 % |
| Follow Potential | Kompetenz, Originalität, Anschlussfähigkeit | 10 % |
| Dwell Potential | erwartbare sinnvolle Aufmerksamkeit | 10 % |
| Discovery Potential | Eignung für Non-Follower | 10 % |
| Content Health | geringe Irritations-/Negative-Feedback-Risiken | 10 % |

**Wichtig:** Diese Dispatch-Gewichte sind **keine Kopie der X-Ranking-Gewichte**. Sie sind ein Produktmodell, das im Laufe der Zeit mit realen Daten kalibriert wird.

### 4.2 Zwei Reichweitenperspektiven

Zusätzlich zum Gesamtscore zeigt Dispatch:

- **Follower Reach** — Eignung für bestehende Audience / In-Network.
- **Discovery Reach** — Eignung für Out-of-Network-Verteilung.

Beispiel:

```text
X Reach Score          82 / 100
Follower Reach         91
Discovery Reach        72

Audience Fit           94
Conversation           71
Shareability           88
Follow Potential       76
Dwell                   79
Negative Feedback      Low
```

## 5. Analyse-Dimensionen

### 5.1 Audience Fit

Beim Onboarding eines Social Accounts definiert der Nutzer optional eine Zielgruppe, z. B.:

`Indie hackers, SaaS founders, product designers, product managers`

Dispatch erzeugt daraus ein **Audience Profile**. Für jeden Entwurf werden Post-Embedding und Audience-Embedding verglichen. Später fließen erfolgreiche historische Posts und Topics des Accounts ein.

V1-Signale:

- semantische Ähnlichkeit zum Audience Profile
- thematische Konsistenz mit dem Account
- Topic-Klarheit
- Fachvokabular / Zielgruppenrelevanz
- Distanz zu erfolgreichen eigenen Posts

### 5.2 Conversation Potential

Dispatch bewertet, ob Leser einen natürlichen Anlass haben, zu antworten oder zu quoten.

Positive Merkmale:

- klare These
- nachvollziehbare Position
- echter Trade-off
- konkrete Erfahrung
- offene Entscheidung / Frage
- ausreichend Kontext für Widerspruch oder Ergänzung

Nicht erwünscht: generische Engagement-Baits wie „Agree?“ oder künstlich angehängte Fragen ohne inhaltlichen Bezug.

### 5.3 Share Potential

Dispatch bewertet die „send this to someone“-Qualität.

Typische positive Strukturen:

- überraschende oder nützliche Daten
- Frameworks
- Checklisten
- Vorher/Nachher
- konkrete, wiederverwendbare Tipps
- hochwertige Visuals
- starke, belegte These
- Referenzmaterial

### 5.4 Follow Potential

Frage: „Erhöht dieser Post die Wahrscheinlichkeit, dass ein relevanter Leser mehr von diesem Autor sehen möchte?“

Signale:

- Originalität
- Kompetenznachweis
- spezifische Erfahrung
- klarer thematischer Schwerpunkt
- wiedererkennbare Perspektive
- Anschlussfähigkeit an weitere Inhalte des Accounts

### 5.5 Dwell Potential

Dwell ist nicht identisch mit Länge. Dispatch bewertet die erwartete **meaningful attention**.

Signale:

- starker Einstieg
- Informationsprogression
- Lesbarkeit
- strukturierte Verdichtung
- Informationslücke ohne Clickbait
- Mediennutzen
- passende Textlänge
- wenig redundante Formulierungen

### 5.6 Negative Feedback Risk

Dispatch soll keine Clickbait-Maschine werden. Deshalb wird ein eigener Risiko-Score berechnet.

Risiken:

- unbelegte Absolutheit
- künstliche Polarisierung
- Spam-/Engagement-Bait-Sprache
- irreführender Hook
- extrem hohe Posting-Frequenz
- starke Themenabweichung ohne Kontext
- potenziell irritierende Wiederholung

### 5.7 Author Saturation / Timing

Dispatch kombiniert öffentlich bekannte Author-Diversity-Mechanismen mit den eigenen Publishing-Daten.

Beispiel:

> „Du hast innerhalb der letzten 45 Minuten bereits drei X-Posts veröffentlicht. Ein weiterer Post konkurriert stärker mit deinem eigenen Inventory. Empfohlenes nächstes Zeitfenster: +1 h 20 min.“

Die konkrete Empfehlung wird später primär durch die **eigene Account-Historie** kalibriert, nicht durch pauschale „Best time to post“-Tabellen.

## 6. Composer UX

### 6.1 Seitenpanel

```text
─────────────────────────────
X Algorithm Intelligence
─────────────────────────────
Reach Score              82 ↑
Discovery potential      72
Audience fit             94
Conversation             71
Shareability             88
Follow potential         76
Negative feedback       Low

3 improvements available

[ Optimize for reach ]
─────────────────────────────
```

### 6.2 Empfehlungen

Empfehlungen müssen:

- konkret sein
- den erwarteten Effekt erklären
- keine Reichweitengarantie versprechen
- den Text nicht automatisch verändern
- bei Annahme als nachvollziehbare Änderung angewendet werden

Beispiel:

> **+8 potential**  
> Die Aussage ist klar, bietet der Zielgruppe aber wenig Anschluss für eine Antwort. Ein konkreter Trade-off oder eine offene Entscheidung dürfte das Conversation Potential erhöhen.

### 6.3 Optimize for Reach

Nach Klick zeigt Dispatch eine Alternative und die prognostizierte Veränderung:

```text
Current
"We've added analytics to Dispatch today.
You can now see how your posts perform."

Suggested
"Most social schedulers tell you when your post
was published.

We wanted to know what happened afterwards.

So we built analytics into Dispatch ↓"

Discovery       64 → 83
Dwell           58 → 79
Replies         44 → 67
Shareability    51 → 72
```

## 7. Learning Loop

Der langfristige Produkt-Moat entsteht nicht aus dem öffentlichen X-Repository allein, sondern aus der Verknüpfung von:

1. öffentlichem Algorithmuswissen,
2. semantischer Inhaltsanalyse,
3. tatsächlicher Performance des jeweiligen Accounts.

### 7.1 Snapshot-Zeitpunkte

Nach Veröffentlichung werden — soweit die Plattform-API die jeweiligen Daten bereitstellt — Performance-Snapshots angelegt, z. B.:

- 15 Minuten
- 1 Stunde
- 6 Stunden
- 24 Stunden
- 48 Stunden

### 7.2 Account-spezifische Kalibrierung

Dispatch lernt beispielsweise:

- welche Topics Non-Follower erreichen
- welche Formate Shares und Replies erzeugen
- welche Hook-Typen für diesen Account funktionieren
- welche Medienformate helfen
- welche Posting-Abstände sinnvoll sind
- welche Textlängen je Topic funktionieren
- welche Vorhersagen systematisch über- oder unterschätzt werden

Ziel:

> Von „Was X allgemein wahrscheinlich bevorzugt“ zu „Was für diesen konkreten Account und dessen Audience nachweislich funktioniert“.

## 8. Technische Architektur

### 8.1 Kein separater Agent-Layer erforderlich

Für Algorithm Intelligence ist zunächst kein eigener Agent-Orchestrator notwendig. **Convex** kann die Workflows, Persistenz, Background Jobs, Snapshots und Re-Kalibrierung orchestrieren.

High-Level Flow:

```text
Composer
  ↓
Analyze draft
  ↓
Algorithm Profile + Audience Profile + Account History
  ↓
LLM / embedding analysis
  ↓
Post Prediction
  ↓
User accepts / rejects recommendations
  ↓
Publish
  ↓
Performance snapshots
  ↓
Account calibration
```

### 8.2 Algorithm Profile

Das Algorithm Profile ist versioniert und enthält nur öffentlich ableitbare Informationen.

```ts
algorithmProfiles {
  platform: "x",
  version: string,
  sourceRepository: string,
  sourceCommit?: string,
  fetchedAt: number,
  signals: [...],
  adjustments: [...],
  filters: [...],
  notes: [...]
}
```

Damit ist jede Vorhersage später reproduzierbar: Dispatch weiß, **mit welchem Wissensstand** ein Post analysiert wurde.

### 8.3 Post Prediction

```ts
postPredictions {
  postId: Id<"posts">,
  platform: "x",
  algorithmProfileId: Id<"algorithmProfiles">,
  modelVersion: string,
  score: number,
  followerReach: number,
  discoveryReach: number,
  audienceFit: number,
  replyPotential: number,
  sharePotential: number,
  followPotential: number,
  dwellPotential: number,
  negativeRisk: number,
  recommendations: [...],
  createdAt: number
}
```

### 8.4 Performance Snapshots

```ts
postPerformanceSnapshots {
  postId: Id<"posts">,
  capturedAt: number,
  ageMinutes: number,
  impressions?: number,
  likes?: number,
  replies?: number,
  reposts?: number,
  quotes?: number,
  bookmarks?: number,
  shares?: number,
  linkClicks?: number,
  profileClicks?: number,
  followersGained?: number,
  videoViews?: number,
  rawMetrics?: unknown
}
```

Nicht jede Kennzahl ist zwingend über jede Plattform/API verfügbar. Deshalb bleiben Metriken optional und `rawMetrics` wird für spätere Schema-Erweiterungen beibehalten.

### 8.5 Account Performance Model

```ts
accountPerformanceModels {
  accountId: Id<"socialAccounts">,
  platform: "x",
  sampleSize: number,
  historicalBaselines: {...},
  topicPerformance: {...},
  formatPerformance: {...},
  timingPerformance: {...},
  predictionCalibration: {...},
  updatedAt: number
}
```

## 9. Analyse-Output / Contract

Die Analyse sollte als strukturiertes Ergebnis gespeichert werden, nicht nur als freier LLM-Text.

```json
{
  "platform": "x",
  "reachScore": 82,
  "followerReach": 91,
  "discoveryReach": 72,
  "components": {
    "audienceFit": 94,
    "conversation": 71,
    "shareability": 88,
    "followPotential": 76,
    "dwell": 79,
    "contentHealth": 86
  },
  "riskFlags": [],
  "recommendations": [
    {
      "type": "conversation",
      "impact": 8,
      "reason": "The post has a clear statement but little room for a substantive reply.",
      "suggestion": "Introduce a concrete trade-off or unresolved decision."
    }
  ]
}
```

## 10. Umsetzung in Phasen

### Phase 1 — Algorithm-aware MVP

Ziel: hilfreiche, erklärbare Pre-Publish-Analyse ohne account-spezifisches ML.

Umfang:

- versioniertes X Algorithm Profile
- Audience Profile pro Social Account
- Embedding-basierter Audience Fit
- LLM-basierte Teil-Scores
- Reach Score + Follower/Discovery Reach
- 1–3 konkrete Verbesserungsvorschläge
- Optimize-for-Reach-Diff im Composer
- Speicherung jeder Prediction

### Phase 2 — Performance Feedback

- Post-Publish-Snapshots
- Normalisierung gegen Account-Baselines
- Topic-/Format-/Timing-Auswertung
- Vergleich Prediction vs. Outcome
- erste account-spezifische Score-Kalibrierung

### Phase 3 — Account Intelligence

- historische Similar-Post-Retrievals
- account-spezifische Priorisierung von Empfehlungen
- adaptive Score-Gewichtung
- Confidence Level je Vorhersage
- Experiment-/A/B-Auswertung, soweit operativ möglich

### Phase 4 — Multi-Platform Algorithm Intelligence

Das Modell wird auf weitere Plattformen abstrahiert:

```text
Platform Algorithm Profile
        ↓
Shared Analysis Dimensions
        ↓
Platform-specific signals
        ↓
Account-specific learning
```

Damit entsteht aus dem X-Feature eine generische Dispatch-Kernfähigkeit.

## 11. Guardrails und Produktprinzipien

### 11.1 Keine Reichweitengarantie

UI-Texte sprechen von **Potential**, **Prediction**, **Expected Effect** und **Confidence**, nicht von garantierter Reichweite.

### 11.2 Keine blinde 1:1-Übernahme öffentlicher Gewichte

X-Gewichte skalieren viewer-spezifische Wahrscheinlichkeiten. Dispatch darf sie nicht als Punktemultiplikatoren auf rohe Merkmale oder Engagementzahlen anwenden.

### 11.3 Kein Engagement-Bait-Optimizer

Negative-Feedback-Risiko und Content Health sind First-Class-Metriken. Empfehlungen dürfen nicht systematisch zu Spam, Polarisierung oder irreführendem Clickbait führen.

### 11.4 Versionierung und Nachvollziehbarkeit

Jede Prediction referenziert:

- Algorithm Profile Version
- Dispatch Analysis Model Version
- Analysezeitpunkt
- verwendete Audience-/Account-Baseline

### 11.5 Änderungen am X-Algorithmus

Das öffentliche Repository wird regelmäßig geändert. Dispatch sollte Änderungen nicht ungeprüft automatisch produktiv übernehmen.

Empfohlener Prozess:

1. Repository-Änderung erkennen.
2. relevante Signal-/Filteränderung extrahieren.
3. neues Algorithm Profile erzeugen.
4. Diff intern prüfen.
5. Score-/Prompt-Logik gegebenenfalls anpassen.
6. Profile aktivieren.

## 12. MVP-Akzeptanzkriterien

Algorithm Intelligence V1 gilt als implementiert, wenn:

- ein X-Account ein Audience Profile besitzen kann;
- jeder Entwurf on-demand analysiert werden kann;
- die Analyse einen strukturierten Reach Score sowie Teil-Scores liefert;
- Follower Reach und Discovery Reach separat dargestellt werden;
- maximal drei priorisierte, erklärbare Empfehlungen angezeigt werden;
- Vorschläge nicht ohne Nutzeraktion in den Post übernommen werden;
- jede Prediction mit Algorithm-/Model-Version gespeichert wird;
- die Analyse bei fehlender Historie funktioniert;
- keine UI-Texte Reichweite garantieren;
- die Architektur Performance-Snapshots und spätere Kalibrierung bereits vorsieht.

## 13. Strategische Bedeutung für Dispatch

Algorithm Intelligence verschiebt Dispatch von einem reinen Publishing-Workflow zu einem **Distribution Intelligence System**.

Klassischer Scheduler:

> Create → Schedule → Publish

Dispatch:

> **Create → Predict → Improve → Publish → Measure → Learn**

Die Differenzierung entsteht nicht dadurch, den X-Algorithmus „auszutricksen“, sondern durch drei kombinierte Wissensschichten:

1. öffentlich nachvollziehbare Plattformmechanismen,
2. semantisches Verständnis des konkreten Contents,
3. proprietäre Performance-Historie des konkreten Accounts.

Diese dritte Schicht wird mit zunehmender Nutzung zum eigentlichen Produkt-Moat.

## 14. Quellen und Referenzstand

Stand der Analyse: **14. September 2026**.

Primäre Quellen:

- X / xAI: `xai-org/x-algorithm` — https://github.com/xai-org/x-algorithm
- README / Architektur, Retrieval, Ranking, Filtering — https://github.com/xai-org/x-algorithm/blob/main/README.md
- Ranking-Gewichte / Produktions-Defaults — https://github.com/xai-org/x-algorithm/blob/main/home-mixer/params/param.rs
- RankingScorer — https://github.com/xai-org/x-algorithm/blob/main/home-mixer/scorers/ranking_scorer.rs
- Author Cold Start — https://github.com/xai-org/x-algorithm/blob/main/home-mixer/scorers/author_cold_start.rs

**Hinweis:** Das Repository weist selbst darauf hin, dass bestimmte Grox-Prompts und einzelne Botmaker-Regeln zur Reduzierung von Gaming-Risiken nicht öffentlich sind. Außerdem können Feature-Switches und Experimente das Produktionsverhalten für Teilmengen des Traffics verändern.
