export class SearchError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function boundedResponse(
  url: string,
  init: RequestInit,
  deadline: number,
) {
  const controller = new AbortController(),
    ms = Math.min(15000, deadline - Date.now());
  if (ms <= 0) throw new SearchError("RESEARCH_DEADLINE");
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    return {
      response,
      close: () => {
        clearTimeout(timer);
        controller.abort();
      },
    };
  } catch {
    clearTimeout(timer);
    throw new SearchError("RESEARCH_PROVIDER_UNAVAILABLE");
  }
}
export async function readBytes(response: Response, max: number) {
  if (!response.body) throw new SearchError("RESEARCH_RESPONSE_INVALID");
  const reader = response.body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > max) throw new SearchError("RESEARCH_RESPONSE_LIMIT");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    throw new SearchError("RESEARCH_RESPONSE_INVALID");
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export type Delivered = {
  providerIdentity: string;
  url: string | null;
  title: string;
  text: string | null;
  publishedAt: number | null;
  count: number | null;
};
export type SearchResult = {
  sources: Delivered[];
  state: "completed" | "empty" | "partial" | "failed" | "unknown";
  reason: string | null;
  units: number | null;
  reportedCost: number | null;
  costInvalid: boolean;
  truncated: boolean;
};
export function emptyResult(): SearchResult {
  return {
    sources: [],
    state: "unknown",
    reason: "RESEARCH_USAGE_UNKNOWN",
    units: null,
    reportedCost: null,
    costInvalid: false,
    truncated: false,
  };
}
