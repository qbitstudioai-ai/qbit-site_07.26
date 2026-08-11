import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseStamp } from "@/features/cases/CaseStamp";

/**
 * Печать кейса: `stampEnabled`, задержка, очистка таймеров и prefers-reduced-motion.
 *
 * Эти свойства проверяются здесь, а не в браузере, ровно по одной причине: единственный надёжный
 * способ доказать, что таймер СНЯТ, — прогнать время вперёд после размонтирования и убедиться, что
 * ни один обработчик не сработал. В e2e такого инструмента нет, там наблюдается только результат.
 */

function stampNode() {
  return document.querySelector("[data-case-stamp]");
}

describe("CaseStamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("не отрисовывает ничего при stampEnabled: false", () => {
    render(<CaseStamp caseKey="case-01" enabled={false} />);

    expect(stampNode()).toBeNull();

    // И не появляется позже: выключенная печать не заводит таймер вовсе.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(stampNode()).toBeNull();
  });

  it("ставится примерно через две секунды после открытия кейса", () => {
    render(<CaseStamp caseKey="case-01" enabled />);

    expect(stampNode()).toHaveAttribute("data-case-stamp", "pending");

    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(stampNode(), "печать появилась раньше срока").toHaveAttribute(
      "data-case-stamp",
      "pending",
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(stampNode()).toHaveAttribute("data-case-stamp", "struck");
  });

  it("декоративна: скрыта от дерева доступности и без альтернативного текста", () => {
    render(<CaseStamp caseKey="case-01" enabled />);

    expect(stampNode()).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelector("[data-case-stamp] img")).toHaveAttribute("alt", "");
    // Ни заголовков, ни доступного имени — скринридер о печати не сообщает.
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("смена кейса сбрасывает ожидание, и печать прошлого кейса не появляется", () => {
    const { rerender } = render(<CaseStamp caseKey="case-01" enabled />);

    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(stampNode()).toHaveAttribute("data-case-stamp", "pending");

    // 200 мс до срабатывания — открыт другой кейс.
    rerender(<CaseStamp caseKey="case-02" enabled />);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(stampNode(), "сработал таймер прошлого кейса").toHaveAttribute(
      "data-case-stamp",
      "pending",
    );

    // Новое ожидание отсчитывается с нуля.
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(stampNode()).toHaveAttribute("data-case-stamp", "struck");
  });

  it("размонтирование снимает таймер: обновления состояния после него нет", () => {
    const { unmount } = render(<CaseStamp caseKey="case-01" enabled />);
    unmount();

    // Единственная надёжная проверка очистки: перевести время далеко вперёд и убедиться, что
    // отложенных таймеров не осталось. Несвёрнутый таймер попытался бы обновить состояние
    // размонтированного компонента.
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(stampNode()).toBeNull();
  });

  it("prefers-reduced-motion: печать сразу на документе, без ожидания и без таймера", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );

    render(<CaseStamp caseKey="case-01" enabled />);

    expect(stampNode()).toHaveAttribute("data-case-stamp", "struck");
    expect(vi.getTimerCount(), "при reduced motion таймер не нужен").toBe(0);
  });
});
