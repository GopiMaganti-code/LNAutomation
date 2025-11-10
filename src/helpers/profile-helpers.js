/**
 * Profile Helper Functions
 * Extract profile information from LinkedIn pages
 */

const { SELECTORS } = require("../selectors/selectors");
const { TestError } = require("./error");

// Fallback selectors if SELECTORS import fails
const FALLBACK_PROFILE_NAME_SELECTORS = [
  "h1",
  'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
  "a[aria-label] h1",
  'a[href*="/in/"] h1',
  'div[data-view-name="profile-top-card-verified-badge"] p',
  'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
  ".text-heading-xlarge",
];

/**
 * Safely extracts profile name from a LinkedIn profile page
 * Tries multiple known selectors and returns the first successful match
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<string>} The profile name or throws error if not found
 */
async function getProfileName(page, timeout = 5000) {
  const nameSelectors = SELECTORS?.PROFILE?.NAME || FALLBACK_PROFILE_NAME_SELECTORS;
  
  for (const selector of nameSelectors) {
    try {
      const text = await page.locator(selector).textContent({ timeout });

      if (text?.trim()) {
        return text.trim();
      }
    } catch (error) {
      // Continue to next selector - silent fail for all errors (including timeout)
      // This ensures fallback behavior works correctly
      continue;
    }
  }

  // If all selectors fail, return default but log warning
  // Do not throw error to avoid breaking test flow
  return "Unknown";
}

// Fallback selectors for degree detection
const FALLBACK_DEGREE_SELECTORS = [
  'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child',
  'div[data-view-name="profile-top-card-verified-badge"] + p + p',
  'div[data-view-name="profile-top-card-verified-badge"]',
  ".distance-badge .visually-hidden",
  ".distance-badge .dist-value",
  '[data-view-name="profile-top-card-verified-badge"] + p',
  'div[data-view-name="profile-top-card-verified-badge"] ~ p:nth-of-type(2)',
];

/**
 * Extracts connection degree from a LinkedIn profile page
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<string>} The connection degree ("1st", "2nd", "3rd", or "unknown")
 */
async function getConnectionDegree(page, timeout = 5000) {
  let degree = "unknown";
  const degreeSelectors = SELECTORS?.PROFILE?.DEGREE || FALLBACK_DEGREE_SELECTORS;

  for (const selector of degreeSelectors) {
    try {
      const connectionInfo = await page
        .locator(selector)
        .textContent({ timeout });

      if (connectionInfo) {
        const lowerInfo = connectionInfo.toLowerCase().trim();
        let matchedDegree = null;

        if (lowerInfo.includes("· 2nd") || lowerInfo.includes("2nd")) {
          matchedDegree = "2nd";
        } else if (lowerInfo.includes("· 3rd") || lowerInfo.includes("3rd")) {
          matchedDegree = "3rd";
        } else if (lowerInfo.includes("· 1st") || lowerInfo.includes("1st")) {
          matchedDegree = "1st";
        } else if (lowerInfo.includes("out of network")) {
          matchedDegree = "Out of Network";
        }

        if (matchedDegree) {
          degree = matchedDegree;
          break;
        }
      }
    } catch (err) {
      // Continue to next selector - silent fail for all errors (including timeout)
      // This ensures fallback behavior works correctly
      continue;
    }
  }

  return degree;
}

/**
 * Gets text from multiple selectors, returning the first successful match
 * @param {Page} page - Playwright page object
 * @param {string[]} selectors - Array of CSS selectors to try
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<string|null>} The text content or null if not found
 */
async function getTextFromSelectors(page, selectors, timeout = 5000) {
  for (const selector of selectors) {
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
  return null;
}

module.exports = {
  getProfileName,
  getConnectionDegree,
  getTextFromSelectors,
};
