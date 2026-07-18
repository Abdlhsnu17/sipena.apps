import { rm } from "node:fs/promises";
import path from "node:path";

const screenshotDir = path.resolve(process.env.SELENIUM_SCREENSHOT_DIR || "selenium/screenshots");

await rm(screenshotDir, { recursive: true, force: true });
