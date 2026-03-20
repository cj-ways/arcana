import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../src/utils/frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses basic frontmatter", () => {
    const content = "---\nname: test-skill\ndescription: 'A test'\n---\n# Body";
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("test-skill");
    expect(fm.description).toBe("A test");
  });

  it("returns empty object for no frontmatter", () => {
    const fm = parseFrontmatter("# Just a heading\nSome content");
    expect(fm).toEqual({});
  });

  it("strips single quotes from values", () => {
    const content = "---\nname: 'quoted-name'\n---\n";
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("quoted-name");
  });

  it("strips double quotes from values", () => {
    const content = '---\nname: "double-quoted"\n---\n';
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("double-quoted");
  });

  it("handles multi-word values", () => {
    const content = "---\ndescription: This is a long description with many words\n---\n";
    const fm = parseFrontmatter(content);
    expect(fm.description).toBe("This is a long description with many words");
  });

  it("handles values with colons", () => {
    const content = "---\ndescription: 'Use when: the user asks'\n---\n";
    const fm = parseFrontmatter(content);
    expect(fm.description).toBe("Use when: the user asks");
  });

  it("ignores lines without colons", () => {
    const content = "---\nname: test\nthis line has no key value\ndescription: ok\n---\n";
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("test");
    expect(fm.description).toBe("ok");
  });

  it("handles allowed-tools comma-separated format", () => {
    const content = "---\nallowed-tools: Read, Grep, Glob, Bash\n---\n";
    const fm = parseFrontmatter(content);
    expect(fm["allowed-tools"]).toBe("Read, Grep, Glob, Bash");
  });

  it("handles boolean-like values", () => {
    const content = "---\ndisable-model-invocation: true\n---\n";
    const fm = parseFrontmatter(content);
    expect(fm["disable-model-invocation"]).toBe("true");
  });
});
