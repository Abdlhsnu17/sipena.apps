import { expect, type Locator, type Page } from "@playwright/test"

export async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth
    const doc = document.documentElement
    const body = document.body

    return {
      viewportWidth,
      documentScrollWidth: doc.scrollWidth,
      bodyScrollWidth: body?.scrollWidth ?? 0,
    }
  })

  expect(
    metrics.documentScrollWidth,
    `Document scroll width ${metrics.documentScrollWidth}px exceeds viewport ${metrics.viewportWidth}px`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1)
  expect(
    metrics.bodyScrollWidth,
    `Body scroll width ${metrics.bodyScrollWidth}px exceeds viewport ${metrics.viewportWidth}px`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1)
}

export async function expectElementToFitViewport(page: Page, locator: Locator, gutter = 8) {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  const box = await locator.boundingBox()
  expect(box).not.toBeNull()

  if (!viewport || !box) return

  expect(box.width, "Element width exceeds viewport").toBeLessThanOrEqual(viewport.width - gutter)
}
