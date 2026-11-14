import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { demoPassword } from "../src/auth.ts";

function run(password: string | undefined, authorization?: string) {
  let passed = false;
  let status = 200;
  const req = { get: (h: string) => (h.toLowerCase() === "authorization" ? authorization : undefined) } as any;
  const res = { set() { return res; }, status(s: number) { status = s; return res; }, send() { return res; } } as any;
  demoPassword(password)(req, res, () => { passed = true; });
  return { passed, status };
}
const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

describe("demo password", () => {
  test("open when no password is configured", () => assert.equal(run(undefined).passed, true));
  test("asks for the password when none is sent", () => assert.deepEqual(run("s3cret"), { passed: false, status: 401 }));
  test("refuses a wrong password", () => assert.equal(run("s3cret", basic("x", "nope")).passed, false));
  test("accepts the right password with any user name", () => assert.equal(run("s3cret", basic("anyone", "s3cret")).passed, true));
  test("a password containing ':' still works", () => assert.equal(run("a:b", basic("u", "a:b")).passed, true));
});
