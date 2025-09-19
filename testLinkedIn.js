/**
 * 🔹 LinkedIn Login Demo with Auto-Refresh State + MFA Retry + Watchdog
 * ---------------------------------------------------------------------
 * - Uses StateManager for session handling
 * - Handles MFA (with authenticator app link + retries)
 * - Auto-refreshes expired sessions at start
 * - Watchdog monitors mid-run logout & relogs automatically
 */

require("dotenv").config();
const speakeasy = require("speakeasy");
const StateManager = require("./stateManager");


async function doLogin(page, context, stateMgr) {
  console.log("🔑 Performing fresh login...");

  // Go to login
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });

  await page.fill("#username", process.env.LINKEDIN_EMAIL);
  await page.fill("#password", process.env.LINKEDIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Handle authenticator app link
  const authLink = page.locator('a:has-text("Verify using authenticator app")');
  if (await authLink.isVisible().catch(() => false)) {
    console.log("🔐 MFA link detected, clicking...");
    await authLink.click();
    await page.waitForTimeout(1000);
  }

  // Handle MFA code input
  const mfaInput = page.locator('input[name="pin"]');
  if (await mfaInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    console.log("🔐 MFA required, generating codes...");

    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const token = speakeasy.totp({
        secret: process.env.LINKEDIN_TOTP_SECRET,
        encoding: "base32",
      });

      console.log(`➡️ Attempt ${attempt}: Entering MFA code ${token}`);
      await mfaInput.fill(token);
      await page.click('button[type="submit"]');

      try {
        await page.waitForURL("https://www.linkedin.com/feed/", {
          timeout: 8000,
        });
        success = true;
        break;
      } catch {
        console.log("⚠️ MFA attempt failed, retrying...");
        await page.waitForTimeout(5000); // wait for next TOTP cycle
      }
    }

    if (!success) throw new Error("❌ MFA failed after 3 attempts");
  }

  // Confirm login success
  await page.waitForURL("https://www.linkedin.com/feed/", {
    timeout: 30000,
  });

  await stateMgr.saveState(context);
  console.log("✅ Login successful & session refreshed!");
}

/**
 * 🔹 Watchdog: Detects mid-run logout and re-logins
 */
async function ensureLoggedIn(browser, context, page, stateMgr) {
  if (page.url().includes("/login")) {
    console.log("⚠️ Watchdog detected logout, re-logging...");

    stateMgr.clearState();
    await browser.close();

    // Relaunch browser & login
    ({ browser, context, page } = await stateMgr.launchWithState());
    await doLogin(page, context, stateMgr);

    return { browser, context, page }; // return updated handles
  }
  return { browser, context, page };
}

(async () => {
  const account = process.env.ACCOUNT || "user1";
  const stateMgr = new StateManager(account);

  let { browser, context, page } = await stateMgr.launchWithState();

  // Initial check (startup)
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
  });

  if (page.url().includes("/login")) {
    console.log("⚠️ Detected expired session at startup, refreshing...");
    stateMgr.clearState();
    await browser.close();

    ({ browser, context, page } = await stateMgr.launchWithState());
    await doLogin(page, context, stateMgr);
  } else {
    console.log("✅ Session still valid, no login required!");
  }

  // 🔹 Example actions with watchdog in between
  console.log("📜 Scrolling feed...");
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(3000);

  ({ browser, context, page } = await ensureLoggedIn(browser, context, page, stateMgr));

  console.log("🔔 Opening notifications...");
  await page.goto("https://www.linkedin.com/notifications/", {
    waitUntil: "domcontentloaded",
  });

  ({ browser, context, page } = await ensureLoggedIn(browser, context, page, stateMgr));

  console.log("👥 Opening My Network...");
  await page.goto("https://www.linkedin.com/mynetwork/", {
    waitUntil: "domcontentloaded",
  });

  // Wrap up
  await page.waitForTimeout(5000);
  await browser.close();
})();
