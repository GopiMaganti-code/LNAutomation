// require("dotenv").config();
// const { test, expect, chromium } = require("@playwright/test");
// const speakeasy = require("speakeasy");
// const fs = require("fs");

// // Local storage file to save LinkedIn session state
// // const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Lokesh.json";
// const STORAGE_FILE =
//   process.env.STORAGE_FILE || "linkedinStealth-state-Thanuja.json";

// /* ---------------------------
//    Human-like helpers
// --------------------------- */
// async function randomDelay(min = 200, max = 1200) {
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
//     (await el.type)
//       ? await el.type(ch, { delay: Math.floor(Math.random() * 150) + 50 })
//       : await page.keyboard.type(ch, { delay: 80 });
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

// async function humanScroll(page, steps = 3) {
//   for (let i = 0; i < steps; i++) {
//     const dir = Math.random() > 0.2 ? 1 : -1;
//     await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
//     await randomDelay(800, 1600);
//   }
// }

// async function humanIdle(min = 2000, max = 6000) {
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
//     } catch (e) {
//       // swallow
//     }
//   });
// }

// /* ---------------------------
//    Main test
// --------------------------- */
// test("LinkedIn stealth login -> check degree of connection", async () => {
//   test.setTimeout(8 * 60 * 1000); // 8 minutes to allow human delays

//   const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } =
//     process.env;
//   if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
//     throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");

//   const browser = await chromium.launch({
//     headless: false,
//     args: ["--start-maximized"],
//   });
//   const context = await browser.newContext({
//     viewport: null,
//     locale: "en-US",
//     timezoneId: "Asia/Kolkata",
//     userAgent:
//       process.env.USER_AGENT ||
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
//     storageState: fs.existsSync(STORAGE_FILE) ? STORAGE_FILE : undefined,
//   });

//   const page = await context.newPage();
//   await addStealth(page);

//   // Go to login page (if cookie state valid you will be redirected to feed)
//   await page.goto("https://www.linkedin.com/login", {
//     waitUntil: "domcontentloaded",
//   });
//   await humanMouse(page, 3);
//   await humanIdle(800, 1800);

//   // If we see username field, perform login flow
//   if (
//     await page
//       .locator("#username")
//       .isVisible()
//       .catch(() => false)
//   ) {
//     await humanType(page, "#username", LINKEDIN_EMAIL);
//     await humanIdle(600, 1600);
//     await humanType(page, "#password", LINKEDIN_PASSWORD);
//     await humanIdle(600, 1600);
//     await page.locator(`label[for='rememberMeOptIn-checkbox']`).click();
//     await humanIdle(600, 1600);
//     await page
//       .locator('button[type="submit"]')
//       .click()
//       .catch(() => {});
//     await randomDelay(1000, 2000);

//     // Try to use authenticator app link if present
//     const authLink = page.locator(
//       'a:has-text("Verify using authenticator app")'
//     );
//     if (await authLink.isVisible().catch(() => false)) {
//       await authLink.click().catch(() => {});
//       await randomDelay(800, 1500);
//     }

//     // TOTP input (6 digits)
//     const totpSel = 'input[name="pin"][maxlength="6"]';

//     // Recovery input (8 digits)
//     const recoverySel = 'input[name="pin"][maxlength="8"]';

//     if (
//       await page
//         .locator(totpSel)
//         .isVisible()
//         .catch(() => false)
//     ) {
//       console.log("🔑 Using TOTP MFA...");
//       const token = speakeasy.totp({
//         secret: process.env.LINKEDIN_TOTP_SECRET,
//         encoding: "base32",
//       });
//       await humanType(page, totpSel, token);
//       await randomDelay(700, 1400);
//       await page
//         .locator('#two-step-submit-button, button[type="submit"]')
//         .first()
//         .click();
//     } else if (
//       await page
//         .locator(recoverySel)
//         .isVisible()
//         .catch(() => false)
//     ) {
//       console.log("🆘 Using Recovery Code MFA...");
//       await humanType(page, recoverySel, process.env.LINKEDIN_RECOVERY_CODE);
//       await randomDelay(700, 1400);
//       await page
//         .locator('#two-step-submit-button, button[type="submit"]')
//         .first()
//         .click();
//     }

//     // Wait for feed or final redirect
//     await page
//       .waitForURL("https://www.linkedin.com/feed/", { timeout: 30000 })
//       .catch(() => {});
//     // Save new storage state
//     await context.storageState({ path: STORAGE_FILE });
//   } else {
//     // If not on login page, ensure we are on feed
//     await page
//       .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" })
//       .catch(() => {});
//   }

//   // Warm up: small human actions on feed
//   await humanIdle(1000, 2500);
//   await humanScroll(page, 3);
//   await humanMouse(page, 4);

//   const profileUrls = [
//     "https://www.linkedin.com/in/saran-jasty-189b429a/",
//     "https://www.linkedin.com/in/k-ratna-kumar/",
//     "https://www.linkedin.com/in/konda-hemanth-719584259/",
//     "https://www.linkedin.com/in/snigdha-chitransh-b273b0a8/",
//     "https://www.linkedin.com/in/bhuvana-ponnam-13476b272/",
//     "https://www.linkedin.com/in/pooja-vibhute-5b089b199/",
//     "https://www.linkedin.com/in/neeshutechautomation/",
//   ];

//   async function checkProfileConnection(page) {
//     // Get profile name from h1
//     const name = await page
//       .locator(".ph5.pb5 h1")
//       .innerText()
//       .catch(() => "Unknown User");

//     // Read degree using provided selector
//     const degreeElem = page.locator(".distance-badge .dist-value");
//     const degreeElem2 = page.locator(".distance-badge .visually-hidden");
//     const degreeText = await degreeElem.innerText().catch(() => null);

//     let degree = "Unknown";
//     if (degreeText) {
//       const cleaned = degreeText.trim().replace("°", "");
//       if (cleaned.includes("1")) degree = "1st";
//       else if (cleaned.includes("2")) degree = "2nd";
//       else if (cleaned.includes("3")) degree = "3rd+";
//     }

//     console.log(`${name} : ${degree} degree connection`);
//   }

//   // Loop through profiles
//   for (const url of profileUrls) {
//     await page.goto(url, { waitUntil: "domcontentloaded" });
//     await humanIdle(2000, 4000);

//     await checkProfileConnection(page);

//     await humanIdle(2000, 4000);
//     await humanScroll(page, 4);
//     await humanIdle(2000, 4000);
//   }

//   // Assert we are on LinkedIn domain
//   await expect(page).toHaveURL(/linkedin\.com/);

//   // Close browser and finish test
//   await randomDelay(4000, 6000);
//   await browser.close();
// });



// require("dotenv").config();
// const { test, expect, chromium } = require("@playwright/test");
// const speakeasy = require("speakeasy");
// const fs = require("fs");

// // Local storage file to save LinkedIn session state
// const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Thanuja.json";

// /* ---------------------------
//    Human-like helpers
// --------------------------- */
// async function randomDelay(min = 200, max = 1200) {
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

// async function humanScroll(page, steps = 3) {
//   for (let i = 0; i < steps; i++) {
//     const dir = Math.random() > 0.2 ? 1 : -1;
//     await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
//     await randomDelay(800, 1600);
//   }
// }

// async function humanIdle(min = 2000, max = 6000) {
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
//     } catch (e) {
//       // swallow
//     }
//   });
// }

// /* ---------------------------
//    Main test suite
// --------------------------- */
// test.describe("LinkedIn Stealth Degree Check", () => {
//   let browser, context, page;

//   test.beforeAll(async () => {
//     const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;
//     if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
//       throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");

//     browser = await chromium.launch({
//       headless: false,
//       args: ["--start-maximized"],
//     });
//     context = await browser.newContext({
//       viewport: null,
//       locale: "en-US",
//       timezoneId: "Asia/Kolkata",
//       userAgent:
//         process.env.USER_AGENT ||
//         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
//       storageState: fs.existsSync(STORAGE_FILE) ? STORAGE_FILE : undefined,
//     });

//     page = await context.newPage();
//     await addStealth(page);

//     // Go to login page
//     await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
//     await humanMouse(page, 3);
//     await humanIdle(800, 1800);

//     // Perform login if needed
//     if (await page.locator("#username").isVisible().catch(() => false)) {
//       await humanType(page, "#username", LINKEDIN_EMAIL);
//       await humanIdle(600, 1600);
//       await humanType(page, "#password", LINKEDIN_PASSWORD);
//       await humanIdle(600, 1600);
      
//       // Click remember me if visible
//       const rememberCheckbox = page.locator('label[for="rememberMeOptIn-checkbox"]');
//       if (await rememberCheckbox.isVisible().catch(() => false)) {
//         await rememberCheckbox.click();
//         await humanIdle(600, 1600);
//       }
      
//       await page.locator('button[type="submit"]').click().catch(() => {});
//       await randomDelay(1000, 2000);

//       // Handle MFA
//       const authLink = page.locator('a:has-text("Verify using authenticator app")');
//       if (await authLink.isVisible().catch(() => false)) {
//         await authLink.click().catch(() => {});
//         await randomDelay(800, 1500);
//       }

//       const totpSel = 'input[name="pin"][maxlength="6"]';
//       const recoverySel = 'input[name="pin"][maxlength="8"]';

//       if (await page.locator(totpSel).isVisible().catch(() => false)) {
//         console.log("🔑 Using TOTP MFA...");
//         const token = speakeasy.totp({
//           secret: process.env.LINKEDIN_TOTP_SECRET,
//           encoding: "base32",
//         });
//         await humanType(page, totpSel, token);
//         await randomDelay(700, 1400);
//         await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
//       } else if (await page.locator(recoverySel).isVisible().catch(() => false)) {
//         console.log("🆘 Using Recovery Code MFA...");
//         await humanType(page, recoverySel, process.env.LINKEDIN_RECOVERY_CODE);
//         await randomDelay(700, 1400);
//         await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
//       }

//       await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 30000 }).catch(() => {});
//       await context.storageState({ path: STORAGE_FILE });
//     } else {
//       await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" }).catch(() => {});
//     }

//     // Warm up on feed
//     await humanIdle(1000, 2500);
//     await humanScroll(page, 3);
//     await humanMouse(page, 4);
//   });

//   test.afterAll(async () => {
//     if (browser) await browser.close();
//   });

//   test("Check Degree of Connection for Profiles", async () => {
//     test.setTimeout(10 * 60 * 1000); // Increased to 10 minutes

//     const profileUrls = [
//       "https://www.linkedin.com/in/saran-jasty-189b429a/",
//       "https://www.linkedin.com/in/k-ratna-kumar/",
//       "https://www.linkedin.com/in/konda-hemanth-719584259/",
//       "https://www.linkedin.com/in/snigdha-chitransh-b273b0a8/",
//       "https://www.linkedin.com/in/bhuvana-ponnam-13476b272/",
//       "https://www.linkedin.com/in/pooja-vibhute-5b089b199/",
//       "https://www.linkedin.com/in/neeshutechautomation/",
//     ];

//     async function checkProfileConnection(page, url) {
//       try {
//         console.log(`Visiting: ${url}`);
//         await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
//         await humanIdle(1000, 2000); // Reduced idle time
//         await humanScroll(page, 2); // Scroll to load dynamic content

//         // Wait for profile elements
//         await page.waitForSelector("h1", { timeout: 10000 }).catch(() => {});
//         await page.waitForSelector(".distance-badge", { timeout: 10000 }).catch(() => {});

//         // Get profile name with fallback
//         let name = "Unknown User";
//         try {
//           name = await page.locator(".ph5.pb5 h1, h1").first().innerText();
//           name = name.trim();
//         } catch {}

//         // Read degree using updated selector
//         let degreeText = null;
//         try {
//           const degreeElem = page.locator(".ph5.pb5 div .dist-value");
//           degreeText = await degreeElem.innerText();
//         } catch {
//           // Fallback selectors
//           try {
//             const fallback1 = page.locator(".distance-badge .dist-value");
//             degreeText = await fallback1.innerText();
//           } catch {
//             try {
//               const fallback2 = page.locator(".distance-badge .visually-hidden");
//               const hiddenText = await fallback2.innerText();
//               degreeText = hiddenText ? hiddenText.split(" ")[0] : null;
//             } catch {}
//           }
//         }

//         let degree = "Unknown";
//         if (degreeText) {
//           const cleaned = degreeText.trim().replace("°", "").toLowerCase();
//           if (cleaned.includes("1st") || cleaned.includes("1")) degree = "1st";
//           else if (cleaned.includes("2nd") || cleaned.includes("2")) degree = "2nd";
//           else if (cleaned.includes("3rd") || cleaned.includes("3")) degree = "3rd+";
//         }

//         console.log(`${name} : ${degree} degree connection`);
//       } catch (err) {
//         console.error(`Error processing ${url}: ${err.message}`);
//         console.log(`Skipping ${url}`);
//       }
//     }

//     // Loop through profiles with individual timeouts
//     for (const url of profileUrls) {
//       await checkProfileConnection(page, url);
//       await humanIdle(1000, 3000); // Reduced between profiles
//     }

//     await expect(page).toHaveURL(/linkedin\.com/);
//   });
// });



require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Local storage file to save LinkedIn session state
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Thanuja.json";

/* ---------------------------
   Human-like helpers
--------------------------- */
async function randomDelay(min = 200, max = 1200) {
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

async function humanScroll(page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    const dir = Math.random() > 0.2 ? 1 : -1;
    await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
    await randomDelay(800, 1600);
  }
}

async function humanIdle(min = 2000, max = 6000) {
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
    } catch (e) {
      // swallow
    }
  });
}

/* ---------------------------
   Main test
--------------------------- */
test("LinkedIn stealth login -> check degree of connection", async () => {
  test.setTimeout(10 * 60 * 1000); // Increased to 10 minutes for safety

  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } =
    process.env;
  if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
    throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");

  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });
  const context = await browser.newContext({
    viewport: null,
    locale: "en-US",
    timezoneId: "Asia/Kolkata",
    userAgent:
      process.env.USER_AGENT ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    storageState: fs.existsSync(STORAGE_FILE) ? STORAGE_FILE : undefined,
  });

  const page = await context.newPage();
  await addStealth(page);

  // Go to login page (if cookie state valid you will be redirected to feed)
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 60000, // Increased goto timeout
  });
  await humanMouse(page, 3);
  await humanIdle(800, 1800);

  // If we see username field, perform login flow
  if (
    await page
      .locator("#username")
      .isVisible()
      .catch(() => false)
  ) {
    await humanType(page, "#username", LINKEDIN_EMAIL);
    await humanIdle(600, 1600);
    await humanType(page, "#password", LINKEDIN_PASSWORD);
    await humanIdle(600, 1600);
    // Optional: Remember Me checkbox
    await page.locator(`label[for='rememberMeOptIn-checkbox']`).click().catch(() => console.log("Remember Me checkbox not found, skipping."));
    await humanIdle(600, 1600);
    await page
      .locator('button[type="submit"]')
      .click()
      .catch(() => {});
    await randomDelay(1000, 2000);

    // Try to use authenticator app link if present
    const authLink = page.locator(
      'a:has-text("Verify using authenticator app")'
    );
    if (await authLink.isVisible().catch(() => false)) {
      await authLink.click().catch(() => {});
      await randomDelay(800, 1500);
    }

    // TOTP input (6 digits)
    const totpSel = 'input[name="pin"][maxlength="6"]';

    // Recovery input (8 digits)
    const recoverySel = 'input[name="pin"][maxlength="8"]';

    if (
      await page
        .locator(totpSel)
        .isVisible()
        .catch(() => false)
    ) {
      console.log("🔑 Using TOTP MFA...");
      const token = speakeasy.totp({
        secret: process.env.LINKEDIN_TOTP_SECRET,
        encoding: "base32",
      });
      await humanType(page, totpSel, token);
      await randomDelay(700, 1400);
      await page
        .locator('#two-step-submit-button, button[type="submit"]')
        .first()
        .click();
    } else if (
      await page
        .locator(recoverySel)
        .isVisible()
        .catch(() => false)
    ) {
      console.log("🆘 Using Recovery Code MFA...");
      await humanType(page, recoverySel, process.env.LINKEDIN_RECOVERY_CODE);
      await randomDelay(700, 1400);
      await page
        .locator('#two-step-submit-button, button[type="submit"]')
        .first()
        .click();
    }

    // Wait for feed or final redirect
    await page
      .waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 })
      .catch(() => {});
    // Save new storage state
    await context.storageState({ path: STORAGE_FILE });
  } else {
    // If not on login page, ensure we are on feed
    await page
      .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" })
      .catch(() => {});
  }

  // Warm up: small human actions on feed
  await humanIdle(1000, 2500);
  await humanScroll(page, 3);
  await humanMouse(page, 4);

  const profileUrls = [
    "https://www.linkedin.com/in/saran-jasty-189b429a/",
    "https://www.linkedin.com/in/k-ratna-kumar/",
    "https://www.linkedin.com/in/konda-hemanth-719584259/",
    "https://www.linkedin.com/in/snigdha-chitransh-b273b0a8/",
    "https://www.linkedin.com/in/bhuvana-ponnam-13476b272/",
    "https://www.linkedin.com/in/pooja-vibhute-5b089b199/",
    "https://www.linkedin.com/in/neeshutechautomation/",
  ];

  async function checkProfileConnection(page, url) {
    // Get profile name from h1 (simpler selector)
    let name = await page
      .locator(".ph5.pb5 h1")
      .innerText()
      .catch(() => "Unknown User");
    name = name.trim();

    // Read degree using primary selector
    const degreeElem = page.locator(".distance-badge .dist-value");
    let degreeText = await degreeElem.innerText().catch(() => null);

    

    // Fallback to visually-hidden if primary fails
    if (!degreeText) {
      const degreeElem2 = page.locator(".distance-badge .visually-hidden");
      degreeText = await degreeElem2.innerText().catch(() => null);
    }

    let degree = "Unknown";
    if (degreeText) {
      const cleaned = degreeText.trim().replace("°", "").toLowerCase();
      if (cleaned.includes("1")) degree = "1st";
      else if (cleaned.includes("2")) degree = "2nd";
      else if (cleaned.includes("3")) degree = "3rd+";
      else if (cleaned.includes("out of network")) degree = "Out of Network";
    }

    console.log(`${name} : ${degree}`);
    // console.log(`${name} : ${degree} degree connection (from ${url})`);
  }

  // Loop through profiles with try-catch to handle failures
  for (const url of profileUrls) {
    // console.log(`Processing URL: ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("h1", { timeout: 10000 }).catch(() => console.log(`Name selector timeout for ${url}`));
      await humanIdle(2000, 4000);

      await checkProfileConnection(page, url);

      await humanIdle(2000, 4000);
      await humanScroll(page, 4);
      await humanIdle(2000, 4000);
    } catch (err) {
      console.error(`Error processing ${url}: ${err.message}. Skipping...`);
    }
  }

  // Assert we are on LinkedIn domain
  await expect(page).toHaveURL(/linkedin\.com/);

  // Close browser and finish test
  await randomDelay(4000, 6000);
  await browser.close();
});