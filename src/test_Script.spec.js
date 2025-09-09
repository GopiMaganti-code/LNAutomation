const { test, chromium, expect } = require("@playwright/test");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const fs = require("fs");
require("dotenv").config();

// -------------------------
// Time Helper (IST)
// -------------------------
function getISTDateTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// -------------------------
// Human-like helper functions (safe & stable)
// -------------------------
function randomDelay(min = 2000, max = 10000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function humanClick(page, selectorOrLocator) {
  const locator =
    typeof selectorOrLocator === "string"
      ? page.locator(selectorOrLocator)
      : selectorOrLocator;

  await expect(locator).toBeVisible({ timeout: 10000 });

  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(
      box.x + box.width / 2 + (Math.random() * 10 - 5),
      box.y + box.height / 2 + (Math.random() * 10 - 5),
      { steps: 10 }
    );
  }

  await randomDelay(500, 1500);
  await locator.click().catch(() => {});
}

async function humanType(locator, text) {
  await expect(locator).toBeVisible({ timeout: 10000 });
  for (const char of text) {
    await locator.type(char, {
      delay: 80 + Math.floor(Math.random() * 120),
    });
  }
}

async function humanScrollAndMove(page) {
  const viewport = page.viewportSize() || { width: 1280, height: 720 };
  const scrollAmount = Math.floor(Math.random() * 400 + 200);
  await page.mouse.wheel(0, scrollAmount);
  await page.waitForTimeout(500 + Math.random() * 500);
  const x = Math.floor(Math.random() * viewport.width);
  const y = Math.floor(Math.random() * viewport.height);
  await page.mouse.move(x, y, { steps: 15 });
}

// -------------------------
// LinkedIn login
// -------------------------
async function loginToLinkedIn(page) {
  console.log("🌐 Navigating to LinkedIn login page...");
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });
  await randomDelay();
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  if (!email || !password)
    throw new Error("LinkedIn credentials missing in .env");

  console.log("🔑 Filling credentials...");
  await humanType(page.locator("#username"), email);
  await randomDelay();
  await humanType(page.locator("#password"), password);
  await randomDelay();

  console.log("➡️ Submitting login...");
  await humanClick(page, 'button[type="submit"]');
  await page
    .waitForNavigation({ waitUntil: "networkidle", timeout: 60000 })
    .catch(() => {
      console.log("⚠️ Login navigation timed out, continuing...");
    });
  console.log("✅ Logged into LinkedIn");
}

// -------------------------
// Campaign Actions
// -------------------------
async function sendConnectionRequest(page, profileUrl, row) {
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await randomDelay();

  let connectBtn = page.locator('.ph5 button:has-text("Connect")');
  if ((await connectBtn.count()) === 0) {
    const moreBtn = page.locator('.ph5 button:has-text("More")').first();
    if (await moreBtn.count()) {
      await humanClick(page, moreBtn);
      await randomDelay(1000, 2000);
      connectBtn = page.locator(
        '.ph5 .artdeco-dropdown__content-inner span:has-text("Connect")'
      );
    }
  }

  if (await connectBtn.count()) {
    await humanClick(page, connectBtn);
    await randomDelay();
    const sendBtn = page.locator('button:has-text("Send")');
    if (await sendBtn.count()) await humanClick(page, sendBtn);

    row.Notes =
      (row.Notes || "") + `\n${getISTDateTime()}: Sent connection request.`;
    await row.save();
    return true;
  }
  return false;
}

async function checkConnectionStatus(page, profileUrl, row) {
  console.log(`\n🔎 Checking connection status for: ${profileUrl}`);
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await randomDelay();

  // --- Step 1: Pending / Withdraw check ---
  const pendingBtn = await page.locator(
    '.ph5 button:has-text("Pending"), .ph5 button:has-text("Withdraw")'
  );
  if ((await pendingBtn.count()) > 0) {
    console.log(
      "❌ Invitation is still pending (Pending/Withdraw button visible)."
    );
    return "not_connected";
  }

  // Open dropdown to catch "Withdraw" there as well
  const moreBtn = page.locator('.ph5 button:has-text("More")').first();
  if ((await moreBtn.count()) > 0) {
    await humanClick(page, moreBtn);
    await page
      .waitForSelector(".artdeco-dropdown__content", { timeout: 2000 })
      .catch(() => null);
    await randomDelay(800, 1500);

    const withdrawOption = page.locator(
      '.artdeco-dropdown__content span:has-text("Withdraw")'
    );
    if ((await withdrawOption.count()) > 0) {
      console.log(
        "❌ Invitation is still pending (Withdraw option in dropdown)."
      );
      await page.keyboard.press("Escape");
      return "not_connected";
    }
    await page.keyboard.press("Escape");
  }

  // --- Step 2: Check if Connect is visible ---
  const connectBtn = page.locator('.ph5 button:has-text("Connect")');
  if ((await connectBtn.count()) > 0) {
    console.log("❌ Connect button still visible → Not yet connected.");
    return "not_connected";
  }

  // --- Step 3: Check for Remove Connection in dropdown ---
  if ((await moreBtn.count()) > 0) {
    await humanClick(page, moreBtn);
    await page
      .waitForSelector(".artdeco-dropdown__content", { timeout: 2000 })
      .catch(() => null);
    await randomDelay(800, 1500);

    const removeConnOption = page.locator(
      '.artdeco-dropdown__content span:has-text("Remove Connection")'
    );
    if ((await removeConnOption.count()) > 0) {
      console.log("✅ Connection accepted (Remove Connection found).");
      await page.keyboard.press("Escape");
      return "connected";
    }
    await page.keyboard.press("Escape");
  }

  // --- Step 4: Fallback ---
  console.log("⚠️ No clear status detected → assuming Not Connected.");
  return "not_connected";
}

async function viewProfile(page, profileUrl, row) {
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await humanScrollAndMove(page);
  await randomDelay(3000, 7000);

  row.Notes = (row.Notes || "") + `\n${getISTDateTime()}: Viewed profile.`;
  await row.save();
}

async function sendMessage(page, profileUrl, row) {
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await randomDelay();

  // Open the Message box
  await humanClick(page, "div.ph5 button:has-text('Message')");
  await randomDelay();

  // Extract name or default to "there"
  const name =
    (
      await page
        .locator("h1")
        .textContent()
        .catch(() => "there")
    )?.trim() || "there";

  // Replace {name} in message template
  const message = (
    process.env.MESSAGE_TEMPLATE || "Hi {name}, nice to connect!"
  ).replace("{name}", name);

  try {
    // Focus inside the message box
    await page.click("div.msg-form__contenteditable");

    // Type slowly like a human
    await page.keyboard.type(message, { delay: 100 });

    // Human-like click on Send button
    await humanClick(page, "button.msg-form__send-button");

    console.log(`✍️ Typed and sent message to ${name}`);
  } catch (err) {
    console.error(`⚠️ Failed to type message for ${name}:`, err);
  }

  // --- Close ALL open message boxes ---
  try {
    const closeButtons = page
      .locator(
        ".msg-overlay-bubble-header__controls.display-flex.align-items-center button"
      )
      .last();
    const count = await closeButtons.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const btn = closeButtons.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          await randomDelay(4000, 6000);
          await humanClick(page, btn);
          console.log(`✅ Closed message box #${i + 1}`);
        }
      }
    } else {
      console.log("⚠️ No open message boxes found to close");
    }
  } catch (err) {
    console.error("⚠️ Error closing message box:", err);
  }

  // Update row notes
  row.Notes =
    (row.Notes || "") + `\n${getISTDateTime()}: Sent message: "${message}"`;
  await row.save();
}

async function checkReply(page, profileUrl, row) {
  console.log(
    `🔎 Navigating to profile and checking messages for: ${profileUrl}`
  );
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await randomDelay();

  // ---------------------------
  // STEP 1: Close any open message overlays first
  // ---------------------------
  const openMessages = page.locator(
    'button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text("Close your conversation with")'
  );
  const openCount = await openMessages.count();
  if (openCount > 0) {
    for (let i = 0; i < openCount; i++) {
      await openMessages
        .nth(i)
        .click()
        .catch(() => {});
      await randomDelay(1000, 2000);
    }
    console.log(
      `✅ Closed ${openCount} existing message box(es) before starting`
    );
  }

  // ---------------------------
  // STEP 2: Click on Message button if visible
  // ---------------------------
  const messageBtn = page.locator("div.ph5 button:has-text('Message')").first();
  if (await messageBtn.isVisible().catch(() => false)) {
    console.log("✉️ Clicking Message button...");
    await humanClick(page, messageBtn);
    await randomDelay();
  } else {
    console.log("⚠️ Message button not found, skipping reply check");
    return false;
  }

  // ---------------------------
  // STEP 3: Check reply status using new rule
  // ---------------------------
  const replyLocator = page.locator(
    ".msg-s-message-list__event:not(.msg-s-message-list__event--outgoing)"
  );

  const replyCount = await replyLocator.count();
  console.log("📨 Total messages detected:", replyCount);

  let hasReply = false;

  if (replyCount === 0) {
    console.log("❌ No conversation started yet");
  } else if (replyCount === 1) {
    console.log("⏳ Only one message found → Reply NOT received");
  } else if (replyCount >= 2) {
    console.log("✅ At least two messages found → Reply RECEIVED");
    hasReply = true;
  }

  // ---------------------------
  // STEP 4: Update Google Sheet notes
  // ---------------------------
  row.Notes =
    (row.Notes || "") +
    `\n${getISTDateTime()}: ${hasReply ? "Reply received." : "No reply."}`;
  await row.save();

  // ---------------------------
  // STEP 5: Close the message overlay before moving on
  // ---------------------------
  const closeButton = page
    .locator(
      'button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text("Close your conversation with")'
    )
    .last();

  if (await closeButton.isVisible().catch(() => false)) {
    await randomDelay(2000, 4000);
    await closeButton.click().catch(() => {});
    console.log("✅ Closed message box after checking replies");
  } else {
    console.log("ℹ️ No message box to close");
  }

  return hasReply;
}

async function likePost(page, profileUrl, row) {
  try {
    await page.goto(`${profileUrl}detail/recent-activity/`, {
      waitUntil: "domcontentloaded",
    });
    await randomDelay();

    // Check if there are any posts
    const posts = page.locator(
      "div.feed-shared-update-v2, div.occludable-update"
    );
    const postCount = await posts.count();

    if (postCount === 0) {
      console.log(`⚠️ No posts found for ${profileUrl}`);
      row.Notes =
        (row.Notes || "") +
        `\n${getISTDateTime()}: No recent post found to like.`;
      await row.save();
      return "no_posts"; // return result for switch
    }

    // Now safely look for Like button
    const likeBtn = posts
      .first()
      .locator(
        'button.react-button__trigger[aria-label*="Like"]:not(.react-button__trigger--active)'
      )
      .first();

    if (await likeBtn.isVisible()) {
      await humanClick(page, likeBtn);
      console.log(`👍 Liked a recent post for ${profileUrl}`);
      row.Notes =
        (row.Notes || "") + `\n${getISTDateTime()}: Liked recent post.`;
      await row.save();
      return "liked";
    } else {
      console.log(
        `⚠️ No visible like button on the first post for ${profileUrl}`
      );
      row.Notes =
        (row.Notes || "") + `\n${getISTDateTime()}: No likeable post found.`;
      await row.save();
      return "no_like_button";
    }
  } catch (err) {
    console.error(`❌ Error liking post for ${profileUrl}: ${err.message}`);
    row.Notes =
      (row.Notes || "") +
      `\n${getISTDateTime()}: Error liking post: ${err.message}`;
    await row.save();
    return "error";
  }
}

// -------------------------
// Process row (flow)
// -------------------------
async function processRow(page, row) {
  const profileUrl = row.ProfileURL;
  if (!profileUrl) return;

  const status = row.Status ? row.Status.toLowerCase() : "first_run";
  console.log(`🚀 Processing ${profileUrl} [${status}]`);

  switch (status) {
    case "first_run":
      await sendConnectionRequest(page, profileUrl, row);
      row.Status = "second_run";
      row.Notes =
        (row.Notes || "") +
        `\n${getISTDateTime()}: Connection request sent (1st run).`;
      await row.save();
      break;

    case "second_run":
      const connStatus = await checkConnectionStatus(page, profileUrl, row);

      if (connStatus === "not_connected") {
        // Connection request still pending → End this flow
        row.Status = "end";
        row.Notes =
          (row.Notes || "") +
          `\n${getISTDateTime()}: Connection request pending or withdraw option found. Flow ended (2nd run).`;
      } else if (connStatus === "connected") {
        // Connection accepted → move to third run
        row.Status = "third_run";
        row.Notes =
          (row.Notes || "") +
          `\n${getISTDateTime()}: Connection accepted, moving to next step (3rd run).`;
      } else {
        // Fallback for unknown cases
        row.Status = "end";
        row.Notes =
          (row.Notes || "") +
          `\n${getISTDateTime()}: Could not determine connection status. Flow ended (2nd run).`;
      }

      await row.save();
      break;

    case "third_run":
      await sendMessage(page, profileUrl, row);
      row.Status = "fourth_run";
      row.Notes += `\n${getISTDateTime()}: Sent message (3rd run).`;
      await row.save();
      break;

    case "fourth_run":
      console.log(`🚀 Fourth run: Checking reply status for ${profileUrl}`);
      const hasReply = await checkReply(page, profileUrl, row);

      if (hasReply) {
        row.Status = "end";
        row.Notes += `\n${getISTDateTime()}: Reply received. Flow ended (4th run).`;
        console.log(`✅ Reply received for ${profileUrl}, marking as End`);
      } else {
        console.log(
          `⚠️ No reply detected for ${profileUrl}, checking posts...`
        );
        const likeResult = await likePost(page, profileUrl, row);

        if (likeResult === "liked") {
          row.Notes += `\n${getISTDateTime()}: No reply, liked a post. Flow ended (4th run).`;
          console.log(`👍 Liked post for ${profileUrl}, flow ended`);
        } else if (likeResult === "no_posts") {
          row.Notes += `\n${getISTDateTime()}: No reply and no posts found. Flow ended (4th run).`;
          console.log(`🚫 No posts found for ${profileUrl}, flow ended`);
        } else if (likeResult === "no_like_button") {
          row.Notes += `\n${getISTDateTime()}: No reply, but no likeable button found. Flow ended (4th run).`;
          console.log(
            `⚠️ No likeable button found for ${profileUrl}, flow ended`
          );
        } else {
          row.Notes += `\n${getISTDateTime()}: No reply, error while liking post. Flow ended (4th run).`;
          console.log(
            `❌ Error while liking post for ${profileUrl}, flow ended`
          );
        }

        row.Status = "end";
      }

      await row.save();
      break;

    case "end":
      console.log(`⏩ Skipping ${profileUrl}, flow already ended.`);
      break;

    default:
      console.log(
        `⚠️ Unknown status for ${profileUrl}, resetting to first_run.`
      );
      row.Status = "first_run";
      await row.save();
  }
}

// -------------------------
// Playwright Test
// -------------------------
const SESSION_FILE = "linkedin-session.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

test.describe("LinkedIn Campaign Automation", () => {
  let browser, context, page, doc, sheet;

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180000);
    browser = await chromium.launch({ headless: false });
    let needLogin = true;

    if (fs.existsSync(SESSION_FILE)) {
      const stats = fs.statSync(SESSION_FILE);
      const age = Date.now() - stats.mtimeMs;
      if (age < SESSION_MAX_AGE) {
        try {
          context = await browser.newContext({
            storageState: SESSION_FILE,
            viewport: { width: 1366, height: 768 },
          });
          page = await context.newPage();
          await page.goto("https://www.linkedin.com/feed", {
            waitUntil: "domcontentloaded",
          });
          if (!(await page.locator("#username").count())) {
            console.log("♻️ Loaded existing LinkedIn session");
            needLogin = false;
          }
        } catch {}
      }
    }

    if (needLogin) {
      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
      });
      page = await context.newPage();
      await loginToLinkedIn(page);
      await context.storageState({ path: SESSION_FILE });
      console.log("💾 Session saved");
    }

    doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n").trim(),
    });
    await doc.loadInfo();
    sheet = doc.sheetsByIndex[0];
    await sheet.loadHeaderRow();
    console.log("✅ Google Sheet ready");
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test("Process Campaign Rows", async () => {
    test.setTimeout(2000000);
    const rows = await sheet.getRows();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.Status && row.Status.toLowerCase() === "end") {
        console.log(`⏩ Skipping row ${i + 2}, already ended.`);
        continue;
      }
      try {
        console.log(`Processing row ${i + 2}`);
        await processRow(page, row);
        await randomDelay(15000, 40000);
      } catch (err) {
        console.error(`❌ Error processing row ${i + 2}:`, err.message);
      }
    }
  });
});
