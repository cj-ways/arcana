/**
 * Parse YAML frontmatter from a SKILL.md or agent .md file.
 * Supports the subset used across Arcana and common imported skills:
 * plain scalars, quoted scalars, block scalars, and top-level lists.
 */
export function parseFrontmatter(content) {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return {};

  const fm = Object.create(null);
  const lines = match[1].split("\n");

  function stripQuotes(value) {
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1).replace(/''/g, "'");
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1).replace(/\\"/g, '"');
    }
    return value;
  }

  function normalizeInlineValue(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return trimmed.slice(1, -1).trim();
    }
    return stripQuotes(trimmed);
  }

  function readIndentedValue(startIndex) {
    if (startIndex >= lines.length || !/^\s/.test(lines[startIndex])) {
      return { value: "", nextIndex: startIndex };
    }

    const isList = /^\s*-\s?/.test(lines[startIndex]);
    const collected = [];
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        if (!isList) collected.push("");
        i++;
        continue;
      }
      if (!/^\s/.test(line)) break;

      if (isList) {
        const itemMatch = line.match(/^\s*-\s?(.*)$/);
        if (!itemMatch) break;
        collected.push(normalizeInlineValue(itemMatch[1]));
      } else {
        collected.push(line.replace(/^\s+/, ""));
      }
      i++;
    }

    return {
      value: isList ? collected.filter(Boolean).join(", ") : collected.join("\n").trimEnd(),
      nextIndex: i,
    };
  }

  function readBlockScalar(startIndex, style) {
    const collected = [];
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        collected.push("");
        i++;
        continue;
      }
      if (!/^\s/.test(line)) break;
      collected.push(line.replace(/^\s+/, ""));
      i++;
    }

    if (style === ">") {
      const paragraphs = [];
      let current = [];
      for (const line of collected) {
        if (line === "") {
          if (current.length > 0) {
            paragraphs.push(current.join(" ").trim());
            current = [];
          }
          continue;
        }
        current.push(line.trim());
      }
      if (current.length > 0) paragraphs.push(current.join(" ").trim());
      return { value: paragraphs.join("\n"), nextIndex: i };
    }

    return { value: collected.join("\n").trimEnd(), nextIndex: i };
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#") || /^\s/.test(line)) {
      i++;
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    if (!key) {
      i++;
      continue;
    }

    const remainder = line.slice(colonIndex + 1).trim();
    i++;

    if (remainder === "|" || remainder === ">") {
      const result = readBlockScalar(i, remainder);
      fm[key] = result.value;
      i = result.nextIndex;
      continue;
    }

    if (remainder === "") {
      const result = readIndentedValue(i);
      fm[key] = result.value;
      i = result.nextIndex;
      continue;
    }

    fm[key] = normalizeInlineValue(remainder);
  }

  return fm;
}
