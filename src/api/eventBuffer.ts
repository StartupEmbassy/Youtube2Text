export type BufferedEvent<T> = {
  id: number;
  event: T;
};

export class EventBuffer<T> {
  private nextId = 1;
  private events: BufferedEvent<T>[] = [];

  constructor(private maxEvents: number) {}

  setNextId(nextId: number) {
    this.nextId = Math.max(1, Math.floor(nextId));
  }

  append(event: T): BufferedEvent<T> {
    const buffered: BufferedEvent<T> = { id: this.nextId++, event };
    this.events.push(buffered);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
    return buffered;
  }

  appendWithId(id: number, event: T): BufferedEvent<T> {
    const buffered: BufferedEvent<T> = { id, event };
    this.nextId = Math.max(this.nextId, id + 1);
    this.events.push(buffered);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
    return buffered;
  }

  listAfter(lastSeenId: number): BufferedEvent<T>[] {
    if (lastSeenId <= 0) return this.events.slice();
    const startIndex = this.events.findIndex((e) => e.id > lastSeenId);
    if (startIndex === -1) return [];
    return this.events.slice(startIndex);
  }
}
