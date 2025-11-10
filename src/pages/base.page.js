/**
 * Base Page Object
 * Base class for all page objects
 */

class BasePage {
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to a URL
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   */
  async goto(url, options = {}) {
    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
      ...options,
    });
  }

  /**
   * Wait for page to be fully loaded
   * @param {string} state - Load state to wait for
   */
  async waitForLoadState(state = "networkidle") {
    await this.page.waitForLoadState(state, { timeout: 10000 }).catch(() => {
      // Silent fail - continue execution
    });
  }

  /**
   * Wait for element to be visible
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForVisible(selector, timeout = 10000) {
    await this.page.locator(selector).waitFor({ state: "visible", timeout });
  }
}

module.exports = BasePage;
