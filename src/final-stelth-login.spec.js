// src/final-stelth-login2.spec.js
/**
 * 🔹 LinkedIn Stealth Automation with Playwright
 * ------------------------------------------------
 * This script automates LinkedIn login and simulates human-like behavior
 * to reduce the chance of triggering LinkedIn’s bot-detection systems.
 *
 * ✅ Core Features:
 * - Reads credentials and MFA TOTP secret from `.env`
 * - Uses saved session state (cookies) to avoid repeated logins
 * - Supports LinkedIn MFA via `speakeasy` (Authenticator App codes)
 * - Injects stealth patches to mask automation signals
 * - Mimics human patterns: typing delays, scrolling, random idling,
 *   and slight randomness in mouse movements
 *
 * 🎲 Post-Login Random Actions:
 * - Scroll through the LinkedIn feed
 * - Like a random post
 * - Open the Notifications tab
 * - Open the My Network tab
 * - View own profile
 * (actions are shuffled per run for variety)
 *
 * 📂 Logging:
 * - Writes structured logs with timestamps
 * - Each run gets a unique header separator
 * - Optionally truncates old logs to keep file size small
 *
 * ⚠️ Requirements:
 * - Node.js with Playwright, dotenv, and speakeasy installed
 * - A `.env` file with valid LinkedIn credentials and MFA secret
 * - Test runs in non-headless mode by default (to observe behavior)
 *
 * 🎯 Purpose:
 * - Safely log in to LinkedIn
 * - Chain realistic, human-like actions to reduce bot suspicion
 * - Provide a reference implementation for stealthy Playwright automation
 */

require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state.json";
const LOG_FILE = "automation-log.txt";
const MAX_RUNS = 5; // Keep only last 3 runs in the log file

/* --------------------------------------
   📝 Logging utility with run headers
-------------------------------------- */


// 🟢 Get current timestamp in IST
function getISTTimestamp() {
  const now = new Date();
  return `[${now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST]`;
}

// 🟢 Log a message to console + file
function log(message) {
  const finalMessage = `${message}`;
  console.log(finalMessage);
  fs.appendFileSync(LOG_FILE, finalMessage + "\n");
}

// 🟢 Add a run header each time script starts
function logRunHeader() {
  const now = new Date();
  const header = `
============================================================
🚀 LinkedIn Automation Run - ${now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
============================================================
`;

  log(header);
  pruneOldRuns();
}

// ✂️ Keep only the last MAX_RUNS in the log
function pruneOldRuns() {
  try {
    const data = fs.readFileSync(LOG_FILE, "utf-8");
    const runs = data
      .split("============================================================")
      .filter((r) => r.trim().length > 0);

    if (runs.length > MAX_RUNS) {
      const recentRuns = runs.slice(-MAX_RUNS);
      const trimmed = recentRuns
        .map((r) => "============================================================" + r)
        .join("");
      fs.writeFileSync(LOG_FILE, trimmed.trimStart());
      console.log(`🗑️ Old logs truncated, keeping last ${MAX_RUNS} runs.`);
    }
  } catch (err) {
    console.error("⚠️ Could not prune old logs:", err);
  }
}

module.exports = {
  logRunHeader,
};

/* --------------------------------------
   🧑 Human-like helper functions
   -------------------------------------- */

async function randomDelay(min = 200, max = 1200) {
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, t));
}

async function humanType(page, locator, text) {
  const el = page.locator(locator);
  await el.click({ delay: 100 });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");

  for (const ch of text) {
    await el.type(ch, { delay: Math.floor(Math.random() * 150) + 50 });
    if (Math.random() < 0.15) await randomDelay(400, 900);
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
  //log(`⏳ Idling for ${wait}ms...`);
  await new Promise((r) => setTimeout(r, wait));
}

/* --------------------------------------
   🕵️ Stealth patches (anti-bot detection)
   -------------------------------------- */
async function addStealth(page) {
  await page.addInitScript(() => {
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
  });
}

/* --------------------------------------
   📢 LinkedIn feed actions
   -------------------------------------- */

async function likeRandomPost(page) {
  const choice = Math.floor(Math.random() * 3);
  const btn = page.locator('button[aria-label*="Like"]').nth(choice);

  if (await btn.isVisible()) {
    log(`👍 Considering post #${choice + 1}`);
    if (Math.random() < 0.7) {
      await btn.hover();
      await randomDelay(800, 2000);
      await btn.click({ delay: Math.floor(Math.random() * 200) + 100 });
      log("✅ Liked the post.");
    } else {
      log("🙅 Skipped liking.");
    }
    await humanIdle(2000, 4000);
  }
}

async function openNotifications(page) {
  log("🔔 Opening notifications...");
  await page.click('a[href*="/notifications/"]');
  await page.waitForLoadState("domcontentloaded");
  await humanIdle(3000, 6000);
}

async function openMyNetwork(page) {
  log("👥 Opening My Network...");
  await page.click('a[href*="/mynetwork/"]');
  await page.waitForLoadState("domcontentloaded");
  await humanIdle(3000, 6000);
}

async function viewOwnProfile(page) {
  log("🧑 Visiting own profile...");
  const profileCard = page.locator("h3.profile-card-name.text-heading-large");
  if (await profileCard.isVisible()) {
    await profileCard.hover();
    await humanIdle(800, 1500);
    await profileCard.click();
    await page.waitForLoadState("domcontentloaded");
    await humanIdle(4000, 8000);
  } else {
    log("⚠️ Profile card not found, skipping.");
  }
}

let headerLogged = false;

function logRunHeaderOnce() {
  if (headerLogged) return;
  headerLogged = true;
  logRunHeader();
}

/* --------------------------------------
   🚀 Main Test Flow
   -------------------------------------- */
test("LinkedIn stealth login with chained human-like actions", async () => {
  test.setTimeout(180000);
  // Log the start of a new run
  logRunHeader();
  logRunHeaderOnce(); // ✅ guaranteed once per process

  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } =
    process.env;

  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null,
    locale: "en-US",
    timezoneId: "Asia/Kolkata",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    storageState: fs.existsSync(STORAGE_FILE) ? STORAGE_FILE : undefined,
  });

  const page = await context.newPage();
  await addStealth(page);

  //log("🌐 Navigating to LinkedIn login page...");
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });
  await humanMouse(page, 4);
  await humanIdle(2000, 4000);

  /* --- Login + MFA --- */
  const emailField = page.locator("#username");
  if (await emailField.isVisible().catch(() => false)) {
    log("🔑 Performing login...");
    await humanType(page, "#username", LINKEDIN_EMAIL);
    await humanIdle(1000, 3000);
    await humanType(page, "#password", LINKEDIN_PASSWORD);
    await humanIdle(1000, 3000);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(2000);
    // MFA TOTP flow
    const authLink = page.locator('a:has-text("Verify using authenticator app")');
    if (await authLink.isVisible().catch(() => false)) {
      await authLink.click();
      await page.waitForTimeout(1000);
    }

    const pinInputSelector = 'input[name="pin"][maxlength="6"]';
    const pinInputVisible = await page.locator(pinInputSelector).first().isVisible().catch(() => false);

    if (pinInputVisible) {
      const token = speakeasy.totp({
        secret: LINKEDIN_TOTP_SECRET,
        encoding: "base32",
      });
      await humanType(page, pinInputSelector, token);
      await page.locator("#two-step-submit-button").first().click();
    }

    await page
      .waitForURL("https://www.linkedin.com/feed/", { timeout: 30000 })
      .catch(() => log("⚠️ Feed did not load in time."));

    //log("✅ Logged in successfully.");
    await context.storageState({ path: STORAGE_FILE });
  } else {
    //log("✅ Session restored, already logged in.");
  }

  /// 🔹 Always go to feed before starting random actions
  log("🏠 Ensuring we are on LinkedIn Home Feed...");
  // await page.goto("https://www.linkedin.com/feed/", {
  //   waitUntil: "domcontentloaded",
  // });
  await page.waitForLoadState("domcontentloaded");
  await humanIdle(3000, 6000);

  /* --- Random chained actions --- */
  const actions = [
    async () => await humanIdle(5000, 10000),
    async () => {
      log("📜 Scrolling feed...");
      await humanScroll(page, 4);
      await humanIdle();
    },
    async () => await likeRandomPost(page),
    async () => await openNotifications(page),
    async () => await openMyNetwork(page),
    async () => await viewOwnProfile(page),
  ];

  const shuffled = actions.sort(() => 0.5 - Math.random());
  const count = Math.floor(Math.random() * 3) + 2;
  const selected = shuffled.slice(0, count);

  log(`🎲 Running ${count} random actions...`);

  for (const action of selected) {
    await action();
    await humanIdle(2000, 5000);
  }

  log("🏁 Script completed. All actions finished successfully!");
  await expect(page).toHaveURL(/linkedin\.com/);
  await browser.close();
});
