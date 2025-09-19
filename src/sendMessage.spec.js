/**
 * Script to log into LinkedIn stealthily and send messages to connected users.
 * Uses Playwright with human-like interactions to avoid bot detection.
 */

require("dotenv").config();
const { test, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

const STORAGE_FILE = "linkedinStealth-state.json";
const profileUrls = [
  "https://www.linkedin.com/in/lamhotsiagian/",
  "https://www.linkedin.com/in/saran-jasty-189b429a/",
  "https://www.linkedin.com/in/mahaveer-manoj-inumarthy-376a743b/",
];

// ----------------- Helpers -----------------
async function randomDelay(min = 500, max = 1500) {
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function highlightElement(page, locator, duration = 1000) {
  try {
    await locator.evaluate((el, duration) => {
      const originalBorder = el.style.border;
      el.style.border = "3px solid red";
      setTimeout(() => el.style.border = originalBorder, duration);
    }, duration);
  } catch (err) {
    console.log("⚠️ Highlight failed:", err);
  }
}

async function humanClick(page, target, description = "element") {
  const locator = typeof target === "string" ? page.locator(target) : target;
  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    const x = box.x + box.width / 2 + (Math.random() * 6 - 3);
    const y = box.y + box.height / 2 + (Math.random() * 6 - 3);
    console.log(`🖱 Moving to x:${Math.floor(x)}, y:${Math.floor(y)} to click ${description}`);
    await page.mouse.move(x, y, { steps: 8 });
    await highlightElement(page, locator);
    await page.mouse.down();
    await randomDelay(100, 200);
    await page.mouse.up();
    console.log(`✅ Clicked on ${description}`);
  } else {
    console.log(`🖱 Clicking ${description} via locator`);
    await highlightElement(page, locator);
    await locator.click();
    console.log(`✅ Clicked on ${description}`);
  }
}

async function humanType(page, selector, text) {
  const el = page.locator(selector);
  await el.click({ delay: 200 });
  await highlightElement(page, el, 1500);
  console.log(`✏️ Typing in ${selector}: "${text}"`);
  for (const ch of text) {
    await el.type(ch, { delay: Math.floor(Math.random() * 200) + 80 });
    if (Math.random() < 0.2) await randomDelay(200, 500);
  }
}

async function addStealth(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });
}

async function closeAllMessageBoxes(page) {
  const closeButtons = page.locator(".msg-overlay-bubble-header__controls.display-flex.align-items-center button, button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text('Close your conversation with')").last();
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = closeButtons.nth(i);
    if (await btn.isVisible().catch(() => false)) {
      await randomDelay(300, 800);
      await humanClick(page, btn, `Close message box #${i + 1}`);
    }
  }
}

// ----------------- Connection Status -----------------
async function getConnectionStatus(page) {
  console.log("🔍 Checking connection via More menu");

  const moreBtn = page.locator('.ph5 button[aria-label="More actions"]');
  if (await moreBtn.count() === 0 || !(await moreBtn.isVisible().catch(() => false))) {
    console.log("⚠️ More button not found → Cannot check connection");
    return "not_connected";
  }

  await humanClick(page, moreBtn.first(), "More Menu");
  await page.waitForSelector(".artdeco-dropdown__content, .artdeco-dropdown__content-inner", { timeout: 5000 }).catch(() => null);
  await randomDelay(500, 1000);

  const removeConnDropdown = page.locator('.ph5 .artdeco-dropdown__content span:has-text("Remove Connection")');
  if (await removeConnDropdown.isVisible().catch(() => false)) {
    console.log("✅ Remove Connection visible → Connected");
    await page.keyboard.press("Escape");
    return "connected";
  }

  console.log("❌ Remove Connection not found → Not connected");
  await page.keyboard.press("Escape");
  return "not_connected";
}

// ----------------- Message Logic -----------------
// async function sendMessageIfConnected(page) {
//   const status = await getConnectionStatus(page);

//   if (status === "connected") {
//     console.log("✅ User is connected — preparing to send message");
//     await closeAllMessageBoxes(page);

//     const messageBtn = page.locator(".ph5 button:has-text('Message')");
//     if (await messageBtn.count() > 0 && await messageBtn.isVisible().catch(() => false)) {
//       await humanClick(page, messageBtn.first(), "Message Button");

//       const name = (await page.locator("h1").textContent().catch(() => "there")).trim() || "there";
//       const msgBox = page.locator("div.msg-form__contenteditable");
//       if (await msgBox.isVisible().catch(() => false)) {
//         await msgBox.fill("");
//         await humanType(page, "div.msg-form__contenteditable", `Hi ${name}, nice to connect with you! 😊`);

//         const sendBtn = page.locator("button.msg-form__send-button");
//         await humanClick(page, sendBtn, "Send Button");

//         console.log(`📨 Message sent to ${name}!`);
//         await randomDelay(1000, 1500);
//         await closeAllMessageBoxes(page);
//       }
//     } else {
//       console.log("❌ Message button not found — cannot send message");
//     }
//   } else {
//     console.log("⚠️ User is not connected → Skipping message");
//   }
// }

async function sendMessageIfConnected(page) {
  const status = await getConnectionStatus(page);

  if (status === "connected") {
    console.log("✅ User is connected — preparing to send message");
    await closeAllMessageBoxes(page);

    const messageBtn = page.locator(".ph5 button:has-text('Message')");
    if (await messageBtn.count() > 0 && await messageBtn.isVisible().catch(() => false)) {
      await humanClick(page, messageBtn.first(), "Message Button");

      // Wait for the message box to appear
      const msgBox = page.locator("div.msg-form__contenteditable");
      await page.waitForTimeout(2000); // give it some time to appear
      if (await msgBox.count() === 0) {
        console.log("❌ Message box not found");
        return;
      }

      if (await msgBox.isVisible().catch(() => false)) {
        const name = (await page.locator("h1").textContent().catch(() => "there")).trim() || "there";
        console.log(`✏️ Message box is ready. Preparing to type message to ${name}`);
        
        // Ensure the message box is focused
        await msgBox.click({ delay: 200 });
        await randomDelay(300, 700);
        
        // Clear existing content if any
        await msgBox.fill("");
        await randomDelay(500, 1000);

        // Type the message
        await humanType(page, "div.msg-form__contenteditable", `Hi ${name}, nice to connect with you! 😊`);

        // Wait a bit before sending
        await randomDelay(500, 1000);
        
        const sendBtn = page.locator("button.msg-form__send-button");
        if (await sendBtn.isVisible().catch(() => false)) {
          await humanClick(page, sendBtn, "Send Button");
          console.log(`📨 Message sent to ${name}!`);
        } else {
          console.log("❌ Send button not found");
        }

        await randomDelay(1000, 1500);
        await closeAllMessageBoxes(page);
      } else {
        console.log("❌ Message box is not visible after waiting");
      }
    } else {
      console.log("❌ Message button not found — cannot send message");
    }
  } else {
    console.log("⚠️ User is not connected → Skipping message");
  }
}


// ----------------- Main Test -----------------
test("LinkedIn stealth login + send message if connected", async () => {
  test.setTimeout(300000);
  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(STORAGE_FILE) ? STORAGE_FILE : undefined,
    locale: "en-US",
    timezoneId: "Asia/Kolkata"
  });
  const page = await context.newPage();
  await addStealth(page);

  if (!fs.existsSync(STORAGE_FILE)) {
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
    console.log("🔑 Logging in...");
    await humanType(page, "#username", LINKEDIN_EMAIL);
    await humanType(page, "#password", LINKEDIN_PASSWORD);
    await page.click('button[type="submit"]');

    const authLink = page.locator('a:has-text("Verify using authenticator app")');
    if (await authLink.isVisible().catch(() => false)) await humanClick(page, authLink, "Authenticator App Link");

    const totpInput = page.locator('input[name="pin"][maxlength="6"]');
    if (await totpInput.isVisible().catch(() => false)) {
      const token = speakeasy.totp({ secret: LINKEDIN_TOTP_SECRET, encoding: "base32" });
      await humanType(page, 'input[name="pin"][maxlength="6"]', token);
      await humanClick(page, "#two-step-submit-button", "Submit 2FA");
    }

    await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 });
    await context.storageState({ path: STORAGE_FILE });
    console.log("✅ Login successful & session saved");
  } else {
    console.log("✅ Session restored from previous login.");
  }

  for (const url of profileUrls) {
    console.log(`\n🔎 Visiting ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await randomDelay(4000, 6000);
    await sendMessageIfConnected(page);
    await randomDelay(2000, 4000);
  }

  console.log("🏁 All profiles processed.");
  await browser.close();
});
