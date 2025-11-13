# Architecture Documentation

## Overview

This LinkedIn automation framework follows a modular, maintainable architecture designed for extensibility and reliability.

## Architecture Patterns

### 1. Modular Design

The codebase is organized into distinct modules with clear responsibilities:

```
┌─────────────────────────────────────────┐
│         Test Files (*.spec.js)          │
│  (Orchestration & Action Execution)     │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────────┐    ┌───────▼────────┐
│  Actions   │    │    Helpers    │
│  Modules   │    │   (Utils)     │
└───┬────────┘    └───────┬───────┘
    │                     │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   Selectors &       │
    │   Page Objects      │
    └─────────────────────┘
```

### 2. Separation of Concerns

#### Test Layer (`src/*.spec.js`)

- **Responsibility**: Test orchestration, action selection, environment setup
- **Pattern**: Playwright test structure with beforeAll/afterAll hooks
- **Example**: `allActions4.spec.js`

#### Action Layer (`src/actions/`)

- **Responsibility**: Business logic for specific LinkedIn actions
- **Pattern**: Isolated functions that can be composed
- **Example**: `feed-actions.js`, `message-actions.js`

#### Helper Layer (`src/helpers/`)

- **Responsibility**: Reusable utilities, common operations
- **Pattern**: Pure functions with clear inputs/outputs
- **Categories**:
  - `human-interactions.js`: Behavior simulation
  - `profile-helpers.js`: Data extraction
  - `ui-helpers.js`: UI interactions
  - `stealth.js`: Bot detection avoidance
  - `error.js`: Error handling

#### Selector Layer (`src/selectors/`)

- **Responsibility**: Centralized CSS selector definitions
- **Pattern**: Organized by feature/component
- **Benefits**: Single source of truth, easy updates

#### Page Object Layer (`src/pages/`)

- **Responsibility**: Encapsulated page interactions
- **Pattern**: Page Object Model (POM)
- **Example**: `base.page.js`, `profile.page.js`

### 3. Dependency Injection

Helpers and utilities are imported where needed:

```javascript
// In test file
const { getProfileName } = require("./helpers/profile-helpers");
const { humanType } = require("./helpers/human-interactions");
```

### 4. Configuration Management

#### Environment Variables

- Centralized in `.env` file
- Loaded via `dotenv` at startup
- Type-safe access through `process.env`

#### Selector Configuration

- Centralized in `src/selectors/selectors.js`
- Fallback selectors in helper functions
- Easy to update when LinkedIn UI changes

### 5. Session Management Pattern

#### Per-Account Isolation

```javascript
class LinkedInSession {
  constructor(account) {
    this.account = account;
    this.stateFile = `linkedin-${account}.json`;
    this.fingerprint = getFingerprint(account);
  }
}
```

**Benefits:**

- Isolated sessions per account
- Deterministic fingerprints
- Independent state management

#### State Persistence

- **Storage**: JSON files in `linkedin-states/`
- **Format**: Playwright storageState format
- **Expiration**: 30 days (configurable)
- **Cleanup**: Automatic on expiration

### 6. Error Handling Strategy

#### Graceful Degradation

```javascript
async function getProfileName(page) {
  for (const selector of selectors) {
    try {
      const text = await page.locator(selector).textContent();
      if (text) return text.trim();
    } catch {
      continue; // Try next selector
    }
  }
  return "Unknown"; // Fallback value
}
```

#### Error Categories

1. **Non-Critical**: Silent failures with fallbacks
2. **Critical**: Logged and propagated
3. **Recoverable**: Retry logic implemented

### 7. Human Behavior Simulation

#### Layered Simulation

```javascript
// Layer 1: Delays
await randomDelay(500, 1000);

// Layer 2: Mouse Movement
await humanMouse(page, 2);

// Layer 3: Typing
await humanType(page, selector, text);

// Layer 4: Scrolling
await humanScroll(page, 3);
```

#### Randomization

- Variable delays (min-max ranges)
- Random mouse positions
- Character-by-character typing
- Natural scrolling patterns

### 8. Stealth Architecture

#### Init Script Injection

```javascript
await context.addInitScript(stealthInitScript());
```

#### Fingerprint Management

- Per-account deterministic fingerprints
- Consistent across sessions
- Realistic browser characteristics

### 9. Action Execution Pattern

#### Action Registry

```javascript
const actions = {
  view_feed: viewFeed,
  send_message: async () => {
    for (const url of PROFILE_URLS) {
      await sendMessage(page, url);
    }
  },
  // ...
};
```

#### Dynamic Execution

```javascript
const actionFunc = actions[ACTION];
if (actionFunc) await actionFunc();
```

### 10. Selector Fallback Pattern

#### Multi-Selector Strategy

```javascript
const selectors = [
  "primary-selector", // Most reliable
  "fallback-selector-1", // Alternative
  "fallback-selector-2", // Legacy
];
```

#### Benefits

- Resilience to UI changes
- Support for multiple LinkedIn UI versions
- Gradual migration path

## Data Flow

### Authentication Flow

```
1. Load Session State
   ↓
2. Validate Session
   ↓
3. Login (if needed)
   ↓
4. MFA Handling
   ↓
5. Save Session State
   ↓
6. Start Watchdog
```

### Action Execution Flow

```
1. Parse Environment Variables
   ↓
2. Initialize Browser Context
   ↓
3. Apply Stealth Patches
   ↓
4. Authenticate (if needed)
   ↓
5. Execute Selected Action
   ↓
6. Human-like Interactions
   ↓
7. Error Handling & Logging
   ↓
8. Cleanup & Session Save
```

### Profile Interaction Flow

```
1. Navigate to Profile
   ↓
2. Extract Profile Data
   ├─ Name (multiple selectors)
   ├─ Degree (multiple selectors)
   └─ Image (multiple selectors)
   ↓
3. Perform Action
   ├─ Send Message
   ├─ Send Connection
   └─ Follow
   ↓
4. Human-like Delays
   ↓
5. Verify Success
```

## Design Principles

### 1. DRY (Don't Repeat Yourself)

- Common functionality extracted to helpers
- Reusable selector arrays
- Shared human interaction functions

### 2. Single Responsibility

- Each module has one clear purpose
- Helpers are focused on specific tasks
- Actions are isolated and composable

### 3. Open/Closed Principle

- Easy to add new actions
- Extendable without modifying core
- Plugin-like action registry

### 4. Dependency Inversion

- High-level modules depend on abstractions
- Helpers provide interfaces
- Easy to swap implementations

### 5. Fail-Safe Defaults

- Fallback selectors always available
- Default values for missing data
- Graceful error handling

## Scalability Considerations

### Multi-Account Support

- Per-account session isolation
- Parallel execution capability
- Resource management

### Action Extensibility

- Easy to add new actions
- Consistent patterns
- Reusable helpers

### Selector Maintenance

- Centralized management
- Version tracking
- Update procedures

## Security Architecture

### Credential Management

- Environment variables only
- Never in code or logs
- Secure storage practices

### Session Security

- Local file storage
- Not committed to version control
- Automatic expiration

### Stealth Techniques

- Browser fingerprint masking
- Human behavior simulation
- Rate limiting considerations

## Performance Optimizations

### Lazy Loading

- Selectors loaded on demand
- Helpers imported as needed
- State files loaded only when required

### Caching

- Session state persistence
- Selector result caching (implicit)
- Browser context reuse

### Resource Management

- Browser cleanup on completion
- Watchdog interval optimization
- Memory leak prevention

## Testing Architecture

### Test Structure

- Playwright test framework
- BeforeAll/afterAll hooks
- Isolated test execution

### Mocking Strategy

- Environment variable overrides
- Test-specific configurations
- Isolated state files

### Debugging Support

- Comprehensive logging
- Screenshot on failure
- Video recording on failure

## Future Architecture Enhancements

### Potential Improvements

1. **Queue System**: Batch action execution with delays
2. **Event-Driven**: Action events and listeners
3. **Plugin System**: External action plugins
4. **Metrics**: Performance and success tracking
5. **Configuration UI**: Web-based configuration
6. **API Layer**: REST API for remote control

### Migration Path

- Gradual refactoring
- Backward compatibility
- Version management
