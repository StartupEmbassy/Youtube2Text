import { proxyToApi } from "../../../../../lib/apiProxy";

export async function POST(request: Request, ctx: { params: { runId: string } }) {
  return proxyToApi(request, `/runs/${encodeURIComponent(ctx.params.runId)}/cancel`);
}

