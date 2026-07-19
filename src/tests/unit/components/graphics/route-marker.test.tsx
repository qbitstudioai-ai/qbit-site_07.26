import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteMarker } from "@/components/graphics/RouteMarker";

// Step 14: маркер маршрута/статуса из графической системы логотипа (docs/02 «Графическая система»:
// стрелки и треугольные формы должны ВЫПОЛНЯТЬ ФУНКЦИЮ, а не украшать).
describe("RouteMarker", () => {
  it("is hidden from assistive technology — the meaning is carried by markup, not by the glyph", () => {
    const { container } = render(<RouteMarker direction="right" />);
    const svg = container.querySelector("svg")!;

    // Это половина смысла, а не сам смысл: статус несут aria-current (рельс) и aria-pressed
    // (выбранная боль). Если маркер начнёт объявляться, скринридер получит безымянную графику,
    // а если он останется ЕДИНСТВЕННЫМ носителем состояния — состояние пропадёт для AT вовсе.
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("role", "presentation");
    // focusable="false" обязателен: IE/Edge-наследие добавляет SVG в Tab-порядок без него.
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("renders a hollow triangle, not a filled blob — the shape language of the logo", () => {
    const { container } = render(<RouteMarker direction="up" />);
    const polygon = container.querySelector("polygon")!;

    expect(polygon).not.toBeNull();
    // Три вершины: именно треугольник, а не произвольный многоугольник.
    expect(polygon.getAttribute("points")!.trim().split(/\s+/)).toHaveLength(3);
  });

  it("points where the direction says: right for a transition, up for a status", () => {
    const { container: right } = render(<RouteMarker direction="right" />);
    const { container: up } = render(<RouteMarker direction="up" />);

    // Поворот задаётся SVG-атрибутом, а не CSS-трансформом места использования, поэтому направление
    // проверяемо и не зависит от того, что делает с элементом внешняя вёрстка.
    expect(right.querySelector("g")).toHaveAttribute("transform", "rotate(90 8 8)");
    expect(up.querySelector("g")).toHaveAttribute("transform", "rotate(0 8 8)");
  });

  it("keeps the caller's class so size and colour stay with the place of use", () => {
    const { container } = render(<RouteMarker direction="up" className="caller-size" />);
    expect(container.querySelector("svg")).toHaveClass("caller-size");
  });
});
