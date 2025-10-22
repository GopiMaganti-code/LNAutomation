// require("dotenv").config();
// const { test, expect, chromium } = require("@playwright/test");
// const speakeasy = require("speakeasy");
// const fs = require("fs");

// // Configuration
// const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state.json";
// const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
// const PROFILE_URLS = (process.env.PROFILE_URLS || "").split(",").map(url => url.replace(/"/g, "").trim()).filter(url => url);

// /* ---------------------------
//    Human-like helpers
// --------------------------- */
// async function randomDelay(min = 1000, max = 3000) {
//   const delay = Math.floor(Math.random() * (max - min + 1)) + min;
//   await new Promise(resolve => setTimeout(resolve, delay));
// }

// /* ---------------------------
//    Stealth patches
// --------------------------- */
// async function addStealth(page) {
//   await page.addInitScript(() => {
//     Object.defineProperty(navigator, "webdriver", { get: () => false });
//     window.chrome = { runtime: {} };
//     Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
//     Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
//   });
// }

// /* ---------------------------
//    Main test - Check Message Reply Status
// --------------------------- */
// test.describe("LinkedIn Message Reply Check", () => {
//   let browser, context, page;

//   test.beforeAll(async () => {
//     if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
//       throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
//     }
//     if (!PROFILE_URLS.length) {
//       console.log("⚠️ No PROFILE_URLS provided.");
//     }

//     browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
//     const storageState = fs.existsSync(STORAGE_FILE) && fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
//       ? STORAGE_FILE
//       : undefined;

//     context = await browser.newContext({
//       viewport: null,
//       locale: "en-US",
//       timezoneId: "Asia/Kolkata",
//       userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
//       storageState,
//     });

//     page = await context.newPage();
//     await addStealth(page);

//     try {
//       await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });
//       await randomDelay(800, 1800);

//       if (await page.locator("#username").isVisible({ timeout: 5000 }).catch(() => false)) {
//         console.log("🔐 Logging in...");
//         await page.locator("#username").fill(process.env.LINKEDIN_EMAIL);
//         await randomDelay(600, 1600);
//         await page.locator("#password").fill(process.env.LINKEDIN_PASSWORD);
//         await randomDelay(600, 1600);
//         await page.locator('button[type="submit"]').click();
//         await randomDelay(1000, 2000);

//         const authLink = page.locator('a:has-text("Verify using authenticator app")');
//         if (await authLink.isVisible({ timeout: 5000 }).catch(() => false)) {
//           await authLink.click();
//           await randomDelay(800, 1500);
//         }

//         const totpInput = page.locator('input[name="pin"][maxlength="6"]');
//         if (await totpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
//           console.log("🔑 Using TOTP...");
//           const token = speakeasy.totp({ secret: process.env.LINKEDIN_TOTP_SECRET, encoding: "base32" });
//           await totpInput.fill(token);
//           await randomDelay(700, 1400);
//           await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
//         }

//         await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => console.log("⚠️ Feed not reached."));
//         await context.storageState({ path: STORAGE_FILE });
//       }
//     } catch (err) {
//       console.error("❌ Login failed:", err.message);
//       throw err;
//     }
//   });

//   test.afterAll(async () => {
//     if (browser) await browser.close();
//   });

//   test("Check Message Reply Status", async () => {
//     test.setTimeout(15 * 60 * 1000); // 15 minutes
//     console.log(`🔍 Processing ${PROFILE_URLS.length} profiles for message replies...`);
//     console.log("-------------------------------");

//     if (!PROFILE_URLS.length) {
//       console.log("⚠️ No PROFILE_URLS provided.");
//       return;
//     }

//     await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
//     await randomDelay(2000, 4000);

//     for (const url of PROFILE_URLS) {
//       console.log(`🌐 Visiting: ${url}`);
//       try {
//         await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
//         await randomDelay(1000, 3000);
//       } catch (err) {
//         console.error(`❌ Navigation failed for ${url}: ${err.message}`);
//         continue;
//       }

//       let profileName = "Unknown";
//       try {
//         profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown";
//         console.log(`🔍 Found profile name: ${profileName}`);
//       } catch (err) {
//         console.log(`⚠️ Profile name not found: ${err.message}`);
//       }

//       let replyStatus = "No Reply Received";
//       try {
//         const messageButton = page.locator(".ph5 button:has-text('Message')").first();
//         if (await messageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
//           await messageButton.click();
//           await randomDelay(4000, 7000);

//           // Check for presence of .msg-s-event-listitem--other
//           const hasReply = await page.locator(".msg-s-event-listitem--other").isVisible({ timeout: 5000 }).catch(() => false);
//           replyStatus = hasReply ? "Reply Received" : "No Reply Received";
//           console.log(`Sender: ${profileName}`);
//           console.log(`  - Reply Status: ${replyStatus}`);

//           // Close message box
//           const closeButton = page.locator("button:has-text('Close your conversation')").first();
//           const altClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
//           if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
//             await closeButton.click();
//           } else if (await altClose.isVisible({ timeout: 5000 }).catch(() => false)) {
//             await altClose.click();
//           }
//           await randomDelay(1000, 2000);
//         } else {
//           console.log(`⚠️ Message button not found for ${profileName}`);
//           console.log(`Sender: ${profileName}`);
//           console.log(`  - Reply Status: No Reply Received (No Message Button)`);
//         }
//       } catch (err) {
//         console.error(`❌ Error checking messages for ${url}: ${err.message}`);
//         console.log(`Sender: ${profileName}`);
//         console.log(`  - Reply Status: No Reply Received (Error)`);
//       }

//       console.log(`✅ Done with ${url}`);
//       console.log("-------------------------------");
//     }

//     await expect(page).toHaveURL(/linkedin\.com/);
//   });
// });







require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Configuration
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
const PROFILE_URLS = (process.env.PROFILE_URLS || "").split(",").map(url => url.replace(/"/g, "").trim()).filter(url => url);

/* ---------------------------
   Human-like helpers
--------------------------- */
async function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/* ---------------------------
   Stealth patches
--------------------------- */
async function addStealth(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });
}

/* ---------------------------
   Main test - Check Message Reply Status
--------------------------- */
test.describe("LinkedIn Message Reply Check", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
    }
    if (!PROFILE_URLS.length) {
      console.log("⚠️ No PROFILE_URLS provided.");
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
      await randomDelay(800, 1800);

      if (await page.locator("#username").isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("🔐 Logging in...");
        await page.locator("#username").fill(process.env.LINKEDIN_EMAIL);
        await randomDelay(600, 1600);
        await page.locator("#password").fill(process.env.LINKEDIN_PASSWORD);
        await randomDelay(600, 1600);
        await page.locator('button[type="submit"]').click();
        await randomDelay(1000, 2000);

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

  test("Check Message Reply Status", async () => {
    test.setTimeout(15 * 60 * 1000); // 15 minutes
    console.log(`🔍 Processing ${PROFILE_URLS.length} profiles for message replies...`);
    console.log("-------------------------------");

    if (!PROFILE_URLS.length) {
      console.log("⚠️ No PROFILE_URLS provided.");
      return;
    }

    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
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

      let profileName = "Unknown";
      try {
        profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown";
        console.log(`🔍 Found profile name: ${profileName}`);
      } catch (err) {
        console.log(`⚠️ Profile name not found: ${err.message}`);
      }

      let replyStatus = "No Reply Received";
      try {
        const messageButton = page.locator(".ph5 button:has-text('Message')").first();
        if (await messageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await messageButton.click();
          await randomDelay(4000, 7000);

          // Check for all reply messages
          const replyElements = await page.locator(".msg-s-event-listitem--other").all();
          if (replyElements.length > 0) {
            replyStatus = "Reply Received";
            console.log(`Sender: ${profileName}`);
            console.log(`  - Reply Status: ${replyStatus}`);
            for (let i = 0; i < replyElements.length; i++) {
              const replyElement = replyElements[i];
              const messageText = await replyElement.locator(".msg-s-event-listitem__body").textContent({ timeout: 5000 }).catch(() => "Unable to retrieve message");
              const senderName = await replyElement.locator(".msg-s-message-group__name").textContent({ timeout: 5000 }).catch(() => "Unknown Sender");
              const timestamp = await replyElement.locator(".msg-s-message-group__timestamp").textContent({ timeout: 5000 }).catch(() => "Unknown Time");
              //console.log(`  - Message ${i + 1}: From ${senderName} at ${timestamp} - "${messageText.trim() || "No readable message content"}"`);
              console.log(
  `- Message ${i + 1}: From ${senderName.trim().replace(/\s+/g, " ")} at ${timestamp.trim().replace(/\s+/g, " ")} - "${messageText.trim() || "No readable message content"}"`
);

            }
          } else {
            console.log(`Sender: ${profileName}`);
            console.log(`  - Reply Status: ${replyStatus}`);
          }

          // Close message box
          const closeButton = page.locator("button:has-text('Close your conversation')").first();
          const altClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
          if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await closeButton.click();
          } else if (await altClose.isVisible({ timeout: 5000 }).catch(() => false)) {
            await altClose.click();
          }
          await randomDelay(1000, 2000);
        } else {
          console.log(`⚠️ Message button not found for ${profileName}`);
          console.log(`Sender: ${profileName}`);
          console.log(`  - Reply Status: No Reply Received (No Message Button)`);
        }
      } catch (err) {
        console.error(`❌ Error checking messages for ${url}: ${err.message}`);
        console.log(`Sender: ${profileName}`);
        console.log(`  - Reply Status: No Reply Received (Error)`);
      }

      console.log(`✅ Done with ${url}`);
      console.log("-------------------------------");
    }

    await expect(page).toHaveURL(/linkedin\.com/);
  });
});