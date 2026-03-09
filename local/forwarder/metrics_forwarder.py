#!/usr/bin/env python3
"""
metrics_forwarder.py — Local Metrics Forwarder
===============================================
Simulates metrics for the six lab VMs and POSTs them to the Railway API
every 2 seconds so the live dashboard reflects "real-time" activity.

Usage:
    python3 metrics_forwarder.py https://your-app.railway.app/api/metrics

The script adds random variance to base values to make the graphs
look lively during a presentation.
"""

import sys
import time
import math
import random
import argparse
import logging

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: run  pip install requests")

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

# ---------------------------------------------------------------------------
# Colour helpers (ANSI — degrades gracefully on Windows without colorama)
# ---------------------------------------------------------------------------

try:
    from colorama import Fore, Style, init as _colorama_init
    _colorama_init(autoreset=True)
    GREEN = Fore.GREEN
    YELLOW = Fore.YELLOW
    RED = Fore.RED
    CYAN = Fore.CYAN
    RESET = Style.RESET_ALL
except ImportError:
    GREEN = YELLOW = RED = CYAN = RESET = ""


def _c(colour: str, text: str) -> str:
    """Wrap text in an ANSI colour code."""
    return f"{colour}{text}{RESET}"


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System definitions
# ---------------------------------------------------------------------------

# Base CPU / memory / network values for each simulated system.
# These act as the "idle" baseline; the forwarder adds realistic variance.
SYSTEMS = {
    "primary-dc": {
        "label": "Primary DC",
        "base_cpu": 22,
        "base_memory": 42,
        "base_network": 5.5,
        "status": "online",
    },
    "secondary-dc": {
        "label": "Secondary DC",
        "base_cpu": 18,
        "base_memory": 38,
        "base_network": 3.2,
        "status": "online",
    },
    "soc": {
        "label": "SOC",
        "base_cpu": 38,
        "base_memory": 58,
        "base_network": 2,      # alert count, not MB/s
        "status": "online",
    },
    "noc": {
        "label": "NOC",
        "base_cpu": 25,
        "base_memory": 47,
        "base_network": 9.1,
        "status": "online",
    },
    "backup": {
        "label": "Backup",
        "base_cpu": 12,
        "base_memory": 32,
        "base_network": 62,     # storage utilisation %
        "status": "online",
    },
    "application": {
        "label": "Application",
        "base_cpu": 45,
        "base_memory": 62,
        "base_network": 130,    # requests/sec
        "status": "online",
    },
}

# ---------------------------------------------------------------------------
# Metric simulation helpers
# ---------------------------------------------------------------------------

_tick = 0  # global tick counter for sine-wave variation


def _vary(base: float, amplitude: float = 8.0, noise: float = 3.0) -> float:
    """Return a varied value using a sine wave + gaussian noise."""
    sine = amplitude * math.sin(_tick * 0.4 + base * 0.1)
    jitter = random.gauss(0, noise)
    return max(0.0, base + sine + jitter)


def _simulate_metrics() -> dict:
    """
    Build a full metrics payload for all simulated systems.
    If psutil is available, the host machine's real CPU / memory are used
    for the 'application' system.
    """
    global _tick
    _tick += 1

    systems = {}
    for key, cfg in SYSTEMS.items():
        cpu = min(100.0, _vary(cfg["base_cpu"], amplitude=10, noise=4))
        memory = min(100.0, _vary(cfg["base_memory"], amplitude=5, noise=2))
        network = max(0.0, _vary(cfg["base_network"], amplitude=cfg["base_network"] * 0.3, noise=2))

        # Optionally use real host metrics for the application server card
        if key == "application" and PSUTIL_AVAILABLE:
            cpu = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory().percent

        systems[key] = {
            "status": cfg["status"],
            "cpu": round(cpu, 1),
            "memory": round(memory, 1),
            "network": round(network, 2),
        }

    return {"systems": systems}


# ---------------------------------------------------------------------------
# Forwarder loop
# ---------------------------------------------------------------------------

def forward_metrics(api_url: str, interval: float = 2.0, max_retries: int = 5) -> None:
    """
    Continuously forward metrics to the Railway API.

    :param api_url:     Full URL, e.g. https://your-app.railway.app/api/metrics
    :param interval:    Seconds between each POST (default: 2)
    :param max_retries: Consecutive failures before sleeping longer (default: 5)
    """
    consecutive_errors = 0
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    log.info(_c(CYAN, f"Starting metrics forwarder → {api_url}"))
    log.info(_c(CYAN, f"Interval: {interval}s  |  psutil: {'enabled' if PSUTIL_AVAILABLE else 'disabled'}"))
    log.info("Press Ctrl+C to stop.\n")

    while True:
        payload = _simulate_metrics()

        try:
            resp = session.post(api_url, json=payload, timeout=8)
            resp.raise_for_status()
            consecutive_errors = 0
            log.info(_c(GREEN, f"✓ Metrics sent  ({len(payload['systems'])} systems)  HTTP {resp.status_code}"))

        except requests.exceptions.ConnectionError:
            consecutive_errors += 1
            log.warning(_c(YELLOW, f"⚠  Connection error — is the API reachable? ({consecutive_errors}/{max_retries})"))
        except requests.exceptions.Timeout:
            consecutive_errors += 1
            log.warning(_c(YELLOW, f"⚠  Request timed out ({consecutive_errors}/{max_retries})"))
        except requests.exceptions.HTTPError as exc:
            consecutive_errors += 1
            log.error(_c(RED, f"✗  HTTP error: {exc} ({consecutive_errors}/{max_retries})"))
        except Exception as exc:  # noqa: BLE001
            consecutive_errors += 1
            log.error(_c(RED, f"✗  Unexpected error: {exc} ({consecutive_errors}/{max_retries})"))

        if consecutive_errors >= max_retries:
            backoff = min(60, interval * consecutive_errors)
            log.warning(_c(YELLOW, f"Too many errors — backing off for {backoff:.0f}s"))
            time.sleep(backoff)
        else:
            time.sleep(interval)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Forward simulated VM metrics to the Cyber Resilience Railway API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 metrics_forwarder.py https://my-app.railway.app/api/metrics\n"
            "  python3 metrics_forwarder.py http://localhost:3000/api/metrics --interval 1\n"
        ),
    )
    parser.add_argument(
        "api_url",
        help="Full URL of the /api/metrics endpoint",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=2.0,
        metavar="SECONDS",
        help="Interval between metric updates (default: 2)",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=5,
        metavar="N",
        help="Consecutive failures before backing off (default: 5)",
    )

    args = parser.parse_args()

    try:
        forward_metrics(args.api_url, interval=args.interval, max_retries=args.max_retries)
    except KeyboardInterrupt:
        log.info(_c(CYAN, "\nStopped by user."))
        sys.exit(0)


if __name__ == "__main__":
    main()
