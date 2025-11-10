# Code Refactoring Examples

This document provides concrete examples of how to refactor code from `allActions4.spec.js` following best practices.

## Example 1: Extract Profile Name Detection

### Before (Repeated 10+ times in file)

```javascript
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
      console.log(`Found profile name with selector: ${selector}`);
      break;
    }
  } catch (err) {
    console.log(`⚠️ Name selector failed: ${err.message}`);
  }
}
```

### After (Single reusable function)

```javascript
// helpers/profile-helpers.js
import { SELECTORS } from "./selectors";

/**
 * Extracts the profile name from a LinkedIn profile page
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<string>} The profile name or throws error if not found
 */
export async function getProfileName(page, timeout = 5000) {
  for (const selector of SELECTORS.PROFILE.NAME) {
    try {
      const text = await page.locator(selector).textContent({ timeout });

      if (text?.trim()) {
        return text.trim();
      }
    } catch (error) {
      // Continue to next selector
      continue;
    }
  }

  throw new Error("Could not determine profile name from any selector");
}

// Usage
const profileName = await getProfileName(page);
```

---

## Example 2: Replace waitForTimeout with Proper Waits

### Before

```javascript
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await randomDelay(2000, 4000);
await humanIdle(1000, 3000);
await page.waitForTimeout(5000);
```

### After

```javascript
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 10000 });
// Or wait for specific element
await page.locator(SELECTORS.PROFILE.NAME[0]).waitFor({
  state: "visible",
  timeout: 10000,
});
```

---

## Example 3: Improve Selector Reliability

### Before

```javascript
const messageButton = page.locator("div.ph5 button:has-text('Message')").last();
await messageButton.click();
```

### After

```javascript
// Option 1: Use getByRole (most reliable)
const messageButton = page.getByRole("link", { name: "Message" });
await messageButton.click();

// Option 2: Use data-testid if available
const messageButton = page.locator('[data-testid="message-button"]');
await messageButton.click();

// Option 3: Multiple fallbacks with proper waiting
const messageButton = await findElementWithFallbacks(page, [
  () => page.getByRole("link", { name: "Message" }),
  () => page.locator('[data-view-name="profile-primary-message"]'),
  () => page.locator('[data-view-name="profile-secondary-message"]'),
]);
await messageButton.click();
```

---

## Example 4: Add Proper Assertions

### Before

```javascript
async function sendMessage(page, url) {
  // ... send message logic
  await sendButton.click();
  console.log("✅ Message sent");
}
```

### After

```javascript
async function sendMessage(page, url, message) {
  // ... send message logic
  await sendButton.click();

  // Assert message was actually sent
  await expect(
    page.locator('[data-testid="message-sent-indicator"]')
  ).toBeVisible({ timeout: 10000 });

  // Or check for success message
  await expect(page.locator(".msg-form__send-status")).toContainText("Sent", {
    timeout: 10000,
  });
}
```

---

## Example 5: Extract Constants

### Before (Magic strings/numbers everywhere)

```javascript
await randomDelay(2000, 4000);
const message = `Hi ${profileName}, I'd like to connect...`;
await page.waitForTimeout(5000);
```

### After

```javascript
// config/constants.js
export const DELAYS = {
  SHORT: { min: 1000, max: 2000 },
  MEDIUM: { min: 2000, max: 4000 },
  LONG: { min: 5000, max: 10000 },
};

export const MESSAGES = {
  CONNECTION_REQUEST: (name) =>
    `Hi ${name}, I'd like to connect and discuss potential opportunities.`,
  DEFAULT_MESSAGE: "Hello, I would like to connect!",
};

// Usage
await randomDelay(DELAYS.MEDIUM.min, DELAYS.MEDIUM.max);
const message = MESSAGES.CONNECTION_REQUEST(profileName);
```

---

## Example 6: Improve Error Handling

### Before

```javascript
try {
  await button.click();
} catch (err) {
  console.log(`⚠️ Failed to click: ${err.message}`);
}
```

### After

```javascript
async function clickWithRetry(locator, options = {}) {
  const { maxRetries = 3, timeout = 10000, retryDelay = 1000 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await locator.waitFor({ state: "visible", timeout });
      await locator.click();
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to click element after ${maxRetries} attempts: ${error.message}`
        );
      }
      await page.waitForTimeout(retryDelay);
    }
  }
}

// Usage
await clickWithRetry(messageButton, { maxRetries: 3 });
```

---

## Example 7: Create Page Object Model

### Before (Direct page manipulation)

```javascript
async function sendMessage(page, url) {
  await page.goto(url);
  const messageButton = page.locator("div.ph5 button:has-text('Message')");
  await messageButton.click();
  const input = page.locator("div.msg-form__contenteditable");
  await input.fill("Hello");
  const sendButton = page.locator("button.msg-form__send-button");
  await sendButton.click();
}
```

### After (Page Object Model)

```javascript
// pages/ProfilePage.js
export class ProfilePage {
  constructor(page) {
    this.page = page;
    this.name = page.locator("h1").first();
    this.messageButton = page.getByRole("link", { name: "Message" });
    this.connectButton = page.getByRole("button", { name: "Connect" });
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState("networkidle");
  }

  async getName() {
    return this.name.textContent();
  }

  async openMessageDialog() {
    await this.messageButton.waitFor({ state: "visible" });
    await this.messageButton.click();
  }
}

// pages/MessageDialog.js
export class MessageDialog {
  constructor(page) {
    this.page = page;
    this.input = page.locator("div.msg-form__contenteditable");
    this.sendButton = page.getByRole("button", { name: "Send" });
  }

  async sendMessage(text) {
    await this.input.waitFor({ state: "visible" });
    await this.input.fill(text);
    await this.sendButton.click();
    await this.waitForSent();
  }

  async waitForSent() {
    await expect(this.page.locator('[data-testid="message-sent"]')).toBeVisible(
      { timeout: 10000 }
    );
  }
}

// Usage in test
test("should send message", async ({ page }) => {
  const profilePage = new ProfilePage(page);
  const messageDialog = new MessageDialog(page);

  await profilePage.goto("https://www.linkedin.com/in/test/");
  await profilePage.openMessageDialog();
  await messageDialog.sendMessage("Hello!");
});
```

---

## Example 8: Split Large Function

### Before (200+ line function)

```javascript
async function sendConnectionRequest(page, url) {
  // 200+ lines of code mixing:
  // - Navigation
  // - Name extraction
  // - Degree detection
  // - Button finding
  // - Clicking
  // - Error handling
}
```

### After (Small, focused functions)

```javascript
// actions/connection-actions.js
import {
  getProfileName,
  getConnectionDegree,
} from "../helpers/profile-helpers";
import { findConnectButton, findMoreButton } from "../helpers/button-helpers";

export async function sendConnectionRequest(page, url) {
  await navigateToProfile(page, url);

  const profileName = await getProfileName(page);
  const degree = await getConnectionDegree(page);

  if (degree === "1st") {
    throw new Error("Already connected");
  }

  const connectButton = await findConnectButton(page);
  if (!connectButton) {
    throw new Error("Connect button not found");
  }

  await clickConnectButton(connectButton);
  await confirmConnectionRequest(page);

  await expect(page.locator('[data-testid="connection-status"]')).toContainText(
    "Pending"
  );
}

async function navigateToProfile(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

async function clickConnectButton(button) {
  await button.waitFor({ state: "visible" });
  await button.click();
}

async function confirmConnectionRequest(page) {
  const sendButton = page.getByRole("button", { name: "Send" });
  await sendButton.waitFor({ state: "visible" });
  await sendButton.click();
}
```

---

## Example 9: Use Playwright Fixtures

### Before (Login in beforeAll)

```javascript
test.beforeAll(async () => {
  browser = await chromium.launch();
  context = await browser.newContext();
  page = await context.newPage();

  // Login logic here (50+ lines)
  await page.goto("https://www.linkedin.com/login");
  // ... login steps
});

test("should send message", async () => {
  // Uses global page variable
  await sendMessage(page, url);
});
```

### After (Use fixtures)

```javascript
// fixtures/authenticated-page.js
import { test as base } from "@playwright/test";
import { login } from "../helpers/auth-helpers";

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Login once, reuse storage state
    const storageState = "auth.json";

    if (!fs.existsSync(storageState)) {
      await login(page);
      await page.context().storageState({ path: storageState });
    }

    // Use existing auth or create new context with storage
    const context = await browser.newContext({
      storageState: fs.existsSync(storageState) ? storageState : undefined,
    });
    const authenticatedPage = await context.newPage();

    await use(authenticatedPage);
    await context.close();
  },
});

// Usage
test("should send message", async ({ authenticatedPage }) => {
  await sendMessage(authenticatedPage, url);
});
```

---

## Example 10: Add TypeScript Types

### Before (JavaScript, no types)

```javascript
async function sendMessage(page, url) {
  // No type safety
}
```

### After (TypeScript)

```typescript
// types/index.ts
import { Page } from "@playwright/test";

export interface MessageOptions {
  note?: string;
  subject?: string;
}

export interface ProfileInfo {
  name: string;
  url: string;
  degree: "1st" | "2nd" | "3rd" | "unknown";
}

// actions/message-actions.ts
import { Page } from "@playwright/test";
import { MessageOptions } from "../types";

export async function sendMessage(
  page: Page,
  url: string,
  message: string,
  options?: MessageOptions
): Promise<void> {
  // Type-safe implementation
}
```

---

## Example 11: Create Selector Constants File

### Before (Selectors scattered throughout)

```javascript
// In sendMessage function
const nameLocators = ["h1", "..."];

// In sendFollow function
const nameLocators = ["h1", "..."]; // Duplicated!

// In checkDegree function
const degreeLocators = ["..."]; // Different but similar
```

### After (Centralized selectors)

```javascript
// helpers/selectors.js
export const SELECTORS = {
  PROFILE: {
    NAME: [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ],
    DEGREE: [
      'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child',
      'div[data-view-name="profile-top-card-verified-badge"] + p + p',
      'div[data-view-name="profile-top-card-verified-badge"]',
      ".distance-badge .visually-hidden",
      ".distance-badge .dist-value",
    ],
    IMAGE: [
      "img.profile-photo-edit__preview",
      ".pv-top-card__edit-photo img",
      '[data-view-name="profile-top-card-member-photo"] img',
    ],
  },
  BUTTONS: {
    MESSAGE: [
      'a[data-view-name="profile-primary-message"]',
      'a[data-view-name="profile-secondary-message"]',
      "div.ph5 button:has-text('Message')",
    ],
    CONNECT: [
      ".ph5 button:has-text('Connect')",
      'div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-connect-action"] a',
    ],
    FOLLOW: [
      ".ph5.pb5 [aria-label*='Follow']",
      'div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
    ],
  },
  MESSAGES: {
    INPUT: "div.msg-form__contenteditable",
    SEND: "button.msg-form__send-button",
    SENT_INDICATOR: '[data-testid="message-sent"]',
  },
};

// Usage
import { SELECTORS } from "./selectors";

const name = await getTextFromSelectors(page, SELECTORS.PROFILE.NAME);
```

---

## Example 12: Improve Test Structure

### Before (Single monolithic test)

```javascript
test("Perform Action", async () => {
  const actions = {
    view_feed: viewFeed,
    like_feed: likeFeed,
    send_message: async () => {
      for (const url of PROFILE_URLS) await sendMessage(page, url);
    },
    // ... 20+ more actions
  };

  const actionFunc = actions[ACTION];
  if (actionFunc) await actionFunc(page);
});
```

### After (Individual, focused tests)

```javascript
// tests/feed-interactions.spec.js
test.describe("Feed Interactions", () => {
  test.use({ storageState: "auth.json" });

  test("should view feed and scroll through posts", async ({ page }) => {
    await viewFeed(page);
    await expect(page.locator(".feed-container")).toBeVisible();
  });

  test("should like a random post", async ({ page }) => {
    await likeFeed(page);
    // Add assertion
  });
});

// tests/messaging.spec.js
test.describe("Messaging", () => {
  test.use({ storageState: "auth.json" });

  test("should send message to 1st degree connection", async ({ page }) => {
    const url = "https://www.linkedin.com/in/test/";
    await sendMessage(page, url, "Hello!");
    await expect(page.locator('[data-testid="message-sent"]')).toBeVisible();
  });

  test("should skip non-1st degree connections", async ({ page }) => {
    // Test logic
  });
});
```

---

These examples demonstrate the key refactoring patterns needed to improve the codebase. Start with the highest priority items (extracting constants, replacing waits, adding assertions) and gradually work toward the more structural changes (POM, TypeScript).
