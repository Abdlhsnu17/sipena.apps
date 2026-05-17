import { expect, test } from "@playwright/test"

import { expectElementToFitViewport, expectNoHorizontalOverflow } from "./responsive.helpers"

const publicRoutes = [
  { path: "/login", heading: "Sistem Inventaris", cardSelector: "[data-auth-card]" },
  { path: "/register", heading: "Pendaftaran Akun", cardSelector: "[data-auth-card]" },
  { path: "/reset-password", heading: "Lupa Password", cardSelector: "[data-auth-card]" },
]

for (const route of publicRoutes) {
  test(`public page ${route.path} stays responsive`, async ({ page }) => {
    await page.goto(route.path)
    await expect(page.getByText(route.heading, { exact: false })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectElementToFitViewport(page, page.locator(route.cardSelector).first(), 12)
  })
}
