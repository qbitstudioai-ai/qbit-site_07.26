import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Счётчик Метрики отправляет просмотры сам (`defer: true`), поэтому проверяется ровно то, что при
 * ручной отправке ломается: количество просмотров и их порядок.
 *
 * `next/script` и `next/navigation` подменены: первый в jsdom пытается работать с загрузкой
 * реального файла, второй требует роутера App Router, которого в модульном тесте нет.
 *
 * `vi.resetModules()` в каждом тесте обязателен: компонент держит «уже инициализирован» и
 * «последний отправленный адрес» на уровне модуля (это осознанное решение — состояние обязано
 * переживать перемонтирование), и без сброса тесты видели бы состояние друг друга.
 */

const navigation = vi.hoisted(() => ({ pathname: "/", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("next/script", () => ({
  default: () => null,
}));

const COUNTER_ID = 109167375;

async function renderMetrika() {
  const { YandexMetrika } = await import("@/components/analytics/YandexMetrika");
  return render(<YandexMetrika />);
}

/** Вызовы счётчика: подменяем `window.ym` заранее, компонент обязан использовать готовый. */
function counterCalls(): unknown[][] {
  return (window.ym as unknown as { mock: { calls: unknown[][] } }).mock.calls;
}

function hits(): unknown[][] {
  return counterCalls().filter((call) => call[1] === "hit");
}

/**
 * Читается через функцию, а не прямым `window.ym`: после `delete window.ym` TypeScript сужает тип
 * свойства до `never` и дальнейшие обращения к нему перестают компилироваться.
 */
function currentCounter(): Window["ym"] {
  return window.ym;
}

describe("YandexMetrika", () => {
  beforeEach(() => {
    vi.resetModules();
    navigation.pathname = "/";
    navigation.search = "";
    window.ym = vi.fn() as unknown as typeof window.ym;
    Object.defineProperty(document, "referrer", {
      value: "https://yandex.ru/search/?text=автоматизация",
      configurable: true,
    });
  });

  afterEach(() => {
    delete window.ym;
  });

  it("инициализирует счётчик один раз с defer и параметрами из интерфейса Метрики", async () => {
    await renderMetrika();

    const inits = counterCalls().filter((call) => call[1] === "init");
    expect(inits).toHaveLength(1);
    expect(inits[0][0]).toBe(COUNTER_ID);
    expect(inits[0][2]).toEqual({
      ssr: true,
      webvisor: true,
      clickmap: true,
      accurateTrackBounce: true,
      trackLinks: true,
      defer: true,
    });
  });

  it("отправляет ровно один просмотр при первой загрузке и сохраняет внешний источник", async () => {
    await renderMetrika();

    expect(hits()).toHaveLength(1);
    expect(hits()[0][2]).toBe("http://localhost:3000/");
    expect(hits()[0][3]).toEqual({ referer: "https://yandex.ru/search/?text=автоматизация" });
  });

  it("не отправляет второй просмотр при перерисовке того же адреса", async () => {
    const { rerender } = await renderMetrika();
    const { YandexMetrika } = await import("@/components/analytics/YandexMetrika");

    rerender(<YandexMetrika />);
    rerender(<YandexMetrika />);

    expect(hits()).toHaveLength(1);
  });

  it("отправляет новый просмотр при клиентском переходе и указывает предыдущую страницу", async () => {
    const { rerender } = await renderMetrika();
    const { YandexMetrika } = await import("@/components/analytics/YandexMetrika");

    navigation.pathname = "/contacts";
    rerender(<YandexMetrika />);

    expect(hits()).toHaveLength(2);
    expect(hits()[1][2]).toBe("http://localhost:3000/contacts");
    expect(hits()[1][3]).toEqual({ referer: "http://localhost:3000/" });
    // Счётчик инициализируется один раз на загрузку документа, а не на каждый переход.
    expect(counterCalls().filter((call) => call[1] === "init")).toHaveLength(1);
  });

  it("считает изменение строки запроса новым адресом", async () => {
    const { rerender } = await renderMetrika();
    const { YandexMetrika } = await import("@/components/analytics/YandexMetrika");

    navigation.search = "tag=avtomatizaciya";
    rerender(<YandexMetrika />);

    expect(hits()).toHaveLength(2);
    expect(hits()[1][2]).toBe("http://localhost:3000/?tag=avtomatizaciya");
  });

  /**
   * Состояние офиса — не отдельные страницы. Проверено в браузере: без вычистки один клик по
   * «Найти потери» давал два просмотра, а осмотр пяти отделов — десяток.
   */
  it("не считает просмотром переключение отделов в офисе", async () => {
    const { rerender } = await renderMetrika();
    const { YandexMetrika } = await import("@/components/analytics/YandexMetrika");
    expect(hits()).toHaveLength(1);

    for (const search of ["section=office", "department=sales", "department=support", ""]) {
      navigation.search = search;
      rerender(<YandexMetrika />);
    }

    expect(hits()).toHaveLength(1);
  });

  it("не считает просмотром прямой заход на отдел сверх самой главной", async () => {
    navigation.search = "department=sales";
    await renderMetrika();

    expect(hits()).toHaveLength(1);
    // В статистику попадает главная, а не адрес состояния интерфейса.
    expect(hits()[0][2]).toBe("http://localhost:3000/");
  });

  it("сохраняет параметры, которые действительно означают другую страницу", async () => {
    navigation.pathname = "/blog";
    navigation.search = "tag=avtomatizaciya";
    await renderMetrika();

    expect(hits()[0][2]).toBe("http://localhost:3000/blog?tag=avtomatizaciya");
  });

  /**
   * Вычистка привязана к главной. Иначе раздел, который когда-нибудь заведёт собственный
   * `?section=`, молча склеил бы свои просмотры в один.
   */
  it("вычищает параметры офиса только на главной", async () => {
    navigation.pathname = "/blog";
    navigation.search = "section=arhiv";
    await renderMetrika();

    expect(hits()[0][2]).toBe("http://localhost:3000/blog?section=arhiv");
  });

  it("не подключается в административной части", async () => {
    navigation.pathname = "/admin/blog";
    const { container } = await renderMetrika();

    expect(counterCalls()).toHaveLength(0);
    expect(container).toBeEmptyDOMElement();
  });

  it("не подключается на странице входа", async () => {
    navigation.pathname = "/login";
    const { container } = await renderMetrika();

    expect(counterCalls()).toHaveLength(0);
    expect(container).toBeEmptyDOMElement();
  });

  it("засчитывает возврат на ту же страницу после административного раздела", async () => {
    const { rerender } = await renderMetrika();
    const { YandexMetrika } = await import("@/components/analytics/YandexMetrika");
    expect(hits()).toHaveLength(1);

    navigation.pathname = "/login";
    rerender(<YandexMetrika />);
    expect(hits()).toHaveLength(1);

    navigation.pathname = "/";
    rerender(<YandexMetrika />);

    // Возврат — это просмотр, а не повтор: адрес совпадает с прошлым, но между ними был уход.
    expect(hits()).toHaveLength(2);
    expect(hits()[1][2]).toBe("http://localhost:3000/");
    // Источник — предыдущая страница САЙТА, а не внешний document.referrer: иначе возврат из
    // админки выглядел бы как ещё один вход из рекламы.
    expect(hits()[1][3]).toEqual({ referer: "http://localhost:3000/" });
  });

  /**
   * Ветка без предзагруженного `window.ym`. В бою она основная: эффект почти всегда исполняется
   * раньше, чем `tag.js` успевает скачаться, и просмотр обязан лечь в очередь, а не потеряться.
   */
  it("складывает вызовы в очередь, пока библиотека не загрузилась", async () => {
    delete window.ym;
    navigation.pathname = "/contacts";

    await renderMetrika();

    const queue = currentCounter()?.a;
    expect(queue).toBeDefined();
    expect(queue?.map((call) => call[1])).toEqual(["init", "hit"]);
    expect(queue?.[1][2]).toBe("http://localhost:3000/contacts");
    // Очередь — массив списков аргументов: именно так её разбирает tag.js.
    expect(Array.isArray(queue?.[0])).toBe(true);
  });

  it("не перезаписывает уже загруженную библиотеку", async () => {
    const loaded = currentCounter();
    await renderMetrika();

    expect(currentCounter()).toBe(loaded);
  });
});
