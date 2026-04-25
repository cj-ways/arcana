import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  MAX_FETCH_SIZE,
  fetchGitHubSkill,
  fetchGitHubTree,
  fetchUrl,
  listGitHubSkills,
  resolveSource,
  validateFrontmatter,
  extractSkillPaths,
  resolveSkillPath,
} from "../src/commands/import.js";

function createResponse({
  ok = true,
  status = 200,
  statusText = "OK",
  text = "",
  headers = {},
} = {}) {
  return {
    ok,
    status,
    statusText,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null;
      },
    },
    text: vi.fn().mockResolvedValue(text),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveSource", () => {
  it("resolves local path starting with ./", () => {
    const result = resolveSource("./my-skill", null);
    expect(result).toEqual({ type: "local", path: "./my-skill" });
  });

  it("resolves local path starting with /", () => {
    const result = resolveSource("/absolute/path", null);
    expect(result).toEqual({ type: "local", path: "/absolute/path" });
  });

  it("resolves local path starting with ../", () => {
    const result = resolveSource("../parent/skill", null);
    expect(result).toEqual({ type: "local", path: "../parent/skill" });
  });

  it("resolves raw HTTPS .md URL", () => {
    const result = resolveSource("https://example.com/SKILL.md", null);
    expect(result).toEqual({ type: "url", url: "https://example.com/SKILL.md" });
  });

  it("rejects HTTP .md URL (not HTTPS)", () => {
    const result = resolveSource("http://example.com/SKILL.md", null);
    expect(result).toBeNull();
  });

  it("resolves GitHub tree URL", () => {
    const result = resolveSource("https://github.com/owner/repo/tree/main/skills/my-skill", null);
    expect(result).not.toBeNull();
    expect(result.type).toBe("github-skill");
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
    expect(result.branch).toBe("main");
    expect(result.name).toBe("my-skill");
    expect(result.path).toBe("skills/my-skill");
  });

  it("strips query strings from GitHub tree URL", () => {
    const result = resolveSource("https://github.com/owner/repo/tree/main/skills/name?tab=readme", null);
    expect(result).not.toBeNull();
    expect(result.type).toBe("github-skill");
    expect(result.name).toBe("name");
  });

  it("strips fragment from GitHub tree URL", () => {
    const result = resolveSource("https://github.com/owner/repo/tree/main/skills/name#section", null);
    expect(result).not.toBeNull();
    expect(result.name).toBe("name");
  });

  it("rejects GitHub tree URL with .. in path", () => {
    const result = resolveSource("https://github.com/owner/repo/tree/main/../../secret", null);
    expect(result).toBeNull();
  });

  it("rejects invalid GitHub owner slug", () => {
    const result = resolveSource("https://github.com/owner?inject/repo/tree/main/skills/s", null);
    expect(result).toBeNull();
  });

  it("resolves GitHub repo URL", () => {
    const result = resolveSource("https://github.com/owner/repo", "skill-name");
    expect(result).not.toBeNull();
    expect(result.type).toBe("github-repo");
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
    expect(result.skillName).toBe("skill-name");
  });

  it("resolves GitHub repo URL with trailing slash", () => {
    const result = resolveSource("https://github.com/owner/repo/", null);
    expect(result).not.toBeNull();
    expect(result.type).toBe("github-repo");
  });

  it("strips .git suffix from repo URL", () => {
    const result = resolveSource("https://github.com/owner/repo.git", null);
    expect(result).not.toBeNull();
    expect(result.repo).toBe("repo");
  });

  it("resolves owner/repo short form", () => {
    const result = resolveSource("anthropics/skills", "claude-api");
    expect(result).not.toBeNull();
    expect(result.type).toBe("github-repo");
    expect(result.owner).toBe("anthropics");
    expect(result.repo).toBe("skills");
    expect(result.skillName).toBe("claude-api");
  });

  it("rejects invalid owner in short form", () => {
    const result = resolveSource("owner?bad/repo", null);
    expect(result).toBeNull();
  });

  it("returns null for unrecognized input", () => {
    expect(resolveSource("just-a-word", null)).toBeNull();
    expect(resolveSource("", null)).toBeNull();
  });
});

describe("validateFrontmatter", () => {
  it("returns no issues for valid frontmatter", () => {
    const issues = validateFrontmatter({ name: "my-skill", description: "Does things" });
    expect(issues).toEqual([]);
  });

  it("reports missing name", () => {
    const issues = validateFrontmatter({ description: "ok" });
    expect(issues).toContain("Missing 'name' field");
  });

  it("reports missing description", () => {
    const issues = validateFrontmatter({ name: "my-skill" });
    expect(issues).toContain("Missing 'description' field");
  });

  it("reports non-kebab-case name", () => {
    const issues = validateFrontmatter({ name: "MySkill", description: "ok" });
    expect(issues.some((i) => i.includes("not lowercase-kebab-case"))).toBe(true);
  });

  it("reports name exceeding 64 chars", () => {
    const issues = validateFrontmatter({ name: "a".repeat(65), description: "ok" });
    expect(issues.some((i) => i.includes("exceeds 64 characters"))).toBe(true);
  });

  it("reports description exceeding 1024 chars", () => {
    const issues = validateFrontmatter({ name: "my-skill", description: "x".repeat(1025) });
    expect(issues.some((i) => i.includes("exceeds 1024 characters"))).toBe(true);
  });

  it("accepts single-segment kebab name", () => {
    const issues = validateFrontmatter({ name: "skill", description: "ok" });
    expect(issues).toEqual([]);
  });

  it("rejects name with underscores", () => {
    const issues = validateFrontmatter({ name: "my_skill", description: "ok" });
    expect(issues.some((i) => i.includes("not lowercase-kebab-case"))).toBe(true);
  });
});

describe("extractSkillPaths", () => {
  it("extracts skill directories from recursive Git trees", () => {
    const paths = extractSkillPaths([
      { path: "skills/quick-review/SKILL.md", type: "blob" },
      { path: "skills/.curated/gh-address-comments/SKILL.md", type: "blob" },
      { path: "skills/.experimental/create-plan/SKILL.md", type: "blob" },
      { path: "README.md", type: "blob" },
      { path: "skills", type: "tree" },
    ]);

    expect(paths).toEqual([
      ".curated/gh-address-comments",
      ".experimental/create-plan",
      "quick-review",
    ]);
  });

  it("includes root-level SKILL.md for single-skill repos", () => {
    const paths = extractSkillPaths([{ path: "SKILL.md", type: "blob" }]);
    expect(paths).toEqual(["."]);
  });
});

describe("resolveSkillPath", () => {
  const availablePaths = [
    "quick-review",
    ".curated/gh-address-comments",
    ".experimental/create-plan",
  ];

  it("resolves an exact nested path", () => {
    expect(resolveSkillPath(".curated/gh-address-comments", availablePaths)).toBe(".curated/gh-address-comments");
  });

  it("resolves a unique basename match", () => {
    expect(resolveSkillPath("create-plan", availablePaths)).toBe(".experimental/create-plan");
  });

  it("resolves basename matches in curated catalogs", () => {
    expect(resolveSkillPath("gh-address-comments", availablePaths)).toBe(".curated/gh-address-comments");
  });

  it("returns null when no match exists", () => {
    expect(resolveSkillPath("nonexistent", availablePaths)).toBeNull();
  });
});

describe("fetchUrl", () => {
  it("returns null on GitHub API rate limiting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const content = await fetchUrl("https://api.github.com/repos/owner/repo", null);
    expect(content).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when fetch times out", async () => {
    const error = new Error("The operation was aborted due to timeout");
    error.name = "TimeoutError";
    const fetchMock = vi.fn().mockRejectedValue(error);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    const content = await fetchUrl("https://example.com/SKILL.md", null);
    expect(content).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("rejects oversized responses by content-length", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        headers: { "content-length": String(MAX_FETCH_SIZE + 1) },
        text: "ignored",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const content = await fetchUrl("https://example.com/SKILL.md", null);
    expect(content).toBeNull();
  });
});

describe("GitHub import helpers", () => {
  it("lists skills from a mocked recursive tree without network access", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        text: JSON.stringify({
          truncated: false,
          tree: [
            { path: "skills/quick-review/SKILL.md", type: "blob" },
            { path: "skills/.curated/gh-address-comments/SKILL.md", type: "blob" },
          ],
        }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const paths = await listGitHubSkills("owner", "repo");
    expect(paths).toEqual([".curated/gh-address-comments", "quick-review"]);
  });

  it("returns null when the recursive tree response is rate-limited", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const tree = await fetchGitHubTree("owner", "repo", "main");
    expect(tree).toBeNull();

    const paths = await listGitHubSkills("owner", "repo");
    expect(paths).toBeNull();
  });

  it("fetches a nested GitHub skill via recursive tree discovery", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({ ok: false, status: 404, statusText: "Not Found" }),
      )
      .mockResolvedValueOnce(
        createResponse({ ok: false, status: 404, statusText: "Not Found" }),
      )
      .mockResolvedValueOnce(
        createResponse({
          text: JSON.stringify({
            truncated: false,
            tree: [
              {
                path: "skills/.curated/gh-address-comments/SKILL.md",
                type: "blob",
              },
            ],
          }),
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          text: "---\nname: gh-address-comments\ndescription: Test\n---\n# Body",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGitHubSkill(
      "openai",
      "skills",
      "gh-address-comments",
    );

    expect(result).toMatchObject({
      branch: "main",
      path: ".curated/gh-address-comments",
    });
    expect(result.content).toContain("name: gh-address-comments");
  });
});
