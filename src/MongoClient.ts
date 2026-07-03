import { Db } from "./Db.js";
import { FileStorage } from "./storage/FileStorage.js";

const DEFAULT_FILE_PATH = "./tinymongo.db.json";

export class MongoClient {
  private readonly storage: FileStorage;
  private connected = false;

  constructor(filePath: string = DEFAULT_FILE_PATH) {
    this.storage = new FileStorage(filePath === ":memory:" ? null : filePath);
  }

  async connect(): Promise<this> {
    await this.storage.load();
    this.connected = true;
    return this;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  db(name: string): Db {
    if (!this.connected) {
      throw new Error("MongoClient is not connected. Call connect() first.");
    }
    return new Db(this.storage, name);
  }
}
