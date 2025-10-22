// require("dotenv").config();
// const { test, expect, chromium } = require("@playwright/test");
// const speakeasy = require("speakeasy");
// const fs = require("fs");

// // Local storage file to save LinkedIn session state
// const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Thanuja.json";
// const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
// const PROFILE_URLS = process.env.PROFILE_URLS || ""; // Comma-separated list, e.g., "url1","url2"

// /* ---------------------------
//    Human-like helpers
// --------------------------- */
// async function randomDelay(min = 1000, max = 3000) {
//   const t = Math.floor(Math.random() * (max - min + 1)) + min;
//   await new Promise((r) => setTimeout(r, t));
// }

// async function humanType(page, locator, text) {
//   const el = page.locator(locator);
//   await el.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
//   try {
//     await el.click({ delay: 100 });
//   } catch {}
//   for (const ch of text) {
//     await el.type(ch, { delay: Math.floor(Math.random() * 150) + 50 });
//     if (Math.random() < 0.12) await randomDelay(300, 800);
//   }
// }

// async function humanMouse(page, moves = 5) {
//   const size = page.viewportSize() || { width: 1280, height: 720 };
//   for (let i = 0; i < moves; i++) {
//     const x = Math.floor(Math.random() * size.width);
//     const y = Math.floor(Math.random() * size.height);
//     await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 12) + 3 });
//     await randomDelay(200, 600);
//   }
// }

// async function humanScroll(page, steps = 5) {
//   for (let i = 0; i < steps; i++) {
//     const dir = Math.random() > 0.2 ? 1 : -1;
//     await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
//     await randomDelay(800, 1600);
//   }
// }

// async function humanIdle(min = 3000, max = 6000) {
//   const wait = Math.floor(Math.random() * (max - min + 1)) + min;
//   await new Promise((r) => setTimeout(r, wait));
// }

// /* ---------------------------
//    Stealth patches
// --------------------------- */
// async function addStealth(page) {
//   await page.addInitScript(() => {
//     try {
//       Object.defineProperty(navigator, "webdriver", { get: () => false });
//       window.chrome = { runtime: {} };
//       Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
//       Object.defineProperty(navigator, "languages", {
//         get: () => ["en-US", "en"],
//       });

//       const toDataURL = HTMLCanvasElement.prototype.toDataURL;
//       HTMLCanvasElement.prototype.toDataURL = function () {
//         const ctx = this.getContext("2d");
//         ctx.fillStyle = "rgba(255,0,0,0.01)";
//         ctx.fillRect(0, 0, 1, 1);
//         return toDataURL.apply(this, arguments);
//       };

//       const getParameter = WebGLRenderingContext.prototype.getParameter;
//       WebGLRenderingContext.prototype.getParameter = function (param) {
//         if (param === 37445) return "Intel Inc.";
//         if (param === 37446) return "Intel Iris OpenGL Engine";
//         return getParameter.apply(this, arguments);
//       };

//       const oldGetChannelData = AudioBuffer.prototype.getChannelData;
//       AudioBuffer.prototype.getChannelData = function () {
//         const data = oldGetChannelData.apply(this, arguments);
//         const rnd = Math.random() * 0.0000001;
//         return data.map((v) => v + rnd);
//       };
//     } catch (e) {}
//   });
// }

// /* ---------------------------
//    Helper function to close message boxes
// --------------------------- */
// async function closeAllMessageBoxes(page) {
//   console.log("🗑️ Closing all open message boxes...");
//   const closeButtons = page
//     .locator(".msg-overlay-bubble-header__controls.display-flex.align-items-center button")
//     .last();
//   const altCloseButtons = page.locator("button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text('Close your conversation with')");

//   const allButtons = closeButtons.or(altCloseButtons);
//   const buttons = await allButtons.all();
//   for (const button of buttons) {
//     try {
//       await button.scrollIntoViewIfNeeded();
//       await humanMouse(page, 1);
//       await button.click({ delay: 100 });
//       console.log("✅ Closed a message box");
//       await randomDelay(500, 1000);
//     } catch (err) {
//       console.log("⚠️ Failed to close a message box:", err.message);
//     }
//   }
// }

// /* ---------------------------
//    Main test - Send Connection Request
// --------------------------- */
// test.describe("LinkedIn Send Connection Request", () => {
//   let browser, context, page;

//   test.beforeAll(async () => {
//     // Validate environment variables
//     const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;
//     if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
//       throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
//     if (!PROFILE_URLS) {
//       console.log("⚠️ PROFILE_URLS not set in .env, no actions will be performed.");
//       PROFILE_URLS = ""; // Default to empty to avoid errors
//     }

//     // Launch browser
//     browser = await chromium.launch({
//       headless: false,
//       args: ["--start-maximized"],
//     });

//     // Check existing session
//     const storageState = fs.existsSync(STORAGE_FILE) && fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
//       ? STORAGE_FILE
//       : undefined;

//     context = await browser.newContext({
//       viewport: null,
//       locale: "en-US",
//       timezoneId: "Asia/Kolkata",
//       userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
//       storageState,
//     });

//     page = await context.newPage();
//     await addStealth(page);

//     // Navigate to login page
//     try {
//       await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });
//       await humanMouse(page, 3);
//       await humanIdle(800, 1800);

//       // Perform login if needed
//       if (await page.locator("#username").isVisible().catch(() => false)) {
//         console.log("🔐 Logging in to LinkedIn...");
//         await humanType(page, "#username", LINKEDIN_EMAIL);
//         await humanIdle(600, 1600);
//         await humanType(page, "#password", LINKEDIN_PASSWORD);
//         await humanIdle(600, 1600);
//         await page.locator(`label[for='rememberMeOptIn-checkbox']`).click().catch(() => console.log("Remember Me checkbox not found, skipping."));
//         await humanIdle(600, 1600);
//         await page.locator('button[type="submit"]').click().catch(() => {});
//         await randomDelay(1000, 2000);

//         // Handle MFA
//         const authLink = page.locator('a:has-text("Verify using authenticator app")');
//         if (await authLink.isVisible().catch(() => false)) {
//           await authLink.click().catch(() => {});
//           await randomDelay(800, 1500);
//         }

//         const totpSel = 'input[name="pin"][maxlength="6"]';
//         if (await page.locator(totpSel).isVisible().catch(() => false)) {
//           console.log("🔑 Using TOTP MFA...");
//           const token = speakeasy.totp({
//             secret: process.env.LINKEDIN_TOTP_SECRET,
//             encoding: "base32",
//           });
//           await humanType(page, totpSel, token);
//           await randomDelay(700, 1400);
//           await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
//         }

//         await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => {
//           console.log("⚠️ Failed to reach feed after login, continuing...");
//         });
//         await context.storageState({ path: STORAGE_FILE });
//       }
//     } catch (err) {
//       console.error("❌ Login failed:", err.message);
//       throw err;
//     }
//   });

//   test.afterAll(async () => {
//     if (browser) await browser.close();
//   });

//   test("Send Connection Request to 2nd/3rd Degree Connections", async () => {
//     // Set test timeout explicitly
//     test.setTimeout(15 * 60 * 1000); // 15 minutes

//     console.log("📤 Starting to process connection requests...");

//     // Parse PROFILE_URLS into an array
//     const urls = PROFILE_URLS.split(",")
//       .map((url) => url.replace(/"/g, "").trim())
//       .filter((url) => url);
//     if (urls.length === 0) {
//       console.log("⚠️ No valid PROFILE_URLS provided, skipping actions.");
//       return;
//     }
//     console.log(`🔍 Found ${urls.length} profile URLs to process: ${urls.join(", ")}`);

//     // Scroll on home page before starting
//     await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
//     await humanScroll(page, 5);
//     await humanIdle(2000, 4000);

//     for (const url of urls) {
//       console.log(`🌐 Processing profile: ${url}`);

//       // Navigate to profile
//       try {
//         await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
//         console.log("✅ Navigated to profile");
//         await humanIdle(2000, 4000); // Pause after navigation
//       } catch (err) {
//         console.error(`❌ Failed to navigate to ${url}:`, err.message);
//         continue;
//       }

//       // Close any existing message boxes before starting
//       await closeAllMessageBoxes(page);

//       // Check for Accept button and click if present
//       try {
//         const acceptButton = page.locator(".ph5 [aria-label*='Accept']");
//         await acceptButton.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
//         if (await acceptButton.isVisible()) {
//           await humanMouse(page, 2);
//           await acceptButton.click({ delay: 100 });
//           console.log("✅ Accepted connection request");
//           await randomDelay(2000, 4000);
//           continue; // Skip further actions after accepting
//         }
//       } catch (err) {
//         console.log(`⚠️ No Accept button found or failed: ${err.message}`);
//       }

//       // Check connection degree
//       let degree = "unknown";
//       const degreeLocators = [
//         { selector: ".distance-badge .visually-hidden", description: "degree badge hidden text" },
//         { selector: ".distance-badge .dist-value", description: "degree badge visible value" },
//       ];

//       for (const { selector, description } of degreeLocators) {
//         try {
//           await page.locator(selector).waitFor({ state: "visible", timeout: 5000 });
//           const connectionInfo = await page.locator(selector).textContent({ timeout: 5000 });
//           if (connectionInfo.toLowerCase().includes("2nd") || connectionInfo.toLowerCase().includes("3rd")) {
//             degree = connectionInfo.toLowerCase().includes("2nd") ? "2nd" : "3rd";
//             console.log(`🔍 Connection degree check (using ${description}): ${degree} degree`);
//             break;
//           } else if (connectionInfo.toLowerCase().includes("1st")) {
//             degree = "1st";
//             console.log(`🔍 Connection degree check (using ${description}): ${degree} degree`);
//             break;
//           }
//         } catch (err) {
//           console.log(`⚠️ Skipping ${description} - ${err.message}`);
//           continue;
//         }
//       }

//       if (degree === "unknown") {
//         console.log(`⛔ Skipping message to ${url} - Degree not detected or not 2nd/3rd`);
//         continue;
//       }
//       if (degree === "1st") {
//         console.log(`⛔ Already connected for ${url}, skipping to next profile`);
//         continue;
//       }

//       // Handle connection request
//       try {
//         // Check for Pending/Withdraw button
//         const pendingWithdrawButton = page.locator(".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')");
//         if (await pendingWithdrawButton.isVisible({ timeout: 5000 })) {
//           await humanMouse(page, 2);
          
//           console.log("⚠️ Found Pending/Withdraw button, No Action needed");
//           await randomDelay(1000, 2000);

//           // Check for Withdraw in dropdown
//           const withdrawDropdown = page.locator(".artdeco-dropdown__content span:has-text('Withdraw')");
//           if (await withdrawDropdown.isVisible({ timeout: 5000 })) {
//             await humanMouse(page, 1);
//             await randomDelay(2000, 4000);
//           }
//           continue; // Skip further actions after withdraw
//         }

//         // Check for Connect button
//         const connectButton = page.locator(".ph5 [aria-label*='to connect'] , .ph5 button:has-text('Connect') ");
//         if (await connectButton.isVisible({ timeout: 5000 })) {
//           await humanMouse(page, 2);
//           await connectButton.click({ delay: 100 });
//           console.log("💡 Connect button clicked");
//           await randomDelay(1000, 2000);
//           await page.pause();

//           // Check for Send button in dialog
//           const sendButton = page.locator("button:has-text('Send')");
//           if (await sendButton.isVisible({ timeout: 5000 })) {
//             await humanMouse(page, 1);
//             await sendButton.click({ delay: 100 });
//             console.log("✅ Connection request sent");
//             await randomDelay(2000, 4000);
//           }
//           continue;
//         }

//         // Check for More button
//         const moreButton = page.locator(".ph5 [aria-label='More actions']");
//         if (await moreButton.isVisible({ timeout: 5000 })) {
//           await humanMouse(page, 2);
//           await moreButton.click({ delay: 100 });
//           console.log("💡 More button clicked");
//           await randomDelay(1000, 2000);

//           // Check for Connect in dropdown
//           const connectDropdown = page.locator(".ph5 .artdeco-dropdown__content-inner span:has-text('Connect')");
//           if (await connectDropdown.isVisible({ timeout: 5000 })) {
//             await humanMouse(page, 1);
//             await connectDropdown.click({ delay: 100 });
//             console.log("💡 Connect from dropdown clicked");
//             await randomDelay(1000, 2000);

//             // Check for Send button in dialog
//             const sendButton = page.locator("button:has-text('Send')");
//             if (await sendButton.isVisible({ timeout: 5000 })) {
//               await humanMouse(page, 1);
//               await sendButton.click({ delay: 100 });
//               console.log("✅ Connection request sent");
//               await randomDelay(2000, 4000);
//             }
//           }
//         }

//         // Check for Remove Connection in dropdown (if 1st degree and needs removal)
//         const removeConnectionDropdown = page.locator(".artdeco-dropdown__content span:has-text('Remove Connection')");
//         if (await removeConnectionDropdown.isVisible({ timeout: 5000 })) {
//           await humanMouse(page, 1);
//           await removeConnectionDropdown.click({ delay: 100 });
//           console.log("✅ Removed existing connection");
//           await randomDelay(2000, 4000);
//         }
//       } catch (err) {
//         console.error(`❌ Failed to send connection request to ${url}:`, err.message);
//       }

//       console.log(`✅ Finished processing ${url}`);
//       await humanIdle(3000, 6000); // Longer pause between profiles
//     }

//     // Verify still on LinkedIn
//     await expect(page).toHaveURL(/linkedin\.com/);
//   });
// });





require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Local storage file to save LinkedIn session state
const STORAGE_FILE = "linkedinStealth-state-Lokesh.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
const PROFILE_URLS = process.env.PROFILE_URLS || ""; // Comma-separated list, e.g., "url1","url2"

/* ---------------------------
   Human-like helpers
--------------------------- */
async function randomDelay(min = 1000, max = 3000) {
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, t));
}

async function humanType(page, locator, text) {
  const el = page.locator(locator);
  await el.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  try {
    await el.click({ delay: 100 });
  } catch {}
  for (const ch of text) {
    await el.type(ch, { delay: Math.floor(Math.random() * 150) + 50 });
    if (Math.random() < 0.12) await randomDelay(300, 800);
  }
}

async function humanMouse(page, moves = 5) {
  const size = page.viewportSize() || { width: 1280, height: 720 };
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * size.width);
    const y = Math.floor(Math.random() * size.height);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 12) + 3 });
    await randomDelay(200, 600);
  }
}

async function humanScroll(page, steps = 5) {
  for (let i = 0; i < steps; i++) {
    const dir = Math.random() > 0.2 ? 1 : -1;
    await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
    await randomDelay(800, 1600);
  }
}

async function humanIdle(min = 3000, max = 6000) {
  const wait = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, wait));
}

/* ---------------------------
   Stealth patches
--------------------------- */
async function addStealth(page) {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function () {
        const ctx = this.getContext("2d");
        ctx.fillStyle = "rgba(255,0,0,0.01)";
        ctx.fillRect(0, 0, 1, 1);
        return toDataURL.apply(this, arguments);
      };

      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (param) {
        if (param === 37445) return "Intel Inc.";
        if (param === 37446) return "Intel Iris OpenGL Engine";
        return getParameter.apply(this, arguments);
      };

      const oldGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function () {
        const data = oldGetChannelData.apply(this, arguments);
        const rnd = Math.random() * 0.0000001;
        return data.map((v) => v + rnd);
      };
    } catch (e) {}
  });
}

/* ---------------------------
   Helper function to close message boxes
--------------------------- */
async function closeAllMessageBoxes(page) {
  console.log("🗑️ Closing all open message boxes...");
  const closeButtons = page
    .locator(".msg-overlay-bubble-header__controls.display-flex.align-items-center button")
    .last();
  const altCloseButtons = page.locator("button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text('Close your conversation with')");

  const allButtons = closeButtons.or(altCloseButtons);
  const buttons = await allButtons.all();
  for (const button of buttons) {
    try {
      await button.scrollIntoViewIfNeeded();
      await humanMouse(page, 1);
      await button.click({ delay: 100 });
      console.log("✅ Closed a message box");
      await randomDelay(500, 1000);
    } catch (err) {
      console.log("⚠️ Failed to close a message box:", err.message);
    }
  }
}

/* ---------------------------
   Main test - Send Connection Request
--------------------------- */
test.describe("LinkedIn Send Connection Request", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    // Validate environment variables
    const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;
    if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
    if (!PROFILE_URLS) {
      console.log("⚠️ PROFILE_URLS not set in .env, no actions will be performed.");
      PROFILE_URLS = ""; // Default to empty to avoid errors
    }

    // Launch browser
    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });

    // Check existing session
    const storageState = fs.existsSync(STORAGE_FILE) && fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
      ? STORAGE_FILE
      : undefined;

    context = await browser.newContext({
      viewport: null,
      locale: "en-US",
      timezoneId: "Asia/Kolkata",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      storageState,
    });

    page = await context.newPage();
    await addStealth(page);

    // Navigate to login page
    try {
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });
      await humanMouse(page, 3);
      await humanIdle(800, 1800);

      // Perform login if needed
      if (await page.locator("#username").isVisible().catch(() => false)) {
        console.log("🔐 Logging in to LinkedIn...");
        await humanType(page, "#username", LINKEDIN_EMAIL);
        await humanIdle(600, 1600);
        await humanType(page, "#password", LINKEDIN_PASSWORD);
        await humanIdle(600, 1600);
        await page.locator(`label[for='rememberMeOptIn-checkbox']`).click().catch(() => console.log("Remember Me checkbox not found, skipping."));
        await humanIdle(600, 1600);
        await page.locator('button[type="submit"]').click().catch(() => {});
        await randomDelay(1000, 2000);

        // Handle MFA
        const authLink = page.locator('a:has-text("Verify using authenticator app")');
        if (await authLink.isVisible().catch(() => false)) {
          await authLink.click().catch(() => {});
          await randomDelay(800, 1500);
        }

        const totpSel = 'input[name="pin"][maxlength="6"]';
        if (await page.locator(totpSel).isVisible().catch(() => false)) {
          console.log("🔑 Using TOTP MFA...");
          const token = speakeasy.totp({
            secret: process.env.LINKEDIN_TOTP_SECRET,
            encoding: "base32",
          });
          await humanType(page, totpSel, token);
          await randomDelay(700, 1400);
          await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
        }

        await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => {
          console.log("⚠️ Failed to reach feed after login, continuing...");
        });
        await context.storageState({ path: STORAGE_FILE });
      }
    } catch (err) {
      console.error("❌ Login failed:", err.message);
      throw err;
    }
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test("Send Connection Request to 2nd/3rd Degree Connections", async () => {
    // Set test timeout explicitly
    test.setTimeout(15 * 60 * 1000); // 15 minutes

    console.log("📤 Starting to process connection requests...");

    // Parse PROFILE_URLS into an array
    const urls = PROFILE_URLS.split(",")
      .map((url) => url.replace(/"/g, "").trim())
      .filter((url) => url);
    if (urls.length === 0) {
      console.log("⚠️ No valid PROFILE_URLS provided, skipping actions.");
      return;
    }
    console.log(`🔍 Found ${urls.length} profile URLs to process: ${urls.join(", ")}`);

    // Scroll on home page before starting
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanScroll(page, 5);
    await humanIdle(2000, 4000);

    for (const url of urls) {
      console.log(`🌐 Processing profile: ${url}`);

      // Navigate to profile
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        console.log("✅ Navigated to profile");
        await humanIdle(2000, 4000); // Pause after navigation
      } catch (err) {
        console.error(`❌ Failed to navigate to ${url}:`, err.message);
        continue;
      }

      // Close any existing message boxes before starting
      await closeAllMessageBoxes(page);

      // Check for Accept button and click if present
      try {
        const acceptButton = page.locator(".ph5 [aria-label*='Accept']");
        await acceptButton.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
        if (await acceptButton.isVisible()) {
          await humanMouse(page, 2);
          await acceptButton.click({ delay: 100 });
          console.log("✅ Accepted connection request");
          await randomDelay(2000, 4000);
          continue; // Skip further actions after accepting
        }
      } catch (err) {
        console.log(`⚠️ No Accept button found or failed: ${err.message}`);
      }

      // Check connection degree
      let degree = "unknown";
      const degreeLocators = [
        { selector: ".distance-badge .visually-hidden", description: "degree badge hidden text" },
        { selector: ".distance-badge .dist-value", description: "degree badge visible value" },
      ];

      for (const { selector, description } of degreeLocators) {
        try {
          await page.locator(selector).waitFor({ state: "visible", timeout: 5000 });
          const connectionInfo = await page.locator(selector).textContent({ timeout: 5000 });
          if (connectionInfo.toLowerCase().includes("1st")) {
            degree = "1st";
            console.log(`🔍 Connection degree check (using ${description}): ${degree} degree`);
            break;
          } else if (connectionInfo.toLowerCase().includes("2nd") || connectionInfo.toLowerCase().includes("3rd")) {
            degree = connectionInfo.toLowerCase().includes("2nd") ? "2nd" : "3rd";
            console.log(`🔍 Connection degree check (using ${description}): ${degree} degree`);
            break;
          }
        } catch (err) {
          console.log(`⚠️ Skipping ${description} - ${err.message}`);
          continue;
        }
      }

      if (degree === "1st") {
        console.log(`⛔ Already connected for ${url}, skipping to next profile`);
        continue;
      }

      // Handle connection request
      try {
        // Check for Pending/Withdraw button
        const pendingWithdrawButton = page.locator(".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')");
        if (await pendingWithdrawButton.isVisible({ timeout: 5000 })) {
          console.log("⚠️ Found Pending/Withdraw button, no action needed");
          await randomDelay(1000, 2000);
          continue; // Skip further actions if pending
        }

        // Check for Connect button in header
        const connectButton = page.locator(".ph5 [aria-label*='to connect'], .ph5 button:has-text('Connect')");
        if (await connectButton.isVisible({ timeout: 5000 })) {
          await humanMouse(page, 2);
          await connectButton.click({ delay: 100 });
          console.log("💡 Connect button clicked");
          await randomDelay(1000, 2000);

          // Check for Send button in dialog
          const sendButton = page.locator("button:has-text('Send')");
          if (await sendButton.isVisible({ timeout: 5000 })) {
            await humanMouse(page, 1);
            await sendButton.click({ delay: 100 });
            console.log("✅ Connection request sent");
            await randomDelay(2000, 4000);
            console.log(`✅ Finished processing ${url}`);
            continue;
          }
        }

        // If Connect button not found, try More button
        const moreButton = page.locator(".ph5 [aria-label='More actions']");
        if (await moreButton.isVisible({ timeout: 5000 })) {
          await humanMouse(page, 2);
          await moreButton.click({ delay: 100 });
          console.log("💡 More button clicked");
          await randomDelay(1000, 2000);

          // Check for Connect in dropdown
          const connectDropdown = page.locator(".ph5 .artdeco-dropdown__content-inner span:has-text('Connect')");
          if (await connectDropdown.isVisible({ timeout: 5000 })) {
            await humanMouse(page, 1);
            await connectDropdown.click({ delay: 100 });
            console.log("💡 Connect from dropdown clicked");
            await randomDelay(1000, 2000);

            // Check for Send button in dialog
            const sendButton = page.locator("button:has-text('Send')");
            if (await sendButton.isVisible({ timeout: 5000 })) {
              await humanMouse(page, 1);
              await sendButton.click({ delay: 100 });
              console.log("✅ Connection request sent");
              await randomDelay(2000, 4000);
            } else {
              console.log("⚠️ Send button not found in dialog");
            }
          } else {
            console.log("⚠️ Connect option not found in More dropdown");
          }
        } else {
          console.log("⚠️ More button not found");
        }

      } catch (err) {
        console.error(`❌ Failed to send connection request to ${url}:`, err.message);
      }

      console.log(`✅ Finished processing ${url}`);
      await humanIdle(3000, 6000); // Longer pause between profiles
    }

    // Verify still on LinkedIn
    await expect(page).toHaveURL(/linkedin\.com/);
  });
});