import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DepartmentNavigationRail } from "@/components/office/DepartmentNavigationRail";
import { OfficePhoto, OfficeScenePhoto } from "@/components/office/OfficePhoto";
import {
  officeSceneById,
  photoByDepartmentId,
  OFFICE_SCENE_SIZES,
  OFFICE_SCENE_WIDTHS,
} from "@/components/office/departmentPhotos";
import { getDepartments } from "@/content/departments";
import { getHomepageCopy } from "@/content/homepage-copy";

// Уровень jsdom: реальной сети нет, поэтому onError диспатчится вручную. Настоящее поведение
// браузера при недоступном файле проверяется e2e (reduced-motion-and-fallback.spec.ts, route.abort).
// Ни один из двух уровней не выдаётся за другой — см. WORKPLAN.md Step 8, Risks.
describe("OfficePhoto", () => {
  it("renders a decorative image while loading succeeds", () => {
    const { container } = render(<OfficePhoto src={photoByDepartmentId.sales} />);
    expect(container.querySelectorAll('img[alt=""]')).toHaveLength(1);
    expect(container.querySelector("[data-photo-fallback]")).toBeNull();
  });

  it("swaps a failed photo for a neutral placeholder instead of a broken image", () => {
    const { container } = render(<OfficePhoto src={photoByDepartmentId.sales} />);
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    const fallback = container.querySelector("[data-photo-fallback]");
    expect(fallback).not.toBeNull();
    // Плейсхолдер декоративен так же, как и само фото — он не должен появиться в дереве доступности.
    expect(fallback).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the caller's class on the placeholder so layout geometry survives the failure", () => {
    const { container } = render(
      <OfficePhoto src={photoByDepartmentId.sales} className="caller-geometry" />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("[data-photo-fallback]")).toHaveClass("caller-geometry");
  });
});

// Step 12: адаптивная отдача сцены. Проверяется именно то, что нельзя увидеть глазами в jsdom, —
// что srcset реально построен по всем предгенерированным ширинам и обоим форматам, а не свёрнут к
// одной картинке (риск "номинальной адаптивности", зафиксированный в WORKPLAN.md Step 10).
describe("OfficeScenePhoto", () => {
  const scene = officeSceneById.overview;

  it("offers AVIF first and WebP as fallback, each with every generated width", () => {
    const { container } = render(<OfficeScenePhoto sources={scene} sizes={OFFICE_SCENE_SIZES} />);

    const sources = container.querySelectorAll("picture > source");
    expect(sources).toHaveLength(2);
    // Порядок значим: браузер берёт первый поддерживаемый <source>.
    expect(sources[0]).toHaveAttribute("type", "image/avif");
    expect(sources[1]).toHaveAttribute("type", "image/webp");

    for (const source of sources) {
      const srcSet = source.getAttribute("srcset") ?? "";
      const descriptors = srcSet.split(",").map((entry) => entry.trim().split(/\s+/)[1]);
      expect(descriptors).toEqual(OFFICE_SCENE_WIDTHS.map((width) => `${width}w`));
      expect(source).toHaveAttribute("sizes", OFFICE_SCENE_SIZES);
    }
  });

  it("keeps a plain <img> inside <picture> as the no-srcset fallback, decorative", () => {
    const { container } = render(<OfficeScenePhoto sources={scene} sizes={OFFICE_SCENE_SIZES} />);
    const img = container.querySelector("picture > img");
    expect(img).not.toBeNull();
    // Сцена декоративна: весь смысл overview несут 5 HTML-кнопок поверх неё.
    expect(img).toHaveAttribute("alt", "");
    // Значение src здесь НЕ проверяется: в Vite image-импорты резолвятся в строки-URL, а не в
    // StaticImageData, поэтому `.src` в jsdom пуст (тот же артефакт окружения описан в
    // office-scenes.test.ts). Что подключена именно мастер-сцена overview, проверяется по исходному
    // тексту в office-semantic-map.test.tsx, а реальная загрузка — в e2e overview-scene.spec.ts.
  });

  it("falls back to the neutral placeholder on load failure, like OfficePhoto", () => {
    const { container } = render(
      <OfficeScenePhoto sources={scene} sizes={OFFICE_SCENE_SIZES} className="caller-geometry" />,
    );
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("picture")).toBeNull();
    const fallback = container.querySelector("[data-photo-fallback]");
    expect(fallback).not.toBeNull();
    expect(fallback).toHaveAttribute("aria-hidden", "true");
    expect(fallback).toHaveClass("caller-geometry");
  });
});

describe("DepartmentNavigationRail with a failed photo layer (Step 8, AC 2)", () => {
  const departments = getDepartments();

  it("keeps all switch buttons and their labels usable when every thumbnail fails", () => {
    const { container } = render(
      <DepartmentNavigationRail
        departments={departments}
        activeSectionId="sales"
        taskCopy={getHomepageCopy().taskSection}
        onSelectDepartment={() => {}}
      />,
    );

    for (const img of container.querySelectorAll("img")) {
      fireEvent.error(img);
    }

    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("[data-photo-fallback]")).toHaveLength(5);

    // Коммерческий путь не зависит от фотослоя: подписи и кнопки переключения на месте.
    const nav = screen.getByRole("navigation", { name: "Панель отделов" });
    // 4 неактивных отдела + «Ваша задача»; у последней миниатюры нет, поэтому провал фото её
    // не касается вовсе.
    expect(nav.querySelectorAll("button")).toHaveLength(5);
    for (const department of departments.filter((d) => d.id !== "sales")) {
      expect(screen.getByRole("button", { name: department.overviewLabel })).toBeInTheDocument();
    }
  });
});
