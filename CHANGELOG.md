# Changelog

## v0.6.0 (2026-03-18)

### Features

- feat: add tool get_budget (`3b00e68`)
- feat: add list_budgets tool (`c915657`)
- feat: add find_cloud_diagrams tool and related functionality (`8717dab`)
- feat: add search expert inquriy prompt (`49be95f`)
- feat: add prompts for expert inquiry (`1a2c59b`)

### Bug Fixes

- fix(security): update hono from 4.8.3 to 4.12.7 (`5ceab08`)

### Chores

- chore: better expert inquiry search prompt and tests (`8c92570`)
- chore: better tests/docs (`f5ce130`)

### Other Changes

- refactor: move filterFields to prompts (`f422dd0`)
- refactor: prompts from utils to top level package split into modules (`d50350c`)


## v0.5.0 (2026-03-11)

### Features

- feat: add get_label tool (`0c0185a`)
- feat: add scripts to help create changelog and release notes (`cbf1c46`)
- feat: add tool list_labels (`252a60c`)
- feat: add list_products tool (`4a4c75d`)
- feat: add list_roles tool (`bc03860`)
- feat: define zodToInputSchema to re-use zod schemas for tool schema (`2ee514e`)
- feat: add list_users tool (`1296ee8`)

### Bug Fixes

- fix: tool error messages are now valid MCP error response (`65ec4bf`)

### Chores

- chore: add github workflow to check commit message formats (`6307b92`)
- chore: add pre-commit config (`94dc343`)
- chore: improve docs (`86cf624`)
- chore: biomjs format and lint integration tests (`16855e6`)
- chore: add integration test setup for stdio server (`b6479d6`)
- chore: improve tests, mock console.error to prevent stderr messages (`03b743e`)
