# TASK-27 / TASK-44 — public X algorithm source review

Reviewed 2026-10-05, beginning 09:42:27 UTC. Read-only public-source inspection; no repository edit, SDK install, paid/model call, credential read or deployment. Root's analysis decision remains `.docs/decisions/analysis-contract.md` (ad466b1): `dispatch-score-v1` is a Dispatch editorial heuristic, not a reconstruction of X ranking.

## Exact source pin

Primary current public source: [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm), scope **For You**. Public GitHub REST `GET /repos/xai-org/x-algorithm/commits/main` returned:

- Commit: [`b412112d03f27acbfd668e0cc040abcafa1080c1`](https://github.com/xai-org/x-algorithm/commit/b412112d03f27acbfd668e0cc040abcafa1080c1)
- Author and committer date: **2026-10-03T03:26:56Z**; message: Open-source X Recommendation Algorithm.
- Parent: `76843a5eea278ced444b21372d4e6d6909f5c35e`.
- Published parameter mirror identifies its last synchronization as **2026-10-02T16:00:41Z**, [param.rs line1](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/params/param.rs#L1).
- The live API and immutable raw files were fetched directly without authentication. Search and the browsed commits page exposed cached September10 content; those cached listings were **not** used as the current pin.

Secondary historical source: [twitter/the-algorithm at c54bec0d4e029fe34926ef3258a86ccacc0d0182](https://github.com/twitter/the-algorithm/commit/c54bec0d4e029fe34926ef3258a86ccacc0d0182), author/committer date **2025-09-03T20:46:53Z**, message “update for-you recommendations code”; live public `commits/main` response. Preserve as historical context only, not the active current For You implementation source. Third-party issues/PR proposals, mirrors and marketing summaries were excluded.

## Supported mechanisms and precise limits

Every link below is immutable at the pinned SHA. “Supported” means inspected public source behavior; it does not assert the exact code/config/checkpoint is running for every X viewer today.

| Mechanism actually supported | Primary evidence | What Dispatch may conclude |
|---|---|---|
| Retrieval and ranking are separate stages, with history-based personalization. | [Phoenix README lines99–121](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/phoenix/README.md#L99-L121); [query hydration lines251–275](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L251-L275). | A text-only editorial score cannot know a viewer's engagement history, eligible candidate inventory or actual audience fit. No universal post ranking probability. |
| Multiple predicted action heads and continuous values are fused; weights are **not raw interaction-count equivalences**. | [scoring comments+arithmetic lines28–118](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/xai-value-model/scoring.rs#L28-L118); [requested weights lines8–45](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/scorers/value_model.rs#L8-L45). | Replies/shares/negative-feedback/dwell predictions occur in the public ranking contract. This supports explaining their existence, not predicting them from Jev questions or copying X weights into Dispatch. A like/report weight ratio is not a like/report count exchange rate. |
| Post-age eligibility filter exists, and this export wires a 48-hour cap. | [AgeFilter lines 7–33](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/filters/age_filter.rs#L7-L33); [MAX_POST_AGE config line 36](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/params/config.rs#L36); [pipeline lines 393–400](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L393-L400). | It is a source-specific For You candidate filter, not “all posts disappear after 48 hours,” Dispatch's research validity policy, an optimal posting-time rule or a legal retention requirement. |
| Exact candidate deduplication and separate post-selection visibility filtering exist. | [dedupe lines19–28](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/filters/drop_duplicates_filter.rs#L19-L28); [post-selection pipeline lines479–483](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L479-L483). | Duplicate tweet IDs across retrieval sources are removed and source refs merged. This alone does not prove semantic duplicate-content penalties or that reposted wording receives a numeric penalty. Visibility eligibility and score are distinct. |
| Viewer/safety-level-dependent visibility rules can drop content; recommendation-only rules are added to shared rules. | [registry lines55–89](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/visibility-filtering/rules/registry.rs#L55-L89); [safety-level policy lines277–280](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/visibility-filtering/rules/registry.rs#L277-L280). | Public visibility behavior varies by context. Dispatch cannot infer an account's live labels/restrictions or pronounce a “shadowban” from post text or missing engagement. |
| Author diversity, out-of-network multipliers and cold-start lifts have configurable implementation paths. | [multipliers/lift lines143–239](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/xai-value-model/scoring.rs#L143-L239); [VM value-model config lines95–104](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/vm-ranker/scoring/value_model.rs#L95-L104). | These operate on a personalized candidate slate and config. They do not validate “post exactlyN times,” “new accounts guaranteed a boost,” or a fixed follower/discovery score in Dispatch. |
| Runtime configuration and viewer-specific overrides exist; exported parameter defaults are not the full live configuration. | [ranking config lines22–36,55–58](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/vm-ranker/ranking_config.rs#L22-L58); [parameter mirror timestamp](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/params/param.rs#L1). | Public default values can be versioned and compared as evidence; a parameter value alone does not prove any viewer's effective production setting. No automatic local scoring update from a changed upstream number. |
| A separate VM ranking call can change scores; its failure preserves local weighted results. | [VMRanker lines84–135](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/scorers/vm_ranker.rs#L84-L135). | Reading only the initial weighted sum is insufficient to reproduce final ranking; request/config/service behavior matters. |

Path correction: current pinned `home-mixer/scorers/ranking_scorer.rs`, `author_diversity_scorer.rs` and `oon_scorer.rs` return404. The README's ranking shorthand is explained by `home-mixer/scorers/value_model.rs`, `xai-value-model/scoring.rs` and VM service integration. Do not use historical paths as proof.

## Interpretation and production unknowns

- **Interpretation:** concise, original, coherent content and natural discussion prompts may be reasonable editorial goals. Public ranking code does not establish a direct causal coefficient from Jev “hook/clarity/originality” to reach. Keep these as root's versioned editorial assumptions.
- **Unsupported:** a universal hashtag/mention threshold of3, a guaranteed CTA benefit, numeric Audience/Share/Follow/Dwell/Discovery predictions, best publishing hour, reach uplift from an eight-point Dispatch score gain, or calibration quality. `structure-v1` remains an explicit Dispatch choice, not an X rule discovered here.
- **Production unknown:** the exact deployed revision, per-viewer active experiments/configuration, real training/serving data, current checkpoint parameters, accessible account safety labels and final exposure. Current export calls its Phoenix model/trainer/serving code production implementations but supplies synthetic worlds instead of checkpoint/corpus downloads and replaces internal infrastructure; this is disclosed in [Phoenix README lines9–21 and61–67](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/phoenix/README.md#L9-L67).
- **Omissions/change:** the repo identifies omitted Grox prompts and some Botmaker rules, configuration experimentation and incomplete deployment-related material. [README lines410–442](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/README.md#L410-L442). A newer public commit supplies a more recent inspectable snapshot, not a signed complete production-state report or empirical effectiveness study.
- No customer data, demographics or behavioral embeddings should be collected merely because Phoenix documents such features. Dispatch purpose/privacy/provider gates remain independent. No fairness or effectiveness result was measured here.

## Safe initial algorithm profile for root review

Minimum candidate: `version=x-public-context-v1`, `network=x`, `surface=for_you`, `sourceRepository=xai-org/x-algorithm`, exact SHA/date above, source URLs/line ranges and hashes below, `sourceScope=public_code`, `productionState=unknown`, `scoreFormula=dispatch-score-v1`, `scoringInfluence=none`, `status=draft`.

Mechanisms are informational source-supported context; editorial scoring assumptions remain separately versioned in ad466b1. No public X weights are copied into the heuristic. Own Audience/historical measurements are explicitly unavailable; `.5` historical baseline is the root's marked assumption, not this source's measurement. No embeddings are required for this profile.

Root may review this evidence under delegated authority and record `reviewed`/`active` with actor, reviewedAt, decision reason and evidence reference. This report itself does not claim that review happened. One active profile/version is selected per analysis; historical assessments retain the old ID. The profile can be active **as reviewed public-code context** while production knowledge remains unknown; provider processing flags independently remain default-off pending actual proof.

Suggested operational validity: observedAt=2026-10-05; reviewDueAt=2026-10-12; status becomes source-review-needed after that date or relevant upstream change. Seven days is a review scheduling assumption, not a platform ranking/freshness/retention constant. An immutable old revision remains historical evidence. A lapsed source review cannot justify new claims about current X production, but it need not disable human publishing or turn missing analysis into zero.

## TASK-44 public update comparison contract

1. Resolve official repository branch to exact full SHA using bounded unauthenticated public read; store repository/branch/observedAt/commit date. Allowlist official owner/repository/HTTPS hosts, bound responses and compare data; no execution of fetched code/instructions. Missing/rate-limit/network failure is `source_check_failed`, not “up to date.”
2. If SHA unchanged, update check receipt only. If changed, create one idempotent review proposal `(repository, oldSha, newSha)` with immutable compare URL, before/after source SHA/file hashes and changed paths. Handle GitHub diff pagination/truncation explicitly; incomplete diff means `review_required`, never “no relevant changes.”
3. For selected evidence paths, compare old/new assertions: retrieval/history contract, weighting semantics, eligibility/filter logic, feature/default configuration and omissions. Classify each as source fact, interpretation, or production unknown; show impact on Dispatch assumptions separately. Upstream change does not patch question sets/formula/profile or activate itself.
4. Re-run existing versioned analysis fixtures only when an actual Dispatch interpretation/question/formula changes. Record tests versus actual human-reviewed eval distinctly. Pure source-context changes may be reviewed without pretending they calibrate a model. A change touching an already calibrated model follows TASK-43 evaluation/rollback gate.
5. Root/internal authorized reviewer accepts/rejects candidate, with explicit reasons. Acceptance atomically switches activeProfileId; old version and prior assessments remain immutable. Rollback selects prior reviewed version and creates an audit receipt, preserving the changed version for traceability. No rewrites of historical assessment inputs.
6. Minimum runnable future checks: repeated SHA notification creates one proposal; foreign repo/tenant rejected; truncated comparison remains pending; source update cannot alter active profile before review; profile switch and rollback leave prior predictions unchanged. Scope source-review proposal access/lifecycle and cost/retention using the existing domain/ops inventory.

## Integrity manifest — bytes fetched at the pinned SHA

SHA-256 applies to raw UTF-8 file bytes, not rendered GitHub HTML:

| File | SHA-256 |
|---|---|
| README.md | 78cfe634123654bf5da0dec8a2b10a48d683cb4b42cc3f0e95a3fc362c659010 |
| phoenix/README.md | 01fe6fece2893023b4d64c60ff7e5030d5fabaf892898e6ce95b7818974a7910 |
| home-mixer/scorers/value_model.rs | 58f4bf4f268d7f2f41652202becfbfed18668b23e17180f7f43c5bff5253ddda |
| xai-value-model/scoring.rs | 647df981a3d8ec9f5a46b0691622e523c84d242da9eab43693be05bd6bbcf035 |
| home-mixer/params/param.rs | fa2880ce4f5efe4197442a98a79ca3511195582c6f89c17939395a7750640e1e |
| home-mixer/params/config.rs | 029567d6d5ff100ebc43160feda15225fc2910862a790dc89648f90bc97153ca |
| home-mixer/filters/age_filter.rs | 8b071a27cfcadbcc2cdeee6b9b2c58a4eafc55d5eedae37f02abd028f106739e |
| home-mixer/filters/drop_duplicates_filter.rs | 8b0a5e750c5d8ac44d0129a2c2b293a375f4d3a38dfb5510e2671791b010c91f |
| home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs | 508fe2c90adc05f1fbea396da4bd57a348cf79c068e6d2802349002c210aa34e |
| visibility-filtering/rules/registry.rs | 19a5ced98340ce6b59926ab047fabf48bcf03ba5fd581c937e38131eff7e5690 |
| home-mixer/scorers/vm_ranker.rs | eebd41c03fa9ca32292fd327114c5f7b9cbeb3104f79bef67ffcf96ae4e946c5 |
| vm-ranker/scoring/value_model.rs | c0f854c5e6f99c835669740534c59de54005a2d1436dcc17cb0eb07fca7f1fd4 |
| vm-ranker/ranking_config.rs | e2ed8fcf0ea24229644b9077094cf00fa6bef5c431d729074c8d375059b4ce9c |

No profile was activated, no source-update job created and no Backlog task closed by this review.
