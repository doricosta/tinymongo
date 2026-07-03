import type { Document } from "./query/matchQuery.js";

export type SortSpec = Record<string, 1 | -1>;

export class Cursor<T extends Document = Document> implements AsyncIterable<T> {
  private docs: T[];
  private sortSpec: SortSpec | null = null;
  private skipCount = 0;
  private limitCount: number | null = null;

  constructor(docs: T[]) {
    this.docs = docs;
  }

  sort(spec: SortSpec): this {
    this.sortSpec = spec;
    return this;
  }

  skip(n: number): this {
    this.skipCount = n;
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  private materialize(): T[] {
    let result = [...this.docs];
    if (this.sortSpec) {
      const entries = Object.entries(this.sortSpec);
      result.sort((a, b) => {
        for (const [key, dir] of entries) {
          const av = (a as Record<string, unknown>)[key];
          const bv = (b as Record<string, unknown>)[key];
          if (av === bv) continue;
          if (av === undefined) return 1;
          if (bv === undefined) return -1;
          const comparison = av! < bv! ? -1 : 1;
          return comparison * dir;
        }
        return 0;
      });
    }
    if (this.skipCount) result = result.slice(this.skipCount);
    if (this.limitCount != null) result = result.slice(0, this.limitCount);
    return result;
  }

  async toArray(): Promise<T[]> {
    return this.materialize();
  }

  async count(): Promise<number> {
    return this.materialize().length;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for (const doc of this.materialize()) {
      yield doc;
    }
  }
}
