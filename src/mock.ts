// Mock core API for Part B (voice): the real v1 router running on the fixture agency
// and its 20 listings, in memory. Leads and events are lost on restart.
//   npm run mock   ->  http://localhost:4010/v1
import "./env.ts";
import express from "express";
import { createApiRouter } from "./api/router.ts";
import { MemoryCoreStore } from "./api/store.ts";

export const MOCK_API_KEY = "tz_test_voice_000000000000000000000000";

const port = Number(process.env.MOCK_PORT) || 4010;
const app = express();
app.use(
  "/v1",
  createApiRouter({
    store: MemoryCoreStore.fromFixtures(),
    apiKeys: [MOCK_API_KEY],
    onRequest: (r) => console.log(`${r.method} ${r.path} -> ${r.status} (${r.ms} ms)`),
  }),
);
app.listen(port, () => {
  console.log(`Mock core API (contract v1) at http://localhost:${port}/v1`);
  console.log(`API key: ${MOCK_API_KEY}`);
  console.log("Test agency id: costa-test-homes. See contract/README.md.");
});
