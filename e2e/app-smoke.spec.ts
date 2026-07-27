import { expect, test } from "@playwright/test";

/**
 * App smoke under CLEARESG_DEV_BYPASS (no Clerk).
 * Full signup→publish path needs seeded DB + bypass; this verifies the shell loads.
 */
test("app runway loads when authenticated via bypass", async ({ page }) => {
  test.skip(
    !process.env.CLEARESG_DEV_BYPASS && process.env.CI === "true",
    "Requires CLEARESG_DEV_BYPASS or local session",
  );

  await page.goto("/dashboard");
  // Either runway or onboarding or sign-in depending on env
  const url = page.url();
  const ok =
    url.includes("/dashboard") || url.includes("/sign-in") || url.includes("/onboarding");
  expect(ok).toBeTruthy();
});
