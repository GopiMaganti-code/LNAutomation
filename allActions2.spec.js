require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Configuration
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Thanuja.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
const PROFILE_URLS = (process.env.PROFILE_URLS || "").split(",").map(url => url.replace(/"/g, "").trim()).filter(url => url);
const ACTION = process.env.ACTION || "view_feed"; // Default action

// Centralized Selectors
const SELECTORS = {
  login: {
    username: "#username",
    password: "#password",
    submit: 'button[type="submit"]',
    rememberMe: 'label[for="rememberMeOptIn-checkbox"]',
    authLink: 'a:has-text("Verify using authenticator app")',
    totpInput: 'input[name="pin"][maxlength="6"]',
    totpSubmit: '#two-step-submit-button, button[type="submit"]',
  },
  feed: {
    content: [".scaffold-layout__content", ".feed-container"],
    likeButton: ".reactions-react-button button[aria-label*='Like']",
  },
  profile: {
    name: ["h1", ".text-heading-xlarge"],
    degree: {
      visible: ".distance-badge .dist-value",
      hidden: ".distance-badge .visually-hidden",
    },
    messageButton: ".ph5 button:has-text('Message')",
    messageInput: "div.msg-form__contenteditable",
    sendButton: "button.msg-form__send-button",
    acceptButton: ".ph5 [aria-label*='Accept']",
    pendingWithdrawButton: ".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')",
    connectButton: ".ph5 button:has-text('Connect')",
    moreButton: ".ph5 [aria-label='More actions']",
    connectDropdown: ".ph5 .artdeco-dropdown__content-inner span:has-text('Connect')",
    followButton: [".ph5.pb5 [aria-label*='Follow']", ".ph5 [aria-label*='Follow']"],
    dropdownFollow: ".ph5.pb5 .artdeco-dropdown__content-inner [aria-label*='Follow']",
    headerWithdraw: ".ph5 [aria-label*='Pending, click to withdraw invitation sent to']",
    dropdownWithdraw: ".ph5 .artdeco-dropdown__content [aria-label*='Pending, click to withdraw invitation sent to']",
    withdrawDialog: "div[role='alertdialog'] button:has-text('Withdraw')",
    removeConnection: ".artdeco-dropdown__content span:has-text('Remove Connection')",
    withdrawOption: ".artdeco-dropdown__content span:has-text('Withdraw')",
    messageClose: ["button:has-text('Close your conversation')", ".msg-overlay-bubble-header__control svg[use*='close-small']"],
    replyIndicator: ".msg-s-event-listitem--other",
  },
};

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
  const closeButtons = page.locator(SELECTORS.profile.messageClose[0]).or(page.locator(SELECTORS.profile.messageClose[1]));
  const buttons = await closeButtons.all();
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
    let feedLoaded = false;
    for (const selector of SELECTORS.feed.content) {
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
    const likeButtons = await page.locator(SELECTORS.feed.likeButton).all();
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
    for (const selector of SELECTORS.profile.name) {
      try { name = await page.locator(selector).innerText({ timeout: 5000 }) || "Unknown User"; break; } catch (err) { console.log(`⚠️ Name locator ${selector} failed: ${err.message}`); }
    }
    let degreeText = null;
    for (const selector of [SELECTORS.profile.degree.visible, SELECTORS.profile.degree.hidden]) {
      try { degreeText = await page.locator(selector).innerText({ timeout: 5000 }); if (degreeText) break; } catch (err) { console.log(`⚠️ Degree locator ${selector} failed: ${err.message}`); }
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
    try { profileName = await page.locator(SELECTORS.profile.name[0]).textContent({ timeout: 5000 }).then(text => text.trim()) || "Friend"; } catch (err) { console.log(`⚠️ Failed to get profile name: ${err.message}`); }
    let is1stDegree = false;
    for (const selector of [SELECTORS.profile.degree.visible, SELECTORS.profile.degree.hidden]) {
      try { const connectionInfo = await page.locator(selector).textContent({ timeout: 5000 }); if (connectionInfo.toLowerCase().includes("1st")) { is1stDegree = true; break; } } catch (err) { console.log(`⚠️ Skipping ${selector}: ${err.message}`); }
    }
    if (!is1stDegree) {
      console.log(`⛔ Skipping message to ${url} - Not a 1st degree connection`);
      return;
    }
    const messageButton = page.locator(SELECTORS.profile.messageButton);
    await messageButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 2);
    await messageButton.click({ delay: 100 });
    console.log("💬 Message box opened");
    await randomDelay(1000, 2000);
    const message = `Hi ${profileName || "Friend"}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    const messageInput = page.locator(SELECTORS.profile.messageInput);
    await messageInput.waitFor({ state: "visible", timeout: 10000 });
    await humanType(page, SELECTORS.profile.messageInput, message);
    console.log("📝 Message typed");
    const sendButton = page.locator(SELECTORS.profile.sendButton);
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

async function sendConnectionRequest(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanIdle(2000, 4000);
    await closeAllMessageBoxes(page);
    let profileName = "";
    try { profileName = await page.locator(SELECTORS.profile.name[0]).textContent({ timeout: 5000 }).then(text => text.trim()) || "Friend"; } catch (err) { console.log(`⚠️ Failed to get profile name: ${err.message}`); }
    const acceptButton = page.locator(SELECTORS.profile.acceptButton);
    if (await acceptButton.isVisible({ timeout: 5000 })) {
      await humanMouse(page, 2);
      await acceptButton.click({ delay: 100 });
      console.log("✅ Accepted connection request");
      await randomDelay(2000, 4000);
      return;
    }
    let degree = "unknown";
    for (const selector of [SELECTORS.profile.degree.hidden, SELECTORS.profile.degree.visible]) {
      try { const connectionInfo = await page.locator(selector).textContent({ timeout: 5000 }); if (connectionInfo.toLowerCase().includes("2nd") || connectionInfo.toLowerCase().includes("3rd")) { degree = connectionInfo.toLowerCase().includes("2nd") ? "2nd" : "3rd"; break; } else if (connectionInfo.toLowerCase().includes("1st")) { degree = "1st"; break; } } catch (err) { console.log(`⚠️ Skipping ${selector}: ${err.message}`); }
    }
    if (degree === "1st" || degree === "unknown") {
      console.log(`⛔ Skipping connection request to ${url} - Already connected or degree not detected`);
      return;
    }
    const pendingWithdrawButton = page.locator(SELECTORS.profile.pendingWithdrawButton);
    if (await pendingWithdrawButton.isVisible({ timeout: 5000 })) {
      console.log("⚠️ Found Pending/Withdraw button, No Action needed");
      await randomDelay(1000, 2000);
      return;
    }
    const connectButton = page.locator(SELECTORS.profile.connectButton);
    if (await connectButton.isVisible({ timeout: 5000 })) {
      await humanMouse(page, 2);
      await connectButton.click({ delay: 100 });
      console.log("💡 Connect button clicked");
      await randomDelay(1000, 2000);
      const sendButton = page.locator("button:has-text('Send')");
      if (await sendButton.isVisible({ timeout: 5000 })) {
        await humanMouse(page, 1);
        await sendButton.click({ delay: 100 });
        console.log("✅ Connection request sent");
        await randomDelay(2000, 4000);
      }
      return;
    }
    const moreButton = page.locator(SELECTORS.profile.moreButton);
    if (await moreButton.isVisible({ timeout: 5000 })) {
      await humanMouse(page, 2);
      await moreButton.click({ delay: 100 });
      console.log("💡 More button clicked");
      await randomDelay(1000, 2000);
      const connectDropdown = page.locator(SELECTORS.profile.connectDropdown);
      if (await connectDropdown.isVisible({ timeout: 5000 })) {
        await humanMouse(page, 1);
        await connectDropdown.click({ delay: 100 });
        console.log("💡 Connect from dropdown clicked");
        await randomDelay(1000, 2000);
        const sendButton = page.locator("button:has-text('Send')");
        if (await sendButton.isVisible({ timeout: 5000 })) {
          await humanMouse(page, 1);
          await sendButton.click({ delay: 100 });
          console.log("✅ Connection request sent");
          await randomDelay(2000, 4000);
        }
      }
    }
    console.log(`✅ Finished processing ${url}`);
  } catch (err) {
    console.error(`❌ Failed to send connection request to ${url}: ${err.message}`);
  }
}

async function checkConnectionAccepted(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1000, 3000);
    let profileName = "Unknown";
    try { profileName = await page.locator(SELECTORS.profile.name[0]).textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown"; } catch (err) { console.log(`⚠️ Profile name not found: ${err.message}`); }
    let degree = "Unknown degree";
    try { degree = await page.locator(SELECTORS.profile.degree.hidden).textContent({ timeout: 5000 }).then(text => text.trim().toLowerCase()) || await page.locator(SELECTORS.profile.degree.visible).textContent({ timeout: 5000 }).then(text => text.trim().toLowerCase()) || "Unknown degree"; } catch (err) { console.log(`⚠️ Degree not found: ${err.message}`); }
    let status = "Unknown";
    if (degree.includes("1st")) {
      status = "Accepted";
      console.log(`✅ ${profileName}: ${degree} - ${status}`);
    } else {
      const acceptButton = page.locator(SELECTORS.profile.acceptButton).first();
      const pendingButton = page.locator(SELECTORS.profile.pendingWithdrawButton).first();
      const connectButton = page.locator(SELECTORS.profile.connectButton).first();
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
        const moreButton = page.locator(SELECTORS.profile.moreButton).first();
        if (await moreButton.isVisible({ timeout: 5000 })) {
          await moreButton.click({ delay: 100 });
          await randomDelay(1000, 2000);
          const removeConnection = page.locator(SELECTORS.profile.removeConnection).last();
          const withdrawOption = page.locator(SELECTORS.profile.withdrawOption).first();
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
    await randomDelay(1000, 3000);
    let profileName = "Unknown";
    try { profileName = await page.locator(SELECTORS.profile.name[0]).textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown"; } catch (err) { console.log(`⚠️ Profile name not found: ${err.message}`); }
    let replyStatus = "No Reply Received";
    const messageButton = page.locator(SELECTORS.profile.messageButton).first();
    if (await messageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await messageButton.click();
      await randomDelay(4000, 7000);
      const hasReply = await page.locator(SELECTORS.profile.replyIndicator).isVisible({ timeout: 5000 }).catch(() => false);
      replyStatus = hasReply ? "Reply Received" : "No Reply Received";
      console.log(`Sender: ${profileName}`);
      console.log(`  - Reply Status: ${replyStatus}`);
      const closeButton = page.locator(SELECTORS.profile.messageClose[0]).first();
      const altClose = page.locator(SELECTORS.profile.messageClose[1]).first();
      if (await closeButton.isVisible({ timeout: 5000 })) await closeButton.click();
      else if (await altClose.isVisible({ timeout: 5000 })) await altClose.click();
      await randomDelay(1000, 2000);
    } else {
      console.log(`⚠️ Message button not found for ${profileName}`);
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
    try { profileName = await page.locator(SELECTORS.profile.name[0]).textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown"; } catch (err) { console.log(`⚠️ Profile name not found: ${err.message}`); }
    let degree = "Unknown";
    try {
      let degreeText = await page.locator(SELECTORS.profile.degree.visible).textContent({ timeout: 5000 }).catch(() => "");
      if (!degreeText) degreeText = await page.locator(SELECTORS.profile.degree.hidden).textContent({ timeout: 5000 }).catch(() => "");
      degree = degreeText.toLowerCase().includes("3rd") ? "3rd" : degreeText.toLowerCase().includes("2nd") ? "2nd" : degreeText.toLowerCase().includes("1st") ? "1st" : "Unknown";
    } catch (err) { console.log(`⚠️ Degree not found: ${err.message}`); }
    if (degree === "3rd") {
      let followButton = page.locator(SELECTORS.profile.followButton[0]).first();
      if (await followButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await followButton.click();
        console.log(`✅ Followed ${profileName} via header`);
      } else {
        followButton = page.locator(SELECTORS.profile.followButton[1]).first();
        if (await followButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await followButton.click();
          console.log(`✅ Followed ${profileName} via secondary header`);
        } else {
          const moreButton = page.locator(SELECTORS.profile.moreButton).first();
          if (await moreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await moreButton.click();
            await randomDelay(1000, 2000);
            const dropdownFollow = page.locator(SELECTORS.profile.dropdownFollow).first();
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
    try { profileName = await page.locator(SELECTORS.profile.name[0]).textContent({ timeout: 5000 }).then(text => text.trim()) || "Unknown"; } catch (err) { console.log(`⚠️ Profile name not found: ${err.message}`); }
    const headerWithdraw = page.locator(SELECTORS.profile.headerWithdraw).first();
    if (await headerWithdraw.isVisible({ timeout: 5000 }).catch(() => false)) {
      await headerWithdraw.click();
      await randomDelay(1000, 2000);
    } else {
      const moreButton = page.locator(SELECTORS.profile.moreButton).first();
      if (await moreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await moreButton.click();
        await randomDelay(1000, 2000);
        const dropdownWithdraw = page.locator(SELECTORS.profile.dropdownWithdraw).first();
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
    const withdrawButton = page.locator(SELECTORS.profile.withdrawDialog).first();
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

      if (await page.locator(SELECTORS.login.username).isVisible({ timeout: 5000 })) {
        console.log("🔐 Logging in...");
        await humanType(page, SELECTORS.login.username, process.env.LINKEDIN_EMAIL);
        await humanIdle(600, 1600);
        await humanType(page, SELECTORS.login.password, process.env.LINKEDIN_PASSWORD);
        await humanIdle(600, 1600);
        await page.locator(SELECTORS.login.rememberMe).click().catch(() => console.log("Remember Me checkbox not found, skipping."));
        await humanIdle(600, 1600);
        await page.locator(SELECTORS.login.submit).click();
        await randomDelay(1000, 2000);

        const authLink = page.locator(SELECTORS.login.authLink);
        if (await authLink.isVisible({ timeout: 5000 })) await authLink.click();
        const totpInput = page.locator(SELECTORS.login.totpInput);
        if (await totpInput.isVisible({ timeout: 5000 })) {
          console.log("🔑 Using TOTP MFA...");
          const token = speakeasy.totp({ secret: process.env.LINKEDIN_TOTP_SECRET, encoding: "base32" });
          await humanType(page, SELECTORS.login.totpInput, token);
          await randomDelay(700, 1400);
          await page.locator(SELECTORS.login.totpSubmit).first().click();
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