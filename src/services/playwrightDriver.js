import { chromium } from "playwright";
import config from "../config.js";
import { getSessionCookies, deactivateSession } from "./supabaseSession.js";

/* ────────────────────────────────────────────────────────
   Helper: human-like delays & mouse movement
   ──────────────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function humanType(page, selector, text) {
  const el = typeof selector === "string" ? page.locator(selector) : selector;
  await el.click();
  // Clear existing value
  await el.fill("");
  for (const ch of text.toString()) {
    await el.type(ch, { delay: 200 });
  }
}

async function humanClick(page, locator) {
  const box = await locator.boundingBox();
  if (box) {
    // Move mouse to the centre of the element first
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2,
      { steps: 10 }
    );
    await sleep(150);
  }
  await locator.click();
}

/* ────────────────────────────────────────────────────────
   Main driver: navigate → fill income → screenshot → (optionally) save
   ──────────────────────────────────────────────────────── */

/**
 * @param {object} opts
 * @param {number} opts.telegramUserId
 * @param {number} opts.newIncome
 * @returns {{ previousIncome: number|null, screenshotBase64: string, page, context, browser }}
 */
export async function fillIncomeForm({ telegramUserId, newIncome }) {
  // 1. Retrieve session cookies from Supabase
  const cookies = await getSessionCookies(telegramUserId);
  if (!cookies) {
    throw new Error(
      "No active idMe session found. Please log in via the Chrome Extension and sync your cookies."
    );
  }

  // 2. Launch browser
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // 3. Navigate to dashboard
    console.log("[playwright] navigating to dashboard …");
    await page.goto(`${config.idmeBaseUrl}/dashboard`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    // 4. Click through: Aplikasi → Pengurusan Awam → Pengurusan Profil
    console.log("[playwright] navigating menus …");

    const aplikasiLink = page.locator("text=Aplikasi").first();
    await humanClick(page, aplikasiLink);
    await sleep(800);

    const pengurusanAwamLink = page.locator("text=Pengurusan Awam").first();
    await humanClick(page, pengurusanAwamLink);
    await sleep(800);

    const pengurusanProfilLink = page.locator("text=Pengurusan Profil").first();
    await humanClick(page, pengurusanProfilLink);
    await sleep(1200);

    // 5. Ensure we're on the Maklumat Peribadi tab
    const peribadTab = page.locator("text=Maklumat Peribadi").first();
    await humanClick(page, peribadTab);
    await sleep(1000);

    // 6. Locate the Pendapatan field (resilient selector)
    console.log("[playwright] locating Pendapatan field …");
    const pendapatanInput =
      page.getByLabel("Pendapatan").first() ??
      page.locator('input[name*="pendapatan" i]').first() ??
      page.locator('input[name*="income" i]').first();

    await pendapatanInput.scrollIntoViewIfNeeded();
    await sleep(500);

    // 7. Read existing value (audit trail)
    const previousIncome = await pendapatanInput.inputValue().catch(() => null);
    console.log("[playwright] previous income:", previousIncome);

    // 8. Type new income with human-like delays
    await humanType(page, pendapatanInput, newIncome);
    await sleep(400);

    // 9. Screenshot BEFORE clicking Simpan
    console.log("[playwright] taking pre-save screenshot …");
    const screenshotBuffer = await page.screenshot({ fullPage: false });
    const screenshotBase64 = screenshotBuffer.toString("base64");

    return {
      previousIncome: previousIncome ? Number(previousIncome) : null,
      screenshotBase64,
      page,
      context,
      browser,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

/**
 * Click the "Simpan" (Save) button on the already-open page.
 */
export async function clickSimpan(page) {
  const simpanBtn =
    page.getByRole("button", { name: /simpan/i }).first() ??
    page.locator("button:has-text('Simpan')").first();

  await humanClick(page, simpanBtn);
  // Wait for navigation / success toast
  await page.waitForTimeout(3000);
  console.log("[playwright] Simpan clicked.");
}

/**
 * Gracefully close every Playwright resource.
 */
export async function closeBrowser(browser) {
  try {
    await browser.close();
  } catch {
    /* already closed */
  }
}
