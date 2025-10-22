require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Configuration
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Thanuja.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
const PROFILE_URLS = (process.env.PROFILE_URLS || "").split(",").map(url => url.replace(/"/g, "").trim()).filter(url => url);

/* ---------------------------
   Human-like helpers
--------------------------- */
async function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
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

async function humanScroll(page, steps = 5) {
  for (let i = 0; i < steps; i++) {
    const dir = Math.random() > 0.5 ? 1 : -1;
    await page.mouse.wheel(0, dir * (Math.random() * 300 + 150));
    await randomDelay(800, 1600);
  }
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
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });

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
        return data.map(v => v + Math.random() * 0.0000001);
      };
    } catch (e) {}
  });
}

/* ---------------------------
   Main test - Check Connection Request Status
--------------------------- */
test.describe("LinkedIn Connection Status Check", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    // Validate environment variables
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
    }
    if (!PROFILE_URLS.length) {
      console.log("⚠️ No PROFILE_URLS provided.");
    }

    // Launch browser
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

    // Login if necessary
    try {
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });
      await humanMouse(page, 3);
      await randomDelay(800, 1800);

      if (await page.locator("#username").isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("🔐 Logging in...");
        await page.locator("#username").fill(process.env.LINKEDIN_EMAIL);
        await randomDelay(600, 1600);
        await page.locator("#password").fill(process.env.LINKEDIN_PASSWORD);
        await randomDelay(600, 1600);
        await page.locator('button[type="submit"]').click();
        await randomDelay(1000, 2000);

        // Handle MFA
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

  test("Check Connection Request Status", async () => {
    test.setTimeout(15 * 60 * 1000); // 15 minutes
    console.log(`🔍 Processing ${PROFILE_URLS.length} profiles...`);
    console.log("-------------------------------");

    if (!PROFILE_URLS.length) {
      console.log("⚠️ No PROFILE_URLS provided.");
      return;
    }

    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanScroll(page, 3);
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

      // Get profile name
      let profileName = "Unknown";
      try {
        profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown";
        console.log(`🔍 Found profile name: ${profileName}`);
      } catch (err) {
        console.log(`⚠️ Profile name not found: ${err.message}`);
      }

      // Check degree
      let degree = "Unknown degree";
      try {
        // Prioritize .visually-hidden for degree text
        const degreeLocator = page.locator(".distance-badge .visually-hidden").first();
        if (await degreeLocator.isVisible({ timeout: 5000 })) {
          degree = await degreeLocator.textContent({ timeout: 5000 }).then(text => text.trim().toLowerCase()) || "Unknown degree";
        } else {
          // Fallback to .dist-value
          const fallbackLocator = page.locator(".distance-badge .dist-value").first();
          degree = await fallbackLocator.textContent({ timeout: 5000 }).then(text => text.trim().toLowerCase()) || "Unknown degree";
        }
        console.log(`🔍 Found degree: ${degree}`);
      } catch (err) {
        console.log(`⚠️ Degree not found: ${err.message}`);
      }

      // Connection status logic
      let status = "Unknown";
      try {
        // Case 1: Accepted (1st degree or Remove Connection)
        if (degree.includes("1st")) {
          status = "Accepted";
          console.log(`✅ ${profileName}: ${degree} - ${status}`);
        } else {
          // Check buttons in header
          const pendingButton = page.locator(".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')").first();
          const connectButton = page.locator(".ph5 button:has-text('Connect')").first();
          const acceptButton = page.locator(".ph5 [aria-label*='Accept']").first();

          if (await acceptButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            status = "Accepted";
            console.log(`✅ ${profileName}: ${degree} - ${status} (Accept button)`);
          } else if (await pendingButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            status = "Sent but Not Accepted (Pending)";
            console.log(`⏳ ${profileName}: ${degree} - ${status}`);
          } else if (await connectButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            status = "Not Sent Yet";
            console.log(`⛔ ${profileName}: ${degree} - ${status} (Connect button)`);
          } else {
            // Check More dropdown
            const moreButton = page.locator(".ph5 button:has-text('More'), .ph5 [aria-label='More actions']").first();
            if (await moreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
              await moreButton.click({ delay: 100 });
              await randomDelay(1000, 2000);

              const removeConnection = page.locator(".artdeco-dropdown__content span:has-text('Remove Connection')").last();
              const withdrawOption = page.locator(".artdeco-dropdown__content span:has-text('Withdraw')").first();
              const connectOption = page.locator(".artdeco-dropdown__content-inner span:has-text('Connect')").last();

              if (await removeConnection.isVisible({ timeout: 5000 }).catch(() => false)) {
                status = "Accepted";
                console.log(`✅ ${profileName}: ${degree} - ${status} (Remove Connection)`);
              } else if (await withdrawOption.isVisible({ timeout: 5000 }).catch(() => false)) {
                status = "Sent but Not Accepted (Withdraw)";
                console.log(`⏳ ${profileName}: ${degree} - ${status}`);
              } else if (await connectOption.isVisible({ timeout: 5000 }).catch(() => false)) {
                status = "Not Sent Yet";
                console.log(`⛔ ${profileName}: ${degree} - ${status} (Connect in dropdown)`);
              } else {
                status = "Unknown";
                console.log(`❓ ${profileName}: ${degree} - ${status}`);
              }

              await moreButton.click({ delay: 100 }); // Close dropdown
              await randomDelay(1000, 2000);
            } else {
              status = "Unknown";
              console.log(`❓ ${profileName}: ${degree} - ${status} (No More button)`);
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error checking status for ${url}: ${err.message}`);
        console.log(`❓ ${profileName}: ${degree} - Unknown (Error)`);
      }

      console.log(`✅ Done with ${url}`);
      console.log("-------------------------------");
    }

    await expect(page).toHaveURL(/linkedin\.com/);
  });
});