import { expect, test, vi } from "vitest";
import { sendEmail } from "../auth";

vi.stubEnv("RESEND_API_KEY", "synthetic-only");

test("auth email bounds a hanging provider with a 10s abort instead of stalling signup", async () => {
  const controller = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(controller.signal);
  const delivery = vi.spyOn(globalThis, "fetch").mockImplementation(
    (_request, options) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new DOMException("This operation was aborted", "AbortError")),
        );
      }),
  );
  try {
    const pending = expect(
      sendEmail(
        "candidate@example.test",
        "Subject",
        "https://example.test/verify",
      ),
    ).rejects.toThrow(/abort/i);
    expect(timeout).toHaveBeenCalledWith(10_000);
    controller.abort();
    await pending;
    expect(delivery).toHaveBeenCalledTimes(1);
  } finally {
    delivery.mockRestore();
    timeout.mockRestore();
  }
});

test("auth email releases the provider body after delivery", async () => {
  const ok = new Response("{}", { status: 200 });
  const cancel = vi.spyOn(ok.body!, "cancel");
  const delivery = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok);
  try {
    await sendEmail(
      "candidate@example.test",
      "Subject",
      "https://example.test/verify",
    );
    expect(cancel).toHaveBeenCalledTimes(1);
  } finally {
    delivery.mockRestore();
  }
});
