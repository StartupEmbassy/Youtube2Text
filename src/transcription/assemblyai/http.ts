import { readFile } from "node:fs/promises";
import { InsufficientCreditsError } from "./errors.js";

const API_BASE = "https://api.assemblyai.com/v2";

function isInsufficientCredits(status: number, body: string): boolean {
  if (status === 402) return true;
  const text = body.toLowerCase();
  return (
    text.includes("insufficient credits") ||
    text.includes("out of credits") ||
    text.includes("credit balance") ||
    text.includes("insufficient") && text.includes("credit") ||
    text.includes("quota exceeded")
  );
}

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
    if (isInsufficientCredits(response.status, text)) {
      throw new InsufficientCreditsError(
        `AssemblyAI insufficient credits: ${text}`
      );
    }
    throw new Error(`AssemblyAI error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

export async function uploadFile(
  apiKey: string,
  audioPath: string
): Promise<{ upload_url: string }> {
  const buffer = await readFile(audioPath);
  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: apiKey },
    body: buffer,
  });
  if (!response.ok) {
    const text = await response.text();
    if (isInsufficientCredits(response.status, text)) {
      throw new InsufficientCreditsError(
        `AssemblyAI insufficient credits: ${text}`
      );
    }
    throw new Error(`Upload failed ${response.status}: ${text}`);
  }
  return (await response.json()) as { upload_url: string };
}
