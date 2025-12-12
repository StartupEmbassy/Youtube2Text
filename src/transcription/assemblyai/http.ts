import { createReadStream } from "node:fs";

const API_BASE = "https://api.assemblyai.com/v2";

export async function requestJson<T>(
  apiKey: string,
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AssemblyAI error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

export async function uploadFile(
  apiKey: string,
  audioPath: string
): Promise<{ upload_url: string }> {
  const stream = createReadStream(audioPath);
  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: apiKey },
    body: stream as unknown as BodyInit,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed ${response.status}: ${text}`);
  }
  return (await response.json()) as { upload_url: string };
}

