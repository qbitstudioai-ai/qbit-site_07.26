import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage, { generateMetadata } from "@/app/page";
import { getHomepageCopy } from "@/content/homepage-copy";
import { getDepartments } from "@/content/departments";
import { SITE_URL } from "@/lib/seo";

describe("HomePage", () => {
  it("renders exactly one h1 with the real headline", async () => {
    render(await HomePage({ searchParams: Promise.resolve({}) }));
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(getHomepageCopy().headline);
  });

  it("server-renders exactly three anonymized cases and keeps homepage SEO metadata stable", async () => {
    const html = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({}) }));
    const copy = getHomepageCopy();
    const metadata = generateMetadata();

    expect(html.match(/data-project-scenario="true"/g) ?? []).toHaveLength(3);
    expect(html).toContain("РЕАЛЬНЫЕ КЕЙСЫ");
    expect(html).toContain("Обезличенные результаты внедрений");
    expect(html).toContain("Раньше руководитель тратил 4–5 часов в неделю");
    expect(html).toContain("500–700 тыс.");
    expect(html).toContain("рост продаж");
    expect(html).toContain("раньше занимал ручной анализ");
    expect(html).toContain("ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ");

    for (const removed of [
      "ПРОЕКТНЫЕ СЦЕНАРИИ",
      "расчётный бизнес-эффект",
      "РАСЧЁТНЫЙ ЭФФЕКТ ДЛЯ РУКОВОДИТЕЛЯ",
      "потенциальной выручки",
      "РАСЧЁТНЫЙ ПОТЕНЦИАЛ НА ОСНОВЕ ДАННЫХ CRM",
      "примерно за 15 минут в неделю",
    ]) {
      expect(html).not.toContain(removed);
    }

    expect(metadata.title).toBe("ИИ-автоматизация бизнеса и продаж — QBit-Studio-Ai");
    expect(metadata.description).toBe(copy.subheadline);
    expect(metadata.alternates).toEqual({ canonical: SITE_URL });
    expect(html).toMatch(
      /<h1[^>]*id="hero-heading"[^>]*>.*Автоматизируем продажи, поддержку и документы.*с помощью ИИ.*<\/h1>/,
    );

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    expect(jsonLdMatch?.[1]).toBeDefined();
    const jsonLd = JSON.parse(jsonLdMatch![1]);
    expect(jsonLd).toEqual([
      expect.objectContaining({
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "QBit-Studio-Ai",
      }),
      expect.objectContaining({
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
      }),
      expect.objectContaining({
        "@type": "WebPage",
        "@id": `${SITE_URL}#webpage`,
        name: `${copy.headline} — QBit-Studio-Ai`,
        description: copy.subheadline,
      }),
    ]);
  });

  it("marks the office section as not yet revealed when no ?department= is given at boot", async () => {
    const { container } = render(await HomePage({ searchParams: Promise.resolve({}) }));
    // Actual CSS hiding (:global(.js) .hiddenUntilRevealed) is not applied by jsdom/Vitest —
    // see OfficeExperience unit test and e2e "office-overview" spec for the visual/a11y-tree
    // verification. Here we only check the structural fact the reveal logic depends on.
    const officeSection = container.querySelector("[data-revealed]");
    expect(officeSection).toHaveAttribute("data-revealed", "false");
  });

  it("flips data-revealed to true after clicking the office CTA, with all 5 hotspots present", async () => {
    const { container } = render(await HomePage({ searchParams: Promise.resolve({}) }));
    const copy = getHomepageCopy();
    fireEvent.click(screen.getByRole("link", { name: copy.secondaryCta }));

    expect(container.querySelector("[data-revealed]")).toHaveAttribute("data-revealed", "true");
    // Scoped to the office map nav: mobile overview now uses the same direct hotspot selection as
    // tablet/desktop, without the old intermediate carousel block.
    const officeMapNav = screen.getByRole("navigation", { name: "Отделы компании" });
    const departments = getDepartments();
    for (const department of departments) {
      expect(
        within(officeMapNav).getByRole("button", { name: department.overviewLabel }),
      ).toBeInTheDocument();
    }
  });

  it("moves focus to the first office hotspot immediately after ACTIVATE_CTA, without any Tab press", async () => {
    // jsdom does not implement layout, so `offsetParent` is always null (a known jsdom limitation,
    // independent of any CSS) — the real focus-fallback logic in OfficeMachine.tsx ("перебрать
    // кандидатов, взять первый видимый") relies on it to pick the visible candidate the same way a
    // real browser would. Stubbed here so this unit test exercises the actual candidate-selection
    // code path instead of asserting around it; real-browser behavior is covered by e2e
    // (office-overview.spec.ts, Step 7.2).
    const offsetParentDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetParent",
    );
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() {
        return document.body;
      },
    });

    try {
      render(await HomePage({ searchParams: Promise.resolve({}) }));
      const copy = getHomepageCopy();
      fireEvent.click(screen.getByRole("link", { name: copy.secondaryCta }));

      const officeMapNav = screen.getByRole("navigation", { name: "Отделы компании" });
      const firstHotspot = within(officeMapNav).getAllByRole("button")[0];
      expect(document.activeElement).toBe(firstHotspot);
    } finally {
      if (offsetParentDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "offsetParent", offsetParentDescriptor);
      }
    }
  });

  it("the return-to-office button sends the user back to hero and moves focus to the hero heading", async () => {
    // The link lives in OfficeExperience's overview branch, alongside the office map/hint —
    // like them, it is only CSS-hidden in hero via `hiddenUntilRevealed` (real hiding verified in
    // e2e, see office-overview.spec.ts; jsdom does not apply that stylesheet rule, see the existing
    // OfficeExperience unit test comment). Here we check the structural fact the reveal logic
    // depends on (data-revealed) rather than element presence, consistent with that pattern.
    const { container } = render(await HomePage({ searchParams: Promise.resolve({}) }));
    const copy = getHomepageCopy();
    fireEvent.click(screen.getByRole("link", { name: copy.secondaryCta }));
    expect(container.querySelector("[data-revealed]")).toHaveAttribute("data-revealed", "true");

    fireEvent.click(screen.getByRole("link", { name: copy.returnToOfficeLabel }));

    expect(container.querySelector("[data-revealed]")).toHaveAttribute("data-revealed", "false");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(copy.headline);
    expect(document.activeElement?.id).toBe("hero-heading");
  });

  it("the return-to-office link is absent from a booted department-active state (it only lives above the overview grid, not in department-active — full close-then-return flow with real timers is covered by e2e office-overview.spec.ts)", async () => {
    render(await HomePage({ searchParams: Promise.resolve({ department: "sales" }) }));
    const copy = getHomepageCopy();
    expect(screen.queryByRole("link", { name: copy.returnToOfficeLabel })).not.toBeInTheDocument();
  });

  it("boots already revealed (data-revealed=true) when a ?department= param is present", async () => {
    const { container } = render(
      await HomePage({ searchParams: Promise.resolve({ department: "sales" }) }),
    );
    expect(container.querySelector("[data-revealed]")).toHaveAttribute("data-revealed", "true");
  });

  it("boots with the department itself already open when a valid ?department=<id> is given (Step 5)", async () => {
    render(await HomePage({ searchParams: Promise.resolve({ department: "sales" }) }));
    const salesDepartment = getDepartments().find((d) => d.id === "sales")!;
    expect(
      screen.getByRole("heading", { level: 2, name: salesDepartment.headline }),
    ).toBeInTheDocument();
  });

  it("degrades to overview (no department opened, no error) when ?department=<id> is invalid", async () => {
    const { container } = render(
      await HomePage({ searchParams: Promise.resolve({ department: "does-not-exist" }) }),
    );
    expect(container.querySelector("[data-revealed]")).toHaveAttribute("data-revealed", "true");
    for (const department of getDepartments()) {
      expect(
        screen.queryByRole("heading", { level: 2, name: department.headline }),
      ).not.toBeInTheDocument();
    }
  });
});
