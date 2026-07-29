import { cache } from "react";
import seedHomepageCopy from "../../../data/homepage-copy.json";
import { homepageCopySchema } from "@/content/schema";
import type { HomepageCopy } from "@/content/types";
import { getContactByKind } from "../repositories/contacts";
import { getPageContent } from "../repositories/pageContent";

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
    headerPhone: phone ? phone.headerLabel || phone.value : copy.headerPhone,
    headerPhoneHref: phone?.href ?? copy.headerPhoneHref,
    headerPhoneAccessibleLabel: phone?.accessibleLabel || copy.headerPhoneAccessibleLabel,
    contactHref: telegram?.href ?? copy.contactHref,
  };
});
