import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home renders ClearESG marketing hero", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Precision instrument/i }),
  ).toBeVisible();
  await expect(page.getByText("72")).toBeVisible();
});

test("pricing and tools are reachable", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
  await page.goto("/tools/scope-2");
  await expect(page.getByRole("heading", { name: /Scope 2/i })).toBeVisible();
  await expect(page.getByText(/tCO2e/i).first()).toBeVisible();
});

test("glossary answer-first page", async ({ page }) => {
  await page.goto("/glossary/scope-3");
  await expect(page.getByRole("heading", { name: "Scope 3" })).toBeVisible();
  await expect(page.getByText(/Updated/i)).toBeVisible();
});

test("health check", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { ok: boolean; service: string };
  expect(body.ok).toBe(true);
  expect(body.service).toBe("clearesg");
});

test("marketing home has no critical axe violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"]) // dark theme tokens audited separately
    .analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");
  expect(critical).toEqual([]);
});
