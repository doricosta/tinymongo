import { ObjectId } from "./ObjectId.js";

export function cloneValue<T>(value: T): T {
  if (value instanceof ObjectId) return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = cloneValue(val);
    }
    return result as T;
  }
  return value;
}
