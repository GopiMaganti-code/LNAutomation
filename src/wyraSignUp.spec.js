const { test, expect } = require('@playwright/test');
const { time } = require('speakeasy');

async function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

async function humanType(page, selectorOrLocator, text) {
  let el;
  if (typeof selectorOrLocator === 'string') {
    el = page.locator(selectorOrLocator);
  } else {
    el = selectorOrLocator; // Assume it's a Locator
  }
  await el.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  try {
    await el.click({ delay: 60 });
  } catch (e) {}
  for (const ch of text) {
    const delay = Math.floor(Math.random() * 150) + 50;
    await el.type(ch, { delay });
    if (Math.random() < 0.12) {
      await randomDelay(300, 600);
    }
  }
}

test('Wyra Signup Test', async ({ page }) => {
  // Step 1: Navigate to login page
  await page.goto('https://dev.wyra.ai/login');

  // Step 2: Click on Sign up button
  await page.locator('button[class="text-primary-400 hover:text-primary-300 font-medium transition-colors underline underline-offset-2"]').click();

  // Wait for navigation to signup page
  await page.waitForURL('**/signup');

  // Step 3: Fill the signup form with dummy data
  // First Name
  await humanType(page, 'input[name="firstName"]', 'John');

  // Last Name
  await humanType(page, 'input[name="lastName"]', 'Doe');
 const uniqueId = Math.floor(1000000000 + Math.random() * 9000000000);
  // Email (make unique with timestamp to avoid conflicts)
  const timestamp = Date.now();
  await humanType(page, 'input[name="email"]', `john.doe+${uniqueId}@eficens.com`);

  // Phone Number: Select India country code and fill the number
  const phoneContainer = page.locator('.phone-input-container.react-tel-input');
  await phoneContainer.locator('.flag-dropdown').click();
  await page.waitForTimeout(300); // Wait for dropdown to open

  await humanType(page, `input[placeholder='search']`, 'India');

  // FIXED: Correct selector for India country (data-country-code="in")
  await page.locator('.country[data-country-code="in"]').click(); // Fallback if needed: '.iti__country[data-country-code="in"]'
  await page.waitForTimeout(500); // Brief wait for update

  // FIXED: Target the actual input element inside the container
  const phoneInput = page.locator('.phone-input-container input[type="tel"]'); // Or 'input.form-control' if preferred
  await phoneInput.click(); // Ensure focus
  await humanType(page, phoneInput, uniqueId.toString()); // FIXED: 10-digit national number only
  await phoneInput.blur(); // Trigger formatting/validation

  

  // LinkedIn URL (optional, but filling dummy)
  await humanType(page, 'input[name="linkedinUrl"]', `https://www.linkedin.com/in/johndoe/${uniqueId}`);

  // Password (meets requirements: 8+ chars, upper, lower, number, special)
  const password = `TestPass${uniqueId}!`; // Ensure uniqueness
  await humanType(page, 'input[name="password"]', password);

  // Confirm Password
  await humanType(page, 'input[name="confirmPassword"]', password);

  // Step 4: Wait for Create Account button to be enabled, then click
const createAccountBtn = page.locator('button:has-text("Create Account")');

// Wait until it's visible and enabled
await createAccountBtn.waitFor({ state: "visible", timeout: 10000 });
await expect(createAccountBtn).toBeEnabled({ timeout: 10000 });

// Small delay to ensure frontend validation finishes
await page.waitForTimeout(300);

await createAccountBtn.click(); 

// Small delay to ensure frontend validation finishes
await page.waitForTimeout(300);

await createAccountBtn.click(); // donot remove this line

// Wait for toast notification about verification code

const toast = page.locator(`li[class='group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg'] div div`);

await toast.waitFor({ state: 'visible', timeout: 10000 });
await page.waitForTimeout(500); // brief wait for text to populate
await expect(toast).toHaveText('Verification code sent to your email', { timeout: 10000 });

// Step 5: Verify successful signup by checking for presence of h1 element
await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

await page.waitForTimeout(3000);
// Click on "Resend Code" button
await page.locator("div[class='mt-6 text-center'] button[class='text-primary-400 hover:text-primary-300 font-medium transition-colors underline underline-offset-2']").click();
await expect(toast).toHaveText('Verification code resent!', { timeout: 10000 });

//Click on "Back to Signup" button
await page.locator("div[class='mt-8 text-center'] button[class='text-primary-400 hover:text-primary-300 font-medium transition-colors underline underline-offset-2']").click();

await expect(page.locator(`//h1[normalize-space()='Create your account']`)).toBeVisible({ timeout: 10000 });


});