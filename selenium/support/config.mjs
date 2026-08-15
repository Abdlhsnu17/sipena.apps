import { readFileSync } from "node:fs";
import path from "node:path";

const defaultAdminUsername = "99999999";
const defaultAdminPassword = "SeleniumE2E#2026";

function readLocalConfig() {
  const candidates = process.env.SELENIUM_ENV_FILE
    ? [process.env.SELENIUM_ENV_FILE]
    : ["selenium.env.json", "cypress.env.json"];

  for (const configPath of candidates) {
    try {
      return JSON.parse(readFileSync(path.resolve(configPath), "utf8"));
    } catch {
      // Coba sumber kredensial lokal berikutnya.
    }
  }

  return {};
}

const localConfig = readLocalConfig();

export const adminUsername = String(
  process.env.SELENIUM_E2E_USERNAME ||
    localConfig.E2E_ADMIN_USERNAME ||
    defaultAdminUsername,
);
export const adminPassword = String(
  process.env.SELENIUM_E2E_PASSWORD ||
    localConfig.E2E_ADMIN_PASSWORD ||
    defaultAdminPassword,
);
