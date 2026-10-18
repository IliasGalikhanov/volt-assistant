import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
 ...base,
 use: { ...base.use, baseURL: "http://127.0.0.1:5173" },
 grep: /three languages/,
 webServer: { command: "npm run dev -- --strictPort", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI },
});

