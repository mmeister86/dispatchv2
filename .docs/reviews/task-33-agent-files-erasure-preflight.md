# TASK33.2 — Agent0.6.4 file erasure: actual references and physical bytes

Read-only source preflight,2026-10-09. No source/git/Backlog/deploy/test mutations. Inspected installed Agent0.6.4 source plus /tmp/task33-original-media-export-preflight.md. The earlier14-table Dev EMPTY audit is historical evidence only: automatic SDK file storage is reachable, so files cannot be classified permanently unused.

## Finding

**Native Agent thread/message deletion does NOT remove app `_storage` bytes, and does not delete the component files row.** It deletes messages/linked embeddings and decrements file refcounts. `Agent.deleteThreadAsync` merely calls native thread deletion and discards its `{isDone}` result; `deleteThreadSync` loops messages/streams, still no files/storage sweep. There is no `deleteMessagesAsync` method in this installed client; supported names are `deleteMessages`, `deleteMessage`, `deleteMessageRange`, `deleteThreadAsync`, `deleteThreadSync`.

The only `ctx.storage.delete` in installed Agent client is client/files.ts:102, deleting a losing duplicate upload created during a concurrent storeFile race. Component files.deleteFiles deletes metadata only; component cannot implicitly address Dispatch app storage. Physical cleanup must execute app-owned `ctx.storage.delete(derivedStorageId)` using retained exact storage identity, not URL fetch or provider deletion.

No current convex app file invokes files.deleteFiles/getFilesToDelete or owns a complete Agent app-storage cleanup path. Existing `ai/conversations.cleanup`, `ai/runs.purgeSource`, `research/pipeline.purge` can erase the only message->fileId ownership links before any bytes are reclaimed. They must integrate capture first; adding a later global zero-refcount sweep does not recover lost tenant provenance.

## Exact supported APIs/signatures

Native component references under `components.agent` (generated public wrapper IDs are strings; component internals validate typed component IDs):

- `messages.listMessagesByThreadId({threadId,order:'asc'|'desc',paginationOpts?:{cursor:string|null,numItems:number,...},excludeToolMessages?:boolean,statuses?:MessageStatus[],upToAndIncludingMessageId?:messageId}) -> {page:MessageDoc[],continueCursor,isDone}`. Defaults statuses to ALL native statuses; `excludeToolMessages:false` includes tool and nontool. PublicMessage strips parentMessageId/stepId/deprecated files, but **retains fileIds**. Supply explicit pagination; default is recent20 and not complete. For deletion include system/tool/pending/failed messages, unlike user-facing private export.
- `messages.getMessagesByIds({messageIds:string[]}) -> (MessageDoc|null)[]`; exact ownership must be established by app root/thread first.
- `messages.deleteByIds({messageIds:string[]}) -> deletedMessageIds:string[]`; no tenant authorization native. `deleteByOrder({threadId,startOrder,startStepOrder?,endOrder,endStepOrder?}) -> {isDone,lastOrder?,lastStepOrder?}`, current batch64.
- `threads.deleteAllForThreadIdAsync({threadId,cursor?,messagesDone?,streamsDone?,streamOrder?,deltaCursor?,limit?}) -> {isDone:boolean}`; schedules native continuations. `threads.deleteAllForThreadIdSync({threadId,limit?}) -> null` is an action; no durable app completion receipt unless caller persists it.
- `files.get({fileId}) -> null|{_id,_creationTime,storageId:string,hash:string,filename?,mediaType?,mimeType?,refcount:number,lastTouchedAt:number}`.
- `files.getFilesToDelete({paginationOpts}) -> {page:FileDoc[],continueCursor,isDone}`: global index `refcount==0`, no owner or thread filter; never a tenant-owned discovery API.
- `files.deleteFiles({fileIds:string[],force?:boolean}) -> deletedFileIds:string[]`: skips missing and positive-refcount rows unless force=true; deletes zero AND negative-refcount rows. No age check, no lastTouched CAS, no storage deletion. Coordinator must explicitly require refcount===0 and valid finite timestamp; **never force**.
- `files.useExistingFile({hash,filename?}) -> null|{fileId,storageId}` touches lastTouchedAt, **does not increment refcount** despite being a mutation.
- `files.addFile({storageId,hash,filename?,mediaType?,mimeType?}) -> {fileId,storageId}` creates new metadata with refcount0; existing same hash+filename increments refcount by1 and touches lastTouchedAt.
- `files.copyFile({fileId}) -> null` increments refcount and lastTouchedAt; no new metadata/byte copy.

App storage proof/cleanup: normalize derived storageId as `_storage`, read exact app system `_storage` metadata/hash, then app storage.delete. Keep this inside app server code; never return storageId or arbitrary delete selector to client. No fileId/storageId provided by user is authority.

SDK methods:
```
agent.deleteMessages(ctx:MutationCtx|ActionCtx,{messageIds:string[]}):Promise<void>
agent.deleteMessage(ctx:MutationCtx|ActionCtx,{messageId:string}):Promise<void>
agent.deleteMessageRange(ctx,{threadId,startOrder,startStepOrder?,endOrder,endStepOrder?})
  :Promise<{isDone,lastOrder?,lastStepOrder?}>
agent.deleteThreadAsync(ctx:MutationCtx|ActionCtx,{threadId,pageSize?}):Promise<void>
agent.deleteThreadSync(ctx:ActionCtx,{threadId,pageSize?}):Promise<void>
```
None invokes app storage.delete for owned attachments. The coordinator should use native thread API to retain actual isDone.

## Physical ownership graph and indices

Authorized native app `conversations` or `agentRuns`/`researchOrders` -> exact `threadId` -> native message with matching thread -> unique `message.fileIds[]` -> `files._id` -> exact `files.storageId/hash` -> app `_storage` metadata/bytes.

Files table has **only** `hash[hash]` and `refcount[refcount]` indexes; no workspace,user,thread,storageId or ownership. Messages table has `threadId_status_tool_order_stepOrder` and `embeddingId_threadId` plus text search. **No fileId reverse-reference index or supported list-references API exists.** Arrays are not a normal multi-entry index. Do not invent a `by_fileId` existing route.

Same hash+filename globally deduplicates, including across different users/workspaces/threads. A file metadata row/physical blob is legitimately shared. Native content URLs can also exist without tracked fileIds; unsupported historical alias/URL does not prove file ownership and must not be parsed into an arbitrary storage delete.

Exact capture receipt must survive every app/native parent being removed: jobId, original app root kind/id, original threadId, original messageId, fileId, storageId, hash, observed file state, current processing state, capturedAt. Deduplicate per job+fileId; keep source association enough for audit without copying body/filename. Include candidate storageId proof even if metadata subsequently disappears. App `_storage` hash must match file.hash before any physical deletion. A missing/mismatched/foreign storage mapping is blocked/reconciliation, not assumed success.

## Actual refcount transitions and limitations

`component/messages.ts::deleteMessage` unconditionally handles every message role/status: deletes message, linked embedding, then `changeRefcount(message.fileIds,[])`. `changeRefcount` uses Sets, so repeated same fileId within one message is one reference; two messages count twice. Deleting missing message is idempotent through deleteByIds; same recorded row is not decremented twice.

- New saved message: increment each unique fileId once, including pending/failed/system/tool if fileIds are present. File missing on increment throws; missing on decrement logs and continues.
- Pending replacement: if new message.fileIds is present, reconcile previous set->new set. **If omitted, code replaces the pending message without calling changeRefcount**, so previous fileIds may disappear without decrement. This can strand a positive count.
- updateMessage: explicit patch.fileIds (including[]) reconciles previous->next. Omission preserves existing refs; message-only edits do not infer attachment removal. Removal of a URL does not itself decrement.
- cloneMessageBatch: increments fileIds for each actually inserted clone. Shared clones are protected by the count.
- Ordinary storeFile path: useExistingFile touches but does not reserve; new store creates refcount0, subsequent message save increments. **Racing two storeFile calls:** both can miss initial lookup; second addFile reuses existing and increments+1, then normal saved message increments another+1. Extra count is not backed by a message edge. Existing component tests intentionally cover addFile(existing) increment, so do not silently patch that API as an obvious typo.
- copyFile increments separately; another later save may increment again. Count may represent explicit unsaved holds; cannot equate positive count with proved foreign persisted message.
- changeRefcount does not touch lastTouchedAt when removing/adding through message operations. Recent useExistingFile/addFile/copyFile touches it. LastTouchedAt recommendation is advisory; no active-upload/serialization lease is enforced by deleteFiles.
- Negative refcount is inconsistent; deleteFiles would delete it because it only blocks >0. Coordinator must reject negative/noninteger/inconsistent rows and must not force cleanup.

Therefore native refcount0 is a useful atomic guard for correctly tracked persisted refs, **not tenant ownership proof**, and positive refcount is not proof of a foreign message. Preserve all positive rows; mark shared-retained only when an actual independent remaining reference is proved, otherwise unresolved/refcount-reconciliation. No production claim that all byte cleanup completes from refcount alone.

## Smallest bounded coordinator path

1. Lock domain/workspace/user and fence generation. Wait actual executionFinishedAt for every producer incarnation so own SDK serialization/save cannot race the scan. Merely aborting a stream or marking run stopped is insufficient. Existing source-retention cleanup paths must obey same capture requirement, not only manual workspace deletion.
2. Before native delete starts, paginate the full own thread through listMessagesByThreadId(order asc, all statuses, tool included). At most10–25 message rows per step with bounded file-reference subcursor. Read each exact files.get, validate app-storage namespace/hash, persist a deduped candidate receipt. Store paging progress in deletion job; do not collect all attachments into one growing array. Capture metadata BEFORE deleting that message. Only after the complete capture pass may native async full-thread deletion begin. Alternative atomically capture/deleteByIds each page, then native final streams/thread cleanup is also valid if native cursor handling is proved; two-pass is simpler initially.
3. Native message/thread removal must reach isDone, plus app producer-finished proof. Candidate receipt remains even when conversation/run/thread already gone. Inline <=64KiB binary parts vanish with message; external URL references require explicit unsupported/external-only disposition, not storage deletion.
4. For each captured candidate, re-read file metadata. If still positive refcount, preserve bytes+metadata. If another authorized native app root/thread is already known to reference it, mark this deletion job's reference removed/shared-retained. Otherwise retain waiting refcount-reconciliation; supported APIs cannot establish the foreign inverse graph globally. A narrow component reference census/maintenance endpoint would be needed for full orphan reconciliation (see below), not brute force.
5. For zero count, require current mapping/hash exactly match receipt, valid numeric count, and no known serializer hold. Native comment recommends excluding touched<24h; that is a practical deferral, **not a proof** that an arbitrary future delayed save cannot reference it. Current storeFile can return reused fileId before message save. A production implementation must either (a) use a finite verified writer-lifetime/quiescence bound that covers actual SDK actions and refresh touches, documented and tested, or (b) add narrow native deletion claim/in-flight reservation semantics. Do not turn the comment into a contractual guarantee. If missing, state waiting/component-proof.
6. Safely remove component metadata with `deleteFiles({fileIds:[id]})`, force omitted, and require returned IDs include id. Do this within an app mutation that has just re-read exact file.refcount===0 and original mapping, then persists candidate state `metadata-deleted,bytes-pending`. The child component mutation must participate in the same transaction for CAS semantics; verify this with native tests/current docs before relying on it. The receipt already contains storageId. If metadata deletion refuses because count changed, preserve bytes and retry. Never call storage.delete merely because files.get returned null unless own durable metadata-deleted receipt proves the mapping was captured and retirement was committed.
7. Delete app bytes using exact receipt storageId from app storage context, then record `bytes-deleted`. Prefer one app mutation containing component retirement+storage.delete+receipt if platform transactional storage semantics are verified; otherwise the durable intermediate state makes crash-after-metadata-before-bytes safely resumable. Metadata removed first prevents new normal hash dedupe from finding this blob; new writer stores a separate blob. Persisted foreign references prevent retirement via native count. A writer holding an old fileId might fail to save after retirement: avoid that through step5, never silently treat as successful unrelated message persistence.
8. Retry missing app bytes as idempotent success only with correct original binding and own pending-delete receipt. Verify metadata absence and _storage absence before own physical-complete. Keep minimal job receipt until final verification, then expire30days except unresolved reference/producer conditions. No global getFilesToDelete purge, force deletion or clearing app _storage.

The supported graph handles real own tracked files now. Explicit positive-count inconsistency and pending/unowned metadata are blocked cases, not reason to omit every supported file. Zero-refcount files with no original own message/captured receipt can arise from interrupted serialization, backup or preexisting orphan; they are **not attributable** to requesting tenant from hash,age or count. Do not delete them under this tenant job. A scoped producer ownership receipt at store time is needed to cover future crash-before-message files; app/node storage upload before component registration can also leave a raw unowned _storage orphan. Capturing only linked messages cannot claim full coverage of those classes.

## When a narrow Agent patch is needed

For complete future byte erasure under reachable automatic file storage, a bounded file lifecycle seam is needed beyond existing cleanup APIs:

- Wire automatic serialize/storeFile source to capture original app run/thread and storageId before message parent may vanish. A small owned wrapper/forked serialize hook only helps if EVERY reachable SDK automatic call uses it; patch exact pinned serialization/storeFile path if necessary, with reproducible src+dist/package handling like Workflow. Do not monkeypatch one caller and assert provider-output automatic serialization covered.
- Add explicit scoped candidate registration after actual byte store and before exposing result; stable producer completion closes unsaved reservation. Native component does not know Dispatch workspace, so app must supply trusted derived root, never client-supplied ownership.
- Reverse reference cleanup can be a bounded component scan over all messages for candidate fileIds returning only reference identities, or a normalized file-message edge table maintained by actual message save/update/clone/delete plus migration. A full normalized graph is larger; for rare inconsistency use bounded census with no copied bodies and a completion/mutation fence. It must not return entire foreign messages to app client. A plain one-time global scan without concurrent-mutation control is not a proof of no refs.
- Preserve native dedupe and live foreign references. Do not repair refcount by setting zero because own thread ended; existing API permits explicit copy/unsaved holds. Resolve those producers first. Unprovable legacy unowned records require dedicated operational reconciliation, not a tenant-wide delete shortcut.

This is a concrete limitation to expose until supported maintenance is implemented. Current14EMPTY Dev audit does not exempt future SDK file producers.

## Native fixture proof plan (do not run as part of preflight)

Reuse tests/model-fixture.ts/modelFixture and convex/ai/conversations.test.ts registered actual Agent; tests/research-fixture.ts/pipelineFixture for owned research roots. New focused `convex/operations/deletion.test.ts` or `deletionFiles.test.ts` with real app `_storage` Blob and registered component files/messages; all bytes use actual metadata SHA256, not arbitrary fake hash.

1. Action harness calls installed storeFile on >64KiB binary; save via native SDK serialization to reach real automatic path; assert _storage and component files exist, then deletion captures before message/thread gone and physically removes storage.
2. Same fileId twice in one message vs same file in two messages; own system/tool/pending/failed entries captured; no visible-only filter. Page>25 messages and multiple files per message; durable restart after each cursor/subcursor checkpoint.
3. Same deduped blob referenced by own+foreign thread: delete own, foreign message+metadata+bytes intact; second tenant deletion then removes only after final actual reference. Clone same-file references likewise.
4. Crash after candidate capture, native message erase, component metadata erase, and storage erase; each resume idempotent, original storage key never lost, metadata absent without prior own receipt blocks.
5. Metadata hash/storageId changed, missing file metadata pre-capture, mismatched app storage hash, raw foreign storage ID injection, unknown URL alias: fail before bytes delete.
6. Native addFile-existing race + normal save demonstrates extra count; pending replacement omitting fileIds demonstrates orphan count; copyFile hold demonstrates count not equal to message cardinality. Positive/negative inconsistent counts never force deletion or false complete.
7. Pause unrelated storeFile after useExistingFile before save while own last-message deletion executes. Grace/producer reservation correctly defers retirement; no broken foreign save. Verify transaction conflict if foreign message increments during retirement.
8. Interrupted storeFile before message save/new _storage before metadata registration: job must report unsupported/unowned cleanup, not claim complete or delete global rows. Future producer capture seam test verifies owned pending file discovery if implemented.
9. No live provider/storage service call needed for native fixture; fixtures prove implementation, not deployed garbage absence. Subsequent exact Dev integration receipt should verify actual own test blob disappearance and unrelated blob survival, only when Root authorizes.

## Source anchors

node_modules/@convex-dev/agent/src/component/files.ts:26 addFileHandler;82 useExistingFile;111 changeRefcount;144 copyFile;173 getFilesToDelete;191 deleteFiles. component/messages.ts:46 publicMessage;50 deleteMessage;64 deleteByIds;270 pending replacement;309 insert references;427 updateMessage;544 clone refs;623 list API;686 getMessagesByIds. component/threads.ts:134 sync;181 async;220 message page. component/schema.ts:18 threads;31messages+indexes;150files+indexes. client/files.ts:18MAX_FILE_SIZE;38storeFile;67reuse;83store;102losing duplicate delete. mapping.ts:422serializeContent and454/475 automatic store. client/index.ts:1390deleteMessages;1475deleteThreadAsync;1492deleteThreadSync.

Not checked/run: native fixtures, actual storage transaction semantics documentation, fresh deployed rows, real byte erasure. Main risk: losing the only message->file ownership edge before capturing storage identity, then either leaking bytes or deleting another tenant's deduped object.
