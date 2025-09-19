/**
 * linkedinAuth.js
 *
 * Reusable LinkedIn login & stealth module
 * Features:
 * - Per-account state files (linkedin-<account>.json)
 * - Unique deterministic device fingerprint per account
 * - Stealth patches (webdriver, canvas, webgl, audio tweaks)
 * - Human-like interactions: typing, mouse move, hover-before-click, scrolling, idle
 * - MFA via speakeasy with retry loop and "Verify using authenticator app" handling
 * - Auto-refresh expired sessions
 * - Watchdog (heartbeat) to detect mid-run logout and auto re-login
 * - Random post-login actions (scroll, like random post, notifications, my network, view profile, go to jobs, messages)
 *
 * Usage: require() this module and create a LinkedInSession instance for each account.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");
const speakeasy = require("speakeasy");

const STATE_DIR = path.join(__dirname, "linkedin-states");
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR);

/* -------------------------
   Utility: deterministic fingerprint generator
   ------------------------- */
function hashToNumber(seed, min, max) {
  const h = crypto.createHash("sha1").update(seed).digest("hex");
  const num = parseInt(h.slice(0, 8), 16);
  return min + (num % (max - min + 1));
}
function getFingerprint(account) {
  // Derive viewport, timezone offset, userAgent minor version from account name deterministically
  const width = hashToNumber(account + "w", 1200, 1600);
  const height = hashToNumber(account + "h", 700, 1000);
  const chromeVer = 110 + (hashToNumber(account + "v", 0, 20));
  const tz = ["Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Singapore"][
    hashToNumber(account + "tz", 0, 3)
  ];
  const locale = ["en-US", "en-GB", "en-IN", "en-SG"][hashToNumber(account + "loc", 0, 3)];
  const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}.0.0.0 Safari/537.36`;
  return { viewport: { width, height }, timezoneId: tz, locale, userAgent: ua };
}

/* -------------------------
   Human-like helpers
   ------------------------- */
async function randomDelay(min = 200, max = 1200) {
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, t));
}
async function humanIdle(min = 1500, max = 5000) {
  await randomDelay(min, max);
}
async function humanType(page, locator, text) {
  const el = page.locator(locator);
  // ensure visible and focus
  await el.scrollIntoViewIfNeeded();
  await el.click({ delay: 80 }).catch(() => {});
  for (const ch of text) {
    // small per-character delay
    await el.type(ch, { delay: Math.floor(Math.random() * 160) + 40 });
    if (Math.random() < 0.12) await randomDelay(300, 800);
  }
}
async function humanHoverClick(page, selector) {
  const el = page.locator(selector);
  if (!(await el.count())) return false;
  try {
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (box) {
      // jitter hover positions
      const x = box.x + Math.floor(box.width * (0.2 + Math.random() * 0.6));
      const y = box.y + Math.floor(box.height * (0.2 + Math.random() * 0.6));
      await page.mouse.move(x, y, { steps: 6 });
    } else {
      await el.hover();
    }
    await randomDelay(400, 1200);
    await el.click({ delay: Math.floor(Math.random() * 150) + 40 });
    return true;
  } catch (e) {
    return false;
  }
}
async function humanMouseMove(page, moves = 4) {
  const size = page.viewportSize() || { width: 1280, height: 720 };
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * size.width);
    const y = Math.floor(Math.random() * size.height);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 3 });
    await randomDelay(200, 700);
  }
}
async function humanScroll(page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    const dir = Math.random() > 0.3 ? 1 : -1;
    await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 400) + 120));
    await randomDelay(700, 1800);
  }
}

/* -------------------------
   Stealth patches (init script)
   ------------------------- */
function stealthInitScript() {
  return `
  (() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = window.chrome || { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        const ctx = this.getContext('2d');
        ctx.fillStyle = "rgba(0,0,0,0.01)";
        ctx.fillRect(0,0,1,1);
        return toDataURL.apply(this, arguments);
      };
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Intel Inc.';
        if (param === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.apply(this, arguments);
      };
      const oldGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function() {
        const data = oldGetChannelData.apply(this, arguments);
        const rnd = Math.random() * 0.0000001;
        for (let i=0;i<data.length;i++) data[i] = data[i] + rnd;
        return data;
      };
    } catch(e) { /* fail silently */ }
  })();`;
}

/* -------------------------
   Session class
   ------------------------- */
class LinkedInSession {
  constructor(account, opts = {}) {
    this.account = account || "user1";
    this.stateFile = path.join(STATE_DIR, `linkedin-${this.account}.json`);
    this.fingerprint = getFingerprint(this.account);
    this.launchOptions = opts.launchOptions || { headless: false, args: ["--start-maximized"] };
    this.contextOptions = opts.contextOptions || { ...this.fingerprint };
    this.browser = null;
    this.context = null;
    this.page = null;
    this.watchdogIntervalId = null;
    this.watchdogSeconds = opts.watchdogSeconds || 15; // heartbeat interval
  }

  async launchWithState() {
    // start browser & context with storage state if available
    this.browser = await chromium.launch(this.launchOptions);
    this.context = await this.browser.newContext({
      ...this.contextOptions,
      storageState: fs.existsSync(this.stateFile) ? this.stateFile : undefined,
    });

    // add stealth init script
    await this.context.addInitScript(stealthInitScript());

    this.page = await this.context.newPage();

    // quick validation: try visit feed (short timeout)
    try {
      await this.page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 15000 });
      if (this.page.url().includes("/login")) {
        // session expired -> remove file so next flow logs in
        this.clearState();
      }
    } catch (e) {
      // ignore network errors; clear state to force login next
      // console.log("Session check error:", e.message);
    }
    return { browser: this.browser, context: this.context, page: this.page };
  }

  async saveState() {
    if (!this.context) return;
    await this.context.storageState({ path: this.stateFile });
    console.log(`💾 Saved state for ${this.account}`);
  }

  hasState() {
    return fs.existsSync(this.stateFile);
  }

  clearState() {
    if (fs.existsSync(this.stateFile)) {
      try { fs.unlinkSync(this.stateFile); console.log(`🗑️ Cleared state for ${this.account}`); } catch(e){}
    }
  }

  async close() {
    if (this.watchdogIntervalId) clearInterval(this.watchdogIntervalId);
    try { await this.browser?.close(); } catch(e){}
    this.browser = this.context = this.page = null;
  }

  /* -------------------------
     MFA + Login flow
     ------------------------- */
  async doLogin() {
    if (!this.page) throw new Error("Page not ready. call launchWithState() first.");

    // Go to login page
    await this.page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
    await humanIdle(300, 1000);

    // Human type email & password
    await humanType(this.page, "#username", process.env.LINKEDIN_EMAIL || "");
    await humanIdle(500, 1200);
    await humanType(this.page, "#password", process.env.LINKEDIN_PASSWORD || "");
    await humanIdle(300, 900);

    // Hover & click submit
    try {
      await this.page.locator('button[type="submit"]').first().hover();
      await randomDelay(400, 1100);
      await this.page.locator('button[type="submit"]').first().click();
    } catch (e) {
      await this.page.click('button[type="submit"]');
    }

    // If LinkedIn shows "Verify using authenticator app", click it
    const authLink = this.page.locator('a:has-text("Verify using authenticator app")');
    if (await authLink.isVisible().catch(() => false)) {
      await authLink.hover().catch(()=>{});
      await randomDelay(300, 900);
      await authLink.click().catch(()=>{});
      await this.page.waitForTimeout(800);
    }

    // If MFA input present -> attempt TOTP with retries
    const mfaSelector = 'input[name="pin"]';
    const mfaInput = this.page.locator(mfaSelector);
    if (await mfaInput.isVisible({ timeout: 7000 }).catch(() => false)) {
      let success = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const token = speakeasy.totp({ secret: process.env.LINKEDIN_TOTP_SECRET || "", encoding: "base32" });
        console.log(`➡️ [${this.account}] MFA attempt ${attempt} -> ${token}`);
        await humanType(this.page, mfaSelector, token);
        // try clicking the submit button(s) for MFA
        try {
          await this.page.locator('button[type="submit"]').first().click();
        } catch (e) {
          await this.page.keyboard.press("Enter").catch(()=>{});
        }
        // wait for feed
        try {
          await this.page.waitForURL("https://www.linkedin.com/feed/", { timeout: 9000 });
          success = true;
          break;
        } catch {
          console.log("⚠️ MFA attempt failed or token expired, retrying...");
          await this.page.waitForTimeout(4000); // wait a bit before next attempt
        }
      }
      if (!success) throw new Error("MFA failed after retries");
    }

    // Wait for feed to fully load
    await this.page.waitForURL(/linkedin\.com\/feed/, { timeout: 30000 });
    await humanIdle(800, 1600);
    await this.saveState();
    console.log(`✅ [${this.account}] Logged in & state saved`);
  }

  /* -------------------------
     Ensure logged in (auto re-login if needed)
     ------------------------- */
  async ensureLoggedInIfNeeded() {
    if (!this.page) throw new Error("Page not ready");
    // check if current page is login page
    if (this.page.url().includes("/login") || this.page.url().includes("/checkpoint/lg/login-submit")) {
      console.log(`⚠️ [${this.account}] Session invalid/expired - re-login initiated`);
      this.clearState();
      await this.close(); // close current browser
      // re-launch and login
      await this.launchWithState();
      await this.doLogin();
      return true;
    }
    return false;
  }

  /* -------------------------
     Watchdog (heartbeat)
     - Runs in background periodically and ensures we are logged in.
     - Returns a stop() function to cancel the watchdog.
     ------------------------- */
  startWatchdog(intervalSeconds = this.watchdogSeconds) {
    if (this.watchdogIntervalId) return;
    this.watchdogIntervalId = setInterval(async () => {
      try {
        if (!this.page) return;
        // lightweight check: fetch feed in the background without navigation if possible
        // simpler: check current URL and if contains /login then relogin
        if (this.page.url().includes("/login")) {
          console.log(`🔁 [${this.account}] Watchdog detected logout`);
          await this.ensureLoggedInIfNeeded();
        } else {
          // occasional lightweight check: try load feed endpoint (no heavy wait)
          try {
            await this.page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 10000 });
            // do nothing if load ok
          } catch (e) {
            // if visiting feed triggered login, handle below
            if (this.page.url().includes("/login")) {
              await this.ensureLoggedInIfNeeded();
            }
          }
        }
      } catch (e) {
        // swallow to avoid watchdog crash
      }
    }, intervalSeconds * 1000);
    console.log(`🟡 [${this.account}] Watchdog started (every ${intervalSeconds}s)`);
  }
  stopWatchdog() {
    if (this.watchdogIntervalId) {
      clearInterval(this.watchdogIntervalId);
      this.watchdogIntervalId = null;
      console.log(`🔴 [${this.account}] Watchdog stopped`);
    }
  }

  /* -------------------------
     Post-login random actions
     - shuffled each time, includes likeRandomPost & other interactions
     ------------------------- */
  async likeRandomPost() {
    // Try to locate like buttons in feed; pick random index
    const likes = this.page.locator('button[aria-label*="Like"]');
    const count = await likes.count().catch(()=>0);
    if (!count) return false;
    const idx = Math.floor(Math.random() * Math.min(count, 6));
    const btn = likes.nth(idx);
    try {
      await btn.scrollIntoViewIfNeeded();
      await btn.hover().catch(()=>{});
      await randomDelay(400, 1200);
      if (Math.random() < 0.75) {
        await btn.click({ delay: Math.floor(Math.random() * 140) + 40 });
        console.log(`👍 [${this.account}] Liked post #${idx+1}`);
        await humanIdle(1000, 3000);
        return true;
      } else {
        console.log(`🙅 [${this.account}] Skipped like this run`);
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  async openNotifications() {
    try {
      const sel = 'a[href*="/notifications/"]';
      await humanHoverClick(this.page, sel);
      await humanIdle(2000, 5000);
      return true;
    } catch { return false; }
  }

  async openMyNetwork() {
    try {
      const sel = 'a[href*="/mynetwork/"]';
      await humanHoverClick(this.page, sel);
      await humanIdle(2000, 5000);
      return true;
    } catch { return false; }
  }

  async viewOwnProfile() {
    try {
      // common profile link
      const profile = this.page.locator('a[href*="/in/"]:has(h3), a[href*="/in/"] >> text=View profile').first();
      if (await profile.isVisible().catch(()=>false)) {
        await humanHoverClick(this.page, 'a[href*="/in/"]');
        await humanIdle(3000, 6000);
        return true;
      }
    } catch {}
    return false;
  }

  async goToJobsAndScroll() {
    try {
      await humanHoverClick(this.page, 'a[href*="/jobs/"]');
      await humanIdle(1200, 2600);
      await humanScroll(this.page, 4);
      await humanIdle(1000, 3000);
      return true;
    } catch { return false; }
  }

  async maybeOpenMessages() {
    // Open messages sometimes
    try {
      if (Math.random() < 0.25) {
        await humanHoverClick(this.page, 'a[href*="/messaging/"]');
        await humanIdle(3000, 6000);
        return true;
      }
    } catch {}
    return false;
  }

  async randomPostLoginActions(count = 3) {
    // pool of actions
    const actions = [
      async () => { await humanIdle(3000, 7000); },
      async () => { await humanScroll(this.page, 4); },
      async () => { await this.likeRandomPost(); },
      async () => { await this.openNotifications(); },
      async () => { await this.openMyNetwork(); },
      async () => { await this.viewOwnProfile(); },
      async () => { await this.goToJobsAndScroll(); },
      async () => { await this.maybeOpenMessages(); },
    ];
    // shuffle
    for (let i = actions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [actions[i], actions[j]] = [actions[j], actions[i]];
    }
    const runCount = Math.max(2, Math.min(actions.length, count));
    for (let i = 0; i < runCount; i++) {
      try {
        await actions[i]();
        await humanIdle(1000, 4000);
        // lightweight ensure logged in (not full relaunch here)
        if (this.page.url().includes("/login")) {
          console.log(`[${this.account}] Detected logout during actions`);
          await this.ensureLoggedInIfNeeded();
        }
      } catch (e) { /* ignore per-action errors */ }
    }
  }

} // end class

module.exports = LinkedInSession;
