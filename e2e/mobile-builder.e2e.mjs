import { expect, test } from "@playwright/test";

const resumeId = process.env.E2E_RESUME_ID;
const authState = process.env.E2E_AUTH_STATE;

if (authState) test.use({ storageState: authState });

test.describe("mobile resume builder", () => {
  test.skip(!resumeId || !authState, "Set E2E_RESUME_ID and E2E_AUTH_STATE to run authenticated builder UX tests.");

  test("opens mobile editor sheets and captures touch layouts", async ({ page, isMobile }, testInfo) => {
    await page.goto(`/builder/${resumeId}`);
    await expect(page.getByRole("button", { name: /open content editor/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /open design settings/i })).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-builder-preview.png`) });

    if (isMobile) {
      await page.getByRole("button", { name: /open content editor/i }).click();
      await expect(page.getByRole("heading", { name: /content/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /basics/i }).first()).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-content-sheet.png`) });
      await page.getByRole("button", { name: /close/i }).click();

      await page.getByRole("button", { name: /open design settings/i }).click();
      await expect(page.getByRole("heading", { name: /design/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /template/i }).first()).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-design-sheet.png`) });
      await page.getByRole("button", { name: /close/i }).click();

      await page.getByRole("button", { name: /more builder actions/i }).click();
      await expect(page.getByRole("menuitem", { name: /download pdf/i })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-mobile-actions.png`) });
    }
  });

  test("returns focus after closing mobile sheets", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Focus return is covered by desktop keyboard tests outside the mobile drawer flow.");

    await page.goto(`/builder/${resumeId}`);
    const contentButton = page.getByRole("button", { name: /open content editor/i });

    await contentButton.click();
    await expect(page.getByRole("heading", { name: /content/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: /content/i })).toBeHidden();
    await expect(contentButton).toBeFocused();
  });
});
