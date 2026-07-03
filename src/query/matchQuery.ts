import { ObjectId } from "../ObjectId.js";

export type Document = Record<string, unknown>;
export type Filter = Record<string, unknown>;

function getByPath(doc: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = doc;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof ObjectId || b instanceof ObjectId) {
    return String(a) === String(b);
  }
  if (a instanceof Date || b instanceof Date) {
    return new Date(a as Date).getTime() === new Date(b as Date).getTime();
  }
  return a === b;
}

function compare(a: unknown, b: unknown): number {
  if (a instanceof Date || b instanceof Date) {
    return new Date(a as Date).getTime() - new Date(b as Date).getTime();
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  return a === b ? 0 : NaN;
}

function matchesCondition(fieldValue: unknown, condition: unknown): boolean {
  if (condition !== null && typeof condition === "object" && !Array.isArray(condition) && !(condition instanceof RegExp)) {
    const ops = condition as Record<string, unknown>;
    const opKeys = Object.keys(ops).filter((k) => k.startsWith("$"));
    if (opKeys.length > 0) {
      return opKeys.every((op) => evalOperator(op, fieldValue, ops[op]));
    }
  }
  if (condition instanceof RegExp) {
    return typeof fieldValue === "string" && condition.test(fieldValue);
  }
  if (Array.isArray(fieldValue)) {
    if (fieldValue.some((v) => valuesEqual(v, condition))) return true;
  }
  return valuesEqual(fieldValue, condition);
}

function evalOperator(op: string, fieldValue: unknown, expected: unknown): boolean {
  switch (op) {
    case "$eq":
      return matchesCondition(fieldValue, expected);
    case "$ne":
      return !matchesCondition(fieldValue, expected);
    case "$gt": {
      const c = compare(fieldValue, expected);
      return !Number.isNaN(c) && c > 0;
    }
    case "$gte": {
      const c = compare(fieldValue, expected);
      return !Number.isNaN(c) && c >= 0;
    }
    case "$lt": {
      const c = compare(fieldValue, expected);
      return !Number.isNaN(c) && c < 0;
    }
    case "$lte": {
      const c = compare(fieldValue, expected);
      return !Number.isNaN(c) && c <= 0;
    }
    case "$in":
      return (expected as unknown[]).some((v) => matchesCondition(fieldValue, v));
    case "$nin":
      return !(expected as unknown[]).some((v) => matchesCondition(fieldValue, v));
    case "$exists":
      return (fieldValue !== undefined) === Boolean(expected);
    case "$regex": {
      const pattern = expected instanceof RegExp ? expected : new RegExp(String(expected));
      return typeof fieldValue === "string" && pattern.test(fieldValue);
    }
    case "$not":
      return !matchesCondition(fieldValue, expected);
    case "$size":
      return Array.isArray(fieldValue) && fieldValue.length === expected;
    case "$all":
      return Array.isArray(fieldValue) && (expected as unknown[]).every((v) => fieldValue.some((fv) => valuesEqual(fv, v)));
    case "$elemMatch":
      return Array.isArray(fieldValue) && fieldValue.some((v) => matchQuery(v as Document, expected as Filter));
    default:
      throw new Error(`Unsupported query operator: ${op}`);
  }
}

export function matchQuery(doc: Document, filter: Filter): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "$and") {
      return (condition as Filter[]).every((f) => matchQuery(doc, f));
    }
    if (key === "$or") {
      return (condition as Filter[]).some((f) => matchQuery(doc, f));
    }
    if (key === "$nor") {
      return !(condition as Filter[]).some((f) => matchQuery(doc, f));
    }
    const fieldValue = getByPath(doc, key);
    return matchesCondition(fieldValue, condition);
  });
}
