"""
MAO Platform — Chat Query Example
Submit a question to the knowledge base and display the grounded response with sources.

Usage:
    python chat_query.py "What compliance frameworks apply to our industrial documents?"
    python chat_query.py "Summarize the key findings" --namespace compliance --top-k 10
"""

import argparse
import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("MAO_BASE_URL", "https://app.inflexis.ai")
AUTH = (os.getenv("MAO_USERNAME", ""), os.getenv("MAO_PASSWORD", ""))


def query(text: str, namespace: str = None, top_k: int = 8) -> dict:
    """Submit a query to the MAO knowledge base."""
    payload = {"query": text, "top_k": top_k}
    if namespace:
        payload["namespace"] = namespace

    resp = requests.post(
        f"{BASE_URL}/api/chat",
        auth=AUTH,
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def display(result: dict) -> None:
    """Print a formatted response."""
    print("\n" + "=" * 70)
    print("RESPONSE")
    print("=" * 70)
    print(result["response"])

    if result.get("sources"):
        print("\n" + "-" * 70)
        print(f"SOURCES  ({result['chunks_used']} chunks used from '{result['namespace_searched']}')")
        print("-" * 70)
        for i, src in enumerate(result["sources"], 1):
            score_pct = f"{src['score']:.0%}"
            print(f"  [{i}] {src['source']}  (relevance: {score_pct})")
            if src.get("excerpt"):
                excerpt = src["excerpt"][:120].replace("\n", " ")
                print(f"      {excerpt}...")

    model = result.get("model", "unknown")
    grounded = "✓ grounded" if result.get("grounded") else "ungrounded"
    cached = " (cached)" if "cached" in model else ""
    print(f"\n  Model: {model}{cached}  |  {grounded}")

    usage = result.get("usage", {})
    if usage:
        print(f"  Budget: {usage.get('used', '?')}/{usage.get('limit', '?')} calls today")

    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Query the MAO Platform knowledge base")
    parser.add_argument("query", help="Question to ask")
    parser.add_argument("--namespace", "-n", default=None, help="Namespace to search")
    parser.add_argument("--top-k", "-k", type=int, default=8, help="Number of chunks to retrieve")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    if not AUTH[0] or not AUTH[1]:
        print("Error: Set MAO_USERNAME and MAO_PASSWORD in your .env file.")
        sys.exit(1)

    try:
        result = query(args.query, namespace=args.namespace, top_k=args.top_k)
    except requests.exceptions.HTTPError as e:
        print(f"API error: {e.response.status_code} — {e.response.text}")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"Connection failed. Is {BASE_URL} reachable?")
        sys.exit(1)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        display(result)


if __name__ == "__main__":
    main()
