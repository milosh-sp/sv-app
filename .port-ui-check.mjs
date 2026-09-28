import { readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const base = "http://host.docker.internal:3000";
const token = (jar) =>
  readFileSync(jar, "utf8")
    .split("\n")
    .find((l) => l.includes("better-auth.session_token"))
    .split("\t")
    .at(-1);

const browser = await puppeteer.connect({ browserWSEndpoint: "ws://localhost:4000?token=1234567890&timeout=240000" });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => ["error", "warn"].includes(m.type()) && errors.push(`console ${m.type()}: ${m.text().slice(0, 300)}`));
page.on("response", (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));
page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

await browser.setCookie({
  name: "better-auth.session_token",
  value: token("/tmp/pt-company.jar"),
  domain: "host.docker.internal",
  path: "/",
  httpOnly: true,
});

const step = (s) => console.log(`- ${s}`);
const waitText = (text, timeout = 90_000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
const clickButton = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((el) => el.innerText.trim() === t && !el.disabled);
    if (!b) throw new Error(`button not found: ${t}`);
    b.click();
  }, text);

await page.goto(`${base}/dashboard/company/saved`, { waitUntil: "networkidle2" });

await page.goto(`${base}/dashboard`, { waitUntil: "networkidle2" });
step(`dashboard redirected to ${new URL(page.url()).pathname}`);
await new Promise((r) => setTimeout(r, 3000));
console.log("early errors:", errors.filter((e) => !e.includes("WebSocket") && !e.includes("manifest")).join("\n"));

await page.evaluate(() => localStorage.removeItem("company-match-state"));
await page.reload({ waitUntil: "networkidle2" });
for (let attempt = 0; attempt < 20; attempt++) {
  await page.$eval("#job-description", (el) => el.select());
  await page.type("#job-description", "Senior React and TypeScript engineer to build a SaaS dashboard with TanStack.");
  if (await page.evaluate(() => localStorage.getItem("company-match-state"))) break;
  await new Promise((r) => setTimeout(r, 1000));
}
await new Promise((r) => setTimeout(r, 500));
console.log("textarea:", JSON.stringify(await page.$eval("#job-description", (el) => el.value)), "stored:", await page.evaluate(() => localStorage.getItem("company-match-state")));
await page.screenshot({ path: "/tmp/company-debug.png" });
await clickButton("Find matches");
await waitText("View profile");
step("match results rendered");
await page.screenshot({ path: "/tmp/company-match.png" });

await page.reload({ waitUntil: "networkidle2" });
await waitText("View profile", 15_000);
step("results restored from localStorage after reload");

await clickButton("View profile");
await waitText("Match score:");
step("detail sheet opened");
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "/tmp/company-sheet.png" });

const favState = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].map((b) => `${b.innerText.trim()}=${b.getAttribute("aria-pressed")}`),
  );
step(`sheet toggles before: ${await favState()}`);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[role="dialog"] button')].find((el) => el.innerText.trim() === "Favorite");
  b.click();
});
await new Promise((r) => setTimeout(r, 1500));
step(`sheet toggles after: ${await favState()}`);

await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 800));
step(`sheet closed: ${!(await page.$('[role="dialog"]'))}`);

await page.goto(`${base}/dashboard/company/saved`, { waitUntil: "networkidle2" });
await waitText("View profile", 15_000);
step("saved page lists the favorited candidate");
await page.screenshot({ path: "/tmp/company-saved.png" });

await page.goto(`${base}/dashboard/company/contacts`, { waitUntil: "networkidle2" });
await waitText("Port Test cand", 15_000);
step("contact history lists the accepted request with email");
await page.type('input[aria-label="Search by candidate name"]', "zzz");
await waitText("No contact requests yet.", 15_000);
step(`search filter works, url: ${new URL(page.url()).search}`);
await page.screenshot({ path: "/tmp/company-contacts.png" });

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
await page.close();
await browser.disconnect();
