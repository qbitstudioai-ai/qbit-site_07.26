import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlogEditor, type ArticleRecordView } from "@/features/admin/BlogEditor";
import { RelationEditor } from "@/features/admin/RelationEditor";
import {
  MAX_ARTICLE_TARGETS,
  MAX_RELATIONS,
  type ArticleRelationValue,
  type RelationOption,
} from "@/features/admin/relationTargets";

/**
 * Раздел «Блог»: редактирование связей статьи.
 *
 * Главное проверяемое свойство — НЕ внешний вид, а невозможность случайной очистки. Связи приходят
 * в редактор из серверного рендера страницы, поэтому состояния «ещё не загрузились» не существует;
 * тест следит, чтобы оно не появилось: при монтировании и открытии формы не должно уходить ни
 * одного сетевого запроса, а первое же сохранение обязано отправить именно те связи, что пришли с
 * сервера.
 *
 * Второе свойство — форма не отправляет ничего, что могло бы разойтись с этими связями: ни
 * `relatedSlugs`, ни роль, ни числовой порядок.
 */

const SOURCE_ID = "uuid-source-0001";
const TARGET_A = "uuid-target-aaaa";
const TARGET_B = "uuid-target-bbbb";
const DRAFT_TARGET = "uuid-target-draft";
const OTHER_PLACEMENT_TARGET = "uuid-target-other";
const PRODUCT_ID = "uuid-product-0001";

function articleRecord(overrides: Partial<ArticleRecordView> = {}): ArticleRecordView {
  return {
    id: SOURCE_ID,
    slug: "kak-avtomatizirovat-zayavki",
    title: "Как автоматизировать заявки",
    excerpt: "Краткое описание.",
    description: "",
    bodyMarkdown: "Текст статьи.",
    coverUrl: "",
    coverAlt: "",
    placement: "blog",
    category: "Процессы",
    tags: [],
    relatedSlugs: ["statya-a"],
    relations: [{ targetType: "article", targetId: TARGET_A }],
    author: "QBit-Studio-Ai",
    seoTitle: null,
    seoDescription: "",
    status: "published",
    isFeatured: false,
    sortOrder: 0,
    publishedAt: "2026-09-01",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

const OPTIONS: RelationOption[] = [
  {
    type: "article",
    id: SOURCE_ID,
    label: "Как автоматизировать заявки",
    detail: "/blog/kak-avtomatizirovat-zayavki",
    isPublished: true,
    placement: "blog",
  },
  {
    type: "article",
    id: TARGET_A,
    label: "Статья А",
    detail: "/blog/statya-a",
    isPublished: true,
    placement: "blog",
  },
  {
    type: "article",
    id: TARGET_B,
    label: "Статья Б",
    detail: "/blog/statya-b",
    isPublished: true,
    placement: "blog",
  },
  {
    type: "article",
    id: DRAFT_TARGET,
    label: "Черновик",
    detail: "/blog/statya-chernovik · черновик",
    isPublished: false,
    placement: "blog",
  },
  {
    type: "article",
    id: OTHER_PLACEMENT_TARGET,
    label: "Статья другого раздела",
    detail: "/blog/statya-drugogo-razdela",
    isPublished: true,
    placement: "spravochnik",
  },
  {
    type: "product",
    id: PRODUCT_ID,
    label: "AI-менеджер",
    detail: "/products/ai-menedzher-dlya-sayta",
    isPublished: true,
    placement: null,
  },
  {
    type: "case",
    id: "case-sales-call-analysis",
    label: "Анализ звонков",
    detail: "/cases/analiz-zvonkov-otdela-prodazh",
    isPublished: true,
    placement: null,
  },
  {
    type: "department",
    id: "sales",
    label: "Отдел продаж",
    detail: "отдел главной страницы",
    isPublished: true,
    placement: null,
  },
];

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Ответ `PUT`, каким его отдаёт роут: статья и ИТОГОВЫЕ связи. */
function putResponse(
  relations: { targetType: string; targetId: string }[],
  article: Partial<ArticleRecordView> = {},
) {
  return {
    ok: true,
    json: async () => ({
      article: { ...articleRecord(article), relations: undefined },
      relations: relations.map((relation, index) => ({
        ...relation,
        sourceType: "article",
        sourceId: SOURCE_ID,
        role: "related",
        sortOrder: index,
        createdAt: "2026-09-02T10:00:00.000Z",
        updatedAt: "2026-09-02T10:00:00.000Z",
      })),
    }),
  };
}

function renderEditor(articles: ArticleRecordView[] = [articleRecord()]) {
  return render(<BlogEditor articles={articles} relationOptions={OPTIONS} />);
}

function openForm() {
  fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
}

/** Все выпадающие списки выбранных связей, в порядке следования. */
function relationSelects(): HTMLSelectElement[] {
  // `queryAll`, а не `getAll`: у статьи без связей списков нет вовсе, и это нормальное состояние,
  // а не отсутствие элемента, которое должно ронять проверку.
  return screen
    .queryAllByLabelText(/^Материал \d+$/)
    .filter((element): element is HTMLSelectElement => element instanceof HTMLSelectElement);
}

function lastRequestBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.at(-1);
  return JSON.parse((call?.[1] as { body: string }).body) as Record<string, unknown>;
}

/**
 * Обёртка с состоянием для прямого рендера редактора.
 *
 * Редактор контролируемый: без хранения `value` нажатие «Добавить материал» только сообщает наверх
 * и на экране ничего не меняет. Обёртка повторяет то, что делает форма статьи, и заодно даёт
 * тестам читать итоговое значение через `onChange`.
 */
function ControlledRelationEditor({
  initial,
  options,
  placement,
  onChange,
}: {
  initial: ArticleRelationValue[];
  options: RelationOption[];
  placement: string;
  onChange?: (next: ArticleRelationValue[]) => void;
}) {
  const [value, setValue] = useState<ArticleRelationValue[]>(initial);
  return (
    <RelationEditor
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      options={options}
      currentArticleId={SOURCE_ID}
      placement={placement}
    />
  );
}

describe("связи приходят из серверного рендера", () => {
  it("существующие связи видны сразу и без единого запроса", async () => {
    renderEditor();
    openForm();

    const selects = relationSelects();
    expect(selects).toHaveLength(1);
    expect(selects[0].value).toBe(`article:${TARGET_A}`);
    // Состояния «ещё не загрузилось» не существует: за связями никто не ходил.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("первое сохранение отправляет пришедшие с сервера связи, а не пустой список", async () => {
    fetchMock.mockResolvedValue(putResponse([{ targetType: "article", targetId: TARGET_A }]));
    renderEditor();
    openForm();

    // Правится обычное поле — связи не трогаем вовсе.
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Другое название" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Сохранить" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastRequestBody().relations).toEqual([{ targetType: "article", targetId: TARGET_A }]);
  });

  it("статья без связей показывает пустой список, а не отсутствие блока", async () => {
    renderEditor([articleRecord({ relations: [], relatedSlugs: [] })]);
    openForm();

    expect(screen.getByText("Связей пока нет")).toBeInTheDocument();
    expect(relationSelects()).toHaveLength(0);
  });
});

describe("форма не отправляет конкурирующих описаний перелинковки", () => {
  it("в теле запроса нет relatedSlugs, роли и числового порядка", async () => {
    fetchMock.mockResolvedValue(putResponse([{ targetType: "article", targetId: TARGET_A }]));
    renderEditor();
    openForm();
    // Панель сохранения не даёт отправить форму без правок, поэтому правка нужна любая.
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Другое название" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Сохранить" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = lastRequestBody();
    expect(body).not.toHaveProperty("relatedSlugs");
    const relations = body.relations as Record<string, unknown>[];
    for (const relation of relations) {
      expect(Object.keys(relation).sort()).toEqual(["targetId", "targetType"]);
    }
  });

  it("второе сохранение не теряет связи: берёт их из ответа сервера", async () => {
    /**
     * Форма делает ответ сервера своим новым значением. Если бы связи в него не попали, второй
     * запрос ушёл бы с пустым списком — то есть с намеренной очисткой, которой никто не просил.
     */
    fetchMock.mockResolvedValue(putResponse([{ targetType: "article", targetId: TARGET_A }]));
    renderEditor();
    openForm();

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Первая правка" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Сохранить" })[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Ещё правка" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Сохранить" })[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(lastRequestBody().relations).toEqual([{ targetType: "article", targetId: TARGET_A }]);
  });

  it("роль и порядок не появляются даже после перестановки", async () => {
    fetchMock.mockResolvedValue(
      putResponse([
        { targetType: "article", targetId: TARGET_A },
        { targetType: "product", targetId: PRODUCT_ID },
      ]),
    );
    renderEditor();
    openForm();

    fireEvent.click(screen.getByRole("button", { name: "Добавить материал" }));
    fireEvent.click(screen.getByRole("button", { name: "Переместить материал 2 вверх" }));
    // Правка списка связей сама по себе делает форму изменённой — отдельная правка не нужна.
    fireEvent.click(screen.getAllByRole("button", { name: "Сохранить" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const relations = lastRequestBody().relations as Record<string, unknown>[];
    expect(relations).toHaveLength(2);
    // Порядок задан положением в массиве, и только им.
    expect(relations[0].targetId).not.toBe(TARGET_A);
    for (const relation of relations) {
      expect(relation).not.toHaveProperty("role");
      expect(relation).not.toHaveProperty("sortOrder");
    }
  });
});

describe("выбор цели: что предлагается человеку", () => {
  it("сама статья, черновик и статья другого раздела в список не попадают", () => {
    renderEditor([articleRecord({ relations: [] })]);
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Добавить материал" }));

    const options = within(relationSelects()[0])
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    expect(options).toContain(`article:${TARGET_A}`);
    expect(options).toContain(`article:${TARGET_B}`);
    expect(options).not.toContain(`article:${SOURCE_ID}`);
    expect(options).not.toContain(`article:${DRAFT_TARGET}`);
    expect(options).not.toContain(`article:${OTHER_PLACEMENT_TARGET}`);
  });

  it("материалы трёх остальных типов предлагаются без ограничений", () => {
    renderEditor([articleRecord({ relations: [] })]);
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Добавить материал" }));

    const options = within(relationSelects()[0])
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    expect(options).toContain(`product:${PRODUCT_ID}`);
    expect(options).toContain("case:case-sales-call-analysis");
    expect(options).toContain("department:sales");
  });

  it("набор доступных статей зависит от РАЗДЕЛА, а не только от каталога", () => {
    /**
     * Редактор рендерится напрямую с двумя РАЗНЫМИ разделами: в справочнике сайта раздел сегодня
     * ровно один, и другой через выпадающий список формы не выбрать. Прогон «blog → blog» не
     * доказывал бы ничего — он прошёл бы и при полностью удалённой фильтрации по разделу.
     */
    const availableIn = (placement: string) => {
      const view = render(
        <ControlledRelationEditor initial={[]} options={OPTIONS} placement={placement} />,
      );
      // Доступные цели видны в выпадающем списке строки, поэтому строку надо создать.
      fireEvent.click(view.getByRole("button", { name: "Добавить материал" }));
      const values = within(view.getByLabelText("Материал 1"))
        .getAllByRole("option")
        .map((option) => (option as HTMLOptionElement).value);
      view.unmount();
      return values;
    };

    const inBlog = availableIn("blog");
    const inSpravochnik = availableIn("spravochnik");

    expect(inBlog).toContain(`article:${TARGET_A}`);
    expect(inBlog).not.toContain(`article:${OTHER_PLACEMENT_TARGET}`);

    expect(inSpravochnik).toContain(`article:${OTHER_PLACEMENT_TARGET}`);
    expect(inSpravochnik).not.toContain(`article:${TARGET_A}`);
  });

  it("уже выбранное не предлагается второй раз", () => {
    renderEditor();
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Добавить материал" }));

    const secondRow = relationSelects()[1];
    const options = within(secondRow)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    expect(options).not.toContain(`article:${TARGET_A}`);
  });

  it("связь на ставший недоступным материал не исчезает молча", () => {
    /**
     * Связанную статью могли снять с публикации после того, как связь была создана. Выбросить такую
     * строку при открытии формы значило бы изменить данные простым открытием страницы. Строка
     * остаётся и помечается словом, а не цветом.
     */
    renderEditor([
      articleRecord({ relations: [{ targetType: "article", targetId: DRAFT_TARGET }] }),
    ]);
    openForm();

    expect(relationSelects()[0].value).toBe(`article:${DRAFT_TARGET}`);
    expect(screen.getByText(/Этот материал сейчас не появится/)).toBeInTheDocument();
  });
});

describe("пределы списка", () => {
  /** Каталог, где пригодных статей ЗАВЕДОМО больше предела: иначе предел нечем задеть. */
  const MANY_ARTICLES: RelationOption[] = [
    ...OPTIONS,
    ...Array.from({ length: MAX_ARTICLE_TARGETS + 2 }, (_, index) => ({
      type: "article" as const,
      id: `uuid-many-${index}`,
      label: `Статья ${index}`,
      detail: `/blog/statya-many-${index}`,
      isPublished: true,
      placement: "blog",
    })),
  ];

  const sixArticles = () =>
    Array.from({ length: MAX_ARTICLE_TARGETS }, (_, index) => ({
      targetType: "article" as const,
      targetId: `uuid-many-${index}`,
    }));

  it("при выбранном пределе строка НЕ-статьи не предлагает обменять себя на статью", () => {
    /**
     * Предел проверяется на каталоге, где пригодных статей БОЛЬШЕ шести. На каталоге из двух
     * утверждение выполнялось бы по другой причине — «свободных статей просто не осталось», — и
     * прошло бы даже при полностью удалённой проверке предела.
     *
     * Смотреть надо строку с материалом ДРУГОГО типа: строка, в которой уже стоит статья, обмен на
     * другую статью допускает законно — счёт от этого не растёт.
     */
    expect(MANY_ARTICLES.filter((option) => option.type === "article").length).toBeGreaterThan(
      MAX_ARTICLE_TARGETS + 1,
    );

    const view = render(
      <ControlledRelationEditor
        initial={[...sixArticles(), { targetType: "product", targetId: PRODUCT_ID }]}
        options={MANY_ARTICLES}
        placement="blog"
      />,
    );

    // Седьмая строка — продукт. Обмен её на статью дал бы седьмую статью, поэтому статей в её
    // списке быть не должно ни одной.
    const productRow = view.getByLabelText(`Материал ${MAX_ARTICLE_TARGETS + 1}`);
    const productRowValues = within(productRow)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);
    expect(productRowValues.filter((value) => value.startsWith("article:"))).toEqual([]);

    // А строка со статьёй обмен на другую свободную статью по-прежнему предлагает.
    const articleRow = view.getByLabelText("Материал 1");
    const articleRowValues = within(articleRow)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);
    expect(articleRowValues.filter((value) => value.startsWith("article:")).length).toBeGreaterThan(
      1,
    );

    view.unmount();
  });

  it("кнопка «Добавить» при выбранном пределе даёт материал ДРУГОГО типа, а не седьмую статью", () => {
    let current: ArticleRelationValue[] = [];

    const view = render(
      <ControlledRelationEditor
        initial={sixArticles()}
        options={MANY_ARTICLES}
        placement="blog"
        onChange={(next) => {
          current = next;
        }}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "Добавить материал" }));
    view.unmount();

    expect(current).toHaveLength(MAX_ARTICLE_TARGETS + 1);
    expect(current.filter((item) => item.targetType === "article")).toHaveLength(
      MAX_ARTICLE_TARGETS,
    );
  });

  it("кнопка добавления гаснет, когда подходящих материалов не осталось", () => {
    const relations = [
      { targetType: "article" as const, targetId: TARGET_A },
      { targetType: "article" as const, targetId: TARGET_B },
      { targetType: "product" as const, targetId: PRODUCT_ID },
      { targetType: "case" as const, targetId: "case-sales-call-analysis" },
      { targetType: "department" as const, targetId: "sales" },
    ];
    renderEditor([articleRecord({ relations })]);
    openForm();

    expect(screen.getByRole("button", { name: "Добавить материал" })).toBeDisabled();
  });

  it("пределы интерфейса совпадают с серверными", async () => {
    /**
     * Числа продублированы в клиентском модуле намеренно: серверные модули тянут доступ к базе и в
     * браузерный бандл им нельзя. Расхождение проявилось бы как отказ сохранения на форме, которая
     * ничего не запрещала, поэтому равенство закреплено здесь.
     */
    const { MAX_LEGACY_ARTICLE_TARGETS } =
      await import("@/server/repositories/articleWithRelations");
    expect(MAX_ARTICLE_TARGETS).toBe(MAX_LEGACY_ARTICLE_TARGETS);

    /**
     * Общий предел сверяется со СХЕМОЙ ЗАПРОСА, а не с литералом: экспортируемого числа у неё нет,
     * но есть поведение, и решает судьбу запроса именно оно. Сравнение `MAX_RELATIONS` с `24`
     * подтверждало бы лишь то, что строчкой выше написано `24`.
     */
    const { articleUpdateSchema } = await import("@/server/api/schemas");
    const body = (count: number) => ({
      slug: "kak-avtomatizirovat-zayavki",
      title: "Название",
      excerpt: "Анонс.",
      bodyMarkdown: "Текст.",
      placement: "blog",
      status: "draft",
      publishedAt: null,
      relations: Array.from({ length: count }, () => ({
        targetType: "department",
        targetId: "sales",
      })),
    });

    expect(articleUpdateSchema.safeParse(body(MAX_RELATIONS)).success).toBe(true);
    expect(articleUpdateSchema.safeParse(body(MAX_RELATIONS + 1)).success).toBe(false);
  });
});

describe("копия статьи", () => {
  it("создаётся без прежних адресов и без структурных связей", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ article: articleRecord({ id: "uuid-kopiya" }) }),
    });
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Копия" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = lastRequestBody();
    expect(body.relatedSlugs).toEqual([]);
    expect(body.relations).toEqual([]);
  });
});

describe("создание статьи: связей ещё не существует", () => {
  /**
   * Находка ревьюера, закрытая в этом же шаге. Редактор связей рендерился и в режиме создания, а
   * `POST` связей не принимает: владелец сайта выбирал материалы, получал «Сохранено» — и выбор
   * исчезал без единого сообщения.
   */
  function openCreateForm() {
    render(<BlogEditor articles={[]} relationOptions={OPTIONS} />);
    fireEvent.click(screen.getByRole("button", { name: "Создать статью" }));
  }

  it("редактора связей нет, вместо него объяснение", () => {
    openCreateForm();

    expect(screen.queryByRole("button", { name: "Добавить материал" })).not.toBeInTheDocument();
    expect(relationSelects()).toHaveLength(0);
    expect(screen.getByText(/Связи добавляются после создания статьи/)).toBeInTheDocument();
  });

  /**
   * От молчаливой потери выбора страхует ТОЛЬКО тест выше: здесь пользователь со связями не
   * взаимодействует, и проверка прошла бы даже с возвращённым в форму редактором. Тест всё равно
   * нужен — он стережёт форму тела запроса, — но удалять предыдущий как «дублирующий» нельзя.
   */
  it("создание не отправляет ни связей, ни прежних адресов", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ article: articleRecord({ id: "uuid-novaya" }) }),
    });
    openCreateForm();

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Новая статья" } });
    fireEvent.change(screen.getByLabelText(/^Адрес статьи/), { target: { value: "novaya" } });
    fireEvent.change(screen.getByLabelText(/^Краткий анонс/), { target: { value: "Анонс." } });
    fireEvent.change(screen.getByLabelText(/^Основной текст/), { target: { value: "Текст." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Сохранить" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("/api/admin/articles");
    expect(init.method).toBe("POST");

    const body = lastRequestBody();
    // Ни одного описания перелинковки: сервер при создании их всё равно не принимает, и отправлять
    // поле, которое будет молча отброшено, — значит обещать сохранение, которого не произойдёт.
    expect(body).not.toHaveProperty("relatedSlugs");
    expect(body).not.toHaveProperty("relations");
  });
});

describe("клавиатура", () => {
  it("после перемещения фокус остаётся на нажатой кнопке", () => {
    /**
     * Находка ревьюера, закрытая в этом же шаге. Ключ строки по идентификатору материала заставлял
     * React пересоздавать обе переставленные строки вместе с нажатой кнопкой — и фокус улетал в
     * начало длинной формы после каждого перемещения. Для работы с клавиатуры это делало
     * перестановку списка практически невозможной.
     */
    const view = render(
      <ControlledRelationEditor
        initial={[
          { targetType: "article", targetId: TARGET_A },
          { targetType: "product", targetId: PRODUCT_ID },
        ]}
        options={OPTIONS}
        placement="blog"
      />,
    );

    const moveUp = view.getByRole("button", { name: "Переместить материал 2 вверх" });
    moveUp.focus();
    expect(document.activeElement).toBe(moveUp);

    fireEvent.click(moveUp);

    // Порядок действительно изменился…
    expect(relationSelects().map((select) => select.value)).toEqual([
      `product:${PRODUCT_ID}`,
      `article:${TARGET_A}`,
    ]);
    // …и фокус остался на ТОЙ ЖЕ кнопке. Проверка тождества, а не «это вообще кнопка»: заголовок
    // теста обещает именно нажатую кнопку, и более слабое утверждение прошло бы, если бы фокус
    // перескочил на соседний элемент управления.
    expect(document.activeElement).toBe(moveUp);

    view.unmount();
  });
});
