import { test, expect } from "@playwright/test";

test("comment completion preserves a newer buffer, blocks duplicate sends and clears only the submitted text", async ({
  page,
}) => {
  await page.goto("/drafts");
  await page.evaluate(async () => {
    // Mount the actual composer input with a controllable transport response.
    const importBrowser = (path: string) => import(path);
    const { VersionCommentInput } = await importBrowser(
      "/src/pages/Drafts.tsx",
    );
    const {
      default: { createElement },
    } = await importBrowser("/node_modules/.vite/deps/react.js");
    const {
      default: { createRoot },
    } = await importBrowser("/node_modules/.vite/deps/react-dom_client.js");
    const host = document.createElement("div");
    document.getElementById("root")!.style.display = "none";
    host.dataset.testid = "comment-race";
    document.body.appendChild(host);
    const transport = {
      sent: [] as string[],
      resolve: null as null | ((ok: boolean) => void),
    };
    (
      window as unknown as { commentTransport: typeof transport }
    ).commentTransport = transport;
    createRoot(host).render(
      createElement(VersionCommentInput, {
        version: 1,
        canWrite: true,
        onSubmit: (text: string) => {
          transport.sent.push(text);
          return new Promise<boolean>((resolve) => {
            transport.resolve = resolve;
          });
        },
      }),
    );
  });
  const input = page.getByTestId("comment-race");
  const field = input.getByRole("textbox");
  const send = input.getByRole("button");
  await field.fill("Submitted comment");
  await send.click();
  await expect(send).toBeDisabled();
  await field.fill("New text while saving");
  await send.evaluate((button: HTMLButtonElement) => button.click());
  const sent = () =>
    page.evaluate(
      () =>
        (window as unknown as { commentTransport: { sent: string[] } })
          .commentTransport.sent,
    );
  expect(await sent()).toEqual(["Submitted comment"]);
  const finish = (ok: boolean) =>
    page.evaluate(
      (value) =>
        (
          window as unknown as {
            commentTransport: { resolve: (ok: boolean) => void };
          }
        ).commentTransport.resolve(value),
      ok,
    );
  await finish(true);
  await expect(field).toHaveValue("New text while saving");
  await expect(send).toBeEnabled();
  await send.click();
  await finish(false);
  await expect(send).toBeEnabled();
  await expect(field).toHaveValue("New text while saving");
  await send.click();
  await finish(true);
  await expect(field).toHaveValue("");
  expect(await sent()).toEqual([
    "Submitted comment",
    "New text while saving",
    "New text while saving",
  ]);
});
