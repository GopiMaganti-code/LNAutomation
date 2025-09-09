// src/scrapeConnections2.spec.js
// ---------------------------------------------------------------------------------
// This script logs into LinkedIn using Playwright with TOTP 2FA support,
// scrapes all connections from the "My Network > Connections" page via full UI scroll,
// saves them to a local JSON file, and optionally appends new connections
// to a Google Sheet (controlled via SAVE_TO_SHEETS env variable).
//
// Usage:
//   SAVE_TO_SHEETS=true  → Scrape + Save JSON + Push to Google Sheets
//   SAVE_TO_SHEETS=false → Scrape + Save JSON only (no Sheets API used at all)
// ---------------------------------------------------------------------------------

require("dotenv").config();
const { test } = require("@playwright/test");
const fs = require("fs");
const speakeasy = require("speakeasy");

const SESSION_FILE = process.env.SESSION_FILE || "linkedin-session.json";
const SPREADSHEET_ID = process.env.SHEET_ID || "YOUR_GOOGLE_SHEET_ID";
const SAVE_TO_SHEETS = process.env.SAVE_TO_SHEETS === "true"; // default false

// ---------- Google Sheets Setup (only if enabled) ----------
let sheets = null;
console.log("SAVE_TO_SHEETS env value:", process.env.SAVE_TO_SHEETS);
if (SAVE_TO_SHEETS) {
  const { google } = require("googleapis");
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials/your-service-account.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheets = google.sheets({ version: "v4", auth });
}

// ---------- Helpers ----------
async function randomDelay(min = 800, max = 2000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((res) => setTimeout(res, delay));
}

async function humanType(locator, text) {
  for (const char of text) {
    await locator.type(char, {
      delay: Math.floor(Math.random() * 150) + 50,
      timeout: 5000,
    });
  }
}

function getISTTimestamp() {
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // +5:30 hrs
  return istTime.toISOString().replace("T", " ").split(".")[0];
}

// ---------- Google Sheets Functions ----------
async function ensureHeaders() {
  if (!SAVE_TO_SHEETS) return;
  const expected = [
    "Name",
    "Profile URL",
    "Headline",
    "Connected On",
    "Profile Image URL",
    "Timestamp",
  ];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Connections!A1:F1",
    });
    const have = (res.data.values && res.data.values[0]) || [];
    const mismatch =
      have.length !== expected.length ||
      expected.some((h, i) => (have[i] || "").trim() !== h);

    if (!res.data.values || res.data.values.length === 0 || mismatch) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Connections!A1:F1",
        valueInputOption: "RAW",
        requestBody: { values: [expected] },
      });
      console.log("📝 Headers set: " + expected.join(", "));
    }
  } catch (err) {
    console.error("⚠️ Could not ensure headers:", err.message);
  }
}

async function getExistingProfiles() {
  if (!SAVE_TO_SHEETS) return new Set();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Connections!B2:B",
    });
    const rows = res.data.values || [];
    return new Set(rows.map((r) => r[0]));
  } catch (err) {
    console.error("⚠️ Could not fetch existing rows:", err.message);
    return new Set();
  }
}

async function saveToGoogleSheets(connections) {
  if (!SAVE_TO_SHEETS) {
    console.log("📌 Skipping Google Sheets push (SAVE_TO_SHEETS=false).");
    return;
  }

  console.log("📤 Preparing to push connections to Google Sheets...");
  const existingProfiles = await getExistingProfiles();
  const newConnections = connections.filter(
    (c) => c.profileUrl && !existingProfiles.has(c.profileUrl)
  );

  if (newConnections.length === 0) {
    console.log("✅ No new connections to append");
    return;
  }

  const rows = newConnections.map((c) => [
    c.name,
    c.profileUrl,
    c.headline,
    c.connectedOn || "",
    c.profileImageUrl || "",
    getISTTimestamp(),
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Connections!A:F",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  console.log(`✅ Pushed ${newConnections.length} new connections to Google Sheets`);
}

// ---------- UI Scraper ----------
async function scrapeConnectionsUI(page, alreadyFetchedUrls = new Set()) {
  console.log("📂 Navigating to Connections page...");
  await page.goto("https://www.linkedin.com/mynetwork/invite-connect/connections/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await randomDelay(5000, 8000);

  let previousCount = alreadyFetchedUrls.size;
  const connectionsSet = new Set(alreadyFetchedUrls);
  let scrollAttempts = 0;

  const container = page.locator("main#workspace").last();

  while (true) {
    await container.evaluate((el) => el.scrollBy(0, 400));
    await randomDelay(800, 1500);
    await page
      .waitForSelector("a[data-view-name='connections-profile']", { timeout: 5000 })
      .catch(() => {});

    const loadedConnections = await page.$$eval(
      "a[data-view-name='connections-profile']",
      (els) => els.map((el) => el.href)
    );
    loadedConnections.forEach((url) => connectionsSet.add(url));

    if (connectionsSet.size === previousCount) {
      scrollAttempts++;
    } else {
      scrollAttempts = 0;
      previousCount = connectionsSet.size;
    }

    if (scrollAttempts >= 10) break;
    if (previousCount % 50 === 0) await randomDelay(3000, 6000);
  }

  const connections = await page.$$eval(
    "div[componentkey^='auto-component-']",
    (cards) =>
      cards
        .map((card) => {
          const firstAnchor = card.querySelector('a[data-view-name="connections-profile"]');
          const profileImageEl = firstAnchor?.querySelector("figure img");

          const infoAnchor = card.querySelectorAll('a[data-view-name="connections-profile"]')[1] || firstAnchor;
          const anchorPs = infoAnchor ? Array.from(infoAnchor.querySelectorAll("p")) : [];
          const nameEl = anchorPs[0]?.querySelector("a") || card.querySelector("p a");

          const headlineText = anchorPs[1]?.innerText?.trim() || null;

          const connectedDateEl = Array.from(card.querySelectorAll("p")).find((p) =>
            /Connected on/i.test(p.innerText || "")
          );

          const profileUrl = (firstAnchor?.href || infoAnchor?.href || "").split("?")[0] || null;

          return {
            name: nameEl?.innerText?.trim() || null,
            profileUrl,
            headline: headlineText,
            connectedOn: connectedDateEl
              ? connectedDateEl.innerText.replace(/^\s*Connected on\s*/i, "").trim()
              : null,
            profileImageUrl: profileImageEl?.src || null,
          };
        })
        .filter((c) => c.name && c.profileUrl)
  );

  console.log(`✅ Total connections extracted via UI: ${connections.length}`);
  return connections;
}

// ---------- MAIN TEST ----------
test("LinkedIn login + scrape all connections (UI full scroll only)", async ({ page }) => {
  test.setTimeout(30 * 60 * 1000); // 30 minutes
  const { LINKEDIN_EMAIL, LINKEDIN_PASSWORD, LINKEDIN_TOTP_SECRET } = process.env;
  let freshLogin = false;

  if (fs.existsSync(SESSION_FILE)) {
    const storage = JSON.parse(fs.readFileSync(SESSION_FILE));
    await page.context().addCookies(storage);
    console.log("Loaded existing session cookies.");
  }

  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await randomDelay();

  if (await page.locator('input[name="session_key"]').isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("Performing fresh login...");
    freshLogin = true;

    await humanType(page.locator("#username"), LINKEDIN_EMAIL);
    await randomDelay();
    await humanType(page.locator("#password"), LINKEDIN_PASSWORD);
    await randomDelay();
    await page.locator('button[type="submit"]').click({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const checkAppHeading = page.locator('h1:has-text("Check your LinkedIn app")');
    if (await checkAppHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("⚠️ Detected LinkedIn push notification MFA screen.");
      const authLink = page.locator('a:has-text("Verify using authenticator app")');
      await authLink.click();
      await page.waitForTimeout(1000);
    }

    const token = speakeasy.totp({ secret: LINKEDIN_TOTP_SECRET, encoding: "base32" });
    const pinInput = page.locator('input[name="pin"]').first();
    await humanType(pinInput, token);
    await page.locator("div button#two-step-submit-button").first().click({ timeout: 10000 });

    await page.waitForURL((url) => /linkedin\.com\/(feed|mynetwork)/.test(url.toString()), {
      timeout: 60000,
    });

    const cookies = await page.context().cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
    console.log("💾 Session cookies saved.");
  } else {
    console.log("Already logged in with existing session.");
  }

  // ---------- UI scraper only ----------
  console.log("⚡ Using UI scraper for connections...");
  const uiConnections = await scrapeConnectionsUI(page);

  const timestamp = new Date().toISOString();
  const allConnections = uiConnections.map((c) => ({
    ...c,
    timestamp,
  }));

  fs.writeFileSync("connections.json", JSON.stringify(allConnections, null, 2));
  console.log(`💾 Saved ${allConnections.length} connections to connections.json`);

  await ensureHeaders();
  await saveToGoogleSheets(allConnections);
});
