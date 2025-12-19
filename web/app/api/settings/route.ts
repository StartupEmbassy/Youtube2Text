import { proxyToApi } from "../../../lib/apiProxy";

export async function GET(request: Request) {
  return proxyToApi(request, "/settings");
}

export async function PATCH(request: Request) {
  return proxyToApi(request, "/settings");
}

