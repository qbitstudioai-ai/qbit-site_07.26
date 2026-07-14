// Server-only: не импортировать напрямую в "use client"-компоненты (см. DECISIONS.md, Step 2) —
// иначе zod и валидация попадут в client-бандл.
import rawHomepageCopy from "../../data/homepage-copy.json";
import { homepageCopySchema } from "./schema";
import type { HomepageCopy } from "./types";

const homepageCopy: HomepageCopy = homepageCopySchema.parse(rawHomepageCopy);

export function getHomepageCopy(): HomepageCopy {
  return homepageCopy;
}
