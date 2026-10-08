import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

// The status once a run (not a preview) is complete, e.g. "400 simulations · 0.2 s"
const done = (sim) => sim.locator(".status").filter({ hasText: /^\s*[\d,]+ simulations · [\d.]+ s\s*$/ });

test("school: results on load, search a school, results update", async ({ page }) => {
  await page.goto("/");
  const sim = page.locator("measles-school-sim");
  await expect(sim.locator("md-results-panel .tile")).toHaveCount(3, { timeout: 60000 });
  await expect(done(sim)).toBeVisible();

  await sim.locator("md-school-selector select").first().selectOption("UT");
  const search = sim.getByRole("combobox", { name: "Search schools" });
  await search.fill("young intermediate");
  const option = sim.getByRole("listbox", { name: "Schools" }).getByRole("option").first();
  await expect(option).toContainText("Adele C. Young Intermediate");
  const percent = Number((await option.locator(".rate").textContent()).replace("%", ""));
  await search.press("ArrowDown");
  await search.press("Enter");

  await expect(sim.locator(".chip")).toContainText("Adele C. Young Intermediate");
  await expect(sim.getByRole("spinbutton", { name: "Vaccinated (%)" })).toHaveValue(String(percent));
  await expect(sim.locator(".lede")).toContainText("Adele C. Young Intermediate");
  await expect(sim.locator(".lede")).toContainText(`${percent}% vaccinated`);
  await expect(sim.getByText("Enrollment isn't available")).toBeVisible();
  await expect(done(sim)).toBeVisible({ timeout: 30000 });

  await sim.getByRole("button", { name: "Show table" }).click();
  await expect(sim.locator("md-results-panel tbody tr")).toHaveCount(5);

  const download = page.waitForEvent("download");
  await sim.getByRole("button", { name: /Download simulations/ }).click();
  const stream = await (await download).createReadStream();
  const text = await new Promise((resolve) => { let s = ""; stream.on("data", (d) => { s += d; }); stream.on("end", () => resolve(s)); });
  expect(text.split("\n")[0]).toBe("sim_num,quarantine,outbreak_size,hospitalizations");
  expect(text.trim().split("\n")).toHaveLength(1 + 2 * 200);
});

test("school: changing an input re-runs; invalid input pauses runs", async ({ page }) => {
  await page.goto("/");
  const sim = page.locator("measles-school-sim");
  await expect(done(sim)).toBeVisible({ timeout: 60000 });
  const before = await sim.locator(".tile").first().locator(".big").textContent();

  const vaccinated = sim.getByRole("spinbutton", { name: "Vaccinated (%)" });
  await vaccinated.fill("40");
  await vaccinated.blur();
  await expect(sim.getByRole("button", { name: "Reset Vaccinated to default" })).toBeVisible();
  await expect(sim.locator(".tile").first().locator(".big")).not.toHaveText(before, { timeout: 30000 });

  const students = sim.getByRole("spinbutton", { name: "Students" });
  await students.fill("0");
  await students.blur();
  await expect(sim.getByRole("alert").filter({ hasText: "Students must be at least 1" })).toBeVisible();
  await expect(sim.locator(".status")).toHaveText(/Check the inputs/);
});

test("community: preview, then full results; editing the population re-runs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Community" }).click();
  const sim = page.locator("measles-mixing-sim");
  await expect(sim.locator(".status")).toContainText("quick preview", { timeout: 60000 });
  await expect(done(sim)).toBeVisible({ timeout: 120000 });
  await expect(sim.locator(".status")).toContainText("400 simulations");

  await sim.getByRole("button", { name: "+ Add group" }).click();
  await expect(sim.locator("md-group-editor tbody tr")).toHaveCount(4);
  await sim.getByLabel("Size of Group 4").fill("2000");
  await sim.getByLabel("Size of Group 4").blur();
  await expect(sim.getByText("Total population: 11,000")).toBeVisible();
  await expect(sim.locator(".lede")).toContainText("11,000");
  await expect(done(sim)).toBeVisible({ timeout: 120000 });
});

test("embedding: host styles, events, and manual mode", async ({ page }) => {
  await page.goto("/embed.html");
  const sim = page.locator("#sim");
  await expect(page.locator("#log")).toContainText("md-run-complete", { timeout: 60000 });
  await expect(sim.locator("footer.ack a").first()).toHaveCSS("color", "rgb(29, 79, 58)");

  await page.evaluate(() => {
    const el = document.createElement("measles-school-sim");
    el.id = "manual";
    el.setAttribute("manual", "");
    el.setAttribute("hide-description", "");
    document.body.append(el);
  });
  const manual = page.locator("#manual");
  await expect(done(manual)).toBeVisible({ timeout: 60000 }); // first run happens on load
  const students = manual.getByRole("spinbutton", { name: "Students" });
  await students.fill("800");
  await students.blur();
  await expect(manual.locator(".status")).toHaveText(/press Run/);
  await manual.getByRole("button", { name: "Run simulation" }).click();
  await expect(done(manual)).toBeVisible({ timeout: 60000 });
  await expect(manual.locator(".lede")).toContainText("800");
});

test("version: header badge and footer link to the latest release", async ({ page }) => {
  const { readFileSync } = await import("node:fs");
  const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const releases = "https://github.com/EpiForeSITE/measles-dashboard/releases/latest";
  await page.goto("/");
  const badge = page.locator("#version");
  await expect(badge).toHaveText(`v${version}`);
  await expect(badge).toHaveAttribute("href", releases);
  const footer = page.locator("measles-dashboard").locator("footer a").first();
  await expect(footer).toHaveText(`Measles dashboard v${version}`);
  await expect(footer).toHaveAttribute("href", releases);
});
