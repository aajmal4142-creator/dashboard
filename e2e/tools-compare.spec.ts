import { test, expect } from "@playwright/test";

test.describe("marketing tools", () => {
  test("price estimate loads", async ({ page }) => {
    await page.goto("/tools/price-estimate");
    await expect(
      page.getByRole("heading", { name: /Price \/ readiness/i }),
    ).toBeVisible();
    await expect(page.getByText(/USD 90,000/i)).toBeVisible();
  });

  test("brsr readiness loads", async ({ page }) => {
    await page.goto("/tools/brsr-readiness");
    await expect(page.getByRole("heading", { name: /BRSR readiness/i })).toBeVisible();
  });

  test("compare envizi loads", async ({ page }) => {
    await page.goto("/compare/envizi");
    await expect(page.getByText(/Envizi/i).first()).toBeVisible();
  });
});
