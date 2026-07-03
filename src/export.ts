import { ObjectId } from "./ObjectId.js";
import type { Document } from "./query/matchQuery.js";

export interface ExportCollectionSummary {
  collection: string;
  count: number;
}

export interface ExportToMongoOptions {
  /** Delete each target collection's existing documents before inserting. Default: false. */
  drop?: boolean;
  /** Database name to use on the target cluster. Defaults to the TinyMongo database name. */
  targetDatabaseName?: string;
}

type RealObjectIdConstructor = new (id?: string) => unknown;

function convertForBson(value: unknown, RealObjectId: RealObjectIdConstructor): unknown {
  if (value instanceof ObjectId) return new RealObjectId(value.toHexString());
  if (Array.isArray(value)) return value.map((item) => convertForBson(item, RealObjectId));
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = convertForBson(val, RealObjectId);
    }
    return result;
  }
  return value;
}

async function loadMongoDriver(): Promise<typeof import("mongodb")> {
  try {
    return await import("mongodb");
  } catch {
    throw new Error("exportTo() requires the 'mongodb' package. Install it with: npm install mongodb");
  }
}

export async function exportCollectionsToMongo(
  collections: Map<string, Document[]>,
  sourceDatabaseName: string,
  targetUri: string,
  options: ExportToMongoOptions = {},
): Promise<ExportCollectionSummary[]> {
  const driver = await loadMongoDriver();
  const target = new driver.MongoClient(targetUri);
  await target.connect();

  try {
    const targetDb = target.db(options.targetDatabaseName ?? sourceDatabaseName);
    const summaries: ExportCollectionSummary[] = [];

    for (const [collectionName, docs] of collections) {
      const targetCollection = targetDb.collection(collectionName);
      if (options.drop) await targetCollection.deleteMany({});
      if (docs.length > 0) {
        const converted = docs.map((doc) => convertForBson(doc, driver.ObjectId) as Document);
        await targetCollection.insertMany(converted);
      }
      summaries.push({ collection: collectionName, count: docs.length });
    }

    return summaries;
  } finally {
    await target.close();
  }
}
