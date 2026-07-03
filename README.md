# TinyMongo

Serverless MongoDB. One file. Zero configuration.

Developers love the MongoDB API, but for a small project it usually means
installing a full server, configuring Docker, volumes, authentication, and
infrastructure just to get started.

TinyMongo removes that overhead.

It is an embedded, MongoDB-API-compatible database that runs from a single
file, starts in milliseconds, and requires no server at all.

Develop locally, deploy small projects with minimal setup, and when your
application grows, migrate to a real MongoDB deployment with minimal code
changes.

## Why TinyMongo

- Single database file
- Instant startup
- Zero configuration
- Very low memory footprint
- Minimal Docker image size
- Compatible with the MongoDB API
- Export path to MongoDB when you need to scale

## Installation

```bash
npm install tinymongo
```

## Usage

```ts
import { MongoClient } from "tinymongo";

const client = new MongoClient();

await client.connect();

const db = client.db("app");

await db.collection("users").insertOne({
    name: "Ada",
    role: "admin",
});

const user = await db.collection("users").findOne({
    name: "Ada",
});
```

By default, data is persisted to a single file (`./tinymongo.db.json`) in the
current working directory. Pass `new MongoClient(":memory:")` to run without
touching disk at all.

## Migrating to MongoDB

When your application outgrows a single file, switch to the official driver:

```ts
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
```

The rest of the application stays largely unchanged.

## Exporting existing data to MongoDB

To move data you already have in a TinyMongo file into a real MongoDB
deployment, use `db.exportTo()`. It copies every collection in a TinyMongo
database into the target cluster, converting `ObjectId` values (including
ones nested inside arrays or subdocuments) so they land as native BSON
`ObjectId`s.

```ts
import { MongoClient } from "tinymongo";

const client = new MongoClient("./tinymongo.db.json");
await client.connect();

const summary = await client.db("app").exportTo(process.env.MONGODB_URI, {
    // optional: defaults to the TinyMongo database name
    targetDatabaseName: "app",
    // optional: clear each target collection before inserting, default false
    drop: false,
});

console.log(summary);
// [ { collection: "users", count: 42 }, { collection: "posts", count: 128 } ]
```

`exportTo()` requires the `mongodb` package. It is not a hard dependency of
TinyMongo — install it only when you need to export:

```bash
npm install mongodb
```

This is a one-time (or repeatable, with `drop: true`) copy, not a live sync:
it reads whatever is currently in the TinyMongo file and writes it to the
target database. See [Roadmap](#roadmap) for known gaps in this migration
path.

## Supported API

**Client & database**

- `MongoClient` — `connect()`, `close()`, `db(name)`
- `Db` — `collection(name)`, `listCollections()`, `dropCollection(name)`, `exportTo(uri, options)`

**Collection methods**

- `insertOne`, `insertMany`
- `findOne`, `find` (returns a `Cursor`)
- `updateOne`, `updateMany`, `replaceOne`
- `deleteOne`, `deleteMany`
- `countDocuments`

**Cursor**

- `sort`, `skip`, `limit`, `toArray`, `count`, async iteration

**Query operators**

`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$regex`,
`$and`, `$or`, `$nor`, `$not`, `$size`, `$all`, `$elemMatch`

**Update operators**

`$set`, `$unset`, `$inc`, `$mul`, `$min`, `$max`, `$push`, `$pull`,
`$addToSet`, `$rename`

**Identifiers**

- `ObjectId` — Mongo-compatible 24-character hex identifiers, generated
  automatically for documents inserted without an `_id`

## Persistence

The entire database — all collections across all databases created through a
single `MongoClient` — is stored in one JSON file. Writes are atomic (written
to a temporary file, then renamed into place) to avoid leaving a corrupted
file behind on crash.

## Goal

TinyMongo is not trying to replace MongoDB.

It aims to be the simplest way to get started with it: begin with a single
file, and scale to a cluster only when you actually need to.

## Roadmap

TinyMongo covers common CRUD usage today. The following are known gaps versus
the real MongoDB API and driver, ordered roughly by how likely they are to
surprise you in practice:

- [ ] `updateOne`/`updateMany` with a plain object (no `$set` etc.) currently
      performs a full replace instead of throwing, unlike real MongoDB. Code
      that forgets an update operator will silently behave differently than
      it would against a real deployment.
- [ ] No `upsert` option on `updateOne`, `updateMany`, or `replaceOne`.
- [ ] `ObjectId` and `Date` values in fields other than the top-level `_id`
      are not revived after a reload from disk — they come back as plain
      strings. Only `_id` is restored to an `ObjectId` instance on reconnect.
- [ ] No aggregation pipeline (`aggregate()`).
- [ ] No `findOneAndUpdate`, `findOneAndDelete`, `findOneAndReplace`.
- [ ] No `bulkWrite()`.
- [ ] No indexes — including unique indexes, so there is no duplicate-key
      error on `_id` or any other field.
- [ ] No transactions or sessions.
- [ ] No change streams (`watch()`).
- [ ] No `distinct()`, no `estimatedDocumentCount()`.
- [ ] `exportTo()` is a one-shot copy, not an incremental or live sync.

Contributions welcome.

## Development

```bash
npm install    # install dependencies
npm run build  # compile TypeScript to dist/
npm test       # run the test suite (vitest)
```

Some tests require a real MongoDB instance and are skipped unless
`MONGODB_TEST_URI` is set, e.g.:

```bash
docker run -d -p 27017:27017 mongo:7
MONGODB_TEST_URI="mongodb://127.0.0.1:27017" npm test
```

## License

MIT
