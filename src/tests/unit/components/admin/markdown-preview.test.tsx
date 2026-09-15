import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "@/features/admin/MarkdownPreview";

/**
 * Предпросмотр статьи показывает ПУБЛИЧНОЕ тело (Amendment 61 / REL-02F.2, D7): скрытая
 * legacy-секция «Материалы по теме» вырезается тем же helper, что на сайте, и об этом есть
 * уведомление.
 */

const NOTE = "Блок «Материалы по теме» скрыт в публичной статье и управляется через «Связи».";

const TEXT = ["**Краткий ответ:**", "Текст статьи."];

describe("MarkdownPreview: скрытая legacy-секция", () => {
  it("распознанная секция вырезана, уведомление показано", () => {
    const markdown = [
      ...TEXT,
      "",
      "**Материалы по теме:**",
      "- «[Сбор заявок](/products/leads-to-crm)» — пояснение.",
    ].join("\n");
    render(<MarkdownPreview markdown={markdown} />);

    expect(screen.getByText("Краткий ответ")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(NOTE);
    expect(screen.queryByRole("heading", { name: "Материалы по теме" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Сбор заявок" })).toBeNull();
  });

  it("тело только из секции — уведомление и пустой предпросмотр", () => {
    render(
      <MarkdownPreview
        markdown={"**Материалы по теме:**\n- «[Сбор заявок](/products/leads-to-crm)» — пояснение."}
      />,
    );

    expect(screen.getByRole("note")).toHaveTextContent(NOTE);
    expect(screen.getByText(/Текст пока пуст/u)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("без секции — без уведомления", () => {
    render(<MarkdownPreview markdown={TEXT.join("\n")} />);

    expect(screen.getByText("Текст статьи.")).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("неоднозначная секция остаётся видимой, как на сайте, без уведомления", () => {
    render(
      <MarkdownPreview
        markdown={[...TEXT, "", "**Материалы по теме:**", "- просто текст без ссылки"].join("\n")}
      />,
    );

    expect(screen.getByText("Материалы по теме")).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });
});
