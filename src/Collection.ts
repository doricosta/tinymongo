import { ObjectId } from "./ObjectId.js";
import { Cursor } from "./Cursor.js";
import { matchQuery, type Document, type Filter } from "./query/matchQuery.js";
import { applyUpdate } from "./query/applyUpdate.js";
import { cloneValue } from "./clone.js";
import type { FileStorage } from "./storage/FileStorage.js";

export interface InsertOneResult {
  acknowledged: true;
  insertedId: ObjectId;
}

export interface InsertManyResult {
  acknowledged: true;
  insertedCount: number;
  insertedIds: Record<number, ObjectId>;
}

export interface UpdateResult {
  acknowledged: true;
  matchedCount: number;
  modifiedCount: number;
}

export interface DeleteResult {
  acknowledged: true;
  deletedCount: number;
}

export class Collection<T extends Document = Document> {
  constructor(
    private readonly storage: FileStorage,
    private readonly dbName: string,
    readonly collectionName: string,
  ) {}

  private get docs(): Document[] {
    return this.storage.getCollection(this.dbName, this.collectionName);
  }

  private async persist(): Promise<void> {
    await this.storage.persist();
  }

  async insertOne(doc: T): Promise<InsertOneResult> {
    const toInsert = cloneValue(doc) as Document;
    if (toInsert._id === undefined) toInsert._id = new ObjectId();
    this.docs.push(toInsert);
    await this.persist();
    return { acknowledged: true, insertedId: toInsert._id as ObjectId };
  }

  async insertMany(docs: T[]): Promise<InsertManyResult> {
    const insertedIds: Record<number, ObjectId> = {};
    docs.forEach((doc, index) => {
      const toInsert = cloneValue(doc) as Document;
      if (toInsert._id === undefined) toInsert._id = new ObjectId();
      this.docs.push(toInsert);
      insertedIds[index] = toInsert._id as ObjectId;
    });
    await this.persist();
    return { acknowledged: true, insertedCount: docs.length, insertedIds };
  }

  async findOne(filter: Filter = {}): Promise<T | null> {
    const found = this.docs.find((doc) => matchQuery(doc, filter));
    return found ? (cloneValue(found) as T) : null;
  }

  find(filter: Filter = {}): Cursor<T> {
    const matches = this.docs.filter((doc) => matchQuery(doc, filter));
    return new Cursor<T>(cloneValue(matches) as T[]);
  }

  async countDocuments(filter: Filter = {}): Promise<number> {
    return this.docs.filter((doc) => matchQuery(doc, filter)).length;
  }

  async updateOne(filter: Filter, update: Document): Promise<UpdateResult> {
    const index = this.docs.findIndex((doc) => matchQuery(doc, filter));
    if (index === -1) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    this.docs[index] = applyUpdate(this.docs[index], update);
    await this.persist();
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(filter: Filter, update: Document): Promise<UpdateResult> {
    let modifiedCount = 0;
    this.docs.forEach((doc, index) => {
      if (matchQuery(doc, filter)) {
        this.docs[index] = applyUpdate(doc, update);
        modifiedCount++;
      }
    });
    if (modifiedCount > 0) await this.persist();
    return { acknowledged: true, matchedCount: modifiedCount, modifiedCount };
  }

  async replaceOne(filter: Filter, replacement: T): Promise<UpdateResult> {
    const index = this.docs.findIndex((doc) => matchQuery(doc, filter));
    if (index === -1) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    const _id = this.docs[index]._id;
    this.docs[index] = { _id, ...cloneValue(replacement) } as Document;
    await this.persist();
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(filter: Filter): Promise<DeleteResult> {
    const index = this.docs.findIndex((doc) => matchQuery(doc, filter));
    if (index === -1) return { acknowledged: true, deletedCount: 0 };
    this.docs.splice(index, 1);
    await this.persist();
    return { acknowledged: true, deletedCount: 1 };
  }

  async deleteMany(filter: Filter = {}): Promise<DeleteResult> {
    const docs = this.docs;
    const remaining = docs.filter((doc) => !matchQuery(doc, filter));
    const deletedCount = docs.length - remaining.length;
    if (deletedCount > 0) {
      docs.length = 0;
      docs.push(...remaining);
      await this.persist();
    }
    return { acknowledged: true, deletedCount };
  }
}
