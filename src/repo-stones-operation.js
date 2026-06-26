export const REPO_STONES_OPERATION_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Accept-list: extensions that identify text/source content worth stoning.
// ---------------------------------------------------------------------------
export const DEFAULT_REPO_STONE_EXTENSIONS = [
  // Prose / documentation
  ".md", ".mdx", ".txt", ".rst",
  // Config & data serialisation
  ".json", ".jsonc", ".toml", ".yml", ".yaml",
  // Web
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".css", ".html", ".htm",
  // Systems / compiled languages
  ".rs", ".go", ".java", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx",
  ".cs", ".php", ".rb", ".lua",
  // Scripting
  ".sh", ".bash", ".zsh", ".fish", ".ps1", ".py", ".pyw",
  // Data / query
  ".sql", ".graphql", ".gql",
  // Infrastructure
  ".tf", ".hcl", ".dockerfile", ".mod", ".sum",
  // Misc text
  ".env.example", ".editorconfig", ".gitignore", ".gitattributes",
  ".eslintrc", ".prettierrc", ".babelrc",
];

// ---------------------------------------------------------------------------
// Extensionless filenames that are always accepted regardless of extension.
// ---------------------------------------------------------------------------
export const REPO_STONE_EXACT_NAMES = new Set([
  "dockerfile",
  "makefile",
  "procfile",
  "requirements.txt",
  "package.json",
  "cargo.toml",
  "wrangler.toml",
  "gemfile",
  "rakefile",
  "justfile",
]);

// Prefix patterns (lower-cased) for extensionless metadata files.
// e.g. "readme", "readme.md", "license", "contributing", "contributing.rst"
export const REPO_STONE_NAME_PREFIXES = [
  "readme",
  "license",
  "licence",
  "contributing",
  "changelog",
  "authors",
  "notice",
  "copying",
  "security",
  "codeowners",
];

// ---------------------------------------------------------------------------
// Hard-reject: directory segments that are never stoned.
// ---------------------------------------------------------------------------
export const DEFAULT_REPO_STONE_IGNORES = [
  // VCS
  ".git/",
  // Dependency directories
  "node_modules/",
  "vendor/",
  // Build outputs
  "dist/",
  "build/",
  "out/",
  "target/",
  "__pycache__/",
  ".pycache/",
  "pycache/",
  // Virtual environments
  ".venv/",
  "venv/",
  ".env/",
  "env/",
  // Coverage / generated reports
  "coverage/",
  ".nyc_output/",
  // Tooling caches
  ".wrangler/",
  ".next/",
  ".nuxt/",
  ".vercel/",
  ".turbo/",
  ".cache/",
  // Lock files (large, low signal)
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  ".DS_Store",
];

// ---------------------------------------------------------------------------
// Hard-reject: extensions that identify binary / media / model artifacts.
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
  ".db", ".sqlite", ".sqlite3", ".lock",
]);

// ---------------------------------------------------------------------------
// repoStoneShouldInclude — patched acceptance / filter logic.
//
// Decision order:
//   1. Reject empty path or zero-size.
//   2. Reject if size > max_file_bytes.
//   3. Reject if any ignore fragment appears in the path.
//   4. Reject if the extension is in the binary reject list.
//   5. Accept if the caller supplied a custom include list and it matches.
//   6. Accept if the base filename matches an exact repo-metadata name.
//   7. Accept if the lower-cased base filename starts with a metadata prefix.
//   8. Accept if the file extension is in the default allow-list.
//   9. Reject everything else.
// ---------------------------------------------------------------------------
export function repoStoneShouldInclude(path, size, options = {}) {
  const textPath = String(path || "");
  const maxFileBytes = Number(options.max_file_bytes || options.maxFileBytes || 900000);
  const extraIgnore = Array.isArray(options.exclude) ? options.exclude.map(String) : [];
  const ignored = [...DEFAULT_REPO_STONE_IGNORES, ...extraIgnore];

  // 1. Sanity guards
  if (!textPath || Number(size || 0) <= 0) return false;

  // 2. Size cap
  if (Number(size || 0) > maxFileBytes) return false;

  // 3. Ignored path segments
  if (ignored.some((fragment) => textPath.includes(fragment))) return false;

  // Derive the base filename (after the last slash, or the whole path).
  const slash = textPath.lastIndexOf("/");
  const basename = slash >= 0 ? textPath.slice(slash + 1) : textPath;
  const basenameLower = basename.toLowerCase();

  // Derive the extension (last dot and everything after it, lower-cased).
  const dotIdx = basename.lastIndexOf(".");
  const ext = dotIdx > 0 ? basename.slice(dotIdx).toLowerCase() : "";

  // 4. Hard-reject binary/media/model artifacts by extension.
  if (ext && BINARY_REJECT_EXTENSIONS.has(ext)) return false;

  // 5. Caller-supplied custom include list takes precedence over defaults.
  if (Array.isArray(options.include) && options.include.length > 0) {
    const customList = options.include.map(String);
    return customList.some((suffix) => textPath.endsWith(suffix));
  }

  // 6. Exact extensionless repo-metadata filenames (case-insensitive).
  if (REPO_STONE_EXACT_NAMES.has(basenameLower)) return true;

  // 7. Prefix-matched metadata files (README*, LICENSE, CONTRIBUTING*, …).
  //    Covers "README", "README.md", "LICENSE.txt", "CONTRIBUTING.rst", etc.
  if (REPO_STONE_NAME_PREFIXES.some((prefix) => basenameLower.startsWith(prefix))) return true;

  // 8. Extension allow-list (DEFAULT_REPO_STONE_EXTENSIONS).
  if (ext && DEFAULT_REPO_STONE_EXTENSIONS.includes(ext)) return true;

  // 9. No match — reject.
  return false;
}

export function buildRepoOrientationContent(summary) {
  const created = Array.isArray(summary.created) ? summary.created : [];
  const skipped = Array.isArray(summary.skipped) ? summary.skipped : [];
  const failed = Array.isArray(summary.failed) ? summary.failed : [];
  const lines = [];
  lines.push(`# ${summary.owner}/${summary.repo} Repository Orientation`);
  lines.push("");
  lines.push(`- chain: ${summary.chain}`);
  lines.push(`- ref: ${summary.ref}`);
  lines.push(`- created stones: ${created.length}`);
  lines.push(`- skipped files: ${skipped.length}`);
  lines.push(`- failed files: ${failed.length}`);
  lines.push("");
  lines.push("## Stoned files");
  for (const item of created) lines.push(`- ${item.path} -> ${item.stone_hash}`);
  if (skipped.length) {
    lines.push("");
    lines.push("## Skipped files");
    for (const item of skipped) lines.push(`- ${item.path}: ${item.reason}`);
  }
  if (failed.length) {
    lines.push("");
    lines.push("## Failed files");
    for (const item of failed) lines.push(`- ${item.path}: ${item.error}`);
  }
  lines.push("");
  lines.push("## Builder note");
  lines.push("This orientation stone is generated by the repository-wide CairnStone ingestion operation. It documents the file stones created for this repository and should be used as the chain HEAD for map-first repo discovery.");
  return lines.join("\n");
}
