import { createRequire } from "node:module";
const require = createRequire("/home/baldur/projects/ewolucja-dewelopera/kraftowy-cal-06-02/package.json");
const { chromium } = require("@playwright/test");
const OUT = "/home/baldur/projects/ewolucja-dewelopera/kraftowy-cal-06-02/docs/booking-private-notes/screenshots";
const BASE = "http://localhost:3010";
const log = (...a) => console.log(...a);

async function run(name, ctxOpts) {
  const browser = await chromium.launch({ executablePath: "/home/baldur/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await browser.newContext({ timezoneId: "Europe/London", ...ctxOpts });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${BASE}/auth/login`);
  await page.fill('input[name="email"]', "pro@example.com");
  await page.fill('input[name="password"]', "pro");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(event-types|getting-started|bookings)/, { timeout: 120000 });
  await page.goto(`${BASE}/bookings/upcoming`);
  await page.waitForSelector('[data-testid="booking-item"], [data-testid^="booking"]', { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${name}-00-list.png` });
  const item = page.locator('[data-testid="booking-item"]').first();
  await item.waitFor({ timeout: 120000 }); await page.getByText("30min", { exact: true }).first().click({ timeout: 30000 });
  await page.waitForSelector('[data-testid="booking-private-note"]', { timeout: 60000 });
  const sec = page.getByTestId("booking-private-note");
  await sec.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${name}-01-empty.png` });
  await page.getByTestId("private-note-add").click();
  await page.getByTestId("private-note-input").fill("Zadzwonić do klienta przed spotkaniem.\nPrzygotować <b>ofertę</b>.");
  await page.screenshot({ path: `${OUT}/${name}-02-editing.png` });
  await page.getByTestId("private-note-save").click();
  await page.getByTestId("private-note-text").waitFor();
  await page.screenshot({ path: `${OUT}/${name}-03-saved.png` });
  // reload and reopen
  await page.reload();
  await page.waitForTimeout(3000);
  if (!(await page.getByTestId("private-note-text").isVisible().catch(() => false))) {
    await page.getByText("30min", { exact: true }).first().click({ timeout: 30000 }).catch(() => {});
  }
  await page.getByTestId("private-note-text").waitFor({ timeout: 60000 });
  log(name, "after reload:", JSON.stringify(await page.getByTestId("private-note-text").innerText()));
  await page.getByTestId("booking-private-note").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${name}-04-reopened.png` });
  // edit
  await page.getByTestId("private-note-edit").click();
  await page.getByTestId("private-note-input").fill("Zmieniona treść notatki");
  await page.getByTestId("private-note-save").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="private-note-text"]')?.textContent === "Zmieniona treść notatki");
  await page.screenshot({ path: `${OUT}/${name}-05-edited.png` });
  // delete
  await page.getByTestId("private-note-delete").click();
  await page.screenshot({ path: `${OUT}/${name}-06-confirm-delete.png` });
  await page.getByTestId("private-note-delete-confirm").click();
  await page.getByTestId("private-note-add").waitFor();
  await page.screenshot({ path: `${OUT}/${name}-07-deleted.png` });
  // validation: too long
  await page.getByTestId("private-note-add").click();
  await page.getByTestId("private-note-input").fill("x".repeat(5001));
  log(name, "save disabled at 5001:", await page.getByTestId("private-note-save").isDisabled());
  await page.screenshot({ path: `${OUT}/${name}-08-too-long.png` });
  await page.getByTestId("private-note-input").fill("Notatka końcowa (zostaje w bazie)");
  await page.getByTestId("private-note-save").click();
  await page.getByTestId("private-note-text").waitFor();
  await browser.close();
}
const mode = process.argv[2];
if (mode === "desktop") await run("desktop", { viewport: { width: 1440, height: 900 } });
else await run("mobile", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
