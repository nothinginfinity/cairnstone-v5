export const REPO_STONES_OPERATION_VERSION = "0.2.0";

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

// Prefix patterns (lower-cased) for extensionless or variangt metadata files.
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
    return customList.some((suffix) => textPath.endsWith(suffix));
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
    /\/api\/|\broutes?\/|\bhandlers?\/|\bendpoints?\/|\bcontrollers?\/|\bviews?\//i.test(p)
  );

  const workerRoutes = paths.filter(p =>
    /wrangler\.toml|worker\.js|worker\.ts|_worker\.js|\/workers?//i.test(p)
  );

  const cliFiles = paths.filter(p =>
    /\/cli\/|\/cmd\/|\/bin\/|cli\.py|cli\.js|cli\.ts|__main__\.py/i.test(p)
  );

  const configs = paths.filter(p => {
    const b = p.split("/").pop().toLowerCase();
    return [
      "wrangler.toml", "package.json", "cargo.toml", "go.mod", "pyproject.toml",
      "setup.cfg", "setup.py", "requirements.txt", "pipfile",
      "dockerfile", "docker-compose.yml", "docker-compose.yaml",
      ".github/workflows", "tsconfig.json", "webpack.config.js",
      "vite.config.js", "vite.config.ts", "next.config.js", "next.config.ts",
    ].some(name => b === name || p.includes(name));
  });

  const packageManagers = [];
  if (paths.some(p => p.endsWith("package.json"))) packageManagers.push("npm/yarn/pnpm");
  if (paths.some(p => p.endsWith("Cargo.toml"))) packageManagers.push("cargo");
  if (paths.some(p => p.endsWith("go.mod"))) packageManagers.push("go modules");
  if (paths.some(p => /requirements\.txt|pyproject\.toml|pipfile/i.test(p))) packageManagers.push("pip/poetry");
  if (paths.some(p => p.endsWith("Gemfile"))) packageManagers.push("bundler");

  const frameworks = [];
  if (paths.some(p => p.includes("wrangler.toml"))) frameworks.push("Cloudflare Workers");
  if (paths.some(p => /next\.config/i.test(p))) frameworks.push("Next.js");
  if (paths.some(p => /vite\.config/i.test(p))) frameworks.push("Vite");
  if (paths.some(p => p.endsWith(".vue"))) frameworks.push("Vue");
  if (paths.some(p => p.endsWith(".svelte"))) frameworks.push("Svelte");
  if (paths.some(p => /django/i.test(p))) frameworks.push("Django");
  if (paths.some(p => /fastapi|uvicorn/i.test(p))) frameworks.push("FastAPI");
  if (paths.some(p => /flask/i.test(p))) frameworks.push("Flask");
  if (paths.some(p => /express/i.test(p))) frameworks.push("Express");
  if (paths.some(p => /spring/i.test(p))) frameworks.push("Spring");

  const importantFolders = [...new Set(
    paths.map(p => p.split("/")[0]).filter(s => s && !s.startsWith("."))
  )].slice(0, 20);

  return { entryPoints, apiFiles, workerRoutes, cliFiles, configs, packageManagers, frameworks, importantFolders };
}

// ---------------------------------------------------------------------------
// Language breakdown from accepted file list.
// ---------------------------------------------------------------------------
export function buildLanguageBreakdown(files) {
  const counts = {};
  for (const f of files) {
    const lang = detectLanguageFromPath(f.path);
    if (lang) counts[lang] = (counts[lang] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({ lang, count, pct: Math.round((count / total) * 100) }));
}

// ---------------------------------------------------------------------------
// Lite lint analysis (pattern-based, no external AST for non-JS languages).
// Returns only confirmed parser/syntax signals from content text.
// ---------------------------------------------------------------------------
export function liteLintAnalysis(path, content) {
  const ext = String(path || "").split(".").pop().toLowerCase();
  const errors = [];
  const lines = content.split(/\r?\n/);

  if (["py", "pyw"].includes(ext)) {
    // Python: detect IndentationError signals and SyntaxError patterns
    const tabSpaceMix = lines.some(l => /^(\t+ | +\t)/.test(l));
    if (tabSpaceMix) errors.push({ kind: "confirmed", category: "syntax", message: "Mixed tabs and spaces detected (IndentationError in Python 3)", line: null });
    lines.forEach((l, i) => {
      if (/^\s*(def|class|if|else|elif|for|while|with|try|except|finally)\s+.*[^:]$/.test(l) && !/['"]/.test(l))
        errors.push({ kind: "confirmed", category: "syntax", message: `Missing colon at end of compound statement`, line: i + 1 });
    });
  }

  if (["go"].includes(ext)) {
    // Go: detect unused imports pattern (simplified)
    const importBlock = content.match(/import\s*\([\s\S]*?\)/)?.[0] || "";
    const importedPkgs = [...importBlock.matchAll(/"([^"]+)"/g)].map(m => m[1].split("/").pop());
    for (const pkg of importedPkgs) {
      const usageRe = new RegExp(`\\b${pkg}\.`, "g");
      if (!usageRe.test(content.replace(importBlock, ""))) {
        errors.push({ kind: "likely", category: "lint", message: `Possible unused import: "${pkg}"`, line: null });
      }
    }
  }

  if (["rs"].includes(ext)) {
    // Rust: detect unwrap() calls (not errors but strong signals)
    lines.forEach((l, i) => {
      if (l.includes(".unwrap()")) errors.push({ kind: "suggestion", category: "reliability", message: "unwrap() call — consider using ? or expect()", line: i + 1 });
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Review analysis — static observations from file content.
// Returns {confirmed, likely, suggestion} categorized observations.
// ---------------------------------------------------------------------------
export function reviewAnalysis(path, content) {
  const observations = [];
  const lines = content.split(/\r?\n/);

  // Security
  lines.forEach((l, i) => {
    if (/(api[_-]?key|secret|password|token)\w*\s*[:=]\s*["'][^"']{4,}["']/i.test(l) && !/example|placeholder|your_/i.test(l))
      observations.push({ kind: "confirmed", category: "security", message: "Possible hardcoded credential or secret", line: i + 1 });
    if (/eval\s*\(|exec\s*\(/i.test(l))
      observations.push({ kind: "likely", category: "security", message: "Dynamic code execution (eval/exec) detected", line: i + 1 });
    if (/sql\s*=.*(%s|f["']|format|\+)/i.test(l))
      observations.push({ kind: "likely", category: "security", message: "Possible SQL string interpolation (injection risk)", line: i + 1 });
  });

  // Performance
  const longFunctions = [];
  let funcStart = -1;
  let funcDepth = 0;
  lines.forEach((l, i) => {
    if (/^\s*(def |async def |function |const \w+ = (async )?\()/.test(l)) { funcStart = i; funcDepth = 0; }
    funcDepth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
    if (funcStart >= 0 && i - funcStart > 100)
      longFunctions.push(i + 1);
  });
  if (longFunctions.length)
    observations.push({ kind: "suggestion", category: "maintainability", message: `${longFunctions.length} function(s) exceed 100 lines — consider splitting`, line: longFunctions[0] });

  // Maintainability
  lines.forEach((l, i) => {
    if (/\b(TODO|FIXME|HACK|XXX)\b/.test(l))
      observations.push({ kind: "suggestion", category: "maintainability", message: `Unresolved annotation: ${l.trim().slice(0, 80)}`, line: i + 1 });
  });

  const MAGIC_RE = /[^=!<>]\b(\d{3,})\b[^:"']/g;
  [...content.matchAll(MAGIC_RE)].slice(0, 3).forEach(m => {
    observations.push({ kind: "suggestion", category: "maintainability", message: `Magic number ${m[1]} — consider named constant`, line: null });
  });

  // Architecture
  const ext = String(path || "").split(".").pop().toLowerCase();
  if (["py", "js", "ts"].includes(ext)) {
    const lineCount = lines.length;
    if (lineCount > 500)
      observations.push({ kind: "suggestion", category: "architecture", message: `File is ${lineCount} lines — consider splitting into modules`, line: null });
  }

  return observations;
}

// ---------------------------------------------------------------------------
// Orientation stone content builder (enhanced with fingerprint + arch + stats).
// ---------------------------------------------------------------------------
export function buildRepoOrientationContent(summary) {
  const created = Array.isArray(summary.created) ? summary.created : [];
  const reused = Array.isArray(summary.reused) ? summary.reused : [];
  const skipped = Array.isArray(summary.skipped) ? summary.skipped : [];
  const failed = Array.isArray(summary.failed) ? summary.failed : [];
  const arch = summary.architecture || null;
  const langBreakdown = Array.isArray(summary.language_breakdown) ? summary.language_breakdown : [];
  const fingerprint = summary.fingerprint || null;
  const lines = [];

  lines.push(`# ${summary.owner}/${summary.repo} Repository Orientation`);
  lines.push("");
  lines.push("## Repository Summary");
  lines.push(`- repository: ${summary.owner}/${summary.repo}`);
  lines.push(`- chain: ${summary.chain}`);
  lines.push(`- ref: ${summary.ref}`);
  lines.push(`- indexed_at: ${new Date().toISOString()}`);
  lines.push("");

  if (langBreakdown.length) {
    lines.push("## Language Breakdown");
    for (const l of langBreakdown) lines.push(`- ${l.lang}: ${l.count} files (${l.pct}%)`);
    lines.push("");
  }

  if (arch) {
    if (arch.frameworks && arch.frameworks.length) {
      lines.push("## Detected Frameworks");
      for (const f of arch.frameworks) lines.push(`- ${f}`);
      lines.push("");
    }
    if (arch.packageManagers && arch.packageManagers.length) {
      lines.push("## Package Managers");
      for (const p of arch.packageManagers) lines.push(`- ${p}`);
      lines.push("");
    }
    if (arch.entryPoints && arch.entryPoints.length) {
      lines.push("## Detected Entry Points");
      for (const e of arch.entryPoints) lines.push(`- ${e}`);
      lines.push("");
    }
    if (arch.importantFolders && arch.importantFolders.length) {
      lines.push("## Important Folders");
      for (const f of arch.importantFolders) lines.push(`- ${f}/`);
      lines.push("");
    }
    if (arch.configs && arch.configs.length) {
      lines.push("## Important Configuration Files");
      for (const c of arch.configs.slice(0, 20)) lines.push(`- ${c}`);
      lines.push("");
    }
  }

  lines.push("## Repository Statistics");
  lines.push(`- created stones: ${created.length}`);
  lines.push(`- reused stones: ${reused.length}`);
  lines.push(`- skipped files: ${skipped.length}`);
  lines.push(`- failed files: ${failed.length}`);
  lines.push("");

  lines.push("## Generated File Inventory");
  for (const item of created) lines.push(`- ${item.path} -> ${item.stone_hash}`);
  for (const item of reused) lines.push(`- ${item.path} -> ${item.stone_hash} [reused]`);
  lines.push("");

  if (skipped.length) {
    lines.push("## Skipped Files");
    for (const item of skipped) lines.push(`- ${item.path}: ${item.reason}`);
    lines.push("");
  }

  if (failed.length) {
    lines.push("## Failed Files");
    for (const item of failed) lines.push(`- ${item.path}: ${item.error}`);
    lines.push("");
  }

  if (fingerprint) {
    lines.push("## Repository Fingerprint");
    lines.push(`- repo: ${fingerprint.repo}`);
    lines.push(`- branch: ${fingerprint.default_branch}`);
    if (fingerprint.head_commit) lines.push(`- head_commit: ${fingerprint.head_commit}`);
    lines.push(`- stone_count: ${fingerprint.stone_count}`);
    lines.push(`- file_count: ${fingerprint.file_count}`);
    lines.push(`- compression_ratio: ${fingerprint.compression_ratio}`);
    if (fingerprint.languages && fingerprint.languages.length) lines.push(`- languages: ${fingerprint.languages.join(", ")}`);
    if (fingerprint.major_frameworks && fingerprint.major_frameworks.length) lines.push(`- frameworks: ${fingerprint.major_frameworks.join(", ")}`);
    lines.push(`- generated_at: ${fingerprint.generated_at}`);
    lines.push("");
  }

  lines.push("## Graph Summary");
  lines.push("This orientation stone is the canonical HEAD for this repository chain.");
  lines.push("It documents every file stone, architecture stone, lint stone, and review stone.");
  lines.push("Use cairnstone_get_chain_manifest to navigate the full graph.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Architecture stone content builder.
// ---------------------------------------------------------------------------
export function buildArchitectureContent(summary, arch) {
  const lines = [];
  lines.push(`# ${summary.owner}/${summary.repo} Architecture`);
  lines.push("");
  lines.push(`- repository: ${summary.owner}/${summary.repo}`);
  lines.push(`- ref: ${summary.ref}`);
  lines.push(`- chain: ${summary.chain}`);
  lines.push("");

  if (arch.entryPoints.length) {
    lines.push("## Entry Points");
    for (const e of arch.entryPoints) lines.push(`- ${e}`);
    lines.push("");
  }

  if (arch.apiFiles.length) {
    lines.push("## API / Route Files");
    for (const a of arch.apiFiles.slice(0, 30)) lines.push(`- ${a}`);
    lines.push("");
  }

  if (arch.workerRoutes.length) {
    lines.push("## Cloudflare Worker Routes / Configs");
    for (const w of arch.workerRoutes.slice(0, 20)) lines.push(`- ${w}`);
    lines.push("");
  }

  if (arch.cliFiles.length) {
    lines.push("## CLI Commands / Entry Scripts");
    for (const c of arch.cliFiles.slice(0, 20)) lines.push(`- ${c}`);
    lines.push("");
  }

  if (arch.packageManagers.length) {
    lines.push("## Package / Dependency Managers");
    for (const p of arch.packageManagers) lines.push(`- ${p}`);
    lines.push("");
  }

  if (arch.frameworks.length) {
    lines.push("## Detected Frameworks");
    for (const f of arch.frameworks) lines.push(`- ${f}`);
    lines.push("");
  }

  if (arch.configs.length) {
    lines.push("## Configuration Hierarchy");
    for (const c of arch.configs.slice(0, 30)) lines.push(`- ${c}`);
    lines.push("");
  }

  if (arch.importantFolders.length) {
    lines.push("## Package Layout (Top-Level Folders)");
    for (const f of arch.importantFolders) lines.push(`- ${f}/`);
    lines.push("");
  }

  lines.push("## Note");
  lines.push("This architecture stone is generated automatically from static file path analysis.");
  lines.push("It documents structural patterns detected without executing any code.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Lint stone content builder.
// ---------------------------------------------------------------------------
export function buildLintContent(summary, lintResults) {
  const lines = [];
  lines.push(`# ${summary.owner}/${summary.repo} Lint Report`);
  lines.push("");
  lines.push(`- repository: ${summary.owner}/${summary.repo}`);
  lines.push(`- ref: ${summary.ref}`);
  lines.push(`- files_analyzed: ${lintResults.length}`);
  const total = lintResults.reduce((n, r) => n + r.errors.length, 0);
  lines.push(`- total_issues: ${total}`);
  lines.push("");

  for (const result of lintResults) {
    if (!result.errors.length) continue;
    lines.push(`### ${result.path}`);
    for (const e of result.errors) {
      const loc = e.line ? ` (line ${e.line})` : "";
      lines.push(`- [${e.kind}] ${e.category}: ${e.message}${loc}`);
    }
    lines.push("");
  }

  if (total === 0) lines.push("No lint issues found in analyzed files.");

  lines.push("## Note");
  lines.push("Lint analysis uses AST parsing (JS/TS) and pattern-based heuristics (Python/Go/Rust).");
  lines.push("Only confirmed and likely issues are reported. Speculative issues are omitted.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Review stone content builder.
// ---------------------------------------------------------------------------
export function buildReviewContent(summary, reviewResults) {
  const lines = [];
  lines.push(`# ${summary.owner}/${summary.repo} Code Review`);
  lines.push("");
  lines.push(`- repository: ${summary.owner}/${summary.repo}`);
  lines.push(`- ref: ${summary.ref}`);
  lines.push(`- files_reviewed: ${reviewResults.length}`);
  const allObs = reviewResults.flatMap(r => r.observations);
  const confirmed = allObs.filter(o => o.kind === "confirmed");
  const likely = allObs.filter(o => o.kind === "likely");
  const suggestions = allObs.filter(o => o.kind === "suggestion");
  lines.push(`- confirmed_issues: ${confirmed.length}`);
  lines.push(`- likely_issues: ${likely.length}`);
  lines.push(`- suggestions: ${suggestions.length}`);
  lines.push("");

  const groups = { security: [], performance: [], maintainability: [], architecture: [] };
  for (const o of allObs) {
    const key = o.category in groups ? o.category : "maintainability";
    groups[key].push(o);
  }

  for (const [cat, items] of Object.entries(groups)) {
    if (!items.length) continue;
    lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
    for (const o of items) {
      const loc = o.line ? ` (line ${o.line})` : "";
      lines.push(`- [${o.kind}] ${o.message}${loc}`);
    }
    lines.push("");
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
