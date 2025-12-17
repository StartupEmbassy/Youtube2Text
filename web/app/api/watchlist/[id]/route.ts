import { proxyToApi } from "../../../../lib/apiProxy";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return proxyToApi(request, `/watchlist/${encodeURIComponent(params.id)}`);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return proxyToApi(request, `/watchlist/${encodeURIComponent(params.id)}`);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return proxyToApi(request, `/watchlist/${encodeURIComponent(params.id)}`);
}

