# Security Policy

## Reporting a vulnerability

Please do not open a public GitHub issue for security findings.

Report vulnerabilities in this repository, in the published `@doitintl/doit-mcp-server`
package, or in the hosted `mcp.doit.com` endpoint to **vulnerability-report@doit.com**.
Reports are handled under DoiT's
[Vulnerability Reward Program](https://help.doit.com/docs/vendor-information/bug-bounty-program),
which also defines scope, eligibility, and the disclosure rules that apply to every report.

A useful report includes:

- the affected file, tool name, or endpoint and the version or commit you tested against
- a description of the impact and the conditions needed to reach it
- steps or a minimal proof of concept that demonstrates the issue

We acknowledge reports as quickly as we can, keep you updated while we work on a fix, and are
happy to credit you by name in the changelog once the fix ships, if you would like that.

## Scope notes for this project

This MCP server is a thin client over the [DoiT API](https://developer.doit.com/reference).
Every call is made with the operator's own API key (or OAuth session on the hosted endpoint),
and authorization is enforced server-side by the DoiT API for that identity. Findings that
require the operator's own credentials and stay within that identity's permissions are
generally treated as hardening issues rather than vulnerabilities, but we still want to hear
about them. Findings in the DoiT API or Console itself should be reported through the same
address.

## Supported versions

Only the latest release published to npm receives security fixes. Please upgrade to the
current version before reporting.
