<div align="center">

# MAO Platform — Integration Examples

### Code samples, API patterns, and integration guides for AIXaaS™

**[Platform Docs](https://github.com/inflexis-ai/aixaas-docs)** · **[Live Platform](https://app.inflexis.ai)** · [inflexis.ai](https://inflexis.ai)

</div>

---

## Overview

This repository contains integration examples, API usage patterns, and reference scripts for the MAO Platform (AIXaaS™). All examples use the public REST API — no internal platform code is exposed.

---

## Examples

### API Integration

| Example | Description |
|---|---|
| [scripts/chat_query.py](scripts/chat_query.py) | Submit a query to the knowledge base and display sources |
| [scripts/ingest_document.py](scripts/ingest_document.py) | Upload a document to a namespace |
| [scripts/ingest_directory.py](scripts/ingest_directory.py) | Batch ingest an entire directory of documents |
| [scripts/check_status.py](scripts/check_status.py) | Check platform health, KB stats, and budget usage |
| [scripts/list_namespaces.py](scripts/list_namespaces.py) | List all accessible namespaces and their chunk counts |

### Notebooks

| Notebook | Description |
|---|---|
| [notebooks/01_first_query.ipynb](notebooks/01_first_query.ipynb) | Your first MAO Platform query — step by step |
| [notebooks/02_bulk_ingest.ipynb](notebooks/02_bulk_ingest.ipynb) | Ingesting a document library and querying results |
| [notebooks/03_compliance_scan.ipynb](notebooks/03_compliance_scan.ipynb) | Uploading documents and inspecting compliance framework detection |
| [notebooks/04_meeting_analysis.ipynb](notebooks/04_meeting_analysis.ipynb) | Uploading a meeting recording and retrieving SPICED scorecard |
| [notebooks/05_multi_namespace.ipynb](notebooks/05_multi_namespace.ipynb) | Working with role-scoped namespaces |

---

## Quickstart

### Prerequisites

```bash
pip install requests python-dotenv
```

### Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
MAO_BASE_URL=https://app.inflexis.ai
MAO_USERNAME=your-username
MAO_PASSWORD=your-password
```

### Run Your First Query

```python
import requests
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("MAO_BASE_URL", "https://app.inflexis.ai")
AUTH = (os.getenv("MAO_USERNAME"), os.getenv("MAO_PASSWORD"))

response = requests.post(
    f"{BASE_URL}/api/chat",
    auth=AUTH,
    json={
        "query": "What compliance frameworks apply to our documents?",
        "top_k": 5,
    }
)

result = response.json()
print(result["response"])
print(f"\nSources: {[s['source'] for s in result['sources']]}")
print(f"Model: {result['model']}")
```

---

## Repository Structure

```
mao-examples/
├── scripts/           # Standalone Python scripts — copy and run
│   ├── chat_query.py
│   ├── ingest_document.py
│   ├── ingest_directory.py
│   ├── check_status.py
│   └── list_namespaces.py
├── notebooks/         # Jupyter notebooks — step-by-step walkthroughs
│   ├── 01_first_query.ipynb
│   ├── 02_bulk_ingest.ipynb
│   ├── 03_compliance_scan.ipynb
│   ├── 04_meeting_analysis.ipynb
│   └── 05_multi_namespace.ipynb
├── .env.example       # Environment template
├── requirements.txt   # Python dependencies
└── README.md
```

---

## Requirements

```
requests>=2.31.0
python-dotenv>=1.0.0
jupyter>=1.0.0        # For notebooks only
pandas>=2.0.0         # For data manipulation examples
```

---

## Platform Documentation

Full API reference, architecture docs, and integration guides are available in the [aixaas-docs](https://github.com/inflexis-ai/aixaas-docs) repository.

---

## Access & Support

MAO Platform access is required to run these examples. Contact [bryan.shaw@inflexis.ai](mailto:bryan.shaw@inflexis.ai) to request access or discuss enterprise deployment.

---

<div align="center">
<sub>© 2026 Inflexis · Examples are provided for integration reference. AIXaaS™ platform source code is proprietary.</sub>
</div>
