"""
MAO Platform — Document Ingest Example
Upload a document to the MAO knowledge base.

Usage:
    python ingest_document.py path/to/document.pdf
    python ingest_document.py report.docx --namespace compliance --owner bryan
    python ingest_document.py meeting.mp4 --namespace meetings

Supported file types:
    Documents: PDF, DOCX, PPTX, XLSX, TXT, MD, RTF
    Structured: CSV, TSV, JSON
    Web: HTML, XML
    Audio/Video: MP3, MP4, WAV, FLAC, WEBM
"""

import argparse
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("MAO_BASE_URL", "https://app.inflexis.ai")
AUTH = (os.getenv("MAO_USERNAME", ""), os.getenv("MAO_PASSWORD", ""))


def ingest(filepath: str, namespace: str = "documents", owner: str = None) -> dict:
    """Upload a file to the MAO knowledge base."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    filename = os.path.basename(filepath)
    filesize = os.path.getsize(filepath)
    print(f"Uploading: {filename} ({filesize / 1024:.1f} KB) → namespace '{namespace}'")

    with open(filepath, "rb") as f:
        files = {"file": (filename, f)}
        data = {"namespace": namespace}
        if owner:
            data["owner"] = owner

        resp = requests.post(
            f"{BASE_URL}/api/ingest/file",
            auth=AUTH,
            files=files,
            data=data,
            timeout=300,  # Large files / audio transcription can take time
        )

    resp.raise_for_status()
    return resp.json()


def display(result: dict) -> None:
    """Print ingest result summary."""
    status = result.get("status", "unknown")
    icon = "✓" if status == "success" else "✗"

    print(f"\n{icon} Ingest {status.upper()}")
    print(f"  File:       {result.get('filename', '?')}")
    print(f"  Hash:       {result.get('file_hash', '?')[:12]}...")
    print(f"  Chunks:     {result.get('chunks_created', 0)}")
    print(f"  Storage:    {result.get('storage_mode', '?')}")

    frameworks = result.get("compliance_frameworks", [])
    if frameworks:
        print(f"  Compliance: {', '.join(frameworks)}")

    adr = result.get("adr_id")
    if adr:
        print(f"  ADR:        {adr}")

    print()


def main():
    parser = argparse.ArgumentParser(description="Upload a document to the MAO knowledge base")
    parser.add_argument("filepath", help="Path to the file to upload")
    parser.add_argument("--namespace", "-n", default="documents", help="Target namespace (default: documents)")
    parser.add_argument("--owner", "-o", default=None, help="Owner username for access scoping")
    args = parser.parse_args()

    if not AUTH[0] or not AUTH[1]:
        print("Error: Set MAO_USERNAME and MAO_PASSWORD in your .env file.")
        sys.exit(1)

    try:
        result = ingest(args.filepath, namespace=args.namespace, owner=args.owner)
        display(result)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(f"API error: {e.response.status_code} — {e.response.text}")
        sys.exit(1)


if __name__ == "__main__":
    main()
