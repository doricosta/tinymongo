import { Collection } from "./Collection.js";
import { exportCollectionsToMongo, type ExportCollectionSummary, type ExportToMongoOptions } from "./export.js";
import type { Document } from "./query/matchQuery.js";
import type { FileStorage } from "./storage/FileStorage.js";

export class Db {
  constructor(
    private readonly storage: FileStorage,
    readonly databaseName: string,
  ) {}

  collection<T extends Document = Document>(name: string): Collection<T> {
    return new Collection<T>(this.storage, this.databaseName, name);
  }

  listCollections(): string[] {
    return this.storage.listCollections(this.databaseName);
  }

  async dropCollection(name: string): Promise<void> {
    this.storage.dropCollection(this.databaseName, name);
    await this.storage.persist();
  }

  // Requires the optional "mongodb" package (dynamically imported, not a hard dependency).
  async exportTo(targetUri: string, options: ExportToMongoOptions = {}): Promise<ExportCollectionSummary[]> {
    const collections = new Map<string, Document[]>();
    for (const name of this.listCollections()) {
      collections.set(name, this.storage.getCollection(this.databaseName, name));
    }
    return exportCollectionsToMongo(collections, this.databaseName, targetUri, options);
  }
}
