import twitterText from "twitter-text";
// Validation normalizes only inside twitter-text. Send the immutable original text.
export function textCount(text: string, provider = "X") {
  const wellFormed =
    new TextDecoder().decode(new TextEncoder().encode(text)) === text;
  if (provider !== "X") return { length: text.length, valid: wellFormed };
  const parsed = twitterText.parseTweet(text);
  return { length: parsed.weightedLength, valid: parsed.valid && wellFormed };
}
export function textWithinLimit(text: string, provider: string, limit: number) {
  const counted = textCount(text, provider);
  return (
    (text === "" || counted.valid) &&
    counted.length <= (provider === "X" ? Math.min(280, limit) : limit)
  );
}
