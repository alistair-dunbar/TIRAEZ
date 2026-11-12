// Loads .env into process.env if the file exists. Node 20.12+ has this built in,
// so no dotenv dependency is needed. Real environment variables win over .env.
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
