// totp.js
require("dotenv").config();
const speakeasy = require("speakeasy");

const secret = process.env.LINKEDIN_TOTP_SECRET;

if (!secret) {
  console.error("❌ Missing LINKEDIN_TOTP_SECRET in .env file");
  process.exit(1);
}

const step = 30; // default TOTP step = 30s

function printCode() {
  const token = speakeasy.totp({
    secret,
    encoding: "base32",
    step,
  });

  const epoch = Math.floor(Date.now() / 1000);
  const remaining = step - (epoch % step);

  // Clear console each refresh for cleaner display
  console.clear();

  console.log(`Code: ${token} ${remaining} seconds remaining`);
  //console.log(`⏳ Expires in: ${remaining} seconds`);
}

// Print immediately
printCode();

// Refresh every second
setInterval(printCode, 2000);
