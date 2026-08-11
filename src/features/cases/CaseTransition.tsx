"use client";

import { Component, createRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./CasesExperience.module.css";

/**
 * Перелистывание листа при смене кейса.
 *
 * Компонент НЕ управляет навигацией и не знает ни одного адреса. Папки слева — обычные ссылки
 * Next.js, переход выполняет роутер, и содержимое досье приходит с сервера уже готовым. Здесь
 * происходит только одно: когда `transitionKey` изменился, ПРЕДЫДУЩИЙ лист задерживается на экране
 * ещё на 380 мс и уходит, а новый укладывается на его место.
 *
 * Из такого разделения следуют три свойства, ради которых оно и сделано:
 *
 *   1. Анимация — progressive enhancement. Без JS ссылки работают, документ отдаётся сервером
 *      целиком, теряется только движение.
 *   2. Адрес меняется сразу, поэтому Back/Forward и перезагрузка ведут себя как на любой обычной
 *      странице — и точно так же анимируются, потому что смена ключа приходит и из истории.
 *   3. Ни один клик не перехватывается и не откладывается: пользователь не ждёт конца анимации,
 *      чтобы попасть на страницу.
 *
 * ── Почему уходящий лист снимается с DOM, а не хранится элементом React ──────────────────────────
 *
 * Предыдущая версия держала в состоянии сам `children` — элемент, пришедший в layout от App Router.
 * Это НЕ снимок: `children` здесь не готовое дерево, а слот маршрутизатора, который при отрисовке
 * читает текущее состояние роутера. Сохранённый элемент, отрисованный заново уже после навигации,
 * показывал НОВЫЙ документ, и все 380 мс на экране было две копии нового кейса вместо старого и
 * нового. Заморозить слот можно только контекстом из внутренностей Next (`app-router-context`) —
 * это непубличный путь импорта, и раздел «Кейсы» не должен от него зависеть.
 *
 * Поэтому снимок берётся там, где прежний документ гарантированно ещё существует и уже никем не
 * управляется, — в самом DOM, в `getSnapshotBeforeUpdate`. Это единственная точка React, в которой
 * новая отрисовка уже посчитана, а старые узлы ещё на месте; ради неё компонент ниже объявлен
 * классом. Копия узлов кладётся в уходящий слой, живёт ровно один переход и удаляется вместе с ним:
 * слоем владеет React, поэтому уборка происходит при смене ключа слоя и при его снятии, а не
 * «когда-нибудь по таймеру».
 *
 * Свойства копии: `aria-hidden` + `inert` (ни скринридеру, ни Tab, ни клику), снятые `id` и ссылки
 * на них (иначе на время перехода в документе оказались бы дубли идентификаторов), сохранённая
 * прокрутка (лист уходит ровно в том виде, в каком его читали). Постоянного дубля содержимого в DOM
 * при этом не появляется: вне перехода уходящего слоя не существует вовсе.
 */

/** Длительность перелистывания. Держится в одном значении с `caseSheetLeave`/`caseSheetEnter`. */
const TURN_DURATION_MS = 380;

/**
 * Атрибуты, ссылающиеся на `id`. Снимаются вместе с самими `id`: копия — картинка, а не документ,
 * и висящая ссылка на несуществующий идентификатор в ней хуже, чем её отсутствие.
 */
const ID_REFERENCE_ATTRIBUTES = [
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-details",
  "aria-owns",
  "for",
] as const;

interface CaseTransitionProps {
  /** Меняется вместе с адресом (slug кейса либо `index` для обложки архива). */
  transitionKey: string;
  children: ReactNode;
}

/** Снимок прежнего листа: узлы, его размер и прокрутка. Живёт ровно один переход. */
interface SheetSnapshot {
  content: DocumentFragment;
  /** Размер прежнего листа в пикселях — см. `captureSheet`. */
  width: number;
  height: number;
  /** Позиция прокрутки по порядковому номеру элемента в копии. Применяется после вставки. */
  scroll: { index: number; top: number; left: number }[];
}

/**
 * Копия содержимого листа.
 *
 * Копируются ДЕТИ слоя, а не сам слой: уходящий слой уже отрисован React со своей геометрией, и
 * лишняя обёртка внутри него изменила бы размер листа во время анимации.
 *
 * ── Почему размер прежнего листа измеряется здесь ────────────────────────────────────────────────
 *
 * Уходящий слой объявлен `position: absolute; inset: 0`, то есть его размер задаёт стопка, а стопку
 * — уже НОВЫЙ документ. На desktop это безразлично: лист там всегда во всю сцену, и оба размера
 * совпадают. На мобильном (`max-width: 860px`) внутренней прокрутки у документа нет, высоту листа
 * задаёт его собственный текст, и размеры кейсов различаются в разы. Копия длинного кейса,
 * помещённая в коробку короткого, сжималась вместе с бумагой, а текст выходил за её край и все
 * 380 мс печатался прямо по фотографии стола (найдено skeptic-ревью, замер 768×1024: низ бумаги
 * 796 px, низ текста 2216 px).
 *
 * Поэтому копия получает СОБСТВЕННЫЙ размер прежнего листа: лист уходит ровно таким, каким его
 * только что видели. Берётся `offsetWidth/offsetHeight`, а не `getBoundingClientRect()`: при быстрой
 * очереди переходов на исходном листе ещё идёт `caseSheetEnter`, и прямоугольник вернул бы размер
 * КАДРА АНИМАЦИИ (лист повёрнут и отодвинут), а не листа.
 *
 * Прокрутку нельзя задать узлу, которого ещё нет в документе, — она лишь измеряется здесь, а
 * присваивается после вставки. Обход `querySelectorAll("*")` у оригинала и у копии идёт в одном
 * порядке, потому что копия — точный `cloneNode(true)`; поэтому узлы сопоставляются по номеру.
 */
function captureSheet(source: HTMLElement): SheetSnapshot | null {
  if (!source.firstElementChild) return null;

  const content = document.createDocumentFragment();
  for (const child of Array.from(source.children)) {
    content.append(child.cloneNode(true));
  }

  const originals = source.querySelectorAll("*");
  const copies = content.querySelectorAll("*");
  const scroll: SheetSnapshot["scroll"] = [];

  copies.forEach((copy, index) => {
    copy.removeAttribute("id");
    for (const attribute of ID_REFERENCE_ATTRIBUTES) copy.removeAttribute(attribute);

    const original = originals[index];
    if (!(original instanceof HTMLElement)) return;
    if (original.scrollTop === 0 && original.scrollLeft === 0) return;

    scroll.push({ index, top: original.scrollTop, left: original.scrollLeft });
  });

  return { content, width: source.offsetWidth, height: source.offsetHeight, scroll };
}

export function CaseTransition({ transitionKey, children }: CaseTransitionProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <SheetStack transitionKey={transitionKey} reducedMotion={prefersReducedMotion}>
      {children}
    </SheetStack>
  );
}

interface SheetStackProps extends CaseTransitionProps {
  /** При `true` перелистывания нет вовсе: документ сменяется сразу, уходящий слой не появляется. */
  reducedMotion: boolean;
}

interface SheetStackState {
  /** Ключ, под которым отрисован текущий лист. */
  key: string;
  /** Сквозной номер перехода. Он же ключ уходящего слоя, поэтому каждый переход получает свой. */
  turn: number;
  /** Номер перехода, чей уходящий слой сейчас на экране. `null` — переходов нет. */
  leaving: number | null;
}

class SheetStack extends Component<SheetStackProps, SheetStackState> {
  private readonly currentRef = createRef<HTMLDivElement>();
  private readonly leavingRef = createRef<HTMLDivElement>();
  private timer: number | null = null;

  state: SheetStackState = { key: this.props.transitionKey, turn: 0, leaving: null };

  /**
   * Уходящий слой объявляется В ТОЙ ЖЕ отрисовке, в которой приходит новый документ, — иначе между
   * ними был бы кадр без анимации. Номер перехода растёт на каждой смене адреса, поэтому у слоя
   * каждый раз новый ключ: React заменяет узел, и `caseSheetLeave` начинается сначала даже при
   * быстрой очереди A → B → C.
   */
  static getDerivedStateFromProps(
    props: SheetStackProps,
    state: SheetStackState,
  ): Partial<SheetStackState> | null {
    if (state.key === props.transitionKey) return null;
    if (props.reducedMotion) return { key: props.transitionKey, leaving: null };

    const turn = state.turn + 1;
    return { key: props.transitionKey, turn, leaving: turn };
  }

  /**
   * Единственный момент, когда прежний документ ещё в DOM, а новый уже посчитан. Снимок берётся
   * ровно здесь и ровно один раз за переход: признак — увеличившийся номер перехода, а не смена
   * `props`, иначе снимок обновлялся бы и на обычных перерисовках.
   */
  getSnapshotBeforeUpdate(
    _prevProps: SheetStackProps,
    prevState: SheetStackState,
  ): SheetSnapshot | null {
    if (prevState.turn === this.state.turn) return null;

    const source = this.currentRef.current;
    return source ? captureSheet(source) : null;
  }

  componentDidUpdate(
    _prevProps: SheetStackProps,
    prevState: SheetStackState,
    snapshot: SheetSnapshot | null,
  ) {
    if (prevState.turn === this.state.turn) return;

    // Снятие слоя планируется ПЕРВЫМ и не зависит от того, удался ли снимок: слой объявлен в фазе
    // отрисовки, и если бы уборка была привязана к успеху снимка, пустой слой мог бы остаться в DOM
    // до следующей навигации.
    this.scheduleRemoval(this.state.turn);

    const layer = this.leavingRef.current;
    if (!snapshot || !layer) return;

    // Собственный размер прежнего листа. Инлайн-стиль перекрывает `inset: 0`: при заданных ширине и
    // высоте `right`/`bottom` не участвуют в расчёте, поэтому копия занимает коробку СВОЕГО листа, а
    // не коробку нового. На desktop оба размера совпадают, и стиль ничего не меняет.
    layer.style.width = `${snapshot.width}px`;
    layer.style.height = `${snapshot.height}px`;

    // Вставка и восстановление прокрутки происходят до отрисовки кадра браузером, поэтому пустого
    // слоя и прыжка прокрутки пользователь не видит.
    layer.replaceChildren(snapshot.content);

    const copies = layer.querySelectorAll("*");
    for (const { index, top, left } of snapshot.scroll) {
      const copy = copies[index];
      if (!(copy instanceof HTMLElement)) continue;

      copy.scrollTop = top;
      copy.scrollLeft = left;
    }
  }

  componentWillUnmount() {
    if (this.timer !== null) window.clearTimeout(this.timer);
  }

  /**
   * Снятие уходящего слоя. Таймер ровно один: следующий переход отменяет прежний, поэтому «повисшего»
   * слоя от позапрошлого кейса не остаётся. Сверка номера — вторая защита: сработавший с опозданием
   * таймер не снимет чужой, более новый слой.
   */
  private scheduleRemoval(turn: number) {
    if (this.timer !== null) window.clearTimeout(this.timer);

    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.setState((state) => (state.leaving === turn ? { leaving: null } : null));
    }, TURN_DURATION_MS);
  }

  render() {
    const { children, transitionKey } = this.props;
    const { leaving } = this.state;

    return (
      <div
        className={styles.sheetStack}
        data-case-transition={leaving === null ? "idle" : "turning"}
      >
        {leaving === null ? null : (
          // Слой пуст в разметке: его содержимое — снимок прежнего документа, вставленный после
          // фиксации. React владеет самим слоем, поэтому копия уходит из DOM вместе с ним.
          <div
            key={leaving}
            ref={this.leavingRef}
            className={styles.sheetLeaving}
            data-case-sheet="leaving"
            aria-hidden="true"
            inert
          />
        )}

        {/* Ключ — адрес: при его смене React монтирует лист заново, поэтому `caseSheetEnter`
            начинается сначала, документ открывается с начала, а таймер печати отсчитывается для
            нового кейса. */}
        <div
          key={transitionKey}
          ref={this.currentRef}
          className={leaving === null ? styles.sheetCurrent : styles.sheetEntering}
          data-case-sheet="current"
        >
          {children}
        </div>
      </div>
    );
  }
}
