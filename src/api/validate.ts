// Small JSON Schema validator for the subset the contract uses:
// type (incl. arrays for nullable), enum, required, properties, additionalProperties,
// items, minItems, maxItems, minimum, maximum, minLength, pattern, and $ref to another
// schema file. Kept in-repo to avoid a dependency; swap for ajv if the contract outgrows it.
import { readFileSync } from "node:fs";
import { repoPath } from "../data.ts";

type Schema = Record<string, any>;
const cache = new Map<string, Schema>();

export function loadSchema(name: string): Schema {
  let schema = cache.get(name);
  if (!schema) {
    schema = JSON.parse(readFileSync(repoPath(`contract/schemas/${name}`), "utf8")) as Schema;
    cache.set(name, schema);
  }
  return schema;
}

function isType(type: string, v: unknown): boolean {
  switch (type) {
    case "null": return v === null;
    case "string": return typeof v === "string";
    case "boolean": return typeof v === "boolean";
    case "number": return typeof v === "number" && Number.isFinite(v);
    case "integer": return typeof v === "number" && Number.isInteger(v);
    case "array": return Array.isArray(v);
    case "object": return typeof v === "object" && v !== null && !Array.isArray(v);
    default: return false;
  }
}

function check(schema: Schema, data: unknown, path: string): string[] {
  if (schema.$ref) return check(loadSchema(schema.$ref), data, path);
  const errors: string[] = [];

  if (schema.type) {
    const types: string[] = [].concat(schema.type);
    if (!types.some((t) => isType(t, data))) return [`${path}: expected ${types.join(" or ")}`];
  }
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: must be one of ${schema.enum.join(", ")}`);
  }
  if (typeof data === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength) errors.push(`${path}: too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errors.push(`${path}: wrong format`);
  }
  if (typeof data === "number") {
    if (schema.minimum !== undefined && data < schema.minimum) errors.push(`${path}: must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) errors.push(`${path}: must be <= ${schema.maximum}`);
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) errors.push(`${path}: too few items`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push(`${path}: too many items`);
    if (schema.items) data.forEach((item, i) => errors.push(...check(schema.items, item, `${path}[${i}]`)));
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push(`${path}.${key}: is required`);
    }
    const props: Record<string, Schema> = schema.properties ?? {};
    for (const [key, value] of Object.entries(obj)) {
      if (props[key]) errors.push(...check(props[key], value, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: is not allowed`);
      else if (typeof schema.additionalProperties === "object") {
        errors.push(...check(schema.additionalProperties, value, `${path}.${key}`));
      }
    }
  }
  return errors;
}

/** Returns a list of problems; empty means valid. */
export function validate(schemaFile: string, data: unknown): string[] {
  return check(loadSchema(schemaFile), data, "body");
}
