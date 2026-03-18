"""
MAO Platform — Platform Status Check
Verify the platform is healthy and display knowledge base statistics.

Usage:
    python check_status.py
"""

import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("MAO_BASE_URL", "https://app.inflexis.ai")
AUTH = (os.getenv("MAO_USERNAME", ""), os.getenv("MAO_PASSWORD", ""))


def check():
    """Fetch health, KB stats, and chat readiness."""
    health_resp = requests.get(f"{BASE_URL}/health", auth=AUTH, timeout=15)
    health_resp.raise_for_status()
    health = health_resp.json()

    status_resp = requests.get(f"{BASE_URL}/api/chat/status", auth=AUTH, timeout=15)
    status_resp.raise_for_status()
    status = status_resp.json()

    return health, status


def display(health: dict, status: dict) -> None:
    print("\n" + "=" * 60)
    print("MAO PLATFORM STATUS")
    print("=" * 60)

    h_status = health.get("status", "unknown")
    kb_ready = health.get("kb_ready", False)
    print(f"  Platform:    {h_status.upper()}")
    print(f"  KB Ready:    {'YES' if kb_ready else 'LOADING...'}")
    print(f"  Storage:     {health.get('storage_mode', '?')}")

    kb_stats = health.get("kb_stats", {})
    total = kb_stats.get("keyword_total", 0) or kb_stats.get("azure_total", 0)
    print(f"  KB Chunks:   {total:,}")

    print()
    print("  Chat Status")
    print(f"    API Key:   {'✓ configured' if status.get('api_key_configured') else '✗ missing'}")
    print(f"    Gate:      {status.get('gate_status', '?')}")
    print(f"    Ready:     {'YES' if status.get('ready') else 'NO'}")
    print(f"    Model:     {status.get('model', '?')}")
    print(f"    Message:   {status.get('message', '')}")

    usage = status.get("usage", {})
    if usage:
        print()
        print("  Budget")
        print(f"    Used:      {usage.get('used', 0)} / {usage.get('limit', '?')} calls")
        print(f"    Remaining: {usage.get('remaining', '?')} calls today")

    cache = status.get("semantic_cache", {})
    if cache:
        hits = cache.get("hits", 0)
        total_queries = hits + cache.get("misses", 0)
        hit_rate = f"{hits / total_queries:.0%}" if total_queries > 0 else "n/a"
        print()
        print("  Semantic Cache")
        print(f"    Entries:   {cache.get('size', 0)}")
        print(f"    Hit rate:  {hit_rate}")

    print("=" * 60 + "\n")


def main():
    if not AUTH[0] or not AUTH[1]:
        print("Error: Set MAO_USERNAME and MAO_PASSWORD in your .env file.")
        sys.exit(1)

    try:
        health, status = check()
        display(health, status)
    except requests.exceptions.HTTPError as e:
        print(f"API error: {e.response.status_code} — {e.response.text}")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"Connection failed. Is {BASE_URL} reachable?")
        sys.exit(1)


if __name__ == "__main__":
    main()
