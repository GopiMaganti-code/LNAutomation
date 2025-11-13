# Claude AI Assistant Context

This document provides context for AI assistants working with this LinkedIn automation codebase.

## Project Overview

This is a **LinkedIn automation framework** built with Playwright that automates various LinkedIn interactions while maintaining stealth and human-like behavior patterns.

## Key Context Points

### 1. Project Purpose

- Automates LinkedIn interactions (messaging, connections, posts, jobs)
- Supports multiple LinkedIn accounts with isolated sessions
- Implements stealth techniques to avoid bot detection
- Handles MFA authentication automatically

### 2. Technology Stack

- **Playwright**: Browser automation (`@playwright/test`)
- **Node.js**: Runtime (CommonJS modules)
- **Speakeasy**: TOTP token generation for MFA
- **dotenv**: Environment configuration

### 3. Architecture Patterns

#### Modular Structure

- **Helpers**: Reusable utility functions (`src/helpers/`)
- **Actions**: Business logic modules (`src/actions/`)
- **Selectors**: Centralized CSS selectors (`src/selectors/`)
- **Pages**: Page Object Model classes (`src/pages/`)

#### Key Design Principles

- **Separation of Concerns**: Helpers, actions, and selectors are separated
- **DRY (Don't Repeat Yourself)**: Common functionality extracted to helpers
- **Human Simulation**: All interactions include delays and randomness
- **Error Resilience**: Graceful error handling with fallbacks

### 4. Authentication System

The authentication flow is handled by `linkedinAuth.js`:

```
Session Check → Login → MFA → Session Save → Watchdog
```

**Key Files:**

- `linkedinAuth.js`: Main authentication module with `LinkedInSession` class
- `src/login.spec.js`: Legacy login test (may be outdated)
- `src/helpers/stealth.js`: Stealth patches for bot detection avoidance

**Authentication Flow:**

1. Attempts to restore session from saved state file
2. If expired/invalid, performs login
3. Handles MFA with TOTP tokens (speakeasy)
4. Saves session state for future use
5. Watchdog monitors session validity

### 5. Main Entry Points

#### Primary Test File

- `src/allActions4.spec.js`: Main comprehensive test file with all actions
- `src/allActions3.spec.js`: Previous version (reference)

#### Action Execution

Actions are executed based on `ACTION` environment variable:

```javascript
const actions = {
  view_feed: viewFeed,
  send_message: async () => {
    /* ... */
  },
  // ... 30+ actions
};
```

### 6. Selector Management

**Centralized Selectors:**

- `src/selectors/selectors.js`: Main selector definitions
- Selectors organized by category (PROFILE, BUTTONS, etc.)
- Fallback selectors in helper functions if import fails

**Selector Patterns:**

- Multiple selectors per element (fallback chain)
- Data attributes preferred (`data-view-name`)
- Aria labels for accessibility
- Class names as fallback

### 7. Human-like Interactions

All interactions simulate human behavior:

**Functions:**

- `randomDelay()`: Variable delays between actions
- `humanType()`: Character-by-character typing with pauses
- `humanMouse()`: Random mouse movements
- `humanScroll()`: Natural scrolling patterns
- `humanIdle()`: Reading/pause simulation

**Location:** `src/helpers/human-interactions.js`

### 8. Stealth Techniques

**Implemented in:** `src/helpers/stealth.js` and `linkedinAuth.js`

**Techniques:**

- `navigator.webdriver` = false
- Canvas fingerprint randomization
- WebGL parameter spoofing
- Audio buffer noise
- Plugin array simulation
- Deterministic device fingerprints per account

### 9. Session Management

**Per-Account Sessions:**

- State files: `linkedin-states/linkedin-{account}.json`
- 30-day expiration (configurable)
- Automatic cleanup on expiration
- Watchdog for session monitoring

**State File Structure:**

```json
{
  "cookies": [...],
  "origins": [...]
}
```

### 10. Error Handling

**Error Patterns:**

- Silent failures for non-critical operations
- Fallback selectors when primary fails
- Try-catch blocks around all interactions
- Logging for debugging

**Error Module:** `src/helpers/error.js`

### 11. Common Patterns

#### Profile Name Extraction

```javascript
const nameSelectors = [
  "h1",
  'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
  // ... fallbacks
];
```

#### Button Finding

```javascript
const button = await getVisibleLocator(page, [
  'button[aria-label*="Message"]',
  'a[data-view-name="profile-primary-message"]',
  // ... fallbacks
]);
```

#### Human Interaction Sequence

```javascript
await humanMouse(page, 2);
await button.scrollIntoViewIfNeeded();
await randomDelay(500, 1000);
await button.click({ delay: 100 });
```

### 12. Environment Variables

**Required:**

- `LINKEDIN_EMAIL`: LinkedIn account email
- `LINKEDIN_PASSWORD`: LinkedIn account password
- `LINKEDIN_TOTP_SECRET`: Base32 TOTP secret

**Optional:**

- `STORAGE_FILE`: Session state file path
- `PROFILE_URLS`: Comma-separated profile URLs
- `ACTION`: Action to execute
- `POST_CONTENT`: Content for posts
- `IMAGE_PATH`: Path to image for image posts
- `JOB_KEYWORDS`: Comma-separated job keywords
- `EXPERIENCE`: Experience level filter
- `MAX_JOBS`: Maximum jobs to apply to

### 13. File Naming Conventions

- **Test files**: `*.spec.js`
- **Helper files**: `*-helpers.js` or `*-helpers/*.js`
- **Action files**: `*-actions.js` or `actions/*.js`
- **State files**: `linkedinStealth-state-{account}.json`

### 14. Common Issues & Solutions

#### Selector Failures

- **Cause**: LinkedIn UI changes
- **Solution**: Update selectors in `src/selectors/selectors.js`
- **Pattern**: Use multiple fallback selectors

#### MFA Failures

- **Cause**: TOTP token expired or incorrect secret
- **Solution**: Verify TOTP secret format (base32)
- **Pattern**: Retry logic with token regeneration

#### Session Expiration

- **Cause**: 30-day expiration or manual logout
- **Solution**: Watchdog detects and re-authenticates
- **Pattern**: Automatic session restoration

### 15. Code Modification Guidelines

When modifying code:

1. **Maintain Human-like Behavior**: Always include delays and randomness
2. **Update Selectors**: If LinkedIn UI changes, update centralized selectors
3. **Error Handling**: Use try-catch with graceful fallbacks
4. **Logging**: Include console.log for debugging
5. **Session Management**: Ensure session state is saved after login
6. **Stealth**: Maintain stealth patches in all browser contexts

### 16. Testing Strategy

- **Headless Mode**: Disabled by default (headless: false)
- **Timeouts**: 60 seconds default, 20 minutes for full test
- **Retries**: 0 (no automatic retries)
- **Screenshots**: Only on failure
- **Videos**: Retained on failure

### 17. Key Dependencies

```json
{
  "@playwright/test": "^1.56.1",
  "playwright": "^1.55.0",
  "speakeasy": "^2.0.0",
  "dotenv": "^17.2.2"
}
```

### 18. Browser Configuration

- **Browser**: Chromium (Chrome channel)
- **Viewport**: 1280x720 (or maximized)
- **Locale**: en-US
- **Timezone**: Asia/Kolkata (configurable per account)
- **User Agent**: Chrome-based (version varies per account)

### 19. Action Categories

1. **Profile Actions**: View, check degree, send messages
2. **Feed Actions**: View, like, comment, post
3. **Connection Actions**: Connect, follow, withdraw
4. **Job Actions**: Search, apply, scrape
5. **Analytics Actions**: Impressions, engagement metrics
6. **Message Actions**: Send, check replies, follow-ups

### 20. Future Considerations

- **Rate Limiting**: Implement per-action rate limits
- **Queue System**: Batch actions with delays
- **Monitoring**: Add metrics and alerting
- **CI/CD**: Automated testing pipeline
- **Multi-threading**: Parallel account execution

## Quick Reference

**Main Files:**

- `src/allActions4.spec.js` - Main test file
- `linkedinAuth.js` - Authentication module
- `src/helpers/` - Utility functions
- `src/selectors/selectors.js` - CSS selectors

**Key Functions:**

- `getProfileName()` - Extract profile name
- `getConnectionDegree()` - Get connection degree
- `getVisibleLocator()` - Find visible elements
- `humanType()` - Human-like typing
- `addStealth()` - Apply stealth patches

**Key Classes:**

- `LinkedInSession` - Session management class
