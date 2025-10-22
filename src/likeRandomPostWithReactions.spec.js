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
async function randomDelay(min = 1000, max = 3000) {
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, t));
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
    const dir = Math.random() > 0.2 ? 1 : -1;
    await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
    await randomDelay(800, 1600);
  }
}

async function humanIdle(min = 3000, max = 6000) {
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
   Main test - Like Random Post with Reactions
--------------------------- */
test.describe("LinkedIn Like Random Post with Reactions", () => {
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
        await page.getByRole('textbox', { name: 'Email or phone' }).fill(LINKEDIN_EMAIL);
        await humanIdle(600, 1600);
        await page.getByRole('textbox', { name: 'Password' }).fill(LINKEDIN_PASSWORD);
        await humanIdle(600, 1600);
        await page.getByText('Keep me logged in').click().catch(() => console.log("Keep me logged in checkbox not found, skipping."));
        await humanIdle(600, 1600);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await randomDelay(1000, 2000);

        // Handle MFA
        const authLink = page.getByRole('link', { name: 'Verify using authenticator app' });
        if (await authLink.isVisible().catch(() => false)) {
          await authLink.click();
          await randomDelay(800, 1500);
        }

        const totpSel = page.getByRole('textbox', { name: 'Please enter the code here' });
        if (await totpSel.isVisible().catch(() => false)) {
          console.log("🔑 Using TOTP MFA...");
          const token = speakeasy.totp({
            secret: process.env.LINKEDIN_TOTP_SECRET,
            encoding: "base32",
          });
          await totpSel.fill(token);
          await randomDelay(700, 1400);
          await page.getByRole('button', { name: 'Submit code' }).click();
        }

        await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => {
          console.log("⚠️ Failed to reach feed after login, continuing...");
        });
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

  test("Like Random Post with Reactions", async () => {
    // Set test timeout explicitly
    test.setTimeout(15 * 60 * 1000); // 15 minutes

    console.log("📝 Starting to like random posts with reactions...");

    // Navigate to feed
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanScroll(page, 5);
    await humanIdle(2000, 4000);

    // Find all like buttons and select a random unreacted post
    const likeButtons = await page.locator(".reactions-react-button button[aria-label*='Like']").all();
    if (likeButtons.length === 0) {
      console.log("⚠️ No Like buttons found on the feed");
      return;
    }

    // Filter unreacted buttons
    const unreactedButtons = [];
    for (const button of likeButtons) {
      const isReacted = await button.evaluate((el) => el.getAttribute("aria-label").includes("Unlike"), { timeout: 5000 }).catch(() => false);
      if (!isReacted) unreactedButtons.push(button);
    }

    if (unreactedButtons.length === 0) {
      console.log("⚠️ All visible posts are already reacted to");
      return;
    }

    const randomIndex = Math.floor(Math.random() * unreactedButtons.length);
    const selectedButton = unreactedButtons[randomIndex];
    console.log(`🎯 Selected random unreacted post ${randomIndex + 1} of ${unreactedButtons.length}`);

    // Decide action based on probability
    const randomValue = Math.random();
    if (randomValue <= 0.6) {
      // 60% chance to Like
      await humanMouse(page, 2);
      await selectedButton.scrollIntoViewIfNeeded();
      await selectedButton.click({ delay: 100 });
      console.log("👍 Liked the post directly");
      await randomDelay(1000, 2000);
    } else {
      // 40% chance to react with one of the other emotions
      await humanMouse(page, 2);
      await selectedButton.scrollIntoViewIfNeeded();
      await selectedButton.hover(); // Hover to open reaction tray
      console.log("💡 Hovered over Like button to open reaction tray");
      await randomDelay(3000, 4000); // Wait for tray

      const reactionTray = page.locator(".reactions-menu");
      if (await reactionTray.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("✅ Reaction tray opened successfully");

        const reactions = [
          { selector: ".reactions-menu button[aria-label='React Love']", name: "Love", weight: 0.25 },
          { selector: ".reactions-menu button[aria-label='React Insightful']", name: "Insightful", weight: 0.25 },
          { selector: ".reactions-menu button[aria-label='React Celebrate']", name: "Celebrate", weight: 0.25 },
          { selector: ".reactions-menu button[aria-label='React Support']", name: "Support", weight: 0.25 },
        ];
        let cumulativeWeight = 0;
        const reactionValue = Math.random();
        let selectedReaction = reactions[0];

        for (const reaction of reactions) {
          cumulativeWeight += reaction.weight;
          if (reactionValue <= cumulativeWeight) {
            selectedReaction = reaction;
            break;
          }
        }

        try {
          const reactionButton = page.locator(selectedReaction.selector);
          await reactionButton.waitFor({ state: "visible", timeout: 5000 });
          await humanMouse(page, 1);
          await reactionButton.click({ delay: 100 });
          console.log(`✅ Reacted with ${selectedReaction.name} on the post`);
          await randomDelay(1000, 2000);
        } catch (err) {
          console.error(`❌ Failed to react with ${selectedReaction.name}:`, err.message);
        }
      } else {
        console.log("⚠️ Reaction tray did not open, falling back to Like");
        await selectedButton.click({ delay: 100 });
        console.log("👍 Liked the post as fallback");
        await randomDelay(1000, 2000);
      }
    }

    console.log("✅ Finished reacting to the post");
    await humanIdle(3000, 6000);

    // Verify still on LinkedIn
    await expect(page).toHaveURL(/linkedin\.com/);
  });
});