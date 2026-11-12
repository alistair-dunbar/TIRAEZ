# TIRAEZ

Multilingual AI receptionist for estate agencies: instant text replies and an AI phone receptionist. Spain first, then Dubai and Saudi Arabia.

| Folder | Owner | What it holds |
| --- | --- | --- |
| `contract/` | Both (changes need both approvals) | The API between the two halves, its schemas, examples and tests |
| `fixtures/agencies/` | Both | Test agencies: Costa Test Homes (Spain), Dubai Test Realty, Riyadh Test Estates |
| `fixtures/calls/` | Part B | Phone test scripts, per test agency, built from shared conversation blocks |
| `core/` | Part A | Core platform and text responder |
| `voice/` | Part B | AI phone receptionist |

Start with `contract/README.md`.
