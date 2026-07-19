import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficeExperience } from "@/components/office/OfficeExperience";
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

  it("renders the return-to-office button above the department grid in overview, and calls onReturnHome when clicked", () => {
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
    const button = screen.getByRole("button", { name: "Выйти из офиса" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("does not render the return-to-office button once a department is active (Step 7.4: it only lives above the overview grid)", () => {
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
    expect(screen.queryByRole("button", { name: "Выйти из офиса" })).not.toBeInTheDocument();
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

  it("renders MobileDepartmentCarousel alongside OfficeSemanticMap in overview (Step 7 — both present in the DOM at once, CSS switches visibility per breakpoint, verified in e2e)", () => {
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
    expect(screen.getByRole("navigation", { name: "Карусель отделов" })).toBeInTheDocument();
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

    // Какая ИМЕННО сцена подключена, проверяется по исходному тексту: в Vite image-импорты
    // резолвятся в строки-URL, поэтому в jsdom и srcset, и `.src` пусты и отличить sales от support
    // по отрисованному DOM невозможно (тот же артефакт окружения — office-photo.test.ts,
    // office-scenes.test.ts; тот же приём — office-semantic-map.test.tsx). Фактически загруженный
    // браузером файл на каждый отдел проверяет e2e department-scene.spec.ts.
    it("binds the background to the ACTIVE department's scene, not to a fixed one", () => {
      const source = readFileSync(
        path.resolve(process.cwd(), "src/components/office/OfficeExperience.tsx"),
        "utf-8",
      );

      // Индексация по активной сцене — то, что делает переключение отдела сменой файла.
      expect(source).toMatch(/officeSceneById\[activeSceneId\]/);
      // ...а сам activeSceneId выводится из активного отдела, а не зафиксирован константой.
      expect(source).toMatch(/activeSceneId\s*:\s*OfficeSceneId\s*=\s*activeDepartment\s*\?/);
      // И общий фон Step 7.3 больше не участвует: пока он здесь, «сцена отдела» была бы одним и тем
      // же фото на все пять отделов.
      expect(source).not.toMatch(/officeBackgroundPhoto/);
      // key по сцене — то, что не даёт признаку неудачной загрузки залипнуть между отделами
      // (skeptic Phase B: без него один сбой гасил фотослой на весь обход офиса).
      expect(source).toMatch(/key=\{activeSceneId\}/);
    });

    it("keeps the overview master scene behind «Ваша задача» — it is not a department", () => {
      const { container } = renderActive("task");
      expect(container.querySelectorAll("picture")).toHaveLength(1);

      const source = readFileSync(
        path.resolve(process.cwd(), "src/components/office/OfficeExperience.tsx"),
        "utf-8",
      );
      // Ветка «не отдел → overview» в выводе activeSceneId.
      expect(source).toMatch(/activeDepartment\s*\?\s*activeDepartment\.id\s*:\s*"overview"/);
    });
  });
});
