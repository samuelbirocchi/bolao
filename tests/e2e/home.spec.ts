import { expect, test } from "@playwright/test";

test("landing page renders without runtime errors", async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page).toHaveTitle(/Bolao/);
  await expect(page.getByRole("link", { name: "Bolao" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "World Cup pools without spreadsheet chaos." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a pool" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View groups" })).toBeVisible();
  await expect(page.getByText(/Application error|Build Error|Unhandled Runtime Error/i)).toHaveCount(
    0,
  );

  expect(consoleErrors).toEqual([]);
});
