# Deployment scripts

Read this when composing or executing direct cloud CLI commands or procedural setup scripts. Apply the shared [deployment rules](deployment-tools.md), including the guidance for replacing an existing IAM policy.

Inspect the script's commands and dependencies, resolve the execution identity and targets, and compare its proposed changes with fresh requirements. Compose it around discovered state: reuse compatible resources, add missing grants while preserving unrelated bindings and conditions, and record completed steps so a retry can rediscover partial success. If another controller owns the resources, express the change in that controller's source.

Use a reliable preview where available and explain which effects it covers. Syntax checks alone do not validate cloud identity, permissions or resource existence. A script that invokes `aws cloudformation` follows the [CloudFormation](cloudformation.md) deployment and callback behavior; read that reference when working on those commands. Direct `aws iam` operations follow the script's own change and registration logic. Identify that logic explicitly.

**Example and possible checks: adapt a setup script to an existing role.** Compare its current trust and permissions with fresh requirements before composing the required updates, preserving unrelated grants. Include any required registration handoff in the proposed implementation. After a partial failure, the command output and rediscovered cloud state can show which steps completed and whether a repair or retry is needed.
