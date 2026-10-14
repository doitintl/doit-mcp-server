# Azure

The MVP binds a management group within an explicit tenant. Subscription, tenant-wide and billing-benefits assignments are not additional binding kinds. Resolve current feature eligibility and roles from requirements; do not infer support from a feature seen in another onboarding flow.

Use the customer tenant's resolved enterprise application principal. Consent can be pending; wait for customer-authorized consent and re-resolve. Never reuse a principal ID from a different tenant or guess a service principal while resolution is incomplete.

Use the returned [CLI recipe](azure-deployment.md) or the customer's existing ARM/Terraform source. Include the returned role scope and principal type in every assignment. A tenant-scope listing is not a substitute for a management-group role probe. CLI/ARM role assignment alone does not register; follow the artifact's explicit registration handoff. An existing Console onboarding verification that already upserts the connection must not be followed by duplicate registration.

Check live role-assignment and feature-specific verification outcomes. Role propagation can take time; preserve retry timing and stop after bounded attempts if the same prerequisite remains unresolved. Disconnect removes the DoiT record; customer-managed role assignments and enterprise application cleanup need their own ownership review.
