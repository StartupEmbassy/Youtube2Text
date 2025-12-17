import { proxyToApi } from "../../../lib/apiProxy";

export async function GET(request: Request) {
  return proxyToApi(request, "/watchlist");
}

export async function POST(request: Request) {
  return proxyToApi(request, "/watchlist");
}

