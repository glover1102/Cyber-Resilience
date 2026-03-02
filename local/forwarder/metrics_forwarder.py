#!/usr/bin/env python3
"""
Metrics Forwarder - Collects system metrics and sends them to a Railway API endpoint.
Usage: python3 metrics_forwarder.py <endpoint_url>
"""

import sys
import time
import json
import psutil
import requests

INTERVAL_SECONDS = 5


def collect_metrics():
    """Collect current system metrics using psutil."""
    net = psutil.net_io_counters()
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "memory": {
            "total": mem.total,
            "used": mem.used,
            "percent": mem.percent,
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "percent": disk.percent,
        },
        "network": {
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
        },
        "timestamp": time.time(),
    }


def send_metrics(url, metrics):
    """POST metrics as JSON to the given URL."""
    response = requests.post(url, json=metrics, timeout=10)
    response.raise_for_status()
    return response.status_code


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 metrics_forwarder.py <endpoint_url>")
        sys.exit(1)

    endpoint = sys.argv[1]
    print(f"[INFO] Starting metrics forwarder -> {endpoint}")
    print(f"[INFO] Sending metrics every {INTERVAL_SECONDS} seconds. Press Ctrl+C to stop.")
    psutil.cpu_percent(interval=None)  # Prime the CPU percent counter

    try:
        while True:
            metrics = collect_metrics()
            try:
                status = send_metrics(endpoint, metrics)
                print(f"[OK] Metrics sent (HTTP {status}) - CPU: {metrics['cpu_percent']}%  "
                      f"Mem: {metrics['memory']['percent']}%  "
                      f"Disk: {metrics['disk']['percent']}%")
            except requests.exceptions.ConnectionError:
                print("[WARN] Connection error - Railway server may not be available. Retrying...")
            except requests.exceptions.Timeout:
                print("[WARN] Request timed out. Retrying...")
            except requests.exceptions.RequestException as exc:
                print(f"[WARN] Failed to send metrics: {exc}")
            time.sleep(INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\n[INFO] Metrics forwarder stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
