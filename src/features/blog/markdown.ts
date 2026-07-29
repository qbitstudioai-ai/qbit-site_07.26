export type BlogContentBlock =
  | { type: "paragraph"; markdown: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code"; language: string; value: string };

export type BlogSection = {
  id: string;
  heading: string;
  blocks: BlogContentBlock[];
};

function headingId(heading: string, index: number) {
  const normalized = heading
    .toLocaleLowerCase("ru")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `section-${index + 1}`;
}

export function parseBlogMarkdown(markdown: string): BlogSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: BlogSection[] = [];
  let current: BlogSection | undefined;
  let index = 0;

  const ensureSection = () => {
    if (!current) {
      current = {
        id: `section-${sections.length + 1}`,
        heading: "Материал",
        blocks: [],
      };
      sections.push(current);
    }
    return current;
  };

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^\*\*([^*]+?)(?::)?\*\*\s*(.*)$/u);
    if (headingMatch) {
      current = {
        id: headingId(headingMatch[1], sections.length),
        heading: headingMatch[1],
        blocks: [],
      };
      sections.push(current);
      if (headingMatch[2]) {
        current.blocks.push({ type: "paragraph", markdown: headingMatch[2] });
      }
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      ensureSection().blocks.push({
        type: "code",
        language,
        value: code.join("\n"),
      });
      continue;
    }

    const unorderedMatch = trimmed.match(/^-\s+(.+)$/u);
    if (unorderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].trim().match(/^-\s+(.+)$/u);
        if (!itemMatch) break;
        items.push(itemMatch[1].replace(/\s{2,}$/u, ""));
        index += 1;
      }
      ensureSection().blocks.push({ type: "unordered-list", items });
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/u);
    if (orderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].trim().match(/^\d+\.\s+(.+)$/u);
        if (!itemMatch) break;
        items.push(itemMatch[1].replace(/\s{2,}$/u, ""));
        index += 1;
      }
      ensureSection().blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraph: string[] = [trimmed.replace(/\s{2,}$/u, "")];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (
        !next ||
        /^\*\*([^*]+?)(?::)?\*\*/u.test(next) ||
        next.startsWith("```") ||
        /^-\s+/u.test(next) ||
        /^\d+\.\s+/u.test(next)
      ) {
        break;
      }
      paragraph.push(next.replace(/\s{2,}$/u, ""));
      index += 1;
    }
    ensureSection().blocks.push({
      type: "paragraph",
      markdown: paragraph.join(" "),
    });
  }

  return sections;
}
