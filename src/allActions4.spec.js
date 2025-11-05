require("dotenv").config();
const { test, expect, chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");
// Configuration
const STORAGE_FILE =
  process.env.STORAGE_FILE || "linkedinStealth-state-Praneeth.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days
const PROFILE_URLS = (process.env.PROFILE_URLS || "")
  .split(",")
  .map((url) => url.replace(/"/g, "").trim())
  .filter((url) => url);
const ACTION = process.env.ACTION || "view_feed"; // Default action
/* ---------------------------
    Human-like Interaction Helpers (Enhanced with Guide Principles)
--------------------------- */

// Simple Gaussian approximation using Box-Muller transform
function gaussianSample(mean, sd) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * sd;
}

function truncatedNormal(mean, sd, min, max) {
  let x;
  do {
    x = gaussianSample(mean, sd);
  } while (x < min || x > max);
  return x;
}

// Mixed distribution delay (70% Gaussian, 20% Uniform, 10% Exponential + jitter)
function humanDelay(actionType = 'general', extraJitterMs = 0) {
  let mean, sd, min, max, uniformMin, uniformMax, expScale;
  switch (actionType) {
    case 'connection_request':
      mean = 270000; // 4.5 min in ms
      sd = 120000; // 2 min
      min = 60000; // 1 min
      max = 720000; // 12 min
      uniformMin = 120000; uniformMax = 600000;
      expScale = 600000;
      break;
    case 'message_after_connect':
      mean = 1800000; // 30 min
      sd = 3600000; // Vary up to hours
      min = 1800000; max = 28800000; // 30min - 8h
      uniformMin = 1800000; uniformMax = 10800000; // 30min-3h for uniform
      expScale = 7200000; // 2h scale
      break;
    case 'profile_view':
      mean = 45000; // 45s
      sd = 30000; // 30s
      min = 10000; max = 300000; // 10s - 5min
      uniformMin = 10000; uniformMax = 90000;
      expScale = 180000;
      break;
    case 'withdraw':
      mean = 750000; // ~12.5 min, but guide 5-20 min
      sd = 450000;
      min = 300000; max = 1200000;
      uniformMin = 300000; uniformMax = 1200000;
      expScale = 900000;
      break;
    case 'general': // Default for scrolls, idles, etc.
    default:
      mean = 2000;
      sd = 1000;
      min = 500; max = 6000;
      uniformMin = 500; uniformMax = 5000;
      expScale = 3000;
      break;
  }
  const r = Math.random();
  let secs;
  if (r < 0.70) {
    secs = truncatedNormal(mean / 1000, sd / 1000, min / 1000, max / 1000) * 1000;
  } else if (r < 0.90) {
    secs = (Math.random() * ((uniformMax - uniformMin) / 1000) + (uniformMin / 1000)) * 1000;
  } else {
    secs = (-Math.log(Math.random()) * expScale + uniformMin) * 1000; // Exponential + min
  }
  // Add uniform jitter
  secs += (Math.random() - 0.5) * extraJitterMs * 2; // ± jitter
  // Clamp
  secs = Math.max(min, Math.min(secs, max));
  return new Promise((r) => setTimeout(r, Math.floor(secs)));
}

// Enhanced humanType with per-char delay, editing pauses, backspaces
async function humanType(page, locator, text) {
  const el = page.locator(locator);
  await el.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  try {
    await el.click({ delay: 100 });
  } catch {}
  let typed = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    // Per-char delay: normal(0.24s, 0.08s) clamped 0.05-0.7s
    const perCharDelay = Math.max(50, Math.min(700, gaussianSample(240, 80)));
    await el.type(ch, { delay: perCharDelay });
    typed += ch;

    // Occasional editing pause (5-15% chance)
    if (Math.random() < 0.1) { // ~10% avg
      const editPause = Math.random() * 2500 + 500; // 0.5-3s
      await page.waitForTimeout(editPause);
    }

    // Occasional backspace (1-3% per char, but overall 15-25% messages)
    if (Math.random() < 0.02 && i > 0 && typed.length > 1) { // Low per-char, accumulates
      await page.waitForTimeout(Math.random() * 170 + 80); // 80-250ms before backspace
      await el.press('Backspace');
      typed = typed.slice(0, -1);
      console.log(`🔧 Simulated backspace edit at char ${i}`);
    }

    // Occasional longer think pause (1-3% of chars)
    if (Math.random() < 0.02) {
      const thinkPause = Math.random() * 7000 + 5000; // 5-12s
      await page.waitForTimeout(thinkPause);
    }
  }
  // Review pause before send: 20-60s
  const reviewDelay = Math.random() * 40000 + 20000;
  await page.waitForTimeout(reviewDelay);
  console.log(`👀 Simulated review pause: ${Math.round(reviewDelay / 1000)}s`);
}

async function humanMouse(page, moves = 5) {
  const size = page.viewportSize() || { width: 1280, height: 720 };
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * size.width);
    const y = Math.floor(Math.random() * size.height);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 12) + 3 });
    await humanDelay('general', 400); // Jittered short delay
  }
}

async function humanScroll(page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    const dir = Math.random() > 0.2 ? 1 : -1;
    await page.mouse.wheel(0, dir * (Math.floor(Math.random() * 300) + 150));
    await humanDelay('general', 1200); // Enhanced with mixed dist
  }
}

async function humanIdle(min = 2000, max = 6000) {
  await humanDelay('general'); // Uses general dist, overrides min/max if needed
}

/* ---------------------------
    Close All Message Boxes Helper (Enhanced)
--------------------------- */
async function closeAllMessageBoxes(page) {
  console.log("🗑️ Closing all open message boxes...");
  const closeButtons = page
    .locator(
      ".msg-overlay-bubble-header__controls.display-flex.align-items-center button"
    )
    .last();
  const altCloseButtons = page.locator(
    "button.msg-overlay-bubble-header__control.artdeco-button--circle:has-text('Close your conversation with')"
  );
  const allButtons = closeButtons.or(altCloseButtons);
  const buttons = await allButtons.all();
  for (const button of buttons) {
    try {
      await button.scrollIntoViewIfNeeded();
      await humanMouse(page, 1);
      await button.click({ delay: 100 });
      console.log("✅ Closed a message box");
      await humanDelay('general'); // Jittered delay between closes
    } catch (err) {
      console.log("⚠️ Failed to close a message box:", err.message);
    }
  }
}

/* ---------------------------
   Stealth patches (Unchanged)
--------------------------- */
async function addStealth(page) {
  await page.addInitScript(() => {
    try {
      // Core automation traces (original + enhanced)
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "webdriver", { configurable: false }); // Prevent override detection
      window.chrome = { runtime: {} }; // Fake Chrome extension support
      Object.defineProperty(navigator, "plugins", {
        get: () => [
          { name: "Chrome PDF Plugin" }, { name: "Chrome PDF Viewer" }, { name: "Native Client" }
        ], // More realistic array
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"], // Original
      });
      Object.defineProperty(navigator, "language", {
        get: () => "en-US",
      });

      // Screen/Viewport spoof (fake common resolutions)
      const fakeScreen = {
        width: 1920 + Math.floor(Math.random() * 200) - 100, // 1820-2020
        height: 1080 + Math.floor(Math.random() * 100) - 50, // 1030-1130
        availWidth: 1920,
        availHeight: 1040,
        colorDepth: 24,
        pixelDepth: 24,
      };
      Object.defineProperty(screen, "width", { get: () => fakeScreen.width });
      Object.defineProperty(screen, "height", { get: () => fakeScreen.height });
      Object.defineProperty(screen, "availWidth", { get: () => fakeScreen.availWidth });
      Object.defineProperty(screen, "availHeight", { get: () => fakeScreen.availHeight });
      Object.defineProperty(screen, "colorDepth", { get: () => fakeScreen.colorDepth });
      Object.defineProperty(screen, "pixelDepth", { get: () => fakeScreen.pixelDepth });

      // Hardware spoof (fake mid-range device)
      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => 8 + Math.floor(Math.random() * 4), // 8-11 cores
      });
      Object.defineProperty(navigator, "deviceMemory", {
        get: () => 8 + Math.floor(Math.random() * 8), // 8-15 GB
      });

      // Timezone/Intl spoof (fake common US/Asia)
      const fakeTimezone = Math.floor(Math.random() * 3) === 0 ? "America/New_York" : "Asia/Kolkata"; // 1/3 US, else IST
      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        const options = originalResolvedOptions.call(this);
        options.timeZone = fakeTimezone;
        return options;
      };

      // Fonts partial spoof (inject CSS to fake measurement; can't fully hide but adds noise)
      const style = document.createElement('style');
      style.textContent = `
        @font-face { font-family: 'FakeFont'; src: url('data:font/woff;base64,...') format('woff'); } /* Placeholder; use real base64 for noise */
        * { font-family: system-ui, -apple-system, sans-serif !important; } /* Normalize to common stack */
      `;
      document.head.appendChild(style);

      // Canvas noise (enhanced: random per call, subtle gradients)
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        if (this.width > 0 && this.height > 0) {
          const ctx = this.getContext("2d");
          // Random noise pixels (0.01-0.05 opacity)
          const noise = Math.random() * 0.04 + 0.01;
          ctx.fillStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},${noise})`;
          ctx.fillRect(0, 0, 1 + Math.random(), 1 + Math.random()); // Varied size
          // Subtle gradient for realism
          const grad = ctx.createLinearGradient(0, 0, 1, 1);
          grad.addColorStop(0, `rgba(0,0,0,${noise/2})`);
          grad.addColorStop(1, `rgba(255,255,255,${noise/2})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, this.width, this.height);
        }
        return originalToDataURL.apply(this, args);
      };
      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
        const dataURL = this.toDataURL(); // Trigger noise
        const binStr = atob(dataURL.split(',')[1]);
        const len = binStr.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i);
        callback(new Blob([arr], { type: 'image/png' }), ...args);
      };

      // WebGL noise (enhanced: vary vendor per context, add extensions)
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return ["Intel Inc.", "NVIDIA Corporation", "Apple GPU"][Math.floor(Math.random() * 3)]; // Rotate vendors
        if (param === 37446) {
          const engines = ["Intel Iris OpenGL Engine", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)", "Apple GLSL"];
          return engines[Math.floor(Math.random() * engines.length)];
        }
        if (param === 7936) return "WebGL 1.0"; // Vendor-specific
        if (param === 7937) return "WebGL GLSL ES 1.0"; // Renderer-specific
        return originalGetParameter.call(this, param);
      };
      // Fake extensions
      const originalGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
      WebGLRenderingContext.prototype.getSupportedExtensions = function() {
        const exts = originalGetSupportedExtensions.call(this) || [];
        // Add/remove randomly for noise
        const fakeExts = ["WEBGL_debug_renderer_info", "OES_texture_float", "EXT_frag_depth"];
        if (Math.random() > 0.5) exts.push(...fakeExts.slice(0, Math.floor(Math.random() * 2)));
        return exts;
      };

      // Audio noise (enhanced: vary noise per buffer, add oscillator quirks)
      const originalGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function(channel) {
        const data = originalGetChannelData.call(this, channel);
        const noiseLevel = Math.random() * 0.0001 + 0.00005; // Subtle variation
        return data.map((v, i) => {
          // Add phase-based noise (mimic hardware)
          const phase = i / data.length * Math.PI * 2;
          return v + noiseLevel * Math.sin(phase) * (Math.random() - 0.5);
        });
      };
      // Fake AudioContext state
      const originalCreateOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function() {
        const osc = originalCreateOscillator.call(this);
        // Add micro-delay simulation
        osc.start = function(when = 0) {
          setTimeout(() => originalCreateOscillator.call(this).start(when), Math.random() * 2); // 0-2ms jitter
        };
        return osc;
      };

      // Media Devices spoof (fake 1 cam + 1 mic)
      const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
      navigator.mediaDevices.enumerateDevices = async () => {
        const devices = await originalEnumerateDevices.call(navigator.mediaDevices);
        // Filter real, add fakes
        return devices.filter(d => d.kind === 'audioinput' || d.kind === 'videoinput').slice(0, 2).concat([
          { deviceId: 'fake-cam', kind: 'videoinput', label: 'Fake Webcam' },
          { deviceId: 'fake-mic', kind: 'audioinput', label: 'Fake Microphone' }
        ]);
      };
      Object.defineProperty(navigator, "permissions", {
        get: () => ({
          query: (perm) => Promise.resolve({ state: perm.name.includes('camera') || perm.name.includes('microphone') ? 'denied' : 'granted' }), // Privacy-focused user
        }),
      });

      // Speech Voices spoof (fake 2-3 common voices)
      const originalGetVoices = window.speechSynthesis.getVoices;
      window.speechSynthesis.getVoices = function() {
        return [
          { name: 'Google US English', lang: 'en-US', localService: false },
          { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US', localService: true },
          Math.random() > 0.5 ? { name: 'Fake Voice', lang: 'en-IN', localService: false } : null,
        ].filter(Boolean);
      };
      // Trigger load
      speechSynthesis.getVoices();

      // Battery spoof (fake 80-100% charging)
      if ('getBattery' in navigator) {
        const originalGetBattery = navigator.getBattery;
        navigator.getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.8 + Math.random() * 0.2, // 80-100%
          addEventListener: () => {}, // Stub events
        });
      }

      // Permissions/Geolocation spoof (deny or fake)
      if (navigator.geolocation) {
        const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
        navigator.geolocation.getCurrentPosition = (success, error) => {
          setTimeout(() => {
            if (Math.random() > 0.7) { // 30% grant fake coords
              success({ coords: { latitude: 37.7749 + (Math.random()-0.5)*0.1, longitude: -122.4194 + (Math.random()-0.5)*0.1 } });
            } else {
              error({ code: 1, message: 'User denied Geolocation' }); // Common denial
            }
          }, Math.random() * 500 + 100); // Human-like delay
        };
      }

      // Performance noise (add micro-delays to timings)
      const originalNow = performance.now;
      let lastTime = Date.now();
      performance.now = function() {
        const real = originalNow.call(this);
        const jitter = (Math.random() - 0.5) * 0.1; // ±0.05ms
        lastTime += jitter;
        return Math.max(real, lastTime);
      };

      // DNT spoof (via header override simulation; real via context)
      Object.defineProperty(navigator, 'doNotTrack', {
        get: () => Math.random() > 0.5 ? '1' : null, // 50% enabled
      });

      // Eval/Console noise (simulate human dev tools)
      const originalEval = window.eval;
      window.eval = function(code) {
        if (Math.random() < 0.01) { // Rare "human" console
          console.log('%cHuman here!', 'color: blue; font-size: 20px');
        }
        return originalEval.call(this, code);
      };
      const originalConsoleLog = console.log;
      console.log = function(...args) {
        if (Math.random() < 0.001) args.unshift(new Date().toISOString()); // Timestamp noise
        return originalConsoleLog.apply(this, args);
      };

      // ClientRects noise (add subpixel jitter)
      const originalGetClientRects = Element.prototype.getClientRects;
      Element.prototype.getClientRects = function() {
        const rects = originalGetClientRects.call(this);
        return Array.from(rects).map(rect => ({
          ...rect,
          x: rect.x + (Math.random() - 0.5) * 0.1, // Subpixel noise
          y: rect.y + (Math.random() - 0.5) * 0.1,
        }));
      };

    } catch (e) {
      console.error('Stealth init error:', e); // Silent in prod
    }
  });
}

/* ---------------------------
   Updated Helpers (Enhanced with delays)
--------------------------- */
async function detectProfileName(page, timeout = 5000) {
  let profileName = "Unknown";
  const nameSelectors = [
    { selector: "h1", description: "h1 tag" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p', description: "verified badge button p" },
    { selector: ".text-heading-xlarge", description: "heading class fallback" }
  ];
  for (const { selector, description } of nameSelectors) {
    try {
      const nameText = await page.locator(selector).textContent({ timeout });
      if (nameText && (profileName = nameText.trim()) !== "Unknown") {
        console.log(`👤 Profile name found via ${description}: ${profileName} (raw: "${nameText.trim()}")`);
        break;
      }
      await humanDelay('general', 200); // Short jitter between selectors
    } catch (err) {
      if (!err.message.includes('Timeout')) {
        console.log(`⚠️ Name selector failed ${description}: ${err.message}`);
      }
    }
  }
  console.log(`👤 Final profile name: ${profileName}`);
  return profileName;
}

async function detectDegree(page, timeout = 5000) {
  let degree = "unknown";
  const degreeSelectors = [
    { selector: 'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child', description: "degree last p" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] + p + p', description: "verified badge + p + p" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"]', description: "verified badge container" },
    // Legacy fallbacks
    { selector: ".distance-badge .visually-hidden", description: "degree badge hidden text" },
    { selector: ".distance-badge .dist-value", description: "degree badge visible value" }
  ];
  for (const { selector, description } of degreeSelectors) {
    try {
      const connectionInfo = await page.locator(selector).textContent({ timeout });
      if (connectionInfo) {
        const lowerInfo = connectionInfo.toLowerCase().trim();
        let matchedDegree = null;
        if (lowerInfo.includes("· 2nd") || lowerInfo.includes("2nd")) {
          matchedDegree = "2nd";
        } else if (lowerInfo.includes("· 3rd") || lowerInfo.includes("3rd")) {
          matchedDegree = "3rd";
        } else if (lowerInfo.includes("· 1st") || lowerInfo.includes("1st")) {
          matchedDegree = "1st";
        }
        if (matchedDegree) {
          degree = matchedDegree; // Keep as "1st"/"2nd"/"3rd" (not full text)
          console.log(`📊 Degree matched via ${description}: ${matchedDegree}`);
          break;
        }
      }
      await humanDelay('general', 200); // Short jitter
    } catch (err) {
      if (!err.message.includes('Timeout')) {
        console.log(`⚠️ Skipping ${description}: ${err.message}`);
      }
    }
  }
  console.log(`📊 Detected degree: ${degree}`);
  return degree;
}

async function getVisibleLocator(page, selectors, useLast = false, timeout = 5000) {
  for (const selector of selectors) {
    try {
      let safeSelector = selector;
      if (!selector.includes(':has(')) {
        safeSelector += useLast ? ':last-of-type' : ':first-of-type';
      }
      const loc = page.locator(safeSelector);
      const singleLoc = useLast ? loc.nth(-1) : loc.nth(0);
      if (await singleLoc.isVisible({ timeout })) {
        console.log(`✅ Using selector: ${selector} (useLast: ${useLast})`);
        return singleLoc;
      }
      await humanDelay('general', 100); // Micro jitter
    } catch (err) {
      console.log(`⚠️ Selector failed: ${selector} - ${err.message}`);
    }
  }
  return null;
}

async function getTextFromSelectors(page, selectors, timeout = 5000) {
  for (const selector of selectors) {
    try {
      const text = await page.locator(selector).textContent({ timeout });
      if (text && text.trim().length > 0) {
        return text.trim();
      }
      await humanDelay('general', 100);
    } catch (err) {
      // Silenced non-critical timeouts for cleaner logs
      if (!err.message.includes("Timeout")) {
        console.log(`⚠️ Text selector failed: ${selector} - ${err.message}`);
      }
    }
  }
  return null;
}

/* ---------------------------
   Action Functions (All Enhanced)
--------------------------- */
/* ---------------------------
   View Feed Action (Enhanced)
--------------------------- */
async function viewFeed(page) {
  console.log("📺 Starting to view LinkedIn feed...");
  try {
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log("✅ Navigated to LinkedIn feed");
    const feedSelectors = [".scaffold-layout__content", ".feed-container"];
    let feedLoaded = false;
    for (const selector of feedSelectors) {
      if (
        await page
          .locator(selector)
          .isVisible({ timeout: 10000 })
          .catch(() => false)
      ) {
        console.log(`✅ Feed content loaded using selector: ${selector}`);
        feedLoaded = true;
        break;
      }
    }
    if (!feedLoaded)
      console.log("⚠️ Feed content not found, continuing with scrolling...");
    for (let session = 1; session <= 3; session++) {
      console.log(
        `🔄 Feed viewing session ${session}/3 - Scrolling and pausing...`
      );
      await humanScroll(page, Math.floor(Math.random() * 5) + 3);
      // Micro-action: Occasional like or view pause
      if (Math.random() < 0.3) {
        await humanMouse(page, 2);
        await humanDelay('profile_view'); // Simulate reading a post
      }
      await humanDelay('general'); // Session pause
      if (Math.random() > 0.5) {
        console.log("🖱️ Simulating mouse movement...");
        await humanMouse(page, 2);
      }
    }
    await humanIdle(); // Final idle
    console.log("✅ Finished viewing feed");
  } catch (err) {
    console.error("❌ Failed to view feed:", err.message);
  }
}

/* ---------------------------
    Like Feed Action (Enhanced)
--------------------------- */
async function likeFeed(page) {
  console.log("📝 Starting to like a random post...");
  try {
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await humanScroll(page, 5);
    await humanDelay('profile_view');
    const likeButtons = await page
      .locator(".reactions-react-button button[aria-label*='Like']")
      .all();
    if (likeButtons.length === 0) {
      console.log("⚠️ No Like buttons found on the feed");
      return;
    }
    const unreactedButtons = [];
    for (const button of likeButtons) {
      const isReacted = await button
        .evaluate((el) => el.getAttribute("aria-label").includes("Unlike"), {
          timeout: 5000,
        })
        .catch(() => false);
      if (!isReacted) unreactedButtons.push(button);
      await humanDelay('general', 200); // Short jitter between checks
    }
    if (unreactedButtons.length === 0) {
      console.log("⚠️ All visible posts are already reacted to");
      return;
    }
    const randomIndex = Math.floor(Math.random() * unreactedButtons.length);
    const selectedButton = unreactedButtons[randomIndex];
    console.log(
      `🎯 Selected random unreacted post ${randomIndex + 1} of ${
        unreactedButtons.length
      }`
    );
    await humanMouse(page, 2);
    await selectedButton.scrollIntoViewIfNeeded();
    await selectedButton.click({ delay: 100 });
    console.log("👍 Liked the post");
    await humanDelay('general');
    console.log("✅ Finished liking the post");
    await humanIdle();
  } catch (err) {
    console.error("❌ Failed to like post:", err.message);
  }
}

/* ---------------------------
   Check Degree Action (Enhanced)
--------------------------- */
async function checkDegree(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    await humanScroll(page, 4);
    let name = "Unknown User";
    const nameLocators = [
      { selector: "h1", description: "h1 tag" },
      {
        selector: ".text-heading-xlarge",
        description: "text-heading-xlarge class",
      },
    ];
    for (const { selector, description } of nameLocators) {
      try {
        name =
          (await page.locator(selector).innerText({ timeout: 5000 })) ||
          "Unknown User";
        break;
      } catch (err) {
        console.log(`⚠️ Name locator ${description} failed: ${err.message}`);
      }
    }
    let degreeText = null;
    const degreeLocators = [
      {
        selector:
          'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child',
        description: "degree last p",
      },
      {
        selector:
          'div[data-view-name="profile-top-card-verified-badge"] + p + p',
        description: "verified badge + p + p",
      },
      {
        selector: 'div[data-view-name="profile-top-card-verified-badge"]',
        description: "verified badge container",
      },
      {
        selector: ".distance-badge .visually-hidden",
        description: "degree badge hidden text",
      },
      {
        selector: ".distance-badge .dist-value",
        description: "degree badge visible value",
      },
    ];
    for (const { selector, description } of degreeLocators) {
      try {
        degreeText = await page
          .locator(selector)
          .textContent({ timeout: 5000 });
        if (degreeText) break;
      } catch (err) {
        console.log(`⚠️ Degree locator ${description} failed: ${err.message}`);
      }
    }
    let degree = "Unknown";
    if (degreeText) {
      const lowerInfo = degreeText.toLowerCase().trim();
      if (lowerInfo.includes("· 2nd") || lowerInfo.includes("2nd")) {
        degree = "2nd";
      } else if (lowerInfo.includes("· 3rd") || lowerInfo.includes("3rd")) {
        degree = "3rd+";
      } else if (lowerInfo.includes("· 1st") || lowerInfo.includes("1st")) {
        degree = "1st";
      } else if (lowerInfo.includes("out of network")) {
        degree = "Out of Network";
      }
    }
    console.log(`Profile Details for ${url}: Name: ${name}, Degree: ${degree}`);
  } catch (err) {
    console.error(`❌ Error processing ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Send Message Action (Enhanced)
--------------------------- */
async function sendMessage(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    await closeAllMessageBoxes(page);
    let profileName = "Friend";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page
          .locator(selector)
          .textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(`Found profile name with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Name selector failed: ${err.message}`);
      }
    }
    let is1stDegree = false;
    const degreeLocators = [
      {
        selector: ".distance-badge .visually-hidden",
        description: "degree badge hidden text",
      },
      {
        selector: ".distance-badge .dist-value",
        description: "degree badge visible value",
      },
      {
        selector:
          'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child',
        description: "degree last p",
      },
      {
        selector: '[data-view-name="profile-top-card-verified-badge"] + p',
        description: "verified badge adjacent p",
      },
      {
        selector:
          'div[data-view-name="profile-top-card-verified-badge"] ~ p:nth-of-type(2)',
        description: "verified badge sibling second p",
      },
    ];
    for (const { selector, description } of degreeLocators) {
      try {
        const connectionInfo = await page
          .locator(selector)
          .textContent({ timeout: 5000 });
        if (connectionInfo && connectionInfo.toLowerCase().includes("1st")) {
          is1stDegree = true;
          break;
        }
      } catch (err) {
        console.log(`⚠️ Skipping ${description}: ${err.message}`);
      }
    }
    if (!is1stDegree) {
      console.log(
        `⛔ Skipping message to ${url} - Not a 1st degree connection`
      );
      return;
    }
    const messageButtonLocators = [
      {
        selector: "div.ph5 button:has-text('Message')",
        description: "old message button",
      },
      {
        selector: 'a[data-view-name="profile-primary-message"]',
        description: "primary message last",
      },
      {
        selector: 'a[data-view-name="profile-secondary-message"]',
        description: "secondary message last",
      },
    ];
    let messageButton = null;
    for (const { selector, description } of messageButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        messageButton = btn;
        console.log(`Found message button with ${description}`);
        break;
      } catch (err) {
        console.log(`⚠️ ${description} not found: ${err.message}`);
      }
    }
    if (!messageButton) {
      console.log("❌ No message button found");
      return;
    }
    await humanMouse(page, 2);
    await messageButton.click({ delay: 100 });
    console.log("💬 Message box opened");
    await humanDelay('general');
    const message = `Hi ${profileName}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    const messageInput = page.locator("div.msg-form__contenteditable");
    await messageInput.waitFor({ state: "visible", timeout: 10000 });
    await humanType(page, "div.msg-form__contenteditable", message); // Enhanced
    console.log("📝 Message typed");
    const sendButton = page.locator("button.msg-form__send-button");
    await sendButton.waitFor({ state: "visible", timeout: 10000 });
    await humanMouse(page, 1);
    await sendButton.click({ delay: 100 });
    console.log(`✅ Message sent to ${profileName}`);
    await humanDelay('general');
    await closeAllMessageBoxes(page);
    console.log(`✅ Finished sending message to ${url}`);
  } catch (err) {
    console.error(`❌ Failed to send message to ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Check Connection Accepted Action (Enhanced)
--------------------------- */
async function checkConnectionAccepted(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    let profileName = await detectProfileName(page);
    let degree = await detectDegree(page);
    if (degree === "unknown") {
      degree = "Unknown degree";
    }
    let status = "Unknown";
    console.log(`🔍 Degree check: "${degree}" (includes "1st"? ${degree.includes("1st")})`);
    if (degree.includes("1st")) {
      status = "Accepted";
      console.log(`✅ ${profileName}: ${degree} - ${status}`);
    } else {
      const acceptSelectors = [
        ".ph5 [aria-label*='Accept']",
        'button[aria-label^="Accept"][aria-label*="request to connect"]',
        '[data-view-name="relationship-building-button"] button[aria-label*="Accept"]',
        '[data-view-name="edge-creation-accept-action"] button'
      ];
      const acceptButton = await getVisibleLocator(page, acceptSelectors);
      const pendingSelectors = [
        ".ph5 button:has-text('Pending')",
        ".ph5 button:has-text('Withdraw')",
        '[aria-label*="Pending, click to withdraw invitation"]',
        '[data-view-name="relationship-building-button"] button[aria-label*="Pending"]',
        '[data-view-name="edge-creation-withdraw-action"] button'
      ];
      const pendingButton = await getVisibleLocator(page, pendingSelectors);
      const connectSelectors = [
        ".ph5 button:has-text('Connect')",
        'div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-connect-action"] a',
        'div[data-view-name="edge-creation-connect-action"] a',
        '[data-view-name="relationship-building-button"] a[aria-label^="Invite"][aria-label*="to connect"]',
        '[data-view-name="edge-creation-connect-action"] a[aria-label^="Invite"][aria-label*="to connect"]',
        '[data-view-name="relationship-building-button"] a:has(svg[id="connect-small"])',
        '[data-view-name="profile-secondary-message"] ~ [data-view-name="relationship-building-button"] a:has-text("Connect")',
        `[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label^="Invite"][aria-label*="to connect"]`
      ];
      const connectButton = await getVisibleLocator(page, connectSelectors, true);
      if (acceptButton) {
        status = "Incoming Request (Accept Pending)";
        console.log(`📥 ${profileName}: ${degree} - ${status} (Accept button)`);
      } else if (pendingButton) {
        status = "Sent but Not Accepted (Pending)";
        console.log(`⏳ ${profileName}: ${degree} - ${status}`);
      } else if (connectButton) {
        status = "Not Sent Yet";
        console.log(`⛔ ${profileName}: ${degree} - ${status} (Connect button)`);
      } else {
        const moreSelectors = [
          ".ph5 button:has-text('More')",
          ".ph5 [aria-label='More actions']",
          '[data-view-name="profile-overflow-button"]',
          '[data-view-name="relationship-building-button"] ~ button[aria-label="More"]'
        ];
        const moreButton = await getVisibleLocator(page, moreSelectors);
        if (moreButton) {
          console.log("🔽 Clicking moreButton...");
          await moreButton.click({ delay: 100, timeout: 10000 });
          console.log("🔽 More dropdown opened");
          await humanDelay('general');
          console.log("🔍 Looking for remove/withdraw options...");
          const removeSelectors = [
            ".artdeco-dropdown__content span:has-text('Remove this connection')",
            ".artdeco-dropdown__content [aria-label*='Remove connection']",
            ".artdeco-dropdown__content li:has-text('Remove')"
          ];
          const removeConnection = await getVisibleLocator(page, removeSelectors, true);
          const withdrawSelectors = [
            ".artdeco-dropdown__content span:has-text('Withdraw invitation')",
            ".artdeco-dropdown__content [aria-label*='Withdraw invitation']",
            ".artdeco-dropdown__content li:has-text('Withdraw')"
          ];
          const withdrawOption = await getVisibleLocator(page, withdrawSelectors);
          if (removeConnection) {
            status = "Accepted";
            console.log(`✅ ${profileName}: ${degree} - ${status} (Remove Connection)`);
          } else if (withdrawOption) {
            status = "Sent but Not Accepted (Withdraw)";
            console.log(`⏳ ${profileName}: ${degree} - ${status}`);
          } else {
            status = "Unknown";
            console.log(`❓ ${profileName}: ${degree} - ${status}`);
          }
          await humanMouse(page, 1);
          await moreButton.click({ delay: 100, timeout: 5000 });
          console.log("🔼 Dropdown closed");
        } else {
          status = "Unknown";
          console.log(`❓ ${profileName}: ${degree} - ${status} (No More button)`);
        }
      }
    }
    console.log(`✅ Done with ${url} - Final Status: ${status}`);
  } catch (err) {
    console.error(`❌ Error checking status for ${url}: ${err.message}`);
    console.log(`✅ Done with ${url} - Final Status: Error`);
  }
}

/* ---------------------------
   Check Reply Action (Enhanced)
--------------------------- */
async function checkReply(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    const closeButton = page.locator("button:has-text('Close your conversation')").first();
    const altClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
    if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeButton.click();
    }
    let profileName = "Unknown";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page.locator(selector).textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(`👤 Found profile name: "${profileName}" (via ${selector})`);
          break;
        }
      } catch {
        // silent fail, try next
      }
    }
    let replyStatus = "No Reply Received";
    const messageButtonLocators = [
      {
        selector: "div.ph5 button:has-text('Message')",
        description: "old message button",
      },
      {
        selector: 'a[data-view-name="profile-primary-message"]',
        description: "primary message last",
      },
      {
        selector: 'a[data-view-name="profile-secondary-message"]',
        description: "secondary message last",
      },
    ];
    let messageButton = null;
    for (const { selector, description } of messageButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        messageButton = btn;
        console.log(`✅ Found message button (${description})`);
        break;
      } catch {
        // try next
      }
    }
    if (messageButton) {
      console.log(`✅ Message button found for ${profileName}`);
      await messageButton.click();
      await humanDelay('general');
      const replyElements = await page.locator(".msg-s-event-listitem--other").all();
      if (replyElements.length > 0) {
        replyStatus = "Reply Received";
        console.log(`Sender: ${profileName}`);
        console.log(` - Reply Status: ${replyStatus}`);
        const firstReply = replyElements[0];
        let senderName = await firstReply.locator(".msg-s-message-group__name").textContent({ timeout: 5000 }).catch(() => profileName);
        let timestamp = await firstReply.locator(".msg-s-message-group__timestamp").textContent({ timeout: 5000 }).catch(() => "Unknown Time");
        for (let i = 0; i < replyElements.length; i++) {
          const replyElement = replyElements[i];
          const messageText = await replyElement.locator(".msg-s-event-listitem__body").textContent({ timeout: 5000 }).catch(() => "Unable to retrieve message");
          console.log(
            `- Message ${i + 1}: From ${senderName.trim().replace(/\s+/g, " ")} at ${timestamp.trim().replace(/\s+/g, " ")} - "${messageText.trim() || "No readable message content"}"`
          );
          await humanDelay('general', 200); // Short between logs
        }
      } else {
        console.log(`Sender: ${profileName}`);
        console.log(` - Reply Status: ${replyStatus} (No reply elements found)`);
      }
      const closeButton = page.locator("button:has-text('Close your conversation')").first();
      const altClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
      if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await closeButton.click();
      } else if (await altClose.isVisible({ timeout: 5000 }).catch(() => false)) {
        await altClose.click();
      }
      await humanDelay('general');
    } else {
      console.log(`⚠️ Message button not found for ${profileName} after 10 seconds`);
      console.log(`Sender: ${profileName}`);
      console.log(` - Reply Status: No Reply Received (No Message Button)`);
    }
    console.log(`✅ Done with ${url}`);
  } catch (err) {
    console.error(`❌ Error checking messages for ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Grab Replies Action (Enhanced)
--------------------------- */
async function grabReplies(page, url) {
  console.log(`🌐 Visiting: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    const closeButton = page.locator("button:has-text('Close your conversation')").first();
    const altClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
    if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeButton.click();
      console.log("🗑️ Closed existing conversation overlay");
    } else if (await altClose.isVisible({ timeout: 5000 }).catch(() => false)) {
      await altClose.click();
      console.log("🗑️ Closed via alt close");
    }
    let profileName = "Unknown";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page.locator(selector).textContent({ timeout: 3000 });
        if (text && text.trim().length > 0) {
          profileName = text.trim();
          console.log(`👤 Found profile name: "${profileName}" (via ${selector})`);
          break;
        }
      } catch (err) {
        if (!err.message.includes("Timeout")) console.log(`⚠️ Name selector failed: ${selector} - ${err.message}`);
      }
    }
    let replyStatus = "No Messages Found";
    const messageButtonLocators = [
      { selector: "div.ph5 button:has-text('Message')", description: "header message button" },
      { selector: 'a[data-view-name="profile-primary-message"]', description: "primary message link" },
      { selector: 'a[data-view-name="profile-secondary-message"]', description: "secondary message link" },
      { selector: 'button[aria-label*="Message"]', description: "aria message button" },
    ];
    let messageButton = null;
    for (const { selector, description } of messageButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 5000 });
        messageButton = btn;
        console.log(`✅ Found message button (${description})`);
        break;
      } catch (err) {
        if (!err.message.includes("Timeout")) console.log(`⚠️ Message button selector failed: ${description} - ${err.message}`);
      }
    }
    if (messageButton) {
      console.log(`💬 Opening conversation for ${profileName}`);
      await humanMouse(page, 2);
      await messageButton.click({ delay: 100 });
      await humanDelay('general');
      const eventContainers = await page.locator('ul.msg-s-message-list-content > li.msg-s-message-list__event').all();
      const timeHeadings = await page.locator('.msg-s-message-list__time-heading').all();
      if (eventContainers.length > 0) {
        replyStatus = "Conversation Retrieved";
        console.log(`Sender: ${profileName}`);
        console.log(` - Status: ${replyStatus} (${eventContainers.length} total messages)`);
        console.log("📜 Full Conversation Log:");
        let currentDateHeading = "Unknown Date";
        let headingIndex = 0;
        let lastTimestamp = null;
        for (let i = 0; i < eventContainers.length; i++) {
          const eventContainer = eventContainers[i];
          const msgElement = eventContainer.locator('.msg-s-event-listitem').first();
          let localHeading = await eventContainer.locator('.msg-s-message-list__time-heading').textContent({ timeout: 2000 }).catch(() => "");
          if (localHeading.trim()) {
            currentDateHeading = localHeading.trim();
          } else if (headingIndex < timeHeadings.length) {
            const globalHeading = await timeHeadings[headingIndex].textContent({ timeout: 2000 }).catch(() => "");
            if (globalHeading.trim()) {
              currentDateHeading = globalHeading.trim();
              headingIndex++;
            }
          }
          const isOther = await msgElement.evaluate(el => el.classList.contains('msg-s-event-listitem--other'));
          let senderName = isOther ? profileName : "Vamsi Reddy";
          let timestamp = await msgElement.locator('.msg-s-message-group__timestamp').textContent({ timeout: 3000 }).catch(() => "Unknown Time");
          timestamp = timestamp ? timestamp.trim().replace(/\s+/g, " ") : "Unknown Time";
          if (timestamp === "Unknown Time" && lastTimestamp) {
            timestamp = lastTimestamp;
          }
          if (timestamp !== "Unknown Time") {
            lastTimestamp = timestamp;
          }
          let messageText = await msgElement.locator('.msg-s-event-listitem__body').textContent({ timeout: 5000 }).catch(() => "");
          messageText = messageText.replace(/<!---->/g, "").trim();
          if (!messageText || messageText.length === 0) {
            messageText = "No readable content";
          }
          let seenInfo = "";
          const seenCount = await msgElement.locator('.msg-s-event-listitem__seen-receipts img').count();
          if (seenCount > 0) {
            const seenTitle = await msgElement.locator('.msg-s-event-listitem__seen-receipts img').getAttribute('title', { timeout: 2000 }).catch(() => "");
            seenInfo = seenTitle ? ` (Seen: ${seenTitle})` : " (Seen)";
          }
          console.log(
            ` - Msg ${i + 1}/${eventContainers.length}: From "${senderName}" on ${currentDateHeading} at ${timestamp}${seenInfo} - "${messageText}"`
          );
          await humanDelay('general', 200); // Micro-pause
        }
      } else {
        console.log(`Sender: ${profileName}`);
        console.log(` - Status: ${replyStatus} (Empty conversation)`);
      }
      const finalCloseButton = page.locator("button:has-text('Close your conversation')").first();
      const finalAltClose = page.locator(".msg-overlay-bubble-header__control svg[use*='close-small']").first();
      if (await finalCloseButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await finalCloseButton.click();
      } else if (await finalAltClose.isVisible({ timeout: 5000 }).catch(() => false)) {
        await finalAltClose.click();
      }
      await humanDelay('general');
    } else {
      console.log(`⚠️ Message button not found for ${profileName} (skipping conversation)`);
      console.log(`Sender: ${profileName}`);
      console.log(` - Status: No Reply Received (No Message Button)`);
    }
    console.log(`✅ Done with ${url} (${replyStatus})`);
  } catch (err) {
    console.error(`❌ Error checking messages for ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Send Follow Action (Enhanced)
--------------------------- */
async function sendFollow(page, url) {
  console.log(`🌐 Visiting: ${url} to follow 3rd degree connection`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    let profileName = "Unknown";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page
          .locator(selector)
          .textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(
            `👤 Found profile name: "${profileName}" (via ${selector})`
          );
          break;
        }
      } catch {
        // silent fail
      }
    }
    let degree = "Unknown";
    const degreeLocators = [
      { selector: 'div:has(div[data-view-name="profile-top-card-verified-badge"]) ~ p:last-child', description: "degree last p" },
      { selector: 'div[data-view-name="profile-top-card-verified-badge"] + p', description: "verified badge + p" },
      { selector: 'div[data-view-name="profile-top-card-verified-badge"] + p + p', description: "verified badge + p + p" },
      { selector: 'div[data-view-name="profile-top-card-verified-badge"]', description: "verified badge container" },
      { selector: ".distance-badge .visually-hidden", description: "degree badge hidden text" },
      { selector: ".distance-badge .dist-value", description: "degree badge visible value" }
    ];
    for (const { selector, description } of degreeLocators) {
      try {
        const connectionInfo = await page.locator(selector).textContent({ timeout: 5000 });
        if (connectionInfo) {
          const lowerInfo = connectionInfo.toLowerCase().trim();
          if (lowerInfo.includes("· 2nd") || lowerInfo.includes("2nd")) {
            degree = "2nd";
            break;
          } else if (lowerInfo.includes("· 3rd") || lowerInfo.includes("3rd")) {
            degree = "3rd";
            break;
          } else if (lowerInfo.includes("· 1st") || lowerInfo.includes("1st")) {
            degree = "1st";
            break;
          }
        }
      } catch (err) {
        if (!err.message.includes('Timeout')) {
          console.log(`⚠️ Skipping ${description}: ${err.message}`);
        }
      }
    }
    console.log(`📊 Detected degree: ${degree}`);
    if (degree === "3rd") {
      const followButtonLocators = [
        {
          selector: ".ph5.pb5 [aria-label*='Follow']",
          description: "header follow button primary / secondary",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "primary-message adjacent relationship follow aria",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
          description: "primary-message adjacent edge-creation follow icon",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
          description: "primary-message adjacent relationship follow text",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-primary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "topcard with primary-message relationship follow aria",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "topcard with secondary-message relationship follow aria",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
          description: "topcard with secondary-message edge-creation follow icon",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
          description: "topcard with secondary-message relationship follow text",
        },
      ];
      let followButton = null;
      for (const { selector, description } of followButtonLocators) {
        try {
          const btn = page.locator(selector).last();
          await btn.waitFor({ state: "visible", timeout: 3000 });
          followButton = btn;
          console.log(`✅ Found follow button (${description})`);
          break;
        } catch {
          // try next
        }
      }
      if (followButton) {
        await humanMouse(page, 2);
        await followButton.click({ delay: 100 });
        console.log(`✅ Followed ${profileName} via direct button`);
      } else {
        const moreButtonLocators = [
          {
            selector: ".ph5 [aria-label='More actions']",
            description: "more actions aria",
          },
          {
            selector: 'button[data-view-name="profile-overflow-button"][aria-label="More"]',
            description: "overflow more button",
          },
          {
            selector: ".ph5.pb5 button:has-text('More')",
            description: "more text button",
          },
        ];
        let moreButton = null;
        for (const { selector, description } of moreButtonLocators) {
          try {
            const btn = page.locator(selector).last();
            await btn.waitFor({ state: "visible", timeout: 3000 });
            moreButton = btn;
            console.log(`✅ Found more button (${description})`);
            break;
          } catch {
            // try next
          }
        }
        if (moreButton) {
          await humanMouse(page, 2);
          await moreButton.click({ delay: 100 });
          console.log("💡 More button clicked");
          await humanDelay('general');
          const dropdownFollowLocators = [
            {
              selector: ".ph5.pb5 .artdeco-dropdown__content-inner [aria-label*='Follow']",
              description: "dropdown aria follow",
            },
            {
              selector: ".artdeco-dropdown__content-inner span:has-text('Follow')",
              description: "dropdown text follow",
            },
            {
              selector: ".artdeco-dropdown__content a[aria-label*='Follow']",
              description: "dropdown link follow",
            },
            {
              selector: "div[aria-label*='Follow']",
              description: "dropdown area follow",
            },
          ];
          let dropdownFollow = null;
          for (const { selector, description } of dropdownFollowLocators) {
            try {
              const btn = page.locator(selector).last();
              await btn.waitFor({ state: "visible", timeout: 3000 });
              dropdownFollow = btn;
              console.log(`✅ Found dropdown follow (${description})`);
              break;
            } catch {
              // try next
            }
          }
          if (dropdownFollow) {
            await humanMouse(page, 1);
            await dropdownFollow.click({ delay: 100 });
            console.log(`✅ Followed ${profileName} via More actions dropdown`);
          } else {
            console.log(`⚠️ Follow option not found in dropdown for ${profileName}`);
          }
          await moreButton.click({ delay: 100 });
          await humanDelay('general');
        } else {
          console.log(`⚠️ No More actions button found for ${profileName}`);
        }
      }
    } else {
      console.log(`⏭️ Skipping ${profileName} - Not a 3rd degree connection (Degree: ${degree})`);
    }
    await humanDelay('general');
    console.log(`✅ Done with ${url}`);
    console.log(`----------------------------`);
  } catch (err) {
    console.error(`❌ Error following ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Send Follow Any Action (Enhanced)
--------------------------- */
async function sendFollowAny(page, url) {
  console.log(`🌐 Visiting: ${url} to follow (any degree)`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    let profileName = "Unknown";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page
          .locator(selector)
          .textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(
            `👤 Found profile name: "${profileName}" (via ${selector})`
          );
          break;
        }
      } catch {
        // silent fail
      }
    }
    const followingButtonLocators = [
      {
        selector: 'div[data-view-name="edge-creation-follow-action"] button[aria-label*="Following, click to unfollow"]',
        description: "header edge-creation following button",
      },
      {
        selector: 'div[data-view-name="relationship-building-button"] button[aria-label*="Following, click to unfollow"]',
        description: "relationship-building header following button",
      },
      {
        selector: ".ph5 button[aria-label*='Following']",
        description: "ph5 header following button (scoped to button)",
      },
    ];
    let isAlreadyFollowing = false;
    for (const { selector, description } of followingButtonLocators) {
      try {
        const btn = page.locator(selector).nth(2);
        await btn.waitFor({ state: "visible", timeout: 3000 });
        isAlreadyFollowing = true;
        console.log(`⏭️ Skipping ${profileName} - Already following (detected via ${description})`);
        break;
      } catch {
        // try next
      }
    }
    if (!isAlreadyFollowing) {
      const moreButtonLocatorsTemp = [
        {
          selector: ".ph5 [aria-label='More actions']",
          description: "more actions aria",
        },
        {
          selector: 'button[data-view-name="profile-overflow-button"][aria-label="More"]',
          description: "overflow more button",
        },
        {
          selector: ".ph5.pb5 button:has-text('More')",
          description: "more text button",
        },
      ];
      let moreButtonTemp = null;
      for (const { selector, description } of moreButtonLocatorsTemp) {
        try {
          const btn = page.locator(selector).last();
          await btn.waitFor({ state: "visible", timeout: 3000 });
          moreButtonTemp = btn;
          console.log(`🔍 Temporarily opening more button (${description}) to check dropdown`);
          break;
        } catch {
          // try next
        }
      }
      if (moreButtonTemp) {
        await humanMouse(page, 2);
        await moreButtonTemp.click({ delay: 100 });
        await humanDelay('general');
        const dropdownFollowingLocators = [
          {
            selector: ".artdeco-dropdown__content div[aria-label*='Unfollow']",
            description: "dropdown unfollow div aria-label",
          },
          {
            selector: `div[role="menu"] div[aria-label*="Following, click to unfollow"]`,
            description: "global following aria-label in dropdown",
          },
        ];
        let dropdownFollowing = null;
        for (const { selector, description } of dropdownFollowingLocators) {
          try {
            const elem = page.locator(selector).last();
            await elem.waitFor({ state: "visible", timeout: 2000 });
            dropdownFollowing = elem;
            console.log(`⏭️ Skipping ${profileName} - Already following in dropdown (detected via ${description})`);
            isAlreadyFollowing = true;
            break;
          } catch {
            // try next
          }
        }
        await moreButtonTemp.click({ delay: 100 });
        await humanDelay('general');
      }
    }
    if (!isAlreadyFollowing) {
      const followButtonLocators = [
        {
          selector: ".ph5.pb5 [aria-label*='Follow']",
          description: "header follow button primary / secondary",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "primary-message adjacent relationship follow aria",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
          description: "primary-message adjacent edge-creation follow icon",
        },
        {
          selector: 'a[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
          description: "primary-message adjacent relationship follow text",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-primary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "topcard with primary-message relationship follow aria",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button[aria-label*="Follow"]',
          description: "topcard with secondary-message relationship follow aria",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="edge-creation-follow-action"] button:has(svg[id="add-small"])',
          description: "topcard with secondary-message edge-creation follow icon",
        },
        {
          selector: 'div[componentkey*="Topcard"]:has(a[data-view-name="profile-secondary-message"]) div[data-view-name="relationship-building-button"] button:has(span:has-text("Follow"))',
          description: "topcard with secondary-message relationship follow text",
        },
      ];
      let followButton = null;
      for (const { selector, description } of followButtonLocators) {
        try {
          const btn = page.locator(selector).last();
          await btn.waitFor({ state: "visible", timeout: 3000 });
          followButton = btn;
          console.log(`✅ Found follow button (${description})`);
          break;
        } catch {
          // try next
        }
      }
      if (followButton) {
        await humanMouse(page, 2);
        await followButton.click({ delay: 100 });
        console.log(`✅ Followed ${profileName} via direct button`);
      } else {
        const moreButtonLocators = [
          {
            selector: ".ph5 [aria-label='More actions']",
            description: "more actions aria",
          },
          {
            selector: 'button[data-view-name="profile-overflow-button"][aria-label="More"]',
            description: "overflow more button",
          },
          {
            selector: ".ph5.pb5 button:has-text('More')",
            description: "more text button",
          },
        ];
        let moreButton = null;
        for (const { selector, description } of moreButtonLocators) {
          try {
            const btn = page.locator(selector).last();
            await btn.waitFor({ state: "visible", timeout: 3000 });
            moreButton = btn;
            console.log(`✅ Found more button (${description})`);
            break;
          } catch {
            // try next
          }
        }
        if (moreButton) {
          await humanMouse(page, 2);
          await moreButton.click({ delay: 100 });
          console.log("💡 More button clicked");
          await humanDelay('general');
          const dropdownFollowLocators = [
            {
              selector: ".ph5.pb5 .artdeco-dropdown__content-inner [aria-label*='Follow']",
              description: "dropdown aria follow",
            },
            {
              selector: ".artdeco-dropdown__content-inner span:has-text('Follow')",
              description: "dropdown text follow",
            },
            {
              selector: ".artdeco-dropdown__content a[aria-label*='Follow']",
              description: "dropdown link follow",
            },
            {
              selector: "div[aria-label*='Follow']",
              description: "dropdown area follow",
            },
          ];
          let dropdownFollow = null;
          for (const { selector, description } of dropdownFollowLocators) {
            try {
              const btn = page.locator(selector).last();
              await btn.waitFor({ state: "visible", timeout: 3000 });
              dropdownFollow = btn;
              console.log(`✅ Found dropdown follow (${description})`);
              break;
            } catch {
              // try next
            }
          }
          if (dropdownFollow) {
            await humanMouse(page, 1);
            await dropdownFollow.click({ delay: 100 });
            console.log(`✅ Followed ${profileName} via More actions dropdown`);
          } else {
            console.log(`⚠️ Follow option not found in dropdown for ${profileName}`);
          }
          await moreButton.click({ delay: 100 });
          await humanDelay('general');
        } else {
          console.log(`⚠️ No More actions button found for ${profileName}`);
        }
      }
    }
    await humanDelay('general');
    console.log(`✅ Done with ${url}`);
    console.log(`----------------------------`);
  } catch (err) {
    console.error(`❌ Error following ${url}: ${err.message}`);
  }
}

/* ---------------------------
    Withdraw Request Action (Enhanced)
--------------------------- */
async function withdrawRequest(page, url) {
  console.log(`🌐 Visiting: ${url} to withdraw request`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    let profileName = "Unknown";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page.locator(selector).textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(`👤 Found profile name: "${profileName}" (via ${selector})`);
          break;
        }
      } catch {
        // silent fail
      }
    }
    const headerWithdrawLocators = [
      {
        selector: 'div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-connect-action"] button[aria-label*="Pending, click to withdraw invitation"]',
        description: "relationship-building edge-creation pending aria-label",
      },
      {
        selector: 'div[data-view-name="edge-creation-connect-action"] button:has(svg[id="clock-small"])',
        description: "edge-creation clock icon pending",
      },
      {
        selector: ".ph5 button[aria-label*='Pending, click to withdraw invitation']",
        description: "ph5 pending withdraw aria-label",
      },
      {
        selector: 'div[data-view-name="relationship-building-button"] button:has(span:has-text("Pending"))',
        description: "relationship-building pending text",
      },
      {
        selector: "button[aria-label*='Pending invitation sent to']",
        description: "global pending invitation aria-label",
      },
    ];
    let headerWithdraw = null;
    for (const { selector, description } of headerWithdrawLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        headerWithdraw = btn;
        console.log(`✅ Found header withdraw (${description})`);
        break;
      } catch {
        // try next
      }
    }
    if (headerWithdraw) {
      await humanMouse(page, 2);
      await headerWithdraw.click({ delay: 100 });
      console.log("💡 Header withdraw clicked");
      await humanDelay('withdraw');
    } else {
      const moreButtonLocatorsTemp = [
        {
          selector: ".ph5 [aria-label='More actions']",
          description: "more actions aria",
        },
        {
          selector: 'button[data-view-name="profile-overflow-button"][aria-label="More"]',
          description: "overflow more button",
        },
        {
          selector: ".ph5.pb5 button:has-text('More')",
          description: "more text button",
        },
      ];
      let moreButton = null;
      for (const { selector, description } of moreButtonLocatorsTemp) {
        try {
          const btn = page.locator(selector).last();
          await btn.waitFor({ state: "visible", timeout: 3000 });
          moreButton = btn;
          console.log(`✅ Found more button (${description})`);
          break;
        } catch {
          // try next
        }
      }
      if (moreButton) {
        await humanMouse(page, 2);
        await moreButton.click({ delay: 100 });
        console.log("💡 More button clicked");
        await humanDelay('general');
        const dropdownWithdrawLocators = [
          {
            selector: ".ph5 .artdeco-dropdown__content [aria-label*='Pending, click to withdraw invitation sent to']",
            description: "dropdown pending withdraw aria-label",
          },
          {
            selector: ".artdeco-dropdown__content [aria-label*='Pending invitation sent to']",
            description: "dropdown pending invitation aria-label",
          },
          {
            selector: ".artdeco-dropdown__content button:has(span:has-text('Pending'))",
            description: "dropdown pending text button",
          },
          {
            selector: ".artdeco-dropdown__content button:has(svg[id='clock-small'])",
            description: "dropdown clock icon pending",
          },
        ];
        let dropdownWithdraw = null;
        for (const { selector, description } of dropdownWithdrawLocators) {
          try {
            const btn = page.locator(selector).last();
            await btn.waitFor({ state: "visible", timeout: 3000 });
            dropdownWithdraw = btn;
            console.log(`✅ Found dropdown withdraw (${description})`);
            break;
          } catch {
            // try next
          }
        }
        if (dropdownWithdraw) {
          await humanMouse(page, 1);
          await dropdownWithdraw.click({ delay: 100 });
          console.log("💡 Dropdown withdraw clicked");
          await humanDelay('withdraw');
        } else {
          console.log(`⚠️ No pending/withdraw option found in dropdown for ${profileName}`);
          await moreButton.click({ delay: 100 });
          return;
        }
        await moreButton.click({ delay: 100 });
        await humanDelay('general');
      } else {
        console.log(`⚠️ No More actions button found for ${profileName}`);
        return;
      }
    }
    const withdrawButtonLocators = [
      {
        selector: `div[role='alertdialog'] button:has-text('Withdraw')`,
        description: "dialog withdraw text",
      },
      {
        selector: "dialog button[aria-label*='Withdrawn invitation sent to']",
        description: "dialog withdrawn aria-label",
      },
      {
        selector: 'div[data-view-name="edge-creation-connect-action"] button:has-text("Withdraw")',
        description: "edge-creation withdraw text",
      },
      {
        selector: '[data-testid="dialog"] button:has-text("Withdraw")',
        description: "data-testid dialog withdraw text",
      },
      {
        selector: 'dialog button:has-text("Withdraw")',
        description: "dialog withdraw text",
      },
    ];
    let withdrawButton = null;
    for (const { selector, description } of withdrawButtonLocators) {
      try {
        const btn = page.locator(selector).first();
        await btn.waitFor({ state: "visible", timeout: 5000 });
        withdrawButton = btn;
        console.log(`✅ Found withdraw confirm button (${description})`);
        break;
      } catch {
        // try next
      }
    }
    if (withdrawButton) {
      await humanMouse(page, 1);
      await withdrawButton.click({ delay: 100 });
      console.log(`✅ Withdrawn request for ${profileName}`);
    } else {
      console.log(`⚠️ Withdraw confirm button not found for ${profileName}`);
    }
    await humanDelay('withdraw');
    console.log(`✅ Done with ${url}`);
    console.log(`----------------------------`);
  } catch (err) {
    console.error(`❌ Error withdrawing request for ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Premium Status Check (Enhanced)
--------------------------- */
async function checkPremiumStatus(page) {
  console.log("🔶 Checking LinkedIn premium status...");
  await humanIdle();
  const meBtn = page.locator(`nav button:has-text('Me')`);
  if (!(await meBtn.isVisible({ timeout: 5000 }))) {
    console.log("❌ Me button not found.");
    return false;
  }
  await meBtn.click();
  await humanDelay('general');
  await humanIdle();
  const settings = page.locator('a:has-text("Settings & Privacy")');
  if (!(await settings.first().isVisible({ timeout: 5000 }))) {
    await page.goBack();
    console.log("❌ Settings & Privacy not found.");
    return false;
  }
  await settings.first().click();
  await page.waitForLoadState("domcontentloaded");
  await humanIdle();
  const subscriptions = page.locator(
    'li #premiumManageAccount, li a[href*="premium"]'
  );
  if (!(await subscriptions.first().isVisible({ timeout: 5000 }))) {
    await page.goBack({ times: 2 });
    console.log("❌ Subscriptions section not found (Not Premium).");
    return false;
  }
  await subscriptions.first().click();
  await page.waitForLoadState("domcontentloaded");
  await humanIdle();
  const planLocator = page.locator(
    ".sans-medium.t-bold.t-black.premium-subscription-overview-settings-card__header"
  );
  await humanIdle();
  const isPremium = await planLocator.isVisible().catch(() => false);
  if (isPremium) {
    const plan = await planLocator.innerText().catch(() => "Unknown");
    console.log(`🔶 Premium Plan: ${plan.trim()}`);
  } else {
    console.log("❌ No premium subscription found (Not Premium).");
  }
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
  });
  await humanIdle();
  return isPremium;
}

/* ---------------------------
   Send Message To Profile (No Degree Check) (Enhanced)
--------------------------- */
async function sendMessageToProfile(page, url) {
  console.log(`💬 Processing profile for messaging: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    await closeAllMessageBoxes(page);
    let profileName = "Friend";
    const nameLocators = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        const text = await page
          .locator(selector)
          .textContent({ timeout: 3000 });
        if (text && text.trim()) {
          profileName = text.trim();
          console.log(
            `👤 Found profile name: "${profileName}" (via ${selector})`
          );
          break;
        }
      } catch {
        // silent fail
      }
    }
    const messageButtonLocators = [
      {
        selector: "div.ph5 button:has-text('Message')",
        description: "old message button",
      },
      {
        selector: 'a[data-view-name="profile-primary-message"]',
        description: "primary message button",
      },
      {
        selector: 'a[data-view-name="profile-secondary-message"]',
        description: "secondary message button",
      },
    ];
    let messageButton = null;
    for (const { selector, description } of messageButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        messageButton = btn;
        console.log(`✅ Found message button (${description})`);
        break;
      } catch {
        // try next
      }
    }
    if (!messageButton) {
      console.log(`⛔ No Message button found for ${profileName} (${url})`);
      return;
    }
    await humanMouse(page, 2);
    await messageButton.click({ delay: 100 });
    console.log("💬 Message box opened");
    await humanDelay('general');
    const messageInputSelector = "div.msg-form__contenteditable";
    const messageInput = page.locator(messageInputSelector);
    await messageInput.waitFor({ state: "visible", timeout: 10000 });
    const subjectSelector = "input[placeholder='Subject (optional)']";
    const subjectInput = page.locator(subjectSelector);
    try {
      const subjectVisible = await subjectInput.isVisible({ timeout: 2000 });
      if (subjectVisible) {
        console.log("✏️ Subject field detected — typing subject...");
        await humanType(
          page,
          subjectSelector,
          "Regarding a potential opportunity"
        );
        await humanDelay('general');
        console.log("✅ Subject typed successfully");
      } else {
        console.log("ℹ️ No subject field found — skipping subject step");
      }
    } catch {
      console.log("ℹ️ Subject field not present — continuing to message");
    }
    const message = `Hi ${profileName}, I'd like to connect and discuss potential opportunities. Looking forward to hearing from you!`;
    await humanType(page, messageInputSelector, message);
    console.log("📝 Message typed");
    const sendButtonLocators = [
      {
        selector: "button.msg-form__send-button",
        description: "standard send button",
      },
      {
        selector: "button.msg-form__send-btn",
        description: "circle send button (alt class)",
      },
      {
        selector: "button[type='submit']",
        description: "generic submit button fallback",
      },
      {
        selector: "button.artdeco-button--primary",
        description: "primary artdeco send button",
      },
    ];
    let sendButton = null;
    for (const { selector, description } of sendButtonLocators) {
      try {
        const btn = page.locator(selector).last();
        await btn.waitFor({ state: "visible", timeout: 5000 });
        sendButton = btn;
        console.log(`✅ Found send button (${description})`);
        break;
      } catch {
        // continue
      }
    }
    if (!sendButton) {
      console.log(`⛔ No Send button found for ${profileName} (${url})`);
      return;
    }
    await humanMouse(page, 1);
    await sendButton.click({ delay: 100 });
    console.log(`📨 Message sent to ${profileName}`);
    await humanDelay('general');
    await closeAllMessageBoxes(page);
    console.log(`✅ Finished sending message to ${url}`);
  } catch (err) {
    console.error(`❌ Failed to send message to ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Send Connection Request Action (Enhanced)
--------------------------- */
async function sendConnectionRequest(page, url) {
  console.log(`🌐 Processing profile: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    await closeAllMessageBoxes(page);
    let profileName = "";
    const nameSelectors = [
      "h1",
      'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p',
    ];
    const nameText = await getTextFromSelectors(page, nameSelectors);
    if (nameText) {
      profileName = nameText || "Friend";
      console.log(`👤 Profile name: ${profileName}`);
    } else {
      console.log(`⚠️ Failed to get profile name`);
    }
    const acceptSelectors = [
      ".ph5 [aria-label*='Accept']",
      'button[aria-label^="Accept"][aria-label*="request to connect"]',
    ];
    const acceptButton = await getVisibleLocator(page, acceptSelectors);
    if (acceptButton) {
      console.log(
        `⛔ Skipping profile ${profileName} (${url}) - Pending acceptance`
      );
      return;
    }
    const degree = await detectDegree(page);
    const pendingSelectors = [
      ".ph5 button:has-text('Pending'), .ph5 button:has-text('Withdraw')",
      'button[aria-label^="Pending, click to withdraw invitation"]:has(svg[id="clock-small"])',
    ];
    const pendingWithdrawButton = await getVisibleLocator(
      page,
      pendingSelectors
    );
    if (pendingWithdrawButton) {
      console.log("⚠️ Found Pending/Withdraw button, No Action needed");
      await humanDelay('general');
      return;
    }
    const connectSelectors = [
      ".ph5 button:has-text('Connect')",
      'div[data-view-name="relationship-building-button"] div[data-view-name="edge-creation-connect-action"] a',
      'div[data-view-name="edge-creation-connect-action"] a',
      `[data-view-name="profile-primary-message"] + div[data-view-name="relationship-building-button"] button[aria-label^="Invite"][aria-label*="to connect"]`
    ];
    const connectButton = await getVisibleLocator(page, connectSelectors, true);
    const moreSelectors = [
      ".ph5 [aria-label='More actions']",
      'div[data-view-name="relationship-building-button"] ~ button[data-view-name="profile-overflow-button"][aria-label="More"]',
      'div[data-view-name="relationship-building-button"] + a[data-view-name="profile-secondary-message"] + button[data-view-name="profile-overflow-button"]',
    ];
    const moreButton = await getVisibleLocator(page, moreSelectors);
    const connectOpportunity = connectButton || moreButton;
    if (degree === "1st") {
      console.log(
        `⛔ Skipping connection request to ${profileName} (${url}) - Already connected`
      );
      return;
    }
    if (!connectOpportunity && degree === "unknown") {
      console.log(
        `⛔ Skipping connection request to ${profileName} (${url}) - No connect opportunity`
      );
      return;
    }
    if (degree === "unknown") {
      console.log(`⚠️ Degree unknown, but connect available - proceeding`);
    }
    const sendSelectors = [
      '[role="dialog"] button[aria-label="Send without a note"]',
      'button[aria-label="Send without a note"]',
    ];
    if (connectButton) {
      await humanMouse(page, 2);
      await connectButton.click({ delay: 100 });
      console.log("💡 Connect button clicked");
      try {
        await page.waitForSelector('button[aria-label="Send without a note"]', {
          state: "visible",
          timeout: 30000,
        });
        const sendButton = page
          .locator('button[aria-label="Send without a note"]')
          .first();
        await humanDelay('connection_request');
        await humanMouse(page, 1);
        await sendButton.click({ delay: 100 });
        console.log("✅ Connection request sent");
        await humanDelay('general');
      } catch (e) {
        console.log("⚠️ Send button not found after modal load");
      }
      return;
    }
    if (moreButton) {
      await humanMouse(page, 2);
      await moreButton.click({ delay: 100 });
      console.log("💡 More button clicked");
      await humanDelay('general');
      const dropdownSelectors = [
        ".ph5 .artdeco-dropdown__content-inner span:has-text('Connect')",
        'a[href^="/preload/custom-invite/"]:has(svg[id="connect-small"])',
      ];
      const connectDropdown = await getVisibleLocator(
        page,
        dropdownSelectors,
        true
      );
      if (connectDropdown) {
        await humanMouse(page, 1);
        await connectDropdown.click({ delay: 100 });
        console.log("💡 Connect from dropdown clicked");
        try {
          await page.waitForSelector(
            'button[aria-label="Send without a note"]',
            { state: "visible", timeout: 30000 }
          );
          const sendButton = page
            .locator('button[aria-label="Send without a note"]')
            .first();
          await humanDelay('connection_request');
          await humanMouse(page, 1);
          await sendButton.click({ delay: 100 });
          console.log("✅ Connection request sent");
          await humanDelay('general');
        } catch (e) {
          console.log("⚠️ Send button not found after modal load");
        }
      }
    } else if (degree === "unknown") {
      console.log(
        `⚠️ No connect opportunity despite unknown degree - skipping`
      );
    }
    console.log(`✅ Finished processing ${profileName} (${url})`);
  } catch (err) {
    console.error(
      `❌ Failed to send connection request to ${url}: ${err.message}`
    );
  }
}

/* ---------------------------
   Navigate to Own Profile and Check Verification Status (Enhanced)
--------------------------- */
async function navigateToOwnProfileAndCheckStatus(page) {
  console.log("👤 Navigating to own profile and checking status...");
  try {
    await page
      .waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 })
      .catch(() => console.log("⚠️ Feed not reached, proceeding..."));
    await humanIdle();
    const meSelectors = [
      "button[aria-label='Me']",
      "button[aria-label*='Me']",
      "nav button:has-text('Me')",
    ];
    let meButton = null;
    for (const selector of meSelectors) {
      try {
        meButton = page.locator(selector).first();
        if (await meButton.isVisible({ timeout: 10000 })) {
          console.log(`✅ Found "Me" button with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ "Me" selector ${selector} failed: ${err.message}`);
      }
    }
    if (!meButton) {
      console.log("⚠️ No 'Me' button found, trying alternative...");
      const avatarSelectors = [
        "img.global-nav__me-photo",
        "img[alt*='Profile photo']",
      ];
      for (const selector of avatarSelectors) {
        try {
          const avatar = page.locator(selector).first();
          if (await avatar.isVisible({ timeout: 10000 })) {
            await humanMouse(page, 2);
            await avatar.click({ delay: 100 });
            console.log(`✅ Clicked avatar with selector: ${selector}`);
            meButton = avatar;
            break;
          }
        } catch (err) {
          console.log(`⚠️ Avatar selector ${selector} failed: ${err.message}`);
        }
      }
    }
    if (meButton) {
      await humanMouse(page, 2);
      await meButton.click({ delay: 100 });
      console.log("✅ Opened user menu");
      await humanDelay('general');
    } else {
      throw new Error("Failed to open user menu");
    }
    const viewProfileSelectors = [
      "a:has-text('View profile')",
      "a[href*='/in/']",
    ];
    let viewProfileLink = null;
    for (const selector of viewProfileSelectors) {
      try {
        viewProfileLink = page.locator(selector).first();
        if (await viewProfileLink.isVisible({ timeout: 10000 })) {
          console.log(
            `✅ Found "View profile" link with selector: ${selector}`
          );
          break;
        }
      } catch (err) {
        console.log(
          `⚠️ "View profile" selector ${selector} failed: ${err.message}`
        );
      }
    }
    if (viewProfileLink) {
      await humanMouse(page, 1);
      await viewProfileLink.click({ delay: 100 });
      console.log("✅ Navigated to own profile");
      await humanDelay('general');
    } else {
      throw new Error("Failed to find 'View profile' link");
    }
    await humanIdle();
    let profileName = "Unknown User";
    const nameLocators = [
      "a[aria-label] h1",
      'a[href*="/in/"] h1',
      'div[data-view-name="profile-top-card-verified-badge"] p',
      'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type',
    ];
    for (const selector of nameLocators) {
      try {
        let nameText;
        if (
          selector.includes("a[aria-label] h1") ||
          selector.includes('a[href*="/in/"] h1')
        ) {
          nameText =
            (await page
              .locator(selector)
              .textContent({ timeout: 10000 })
              .then((text) => text.trim())) || "";
        } else {
          nameText =
            (await page
              .locator(selector)
              .textContent({ timeout: 10000 })
              .then((text) => text.trim())) || "";
        }
        if (
          nameText &&
          nameText.length > 0 &&
          !nameText.includes("verifications")
        ) {
          profileName = nameText;
          console.log(
            `✅ Found name with selector: ${selector} - ${profileName}`
          );
          break;
        }
      } catch (err) {
        console.log(`⚠️ Name locator ${selector} failed: ${err.message}`);
      }
    }
    const verifiedSelectors = [
      'svg[data-test-icon="verified-medium"]',
      'svg[aria-label*="verifications"]',
      'div[data-view-name="profile-top-card-verified-badge"] svg',
    ];
    let isVerified = false;
    for (const selector of verifiedSelectors) {
      try {
        if (await page.locator(selector).isVisible({ timeout: 5000 })) {
          isVerified = true;
          console.log(`✅ Found verification badge with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Verified locator ${selector} failed: ${err.message}`);
      }
    }
    console.log(
      `Profile Status for own profile: Name: ${profileName}, Verified: ${
        isVerified ? "Yes" : "No"
      }`
    );
  } catch (err) {
    console.error(
      `❌ Error navigating to own profile or checking status: ${err.message}`
    );
  }
}

/* ---------------------------
    Like Random Post from User's Activity (Enhanced)
--------------------------- */
async function likeRandomUserPost(page, url) {
  console.log(`🌐 Visiting: ${url} to like a random post`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay('profile_view');
    await humanScroll(page, 2);
    const showAllSelectors = [
      'a[aria-label="Show all"]',
      'a:has-text("Show all")',
      '.ph5 a[href*="/recent-activity/all/"]',
      `a[href*="/recent-activity/all/"]:has(span:has-text("Show all"))`,
      `a[href*="/recent-activity/all/"]:has-text("See all activity")`,
      `a[aria-label='Show all']`,
    ];
    const showAllLink = await getVisibleLocator(page, showAllSelectors, false, 10000);
    if (!showAllLink) {
      console.log(`⚠️ "Show all" link not found for ${url}, skipping`);
      return;
    }
    console.log(`🔍 Found "Show all" - clicking to view activity...`);
    await humanMouse(page, 2);
    await showAllLink.click({ delay: 100 });
    await page.waitForURL(/\/recent-activity\/all\/$/, { timeout: 10000 }).catch(() => console.log(`⚠️ Activity URL not reached, proceeding...`));
    await humanDelay('general');
    await humanScroll(page, 3);
    await humanIdle();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => console.log(`⚠️ Network idle not reached, proceeding...`));
    const emptyStateSelectors = [
      { selector: 'div[data-test-id="empty-state"]', textCheck: 'No recent activity' },
      { selector: '.scaffold-layout__empty-state', textCheck: 'No recent activity' },
      { selector: 'p:has-text("No recent activity")', textCheck: 'No recent activity' },
      { selector: '[data-test-id="no-activity"]', textCheck: 'no activity' },
      { selector: 'div:contains("No activity")', textCheck: 'No activity' },
      { selector: '.artdeco-empty-state', textCheck: 'No recent activity' }
    ];
    let isEmpty = false;
    for (const { selector, textCheck } of emptyStateSelectors) {
      try {
        const emptyEl = page.locator(selector);
        if (await emptyEl.isVisible({ timeout: 5000 })) {
          const elText = await emptyEl.textContent({ timeout: 5000 }) || '';
          if (elText.toLowerCase().includes(textCheck.toLowerCase())) {
            console.log(`⚠️ Confirmed empty activity state detected for ${url} using selector: ${selector} (text: "${elText.trim()}"), skipping`);
            isEmpty = true;
            break;
          } else {
            console.log(`ℹ️ Empty state element found (${selector}) but text mismatch (expected: "${textCheck}", got: "${elText.trim()}"), continuing`);
          }
        }
      } catch (err) {
        // Timeout is fine
      }
    }
    if (isEmpty) {
      return;
    }
    const likeSelector = 'button[aria-label*="Like"]';
    const potentialButtons = await page.locator(likeSelector).all();
    console.log(`🔍 Searched selector "${likeSelector}": found ${potentialButtons.length} potential buttons`);
    const visibleUnliked = [];
    let visibleCount = 0;
    let unlikedCount = 0;
    let pressedCount = 0;
    for (const btn of potentialButtons) {
      try {
        if (await btn.isVisible({ timeout: 3000 })) {
          visibleCount++;
          console.log(` - Button ${visibleCount} is visible`);
          const ariaLabel = await btn.getAttribute('aria-label') || '';
          console.log(` Aria-label: "${ariaLabel}"`);
          if (ariaLabel.toLowerCase().includes('like') && !ariaLabel.toLowerCase().includes('unlike')) {
            unlikedCount++;
            console.log(` - Passes label filter (unliked)`);
            const pressed = await btn.getAttribute('aria-pressed');
            console.log(` - Aria-pressed: "${pressed}"`);
            const isActive = await btn.evaluate(el => el.classList && el.classList.contains('react-button__trigger--active'));
            console.log(` - Is active class: ${isActive}`);
            if (pressed !== 'true' && !isActive) {
              visibleUnliked.push(btn);
              console.log(` ✅ Fully unliked and ready`);
            } else {
              pressedCount++;
              console.log(` ❌ Excluded: pressed=${pressed} or active=${isActive}`);
            }
          } else {
            console.log(` ❌ Excluded: contains "unlike" or no "like"`);
          }
        } else {
          console.log(` - Button skipped: not visible`);
        }
      } catch (err) {
        console.log(`⚠️ Visibility/attribute check failed for button: ${err.message}`);
      }
    }
    console.log(`📊 Filter summary: ${potentialButtons.length} total -> ${visibleCount} visible -> ${unlikedCount} unliked by label -> ${visibleUnliked.length} fully unliked (excluded ${pressedCount} pressed/active)`);
    if (visibleUnliked.length === 0) {
      console.log(`⚠️ No unliked like buttons found for ${url}, skipping`);
      const likedSelector = 'button[aria-label*="Unlike"]';
      const likedCount = await page.locator(likedSelector).count();
      console.log(`ℹ️ Debug: Found ${likedCount} already liked ("Unlike") buttons`);
      return;
    }
    const button = visibleUnliked[0];
    console.log(`🎯 Selected first like button of ${visibleUnliked.length} to click`);
    await humanMouse(page, 2);
    await button.scrollIntoViewIfNeeded();
    await humanDelay('general');
    await button.click({ delay: 100 });
    console.log(`👍 Liked first post on ${url}`);
    await humanIdle();
    console.log(`✅ Finished liking post on ${url}`);
    console.log("-------------------------------");
  } catch (err) {
    console.error(`❌ Error liking post on ${url}: ${err.message}`);
  }
}

/* ---------------------------
   Withdraw All Follows (Enhanced)
--------------------------- */
async function withdrawAllFollows(page) {
  console.log("🚫 Starting to withdraw all follow requests...");
  try {
    await page.goto("https://www.linkedin.com/mynetwork/network-manager/people-follow/following/", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("✅ Navigated to Following page");
    await humanDelay('general');
    let previousHeight = 0;
    let loadAttempts = 0;
    const maxLoadAttempts = 10;
    while (loadAttempts < maxLoadAttempts) {
      await humanScroll(page, 2);
      await humanDelay('general');
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        console.log("📜 No more content to load");
        break;
      }
      previousHeight = currentHeight;
      loadAttempts++;
      console.log(`📜 Loaded more content (attempt ${loadAttempts}/${maxLoadAttempts})`);
    }
    const unfollowSelectors = [
      'button[aria-label*="Click to stop following"]',
      'button[aria-label*="Unfollow"]'
    ];
    let unfollowButtons = [];
    for (const selector of unfollowSelectors) {
      try {
        unfollowButtons = await page.locator(selector).all();
        if (unfollowButtons.length > 0) {
          console.log(`✅ Found ${unfollowButtons.length} unfollow buttons using: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Unfollow selector failed: ${selector} - ${err.message}`);
      }
    }
    if (unfollowButtons.length === 0) {
      console.log("⚠️ No unfollow buttons found on the page");
      return;
    }
    console.log(`🔄 Unfollowing ${unfollowButtons.length} people one by one...`);
    for (let i = 0; i < unfollowButtons.length; i++) {
      const button = unfollowButtons[i];
      try {
        if (!(await button.isVisible({ timeout: 3000 }))) {
          console.log(`⚠️ Button ${i + 1} no longer visible (skipped)`);
          continue;
        }
        await button.scrollIntoViewIfNeeded();
        await humanMouse(page, 1);
        await button.click({ delay: 100 });
        console.log(`💥 Unfollow initiated for person ${i + 1}/${unfollowButtons.length}`);
        const confirmSelectors = [
          '[data-test-modal] button[data-test-dialog-primary-btn]',
          'div[role="dialog"] button:has-text("Unfollow")',
          'button[data-test-dialog-primary-btn]:has-text("Unfollow")'
        ];
        let confirmButton = null;
        for (const sel of confirmSelectors) {
          try {
            confirmButton = page.locator(sel).first();
            if (await confirmButton.isVisible({ timeout: 5000 })) {
              console.log(`✅ Using confirm selector: ${sel}`);
              break;
            }
          } catch (err) {
            // Silently skip
          }
        }
        if (confirmButton) {
          await humanMouse(page, 1);
          await confirmButton.click({ delay: 100 });
          console.log(`✅ Confirmed unfollow for person ${i + 1}`);
        } else {
          console.log(`⚠️ Confirm button not found for person ${i + 1}, skipping confirmation`);
        }
        const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5s, but use humanDelay for variety
        await humanDelay('withdraw'); // Use withdraw dist for inter-action
      } catch (err) {
        console.log(`⚠️ Failed to unfollow person ${i + 1}: ${err.message}`);
        await humanDelay('general');
      }
    }
    console.log("✅ Finished withdrawing all follows");
    await humanIdle();
  } catch (err) {
    console.error("❌ Failed to withdraw follows:", err.message);
  }
}

/* ---------------------------
   Withdraw All Sent Connection Requests (Enhanced)
--------------------------- */
async function withdrawAllSentRequests(page) {
  console.log("🚫 Starting to withdraw all sent connection requests...");
  try {
    await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("✅ Navigated to Sent Invitations page");
    await humanDelay('general');
    const sentTabSelectors = [
      'button[aria-current="true"]:has-text("Sent")',
      'button:has-text("Sent")'
    ];
    const sentTab = await getVisibleLocator(page, sentTabSelectors);
    if (sentTab && !(await sentTab.getAttribute('aria-current') === 'true')) {
      await sentTab.click({ delay: 100 });
      await humanDelay('general');
    }
    let previousHeight = 0;
    let loadAttempts = 0;
    const maxLoadAttempts = 15;
    while (loadAttempts < maxLoadAttempts) {
      const loadMoreButton = page.locator('button:has-text("Load more")').first();
      if (await loadMoreButton.isVisible({ timeout: 3000 })) {
        await loadMoreButton.click({ delay: 100 });
        console.log("📜 Clicked 'Load more'");
        await humanDelay('general');
      }
      await humanScroll(page, 2);
      await humanDelay('general');
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        console.log("📜 No more content to load");
        break;
      }
      previousHeight = currentHeight;
      loadAttempts++;
      console.log(`📜 Loaded more content (attempt ${loadAttempts}/${maxLoadAttempts})`);
    }
    const withdrawSelectors = [
      'button[data-view-name="sent-invitations-withdraw-single"]:has-text("Withdraw")',
      'button:has-text("Withdraw")'
    ];
    let withdrawButtons = [];
    for (const selector of withdrawSelectors) {
      try {
        withdrawButtons = await page.locator(selector).all();
        if (withdrawButtons.length > 0) {
          console.log(`✅ Found ${withdrawButtons.length} withdraw buttons using: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Withdraw selector failed: ${selector} - ${err.message}`);
      }
    }
    if (withdrawButtons.length === 0) {
      console.log("⚠️ No withdraw buttons found on the page");
      return;
    }
    console.log(`🔄 Withdrawing ${withdrawButtons.length} requests one by one...`);
    for (let i = 0; i < withdrawButtons.length; i++) {
      const button = withdrawButtons[i];
      try {
        if (!(await button.isVisible({ timeout: 3000 }))) {
          console.log(`⚠️ Button ${i + 1} no longer visible (skipped)`);
          continue;
        }
        await button.scrollIntoViewIfNeeded();
        await humanMouse(page, 1);
        await button.click({ delay: 100 });
        console.log(`💥 Withdraw initiated for request ${i + 1}/${withdrawButtons.length}`);
        const confirmSelectors = [
          'button[aria-label^="Withdrawn invitation sent to"]',
          'button:has-text("Withdraw")',
          'div[role="dialog"] button:not([aria-label*="Cancel"]):has-text("Withdraw")'
        ];
        let confirmButton = null;
        for (const sel of confirmSelectors) {
          try {
            confirmButton = page.locator(sel).first();
            if (await confirmButton.isVisible({ timeout: 5000 })) {
              console.log(`✅ Using confirm selector: ${sel}`);
              break;
            }
          } catch (err) {
            // Silently skip
          }
        }
        if (confirmButton) {
          await humanMouse(page, 1);
          await confirmButton.click({ delay: 100 });
          console.log(`✅ Confirmed withdraw for request ${i + 1}`);
          await humanDelay('general');
        } else {
          console.log(`⚠️ Confirm button not found for request ${i + 1}, skipping confirmation`);
        }
        await humanDelay('withdraw'); // Longer for invites
      } catch (err) {
        console.log(`⚠️ Failed to withdraw request ${i + 1}: ${err.message}`);
        await humanDelay('general');
      }
    }
    console.log("✅ Finished withdrawing all sent requests");
    await humanIdle();
  } catch (err) {
    console.error("❌ Failed to withdraw sent requests:", err.message);
  }
}

/* ---------------------------
   Post Impressions Action (Enhanced)
--------------------------- */
async function checkPostImpressions(page) {
  console.log("📊 Starting to check Post Impressions / Creator Analytics...");
  await page
    .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await humanIdle();
  const postImpressions = page
    .locator(
      `.scaffold-layout__sticky-content [aria-label*='Side Bar'] span:has-text('Post impressions')`
    )
    .first();
  if (await postImpressions.count()) {
    await postImpressions.click().catch(() => {});
  }
  const viewAllAnalytics = page
    .locator(`.scaffold-layout__sticky-content [aria-label*='Side Bar'] span:has-text('View all analytics')`)
    .first();
  if (await viewAllAnalytics.count()) {
    await viewAllAnalytics.click().catch(() => {});
    await humanDelay('general');
    await page.locator(`.pcd-analytic-view-items-container [href*='https://www.linkedin.com/analytics/creator/content']`).first().click().catch(() => {});
  }
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  console.log("Opened Post Impressions / Creator Analytics");
  await humanIdle();
  const filterBtn = page.locator(
    "div[class='artdeco-card'] .analytics-libra-analytics-filter-group"
  );
  await filterBtn
    .first()
    .click()
    .catch(() => {});
  await humanDelay('general');
  const timeFilter = page.locator(
    `label[for='timeRange-past_28_days'] p[class='display-flex']`
  );
  if (await timeFilter.count()) {
    await timeFilter
      .first()
      .click()
      .catch(() => {});
    console.log("Set time filter to Past 28 days");
    await humanIdle();
  }
  const applyBtn = page.locator(
    `div[id*='artdeco-hoverable-artdeco-gen'] div[class='artdeco-hoverable-content__content'] button[aria-label='This button will apply your selected item']`
  );
  if (await applyBtn.count()) {
    await applyBtn
      .first()
      .click()
      .catch(() => {});
    console.log("Applied filter");
    await humanIdle();
  }
  const { impressions, membersReached } = await page.evaluate(() => {
    const impressions = document
      .querySelector(
        ".member-analytics-addon-summary__list-item:nth-of-type(1) .text-body-medium-bold"
      )
      ?.innerText.trim();
    const membersReached = document
      .querySelector(
        ".member-analytics-addon-summary__list-item:nth-of-type(2) .text-body-medium-bold"
      )
      ?.innerText.trim();
    return { impressions, membersReached };
  });
  console.log("Impressions:", impressions);
  console.log("Members reached:", membersReached);
  await humanIdle();
  await filterBtn
    .last()
    .click()
    .catch(() => {});
  await humanDelay('general');
  await page
    .locator(`label[for='metricType-ENGAGEMENTS']`)
    .first()
    .click()
    .catch(() => {});
  await humanDelay('general');
  await page
    .locator(
      "div[id*='artdeco-hoverable-artdeco-gen'] button[aria-label='This button will apply your selected item']"
    )
    .nth(1)
    .click()
    .catch(() => {});
  await humanDelay('general');
  await page.waitForSelector(
    "section.artdeco-card.member-analytics-addon-card__base-card",
    { timeout: 15000 }
  );
  await page.waitForTimeout(3000);
  const metrics = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll(".member-analytics-addon__cta-list-item")
    );
    const getTextByTitle = (title) => {
      const item = items.find(
        (li) =>
          li
            .querySelector(".member-analytics-addon__cta-list-item-title")
            ?.innerText.trim() === title
      );
      return item
        ?.querySelector(
          ".member-analytics-addon__cta-list-item-count-container .member-analytics-addon__cta-list-item-text"
        )
        ?.innerText.trim();
    };
    return {
      reactions: getTextByTitle("Reactions"),
      comments: getTextByTitle("Comments"),
      reposts: getTextByTitle("Reposts"),
      saves: getTextByTitle("Saves"),
      sendsOnLinkedIn: getTextByTitle("Sends on LinkedIn"),
    };
  });
  console.log(`Reactions: ${metrics.reactions}`);
  console.log(`Comments: ${metrics.comments}`);
  console.log(`Reposts: ${metrics.reposts}`);
  console.log(`Saves: ${metrics.saves}`);
  console.log(`Sends on LinkedIn: ${metrics.sendsOnLinkedIn}`);
  await humanIdle();
  console.log("✅ Finished checking Post Impressions / Creator Analytics");
}

/* ---------------------------
   Scrape Connections Action (Enhanced)
--------------------------- */
async function scrapeConnections(page) {
  console.log("🔎 Scraping first 20 connections...");
  await page
    .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await humanIdle();
  console.log("Navigating to My Network -> Connections...");
  const myNetwork = `nav li [href*='https://www.linkedin.com/mynetwork']`;
  await page
    .locator(myNetwork)
    .click()
    .catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await humanIdle();
  await page.locator(`nav ul [aria-label*='connections']`).first().click();
  await humanIdle();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await humanDelay('general');
  await page.waitForSelector('a[data-view-name="connections-profile"]', {
    timeout: 10000,
  });
  const allConnections = await page.$$eval(
    'a[data-view-name="connections-profile"]',
    (els) =>
      els
        .map((el) => {
          const nameEl = el.querySelector("p a");
          const name = nameEl ? nameEl.innerText.trim() : null;
          const url = el.href;
          return { name, url };
        })
        .filter((c) => c.name && c.url)
  );
  const first20Connections = allConnections.slice(0, 20);
  first20Connections.forEach(({ name, url }, idx) => {
    console.log(`${idx + 1}. ${name} : ${url}`);
    console.log("-------------------------------");
  });
  console.log(`\n✅ Total connections scraped: ${allConnections.length}`);
  return first20Connections;
}

/* ---------------------------
   Grab Profile Image (Enhanced)
--------------------------- */
async function grabProfileImage(page) {
  console.log("👤 Grabbing profile image...");
  await page
    .goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 })
    .catch(() => {});
  await humanIdle();
  await page.locator(`img.global-nav__me-photo, img[alt*="Profile photo"], figure[data-view-name="image"] img`).first().click().catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await humanIdle();
  await page.locator(`a:has-text('View profile'), a[href*='/in/']`).first().click().catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await humanIdle();
  const nameLocators = [
    { selector: "h1", description: "h1 tag" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] div[role="button"] > div > p', description: "verified badge button p" },
    { selector: "a[aria-label] h1", description: "aria-label a h1" },
    { selector: 'a[href*="/in/"] h1', description: "in href a h1" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] p', description: "verified badge p" },
    { selector: 'div[data-view-name="profile-top-card-verified-badge"] p:first-of-type', description: "verified badge first p" },
  ];
  let nameText = await getTextFromSelectors(page, nameLocators.map(loc => loc.selector), 10000);
  if (!nameText) {
    console.log("⚠️ No name found with provided locators");
    nameText = "Unknown";
  } else {
    console.log("Profile Name:", nameText);
  }
  const combinedProfileImageSelector = [
    'img.profile-photo-edit__preview',
    '.pv-top-card__edit-photo img',
    '.profile-photo-edit.pv-top-card__edit-photo img',
    '[data-view-name="profile-top-card-member-photo"] img',
    'figure[data-view-name="image"] img',
    'img[data-loaded="true"]'
  ].join(', ');
  const profileImage = page.locator(combinedProfileImageSelector).first();
  await profileImage.waitFor({ state: "visible", timeout: 20000 }).catch(() => console.log("⚠️ Profile image not found or timed out"));
  let imageUrl = await profileImage.getAttribute("src");
  if (!imageUrl) {
    console.log("⚠️ No image URL found with src attribute");
    imageUrl = null;
  } else {
    console.log("Profile Image URL:", imageUrl);
  }
  return { name: nameText, imageUrl };
};

/* ---------------------------
   Main Test - Perform Action (Enhanced loops)
--------------------------- */
test.describe("LinkedIn Multi-Action Script", () => {
  let browser, context, page;
  test.beforeAll(async () => {
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
    }
    if (!PROFILE_URLS.length) console.log("⚠️ No PROFILE_URLS provided.");
    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });
    const storageState =
      fs.existsSync(STORAGE_FILE) &&
      fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
        ? STORAGE_FILE
        : undefined;
    context = await browser.newContext({
      viewport: null,
      locale: "en-US",
      timezoneId: "Asia/Kolkata",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      storageState,
    });
    page = await context.newPage();
    await addStealth(page);
    try {
      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await humanMouse(page, 3);
      await humanIdle();
      if (await page.locator("#username").isVisible({ timeout: 5000 })) {
        console.log("🔐 Logging in...");
        await humanType(page, "#username", process.env.LINKEDIN_EMAIL);
        await humanIdle();
        await humanType(page, "#password", process.env.LINKEDIN_PASSWORD);
        await humanIdle();
        await page
          .locator(`label[for='rememberMeOptIn-checkbox']`)
          .click()
          .catch(() =>
            console.log("Remember Me checkbox not found, skipping.")
          );
        await humanIdle();
        await page.locator('button[type="submit"]').click();
        await humanDelay('general');
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
          await humanType(page, 'input[name="pin"][maxlength="6"]', token);
          await humanDelay('general');
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
  test("Perform Action", async () => {
    test.setTimeout(20 * 60 * 1000); // 20 minutes
    console.log(
      `🔍 Performing action: ${ACTION} on ${PROFILE_URLS.length} profiles...`
    );
    console.log("-------------------------------");
    const actions = {
      view_feed: viewFeed,
      like_feed: likeFeed,
      check_degree: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await checkDegree(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('profile_view');
        }
      },
      send_message: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await sendMessage(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('message_after_connect');
        }
      },
      send_connection_request: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await sendConnectionRequest(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('connection_request');
        }
      },
      check_connection_accepted: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await checkConnectionAccepted(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('profile_view');
        }
      },
      check_reply: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await checkReply(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('general');
        }
      },
      grab_replies: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await grabReplies(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('general');
        }
      },
      send_follow: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await sendFollow(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('general');
        }
      },
      send_follow_any: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await sendFollowAny(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('general');
        }
      },
      withdraw_request: async () => {
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await withdrawRequest(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('withdraw');
        }
      },
      check_own_verification: navigateToOwnProfileAndCheckStatus,
      send_message_premium: async () => {
        const isPremiumUser = await checkPremiumStatus(page);
        if (isPremiumUser && PROFILE_URLS.length > 0) {
          console.log(
            `💬 Premium user detected. Sending messages to ${PROFILE_URLS.length} profiles...`
          );
          for (let i = 0; i < PROFILE_URLS.length; i++) {
            await sendMessageToProfile(page, PROFILE_URLS[i]);
            if (i < PROFILE_URLS.length - 1) await humanDelay('message_after_connect');
          }
        } else if (!isPremiumUser) {
          console.log("⛔ Not a premium user. Skipping message sending.");
        } else {
          console.log("⚠️ No PROFILE_URLS provided. Skipping message sending.");
        }
      },
      like_user_post: async () => {
        console.log(`👍 Liking random posts on ${PROFILE_URLS.length} user profiles...`);
        for (let i = 0; i < PROFILE_URLS.length; i++) {
          await likeRandomUserPost(page, PROFILE_URLS[i]);
          if (i < PROFILE_URLS.length - 1) await humanDelay('general');
        }
      },
      withdraw_all_follows: withdrawAllFollows,
      withdraw_all_sent_requests: withdrawAllSentRequests,
      check_post_impressions: checkPostImpressions,
      scrape_connections: scrapeConnections,
      grab_profile_image: grabProfileImage,
    };
    const actionFunc = actions[ACTION];
    if (actionFunc) await actionFunc(page);
    else
      console.log(
        `⚠️ Unknown action: ${ACTION}. Available actions: ${Object.keys(
          actions
        ).join(", ")}`
      );
    await expect(page).toHaveURL(/linkedin\.com/);
  });
});