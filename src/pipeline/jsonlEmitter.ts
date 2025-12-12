import { PipelineEvent, PipelineEventEmitter } from "./events.js";

export class JsonLinesEventEmitter implements PipelineEventEmitter {
  emit(event: PipelineEvent): void {
    process.stdout.write(JSON.stringify(event) + "\n");
  }
}

