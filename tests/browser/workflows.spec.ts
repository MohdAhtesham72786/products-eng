import { test, expect } from "@playwright/test";
test("complete demo workflow from signup to shortlist and contextual outreach", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Browser reviewer");
  await page.getByLabel("Email").fill(`browser-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("browser-test-password-123");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your next best moves" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load fictional demo" }).click();
  await expect(page.getByText("Demo companies queued")).toBeVisible();
  await expect(page.locator(".action-card")).toHaveCount(5, { timeout: 60000 });
  await expect(
    page.getByText("Fictional demo", { exact: true }).first(),
  ).toBeVisible();
  await page
    .locator(".action-card")
    .first()
    .getByRole("button", { name: "Open dossier" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Company intelligence" }),
  ).toBeVisible();
  await expect(
    page.getByText("Subscription software", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(
    page.getByText("Primary source", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Outreach" }).click();
  await page.getByRole("button", { name: "Generate draft" }).click();
  await expect(page.getByLabel("Message")).toContainText(/./);
  await page
    .getByLabel("Message")
    .fill("Reviewed message for the operations team.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Outreach" }).click();
  await expect(page.getByLabel("Message")).toHaveValue(
    "Reviewed message for the operations team.",
  );
  await page.getByRole("button", { name: "Research again" }).click();
  await page.getByRole("tab", { name: "Changes" }).click();
  await expect(
    page.getByRole("button", { name: "Compare snapshots" }),
  ).toBeEnabled({ timeout: 60000 });
  await page.getByRole("button", { name: "Compare snapshots" }).click();
  await expect(
    page.getByText(
      "New expansion evidence may create an opening for the configured offering.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Research again" }).click();
  await expect(
    page.getByLabel("Before snapshot").locator("option"),
  ).toHaveCount(4, { timeout: 60000 });
  const oldest = (await page
    .getByLabel("Before snapshot")
    .locator("option")
    .last()
    .getAttribute("value"))!;
  await page.getByLabel("Before snapshot").selectOption(oldest);
  await page.waitForResponse(
    (r) =>
      r.url().includes("/api/companies/") &&
      !r.url().includes("/compare") &&
      r.request().method() === "GET",
  );
  await expect(page.getByLabel("Before snapshot")).toHaveValue(oldest);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page
    .locator(".action-card")
    .first()
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await expect(page.locator(".action-card")).toHaveCount(5);
  await page.getByRole("button", { name: "Companies", exact: true }).click();
  await page
    .getByLabel("Company websites")
    .fill("website\nnew-demo.example\nfile:///bad");
  await page.getByRole("button", { name: "Research companies" }).click();
  await expect(page.getByText(/Row 3:/)).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Daily action limit").fill("3");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator(".action-card")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Companies", exact: true }).click();
  await expect(page.getByLabel("Company websites")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
test("mobile navigation and sign-in errors are accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Email").fill("missing@example.com");
  await page.getByLabel("Password").fill("invalid-password-123");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
});
