"""
MAO Platform — Batch Directory Ingest
Upload all supported documents in a directory to the MAO knowledge base.

Usage:
    python ingest_directory.py /path/to/documents/
    python ingest_directory.py /path/to/docs/ --namespace compliance --recursive
    python ingest_directory.py ./reports/ --dry-run
"""

import argparse
import os
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("MAO_BASE_URL", "https://app.inflexis.ai")
AUTH = (os.getenv("MAO_USERNAME", ""), os.getenv("MAO_PASSWORD", ""))

# Supported file extensions
SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".xlsx",
    ".txt", ".md", ".rtf",
    ".csv", ".tsv", ".json",
    ".html", ".xml",
    ".mp3", ".mp4", ".wav", ".flac", ".webm",
}


def find_files(directory: str, recursive: bool = False) -> list[str]:
    """Find all supported files in directory."""
    files = []
    if recursive:
        for root, _, filenames in os.walk(directory):
            for name in filenames:
                ext = os.path.splitext(name)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    files.append(os.path.join(root, name))
    else:
        for name in os.listdir(directory):
            filepath = os.path.join(directory, name)
            if os.path.isfile(filepath):
                ext = os.path.splitext(name)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    files.append(filepath)
    return sorted(files)


def ingest_file(filepath: str, namespace: str, owner: str = None) -> dict:
    """Upload a single file."""
    filename = os.path.basename(filepath)
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
            timeout=300,
        )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description="Batch ingest a directory of documents")
    parser.add_argument("directory", help="Directory containing documents to ingest")
    parser.add_argument("--namespace", "-n", default="documents", help="Target namespace")
    parser.add_argument("--owner", "-o", default=None, help="Owner username")
    parser.add_argument("--recursive", "-r", action="store_true", help="Include subdirectories")
    parser.add_argument("--dry-run", action="store_true", help="List files without uploading")
    parser.add_argument("--delay", type=float, default=0.5, help="Seconds between uploads (default: 0.5)")
    args = parser.parse_args()

    if not os.path.isdir(args.directory):
        print(f"Error: '{args.directory}' is not a directory.")
        sys.exit(1)

    if not AUTH[0] or not AUTH[1]:
        print("Error: Set MAO_USERNAME and MAO_PASSWORD in your .env file.")
        sys.exit(1)

    files = find_files(args.directory, recursive=args.recursive)

    if not files:
        print(f"No supported files found in '{args.directory}'.")
        sys.exit(0)

    total_size = sum(os.path.getsize(f) for f in files)
    print(f"\nFound {len(files)} files ({total_size / 1024 / 1024:.1f} MB total)")
    print(f"Target namespace: {args.namespace}")
    if args.dry_run:
        print("\n[DRY RUN — files listed but not uploaded]\n")
        for f in files:
            size = os.path.getsize(f) / 1024
            print(f"  {os.path.basename(f):50s} ({size:.0f} KB)")
        return

    print(f"\nStarting ingest...\n")
    success = 0
    failed = []

    for i, filepath in enumerate(files, 1):
        filename = os.path.basename(filepath)
        size_kb = os.path.getsize(filepath) / 1024
        print(f"[{i}/{len(files)}] {filename} ({size_kb:.0f} KB)... ", end="", flush=True)

        try:
            result = ingest_file(filepath, namespace=args.namespace, owner=args.owner)
            chunks = result.get("chunks_created", 0)
            print(f"✓ {chunks} chunks")
            success += 1
        except requests.exceptions.HTTPError as e:
            print(f"✗ HTTP {e.response.status_code}")
            failed.append((filename, str(e.response.status_code)))
        except Exception as e:
            print(f"✗ {e}")
            failed.append((filename, str(e)))

        if i < len(files) and args.delay > 0:
            time.sleep(args.delay)

    print(f"\n{'=' * 50}")
    print(f"Complete: {success}/{len(files)} files ingested successfully")
    if failed:
        print(f"\nFailed ({len(failed)}):")
        for name, err in failed:
            print(f"  ✗ {name}: {err}")
    print()


if __name__ == "__main__":
    main()
