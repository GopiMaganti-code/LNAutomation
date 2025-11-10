/**
 * Message Actions
 * Actions related to sending messages on LinkedIn
 */

const { SELECTORS } = require("../selectors/selectors");
const { expect } = require("@playwright/test");
const {
  getProfileName,
  getConnectionDegree,
} = require("../helpers/profile-helpers");
const {
  closeAllMessageBoxes,
  getVisibleLocator,
} = require("../helpers/ui-helpers");
const {
  humanType,
  humanMouse,
  randomDelay,
} = require("../helpers/human-interactions");
const { TestError } = require("../helpers/error");

/**
 * Send a message to a LinkedIn profile (1st degree connections only)
 * @param {Page} page - Playwright page object
 * @param {string} url - LinkedIn profile URL
 * @param {string} message - Optional custom message
 */
async function sendMessage(page, url, message = null) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
      // Silent fail
    });

    await closeAllMessageBoxes(page);

    const profileName = await getProfileName(page);
    const degree = await getConnectionDegree(page);

    // Check if 1st degree connection
    if (degree !== "1st") {
      // UPDATE SELECTOR - Add assertion if needed
      return;
    }

    // Find message button
    const messageButton = await getVisibleLocator(
      page,
      SELECTORS.BUTTONS.MESSAGE,
      true
    );

    if (!messageButton) {
      throw TestError.create("sendMessage", "Message button not found", {
        url,
      });
    }

    await humanMouse(page, 2);
    await messageButton.click({ delay: 100 });

    // Wait for message input to appear instead of randomDelay
    const messageInput = page.locator(SELECTORS.MESSAGES.INPUT);
    await expect(messageInput).toBeVisible({ timeout: 10000 });

    const messageText =
      message ||
      `Hi ${profileName}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    await humanType(page, SELECTORS.MESSAGES.INPUT, messageText);

    const sendButton = page.locator(SELECTORS.MESSAGES.SEND);
    await expect(sendButton).toBeVisible({ timeout: 10000 });
    await humanMouse(page, 1);
    await sendButton.click({ delay: 100 });

    // UPDATE SELECTOR - Add assertion to verify message was sent
    // await expect(page.locator("UPDATE_SELECTOR")).toContainText("Sent");

    await randomDelay(2000, 4000);
    await closeAllMessageBoxes(page);
  } catch (error) {
    if (error instanceof TestError) {
      throw error;
    }
    throw TestError.create("sendMessage", error.message, { url, error });
  }
}

module.exports = {
  sendMessage,
};
