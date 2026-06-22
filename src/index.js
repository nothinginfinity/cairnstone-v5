export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        name: "cairnstone-v5",
        protocol: "FSL-CCR Stone v5",
        d1: Boolean(env.CAIRNSTONE_DB),
        r2: Boolean(env.CAIRNSTONE_RAW)
      })
    }
    return Response.json({
      ok: true,
      message: "CairnStone v5 scaffold",
      endpoints: ["/health", "/v1/stones", "/v1/search", "/v1/expand"]
    })
  }
}
