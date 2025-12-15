import { proxyToApi } from "../../../../../lib/apiProxy";

export async function GET(request: Request, ctx: { params: { runId: string } }) {
  return proxyToApi(request, `/runs/${encodeURIComponent(ctx.params.runId)}/artifacts`);
}

