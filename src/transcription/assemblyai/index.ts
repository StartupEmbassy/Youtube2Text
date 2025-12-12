import { AssemblyAiClient } from "./client.js";
import { TranscriptionProvider } from "../provider.js";
import { TranscriptJson, TranscriptionOptions } from "../types.js";

export class AssemblyAiProvider implements TranscriptionProvider {
  name = "assemblyai";
  private client: AssemblyAiClient;

  constructor(apiKey: string) {
    this.client = new AssemblyAiClient(apiKey);
  }

  transcribe(audioPath: string, opts: TranscriptionOptions): Promise<TranscriptJson> {
    return this.client.transcribe(audioPath, opts);
  }
}

