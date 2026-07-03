import type { Document } from "./matchQuery.js";

function getByPath(doc: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = doc;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setByPath(doc: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function unsetByPath(doc: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  let current = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== "object") return;
    current = current[part] as Record<string, unknown>;
  }
  delete current[parts[parts.length - 1]];
}

const UPDATE_OPERATORS = new Set(["$set", "$unset", "$inc", "$push", "$pull", "$addToSet", "$rename", "$min", "$max", "$mul"]);

export function isUpdateOperatorDocument(update: Document): boolean {
  return Object.keys(update).some((k) => k.startsWith("$"));
}

export function applyUpdate(doc: Document, update: Document): Document {
  const result: Record<string, unknown> = { ...doc };
  const hasOperators = isUpdateOperatorDocument(update);

  if (!hasOperators) {
    const { _id, ...rest } = update;
    return { _id: result._id, ...rest };
  }

  for (const [op, fields] of Object.entries(update)) {
    if (!UPDATE_OPERATORS.has(op)) {
      throw new Error(`Unsupported update operator: ${op}`);
    }
    const entries = Object.entries(fields as Record<string, unknown>);
    for (const [path, value] of entries) {
      switch (op) {
        case "$set":
          setByPath(result, path, value);
          break;
        case "$unset":
          unsetByPath(result, path);
          break;
        case "$inc":
          setByPath(result, path, (Number(getByPath(result, path)) || 0) + Number(value));
          break;
        case "$mul":
          setByPath(result, path, (Number(getByPath(result, path)) || 0) * Number(value));
          break;
        case "$min": {
          const current = getByPath(result, path);
          if (current === undefined || Number(value) < Number(current)) setByPath(result, path, value);
          break;
        }
        case "$max": {
          const current = getByPath(result, path);
          if (current === undefined || Number(value) > Number(current)) setByPath(result, path, value);
          break;
        }
        case "$push": {
          const current = getByPath(result, path);
          const arr = Array.isArray(current) ? [...current] : [];
          arr.push(value);
          setByPath(result, path, arr);
          break;
        }
        case "$pull": {
          const current = getByPath(result, path);
          if (Array.isArray(current)) {
            setByPath(result, path, current.filter((item) => JSON.stringify(item) !== JSON.stringify(value)));
          }
          break;
        }
        case "$addToSet": {
          const current = getByPath(result, path);
          const arr = Array.isArray(current) ? [...current] : [];
          if (!arr.some((item) => JSON.stringify(item) === JSON.stringify(value))) arr.push(value);
          setByPath(result, path, arr);
          break;
        }
        case "$rename": {
          const current = getByPath(result, path);
          unsetByPath(result, path);
          setByPath(result, String(value), current);
          break;
        }
      }
    }
  }

  return result as Document;
}
