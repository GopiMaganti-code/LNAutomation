//src/likeAndMessage3.spec.js
require("dotenv").config();
const { test } = require("@playwright/test");
const fs = require("fs");
const speakeasy = require("speakeasy");

// ---------- CONFIG ----------
const SESSION_FILE = process.env.SESSION_FILE || "linkedin-session.json";
let PROFILE_LIST = [
  "https://www.linkedin.com/in/rajasekhar-kolli/",
  "https://www.linkedin.com/in/tsivaharsha/",
];

// Allow loading from external file
if (fs.existsSync("profiles.json")) {
  try {
    const fileProfiles = JSON.parse(fs.readFileSync("profiles.json", "utf8"));
    if (Array.isArray(fileProfiles) && fileProfiles.length > 0) {
      PROFILE_LIST = fileProfiles;
      console.log(`Loaded ${PROFILE_LIST.length} profiles from profiles.json`);
    }
  } catch (err) {
    console.warn("⚠️ Failed to parse profiles.json, using default list.");
  }
}

// ---------- HELPERS ----------
async function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((res) => setTimeout(res, delay));
}

async function humanType(locator, text, minDelay = 80, maxDelay = 200) {
  for (const char of text) {
    await locator.type(char, {
      delay: Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay,
    });
    if (Math.random() < 0.15) await randomDelay(200, 600);
  }
}

async function humanClick(page, locator) {
  if (typeof locator === "string") locator = page.locator(locator);
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();

  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.move(
      box.x + Math.random() * box.width,
      box.y + Math.random() * box.height,
      { steps: Math.floor(Math.random() * 5) + 2 }
    );
  }

  await randomDelay(500, 1500);
  await locator.click();
  await randomDelay(1000, 2500);
}

async function humanScroll(page) {
  const scrolls = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < scrolls; i++) {
    const distance = Math.floor(Math.random() * 400) + 100;
    await page.mouse.wheel(0, distance);
    await randomDelay(800, 2000);
  }
}

// ---------- CORE ACTIONS ----------
async function likePost(page, profileUrl) {
  try {
    await page.goto(`${profileUrl}detail/recent-activity/shares/`, {
      waitUntil: "domcontentloaded",
    });
    await randomDelay(2000, 4000);
    await humanScroll(page);

    await page
      .waitForSelector("div.feed-shared-update-v2, div.occludable-update", {
        timeout: 10000,
      })
      .catch(() => {});

    const posts = page.locator(
      "div.feed-shared-update-v2, div.occludable-update"
    );
    const postCount = await posts.count();

    if (postCount === 0) {
      console.log(`⚠️ No posts for ${profileUrl}`);
      return "no_posts";
    }

    for (let i = 0; i < Math.min(postCount, 5); i++) {
      const likeBtn = posts.nth(i).locator(
        'button.react-button__trigger[aria-label*="Like"]:not(.react-button__trigger--active)'
      );
      if (await likeBtn.isVisible().catch(() => false)) {
        await humanClick(page, likeBtn);
        console.log(`👍 Liked a post for ${profileUrl}`);
        await randomDelay(5000, 8000);
        return "liked";
      }
    }

    console.log(`⚠️ No unliked posts found for ${profileUrl}`);
    return "no_like_button";
  } catch (err) {
    console.error(`❌ Error while liking post at ${profileUrl}:`, err);
    return "error";
  }
}

async function sendMessage(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 4000);
    await humanScroll(page);

    await closeAllMessageOverlays(page);

    const messageBtn = page.locator("div.ph5 button:has-text('Message')").first();
    if (!(await messageBtn.isVisible().catch(() => false))) {
      console.warn(`⚠️ Message button not found for ${profileUrl}`);
      return;
    }

    await humanClick(page, messageBtn);
    await randomDelay(2000, 3500);

    const name =
      (await page.locator("h1").textContent().catch(() => "there"))?.trim() ||
      "there";
    const message = (
      process.env.MESSAGE_TEMPLATE || "Hi {name}, nice to connect!"
    ).replace("{name}", name);

    let retry = 0;
    while (retry < 2) {
      try {
        const input = page.locator("div.msg-form__contenteditable").first();
        await input.click();
        await humanType(input, message);

        const sendBtn = page
          .locator("button.msg-form__send-button:not([disabled])")
          .first();
        if (await sendBtn.isVisible().catch(() => false)) {
          await humanClick(page, sendBtn);
          console.log(`✍️ Sent message to ${name}`);
        } else {
          console.warn(`⚠️ Send button not available for ${name}`);
        }

        await randomDelay(3000, 5000);
        break;
      } catch (err) {
        retry++;
        console.warn(`⚠️ Send failed for ${name}, retrying (${retry})...`, err);
        await closeAllMessageOverlays(page);
        await randomDelay(2000, 4000);
      }
    }

    await closeAllMessageOverlays(page);
  } catch (err) {
    console.error(`❌ Error in sendMessage(${profileUrl}):`, err);
  }
}

async function closeAllMessageOverlays(page) {
  try {
    const closeBtns = page.locator(
      ".msg-overlay-bubble-header__controls.display-flex.align-items-center button"
    );

    let count = await closeBtns.count();
    while (count > 0) {
      for (let i = 0; i < count; i++) {
        const btn = closeBtns.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          await humanClick(page, btn);
          await randomDelay(300, 700);
        }
      }
      count = await closeBtns.count();
    }

    console.log("🧹 All message overlays closed.");
  } catch (err) {
    console.warn("⚠️ Error closing overlays:", err);
  }
}

// ---------- TEST ----------
test("LinkedIn bulk like + message", async ({ page }) => {
  test.setTimeout(600000);

  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;
  if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD) {
    throw new Error("❌ Missing LinkedIn credentials in .env file.");
  }

  let loggedIn = false;
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
      await page.context().addCookies(cookies);
      console.log("Loaded session cookies.");
      loggedIn = true;
    } catch {
      console.warn("⚠️ Failed to load saved cookies, fresh login required.");
    }
  }

  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });
  await randomDelay(2000, 4000);

  if (
    await page.locator('input[name="session_key"]').isVisible().catch(() => false)
  ) {
    console.log("Performing login...");
    const emailField = page.locator("#username");
    const passwordField = page.locator("#password");
    const submitBtn = page.locator('button[type="submit"]');

    await humanType(emailField, LINKEDIN_EMAIL);
    await randomDelay(500, 1200);
    await humanType(passwordField, LINKEDIN_PASSWORD);
    await randomDelay(500, 1200);
    await humanClick(page, submitBtn);

    await page.waitForTimeout(2000);
    const authLink = page.locator(
      'a:has-text("Verify using authenticator app")'
    );
    if (await authLink.isVisible().catch(() => false)) {
      await authLink.click();
      await page.waitForTimeout(1000);
    }

    const pinInput = page.locator('input[name="pin"]').first();
    if (await pinInput.isVisible().catch(() => false)) {
      const token = speakeasy.totp({
        secret: LINKEDIN_TOTP_SECRET,
        encoding: "base32",
      });
      await pinInput.click();
      await pinInput.type(token);
      const submit2FA = page.locator("div button#two-step-submit-button").nth(0);
      await submit2FA.click();
    }

    await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 20000 });
    const cookies = await page.context().cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
    console.log("✅ Session cookies saved.");
    loggedIn = true;
  } else {
    console.log("Already logged in with saved session.");
  }

  if (!loggedIn) {
    throw new Error("❌ Login failed, aborting.");
  }

  // Process profiles with randomness
  for (const profileUrl of PROFILE_LIST) {
    console.log(`🚀 Processing: ${profileUrl}`);

    if (Math.random() < 0.85) {
      await likePost(page, profileUrl);
      await randomDelay(2000, 4000);
    } else {
      console.log(`⏭️ Skipping like for ${profileUrl}`);
    }

    if (Math.random() < 0.9) {
      await sendMessage(page, profileUrl);
    } else {
      console.log(`⏭️ Skipping message for ${profileUrl}`);
    }

    // Random rest patterns
    const pause = Math.random();
    if (pause < 0.2) {
      console.log("😴 Taking a short random pause...");
      await randomDelay(15000, 30000);
    } else {
      await randomDelay(5000, 10000);
    }
  }

  console.log("✅ Completed all profiles");
});
