# JEV Integration for Dispatch

> Status: Proposal / Implementation Guide  
> Project: Dispatch  
> Last updated: 2026-09-18  
> Provider: TypeSafe AI  
> Model: `jev-latest`

---

> Dispatch release override, 2026-09-19 (D04): Post Analyzer, Dispatch Score and explicit recommendation adoption ship within the Dispatch MVP/R2. Metrics foundation remains R3; routing, verification and calibration remain R5; Network Fit remains R7 for selected channels. This guide is an implementation proposal; examples, SDK syntax, weights, prices and provider data-path claims require validation. The [release contract](decisions/release-scope.md) and [domain contract](decisions/domain-contracts.md) govern scope and activation. EU-only approval is required before customer-data calls; model confidence never grants publishing, authentication, billing or scheduling authority.

## 1. Purpose

This document defines how TypeSafe AI's **Jev** model should be integrated into Dispatch.

Jev is not intended to replace the generative LLM layer. Its role is to act as a **decision engine** for fast, typed, probabilistic decisions inside Dispatch workflows.

The architectural separation is:

- **Generative LLMs** create, rewrite, summarize, research, and explain.
- **Jev** classifies, scores, routes, verifies, and guards.
- **Convex** owns orchestration, business rules, persistence, scheduling, retries, and execution.
- **Provider APIs** publish content and return analytics.

The core design principle is:

> Keep intelligence atomic, orchestration deterministic, and execution inside application code.

---

## 2. Why Jev Fits Dispatch

Dispatch needs many decisions that are semantic but do not require text generation.

Examples:

- What type of post is this?
- How strong is the hook?
- Does the draft sound overly promotional?
- Is the post likely to invite meaningful replies?
- Does the generated version still preserve the user's intent?
- Which content strategy should the generator use?
- Does a draft fit X, LinkedIn, or Bluesky?
- Should a post be reused, rewritten, or ignored?
- Is the model confident enough for Dispatch to act automatically?

These are better represented as structured decisions than as free-form natural-language responses.

Jev supports three primary question primitives:

- `choice`
- `score`
- `noul`

`choice` and `score` return a confidence value in addition to their probability distribution. `noul` represents a scalar probabilistic answer and does not expose the same separate confidence field.

---

## 3. Architectural Position

```text
┌───────────────────────────────────────────────┐
│                    Dispatch                   │
├───────────────────────────────────────────────┤
│ React + Vite + TanStack Router                │
├───────────────────────────────────────────────┤
│                    Convex                     │
│                                               │
│ Domain logic                                  │
│ Workflows                                     │
│ Scheduling                                    │
│ Background jobs                               │
│ Rate limiting                                 │
│ Analytics                                     │
│ Media storage                                 │
│ Provider integrations                         │
├───────────────────────┬───────────────────────┤
│ Generation Layer      │ Decision Layer        │
│                       │                       │
│ GPT / Claude / etc.   │ TypeSafe AI / Jev     │
│                       │                       │
│ write                 │ classify              │
│ rewrite               │ score                 │
│ summarize             │ route                 │
│ research              │ verify                │
│ explain               │ guard                 │
├───────────────────────┴───────────────────────┤
│ Social APIs                                   │
│ X · LinkedIn · Bluesky · future providers     │
└───────────────────────────────────────────────┘
```

Jev must **not** become the central orchestrator.

Convex remains the workflow engine.

---

## 4. Non-Goals

Jev should not be used for:

- Writing complete social posts
- Writing threads
- Long-form summarization
- Web research
- User-facing explanations
- Strategy documents
- Retrieval-augmented generation
- Complex multi-step reasoning that requires generated intermediate text
- Provider-side publishing logic
- Authentication
- Billing
- Scheduling

These responsibilities remain with their existing Dispatch components.

---

## 5. Initial Dispatch Use Cases

The first implementation should focus on four capabilities.

### 5.1 Post Analyzer

Analyze a draft across semantic dimensions.

Suggested initial dimensions:

- hook strength
- clarity
- originality
- discussion potential
- promotional tone
- audience fit
- strong factual claim
- clickbait tendency
- naturalness of CTA
- content intent

Output is machine-readable and can be used to build a visible **Dispatch Score**.

---

### 5.2 Intent Router

Determine what kind of generation workflow should be invoked.

Examples:

- announcement
- product launch
- milestone
- opinion
- educational
- thought leadership
- conversation starter
- promotional
- update
- story

The routing decision is made by Jev.

The actual workflow selection is made by Convex code.

---

### 5.3 Output Verifier

After a generative LLM produces a post, Jev checks whether the result satisfies Dispatch constraints.

Examples:

- Does the generated post preserve the original intent?
- Has the tone changed materially?
- Is the result more promotional than requested?
- Did the rewrite introduce a stronger factual claim?
- Is the generated version suitable for the target network?
- Does the rewrite appear repetitive?
- Is the requested CTA still present?

Convex determines whether to:

- accept
- regenerate
- show a warning
- request user confirmation
- fall back to the original version

---

### 5.4 Network Fit

Evaluate whether content is appropriate for a target platform.

Initial networks:

- X
- LinkedIn
- Bluesky

This should not attempt to predict exact reach.

It should measure whether the content exhibits qualities Dispatch considers useful for the selected network.

---

## 6. Package Installation

The official JavaScript / TypeScript SDK currently requires Node.js 20 or newer.

```bash
npm install @typesafe-ai/sdk
```

Environment variable:

```bash
TYPESAFE_API_KEY=...
```

The API must only be called from trusted server-side Convex code.

Never expose the TypeSafe API key to the browser.

---

## 7. Proposed Project Structure

```text
convex/
  ai/
    jev/
      client.ts
      types.ts
      questions/
        postAnalysis.ts
        intentRouting.ts
        outputVerification.ts
        networkFit.ts
      analyzePost.ts
      classifyIntent.ts
      verifyGeneratedPost.ts
      evaluateNetworkFit.ts
      normalize.ts
      thresholds.ts

    generation/
      generatePost.ts
      rewritePost.ts
      adaptPostForNetwork.ts

    scoring/
      dispatchScore.ts

  analytics/
    postPerformance.ts
    scoreCalibration.ts

  posts/
    actions.ts
    mutations.ts
    queries.ts
```

The `jev` directory is the provider adapter boundary.

No domain code outside this module should depend directly on the TypeSafe SDK.

---

## 8. Client Adapter

`convex/ai/jev/client.ts`

```ts
import { TypeSafeClient } from "@typesafe-ai/sdk";

let client: TypeSafeClient | undefined;

export function getJevClient() {
  if (!client) {
    client = new TypeSafeClient({
      apiKey: process.env.TYPESAFE_API_KEY,
    });
  }

  return client;
}
```

If the SDK constructor reads `TYPESAFE_API_KEY` automatically in the deployed version, explicit `apiKey` configuration may be omitted.

The adapter boundary should remain even if the client initialization becomes trivial.

---

## 9. Shared Analysis Context

All analysis should use a normalized Dispatch context object.

```ts
export type DispatchAnalysisContext = {
  post: string;

  network?: "x" | "linkedin" | "bluesky";

  objective?:
    | "engagement"
    | "reach"
    | "discussion"
    | "traffic"
    | "awareness"
    | "conversion";

  audience?: string;

  accountContext?: {
    displayName?: string;
    profileDescription?: string;
    topics?: string[];
  };

  source?: {
    type:
      | "manual"
      | "generated"
      | "rewritten"
      | "recycled";
  };
};
```

Do not send unnecessary workspace data to Jev.

Only include context required for the current decision.

---

## 10. Post Analysis Question Set

`convex/ai/jev/questions/postAnalysis.ts`

```ts
import { choice, noul, score } from "@typesafe-ai/sdk";

export const postAnalysisQuestions = {
  contentType: choice(
    "What type of social media content is this?",
    {
      announcement: "News or an announcement",
      opinion: "A personal opinion, position, or take",
      educational: "Explains or teaches something",
      promotional: "Primarily promotes a product or service",
      conversation: "Primarily intended to start a discussion",
      story: "Primarily tells a story or personal narrative",
      update: "A progress or status update",
      other: "None of the above clearly applies",
    },
  ),

  hookStrength: score(
    "How effective is the opening at creating immediate interest?",
    [
      "Very weak",
      "Weak",
      "Average",
      "Strong",
      "Exceptional",
    ],
  ),

  clarity: score(
    "How easy is the post to understand on first reading?",
    [
      "Very unclear",
      "Somewhat unclear",
      "Adequate",
      "Clear",
      "Exceptionally clear",
    ],
  ),

  originality: score(
    "How distinctive or non-generic is the post's core idea or framing?",
    [
      "Very generic",
      "Generic",
      "Moderately distinctive",
      "Distinctive",
      "Highly distinctive",
    ],
  ),

  discussionPotential: score(
    "How likely is the post to invite meaningful replies or discussion?",
    [
      "Very low",
      "Low",
      "Moderate",
      "High",
      "Very high",
    ],
  ),

  promotionalTone: noul(
    "The post reads primarily as promotional or sales-oriented content.",
  ),

  strongClaim: noul(
    "The post contains a strong factual, causal, comparative, or predictive claim.",
  ),

  clickbait: noul(
    "The post relies on exaggerated curiosity, sensational framing, or clickbait.",
  ),

  naturalCta: score(
    "If the post contains a call to action, how natural and contextually appropriate is it? If no CTA exists, prefer the neutral middle score.",
    [
      "Very forced",
      "Forced",
      "Neutral or absent",
      "Natural",
      "Very natural",
    ],
  ),
} as const;
```

Question wording should be versioned.

Changes to wording can change model behavior and therefore must not silently modify historic score semantics.

---

## 11. Calling Jev

`convex/ai/jev/analyzePost.ts`

```ts
import { getJevClient } from "./client";
import { postAnalysisQuestions } from "./questions/postAnalysis";

export async function analyzePost(
  context: DispatchAnalysisContext,
) {
  const client = getJevClient();

  const response = await client.systemOne({
    state: {
      post: context.post,
      network: context.network ?? null,
      objective: context.objective ?? null,
      audience: context.audience ?? null,
      accountContext: context.accountContext ?? null,
    },
    questions: postAnalysisQuestions,
  });

  return response;
}
```

Do not put business rules inside this function.

Its responsibility is only:

1. build state
2. call Jev
3. validate/normalize response
4. return structured analysis

---

## 12. Normalized Dispatch Representation

Provider-specific responses should be converted into a stable internal structure.

```ts
export type DispatchSemanticAnalysis = {
  version: string;
  provider: "typesafe";
  model: string;

  contentType: {
    value:
      | "announcement"
      | "opinion"
      | "educational"
      | "promotional"
      | "conversation"
      | "story"
      | "update"
      | "other";
    confidence: number;
  };

  scores: {
    hook: number;
    clarity: number;
    originality: number;
    discussion: number;
    naturalCta: number;
  };

  probabilities: {
    promotionalTone: number;
    strongClaim: number;
    clickbait: number;
  };

  confidence: {
    hook: number;
    clarity: number;
    originality: number;
    discussion: number;
    naturalCta: number;
  };

  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};
```

All `score` values should be normalized to a consistent Dispatch scale, preferably `0..1`.

---

## 13. Score Normalization

If a five-level Jev score uses indices `0..4`:

```ts
export function normalizeFiveLevelScore(score: number) {
  return Math.max(0, Math.min(1, score / 4));
}
```

Do not round during calculation.

Round only when presenting the value in the UI.

---

## 14. Dispatch Score

The Dispatch Score should be calculated by Dispatch code, not by Jev.

### Initial Formula

```ts
export function calculateDispatchScore(
  semantic: DispatchSemanticAnalysis,
  deterministic: DeterministicPostSignals,
  account?: AccountPerformanceSignals,
) {
  const semanticScore =
    semantic.scores.hook * 0.20 +
    semantic.scores.clarity * 0.20 +
    semantic.scores.discussion * 0.20 +
    semantic.scores.originality * 0.15 +
    semantic.scores.naturalCta * 0.05;

  const deterministicScore =
    deterministic.structureScore * 0.10;

  const accountScore =
    (account?.historicalFit ?? 0.5) * 0.10;

  return Math.round(
    (semanticScore + deterministicScore + accountScore) * 100,
  );
}
```

This is an **initial heuristic**, not a scientifically validated prediction model.

The weights must later be calibrated against real Dispatch analytics.

---

## 15. Deterministic Signals

Do not use AI for values that can be calculated directly.

Examples:

```ts
export type DeterministicPostSignals = {
  length: number;
  hasMedia: boolean;
  hasLink: boolean;
  hashtagCount: number;
  mentionCount: number;
  lineCount: number;
  hasQuestion: boolean;
  hasExplicitCta: boolean;
  structureScore: number;
};
```

Potential provider-specific deterministic signals can be added later.

These should be evaluated separately from Jev semantic signals.

---

## 16. Score Interpretation

Suggested initial UI ranges:

```text
0–39   Needs work
40–59  Developing
60–74  Solid
75–89  Strong
90–100 Exceptional
```

These labels are product language only.

They do not represent a prediction of impressions, likes, reach, or revenue.

Prefer wording such as:

> This post has several characteristics that Dispatch associates with strong social content.

Avoid:

> This post will perform well.

or:

> This post will get more reach.

---

## 17. Confidence-Gated Behavior

Jev confidence should affect what Dispatch does with a decision.

Suggested starting policy:

```ts
export const JEV_CONFIDENCE = {
  low: 0.50,
  medium: 0.75,
  high: 0.90,
} as const;
```

Example routing:

```ts
if (analysis.contentType.confidence < JEV_CONFIDENCE.low) {
  return {
    action: "fallback",
  };
}

if (analysis.contentType.confidence < JEV_CONFIDENCE.high) {
  return {
    action: "soft-route",
    contentType: analysis.contentType.value,
  };
}

return {
  action: "route",
  contentType: analysis.contentType.value,
};
```

Thresholds must be calibrated using Dispatch data.

Do not treat the initial values as permanent.

---

## 18. Intent Routing

`convex/ai/jev/questions/intentRouting.ts`

```ts
import { choice } from "@typesafe-ai/sdk";

export const intentRoutingQuestions = {
  generationStrategy: choice(
    "Which generation strategy best matches the user's source content?",
    {
      announcement:
        "Turn information into a concise announcement.",
      milestone:
        "Communicate progress, growth, or an achieved milestone.",
      launch:
        "Introduce a newly launched product, feature, or service.",
      educational:
        "Teach or explain a concept.",
      thoughtLeadership:
        "Develop an opinion, thesis, or industry perspective.",
      conversation:
        "Create a discussion-oriented post.",
      story:
        "Use narrative or personal experience.",
      promotional:
        "Promote a product, service, offer, or conversion action.",
      generic:
        "No specialized strategy clearly applies.",
    },
  ),
} as const;
```

Convex handles routing:

```ts
switch (decision.generationStrategy.choice) {
  case "launch":
    return generateLaunchPost(ctx, input);

  case "milestone":
    return generateMilestonePost(ctx, input);

  case "educational":
    return generateEducationalPost(ctx, input);

  case "thoughtLeadership":
    return generateThoughtLeadershipPost(ctx, input);

  default:
    return generateGenericPost(ctx, input);
}
```

Jev selects a category.

Convex controls execution.

---

## 19. Output Verification

The verifier should compare:

- original source
- user intent
- generated result
- target network
- requested tone

Example state:

```ts
const state = {
  source: input.source,
  generatedPost: input.generatedPost,
  requestedTone: input.requestedTone,
  targetNetwork: input.network,
};
```

Suggested questions:

```ts
export const outputVerificationQuestions = {
  preservesIntent: noul(
    "The generated post preserves the core intent of the source.",
  ),

  preservesMeaning: noul(
    "The generated post preserves the important factual meaning of the source.",
  ),

  addsStrongClaim: noul(
    "The generated post introduces a strong factual, causal, comparative, or predictive claim that is not present in the source.",
  ),

  excessivePromotion: noul(
    "The generated post is substantially more promotional than the source or requested tone.",
  ),

  targetFit: score(
    "How well does the generated post fit the selected social network and requested communication goal?",
    [
      "Very poor fit",
      "Poor fit",
      "Adequate",
      "Good fit",
      "Excellent fit",
    ],
  ),
} as const;
```

---

## 20. Verification Policy

Suggested initial policy:

```ts
type VerificationAction =
  | "accept"
  | "accept-with-warning"
  | "regenerate"
  | "manual-review";

export function resolveVerification(
  result: VerificationResult,
): VerificationAction {
  if (result.preservesMeaning < 0.70) {
    return "regenerate";
  }

  if (result.addsStrongClaim > 0.75) {
    return "manual-review";
  }

  if (result.excessivePromotion > 0.80) {
    return "accept-with-warning";
  }

  if (result.targetFit < 0.50) {
    return "regenerate";
  }

  return "accept";
}
```

These values are placeholders.

They must be measured and tuned.

---

## 21. Network Fit

Network fit should be evaluated independently for each target platform.

Suggested dimensions:

### X

- immediacy
- conversational potential
- concise framing
- hook strength
- opinion / novelty
- reply potential

### LinkedIn

- professional relevance
- clarity
- explanatory value
- credibility
- narrative structure
- business relevance

### Bluesky

- conversational naturalness
- community relevance
- authenticity
- compactness
- discussion potential

Do not encode undocumented platform algorithm rumors as ground truth.

Platform-specific optimization should be based on:

1. observable content characteristics
2. documented provider constraints
3. Dispatch's own measured analytics
4. public technical documentation where available

---

## 22. Multi-Network Workflow

```text
User draft
   │
   ▼
Jev semantic analysis
   │
   ├── X fit
   ├── LinkedIn fit
   └── Bluesky fit
   │
   ▼
Convex routing
   │
   ├── reuse unchanged
   ├── minor adaptation
   └── generate network-specific rewrite
```

The system should avoid generating three rewrites when one original version already fits all selected networks.

---

## 23. Post Creation Workflow

Recommended workflow:

```text
User input
   │
   ▼
Intent routing
   │
   ▼
Convex selects generator
   │
   ▼
Generative LLM
   │
   ▼
Jev output verification
   │
   ├── accepted
   │      │
   │      ▼
   │   Post Analyzer
   │      │
   │      ▼
   │   Dispatch Score
   │
   ├── warning
   │
   └── regenerate / review
```

This keeps generation and evaluation separated.

---

## 24. Realtime Composer Analysis

Do not call Jev on every keystroke.

Recommended UX:

```text
Typing
  ↓
debounce
  ↓
meaningful content change
  ↓
Jev analysis
```

Suggested initial debounce:

```ts
const ANALYSIS_DEBOUNCE_MS = 800;
```

Additional rules:

- minimum post length before analysis
- cancel obsolete requests
- cache identical inputs
- avoid repeat analysis for cosmetic whitespace changes
- do not block typing on Jev
- preserve last valid analysis while a new request is running

---

## 25. Caching

A post analysis can be cached using a deterministic hash.

Example cache key:

```text
sha256(
  analysisVersion
  + network
  + objective
  + audience
  + normalizedPost
)
```

Cache entries should include:

```ts
{
  inputHash,
  questionSetVersion,
  provider,
  model,
  createdAt,
  result,
}
```

---

## 26. Versioning

Every persisted Jev analysis should include at least:

```ts
{
  provider: "typesafe",
  model: "jev-latest",
  questionSetVersion: "post-analysis-v1",
  scoringVersion: "dispatch-score-v1",
}
```

Prefer also persisting the resolved model identifier if TypeSafe returns one.

Never compare historic scores blindly if the question set or scoring formula changed.

---

## 27. Proposed Convex Schema

Example:

```ts
postAssessments: defineTable({
  workspaceId: v.id("workspaces"),
  postId: v.id("posts"),

  provider: v.literal("typesafe"),
  model: v.string(),

  questionSetVersion: v.string(),
  scoringVersion: v.string(),

  network: v.optional(
    v.union(
      v.literal("x"),
      v.literal("linkedin"),
      v.literal("bluesky"),
    ),
  ),

  dispatchScore: v.number(),

  semantic: v.object({
    contentType: v.object({
      value: v.string(),
      confidence: v.number(),
    }),

    scores: v.object({
      hook: v.number(),
      clarity: v.number(),
      originality: v.number(),
      discussion: v.number(),
      naturalCta: v.number(),
    }),

    probabilities: v.object({
      promotionalTone: v.number(),
      strongClaim: v.number(),
      clickbait: v.number(),
    }),

    confidence: v.object({
      hook: v.number(),
      clarity: v.number(),
      originality: v.number(),
      discussion: v.number(),
      naturalCta: v.number(),
    }),
  }),

  deterministic: v.object({
    length: v.number(),
    hasMedia: v.boolean(),
    hasLink: v.boolean(),
    hashtagCount: v.number(),
    mentionCount: v.number(),
    hasQuestion: v.boolean(),
    hasExplicitCta: v.boolean(),
    structureScore: v.number(),
  }),

  usage: v.optional(
    v.object({
      inputTokens: v.optional(v.number()),
      outputTokens: v.optional(v.number()),
    }),
  ),

  createdAt: v.number(),
})
  .index("by_post", ["postId"])
  .index("by_workspace", ["workspaceId"]);
```

This is a starting shape.

If assessments become numerous, split raw provider responses and normalized analytics into separate tables.

---

## 28. Persist Raw Provider Output?

Recommended approach:

### MVP

Store:

- normalized values
- confidence
- model
- version
- token usage

Do not store complete duplicate prompts/state unless needed for debugging.

### Development / Debug Mode

Optionally store raw API response with:

- short retention
- environment gating
- strict access controls
- no secrets
- no unnecessary user data

This avoids creating an unnecessary duplicate content store.

---

## 29. Analytics Feedback Loop

This is where Jev becomes strategically valuable.

Persist the analysis available at publication time.

Later join it with actual provider performance.

```text
post assessment
      │
      ▼
publication
      │
      ▼
provider analytics
      │
      ▼
normalized performance
      │
      ▼
correlation / calibration
```

Example questions Dispatch can evaluate:

- Do posts with higher hook scores receive better normalized reach?
- Does discussion potential correlate with reply rate?
- Does promotional tone correlate with lower organic interaction?
- Which characteristics matter for a specific workspace?
- Do network-fit scores predict whether adaptation is useful?

---

## 30. Normalize Performance Before Learning From It

Raw engagement counts are not directly comparable.

A post from an account with 100,000 followers should not be compared directly with one from an account with 300 followers.

Prefer normalized metrics such as:

```ts
type NormalizedPostPerformance = {
  impressionRate?: number;
  engagementRate?: number;
  replyRate?: number;
  repostRate?: number;
  clickRate?: number;
  followerConversionRate?: number;
};
```

Also account for:

- network
- account size
- content type
- posting time
- media type
- historical baseline
- observation window

---

## 31. Workspace-Specific Scoring

Eventually, Dispatch should allow global weights to be adjusted using measured account behavior.

Example:

```text
Global Dispatch model
         │
         ▼
workspace observations
         │
         ▼
workspace calibration
         │
         ▼
personalized score weights
```

Example:

```ts
{
  hook: 0.18,
  clarity: 0.14,
  originality: 0.21,
  discussion: 0.29,
  cta: 0.03,
  historicalFit: 0.15,
}
```

Do not let Jev directly modify these weights.

Calibration belongs to Dispatch analytics logic.

---

## 32. Content Recycling

Potential future decision set:

```ts
const recyclingQuestions = {
  stillRelevant: noul(
    "The content is still timely and useful today.",
  ),

  repetitive: noul(
    "Reposting this content would likely feel repetitive for the account's audience.",
  ),

  needsUpdate: noul(
    "The content should be materially updated before being published again.",
  ),

  reuseStrategy: choice(
    "What is the best reuse strategy?",
    {
      repost: "Reuse mostly unchanged",
      rewrite: "Rewrite while preserving the core idea",
      thread: "Expand into a multi-post format",
      adapt: "Adapt to another social network",
      skip: "Do not reuse",
    },
  ),
};
```

This belongs after MVP.

---

## 33. Failure Handling

Jev must not become a single point of failure for publishing.

Define failure classes:

```ts
type JevFailure =
  | "timeout"
  | "rate_limit"
  | "provider_error"
  | "invalid_response"
  | "low_confidence";
```

Suggested behavior:

| Feature | Jev unavailable |
|---|---|
| Composer score | Show unavailable state |
| Intent routing | Use generic generator |
| Output verification | Fall back to conservative local rules |
| Publishing | Do not block publishing solely because Jev is offline |
| Network fit | Hide recommendation |
| Recycling | Skip automated suggestion |

---

## 34. Retry Strategy

Retries should be bounded.

Recommended:

```text
attempt 1
  ↓
transient failure
  ↓
short retry
  ↓
attempt 2
  ↓
fallback
```

Do not build deep retry loops into user-facing composer actions.

For background jobs, Convex retry behavior may use a different policy.

---

## 35. Circuit Breaker

If TypeSafe experiences persistent failures, Dispatch should temporarily stop calling the provider.

Suggested state:

```ts
{
  failures: number,
  openedAt?: number,
  lastSuccessAt?: number,
}
```

A simple failure threshold is sufficient for the first version.

---

## 36. Timeouts

Jev is intended for low-latency decisions, but Dispatch should still enforce application-level timeouts.

Suggested initial values:

```ts
export const JEV_TIMEOUTS = {
  composerMs: 2_500,
  backgroundMs: 5_000,
};
```

Do not allow a decision service to indefinitely block a Convex workflow.

---

## 37. Observability

Track at least:

```ts
type JevTelemetry = {
  operation:
    | "post_analysis"
    | "intent_routing"
    | "output_verification"
    | "network_fit";

  durationMs: number;
  success: boolean;

  model?: string;

  inputTokens?: number;
  outputTokens?: number;

  questionSetVersion: string;

  fallbackUsed: boolean;
};
```

Do not log full user post content into general observability events.

Rybbit should receive product-level metrics, not private draft contents.

---

## 38. Cost Tracking

At the current public TypeSafe price:

```text
$42 / billion input tokens
```

which is equivalent to:

```text
$0.042 / million input tokens
```

Output tokens are currently advertised as free.

Dispatch should nevertheless persist usage because:

- pricing may change
- usage can identify runaway workflows
- usage is useful for internal cost attribution

Do not hard-code provider pricing into scoring or product logic.

---

## 39. Privacy and GDPR

TypeSafe currently states that customer input is not used to train or fine-tune its AI/ML models.

TypeSafe also publishes a Data Processing Addendum and includes mechanisms for international transfers, including EU Standard Contractual Clauses.

Dispatch should still treat TypeSafe as a subprocesser.

Required actions before production:

- add TypeSafe to Dispatch's subprocesser list
- sign / accept the applicable DPA
- document the purpose of processing
- document transferred data categories
- review current subprocessers in the TypeSafe Trust Center
- verify retention behavior
- complete a transfer-risk assessment where required
- update the Dispatch privacy notice if necessary
- avoid unnecessary personal data in Jev state
- avoid transmitting secrets or credentials
- provide deletion handling consistent with Dispatch retention policies

The integration must follow data minimization.

---

## 40. Data Minimization

Bad:

```ts
state: {
  wholeWorkspace,
  user,
  billing,
  accountTokens,
  allPreviousPosts,
  currentPost,
}
```

Good:

```ts
state: {
  post,
  network,
  objective,
  audience,
}
```

Only send what is needed to answer the current questions.

---

## 41. Security

Rules:

1. `TYPESAFE_API_KEY` stays server-side.
2. Never expose the key to React.
3. Never persist the key in Convex documents.
4. Never log authorization headers.
5. Rotate the key if leaked.
6. Restrict production secrets through deployment environment configuration.
7. Treat draft post content as customer data.
8. Do not send social-provider access tokens to Jev.

---

## 42. Feature Flags

Jev should initially be feature-flagged.

Suggested flags:

```ts
{
  jevEnabled: true,
  jevPostAnalysis: true,
  jevIntentRouting: true,
  jevOutputVerification: false,
  jevNetworkFit: false,
}
```

This allows staged rollout and quick provider disablement.

---

## 43. Rollout Plan

### Phase 1 — Internal

Implement:

- Jev adapter
- post analyzer
- normalized output
- Dispatch Score
- telemetry
- caching

No automatic workflow decisions.

### Phase 2 — Assisted Decisions

Enable:

- intent routing
- network fit
- warnings
- suggestions

Users remain fully in control.

### Phase 3 — Verification

Enable:

- post-generation verification
- automatic regeneration for clear low-risk failures
- confidence gates

### Phase 4 — Calibration

Connect:

- publication analytics
- normalized performance
- score correlation
- workspace-specific calibration

### Phase 5 — Advanced Automation

Potentially add:

- recycling decisions
- scheduling recommendations
- content mix analysis
- selective automatic adaptation

---

## 44. MVP Acceptance Criteria

The Jev integration is ready for first production use when:

- [ ] TypeSafe SDK runs from Convex
- [ ] API key is server-only
- [ ] Post analysis uses versioned questions
- [ ] Responses are normalized into Dispatch types
- [ ] Dispatch Score is calculated in application code
- [ ] Composer can display semantic dimensions
- [ ] Low-confidence responses are represented explicitly
- [ ] Provider failures do not block manual publishing
- [ ] Requests have application-level timeouts
- [ ] Telemetry captures latency, success, usage, and fallback
- [ ] Raw user drafts are not written to analytics logs
- [ ] Assessments persist model and question-set version
- [ ] TypeSafe privacy/DPA review is complete
- [ ] Feature flag can disable Jev without deployment

---

## 45. Testing Strategy

### Unit Tests

Test:

- score normalization
- Dispatch Score formula
- threshold routing
- fallback policy
- network-specific rules
- provider response normalization

### Contract Tests

Mock TypeSafe responses and verify:

- expected answer types
- missing fields
- malformed responses
- confidence handling
- provider errors
- timeout handling

### Evaluation Dataset

Create an internal set of representative posts.

Suggested categories:

- launch
- announcement
- opinion
- educational
- story
- promotional
- weak hook
- strong hook
- clickbait
- ambiguous intent
- highly technical
- conversational
- factual claim
- no CTA
- strong CTA

For each sample, maintain human-reviewed expected ranges rather than only one exact answer.

---

## 46. Calibration Dataset

Persist anonymized or appropriately controlled evaluation data containing:

```ts
{
  postId,
  analysisVersion,
  semanticSignals,
  network,
  publicationMetrics,
  normalizedPerformance,
}
```

Do not train Jev.

Use this data to calibrate Dispatch's own scoring and routing policies.

---

## 47. Suggested UI

Composer:

```text
──────────────────────────────────────

Dispatch Score                         82

Hook                    ████████░░    81
Clarity                 █████████░    90
Discussion              ███████░░░    74
Originality             ████████░░    83

✓ Low promotional tone
✓ Good audience fit
⚠ Strong factual claim detected

──────────────────────────────────────
```

Each dimension should be explainable.

Avoid presenting a single opaque score without showing its components.

---

## 48. Explainability

The UI should explain what each score means without pretending to know future performance.

Example:

**Discussion Potential**

> Measures whether the wording and framing invite a meaningful response or conversation.

Not:

> Predicts how many replies your post will receive.

---

## 49. Product Principle

The Dispatch Score should become:

> A structured assessment of content characteristics using semantic signals, deterministic post features, and account-specific performance data.

It should not become:

> An AI prediction of viral reach.

This distinction is important for credibility and long-term usefulness.

---

## 50. Recommended Final Architecture

```text
                         ┌─────────────────────┐
                         │ React / Vite        │
                         │ TanStack Router     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       Convex        │
                         │                     │
                         │ Orchestration       │
                         │ Domain Logic        │
                         │ Persistence         │
                         │ Scheduling          │
                         │ Analytics           │
                         └───────┬───────┬─────┘
                                 │       │
                  generation     │       │ decisions
                                 ▼       ▼
                          ┌──────────┐ ┌──────────┐
                          │   LLM    │ │   Jev    │
                          │          │ │          │
                          │ Writer   │ │ Judge    │
                          └────┬─────┘ └────┬─────┘
                               │            │
                               └─────┬──────┘
                                     │
                                     ▼
                              Convex policies
                                     │
                                     ▼
                           Provider integrations
                                     │
                      ┌──────────────┼─────────────┐
                      ▼              ▼             ▼
                      X           LinkedIn      Bluesky
```

### Responsibility Matrix

| Responsibility | Owner |
|---|---|
| Generate text | Generative LLM |
| Rewrite text | Generative LLM |
| Summarize/research | Generative LLM |
| Classify | Jev |
| Score semantic qualities | Jev |
| Route intent | Jev + Convex |
| Verify generated output | Jev |
| Calculate Dispatch Score | Convex |
| Apply business rules | Convex |
| Persist data | Convex |
| Schedule actions | Convex |
| Publish | Provider adapters |
| Measure performance | Dispatch analytics |
| Calibrate weights | Dispatch analytics |

---

## 51. Decision

**Adopt Jev as Dispatch's semantic decision layer behind an internal provider adapter.**

Do not introduce a separate autonomous agent framework for the initial Dispatch architecture.

Use:

```text
Convex = orchestrator
Jev = decision engine
Generative LLM = generator
Dispatch analytics = calibration layer
```

The first production feature should be the **Post Analyzer + Dispatch Score**, followed by **Intent Routing**, **Output Verification**, and **Network Fit**.

---

## 52. References

TypeSafe AI documentation:

- Quick start: https://docs.typesafe.ai/introduction/quickstart
- JavaScript / TypeScript SDK: https://docs.typesafe.ai/sdk/javascript
- Patterns: https://docs.typesafe.ai/patterns
- Confidence: https://docs.typesafe.ai/confidence
- TypeSafe AI: https://typesafe.ai/
- Jev announcement: https://typesafe.ai/blog/introducing-system-one-models-and-jev
- Privacy Policy: https://typesafe.ai/legal/privacy-policy
- Data Processing Addendum: https://typesafe.ai/legal/data-processing

---

## 53. Implementation Notes

The Jev and TypeSafe APIs are new and may evolve quickly.

Before implementation:

1. verify the current SDK API
2. pin an SDK version
3. review the changelog during upgrades
4. keep all provider-specific code inside `convex/ai/jev`
5. keep persisted Dispatch data provider-neutral where practical
6. version all question sets and score formulas

This allows Dispatch to replace, supplement, or A/B-test the decision provider without restructuring the application.
