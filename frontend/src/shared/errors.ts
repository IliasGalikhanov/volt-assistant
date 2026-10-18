import { APIError } from "./api";
import type { Language } from "./types";

const messages: Record<string, [string, string, string]> = {
  request_failed: [
    "Не удалось выполнить запрос. Повторите попытку.",
    "Сұрау орындалмады. Қайталап көріңіз.",
    "Request failed. Please retry.",
  ],
  network: [
    "Нет связи с сервером. Проверьте, запущено ли приложение.",
    "Сервермен байланыс жоқ. Қолданбаның іске қосылғанын тексеріңіз.",
    "Cannot reach the server. Check that the application is running.",
  ],
  invalid_input: [
    "Проверьте введённые данные.",
    "Енгізілген деректерді тексеріңіз.",
    "Check the submitted values.",
  ],
  invalid_file: [
    "Не удалось прочитать файл. Проверьте формат, кодировку UTF-8 и размер до 10 МБ.",
    "Файл оқылмады. Пішімін, UTF-8 кодтауын және 10 МБ шегін тексеріңіз.",
    "Cannot read this file. Check the format, UTF-8 encoding and 10 MB limit.",
  ],
  invalid_catalogue: [
    "Каталог не прошёл проверку. Проверьте артикулы, цены, остатки и сопоставление колонок.",
    "Каталог тексеруден өтпеді. Артикулдарды, бағаларды, қалдықтарды және бағандарды тексеріңіз.",
    "Catalogue validation failed. Check articles, prices, stock and column mapping.",
  ],
  invalid_draft: [
    "Проверьте строки черновика: текст, склад и целое количество от 1 до 1 000 000.",
    "Жоба жолдарын тексеріңіз: мәтін, қойма және 1–1 000 000 аралығындағы бүтін сан.",
    "Check draft rows, warehouse and integer quantities from 1 to 1,000,000.",
  ],
  draft_conflict: [
    "Черновик изменён в другой вкладке или удалён. Скопируйте свои правки и откройте проверку заново.",
    "Жоба басқа қойындыда өзгертілген немесе жойылған. Түзетулерді көшіріп, қайта ашыңыз.",
    "The draft changed in another tab or was deleted. Copy your edits and reopen the review.",
  ],
  upload_limit: [
    "Достигнут лимит 30 файлов. Удалите ненужные файлы.",
    "30 файл шегіне жетті. Қажетсіз файлдарды жойыңыз.",
    "The 30-file limit was reached. Delete unused files.",
  ],
  file_busy: [
    "Файл ещё обрабатывается или уже удалён.",
    "Файл өңделуде немесе жойылған.",
    "The file is still processing or was deleted.",
  ],
  model_failed: [
    "Модель недоступна или не распознала изображение. Повторите попытку либо загрузите CSV/XLSX.",
    "Модель қолжетімсіз немесе сурет танылмады. Қайталаңыз не CSV/XLSX жүктеңіз.",
    "The model is unavailable or could not read the image. Retry or upload CSV/XLSX.",
  ],
  invalid_extraction: [
    "Результат распознавания ненадёжен. Загрузите более чёткий документ.",
    "Тану нәтижесі сенімсіз. Анығырақ құжат жүктеңіз.",
    "Extraction is unreliable. Upload a clearer document.",
  ],
  processing_interrupted: [
    "Обработка прерывалась трижды. Загрузите файл повторно.",
    "Өңдеу үш рет үзілді. Файлды қайта жүктеңіз.",
    "Processing was interrupted three times. Upload the file again.",
  ],
  not_found: [
    "Данные не найдены. Обновите страницу.",
    "Деректер табылмады. Бетті жаңартыңыз.",
    "Data was not found. Reload the page.",
  ],
  conflict: [
    "Цена, остаток или корзина изменились. Проверьте позиции и подготовьте корзину заново.",
    "Баға, қалдық немесе себет өзгерді. Тауарларды тексеріп, себетті қайта дайындаңыз.",
    "Price, stock or cart changed. Review items and prepare the cart again.",
  ],
  invalid_cart: [
    "Проверьте количество, кратность и остаток на выбранном складе.",
    "Мөлшерді, еселікті және қоймадағы қалдықты тексеріңіз.",
    "Check quantity, pack size and stock at the selected warehouse.",
  ],
};
export function errorCodeMessage(code: string, lang: Language): string {
  const aliases: Record<string, string> = {
    proposal_conflict: "conflict",
    confirmation_failed: "conflict",
    invalid_selection: "invalid_cart",
  };
  return (messages[aliases[code] ?? code] ?? messages.request_failed)[
    { ru: 0, kk: 1, en: 2 }[lang]
  ];
}
export function errorMessage(error: unknown, lang: Language): string {
  return errorCodeMessage(
    error instanceof APIError
      ? error.code
      : error instanceof TypeError
        ? "network"
        : "request_failed",
    lang,
  );
}
