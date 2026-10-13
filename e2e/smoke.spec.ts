import { test, expect } from "@playwright/test";

/**
 * Anonymous smoke coverage. These guard the two regression risks that are easy
 * to reintroduce and expensive to discover late:
 *
 *  - a route that throws on an unauthenticated visitor, and
 *  - a runtime error that the global ErrorBoundary swallows into a blank page.
 *
 * Deliberately no login: see playwright-fixture.ts.
 */

test.describe("public routes", () => {
  const routes = ["/", "/tags", "/collections"];

  for (const route of routes) {
    test(`${route} renders without error for a logged-out visitor`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await page.goto(route, { waitUntil: "domcontentloaded" });

      // The root div must actually receive content; a blank body means a throw
      // during render that ErrorBoundary caught.
      await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
      expect(errors, `page errors on ${route}`).toEqual([]);
    });
  }
});

test.describe("404 handling", () => {
  test("an unknown path does not white-screen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/this-route-does-not-exist", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    expect(errors).toEqual([]);
  });
});