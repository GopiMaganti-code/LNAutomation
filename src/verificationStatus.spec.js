require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Configuration
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Praneeth.json";
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
  try { await el.click({ delay: 100 }); } catch {}
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
        const rnd = Math.random() * 0.0000001;
        return data.map((v) => v + rnd);
      };
    } catch (e) {}
  });
}


/* ---------------------------
   Action Functions
--------------------------- */
async function navigateToOwnProfileAndCheckStatus(page) {
  console.log("👤 Navigating to own profile and checking status...");
  try {
    // Wait for feed to load after login
    await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => console.log("⚠️ Feed not reached, proceeding..."));
    await humanIdle(2000, 4000);

    // Click "Me" menu button
    const meSelectors = [
      "button[aria-label='Me']",
      "button[aria-label*='Me']",
      "nav button:has-text('Me')"
    ];
    let meButton = null;
    for (const selector of meSelectors) {
      try {
        meButton = page.locator(selector).first();
        if (await meButton.isVisible({ timeout: 10000 })) {
          console.log(`✅ Found "Me" button with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ "Me" selector ${selector} failed: ${err.message}`);
      }
    }
    if (!meButton) {
      console.log("⚠️ No 'Me' button found, trying alternative...");
      // Alternative: Click on avatar
      const avatarSelectors = [
        "img.global-nav__me-photo",
        "img[alt*='Profile photo']"
      ];
      for (const selector of avatarSelectors) {
        try {
          const avatar = page.locator(selector).first();
          if (await avatar.isVisible({ timeout: 10000 })) {
            await humanMouse(page, 2);
            await avatar.click({ delay: 100 });
            console.log(`✅ Clicked avatar with selector: ${selector}`);
            meButton = avatar; // Treat as successful
            break;
          }
        } catch (err) {
          console.log(`⚠️ Avatar selector ${selector} failed: ${err.message}`);
        }
      }
    }
    if (meButton) {
      await humanMouse(page, 2);
      await meButton.click({ delay: 100 });
      console.log("✅ Opened user menu");
      await randomDelay(1000, 2000);
    } else {
      throw new Error("Failed to open user menu");
    }

    // Click "View profile" link
    const viewProfileSelectors = [
      "a:has-text('View profile')",
      "a[href*='/in/']"
    ];
    let viewProfileLink = null;
    for (const selector of viewProfileSelectors) {
      try {
        viewProfileLink = page.locator(selector).first();
        if (await viewProfileLink.isVisible({ timeout: 10000 })) {
          console.log(`✅ Found "View profile" link with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ "View profile" selector ${selector} failed: ${err.message}`);
      }
    }
    if (viewProfileLink) {
      await humanMouse(page, 1);
      await viewProfileLink.click({ delay: 100 });
      console.log("✅ Navigated to own profile");
      await randomDelay(2000, 4000);
    } else {
      throw new Error("Failed to find 'View profile' link");
    }

    // Now check verification status on own profile
    await humanIdle(2000, 4000);
    let profileName = "Unknown User";

    // Universal selectors for name that work for both structures
    // Structure 1: h1 inside a[aria-label] (legacy/older UI)
    // Structure 2: p inside div[data-view-name="profile-top-card-verified-badge"] (modern/verified UI)
    const nameLocators = [
      // For Structure 1
      'a[aria-label] h1',
      'a[href*="/in/"] h1',
      // For Structure 2
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        let nameText;
        if (selector.includes('a[aria-label] h1') || selector.includes('a[href*="/in/"] h1')) {
          nameText = await page.locator(selector).textContent({ timeout: 10000 }).then(text => text.trim()) || "";
        } else if (selector === 'a[aria-label]') {
          nameText = await page.locator(selector).getAttribute('aria-label', { timeout: 10000 }) || "";
        } else {
          nameText = await page.locator(selector).textContent({ timeout: 10000 }).then(text => text.trim()) || "";
        }
        if (nameText && nameText.length > 0 && !nameText.includes('verifications')) {
          profileName = nameText;
          console.log(`✅ Found name with selector: ${selector} - ${profileName}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Name locator ${selector} failed: ${err.message}`);
      }
    }

    // Universal selectors for verification badge that work for both structures
    // Structure 1: svg[data-test-icon="verified-medium"]
    // Structure 2: svg[aria-label*="verifications"] or svg[id="verified-medium"]
    const verifiedSelectors = [
      'svg[data-test-icon="verified-medium"]',
      'svg[aria-label*="verifications"]',
      'div[data-view-name="profile-top-card-verified-badge"] svg'
    ];
    let isVerified = false;
    for (const selector of verifiedSelectors) {
      try {
        if (await page.locator(selector).isVisible({ timeout: 5000 })) {
          isVerified = true;
          console.log(`✅ Found verification badge with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Verified locator ${selector} failed: ${err.message}`);
      }
    }

    console.log(`Profile Status for own profile: Name: ${profileName}, Verified: ${isVerified ? "Yes" : "No"}`);
  } catch (err) {
    console.error(`❌ Error navigating to own profile or checking status: ${err.message}`);
  }
}

/* ---------------------------
   Main Test - Perform Action
--------------------------- */
test.describe("LinkedIn Own Profile Status Check Script", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
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
      await humanMouse(page, 3);
      await humanIdle(800, 1800);

      if (await page.locator("#username").isVisible({ timeout: 5000 })) {
        console.log("🔐 Logging in...");
        await humanType(page, "#username", process.env.LINKEDIN_EMAIL);
        await humanIdle(600, 1600);
        await humanType(page, "#password", process.env.LINKEDIN_PASSWORD);
        await humanIdle(600, 1600);
        await page.locator(`label[for='rememberMeOptIn-checkbox']`).click().catch(() => console.log("Remember Me checkbox not found, skipping."));
        await humanIdle(600, 1600);
        await page.locator('button[type="submit"]').click();
        await randomDelay(1000, 2000);

        const authLink = page.locator('a:has-text("Verify using authenticator app")');
        if (await authLink.isVisible({ timeout: 5000 })) await authLink.click();
        const totpInput = page.locator('input[name="pin"][maxlength="6"]');
        if (await totpInput.isVisible({ timeout: 5000 })) {
          console.log("🔑 Using TOTP MFA...");
          const token = speakeasy.totp({ secret: process.env.LINKEDIN_TOTP_SECRET, encoding: "base32" });
          await humanType(page, 'input[name="pin"][maxlength="6"]', token);
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

  test("Navigate to Own Profile and Check Status", async () => {
    test.setTimeout(5 * 60 * 1000); // 5 minutes
    console.log("🔍 Navigating to own profile and checking verification status...");
    console.log("-------------------------------");
    
    await navigateToOwnProfileAndCheckStatus(page);
    
    await expect(page).toHaveURL(/linkedin\.com\/in\//);
  });
});