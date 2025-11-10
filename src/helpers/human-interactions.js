/**
 * Human-like Interaction Helpers
 * Simulates human behavior to avoid bot detection
 */

/**
 * Random delay between min and max milliseconds
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 */
async function randomDelay(min = 200, max = 1200) {
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, t));
}

/**
 * Human-like typing with random delays between keystrokes
 * @param {Page} page - Playwright page object
 * @param {string|Locator} selectorOrLocator - CSS selector string or Locator object
 * @param {string} text - Text to type
 */
async function humanType(page, selectorOrLocator, text) {
  let el;
  if (typeof selectorOrLocator === "string") {
    el = page.locator(selectorOrLocator);
  } else {
    el = selectorOrLocator; // Assume it's a Locator
  }
  await el.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  try {
    await el.click({ delay: 100 });
  } catch (e) {
    // Silent fail
  }
  for (const ch of text) {
    const delay = Math.floor(Math.random() * 150) + 50;
    await el.type(ch, { delay });
    if (Math.random() < 0.12) {
      await randomDelay(300, 800);
    }
  }
}

/**
 * Simulates random mouse movements
 * @param {Page} page - Playwright page object
 * @param {number} moves - Number of mouse movements
 */
async function humanMouse(page, moves = 5) {
  const size = page.viewportSize() || { width: 1280, height: 720 };
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * size.width);
    const y = Math.floor(Math.random() * size.height);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 12) + 3 });
    await randomDelay(200, 600);
  }
}

/**
 * Simulates human-like scrolling
 * @param {Page} page - Playwright page object
 * @param {number} steps - Number of scroll steps
 */
async function humanScroll(page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    const dir = Math.random() > 0.2 ? 1 : -1;
    await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
    await randomDelay(800, 1600);
  }
}

/**
 * Simulates idle time (human reading/thinking)
 * @param {number} min - Minimum idle time in milliseconds
 * @param {number} max - Maximum idle time in milliseconds
 */
async function humanIdle(min = 2000, max = 6000) {
  const wait = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((r) => setTimeout(r, wait));
}

module.exports = {
  randomDelay,
  humanType,
  humanMouse,
  humanScroll,
  humanIdle,
};
