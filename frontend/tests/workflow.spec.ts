import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

test("specification, explained substitution, explicit confirmation and export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Каталог 18" })).toBeVisible();
  await page
    .getByRole("button", { name: "Загрузить спецификацию", exact: true })
    .click();
  await page
    .getByLabel("Выберите файл", { exact: true })
    .setInputFiles(path.resolve("public/examples/specification.csv"));
  await page
    .getByRole("button", { name: "Проверить позиции", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Подготовить корзину", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Возможные замены", exact: true })
    .nth(0)
    .click();
  await page.getByRole("button", { name: /^DEMO-MCB-002 ·/ }).click();
  await page
    .getByRole("checkbox", { name: "Я проверил позиции и количество" })
    .check();
  await page
    .getByRole("button", { name: "Подготовить корзину", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Проверьте будущую корзину" }),
  ).toBeVisible();
  const before = await page.request.get("/api/cart");
  expect((await before.json()).lines).toHaveLength(0);
  await page
    .getByRole("button", { name: "Подтвердить изменения", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Корзина", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "DEMO-MCB-002" }),
  ).toContainText("3 шт.");
  await expect(page.locator(".total-price")).toContainText("15");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Скачать CSV" }).click();
  const download = await downloadPromise;
  const file = await download.path();
  const text = await fs.readFile(file!, "utf8");
  expect(text).toContain("DEMO-MCB-002");
  expect(text).toContain("DEMO-CBL-002");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "DEMO-MCB-002" }),
  ).toContainText("3 шт.");
  await page
    .getByRole("button", { name: "Убрать DEMO-MCB-002", exact: true })
    .click();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "DEMO-MCB-002" }),
  ).toBeVisible();
});

test("three languages, theme persistence, responsive layout and offline chat", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Язык", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "From specification to purchase list." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("link", { name: "Data & settings", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Search without a model", exact: true })
    .check();
  await page.getByRole("link", { name: "Assistant", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Ask a question…" })
    .fill("DEMO-MCB-002");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".chat-product")).toContainText("DEMO-MCB-002");
  await page.getByLabel("Language", { exact: true }).selectOption("kk");
  await expect(
    page.getByRole("heading", { name: "Электр тауарлары бойынша көмекшіңіз" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Каталог", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Спецификациядан дайын сатып алуға." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("catalogue preview and session-isolated import", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Данные и настройки", exact: true })
    .click();
  await page
    .getByLabel("Импорт каталога Выберите файл", { exact: true })
    .setInputFiles(path.resolve("public/examples/catalogue.json"));
  await expect(
    page.getByRole("button", { name: "Подтвердить импорт", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Название каталога", { exact: true })
    .fill("Test uploaded catalogue");
  await page
    .getByRole("button", { name: "Подтвердить импорт", exact: true })
    .click();
  await expect(page.getByLabel("Источник", { exact: true })).toContainText(
    "Test uploaded catalogue",
  );
  await page.getByRole("link", { name: "Каталог", exact: true }).click();
  await expect(page.getByTestId("product-USER-MCB-001")).toBeVisible();
  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto("/");
  await expect(other.getByLabel("Источник", { exact: true })).not.toContainText(
    "Test uploaded catalogue",
  );
  await second.close();
});

test("saved review survives reload and stale tabs cannot overwrite it", async ({
  page,
}) => {
  await page.goto("/#specifications");
  await page
    .getByLabel("Выберите файл", { exact: true })
    .setInputFiles(path.resolve("public/examples/specification.csv"));
  await page
    .getByRole("button", { name: "Проверить позиции", exact: true })
    .click();
  await page.getByLabel("Количество 1", { exact: true }).fill("5");
  await page
    .getByLabel("Выберите товар 1", { exact: true })
    .selectOption("DEMO-MCB-002");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Сохранить черновик", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page
    .getByRole("button", { name: "Проверить позиции", exact: true })
    .click();
  await expect(page.getByLabel("Количество 1", { exact: true })).toHaveValue(
    "5",
  );
  await expect(
    page.getByLabel("Выберите товар 1", { exact: true }),
  ).toHaveValue("DEMO-MCB-002");

  const jobs = await (await page.request.get("/api/jobs")).json();
  const endpoint = "/api/jobs/" + jobs[0].id + "/draft";
  const current = await (await page.request.get(endpoint)).json();
  current.draft.rows[0].quantity = 7;
  expect(
    (
      await page.request.put(endpoint, {
        data: current,
        headers: { "X-Volt-Request": "1" },
      })
    ).ok(),
  ).toBe(true);
  await page.getByLabel("Количество 1", { exact: true }).fill("6");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Черновик изменён");
  const persisted = await (await page.request.get(endpoint)).json();
  expect(persisted.draft.rows[0].quantity).toBe(7);
  expect(
    (await (await page.request.get("/api/cart")).json()).lines,
  ).toHaveLength(0);
});

test("10000 synthetic products stay usable and numeric search is exact", async ({ page }) => {
  test.setTimeout(150000);
  const catalogue = Array.from({ length: 10000 }, (_, i) => ({
    sku: `SYNTH-MCB-${String(i).padStart(5,"0")}`, name: `Synthetic breaker ${1 + i % 200}A`,
    category: "breaker", price_minor: 100000, currency: "KZT", unit: "pcs", step: 1,
    stores: { central: 100 }, attributes: { current_a: String(1 + i % 200), poles: "1", voltage_v: "230" },
    fetched_at: "2026-01-01T00:00:00Z",
  }));
  await page.goto("/#data");
  await page.getByLabel("Импорт каталога Выберите файл", { exact: true }).setInputFiles({
    name: "synthetic-10000.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(catalogue)),
  });
  await expect(page.getByRole("button", { name: "Подтвердить импорт", exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Название каталога", { exact: true }).fill("Synthetic 10000");
  await page.getByRole("button", { name: "Подтвердить импорт", exact: true }).click();
  await expect(page.getByLabel("Источник", { exact: true })).toContainText("Synthetic 10000", { timeout: 60000 });
  await page.getByRole("link", { name: "Каталог", exact: true }).click();
  await expect(page.locator('[data-testid^="product-"]')).toHaveCount(24);
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(page.getByTestId("product-SYNTH-MCB-00024")).toBeVisible();
  await page.getByLabel("Артикул, название или характеристика", { exact: true }).fill("breaker 16A");
  await expect(page.locator(".pagination")).toContainText("50 товаров");
  await expect(page.locator('[data-testid^="product-"]')).toHaveCount(24);
  await page.getByLabel("Артикул, название или характеристика", { exact: true }).fill("SYNTH-MCB-09876");
  await expect(page.locator('[data-testid^="product-"]')).toHaveCount(1);
  await expect(page.getByTestId("product-SYNTH-MCB-09876")).toBeVisible();
});

