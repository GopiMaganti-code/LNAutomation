require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinStealth-state-Lokesh.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

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

test.describe("LinkedIn Profile Image Grab", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    test.setTimeout(10 * 60 * 1000);

    const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;
    if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD)
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");

    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });

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

    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });

    if (await page.locator("#username").isVisible().catch(() => false)) {
      await page.locator("#username").fill(LINKEDIN_EMAIL);
      await page.locator("#password").fill(LINKEDIN_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => {});

      const authLink = page.locator('a:has-text("Verify using authenticator app")','#try-another-way');
      if (await authLink.isVisible().catch(() => false)) {
        await authLink.click();
      }

      const totpSel = 'input[name="pin"][maxlength="6"]';
      if (await page.locator(totpSel).isVisible().catch(() => false)) {
        const token = speakeasy.totp({
          secret: LINKEDIN_TOTP_SECRET,
          encoding: "base32",
        });
        await page.locator(totpSel).fill(token);
        await page.locator('#two-step-submit-button, button[type="submit"]').first().click();
      }

      await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 }).catch(() => {});
      await context.storageState({ path: STORAGE_FILE });
    } else {
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    }
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test("Grab Profile Image and navigate to settings", async () => {
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const profileImage = page.locator('a[data-view-name="identity-self-profile"] >> img').nth(1);
  const name = page.locator(`a[data-view-name="identity-self-profile"] p:first-of-type`).nth(1);
  await profileImage.waitFor({ state: "visible", timeout: 20000 });
  await name.waitFor({ state: "visible", timeout: 10000 });
  
  const imageUrl = await profileImage.getAttribute("src");
  const nameText = await name.innerText();
  console.log("Profile Name:", nameText);
  console.log("Profile Image URL:", imageUrl);
  await page.locator(`[data-view-name="navigation-settings"]`).click();
  await page.locator(`[data-view-name="nav-me-settings-account-manage-account"]`).click();
 
});

//   await page.goto("https://www.linkedin.com/feed/", { waitUntil: "networkidle", timeout: 60000 });
  
//   // Target the overall profile section for waits
//   const profileSection = page.locator('a[data-view-name="identity-self-profile"]').first();
//   await profileSection.waitFor({ state: "visible", timeout: 10000 });
  
//   // Image: Target the SECOND figure[data-view-name="image"] (profile photo container), then its img
//   const profileImageContainer = page.locator('figure[data-view-name="image"]').nth(1);
//   await profileImageContainer.waitFor({ state: "visible", timeout: 10000 });
//   const profileImage = profileImageContainer.locator('img');
  
//   // Name: Target the SECOND a[data-view-name="identity-self-profile"] (text block), then its first p
//   const nameContainer = page.locator('a[data-view-name="identity-self-profile"]').nth(1);
//   await nameContainer.waitFor({ state: "visible", timeout: 10000 });
//   const name = nameContainer.locator('p').first();
  
//   const nameText = await name.innerText();
//   console.log("Profile Name:", nameText);
  
//   // Debug: Log the full outer HTML of the image container for verification
//   const imageHtml = await profileImageContainer.innerHTML();
//   console.log("Profile Image Container HTML:", imageHtml);
  
//   // Extract src (should now hit the photo img directly)
//   let imageUrl = await profileImage.getAttribute("src");
//   if (imageUrl) {
//     console.log("Profile Image URL (from src):", imageUrl);
//     return; // Early exit
//   }
  
//   // Fallback: Check computed background-image on the container (unlikely, but covers div-based layouts)
//   const bgStyle = await profileImageContainer.evaluate((el) => {
//     const style = window.getComputedStyle(el);
//     return style.backgroundImage;
//   });
  
//   if (bgStyle && bgStyle !== "none" && bgStyle.startsWith("url(")) {
//     imageUrl = bgStyle.slice(4, -1).replace(/["']/g, "");
//     console.log("Profile Image URL (from background-image):", imageUrl);
//   } else {
//     console.log("No image URL found. Computed background-image:", bgStyle);
    
//     // Extra debug: All attributes on the img
//     const attrs = await profileImage.evaluate((el) => {
//       const attrObj = {};
//       for (let attr of el.attributes) {
//         attrObj[attr.name] = attr.value;
//       }
//       return attrObj;
//     });
//     console.log("All attributes on profile img:", attrs);
//   }
// });
});