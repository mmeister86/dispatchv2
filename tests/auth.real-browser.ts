import { expect, test } from "@playwright/test";

for (const flow of [
  {
    path: "/reset-password",
    endpoint: "request-password-reset",
    button: "Reset-Link anfordern",
    success: "Anfrage angenommen",
  },
  {
    path: "/verify",
    endpoint: "send-verification-email",
    button: "Bestätigungslink erneut senden",
    success: "Bestätigungslink angefordert",
  },
  {
    path: "/reset-password?token=browser-test-token",
    endpoint: "reset-password",
    button: "Passwort speichern",
    success: "Passwort gespeichert",
  },
]) {
  test(`${flow.endpoint} completion opens a fresh login form with its destination`, async ({
    page,
  }) => {
    await page.route(`**/api/auth/${flow.endpoint}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      }),
    );
    const destination = "/settings/profile";
    await page.goto(
      `${flow.path}${flow.path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(destination)}`,
    );
    if (flow.endpoint === "reset-password")
      await page.getByLabel("Neues Passwort").fill("browser-test-password");
    else
      await page.getByLabel("E-Mail-Adresse").fill("browser@example.invalid");
    await page.getByRole("button", { name: flow.button, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: flow.success }),
    ).toBeVisible();
    await page
      .getByRole("status")
      .getByRole("link", { name: "Zur Anmeldung" })
      .click();
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fsettings%2Fprofile$/);
    await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Anmelden", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: flow.success })).toHaveCount(
      0,
    );
  });
}
