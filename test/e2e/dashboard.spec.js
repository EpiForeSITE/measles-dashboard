import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

test("school: pick a school, run, see results", async ({ page }) => {
  await page.goto("/");
  const sim = page.locator("measles-school-sim");
  await sim.locator("summary", { hasText: "School Selector" }).click();
  await sim.locator("#state").selectOption("UT");
  await expect(sim.locator("#county option")).not.toHaveCount(1);
  await sim.locator("#county").selectOption({ index: 1 });
  await expect(sim.locator("#school option")).not.toHaveCount(1);
  const label = await sim.locator("#school option").nth(1).textContent();
  const percent = Number(label.match(/\((\d+)%\)/)[1]);
  await sim.locator("#school").selectOption({ index: 1 });

  const vaccinated = sim.locator("md-param-input").filter({ hasText: "Proportion Vaccinated" });
  await expect(vaccinated.locator("output")).toHaveText((percent / 100).toFixed(2));
  await expect(sim.getByText("enrollment data is not available")).toBeVisible();

  await sim.getByRole("button", { name: "Run Simulation" }).click();
  await expect(sim.locator(".value-box")).toHaveCount(2, { timeout: 60000 });
  await expect(sim.locator("md-epicurve-chart svg")).toBeVisible();
  await expect(sim.locator("md-results-panel tbody tr")).toHaveCount(5);
  await expect(sim.getByText(/introduced into a school with 500 students/)).toBeVisible();

  const download = page.waitForEvent("download");
  await sim.getByRole("button", { name: /Download Data/ }).click();
  const csv = await (await download).createReadStream();
  const text = await new Promise((resolve) => { let s = ""; csv.on("data", (d) => { s += d; }); csv.on("end", () => resolve(s)); });
  expect(text.split("\n")[0]).toBe("sim_num,quarantine,outbreak_size,hospitalizations");
  expect(text.trim().split("\n")).toHaveLength(1 + 2 * 200);
});

test("school: invalid input disables the run", async ({ page }) => {
  await page.goto("/");
  const sim = page.locator("measles-school-sim");
  const size = sim.locator("md-param-input").filter({ hasText: "Population Size" }).locator("input");
  await size.fill("0");
  await size.blur();
  await expect(sim.getByRole("alert").filter({ hasText: "Population Size must be at least 1" })).toBeVisible();
  await expect(sim.getByRole("button", { name: "Run Simulation" })).toBeDisabled();
});

test("mixing: edit the population, run, see results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Community (mixing)" }).click();
  const sim = page.locator("measles-mixing-sim");
  await sim.getByRole("button", { name: "+ Add group" }).click();
  await expect(sim.locator("md-group-editor tbody tr")).toHaveCount(4);
  await sim.getByLabel("Size of Group 4").fill("2000");
  await sim.getByLabel("Size of Group 4").blur();
  await expect(sim.getByText("Total population: 11,000")).toBeVisible();

  await sim.getByRole("button", { name: "Run Simulation" }).click();
  await expect(sim.locator(".value-box")).toHaveCount(2, { timeout: 120000 });
  await expect(sim.getByText(/community of 11,000 people/)).toBeVisible();
});

test("embedding: host styles and events reach the element", async ({ page }) => {
  await page.goto("/embed.html");
  const sim = page.locator("#sim");
  const button = sim.getByRole("button", { name: "Run Simulation" });
  await expect(button).toHaveCSS("background-color", "rgb(29, 79, 58)");
  await button.click();
  await expect(page.locator("#log")).toContainText("md-run-complete", { timeout: 60000 });
});
