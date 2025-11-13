# Authentication Documentation

## Overview

The authentication system handles LinkedIn login with MFA support, session persistence, and automatic re-authentication.

## Authentication Files

### Primary Files

1. **`linkedinAuth.js`** - Main authentication module

   - `LinkedInSession` class
   - Session management
   - MFA handling
   - Watchdog implementation

2. **`src/login.spec.js`** - Legacy login test

   - Basic login flow
   - May be outdated

3. **`src/helpers/stealth.js`** - Stealth patches

   - Browser fingerprint masking
   - Bot detection avoidance

4. **`src/allActions4.spec.js`** - Main test file
   - Uses `linkedinAuth.js` or inline authentication
   - Action execution after authentication

## Authentication Flow

### Complete Login Process

```
┌─────────────────────────────────────────┐
│  1. Initialize LinkedInSession          │
│     - Load session state file            │
│     - Generate deterministic fingerprint │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Launch Browser Context              │
│     - Apply stealth patches              │
│     - Load saved cookies (if exists)     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Validate Session                    │
│     - Navigate to feed                  │
│     - Check for login redirect          │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
    Valid?        Expired?
        │             │
        ▼             ▼
┌──────────┐  ┌──────────────────┐
│ Continue │  │ 4. Perform Login  │
│ to Feed  │  └────────┬──────────┘
└──────────┘           │
                       ▼
            ┌──────────────────────┐
            │ 4a. Navigate to Login│
            │     - LinkedIn login  │
            │       page            │
            └──────────┬────────────┘
                       ▼
            ┌──────────────────────┐
            │ 4b. Enter Credentials │
            │     - Human-like type │
            │     - Email & Password│
            └──────────┬────────────┘
                       ▼
            ┌──────────────────────┐
            │ 4c. Submit Form      │
            │     - Hover & click  │
            └──────────┬────────────┘
                       ▼
            ┌──────────────────────┐
            │ 4d. Handle MFA       │
            │     - Check for MFA   │
            │     - Generate TOTP   │
            │     - Enter token     │
            │     - Retry if needed │
            └──────────┬────────────┘
                       ▼
            ┌──────────────────────┐
            │ 4e. Wait for Feed    │
            │     - Verify login    │
            │       success         │
            └──────────┬────────────┘
                       │
                       ▼
┌─────────────────────────────────────────┐
│  5. Save Session State                  │
│     - Save cookies & storage            │
│     - Write to state file               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  6. Start Watchdog (Optional)          │
│     - Monitor session validity          │
│     - Auto re-login on expiration       │
└─────────────────────────────────────────┘
```

## File Interactions

### How Authentication Files Work Together

```
┌─────────────────────────────────────────────────┐
│            allActions4.spec.js                  │
│  (Main Test File)                               │
│                                                 │
│  - Imports helpers                             │
│  - Uses stealth patches                        │
│  - May use LinkedInSession or inline auth      │
└────────────┬────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌──────────┐   ┌──────────────┐
│ stealth  │   │ linkedinAuth │
│   .js    │   │     .js      │
└──────────┘   └──────┬───────┘
                      │
                      ▼
            ┌──────────────────┐
            │ LinkedInSession  │
            │   Class          │
            │                  │
            │ - launchWithState│
            │ - doLogin        │
            │ - saveState      │
            │ - startWatchdog  │
            └──────────────────┘
```

## Detailed Component Breakdown

### 1. LinkedInSession Class (`linkedinAuth.js`)

#### Constructor

```javascript
constructor(account, opts = {}) {
  this.account = account;
  this.stateFile = `linkedin-${account}.json`;
  this.fingerprint = getFingerprint(account);
  // ...
}
```

**Responsibilities:**

- Account identification
- State file path management
- Fingerprint generation

#### launchWithState()

```javascript
async launchWithState() {
  // Launch browser with saved state
  // Apply stealth patches
  // Validate session
  // Return browser, context, page
}
```

**Flow:**

1. Launch Chromium browser
2. Create context with saved state (if exists)
3. Add stealth init script
4. Create new page
5. Quick validation (navigate to feed)
6. Clear state if expired

#### doLogin()

```javascript
async doLogin() {
  // Navigate to login page
  // Enter credentials
  // Handle MFA
  // Wait for feed
  // Save state
}
```

**Detailed Steps:**

1. **Navigate to Login**

   ```javascript
   await page.goto("https://www.linkedin.com/login");
   ```

2. **Enter Email**

   ```javascript
   await humanType(page, "#username", email);
   ```

3. **Enter Password**

   ```javascript
   await humanType(page, "#password", password);
   ```

4. **Submit Form**

   ```javascript
   await page.locator('button[type="submit"]').click();
   ```

5. **Handle MFA Prompt**

   ```javascript
   // Check for "Verify using authenticator app" link
   const authLink = page.locator(
     'a:has-text("Verify using authenticator app")'
   );
   if (await authLink.isVisible()) {
     await authLink.click();
   }
   ```

6. **Enter TOTP Token**

   ```javascript
   const token = speakeasy.totp({
     secret: process.env.LINKEDIN_TOTP_SECRET,
     encoding: "base32",
   });
   await humanType(page, 'input[name="pin"]', token);
   ```

7. **Retry Logic**

   ```javascript
   for (let attempt = 1; attempt <= 4; attempt++) {
     // Generate new token
     // Enter token
     // Check for success
     // Retry if failed
   }
   ```

8. **Verify Success**

   ```javascript
   await page.waitForURL(/linkedin\.com\/feed/, { timeout: 30000 });
   ```

9. **Save State**
   ```javascript
   await this.saveState();
   ```

#### ensureLoggedInIfNeeded()

```javascript
async ensureLoggedInIfNeeded() {
  // Check if on login page
  // Clear state if expired
  // Re-launch and login
}
```

**Use Cases:**

- Session expiration during execution
- Manual logout detection
- Watchdog-triggered re-authentication

#### Watchdog System

```javascript
startWatchdog(intervalSeconds = 15) {
  setInterval(async () => {
    // Check current URL
    // Detect logout
    // Trigger re-authentication
  }, intervalSeconds * 1000);
}
```

**Features:**

- Background monitoring
- Automatic re-login
- Configurable interval
- Graceful error handling

### 2. Stealth Patches (`src/helpers/stealth.js`)

#### addStealth()

```javascript
async function addStealth(page) {
  await page.addInitScript(() => {
    // Navigator.webdriver = false
    // Canvas fingerprint randomization
    // WebGL parameter spoofing
    // Audio buffer noise
  });
}
```

**Patches Applied:**

1. **WebDriver Property**

   ```javascript
   Object.defineProperty(navigator, "webdriver", { get: () => false });
   ```

2. **Chrome Runtime**

   ```javascript
   window.chrome = { runtime: {} };
   ```

3. **Plugins Array**

   ```javascript
   Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
   ```

4. **Languages**

   ```javascript
   Object.defineProperty(navigator, "languages", {
     get: () => ["en-US", "en"],
   });
   ```

5. **Canvas Fingerprint**

   ```javascript
   HTMLCanvasElement.prototype.toDataURL = function () {
     // Add noise to canvas
   };
   ```

6. **WebGL Fingerprint**

   ```javascript
   WebGLRenderingContext.prototype.getParameter = function (param) {
     // Spoof GPU vendor/renderer
   };
   ```

7. **Audio Fingerprint**
   ```javascript
   AudioBuffer.prototype.getChannelData = function () {
     // Add random noise
   };
   ```

### 3. Human-like Interactions

#### Typing Simulation

```javascript
async function humanType(page, locator, text) {
  const el = page.locator(locator);
  await el.click();
  for (const ch of text) {
    await el.type(ch, { delay: Math.random() * 160 + 40 });
    if (Math.random() < 0.12) {
      await randomDelay(300, 800); // Occasional pause
    }
  }
}
```

#### Mouse Movements

```javascript
async function humanMouse(page, moves = 4) {
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    await page.mouse.move(x, y, { steps: random(3, 12) });
    await randomDelay(200, 700);
  }
}
```

## Session State Management

### State File Structure

```json
{
  "cookies": [
    {
      "name": "li_at",
      "value": "...",
      "domain": ".linkedin.com",
      "path": "/",
      "expires": 1234567890,
      "httpOnly": true,
      "secure": true,
      "sameSite": "None"
    }
  ],
  "origins": [
    {
      "origin": "https://www.linkedin.com",
      "localStorage": [
        {
          "name": "key",
          "value": "value"
        }
      ]
    }
  ]
}
```

### State File Location

- **Path**: `linkedin-states/linkedin-{account}.json`
- **Format**: Playwright storageState format
- **Expiration**: 30 days (configurable)

### State Lifecycle

1. **Creation**: After successful login
2. **Loading**: On browser context creation
3. **Validation**: Quick feed navigation check
4. **Expiration**: Automatic cleanup
5. **Refresh**: On re-authentication

## MFA Implementation

### TOTP Token Generation

```javascript
const speakeasy = require("speakeasy");

const token = speakeasy.totp({
  secret: process.env.LINKEDIN_TOTP_SECRET, // Base32 encoded
  encoding: "base32",
  time: Math.floor(Date.now() / 1000), // Current time
});
```

### MFA Flow

1. **Detection**

   ```javascript
   const mfaInput = page.locator('input[name="pin"]');
   if (await mfaInput.isVisible({ timeout: 7000 })) {
     // MFA required
   }
   ```

2. **Token Entry**

   ```javascript
   const token = speakeasy.totp({ secret, encoding: "base32" });
   await humanType(page, 'input[name="pin"]', token);
   ```

3. **Submission**

   ```javascript
   await page.locator('button[type="submit"]').click();
   ```

4. **Retry Logic**
   ```javascript
   for (let attempt = 1; attempt <= 4; attempt++) {
     const token = speakeasy.totp({ secret, encoding: "base32" });
     // Enter and submit
     // Check for success
     // Wait before retry if failed
   }
   ```

### MFA Scenarios

1. **Push Notification Screen**

   - Detect: `h1:has-text("Check your LinkedIn app")`
   - Action: Click "Verify using authenticator app"

2. **TOTP Input Screen**

   - Detect: `input[name="pin"]`
   - Action: Generate and enter TOTP token

3. **Token Expiration**
   - Detect: Still on MFA page after submission
   - Action: Generate new token and retry

## Error Handling

### Login Errors

1. **Invalid Credentials**

   - Detection: Login page remains
   - Handling: Log error, stop execution

2. **MFA Failure**

   - Detection: MFA page after 4 attempts
   - Handling: Throw error, log attempts

3. **Network Errors**

   - Detection: Timeout or connection error
   - Handling: Retry with exponential backoff

4. **Session Expiration**
   - Detection: Redirect to login page
   - Handling: Clear state, re-authenticate

### Watchdog Errors

- **Silent Failures**: Watchdog errors don't crash main process
- **Logging**: Errors logged for debugging
- **Recovery**: Automatic re-authentication attempt

## Security Considerations

### Credential Storage

- **Never in code**: All credentials in `.env`
- **Never in logs**: Credentials masked in output
- **Never in state files**: Only session cookies stored

### Session Security

- **Local storage only**: State files not in version control
- **Automatic expiration**: 30-day limit
- **Secure cookies**: HttpOnly, Secure flags

### TOTP Secret

- **Base32 format**: Required encoding
- **Environment variable**: Never hardcoded
- **Rotation**: Support for secret updates

## Troubleshooting

### Common Issues

1. **"MFA failed after retries"**

   - Check TOTP secret format (base32)
   - Verify authenticator app is synced
   - Check system time accuracy

2. **"Session expired"**

   - Normal after 30 days
   - Watchdog will auto re-authenticate
   - Manual re-login if needed

3. **"Login page not found"**

   - Check LinkedIn URL
   - Verify network connectivity
   - Check for LinkedIn changes

4. **"State file not loading"**
   - Verify file exists
   - Check file permissions
   - Validate JSON format

## Best Practices

1. **Always use human-like interactions**

   - Delays between actions
   - Random mouse movements
   - Natural typing patterns

2. **Maintain stealth patches**

   - Apply to all browser contexts
   - Keep patches updated
   - Test fingerprint changes

3. **Handle errors gracefully**

   - Try-catch around all operations
   - Fallback mechanisms
   - Comprehensive logging

4. **Monitor session state**
   - Use watchdog for long-running tasks
   - Check session validity periodically
   - Save state after important operations
