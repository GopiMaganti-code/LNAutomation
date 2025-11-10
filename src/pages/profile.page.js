/**
 * Profile Page Object
 * Handles interactions with LinkedIn profile pages
 */

const BasePage = require("./base.page");
const { SELECTORS } = require("../selectors/selectors");
const {
  getProfileName,
  getConnectionDegree,
} = require("../helpers/profile-helpers");
const { getVisibleLocator } = require("../helpers/ui-helpers");

class ProfilePage extends BasePage {
  constructor(page) {
    super(page);
    this.nameLocator = this.page.locator(SELECTORS.PROFILE.NAME[0]);
  }

  /**
   * Navigate to a profile URL
   * @param {string} url - LinkedIn profile URL
   */
  async gotoProfile(url) {
    await this.goto(url);
    await this.waitForLoadState("networkidle");
  }

  /**
   * Get the profile name
   * @returns {Promise<string>} Profile name
   */
  async getName() {
    return await getProfileName(this.page);
  }

  /**
   * Get the connection degree
   * @returns {Promise<string>} Connection degree ("1st", "2nd", "3rd", or "unknown")
   */
  async getDegree() {
    return await getConnectionDegree(this.page);
  }

  /**
   * Find and click the message button
   * @returns {Promise<boolean>} True if message button was found and clicked
   */
  async clickMessageButton() {
    const messageButton = await getVisibleLocator(
      this.page,
      SELECTORS.BUTTONS.MESSAGE,
      true
    );
    if (messageButton) {
      await messageButton.click({ delay: 100 });
      return true;
    }
    return false;
  }

  /**
   * Find and click the connect button
   * @returns {Promise<boolean>} True if connect button was found and clicked
   */
  async clickConnectButton() {
    const connectButton = await getVisibleLocator(
      this.page,
      SELECTORS.BUTTONS.CONNECT,
      true
    );
    if (connectButton) {
      await connectButton.click({ delay: 100 });
      return true;
    }
    return false;
  }

  /**
   * Find and click the follow button
   * @returns {Promise<boolean>} True if follow button was found and clicked
   */
  async clickFollowButton() {
    const followButton = await getVisibleLocator(
      this.page,
      SELECTORS.BUTTONS.FOLLOW,
      true
    );
    if (followButton) {
      await followButton.click({ delay: 100 });
      return true;
    }
    return false;
  }

  /**
   * Check if already following
   * @returns {Promise<boolean>} True if already following
   */
  async isFollowing() {
    const followingButton = await getVisibleLocator(
      this.page,
      SELECTORS.BUTTONS.FOLLOWING,
      false,
      3000
    );
    return followingButton !== null;
  }

  /**
   * Check connection status
   * @returns {Promise<string>} Connection status ("1st", "Pending", "Not Sent", etc.)
   */
  async getConnectionStatus() {
    const degree = await this.getDegree();
    if (degree === "1st") {
      return "Connected";
    }

    // Check for accept button (incoming request)
    const acceptButton = await getVisibleLocator(
      this.page,
      SELECTORS.BUTTONS.ACCEPT,
      false,
      3000
    );
    if (acceptButton) {
      return "Incoming Request";
    }

    // Check for pending button (outgoing request)
    const pendingButton = await getVisibleLocator(
      this.page,
      SELECTORS.BUTTONS.PENDING,
      false,
      3000
    );
    if (pendingButton) {
      return "Pending";
    }

    // Check for connect button (not sent)
    const connectButton = await getVisibleLocator(
      this.page,
      SELECTORS.BUTTONS.CONNECT,
      true,
      3000
    );
    if (connectButton) {
      return "Not Sent";
    }

    return "Unknown";
  }
}

module.exports = ProfilePage;
