# Security policy

## Supported versions

Until UA Compass reaches 1.0, security fixes are provided for the latest published `0.x` minor line only.

## Reporting a vulnerability

Please report suspected vulnerabilities privately by email to `ckidoz@gmail.com` with the subject `UA Compass security report`. Include affected versions, reproduction steps, impact, and any suggested mitigation. Do not open a public issue until a coordinated disclosure date is agreed.

Receipt should be acknowledged within seven days. The maintainer will validate the report, coordinate a fix and release, and credit the reporter if requested. If the email channel is unavailable for seven days, open a GitHub issue containing no exploit details and request a private contact.

User-Agent strings, Client Hints, and custom packs cross untrusted-input boundaries. Reports involving hangs, disproportionate CPU/memory use, validation bypasses, prototype pollution, mutation across calls, or malformed Unicode are particularly useful.
