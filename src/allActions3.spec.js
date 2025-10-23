require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Configuration
const STORAGE_FILE =
  process.env.STORAGE_FILE || "linkedinStealth-state-Praneeth.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days
const PROFILE_URLS = (process.env.PROFILE_URLS || "")
  .split(",")
  .map((url) => url.replace(/"/g, "").trim())
  .filter((url) => url);
const ACTION = process.env.ACTION || "view_feed"; // Default action

/* ---------------------------
    Human-like Interaction Helpers
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
    Close All Message Boxes Helper
--------------------------- */

async function closeAllMessageBoxes(page) {
  console.log("🗑️ Closing all open message boxes...");
  const closeButtons = page
    .locator(
      ".msg-overlay-bubble-header__controls.display-flex.align-items-center button"
    )
    .last();
  const altCloseButtons = page.locator(
    "button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text('Close your conversation with')"
  );
  const allButtons = closeButtons.or(altCloseButtons);
  const buttons = await allButtons.all();
  for (const button of buttons) {
    try {
      await button.scrollIntoViewIfNeeded();
      await humanMouse(page, 1);
      await button.click({ delay: 100 });
      console.log("✅ Closed a message box");
      await randomDelay(500, 1000);
    } catch (err) {
      console.log("⚠️ Failed to close a message box:", err.message);
    }
  }
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
   Action Functions
--------------------------- */

/* ---------------------------
   View Feed Action
--------------------------- */
async function viewFeed(page) {
  console.log("📺 Starting to view LinkedIn feed...");
  try {
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log("✅ Navigated to LinkedIn feed");
    const feedSelectors = [".scaffold-layout__content", ".feed-container"];
    let feedLoaded = false;
    for (const selector of feedSelectors) {
      if (
        await page
          .locator(selector)
          .isVisible({ timeout: 10000 })
          .catch(() => false)
      ) {
        console.log(`✅ Feed content loaded using selector: ${selector}`);
        feedLoaded = true;
        break;
      }
    }
    if (!feedLoaded)
      console.log("⚠️ Feed content not found, continuing with scrolling...");
    for (let session = 1; session <= 3; session++) {
      console.log(
        `🔄 Feed viewing session ${session}/3 - Scrolling and pausing...`
      );
      await humanScroll(page, Math.floor(Math.random() * 5) + 3);
      const pauseTime = Math.random() * 10000 + 5000;
      console.log(`⏸️ Pausing for ${Math.round(pauseTime / 1000)} seconds...`);
      await page.waitForTimeout(pauseTime);
      if (Math.random() > 0.5) {
        console.log("🖱️ Simulating mouse movement...");
        await humanMouse(page, 2);
      }
    }
    await humanIdle(3000, 8000);
    console.log("✅ Finished viewing feed");
  } catch (err) {
    console.error("❌ Failed to view feed:", err.message);
  }
}
/* ---------------------------
    Like Feed Action
--------------------------- */

async function likeFeed(page) {
  console.log("📝 Starting to like a random post...");
  try {
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await humanScroll(page, 5);
    await humanIdle(2000, 4000);
    const likeButtons = await page
      .locator(".reactions-react-button button[aria-label*='Like']")
      .all();
    if (likeButtons.length === 0) {
      console.log("⚠️ No Like buttons found on the feed");
      return;
    }
    const unreactedButtons = [];
    for (const button of likeButtons) {
      const isReacted = await button
        .evaluate((el) => el.getAttribute("aria-label").includes("Unlike"), {
          timeout: 5000,
        })
        .catch(() => false);
      if (!isReacted) unreactedButtons.push(button);
    }
    if (unreactedButtons.length === 0) {
      console.log("⚠️ All visible posts are already reacted to");
      return;
    }
    const randomIndex = Math.floor(Math.random() * unreactedButtons.length);
    const selectedButton = unreactedButtons[randomIndex];
    console.log(
      `🎯 Selected random unreacted post ${randomIndex + 1} of ${
        unreactedButtons.length
      }`
    );
    await humanMouse(page, 2);
    await selectedButton.scrollIntoViewIfNeeded();
    await selectedButton.click({ delay: 100 });
    console.log("👍 Liked the post");
    await randomDelay(1000, 2000);
    console.log("✅ Finished liking the post");
    await humanIdle(3000, 6000);
  } catch (err) {
    console.error("❌ Failed to like post:", err.message);
  }
}

/* ---------------------------
   Check Degree Action
--------------------------- */

async function checkDegree(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await humanScroll(page, 4);
    let name = "Unknown User";
    const nameLocators = [
      { selector: "h1", description: "h1 tag" },
      {
        selector: ".text-heading-xlarge",
        description: "text-heading-xlarge class",
      },
    ];
    for (const { selector, description } of nameLocators) {
      try {
        name =
          (await page.locator(selector).innerText({ timeout: 5000 })) ||
          "Unknown User";
        break;
      } catch (err) {
        console.log(`⚠️ Name locator ${description} failed: ${err.message}`);
      }
    }
    let degreeText = null;
    const degreeLocators = [
      // New selectors first for faster, reliable detection
      {
        selector:
          'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child',
        description: "degree last p",
      },
      {
        selector:
          'div[data-view-name="profile-top-card-verified-badge"] + p + p',
        description: "verified badge + p + p",
      },
      {
        selector: 'div[data-view-name="profile-top-card-verified-badge"]',
        description: "verified badge container",
      },
      // Legacy fallbacks (will timeout silently if irrelevant)
      {
        selector: ".distance-badge .visually-hidden",
        description: "degree badge hidden text",
      },
      {
        selector: ".distance-badge .dist-value",
        description: "degree badge visible value",
      },
    ];
    for (const { selector, description } of degreeLocators) {
      try {
        degreeText = await page
          .locator(selector)
          .textContent({ timeout: 5000 });
        if (degreeText) break;
      } catch (err) {
        console.log(`⚠️ Degree locator ${description} failed: ${err.message}`);
      }
    }
    let degree = "Unknown";
    if (degreeText) {
      const lowerInfo = degreeText.toLowerCase().trim();
      // Improved matching: Look for "· 1st/2nd/3rd" pattern common in LinkedIn
      if (lowerInfo.includes("· 2nd") || lowerInfo.includes("2nd")) {
        degree = "2nd";
      } else if (lowerInfo.includes("· 3rd") || lowerInfo.includes("3rd")) {
        degree = "3rd+";
      } else if (lowerInfo.includes("· 1st") || lowerInfo.includes("1st")) {
        degree = "1st";
      } else if (lowerInfo.includes("out of network")) {
        degree = "Out of Network";
      }
    }
    console.log(`Profile Details for ${url}: Name: ${name}, Degree: ${degree}`);
  } catch (err) {
    console.error(`❌ Error processing ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Send Message Action
--------------------------- */

async function sendMessage(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await closeAllMessageBoxes(page);
    let profileName = "Friend";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      // For Structure 1
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      // For Structure 2
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page
          .locator(selector)
          .textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(`Found profile name with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Name selector failed: ${err.message}`);
      }
    }
    let is1stDegree = false;
    const degreeLocators = [
      // Legacy fallbacks first for faster, reliable detection (if still present)
      {
        selector: ".distance-badge .visually-hidden",
        description: "degree badge hidden text",
      },
      {
        selector: ".distance-badge .dist-value",
        description: "degree badge visible value",
      },
      // New selectors (will timeout silently if irrelevant)
      {
        selector:
          'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child',
        description: "degree last p",
      },
      {
        selector: '[data-view-name="profile-top-card-verified-badge"] + p',
        description: "verified badge adjacent p",
      },
      {
        selector:
          'div[data-view-name="profile-top-card-verified-badge"] ~ p:nth-of-type(2)',
        description: "verified badge sibling second p",
      },
    ];
    for (const { selector, description } of degreeLocators) {
      try {
        const connectionInfo = await page
          .locator(selector)
          .textContent({ timeout: 5000 });
        if (connectionInfo && connectionInfo.toLowerCase().includes("1st")) {
          is1stDegree = true;
          break;
        }
      } catch (err) {
        console.log(`⚠️ Skipping ${description}: ${err.message}`);
      }
    }
    if (!is1stDegree) {
      console.log(
        `⛔ Skipping message to ${url} - Not a 1st degree connection`
      );
      return;
    }
    const messageButtonLocators = [
      {
        selector: "div.ph5 button:has-text('Message')",
        description: "old message button",
      },
      {
        selector: 'a[data-view-name="profile-primary-message"]',
        description: "primary message last",
      },
      {
        selector: 'a[data-view-name="profile-secondary-message"]',
        description: "secondary message last",
      },
    ];
    let messageButton = null;
    for (const { selector, description } of messageButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        messageButton = btn;
        console.log(`Found message button with ${description}`);
        break;
      } catch (err) {
        console.log(`⚠️ ${description} not found: ${err.message}`);
      }
    }
    if (!messageButton) {
      console.log("❌ No message button found");
      return;
    }
    await humanMouse(page, 2);
    await messageButton.click({ delay: 100 });
    console.log("💬 Message box opened");
    await randomDelay(1000, 2000);
    const message = `Hi ${profileName}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    const messageInput = page.locator("div.msg-form__contenteditable");
    await messageInput.waitFor({ state: "visible", timeout: 10000 });
    await humanType(page, "div.msg-form__contenteditable", message);
    console.log("📝 Message typed");
    const sendButton = page.locator("button.msg-form__send-button");
    await sendButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await sendButton.click({ delay: 100 });
    console.log(`✅ Message sent to ${profileName}`);
    await randomDelay(2000, 4000);
    await closeAllMessageBoxes(page);
    console.log(`✅ Finished sending message to ${url}`);
  } catch (err) {
    console.error(`❌ Failed to send message to ${url}: ${err.message}`);
  }
}

/* --------------------------------
   Check Connection Accepted Action
------------------------------------ */

async function checkConnectionAccepted(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);
    let profileName = "Unknown";
    try {
      profileName =
        (await page
          .locator("h1")
          .textContent({ timeout: 5000 })
          .then((text) => text.trim())) || "Unknown";
    } catch (err) {
      console.log(`⚠️ Profile name not found: ${err.message}`);
    }
    let degree = "Unknown degree";
    try {
      degree =
        (await page
          .locator(".distance-badge .visually-hidden")
          .textContent({ timeout: 5000 })
          .then((text) => text.trim().toLowerCase())) ||
        (await page
          .locator(".distance-badge .dist-value")
          .textContent({ timeout: 5000 })
          .then((text) => text.trim().toLowerCase())) ||
        "Unknown degree";
    } catch (err) {
      console.log(`⚠️ Degree not found: ${err.message}`);
    }
    let status = "Unknown";
    if (degree.includes("1st")) {
      status = "Accepted";
      console.log(`✅ ${profileName}: ${degree} - ${status}`);
    } else {
      const acceptButton = page.locator(".ph5 [aria-label*='Accept']").first();
      const pendingButton = page
        .locator(
          ".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')"
        )
        .first();
      const connectButton = page
        .locator(".ph5 button:has-text('Connect')")
        .first();
      if (await acceptButton.isVisible({ timeout: 5000 })) {
        status = "Accepted";
        console.log(`✅ ${profileName}: ${degree} - ${status} (Accept button)`);
      } else if (await pendingButton.isVisible({ timeout: 5000 })) {
        status = "Sent but Not Accepted (Pending)";
        console.log(`⏳ ${profileName}: ${degree} - ${status}`);
      } else if (await connectButton.isVisible({ timeout: 5000 })) {
        status = "Not Sent Yet";
        console.log(
          `⛔ ${profileName}: ${degree} - ${status} (Connect button)`
        );
      } else {
        const moreButton = page
          .locator(
            ".ph5 button:has-text('More'), .ph5 [aria-label='More actions']"
          )
          .first();
        if (await moreButton.isVisible({ timeout: 5000 })) {
          await moreButton.click({ delay: 100 });
          await randomDelay(1000, 2000);
          const removeConnection = page
            .locator(
              ".artdeco-dropdown__content span:has-text('Remove Connection')"
            )
            .last();
          const withdrawOption = page
            .locator(".artdeco-dropdown__content span:has-text('Withdraw')")
            .first();
          if (await removeConnection.isVisible({ timeout: 5000 })) {
            status = "Accepted";
            console.log(
              `✅ ${profileName}: ${degree} - ${status} (Remove Connection)`
            );
          } else if (await withdrawOption.isVisible({ timeout: 5000 })) {
            status = "Sent but Not Accepted (Withdraw)";
            console.log(`⏳ ${profileName}: ${degree} - ${status}`);
          } else {
            status = "Unknown";
            console.log(`❓ ${profileName}: ${degree} - ${status}`);
          }
          await moreButton.click({ delay: 100 });
        } else {
          status = "Unknown";
          console.log(
            `❓ ${profileName}: ${degree} - ${status} (No More button)`
          );
        }
      }
    }
    console.log(`✅ Done with ${url}`);
  } catch (err) {
    console.error(`❌ Error checking status for ${url}: ${err.message}`);
  }
}

/* ---------------------------
    Check Reply Action
--------------------------- */

async function checkReply(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(4000, 6000); // Increased delay for page stability
    const closeButton = page.locator("button:has-text('Close your conversation')").first();
    const altClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
    if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeButton.click();
    }
    let profileName = "Unknown";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      // For Structure 1
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      // For Structure 2
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page.locator(selector).textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(`👤 Found profile name: "${profileName}" (via ${selector})`);
          break;
        }
      } catch {
        // silent fail, try next
      }
    }
    let replyStatus = "No Reply Received";
    const messageButtonLocators = [
      {
        selector: "div.ph5 button:has-text('Message')",
        description: "old message button",
      },
      {
        selector: 'a[data-view-name="profile-primary-message"]',
        description: "primary message last",
      },
      {
        selector: 'a[data-view-name="profile-secondary-message"]',
        description: "secondary message last",
      },
    ];
    let messageButton = null;
    for (const { selector, description } of messageButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        messageButton = btn;
        console.log(`✅ Found message button (${description})`);
        break;
      } catch {
        // try next
      }
    }
    if (messageButton) {
      console.log(`✅ Message button found for ${profileName}`);
      await messageButton.click();
      await randomDelay(4000, 7000);

      // Check for all reply messages
      const replyElements = await page.locator(".msg-s-event-listitem--other").all();
      if (replyElements.length > 0) {
        replyStatus = "Reply Received";
        console.log(`Sender: ${profileName}`);
        console.log(`  - Reply Status: ${replyStatus}`);

        // Get sender and timestamp from the first reply element as a fallback
        const firstReply = replyElements[0];
        let senderName = await firstReply.locator(".msg-s-message-group__name").textContent({ timeout: 5000 }).catch(() => profileName);
        let timestamp = await firstReply.locator(".msg-s-message-group__timestamp").textContent({ timeout: 5000 }).catch(() => "Unknown Time");

        for (let i = 0; i < replyElements.length; i++) {
          const replyElement = replyElements[i];
          const messageText = await replyElement.locator(".msg-s-event-listitem__body").textContent({ timeout: 5000 }).catch(() => "Unable to retrieve message");
          console.log(
            `- Message ${i + 1}: From ${senderName.trim().replace(/\s+/g, " ")} at ${timestamp.trim().replace(/\s+/g, " ")} - "${messageText.trim() || "No readable message content"}"`
          );
        }
      } else {
        console.log(`Sender: ${profileName}`);
        console.log(`  - Reply Status: ${replyStatus} (No reply elements found)`);
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
      console.log(`⚠️ Message button not found for ${profileName} after 10 seconds`);
      console.log(`Sender: ${profileName}`);
      console.log(`  - Reply Status: No Reply Received (No Message Button)`);
    }
    console.log(`✅ Done with ${url}`);
  } catch (err) {
    console.error(`❌ Error checking messages for ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Send Follow Action
--------------------------- */

async function sendFollow(page, url) {
  console.log(`🌐 Visiting: ${url} to follow 3rd degree connection`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);

    // Step 1️⃣ — Extract Profile Name (Robust locators from sendMessageToProfile)
    let profileName = "Unknown";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page
          .locator(selector)
          .textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(
            `👤 Found profile name: "${profileName}" (via ${selector})`
          );
          break;
        }
      } catch {
        // silent fail, try next
      }
    }

    // Step 2️⃣ — Detect Degree (Updated with robust locators)
    let degree = "Unknown";
    const degreeLocators = [
      { selector: 'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child', description: "degree last p" },
      { selector: 'div[data-view-name="profile-top-card-verified-badge"] + p', description: "verified badge + p" },
      { selector: 'div[data-view-name="profile-top-card-verified-badge"] + p + p', description: "verified badge + p + p" },
      { selector: 'div[data-view-name="profile-top-card-verified-badge"]', description: "verified badge container" },
      { selector: ".distance-badge .visually-hidden", description: "degree badge hidden text" },
      { selector: ".distance-badge .dist-value", description: "degree badge visible value" }
    ];
    for (const { selector, description } of degreeLocators) {
      try {
        const connectionInfo = await page.locator(selector).textContent({ timeout: 5000 });
        if (connectionInfo) {
          const lowerInfo = connectionInfo.toLowerCase().trim();
          // Improved matching: Look for "· 1st/2nd/3rd" pattern common in LinkedIn
          if (lowerInfo.includes("· 2nd") || lowerInfo.includes("2nd")) {
            degree = "2nd";
            break;
          } else if (lowerInfo.includes("· 3rd") || lowerInfo.includes("3rd")) {
            degree = "3rd";
            break;
          } else if (lowerInfo.includes("· 1st") || lowerInfo.includes("1st")) {
            degree = "1st";
            break;
          }
        }
      } catch (err) {
        if (!err.message.includes('Timeout')) {
          console.log(`⚠️ Skipping ${description}: ${err.message}`);
        }
      }
    }
    console.log(`📊 Detected degree: ${degree}`);

    if (degree === "3rd") {
      // Step 3️⃣ — Locate Follow Button (Robust array like message buttons)
      const followButtonLocators = [
        {
          selector: ".ph5.pb5 [aria-label*='Follow']",
          description: "header follow button primary / secondary",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "primary-message adjacent relationship follow aria",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
          description: "primary-message adjacent edge-creation follow icon",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
          description: "primary-message adjacent relationship follow text",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-primary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "topcard with primary-message relationship follow aria",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "topcard with secondary-message relationship follow aria",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
          description: "topcard with secondary-message edge-creation follow icon",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
          description: "topcard with secondary-message relationship follow text",
        },
      ];

      let followButton = null;
      for (const { selector, description } of followButtonLocators) {
        try {
          const btn = page.locator(selector).last();
          await btn.waitFor({ state: "visible", timeout: 3000 });
          followButton = btn;
          console.log(`✅ Found follow button (${description})`);
          break;
        } catch {
          // try next
        }
      }

      if (followButton) {
        // Step 4️⃣ — Click Follow Button
        await humanMouse(page, 2);
        await followButton.click({ delay: 100 });
        console.log(`✅ Followed ${profileName} via direct button`);
      } else {
        // Step 5️⃣ — Fallback: More Actions Path (Robust locators)
        const moreButtonLocators = [
          {
            selector: ".ph5 [aria-label='More actions']",
            description: "more actions aria",
          },
          {
            selector: 'button[data-view-name="profile-overflow-button"][aria-label="More"]',
            description: "overflow more button",
          },
          {
            selector: ".ph5.pb5 button:has-text('More')",
            description: "more text button",
          },
        ];

        let moreButton = null;
        for (const { selector, description } of moreButtonLocators) {
          try {
            const btn = page.locator(selector).last();
            await btn.waitFor({ state: "visible", timeout: 3000 });
            moreButton = btn;
            console.log(`✅ Found more button (${description})`);
            break;
          } catch {
            // try next
          }
        }

        if (moreButton) {
          await humanMouse(page, 2);
          await moreButton.click({ delay: 100 });
          console.log("💡 More button clicked");
          await randomDelay(1000, 2000);

          // Step 6️⃣ — Locate Dropdown Follow (Robust array)
          const dropdownFollowLocators = [
            {
              selector: ".ph5.pb5 .artdeco-dropdown__content-inner [aria-label*='Follow']",
              description: "dropdown aria follow",
            },
            {
              selector: ".artdeco-dropdown__content-inner span:has-text('Follow')",
              description: "dropdown text follow",
            },
            {
              selector: ".artdeco-dropdown__content a[aria-label*='Follow']",
              description: "dropdown link follow",
            },
            {
              selector: "div[aria-label*='Follow']",
              description: "dropdown area follow",
            },
          ];

          let dropdownFollow = null;
          for (const { selector, description } of dropdownFollowLocators) {
            try {
              const btn = page.locator(selector).last();
              await btn.waitFor({ state: "visible", timeout: 3000 });
              dropdownFollow = btn;
              console.log(`✅ Found dropdown follow (${description})`);
              break;
            } catch {
              // try next
            }
          }

          if (dropdownFollow) {
            await humanMouse(page, 1);
            await dropdownFollow.click({ delay: 100 });
            console.log(`✅ Followed ${profileName} via More actions dropdown`);
          } else {
            console.log(`⚠️ Follow option not found in dropdown for ${profileName}`);
          }
        } else {
          console.log(`⚠️ No More actions button found for ${profileName}`);
        }
      }
    } else {
      console.log(`⏭️ Skipping ${profileName} - Not a 3rd degree connection (Degree: ${degree})`);
      
    }
    await randomDelay(1000, 2000);
    console.log(`✅ Done with ${url}`);
    console.log(`----------------------------`);
  } catch (err) {
    console.error(`❌ Error following ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Send Follow Any Action
--------------------------- */

async function sendFollowAny(page, url) {
  console.log(`🌐 Visiting: ${url} to follow (any degree)`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);

    // Step 1️⃣ — Extract Profile Name (Robust locators from sendFollow)
    let profileName = "Unknown";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page
          .locator(selector)
          .textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(
            `👤 Found profile name: "${profileName}" (via ${selector})`
          );
          break;
        }
      } catch {
        // silent fail, try next
      }
    }

    // Step 2️⃣ — Check if Already Following (Header-specific locators to avoid footer/dropdown matches)
    const followingButtonLocators = [
      {
        selector: 'div[data-view-name="edge-creation-follow-action"] button[aria-label*="Following, click to unfollow"]',
        description: "header edge-creation following button",
      },
      {
        selector: 'div[data-view-name="relationship-building-button"] button[aria-label*="Following, click to unfollow"]',
        description: "relationship-building header following button",
      },
      {
        selector: ".ph5 button[aria-label*='Following']",
        description: "ph5 header following button (scoped to button)",
      },
    ];

    let isAlreadyFollowing = false;
    for (const { selector, description } of followingButtonLocators) {
      try {
        const btn = page.locator(selector).nth(2); // Use .last() for selectors matching multiple elements
        await btn.waitFor({ state: "visible", timeout: 3000 });
        isAlreadyFollowing = true;
        console.log(`⏭️ Skipping ${profileName} - Already following (detected via ${description})`);
        break;
      } catch {
        // try next
      }
    }

    // Optional: If needed, check dropdown for following (requires opening More first)
    if (!isAlreadyFollowing) {
      // Temporarily open More to check dropdown following option
      const moreButtonLocatorsTemp = [
        {
          selector: ".ph5 [aria-label='More actions']",
          description: "more actions aria",
        },
        {
          selector: 'button[data-view-name="profile-overflow-button"][aria-label="More"]',
          description: "overflow more button",
        },
        {
          selector: ".ph5.pb5 button:has-text('More')",
          description: "more text button",
        },
      ];

      let moreButtonTemp = null;
      for (const { selector, description } of moreButtonLocatorsTemp) {
        try {
          const btn = page.locator(selector).last();
          await btn.waitFor({ state: "visible", timeout: 3000 });
          moreButtonTemp = btn;
          console.log(`🔍 Temporarily opening more button (${description}) to check dropdown`);
          break;
        } catch {
          // try next
        }
      }

      if (moreButtonTemp) {
        await humanMouse(page, 2);
        await moreButtonTemp.click({ delay: 100 });
        await randomDelay(1000, 2000);

        const dropdownFollowingLocators = [
          {
            selector: ".artdeco-dropdown__content div[aria-label*='Unfollow']",
            description: "dropdown unfollow div aria-label",
          },
          {
            selector: `div[role="menu"] div[aria-label*="Following, click to unfollow"]`,
            description: "global following aria-label in dropdown",
          },
        ];

        let dropdownFollowing = null;
        for (const { selector, description } of dropdownFollowingLocators) {
          try {
            const elem = page.locator(selector).last(); // Use .last() for selectors matching multiple elements
            await elem.waitFor({ state: "visible", timeout: 2000 });
            dropdownFollowing = elem;
            console.log(`⏭️ Skipping ${profileName} - Already following in dropdown (detected via ${description})`);
            isAlreadyFollowing = true;
            break;
          } catch {
            // try next
          }
        }

        // Close dropdown
        await moreButtonTemp.click({ delay: 100 });
        await randomDelay(500, 1000);
      }
    }

    if (!isAlreadyFollowing) {
      // Step 3️⃣ — Locate Follow Button (Robust array like sendFollow)
      const followButtonLocators = [
        {
          selector: ".ph5.pb5 [aria-label*='Follow']",
          description: "header follow button primary / secondary",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "primary-message adjacent relationship follow aria",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
          description: "primary-message adjacent edge-creation follow icon",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
          description: "primary-message adjacent relationship follow text",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-primary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "topcard with primary-message relationship follow aria",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "topcard with secondary-message relationship follow aria",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
          description: "topcard with secondary-message edge-creation follow icon",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
          description: "topcard with secondary-message relationship follow text",
        },
      ];

      let followButton = null;
      for (const { selector, description } of followButtonLocators) {
        try {
          const btn = page.locator(selector).last();
          await btn.waitFor({ state: "visible", timeout: 3000 });
          followButton = btn;
          console.log(`✅ Found follow button (${description})`);
          break;
        } catch {
          // try next
        }
      }

      if (followButton) {
        // Step 4️⃣ — Click Follow Button
        await humanMouse(page, 2);
        await followButton.click({ delay: 100 });
        console.log(`✅ Followed ${profileName} via direct button`);
      } else {
        // Step 5️⃣ — Fallback: More Actions Path (Robust locators)
        const moreButtonLocators = [
          {
            selector: ".ph5 [aria-label='More actions']",
            description: "more actions aria",
          },
          {
            selector: 'button[data-view-name="profile-overflow-button"][aria-label="More"]',
            description: "overflow more button",
          },
          {
            selector: ".ph5.pb5 button:has-text('More')",
            description: "more text button",
          },
        ];

        let moreButton = null;
        for (const { selector, description } of moreButtonLocators) {
          try {
            const btn = page.locator(selector).last();
            await btn.waitFor({ state: "visible", timeout: 3000 });
            moreButton = btn;
            console.log(`✅ Found more button (${description})`);
            break;
          } catch {
            // try next
          }
        }

        if (moreButton) {
          await humanMouse(page, 2);
          await moreButton.click({ delay: 100 });
          console.log("💡 More button clicked");
          await randomDelay(1000, 2000);

          // Step 6️⃣ — Locate Dropdown Follow (Robust array)
          const dropdownFollowLocators = [
            {
              selector: ".ph5.pb5 .artdeco-dropdown__content-inner [aria-label*='Follow']",
              description: "dropdown aria follow",
            },
            {
              selector: ".artdeco-dropdown__content-inner span:has-text('Follow')",
              description: "dropdown text follow",
            },
            {
              selector: ".artdeco-dropdown__content a[aria-label*='Follow']",
              description: "dropdown link follow",
            },
            {
              selector: "div[aria-label*='Follow']",
              description: "dropdown area follow",
            },
          ];

          let dropdownFollow = null;
          for (const { selector, description } of dropdownFollowLocators) {
            try {
              const btn = page.locator(selector).last();
              await btn.waitFor({ state: "visible", timeout: 3000 });
              dropdownFollow = btn;
              console.log(`✅ Found dropdown follow (${description})`);
              break;
            } catch {
              // try next
            }
          }

          if (dropdownFollow) {
            await humanMouse(page, 1);
            await dropdownFollow.click({ delay: 100 });
            console.log(`✅ Followed ${profileName} via More actions dropdown`);
          } else {
            console.log(`⚠️ Follow option not found in dropdown for ${profileName}`);
          }

          // Close dropdown after action
          await moreButton.click({ delay: 100 });
          await randomDelay(500, 1000);
        } else {
          console.log(`⚠️ No More actions button found for ${profileName}`);
        }
      }
    }

    await randomDelay(1000, 2000);
    console.log(`✅ Done with ${url}`);
    console.log(`----------------------------`);
  } catch (err) {
    console.error(`❌ Error following ${url}: ${err.message}`);
  }
}

/* ---------------------------
    Withdraw Request Action
------------------------------ */

async function withdrawRequest(page, url) {
  console.log(`🌐 Visiting: ${url} to withdraw request`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);
    let profileName = "Unknown";
    try {
      profileName =
        (await page
          .locator("h1")
          .textContent({ timeout: 5000 })
          .then((text) => text.trim())) || "Unknown";
    } catch (err) {
      console.log(`⚠️ Profile name not found: ${err.message}`);
    }
    const headerWithdraw = page
      .locator(
        ".ph5 [aria-label*='Pending, click to withdraw invitation sent to']"
      )
      .first();
    if (await headerWithdraw.isVisible({ timeout: 5000 }).catch(() => false)) {
      await headerWithdraw.click();
      await randomDelay(1000, 2000);
    } else {
      const moreButton = page
        .locator(".ph5 [aria-label='More actions']")
        .first();
      if (await moreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await moreButton.click();
        await randomDelay(1000, 2000);
        const dropdownWithdraw = page
          .locator(
            ".ph5 .artdeco-dropdown__content [aria-label*='Pending, click to withdraw invitation sent to']"
          )
          .first();
        if (
          await dropdownWithdraw.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
          await dropdownWithdraw.click();
          await randomDelay(1000, 2000);
        } else {
          console.log(`⚠️ No pending/withdraw option found for ${profileName}`);
          return;
        }
      } else {
        console.log(`⚠️ No More actions button found for ${profileName}`);
        return;
      }
    }
    const withdrawButton = page
      .locator("div[role='alertdialog'] button:has-text('Withdraw')")
      .first();
    if (await withdrawButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await withdrawButton.click();
      console.log(`✅ Withdrawn request for ${profileName}`);
    } else {
      console.log(`⚠️ Withdraw button not found for ${profileName}`);
    }
    await randomDelay(1000, 2000);
    console.log(`✅ Done with ${url}`);
  } catch (err) {
    console.error(`❌ Error withdrawing request for ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Premium Status Check
--------------------------- */
async function checkPremiumStatus(page) {
  console.log("🔶 Checking LinkedIn premium status...");
  await humanIdle(1000, 2500);

  // Click on Me button
  const meBtn = page.locator(`nav button:has-text('Me')`);
  if (!(await meBtn.isVisible({ timeout: 5000 }))) {
    console.log("❌ Me button not found.");
    return false;
  }
  await meBtn.click();
  await randomDelay(500, 1200);
  await humanIdle(3000, 4000);

  // Click on Settings & Privacy
  const settings = page.locator('a:has-text("Settings & Privacy")');
  if (!(await settings.first().isVisible({ timeout: 5000 }))) {
    await page.goBack();
    console.log("❌ Settings & Privacy not found.");
    return false;
  }
  await settings.first().click();
  await page.waitForLoadState("domcontentloaded");
  await humanIdle(5000, 10000);

  // Go to Subscriptions & payments
  const subscriptions = page.locator(
    'li #premiumManageAccount, li a[href*="premium"]'
  );
  if (!(await subscriptions.first().isVisible({ timeout: 5000 }))) {
    await page.goBack({ times: 2 });
    console.log("❌ Subscriptions section not found (Not Premium).");
    return false;
  }
  await subscriptions.first().click();
  await page.waitForLoadState("domcontentloaded");
  await humanIdle(5000, 10000);

  // Check if plan details element is visible
  const planLocator = page.locator(
    ".sans-medium.t-bold.t-black.premium-subscription-overview-settings-card__header"
  );

  await humanIdle(5000, 10000);

  const isPremium = await planLocator.isVisible().catch(() => false);
  if (isPremium) {
    const plan = await planLocator.innerText().catch(() => "Unknown");
    console.log(`🔶 Premium Plan: ${plan.trim()}`);
  } else {
    console.log("❌ No premium subscription found (Not Premium).");
  }

  // Navigate back to feed
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
  });
  await humanIdle(2000, 4000);

  return isPremium;
}

/* ---------------------------
   Send Message Function (No Degree Check)
--------------------------- */

async function sendMessageToProfile(page, url) {
  console.log(`💬 Processing profile for messaging: ${url}`);

  try {
    // Step 1️⃣ — Load profile page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await closeAllMessageBoxes(page);

    // Step 2️⃣ — Extract Profile Name
    let profileName = "Friend";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];

    for (const selector of nameLocators) {
      try {
        const text = await page
          .locator(selector)
          .textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(
            `👤 Found profile name: "${profileName}" (via ${selector})`
          );
          break;
        }
      } catch {
        // silent fail, try next
      }
    }

    // Step 3️⃣ — Locate Message Button
    const messageButtonLocators = [
      {
        selector: "div.ph5 button:has-text('Message')",
        description: "old message button",
      },
      {
        selector: 'a[data-view-name="profile-primary-message"]',
        description: "primary message button",
      },
      {
        selector: 'a[data-view-name="profile-secondary-message"]',
        description: "secondary message button",
      },
    ];

    let messageButton = null;
    for (const { selector, description } of messageButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        messageButton = btn;
        console.log(`✅ Found message button (${description})`);
        break;
      } catch {
        // try next
      }
    }

    if (!messageButton) {
      console.log(`⛔ No Message button found for ${profileName} (${url})`);
      return;
    }

    // Step 4️⃣ — Open message dialog
    await humanMouse(page, 2);
    await messageButton.click({ delay: 100 });
    console.log("💬 Message box opened");
    await randomDelay(1000, 2000);

    // // Step 5️⃣ — Locate message input
    // const messageInputSelector = "div.msg-form__contenteditable";
    // const messageInput = page.locator(messageInputSelector);
    // await messageInput.waitFor({ state: "visible", timeout: 10000 });

    // // Step 6️⃣ — Type message
    // const message = `Hi ${profileName}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    // await humanType(page, messageInputSelector, message);
    // console.log("📝 Message typed");
    // Step 5️⃣ — Locate message input (and optional subject)
    const messageInputSelector = "div.msg-form__contenteditable";
    const messageInput = page.locator(messageInputSelector);
    await messageInput.waitFor({ state: "visible", timeout: 10000 });

    // 🔹 Check if "Subject (optional)" field exists
    const subjectSelector = "input[placeholder='Subject (optional)']";
    const subjectInput = page.locator(subjectSelector);

    try {
      const subjectVisible = await subjectInput.isVisible({ timeout: 2000 });
      if (subjectVisible) {
        console.log("✏️ Subject field detected — typing subject...");
        await humanType(
          page,
          subjectSelector,
          "Regarding a potential opportunity"
        );
        await randomDelay(500, 1000);
        console.log("✅ Subject typed successfully");
      } else {
        console.log("ℹ️ No subject field found — skipping subject step");
      }
    } catch {
      console.log("ℹ️ Subject field not present — continuing to message");
    }

    // Step 6️⃣ — Type message
    const message = `Hi ${profileName}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    await humanType(page, messageInputSelector, message);
    console.log("📝 Message typed");

    // Step 7️⃣ — Locate and click send button (includes all variants)
    const sendButtonLocators = [
      {
        selector: "button.msg-form__send-button",
        description: "standard send button",
      },
      {
        selector: "button.msg-form__send-btn",
        description: "circle send button (alt class)",
      },
      {
        selector: "button[type='submit']",
        description: "generic submit button fallback",
      },
      {
        selector: "button.artdeco-button--primary",
        description: "primary artdeco send button",
      },
    ];

    let sendButton = null;
    for (const { selector, description } of sendButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 5000 });
        sendButton = btn;
        console.log(`✅ Found send button (${description})`);
        break;
      } catch {
        // continue
      }
    }

    if (!sendButton) {
      console.log(`⛔ No Send button found for ${profileName} (${url})`);
      return;
    }

    await humanMouse(page, 1);
    await sendButton.click({ delay: 100 });
    console.log(`📨 Message sent to ${profileName}`);

    // Step 8️⃣ — Wrap up
    await randomDelay(2000, 4000);
    await closeAllMessageBoxes(page);
    console.log(`✅ Finished sending message to ${url}`);
  } catch (err) {
    console.error(`❌ Failed to send message to ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Helper Functions (Latest Versions - Duplicates Removed)
--------------------------- */
async function getVisibleLocator(
  page,
  selectors,
  useLast = false,
  timeout = 5000
) {
  for (const selector of selectors) {
    try {
      // Build safe selector with scoping if needed
      let safeSelector = selector;
      // Append pseudo-selector for single match if not using :has (which chains poorly)
      if (selector.includes(":has(")) {
        // For :has, we'll use .nth after locator
      } else {
        safeSelector += useLast ? ":last-of-type" : ":first-of-type";
      }
      const loc = page.locator(safeSelector);
      // Chain .nth for explicit single selection (0 = first, -1 = last)
      const singleLoc = useLast ? loc.nth(-1) : loc.nth(0);
      if (await singleLoc.isVisible({ timeout })) {
        console.log(`✅ Using selector: ${selector} (useLast: ${useLast})`);
        return singleLoc;
      }
    } catch (err) {
      console.log(`⚠️ Selector failed: ${selector} - ${err.message}`);
    }
  }
  return null;
}

/* ---------------------------
    Text Extraction Helper
--------------------------- */

async function getTextFromSelectors(page, selectors, timeout = 5000) {
  for (const selector of selectors) {
    try {
      const text = await page.locator(selector).textContent({ timeout });
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (err) {
      // Silenced non-critical timeouts for cleaner logs
      if (!err.message.includes("Timeout")) {
        console.log(`⚠️ Text selector failed: ${selector} - ${err.message}`);
      }
    }
  }
  return null;
}

/* ---------------------------
    Degree Detection Helper
--------------------------- */

async function detectDegree(page, timeout = 5000) {
  let degree = "unknown";
  const degreeSelectors = [
    // New selectors first for faster, reliable detection
    {
      selector:
        'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child',
      description: "degree last p",
    },
    {
      selector: 'div[data-view-name="profile-top-card-verified-badge"] + p',
      description: "verified badge + p + p",
    },
    {
      selector: 'div[data-view-name="profile-top-card-verified-badge"]',
      description: "verified badge container",
    },
    // Legacy fallbacks (will timeout silently if irrelevant)
    {
      selector: ".distance-badge .visually-hidden",
      description: "degree badge hidden text",
    },
    {
      selector: ".distance-badge .dist-value",
      description: "degree badge visible value",
    },
  ];
  for (const { selector, description } of degreeSelectors) {
    try {
      const connectionInfo = await page
        .locator(selector)
        .textContent({ timeout });
      if (connectionInfo) {
        const lowerInfo = connectionInfo.toLowerCase().trim();
        // Improved matching: Look for "· 1st/2nd/3rd" pattern common in LinkedIn
        if (lowerInfo.includes("· 2nd") || lowerInfo.includes("2nd")) {
          degree = "2nd";
          break;
        } else if (lowerInfo.includes("· 3rd") || lowerInfo.includes("3rd")) {
          degree = "3rd";
          break;
        } else if (lowerInfo.includes("· 1st") || lowerInfo.includes("1st")) {
          degree = "1st";
          break;
        }
      }
    } catch (err) {
      if (!err.message.includes("Timeout")) {
        console.log(`⚠️ Skipping ${description}: ${err.message}`);
      }
    }
  }
  console.log(`📊 Detected degree: ${degree}`);
  return degree;
}

/* ---------------------------
    Send Connection Request Action
--------------------------- */

async function sendConnectionRequest(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await closeAllMessageBoxes(page);
    let profileName = "";
    const nameSelectors = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
    ];
    const nameText = await getTextFromSelectors(page, nameSelectors);
    if (nameText) {
      profileName = nameText || "Friend";
      console.log(`👤 Profile name: ${profileName}`);
    } else {
      console.log(`⚠️ Failed to get profile name`);
    }
    const acceptSelectors = [
      ".ph5 [aria-label*='Accept']",
      'button[aria-label^="Accept"][aria-label*="request to connect"]',
    ];
    const acceptButton = await getVisibleLocator(page, acceptSelectors);
    if (acceptButton) {
      console.log(
        `⛔ Skipping profile ${profileName} (${url}) - Pending acceptance`
      );
      return;
    }
    const degree = await detectDegree(page);
    const pendingSelectors = [
      ".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')",
      'button[aria-label^="Pending, click to withdraw invitation"]:has(svg[id="clock-small"])',
    ];
    const pendingWithdrawButton = await getVisibleLocator(
      page,
      pendingSelectors
    );
    if (pendingWithdrawButton) {
      console.log("⚠️ Found Pending/Withdraw button, No Action needed");
      await randomDelay(1000, 2000);
      return;
    }
    // Check if connect action is possible (direct or via more) before skipping
    const connectSelectors = [
      ".ph5 button:has-text('Connect')",
      // Scoped alternatives with .last() for multi-matches
      'div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-connect-action"] a',
      'div[data-view-name="edge-creation-connect-action"] a',
    ];
    const connectButton = await getVisibleLocator(page, connectSelectors, true); // Use .last() for alternatives
    const moreSelectors = [
      ".ph5 [aria-label='More actions']",
      'div[data-view-name="relationship-building-button"] ~ button[data-view-name="profile-overflow-button"][aria-label="More"]',
      'div[data-view-name="relationship-building-button"] + a[data-view-name="profile-secondary-message"] + button[data-view-name="profile-overflow-button"]',
    ];
    const moreButton = await getVisibleLocator(page, moreSelectors);
    const connectOpportunity = connectButton || moreButton;
    if (degree === "1st") {
      console.log(
        `⛔ Skipping connection request to ${profileName} (${url}) - Already connected`
      );
      return;
    }
    if (!connectOpportunity && degree === "unknown") {
      console.log(
        `⛔ Skipping connection request to ${profileName} (${url}) - No connect opportunity`
      );
      return;
    }
    if (degree === "unknown") {
      console.log(`⚠️ Degree unknown, but connect available - proceeding`);
    }
    // Scoped send selectors for modal (avoids feed buttons) - Defined here for both paths
    const sendSelectors = [
      // Primary: Scoped to connect modal/dialog
      '[role="dialog"] button[aria-label="Send without a note"]',
      // Fallback: Text-based in modal
      'button[aria-label="Send without a note"]',
    ];
    // Proceed with connect if available
    if (connectButton) {
      await humanMouse(page, 2);
      await connectButton.click({ delay: 100 });
      console.log("💡 Connect button clicked");
      // Wait specifically for send button to appear and be visible
      try {
        await page.waitForSelector('button[aria-label="Send without a note"]', {
          state: "visible",
          timeout: 30000,
        });
        const sendButton = page
          .locator('button[aria-label="Send without a note"]')
          .first();
        await humanMouse(page, 1);
        await sendButton.click({ delay: 100 });
        console.log("✅ Connection request sent");
        await randomDelay(2000, 4000);
      } catch (e) {
        console.log("⚠️ Send button not found after modal load");
      }
      return;
    }
    // Fallback to More path
    if (moreButton) {
      await humanMouse(page, 2);
      await moreButton.click({ delay: 100 });
      console.log("💡 More button clicked");
      await randomDelay(1000, 2000);
      const dropdownSelectors = [
        ".ph5 .artdeco-dropdown__content-inner span:has-text('Connect')",
        // Scoped to avoid multi-matches, with .last()
        'a[href^="/preload/custom-invite/"]:has(svg[id="connect-small"])',
      ];
      const connectDropdown = await getVisibleLocator(
        page,
        dropdownSelectors,
        true
      ); // Use .last() for alternatives
      if (connectDropdown) {
        await humanMouse(page, 1);
        await connectDropdown.click({ delay: 100 });
        console.log("💡 Connect from dropdown clicked");
        // Wait specifically for send button to appear and be visible
        try {
          await page.waitForSelector(
            'button[aria-label="Send without a note"]',
            { state: "visible", timeout: 30000 }
          );
          const sendButton = page
            .locator('button[aria-label="Send without a note"]')
            .first();
          await humanMouse(page, 1);
          await sendButton.click({ delay: 100 });
          console.log("✅ Connection request sent");
          await randomDelay(2000, 4000);
        } catch (e) {
          console.log("⚠️ Send button not found after modal load");
        }
      }
    } else if (degree === "unknown") {
      console.log(
        `⚠️ No connect opportunity despite unknown degree - skipping`
      );
    }
    console.log(`✅ Finished processing ${profileName} (${url})`);
  } catch (err) {
    console.error(
      `❌ Failed to send connection request to ${url}: ${err.message}`
    );
  }
}

/* ------------------------------------------------------
    Navigate to Own Profile and Check Verification Status
--------------------------------------------------------- */
async function navigateToOwnProfileAndCheckStatus(page) {
  console.log("👤 Navigating to own profile and checking status...");
  try {
    // Wait for feed to load after login
    await page
      .waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 })
      .catch(() => console.log("⚠️ Feed not reached, proceeding..."));
    await humanIdle(2000, 4000);

    // Click "Me" menu button
    const meSelectors = [
      "button[aria-label='Me']",
      "button[aria-label*='Me']",
      "nav button:has-text('Me')",
    ];
    let meButton = null;
    for (const selector of meSelectors) {
      try {
        meButton = page.locator(selector).first();
        if (await meButton.isVisible({ timeout: 10000 })) {
          console.log(`✅ Found "Me" button with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ "Me" selector ${selector} failed: ${err.message}`);
      }
    }
    if (!meButton) {
      console.log("⚠️ No 'Me' button found, trying alternative...");
      // Alternative: Click on avatar
      const avatarSelectors = [
        "img.global-nav__me-photo",
        "img[alt*='Profile photo']",
      ];
      for (const selector of avatarSelectors) {
        try {
          const avatar = page.locator(selector).first();
          if (await avatar.isVisible({ timeout: 10000 })) {
            await humanMouse(page, 2);
            await avatar.click({ delay: 100 });
            console.log(`✅ Clicked avatar with selector: ${selector}`);
            meButton = avatar; // Treat as successful
            break;
          }
        } catch (err) {
          console.log(`⚠️ Avatar selector ${selector} failed: ${err.message}`);
        }
      }
    }
    if (meButton) {
      await humanMouse(page, 2);
      await meButton.click({ delay: 100 });
      console.log("✅ Opened user menu");
      await randomDelay(1000, 2000);
    } else {
      throw new Error("Failed to open user menu");
    }

    // Click "View profile" link
    const viewProfileSelectors = [
      "a:has-text('View profile')",
      "a[href*='/in/']",
    ];
    let viewProfileLink = null;
    for (const selector of viewProfileSelectors) {
      try {
        viewProfileLink = page.locator(selector).first();
        if (await viewProfileLink.isVisible({ timeout: 10000 })) {
          console.log(
            `✅ Found "View profile" link with selector: ${selector}`
          );
          break;
        }
      } catch (err) {
        console.log(
          `⚠️ "View profile" selector ${selector} failed: ${err.message}`
        );
      }
    }
    if (viewProfileLink) {
      await humanMouse(page, 1);
      await viewProfileLink.click({ delay: 100 });
      console.log("✅ Navigated to own profile");
      await randomDelay(2000, 4000);
    } else {
      throw new Error("Failed to find 'View profile' link");
    }

    // Now check verification status on own profile
    await humanIdle(2000, 4000);
    let profileName = "Unknown User";

    // Universal selectors for name that work for both structures
    // Structure 1: h1 inside a[aria-label] (legacy/older UI)
    // Structure 2: p inside div[data-view-name="profile-top-card-verified-badge"] (modern/verified UI)
    const nameLocators = [
      // For Structure 1
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      // For Structure 2
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        let nameText;
        if (
          selector.includes("a[aria-label] h1") ||
          selector.includes('a[href*="/in/"] h1')
        ) {
          nameText =
            (await page
              .locator(selector)
              .textContent({ timeout: 10000 })
              .then((text) => text.trim())) || "";
        } else if (selector === "a[aria-label]") {
          nameText =
            (await page
              .locator(selector)
              .getAttribute("aria-label", { timeout: 10000 })) || "";
        } else {
          nameText =
            (await page
              .locator(selector)
              .textContent({ timeout: 10000 })
              .then((text) => text.trim())) || "";
        }
        if (
          nameText &&
          nameText.length > 0 &&
          !nameText.includes("verifications")
        ) {
          profileName = nameText;
          console.log(
            `✅ Found name with selector: ${selector} - ${profileName}`
          );
          break;
        }
      } catch (err) {
        console.log(`⚠️ Name locator ${selector} failed: ${err.message}`);
      }
    }

    // Universal selectors for verification badge that work for both structures
    // Structure 1: svg[data-test-icon="verified-medium"]
    // Structure 2: svg[aria-label*="verifications"] or svg[id="verified-medium"]
    const verifiedSelectors = [
      'svg[data-test-icon="verified-medium"]',
      'svg[aria-label*="verifications"]',
      'div[data-view-name="profile-top-card-verified-badge"] svg',
    ];
    let isVerified = false;
    for (const selector of verifiedSelectors) {
      try {
        if (await page.locator(selector).isVisible({ timeout: 5000 })) {
          isVerified = true;
          console.log(`✅ Found verification badge with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Verified locator ${selector} failed: ${err.message}`);
      }
    }

    console.log(
      `Profile Status for own profile: Name: ${profileName}, Verified: ${
        isVerified ? "Yes" : "No"
      }`
    );
  } catch (err) {
    console.error(
      `❌ Error navigating to own profile or checking status: ${err.message}`
    );
  }
}



/* ---------------------------
   Main Test - Perform Action
------------------------------ */
test.describe("LinkedIn Multi-Action Script", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
    }
    if (!PROFILE_URLS.length) console.log("⚠️ No PROFILE_URLS provided.");

    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });
    const storageState =
      fs.existsSync(STORAGE_FILE) &&
      fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
        ? STORAGE_FILE
        : undefined;

    context = await browser.newContext({
      viewport: null,
      locale: "en-US",
      timezoneId: "Asia/Kolkata",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      storageState,
    });

    page = await context.newPage();
    await addStealth(page);

    try {
      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await humanMouse(page, 3);
      await humanIdle(800, 1800);

      if (await page.locator("#username").isVisible({ timeout: 5000 })) {
        console.log("🔐 Logging in...");
        await humanType(page, "#username", process.env.LINKEDIN_EMAIL);
        await humanIdle(600, 1600);
        await humanType(page, "#password", process.env.LINKEDIN_PASSWORD);
        await humanIdle(600, 1600);
        await page
          .locator(`label[for='rememberMeOptIn-checkbox']`)
          .click()
          .catch(() =>
            console.log("Remember Me checkbox not found, skipping.")
          );
        await humanIdle(600, 1600);
        await page.locator('button[type="submit"]').click();
        await randomDelay(1000, 2000);

        const authLink = page.locator(
          'a:has-text("Verify using authenticator app")'
        );
        if (await authLink.isVisible({ timeout: 5000 })) await authLink.click();
        const totpInput = page.locator('input[name="pin"][maxlength="6"]');
        if (await totpInput.isVisible({ timeout: 5000 })) {
          console.log("🔑 Using TOTP MFA...");
          const token = speakeasy.totp({
            secret: process.env.LINKEDIN_TOTP_SECRET,
            encoding: "base32",
          });
          await humanType(page, 'input[name="pin"][maxlength="6"]', token);
          await randomDelay(700, 1400);
          await page
            .locator('#two-step-submit-button, button[type="submit"]')
            .first()
            .click();
        }

        await page
          .waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 })
          .catch(() => console.log("⚠️ Feed not reached."));
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

  test("Perform Action", async () => {
  test.setTimeout(20 * 60 * 1000); // 20 minutes
  console.log(
    `🔍 Performing action: ${ACTION} on ${PROFILE_URLS.length} profiles...`
  );
  console.log("-------------------------------");

  const actions = {
    view_feed: viewFeed,
    like_feed: likeFeed,
    check_degree: async () => {
      for (const url of PROFILE_URLS) await checkDegree(page, url);
    },
    send_message: async () => {
      for (const url of PROFILE_URLS) await sendMessage(page, url);
    },
    send_connection_request: async () => {
      for (const url of PROFILE_URLS) await sendConnectionRequest(page, url);
    },
    check_connection_accepted: async () => {
      for (const url of PROFILE_URLS)
        await checkConnectionAccepted(page, url);
    },
    check_reply: async () => {
      for (const url of PROFILE_URLS) await checkReply(page, url);
    },
    send_follow: async () => {
      for (const url of PROFILE_URLS) await sendFollow(page, url);
    },
    send_follow_any: async () => {
      for (const url of PROFILE_URLS) await sendFollowAny(page, url);
    },
    withdraw_request: async () => {for (const url of PROFILE_URLS) await withdrawRequest(page, url);},
    check_own_verification: navigateToOwnProfileAndCheckStatus,
    send_message_premium: async () => {
      const isPremiumUser = await checkPremiumStatus(page);
      if (isPremiumUser && PROFILE_URLS.length > 0) {
        console.log(
          `💬 Premium user detected. Sending messages to ${PROFILE_URLS.length} profiles...`
        );
        for (const url of PROFILE_URLS) {
          await sendMessageToProfile(page, url);
          await humanIdle(3000, 6000); // Pause between profiles
        }
      } else if (!isPremiumUser) {
        console.log("⛔ Not a premium user. Skipping message sending.");
      } else {
        console.log("⚠️ No PROFILE_URLS provided. Skipping message sending.");
      }
    },
  };

  const actionFunc = actions[ACTION];
  if (actionFunc) await actionFunc(page);
  else
    console.log(
      `⚠️ Unknown action: ${ACTION}. Available actions: ${Object.keys(
        actions
      ).join(", ")}`
    );

  await expect(page).toHaveURL(/linkedin\.com/);
});

  // test("Perform Action", async () => {
  //   test.setTimeout(20 * 60 * 1000); // 20 minutes
  //   console.log(
  //     `🔍 Performing action: ${ACTION} on ${PROFILE_URLS.length} profiles...`
  //   );
  //   console.log("-------------------------------");

  //   const actions = {
  //     view_feed: viewFeed,
  //     like_feed: likeFeed,
  //     check_degree: async () => {
  //       for (const url of PROFILE_URLS) await checkDegree(page, url);
  //     },
  //     send_message: async () => {
  //       for (const url of PROFILE_URLS) await sendMessage(page, url);
  //     },
  //     send_connection_request: async () => {
  //       for (const url of PROFILE_URLS) await sendConnectionRequest(page, url);
  //     },
  //     check_connection_accepted: async () => {
  //       for (const url of PROFILE_URLS)
  //         await checkConnectionAccepted(page, url);
  //     },
  //     check_reply: async () => {
  //       for (const url of PROFILE_URLS) await checkReply(page, url);
  //     },
  //     send_follow: async () => {
  //       for (const url of PROFILE_URLS) await sendFollow(page, url);
  //     },
  //     withdraw_request: async () => {for (const url of PROFILE_URLS) await withdrawRequest(page, url);},
  //     check_own_verification: navigateToOwnProfileAndCheckStatus,
  //     send_message_premium: async () => {
  //       const isPremiumUser = await checkPremiumStatus(page);
  //       if (isPremiumUser && PROFILE_URLS.length > 0) {
  //         console.log(
  //           `💬 Premium user detected. Sending messages to ${PROFILE_URLS.length} profiles...`
  //         );
  //         for (const url of PROFILE_URLS) {
  //           await sendMessageToProfile(page, url);
  //           await humanIdle(3000, 6000); // Pause between profiles
  //         }
  //       } else if (!isPremiumUser) {
  //         console.log("⛔ Not a premium user. Skipping message sending.");
  //       } else {
  //         console.log("⚠️ No PROFILE_URLS provided. Skipping message sending.");
  //       }
  //     },
  //   };

  //   const actionFunc = actions[ACTION];
  //   if (actionFunc) await actionFunc(page);
  //   else
  //     console.log(
  //       `⚠️ Unknown action: ${ACTION}. Available actions: ${Object.keys(
  //         actions
  //       ).join(", ")}`
  //     );

  //   await expect(page).toHaveURL(/linkedin\.com/);
  // });
});
