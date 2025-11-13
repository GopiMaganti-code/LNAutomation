# Folder Structure Documentation

## Root Directory

```
Two-Factor-Auth/
├── src/                          # Main source code directory
├── linkedin-states/              # Session state files (per account)
├── test-results/                 # Playwright test results
├── node_modules/                 # NPM dependencies
├── linkedinAuth.js               # Main authentication module
├── package.json                  # Project dependencies and scripts
├── package-lock.json             # Locked dependency versions
├── playwright.config.js           # Playwright configuration
├── .env                          # Environment variables (not in repo)
├── README.md                     # Project overview
├── CLAUDE.md                     # AI assistant context
├── ARCHITECTURE.md               # Architecture documentation
├── AUTHENTICATION.md             # Authentication flow docs
├── FOLDER_STRUCTURE.md           # This file
└── *.json                        # Various state/session files
```

## Source Directory (`src/`)

### Main Structure

```
src/
├── actions/                      # Action modules
│   ├── feed-actions.js           # Feed-related actions
│   └── message-actions.js        # Message-related actions
├── fixtures/                      # Playwright fixtures
│   └── authenticated-fixture.js  # Pre-authenticated test fixture
├── helpers/                      # Utility functions
│   ├── error.js                  # Error handling utilities
│   ├── human-interactions.js     # Human behavior simulation
│   ├── profile-helpers.js        # Profile data extraction
│   ├── stealth.js                # Stealth patches
│   └── ui-helpers.js             # UI interaction utilities
├── pages/                        # Page Object Model classes
│   ├── base.page.js              # Base page class
│   └── profile.page.js           # Profile page class
├── selectors/                    # Centralized CSS selectors
│   └── selectors.js              # All CSS selectors
├── tests/                        # Additional test files
└── *.spec.js                     # Playwright test files
```

## Detailed Breakdown

### `/src/actions/` - Action Modules

**Purpose**: Isolated business logic for specific LinkedIn actions

**Files**:
- `feed-actions.js`: Feed viewing, liking, commenting, posting
- `message-actions.js`: Sending messages, checking replies

**Pattern**:
```javascript
// Export action functions
module.exports = {
  viewFeed,
  likePost,
  commentPost
};
```

### `/src/helpers/` - Utility Functions

**Purpose**: Reusable helper functions used across the codebase

#### `error.js`
- Error handling utilities
- Custom error classes
- Error formatting

#### `human-interactions.js`
- `randomDelay()`: Variable delays
- `humanType()`: Human-like typing
- `humanMouse()`: Random mouse movements
- `humanScroll()`: Natural scrolling
- `humanIdle()`: Reading simulation

#### `profile-helpers.js`
- `getProfileName()`: Extract profile name
- `getConnectionDegree()`: Get connection degree
- `getTextFromSelectors()`: Multi-selector text extraction

#### `stealth.js`
- `addStealth()`: Apply stealth patches
- Browser fingerprint masking
- Bot detection avoidance

#### `ui-helpers.js`
- `closeAllMessageBoxes()`: Close message overlays
- `getVisibleLocator()`: Find visible elements with fallbacks

### `/src/pages/` - Page Object Model

**Purpose**: Encapsulated page interactions

**Files**:
- `base.page.js`: Base class with common methods
- `profile.page.js`: Profile-specific interactions

**Pattern**:
```javascript
class ProfilePage extends BasePage {
  async getProfileName() { /* ... */ }
  async sendMessage(text) { /* ... */ }
}
```

### `/src/selectors/` - CSS Selectors

**Purpose**: Centralized selector definitions

**File**: `selectors.js`

**Structure**:
```javascript
module.exports = {
  PROFILE: {
    NAME: [...],
    DEGREE: [...],
    IMAGE: [...]
  },
  BUTTONS: {
    MESSAGE: [...],
    CONNECT: [...]
  }
};
```

### `/src/fixtures/` - Playwright Fixtures

**Purpose**: Reusable test fixtures

**File**: `authenticated-fixture.js`

**Usage**: Pre-authenticated browser context for tests

### `/src/*.spec.js` - Test Files

**Purpose**: Playwright test files

**Key Files**:
- `allActions4.spec.js`: Main comprehensive test file (4406 lines)
- `allActions3.spec.js`: Previous version (reference)
- `login.spec.js`: Legacy login test
- `checkDegree.spec.js`: Degree checking test
- `sendMessage.spec.js`: Message sending test
- `viewFeed.spec.js`: Feed viewing test
- And many more...

**Pattern**:
```javascript
test.describe("Test Suite", () => {
  test.beforeAll(async () => { /* setup */ });
  test("Test Case", async () => { /* test */ });
  test.afterAll(async () => { /* cleanup */ });
});
```

## Root Level Files

### Configuration Files

#### `package.json`
- Project metadata
- Dependencies
- Scripts

#### `playwright.config.js`
- Playwright test configuration
- Browser settings
- Timeouts and retries

#### `.env` (not in repo)
- Environment variables
- Credentials
- Configuration

### Authentication Files

#### `linkedinAuth.js`
- `LinkedInSession` class
- Authentication logic
- Session management
- Watchdog implementation

### State Files

#### `linkedin-states/`
- Per-account session files
- Format: `linkedin-{account}.json`
- Contains cookies and storage state

#### Root Level JSON Files
- `linkedinStealth-state-*.json`: Legacy state files
- `connections.json`: Connection data
- `connections-state.json`: Connection state

### Documentation Files

- `README.md`: Project overview and quick start
- `CLAUDE.md`: AI assistant context
- `ARCHITECTURE.md`: Architecture patterns
- `AUTHENTICATION.md`: Authentication flow
- `FOLDER_STRUCTURE.md`: This file

## File Naming Conventions

### Test Files
- Pattern: `*.spec.js`
- Examples: `allActions4.spec.js`, `login.spec.js`

### Helper Files
- Pattern: `*-helpers.js` or `helpers/*.js`
- Examples: `profile-helpers.js`, `ui-helpers.js`

### Action Files
- Pattern: `*-actions.js` or `actions/*.js`
- Examples: `feed-actions.js`, `message-actions.js`

### Page Files
- Pattern: `*.page.js` or `pages/*.js`
- Examples: `base.page.js`, `profile.page.js`

### State Files
- Pattern: `*-state-*.json` or `linkedin-*.json`
- Examples: `linkedinStealth-state-Gopi.json`, `linkedin-Gopi.json`

## Directory Purposes

### `/src/` - Source Code
- All application code
- Organized by concern
- Modular structure

### `/linkedin-states/` - Session Storage
- Per-account session files
- Not in version control
- Auto-generated

### `/test-results/` - Test Output
- Playwright test results
- Screenshots on failure
- Videos on failure
- Auto-generated

### `/node_modules/` - Dependencies
- NPM packages
- Auto-generated
- Not in version control

## Import Patterns

### From Helpers
```javascript
const { getProfileName } = require("./helpers/profile-helpers");
const { humanType } = require("./helpers/human-interactions");
```

### From Actions
```javascript
const { viewFeed, likePost } = require("./actions/feed-actions");
```

### From Selectors
```javascript
const { SELECTORS } = require("./selectors/selectors");
```

### From Pages
```javascript
const ProfilePage = require("./pages/profile.page");
```

### From Root
```javascript
const LinkedInSession = require("../linkedinAuth");
```

## File Size Considerations

### Large Files
- `src/allActions4.spec.js`: 4406 lines (main test file)
- `src/allActions3.spec.js`: 4188 lines (reference)

**Note**: These files contain all actions inline. Consider refactoring to use action modules.

### Modular Files
- Helper files: ~50-200 lines each
- Action files: ~100-300 lines each
- Selector file: ~200 lines

## Future Structure Improvements

### Proposed Changes

1. **Action Extraction**
   ```
   src/actions/
   ├── feed/
   │   ├── view-feed.js
   │   ├── like-feed.js
   │   └── comment-feed.js
   ├── profile/
   │   ├── check-degree.js
   │   ├── send-message.js
   │   └── send-connection.js
   └── jobs/
       └── apply-jobs.js
   ```

2. **Configuration Separation**
   ```
   config/
   ├── selectors.js
   ├── constants.js
   └── defaults.js
   ```

3. **Test Organization**
   ```
   tests/
   ├── unit/
   ├── integration/
   └── e2e/
   ```

## File Dependencies

### Dependency Graph

```
allActions4.spec.js
├── helpers/
│   ├── profile-helpers.js
│   ├── ui-helpers.js
│   ├── human-interactions.js
│   └── error.js
├── selectors/
│   └── selectors.js
└── (optional) linkedinAuth.js
```

### Circular Dependencies
- None detected
- Clean import structure
- Unidirectional dependencies

## Version Control

### Ignored Files
- `.env`: Credentials
- `node_modules/`: Dependencies
- `test-results/`: Test output
- `linkedin-states/*.json`: Session files
- `*.json`: State files (except package files)

### Tracked Files
- All source code
- Configuration files
- Documentation
- Package files

