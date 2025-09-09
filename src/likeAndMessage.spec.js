require('dotenv').config();
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const speakeasy = require('speakeasy');

// ---------- CONFIG ----------
const SESSION_FILE = process.env.SESSION_FILE || 'linkedin-session.json';
const PROFILE_LIST = [
  "https://www.linkedin.com/in/writer-immah-18a65b354/",
  "https://www.linkedin.com/in/punit-sharma-ba90a41a5/",
  // add more profiles here
];

// ---------- HELPERS ----------
async function randomDelay(min = 300, max = 1200) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(res => setTimeout(res, delay));
}

async function humanType(locator, text) {
  for (const char of text) {
    await locator.type(char, { delay: Math.floor(Math.random() * 150) + 50 });
  }
}

async function humanClick(page, locator) {
  if (typeof locator === "string") locator = page.locator(locator);
  await locator.hover();
  await randomDelay();
  await locator.click();
}

// ---------- CORE ACTIONS ----------
// async function likePost(page, profileUrl) {
//   await page.goto(`${profileUrl}detail/recent-activity/`, {
//     waitUntil: "domcontentloaded",
//   });
//   await randomDelay();

//   //const posts = page.locator("div.feed-shared-update-v2, div.occludable-update");
//   const posts = page.locator("div.feed-shared-update-v2, div.occludable-update", { timeout: 10000 }).catch(() => {});
//   const postCount = await posts.count();

//   if (postCount === 0) {
//     console.log(`⚠️ No posts found for ${profileUrl}`);
//     return "no_posts";
//   }

//   const likeBtn = posts
//     .first()
//     .locator(
//       'button.react-button__trigger[aria-label*="Like"]:not(.react-button__trigger--active)'
//     )
//     .first();

//   if (await likeBtn.isVisible().catch(() => false)) {
//     await humanClick(page, likeBtn);
//     console.log(`👍 Liked a recent post for ${profileUrl}`);
//     await randomDelay(4000, 7000);
//     return "liked";
//   } else {
//     console.log(`⚠️ No like button visible for ${profileUrl}`);
//     await randomDelay(4000, 7000);
//     return "no_like_button";
//   }
// }
async function likePost(page, profileUrl) {
  // Go directly to "Posts" tab instead of generic activity
  await page.goto(`${profileUrl}detail/recent-activity/shares/`, {
    waitUntil: "domcontentloaded",
  });
  await randomDelay();

  // ✅ Wait for posts to load (up to 10s)
  await page.waitForSelector("div.feed-shared-update-v2, div.occludable-update", {
    timeout: 10000,
  }).catch(() => {});

  // Grab posts
  let posts = page.locator("div.feed-shared-update-v2, div.occludable-update");
  let postCount = await posts.count();

  // If no posts, try scrolling to lazy-load
  if (postCount === 0) {
    console.log(`⚠️ No posts visible yet for ${profileUrl}, scrolling...`);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 500);
      await randomDelay(1500, 2500);
      postCount = await posts.count();
      if (postCount > 0) break;
    }
  }

  if (postCount === 0) {
    console.log(`⚠️ Still no posts found for ${profileUrl}`);
    return "no_posts";
  }

  // Get like button on first post
  const likeBtn = posts
    .first()
    .locator(
      'button.react-button__trigger[aria-label*="Like"]:not(.react-button__trigger--active)'
    )
    .first();

  if (await likeBtn.isVisible().catch(() => false)) {
    await humanClick(page, likeBtn);
    console.log(`👍 Liked a recent post for ${profileUrl}`);
    await randomDelay(4000, 7000); // linger after like
    return "liked";
  } else {
    console.log(`⚠️ No like button visible for ${profileUrl}`);
    await randomDelay(4000, 7000);
    return "no_like_button";
  }
}

async function sendMessage(page, profileUrl) {
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await randomDelay();

  // Open message box
  await humanClick(page, "div.ph5 button:has-text('Message')");
  await randomDelay();

  // Extract full name
  const name =
    (
      await page.locator("h1").textContent().catch(() => "there")
    )?.trim() || "there";

  const message = (process.env.MESSAGE_TEMPLATE || "Hi {name}, nice to connect!")
    .replace("{name}", name);

  try {
    await page.click("div.msg-form__contenteditable");
    await page.keyboard.type(message, { delay: 100 });
    await humanClick(page, "button.msg-form__send-button");
    console.log(`✍️ Sent message to ${name}`);
  } catch (err) {
    console.error(`⚠️ Failed to send message to ${name}:`, err);
  }

  // Close message overlays
  try {
    const closeBtns = page.locator(
      ".msg-overlay-bubble-header__controls.display-flex.align-items-center button"
    ).last();
    const count = await closeBtns.count();

    for (let i = 0; i < count; i++) {
      const btn = closeBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await randomDelay(3000, 5000);
        await humanClick(page, btn);
      }
    }
  } catch (err) {
    console.error("⚠️ Error closing message box:", err);
  }
}

// ---------- TEST ----------
test('LinkedIn bulk like + message', async ({ page }) => {
  test.setTimeout(180000); // extend timeout
  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;

  // --- Load session if available ---
  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
    await page.context().addCookies(cookies);
    console.log('Loaded existing session cookies.');
  }

  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  await randomDelay();

  if (await page.locator('input[name="session_key"]').isVisible().catch(() => false)) {
    console.log('Performing login...');

    const emailField = page.locator('#username');
    const passwordField = page.locator('#password');
    const submitBtn = page.locator('button[type="submit"]');

    await humanType(emailField, LINKEDIN_EMAIL);
    await randomDelay();
    await humanType(passwordField, LINKEDIN_PASSWORD);
    await randomDelay();
    await submitBtn.click();

    // Handle 2FA
    const pinInput = page.locator('input[name="pin"]').first();
    if (await pinInput.isVisible().catch(() => false)) {
      const token = speakeasy.totp({
        secret: LINKEDIN_TOTP_SECRET,
        encoding: 'base32',
      });
      await humanType(pinInput, token);
      const submit2FA = page.locator('div button#two-step-submit-button').nth(0);
      await submit2FA.click();
    }

    await page.waitForURL('https://www.linkedin.com/feed/', { timeout: 20000 });
    const cookies = await page.context().cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
    console.log('Session cookies saved.');
  }

  // --- Bulk run for profiles ---
  for (const profileUrl of PROFILE_LIST) {
    console.log(`🚀 Processing: ${profileUrl}`);
    await likePost(page, profileUrl);
    await randomDelay(2000, 4000);
    await sendMessage(page, profileUrl);
    await randomDelay(4000, 6000); // wait between users
  }

  console.log("✅ Completed all profiles");
});
