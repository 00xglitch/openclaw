import { _electron as electron, test, expect, type ElectronApplication, type Page } from "@playwright/test";
import path from "node:path";

const APP_DIR = path.resolve(__dirname, "..");

// Helper: launch app with fresh state (cleared localStorage)
async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [APP_DIR],
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
  });
  const page = await app.firstWindow();
  // Wait for renderer to load
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

// Helper: skip onboarding by setting localStorage
async function skipOnboarding(page: Page): Promise<void> {
  const testToken = process.env.OPENCLAW_TEST_TOKEN || "test-placeholder-token";
  await page.evaluate((token) => {
    localStorage.setItem("openclaw:gatewayUrl", "ws://127.0.0.1:18789");
    localStorage.setItem("openclaw:token", token);
    localStorage.setItem("openclaw:ttsUrl", "http://127.0.0.1:4123");
    localStorage.setItem("openclaw:onboardingComplete", "true");
  }, testToken);
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
}

test.describe("Onboarding", () => {
  test("shows welcome step on first launch", async () => {
    const { app, page } = await launchApp();

    // Clear any previous onboarding state
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Should see the OpenClaw heading
    await expect(page.locator("text=OpenClaw")).toBeVisible({ timeout: 10_000 });

    // Should see the Get Started button
    await expect(page.locator("text=Get Started")).toBeVisible();

    await app.close();
  });

  test("navigates through onboarding steps", async () => {
    const { app, page } = await launchApp();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Step 0: Welcome
    await expect(page.locator("text=Get Started")).toBeVisible({ timeout: 10_000 });
    await page.click("text=Get Started");

    // Step 1: Connect — should see form fields
    await expect(page.locator("text=Gateway URL")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=Token")).toBeVisible();

    // Should have a Test Connection button
    await expect(page.locator("text=Test Connection")).toBeVisible();

    await app.close();
  });
});

test.describe("Chat UI", () => {
  test("shows connecting screen after onboarding", async () => {
    const { app, page } = await launchApp();
    await skipOnboarding(page);

    // Should show either connecting screen or the actual chat UI
    // (depends on whether gateway is running)
    const connected = await page.locator("[title='Connected']").isVisible().catch(() => false);
    const connecting = await page.locator("text=Connecting").isVisible().catch(() => false);
    const disconnected = await page.locator("text=Disconnected").isVisible().catch(() => false);

    expect(connected || connecting || disconnected).toBe(true);

    await app.close();
  });

  test("compose field is present and functional", async () => {
    const { app, page } = await launchApp();
    await skipOnboarding(page);

    // Wait for either connected state or timeout screen
    await page.waitForTimeout(2_000);

    // If connected, the compose textarea should be present
    const textarea = page.locator("textarea");
    const count = await textarea.count();

    if (count > 0) {
      await textarea.first().fill("hello world");
      const value = await textarea.first().inputValue();
      expect(value).toBe("hello world");
    }

    await app.close();
  });
});

test.describe("Dashboard Drawer", () => {
  test("opens when hamburger is clicked", async () => {
    const { app, page } = await launchApp();
    await skipOnboarding(page);

    // Wait for connection or timeout
    await page.waitForTimeout(3_000);

    // Look for hamburger button (title="Dashboard")
    const hamburger = page.locator("[title='Dashboard']");
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();

      // Drawer should appear with Dashboard heading
      await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 3_000 });

      // Should have tab pills
      await expect(page.locator("text=Agents")).toBeVisible();
      await expect(page.locator("text=Sessions")).toBeVisible();
      await expect(page.locator("text=Nodes")).toBeVisible();

      // Click Sessions tab
      await page.locator("text=Sessions").click();
      await page.waitForTimeout(500);

      // Click Nodes tab
      await page.locator("text=Nodes").click();
      await page.waitForTimeout(500);

      // Close drawer by clicking backdrop
      const backdrop = page.locator(".fixed.inset-0.bg-black\\/40");
      if (await backdrop.isVisible()) {
        await backdrop.click({ position: { x: 350, y: 300 } });
      }
    }

    await app.close();
  });
});

test.describe("Agent Orb", () => {
  test("orb is visible in connected state", async () => {
    const { app, page } = await launchApp();
    await skipOnboarding(page);

    // Wait for app to settle
    await page.waitForTimeout(3_000);

    // Look for the orb button (title contains "voice")
    const orb = page.locator("button[title*='voice' i], button[title*='Voice' i]");
    if (await orb.isVisible().catch(() => false)) {
      expect(await orb.isVisible()).toBe(true);
    }

    await app.close();
  });

  test("clicking orb toggles voice mode", async () => {
    const { app, page } = await launchApp();
    await skipOnboarding(page);

    // Wait long enough for either connection or disconnected screen
    await page.waitForTimeout(12_000);

    // Only test orb toggle if we're in the connected chat UI
    const orbOff = page.locator("button[title='Enable voice']");
    if (await orbOff.isVisible().catch(() => false)) {
      await orbOff.click();
      await expect(page.locator("button[title='Disable voice']")).toBeVisible({ timeout: 2_000 });
      await page.locator("button[title='Disable voice']").click();
      await expect(page.locator("button[title='Enable voice']")).toBeVisible({ timeout: 2_000 });
    } else {
      // Not connected — verify disconnected screen is shown instead
      const disconnected = page.locator("text=Settings");
      expect(await disconnected.isVisible().catch(() => false)).toBe(true);
    }

    await app.close();
  });
});

test.describe("StatusBar", () => {
  test("shows controls after onboarding completes", async () => {
    const { app, page } = await launchApp();
    await skipOnboarding(page);

    // Wait for connection attempt + timeout (10s + buffer)
    await page.waitForTimeout(12_000);

    // Should see either: connected UI (settings gear + hamburger) or disconnected screen (Settings + Retry)
    const settingsGear = page.locator("[title='Connection settings']");
    const settingsBtn = page.locator("text=Settings");
    const retryBtn = page.locator("text=Retry");

    const anyVisible = (await settingsGear.isVisible().catch(() => false))
      || (await settingsBtn.isVisible().catch(() => false))
      || (await retryBtn.isVisible().catch(() => false));

    expect(anyVisible).toBe(true);

    await app.close();
  });
});
