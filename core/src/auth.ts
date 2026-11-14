// Password on the demo page once it is online, so strangers can't spend the Anthropic credit.
// Set DEMO_PASSWORD on the server. The browser asks for it (any user name works).
// Without DEMO_PASSWORD (local use) the page is open.
import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function demoPassword(password: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!password) return next();
    const header = req.get("authorization") ?? "";
    if (header.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (same(given, password)) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="TIRAEZ demo", charset="UTF-8"');
    res.status(401).send("Password required.");
  };
}
