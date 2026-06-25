import { buildRepoOrientationContent, repoStoneShouldInclude } from "./repo-stones-operation.js";

export async function createRepoStonesFromBody(body, env, deps) {
  const required = [
    "createStoneFromGitHubBody",
    "createStoneFromBody",
    "linkStonesFromBody",
    "requireBindings",
    "requiredString",
    "safeGitHubPart",
    "safeGitHubRef",
    "clamp"
  ];

  for (const name of required) {
    if (typeof deps?.[name] !== "function") {
      throw new Error(`Missing repo stones dependency: ${name}`);
    }
  }

  deps.requireBindings(env);

  const owner = deps.safeGitHubPart(body.owner, "owner");
  const repo = deps.safeGitHubPart(body.repo, "repo");
  const ref = deps.safeGitHubRef(body.ref || "main");
  const author = deps.requiredString(body.author, "author");
  const chain = body.chain || repo;
  const maxFiles = deps.clamp(Number(body.max_files || 200), 1, 500);
  const maxFiles = deps.clamp(Number(body.max_files || 200), 1, 500);
  const repoFull = `${owner}/${repo}`;
  const reuseUnchanged = body.reuse_unchanged !== false;
  const linkSupersedes = body.link_supersedes !== false;
  const priorIndex = await loadPriorRepoStoneIndex(env, { chain, repoFull });
  const treeResult = await fetchGitHubRepoTree({ owner, repo, ref }, env, deps);
  if (!treeResult.ok) return treeResult;

  const created = [];
  const reused = [];
  const updated = [];
  const superseded = [];
  const skipped = [];
  const failed = [];

  const accepted = [];
  for (const file of treeResult.files) {
    if (repoStoneShouldInclude(file.path, file.size, body)) accepted.push(file);
    else skipped.push({ path: file.path, size: file.size, reason: "filtered" });
  }

  const candidates = accepted.slice(0, maxFiles);
  for (const file of accepted.slice(maxFiles)) skipped.push({ path: file.path, size: file.size, reason: "max_files_exceeded" });

  for (const file of candidates) {
    const prior = priorIndex.by_path.get(file.path) || null;
    if (reuseUnchanged && prior?.sha && prior.sha === file.sha) {
      reused.push({ path: file.path, stone_hash: prior.stone_hash, refs: prior.refs, bytes: prior.bytes || file.size, sha: file.sha, reused_from: prior.stone_hash });
      continue;
    }
    const result = await deps.createStoneFromGitHubBody({
      owner, repo, ref, path: file.path, author, chain, title: `${repo} ${file.path}`,
      metadata: { kind: "repo_file", repo: repoFull, path: file.path, sha: file.sha, previous_sha: prior?.sha || null, previous_stone_hash: prior?.stone_hash || null, repo_stones_operation: true }
    }, env);
    if (!result.ok) {
      failed.push({ path: file.path, size: file.size, sha: file.sha, error: result.error || "stone_failed" });
      continue;
    }
    const item = { path: file.path, stone_hash: result.stone_hash, refs: result.refs, bytes: result.receipt?.original_bytes || file.size, sha: file.sha };
    created.push(item);
    if (prior?.stone_hash && prior.stone_hash !== result.stone_hash) {
      updated.push({ ...item, previous_stone_hash: prior.stone_hash, previous_sha: prior.sha || null });
      if (linkSupersedes) {
        const edge = await deps.linkStonesFromBody({ from_hash: result.stone_hash, to_hash: prior.stone_hash, edge_type: "supersedes", note: `Repo file ${file.path} supersedes previous Git SHA ${prior.sha || "unknown"}` }, env);
        if (edge.ok) superseded.push({ path: file.path, from_hash: result.stone_hash, to_hash: prior.stone_hash, edge_id: edge.id });
      }
    }
  }

  const current = [...created, ...reused];
  const summary = { owner, repo, ref, chain, created, reused, updated, skipped, failed };
  let orientation = null;
  let orientationSuperseded = null;

  if (body.create_orientation !== false) {
    orientation = await deps.createStoneFromBody({
      title: `${repo} repository orientation`, author, chain, content: buildRepoOrientationContent(summary),
      metadata: { kind: "repo_orientation", repo: repoFull, ref, previous_head_hash: priorIndex.previous_head_hash, previous_orientation_hash: priorIndex.previous_orientation?.stone_hash || null, repo_stones_operation: true },
      set_as_head: body.set_head !== false
    }, env);
    const priorOrientationHash = priorIndex.previous_orientation?.stone_hash || priorIndex.previous_head_hash || null;
    if (orientation?.ok && linkSupersedes && priorOrientationHash && priorOrientationHash !== orientation.stone_hash) {
      const edge = await deps.linkStonesFromBody({ from_hash: orientation.stone_hash, to_hash: priorOrientationHash, edge_type: "supersedes", note: `Repository orientation for ${repoFull}@${ref} supersedes previous orientation` }, env);
      if (edge.ok) orientationSuperseded = { from_hash: orientation.stone_hash, to_hash: priorOrientationHash, edge_id: edge.id };
    }
  }

  let linked = 0;
  if (orientation?.ok && body.auto_link !== false) {
    for (const item of current) {
      const edge = await deps.linkStonesFromBody({ from_hash: orientation.stone_hash, to_hash: item.stone_hash, edge_type: "documents", note: `Repository orientation documents ${item.path}` }, env);
      if (edge.ok) linked += 1;
    }
  }

  return { ok: true, owner, repo, ref, chain, previous_head_hash: priorIndex.previous_head_hash, previous_orientation_hash: priorIndex.previous_orientation?.stone_hash || null, created_count: created.length, reused_count: reused.length, updated_count: updated.length, superseded_count: superseded.length, skipped_count: skipped.length, failed_count: failed.length, linked_count: linked, orientation_hash: orientation?.stone_hash || null, orientation_superseded: orientationSuperseded, head_hash: orientation?.stone_hash || null, truncated: treeResult.truncated, created, reused, updated, superseded, skipped, failed };
}

async function loadPriorRepoStoneIndex
}

async function loadPriorRepoStoneIndex(env, { chain, repoFull }) {
  const result = {
    previous_head_hash: null,
    previous_orientation: null,
    by_path: new Map()
  };

  if (!env?.CAIRNSTONE_DB || !chain || !repoFull) return result;

  const headRow = await env.CAIRNSTONE_DB.prepare("SELECT head_hash FROM chain_heads WHERE chain = ?").bind(chain).first();
  result.previous_head_hash = headRow?.head_hash || null;

  const rows = await env.CAIRNSTONE_DB.prepare(
    "SELECT hash,created_at,stone_json FROM stones WHERE chain_hash = ? ORDER BY created_at ASC"
  ).bind(chain).all();

  for (const row of rows.results || []) {
    let stone = null;
    try {
      stone = JSON.parse(row.stone_json || "null");
    } catch {
      continue;
    }

    const metadata = stone?.metadata || {};
    if (metadata.repo !== repoFull || metadata.repo_stones_operation !== true) continue;

    if (metadata.kind === "repo_orientation") {
      result.previous_orientation = {
        stone_hash: row.hash,
        created_at: row.created_at,
        ref: metadata.ref || null
      };
      continue;
    }

    if (metadata.kind !== "repo_file" || !metadata.path) continue;
    result.by_path.set(metadata.path, {
      stone_hash: row.hash,
      created_at: row.created_at,
      path: metadata.path,
      sha: metadata.sha || null,
      refs: stone?.layers?.lod2?.compressed_index?.length || null,
      bytes: stone?.layers?.lod1?.raw_bytes || null
    });
  }

  return result;
}

export async function fetchGitHubRepoTree(spec, env, deps = {}) {
  const safeGitHubPart = deps.safeGitHubPart || ((value) => String(value || "").trim());
  const safeGitHubRef = deps.safeGitHubRef || ((value) => String(value || "main").trim());
  const owner = safeGitHubPart(spec.owner, "owner");
  const repo = safeGitHubPart(spec.repo, "repo");
  const ref = safeGitHubRef(spec.ref || "main");
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const headers = {
    "User-Agent": "cairnstone-v5-worker",
    "Accept": "application/vnd.github+json"
  };
  if (env?.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return {
      ok: false,
      error: "github_tree_fetch_failed",
      status: response.status,
      status_text: response.statusText,
      github: { owner, repo, ref }
    };
  }

  const data = await response.json();
  return {
    ok: true,
    owner,
    repo,
    ref,
    truncated: Boolean(data.truncated),
    files: (data.tree || [])
      .filter((item) => item.type === "blob")
      .map((item) => ({ path: item.path, size: item.size || 0, sha: item.sha }))
  };
}
