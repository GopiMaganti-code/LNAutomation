/**
 * 🔹 LinkedIn State Manager
 * -------------------------
 * Utility to manage Playwright storageState (cookies + localStorage)
 * for multiple LinkedIn accounts, reducing detection risk.
 *
 * Features:
 * ✅ One state file per account
 * ✅ Auto-load state if available
 * ✅ Auto-save new state after login
 * ✅ Consistent fingerprint (timezone, locale, UA)
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

// 📂 Where to store session files
const STATE_DIR = path.join(__dirname, "linkedin-states");
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR);

// 🔧 Config: fingerprints per account (optional)
const DEFAULT_FINGERPRINT = {
  locale: "en-US",
  timezoneId: "Asia/Kolkata",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 720 },
};

class StateManager {
  constructor(accountName) {
    this.accountName = accountName;
    this.stateFile = path.join(STATE_DIR, `linkedin-${accountName}.json`);
  }

  // 🟢 Load browser + context with state (if available)
  async launchWithState(options = {}) {
    const browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });

    const context = await browser.newContext({
      ...DEFAULT_FINGERPRINT,
      ...options,
      storageState: fs.existsSync(this.stateFile)
        ? this.stateFile
        : undefined,
    });

    const page = await context.newPage();
    return { browser, context, page };
  }

  // 🟢 Save state after successful login
  async saveState(context) {
    await context.storageState({ path: this.stateFile });
    console.log(`💾 Saved state for account: ${this.accountName}`);
  }

  // 🟢 Check if state exists
  hasState() {
    return fs.existsSync(this.stateFile);
  }

  // 🟢 Clear state (force re-login next time)
  clearState() {
    if (fs.existsSync(this.stateFile)) {
      fs.unlinkSync(this.stateFile);
      console.log(`🗑️ Cleared state for account: ${this.accountName}`);
    }
  }
}

module.exports = StateManager;
