/**
 * Feed Actions
 * Actions related to LinkedIn feed interactions
 */

const { SELECTORS } = require("../selectors/selectors");
const { expect } = require("@playwright/test");
const {
  humanScroll,
  humanMouse,
  humanIdle,
} = require("../helpers/human-interactions");

/**
 * View LinkedIn feed with human-like scrolling
 * @param {Page} page - Playwright page object
 */
async function viewFeed(page) {
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for feed to load using proper waits instead of waitForTimeout
  let feedLoaded = false;
  for (const selector of SELECTORS.FEED.CONTAINER) {
    try {
      await expect(page.locator(selector)).toBeVisible({ timeout: 10000 });
      feedLoaded = true;
      break;
    } catch {
      // Continue to next selector
      continue;
    }
  }

  if (!feedLoaded) {
    // UPDATE SELECTOR - Add assertion for feed visibility if needed
    // await expect(page.locator("UPDATE_SELECTOR")).toBeVisible();
  }

  // Replace waitForTimeout with proper waits
  for (let session = 1; session <= 3; session++) {
    await humanScroll(page, Math.floor(Math.random() * 5) + 3);

    // Wait for network to be idle instead of fixed timeout
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
      // Silent fail - continue execution
    });

    if (Math.random() > 0.5) {
      await humanMouse(page, 2);
    }
  }

  await humanIdle(3000, 8000);

  // UPDATE SELECTOR - Add assertion to verify feed viewing completed
  // await expect(page.locator("UPDATE_SELECTOR")).toBeVisible();
}

/**
 * Like a random post in the feed
 * @param {Page} page - Playwright page object
 */
async function likeFeed(page) {
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await humanScroll(page, 5);
  await humanIdle(2000, 4000);

  // Wait for like buttons to be available
  const likeButtons = await page.locator(SELECTORS.FEED.LIKE_BUTTON).all();

  if (likeButtons.length === 0) {
    // UPDATE SELECTOR - Add assertion if no like buttons found
    return;
  }

  const unreactedButtons = [];
  for (const button of likeButtons) {
    try {
      const isReacted = await button
        .evaluate((el) => el.getAttribute("aria-label").includes("Unlike"), {
          timeout: 5000,
        })
        .catch(() => false);
      if (!isReacted) unreactedButtons.push(button);
    } catch {
      // Continue to next button
      continue;
    }
  }

  if (unreactedButtons.length === 0) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * unreactedButtons.length);
  const selectedButton = unreactedButtons[randomIndex];

  await humanMouse(page, 2);
  await selectedButton.scrollIntoViewIfNeeded();
  await selectedButton.click({ delay: 100 });

  // UPDATE SELECTOR - Add assertion to verify post was liked
  // await expect(page.locator("UPDATE_SELECTOR")).toContainText("Liked");

  await humanIdle(3000, 6000);
}

module.exports = {
  viewFeed,
  likeFeed,
};
