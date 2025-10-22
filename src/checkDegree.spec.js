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
   Check Degree of Connection
--------------------------- */
async function checkProfileConnection(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("body", { timeout: 10000 }).catch(() => console.log(`Body selector timeout for ${url}`));
  await humanIdle(2000, 4000);

  // Try multiple name locators in sequence
  const nameLocators = [
    { selector: "h1", description: "h1 tag" },
    { selector: "[href*='overlay/about-this-profile/']", description: "about profile link" },
    { selector: ".text-heading-xlarge", description: "text-heading-xlarge class" },
  ];
  let name = "Unknown User";
  for (const { selector, description } of nameLocators) {
    try {
      const text = await page.locator(selector).innerText({ timeout: 5000 }).catch(() => null);
      if (text && text.trim()) {
        name = text.trim();
        break;
      }
    } catch (err) {
      console.log(`Name locator ${description} failed for ${url}: ${err.message}`);
    }
  }

  // Try multiple degree locators in sequence
  const degreeLocators = [
    { selector: ".distance-badge .dist-value", description: "dist-value class" },
    { selector: ".distance-badge .visually-hidden", description: "visually-hidden class" },
    { selector: ".pv-top-card--list li:has-text('degree connection')", description: "top card list item" },
  ];
  let degreeText = null;
  for (const { selector, description } of degreeLocators) {
    try {
      degreeText = await page.locator(selector).innerText({ timeout: 5000 }).catch(() => null);
      if (degreeText && degreeText.trim()) {
        break;
      }
    } catch (err) {
      console.log(`Degree locator ${description} failed for ${url}: ${err.message}`);
    }
  }

  let degree = "Unknown";
  if (degreeText) {
    const cleaned = degreeText.trim().replace("°", "").toLowerCase();
    if (cleaned.includes("1")) degree = "1st";
    else if (cleaned.includes("2")) degree = "2nd";
    else if (cleaned.includes("3")) degree = "3rd+";
    else if (cleaned.includes("out of network")) degree = "Out of Network";
  }

  console.log(`${name} : ${degree} degree connection`);
  return { name, degree };
}

/* ---------------------------
   Main test
--------------------------- */
test.describe("LinkedIn Check Degree of Connection", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    test.setTimeout(10 * 60 * 1000); // 10 minutes

    const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;
    if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");

    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });
    const storageState = fs.existsSync(STORAGE_FILE) && fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
      ? STORAGE_FILE
      : undefined;

    context = await browser.newContext({
      viewport: null,
      locale: "en-US",
      timezoneId: "Asia/Kolkata",
      userAgent:
        process.env.USER_AGENT ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      storageState,
    });

    page = await context.newPage();
    await addStealth(page);

    // Go to login page
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanMouse(page, 3);
    await humanIdle(800, 1800);

    // Perform login if needed
    if (await page.locator("#username").isVisible().catch(() => false)) {
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
      const recoverySel = 'input[name="pin"][maxlength="8"]';

      if (await page.locator(totpSel).isVisible().catch(() => false)) {
        console.log("🔑 Using TOTP MFA...");
        const token = speakeasy.totp({
          secret: process.env.LINKEDIN_TOTP_SECRET,
          encoding: "base32",
        });
        await humanType(page, totpSel, token);
        await randomDelay(700, 1400);
        await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
      } else if (await page.locator(recoverySel).isVisible().catch(() => false)) {
        console.log("🆘 Using Recovery Code MFA...");
        await humanType(page, recoverySel, process.env.LINKEDIN_RECOVERY_CODE);
        await randomDelay(700, 1400);
        await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
      }

      await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => {});
      await context.storageState({ path: STORAGE_FILE });
    } else {
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    }

    await humanIdle(1000, 2500);
    await humanScroll(page, 3);
    await humanMouse(page, 4);
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test("Check Degree of Connection for Profiles", async () => {
    const profileUrls = [
      "https://www.linkedin.com/in/saran-jasty-189b429a/",
      "https://www.linkedin.com/in/k-ratna-kumar/",
      "https://www.linkedin.com/in/snigdha-chitransh-b273b0a8/",
      "https://www.linkedin.com/in/pooja-vibhute-5b089b199/",
    ];

    for (const url of profileUrls) {
      try {
        await checkProfileConnection(page, url);
        await humanIdle(2000, 4000);
      } catch (err) {
        console.error(`Error processing ${url}: ${err.message}. Skipping...`);
      }
    }

    await expect(page).toHaveURL(/linkedin\.com/);
  });
});