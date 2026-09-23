"use client";

import { useMemo } from "react";
import styles from "./admin.module.css";
import {
  MAX_ARTICLE_TARGETS,
  MAX_RELATIONS,
  type ArticleRelationValue,
  type RelationEntityType,
  type RelationOption,
} from "./relationTargets";

/**
 * Редактор связей материала: «что показать рядом с этой статьёй».
 *
 * Заменяет прежнее поле со списком адресов через запятую. Прежнее поле требовало от владельца сайта
 * помнить адреса наизусть и молча принимало опечатку: связь с несуществующим адресом выглядела
 * сохранённой, а на странице не появлялась. Здесь материал ВЫБИРАЕТСЯ из списка, поэтому связь либо
 * ведёт на существующий материал, либо её нет.
 *
 * ЧТО ЭТОТ РЕДАКТОР НЕ ДЕЛАЕТ. Он не составляет прежнюю колонку `articles.related_slugs`: её
 * выводит сервер из выбранных здесь связей. Иначе форма могла бы прислать одну структуру в связях и
 * другую в адресах, и две модели разошлись бы в пределах одного сохранения.
 *
 * РОЛЬ СВЯЗИ И ПОРЯДОК СОРТИРОВКИ ЗДЕСЬ НЕ ЗАДАЮТСЯ. Роль (`primary`/`related`) сегодня не читает
 * ни один модуль сайта, поэтому спрашивать её у человека — значит просить решение, на которое
 * ничто не опирается; сервер подставляет «связанный». Порядок задаётся положением в списке, и
 * отдельного числового поля для него нет: две записи одного и того же порядка (позиция и число)
 * рано или поздно разошлись бы.
 *
 * ДОСТУПНОСТЬ. Список — `fieldset` с `legend`, каждая строка — обычный `select` с подписью, кнопки
 * перемещения и удаления имеют текстовые `aria-label` с номером строки. Разметка намеренно
 * повторяет `ListEditor` из `formKit.tsx`: тот же «язык» интерфейса, те же классы, то же поведение
 * с клавиатуры. Своим компонентом это сделано потому, что `ListEditor` добавляет пункты безусловно,
 * а здесь добавление обязано упираться в пределы списка и в отсутствие свободных материалов.
 */

const TYPE_GROUP_LABELS: Readonly<Record<RelationEntityType, string>> = {
  article: "Статьи",
  product: "Продукты",
  case: "Кейсы",
  department: "Отделы",
};

const TYPE_ORDER: readonly RelationEntityType[] = ["article", "product", "case", "department"];

const optionKey = (type: RelationEntityType, id: string) => `${type}:${id}`;
const valueKey = (value: ArticleRelationValue) => optionKey(value.targetType, value.targetId);

/**
 * Можно ли выбрать материал целью.
 *
 * Ограничения — только для статей и ровно те, что проверяет сервер: не сама эта статья, только
 * опубликованная, только того же раздела сайта. Причина не в аккуратности формы: пока публичный
 * блок «материалы по теме» читает прежнюю колонку, он показывает именно такие статьи и молча
 * пропускает остальные. Связь, которую блок заведомо не покажет, — тихая пропажа, а не связь.
 *
 * Раздел сверяется с ТЕКУЩИМ значением поля формы, а не с сохранённым: если владелец сайта тут же
 * переносит статью в другой раздел, выбирать надо из материалов раздела назначения.
 *
 * Отдел с Amendment 64 ограничен публикацией — и только ею: публичный блок отбирает отделы тем же
 * условием `is_published = 1`, а его страница `/solutions/<slug>` у снятого с публикации отдела
 * отвечает 404. Раздела сайта у отдела нет, поэтому сверять с `placement` нечего.
 *
 * Продукты и кейсы не ограничиваются ничем: их связи публичный сайт пока не читает, и правило,
 * придуманное раньше потребителя, было бы догадкой.
 */
function isSelectable(
  option: RelationOption,
  currentArticleId: string | null,
  placement: string,
): boolean {
  if (option.type === "department") return option.isPublished;
  if (option.type !== "article") return true;
  if (option.id === currentArticleId) return false;
  if (!option.isPublished) return false;
  return option.placement === placement;
}

interface RelationEditorProps {
  value: readonly ArticleRelationValue[];
  onChange: (next: ArticleRelationValue[]) => void;
  options: readonly RelationOption[];
  /** Идентификатор редактируемой статьи. `null` у ещё не созданной. */
  currentArticleId: string | null;
  /** Текущее значение поля «Раздел сайта» в этой же форме. */
  placement: string;
  error?: string;
}

export function RelationEditor({
  value,
  onChange,
  options,
  currentArticleId,
  placement,
  error,
}: RelationEditorProps) {
  const byKey = useMemo(
    () => new Map(options.map((option) => [optionKey(option.type, option.id), option])),
    [options],
  );

  const selectable = useMemo(
    () => options.filter((option) => isSelectable(option, currentArticleId, placement)),
    [options, currentArticleId, placement],
  );

  const chosenKeys = new Set(value.map(valueKey));
  const articleCount = value.filter((item) => item.targetType === "article").length;

  /**
   * Материалы, доступные КОНКРЕТНОЙ строке.
   *
   * Уже выбранное в других строках исключается: повтор одной цели сервер отвергает как ошибку
   * ввода, и предлагать его в списке значило бы вести к заведомому отказу.
   *
   * Текущее значение строки добавляется ВСЕГДА, даже если материал больше не подходит — например,
   * связанную статью сняли с публикации или перенесли в другой раздел. Молча выбросить такую строку
   * значило бы изменить данные при простом открытии формы. Строка остаётся видимой и помеченной,
   * а решение — снять её или вернуть цель в публикацию — принимает человек.
   */
  const optionsForRow = (item: ArticleRelationValue): { value: string; label: string }[] => {
    const currentKey = valueKey(item);
    const known = byKey.get(currentKey);
    const allowMoreArticles = item.targetType === "article" || articleCount < MAX_ARTICLE_TARGETS;

    const free = selectable.filter((option) => {
      const key = optionKey(option.type, option.id);
      if (key === currentKey) return false;
      if (chosenKeys.has(key)) return false;
      return option.type !== "article" || allowMoreArticles;
    });

    const currentEntry = {
      value: currentKey,
      label: known
        ? optionLabel(known, isSelectable(known, currentArticleId, placement))
        : `Материал удалён (${currentKey})`,
    };

    const grouped = TYPE_ORDER.flatMap((type) => {
      const forType = free.filter((option) => option.type === type);
      return forType.map((option) => ({
        value: optionKey(option.type, option.id),
        label: `${TYPE_GROUP_LABELS[type]} · ${optionLabel(option, true)}`,
      }));
    });

    return [currentEntry, ...grouped];
  };

  const freeForAdd = selectable.filter((option) => {
    if (chosenKeys.has(optionKey(option.type, option.id))) return false;
    return option.type !== "article" || articleCount < MAX_ARTICLE_TARGETS;
  });

  const nextToAdd = freeForAdd[0];
  const isFull = value.length >= MAX_RELATIONS;
  const canAdd = !isFull && nextToAdd !== undefined;

  const replaceAt = (index: number, key: string) => {
    const [targetType, ...rest] = key.split(":");
    const next = [...value];
    next[index] = { targetType: targetType as RelationEntityType, targetId: rest.join(":") };
    onChange(next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;

    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <fieldset className={styles.field}>
      <legend className={styles.label}>Материалы по теме</legend>
      <span className={styles.hint}>
        Показываются рядом со статьёй. Порядок в списке — порядок на странице. Статей не больше{" "}
        {MAX_ARTICLE_TARGETS}, материалов всего не больше {MAX_RELATIONS}.
      </span>

      {value.length === 0 ? (
        <p className={styles.messageEmpty}>Связей пока нет</p>
      ) : (
        <div className={styles.listEditor}>
          {value.map((item, index) => {
            const known = byKey.get(valueKey(item));
            const unavailable = known
              ? !isSelectable(known, currentArticleId, placement)
              : /* удалённый материал */ true;

            return (
              /*
                Ключ — ПОЗИЦИЯ, а не идентификатор материала, и это ровно тот случай, когда
                позиционный ключ верен, а «стабильный» ломает.

                Перестановка меняет содержимое двух строк, но не их количество и не их роли на
                экране. Ключ по материалу заставил бы React размонтировать обе строки и собрать
                заново — вместе с нажатой кнопкой, а с ней и с фокусом: работающий с клавиатуры
                улетал бы в начало формы после каждого перемещения. Измерено, закрыто тестом на
                `document.activeElement`. Так же сделан `ListEditor` в `formKit.tsx`.
              */
              <div className={styles.listItem} key={index}>
                <div className={styles.listItemBody}>
                  <span className={styles.listIndex}>{index + 1}</span>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`relation-${index}`}>
                      Материал {index + 1}
                    </label>
                    <select
                      id={`relation-${index}`}
                      className={styles.select}
                      value={valueKey(item)}
                      onChange={(event) => replaceAt(index, event.target.value)}
                    >
                      {optionsForRow(item).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {unavailable ? (
                      <span className={styles.hint}>
                        {known?.type === "department"
                          ? "Этот отдел снят с публикации: его страница отвечает 404, и в блоке на странице он не появится. Снимите связь или опубликуйте отдел."
                          : "Этот материал сейчас не появится в блоке на странице. Снимите связь или опубликуйте материал в этом разделе — иначе сохранение будет отклонено."}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className={styles.listItemControls}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSmall}`}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Переместить материал ${index + 1} вверх`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSmall}`}
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label={`Переместить материал ${index + 1} вниз`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${styles.buttonDanger} ${styles.buttonSmall}`}
                    onClick={() => onChange(value.filter((_, position) => position !== index))}
                    aria-label={`Удалить материал ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className={styles.button}
        disabled={!canAdd}
        onClick={() => {
          if (!nextToAdd) return;
          onChange([...value, { targetType: nextToAdd.type, targetId: nextToAdd.id }]);
        }}
      >
        Добавить материал
      </button>

      {!canAdd ? (
        <span className={styles.hint}>
          {isFull
            ? `Достигнут предел в ${MAX_RELATIONS} материалов.`
            : "Подходящих материалов больше нет: остальные уже выбраны, скрыты или относятся к другому разделу."}
        </span>
      ) : null}

      {error ? (
        <strong className={styles.fieldError} role="alert">
          {error}
        </strong>
      ) : null}
    </fieldset>
  );
}

/** Название материала для списка: заголовок и уточнение, по которому его узнают. */
function optionLabel(option: RelationOption, available: boolean): string {
  const detail = option.detail ? ` (${option.detail})` : "";
  // Пометка словом, а не цветом: список читают и через скринридер.
  const marker = available ? "" : " — недоступен";
  return `${option.label}${detail}${marker}`;
}
