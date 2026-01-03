import { retry } from "../../utils/retry.js";
import { logStep } from "../../utils/logger.js";
import { TranscriptJson, TranscriptionOptions } from "../types.js";
import { requestJson, uploadFile } from "./http.js";
import { buildCreateTranscriptRequestBody } from "./request.js";

type CreateResponse = { id: string; status: string };

export class AssemblyAiClient {
  constructor(
    private apiKey: string,
    private timeoutMs?: number
  ) {}

  async getAccount(): Promise<Record<string, unknown>> {
    return await requestJson<Record<string, unknown>>(
      this.apiKey,
      "/account",
      { method: "GET" },
      this.timeoutMs
    );
  }

  async uploadAudio(audioPath: string, timeoutMs?: number): Promise<string> {
    const data = await uploadFile(this.apiKey, audioPath, timeoutMs ?? this.timeoutMs);
    return data.upload_url;
  }

  async createTranscript(
    audioUrl: string,
    options: Pick<
      TranscriptionOptions,
      "languageCode" | "languageDetection" | "languageConfidenceThreshold"
    >,
    timeoutMs?: number
  ): Promise<CreateResponse> {
    return await requestJson<CreateResponse>(this.apiKey, "/transcript", {
      method: "POST",
      body: JSON.stringify({
        ...buildCreateTranscriptRequestBody({
          audioUrl,
          languageCode: options.languageCode,
          languageDetection: options.languageDetection,
          languageConfidenceThreshold: options.languageConfidenceThreshold,
        }),
      }),
    }, timeoutMs ?? this.timeoutMs);
  }

  async getTranscript(id: string, timeoutMs?: number): Promise<TranscriptJson> {
    return await requestJson<TranscriptJson>(
      this.apiKey,
      `/transcript/${id}`,
      {
      method: "GET",
      },
      timeoutMs ?? this.timeoutMs
    );
  }

  async transcribe(
    audioPath: string,
    opts: TranscriptionOptions
  ): Promise<TranscriptJson> {
    const timeoutMs = opts.providerTimeoutMs ?? this.timeoutMs;
    return await retry(
      async () => {
        logStep("upload", `Uploading to AssemblyAI: ${audioPath}`);
        const uploadUrl = await this.uploadAudio(audioPath, timeoutMs);
        const created = await this.createTranscript(uploadUrl, {
          languageCode: opts.languageCode,
          languageDetection: opts.languageDetection,
          languageConfidenceThreshold: opts.languageConfidenceThreshold,
        }, timeoutMs);
        const deadline =
          Date.now() + opts.maxPollMinutes * 60 * 1000;

        logStep("transcribe", `Transcription started: ${created.id}`);

        while (Date.now() < deadline) {
          const current = await this.getTranscript(created.id, timeoutMs);
          if (current.status === "completed") return current;
          if (current.status === "error") {
            throw new Error(
              `Transcription error: ${JSON.stringify(current)}`
            );
          }
          await new Promise((r) =>
            setTimeout(r, opts.pollIntervalMs)
          );
        }

        throw new Error(
          `Transcription timed out after ${opts.maxPollMinutes} minutes`
        );
      },
      { retries: opts.retries, baseDelayMs: 2000, maxDelayMs: 20000 }
    );
  }
}
