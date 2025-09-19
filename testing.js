/**
 * 🔹 LinkedIn Job Scraper + Google Sheets Writer
 * ----------------------------------------------
 * - Uses StateManager for session persistence
 * - Logs in with TOTP MFA if needed
 * - Scrapes jobs by keyword & location
 * - Writes results directly to Google Sheets
 */

require("dotenv").config();
const { google } = require("googleapis");
const speakeasy = require("speakeasy");
const StateManager = require("./stateManager");

// --------------- CONFIG ----------------
const KEYWORD = process.env.JOB_KEYWORD || "Software Testing";
const LOCATION = process.env.JOB_LOCATION || "Hyderabad, India";
const SHEET_ID = process.env.SHEET_ID; // must be set in .env
const ACCOUNT = process.env.ACCOUNT || "user1";

// Path to service account credentials
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./credentials/your-service-account.json";

// --------------- HELPERS ----------------
async function setupSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

async function doLogin(page, context, stateMgr) {
  console.log("🔑 Performing fresh login...");

  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });

  await page.fill("#username", process.env.LINKEDIN_EMAIL);
  await page.fill("#password", process.env.LINKEDIN_PASSWORD);
  await page.click('button[type="submit"]');

  // MFA link
  const authLink = page.locator('a:has-text("Verify using authenticator app")');
  if (await authLink.isVisible().catch(() => false)) {
    console.log("🔐 Clicking MFA authenticator link...");
    await authLink.click();
    await page.waitForTimeout(1000);
  }

  // MFA TOTP
  const mfaInput = page.locator('input[name="pin"]');
  if (await mfaInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const token = speakeasy.totp({
        secret: process.env.LINKEDIN_TOTP_SECRET,
        encoding: "base32",
      });
      console.log(`➡️ MFA attempt ${attempt}: ${token}`);

      await mfaInput.fill(token);
      await page.click('button[type="submit"]');

      try {
        await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 8000 });
        success = true;
        break;
      } catch {
        console.log("⚠️ MFA failed, retrying...");
        await page.waitForTimeout(5000);
      }
    }
    if (!success) throw new Error("❌ MFA failed after 3 attempts");
  }

  await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 30000 });
  await stateMgr.saveState(context);
  console.log("✅ Login successful & state saved!");
}

async function scrapeJobs(page) {
  console.log(`🔍 Searching jobs for "${KEYWORD}" in "${LOCATION}"`);

  await page.goto("https://www.linkedin.com/jobs/", { waitUntil: "domcontentloaded" });

  // Enter search keyword
  const keywordInput = page.locator("input[aria-label='Search jobs']");
  await keywordInput.fill(KEYWORD);

  // Enter location
  const locationInput = page.locator("input[aria-label='Search location']");
  await locationInput.fill(LOCATION);

  // Submit search
  await page.locator("button.jobs-search-box__submit-button").click();
  await page.waitForTimeout(4000);

  // Apply "Past 24 hours"
  await page.locator("#searchFilter_timePostedRange").click();
  await page.locator("label:has-text('Past 24 hours')").click();
  await page.locator("button:has-text('Show results')").click();
  await page.waitForTimeout(4000);

  const jobs = [];
  const jobCardsSelector = "ul.jobs-search-results__list li";

  // pagination loop
  let hasNext = true;
  while (hasNext) {
    const cards = await page.$$(jobCardsSelector);

    for (const card of cards) {
      const title = await card.$eval("h3", el => el.innerText.trim()).catch(() => null);
      const company = await card.$eval("h4 span:first-child", el => el.innerText.trim()).catch(() => null);
      const location = await card.$eval(".job-search-card__location", el => el.innerText.trim()).catch(() => null);
      const posted = await card.$eval(".job-search-card__listdate", el => el.innerText.trim()).catch(() => null);
      const link = await card.$eval("a", el => el.href).catch(() => null);

      if (title && company && link) jobs.push({ title, company, location, posted, link });
    }

    // Check for Next button
    const nextBtn = page.locator("button.jobs-search-pagination__button--next");
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(4000);
    } else {
      hasNext = false;
    }
  }

  console.log(`✅ Scraped ${jobs.length} jobs.`);
  return jobs;
}

async function writeToGoogleSheets(jobs, sheets) {
  if (!SHEET_ID) throw new Error("❌ SHEET_ID is missing in .env");

  const values = [["Job Title", "Company", "Location", "Posted", "Job Link"]];
  for (const job of jobs) {
    values.push([job.title, job.company, job.location, job.posted, job.link]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "Sheet1!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  console.log("💾 Jobs written to Google Sheets!");
}

// --------------- MAIN ----------------
(async () => {
  const stateMgr = new StateManager(ACCOUNT);
  let { browser, context, page } = await stateMgr.launchWithState();

  // Check session
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    console.log("⚠️ Session expired, logging in again...");
    stateMgr.clearState();
    await browser.close();
    ({ browser, context, page } = await stateMgr.launchWithState());
    await doLogin(page, context, stateMgr);
  } else {
    console.log("✅ Session valid, continuing...");
  }

  const jobs = await scrapeJobs(page);
  const sheets = await setupSheets();
  await writeToGoogleSheets(jobs, sheets);

  await browser.close();
})();
