export function apiBaseUrl(): string {
  return (
    process.env.Y2T_API_BASE_URL ||
    process.env.NEXT_PUBLIC_Y2T_API_BASE_URL ||
    "http://127.0.0.1:8787"
  );
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

