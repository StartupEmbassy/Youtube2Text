export function apiBaseUrlServer(): string {
  return process.env.Y2T_API_BASE_URL || "http://127.0.0.1:8787";
}

export function apiBaseUrlClient(): string {
  return process.env.NEXT_PUBLIC_Y2T_API_BASE_URL || "http://127.0.0.1:8787";
}

function apiKeyHeader(): Record<string, string> {
  const key = process.env.Y2T_API_KEY;
  if (!key || key.trim().length === 0) return {};
  return { "x-api-key": key.trim() };
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrlServer()}${path}`, {
    cache: "no-store",
    headers: apiKeyHeader(),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
