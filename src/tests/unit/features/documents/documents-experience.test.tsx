import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentItem } from "@/features/documents/documents";
import { DocumentsExperience } from "@/features/documents/DocumentsExperience";

const catalog: DocumentItem[] = [
  {
    id: "ustav",
    title: "Устав QBit",
    description: "Учредительный документ компании.",
    category: "legal",
    fileType: "pdf",
    fileSize: 1_887_437,
    updatedAt: "2026-07-18",
    fileUrl: "/dox/files/ustav-qbit.pdf",
    previewUrl: "/dox/previews/ustav-qbit.svg",
    sortOrder: 10,
  },
  {
    id: "projects",
    title: "Реализованные проекты QBit",
    category: "projects",
    fileType: "xlsx",
    fileUrl: "/dox/files/delivered-projects.xlsx",
    sortOrder: 20,
  },
  {
    id: "long-title",
    title:
      "Регламент взаимодействия с подрядчиками при внедрении автоматизации бизнес-процессов компании",
    category: "projects",
    fileType: "docx",
    fileUrl: "/dox/files/automation-in-progress.docx",
    sortOrder: 30,
  },
];

const defaultProps = {
  taskCtaLabel: "Получить бесплатный разбор",
  taskCtaHref: "https://t.me/Promt_Pavel",
  categories: [
    { id: "legal", label: "Юридические" },
    { id: "projects", label: "Проекты" },
  ],
  pageCopy: {
    headline: "Документы",
    subheading: "Корпоративные материалы, презентации и официальные файлы QBit",
    emptyMessage: "Документы пока не опубликованы",
    seoDescription: "Документы QBit-Studio-Ai",
  },
};

const listItems = () => screen.getByRole("list").querySelectorAll("button");

describe("DocumentsExperience", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("делает первый документ активным сразу и показывает его предпросмотр", () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={catalog} />);

    expect(screen.getByRole("heading", { level: 1, name: "Документы" })).toBeInTheDocument();
    expect(listItems()[0]).toHaveAttribute("aria-current", "true");
    expect(document.querySelector('[data-document-preview="ustav"]')).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Устав QBit" })).toBeInTheDocument();
    expect(screen.getByText("PDF · 1,8 МБ · обновлено 18 июля 2026")).toBeInTheDocument();
  });

  it("переключает активный документ по клику, а не по наведению", async () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={catalog} />);
    const [, second] = Array.from(listItems());

    fireEvent.mouseEnter(second);
    expect(document.querySelector('[data-document-preview="ustav"]')).toBeInTheDocument();

    fireEvent.click(second);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(second).toHaveAttribute("aria-current", "true");
    expect(document.querySelector('[data-document-preview="projects"]')).toBeInTheDocument();
    expect(document.querySelector('[data-document-preview="ustav"]')).not.toBeInTheDocument();
  });

  it("даёт кнопку скачивания с реальной ссылкой и второе действие «открыть полностью»", () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={catalog} />);

    const download = screen.getByRole("link", { name: /Скачать документ/ });
    expect(download).toHaveAttribute("href", "/dox/files/ustav-qbit.pdf");
    expect(download).toHaveAttribute("download");

    const openFull = screen.getByRole("link", { name: "Открыть полностью" });
    expect(openFull).toHaveAttribute("href", "/dox/files/ustav-qbit.pdf");
    expect(openFull).toHaveAttribute("target", "_blank");
  });

  it("показывает заглушку формата, когда предпросмотра нет", async () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={catalog} />);

    fireEvent.click(Array.from(listItems())[1]);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    const fallback = document.querySelector("[data-document-fallback]");
    expect(fallback).toBeInTheDocument();
    expect(within(fallback as HTMLElement).getByText("XLSX")).toBeInTheDocument();
    expect(
      within(fallback as HTMLElement).getByText("Предпросмотр недоступен"),
    ).toBeInTheDocument();
  });

  it("переходит на заглушку, если изображение предпросмотра не загрузилось", () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={catalog} />);

    const image = screen.getByRole("img", { name: /Первая страница документа/ });
    fireEvent.error(image);

    expect(document.querySelector("[data-document-fallback]")).toBeInTheDocument();
  });

  it("фильтрует список по категории и активирует первый доступный документ", async () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={catalog} />);

    fireEvent.click(screen.getByRole("button", { name: "Проекты" }));

    await waitFor(() => expect(listItems()).toHaveLength(2));
    expect(document.querySelector('[data-document-preview="projects"]')).toBeInTheDocument();
    expect(screen.queryByText("Устав QBit")).not.toBeInTheDocument();
  });

  it("не ломается на записи без описания, размера и даты", async () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={catalog} />);

    fireEvent.click(Array.from(listItems())[1]);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    const meta = document.querySelector("[data-document-meta]") as HTMLElement;
    // Ни «undefined», ни висящих разделителей: строка фактов состоит из одного формата.
    expect(within(meta).getByText("XLSX")).toBeInTheDocument();
    expect(within(meta).queryByText(/·/)).not.toBeInTheDocument();
  });

  it("рендерит длинное название целиком в разметке", () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={catalog} />);

    expect(screen.getByText(catalog[2].title)).toBeInTheDocument();
  });

  it("выдерживает каталог из двадцати документов", () => {
    const many: DocumentItem[] = Array.from({ length: 20 }, (_, index) => ({
      id: `doc-${index}`,
      title: `Документ номер ${index + 1}`,
      category: index % 2 === 0 ? "legal" : "projects",
      fileType: "pdf",
      fileUrl: `/dox/files/doc-${index}.pdf`,
      sortOrder: index,
    }));

    render(<DocumentsExperience {...defaultProps} initialDocuments={many} />);

    expect(listItems()).toHaveLength(20);
    expect(Array.from(listItems())[0]).toHaveAttribute("aria-current", "true");
  });

  it("показывает спокойное сообщение, когда документов нет", () => {
    render(<DocumentsExperience {...defaultProps} initialDocuments={[]} />);

    expect(screen.getByText("Документы пока не опубликованы")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("DocumentsExperience без серверных данных (загрузка через API)", () => {
  it("показывает загрузку, затем каталог из loadDocuments()", async () => {
    // `loadDocuments()` спрашивает публичный API. В jsdom сервера нет, поэтому ответ подставляется
    // вручную — проверяется поведение экрана, а не сеть.
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ documents: catalog, categories: defaultProps.categories }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<DocumentsExperience {...defaultProps} initialDocuments={null} />);

    expect(screen.getByText("Загружаем документы")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());
    expect(within(screen.getByRole("list")).getByText("Устав QBit")).toBeInTheDocument();
  });

  it("показывает ошибку и повторяет загрузку по кнопке", async () => {
    const documentsModule = await import("@/features/documents/documents");
    const loadSpy = vi
      .spyOn(documentsModule, "loadDocuments")
      .mockRejectedValueOnce(new Error("network"));

    render(<DocumentsExperience {...defaultProps} initialDocuments={null} />);

    await waitFor(() =>
      expect(screen.getByText("Не удалось загрузить документы")).toBeInTheDocument(),
    );

    loadSpy.mockResolvedValueOnce(catalog);
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());
    loadSpy.mockRestore();
  });
});
