import type { Doc } from "../_generated/dataModel";
import {
  boundedResponse,
  emptyResult,
  SearchError,
  type SearchResult,
} from "./transport";
export async function parseSearch(response: Response): Promise<SearchResult> {
  const result = emptyResult();
  if (!response.ok || !response.body) {
    result.reason =
      response.status === 429
        ? "RESEARCH_RATE_LIMITED"
        : "RESEARCH_PROVIDER_UNAVAILABLE";
    return result;
  }
  if (!response.headers.get("content-type")?.startsWith("text/event-stream")) {
    result.reason = "RESEARCH_STREAM_INVALID";
    return result;
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "",
    data: string[] = [],
    event = "",
    bytes = 0,
    events = 0,
    textBytes = 0,
    done = false,
    finish = false,
    usage: string | null = null;
  const consume = () => {
    if (!data.length) {
      event = "";
      return;
    }
    const payload = data.join("\n");
    data = [];
    events++;
    if (
      events > 512 ||
      new TextEncoder().encode(payload).length > 65536 ||
      done
    )
      throw new SearchError("RESEARCH_STREAM_LIMIT");
    if (payload === "[DONE]") {
      if (!finish || usage === null)
        throw new SearchError("RESEARCH_STREAM_INCOMPLETE");
      done = true;
      event = "";
      return;
    }
    const parsed: unknown = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new SearchError("RESEARCH_STREAM_INVALID");
    const frame = parsed as {
      error?: unknown;
      choices?: {
        index?: number;
        delta?: { content?: unknown; web_search?: { content?: unknown } };
        finish_reason?: unknown;
      }[];
      usage?: {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
        total_tokens?: unknown;
        cost?: unknown;
      };
    };
    if (frame.error || event === "error")
      throw new SearchError("RESEARCH_PROVIDER_UNAVAILABLE");
    event = "";
    if (!Array.isArray(frame.choices) || frame.choices.length > 1)
      throw new SearchError("RESEARCH_STREAM_INVALID");
    for (const choice of frame.choices) {
      if (choice.index !== undefined && choice.index !== 0)
        throw new SearchError("RESEARCH_STREAM_INVALID");
      if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
        if (choice.finish_reason !== "stop" || finish)
          throw new SearchError("RESEARCH_STREAM_INCOMPLETE");
        finish = true;
      }
      if (
        choice.delta?.content !== undefined &&
        choice.delta.content !== null
      ) {
        if (typeof choice.delta.content !== "string")
          throw new SearchError("RESEARCH_STREAM_INVALID");
        textBytes += new TextEncoder().encode(choice.delta.content).length;
        if (textBytes > 16384) throw new SearchError("RESEARCH_STREAM_LIMIT");
      }
      const sources = choice.delta?.web_search?.content;
      if (sources !== undefined) {
        if (!Array.isArray(sources) || sources.length > 20)
          throw new SearchError("RESEARCH_STREAM_INVALID");
        for (const value of sources) {
          if (
            !value ||
            typeof value !== "object" ||
            typeof value.url !== "string" ||
            typeof value.title !== "string" ||
            !value.title.trim() ||
            value.title.length > 500 ||
            value.url.length > 2000
          )
            throw new SearchError("RESEARCH_SOURCE_INVALID");
          const url = new URL(value.url);
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            (url.port && url.port !== "443")
          )
            throw new SearchError("RESEARCH_SOURCE_INVALID");
          url.hash = "";
          const identity = url.href,
            old = result.sources.find((s) => s.providerIdentity === identity);
          if (old) {
            if (old.title !== value.title)
              throw new SearchError("RESEARCH_SOURCE_CONFLICT");
            continue;
          }
          if (result.sources.length >= 20)
            throw new SearchError("RESEARCH_SOURCE_LIMIT");
          result.sources.push({
            providerIdentity: identity,
            url: identity,
            title: value.title,
            text: null,
            publishedAt: null,
            count: null,
          });
        }
      }
    }
    if (frame.usage !== undefined) {
      const u = frame.usage;
      if (
        !u ||
        ![u.prompt_tokens, u.completion_tokens, u.total_tokens].every(
          (n) =>
            typeof n === "number" &&
            Number.isSafeInteger(n) &&
            n >= 0 &&
            n <= 100000,
        ) ||
        Number(u.prompt_tokens) + Number(u.completion_tokens) !== u.total_tokens
      )
        throw new SearchError("RESEARCH_USAGE_INVALID");
      const serialized = JSON.stringify(u);
      if (usage !== null && usage !== serialized)
        throw new SearchError("RESEARCH_USAGE_CONFLICT");
      usage = serialized;
      if (u.cost !== undefined) {
        if (
          typeof u.cost !== "number" ||
          !Number.isFinite(u.cost) ||
          u.cost < 0 ||
          u.cost > 1e6
        )
          result.costInvalid = true;
        else result.reportedCost = u.cost;
      }
    }
  };
  const lines = () => {
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      let line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line === "") consume();
      else if (line.startsWith("data:"))
        data.push(line.slice(5).replace(/^ /, ""));
      else if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (
        !line.startsWith(":") &&
        !line.startsWith("id:") &&
        !line.startsWith("retry:")
      )
        throw new SearchError("RESEARCH_STREAM_INVALID");
      if (data.join("\n").length > 65536)
        throw new SearchError("RESEARCH_STREAM_LIMIT");
    }
    if (buffer.length > 65536) throw new SearchError("RESEARCH_STREAM_LIMIT");
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1048576) throw new SearchError("RESEARCH_STREAM_LIMIT");
      buffer += decoder.decode(chunk.value, { stream: true });
      lines();
    }
    buffer += decoder.decode();
    lines();
    if (buffer || data.length || !done || !finish || usage === null)
      throw new SearchError("RESEARCH_STREAM_INCOMPLETE");
    result.state = result.sources.length ? "completed" : "empty";
    result.reason = null;
  } catch (e) {
    result.state = result.sources.length ? "partial" : "unknown";
    result.reason =
      e instanceof SearchError ? e.code : "RESEARCH_STREAM_INVALID";
    result.reportedCost = null;
  } finally {
    await reader.cancel().catch(() => {});
  }
  return result;
}
export async function searchWeb(
  o: Doc<"researchOrders">,
  p: Doc<"researchSourcePolicies">,
  key: string,
) {
  const request = JSON.stringify({
    model: p.model,
    messages: [
      {
        role: "user",
        content: `Find public sources for this query in ${o.native!.language}: ${o.native!.query}. Return delivered source metadata; do not follow authenticated or private sources.`,
      },
    ],
    tools: [{ type: "web_search" }],
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 256,
  });
  const { response, close } = await boundedResponse(
    "https://router.eu.requesty.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: request,
    },
    o.deadline,
  );
  try {
    return await parseSearch(response);
  } finally {
    close();
  }
}
