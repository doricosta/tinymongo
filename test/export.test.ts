import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient as RealMongoClient, ObjectId as RealObjectId } from "mongodb";
import { MongoClient, ObjectId } from "../src/index.js";

const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI;

describe.skipIf(!MONGODB_TEST_URI)("exportTo (real MongoDB required)", () => {
  const targetDbName = `tinymongo_export_test_${Date.now()}`;
  let realClient: RealMongoClient;

  beforeAll(async () => {
    realClient = new RealMongoClient(MONGODB_TEST_URI!);
    await realClient.connect();
  });

  afterAll(async () => {
    await realClient.db(targetDbName).dropDatabase();
    await realClient.close();
  });

  it("copies collections and documents into a real MongoDB database", async () => {
    const client = new MongoClient(":memory:");
    await client.connect();
    const db = client.db("app");

    const { insertedId } = await db.collection("users").insertOne({
      name: "Ada",
      role: "admin",
    });
    await db.collection("posts").insertMany([
      { title: "Hello", authorId: insertedId },
      { title: "World", authorId: insertedId },
    ]);

    const summaries = await db.exportTo(MONGODB_TEST_URI!, { targetDatabaseName: targetDbName });

    expect(summaries).toEqual(
      expect.arrayContaining([
        { collection: "users", count: 1 },
        { collection: "posts", count: 2 },
      ]),
    );

    const targetDb = realClient.db(targetDbName);

    const exportedUser = await targetDb.collection("users").findOne({ name: "Ada" });
    expect(exportedUser).not.toBeNull();
    expect(exportedUser?._id).toBeInstanceOf(RealObjectId);
    expect(exportedUser?._id.toHexString()).toBe(insertedId.toHexString());

    const exportedPosts = await targetDb.collection("posts").find({}).toArray();
    expect(exportedPosts).toHaveLength(2);
    expect(exportedPosts[0].authorId).toBeInstanceOf(RealObjectId);
    expect(exportedPosts[0].authorId.toHexString()).toBe(insertedId.toHexString());
  });

  it("supports drop to make repeated exports idempotent", async () => {
    const client = new MongoClient(":memory:");
    await client.connect();
    const db = client.db("app");
    await db.collection("users").insertOne({ name: "Grace" });

    await db.exportTo(MONGODB_TEST_URI!, { targetDatabaseName: targetDbName, drop: true });
    await db.exportTo(MONGODB_TEST_URI!, { targetDatabaseName: targetDbName, drop: true });

    const count = await realClient.db(targetDbName).collection("users").countDocuments({ name: "Grace" });
    expect(count).toBe(1);
  });
});

describe("exportTo error handling", () => {
  it("propagates a connection error for an unreachable target URI", async () => {
    const client = new MongoClient(":memory:");
    await client.connect();
    const db = client.db("app");
    await db.collection("users").insertOne({ name: "Ada" });

    await expect(
      db.exportTo("mongodb://127.0.0.1:1/never-runs?serverSelectionTimeoutMS=200", {
        targetDatabaseName: "does-not-matter",
      }),
    ).rejects.toThrow();
  });
});

describe("ObjectId compatibility with the real driver", () => {
  it("TinyMongo ObjectId hex strings construct valid real driver ObjectIds", () => {
    const tiny = new ObjectId();
    const real = new RealObjectId(tiny.toHexString());
    expect(real.toHexString()).toBe(tiny.toHexString());
  });
});
