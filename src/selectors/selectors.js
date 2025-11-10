/**
 * Selector Constants
 * All CSS selectors extracted from allActions4.spec.js
 * DO NOT modify or rename selectors - only extract them as-is
 */

module.exports = {
  PROFILE: {
    NAME: [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
      ".text-heading-xlarge",
    ],
    DEGREE: [
      'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child',
      'div[data-view-name="profile-top-card-verified-badge"] + p + p',
      'div[data-view-name="profile-top-card-verified-badge"]',
      ".distance-badge .visually-hidden",
      ".distance-badge .dist-value",
      '[data-view-name="profile-top-card-verified-badge"] + p',
      'div[data-view-name="profile-top-card-verified-badge"] ~ p:nth-of-type(2)',
    ],
    IMAGE: [
      "img.profile-photo-edit__preview",
      ".pv-top-card__edit-photo img",
      ".profile-photo-edit.pv-top-card__edit-photo img",
      '[data-view-name="profile-top-card-member-photo"] img',
      'figure[data-view-name="image"] img',
      'img[data-loaded="true"]',
    ],
    VERIFIED: [
      'svg[data-test-icon="verified-medium"]',
      'svg[aria-label*="verifications"]',
      'div[data-view-name="profile-top-card-verified-badge"] svg',
    ],
  },
  BUTTONS: {
    MESSAGE: [
      "div.ph5 button:has-text('Message')",
      'a[data-view-name="profile-primary-message"]',
      'a[data-view-name="profile-secondary-message"]',
      'button[aria-label*="Message"]',
    ],
    CONNECT: [
      ".ph5 button:has-text('Connect')",
      'div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-connect-action"] a',
      'div[data-view-name="edge-creation-connect-action"] a',
      '[data-view-name="relationship-building-button"] a[aria-label^="Invite"][aria-label*="to connect"]',
      '[data-view-name="edge-creation-connect-action"] a[aria-label^="Invite"][aria-label*="to connect"]',
      '[data-view-name="relationship-building-button"] a:has(svg[id="connect-small"])',
      '[data-view-name="profile-secondary-message"] ~ [data-view-name="relationship-building-button"] a:has-text("Connect")',
      `[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label^="Invite"][aria-label*="to connect"]`,
      ".ph5 .artdeco-dropdown__content-inner span:has-text('Connect')",
      'a[href^="/preload/custom-invite/"]:has(svg[id="connect-small"])',
    ],
    FOLLOW: [
      ".ph5.pb5 [aria-label*='Follow']",
      'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
      'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
      'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
      'div[componentkey*="Topcard"]:has(a[data-view-name="profile-primary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
      'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
      'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
      'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
      ".ph5.pb5 .artdeco-dropdown__content-inner [aria-label*='Follow']",
      ".artdeco-dropdown__content-inner span:has-text('Follow')",
      ".artdeco-dropdown__content a[aria-label*='Follow']",
      "div[aria-label*='Follow']",
    ],
    FOLLOWING: [
      'div[data-view-name="edge-creation-follow-action"] button[aria-label*="Following, click to unfollow"]',
      'div[data-view-name="relationship-building-button"] button[aria-label*="Following, click to unfollow"]',
      ".ph5 button[aria-label*='Following']",
      ".artdeco-dropdown__content div[aria-label*='Unfollow']",
      `div[role="menu"] div[aria-label*="Following, click to unfollow"]`,
    ],
    ACCEPT: [
      ".ph5 [aria-label*='Accept']",
      'button[aria-label^="Accept"][aria-label*="request to connect"]',
      '[data-view-name="relationship-building-button"] button[aria-label*="Accept"]',
      '[data-view-name="edge-creation-accept-action"] button',
    ],
    PENDING: [
      ".ph5 button:has-text('Pending')",
      ".ph5 button:has-text('Withdraw')",
      'button[aria-label^="Pending, click to withdraw invitation"]',
      '[data-view-name="relationship-building-button"] button[aria-label*="Pending"]',
      '[data-view-name="edge-creation-withdraw-action"] button',
      ".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')",
      'button[aria-label^="Pending, click to withdraw invitation"]:has(svg[id="clock-small"])',
    ],
    MORE: [
      ".ph5 button:has-text('More')",
      ".ph5 [aria-label='More actions']",
      '[data-view-name="profile-overflow-button"]',
      '[data-view-name="relationship-building-button"] ~ button[aria-label="More"]',
      'button[data-view-name="profile-overflow-button"][aria-label="More"]',
      ".ph5.pb5 button:has-text('More')",
    ],
    REMOVE: [
      ".artdeco-dropdown__content span:has-text('Remove this connection')",
      ".artdeco-dropdown__content [aria-label*='Remove connection']",
      ".artdeco-dropdown__content li:has-text('Remove')",
    ],
    WITHDRAW: [
      ".artdeco-dropdown__content span:has-text('Withdraw invitation')",
      ".artdeco-dropdown__content [aria-label*='Withdraw invitation']",
      ".artdeco-dropdown__content li:has-text('Withdraw')",
    ],
    SEND: [
      '[role="dialog"] button[aria-label="Send without a note"]',
      'button[aria-label="Send without a note"]',
    ],
  },
  MESSAGES: {
    INPUT: "div.msg-form__contenteditable",
    SEND: "button.msg-form__send-button",
    CLOSE: [
      "button:has-text('Close your conversation')",
      ".msg-overlay-bubble-header__control svg[use*='close-small']",
      ".msg-overlay-bubble-header__controls.display-flex.align-items-center button",
      "button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text('Close your conversation with')",
    ],
    REPLY_ELEMENTS: ".msg-s-event-listitem--other",
    REPLY_BODY: ".msg-s-event-listitem__body",
    REPLY_NAME: ".msg-s-message-group__name",
    REPLY_TIMESTAMP: ".msg-s-message-group__timestamp",
    EVENT_CONTAINERS:
      "ul.msg-s-message-list-content > li.msg-s-message-list__event",
    TIME_HEADING: ".msg-s-message-list__time-heading",
    SEEN_RECEIPTS: ".msg-s-event-listitem__seen-receipts img",
  },
  FEED: {
    CONTAINER: [".scaffold-layout__content", ".feed-container"],
    LIKE_BUTTON: ".reactions-react-button button[aria-label*='Like']",
    POST_CONTAINER: [
      ".feed-shared-update-v2",
      ".occludable-update",
      '[data-urn*="urn:li:activity:"]',
      ".update-components-actor",
      ".feed-shared-actor",
    ],
    EMPTY_STATE: [
      'div[data-test-id="empty-state"]',
      ".scaffold-layout__empty-state",
      'p:has-text("No recent activity")',
      '[data-test-id="no-activity"]',
      ".artdeco-empty-state",
    ],
  },
  PROFILE_NAV: {
    ME: [
      "button[aria-label='Me']",
      "button[aria-label*='Me']",
      "nav button:has-text('Me')",
    ],
    AVATAR: ["img.global-nav__me-photo", "img[alt*='Profile photo']"],
    VIEW_PROFILE: ["a:has-text('View profile')", "a[href*='/in/']"],
  },
  ACTIVITY: {
    SHOW_ALL: [
      'a[aria-label="Show all"]',
      'a:has-text("Show all")',
      '.ph5 a[href*="/recent-activity/all/"]',
      `a[href*="/recent-activity/all/"]:has(span:has-text("Show all"))`,
      `a[href*="/recent-activity/all/"]:has-text("See all activity")`,
      `a[aria-label='Show all']`,
    ],
  },
  JOBS: {
    NAV: 'a[aria-label="Jobs, 0 new notifications"], a[aria-label*="Jobs"]',
    SEARCH_INPUT: 'combobox[name*="Search by title, skill, or company"]',
    TIME_FILTER:
      "#searchFilter_timePostedRange, [data-test-id='job-search-time-filter']",
    PAST_24H:
      "label:has-text('Past 24 hours'), [for*='timePostedRange-past_24']",
    SHOW_RESULTS: "button:has-text('Show results'), #searchFilter_apply",
    EASY_APPLY:
      "#searchFilter_applyWithLinkedin, [data-test-id='job-search-easy-apply-filter']",
    RESULTS_LIST: ".jobs-search-results-list, .semantic-search-results-list",
    EASY_APPLY_BUTTON: 'button[aria-label*="Easy Apply"]',
    NEXT_PAGE: 'button[aria-label="Next"]',
  },
};
