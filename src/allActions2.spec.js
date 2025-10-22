require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Configuration
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Praneeth.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
const PROFILE_URLS = (process.env.PROFILE_URLS || "").split(",").map(url => url.replace(/"/g, "").trim()).filter(url => url);
const ACTION = process.env.ACTION || "view_feed"; // Default action

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
  try { await el.click({ delay: 100 }); } catch {}
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

async function closeAllMessageBoxes(page) {
  console.log("🗑️ Closing all open message boxes...");
  const closeButtons = page.locator(".msg-overlay-bubble-header__controls.display-flex.align-items-center button").last();
  const altCloseButtons = page.locator("button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text('Close your conversation with')");
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
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });

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
async function viewFeed(page) {
  console.log("📺 Starting to view LinkedIn feed...");
  try {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("✅ Navigated to LinkedIn feed");
    const feedSelectors = [".scaffold-layout__content", ".feed-container"];
    let feedLoaded = false;
    for (const selector of feedSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 10000 }).catch(() => false)) {
        console.log(`✅ Feed content loaded using selector: ${selector}`);
        feedLoaded = true;
        break;
      }
    }
    if (!feedLoaded) console.log("⚠️ Feed content not found, continuing with scrolling...");
    for (let session = 1; session <= 3; session++) {
      console.log(`🔄 Feed viewing session ${session}/3 - Scrolling and pausing...`);
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

async function likeFeed(page) {
  console.log("📝 Starting to like a random post...");
  try {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanScroll(page, 5);
    await humanIdle(2000, 4000);
    const likeButtons = await page.locator(".reactions-react-button button[aria-label*='Like']").all();
    if (likeButtons.length === 0) {
      console.log("⚠️ No Like buttons found on the feed");
      return;
    }
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

async function checkDegree(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await humanScroll(page, 4);
    let name = "Unknown User";
    const nameLocators = [{ selector: "h1", description: "h1 tag" }, { selector: ".text-heading-xlarge", description: "text-heading-xlarge class" }];
    for (const { selector, description } of nameLocators) {
      try { name = await page.locator(selector).innerText({ timeout: 5000 }) || "Unknown User"; break; } catch (err) { console.log(`⚠️ Name locator ${description} failed: ${err.message}`); }
    }
    let degreeText = null;
    const degreeLocators = [{ selector: ".distance-badge .dist-value", description: "dist-value class" }, { selector: ".distance-badge .visually-hidden", description: "visually-hidden class" }];
    for (const { selector, description } of degreeLocators) {
      try { degreeText = await page.locator(selector).innerText({ timeout: 5000 }); if (degreeText) break; } catch (err) { console.log(`⚠️ Degree locator ${description} failed: ${err.message}`); }
    }
    let degree = "Unknown";
    if (degreeText) {
      const cleaned = degreeText.trim().replace("°", "").toLowerCase();
      if (cleaned.includes("1")) degree = "1st";
      else if (cleaned.includes("2")) degree = "2nd";
      else if (cleaned.includes("3")) degree = "3rd+";
      else if (cleaned.includes("out of network")) degree = "Out of Network";
    }
    console.log(`Profile Details for ${url}: Name: ${name}, Degree: ${degree}`);
  } catch (err) {
    console.error(`❌ Error processing ${url}: ${err.message}`);
  }
}

async function sendMessage(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await closeAllMessageBoxes(page);
    let profileName = "";
    try { profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Friend"; } catch (err) { console.log(`⚠️ Failed to get profile name: ${err.message}`); }
    let is1stDegree = false;
    const degreeLocators = [{ selector: ".distance-badge .dist-value", description: "dist-value class" }, { selector: ".distance-badge .visually-hidden", description: "visually-hidden class" }];
    for (const { selector, description } of degreeLocators) {
      try { const connectionInfo = await page.locator(selector).textContent({ timeout: 5000 }); if (connectionInfo.toLowerCase().includes("1st")) { is1stDegree = true; break; } } catch (err) { console.log(`⚠️ Skipping ${description}: ${err.message}`); }
    }
    if (!is1stDegree) {
      console.log(`⛔ Skipping message to ${url} - Not a 1st degree connection`);
      return;
    }
    const messageButton = page.locator("div.ph5 button:has-text('Message')");
    await messageButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 2);
    await messageButton.click({ delay: 100 });
    console.log("💬 Message box opened");
    await randomDelay(1000, 2000);
    const message = `Hi ${profileName || "Friend"}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    const messageInput = page.locator("div.msg-form__contenteditable");
    await messageInput.waitFor({ state: "visible", timeout: 10000 });
    await humanType(page, "div.msg-form__contenteditable", message);
    console.log("📝 Message typed");
    const sendButton = page.locator("button.msg-form__send-button");
    await sendButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await sendButton.click({ delay: 100 });
    console.log(`✅ Message sent to ${profileName || "Friend"}`);
    await randomDelay(2000, 4000);
    await closeAllMessageBoxes(page);
    console.log(`✅ Finished sending message to ${url}`);
  } catch (err) {
    console.error(`❌ Failed to send message to ${url}: ${err.message}`);
  }
}

async function checkConnectionAccepted(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);
    let profileName = "Unknown";
    try { profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown"; } catch (err) { console.log(`⚠️ Profile name not found: ${err.message}`); }
    let degree = "Unknown degree";
    try { degree = await page.locator(".distance-badge .visually-hidden").textContent({ timeout: 5000 }).then(text => text.trim().toLowerCase()) || await page.locator(".distance-badge .dist-value").textContent({ timeout: 5000 }).then(text => text.trim().toLowerCase()) || "Unknown degree"; } catch (err) { console.log(`⚠️ Degree not found: ${err.message}`); }
    let status = "Unknown";
    if (degree.includes("1st")) {
      status = "Accepted";
      console.log(`✅ ${profileName}: ${degree} - ${status}`);
    } else {
      const acceptButton = page.locator(".ph5 [aria-label*='Accept']").first();
      const pendingButton = page.locator(".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')").first();
      const connectButton = page.locator(".ph5 button:has-text('Connect')").first();
      if (await acceptButton.isVisible({ timeout: 5000 })) {
        status = "Accepted";
        console.log(`✅ ${profileName}: ${degree} - ${status} (Accept button)`);
      } else if (await pendingButton.isVisible({ timeout: 5000 })) {
        status = "Sent but Not Accepted (Pending)";
        console.log(`⏳ ${profileName}: ${degree} - ${status}`);
      } else if (await connectButton.isVisible({ timeout: 5000 })) {
        status = "Not Sent Yet";
        console.log(`⛔ ${profileName}: ${degree} - ${status} (Connect button)`);
      } else {
        const moreButton = page.locator(".ph5 button:has-text('More'), .ph5 [aria-label='More actions']").first();
        if (await moreButton.isVisible({ timeout: 5000 })) {
          await moreButton.click({ delay: 100 });
          await randomDelay(1000, 2000);
          const removeConnection = page.locator(".artdeco-dropdown__content span:has-text('Remove Connection')").last();
          const withdrawOption = page.locator(".artdeco-dropdown__content span:has-text('Withdraw')").first();
          if (await removeConnection.isVisible({ timeout: 5000 })) {
            status = "Accepted";
            console.log(`✅ ${profileName}: ${degree} - ${status} (Remove Connection)`);
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
          console.log(`❓ ${profileName}: ${degree} - ${status} (No More button)`);
        }
      }
    }
    console.log(`✅ Done with ${url}`);
  } catch (err) {
    console.error(`❌ Error checking status for ${url}: ${err.message}`);
  }
}

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
    try {
      profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown";
      console.log(`🔍 Found profile name: ${profileName}`);
    } catch (err) {
      console.log(`⚠️ Profile name not found: ${err.message}`);
    }
    let replyStatus = "No Reply Received";
    const messageButton = page.locator(".ph5 button:has-text('Message')").first();
    if (await messageButton.isVisible({ timeout: 10000 }).catch(() => false)) { // 10-second timeout
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

async function sendFollow(page, url) {
  console.log(`🌐 Visiting: ${url} to follow 3rd degree connection`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);
    let profileName = "Unknown";
    try { profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown"; } catch (err) { console.log(`⚠️ Profile name not found: ${err.message}`); }
    let degree = "Unknown";
    try {
      let degreeText = await page.locator(".distance-badge .dist-value").textContent({ timeout: 5000 }).catch(() => "");
      if (!degreeText) degreeText = await page.locator(".distance-badge .visually-hidden").textContent({ timeout: 5000 }).catch(() => "");
      degree = degreeText.toLowerCase().includes("3rd") ? "3rd" : degreeText.toLowerCase().includes("2nd") ? "2nd" : degreeText.toLowerCase().includes("1st") ? "1st" : "Unknown";
    } catch (err) { console.log(`⚠️ Degree not found: ${err.message}`); }
    if (degree === "3rd") {
      let followButton = page.locator(".ph5.pb5 [aria-label*='Follow']").first();
      if (await followButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await followButton.click();
        console.log(`✅ Followed ${profileName} via header`);
      } else {
        followButton = page.locator(".ph5 [aria-label*='Follow']").first();
        if (await followButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await followButton.click();
          console.log(`✅ Followed ${profileName} via secondary header`);
        } else {
          const moreButton = page.locator(".ph5 [aria-label='More actions']").first();
          if (await moreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await moreButton.click();
            await randomDelay(1000, 2000);
            const dropdownFollow = page.locator(".ph5.pb5 .artdeco-dropdown__content-inner [aria-label*='Follow']").first();
            if (await dropdownFollow.isVisible({ timeout: 5000 }).catch(() => false)) {
              await dropdownFollow.click();
              console.log(`✅ Followed ${profileName} via More actions`);
            } else {
              console.log(`⚠️ Follow option not found in dropdown for ${profileName}`);
            }
          } else {
            console.log(`⚠️ No More actions button found for ${profileName}`);
          }
        }
      }
    } else {
      console.log(`⏭️ Skipping ${profileName} - Not a 3rd degree connection (Degree: ${degree})`);
    }
    await randomDelay(1000, 2000);
    console.log(`✅ Done with ${url}`);
  } catch (err) {
    console.error(`❌ Error following ${url}: ${err.message}`);
  }
}

async function withdrawRequest(page, url) {
  console.log(`🌐 Visiting: ${url} to withdraw request`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);
    let profileName = "Unknown";
    try { profileName = await page.locator("h1").textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown"; } catch (err) { console.log(`⚠️ Profile name not found: ${err.message}`); }
    const headerWithdraw = page.locator(".ph5 [aria-label*='Pending, click to withdraw invitation sent to']").first();
    if (await headerWithdraw.isVisible({ timeout: 5000 }).catch(() => false)) {
      await headerWithdraw.click();
      await randomDelay(1000, 2000);
    } else {
      const moreButton = page.locator(".ph5 [aria-label='More actions']").first();
      if (await moreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await moreButton.click();
        await randomDelay(1000, 2000);
        const dropdownWithdraw = page.locator(".ph5 .artdeco-dropdown__content [aria-label*='Pending, click to withdraw invitation sent to']").first();
        if (await dropdownWithdraw.isVisible({ timeout: 5000 }).catch(() => false)) {
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
    const withdrawButton = page.locator("div[role='alertdialog'] button:has-text('Withdraw')").first();
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
   Helper Functions (Latest Versions - Duplicates Removed)
--------------------------- */
async function getVisibleLocator(page, selectors, useLast = false, timeout = 5000) {
  for (const selector of selectors) {
    try {
      // Build safe selector with scoping if needed
      let safeSelector = selector;
      // Append pseudo-selector for single match if not using :has (which chains poorly)
      if (selector.includes(':has(')) {
        // For :has, we'll use .nth after locator
      } else {
        safeSelector += useLast ? ':last-of-type' : ':first-of-type';
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

async function getTextFromSelectors(page, selectors, timeout = 5000) {
  for (const selector of selectors) {
    try {
      const text = await page.locator(selector).textContent({ timeout });
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (err) {
      // Silenced non-critical timeouts for cleaner logs
      if (!err.message.includes('Timeout')) {
        console.log(`⚠️ Text selector failed: ${selector} - ${err.message}`);
      }
    }
  }
  return null;
}

async function detectDegree(page, timeout = 5000) {
  let degree = "unknown";
  const degreeSelectors = [
    // New selectors first for faster, reliable detection
    { selector: 'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child', description: "degree last p" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] + p + p', description: "verified badge + p + p" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"]', description: "verified badge container" },
    // Legacy fallbacks (will timeout silently if irrelevant)
    { selector: ".distance-badge .visually-hidden", description: "degree badge hidden text" },
    { selector: ".distance-badge .dist-value", description: "degree badge visible value" }
  ];
  for (const { selector, description } of degreeSelectors) {
    try {
      const connectionInfo = await page.locator(selector).textContent({ timeout });
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
  return degree;
}

async function sendConnectionRequest(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await closeAllMessageBoxes(page);
    let profileName = "";
    const nameSelectors = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p'
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
      'button[aria-label^="Accept"][aria-label*="request to connect"]'
    ];
    const acceptButton = await getVisibleLocator(page, acceptSelectors);
    if (acceptButton) {
      console.log(`⛔ Skipping profile ${profileName} (${url}) - Pending acceptance`);
      return;
    }
    const degree = await detectDegree(page);
    const pendingSelectors = [
      ".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')",
      'button[aria-label^="Pending, click to withdraw invitation"]:has(svg[id="clock-small"])'
    ];
    const pendingWithdrawButton = await getVisibleLocator(page, pendingSelectors);
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
      'div[data-view-name="edge-creation-connect-action"] a'
    ];
    const connectButton = await getVisibleLocator(page, connectSelectors, true);  // Use .last() for alternatives
    const moreSelectors = [
      ".ph5 [aria-label='More actions']",
      'div[data-view-name="relationship-building-button"] ~ button[data-view-name="profile-overflow-button"][aria-label="More"]',
      'div[data-view-name="relationship-building-button"] + a[data-view-name="profile-secondary-message"] + button[data-view-name="profile-overflow-button"]'
    ];
    const moreButton = await getVisibleLocator(page, moreSelectors);
    const connectOpportunity = connectButton || moreButton;
    if (degree === "1st") {
      console.log(`⛔ Skipping connection request to ${profileName} (${url}) - Already connected`);
      return;
    }
    if (!connectOpportunity && degree === "unknown") {
      console.log(`⛔ Skipping connection request to ${profileName} (${url}) - No connect opportunity`);
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
      'button[aria-label="Send without a note"]'
    ];
    // Proceed with connect if available
    if (connectButton) {
      await humanMouse(page, 2);
      await connectButton.click({ delay: 100 });
      console.log("💡 Connect button clicked");
      // Wait specifically for send button to appear and be visible
      try {
        await page.waitForSelector('button[aria-label="Send without a note"]', { state: 'visible', timeout: 30000 });
        const sendButton = page.locator('button[aria-label="Send without a note"]').first();
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
        'a[href^="/preload/custom-invite/"]:has(svg[id="connect-small"])'
      ];
      const connectDropdown = await getVisibleLocator(page, dropdownSelectors, true);  // Use .last() for alternatives
      if (connectDropdown) {
        await humanMouse(page, 1);
        await connectDropdown.click({ delay: 100 });
        console.log("💡 Connect from dropdown clicked");
        // Wait specifically for send button to appear and be visible
        try {
          await page.waitForSelector('button[aria-label="Send without a note"]', { state: 'visible', timeout: 30000 });
          const sendButton = page.locator('button[aria-label="Send without a note"]').first();
          await humanMouse(page, 1);
          await sendButton.click({ delay: 100 });
          console.log("✅ Connection request sent");
          await randomDelay(2000, 4000);
        } catch (e) {
          console.log("⚠️ Send button not found after modal load");
        }
      }
    } else if (degree === "unknown") {
      console.log(`⚠️ No connect opportunity despite unknown degree - skipping`);
    }
    console.log(`✅ Finished processing ${profileName} (${url})`);
  } catch (err) {
    console.error(`❌ Failed to send connection request to ${url}: ${err.message}`);
  }

  
}



/* ---------------------------
   Main Test - Perform Action
--------------------------- */
test.describe("LinkedIn Multi-Action Script", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
    }
    if (!PROFILE_URLS.length) console.log("⚠️ No PROFILE_URLS provided.");

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
      await humanMouse(page, 3);
      await humanIdle(800, 1800);

      if (await page.locator("#username").isVisible({ timeout: 5000 })) {
        console.log("🔐 Logging in...");
        await humanType(page, "#username", process.env.LINKEDIN_EMAIL);
        await humanIdle(600, 1600);
        await humanType(page, "#password", process.env.LINKEDIN_PASSWORD);
        await humanIdle(600, 1600);
        await page.locator(`label[for='rememberMeOptIn-checkbox']`).click().catch(() => console.log("Remember Me checkbox not found, skipping."));
        await humanIdle(600, 1600);
        await page.locator('button[type="submit"]').click();
        await randomDelay(1000, 2000);

        const authLink = page.locator('a:has-text("Verify using authenticator app")');
        if (await authLink.isVisible({ timeout: 5000 })) await authLink.click();
        const totpInput = page.locator('input[name="pin"][maxlength="6"]');
        if (await totpInput.isVisible({ timeout: 5000 })) {
          console.log("🔑 Using TOTP MFA...");
          const token = speakeasy.totp({ secret: process.env.LINKEDIN_TOTP_SECRET, encoding: "base32" });
          await humanType(page, 'input[name="pin"][maxlength="6"]', token);
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

  test("Perform Action", async () => {
    test.setTimeout(20 * 60 * 1000); // 20 minutes
    console.log(`🔍 Performing action: ${ACTION} on ${PROFILE_URLS.length} profiles...`);
    console.log("-------------------------------");

    const actions = {
      view_feed: viewFeed,
      like_feed: likeFeed,
      check_degree: async () => { for (const url of PROFILE_URLS) await checkDegree(page, url); },
      send_message: async () => { for (const url of PROFILE_URLS) await sendMessage(page, url); },
      send_connection_request: async () => { for (const url of PROFILE_URLS) await sendConnectionRequest(page, url); },
      check_connection_accepted: async () => { for (const url of PROFILE_URLS) await checkConnectionAccepted(page, url); },
      check_reply: async () => { for (const url of PROFILE_URLS) await checkReply(page, url); },
      send_follow: async () => { for (const url of PROFILE_URLS) await sendFollow(page, url); },
      withdraw_request: async () => { for (const url of PROFILE_URLS) await withdrawRequest(page, url); },
    };

    const actionFunc = actions[ACTION];
    if (actionFunc) await actionFunc(page);
    else console.log(`⚠️ Unknown action: ${ACTION}. Available actions: ${Object.keys(actions).join(", ")}`);

    await expect(page).toHaveURL(/linkedin\.com/);
  });
});