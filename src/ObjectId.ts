import { randomBytes } from "node:crypto";

let counter = randomBytes(3).readUIntBE(0, 3);

export class ObjectId {
  private readonly bytes: Buffer;

  constructor(id?: string | ObjectId) {
    if (id instanceof ObjectId) {
      this.bytes = Buffer.from(id.bytes);
    } else if (typeof id === "string") {
      if (!ObjectId.isValid(id)) {
        throw new Error(`Invalid ObjectId string: ${id}`);
      }
      this.bytes = Buffer.from(id, "hex");
    } else {
      this.bytes = ObjectId.generate();
    }
  }

  private static generate(): Buffer {
    const buffer = Buffer.alloc(12);
    buffer.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
    randomBytes(5).copy(buffer, 4);
    counter = (counter + 1) & 0xffffff;
    buffer.writeUIntBE(counter, 9, 3);
    return buffer;
  }

  static isValid(id: unknown): boolean {
    if (id instanceof ObjectId) return true;
    return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
  }

  toHexString(): string {
    return this.bytes.toString("hex");
  }

  toString(): string {
    return this.toHexString();
  }

  toJSON(): string {
    return this.toHexString();
  }

  equals(other: unknown): boolean {
    if (other instanceof ObjectId) return this.toHexString() === other.toHexString();
    if (typeof other === "string") return this.toHexString() === other;
    return false;
  }
}
