import { expect, test } from "@playwright/test";

test("analysis scene runs Windows → QBit → terminal without overlap", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/how-we-work");

  const scene = page.locator("section[aria-label='Интерактивная офисная сцена']");
  await expect(scene).toBeVisible();

  /**
   * Колесо доставляется ТОЛЬКО после гидратации.
   *
   * Обработчик `wheel` навешивается в `useEffect`, поэтому событие, отправленное сразу после
   * `goto`, до гидратации просто теряется — сцена остаётся нулевой, и спек падал с
   * «Expected "1", Received "0"». Это гонка теста с гидратацией, а не дефект страницы.
   *
   * Поэтому событие повторяется, пока сцена не сдвинется. Повтор безопасен от «перелёта»: следующая
   * попытка делается только если сцена ВСЁ ЕЩЁ нулевая, а между попытками выдерживается пауза
   * заведомо больше `WHEEL_RESET_DELAY` (140 мс) — накопитель колеса успевает обнулиться, и две
   * попытки не складываются в два перехода.
   */
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if ((await scene.getAttribute("data-active-scene")) !== "0") break;
    await page.evaluate(() => {
      window.dispatchEvent(new WheelEvent("wheel", { cancelable: true, deltaY: 100 }));
    });
    await page.waitForTimeout(400);
  }

  await expect(scene).toHaveAttribute("data-active-scene", "1");
  const laptop = page.locator("[class*='laptop-screen-surface']");
  await expect(laptop).toHaveAttribute("data-content-active", "true", { timeout: 4000 });

  await page.evaluate(() => {
    const mark = document.querySelector<HTMLElement>("[class*='boot-mark']");
    const brand = document.querySelector<HTMLElement>("img[class*='boot-brand']");
    const output = document.querySelector<HTMLElement>("[class*='terminal-output']");

    if (!mark || !brand || !output) throw new Error("Analysis boot elements are missing");

    const startedAt = performance.now();
    const timeline = {
      brandOpacityAtFirstOutput: null as number | null,
      brandVisibleAt: null as number | null,
      markVisibleAt: null as number | null,
      outputAt: null as number | null,
    };

    (window as typeof window & { __analysisTimeline?: typeof timeline }).__analysisTimeline =
      timeline;

    const sample = () => {
      const elapsed = performance.now() - startedAt;
      const markOpacity = Number.parseFloat(getComputedStyle(mark).opacity);
      const brandOpacity = Number.parseFloat(getComputedStyle(brand).opacity);

      if (timeline.markVisibleAt === null && markOpacity > 0.5) {
        timeline.markVisibleAt = elapsed;
      }
      if (timeline.brandVisibleAt === null && brandOpacity > 0.5) {
        timeline.brandVisibleAt = elapsed;
      }
      if (timeline.outputAt === null && output.textContent) {
        timeline.outputAt = elapsed;
        timeline.brandOpacityAtFirstOutput = brandOpacity;
      }

      if (timeline.outputAt === null) requestAnimationFrame(sample);
    };

    requestAnimationFrame(sample);
  });

  await page.waitForFunction(
    () =>
      (
        window as typeof window & {
          __analysisTimeline?: { outputAt: number | null };
        }
      ).__analysisTimeline?.outputAt !== null,
    undefined,
    { timeout: 8000 },
  );

  const timeline = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __analysisTimeline?: {
            brandOpacityAtFirstOutput: number | null;
            brandVisibleAt: number | null;
            markVisibleAt: number | null;
            outputAt: number | null;
          };
        }
      ).__analysisTimeline,
  );

  expect(timeline?.markVisibleAt).not.toBeNull();
  expect(timeline?.brandVisibleAt).not.toBeNull();
  expect(timeline?.outputAt).not.toBeNull();
  expect(timeline!.markVisibleAt!).toBeLessThan(timeline!.brandVisibleAt!);
  expect(timeline!.brandVisibleAt!).toBeLessThan(timeline!.outputAt!);
  expect(timeline!.brandOpacityAtFirstOutput!).toBeLessThan(0.05);
});
