# Contract changelog

Every change to the shared contract, newest first. Each entry needs approval from both Part A and Part B.

## 1.1.0 (Nov 12, 2026)

- Added optional `preferred_agent_id` and `preferred_language` to `POST /callbacks` and `POST /viewings/request`, so a caller can ask for a specific agent or language. Fallback rule: Part A uses the named agent if they exist, otherwise an agent who speaks the language, otherwise the on-duty agent.
- Added examples 20 and 21.
- Not a breaking change: both fields are optional. Approved by both partners, who left the design of this one change to the author.

## 1.0.0 (signed off Nov 12, 2026)

- First version: 11 endpoints, 6 schema files, 19 examples, and the Costa Test Homes fixtures.
- Sign-off: [x] Part A  [x] Part B (both partners read it and agreed to continue)
