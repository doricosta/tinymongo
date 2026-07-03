import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoClient, ObjectId } from "../src/index.js";

describe("README example", () => {
  it("insertOne + findOne round-trip", async () => {
    const client = new MongoClient(":memory:");
    await client.connect();

    const db = client.db("app");

    await db.collection("users").insertOne({
      name: "Ada",
      role: "admin",
    });

    const user = await db.collection("users").findOne({
      name: "Ada",
    });

    expect(user).not.toBeNull();
    expect(user?.name).toBe("Ada");
    expect(user?.role).toBe("admin");
    expect(ObjectId.isValid(user?._id as string)).toBe(true);
  });
});

describe("Collection CRUD", () => {
  let client: MongoClient;

  beforeEach(async () => {
    client = new MongoClient(":memory:");
    await client.connect();
  });

  it("insertMany assigns ids and findOne/find query with operators", async () => {
    const users = client.db("app").collection("users");
    await users.insertMany([
      { name: "Ana", age: 30 },
      { name: "Bruno", age: 20 },
      { name: "Carla", age: 40 },
    ]);

    const adults = await users.find({ age: { $gte: 30 } }).sort({ age: 1 }).toArray();
    expect(adults.map((u) => u.name)).toEqual(["Ana", "Carla"]);

    const young = await users.findOne({ age: { $lt: 25 } });
    expect(young?.name).toBe("Bruno");

    const count = await users.countDocuments({ age: { $gt: 15 } });
    expect(count).toBe(3);
  });

  it("updateOne applies $set and $inc", async () => {
    const users = client.db("app").collection("users");
    const { insertedId } = await users.insertOne({ name: "Grace", age: 34 });

    await users.updateOne({ _id: insertedId }, { $set: { active: true }, $inc: { age: 1 } });

    const updated = await users.findOne({ _id: insertedId });
    expect(updated?.age).toBe(35);
    expect(updated?.active).toBe(true);
  });

  it("updateMany with $push and $pull on arrays", async () => {
    const posts = client.db("app").collection("posts");
    await posts.insertMany([
      { title: "A", tags: ["x"] },
      { title: "B", tags: ["x"] },
    ]);

    await posts.updateMany({}, { $push: { tags: "y" } });
    const all = await posts.find({}).toArray();
    expect(all.every((p) => (p.tags as string[]).includes("y"))).toBe(true);

    await posts.updateMany({}, { $pull: { tags: "x" } });
    const afterPull = await posts.find({}).toArray();
    expect(afterPull.every((p) => !(p.tags as string[]).includes("x"))).toBe(true);
  });

  it("deleteOne and deleteMany remove matching documents", async () => {
    const users = client.db("app").collection("users");
    await users.insertMany([
      { name: "Ana", age: 30 },
      { name: "Bruno", age: 20 },
    ]);

    const del = await users.deleteOne({ name: "Ana" });
    expect(del.deletedCount).toBe(1);
    expect(await users.countDocuments()).toBe(1);

    await users.deleteMany({});
    expect(await users.countDocuments()).toBe(0);
  });

  it("supports $and/$or/$in and dot-path queries", async () => {
    const users = client.db("app").collection("users");
    await users.insertMany([
      { name: "Ana", address: { city: "SP" } },
      { name: "Bruno", address: { city: "RJ" } },
    ]);

    const sp = await users.find({ "address.city": "SP" }).toArray();
    expect(sp).toHaveLength(1);

    const either = await users.find({ $or: [{ name: "Ana" }, { name: "Bruno" }] }).toArray();
    expect(either).toHaveLength(2);

    const inNames = await users.find({ name: { $in: ["Ana", "Zara"] } }).toArray();
    expect(inNames).toHaveLength(1);
  });
});

describe("File persistence", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "tinymongo-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("persists data to a single JSON file and reloads it on reconnect", async () => {
    const filePath = join(dir, "db.json");

    const client1 = new MongoClient(filePath);
    await client1.connect();
    await client1.db("app").collection("users").insertOne({ name: "Ada" });
    await client1.close();

    const raw = await readFile(filePath, "utf8");
    expect(JSON.parse(raw)).toHaveProperty("app.users");

    const client2 = new MongoClient(filePath);
    await client2.connect();
    const user = await client2.db("app").collection("users").findOne({ name: "Ada" });
    expect(user?.name).toBe("Ada");
  });
});
