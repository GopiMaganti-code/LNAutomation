/**
 * UI Helper Functions
 * Common UI interactions and element finding utilities
 */

const { SELECTORS } = require("../selectors/selectors");
const { humanMouse, randomDelay } = require("./human-interactions");

/**
 * Closes all open message boxes/overlays
 * @param {Page} page - Playwright page object
 */
async function closeAllMessageBoxes(page) {
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
      await randomDelay(500, 1000);
    } catch (err) {
      // Silent fail - continue closing other boxes
      continue;
    }
  }
}

/**
 * Gets the first visible locator from an array of selectors
 * @param {Page} page - Playwright page object
 * @param {string[]} selectors - Array of CSS selectors to try
 * @param {boolean} useLast - If true, use last matching element, otherwise first
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<Locator|null>} The first visible locator or null if none found
 */
async function getVisibleLocator(
  page,
  selectors,
  useLast = false,
  timeout = 5000
) {
  for (const selector of selectors) {
    try {
      let safeSelector = selector;
      if (!selector.includes(":has(")) {
        safeSelector += useLast ? ":last-of-type" : ":first-of-type";
      }
      const loc = page.locator(safeSelector);
      const singleLoc = useLast ? loc.nth(-1) : loc.nth(0);
      if (await singleLoc.isVisible({ timeout })) {
        return singleLoc;
      }
    } catch (err) {
      // Continue to next selector
      continue;
    }
  }
  return null;
}

module.exports = {
  closeAllMessageBoxes,
  getVisibleLocator,
};
