import { cache } from "react";
import seedHomepageCopy from "../../../data/homepage-copy.json";
import { OFFICE_MAP_HREF, OFFICE_MAP_LINK } from "@/content/officeMapLink";
import { homepageCopySchema } from "@/content/schema";
import type { HeroLink, HomepageCopy } from "@/content/types";
import { getContactByKind } from "../repositories/contacts";
import { getPageContent } from "../repositories/pageContent";

/**
 * Гарантирует пункт «Найти потери» сразу после «Главной».
 *
 * Меню шапки хранится в базе (`page_content.homepage.heroLinks`), а запись там появилась ДО этого
 * пункта. Правки одного лишь `data/homepage-copy.json` посетитель бы не увидел: seed читается
 * только когда записи в базе нет. Вариантов было два — миграция боевой базы (как
 * `scripts/homepage-cases-migration.mjs`) или досборка на чтении. Выбран второй: он не требует
 * шага на сервере при выкатке и чинит любую базу, включая базы разработчиков и тестовую.
 *
 * Условие — по `href`, а не по индексу: если владелец сайта позже переименует пункт, дубля не
 * появится. Если «Главной» в меню нет, пункт встаёт первым.
 */
function withOfficeMapLink(heroLinks: HeroLink[]): HeroLink[] {
  if (heroLinks.some((link) => link.href === OFFICE_MAP_HREF)) return heroLinks;

  const homeIndex = heroLinks.findIndex((link) => link.href === "/");
  const insertAt = homeIndex >= 0 ? homeIndex + 1 : 0;
  return [...heroLinks.slice(0, insertAt), OFFICE_MAP_LINK, ...heroLinks.slice(insertAt)];
}

/**
 * Тексты главной страницы и общей шапки сайта.
 *
 * Читает `page_content.homepage` и подставляет контакты из раздела «Контакты»: номер телефона в
 * шапке и адрес, на который ведут все CTA. Это ЕДИНСТВЕННОЕ место, где две сущности сходятся, и
 * сделано так намеренно — иначе телефон пришлось бы править дважды.
 *
 * `cache()` — дедупликация в пределах одного запроса: копию текстов запрашивают и layout, и
 * страница, и это не должно превращаться в несколько чтений базы.
 */
export const getHomepageCopy = cache((): HomepageCopy => {
  const stored = getPageContent<unknown>("homepage", seedHomepageCopy);
  const parsed = homepageCopySchema.safeParse(stored);
  // Битая или неполная запись не должна ронять весь сайт: показываем исходные тексты из seed.
  const copy: HomepageCopy = parsed.success
    ? parsed.data
    : homepageCopySchema.parse(seedHomepageCopy);

  const phone = getContactByKind("phone");
  const telegram = getContactByKind("telegram-primary");

  return {
    ...copy,
    heroLinks: withOfficeMapLink(copy.heroLinks),
    headerPhone: phone ? phone.headerLabel || phone.value : copy.headerPhone,
    headerPhoneHref: phone?.href ?? copy.headerPhoneHref,
    headerPhoneAccessibleLabel: phone?.accessibleLabel || copy.headerPhoneAccessibleLabel,
    contactHref: telegram?.href ?? copy.contactHref,
  };
});
