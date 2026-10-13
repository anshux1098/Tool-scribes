import { test as base, expect } from "@playwright/test";

/**
 * #21: this re-exported from `lovable-agent-playwright-config/fixture`, which is
 * not in package.json or package-lock.json, so importing it failed outright.
 * Base it on @playwright/test instead and extend from here.
 *
 * Deliberately does NOT log in. These tests run against the real Supabase
 * project, and a sign-in helper would need either real credentials in CI or a
 * seeded test user. Anonymous smoke coverage is the safe default; authenticated
 * flows belong in the vitest layer where they can be mocked.
 */
export const test = base.extend({});

export { expect };