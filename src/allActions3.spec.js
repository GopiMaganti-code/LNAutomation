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

/* ---------------------------
   Updated humanType to handle both string selectors and Locator objects
--------------------------- */
async function humanType(page, selectorOrLocator, text) {
  let el;
  if (typeof selectorOrLocator === 'string') {
    el = page.locator(selectorOrLocator);
  } else {
    el = selectorOrLocator; // Assume it's a Locator
  }
  await el.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  try {
    await el.click({ delay: 100 });
  } catch (e) {}
  for (const ch of text) {
    const delay = Math.floor(Math.random() * 150) + 50;
    await el.type(ch, { delay });
    if (Math.random() < 0.12) {
      await randomDelay(300, 1000);
    }
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
    const message = `Hi ${profileName}, I’d like to connect to discuss potential opportunities. Hope to connect soon!`;
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


/* ---------------------------
   Updated Helpers
--------------------------- */
async function detectProfileName(page, timeout = 5000) {
  let profileName = "Unknown";
  const nameSelectors = [
    { selector: "h1", description: "h1 tag" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p', description: "verified badge button p" },
    { selector: ".text-heading-xlarge", description: "heading class fallback" }
  ];
  for (const { selector, description } of nameSelectors) {
    try {
      const nameText = await page.locator(selector).textContent({ timeout });
      if (nameText && (profileName = nameText.trim()) !== "Unknown") {
        console.log(`👤 Profile name found via ${description}: ${profileName} (raw: "${nameText.trim()}")`);
        break;
      }
    } catch (err) {
      if (!err.message.includes('Timeout')) {
        console.log(`⚠️ Name selector failed ${description}: ${err.message}`);
      }
    }
  }
  console.log(`👤 Final profile name: ${profileName}`);
  return profileName;
}

async function detectDegree(page, timeout = 5000) {
  let degree = "unknown";
  const degreeSelectors = [
    { selector: 'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child', description: "degree last p" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] + p + p', description: "verified badge + p + p" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"]', description: "verified badge container" },
    // Legacy fallbacks
    { selector: ".distance-badge .visually-hidden", description: "degree badge hidden text" },
    { selector: ".distance-badge .dist-value", description: "degree badge visible value" }
  ];
  for (const { selector, description } of degreeSelectors) {
    try {
      const connectionInfo = await page.locator(selector).textContent({ timeout });
      if (connectionInfo) {
        const lowerInfo = connectionInfo.toLowerCase().trim();
        let matchedDegree = null;
        if (lowerInfo.includes("· 2nd") || lowerInfo.includes("2nd")) {
          matchedDegree = "2nd";
        } else if (lowerInfo.includes("· 3rd") || lowerInfo.includes("3rd")) {
          matchedDegree = "3rd";
        } else if (lowerInfo.includes("· 1st") || lowerInfo.includes("1st")) {
          matchedDegree = "1st";
        }
        if (matchedDegree) {
          degree = matchedDegree;  // Keep as "1st"/"2nd"/"3rd" (not full text)
          console.log(`📊 Degree matched via ${description}: ${matchedDegree}`);
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

async function getVisibleLocator(page, selectors, useLast = false, timeout = 5000) {
  for (const selector of selectors) {
    try {
      let safeSelector = selector;
      if (!selector.includes(':has(')) {
        safeSelector += useLast ? ':last-of-type' : ':first-of-type';
      }
      const loc = page.locator(safeSelector);
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
   Updated Function
--------------------------- */
async function checkConnectionAccepted(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);

    // Robust name detection
    let profileName = await detectProfileName(page);
    
    // Updated degree detection
    let degree = await detectDegree(page);
    if (degree === "unknown") {
      degree = "Unknown degree";
    }
    
    let status = "Unknown";
    // Debug log for degree check
    console.log(`🔍 Degree check: "${degree}" (includes "1st"? ${degree.includes("1st")})`);
    if (degree.includes("1st")) {
      status = "Accepted";
      console.log(`✅ ${profileName}: ${degree} - ${status}`);
    } else {
      // Accept button (incoming)
      const acceptSelectors = [
        ".ph5 [aria-label*='Accept']",
        'button[aria-label^="Accept"][aria-label*="request to connect"]',
        '[data-view-name="relationship-building-button"] button[aria-label*="Accept"]',
        '[data-view-name="edge-creation-accept-action"] button'
      ];
      const acceptButton = await getVisibleLocator(page, acceptSelectors);

      // Pending/withdraw (outgoing pending)
      const pendingSelectors = [
        ".ph5 button:has-text('Pending')",
        ".ph5 button:has-text('Withdraw')",
        '[aria-label*="Pending, click to withdraw invitation"]',
        '[data-view-name="relationship-building-button"] button[aria-label*="Pending"]',
        '[data-view-name="edge-creation-withdraw-action"] button'
      ];
      const pendingButton = await getVisibleLocator(page, pendingSelectors);

      // Connect button (not sent)
      const connectSelectors = [
        ".ph5 button:has-text('Connect')",
        'div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-connect-action"] a',
        'div[data-view-name="edge-creation-connect-action"] a',
        '[data-view-name="relationship-building-button"] a[aria-label^="Invite"][aria-label*="to connect"]',
        '[data-view-name="edge-creation-connect-action"] a[aria-label^="Invite"][aria-label*="to connect"]',
        '[data-view-name="relationship-building-button"] a:has(svg[id="connect-small"])',
        '[data-view-name="profile-secondary-message"] ~ [data-view-name="relationship-building-button"] a:has-text("Connect")',
        `[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label^="Invite"][aria-label*="to connect"]`
      ];
      const connectButton = await getVisibleLocator(page, connectSelectors, true);

      if (acceptButton) {
        status = "Incoming Request (Accept Pending)";
        console.log(`📥 ${profileName}: ${degree} - ${status} (Accept button)`);
      } else if (pendingButton) {
        status = "Sent but Not Accepted (Pending)";
        console.log(`⏳ ${profileName}: ${degree} - ${status}`);
      } else if (connectButton) {
        status = "Not Sent Yet";
        console.log(`⛔ ${profileName}: ${degree} - ${status} (Connect button)`);
      } else {
        // More button
        const moreSelectors = [
          ".ph5 button:has-text('More')",
          ".ph5 [aria-label='More actions']",
          '[data-view-name="profile-overflow-button"]',
          '[data-view-name="relationship-building-button"] ~ button[aria-label="More"]'
        ];
        const moreButton = await getVisibleLocator(page, moreSelectors);
        
        if (moreButton) {
          console.log("🔽 Clicking moreButton...");
          await moreButton.click({ delay: 100, timeout: 10000 });  // Explicit timeout to prevent hang
          console.log("🔽 More dropdown opened");
          await randomDelay(1000, 2000);
          console.log("🔍 Looking for remove/withdraw options...");

          // Remove connection (accepted)
          const removeSelectors = [
            ".artdeco-dropdown__content span:has-text('Remove this connection')",
            ".artdeco-dropdown__content [aria-label*='Remove connection']",
            ".artdeco-dropdown__content li:has-text('Remove')"
          ];
          const removeConnection = await getVisibleLocator(page, removeSelectors, true);

          // Withdraw (pending)
          const withdrawSelectors = [
            ".artdeco-dropdown__content span:has-text('Withdraw invitation')",
            ".artdeco-dropdown__content [aria-label*='Withdraw invitation']",
            ".artdeco-dropdown__content li:has-text('Withdraw')"
          ];
          const withdrawOption = await getVisibleLocator(page, withdrawSelectors);

          if (removeConnection) {
            status = "Accepted";
            console.log(`✅ ${profileName}: ${degree} - ${status} (Remove Connection)`);
          } else if (withdrawOption) {
            status = "Sent but Not Accepted (Withdraw)";
            console.log(`⏳ ${profileName}: ${degree} - ${status}`);
          } else {
            status = "Unknown";
            console.log(`❓ ${profileName}: ${degree} - ${status}`);
          }

          // Close dropdown
          console.log("🔼 Closing more dropdown...");
          await moreButton.click({ delay: 100, timeout: 5000 });
          console.log("🔼 Dropdown closed");
        } else {
          status = "Unknown";
          console.log(`❓ ${profileName}: ${degree} - ${status} (No More button)`);
        }
      }
    }
    console.log(`✅ Done with ${url} - Final Status: ${status}`);
  } catch (err) {
    console.error(`❌ Error checking status for ${url}: ${err.message}`);
    console.log(`✅ Done with ${url} - Final Status: Error`);
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


//---------------------------
//   Grab Replies Action
//---------------------------
async function grabReplies(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(4000, 6000); // Increased delay for page stability
    // Close any lingering message overlays
    const closeButton = page.locator("button:has-text('Close your conversation')").first();
    const altClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
    if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeButton.click();
      console.log("🗑️ Closed existing conversation overlay");
    } else if (await altClose.isVisible({ timeout: 5000 }).catch(() => false)) {
      await altClose.click();
      console.log("🗑️ Closed via alt close");
    }

    // Dynamic profile name extraction (fallbacks for varying structures) - Kept for logging/other uses
    let profileName = "Unknown";
    const nameLocators = [
      "h1", // Primary: Profile header
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p', // Verified badge variant
      "a[aria-label] h1", // Aria-linked header
      'a[href*="/in/"] h1', // LinkedIn URL header
      'div[data-view-name="profile-top-card-verified-badge"] p', // Fallback p in badge
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type', // First p variant
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page.locator(selector).textContent({ timeout: 3000 });
        if (text && text.trim().length > 0) {
          profileName = text.trim();
          console.log(`👤 Found profile name: "${profileName}" (via ${selector})`);
          break;
        }
      } catch (err) {
        // Silent fail on timeout/non-critical errors; try next selector
        if (!err.message.includes("Timeout")) console.log(`⚠️ Name selector failed: ${selector} - ${err.message}`);
      }
    }

    let replyStatus = "No Messages Found";
    // Enhanced message button selectors (prioritize visibility with fallbacks)
    const messageButtonLocators = [
      { selector: "div.ph5 button:has-text('Message')", description: "header message button" },
      { selector: 'a[data-view-name="profile-primary-message"]', description: "primary message link" },
      { selector: 'a[data-view-name="profile-secondary-message"]', description: "secondary message link" },
      { selector: 'button[aria-label*="Message"]', description: "aria message button" }, // New: Aria fallback
    ];
    let messageButton = null;
    for (const { selector, description } of messageButtonLocators) {
      try {
        const btn = page.locator(selector).last(); // Use .last() for multi-matches in feed-like views
        await btn.waitFor({ state: "visible", timeout: 5000 }); // Slightly longer for stability
        messageButton = btn;
        console.log(`✅ Found message button (${description})`);
        break;
      } catch (err) {
        // Silent fail; try next
        if (!err.message.includes("Timeout")) console.log(`⚠️ Message button selector failed: ${description} - ${err.message}`);
      }
    }

    if (messageButton) {
      console.log(`💬 Opening conversation for ${profileName}`);
      await humanMouse(page, 2); // Human-like hover before click
      await messageButton.click({ delay: 100 });
      await randomDelay(5000, 8000); // Extended wait for full message list load (dynamic content)

      // Grab FULL conversation: Target all event list items (both own and other)
      // Use li.msg-s-message-list__event for containers, then .msg-s-event-listitem inside
      const eventContainers = await page.locator('ul.msg-s-message-list-content > li.msg-s-message-list__event').all();
      const timeHeadings = await page.locator('.msg-s-message-list__time-heading').all(); // Global headings for grouping

      if (eventContainers.length > 0) {
        replyStatus = "Conversation Retrieved";
        console.log(`Sender: ${profileName}`);
        console.log(`  - Status: ${replyStatus} (${eventContainers.length} total messages)`);
        console.log("📜 Full Conversation Log:");

        let currentDateHeading = "Unknown Date"; // Default; update dynamically
        let headingIndex = 0;
        let lastTimestamp = null; // Track last known timestamp for carry-forward
        let lastSender = null; // NEW: Track last known sender for grouped/consecutive messages
        let ownName = null; // NEW: Dynamic own name, set from first successful own extraction

        for (let i = 0; i < eventContainers.length; i++) {
          const eventContainer = eventContainers[i];
          const msgElement = eventContainer.locator('.msg-s-event-listitem').first();

          // Dynamic date: Check for time-heading within this event container or advance global
          let localHeading = await eventContainer.locator('.msg-s-message-list__time-heading').textContent({ timeout: 2000 }).catch(() => "");
          if (localHeading.trim()) {
            currentDateHeading = localHeading.trim();
          } else if (headingIndex < timeHeadings.length) {
            // Fallback to global headings (approximate)
            const globalHeading = await timeHeadings[headingIndex].textContent({ timeout: 2000 }).catch(() => "");
            if (globalHeading.trim()) {
              currentDateHeading = globalHeading.trim();
              headingIndex++;
            }
          }

          // UPDATED: Dynamic sender with tracking/fallback for missing meta in consecutive messages
          const isOther = await msgElement.evaluate(el => el.classList.contains('msg-s-event-listitem--other'));
          let extractedName = await msgElement.locator('.msg-s-message-group__name').textContent({ timeout: 5000 }).catch(() => null); // Increased timeout
          extractedName = extractedName ? extractedName.trim().replace(/\s+/g, " ") : null;

          let senderName;
          if (extractedName && extractedName.length > 0) {
            senderName = extractedName;
            lastSender = senderName; // Update tracker
            if (!isOther && !ownName) {
              ownName = senderName; // Set ownName from first successful own extraction
            }
          } else {
            // Fallback: Use lastSender, or initial based on isOther/ownName
            if (lastSender) {
              senderName = lastSender;
            } else if (isOther) {
              senderName = profileName;
              lastSender = senderName; // Set initial for other
            } else if (ownName) {
              senderName = ownName;
              lastSender = senderName; // Set/carry for own
            } else {
              senderName = "Unknown Sender"; // Rare: True first message with no extraction
            }
          }

          // Timestamp: From .msg-s-message-group__timestamp (own may lack, fallback)
          let timestamp = await msgElement.locator('.msg-s-message-group__timestamp').textContent({ timeout: 3000 }).catch(() => "Unknown Time");
          timestamp = timestamp ? timestamp.trim().replace(/\s+/g, " ") : "Unknown Time";
          // Carry forward: If unknown, use last known timestamp
          if (timestamp === "Unknown Time" && lastTimestamp) {
            timestamp = lastTimestamp;
          }
          // Update last known timestamp if this one is valid
          if (timestamp !== "Unknown Time") {
            lastTimestamp = timestamp;
          }

          // Message body: Use .msg-s-event-listitem__body with textContent (matches working logic)
          // ENHANCED: Better cleaning for links/attachments (truncate long URLs, remove empty artifacts)
          let messageText = await msgElement.locator('.msg-s-event-listitem__body').textContent({ timeout: 5000 }).catch(() => "");
          messageText = messageText
            .replace(/<!---->/g, "") // Remove Vue artifacts
            .replace(/https?:\/\/[^\s]+/g, (url) => url.length > 50 ? `${url.substring(0, 47)}...` : url) // Truncate long URLs
            .trim();
          if (!messageText || messageText.length === 0) {
            messageText = "No readable content";
          }

          // Seen receipts: Check for presence and title
          let seenInfo = "";
          const seenCount = await msgElement.locator('.msg-s-event-listitem__seen-receipts img').count();
          if (seenCount > 0) {
            const seenTitle = await msgElement.locator('.msg-s-event-listitem__seen-receipts img').getAttribute('title', { timeout: 2000 }).catch(() => "");
            seenInfo = seenTitle ? ` (Seen: ${seenTitle})` : " (Seen)";
          }

          console.log(
            `  - Msg ${i + 1}/${eventContainers.length}: From "${senderName}" on ${currentDateHeading} at ${timestamp}${seenInfo} - "${messageText}"`
          );

          await randomDelay(200, 500); // Micro-pause for readability in logs
        }
      } else {
        console.log(`Sender: ${profileName}`);
        console.log(`  - Status: ${replyStatus} (Empty conversation)`);
      }

      // Graceful close
      const finalCloseButton = page.locator("button:has-text('Close your conversation')").first();
      const finalAltClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
      if (await finalCloseButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await finalCloseButton.click();
      } else if (await finalAltClose.isVisible({ timeout: 5000 }).catch(() => false)) {
        await finalAltClose.click();
      }
      await randomDelay(1000, 2000);
    } else {
      console.log(`⚠️ Message button not found for ${profileName} (skipping conversation)`);
      console.log(`Sender: ${profileName}`);
      console.log(`  - Status: No Reply Received (No Message Button)`);
    }
    console.log(`✅ Done with ${url} (${replyStatus})`);
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

    // Step 1️⃣ — Extract Profile Name (Robust locators)
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

    // Step 2️⃣ — Check Header Withdraw (Robust locators with .last())
    const headerWithdrawLocators = [
      {
        selector: 'div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-connect-action"] button[aria-label*="Pending, click to withdraw invitation"]',
        description: "relationship-building edge-creation pending aria-label",
      },
      {
        selector: 'div[data-view-name="edge-creation-connect-action"] button:has(svg[id="clock-small"])',
        description: "edge-creation clock icon pending",
      },
      {
        selector: ".ph5 button[aria-label*='Pending, click to withdraw invitation']",
        description: "ph5 pending withdraw aria-label",
      },
      {
        selector: 'div[data-view-name="relationship-building-button"] button:has(span:has-text("Pending"))',
        description: "relationship-building pending text",
      },
      {
        selector: "button[aria-label*='Pending invitation sent to']",
        description: "global pending invitation aria-label",
      },
    ];

    let headerWithdraw = null;
    for (const { selector, description } of headerWithdrawLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        headerWithdraw = btn;
        console.log(`✅ Found header withdraw (${description})`);
        break;
      } catch {
        // try next
      }
    }

    if (headerWithdraw) {
      await humanMouse(page, 2);
      await headerWithdraw.click({ delay: 100 });
      console.log("💡 Header withdraw clicked");
      await randomDelay(1000, 2000);
    } else {
      // Step 3️⃣ — Fallback: More Actions Path (Robust locators with .last())
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

      let moreButton = null;
      for (const { selector, description } of moreButtonLocatorsTemp) {
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

        // Step 4️⃣ — Locate Dropdown Withdraw (Robust array with .last())
        const dropdownWithdrawLocators = [
          {
            selector: ".ph5 .artdeco-dropdown__content [aria-label*='Pending, click to withdraw invitation sent to']",
            description: "dropdown pending withdraw aria-label",
          },
          {
            selector: ".artdeco-dropdown__content [aria-label*='Pending invitation sent to']",
            description: "dropdown pending invitation aria-label",
          },
          {
            selector: ".artdeco-dropdown__content button:has(span:has-text('Pending'))",
            description: "dropdown pending text button",
          },
          {
            selector: ".artdeco-dropdown__content button:has(svg[id='clock-small'])",
            description: "dropdown clock icon pending",
          },
        ];

        let dropdownWithdraw = null;
        for (const { selector, description } of dropdownWithdrawLocators) {
          try {
            const btn = page.locator(selector).last();
            await btn.waitFor({ state: "visible", timeout: 3000 });
            dropdownWithdraw = btn;
            console.log(`✅ Found dropdown withdraw (${description})`);
            break;
          } catch {
            // try next
          }
        }

        if (dropdownWithdraw) {
          await humanMouse(page, 1);
          await dropdownWithdraw.click({ delay: 100 });
          console.log("💡 Dropdown withdraw clicked");
          await randomDelay(1000, 2000);
        } else {
          console.log(`⚠️ No pending/withdraw option found in dropdown for ${profileName}`);
          // Close dropdown
          await moreButton.click({ delay: 100 });
          return;
        }

        // Close dropdown after click
        await moreButton.click({ delay: 100 });
        await randomDelay(500, 1000);
      } else {
        console.log(`⚠️ No More actions button found for ${profileName}`);
        return;
      }
    }

    // Step 5️⃣ — Confirm Withdraw in Dialog (Robust locators with .first())
    const withdrawButtonLocators = [
      {
        selector: `div[role='alertdialog'] button:has-text('Withdraw')`,
        description: "dialog withdraw text",
      },
      {
        selector: "dialog button[aria-label*='Withdrawn invitation sent to']",
        description: "dialog withdrawn aria-label",
      },
      {
        selector: 'div[data-view-name="edge-creation-connect-action"] button:has-text("Withdraw")',
        description: "edge-creation withdraw text",
      },
      {
        selector: '[data-testid="dialog"] button:has-text("Withdraw")',
        description: "data-testid dialog withdraw text",
      },
      {
        selector: 'dialog button:has-text("Withdraw")',
        description: "dialog withdraw text",
      },
      
    ];

    let withdrawButton = null;
    for (const { selector, description } of withdrawButtonLocators) {
      try {
        const btn = page.locator(selector).first();
        await btn.waitFor({ state: "visible", timeout: 5000 });
        withdrawButton = btn;
        console.log(`✅ Found withdraw confirm button (${description})`);
        break;
      } catch {
        // try next
      }
    }

    if (withdrawButton) {
      await humanMouse(page, 1);
      await withdrawButton.click({ delay: 100 });
      console.log(`✅ Withdrawn request for ${profileName}`);
    } else {
      console.log(`⚠️ Withdraw confirm button not found for ${profileName}`);
    }

    await randomDelay(1000, 2000);
    console.log(`✅ Done with ${url}`);
    console.log(`----------------------------`);
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
      `[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label^="Invite"][aria-label*="to connect"]`
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
    Like Random Post from User's Activity
--------------------------- */


async function likeRandomUserPost(page, url) {
  console.log(`🌐 Visiting: ${url} to like a random post`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(2000, 4000);
    await humanScroll(page, 2); // Gentle scroll to reveal activity section

    // Find and click "Show all" link in Activity section
    const showAllSelectors = [
      'a[aria-label="Show all"]',
      'a:has-text("Show all")',
      '.ph5 a[href*="/recent-activity/all/"]',
      `a[href*="/recent-activity/all/"]:has(span:has-text("Show all"))`,
      `a[href*="/recent-activity/all/"]:has-text("See all activity")`,
      `a[aria-label='Show all']`,
    ];
    const showAllLink = await getVisibleLocator(page, showAllSelectors, false, 10000);
    if (!showAllLink) {
      console.log(`⚠️ "Show all" link not found for ${url}, skipping`);
      return;
    }

    console.log(`🔍 Found "Show all" - clicking to view activity...`);
    await humanMouse(page, 2);
    await showAllLink.click({ delay: 100 });
    
    // Wait for navigation to activity page
    await page.waitForURL(/\/recent-activity\/all\/$/, { timeout: 10000 }).catch(() => console.log(`⚠️ Activity URL not reached, proceeding...`));
    await randomDelay(6000, 8000); // Increased wait for activity page load to ensure DOM stability

    // Wait for post containers to load (key fix for async loading)
    const postSelectors = [
      '.feed-shared-update-v2',
      '.occludable-update',
      '[data-urn*="urn:li:activity:"]',
      '.update-components-actor',
      '.feed-shared-actor'
    ];
    let postLoaded = false;
    // for (const selector of postSelectors) {
    //   try {
    //     await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
    //     console.log(`✅ Post container loaded using selector: ${selector}`);
    //     postLoaded = true;
    //     break;
    //   } catch (err) {
    //     console.log(`⚠️ Post selector ${selector} timed out`);
    //   }
    // }
    if (!postLoaded) {
      console.log(`⚠️ No post containers loaded for ${url}, likely empty activity`);
    }

    // Single gentle scroll to trigger any lazy loading without retry loop
    await humanScroll(page, 3);
    await humanIdle(3000, 5000); // Additional idle for rendering
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => console.log(`⚠️ Network idle not reached, proceeding...`));

    // Improved empty activity state check: Require specific text for confirmation
    const emptyStateSelectors = [
      { selector: 'div[data-test-id="empty-state"]', textCheck: 'No recent activity' },
      { selector: '.scaffold-layout__empty-state', textCheck: 'No recent activity' },
      { selector: 'p:has-text("No recent activity")', textCheck: 'No recent activity' },
      { selector: '[data-test-id="no-activity"]', textCheck: 'no activity' },
      { selector: 'div:contains("No activity")', textCheck: 'No activity' },
      { selector: '.artdeco-empty-state', textCheck: 'No recent activity' }
    ];
    let isEmpty = false;
    for (const { selector, textCheck } of emptyStateSelectors) {
      try {
        const emptyEl = page.locator(selector);
        if (await emptyEl.isVisible({ timeout: 5000 })) {
          const elText = await emptyEl.textContent({ timeout: 5000 }) || '';
          if (elText.toLowerCase().includes(textCheck.toLowerCase())) {
            console.log(`⚠️ Confirmed empty activity state detected for ${url} using selector: ${selector} (text: "${elText.trim()}"), skipping`);
            isEmpty = true;
            break;
          } else {
            console.log(`ℹ️ Empty state element found (${selector}) but text mismatch (expected: "${textCheck}", got: "${elText.trim()}"), continuing`);
          }
        }
      } catch (err) {
        // Timeout is fine, continue
      }
    }
    if (isEmpty) {
      return;
    }

    // Single check for like buttons after enhanced load (no retry loop)
    const likeSelector = 'button[aria-label*="Like"]';
    const potentialButtons = await page.locator(likeSelector).all();
    console.log(`🔍 Searched selector "${likeSelector}": found ${potentialButtons.length} potential buttons`);

    // Enhanced filtering with detailed debug logs
    const visibleUnliked = [];
    let visibleCount = 0;
    let unlikedCount = 0;
    let pressedCount = 0;
    for (const btn of potentialButtons) {
      try {
        if (await btn.isVisible({ timeout: 3000 })) { // Increased timeout for visibility
          visibleCount++;
          console.log(`   - Button ${visibleCount} is visible`);
          const ariaLabel = await btn.getAttribute('aria-label') || '';
          console.log(`     Aria-label: "${ariaLabel}"`);
          if (ariaLabel.toLowerCase().includes('like') && !ariaLabel.toLowerCase().includes('unlike')) {
            unlikedCount++;
            console.log(`       - Passes label filter (unliked)`);
            // Additional check for pressed state
            const pressed = await btn.getAttribute('aria-pressed');
            console.log(`       - Aria-pressed: "${pressed}"`);
            const isActive = await btn.evaluate(el => el.classList && el.classList.contains('react-button__trigger--active'));
            console.log(`       - Is active class: ${isActive}`);
            if (pressed !== 'true' && !isActive) {
              visibleUnliked.push(btn);
              console.log(`         ✅ Fully unliked and ready`);
            } else {
              pressedCount++;
              console.log(`         ❌ Excluded: pressed=${pressed} or active=${isActive}`);
            }
          } else {
            console.log(`     ❌ Excluded: contains "unlike" or no "like"`);
          }
        } else {
          console.log(`   - Button skipped: not visible`);
        }
      } catch (err) {
        console.log(`⚠️ Visibility/attribute check failed for button: ${err.message}`);
      }
    }
    console.log(`📊 Filter summary: ${potentialButtons.length} total -> ${visibleCount} visible -> ${unlikedCount} unliked by label -> ${visibleUnliked.length} fully unliked (excluded ${pressedCount} pressed/active)`);

    if (visibleUnliked.length === 0) {
      console.log(`⚠️ No unliked like buttons found for ${url}, skipping`);
      // Optional: Log total liked buttons for debug
      const likedSelector = 'button[aria-label*="Unlike"]';
      const likedCount = await page.locator(likedSelector).count();
      console.log(`ℹ️ Debug: Found ${likedCount} already liked ("Unlike") buttons`);
      return;
    }

    // Click the first unliked button (no random selection)
    const button = visibleUnliked[0];
    console.log(`🎯 Selected first like button of ${visibleUnliked.length} to click`);

    // Human-like interaction
    await humanMouse(page, 2);
    await button.scrollIntoViewIfNeeded();
    await randomDelay(800, 1500);
    await button.click({ delay: 100 });
    console.log(`👍 Liked first post on ${url}`);
    await humanIdle(2000, 4000);

    console.log(`✅ Finished liking post on ${url}`);
    console.log("-------------------------------");
  } catch (err) {
    console.error(`❌ Error liking post on ${url}: ${err.message}`);
  }
}


/* ---------------------------
    Withdraw All Follows
--------------------------- */
async function withdrawAllFollows(page) {
  console.log("🚫 Starting to withdraw all follow requests...");
  try {
    await page.goto("https://www.linkedin.com/mynetwork/network-manager/people-follow/following/", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("✅ Navigated to Following page");
    await randomDelay(2000, 4000);

    // Scroll to load more followers if needed (infinite scroll handling)
    let previousHeight = 0;
    let loadAttempts = 0;
    const maxLoadAttempts = 10;
    while (loadAttempts < maxLoadAttempts) {
      await humanScroll(page, 2);  // Gentle scroll down
      await randomDelay(1000, 2000);
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        console.log("📜 No more content to load");
        break;
      }
      previousHeight = currentHeight;
      loadAttempts++;
      console.log(`📜 Loaded more content (attempt ${loadAttempts}/${maxLoadAttempts})`);
    }

    // Find all unfollow buttons (initial query)
    const unfollowSelectors = [
      'button[aria-label*="Click to stop following"]',
      'button[aria-label*="Unfollow"]'
    ];
    let unfollowButtons = [];
    for (const selector of unfollowSelectors) {
      try {
        unfollowButtons = await page.locator(selector).all();
        if (unfollowButtons.length > 0) {
          console.log(`✅ Found ${unfollowButtons.length} unfollow buttons using: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Unfollow selector failed: ${selector} - ${err.message}`);
      }
    }

    if (unfollowButtons.length === 0) {
      console.log("⚠️ No unfollow buttons found on the page");
      return;
    }

    console.log(`🔄 Unfollowing ${unfollowButtons.length} people one by one...`);
    // Process in original order; no inner refresh to avoid index shifts
    // Alternative: Reverse loop if list re-renders shift indices: for (let i = unfollowButtons.length - 1; i >= 0; i--)
    for (let i = 0; i < unfollowButtons.length; i++) {
      const button = unfollowButtons[i];
      try {
        // Check if still visible (handles stale or removed)
        if (!(await button.isVisible({ timeout: 3000 }))) {
          console.log(`⚠️ Button ${i + 1} no longer visible (skipped)`);
          continue;
        }
        await button.scrollIntoViewIfNeeded();
        await humanMouse(page, 1);
        await button.click({ delay: 100 });
        console.log(`💥 Unfollow initiated for person ${i + 1}/${unfollowButtons.length}`);

        // Wait for and confirm modal
        const confirmSelectors = [
          '[data-test-modal] button[data-test-dialog-primary-btn]',
          'div[role="dialog"] button:has-text("Unfollow")',
          'button[data-test-dialog-primary-btn]:has-text("Unfollow")'
        ];
        let confirmButton = null;
        for (const sel of confirmSelectors) {
          try {
            confirmButton = page.locator(sel).first();
            if (await confirmButton.isVisible({ timeout: 5000 })) {
              console.log(`✅ Using confirm selector: ${sel}`);
              break;
            }
          } catch (err) {
            // Silently skip timeout
          }
        }
        if (confirmButton) {
          await humanMouse(page, 1);
          await confirmButton.click({ delay: 100 });
          console.log(`✅ Confirmed unfollow for person ${i + 1}`);
        } else {
          console.log(`⚠️ Confirm button not found for person ${i + 1}, skipping confirmation`);
        }

        // Random delay between actions to mimic human behavior
        const delay = Math.floor(Math.random() * 3000) + 2000;  // 2-5 seconds
        console.log(`⏸️ Waiting ${Math.round(delay / 1000)} seconds before next...`);
        await page.waitForTimeout(delay);

        // NO REFRESH HERE: Prevents index shifting that causes skips (e.g., clicking 1,3,5,7 instead of 1-8)
        // If list grows/shrinks unexpectedly, the visibility check above handles skips safely
      } catch (err) {
        console.log(`⚠️ Failed to unfollow person ${i + 1}: ${err.message}`);
        await randomDelay(1000, 2000);
      }
    }

    console.log("✅ Finished withdrawing all follows");
    await humanIdle(3000, 6000);
  } catch (err) {
    console.error("❌ Failed to withdraw follows:", err.message);
  }
}



/* ---------------------------
   Withdraw All Sent Connection Requests
--------------------------- */
async function withdrawAllSentRequests(page) {
  console.log("🚫 Starting to withdraw all sent connection requests...");
  try {
    await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("✅ Navigated to Sent Invitations page");
    await randomDelay(2000, 4000);

    // Ensure "Sent" tab is active
    const sentTabSelectors = [
      'button[aria-current="true"]:has-text("Sent")',
      'button:has-text("Sent")'
    ];
    const sentTab = await getVisibleLocator(page, sentTabSelectors);
    if (sentTab && !(await sentTab.getAttribute('aria-current') === 'true')) {
      await sentTab.click({ delay: 100 });
      await randomDelay(1000, 2000);
    }

    // Scroll to load more invitations if needed (infinite scroll + "Load more")
    let previousHeight = 0;
    let loadAttempts = 0;
    const maxLoadAttempts = 15;  // Increased for potentially more invites
    while (loadAttempts < maxLoadAttempts) {
      // Check and click "Load more" if visible
      const loadMoreButton = page.locator('button:has-text("Load more")').first();
      if (await loadMoreButton.isVisible({ timeout: 3000 })) {
        await loadMoreButton.click({ delay: 100 });
        console.log("📜 Clicked 'Load more'");
        await randomDelay(2000, 4000);
      }
      await humanScroll(page, 2);  // Gentle scroll down
      await randomDelay(1000, 2000);
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        console.log("📜 No more content to load");
        break;
      }
      previousHeight = currentHeight;
      loadAttempts++;
      console.log(`📜 Loaded more content (attempt ${loadAttempts}/${maxLoadAttempts})`);
    }

    // Find all withdraw buttons
    const withdrawSelectors = [
      'button[data-view-name="sent-invitations-withdraw-single"]:has-text("Withdraw")',
      'button:has-text("Withdraw")'
    ];
    let withdrawButtons = [];
    for (const selector of withdrawSelectors) {
      try {
        withdrawButtons = await page.locator(selector).all();
        if (withdrawButtons.length > 0) {
          console.log(`✅ Found ${withdrawButtons.length} withdraw buttons using: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Withdraw selector failed: ${selector} - ${err.message}`);
      }
    }

    if (withdrawButtons.length === 0) {
      console.log("⚠️ No withdraw buttons found on the page");
      return;
    }

    console.log(`🔄 Withdrawing ${withdrawButtons.length} requests one by one...`);
    // Process in original order; no inner refresh to avoid index shifts
    // Alternative: Reverse loop if list re-renders shift indices: for (let i = withdrawButtons.length - 1; i >= 0; i--)
    for (let i = 0; i < withdrawButtons.length; i++) {
      const button = withdrawButtons[i];
      try {
        // Check if still visible (handles stale or removed)
        if (!(await button.isVisible({ timeout: 3000 }))) {
          console.log(`⚠️ Button ${i + 1} no longer visible (skipped)`);
          continue;
        }
        await button.scrollIntoViewIfNeeded();
        await humanMouse(page, 1);
        await button.click({ delay: 100 });
        console.log(`💥 Withdraw initiated for request ${i + 1}/${withdrawButtons.length}`);

        // Wait for and confirm modal
        const confirmSelectors = [
          'button[aria-label^="Withdrawn invitation sent to"]',
          'button:has-text("Withdraw")',
          'div[role="dialog"] button:not([aria-label*="Cancel"]):has-text("Withdraw")'
        ];
        let confirmButton = null;
        for (const sel of confirmSelectors) {
          try {
            confirmButton = page.locator(sel).first();
            if (await confirmButton.isVisible({ timeout: 5000 })) {
              console.log(`✅ Using confirm selector: ${sel}`);
              break;
            }
          } catch (err) {
            // Silently skip timeout
          }
        }
        if (confirmButton) {
          await humanMouse(page, 1);
          await confirmButton.click({ delay: 100 });
          console.log(`✅ Confirmed withdraw for request ${i + 1}`);
          await randomDelay(1000, 2000);  // Brief pause after confirm
        } else {
          console.log(`⚠️ Confirm button not found for request ${i + 1}, skipping confirmation`);
        }

        // Random delay between actions to mimic human behavior
        const delay = Math.floor(Math.random() * 4000) + 3000;  // 3-7 seconds (longer for invites)
        console.log(`⏸️ Waiting ${Math.round(delay / 1000)} seconds before next...`);
        await page.waitForTimeout(delay);

        // NO REFRESH HERE: Prevents index shifting that causes skips
        // Visibility check above handles any stale elements safely
      } catch (err) {
        console.log(`⚠️ Failed to withdraw request ${i + 1}: ${err.message}`);
        await randomDelay(1000, 2000);
      }
    }

    console.log("✅ Finished withdrawing all sent requests");
    await humanIdle(4000, 8000);
  } catch (err) {
    console.error("❌ Failed to withdraw sent requests:", err.message);
  }
}

/* ---------------------------
   Post Impressions Action
--------------------------- */
async function checkPostImpressions(page) {
  console.log("📊 Starting to check Post Impressions / Creator Analytics...");

  // Ensure we are on Home feed
  await page
    .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await humanIdle(800, 1800);

  const postImpressions = page
    .locator(
      `.scaffold-layout__sticky-content [aria-label*='Side Bar'] span:has-text('Post impressions')`
    )
    .first();
  if (await postImpressions.count()) {
    await postImpressions.click().catch(() => {});
  }
  const viewAllAnalytics = page
    .locator(`.scaffold-layout__sticky-content [aria-label*='Side Bar'] span:has-text('View all analytics')`)
    .first();
  if (await viewAllAnalytics.count()) {
    await viewAllAnalytics.click().catch(() => {});
    await randomDelay(1500, 3500);
    await page.locator(`.pcd-analytic-view-items-container [href*='https://www.linkedin.com/analytics/creator/content']`).first().click().catch(() => {});
  }
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
    await applyBtn
      .first()
      .click()
      .catch(() => {});
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

  console.log("✅ Finished checking Post Impressions / Creator Analytics");
}


/* ---------------------------
   Scrape Connections Action
--------------------------- */
async function scrapeConnections(page) {
  console.log("🔎 Scraping first 20 connections...");

  // Ensure we are on Home feed first
  await page
    .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await humanIdle(2000, 4000);

  console.log("Navigating to My Network -> Connections...");
  const myNetwork = `nav li [href*='https://www.linkedin.com/mynetwork']`;
  await page
    .locator(myNetwork)
    .click()
    .catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await humanIdle(3000, 6000);
  // Click on Connections link
  await page.locator(`nav ul [aria-label*='connections']`).first().click();
  await humanIdle(2000, 4000);

  // Wait for connections to load
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await randomDelay(4000, 6000);

  // Wait for connections list to load
  await page.waitForSelector('a[data-view-name="connections-profile"]', {
    timeout: 10000,
  });

  // Grab all connections first
  const allConnections = await page.$$eval(
    'a[data-view-name="connections-profile"]',
    (els) =>
      els
        .map((el) => {
          const nameEl = el.querySelector("p a");
          const name = nameEl ? nameEl.innerText.trim() : null;
          const url = el.href;
          return { name, url };
        })
        .filter((c) => c.name && c.url)
  );

  // Take only first 20
  const first20Connections = allConnections.slice(0, 20);

  // Print first 20 connections
  first20Connections.forEach(({ name, url }, idx) => {
    console.log(`${idx + 1}. ${name} : ${url}`);
    console.log("-------------------------------");
  });

  // Print total connections scraped
  console.log(`\n✅ Total connections scraped: ${allConnections.length}`);

  return first20Connections; // Optional: return the data for further use
}



// Selectors for Profile Image from First HTML Snippet
// (Targets the img inside .profile-photo-edit__preview or .pv-top-card__edit-photo)
const firstImageSelectors = [
  'img.profile-photo-edit__preview',
  '.pv-top-card__edit-photo img',
  '.profile-photo-edit.pv-top-card__edit-photo img'
];

// Selectors for Profile Image from Second HTML Snippet
// (Targets the img inside [data-view-name="profile-top-card-member-photo"] or figure[data-view-name="image"])
const secondImageSelectors = [
  '[data-view-name="profile-top-card-member-photo"] img',
  'figure[data-view-name="image"] img',
  'img[data-loaded="true"]'
];

// Combined Robust Selector for Profile Image (works for both structures)
const combinedProfileImageSelector = [
  'img.profile-photo-edit__preview',
  '.pv-top-card__edit-photo img',
  '.profile-photo-edit.pv-top-card__edit-photo img',
  '[data-view-name="profile-top-card-member-photo"] img',
  'figure[data-view-name="image"] img',
  'img[data-loaded="true"]'
].join(', ');

// Usage Example in grabProfileImage Function
async function grabProfileImage(page) {
  console.log("👤 Grabbing profile image...");

  // Ensure we are on Home feed
  await page
    .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 })
    .catch(() => {});
  await humanIdle(2000, 4000);

  // Click on profile image to open menu
  await page.locator(`img.global-nav__me-photo, img[alt*="Profile photo"], figure[data-view-name="image"] img`).first().click().catch(() => {});

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await humanIdle(2000, 4000);
  
  // Click "View profile" to navigate to own profile
  await page.locator(`a:has-text('View profile'), a[href*='/in/']`).first().click().catch(() => {});
  
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await humanIdle(2000, 4000);

  // Updated robust selectors for name using provided locators
  const nameLocators = [
    { selector: "h1", description: "h1 tag" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p', description: "verified badge button p" },
    { selector: "a[aria-label] h1", description: "aria-label a h1" },
    { selector: 'a[href*="/in/"] h1', description: "in href a h1" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] p', description: "verified badge p" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type', description: "verified badge first p" },
  ];

  let nameText = await getTextFromSelectors(page, nameLocators.map(loc => loc.selector), 10000);
  if (!nameText) {
    console.log("⚠️ No name found with provided locators");
    nameText = "Unknown";
  } else {
    console.log("Profile Name:", nameText);
  }

  // Updated robust selector for profile image using combined selectors
  const profileImage = page.locator(combinedProfileImageSelector).first();
  await profileImage.waitFor({ state: "visible", timeout: 20000 }).catch(() => console.log("⚠️ Profile image not found or timed out"));
  
  let imageUrl = await profileImage.getAttribute("src");
  if (!imageUrl) {
    console.log("⚠️ No image URL found with src attribute");
    imageUrl = null;
  } else {
    console.log("Profile Image URL:", imageUrl);
  }

  return { name: nameText, imageUrl }; // Optional: return the data for further use
};

async function applyToJobs(page, keywords = [], experience = "2-5", maxJobs = 10) {
  console.log(`🎯 Starting job application automation: Applying to all Easy Apply jobs (Past 24 hours)`);
  try {
    // Step 2: Navigate to Jobs
    console.log("🔍 Navigating to Jobs...");
    const jobsNavSelector = 'a[aria-label="Jobs, 0 new notifications"], a[aria-label*="Jobs"]';
    const jobsLink = page.locator(jobsNavSelector).first();
    if (await jobsLink.isVisible({ timeout: 5000 })) {
      await humanMouse(page, 2);
      await jobsLink.click({ delay: 100 });
      await page.waitForURL(/linkedin\.com\/jobs/, { timeout: 10000 });
      console.log("✅ Landed on Jobs page");
    } else {
      console.log("⚠️ Jobs nav not found, direct goto...");
      await page.goto("https://www.linkedin.com/jobs/", { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    await randomDelay(2000, 4000); // Random delay before search
    // Step 3: Human-like search for "Software testing Jobs in Hyderabad" (Fixed locator for strict mode)
    console.log("🔎 Performing human-like job search...");
    // More precise locator: Use getByRole for the active combobox input
    const searchInput = page.getByRole('combobox', { name: /Search by title, skill, or company/ });
    await searchInput.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await searchInput.click({ delay: 100 });
    await randomDelay(800, 1500); // Pause before typing
    const query = "Software testing Jobs in Hyderabad";
    await humanType(page, searchInput, query); // Human typing (locator is now single element)
    await randomDelay(500, 1000);
    await searchInput.press("Enter");
    await randomDelay(2000, 4000); // Wait for results
    // Step 4: Apply "Past 24 hours" filter
    console.log("⏰ Applying 'Past 24 hours' filter...");
    const timeFilterBtn = page.locator("#searchFilter_timePostedRange, [data-test-id='job-search-time-filter']");
    await timeFilterBtn.click();
    await randomDelay(300, 800);
    const past24hOption = page.locator("label:has-text('Past 24 hours'), [for*='timePostedRange-past_24']");
    await past24hOption.click();
    await randomDelay(200, 500);
    const showResultsBtn = page.locator("button:has-text('Show results'), #searchFilter_apply").first();
    await showResultsBtn.click();
    await randomDelay(2000, 4000);
    // Step 5: Enable Easy Apply filter
    console.log("⚡ Enabling Easy Apply filter...");
    const easyApplyBtn = page.locator("#searchFilter_applyWithLinkedin, [data-test-id='job-search-easy-apply-filter']");
    await easyApplyBtn.click();
    await randomDelay(500, 1000);
   
    // Step 6: Scrape and apply to all Easy Apply jobs
    console.log("📋 Scraping and applying to Easy Apply jobs...");
    const appliedCount = { total: 0 };
    let currentPage = 1;
    let hasNext = true;
    let scrapedJobs = [];
    while (hasNext) {
      console.log(`➡️ Processing page ${currentPage}...`);
      // Human scroll through results
      await page.evaluate(async () => {
        const container = document.querySelector(".jobs-search-results-list, .semantic-search-results-list");
        if (!container) return;
        const distance = 400;
        let position = 0;
        while (position < container.scrollHeight) {
          container.scrollBy(0, distance);
          position += distance;
          const delay = Math.floor(Math.random() * 1200) + 600; // 600-1800ms
          await new Promise((r) => setTimeout(r, delay));
          if (Math.random() < 0.15) { // 15% chance longer pause
            await new Promise((r) => setTimeout(r, 4000));
          }
        }
      });
      await randomDelay(1000, 3000);
      // Updated scraping: Use page.locator and .nth(i) for stable querying without ElementHandles
      const jobListLocator = page.locator(".semantic-search-results-list__list-item");
      const jobCount = await jobListLocator.count();
      console.log(`🔍 Found ${jobCount} job items on page ${currentPage}`);
      for (let i = 0; i < jobCount; i++) {
        // Scoped locators for the i-th job item
        const itemLocator = jobListLocator.nth(i);
        const title = await itemLocator.locator(".artdeco-entity-lockup__title span[aria-hidden='true']").textContent({ timeout: 5000 }).catch(() => null);
        const company = await itemLocator.locator(".artdeco-entity-lockup__subtitle div").textContent({ timeout: 5000 }).catch(() => null);
        const locationText = await itemLocator.locator(".artdeco-entity-lockup__caption div").textContent({ timeout: 5000 }).catch(() => null);
        const posted = await itemLocator.locator("time").textContent({ timeout: 5000 }).catch(() => null);
        const link = await itemLocator.locator("a.job-card-job-posting-card-wrapper__card-link").getAttribute("href", { timeout: 5000 }).catch(() => null);
        // Check Easy Apply using locator
        const easyApplyElements = await itemLocator.locator(".job-card-job-posting-card-wrapper__footer-item").all();
        let easyApply = false;
        for (const el of easyApplyElements) {
          const text = await el.textContent({ timeout: 3000 }).catch(() => "");
          if (text && text.includes("Easy Apply")) {
            easyApply = true;
            break;
          }
        }
        if (!easyApply) {
          console.log(`⏭️ Skipping job ${i+1} (Title: ${title || 'Unknown'} at ${company || 'Unknown'}): No Easy Apply available`);
          continue;
        }
        if (!title || !link) {
          console.log(`⏭️ Skipping job ${i+1} (Title: ${title || 'Missing'} at ${company || 'Unknown'}): Missing title or job link`);
          continue;
        }
        scrapedJobs.push({ title, company, location: locationText, posted, link });
        // Visit job page to apply
        console.log(`🔍 Applying to job ${i+1}/${jobCount}: ${title} at ${company}`);
        await page.goto(link, { waitUntil: "domcontentloaded", timeout: 30000 });
        await randomDelay(5000, 10000); // Shorter simulate reading to speed up
        // Apply via Easy Apply - Reliable selector for 2025
        const jobEasyApplyBtn = page.locator('button.jobs-apply-button:has-text("Easy Apply"), button[aria-label*="Easy Apply to"], button[data-test-apply-button="true"]').first();
        if (await jobEasyApplyBtn.isVisible({ timeout: 10000 })) {
          await humanMouse(page, 1);
          await jobEasyApplyBtn.click({ delay: 100 });
          console.log("✅ Easy Apply modal opened");
          await randomDelay(2000, 4000);
          // Handle multi-step form: Fill contact info step (first modal)
          // Use getByLabel for robust field selection (works with labels in HTML)
          // First name (required, empty)
          const firstNameInput = page.getByLabel("First name");
          if (await firstNameInput.isVisible({ timeout: 5000 })) {
            await firstNameInput.fill("Tanuja"); // Use from profile or default
            console.log("📝 Filled first name");
          }
          // Last name
          const lastNameInput = page.getByLabel("Last name");
          if (await lastNameInput.isVisible({ timeout: 5000 })) {
            await lastNameInput.fill("Peddi");
            console.log("📝 Filled last name");
          }
          // Phone country code select (default "Select an option" -> choose India)
          const phoneCountrySelect = page.getByLabel("Phone country code");
          if (await phoneCountrySelect.isVisible({ timeout: 5000 })) {
            await phoneCountrySelect.selectOption("India (+91)");
            console.log("📞 Selected phone country: India");
          }
          // Mobile phone number
          const phoneInput = page.getByLabel("Mobile phone number");
          if (await phoneInput.isVisible({ timeout: 5000 })) {
            await humanType(page, phoneInput, "1234567890");
            console.log("📞 Filled mobile phone");
          }
          // Email (pre-filled select, skip or verify)
          const emailSelect = page.getByLabel("Email address");
          if (await emailSelect.isVisible({ timeout: 3000 })) {
            // Assume pre-selected, no action needed
            console.log("📧 Email pre-filled");
          }
          // Location (city)
          const locationInput = page.getByLabel("Location (city)");
          if (await locationInput.isVisible({ timeout: 5000 })) {
            await locationInput.fill("Hyderabad, Telangana, India");
            console.log("📍 Filled location");
          }
          // Click Next to proceed (from HTML: aria-label="Continue to next step", text="Next")
          const nextBtn = page.getByRole("button", { name: "Next", exact: true }).or(page.locator('button[aria-label="Continue to next step"]')).first();
          if (await nextBtn.isVisible({ timeout: 10000 })) {
            await humanMouse(page, 1);
            await nextBtn.click({ delay: 100 });
            console.log("➡️ Clicked Next - Proceeding to resume step");
            await randomDelay(2000, 4000);
            // Next step: Resume upload (common after contact info)
            // Look for file input with label "Upload your resume" or similar
            const resumeInput = page.locator('input[type="file"][accept*="pdf"], input[type="file"]:has([for*="resume"]), input[type="file"]').first();
            if (await resumeInput.isVisible({ timeout: 5000 })) {
              // Upload placeholder resume (update path to your file)
              await resumeInput.setInputFiles("path/to/your-resume.pdf"); // e.g., "./resume.pdf"
              console.log("📎 Uploaded resume");
              await randomDelay(3000, 5000); // Wait for upload
            } else {
              console.log("⚠️ No resume upload found - skipping");
            }
            // Possible additional questions - Skip if present
            const skipBtn = page.getByRole("button", { name: "Skip", exact: true }).or(page.locator('button:has-text("Skip for now")')).first();
            if (await skipBtn.isVisible({ timeout: 3000 })) {
              await skipBtn.click();
              console.log("❓ Skipped questions");
              await randomDelay(1000, 2000);
            }
            // Final Submit (after resume/next)
            const submitBtn = page.getByRole("button", { name: "Submit application", exact: true }).or(page.locator('button[aria-label="Submit application"]')).first();
            if (await submitBtn.isVisible({ timeout: 10000 })) {
              await humanMouse(page, 1);
              await submitBtn.click({ delay: 100 });
              console.log(`📤 Applied to: ${title}`);
              appliedCount.total++;
            } else {
              console.log(`⚠️ Final Submit button not found for ${title} - Form may be incomplete`);
            }
          } else {
            console.log(`⚠️ Next button not found for ${title} - Check form fields`);
          }
          await randomDelay(2000, 5000); // Post-apply pause
          // Close modal if needed
          const closeModal = page.locator('button[aria-label="Dismiss"], .artdeco-modal__dismiss').first();
          if (await closeModal.isVisible({ timeout: 3000 })) {
            await closeModal.click();
          }
        } else {
          console.log(`⚠️ Easy Apply button not found for ${title}`);
        }
        // Go back to search results with explicit wait
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 });
        await randomDelay(1000, 3000);
      }
      // Pagination - Updated to use locator
      const nextBtn = page.locator("button[aria-label='View next page'], #pagination-next-btn, li[role='presentation']:last-child button");
      hasNext = await nextBtn.isVisible({ timeout: 3000 }) && !(await nextBtn.isDisabled());
      if (hasNext) {
        await humanMouse(page, 1);
        await nextBtn.click();
        await randomDelay(2000, 4000);
        currentPage++;
      } else {
        hasNext = false;
      }
    }
    console.log(`✅ Finished! Applied to ${appliedCount.total} Easy Apply jobs. Scraped ${scrapedJobs.length} jobs total.`);
  } catch (err) {
    console.error("❌ Job application failed:", err.message);
  }
};
// Function to send connection request with a personalized note
async function sendConnectionRequestWithNote(page, url) {
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
      console.log(`⛔ Skipping profile ${profileName} (${url}) - Pending acceptance`);
      return;
    }
    const degree = await detectDegree(page);
    const pendingSelectors = [
      ".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')",
      'button[aria-label^="Pending, click to withdraw invitation"]:has(svg[id="clock-small"])',
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
      'div[data-view-name="edge-creation-connect-action"] a',
      `[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label^="Invite"][aria-label*="to connect"]`
    ];
    const connectButton = await getVisibleLocator(page, connectSelectors, true);  // Use .last() for alternatives
    const moreSelectors = [
      ".ph5 [aria-label='More actions']",
      'div[data-view-name="relationship-building-button"] ~ button[data-view-name="profile-overflow-button"][aria-label="More"]',
      'div[data-view-name="relationship-building-button"] + a[data-view-name="profile-secondary-message"] + button[data-view-name="profile-overflow-button"]',
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
    // Prepare note message from environment variable
    let noteMessage = process.env.CONNECTION_NOTE || `Hi ${profileName}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    if (noteMessage.includes('${profileName}')) {
      noteMessage = noteMessage.replace(/\${profileName}/g, profileName);
    }
    // Proceed with connect if available
    if (connectButton) {
      await humanMouse(page, 2);
      await connectButton.click({ delay: 100 });
      console.log("💡 Connect button clicked");
      // Wait for modal to load
      try {
        await page.waitForSelector('[role="dialog"]', { state: "visible", timeout: 30000 });
        // Click Add a note button
        const addNoteButton = page.locator('[aria-label="Add a note"]').first();
        await addNoteButton.waitFor({ state: "visible", timeout: 10000 });
        await humanMouse(page, 1);
        await addNoteButton.click({ delay: 100 });
        console.log("📝 Add note button clicked");
        await randomDelay(500, 1000);
        // Wait for input box and type message
        const inputSelectors = [".connect-button-send-invite__custom-message-box", "#custom-message"];
        let messageInput = null;
        for (const selector of inputSelectors) {
          try {
            const input = page.locator(selector).first();
            await input.waitFor({ state: "visible", timeout: 10000 });
            messageInput = input;
            break;
          } catch (err) {
            console.log(`⚠️ Input selector ${selector} not found, trying next`);
          }
        }
        if (messageInput) {
          await humanType(page, messageInput, noteMessage);
          console.log("📝 Note message typed");
          await randomDelay(500, 1000);
          // Click Send invitation button
          const sendButton = page.locator('[aria-label="Send invitation"]').first();
          await sendButton.waitFor({ state: "visible", timeout: 10000 });
          await humanMouse(page, 1);
          await sendButton.click({ delay: 100 });
          console.log("✅ Connection request with note sent");
          await randomDelay(2000, 4000);
        } else {
          console.log("⚠️ Message input not found after adding note");
        }
      } catch (e) {
        console.log("⚠️ Modal or add note elements not found after connect click:", e.message);
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
      const connectDropdown = await getVisibleLocator(page, dropdownSelectors, true);  // Use .last() for alternatives
      if (connectDropdown) {
        await humanMouse(page, 1);
        await connectDropdown.click({ delay: 100 });
        console.log("💡 Connect from dropdown clicked");
        // Wait for modal to load
        try {
          await page.waitForSelector('[role="dialog"]', { state: "visible", timeout: 30000 });
          // Click Add a note button
          const addNoteButton = page.locator('[aria-label="Add a note"]').first();
          await addNoteButton.waitFor({ state: "visible", timeout: 10000 });
          await humanMouse(page, 1);
          await addNoteButton.click({ delay: 100 });
          console.log("📝 Add note button clicked");
          await randomDelay(500, 1000);
          // Wait for input box and type message
          const inputSelectors = [".connect-button-send-invite__custom-message-box", "#custom-message"];
          let messageInput = null;
          for (const selector of inputSelectors) {
            try {
              const input = page.locator(selector).first();
              await input.waitFor({ state: "visible", timeout: 10000 });
              messageInput = input;
              break;
            } catch (err) {
              console.log(`⚠️ Input selector ${selector} not found, trying next`);
            }
          }
          if (messageInput) {
            await humanType(page, messageInput, noteMessage);
            console.log("📝 Note message typed");
            await randomDelay(500, 1000);
            // Click Send invitation button
            const sendButton = page.locator('[aria-label="Send invitation"]').first();
            await sendButton.waitFor({ state: "visible", timeout: 10000 });
            await humanMouse(page, 1);
            await sendButton.click({ delay: 100 });
            console.log("✅ Connection request with note sent");
            await randomDelay(2000, 4000);
          } else {
            console.log("⚠️ Message input not found after adding note");
          }
        } catch (e) {
          console.log("⚠️ Modal or add note elements not found after dropdown connect:", e.message);
        }
      }
    } else if (degree === "unknown") {
      console.log(`⚠️ No connect opportunity despite unknown degree - skipping`);
    }
    console.log(`✅ Finished processing ${profileName} (${url})`);
  } catch (err) {
    console.error(`❌ Failed to send connection request with note to ${url}: ${err.message}`);
  }
};

// Function to post a text update to LinkedIn feed
async function postToFeed(page) {
  const content = process.env.POST_CONTENT || "As a QA engineer, I've been diving deep into automated testing frameworks lately. What's your go-to tool for ensuring robust test coverage? Sharing thoughts in the comments! #QA #Testing #Automation";
  console.log("📝 Starting to post to LinkedIn feed...");
  try {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("✅ Navigated to LinkedIn feed");
    
    // Perform random scrolling sessions to simulate browsing
    const scrollSessions = Math.floor(Math.random() * 3) + 2; // 2-4 sessions
    for (let session = 1; session <= scrollSessions; session++) {
      console.log(`🔄 Pre-post scrolling session ${session}/${scrollSessions}...`);
      await humanScroll(page, Math.floor(Math.random() * 4) + 2);
      const pauseTime = Math.random() * 5000 + 2000; // 2-7 seconds
      await page.waitForTimeout(pauseTime);
      if (Math.random() > 0.4) {
        console.log("🖱️ Simulating mouse movement...");
        await humanMouse(page, Math.floor(Math.random() * 3) + 1);
      }
    }
    await humanIdle(1000, 3000);
    
    // Click on "Start post" button
    const startPostSelector = ".share-box-feed-entry__top-bar button:has(span[class='artdeco-button__text'])";
    const startPostButton = page.locator(startPostSelector).first();
    await startPostButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 2);
    await startPostButton.click({ delay: 100 });
    console.log("✏️ 'Start post' button clicked");
    
    await humanIdle(1500, 3500);
    
    // Click and type in the text editor
    const editorSelector = "div[aria-label='Text editor for creating content']";
    const editor = page.locator(editorSelector).first();
    await editor.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await editor.click({ delay: 100 });
    console.log("⌨️ Text editor focused");
    
    await humanType(page, editor, content);
    console.log("📝 Post content typed");
    
    await humanIdle(1000, 2000);
    
    // Click post button
    const postButtonSelector = "button[class$='share-actions__primary-action artdeco-button artdeco-button--2 artdeco-button--primary ember-view']";
    const postButton = page.locator(postButtonSelector).first();
    await postButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await postButton.click({ delay: 100 });
    console.log("✅ Post submitted");
    
    await humanIdle(3000, 6000); // Wait for post to appear
    console.log("✅ Finished posting to feed");
  } catch (err) {
    console.error("❌ Failed to post to feed:", err.message);
  }
};

// Function to post an image to LinkedIn feed
async function postImageToFeed(page) {
  const imagePath = process.env.IMAGE_PATH || "C:\\Users\\gopikrishna.m\\Downloads\\productImage.png";
  const content = process.env.POST_CONTENT_IMAGE || 
  "As a QA engineer, I've been diving deep into automated testing frameworks lately. What's your go-to tool for ensuring robust test coverage? Sharing thoughts in the comments! #QA #Testing #Automation";

  console.log("📝 Starting to post to LinkedIn feed...");
  try {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("✅ Navigated to LinkedIn feed");
    
    // Perform random scrolling sessions to simulate browsing
    const scrollSessions = Math.floor(Math.random() * 3) + 2; // 2-4 sessions
    for (let session = 1; session <= scrollSessions; session++) {
      console.log(`🔄 Pre-post scrolling session ${session}/${scrollSessions}...`);
      await humanScroll(page, Math.floor(Math.random() * 4) + 2);
      const pauseTime = Math.random() * 5000 + 2000; // 2–7s
      await page.waitForTimeout(pauseTime);
      if (Math.random() > 0.4) {
        console.log("🖱️ Simulating mouse movement...");
        await humanMouse(page, Math.floor(Math.random() * 3) + 1);
      }
    }
    await humanIdle(1000, 3000);
    
    // Click on "Start post" button
    const startPostSelector = ".share-box-feed-entry__top-bar button:has(span[class='artdeco-button__text'])";
    const startPostButton = page.locator(startPostSelector).first();
    await startPostButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 2);
    await startPostButton.click({ delay: 100 });
    console.log("✏️ 'Start post' button clicked");
    
    await humanIdle(1500, 3500);
    
    // Type post content
    const editorSelector = "div[aria-label='Text editor for creating content']";
    const editor = page.locator(editorSelector).first();
    await editor.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await editor.click({ delay: 100 });
    console.log("⌨️ Text editor focused");
    
    await humanType(page, editor, content);
    console.log("📝 Post content typed");

    await humanIdle(1000, 2000);

    // Check and click preview container button if visible (e.g., close/cancel overlay)
    const previewBtnSelector = "button[class$='share-creation-state__preview-container-btn artdeco-button artdeco-button--circle artdeco-button--muted artdeco-button--1 artdeco-button--primary ember-view']";
    const previewBtn = page.locator(previewBtnSelector).first();
    if (await previewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("🗑️ Preview container button visible — clicking to dismiss...");
      await humanMouse(page, 1);
      await previewBtn.click({ delay: 100 });
      await humanIdle(500, 1500);
    } else {
      console.log("ℹ️ No preview container button found — proceeding...");
    }

    // Add image
    const addPhotoSelector = "button[aria-label='Add media'] span[class='share-promoted-detour-button__icon-container']";
    const addPhotoButton = page.locator(addPhotoSelector).first();
    await addPhotoButton.waitFor({ state: "visible", timeout: 15000 });
    console.log("🖱️ 'Add a photo' button found");

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      addPhotoButton.click({ delay: 100 }),
    ]);
    console.log("🖼️ File chooser triggered successfully");

    await fileChooser.setFiles(imagePath);
    console.log("✅ Image uploaded via Playwright (no explorer opened)");
    await humanIdle(3000, 5000); // wait for LinkedIn to show preview
    const nxtBtn = page.locator("button[aria-label='Next']").first();
    await nxtBtn.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await nxtBtn.click({ delay: 100 });
    console.log("➡️ 'Next' button clicked — preview confirmed");

    await humanIdle(3000, 5000); // wait for preview
    const imgPreviewSelector = "img[alt$='Image preview']";
    const imgPreview = page.locator(imgPreviewSelector).first();
    await imgPreview.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await imgPreview.scrollIntoViewIfNeeded();
    console.log("🖼️ Image preview in view");
    await humanIdle(3000, 5000);
    // Click Post
    const postButtonSelector =
      "button[class$='share-actions__primary-action artdeco-button artdeco-button--2 artdeco-button--primary ember-view']";
    const postButton = page.locator(postButtonSelector).first();
    await postButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await postButton.click({ delay: 100 });
    console.log("✅ Post submitted");

    await humanIdle(3000, 6000);
    console.log("🎉 Finished posting to feed");
  } catch (err) {
    console.error("❌ Failed to post to feed:", err.message);
  }
}

/* ---------------------------
   Function to comment on a random post in the feed
--------------------------- */
async function commentFeed(page) {
  const commentText = process.env.POST_COMMENT || "Great insights! What's your take on this? #LinkedIn #Engagement";
  console.log("💬 Starting to comment on a random post...");
  try {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanScroll(page, 5);
    await humanIdle(2000, 4000);
    const commentButtons = await page.locator("button[aria-label='Comment']").all();
    if (commentButtons.length === 0) {
      console.log("⚠️ No Comment buttons found on the feed");
      return;
    }
    const randomIndex = Math.floor(Math.random() * commentButtons.length);
    const selectedButton = commentButtons[randomIndex];
    console.log(`🎯 Selected random post ${randomIndex + 1} of ${commentButtons.length} for commenting`);
    await humanMouse(page, 2);
    await selectedButton.scrollIntoViewIfNeeded();
    await selectedButton.click({ delay: 100 });
    console.log("💭 Comment button clicked");

    await humanIdle(1500, 3000);

    // Focus and type in the comment editor (target the div, not the inner p to avoid scroll issues)
    const editorSelector = "div[aria-label='Text editor for creating content']";
    const editor = page.locator(editorSelector).first();
    await editor.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await editor.click({ delay: 100 });
    console.log("⌨️ Comment editor focused");
    await humanType(page, editorSelector, commentText);
    console.log("📝 Comment typed");

    await humanIdle(1000, 2000);

    // Scroll to ensure post button is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await humanIdle(500, 1000);

    // Click post button (more precise selector with :has for inner text span)
    const postButtonSelector = "button.artdeco-button.artdeco-button--1.artdeco-button--primary:has(span.artdeco-button__text)";
    const postButton = page.locator(postButtonSelector).first();
    await postButton.waitFor({ state: "visible", timeout: 15000 });
    await postButton.scrollIntoViewIfNeeded();
    await humanMouse(page, 1);
    await postButton.click({ delay: 100 });
    console.log("✅ Comment posted");

    await randomDelay(1000, 2000);
    console.log("✅ Finished commenting on the post");
    await humanIdle(3000, 6000);
  } catch (err) {
    console.error("❌ Failed to comment on post:", err.message);
  }
}

// Send Folloowup Message
async function sendFollowUpMessageToProfile(page, url) {
  console.log(`💬 Processing profile for follow-up messaging: ${url}`);
  await randomDelay(2000, 4000);
  await humanScroll(page, Math.floor(Math.random() * 3) + 2);
  await humanMouse(page, Math.floor(Math.random() * 4) + 3);
  await randomDelay(2000, 6000);

  try {
    // Step 1️⃣ — Load profile page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await closeAllMessageBoxes(page);

    // Additional human mimic: Scroll and hover on profile to simulate reading
    await humanScroll(page, Math.floor(Math.random() * 3) + 2);
    await humanMouse(page, Math.floor(Math.random() * 4) + 3);
    await humanIdle(1500, 3000);

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

    // Additional human mimic: Hover near message button before clicking
    await humanMouse(page, 2);
    await randomDelay(500, 1500);

    // Step 4️⃣ — Open message dialog
    await messageButton.click({ delay: 100 });
    console.log("💬 Message box opened");
    await randomDelay(1000, 2000);

    // Additional human mimic: Small idle and mouse move in dialog
    await humanIdle(800, 2000);
    await humanMouse(page, 1);

    // Step 5️⃣ — Locate message input (and optional subject)
    const messageInputSelector = "div.msg-form__contenteditable";
    const messageInput = page.locator(messageInputSelector);
    await messageInput.waitFor({ state: "visible", timeout: 10000 });

    // 🔹 Check if "Subject (optional)" field exists (less likely for follow-ups in direct threads)
    const subjectSelector = "input[placeholder='Subject (optional)']";
    const subjectInput = page.locator(subjectSelector);

    try {
      const subjectVisible = await subjectInput.isVisible({ timeout: 2000 });
      if (subjectVisible) {
        console.log("✏️ Subject field detected — typing follow-up subject...");
        await humanType(
          page,
          subjectSelector,
          "Follow-up on previous message"
        );
        await randomDelay(500, 1000);
        console.log("✅ Subject typed successfully");
      } else {
        console.log("ℹ️ No subject field found — skipping subject step");
      }
    } catch {
      console.log("ℹ️ Subject field not present — continuing to message");
    }

    // Step 6️⃣ — Type follow-up message
    const followUpMessage = `Hi ${profileName}, I hope this message finds you well. Following up on my previous message regarding potential opportunities. Are you available for a quick chat? Looking forward to your response!`;
    await humanType(page, messageInputSelector, followUpMessage);
    console.log("📝 Follow-up message typed");

    // Additional human mimic: Idle after typing, simulate reading back
    await humanIdle(1000, 2500);
    await humanMouse(page, 1);

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
    console.log(`📨 Follow-up message sent to ${profileName}`);

    // Step 8️⃣ — Wrap up
    await randomDelay(2000, 4000);
    await closeAllMessageBoxes(page);
    console.log(`✅ Finished sending follow-up message to ${url}`);
  } catch (err) {
    console.error(`❌ Failed to send follow-up message to ${url}: ${err.message}`);
  }
};



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
      check_degree: async () => { for (const url of PROFILE_URLS) await checkDegree(page, url); },
      send_message: async () => { for (const url of PROFILE_URLS) await sendMessage(page, url); },
      send_connection_request: async () => { for (const url of PROFILE_URLS) await sendConnectionRequest(page, url); },
      send_connection_request_with_note: async () => { for (const url of PROFILE_URLS) await sendConnectionRequestWithNote(page, url); },
      check_connection_accepted: async () => { for (const url of PROFILE_URLS) await checkConnectionAccepted(page, url); },
      check_reply: async () => { for (const url of PROFILE_URLS) await checkReply(page, url); },
      grab_replies: async () => { for (const url of PROFILE_URLS) await grabReplies(page, url); },
      send_follow: async () => { for (const url of PROFILE_URLS) await sendFollow(page, url); },
      send_follow_any: async () => { for (const url of PROFILE_URLS) await sendFollowAny(page, url); },
      withdraw_request: async () => { for (const url of PROFILE_URLS) await withdrawRequest(page, url); },
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
      
      like_user_post: async () => {
        console.log(`👍 Liking random posts on ${PROFILE_URLS.length} user profiles...`);
        for (const url of PROFILE_URLS) {
          await likeRandomUserPost(page, url);
          await humanIdle(5000, 10000); // Longer pause between profiles to avoid rate limits
        }
      },
      withdraw_all_follows: withdrawAllFollows, // New action
      withdraw_all_sent_requests: withdrawAllSentRequests, // New bulk withdraw action
      check_post_impressions: checkPostImpressions,
      scrape_connections: scrapeConnections,
      grab_profile_image: grabProfileImage,
      apply_jobs: async () => {
        const keywords = process.env.JOB_KEYWORDS.split(",").map(k => k.trim());
        const experience = process.env.EXPERIENCE;
        const maxJobs = parseInt(process.env.MAX_JOBS);
        await applyToJobs(page, keywords, experience, maxJobs);
      },
      post_to_feed: async () => await postToFeed(page),
      post_image_to_feed: async () => await postImageToFeed(page),
      comment_feed: commentFeed,
      send_followup_message: async () => {
  if (PROFILE_URLS.length > 0) {
    console.log(
      `💬 Sending follow-up messages to ${PROFILE_URLS.length} profiles...`
    );
    for (const url of PROFILE_URLS) {
      await sendFollowUpMessageToProfile(page, url);
      await humanIdle(3000, 6000); // Pause between profiles
    }
  } else {
    console.log("⚠️ No PROFILE_URLS provided. Skipping follow-up message sending.");
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

});
