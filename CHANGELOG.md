# Changelog

## v0.11.0 (2026-04-01)

### Features

- feat: add list_ticket_comments tool for retrieving comments on support tickets (`0dd7352`)

## v0.10.0 (2026-04-01)

### Features

- feat: add commitment management tools for listing and retrieving comm… (#147) (`0b5127e`)
- feat: add get_ticket tool for retrieving support ticket details (#148) (`22314c2`)
- feat: add invite_user tool for inviting new users (#145) (`ea8511a`)
- feat: add update_user tool for user information updates (#144) (`72ee461`)
- feat: add get_report_config tool for retrieving report configurations (`3c6a0e7`)
- feat: add send_datahub_events tool for event ingestion (#142) (`420b2f2`)
- feat: add create and update DataHub dataset tools with request handlers (#140) (`835485f`)
- feat: OpenAI Apps SDK compliance for ChatGPT app submission (`79f3fff`)

## v0.9.0 (2026-03-26)

### Features

- feat: add doit-mcp-api agent skill (#131) (`c0010d6`)
- feat: add get_asset tool and update assets handling (#135) (`3619b5f`)
- feat: add label assignment tools and update documentation (#134) (`2c49a7e`)
- feat: add create_label and update_label tools (#133) (`a7ceb24`)
- feat: add create_annotation and update_annotation tools with corresponding request handlers and tests (`3695051`)
- feat(mcp): add skills (#123) (`1eeeb25`)
- feat: add list_annotations and get_annotation tools (#130) (`e77fb29`)
- feat: add update_report tool and related functionality (`96885fc`)
- feat: add create_report tool and related functionality (#127) (`25e83b8`)
- feat: add create_alert tool and related functionality (#125) (`97bf079`)
- feat: update alert (#126) (`4a487f2`)

## v0.8.0 (2026-03-19)

### Features

- feat: add update_budget tool (`7332fee`)

## v0.7.0 (2026-03-18)

### Features

- feat: tool create_budget (`204a09e`)

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
