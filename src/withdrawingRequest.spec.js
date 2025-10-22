require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Configuration
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
const PROFILE_URLS = (process.env.PROFILE_URLS || "").split(",").map(url => url.replace(/"/g, "").trim()).filter(url => url);

/* ---------------------------
   Human-like helpers
--------------------------- */
async function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/* ---------------------------
   Stealth patches
--------------------------- */
async function addStealth(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });
}

/* ---------------------------
   Main test - Withdraw Connection Request
--------------------------- */
test.describe("LinkedIn Withdraw Connection Request", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
    }
    if (!PROFILE_URLS.length) {
      console.log("⚠️ No PROFILE_URLS provided.");
    }

    browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
    const storageState = fs.existsSync(STORAGE_FILE) && fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
      ? STORAGE_FILE
      : undefined;

    context = await browser.newContext({
      viewport: null,
      locale: "en-US",
      timezoneId: "Asia/Kolkata",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      storageState,
    });

    page = await context.newPage();
    await addStealth(page);

    try {
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });
      await randomDelay(800, 1800);

      if (await page.locator("#username").isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("🔐 Logging in...");
        await page.locator("#username").fill(process.env.LINKEDIN_EMAIL);
        await randomDelay(600, 1600);
        await page.locator("#password").fill(process.env.LINKEDIN_PASSWORD);
        await randomDelay(600, 1600);
        await page.locator('button[type="submit"]').click();
        await randomDelay(1000, 2000);

        const authLink = page.locator('a:has-text("Verify using authenticator app")');
        if (await authLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          await authLink.click();
          await randomDelay(800, 1500);
        }

        const totpInput = page.locator('input[name="pin"][maxlength="6"]');
        if (await totpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log("🔑 Using TOTP...");
          const token = speakeasy.totp({ secret: process.env.LINKEDIN_TOTP_SECRET, encoding: "base32" });
          await totpInput.fill(token);
          await randomDelay(700, 1400);
          await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
        }

        await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => console.log("⚠️ Feed not reached."));
        await context.storageState({ path: STORAGE_FILE });
      }
    } catch (err) {
      console.error("❌ Login failed:", err.message);
      throw err;
    }
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test("Withdraw Connection Request", async () => {
    test.setTimeout(15 * 60 * 1000); // 15 minutes
    console.log(`🔍 Processing ${PROFILE_URLS.length} profiles to withdraw requests...`);
    console.log("-------------------------------");

    if (!PROFILE_URLS.length) {
      console.log("⚠️ No PROFILE_URLS provided.");
      return;
    }

    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(2000, 4000);

    for (const url of PROFILE_URLS) {
      console.log(`🌐 Visiting: ${url}`);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await randomDelay(1000, 3000);
      } catch (err) {
        console.error(`❌ Navigation failed for ${url}: ${err.message}`);
        continue;
      }

      let profileName = "Unknown";
      try {
        profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown";
        // console.log(`🔍 Found profile name: ${profileName}`);
      } catch (err) {
        console.log(`⚠️ Profile name not found: ${err.message}`);
      }

      try {
        // Check header for pending/withdraw option
        const headerWithdraw = page.locator(".ph5 [aria-label*='Pending, click to withdraw invitation sent to']").first();
        if (await headerWithdraw.isVisible({ timeout: 5000 }).catch(() => false)) {
          await headerWithdraw.click();
          await randomDelay(1000, 2000);
        } else {
          // Click More actions if not found in header
          const moreButton = page.locator(".ph5 [aria-label='More actions']").first();
          if (await moreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await moreButton.click();
            await randomDelay(1000, 2000);

            // Check dropdown for pending/withdraw option
            const dropdownWithdraw = page.locator(".ph5 .artdeco-dropdown__content [aria-label*='Pending, click to withdraw invitation sent to']").first();
            if (await dropdownWithdraw.isVisible({ timeout: 5000 }).catch(() => false)) {
              await dropdownWithdraw.click();
              await randomDelay(1000, 2000);
            } else {
              console.log(`⚠️ No pending/withdraw option found for ${profileName}`);
              console.log(`-------------------------------`)
              continue;
            }
          } else {
            console.log(`⚠️ No More actions button found for ${profileName}`);
            continue;
          }
        }

        // Click Withdraw in the alert dialog
        const withdrawButton = page.locator("div[role='alertdialog'] button:has-text('Withdraw')").first();
        if (await withdrawButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await withdrawButton.click();
          console.log(`✅ Withdrawn request for ${profileName}`);
        } else {
          console.log(`⚠️ Withdraw button not found for ${profileName}`);
        }

        await randomDelay(1000, 2000);
      } catch (err) {
        console.error(`❌ Error withdrawing request for ${url}: ${err.message}`);
      }

      console.log(`✅ Done with ${url}`);
      console.log("-------------------------------");
    }

    await expect(page).toHaveURL(/linkedin\.com/);
  });
});