require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Local storage file to save LinkedIn session state
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Thanuja.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

/* ---------------------------
   Human-like helpers
--------------------------- */
async function randomDelay(min = 200, max = 1200) {
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, t));
}

async function humanType(page, locator, text) {
  const el = page.locator(locator);
  await el.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  try {
    await el.click({ delay: 100 });
  } catch {}
  for (const ch of text) {
    await el.type(ch, { delay: Math.floor(Math.random() * 150) + 50 });
    if (Math.random() < 0.12) await randomDelay(300, 800);
  }
}

async function humanMouse(page, moves = 5) {
  const size = page.viewportSize() || { width: 1280, height: 720 };
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * size.width);
    const y = Math.floor(Math.random() * size.height);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 12) + 3 });
    await randomDelay(200, 600);
  }
}

async function humanScroll(page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    const dir = Math.random() > 0.2 ? 1 : -1;
    await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
    await randomDelay(800, 1600);
  }
}

async function humanIdle(min = 2000, max = 6000) {
  const wait = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, wait));
}

/* ---------------------------
   Stealth patches
--------------------------- */
async function addStealth(page) {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function () {
        const ctx = this.getContext("2d");
        ctx.fillStyle = "rgba(255,0,0,0.01)";
        ctx.fillRect(0, 0, 1, 1);
        return toDataURL.apply(this, arguments);
      };

      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (param) {
        if (param === 37445) return "Intel Inc.";
        if (param === 37446) return "Intel Iris OpenGL Engine";
        return getParameter.apply(this, arguments);
      };

      const oldGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function () {
        const data = oldGetChannelData.apply(this, arguments);
        const rnd = Math.random() * 0.0000001;
        return data.map((v) => v + rnd);
      };
    } catch (e) {}
  });
}

/* ---------------------------
   Main test - View LinkedIn Feed
--------------------------- */
test.describe("LinkedIn View Feed", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    // Validate environment variables
    const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;
    if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");

    // Launch browser
    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });

    // Check existing session
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

    // Navigate to login page
    try {
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });
      await humanMouse(page, 3);
      await humanIdle(800, 1800);

      // Perform login if needed
      if (await page.locator("#username").isVisible().catch(() => false)) {
        console.log("🔐 Logging in to LinkedIn...");
        await humanType(page, "#username", LINKEDIN_EMAIL);
        await humanIdle(600, 1600);
        await humanType(page, "#password", LINKEDIN_PASSWORD);
        await humanIdle(600, 1600);
        await page.locator(`label[for='rememberMeOptIn-checkbox']`).click().catch(() => console.log("Remember Me checkbox not found, skipping."));
        await humanIdle(600, 1600);
        await page.locator('button[type="submit"]').click().catch(() => {});
        await randomDelay(1000, 2000);

        // Handle MFA
        const authLink = page.locator('a:has-text("Verify using authenticator app")');
        if (await authLink.isVisible().catch(() => false)) {
          await authLink.click().catch(() => {});
          await randomDelay(800, 1500);
        }

        const totpSel = 'input[name="pin"][maxlength="6"]';
        if (await page.locator(totpSel).isVisible().catch(() => false)) {
          console.log("🔑 Using TOTP MFA...");
          const token = speakeasy.totp({
            secret: process.env.LINKEDIN_TOTP_SECRET,
            encoding: "base32",
          });
          await humanType(page, totpSel, token);
          await randomDelay(700, 1400);
          await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
        }

        await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => {
          console.log("⚠️ Failed to reach feed after login, continuing...");
        });
        await context.storageState({ path: STORAGE_FILE });
      } else {
        console.log("🔄 Using existing session, navigating to feed...");
        await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      }
    } catch (err) {
      console.error("❌ Login failed:", err.message);
      throw err;
    }
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test("View and Scroll LinkedIn Feed", async () => {
    // Set test timeout explicitly
    test.setTimeout(12 * 60 * 1000); // 12 minutes

    console.log("📺 Starting to view LinkedIn feed...");

    // Navigate to feed
    try {
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
      console.log("✅ Navigated to LinkedIn feed");
    } catch (err) {
      console.error("❌ Failed to navigate to feed:", err.message);
      return;
    }

    // Wait for feed content
    const feedSelectors = [".scaffold-layout__content", ".feed-container"];
    let feedLoaded = false;
    for (const selector of feedSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 10000 }).catch(() => false)) {
        console.log(`✅ Feed content loaded using selector: ${selector}`);
        feedLoaded = true;
        break;
      }
    }
    if (!feedLoaded) {
      console.log("⚠️ Feed content not found, continuing with scrolling...");
    }

    // Simulate human-like feed browsing: 3 scroll sessions with pauses
    const scrollSessions = 3;
    for (let session = 1; session <= scrollSessions; session++) {
      try {
        console.log(`🔄 Feed viewing session ${session}/${scrollSessions} - Scrolling and pausing...`);

        // Random scroll (3-7 steps, mostly down, occasional up)
        const scrollSteps = Math.floor(Math.random() * 5) + 3;
        await humanScroll(page, scrollSteps);

        // Random pause to simulate reading
        const pauseTime = Math.random() * 10000 + 5000; // 5-15 seconds
        console.log(`⏸️ Pausing for ${Math.round(pauseTime / 1000)} seconds...`);
        await page.waitForTimeout(pauseTime);

        // Occasional mouse movement to mimic attention
        if (Math.random() > 0.5) {
          console.log("🖱️ Simulating mouse movement...");
          await humanMouse(page, 2);
        }
      } catch (err) {
        console.error(`❌ Error in scroll session ${session}:`, err.message);
      }
    }

    // Final pause
    await humanIdle(3000, 8000);
    console.log("✅ Finished viewing feed");
    

    // Verify still on LinkedIn
    await expect(page).toHaveURL(/linkedin\.com/);
  });
});