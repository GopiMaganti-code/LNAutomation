// require('dotenv').config();
// const { test, expect, chromium } = require('@playwright/test');
// const fs = require('fs');
// const speakeasy = require('speakeasy');

// const SESSION_FILE = process.env.SESSION_FILE || 'linkedin-session.json';

// // ======= CONFIG =======
// const CONFIG = {
//   mouseMoves: 5,
//   scrolls: 3,
//   hoverPosts: 3,
//   idleMin: 2000,
//   idleMax: 6000,
//   likeChance: 0.3,
//   viewProfileChance: 0.2,
// };

// // ======= UTILS =======

// // Random delay
// async function randomDelay(min = 300, max = 1200) {
//   const delay = Math.floor(Math.random() * (max - min + 1)) + min;
//   await new Promise(res => setTimeout(res, delay));
// }

// // Human-like typing
// async function humanType(locator, text) {
//   for (const char of text) {
//     await locator.type(char, { delay: Math.floor(Math.random() * 150) + 50 });
//   }
// }

// // Random mouse movements
// async function humanMouse(page, times = CONFIG.mouseMoves) {
//   let box = await page.viewportSize();

//   if (!box) {
//     box = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
//   }

//   for (let i = 0; i < times; i++) {
//     const x = Math.floor(Math.random() * box.width);
//     const y = Math.floor(Math.random() * box.height);
//     await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 20) + 5 });
//     await randomDelay(200, 600);
//   }
// }

// // Random scrolling
// async function humanScroll(page, times = CONFIG.scrolls) {
//   for (let i = 0; i < times; i++) {
//     const distance = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 500);
//     await page.mouse.wheel(0, distance);
//     await randomDelay(400, 1200);
//   }
// }

// // Idle/reading time
// async function humanIdle(min = CONFIG.idleMin, max = CONFIG.idleMax) {
//   const waitTime = Math.floor(Math.random() * (max - min + 1)) + min;
//   console.log(`⏳ Idling for ${waitTime}ms...`);
//   await new Promise(res => setTimeout(res, waitTime));
// }

// // Hover over random posts
// async function humanHoverPosts(page, count = CONFIG.hoverPosts) {
//   const posts = page.locator('div.feed-shared-update-v2');
//   const totalPosts = await posts.count();

//   if (totalPosts === 0) return;

//   for (let i = 0; i < count; i++) {
//     const index = Math.floor(Math.random() * Math.min(totalPosts, 10));
//     const post = posts.nth(index);

//     try {
//       await post.hover();
//       console.log(`👀 Hovered over post #${index + 1}`);
//       await humanIdle(2000, 5000);
//     } catch (err) {
//       console.log('⚠️ Could not hover post:', err.message);
//     }
//   }
// }

// // Chance-based actions
// async function maybeLikePost(page, probability = CONFIG.likeChance) {
//   if (Math.random() < probability) {
//     const likeButtons = page.locator('button[aria-label*="Like"]');
//     const count = await likeButtons.count();
//     if (count > 0) {
//       const index = Math.floor(Math.random() * Math.min(count, 5));
//       try {
//         await likeButtons.nth(index).hover();
//         await randomDelay();
//         await likeButtons.nth(index).click();
//         console.log(`👍 Liked a post (index ${index})`);
//         await humanIdle(2000, 4000);
//       } catch (err) {
//         console.log('⚠️ Could not like post:', err.message);
//       }
//     }
//   }
// }

// async function maybeViewProfile(page, probability = CONFIG.viewProfileChance) {
//   if (Math.random() < probability) {
//     const profileLinks = page.locator('a[href*="/in/"]');
//     const count = await profileLinks.count();
//     if (count > 0) {
//       const index = Math.floor(Math.random() * Math.min(count, 5));
//       try {
//         const href = await profileLinks.nth(index).getAttribute('href');
//         console.log(`👤 Visiting profile: ${href}`);
//         await profileLinks.nth(index).click();
//         await page.waitForLoadState('domcontentloaded');
//         await humanIdle(4000, 8000);
//         await page.goBack();
//         await page.waitForLoadState('domcontentloaded');
//       } catch (err) {
//         console.log('⚠️ Could not view profile:', err.message);
//       }
//     }
//   }
// }

// // Randomize browsing sequence
// async function randomBrowsingSequence(page) {
//   const actions = [
//     async () => await humanScroll(page),
//     async () => await humanMouse(page),
//     async () => await humanHoverPosts(page),
//     async () => await humanIdle(3000, 7000),
//     async () => await maybeLikePost(page),
//     async () => await maybeViewProfile(page),
//   ];

//   // Shuffle actions
//   for (let i = actions.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [actions[i], actions[j]] = [actions[j], actions[i]];
//   }

//   // Execute shuffled actions
//   for (const action of actions) {
//     await action();
//   }
// }

// // ======= TEST =======
// test('LinkedIn stealth login with MFA and randomized browsing', async () => {
//   test.setTimeout(180000);

//   const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;

//   const browser = await chromium.launch({
//     headless: false,
//     args: ['--disable-blink-features=AutomationControlled', '--start-maximized'],
//   });

//   const context = await browser.newContext({
//     userAgent:
//       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
//     viewport: null,
//     locale: 'en-US',
//     timezoneId: 'Asia/Kolkata',
//   });

//   const page = await context.newPage();

//   // Patch fingerprints
//   await page.addInitScript(() => {
//     Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
//     Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
//     Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
//   });

//   // Load existing session
//   if (fs.existsSync(SESSION_FILE)) {
//     const cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
//     await context.addCookies(cookies);
//     console.log('Loaded existing session cookies.');
//   }

//   await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
//   await randomDelay();
//   await humanMouse(page, 5);
//   await humanIdle(3000, 6000);

//   // Login if needed
//   if (await page.locator('input[name="session_key"]').isVisible()) {
//     console.log('Performing login...');

//     const emailField = page.locator('#username');
//     const passwordField = page.locator('#password');
//     const submitBtn = page.locator('button[type="submit"]');

//     await emailField.hover();
//     await humanType(emailField, LINKEDIN_EMAIL);
//     await humanIdle(2000, 4000);

//     await passwordField.hover();
//     await humanType(passwordField, LINKEDIN_PASSWORD);
//     await humanIdle(2000, 4000);

//     await submitBtn.hover();
//     await randomDelay();
//     await submitBtn.click();

//     // ======= MFA HANDLING =======
//     await page.waitForTimeout(2000);

//     // 1️⃣ Detect push notification screen
//     const checkAppHeading = page.locator('h1:has-text("Check your LinkedIn app")');
//     if (await checkAppHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
//       console.log("⚠️ Detected LinkedIn push notification MFA screen.");
//       const authLink = page.locator('a:has-text("Verify using authenticator app")');
//       await authLink.click();
//       await page.waitForTimeout(1000);
//     }

//     // 2️⃣ Handle TOTP pin input
//     const pinInput = page.locator('input[name="pin"]').first();
//     if (await pinInput.isVisible({ timeout: 5000 }).catch(() => false)) {
//       const token = speakeasy.totp({ secret: LINKEDIN_TOTP_SECRET, encoding: 'base32' });

//       await humanType(pinInput, token);
//       await humanIdle(2000, 5000);

//       const submit2FA = page.locator('div button#two-step-submit-button').nth(0);
//       await submit2FA.hover();
//       await randomDelay();
//       await submit2FA.click();
//     }

//     await page.waitForURL('https://www.linkedin.com/feed/', { timeout: 20000 });

//     // Save session
//     const cookies = await context.cookies();
//     fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
//     console.log('Session cookies saved.');
//   } else {
//     console.log('Already logged in with existing session.');
//   }

//   // Randomized browsing with chance actions
//   await randomBrowsingSequence(page);

//   await expect(page).toHaveURL('https://www.linkedin.com/feed/');
//   await page.pause();
// });



// tests/linkedin.spec.js
require('dotenv').config();
const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const speakeasy = require('speakeasy');

const SESSION_FILE = process.env.SESSION_FILE || 'linkedin-session.json';

// ======= CONFIG =======
const CONFIG = {
  mouseMoves: 5,
  scrolls: 3,
  hoverPosts: 3,
  idleMin: 2000,
  idleMax: 6000,
  likeChance: 0.3,
  viewProfileChance: 0.2,
};

// ======= UTILS =======

// Random delay
async function randomDelay(min = 300, max = 1200) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(res => setTimeout(res, delay));
}

// Typing simulation
async function humanType(locator, text) {
  for (const char of text) {
    await locator.type(char, { delay: Math.floor(Math.random() * 150) + 50 });
  }
}

// Mouse movements
async function humanMouse(page, times = CONFIG.mouseMoves) {
  const size = page.viewportSize();
  if (!size) return;
  for (let i = 0; i < times; i++) {
    const x = Math.floor(Math.random() * size.width);
    const y = Math.floor(Math.random() * size.height);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 15) + 3 });
    await randomDelay(200, 600);
  }
}

// Scrolling
async function humanScroll(page, times = CONFIG.scrolls) {
  for (let i = 0; i < times; i++) {
    const distance = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 500);
    await page.mouse.wheel(0, distance);
    await randomDelay(400, 1000);
  }
}

// Idle time
async function humanIdle(min = CONFIG.idleMin, max = CONFIG.idleMax) {
  const waitTime = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`⏳ Idling for ${waitTime}ms...`);
  await new Promise(res => setTimeout(res, waitTime));
}

// Hover random posts
async function humanHoverPosts(page, count = CONFIG.hoverPosts) {
  const posts = page.locator('div.feed-shared-update-v2');
  const total = await posts.count();
  if (!total) return;

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * Math.min(total, 10));
    try {
      await posts.nth(idx).hover();
      console.log(`👀 Hovered post #${idx + 1}`);
      await humanIdle(2000, 5000);
    } catch {
      console.log('⚠️ Could not hover a post.');
    }
  }
}

// Maybe like a post
async function maybeLikePost(page, probability = CONFIG.likeChance) {
  if (Math.random() >= probability) return;
  const buttons = page.locator('button[aria-label*="Like"]');
  const count = await buttons.count();
  if (!count) return;

  const idx = Math.floor(Math.random() * Math.min(count, 5));
  try {
    await buttons.nth(idx).click();
    console.log(`👍 Liked a post (index ${idx})`);
    await humanIdle(2000, 4000);
  } catch {
    console.log('⚠️ Could not like post.');
  }
}

// Maybe view profile
async function maybeViewProfile(page, probability = CONFIG.viewProfileChance) {
  if (Math.random() >= probability) return;
  const links = page.locator('a[href*="/in/"]');
  const count = await links.count();
  if (!count) return;

  const idx = Math.floor(Math.random() * Math.min(count, 5));
  try {
    const href = await links.nth(idx).getAttribute('href');
    console.log(`👤 Visiting profile: ${href}`);
    await links.nth(idx).click();
    await page.waitForLoadState('domcontentloaded');
    await humanIdle(4000, 8000);
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
  } catch {
    console.log('⚠️ Could not view profile.');
  }
}

// Random browsing sequence
async function randomBrowsingSequence(page) {
  const actions = [
    () => humanScroll(page),
    () => humanMouse(page),
    () => humanHoverPosts(page),
    () => humanIdle(3000, 7000),
    () => maybeLikePost(page),
    () => maybeViewProfile(page),
  ];

  for (let i = actions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [actions[i], actions[j]] = [actions[j], actions[i]];
  }

  for (const act of actions) {
    await act();
  }
}

// ======= TEST =======
test('LinkedIn login with MFA and browsing (no fingerprint tricks)', async () => {
  test.setTimeout(180000);
  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
  });
  const page = await context.newPage();

  // Load session if exists
  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
    await context.addCookies(cookies);
    console.log('🔁 Session restored from file.');
  }

  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  // Login if form is visible
  if (await page.locator('input[name="session_key"]').isVisible()) {
    console.log('🔑 Logging in...');

    const email = page.locator('#username');
    const pass = page.locator('#password');
    const submit = page.locator('button[type="submit"]');

    await humanType(email, LINKEDIN_EMAIL);
    await humanIdle(1000, 3000);

    await humanType(pass, LINKEDIN_PASSWORD);
    await humanIdle(1000, 3000);

    await submit.click();

    // MFA check
    const pinInput = page.locator('input[name="pin"]').first();
    if (await pinInput.isVisible().catch(() => false)) {
      const token = speakeasy.totp({
        secret: LINKEDIN_TOTP_SECRET,
        encoding: 'base32',
      });
      await humanType(pinInput, token);
      await page.locator('#two-step-submit-button').click();
    }

    await page.waitForURL('https://www.linkedin.com/feed/', { timeout: 20000 });

    const cookies = await context.cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
    console.log('💾 Session saved.');
  } else {
    console.log('✅ Already logged in (session restored).');
  }

  // Do browsing
  await randomBrowsingSequence(page);

  await expect(page).toHaveURL(/linkedin\.com\/feed/);
  await page.pause();
});
