// src/postImpressions.spec.js
require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Local storage file to save LinkedIn session state
// const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Lokesh.json";
const STORAGE_FILE =
  process.env.STORAGE_FILE || "linkedinStealth-state-Gopi.json";

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
    (await el.type)
      ? await el.type(ch, { delay: Math.floor(Math.random() * 150) + 50 })
      : await page.keyboard.type(ch, { delay: 80 });
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
    } catch (e) {
      // swallow
    }
  });
}

/* ---------------------------
   Feed actions
--------------------------- */
async function likeRandomPost(page) {
  const choice = Math.floor(Math.random() * 5); // try a few candidates
  const btn = page
    .locator('button[aria-label*="Like"], button[aria-label*="like"]')
    .nth(choice);
  if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
    if (Math.random() < 0.7) {
      await btn.scrollIntoViewIfNeeded();
      await randomDelay(700, 1600);
      await btn.hover().catch(() => {});
      await randomDelay(500, 1500);
      await btn.click({ timeout: 5000 }).catch(() => {});
    }
    await humanIdle(1500, 3500);
  }
}

async function openNotifications(page) {
  // click notifications link
  const sel = 'a[href*="/notifications/"], a[aria-label*="Notifications"]';
  if (await page.locator(sel).count()) {
    await page
      .locator(sel)
      .first()
      .click()
      .catch(() => {});
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await humanIdle(2000, 4500);
  }
}

async function openMyNetwork(page) {
  const sel = 'a[href*="/mynetwork/"], a[aria-label*="My network"]';
  if (await page.locator(sel).count()) {
    await page
      .locator(sel)
      .first()
      .click()
      .catch(() => {});
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await humanIdle(2000, 4500);
  }
}

async function viewOwnProfile(page) {
  // Try the "Me" menu and "View profile" or direct profile avatar
  const meBtn = page.locator(
    'button[aria-label="Me"], button[aria-label*="Me"]'
  );
  if (await meBtn.count()) {
    await meBtn
      .first()
      .click()
      .catch(() => {});
    await randomDelay(500, 1200);
    const viewProfile = page.locator(
      'a:has-text("View profile"), a[href*="/in/"]'
    );
    if (await viewProfile.count()) {
      await viewProfile
        .first()
        .click()
        .catch(() => {});
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await humanIdle(2000, 5000);
      return;
    }
  }
  // fallback: try clicking profile picture
  const avatar = page.locator(
    'img.global-nav__me-photo, img[alt*="Profile photo"]'
  );
  if (await avatar.count()) {
    await avatar
      .first()
      .click()
      .catch(() => {});
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await humanIdle(2000, 4500);
  }
}

/* ---------------------------
   Main test
--------------------------- */
test("LinkedIn stealth login -> random actions -> open Post Impressions", async () => {
  test.setTimeout(8 * 60 * 1000); // 8 minutes to allow human delays

  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } =
    process.env;
  if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
    throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");

  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });
  const context = await browser.newContext({
    viewport: null,
    locale: "en-US",
    timezoneId: "Asia/Kolkata",
    userAgent:
      process.env.USER_AGENT ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    storageState: fs.existsSync(STORAGE_FILE) ? STORAGE_FILE : undefined,
  });

  const page = await context.newPage();
  await addStealth(page);

  // Go to login page (if cookie state valid you will be redirected to feed)
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });
  await humanMouse(page, 3);
  await humanIdle(800, 1800);

  // If we see username field, perform login flow
  if (
    await page
      .locator("#username")
      .isVisible()
      .catch(() => false)
  ) {
    await humanType(page, "#username", LINKEDIN_EMAIL);
    await humanIdle(600, 1600);
    await humanType(page, "#password", LINKEDIN_PASSWORD);
    await humanIdle(600, 1600);
    await page
      .locator('button[type="submit"]')
      .click()
      .catch(() => {});
    await randomDelay(1000, 2000);

    // Try to use authenticator app link if present
    const authLink = page.locator(
      'a:has-text("Verify using authenticator app")'
    );
    if (await authLink.isVisible().catch(() => false)) {
      await authLink.click().catch(() => {});
      await randomDelay(800, 1500);
    }

    // TOTP input (6 digits)
    const totpSel = 'input[name="pin"][maxlength="6"]';

    // Recovery input (8 digits)
    const recoverySel = 'input[name="pin"][maxlength="8"]';

    if (
      await page
        .locator(totpSel)
        .isVisible()
        .catch(() => false)
    ) {
      console.log("🔑 Using TOTP MFA...");
      const token = speakeasy.totp({
        secret: process.env.LINKEDIN_TOTP_SECRET,
        encoding: "base32",
      });
      await humanType(page, totpSel, token);
      await randomDelay(700, 1400);
      await page
        .locator('#two-step-submit-button, button[type="submit"]')
        .first()
        .click();
    } else if (
      await page
        .locator(recoverySel)
        .isVisible()
        .catch(() => false)
    ) {
      console.log("🆘 Using Recovery Code MFA...");
      await humanType(page, recoverySel, process.env.LINKEDIN_RECOVERY_CODE);
      await randomDelay(700, 1400);
      await page
        .locator('#two-step-submit-button, button[type="submit"]')
        .first()
        .click();
    } 

    // Wait for feed or final redirect
    await page
      .waitForURL("https://www.linkedin.com/feed/", { timeout: 30000 })
      .catch(() => {});
    // Save new storage state
    await context.storageState({ path: STORAGE_FILE });
  } else {
    // If not on login page, ensure we are on feed
    await page
      .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" })
      .catch(() => {});
  }

  // Warm up: small human actions on feed
  await humanIdle(1000, 2500);
  await humanScroll(page, 3);
  await humanMouse(page, 4);

  // Random chain of actions
  const actions = [
    async () => await humanIdle(3000, 7000),
    async () => await humanScroll(page, 4),
    async () => await likeRandomPost(page),
    async () => await openNotifications(page),
    async () => await openMyNetwork(page),
    async () => await viewOwnProfile(page),
  ];
  const shuffled = actions.sort(() => 0.5 - Math.random());
  const count = Math.floor(Math.random() * 3) + 2;
  const selected = shuffled.slice(0, count);
  for (const action of selected) {
    await action();
    await humanIdle(1500, 4000);
  }

  // Ensure we are on Home feed
  await page
    .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await humanIdle(800, 1800);

  await page.goto("https://www.linkedin.com/analytics/creator/content/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  console.log("Opened Post Impressions / Creator Analytics");
  await humanIdle(1200, 2400);

  const filterBtn = page.locator(
    "div[class='artdeco-card'] .analytics-libra-analytics-filter-group"
  );
  await filterBtn
    .first()
    .click()
    .catch(() => {});
  await humanIdle(800, 1600);
  const timeFilter = page.locator(
    `label[for='timeRange-past_28_days'] p[class='display-flex']`
  );
  if (await timeFilter.count()) {
    await timeFilter
      .first()
      .click()
      .catch(() => {});
    console.log("Set time filter to Past 28 days");
    await humanIdle(2000, 4000);
  }
  const applyBtn = page.locator(
    `div[id*='artdeco-hoverable-artdeco-gen'] div[class='artdeco-hoverable-content__content'] button[aria-label='This button will apply your selected item']`
  );
  if (await applyBtn.count()) {
    await applyBtn.first().click().catch(() => {});
    console.log("Applied filter");
    await humanIdle(2000, 4000);
  }
  const { impressions, membersReached } = await page.evaluate(() => {
    const impressions = document
      .querySelector(
        ".member-analytics-addon-summary__list-item:nth-of-type(1) .text-body-medium-bold"
      )
      ?.innerText.trim();
    const membersReached = document
      .querySelector(
        ".member-analytics-addon-summary__list-item:nth-of-type(2) .text-body-medium-bold"
      )
      ?.innerText.trim();
    return { impressions, membersReached };
  });
  console.log("Impressions:", impressions);
  console.log("Members reached:", membersReached);

  // Final small wait to allow analytics screen to render
  await humanIdle(2000, 4000);

  await filterBtn
    .last()
    .click()
    .catch(() => {});
  await humanIdle(800, 1600);
  await page
    .locator(`label[for='metricType-ENGAGEMENTS']`)
    .first()
    .click()
    .catch(() => {});
  await humanIdle(800, 1600);
  await page
    .locator(
      "div[id*='artdeco-hoverable-artdeco-gen'] button[aria-label='This button will apply your selected item']"
    )
    .nth(1)
    .click()
    .catch(() => {});
  await humanIdle(1000, 3000);
  // Wait for the analytics card container on the page to be fully visible and loaded
  await page.waitForSelector(
    "section.artdeco-card.member-analytics-addon-card__base-card",
    { timeout: 15000 }
  );

  // Optional wait to ensure dynamic content loads fully
  await page.waitForTimeout(3000);

  const metrics = await page.evaluate(() => {
    // Collect all metric list items
    const items = Array.from(
      document.querySelectorAll(".member-analytics-addon__cta-list-item")
    );

    // Helper function to get the count text by title matching (like 'Impressions', 'Reactions')
    const getTextByTitle = (title) => {
      const item = items.find(
        (li) =>
          li
            .querySelector(".member-analytics-addon__cta-list-item-title")
            ?.innerText.trim() === title
      );
      // Extract text inside the count container's text span
      return item
        ?.querySelector(
          ".member-analytics-addon__cta-list-item-count-container .member-analytics-addon__cta-list-item-text"
        )
        ?.innerText.trim();
    };

    return {
      reactions: getTextByTitle("Reactions"),
      comments: getTextByTitle("Comments"),
      reposts: getTextByTitle("Reposts"),
      saves: getTextByTitle("Saves"),
      sendsOnLinkedIn: getTextByTitle("Sends on LinkedIn"),
    };
  });

  console.log(`Reactions: ${metrics.reactions}`);
  console.log(`Comments: ${metrics.comments}`);
  console.log(`Reposts: ${metrics.reposts}`);
  console.log(`Saves: ${metrics.saves}`);
  console.log(`Sends on LinkedIn: ${metrics.sendsOnLinkedIn}`);
  await humanIdle(2000, 4000);

  // Assert we are on LinkedIn domain
  await expect(page).toHaveURL(/linkedin\.com/);

  // Close browser and finish test
  await browser.close();
});
