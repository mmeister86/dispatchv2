# TASK33 Unit6A — choose B: enforce actual text-only Agent contract

Read-only concrete handoff,2026-10-09. Root chose B after source comparison. No source/git/Backlog/deploy/tests changed. Suggested exclusive Unit6A source ownership: `convex/ai/provider.ts`, focused additions in `convex/ai/provider.test.ts` (and only necessary local test helper). No new dependency/middleware layer/Agent package patch. Existing original-file export and legacy attachment cleanup remain supported.

## Actual reachable writers/configuration

- Only production `new Agent(...)` is `convex/ai/provider.ts:402`; only actual generate/stream invocations are `generateForRun` at469–470. Default execute first claims native agentRuns then calls this helper. GitHub summary, Idea generation, research and composite repair all create agentRuns and use same provider execute. Research workflow `ai/researchAgent.ts` uses internal.ai.provider.execute; research has tools={}.
- All explicit app saveMessage callers are text: `ai/runs.ts:createRun` accepts prompt:string and saves role user/content promptText; `ai/conversations.ts:send` public prompt:v.string saves concatenated text; researchResult and attachEvidence save role assistant/content string. No direct app storeFile/copyFile/cloneThread/updateMessage file input. Account/domain mutations expose no raw ModelMessage/fileId/storageId upload argument.
- Current only model tools are read_context (native object of bounded strings/declaration arrays from runs.toolContext) and optionally create_idea (validated title/perspective/rationale/questions, returns native ID). Neither returns binary or a model file-content conversion hook. Provider-executed tool-result's native type is JSON; current own tool adapters produce JSON/string, not image/file content.
- Agent has no embeddingModel or rawRequestResponseHandler. Existing human chat is text, generation expects strict{text:string}, research expects text containing validated JSON. Rejecting unexpected binary model output enforces introduced product contract; it removes no requested attachment feature.
- Pinned Agent serializeContent CAN automatically store >64KiB ArrayBuffer image/file parts through app ctx.storage.store. Future callers could reach it without explicit storeFile. Do not generalize current app text contract to all Agent features or claim historical files impossible.
- Additional exact-version nuance: current AI SDK6.0.300 `generate-text/to-response-messages.ts:61` converts generated file to filePart.data=part.file.base64; Agent serializeDataOrUrl preserves strings. Thus a specific ordinary provider file may persist inline base64 instead of creating _storage bytes. Do not claim every provider file necessarily auto-stores. The rejection prevents both unwanted persisted binary/base64 and any alternate automatic storage path before serialization.

## Existing supported boundary; no invented API

`provider.ts:boundedAgent` already uses wrapLanguageModel({middleware:{specificationVersion:'v3',transformParams,wrapGenerate,wrapStream}}). Installed @ai-sdk/provider3.0.18 LanguageModelV3Middleware supports exactly wrapGenerate/wrapStream (no transformGenerateResult hook). Use those existing wrappers.

Native v3 generated images/audio/files are `type:'file'` with mediaType and data:string|Uint8Array. There is no native top-level `type:'image'` in generated-content/stream union; images are mediaType image/* files. Explicitly reject `file` in both paths. No MIME-specific exceptions and no size threshold. A string that mentions file or base64 in legitimate text is still text; do not block it with keyword heuristics. Keep all other current validated text/reasoning/source/tool processing as-is. Unknown malformed runtime part types already fall outside pinned provider contract; no generic multimodal scanner needed for this unit.

### Generate placement

Current doGenerate().then handler settles known usage first. After beforeDeadline(generated,run.deadline) and authorize(), BEFORE return content.map (prefer before JSON.stringify(result.content) size processing), check `result.content.some(part=>part.type==='file')` and throw existing sanitized safeError or fixed MODEL_OUTPUT_UNSUPPORTED code mapped through existing safeError catch. Do not serialize/log file.data to formulate error. Existing known settlement must remain exactly once; catch's unknown settlement must not overwrite it. No filtering binary out and then returning partial success: whole run fails.

This is inside LanguageModel wrapper before AI SDK converts result into StepResult and before Agent onStepFinish invokes call.save→serializeResponseMessages→serializeContent. Validating only generated text at generateForRun end is too late because Agent has already saved the step.

### Stream placement

Current pull loop obtains `const part=next.value`, then JSON-stringifies part to count bytes, handles finish usage, authorizes and enqueues. Add `if(part.type==='file') throw safeError()` immediately after next.value and BEFORE JSON serialization, controller.enqueue, SDK/UI stream processing or any native delta/body save. Existing catch calls unknown(), reader.cancel and controller.error(safeError); this is the correct fail-closed route. Do not enqueue the file and remove it later; do not only inspect final text/finish.

Previously emitted text/reasoning deltas may remain failed native history and are cleaned by normal source/retention; no file part/body may be emitted or persisted. Error is fixed/sanitized. If file arrives before finish, later unread finish usage is genuinely unknown under existing stream cancellation: retain original hold/unknown rather than invent zero or drain arbitrary unsafe stream to get usage. If known finish usage was already observed/settled, later rejection/cancel must not overwrite or double-charge it. Tests should distinguish these cases. Generated mixed-text+file includes known usage before validation and settles it once.

## Targeted native fixture proof

Use existing provider.test.ts `claimed`/modelFixture, real registered Agent, MockLanguageModelV3 and simulateReadableStream. Keep existing normal text/reasoning/tool tests; no broad rewrite. Add meaningful tests:

1. doGenerate returns valid ordinary text + native file part with Uint8Array and mediaType image/png. Include file-only as table case, and base64 file data (unsupported regardless encoding/size). generateForRun rejects fixed sanitized error. Known token usage spent once, held released only as actual known usage permits; no duplicate physical model call.
2. Streaming text-start/text-delta followed by file: wrapped output rejects/cancels before any file crosses boundary. Native message and stream delta scans contain no file body/file part/storage URL; no component files row or app _storage created by this run. Original attempt remains unknown if finish wasn't observed; no claimed successful run/domain output. execute-path test should confirm terminal failed and executionFinishedAt when coordinator relies on it.
3. Stream with already-observed known finish then erroneous file: known settlement immutable once despite subsequent error/cancel; if SDK stops at finish, test actual wrapper/native consumption behavior rather than synthetic unreachable assertions. At minimum assert the real generate known-usage case plus real interrupted-stream unknown case; don't fake knowledge of unread usage.
4. Spy on app storage.store in action harness (or inspect actual app _storage and registered component files after run); assert no file store. Inspect actual component saved messages AND stream deltas, not merely result.text. Use distinctive file-body sentinel and ensure no logger/debug body. Fixed sanitized error may be logged by SDK; secret bytes must not be present.
5. Existing text success, reasoning, legitimate read_context/create_idea, research structured text and composite repair remain passing. Test file rejection before JSON stringify with file body whose conversion must not be invoked, if useful, without replacing actual native file fixture.

Tests must not claim no prior historical file rows globally; compare before/after this run or own fixture. Native fixture evidence plus original-file legacy cleanup path is sufficient for this unit. Prior14EMPTY Dev snapshot is evidence only for that deployment/time.

## Legacy/historical files remain separate supported erasure

Keep authorized original-file export, exact own root→thread→message.fileIds→filemeta→app-storage proof and capture-before-parent-deletion flow from task33-agent-files-erasure-preflight.md. Ordinary own refcount0 metadata is retired nonforce after recheck, then exact held app storage key is deleted and verified. Real foreign references retain shared bytes. Positive-count anomalies, unowned zero-count orphan metadata/raw storage, mapping mismatch or missing provenance BLOCK that cleanup slice; B never authorizes global sweep/reset or force delete. Account/workspace complete must respect these dispositions. Source expiry/thread deletion paths must also capture known files before removing message ownership evidence.

## Option A assessed, not selected

A can close ordinary concurrent foreign serialization for app-linked candidates by proving globally no claimed-unfinished file-capable agentRun at the SAME app mutation that retires zero-refcount metadata. Existing run claim writes executionKey, state running; finish writes executionFinishedAt even if generation stopped. Minimal new index `[executionFinishedAt,executionKey]` supports missing finish+non-null key prefix/range; alternatively explicit active producer field/index requires migration. State==running alone is insufficient because stopped runs may still execute; queued/unclaimed runs cannot yet store, but concurrent claim must conflict with exact empty predicate read under OCC. No foreign body read or user-visible global producer list needed.

Run claim/start after metadata retirement cannot dedupe the removed file metadata and must produce a new blob. A previously claimed foreign run paused after useExistingFile remains in pending predicate and defers retirement. Default Agent streaming call uses saveStreamDeltas:true, which sets willAwaitStream; native streamText awaits consumption and final call.save before return. generateText awaits onStepFinish save. Therefore current execute's finish receipt is a plausible real producer bound; test its error/cancel paths. Never delete run rows while execution unfinished, or predicate loses evidence. A crash before finish leaves blocking producer until separately proved ended; deadline alone is not actual execution completion.

A has global contention/starvation while any tenant's run is active and still cannot assign ownership to an SDK crash after app storage.store but before file metadata/message capture. It also cannot repair refcount anomalies. Therefore A does not alone complete the broader file lifecycle, and is unnecessary for B's current text-only future producers once old executions have drained.

## Upgrade condition

Any future Task59/attachment/file-output feature, provider adapter change, binary tool output, direct storeFile/copyFile/clone use, or Agent raw-model bypass must deliberately introduce owned producer/storage receipts and concurrent shared-file cleanup before relaxing file rejection. This is a concrete lifecycle dependency, not a request to build that feature now. Keep one concise why-comment at boundary if needed: Dispatch currently stores text-only Agent results; file lifecycle requires explicit introduction.

Not run: tests, deployments, fresh live file audit. Recommendation is exact current-source minimal change, not proof of impossible future file creation.
