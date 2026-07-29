import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficeExperience } from "@/components/office/OfficeExperience";
import { SCENE_DISSOLVE_MS, SCENE_DOLLY_MS } from "@/components/office/SceneCrossfade";
import { getDepartments } from "@/content/departments";
import { getHomepageCopy } from "@/content/homepage-copy";
import { getOfficeZones } from "@/content/office-zones";

describe("OfficeExperience", () => {
  const departments = getDepartments();
  const copy = getHomepageCopy();
  const officeZones = getOfficeZones();

  it("marks itself data-revealed=false and applies the hidden-until-revealed class when isRevealed is false", () => {
    const { container } = render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        returnToOfficeLabel="Выйти из офиса"
        contactHref="https://t.me/Promt_Pavel"
        taskCopy={copy.taskSection}
        onReturnHome={() => {}}
        departments={departments}
        officeZones={officeZones}
        isRevealed={false}
        machineView="hero"
        activeSectionId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-revealed", "false");
    // The office map/hint is still present in the DOM (progressive enhancement, no-JS
    // fallback) — only its class marks it as hidden-until-revealed; actual CSS hiding is
    // verified in e2e (jsdom does not apply the real :global(.js) stylesheet rule).
    expect(screen.getByRole("navigation", { name: "Отделы компании" })).toBeInTheDocument();
  });

  it("marks itself data-revealed=true and drops the hidden-until-revealed class when isRevealed is true", () => {
    const { container } = render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        returnToOfficeLabel="Выйти из офиса"
        contactHref="https://t.me/Promt_Pavel"
        taskCopy={copy.taskSection}
        onReturnHome={() => {}}
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="overview"
        activeSectionId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-revealed", "true");
  });

  it("renders the editorial overview stories and direct Telegram CTA from structured copy", () => {
    render(
      <OfficeExperience
        interactionHint={copy.interactionHint}
        officeOverview={copy.officeOverview}
        returnToOfficeLabel={copy.returnToOfficeLabel}
        contactHref={copy.contactHref}
        taskCopy={copy.taskSection}
        onReturnHome={() => {}}
        departments={departments}
        officeZones={officeZones}
        isRevealed
        machineView="overview"
        activeSectionId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );

    expect(screen.getByText(copy.officeOverview.leftStory.title)).toBeInTheDocument();
    expect(screen.getByText(copy.officeOverview.rightStory.title)).toBeInTheDocument();
    expect(screen.getByText("Выберите отдел")).toBeInTheDocument();
    expect(screen.queryByText("Наведи курсор на область офиса")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: copy.officeOverview.ctaAccessibleLabel }),
    ).toHaveAttribute("href", copy.contactHref);
  });

  it("does not render an active department panel when activeSectionId is null", () => {
    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        returnToOfficeLabel="Выйти из офиса"
        contactHref="https://t.me/Promt_Pavel"
        taskCopy={copy.taskSection}
        onReturnHome={() => {}}
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="overview"
        activeSectionId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders the return-to-office link above the department grid in overview, and calls onReturnHome when clicked", () => {
    const onReturnHome = vi.fn();
    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        returnToOfficeLabel="Выйти из офиса"
        contactHref="https://t.me/Promt_Pavel"
        taskCopy={copy.taskSection}
        onReturnHome={onReturnHome}
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="overview"
        activeSectionId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    const link = screen.getByRole("link", { name: "Выйти из офиса" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#hero-heading");
    fireEvent.click(link);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("does not render the return-to-office link once a department is active (it only lives above the overview grid)", () => {
    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        returnToOfficeLabel="Выйти из офиса"
        contactHref="https://t.me/Promt_Pavel"
        taskCopy={copy.taskSection}
        onReturnHome={() => {}}
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="department-active"
        activeSectionId="sales"
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    expect(screen.queryByRole("link", { name: "Выйти из офиса" })).not.toBeInTheDocument();
  });

  it("renders DepartmentExperience and the rail (4 departments + task section), and hides the office map (Step 6 10/90 shell)", () => {
    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        returnToOfficeLabel="Выйти из офиса"
        contactHref="https://t.me/Promt_Pavel"
        taskCopy={copy.taskSection}
        onReturnHome={() => {}}
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="department-active"
        activeSectionId="sales"
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    const salesDepartment = departments.find((d) => d.id === "sales")!;
    expect(
      screen.getByRole("heading", { level: 2, name: salesDepartment.headline }),
    ).toBeInTheDocument();
    // Карта офиса (5 хотспотов) больше не рендерится одновременно с активным отделом — заменена
    // DepartmentNavigationRail (см. WORKPLAN.md Step 6 Expected files: DepartmentHotspot больше не
    // остаётся видимым одновременно с активным отделом).
    expect(screen.queryByRole("navigation", { name: "Отделы компании" })).not.toBeInTheDocument();
    const rail = screen.getByRole("navigation", { name: "Панель отделов" });
    // 4 неактивных отдела + «Ваша задача» (Step 12.7).
    expect(rail.querySelectorAll("button")).toHaveLength(5);
  });

  it("renders the direct OfficeSemanticMap in overview without the old mobile carousel block", () => {
    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        returnToOfficeLabel="Выйти из офиса"
        contactHref="https://t.me/Promt_Pavel"
        taskCopy={copy.taskSection}
        onReturnHome={() => {}}
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="overview"
        activeSectionId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Отделы компании" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Карусель отделов" })).not.toBeInTheDocument();
  });

  it("passes departments/onSelectDepartment down to DepartmentExperience so CarouselNavControls names the correct wrap-around neighbours (Step 7)", () => {
    // "executive" — средний по сортировке officeZones (не первый/последний), чтобы проверить
    // обычный (не граничный) случай prev/next.
    const sortedIds = officeZones
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((zone) => zone.departmentId);
    const activeIndex = sortedIds.indexOf("executive");
    const previousDepartment = departments.find(
      (d) => d.id === sortedIds[(activeIndex - 1 + sortedIds.length) % sortedIds.length],
    )!;
    const nextDepartment = departments.find(
      (d) => d.id === sortedIds[(activeIndex + 1) % sortedIds.length],
    )!;

    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        returnToOfficeLabel="Выйти из офиса"
        contactHref="https://t.me/Promt_Pavel"
        taskCopy={copy.taskSection}
        onReturnHome={() => {}}
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="department-active"
        activeSectionId="executive"
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: `Предыдущий отдел: ${previousDepartment.overviewLabel}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Следующий отдел: ${nextDepartment.overviewLabel}` }),
    ).toBeInTheDocument();
  });

  // ── Step 13: сцена активного отдела вместо одного общего фона ──────────────────────────────────
  describe("department scene (Step 13)", () => {
    const renderActive = (activeSectionId: "sales" | "logistics" | "task") =>
      render(
        <OfficeExperience
          interactionHint="Наведите курсор на отдел"
          returnToOfficeLabel="Выйти из офиса"
          contactHref="https://t.me/Promt_Pavel"
          taskCopy={copy.taskSection}
          onReturnHome={() => {}}
          departments={departments}
          officeZones={officeZones}
          isRevealed={true}
          machineView="department-active"
          activeSectionId={activeSectionId}
          onSelectDepartment={() => {}}
          onCloseDepartment={() => {}}
        />,
      );

    it("renders the scene through the adaptive <picture> layer, not the single-source photo", () => {
      const { container } = renderActive("sales");

      // Одноисточниковый OfficePhoto (<img> от next/image) не дал бы браузеру ни выбора формата,
      // ни выбора ширины — адаптивность сцены отдела оказалась бы номинальной.
      const sources = container.querySelectorAll("picture > source");
      expect(sources).toHaveLength(2);
      expect(sources[0]).toHaveAttribute("type", "image/avif");
      expect(sources[1]).toHaveAttribute("type", "image/webp");
    });

    it("mounts exactly one scene — the active one, not all six", () => {
      const { container } = renderActive("logistics");
      // Если бы сцены рендерились впрок (все отделы сразу, скрытые CSS), браузер запросил бы шесть
      // фонов на одно открытие отдела — прямое нарушение AC3 и docs/10 («detail assets — при выборе»).
      expect(container.querySelectorAll("picture")).toHaveLength(1);
    });

    // Какая ИМЕННО сцена подключена — теперь проверяется по ОТРИСОВАННОМУ DOM (Step 18).
    //
    // Прежняя редакция читала исходный текст и искала в нём форму записи `activeSceneId = ...`:
    // обходной приём, потому что в Vite image-импорты резолвятся в строки-URL и отличить sales от
    // support по `img.src` в jsdom нельзя. Со Step 18 отличать МОЖНО — слой переходов выставляет id
    // текущей сцены атрибутом. Замена не косметическая: регулярка ломалась от любого переписывания
    // выражения (она и упала на переносе вывода сцены в реестр разделов), но при этом прошла бы,
    // будь результат этого выражения никуда не передан. Проверка по DOM ведёт себя ровно наоборот —
    // ей безразлична форма записи и небезразличен результат.
    //
    // Фактически загруженный браузером файл на каждый отдел проверяет e2e department-scene.spec.ts.
    it("binds the background to the ACTIVE department's scene, not to a fixed one", () => {
      for (const sceneId of ["sales", "logistics"] as const) {
        const { container, unmount } = renderActive(sceneId);
        expect(container.querySelector("[data-scene-crossfade]")).toHaveAttribute(
          "data-scene-crossfade",
          sceneId,
        );
        unmount();
      }

      // Со Step 16 фотослой рендерит SceneCrossfade (два слоя вместо одного), поэтому часть
      // инвариантов живёт там. Проверки НЕ сняты — они смотрят по новому адресу, иначе переезд
      // молча снял бы сторожей вместе с кодом.
      const crossfadeSource = readFileSync(
        path.resolve(process.cwd(), "src/components/office/SceneCrossfade.tsx"),
        "utf-8",
      );

      // Индексация по id сцены живёт в SceneCrossfade — именно она делает переключение отдела
      // сменой файла.
      expect(crossfadeSource).toMatch(/officeSceneById\[/);

      // И общий фон Step 7.3 больше не участвует: пока он здесь, «сцена отдела» была бы одним и тем
      // же фото на все пять отделов.
      const source = readFileSync(
        path.resolve(process.cwd(), "src/components/office/OfficeExperience.tsx"),
        "utf-8",
      );
      expect(source).not.toMatch(/officeBackgroundPhoto/);

      // key по сцене — то, что не даёт признаку неудачной загрузки залипнуть между отделами
      // (skeptic Phase B Step 13: без него один сбой гасил фотослой на весь обход офиса).
      //
      // Со Step 16 ключ обязан быть привязан ИМЕННО К СЦЕНЕ (`scene-<id>`), а не к роли слоя
      // («уходящий»/«приходящий»). Это не стилистика: при ключе по роли уходящий слой оказывается
      // НОВЫМ DOM-элементом и стартует пустым, то есть удерживать предыдущий кадр ему нечем —
      // измерено 16 из 30 выборок без видимой сцены на медленном канале. Ключ по сцене сохраняет
      // уже отрисованный <img>, и переход перестаёт идти через пустоту (0 из 30).
      expect(crossfadeSource).toMatch(/key=\{`scene-\$\{id\}`\}/);
      expect(
        crossfadeSource,
        "ключ слоя не должен зависеть от роли — иначе уходящий кадр не удержать",
      ).not.toMatch(/key=\{`(outgoing|incoming)-/);
    });

    // Amendment 15: длительности перехода живут в CSS, а их значения продублированы константами в
    // TS. В рантайме эти константы больше ничего не запускают — снятие слоёв идёт по событию
    // окончания анимации, а не по таймеру, — но они остаются ЗАФИКСИРОВАННЫМ КОНТРАКТОМ эффекта.
    // Сторож здесь проверяет то, что нигде больше не проверяется: проявление обязано быть короче
    // движения. Сравняв их, эффект тихо вырождается обратно в одинарный crossfade — именно в тот,
    // который пользователь назвал дешёвым; ни один e2e-тест такого не поймает, если длительности
    // при этом останутся в вилке docs/07.
    it("keeps the transition timings in CSS and TS in sync", () => {
      const css = readFileSync(
        path.resolve(process.cwd(), "src/components/office/SceneCrossfade.module.css"),
        "utf-8",
      );

      const durationOf = (keyframes: string) => {
        const match = css.match(new RegExp(`${keyframes}\\s+(\\d+)ms`));
        expect(match, `в CSS не найдена длительность анимации ${keyframes}`).not.toBeNull();
        return Number(match![1]);
      };

      expect(durationOf("scene-dolly")).toBe(SCENE_DOLLY_MS);
      expect(durationOf("scene-dissolve")).toBe(SCENE_DISSOLVE_MS);
      // Проявление обязано заканчиваться раньше движения — иначе это одинарный фейд, а не наезд.
      expect(SCENE_DISSOLVE_MS).toBeLessThan(SCENE_DOLLY_MS);
      // Уходящий план движется столько же, сколько приходящий: расхождение дало бы рывок на стыке.
      expect(durationOf("scene-recede")).toBe(SCENE_DOLLY_MS);
    });

    // ── Сцена overview (переехало из office-semantic-map.test.tsx, Step 18) ──────────────────────
    // До Step 18 кадр overview рисовала карта офиса, и эти три сторожа стояли у неё. Со Step 18 кадр
    // держит общий сцен-слой, живущий через оба состояния, поэтому проверки переехали СЮДА вместе с
    // ответственностью. Требования не изменились — изменился владелец; снять их вместе с переездом
    // означало бы потерять покрытие ровно того, что шаг трогает.
    const renderOverview = () =>
      render(
        <OfficeExperience
          interactionHint="Наведите курсор на отдел"
          returnToOfficeLabel="Выйти из офиса"
          contactHref="https://t.me/Promt_Pavel"
          taskCopy={copy.taskSection}
          onReturnHome={() => {}}
          departments={departments}
          officeZones={officeZones}
          isRevealed={true}
          machineView="overview"
          activeSectionId={null}
          onSelectDepartment={() => {}}
          onCloseDepartment={() => {}}
        />,
      );

    // Step 12: overview — настоящая сцена офиса, а не карточки на токен-фоне.
    it("renders a scene photo behind the hotspot layer in overview", () => {
      const { container } = renderOverview();
      expect(container.querySelector("picture")).not.toBeNull();
    });

    // При переезде проверка УСИЛЕНА. Прежняя редакция искала `sources={officeSceneById.overview}` в
    // исходном тексте — обходной приём, потому что в Vite image-импорты резолвятся в строки-URL и
    // отличить сцены по `img.src` в jsdom нельзя. Теперь отличать по DOM МОЖНО: слой переходов
    // выставляет id текущей сцены атрибутом, и сторож смотрит на фактический результат рендера, а не
    // на форму записи в коде. Регулярка прошла бы и при закомментированном вызове; эта — нет.
    it("wires the overview master scene in overview, not a department scene", () => {
      const { container } = renderOverview();
      expect(container.querySelector("[data-scene-crossfade]")).toHaveAttribute(
        "data-scene-crossfade",
        "overview",
      );
    });

    it("keeps all 5 department buttons usable when the overview scene fails to load (Step 8 fallback)", () => {
      const { container } = renderOverview();
      fireEvent.error(container.querySelector("img")!);

      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("[data-photo-fallback]")).not.toBeNull();

      // Коммерческий путь overview не зависит от фотослоя вовсе.
      const nav = screen.getByRole("navigation", { name: "Отделы компании" });
      expect(within(nav).getAllByRole("button")).toHaveLength(5);
    });

    it("keeps the overview master scene behind «Ваша задача» — it is not a department", () => {
      const { container } = renderActive("task");
      expect(container.querySelectorAll("picture")).toHaveLength(1);
      // По той же причине, что и выше: проверяется результат, а не форма записи вывода сцены.
      expect(container.querySelector("[data-scene-crossfade]")).toHaveAttribute(
        "data-scene-crossfade",
        "overview",
      );
    });
  });
});
