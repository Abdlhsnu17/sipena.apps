import { expect, test } from "@playwright/test"

import { expectNoHorizontalOverflow } from "./responsive.helpers"

const loginNip = process.env.E2E_NIP
const loginPassword = process.env.E2E_PASSWORD

test.describe("authenticated shell responsive checks", () => {
  test.skip(!loginNip || !loginPassword, "Set E2E_NIP and E2E_PASSWORD to run authenticated responsive checks.")

  test("dashboard shell, drawer, and settings page fit mobile and tablet viewports", async ({ page }) => {
    await page.goto("/login")

    await page.locator("#nip").fill(loginNip ?? "")
    await page.locator("#password").fill(loginPassword ?? "")
    await page.getByRole("button", { name: "Masuk" }).click()

    await page.waitForURL((url) => !url.pathname.endsWith("/login"))
    await expect(page.locator('[data-app-shell="authenticated"]')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const mobileMenuButton = page.getByRole("button", { name: "Open menu" })
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click()
      await expect(page.getByRole("dialog", { name: "Menu navigasi" })).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await page.getByRole("button", { name: "Close menu" }).click()
    }

    await page.goto("/settings")
    await expect(page.getByRole("heading", { name: "Pengaturan" })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.goto("/uml")
    await expect(page.getByText("Dokumentasi UML", { exact: false }).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
