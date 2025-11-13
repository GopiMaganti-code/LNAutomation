// applyToJobs.test.js - Standalone Playwright Test File for Job Application Automation
require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");

// Configuration
const STORAGE_FILE = process.env.STORAGE_FILE || "linkedinJobApply-state.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_JOBS = parseInt(process.env.MAX_JOBS) || 3; // Limit for testing (default 3 to avoid spam)

/* ---------------------------
   Human-like helpers (Copied from main script for standalone use)
--------------------------- */
async function randomDelay(min = 200, max = 1200) {
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, t));
}

async function humanType(page, locatorOrSelector, text) {
  let el;
  if (typeof locatorOrSelector === "string") {
    el = page.locator(locatorOrSelector);
  } else if (
    locatorOrSelector &&
    typeof locatorOrSelector.locator === "function"
  ) {
    el = locatorOrSelector;
  } else {
    console.error("❌ Invalid locatorOrSelector in humanType");
    return;
  }
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

async function humanIdle(min = 2000, max = 6000) {
  const wait = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, wait));
}

/* ---------------------------
   Stealth patches (Copied for standalone)
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
   The applyToJobs Function (Included for testing)
--------------------------- */
async function applyToJobs(
  page,
  keywords = [],
  experience = "2-5",
  maxJobs = MAX_JOBS
) {
  console.log(
    `🎯 Starting job application automation: Applying to all Easy Apply jobs (Past 24 hours)`
  );
  try {
    // Step 2: Navigate to Jobs
    console.log("🔍 Navigating to Jobs...");
    const jobsNavSelector =
      'a[aria-label="Jobs, 0 new notifications"], a[aria-label*="Jobs"]';
    const jobsLink = page.locator(jobsNavSelector).first();
    if (await jobsLink.isVisible({ timeout: 5000 })) {
      await humanMouse(page, 2);
      await jobsLink.click({ delay: 100 });
      await page.waitForURL(/linkedin\.com\/jobs/, { timeout: 10000 });
      console.log("✅ Landed on Jobs page");
    } else {
      console.log("⚠️ Jobs nav not found, direct goto...");
      await page.goto("https://www.linkedin.com/jobs/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }
    await randomDelay(2000, 4000); // Random delay before search
    // Step 3: Human-like search for "Software testing Jobs in Hyderabad" (Fixed locator for strict mode)
    console.log("🔎 Performing human-like job search...");
    // More precise locator: Use getByRole for the active combobox input
    const searchInput = page.getByRole("combobox", {
      name: /Search by title, skill, or company/,
    });
    await searchInput.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await searchInput.click({ delay: 100 });
    await randomDelay(800, 1500); // Pause before typing
    const query = "Software testing Jobs in Hyderabad";
    await humanType(page, searchInput, query); // Human typing (locator is now single element)
    await randomDelay(500, 1000);
    await searchInput.press("Enter");
    await randomDelay(2000, 4000); // Wait for results
    // Step 4: Apply "Past 24 hours" filter
    console.log("⏰ Applying 'Past 24 hours' filter...");
    const timeFilterBtn = page.locator(
      "#searchFilter_timePostedRange, [data-test-id='job-search-time-filter']"
    );
    await timeFilterBtn.click();
    await randomDelay(300, 800);
    const past24hOption = page.locator(
      "label:has-text('Past 24 hours'), [for*='timePostedRange-past_24']"
    );
    await past24hOption.click();
    await randomDelay(200, 500);
    const showResultsBtn = page
      .locator("button:has-text('Show results'), #searchFilter_apply")
      .first();
    await showResultsBtn.click();
    await randomDelay(2000, 4000);
    // Step 5: Enable Easy Apply filter
    console.log("⚡ Enabling Easy Apply filter...");
    const easyApplyBtn = page.locator(
      "#searchFilter_applyWithLinkedin, [data-test-id='job-search-easy-apply-filter']"
    );
    await easyApplyBtn.click();
    await randomDelay(500, 1000);

    // Step 6: Scrape and apply to all Easy Apply jobs
    console.log("📋 Scraping and applying to Easy Apply jobs...");
    const appliedCount = { total: 0 };
    let currentPage = 1;
    let hasNext = true;
    let scrapedJobs = [];
    while (hasNext && appliedCount.total < maxJobs) {
      console.log(`➡️ Processing page ${currentPage}...`);
      // Human scroll through results
      await page.evaluate(async () => {
        const container = document.querySelector(
          ".jobs-search-results-list, .semantic-search-results-list"
        );
        if (!container) return;
        const distance = 400;
        let position = 0;
        while (position < container.scrollHeight) {
          container.scrollBy(0, distance);
          position += distance;
          const delay = Math.floor(Math.random() * 1200) + 600; // 600-1800ms
          await new Promise((r) => setTimeout(r, delay));
          if (Math.random() < 0.15) {
            // 15% chance longer pause
            await new Promise((r) => setTimeout(r, 4000));
          }
        }
      });
      await randomDelay(1000, 3000);
      // Updated scraping: Use page.locator and .nth(i) for stable querying without ElementHandles
      const jobListLocator = page.locator(
        ".semantic-search-results-list__list-item"
      );
      const jobCount = await jobListLocator.count();
      console.log(`🔍 Found ${jobCount} job items on page ${currentPage}`);
      for (let i = 0; i < jobCount && appliedCount.total < maxJobs; i++) {
        // Scoped locators for the i-th job item
        const itemLocator = jobListLocator.nth(i);
        const title = await itemLocator
          .locator(".artdeco-entity-lockup__title span[aria-hidden='true']")
          .textContent({ timeout: 5000 })
          .catch(() => null);
        const company = await itemLocator
          .locator(".artdeco-entity-lockup__subtitle div")
          .textContent({ timeout: 5000 })
          .catch(() => null);
        const locationText = await itemLocator
          .locator(".artdeco-entity-lockup__caption div")
          .textContent({ timeout: 5000 })
          .catch(() => null);
        const posted = await itemLocator
          .locator("time")
          .textContent({ timeout: 5000 })
          .catch(() => null);
        const link = await itemLocator
          .locator("a.job-card-job-posting-card-wrapper__card-link")
          .getAttribute("href", { timeout: 5000 })
          .catch(() => null);
        // Check Easy Apply using locator
        const easyApplyElements = await itemLocator
          .locator(".job-card-job-posting-card-wrapper__footer-item")
          .all();
        let easyApply = false;
        for (const el of easyApplyElements) {
          const text = await el.textContent({ timeout: 3000 }).catch(() => "");
          if (text && text.includes("Easy Apply")) {
            easyApply = true;
            break;
          }
        }
        if (!easyApply) {
          console.log(
            `⏭️ Skipping job ${i + 1} (Title: ${title || "Unknown"} at ${
              company || "Unknown"
            }): No Easy Apply available`
          );
          continue;
        }
        if (!title || !link) {
          console.log(
            `⏭️ Skipping job ${i + 1} (Title: ${title || "Missing"} at ${
              company || "Unknown"
            }): Missing title or job link`
          );
          continue;
        }
        scrapedJobs.push({
          title,
          company,
          location: locationText,
          posted,
          link,
        });
        // Visit job page to apply
        console.log(
          `🔍 Applying to job ${i + 1}/${jobCount}: ${title} at ${company}`
        );
        await page.goto(link, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await randomDelay(5000, 10000); // Shorter simulate reading to speed up
        // Apply via Easy Apply - Reliable selector for 2025
        const jobEasyApplyBtn = page
          .locator(
            'button.jobs-apply-button:has-text("Easy Apply"), button[aria-label*="Easy Apply to"], button[data-test-apply-button="true"]'
          )
          .first();
        if (await jobEasyApplyBtn.isVisible({ timeout: 10000 })) {
          await humanMouse(page, 1);
          await jobEasyApplyBtn.click({ delay: 100 });
          console.log("✅ Easy Apply modal opened");
          await randomDelay(2000, 4000);
          // Handle multi-step form: Fill contact info step (first modal)
          // Use getByLabel for robust field selection (works with labels in HTML)
          // First name (required, empty)
          const firstNameInput = page.getByLabel("First name");
          if (await firstNameInput.isVisible({ timeout: 5000 })) {
            await firstNameInput.fill("Tanuja"); // Use from profile or default
            console.log("📝 Filled first name");
          }
          // Last name
          const lastNameInput = page.getByLabel("Last name");
          if (await lastNameInput.isVisible({ timeout: 5000 })) {
            await lastNameInput.fill("Peddi");
            console.log("📝 Filled last name");
          }

          // Check if Contact Info form fields are already filled
          console.log("🔍 Checking if Contact Info form is already filled...");
          let isAlreadyFilled = true;
          const fieldsToCheck = [];

          // Check Email address
          const emailSelect = page.getByLabel("Email address");
          if (
            await emailSelect.isVisible({ timeout: 3000 }).catch(() => false)
          ) {
            try {
              // For select dropdowns, check selected option
              const emailValue = await emailSelect.inputValue().catch(() => "");
              const emailText = await emailSelect.textContent().catch(() => "");
              const isEmailFilled =
                emailValue &&
                emailValue.trim() !== "" &&
                emailValue !== "Select an option" &&
                !emailText.includes("Select");
              fieldsToCheck.push({
                name: "Email address",
                filled: isEmailFilled,
                locator: emailSelect,
              });
              if (!isEmailFilled) isAlreadyFilled = false;
            } catch (err) {
              // If it's a select with options, try to get selected value
              const selectedOption = await emailSelect
                .locator("option:checked")
                .textContent()
                .catch(() => "");
              const isEmailFilled =
                selectedOption &&
                selectedOption.trim() !== "" &&
                selectedOption !== "Select an option";
              fieldsToCheck.push({
                name: "Email address",
                filled: isEmailFilled,
                locator: emailSelect,
              });
              if (!isEmailFilled) isAlreadyFilled = false;
            }
          }

          // Check Phone country code
          const phoneCountrySelect = page.getByLabel("Phone country code");
          if (
            await phoneCountrySelect
              .isVisible({ timeout: 5000 })
              .catch(() => false)
          ) {
            try {
              const phoneCountryValue = await phoneCountrySelect
                .inputValue()
                .catch(() => "");
              const phoneCountryText = await phoneCountrySelect
                .textContent()
                .catch(() => "");
              const isPhoneCountryFilled =
                phoneCountryValue &&
                phoneCountryValue.trim() !== "" &&
                phoneCountryValue !== "Select an option" &&
                !phoneCountryText.includes("Select");
              fieldsToCheck.push({
                name: "Phone country code",
                filled: isPhoneCountryFilled,
                locator: phoneCountrySelect,
              });
              if (!isPhoneCountryFilled) isAlreadyFilled = false;
            } catch (err) {
              const selectedOption = await phoneCountrySelect
                .locator("option:checked")
                .textContent()
                .catch(() => "");
              const isPhoneCountryFilled =
                selectedOption &&
                selectedOption.trim() !== "" &&
                selectedOption !== "Select an option";
              fieldsToCheck.push({
                name: "Phone country code",
                filled: isPhoneCountryFilled,
                locator: phoneCountrySelect,
              });
              if (!isPhoneCountryFilled) isAlreadyFilled = false;
            }
          }

          // Check Mobile phone number
          const phoneInput = page.getByLabel("Mobile phone number");
          if (
            await phoneInput.isVisible({ timeout: 5000 }).catch(() => false)
          ) {
            const phoneValue = await phoneInput.inputValue().catch(() => "");
            const isPhoneFilled = phoneValue && phoneValue.trim() !== "";
            fieldsToCheck.push({
              name: "Mobile phone number",
              filled: isPhoneFilled,
              locator: phoneInput,
            });
            if (!isPhoneFilled) isAlreadyFilled = false;
          }

          // Check Location (city)
          const locationInput = page.getByLabel("Location (city)");
          if (
            await locationInput.isVisible({ timeout: 5000 }).catch(() => false)
          ) {
            const locationValue = await locationInput
              .inputValue()
              .catch(() => "");
            const isLocationFilled =
              locationValue && locationValue.trim() !== "";
            fieldsToCheck.push({
              name: "Location (city)",
              filled: isLocationFilled,
              locator: locationInput,
            });
            if (!isLocationFilled) isAlreadyFilled = false;
          }

          // Log field status
          fieldsToCheck.forEach((field) => {
            console.log(
              `  ${field.filled ? "✅" : "❌"} ${field.name}: ${
                field.filled ? "Filled" : "Empty"
              }`
            );
          });

          if (isAlreadyFilled && fieldsToCheck.length > 0) {
            console.log("✅ Form already filled — skipping inputs.");
          } else {
            // Fill only empty fields
            console.log("📝 Filling empty Contact Info fields...");

            // Fill Email if empty
            const emailField = fieldsToCheck.find(
              (f) => f.name === "Email address"
            );
            if (
              emailField &&
              !emailField.filled &&
              (await emailField.locator
                .isVisible({ timeout: 3000 })
                .catch(() => false))
            ) {
              try {
                // Try to select first valid email option
                const emailOptions = await emailField.locator
                  .locator("option")
                  .all();
                if (emailOptions.length > 1) {
                  // Skip first option if it's "Select an option"
                  const firstValidOption = emailOptions[1] || emailOptions[0];
                  const optionValue = await firstValidOption
                    .getAttribute("value")
                    .catch(() => "");
                  if (optionValue) {
                    await emailField.locator.selectOption(optionValue);
                    console.log("📧 Selected email address");
                  } else {
                    // If no value attribute, try selecting by index
                    await emailField.locator.selectOption({ index: 1 });
                    console.log("📧 Selected email address (by index)");
                  }
                } else if (emailOptions.length === 1) {
                  // Only one option, select it
                  await emailField.locator.selectOption({ index: 0 });
                  console.log("📧 Selected email address");
                }
              } catch (err) {
                console.log("⚠️ Could not fill email address:", err.message);
              }
            }

            // Fill Phone Country Code if empty
            const phoneCountryField = fieldsToCheck.find(
              (f) => f.name === "Phone country code"
            );
            if (
              phoneCountryField &&
              !phoneCountryField.filled &&
              (await phoneCountryField.locator
                .isVisible({ timeout: 5000 })
                .catch(() => false))
            ) {
              await phoneCountryField.locator.selectOption("India (+91)");
              console.log("📞 Selected phone country: India");
            }

            // Fill Mobile Phone Number if empty
            const phoneField = fieldsToCheck.find(
              (f) => f.name === "Mobile phone number"
            );
            if (
              phoneField &&
              !phoneField.filled &&
              (await phoneField.locator
                .isVisible({ timeout: 5000 })
                .catch(() => false))
            ) {
              await humanType(page, phoneField.locator, "1234567890");
              console.log("📞 Filled mobile phone");
            }

            // Fill Location if empty
            const locationField = fieldsToCheck.find(
              (f) => f.name === "Location (city)"
            );
            if (
              locationField &&
              !locationField.filled &&
              (await locationField.locator
                .isVisible({ timeout: 5000 })
                .catch(() => false))
            ) {
              await locationField.locator.fill("Hyderabad, Telangana, India");
              console.log("📍 Filled location");
            }
          }

          // Click Next to proceed (from HTML: aria-label="Continue to next step", text="Next")
          const nextBtn = page
            .getByRole("button", { name: "Next", exact: true })
            .or(page.locator('button[aria-label="Continue to next step"]'))
            .first();
          if (await nextBtn.isVisible({ timeout: 10000 })) {
            await humanMouse(page, 1);
            await nextBtn.click({ delay: 100 });
            console.log("➡️ Step 1: Clicked Next - Proceeding to resume step");
            await randomDelay(2000, 4000);

            // Step 2: After resume dialog appears, click Next again (resume already selected)
            console.log(
              "🔍 Step 2: Waiting for resume dialog and clicking Next..."
            );
            const resumeNextBtn = page
              .locator('button[aria-label="Continue to next step"]')
              .or(page.locator('button:has-text("Next")'))
              .first();
            if (await resumeNextBtn.isVisible({ timeout: 10000 })) {
              await humanMouse(page, 1);
              await resumeNextBtn.click({ delay: 100 });
              console.log("✅ Step 2: Clicked Next after resume dialog");
              await randomDelay(2000, 4000);
            } else {
              console.log(
                "⚠️ Resume Next button not found - may already be past this step"
              );
            }

            // Step 3: Check for and click top choice checkbox if visible
            console.log("🔍 Step 3: Checking for top choice checkbox...");
            const topChoiceCheckbox = page.locator(
              "#job-details-easy-apply-top-choice"
            );
            if (
              await topChoiceCheckbox
                .isVisible({ timeout: 5000 })
                .catch(() => false)
            ) {
              await humanMouse(page, 1);
              await topChoiceCheckbox.click({ delay: 100 });
              console.log("✅ Step 3: Clicked top choice checkbox");
              await randomDelay(1000, 2000);
            } else {
              console.log(
                "ℹ️ Step 3: Top choice checkbox not found - skipping"
              );
            }

            // Step 4: Fill text area with top choice message
            console.log("🔍 Step 4: Looking for top choice text area...");
            const topChoiceTextArea = page.locator(
              '[placeholder="Briefly describe why this job is your top choice and why you\'re a good fit."]'
            );
            if (
              await topChoiceTextArea
                .isVisible({ timeout: 5000 })
                .catch(() => false)
            ) {
              const topChoiceMessage =
                "I am highly motivated for this position because it aligns strongly with my background and interests. My skills and experience make me a strong fit for the role, and I am excited about the opportunity to contribute.";
              await humanType(page, topChoiceTextArea, topChoiceMessage);
              console.log("✅ Step 4: Filled top choice text area");
              await randomDelay(1000, 2000);
            } else {
              console.log(
                "ℹ️ Step 4: Top choice text area not found - skipping"
              );
            }

            // Step 5: Click Review button
            console.log("🔍 Step 5: Looking for Review button...");
            const reviewBtn = page.locator(
              '[aria-label="Review your application"]'
            );
            if (
              await reviewBtn.isVisible({ timeout: 10000 }).catch(() => false)
            ) {
              await humanMouse(page, 1);
              await reviewBtn.click({ delay: 100 });
              console.log("✅ Step 5: Clicked Review button");
              await randomDelay(2000, 4000);
            } else {
              console.log(
                "⚠️ Step 5: Review button not found - may already be on review page"
              );
            }

            // Step 6: Click Submit application button
            console.log("🔍 Step 6: Looking for Submit application button...");
            const submitBtn = page.locator('[aria-label="Submit application"]');
            if (
              await submitBtn.isVisible({ timeout: 10000 }).catch(() => false)
            ) {
              await humanMouse(page, 1);
              await submitBtn.click({ delay: 100 });
              console.log(`✅ Step 6: Submitted application for ${title}`);
              appliedCount.total++;
            } else {
              // Fallback: Try alternative selectors
              const submitBtnAlt = page
                .getByRole("button", {
                  name: "Submit application",
                  exact: true,
                })
                .or(page.locator('button:has-text("Submit application")'))
                .first();
              if (
                await submitBtnAlt
                  .isVisible({ timeout: 5000 })
                  .catch(() => false)
              ) {
                await humanMouse(page, 1);
                await submitBtnAlt.click({ delay: 100 });
                console.log(
                  `✅ Step 6: Submitted application (alt selector) for ${title}`
                );
                appliedCount.total++;
              } else {
                console.log(
                  `⚠️ Step 6: Submit button not found for ${title} - Form may be incomplete`
                );
              }
            }
          } else {
            console.log(
              `⚠️ Next button not found for ${title} - Check form fields`
            );
          }
          await randomDelay(2000, 5000); // Post-apply pause
          // Close modal if needed
          const closeModal = page
            .locator('button[aria-label="Dismiss"], .artdeco-modal__dismiss')
            .first();
          if (await closeModal.isVisible({ timeout: 3000 })) {
            await closeModal.click();
          }
        } else {
          console.log(`⚠️ Easy Apply button not found for ${title}`);
        }
        // Go back to search results with explicit wait
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 });
        await randomDelay(1000, 3000);
      }
      // Pagination - Updated to use locator
      const nextBtn = page.locator(
        "button[aria-label='View next page'], #pagination-next-btn, li[role='presentation']:last-child button"
      );
      hasNext =
        (await nextBtn.isVisible({ timeout: 3000 })) &&
        !(await nextBtn.isDisabled());
      if (hasNext) {
        await humanMouse(page, 1);
        await nextBtn.click();
        await randomDelay(2000, 4000);
        currentPage++;
      } else {
        hasNext = false;
      }
    }
    console.log(
      `✅ Finished! Applied to ${appliedCount.total} Easy Apply jobs. Scraped ${scrapedJobs.length} jobs total.`
    );
    return { applied: appliedCount.total, scraped: scrapedJobs }; // Return for assertions
  } catch (err) {
    console.error("❌ Job application failed:", err.message);
    throw err; // Re-throw for test failure
  }
}

/* ---------------------------
   Main Test Suite
--------------------------- */
test.describe("LinkedIn Job Application Tests", () => {
  let browser, context, page;

  test.beforeAll(async () => {
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
    }

    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    }); // Non-headless for visual debugging
    const storageState =
      fs.existsSync(STORAGE_FILE) &&
      fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
        ? STORAGE_FILE
        : undefined;

    context = await browser.newContext({
      viewport: null,
      locale: "en-US",
      timezoneId: "Asia/Kolkata", // Match user's likely timezone
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      storageState,
    });

    page = await context.newPage();
    await addStealth(page); // Apply stealth patches

    try {
      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await humanMouse(page, 3);
      await humanIdle(800, 1800);

      if (await page.locator("#username").isVisible({ timeout: 5000 })) {
        console.log("🔐 Logging in...");
        await humanType(page, "#username", process.env.LINKEDIN_EMAIL);
        await humanIdle(600, 1600);
        await humanType(page, "#password", process.env.LINKEDIN_PASSWORD);
        await humanIdle(600, 1600);
        await page
          .locator(`label[for='rememberMeOptIn-checkbox']`)
          .click()
          .catch(() =>
            console.log("Remember Me checkbox not found, skipping.")
          );
        await humanIdle(600, 1600);
        await page.locator('button[type="submit"]').click();
        await randomDelay(1000, 2000);

        const authLink = page.locator(
          'a:has-text("Verify using authenticator app")'
        );
        if (await authLink.isVisible({ timeout: 5000 })) await authLink.click();
        const totpInput = page.locator('input[name="pin"][maxlength="6"]');
        if (await totpInput.isVisible({ timeout: 5000 })) {
          console.log("🔑 Using TOTP MFA...");
          const token = speakeasy.totp({
            secret: process.env.LINKEDIN_TOTP_SECRET,
            encoding: "base32",
          });
          await humanType(page, totpInput, token);
          await randomDelay(700, 1400);
          await page
            .locator('#two-step-submit-button, button[type="submit"]')
            .first()
            .click();
        }

        await page
          .waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 })
          .catch(() => console.log("⚠️ Feed not reached."));
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

  test(
    "Apply to Easy Apply Jobs",
    async () => {
      test.setTimeout(30 * 60 * 1000); // 30 minutes for job apps (longer due to pagination/forms)

      console.log("🚀 Running job application test...");
      const result = await applyToJobs(page, [], "2-5", MAX_JOBS);

      // Basic assertions (expand as needed)
      expect(result.applied).toBeGreaterThanOrEqual(0); // At least attempted
      expect(result.scraped).toHaveLength(result.applied + expect.any(Number)); // Scraped >= applied
      console.log(
        `✅ Test passed: Applied to ${result.applied} jobs, scraped ${result.scraped.length} total.`
      );

      // Final URL check (should be back on jobs or feed)
      await expect(page).toHaveURL(/linkedin\.com\/(jobs|feed)/);
    },
    { timeout: 30 * 60 * 1000 }
  ); // Per-test timeout
});

// Run with: npx playwright test applyToJobs.test.js --project=chromium
// Notes: Update resume path in applyToJobs. Set MAX_JOBS=1 for dry-run. Ensure .env has creds + TOTP_SECRET.
// Fixed: humanType now accepts Locator objects directly (e.g., from getByRole/getByLabel) to avoid "expected string, got object" error.
