# Contributing to MAO Examples

We welcome contributions that help developers integrate with the AIXaaS™ Platform API. This guide explains what to submit and how.

---

## What We Accept

✅ **Bug fixes** — broken scripts, incorrect API usage, outdated response schemas
✅ **New scripts** — useful CLI tools for common MAO Platform workflows
✅ **New notebooks** — step-by-step walkthroughs of platform capabilities
✅ **Improvements** — better error handling, clearer output, additional flags

❌ **We do not accept**:
- Code that imports from or depends on MAO Platform internals (use the REST API only)
- Hardcoded credentials or API keys
- Examples for unreleased API endpoints

---

## Ground Rules

**API-only access.** All examples must interact with the MAO Platform via its public REST API. No internal modules, no private imports.

**Credential safety.** Never hardcode usernames, passwords, or API keys. Always use `python-dotenv` + `.env` file, following the pattern in existing scripts.

**Tested code only.** All submitted examples must run against the live platform without errors.

---

## Submitting a PR

1. **Fork** the repository
2. **Create a branch**: `git checkout -b example/meeting-ingest-batch`
3. **Write your example** following the patterns in `scripts/`
4. **Test it** against `https://app.inflexis.ai`
5. **Open a PR** using the [PR template](.github/pull_request_template.md)

### Branch naming

| Type | Pattern | Example |
|---|---|---|
| New example | `example/description` | `example/meeting-batch-ingest` |
| Bug fix | `fix/description` | `fix/ingest-timeout-handling` |
| Notebook | `notebook/description` | `notebook/compliance-audit` |

---

## Code Style

Follow the patterns established in existing scripts:

```python
"""
MAO Platform — [Feature Name] Example
[One line description of what it does.]

Usage:
    python my_script.py arg1 [--optional flag]
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("MAO_BASE_URL", "https://app.inflexis.ai")
AUTH = (os.getenv("MAO_USERNAME", ""), os.getenv("MAO_PASSWORD", ""))
```

- Use `argparse` for CLI arguments
- Include a docstring at the top with usage examples
- Handle `requests.HTTPError` and `ConnectionError` gracefully
- Add a `timeout=` to all requests (never hang forever)
- Print meaningful, human-readable output

---

## Questions?

📧 [bryan.shaw@inflexis.ai](mailto:bryan.shaw@inflexis.ai)
