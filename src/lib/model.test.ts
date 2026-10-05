import { describe, it, expect } from "vitest";
import {
  createSeed,
  currentVersion,
  editDraft,
  approveDraft,
  scheduleDraft,
  approved,
  canResumeSnapshot,
  resumeSnapshot,
  revokeDraftApproval,
  approveSnapshot,
  replaceScheduledVersion,
  disconnectAccount,
} from "./model";
import { resolveLocalTime } from "./time";
describe("Editorial mock invariants", () => {
  it("required stage reviews bind approval to version and account", () => {
    let state = createSeed();
    state = {
      ...state,
      drafts: state.drafts.map((d) =>
        d.id === "draft-1"
          ? { ...d, reviewPolicy: { editorial: true, brand: true } }
          : d,
      ),
    };
    expect(() => approveDraft(state, "draft-1")).toThrow(/Reviews/);
    state = {
      ...state,
      drafts: state.drafts.map((d) =>
        d.id === "draft-1"
          ? {
              ...d,
              reviews: [
                {
                  version: 1,
                  accountId: "acc-x",
                  stage: "editorial",
                  by: "Lea",
                  at: new Date().toISOString(),
                },
                {
                  version: 1,
                  accountId: "acc-x",
                  stage: "brand",
                  by: "Lea",
                  at: new Date().toISOString(),
                },
              ],
            }
          : d,
      ),
    };
    state = approveDraft(state, "draft-1");
    expect(approved(state.drafts.find((d) => d.id === "draft-1")!)).toBe(true);
    state = editDraft(state, "draft-1", {}, ["Neue Version"]);
    expect(() => approveDraft(state, "draft-1")).toThrow(/Reviews/);
  });
  it("a working version change does not block authorized partial snapshot recovery", () => {
    let state = createSeed();
    const slot = state.schedules.find((s) => s.status === "partial")!;
    state = editDraft(state, slot.draftId, {}, ["Neue Arbeitsversion"]);
    state = approveDraft(state, slot.draftId);
    expect(canResumeSnapshot(state, slot)).toBe(true);
    state = resumeSnapshot(state, slot.id);
    expect(state.schedules.find((s) => s.id === slot.id)?.publishedCount).toBe(
      slot.text.length,
    );
    expect(
      currentVersion(state.drafts.find((d) => d.id === slot.draftId)!).text,
    ).toEqual(["Neue Arbeitsversion"]);
  });
  it("a revoked partial snapshot needs its own explicit reapproval", () => {
    let state = createSeed();
    const slot = state.schedules.find((s) => s.status === "partial")!;
    state = revokeDraftApproval(state, slot.draftId);
    expect(canResumeSnapshot(state, slot)).toBe(false);
    expect(() => resumeSnapshot(state, slot.id)).toThrow();
    state = approveSnapshot(state, slot.id);
    expect(canResumeSnapshot(state, slot)).toBe(true);
  });
  it("unresolved publishing outcomes cannot be resumed blindly", () => {
    const state = createSeed();
    const slot = state.schedules.find((s) => s.status === "uncertain")!;
    expect(canResumeSnapshot(state, slot)).toBe(false);
    expect(() => resumeSnapshot(state, slot.id)).toThrow(/abgleichen/);
  });
  it("rejects mutation of a draft from another workspace", () => {
    const state = createSeed();
    expect(() => editDraft(state, "draft-client", {}, ["Hallo"])).toThrow(
      /Workspace/,
    );
    expect(() => approveDraft(state, "draft-client")).toThrow();
  });
  it("snapshot replacement requires the same account and fresh authorization", () => {
    let state = createSeed();
    state = editDraft(state, "draft-2", {}, [
      "Neue bewusst freigegebene Version",
    ]);
    expect(() => replaceScheduledVersion(state, "slot-1")).toThrow(/freigeben/);
    state = approveDraft(state, "draft-2");
    state = replaceScheduledVersion(state, "slot-1");
    expect(state.schedules[0].version).toBe(2);
    expect(state.schedules[0].authorization?.version).toBe(2);
    expect(state.schedules[0].authorization?.accountId).toBe("acc-x");
    const snapshot = structuredClone(state.schedules[0]);
    state = editDraft(state, "draft-2", { accountId: "acc-linkedin" });
    state = approveDraft(state, "draft-2");
    expect(() => replaceScheduledVersion(state, "slot-1")).toThrow(
      /Account geändert/,
    );
    expect(state.schedules[0]).toEqual(snapshot);
    expect(() =>
      replaceScheduledVersion({ ...state, role: "Viewer" }, "slot-1"),
    ).toThrow(/Rechte/);
  });
  it("disconnect suspends queued slots while preserving uncertain and partial outcomes", () => {
    const state = createSeed();
    const changed = disconnectAccount(state, "acc-x");
    expect(
      changed.schedules.filter(
        (s) => s.accountId === "acc-x" && s.status === "scheduled",
      ),
    ).toHaveLength(0);
    expect(changed.schedules.find((s) => s.id === "slot-3")).toEqual(
      state.schedules.find((s) => s.id === "slot-3"),
    );
    expect(changed.schedules.find((s) => s.id === "slot-5")).toEqual(
      state.schedules.find((s) => s.id === "slot-5"),
    );
    expect(changed.schedules[0].error).toContain("ausdrücklich fortsetzen");
    const reconnected = {
      ...changed,
      accounts: changed.accounts.map((a) => ({ ...a, connected: true })),
    };
    expect(reconnected.schedules[0].status).toBe("failed");
  });
  it("new edits invalidate current approval and preserve planned snapshots", () => {
    let state = createSeed();
    const before = state.schedules.find((s) => s.draftId === "draft-2")!;
    state = editDraft(state, "draft-2", {}, ["Ein veränderter Beitrag."]);
    const d = state.drafts.find((d) => d.id === "draft-2")!;
    expect(currentVersion(d).number).toBe(2);
    expect(approved(d)).toBe(false);
    expect(state.schedules.find((s) => s.id === before.id)?.text).toEqual(
      before.text,
    );
    expect(state.schedules.find((s) => s.id === before.id)?.version).toBe(1);
  });
  it("account and media changes require new approval", () => {
    const state = createSeed();
    const changed = editDraft(state, "draft-2", { accountId: "acc-linkedin" });
    expect(approved(changed.drafts.find((d) => d.id === "draft-2")!)).toBe(
      false,
    );
    const mediaChanged = editDraft(state, "draft-2", {}, undefined, [
      "media-1",
    ]);
    expect(approved(mediaChanged.drafts.find((d) => d.id === "draft-2")!)).toBe(
      false,
    );
  });
  it("cannot schedule without approval", () => {
    const state = createSeed();
    expect(() =>
      scheduleDraft(
        state,
        "draft-1",
        new Date(Date.now() + 86400000).toISOString(),
      ),
    ).toThrow(/freigegeben/);
  });
  it("accepting two approved versions creates exactly two and repeated acceptance is idempotent", () => {
    let state = createSeed();
    state = approveDraft(state, "draft-1");
    state = approveDraft(state, "draft-4");
    const count = state.schedules.length;
    const a = new Date(Date.now() + 86400000).toISOString();
    const b = new Date(Date.now() + 172800000).toISOString();
    state = scheduleDraft(state, "draft-1", a);
    state = scheduleDraft(state, "draft-4", b);
    expect(state.schedules).toHaveLength(count + 2);
    state = scheduleDraft(state, "draft-1", a);
    expect(state.schedules).toHaveLength(count + 2);
  });
  it("rejects past dates, disconnected accounts and occupied slots", () => {
    let state = createSeed();
    state = approveDraft(state, "draft-1");
    expect(() =>
      scheduleDraft(state, "draft-1", "2020-01-01T10:00:00Z"),
    ).toThrow(/Zukunft/);
    const used = state.schedules.find((s) => s.status === "scheduled")!.at;
    expect(() => scheduleDraft(state, "draft-1", used)).toThrow(/belegt/);
    state = {
      ...state,
      accounts: state.accounts.map((a) =>
        a.id === "acc-x" ? { ...a, connected: false } : a,
      ),
    };
    expect(() => approveDraft(state, "draft-1")).toThrow();
  });
  it("Viewer cannot edit; Editor cannot approve", () => {
    const seed = createSeed();
    expect(() =>
      editDraft({ ...seed, role: "Viewer" }, "draft-1", {}, ["Hallo"]),
    ).toThrow(/ansehen/);
    expect(() => approveDraft({ ...seed, role: "Editor" }, "draft-1")).toThrow(
      /Rechte/,
    );
  });
  it("missing alt text prevents approval", () => {
    let state = createSeed();
    state = { ...state, media: state.media.map((m) => ({ ...m, alt: "" })) };
    state = editDraft(state, "draft-1", {}, undefined, ["media-1"]);
    expect(() => approveDraft(state, "draft-1")).toThrow();
  });
});
describe("Explicit wall-clock scheduling", () => {
  it("resolves a normal Berlin time", () =>
    expect(resolveLocalTime("2026-10-05T10:00", "Europe/Berlin")).toEqual([
      "2026-10-05T08:00:00.000Z",
    ]));
  it("rejects non-existent DST wall-clock times", () =>
    expect(resolveLocalTime("2026-03-29T02:30", "Europe/Berlin")).toEqual([]));
  it("offers both instances at DST fall-back", () =>
    expect(resolveLocalTime("2026-10-25T02:30", "Europe/Berlin")).toEqual([
      "2026-10-25T00:30:00.000Z",
      "2026-10-25T01:30:00.000Z",
    ]));
});
