import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { ObjectId } from "../ObjectId.js";
import type { Document } from "../query/matchQuery.js";

type DatabaseData = Record<string, Record<string, Document[]>>;

function reviveDocument(doc: Document): Document {
  if (ObjectId.isValid(doc._id)) {
    return { ...doc, _id: new ObjectId(doc._id as string) };
  }
  return doc;
}

export class FileStorage {
  private readonly filePath: string | null;
  private data: DatabaseData = {};
  private writeQueue: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(filePath: string | null) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.filePath) return;

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = raw.trim().length > 0 ? JSON.parse(raw) : {};
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      this.data = {};
    }

    for (const collections of Object.values(this.data)) {
      for (const [name, docs] of Object.entries(collections)) {
        collections[name] = docs.map(reviveDocument);
      }
    }
  }

  getCollection(dbName: string, collectionName: string): Document[] {
    if (!this.data[dbName]) this.data[dbName] = {};
    if (!this.data[dbName][collectionName]) this.data[dbName][collectionName] = [];
    return this.data[dbName][collectionName];
  }

  listCollections(dbName: string): string[] {
    return Object.keys(this.data[dbName] ?? {});
  }

  dropCollection(dbName: string, collectionName: string): void {
    if (this.data[dbName]) delete this.data[dbName][collectionName];
  }

  async persist(): Promise<void> {
    if (!this.filePath) return;
    const snapshot = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(() => this.writeToDisk(snapshot));
    await this.writeQueue;
  }

  private async writeToDisk(snapshot: string): Promise<void> {
    const filePath = this.filePath!;
    await mkdir(dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, snapshot, "utf8");
    await rename(tmpPath, filePath);
  }
}
