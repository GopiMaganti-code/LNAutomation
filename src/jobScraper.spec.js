require("dotenv").config();
const { test } = require("@playwright/test");
const { chromium } = require("playwright");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const speakeasy = require("speakeasy");

// ---------------- CONFIG ----------------
const STATE_FILE = path.join(__dirname, "linkedin-session.json");
const KEYWORD = process.env.JOB_KEYWORD || "Software Testing Hyderabad, India";
const LOCATION = process.env.JOB_LOCATION || "Hyderabad, India";
const SHEET_ID = process.env.SHEET_ID;
const CREDENTIALS_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "./credentials/google-service-account.json";
const HEADLESS = process.env.HEADLESS !== "false"; // default true

test.setTimeout(300000); // 5 minutes per test

test("LinkedIn Job Scraper", async () => {
  let browser, context, page;

  // ---------------- Google Sheets Setup ----------------
  async function setupSheets() {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  }

  // ---------------- LinkedIn Login ----------------
  async function login(page, context) {
    console.log("🔑 Logging into LinkedIn...");
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
    });
    await page.fill("#username", process.env.LINKEDIN_EMAIL);
    await page.fill("#password", process.env.LINKEDIN_PASSWORD);
    await page.click('button[type="submit"]');

    // MFA
    const mfaInput = page.locator('input[name="pin"]').first();
    if (await mfaInput.isVisible().catch(() => false)) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const token = speakeasy.totp({
          secret: process.env.LINKEDIN_TOTP_SECRET,
          encoding: "base32",
        });
        console.log(`➡️ MFA token: ${token}`);
        try {
          await mfaInput.fill(token);
          await page.click('button[type="submit"]');
          await page.waitForURL("https://www.linkedin.com/feed/", {
            timeout: 15000,
          });
          break;
        } catch {
          console.log("⚠️ MFA failed, retrying...");
          await page.waitForTimeout(5000);
        }
      }
    }

    await page.waitForURL("https://www.linkedin.com/feed/", { timeout: 30000 });
    await context.storageState({ path: STATE_FILE });
    console.log("✅ Login successful & session saved!");
  }

  async function scrapeJobs(page, keyword, location, MAX_PAGES = 5) {
    console.log(`🔍 Searching jobs: "${keyword}" in "${location}"`);

    await page.goto("https://www.linkedin.com/jobs/", {
      waitUntil: "domcontentloaded",
    });

    // Fill search keyword
    await page.fill("input[aria-label*='title, skill, or company']", keyword);
    await page.press("input[aria-label*='title, skill, or company']", "Enter");

    await page.waitForTimeout(4000);

    // Apply "Past 24 hours" filter
    const filterBtn = page.locator("#searchFilter_timePostedRange");
    await filterBtn.click();
    await page.locator("label:has-text('Past 24 hours')").click();
    await page.locator("button:has-text('Show results')").first().click();
    await page.waitForTimeout(3000);

    const jobList = [];
    let hasNext = true;
    let currentPage = 1;

    while (hasNext && currentPage <= MAX_PAGES) {
      console.log(`➡️ Scraping page ${currentPage}...`);

      // // Scroll through job list for dynamic loading
      // await page.evaluate(async () => {
      //     const container = document.querySelector(
      //         ".EElRhzBvRsaMRudgcqTRQzqdRElzpnHOERsA.semantic-search-results-list"
      //     );
      //     if (!container) return;
      //     const distance = 500;
      //     for (let i = 0; i < container.scrollHeight; i += distance) {
      //         container.scrollBy(0, distance);
      //         await new Promise(r => setTimeout(r, 500));
      //     }
      // });
      await page.evaluate(async () => {
        const container = document.querySelector(
          ".EElRhzBvRsaMRudgcqTRQzqdRElzpnHOERsA.semantic-search-results-list"
        );
        if (!container) return;

        const distance = 300; // smaller scroll step
        let position = 0;

        while (position < container.scrollHeight) {
          container.scrollBy(0, distance);
          position += distance;

          // random human-like delay (800–1600ms)
          const delay = Math.floor(Math.random() * (1600 - 800 + 1)) + 800;
          await new Promise((r) => setTimeout(r, delay));

          // occasional longer pause (simulate reading)
          if (Math.random() < 0.1) {
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      });

      // Select all job list items
      const jobItems = await page.$$(
        ".semantic-search-results-list__list-item"
      );
      for (const item of jobItems) {
        const card = await item.$(
          ".job-card-job-posting-card-wrapper__entity-lockup"
        );
        if (!card) continue;

        // Job Title: Use aria-hidden for proper extraction
        const title = await card
          .$eval(
            '.artdeco-entity-lockup__title span[aria-hidden="true"]',
            (el) => el.textContent.trim()
          )
          .catch(() => null);

        // Company Name
        const company = await card
          .$eval("div.artdeco-entity-lockup__subtitle div", (el) =>
            el.textContent.trim()
          )
          .catch(() => null);

        // Location
        const location = await card
          .$eval("div.artdeco-entity-lockup__caption div", (el) =>
            el.textContent.trim()
          )
          .catch(() => null);

        // Posted Date
        const posted = await card
          .$eval("time", (el) => el.textContent.trim())
          .catch(() => null);

        // Job Link (from main list item anchor, not card)
        const link = await item
          .$eval(
            "a.job-card-job-posting-card-wrapper__card-link",
            (el) => el.href
          )
          .catch(() => null);

        // Easy Apply presence
        const easyApply = await item
          .$$eval(".job-card-job-posting-card-wrapper__footer-item", (arr) =>
            arr.some((el) => el.textContent.includes("Easy Apply"))
          )
          .catch(() => false);

        // Actively Reviewing Applicants status
        const activelyReviewing = await item
          .$$eval(
            ".job-card-job-posting-card-wrapper__job-insight-text",
            (arr) =>
              arr.some((el) =>
                el.textContent.includes("Actively reviewing applicants")
              )
          )
          .catch(() => false);

        // Company Logo URL (from image tag in lockup)
        const companyLogo = await card
          .$eval(".artdeco-entity-lockup__image img", (el) => el.src)
          .catch(() => null);

        jobList.push({
          title,
          company,
          location,
          posted,
          link,
          easyApply,
          activelyReviewing,
          companyLogo,
        });
      }

      // Next page
      const nextBtn = page.locator("button[aria-label='View next page']");
      await page.waitForTimeout(3000); // short wait before pagination
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.scrollIntoViewIfNeeded();
        await nextBtn.click();
        await page.waitForTimeout(4000);
        currentPage++;
      } else {
        hasNext = false;
      }
    }

    console.log(
      `✅ Scraped ${jobList.length} jobs across ${currentPage} page(s).`
    );
    return jobList;
  }

  // ---------------- Write to Google Sheets ----------------
  async function writeToGoogleSheets(jobs, sheets) {
    if (!SHEET_ID) throw new Error("❌ SHEET_ID missing in .env");

    const values = [
      [
        "Job Title",
        "Company",
        "Location",
        "Posted",
        "Job Link",
        "Easy Apply",
        "Actively Reviewing",
        "Company Logo",
      ],
    ];
    for (const job of jobs)
      values.push([
        job.title,
        job.company,
        job.location,
        job.posted,
        job.link,
        job.easyApply ? "Yes" : "No",
        job.activelyReviewing ? "Yes" : "No",
        job.companyLogo,
      ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    console.log("💾 Jobs written to Google Sheets!");
  }

  // ---------------- MAIN FLOW ----------------
  browser = await chromium.launch({ headless: HEADLESS });
  context = fs.existsSync(STATE_FILE)
    ? await browser.newContext({ storageState: STATE_FILE })
    : await browser.newContext();
  page = await context.newPage();

  if (!fs.existsSync(STATE_FILE)) {
    await login(page, context);
  } else {
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
    });
    if (page.url().includes("/login")) {
      console.log("⚠️ Session expired. Re-logging in...");
      fs.unlinkSync(STATE_FILE);
      await login(page, context);
    }
  }

  // scrape & save
  const jobResults = await scrapeJobs(page, KEYWORD, LOCATION, 5);
  const sheets = await setupSheets();
  await writeToGoogleSheets(jobResults, sheets);

  await browser.close();
});
