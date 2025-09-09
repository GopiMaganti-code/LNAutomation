require('dotenv').config(); 
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const speakeasy = require('speakeasy');

// ---------- CONFIG ----------
const SESSION_FILE = process.env.SESSION_FILE || 'linkedin-session.json';
const PROFILE_LIST = [
  "https://www.linkedin.com/in/a-sri-harsha/",
  "https://www.linkedin.com/in/shubham-amate-7a82651b4/",
  
  // add more profiles here
];

// ---------- HELPERS ----------
async function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(res => setTimeout(res, delay));
}

async function humanType(locator, text, minDelay = 80, maxDelay = 200) {
  for (const char of text) {
    await locator.type(char, { delay: Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay });
    if (Math.random() < 0.15) await randomDelay(200, 600); // occasional pause
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
  await randomDelay(1000, 2500); // linger after click
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
  await page.goto(`${profileUrl}detail/recent-activity/shares/`, { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 4000);
  await humanScroll(page);

  await page.waitForSelector("div.feed-shared-update-v2, div.occludable-update", { timeout: 10000 }).catch(() => {});

  const posts = page.locator("div.feed-shared-update-v2, div.occludable-update");
  let postCount = await posts.count();

  if (postCount === 0) {
    console.log(`⚠️ No posts for ${profileUrl}`);
    return "no_posts";
  }

  const likeBtn = posts.first().locator('button.react-button__trigger[aria-label*="Like"]:not(.react-button__trigger--active)');

  if (await likeBtn.isVisible().catch(() => false)) {
    await humanClick(page, likeBtn);
    console.log(`👍 Liked a recent post for ${profileUrl}`);
    await randomDelay(5000, 8000); // linger after like
    return "liked";
  } else {
    console.log(`⚠️ No like button for ${profileUrl}`);
    await randomDelay(4000, 7000);
    return "no_like_button";
  }
}

// async function sendMessage(page, profileUrl) {
//   await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
//   await randomDelay(2000, 4000);
//   await humanScroll(page);

//   await humanClick(page, "div.ph5 button:has-text('Message')");
//   await randomDelay(2000, 3500);

//   const name = (await page.locator("h1").textContent().catch(() => "there"))?.trim() || "there";
//   const message = (process.env.MESSAGE_TEMPLATE || "Hi {name}, nice to connect!").replace("{name}", name);

//   try {
//     const input = page.locator("div.msg-form__contenteditable");
//     await input.click();
//     await humanType(input, message); // human-like typing
//     await humanClick(page, "button.msg-form__send-button");
//     console.log(`✍️ Sent message to ${name}`);
//     await randomDelay(3000, 5000);
//   } catch (err) {
//     console.error(`⚠️ Failed to send message to ${name}:`, err);
//   }

//   // Close overlays
//   try {
//     const closeBtns = page.locator(".msg-overlay-bubble-header__controls.display-flex.align-items-center button").last();
//     const count = await closeBtns.count();
//     for (let i = 0; i < count; i++) {
//       if (await closeBtns.nth(i).isVisible().catch(() => false)) {
//         await humanClick(page, closeBtns.nth(i));
//       }
//     }
//   } catch {}
// }


// async function sendMessage(page, profileUrl) {
//   await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
//   await randomDelay(2000, 4000);
//   await humanScroll(page);

//   // Open message box
//   const messageBtn = page.locator("div.ph5 button:has-text('Message')").first();
//   if (await messageBtn.isVisible().catch(() => false)) {
//     await humanClick(page, messageBtn);
//     await randomDelay(2000, 3500);
//   } else {
//     console.warn(`⚠️ Message button not found for ${profileUrl}`);
//     return;
//   }

//   const name = (await page.locator("h1").textContent().catch(() => "there"))?.trim() || "there";
//   const message = (process.env.MESSAGE_TEMPLATE || "Hi {name}, nice to connect!").replace("{name}", name);

//   try {
//     const input = page.locator("div.msg-form__contenteditable").first();
//     await input.click();
//     await humanType(input, message); // human-like typing

//     // --- Click Send button safely ---
//     const sendBtn = page.locator("button.msg-form__send-button:not([disabled])").first();
//     if (await sendBtn.isVisible().catch(() => false)) {
//       await humanClick(page, sendBtn);
//       console.log(`✍️ Sent message to ${name}`);
//     } else {
//       console.warn(`⚠️ Send button not visible or disabled for ${name}`);
//     }

//     await randomDelay(3000, 5000);
//   } catch (err) {
//     console.error(`⚠️ Failed to send message to ${name}:`, err);
//   }

//   // --- Close any extra overlays safely ---
//   try {
//     const closeBtns = page.locator(".msg-overlay-bubble-header__controls.display-flex.align-items-center button").last();
//     const count = await closeBtns.count();
//     for (let i = 0; i < count; i++) {
//       const btn = closeBtns.nth(i);
//       if (await btn.isVisible().catch(() => false)) {
//         await humanClick(page, btn);
//       }
//     }
//   } catch (err) {
//     console.warn("⚠️ Failed to close some overlays:", err);
//   }
// }


async function sendMessage(page, profileUrl) {
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 4000);
  await humanScroll(page);

  // --- Always close any existing overlays before starting ---
  await closeAllMessageOverlays(page);

  // Open message box
  const messageBtn = page.locator("div.ph5 button:has-text('Message')").first();
  if (await messageBtn.isVisible().catch(() => false)) {
    await humanClick(page, messageBtn);
    await randomDelay(2000, 3500);
  } else {
    console.warn(`⚠️ Message button not found for ${profileUrl}`);
    return;
  }

  const name = (await page.locator("h1").textContent().catch(() => "there"))?.trim() || "there";
  const message = (process.env.MESSAGE_TEMPLATE || "Hi {name}, nice to connect!").replace("{name}", name);

  try {
    const input = page.locator("div.msg-form__contenteditable").first();
    await input.click();
    await humanType(input, message); // human-like typing

    // --- Click Send button safely ---
    const sendBtn = page.locator("button.msg-form__send-button:not([disabled])").first();
    if (await sendBtn.isVisible().catch(() => false)) {
      await humanClick(page, sendBtn);
      console.log(`✍️ Sent message to ${name}`);
    } else {
      console.warn(`⚠️ Send button not visible or disabled for ${name}`);
    }

    await randomDelay(3000, 5000);
  } catch (err) {
    console.error(`⚠️ Failed to send message to ${name}:`, err);
  }

  // --- Always close overlays after sending, before next profile ---
  await closeAllMessageOverlays(page);
}

// Helper: Close ALL LinkedIn message overlays safely
// async function closeAllMessageOverlays(page) {
//   try {
//     const closeBtns = page.locator(".msg-overlay-bubble-header__controls.display-flex.align-items-center button").last();
//     const count = await closeBtns.count();
//     for (let i = 0; i < count; i++) {
//       const btn = closeBtns.nth(i);
//       if (await btn.isVisible().catch(() => false)) {
//         await humanClick(page, btn);
//         await randomDelay(300, 700);
//       }
//     }
//     if (count > 0) {
//       console.log(`🧹 Closed ${count} message overlay(s).`);
//     }
//   } catch (err) {
//     console.warn("⚠️ Failed to close some overlays:", err);
//   }
// }

//Need to add: Safety retry inside sendMessage() (so if an incoming overlay interrupts typing, it retries once instead of skipping)
async function closeAllMessageOverlays(page) {
  try {
    const closeBtns = page.locator(".msg-overlay-bubble-header__controls.display-flex.align-items-center button").last();
    let count = await closeBtns.count();

    while (count > 0) {
      for (let i = 0; i < count; i++) {
        const btn = closeBtns.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          await humanClick(page, btn);
          await randomDelay(300, 700);
        }
      }
      count = await closeBtns.count(); // re-check in case new ones opened
    }

    console.log("🧹 All message overlays closed before navigation.");
  } catch (err) {
    console.warn("⚠️ Error closing overlays:", err);
  }
}



// ---------- TEST ----------
test('LinkedIn bulk like + message', async ({ page }) => {
  test.setTimeout(600000); // extend timeout for multiple profiles
  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;

  // Load session if available
  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
    await page.context().addCookies(cookies);
    console.log('Loaded existing session cookies.');
  }

  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 4000);

  if (await page.locator('input[name="session_key"]').isVisible().catch(() => false)) {
    console.log('Performing login...');

    const emailField = page.locator('#username');
    const passwordField = page.locator('#password');
    const submitBtn = page.locator('button[type="submit"]');

    await humanType(emailField, LINKEDIN_EMAIL);
    await randomDelay(500, 1200);
    await humanType(passwordField, LINKEDIN_PASSWORD);
    await randomDelay(500, 1200);
    await humanClick(page, submitBtn); // human-like click

    // Handle 2FA quickly
    const pinInput = page.locator('input[name="pin"]').first();
    if (await pinInput.isVisible().catch(() => false)) {
      const token = speakeasy.totp({ secret: LINKEDIN_TOTP_SECRET, encoding: 'base32' });
      await pinInput.click();
      await pinInput.type(token); // minimal delay
      const submit2FA = page.locator('div button#two-step-submit-button').nth(0);
      await submit2FA.click();
    }

    await page.waitForURL('https://www.linkedin.com/feed/', { timeout: 20000 });
    const cookies = await page.context().cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
    console.log('Session cookies saved.');
  } else {
    console.log('Already logged in with existing session.');
  }

  // --- Process profiles ---
  for (const profileUrl of PROFILE_LIST) {
    console.log(`🚀 Processing: ${profileUrl}`);
    await likePost(page, profileUrl);
    await randomDelay(2000, 4000);
    await sendMessage(page, profileUrl);
    await randomDelay(5000, 8000); // wait before next profile
  }

  console.log("✅ Completed all profiles");
});
