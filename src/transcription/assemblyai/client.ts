import { retry } from "../../utils/retry.js";
import { logStep } from "../../utils/logger.js";
import { TranscriptJson, TranscriptionOptions } from "../types.js";
import { requestJson, uploadFile } from "./http.js";
import { buildCreateTranscriptRequestBody } from "./request.js";

type CreateResponse = { id: string; status: string };

export class AssemblyAiClient {
  constructor(private apiKey: string) {}

  async getAccount(): Promise<Record<string, unknown>> {
    return await requestJson<Record<string, unknown>>(
      this.apiKey,
      "/account",
      { method: "GET" }
    );
  }

  async uploadAudio(audioPath: string): Promise<string> {
    const data = await uploadFile(this.apiKey, audioPath);
    return data.upload_url;
  }

  async createTranscript(
    audioUrl: string,
    options: Pick<
      TranscriptionOptions,
      "languageCode" | "languageDetection" | "languageConfidenceThreshold"
    >
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
    });
  }

  async getTranscript(id: string): Promise<TranscriptJson> {
    return await requestJson<TranscriptJson>(
      this.apiKey,
      `/transcript/${id}`,
      {
      method: "GET",
      }
    );
  }

  async transcribe(
    audioPath: string,
    opts: TranscriptionOptions
  ): Promise<TranscriptJson> {
    return await retry(
      async () => {
        logStep("upload", `Uploading to AssemblyAI: ${audioPath}`);
        const uploadUrl = await this.uploadAudio(audioPath);
        const created = await this.createTranscript(uploadUrl, {
          languageCode: opts.languageCode,
          languageDetection: opts.languageDetection,
          languageConfidenceThreshold: opts.languageConfidenceThreshold,
        });
        const deadline =
          Date.now() + opts.maxPollMinutes * 60 * 1000;

        logStep("transcribe", `Transcription started: ${created.id}`);

        while (Date.now() < deadline) {
          const current = await this.getTranscript(created.id);
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
