export const REPO_STONES_OPERATION_VERSION = "0.2.1";

// ---------------------------------------------------------------------------
// Chain naming — preferred format: owner/repo
// ---------------------------------------------------------------------------
export function canonicalChain(owner, repo, override) {
  if (typeof override === "string" && override.trim()) return override.trim();
  return `${owner}/${repo}`;
}

// ---------------------------------------------------------------------------
// Accept-list: extensions that identify text/source content worth stoning.
// ---------------------------------------------------------------------------
export const DEFAULT_REPO_STONE_EXTENSIONS = [
  // Prose / documentation
  ".md", ".mdx", ".txt", ".rst", ".adoc",
  // Config & data serialisation
  ".json", ".jsonc", ".toml", ".yml", ".yaml", ".ini", ".cfg", ".conf",
  // Web
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".css", ".html", ".htm", ".vue", ".svelte",
  // Systems / compiled languages
  ".rs", ".go", ".java", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx",
  ".cs", ".php", ".rb", ".lua", ".swift", ".kt", ".kts", ".scala",
  // Scripting
  ".sh", ".bash", ".zsh", ".fish", ".ps1", ".py", ".pyw", ".r", ".R",
  // Data / query
  ".sql", ".graphql", ".gql", ".proto",
  // Infrastructure
  ".tf", ".hcl", ".dockerfile", ".mod", ".sum",
  // Misc text
  ".env.example", ".editorconfig", ".gitignore", ".gitattributes", ".dockerignore",
  ".npmignore", ".eslintrc", ".prettierrc", ".babelrc", ".clang-format", ".clang-tidy",
];

// ---------------------------------------------------------------------------
// Extensionless filenames always accepted (lower-cased for comparison).
// ---------------------------------------------------------------------------
export const REPO_STONE_EXACT_NAMES = new Set([
  "dockerfile", "makefile", "procfile", "justfile", "gemfile", "rakefile",
  "requirements.txt", "package.json", "cargo.toml", "wrangler.toml",
  "go.mod", "go.sum", "pyproject.toml", "setup.cfg", "setup.py",
  "pipfile", "poetry.lock",
  // dotfiles that matter
  ".gitignore", ".dockerignore", ".gitattributes", ".editorconfig",
  ".npmignore", ".eslintrc", ".prettierrc", ".babelrc",
  ".clang-format", ".clang-tidy", ".env.example",
  // CI / platform
  ".travis.yml", "tox.ini", ".flake8",
]);

// Prefix patterns (lower-cased) for extensionless or variant metadata files.
export const REPO_STONE_NAME_PREFIXES = [
  "readme", "license", "licence", "contributing", "changelog",
  "authors", "notice", "copying", "security", "codeowners",
  "maintainers", "support", "funding",
];

// ---------------------------------------------------------------------------
// Hard-reject: directory segments / path fragments that are never stoned.
// ---------------------------------------------------------------------------
export const DEFAULT_REPO_STONE_IGNORES = [
  ".git/",
  "node_modules/", "vendor/",
  "dist/", "build/", "out/", "target/",
  "__pycache__/", ".pycache/", "pycache/",
  ".venv/", "venv/", ".env/", "env/",
  "coverage/", ".nyc_output/",
  ".wrangler/", ".next/", ".nuxt/", ".vercel/", ".turbo/", ".cache/",
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "Cargo.lock", ".DS_Store",
];

// ---------------------------------------------------------------------------
// Hard-reject: binary / media / model artifact extensions.
// ---------------------------------------------------------------------------
const BINARY_REJECT_EXTENSIONS = new Set([
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico",
  ".bmp", ".tiff", ".tif", ".heic", ".heif",
  // Video
  ".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v",
  // Audio
  ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a",
  // Archives
  ".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar", ".zst",
  // Documents (binary)
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
  // Python wheels / eggs / compiled
  ".whl", ".egg", ".pyc", ".pyo",
  // Model weights / ML artifacts
  ".pt", ".pth", ".onnx", ".bin", ".safetensors", ".ckpt", ".pkl",
  ".pickle", ".npy", ".npz", ".h5", ".hdf5", ".pb",
  // Native binaries / libraries
  ".so", ".dylib", ".dll", ".exe", ".a", ".o", ".obj",
  // Fonts
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  // Misc binary
  ".db", ".sqlite", ".sqlite3",
]);

// ---------------------------------------------------------------------------
// repoStonePathMatches — glob pattern matcher for file paths.
// ---------------------------------------------------------------------------
// Supports:
//  - Literal suffixes: .md, .js, .json
//  - Exact filenames: README.md, package.json
//  - Wildcard patterns: *.md, src/*.js
//  - Recursive patterns: **/*.js, **/*.md, docs/**/*.md
// ---------------------------------------------------------------------------
function repoStonePathMatches(path, pattern) {
  const textPath = String(path || "").replace(/^\/+/, "");
  const rawPattern = String(pattern || "").trim().replace(/^\/+/, "");

  if (!textPath || !rawPattern) return false;

  // Exact path match
  if (textPath === rawPattern) return true;

  const normalizedPattern = rawPattern.replace(/\\/g, "/").replace(/^\.\//, "");

  // Rule 1: Pure extension suffix like ".md" or ".js" (backward compatibility, no wildcards)
  if (normalizedPattern.startsWith(".") && !normalizedPattern.includes("*") && !normalizedPattern.includes("/")) {
    return textPath.endsWith(normalizedPattern);
  }

  // Rule 2: No wildcards in pattern = literal path match
  if (!normalizedPattern.includes("*")) {
    return textPath.endsWith(normalizedPattern);
  }

  // Rule 3: Pattern with no "/" — matches basename only (*.js matches index.js not src/index.js)
  if (!normalizedPattern.includes("/")) {
    // If the path contains a directory (has /), don't match basename-only patterns
    if (textPath.includes("/")) {
      return false;
    }

    // Get basename of the path (which is the whole thing if no /)
    const slashIdx = textPath.lastIndexOf("/");
    const basename = slashIdx >= 0 ? textPath.slice(slashIdx + 1) : textPath;

    // Convert glob to regex
    const escaped = normalizedPattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*");

    return new RegExp(`^${escaped}$`).test(basename);
  }

  // Rule 4: Pattern with "/" — path-based glob matching
  const escaped = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");

  return new RegExp(`^${escaped}$`).test(textPath);
}

// ---------------------------------------------------------------------------
// repoStoneShouldInclude — file acceptance filter.
// ---------------------------------------------------------------------------
export function repoStoneShouldInclude(path, size, options = {}) {
  const textPath = String(path || "");
  const maxFileBytes = Number(options.max_file_bytes || options.maxFileBytes || 900000);
  const extraIgnore = Array.isArray(options.exclude) ? options.exclude.map(String) : [];
  const ignored = [...DEFAULT_REPO_STONE_IGNORES, ...extraIgnore];

  if (!textPath || Number(size || 0) <= 0) return false;
  if (Number(size || 0) > maxFileBytes) return false;
  if (ignored.some((fragment) => textPath.includes(fragment))) return false;

  const slash = textPath.lastIndexOf("/");
  const basename = slash >= 0 ? textPath.slice(slash + 1) : textPath;
  const basenameLower = basename.toLowerCase();
  const dotIdx = basename.lastIndexOf(".");
  const ext = dotIdx > 0 ? basename.slice(dotIdx).toLowerCase() : "";

  if (ext && BINARY_REJECT_EXTENSIONS.has(ext)) return false;

  if (Array.isArray(options.include) && options.include.length > 0) {
    const customList = options.include.map(String);
    return customList.some((pattern) => repoStonePathMatches(textPath, pattern));
  }

  if (REPO_STONE_EXACT_NAMES.has(basenameLower)) return true;
  if (REPO_STONE_NAME_PREFIXES.some((prefix) => basenameLower.startsWith(prefix))) return true;
  if (ext && DEFAULT_REPO_STONE_EXTENSIONS.includes(ext)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Language detection from file path.
// ---------------------------------------------------------------------------
export function detectLanguageFromPath(path) {
  const ext = String(path || "").split(".").pop().toLowerCase();
  const MAP = {
    py: "Python", pyw: "Python",
    js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", jsx: "JavaScript",
    ts: "TypeScript", tsx: "TypeScript",
    rs: "Rust", go: "Go", java: "Java",
    c: "C", cpp: "C++", cc: "C++", cxx: "C++", h: "C/C++", hpp: "C++",
    cs: "C#", php: "PHP", rb: "Ruby", lua: "Lua",
    sh: "Shell", bash: "Shell", zsh: "Shell",
    r: "R", R: "R", scala: "Scala", kt: "Kotlin", kts: "Kotlin", swift: "Swift",
    sql: "SQL", graphql: "GraphQL", gql: "GraphQL", proto: "Protobuf",
    html: "HTML", htm: "HTML", css: "CSS", vue: "Vue", svelte: "Svelte",
    md: "Markdown", mdx: "MDX", rst: "reStructuredText", adoc: "AsciiDoc",
    yaml: "YAML", yml: "YAML", toml: "TOML", json: "JSON",
    tf: "Terraform", hcl: "HCL",
  };
  return MAP[ext] || null;
}

// ---------------------------------------------------------------------------
// Repository fingerprint builder.
// ---------------------------------------------------------------------------
export function buildRepoFingerprint({ owner, repo, ref, headCommit, treeHash, languages, frameworks, configs, stoneCount, fileCount, compressionRatio }) {
  return {
    repo: `${owner}/${repo}`,
    default_branch: ref,
    head_commit: headCommit || null,
    tree_hash: treeHash || null,
    languages: languages || [],
    major_frameworks: frameworks || [],
    major_configs: configs || [],
    stone_count: stoneCount || 0,
    file_count: fileCount || 0,
    compression_ratio: compressionRatio || 0,
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Architecture detection — static analysis of file paths and names.
// ---------------------------------------------------------------------------
export function detectArchitecture(files) {
  const paths = files.map(f => f.path);

  const entryPoints = paths.filter(p => {
    const b = p.split("/").pop().toLowerCase();
    return [
      "main.py", "app.py", "index.js", "index.ts", "main.js", "main.ts",
      "main.go", "main.rs", "main.c", "main.cpp", "app.js", "app.ts",
      "server.js", "server.ts", "worker.js", "worker.ts",
    ].includes(b);
  });

  const apiFiles = paths.filter(p =>
    /\/api\/|\/routes?\/ |\/handlers?\/ |\/endpoints?\/ |\/controllers?\/ |\/views?\//i.test(p)
  );

  // FIX: was /\/workers?//i — the unescaped / terminated the regex early,
  // leaving `i` as a dangling identifier that caused "i is not defined".
  const workerRoutes = paths.filter(p =>
    /wrangler\.toml|worker\.js|worker\.ts|_worker\.js|\/workers?\/|workers?\\//i.test(p)
  );

  const cliFiles = paths.filter(p =>
    /cli\.js|cli\.ts|bin\/|scripts\/|cmd\//i.test(p)
  );

  const langSet = new Set(
    files
      .map(f => detectLanguageFromPath(f.path))
      .filter(Boolean)
  );

  return {
    languages: Array.from(langSet),
    has_entry_points: entryPoints.length > 0,
    has_api_routes: apiFiles.length > 0,
    has_worker_routes: workerRoutes.length > 0,
    has_cli: cliFiles.length > 0,
    estimated_pattern: inferPattern(entryPoints, apiFiles, workerRoutes, cliFiles),
  };
}

function inferPattern(entryPoints, apiFiles, workerRoutes, cliFiles) {
  if (workerRoutes.length > 0) return "cloudflare-worker";
  if (apiFiles.length > 0 && entryPoints.length > 0) return "rest-api";
  if (cliFiles.length > 0) return "cli-tool";
  if (entryPoints.length > 0) return "application";
  return "library";
}

// ---------------------------------------------------------------------------
// buildRepoOrientationContent — full repository report, markdown format.
// ---------------------------------------------------------------------------
export function buildRepoOrientationContent({
  owner,
  repo,
  ref,
  chain,
  created,
  skipped,
  failed,
}) {
  const lines = [];
  lines.push(`# ${owner}/${repo} Repository Orientation`);
  lines.push(`**Chain:** \`${chain}\`  **Branch:** \`${ref}\``);
  lines.push("");

  if (created && created.length > 0) {
    lines.push("## Created Stones");
    created.forEach(({ path, stone_hash }) => {
      lines.push(`- ${path} -> ${stone_hash.slice(0, 12)}`);
    });
    lines.push("");
  }

  if (skipped && skipped.length > 0) {
    lines.push("## Skipped Files");
    skipped.forEach(({ path, reason }) => {
      lines.push(`- ${path}: ${reason}`);
    });
    lines.push("");
  }

  if (failed && failed.length > 0) {
    lines.push("## Failed Stones");
    failed.forEach(({ path, error }) => {
      lines.push(`- ${path}: ${error}`);
    });
    lines.push("");
  }

  lines.push("---");
  lines.push(`_Generated at ${new Date().toISOString()}_`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// observationTriageByStage — categorize and score lint observations.
// ---------------------------------------------------------------------------
export function observationTriageByStage(observations = []) {
  const byStage = {
    critical: { score: 100, items: [] },
    likely: { score: 65, items: [] },
    suggestion: { score: 20, items: [] },
    noise: { score: 0, items: [] },
  };

  observations.forEach((obs) => {
    const { flag, category, severity, text, ref_id, line_num } = obs;
    const item = { flag, category, ref_id, line_num, text };

    if (severity === "critical" || flag === "hardcoded_secret") {
      byStage.critical.items.push(item);
    } else if (severity === "likely" || flag === "empty_catch") {
      byStage.likely.items.push(item);
    } else if (
      severity === "suggestion" ||
      ["todo_comment", "long_line", "var_usage", "console_debug"].includes(flag)
    ) {
      byStage.suggestion.items.push(item);
    } else {
      byStage.noise.items.push(item);
    }
  });

  return byStage;
}

// ---------------------------------------------------------------------------
// buildLintReportContent — review report in markdown, for stoning.
// ---------------------------------------------------------------------------
export function buildLintReportContent({
  owner,
  repo,
  ref,
  chain,
  observations,
  filePath,
  stone_hash,
}) {
  const lines = [];
  lines.push(`# ${owner}/${repo} Lint Report`);
  lines.push(`**Chain:** \`${chain}\`  **File:** \`${filePath}\`  **Ref:** \`${ref}\``);
  lines.push(`**Stone:** \`${stone_hash}\``);
  lines.push("");

  const triage = observationTriageByStage(observations || []);

  const allObs = [];
  for (const [stage, { items }] of Object.entries(triage)) {
    if (items.length === 0) continue;
    allObs.push(`**${stage}** (${items.length})`);
    items.forEach(({ flag, line_num, text }) => {
      allObs.push(`- \`${flag}\` @line ${line_num}: ${text}`);
    });
  }

  if (allObs.length === 0) lines.push("No observations generated. The analyzed files appear clean.");

  lines.push("## Disclaimer");
  lines.push("This review is generated automatically by static analysis.");
  lines.push("Confirmed = parser/AST-verified. Likely = strong heuristic signal. Suggestion = improvement opportunity.");
  lines.push("Do not treat suggestions as bugs. Human review is always recommended.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Repository health dashboard summary.
// ---------------------------------------------------------------------------
export function buildHealthDashboard({
  chain, owner, repo, ref,
  langBreakdown, fileCount, stoneCount, refCount,
  compressionRatio, graphDensity,
  hasReview, hasLint, hasArchitecture,
  lastIndexedCommit, fingerprint
}) {
  const langNames = (langBreakdown || []).map(l => l.lang);
  const healthScore = computeHealthScore({ stoneCount, hasReview, hasLint, hasArchitecture, fileCount });
  return {
    chain,
    repo: `${owner}/${repo}`,
    ref,
    languages: langNames,
    file_count: fileCount || 0,
    stone_count: stoneCount || 0,
    ref_count: refCount || 0,
    compression_ratio: compressionRatio || 0,
    graph_density: graphDensity || 0,
    has_review_stone: Boolean(hasReview),
    has_lint_stone: Boolean(hasLint),
    has_architecture_stone: Boolean(hasArchitecture),
    last_indexed_commit: lastIndexedCommit || null,
    health_score: healthScore,
    fingerprint: fingerprint || null,
  };
}

function computeHealthScore({ stoneCount, hasReview, hasLint, hasArchitecture, fileCount }) {
  let score = 0;
  if (stoneCount > 0) score += 30;
  if (fileCount > 0 && stoneCount >= Math.min(fileCount, 5)) score += 20;
  if (hasArchitecture) score += 20;
  if (hasLint) score += 15;
  if (hasReview) score += 15;
  return score;
}