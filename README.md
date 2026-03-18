<div align="center">

<img src="https://img.shields.io/badge/AIXaaS™-Integration%20Examples-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white" alt="MAO Examples"/>

# MAO Platform — Integration Examples

**Production-ready scripts and notebooks for the AIXaaS™ REST API**

[![Platform](https://img.shields.io/badge/platform-live-brightgreen?style=flat-square)](https://app.inflexis.ai)
[![Python](https://img.shields.io/badge/python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-aixaas--docs-blue?style=flat-square)](https://github.com/inflexis-ai/aixaas-docs)
[![Issues](https://img.shields.io/github/issues/inflexis-ai/mao-examples?style=flat-square)](https://github.com/inflexis-ai/mao-examples/issues)

<br/>

[**Platform Docs →**](https://github.com/inflexis-ai/aixaas-docs) · [**API Reference →**](https://github.com/inflexis-ai/aixaas-docs/blob/main/docs/integrations/api-reference.md) · [**Get Access →**](mailto:bryan.shaw@inflexis.ai)

</div>

---

## Overview

This repository contains **integration examples, Python scripts, and Jupyter notebooks** for the MAO Platform (AIXaaS™). All examples interact with the public REST API — no internal platform code is exposed or required.

Everything here is designed to be **copy-paste ready**: configure your `.env`, run the script, get results.

---

## Examples

### 🐍 Python Scripts

| Script | What It Does |
|---|---|
| [`scripts/chat_query.py`](scripts/chat_query.py) | Query the knowledge base with a question — displays grounded response, sources, model used, and budget status |
| [`scripts/ingest_document.py`](scripts/ingest_document.py) | Upload a single document to a namespace — shows chunk count, compliance frameworks detected, ADR record |
| [`scripts/ingest_directory.py`](scripts/ingest_directory.py) | Batch-upload an entire directory — supports `--recursive`, `--dry-run`, configurable delay |
| [`scripts/check_status.py`](scripts/check_status.py) | Platform health check — KB stats, model config, budget usage, semantic cache hit rate |

### 📓 Jupyter Notebooks

| Notebook | What It Covers |
|---|---|
| [`notebooks/01_first_query.ipynb`](notebooks/01_first_query.ipynb) | Your first MAO Platform query — authenticate, ask a question, inspect sources |
| [`notebooks/02_bulk_ingest.ipynb`](notebooks/02_bulk_ingest.ipynb) | Ingest a document library and measure search quality before and after |
| [`notebooks/03_compliance_scan.ipynb`](notebooks/03_compliance_scan.ipynb) | Upload documents, inspect which compliance frameworks were detected, explore the ADR pipeline log |
| [`notebooks/04_meeting_analysis.ipynb`](notebooks/04_meeting_analysis.ipynb) | Upload a meeting recording, retrieve SPICED scorecard and action items |
| [`notebooks/05_multi_namespace.ipynb`](notebooks/05_multi_namespace.ipynb) | Work with role-scoped namespaces, compare retrieval across knowledge sectors |

---

## Quickstart

### 1. Clone & install

```bash
git clone https://github.com/inflexis-ai/mao-examples.git
cd mao-examples
pip install -r requirements.txt
```

### 2. Configure credentials

```bash
cp .env.example .env
# Edit .env with your MAO Platform credentials
```

```ini
# .env
MAO_BASE_URL=https://app.inflexis.ai
MAO_USERNAME=your-username
MAO_PASSWORD=your-password
MAO_DEFAULT_NAMESPACE=documents
```

### 3. Verify connectivity

```bash
python scripts/check_status.py
```

```
==============================
MAO PLATFORM STATUS
==============================
  Platform:    HEALTHY
  KB Ready:    YES
  Storage:     azure+keyword
  KB Chunks:   168,778

  Chat Status
    API Key:   ✓ configured
    Gate:      approved
    Ready:     YES
    Model:     claude-haiku-4-5-20251001
    Message:   Ready

  Budget
    Used:      3 / 100 calls
    Remaining: 97 calls today
==============================
```

### 4. Run your first query

```bash
python scripts/chat_query.py "What compliance frameworks apply to OT/ICS environments?"
```

```
======================================================================
RESPONSE
======================================================================
Based on your knowledge base, OT/ICS environments are subject to
several regulatory frameworks...

----------------------------------------------------------------------
SOURCES  (8 chunks used from 'compliance')
----------------------------------------------------------------------
  [1] nerc-cip-standards.pdf      (relevance: 94%)
  [2] iec-62443-overview.pdf      (relevance: 89%)
  [3] nist-sp-800-82.pdf          (relevance: 85%)

  Model: anthropic/claude-haiku-4-5-20251001  |  ✓ grounded
  Budget: 4/100 calls today
======================================================================
```

---

## Usage Examples

### Ingest a document

```bash
python scripts/ingest_document.py reports/frenos-site-assessment.pdf \
  --namespace compliance \
  --owner bryan
```

```
Uploading: frenos-site-assessment.pdf (2.3 MB) → namespace 'compliance'

✓ Ingest SUCCESS
  File:       frenos-site-assessment.pdf
  Hash:       a3f892bc1d4e...
  Chunks:     127
  Storage:    azure+keyword
  Compliance: NERC CIP, IEC 62443, NIST SP 800-82
  ADR:        0047-INGEST
```

### Batch ingest a directory

```bash
python scripts/ingest_directory.py ./documents/ \
  --namespace compliance \
  --recursive \
  --dry-run    # Preview files without uploading

python scripts/ingest_directory.py ./documents/ \
  --namespace compliance \
  --recursive  # Then actually ingest
```

### Query with namespace scope

```python
import requests, os
from dotenv import load_dotenv

load_dotenv()
AUTH = (os.getenv("MAO_USERNAME"), os.getenv("MAO_PASSWORD"))

# Compliance-scoped query
resp = requests.post(
    "https://app.inflexis.ai/api/chat",
    auth=AUTH,
    json={
        "query": "What are our NERC CIP patching obligations?",
        "namespace": "compliance",
        "top_k": 10,
    }
)
data = resp.json()
print(f"Answer: {data['response']}")
print(f"Model:  {data['model']}")
print(f"Sources: {[s['source'] for s in data['sources']]}")
```

---

## Repository Structure

```
mao-examples/
├── scripts/                    # Standalone CLI scripts
│   ├── chat_query.py           # Query the knowledge base
│   ├── ingest_document.py      # Upload a single file
│   ├── ingest_directory.py     # Batch upload a directory
│   └── check_status.py         # Platform health check
├── notebooks/                  # Jupyter walkthroughs
│   ├── 01_first_query.ipynb
│   ├── 02_bulk_ingest.ipynb
│   ├── 03_compliance_scan.ipynb
│   ├── 04_meeting_analysis.ipynb
│   └── 05_multi_namespace.ipynb
├── .env.example                # Credentials template
├── requirements.txt            # Python dependencies
├── CONTRIBUTING.md             # How to contribute
└── README.md
```

---

## Dependencies

```
requests>=2.31.0      # HTTP client for MAO Platform REST API
python-dotenv>=1.0.0  # Load credentials from .env file
jupyter>=1.0.0        # For running notebooks
pandas>=2.0.0         # Data manipulation in notebook examples
```

---

## Platform Documentation

Full API reference, architecture guides, and integration docs:
**→ [github.com/inflexis-ai/aixaas-docs](https://github.com/inflexis-ai/aixaas-docs)**

---

## Contributing

Found a bug in an example? Have a use case that's not covered? PRs and issues are welcome.

- [Report a bug](https://github.com/inflexis-ai/mao-examples/issues/new?template=bug_report.md)
- [Request a new example](https://github.com/inflexis-ai/mao-examples/issues/new?template=feature_request.md)
- Read [CONTRIBUTING.md](CONTRIBUTING.md) first

---

## Access

MAO Platform credentials are required to run these examples. Request access:
📧 [bryan.shaw@inflexis.ai](mailto:bryan.shaw@inflexis.ai) · 🌐 [inflexis.ai](https://inflexis.ai)

---

<div align="center">
<sub>© 2026 Inflexis · Examples licensed MIT · AIXaaS™ platform is proprietary</sub>
</div>
