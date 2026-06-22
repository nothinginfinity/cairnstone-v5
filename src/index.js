const VERSION = "0.1.0";
const MCP_PROTOCOL_VERSION = "2025-03-26";
const DEFAULT_LINES_PER_REF = 80;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
      if (url.pathname === "/mcp") return handleMcp(request, env, url);
      if (request.method === "GET" && url.pathname === "/") return json(landing(env, url));
      if (request.method === "GET" && url.pathname === "/health") return json(health(env));
      if (request.method === "POST" && url.pathname === "/v1/stones") return json(await createStoneFromBody(await request.json(), env));
      if (request.method === "POST" && url.pathname === "/v1/search") return json(await searchStonesFromBody(await request.json(), env));
      if (request.method === "POST" && url.pathname === "/v1/expand") return json(await expandRefFromBody(await request.json(), env));

      const stoneMatch = url.pathname.match(/^\/v1\/stones\/([^/]+)$/);
      if (request.method === "GET" && stoneMatch) return json(await getStone(env, stoneMatch[1]));

      const lodMatch = url.pathname.match(/^\/v1\/stones\/([^/]+)\/lod\/(lod[1-5])$/);
      if (request.method === "GET" && lodMatch) return json(await getLod(env, lodMatch[1], lodMatch[2]));

      return json({ ok: false, error: "not_found", endpoints: routes() }, 404);
    } catch (error) {
      return json({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
    }
  }
};

function landing(env, url) {
  return {
    ok: true,
    name: "cairnstone-v5",
    version: VERSION,
    protocol: "FSL-CCR Stone v5",
    mcp: `${url.origin}/mcp`,
    message: "CairnStone v5 is live. Claude and other MCP clients should connect to /mcp. REST clients can use /health, /v1/stones, /v1/search, and /v1/expand.",
    base_url: url.origin,
    health: `${url.origin}/health`,
    d1: Boolean(env.CAIRNSTONE_DB),
    r2: Boolean(env.CAIRNSTONE_RAW),
    endpoints: routes(),
    mcp_tools: mcpTools().map(tool => tool.name)
  };
}

function health(env) {
  return {
    ok: true,
    name: "cairnstone-v5",
    version: VERSION,
    protocol: "FSL-CCR Stone v5",
    mcp_protocol_version: MCP_PROTOCOL_VERSION,
    d1: Boolean(env.CAIRNSTONE_DB),
    r2: Boolean(env.CAIRNSTONE_RAW),
    endpoints: routes(),
    mcp_tools: mcpTools().map(tool => tool.name)
  };
}

function routes() {
  return [
    "GET /",
    "GET /health",
    "POST /mcp",
    "GET /mcp",
    "POST /v1/stones",
    "GET /v1/stones/:hash",
    "GET /v1/stones/:hash/lod/:level",
    "POST /v1/search",
    "POST /v1/expand"
  ];
}

async function handleMcp(request, env, url) {
  if (request.method === "GET") {
    return json({
      ok: true,
      name: "cairnstone-v5-mcp",
      version: VERSION,
      protocol: "MCP JSON-RPC over HTTP",
      endpoint: `${url.origin}/mcp`,
      methods: ["initialize", "tools/list", "tools/call"],
      tools: mcpTools().map(tool => ({ name: tool.name, description: tool.description }))
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  let rpc;
  try {
    rpc = await request.json();
  } catch (error) {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  if (Array.isArray(rpc)) {
    const results = [];
    for (const item of rpc) {
      const result = await handleMcpRpc(item, env);
      if (result) results.push(result);
    }
    if (!results.length) return withCors(new Response(null, { status: 202 }));
    return json(results);
  }

  const result = await handleMcpRpc(rpc, env);
  if (!result) return withCors(new Response(null, { status: 202 }));
  return json(result);
}

async function handleMcpRpc(rpc, env) {
  const id = rpc && Object.prototype.hasOwnProperty.call(rpc, "id") ? rpc.id : null;
  const method = rpc && rpc.method;
  const params = isObject(rpc && rpc.params) ? rpc.params : {};

  try {
    if (method === "initialize") {
      return rpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "cairnstone-v5", version: VERSION }
      });
    }

    if (method === "notifications/initialized") {
      return null;
    }

    if (method === "ping") {
      return rpcResult(id, {});
    }

    if (method === "tools/list") {
      return rpcResult(id, { tools: mcpTools() });
    }

    if (method === "tools/call") {
      const name = requiredString(params.name, "name");
      const args = isObject(params.arguments) ? params.arguments : {};
      const output = await callMcpTool(name, args, env);
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        isError: output && output.ok === false
      });
    }

    return rpcError(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    return rpcError(id, -32000, String(error && error.message ? error.message : error));
  }
}

async function callMcpTool(name, args, env) {
  if (name === "cairnstone_health") return health(env);
  if (name === "cairnstone_create_stone") return createStoneFromBody(args, env);
  if (name === "cairnstone_search") return searchStonesFromBody(args, env);
  if (name === "cairnstone_expand") return expandRefFromBody(args, env);
  if (name === "cairnstone_get_stone") return getStone(env, requiredString(args.hash, "hash"));
  if (name === "cairnstone_get_lod") return getLod(env, requiredString(args.hash, "hash"), requiredString(args.level, "level"));
  return { ok: false, error: "unknown_tool", name };
}

function mcpTools() {
  return [
    {
      name: "cairnstone_health",
      description: "Check CairnStone v5 MCP, D1, and R2 status.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }
    },
    {
      name: "cairnstone_create_stone",
      description: "Create a CairnStone from raw text content. Stores raw content in R2, creates searchable refs in D1, and returns LOD layers plus a compression receipt.",
      inputSchema: {
        type: "object",
        required: ["title", "author", "content"],
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          content: { type: "string" },
          path: { type: "string" },
          repo: { type: "string" },
          commit: { type: "string" },
          parent: { type: "string" },
          chain: { type: "string" },
          related: { type: "array", items: { type: "string" } },
          metadata: { type: "object" }
        }
      }
    },
    {
      name: "cairnstone_search",
      description: "Search compressed CairnStone refs before expanding raw content.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          stone_hash: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 }
        }
      }
    },
    {
      name: "cairnstone_expand",
      description: "Expand a selected CairnStone ref into exact raw line-window content from R2.",
      inputSchema: {
        type: "object",
        properties: {
          ref_id: { type: "string" },
          stone_hash: { type: "string" },
          path: { type: "string" },
          line_start: { type: "number" },
          context_lines: { type: "number", minimum: 0, maximum: 200 }
        }
      }
    },
    {
      name: "cairnstone_get_stone",
      description: "Get a complete CairnStone record by hash.",
      inputSchema: { type: "object", required: ["hash"], properties: { hash: { type: "string" } } }
    },
    {
      name: "cairnstone_get_lod",
      description: "Get one CairnStone LOD layer by hash and level.",
      inputSchema: {
        type: "object",
        required: ["hash", "level"],
        properties: {
          hash: { type: "string" },
          level: { type: "string", enum: ["lod1", "lod2", "lod3", "lod4", "lod5"] }
        }
      }
    }
  ];
}

async function createStoneFromBody(body, env) {
  requireBindings(env);
  const content = requiredString(body.content, "content");
  const title = requiredString(body.title, "title");
  const author = requiredString(body.author, "author");
  const created = new Date().toISOString();
  const path = body.path || "content.txt";
  const repo = body.repo || null;
  const commit = body.commit || null;
  const parent = body.parent || null;
  const chain = body.chain || null;
  const metadata = isObject(body.metadata) ? body.metadata : {};

  const rawHash = await sha256(content);
  const rawKey = `raw/${rawHash}.txt`;
  await env.CAIRNSTONE_RAW.put(rawKey, content, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
    customMetadata: { title, author, rawHash }
  });

  const seed = stableJson({ title, author, created, rawHash, repo, commit, parent, chain });
  const stoneHash = await sha256(seed);
  const refs = await buildRefs({ stoneHash, path, rawKey, content });
  const receipt = buildReceipt({ content, refs, created });
  const layers = buildLayers({ title, author, repo, commit, content, refs, receipt, rawKey });
  const stone = {
    border: { hash: stoneHash, author, created, title, repo, commit, parent, chain, signature: null },
    layers,
    related: Array.isArray(body.related) ? body.related : [],
    metadata
  };

  await env.CAIRNSTONE_DB.prepare(
    "INSERT INTO stones (hash,title,author,created_at,repo,commit_sha,parent_hash,chain_hash,raw_key,stone_json) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).bind(stoneHash, title, author, created, repo, commit, parent, chain, rawKey, JSON.stringify(stone)).run();

  for (const ref of refs) {
    await env.CAIRNSTONE_DB.prepare(
      "INSERT INTO refs (ref_id,stone_hash,path,line_start,line_end,keywords,preview,raw_key) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(ref.ref_id, stoneHash, ref.path, ref.line_start, ref.line_end, ref.keywords.join(" "), ref.preview, rawKey).run();
  }

  const receiptId = await sha256(`${stoneHash}:${created}:receipt`);
  await env.CAIRNSTONE_DB.prepare(
    "INSERT INTO receipts (id,stone_hash,original_bytes,compressed_bytes,ratio,strategy,created_at) VALUES (?,?,?,?,?,?,?)"
  ).bind(receiptId, stoneHash, receipt.original_bytes, receipt.compressed_bytes, receipt.ratio, receipt.strategy, created).run();

  return { ok: true, stone_hash: stoneHash, raw_key: rawKey, refs: refs.length, receipt, stone };
}

async function getStone(env, hash) {
  requireBindings(env);
  const row = await env.CAIRNSTONE_DB.prepare("SELECT stone_json FROM stones WHERE hash = ?").bind(hash).first();
  if (!row) return { ok: false, error: "stone_not_found", hash };
  return { ok: true, stone: JSON.parse(row.stone_json) };
}

async function getLod(env, hash, level) {
  const result = await getStone(env, hash);
  if (!result.ok) return result;
  const value = result.stone.layers[level];
  if (value === undefined) return { ok: false, error: "lod_not_found", hash, level };
  return { ok: true, hash, level, value };
}

async function searchStonesFromBody(body, env) {
  requireBindings(env);
  const query = requiredString(body.query, "query").toLowerCase();
  const limit = clamp(Number(body.limit || 20), 1, 100);
  const stoneHash = body.stone_hash || null;
  const safe = query.replaceAll("%", "").replaceAll("_", "");
  const like = `%${safe}%`;
  const sql = stoneHash
    ? "SELECT ref_id,stone_hash,path,line_start,line_end,keywords,preview FROM refs WHERE stone_hash = ? AND (LOWER(keywords) LIKE ? OR LOWER(preview) LIKE ?) LIMIT ?"
    : "SELECT ref_id,stone_hash,path,line_start,line_end,keywords,preview FROM refs WHERE LOWER(keywords) LIKE ? OR LOWER(preview) LIKE ? LIMIT ?";
  const stmt = env.CAIRNSTONE_DB.prepare(sql);
  const rows = stoneHash ? await stmt.bind(stoneHash, like, like, limit).all() : await stmt.bind(like, like, limit).all();
  await logEvent(env, { stone_hash: stoneHash, query, event_type: "search" });
  return {
    ok: true,
    query,
    total: rows.results.length,
    matches: rows.results.map(row => ({
      ref_id: row.ref_id,
      stone_hash: row.stone_hash,
      path: row.path,
      line_start: row.line_start,
      line_end: row.line_end,
      keywords: String(row.keywords || "").split(/\s+/).filter(Boolean),
      preview: row.preview
    }))
  };
}

async function expandRefFromBody(body, env) {
  requireBindings(env);
  const refId = body.ref_id || null;
  let row;
  if (refId) {
    row = await env.CAIRNSTONE_DB.prepare("SELECT * FROM refs WHERE ref_id = ?").bind(refId).first();
  } else {
    const stoneHash = requiredString(body.stone_hash, "stone_hash");
    const path = body.path || "content.txt";
    const lineStart = Number(body.line_start || 1);
    row = await env.CAIRNSTONE_DB.prepare(
      "SELECT * FROM refs WHERE stone_hash = ? AND path = ? AND line_start <= ? AND line_end >= ? LIMIT 1"
    ).bind(stoneHash, path, lineStart, lineStart).first();
  }
  if (!row) return { ok: false, error: "ref_not_found" };
  const context = clamp(Number(body.context_lines || 10), 0, 200);
  const raw = await env.CAIRNSTONE_RAW.get(row.raw_key);
  if (!raw) return { ok: false, error: "raw_not_found", raw_key: row.raw_key };
  const text = await raw.text();
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, Number(row.line_start) - context);
  const end = Math.min(lines.length, Number(row.line_end) + context);
  const window = lines.slice(start - 1, end).map((line, i) => ({ n: start + i, text: line }));
  await logEvent(env, { stone_hash: row.stone_hash, ref_id: row.ref_id, event_type: "expand" });
  return { ok: true, ref_id: row.ref_id, stone_hash: row.stone_hash, path: row.path, line_start: start, line_end: end, text: window.map(line => line.text).join("\n"), lines: window };
}

async function buildRefs({ stoneHash, path, rawKey, content }) {
  const lines = content.split(/\r?\n/);
  const refs = [];
  for (let i = 0; i < lines.length; i += DEFAULT_LINES_PER_REF) {
    const chunkLines = lines.slice(i, i + DEFAULT_LINES_PER_REF);
    const text = chunkLines.join("\n");
    const chunkHash = await sha256(`${stoneHash}:${path}:${i + 1}:${text}`);
    refs.push({ ref_id: `fsl:${chunkHash.slice(0, 16)}`, stone_hash: stoneHash, path, line_start: i + 1, line_end: i + chunkLines.length, keywords: extractKeywords(text, 12), preview: preview(text), raw_key: rawKey });
  }
  return refs;
}

function buildReceipt({ content, refs, created }) {
  const originalBytes = utf8Bytes(content);
  const compressedBytes = utf8Bytes(JSON.stringify(refs));
  return { original_bytes: originalBytes, compressed_bytes: compressedBytes, ratio: compressedBytes > 0 ? Number((originalBytes / compressedBytes).toFixed(2)) : 0, strategy: "cairnstone-v5.line-window-ref-index", created_at: created };
}

function buildLayers({ title, author, repo, commit, content, refs, receipt, rawKey }) {
  const lineCount = content.split(/\r?\n/).length;
  const topKeywords = extractKeywords(content, 16);
  const lod5 = `${title}: ${lineCount} lines, ${refs.length} refs, ${receipt.ratio}x ratio`;
  const lod4 = [lod5, `author=${author}`, repo ? `repo=${repo}` : null, commit ? `commit=${commit}` : null, `top=${topKeywords.slice(0, 8).join(",")}`].filter(Boolean).join(" | ");
  const lod3 = refs.slice(0, 24).map(ref => `${ref.ref_id} ${ref.path}:${ref.line_start}-${ref.line_end} ${ref.keywords.slice(0, 5).join(",")}`).join("\n");
  return { lod5, lod4, lod3, lod2: { compressed_index: refs, receipt }, lod1: { raw_key: rawKey, raw_bytes: receipt.original_bytes } };
}

function extractKeywords(text, limit) {
  const stop = new Set(["the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "have", "has", "not", "you", "your", "but", "can", "will", "all", "into", "our", "out", "use", "using", "true", "false", "null"]);
  const counts = new Map();
  for (const match of text.toLowerCase().matchAll(/[a-z0-9_]{3,}/g)) {
    const term = match[0];
    if (stop.has(term)) continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([term]) => term);
}

function preview(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 260);
}

async function logEvent(env, event) {
  if (!env.CAIRNSTONE_DB) return;
  const id = await sha256(`${Date.now()}:${Math.random()}:${JSON.stringify(event)}`);
  await env.CAIRNSTONE_DB.prepare(
    "INSERT INTO retrieval_events (id,stone_hash,ref_id,query,event_type,created_at) VALUES (?,?,?,?,?,?)"
  ).bind(id, event.stone_hash || null, event.ref_id || null, event.query || null, event.event_type, new Date().toISOString()).run();
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).length;
}

function requireBindings(env) {
  if (!env.CAIRNSTONE_DB) throw new Error("Missing D1 binding CAIRNSTONE_DB");
  if (!env.CAIRNSTONE_RAW) throw new Error("Missing R2 binding CAIRNSTONE_RAW");
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required string: ${name}`);
  return value;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function json(data, status = 200) {
  return withCors(Response.json(data, { status }));
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization,Mcp-Session-Id");
  headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
