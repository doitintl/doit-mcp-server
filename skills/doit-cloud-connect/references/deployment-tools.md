# Local deployment review and evidence

Keep source files, credentials, Terraform state, plans and raw logs in the customer's environment. DoiT requirements are the expected access contract; a customer-produced preview is not server-verified evidence.

**Terraform:** inspect the provider/module versions and `terraform show -json` of a saved plan. Compare planned identity and scope, trust principal/External ID, grants and artifact parameters with the fresh requirements response. Read `resource_changes` and `after_unknown`: unknown trust or permission values are unresolved, never passing. Identify deletions/replacements and permissions removed from shared policies. Apply through the customer's normal gate.

**CloudFormation:** inspect the actual template and change set: parameters, replacements, IAM policies and hooks. Confirm the hook input (`FeatureFlags`) differs from the deployed stack before a feature update. Check StackSet member instances separately from the parent operation. Record terminal stack events and the CloudFormation `RequestId` of a failed hook locally: callback success and CloudFormation response delivery are different observations, and DoiT-side logs are not available to the customer.

**Other controllers** (CDK, Pulumi, scripts): if there is no reliable preview, prepare reviewable commands and say what cannot be proved before execution. Never replace an IAM policy from a partial listing.

A registration dry run previews backend effects and performs DoiT's live gate where the broker can probe without registration. New AWS roles have an explicit limitation (see the AWS reference); registration must still pass the live gate. A dry run cannot validate a cloud plan before that access exists, so re-run after deployment rather than reading a pre-deployment identity failure as proof the plan is wrong.
