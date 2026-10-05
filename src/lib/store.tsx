import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  createSeed,
  uid,
  now,
  type AppState,
  type Draft,
  type Idea,
} from "./model";
const KEY = "dispatch-demo-v1";
function readState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (
        s.schemaVersion === 1 &&
        [
          s.workspaces,
          s.accounts,
          s.drafts,
          s.schedules,
          s.ideas,
          s.media,
        ].every(Array.isArray) &&
        s.preferences
      )
        return s;
    }
  } catch {
    /* Invalid local demo data resets safely. */
  }
  return createSeed();
}
const Context = createContext<{
  state: AppState;
  setState: (update: React.SetStateAction<AppState>) => boolean;
  mutate: (fn: (s: AppState) => AppState, message?: string) => boolean;
  createDraft: (
    title: string,
    text?: string,
    source?: string,
    accountId?: string,
  ) => string;
  ideaToDraft: (idea: Idea) => string;
  reset: () => void;
} | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setMemoryState] = useState<AppState>(readState);
  const latest = useRef(state);
  const commit = useCallback((next: AppState) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      latest.current = next;
      setMemoryState(next);
      return true;
    } catch {
      toast.error(
        "Lokaler Speicher ist voll. Änderung wurde nicht gespeichert. Große Medien entfernen oder Daten exportieren.",
      );
      return false;
    }
  }, []);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) commit(latest.current);
    } catch {
      /* Storage failures are reported when a user attempts to save. */
    }
  }, [commit]);
  const setState = useCallback<
    (update: React.SetStateAction<AppState>) => boolean
  >(
    (update) => {
      return commit(
        typeof update === "function" ? update(latest.current) : update,
      );
    },
    [commit],
  );
  const mutate = useCallback(
    (fn: (s: AppState) => AppState, message?: string) => {
      try {
        if (!commit(fn(latest.current))) return false;
        if (message) toast.success(message);
        return true;
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Aktion konnte nicht ausgeführt werden.",
        );
        return false;
      }
    },
    [commit],
  );
  const makeDraft = (
    title: string,
    text = "",
    source = "Manuelle Notiz",
    accountId = latest.current.activeAccountId,
  ) => {
    const state = latest.current;
    const id = uid("draft");
    if (state.role === "Viewer") {
      toast.error("Viewer können keine Entwürfe erstellen.");
      return "";
    }
    const draft: Draft = {
      id,
      title,
      workspaceId: state.activeWorkspaceId,
      accountId,
      pillar: "Building in public",
      versions: [
        {
          number: 1,
          text: [text],
          mediaIds: [],
          createdAt: now(),
          reason: "Erster Entwurf",
        },
      ],
      comments: [],
      strategy: "generic",
      source,
      reviewPolicy: state.reviewPolicies?.[state.activeWorkspaceId],
    };
    return draft;
  };
  const createDraft = (
    title: string,
    text = "",
    source = "Manuelle Notiz",
    accountId?: string,
  ) => {
    const draft = makeDraft(title, text, source, accountId);
    return draft && mutate((s) => ({ ...s, drafts: [draft, ...s.drafts] }))
      ? draft.id
      : "";
  };
  const ideaToDraft = (idea: Idea) => {
    const existing = latest.current.ideas.find(
      (i) => i.id === idea.id,
    )?.draftId;
    if (existing) return existing;
    const draft = makeDraft(idea.title, idea.description, idea.source);
    return draft &&
      mutate((s) => ({
        ...s,
        drafts: [draft, ...s.drafts],
        ideas: s.ideas.map((i) =>
          i.id === idea.id
            ? { ...i, status: "accepted", draftId: draft.id }
            : i,
        ),
      }))
      ? draft.id
      : "";
  };
  return (
    <Context.Provider
      value={{
        state,
        setState,
        mutate,
        createDraft,
        ideaToDraft,
        reset: () => {
          mutate(() => createSeed(), "Demo-Daten zurückgesetzt.");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const s = useContext(Context);
  if (!s) throw new Error("StoreProvider fehlt");
  return s;
}
export function useLocalState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`dispatch-${key}`);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  const latest = useRef(value);
  const loadedKey = useRef(key);
  useEffect(() => {
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    let next = initial;
    try {
      const raw = localStorage.getItem(`dispatch-${key}`);
      if (raw) next = JSON.parse(raw);
    } catch {
      /* Invalid module settings use their local defaults. */
    }
    latest.current = next;
    setValue(next);
  }, [key]);
  const persist = useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (update) => {
      const next =
        typeof update === "function"
          ? (update as (prev: T) => T)(latest.current)
          : update;
      try {
        localStorage.setItem(`dispatch-${key}`, JSON.stringify(next));
      } catch {
        toast.error(
          "Demo-Einstellungen konnten nicht gespeichert werden. Die Änderung wurde verworfen.",
        );
        return;
      }
      latest.current = next;
      setValue(next);
    },
    [key],
  );
  return [value, persist];
}
export function useWorkspaceLocalState<T>(key: string, initial: T) {
  const { state } = useStore();
  return useLocalState(`${state.activeWorkspaceId}-${key}`, initial);
}
