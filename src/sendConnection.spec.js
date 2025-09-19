/* 
Script Purpose
Automates opening LinkedIn post impressions via browser automation to extract reactions, comments, and reposts for analytics or reporting.

Key Workflow Notes
Uses Playwright framework executed with npx for compatibility and ease of setup in Node.js environments.

Script interacts with dynamic LinkedIn page content for gathering engagement metrics.

Implementation Details
Profile/session data can be managed via session storage for stateful test scenarios or personalized analytics.

Intended for scaling over multiple profiles (e.g., a starter JSON containing 20 profiles is recommended for batch processing and review tasks).
*/



require("dotenv").config();
const { test, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

const STORAGE_FILE = "linkedin_state.json";
const profileUrls = [
  "https://www.linkedin.com/in/mounikakallem/",
  "https://www.linkedin.com/in/vandana-kande-00045511/",
];

// ----------------- Helpers -----------------
async function randomDelay(min = 200, max = 1200) {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min)
  );
}
async function humanType(page, selector, text) {
  if (!text) throw new Error(`❌ Missing text for ${selector}`);
  const el = page.locator(selector);
  await el.click({ delay: 100 });
  for (const ch of text) {
    await el.type(ch, { delay: Math.floor(Math.random() * 150) + 50 });
    if (Math.random() < 0.15) await randomDelay(300, 900);
  }
}
async function humanScroll(page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, Math.floor(Math.random() * 300) + 200);
    await randomDelay(1000, 2500);
  }
}
async function addStealth(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });
}

// ----------------- Main Test -----------------
test("LinkedIn stealth login + send connections", async () => {
  test.setTimeout(180000);

  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } =
    process.env;

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(STORAGE_FILE) ? STORAGE_FILE : "linkedinStealth-state.json",
    locale: "en-US",
    timezoneId: "Asia/Kolkata",
  });
  const page = await context.newPage();
  await addStealth(page);

  // --- Login only if session missing ---
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });
  if (
    await page
      .locator("#username")
      .isVisible()
      .catch(() => false)
  ) {
    console.log("🔑 Logging in...");
    await humanType(page, "#username", LINKEDIN_EMAIL);
    await humanType(page, "#password", LINKEDIN_PASSWORD);
    await page.click('button[type="submit"]');

    // MFA if required
    const authLink = page.locator(
      'a:has-text("Verify using authenticator app")'
    );
    if (await authLink.isVisible().catch(() => false)) {
      await authLink.click();
    }
    // Select only the 6-digit authenticator input
    const totpInput = page.locator('input[name="pin"][maxlength="6"]');

    if (await totpInput.isVisible().catch(() => false)) {
      const token = speakeasy.totp({
        secret: LINKEDIN_TOTP_SECRET,
        encoding: "base32",
      });
      console.log(`🔐 Entering 2FA token ${token}`);
      await humanType(page, 'input[name="pin"][maxlength="6"]', token);
      await page.click("#two-step-submit-button");
    } else if (
      await page
        .locator('input[name="pin"][maxlength="8"]')
        .isVisible()
        .catch(() => false)
    ) {
      console.log(
        "⚠️ Recovery code input detected — skipping since we expect authenticator app code."
      );
    } else {
      console.log("⚠️ No MFA input found — continuing without MFA.");
    }

    await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 });
    await context.storageState({ path: STORAGE_FILE });
    console.log("✅ Login successful & session saved");
  } else {
    console.log("✅ Session restored, skipping login");
  }

  // --- Process each profile ---
  for (const url of profileUrls) {
    console.log(`🔎 Visiting ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await humanScroll(page, 4);

    // Check connect button on header
    const headerConnect = page.locator(".ph5 button:has-text('Connect')");
    if (await headerConnect.isVisible().catch(() => false)) {
      console.log("📩 Sending connection from header button...");
      await headerConnect.click();
      const sendBtn = page.locator("button:has-text('Send')");
      if (await sendBtn.isVisible().catch(() => false)) await sendBtn.click();
      continue;
    }

    // Check More dropdown
    const moreBtn = page.locator(".ph5 button:has-text('More')");
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      await randomDelay(1000, 2000);

      const dropdownConnect = page.locator(
        ".ph5 .artdeco-dropdown__content-inner span:has-text('Connect')"
      );
      const removeConnection = page.locator(
        ".artdeco-dropdown__content span:has-text('Remove Connection')"
      );

      if (await dropdownConnect.isVisible().catch(() => false)) {
        console.log("📩 Sending connection from More menu...");
        await dropdownConnect.click();
        const sendBtn = page.locator("button:has-text('Send')");
        if (await sendBtn.isVisible().catch(() => false)) await sendBtn.click();
      } else if (await removeConnection.isVisible().catch(() => false)) {
        console.log("✅ Already connected (Remove Connection found)");
      } else {
        console.log("❌ Neither Connect nor Remove found under More");
      }
      continue;
    }

    console.log("⚠️ No Connect/More found — maybe restricted profile");
    await randomDelay(3000, 5000);
  }

  console.log("🏁 All profiles processed.");
  await browser.close();
});
