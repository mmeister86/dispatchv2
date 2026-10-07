# TASK-32.3 — fresh independent SPEC final2: PASS

Freeze SHA256 `52a39e12ca87bb4576097dbc6970e0fe40bcc6313fe935fa25f99c39e182c287`, HEAD `4a22190c7014bc2f2facbd214f28dc0db1a8b533`. All351 frozen source/config hashes match; only preferences.ts/test.ts differ from final1, other349 exact. The339 protected old nongenerated paths, all5 generated files, human .zcodeignore and paused inventory document remain unchanged. No source/docs/tests/Backlog/config/env/generated/live/provider writes by this reviewer.

## Correction and independent execution

The actual shared `validateIntent` at convex/preferences.ts:86–99 now obtains Intl's resolved timezone and rejects canonical values beginning with + or -. Both incoming setter intent and stored getter intent pass through this check. It therefore rejects runtime-supported fixed offsets without excluding named IANA zones such as Etc/GMT+1. Values remain bounded to100characters; no new schema, projection, transport or helper framework. Original profile save definition remains byte-exact and independently scoped.

The exact unchanged private control `/tmp/dispatch-32.3-spec-final1-timezone.test.ts` (SHA256 `75e1c44538bfc297d8e81a0c8ad0aae36b1edf8515c0eb82856789ac043d2b74`) was freshly rerun against frozen final2 production modules using the original private config and assertion. It is **GREEN:1 passed/9 skipped, exit0**, resolving the final1 registered-save +01:00 defect. The original RED control/config/log/report are retained and hash-verified unchanged.

Fresh independent command `node node_modules/vitest/vitest.mjs run convex/preferences.test.ts tests/foundation.test.ts tests/team.test.ts convex/operations/export.test.ts` is **75 tests/4 files PASS, exit0**. The new registered control rejects +01:00/-04:30/+00:00/+0100/+01 on setter with original row unchanged, rejects corrupt stored offsets on getter, and accepts UTC/EtcUTC/EtcGMT±1/USEastern/Berlin named zones. Fetch spy stays unused. All original nine preference test bodies/fixture are preserved exactly, corroborated against the unchanged private original copy with only its required absolute imports normalized.

The other seven-path review conclusions are retained from the complete final1 source review and confirmed by exact349-file equality: actual Auth/current session/selected workspace membership precede indexed own lookup; four roles own-only; getter/defaultOFF no writes; no Admin recipient override; CAS conflict/noop/overflow and corrupt values fail closed; profile save preservation and exact8-field profile export boundary; keyed nativeScope/session/account/ABA/unmount/correlation/error privacy; optional stored choices do not activate dispatch or alter required native inbox/Auth mail behavior. The one previously blocking timezone family finding is now resolved by actual registered execution.

## UI evidence and provenance

No fresh final2 browser run is claimed. The actual styled App/Store/CSS1280/390 final1 independent browser evidence is retained:171 current assertions,139 old retained in original order and4 explicitly superseded Cloud mock assertions; Demo body byte-exact. All UI/browser/store files are exact to that run, and its log/receipt/screenshots plus assertion/body artifacts have been hash-verified unchanged. Native persistence is proved separately in fresh final2 tests; browser uses synthetic native-shaped transport.

Initial private guard enumeration omitted shared/ and raised an assertion although all351 file hashes, HEAD/human and historical artifacts already matched. Corrected enumeration includes shared/ and passes; initial read-only comparison also mistakenly compared changed schema imports rather than the unchanged original save definition. Corrected definition-only proof passes. These private setup corrections changed no repository or original assertion. Corrected before/after artifacts bind351 hashes and complete code/config inventory; after guard remains exact. Historical RED/failed/interrupted artifacts remain unchanged and are not relabelled PASS.

No production distributed OCC/provider delivery, instantaneous revocation, actual cloud mutation, new whole-suite/static/codegen execution, EUDev/manual Done or completion of parent TASK32 is claimed. Root codegen evidence is separate; distinct QUALITY and Root whole-native/static gates follow this scoped SPEC PASS.

Receipt binds source guards, fresh commands/logs, exact control/config, body proofs and retained browser evidence: `/tmp/dispatch-32.3-spec-final2-receipt.json`.
