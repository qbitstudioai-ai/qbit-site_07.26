import { describe, expect, it } from "vitest";
import {
  CONTACT_ERRORS,
  CONTACT_LIMITS,
  collectContactErrors,
  contactSubmissionSchema,
  isValidPhone,
  normalizePhone,
  normalizeTelegram,
} from "@/features/contacts/contactSchema";

const VALID_PROCESS = "Менеджеры вручную переносят заявки из Telegram в CRM и теряют часть из них.";

const values = (overrides: Partial<Record<string, string>> = {}) => ({
  name: "Павел",
  phone: "",
  telegram: "",
  process: VALID_PROCESS,
  ...overrides,
});

describe("нормализация телефона", () => {
  it("приводит российскую запись с 8 к международному виду", () => {
    expect(normalizePhone("8 937 534-65-75")).toBe("+79375346575");
  });

  it("сохраняет уже международный номер", () => {
    expect(normalizePhone("+7 (937) 534-65-75")).toBe("+79375346575");
  });

  it("не навязывает российский формат зарубежному номеру", () => {
    expect(normalizePhone("+49 30 901820")).toBe("+4930901820");
    expect(isValidPhone("+49 30 901820")).toBe(true);
  });

  it("пустое значение даёт null — именно оно уходит в n8n", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
  });

  it("отвергает буквы и слишком короткие или длинные наборы цифр", () => {
    expect(isValidPhone("позвоните мне")).toBe(false);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("+1234567890123456")).toBe(false);
  });
});

describe("нормализация Telegram", () => {
  it("принимает значение и с @, и без него, а отдаёт всегда с @", () => {
    expect(normalizeTelegram("Promt_Pavel")).toBe("@Promt_Pavel");
    expect(normalizeTelegram("@Promt_Pavel")).toBe("@Promt_Pavel");
  });

  it("не разбирает полную ссылку молча — иначе опечатка уведёт заявку не тому человеку", () => {
    expect(normalizeTelegram("https://t.me/Promt_Pavel")).toBeNull();
    expect(normalizeTelegram("t.me/Promt_Pavel")).toBeNull();
  });

  it("отвергает недопустимые символы", () => {
    expect(normalizeTelegram("@павел")).toBeNull();
    expect(normalizeTelegram("@pa vel")).toBeNull();
    expect(normalizeTelegram("@pa-vel")).toBeNull();
  });
});

describe("правила заявки", () => {
  it("требует имя", () => {
    expect(collectContactErrors(values({ name: " ", phone: "+79375346575" })).name).toBe(
      CONTACT_ERRORS.name,
    );
    expect(collectContactErrors(values({ name: "П", phone: "+79375346575" })).name).toBe(
      CONTACT_ERRORS.name,
    );
    expect(
      collectContactErrors(
        values({ name: "а".repeat(CONTACT_LIMITS.name + 1), phone: "+79375346575" }),
      ).name,
    ).toBe(CONTACT_ERRORS.name);
  });

  it("требует описание процесса не короче 15 символов и не длиннее 2000", () => {
    expect(collectContactErrors(values({ phone: "+79375346575", process: "Мало" })).process).toBe(
      CONTACT_ERRORS.process,
    );
    expect(
      collectContactErrors(values({ phone: "+79375346575", process: "   ".repeat(20) })).process,
    ).toBe(CONTACT_ERRORS.process);
    expect(
      collectContactErrors(
        values({ phone: "+79375346575", process: "а".repeat(CONTACT_LIMITS.process + 1) }),
      ).process,
    ).toBe(CONTACT_ERRORS.process);
  });

  it("принимает заявку только с телефоном", () => {
    const parsed = contactSubmissionSchema.safeParse(values({ phone: "+7 937 534-65-75" }));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({
      name: "Павел",
      phone: "+79375346575",
      telegram: null,
      process: VALID_PROCESS,
    });
  });

  it("принимает заявку только с Telegram", () => {
    const parsed = contactSubmissionSchema.safeParse(values({ telegram: "Promt_Pavel" }));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({
      name: "Павел",
      phone: null,
      telegram: "@Promt_Pavel",
      process: VALID_PROCESS,
    });
  });

  it("не принимает заявку без единого способа связи", () => {
    const errors = collectContactErrors(values());
    expect(errors.contact).toBe(CONTACT_ERRORS.contact);
    expect(contactSubmissionSchema.safeParse(values()).success).toBe(false);
  });

  it("сообщает о неверном формате телефона и Telegram по отдельности", () => {
    expect(collectContactErrors(values({ phone: "12345" })).phone).toBe(CONTACT_ERRORS.phone);
    expect(collectContactErrors(values({ telegram: "https://t.me/x" })).telegram).toBe(
      CONTACT_ERRORS.telegram,
    );
  });

  it("обрезает пробелы имени и описания перед отправкой", () => {
    const parsed = contactSubmissionSchema.safeParse(
      values({ name: "  Павел  ", phone: "+79375346575", process: `  ${VALID_PROCESS}  ` }),
    );
    expect(parsed.success && parsed.data.name).toBe("Павел");
    expect(parsed.success && parsed.data.process).toBe(VALID_PROCESS);
  });
});
