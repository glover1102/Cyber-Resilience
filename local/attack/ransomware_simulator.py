#!/usr/bin/env python3
"""
Ransomware Simulator - A SAFE, EDUCATIONAL tool for cyber resilience demos.

WARNING: This script is for EDUCATIONAL PURPOSES ONLY. It only operates on
files inside a local 'demo_files/' subdirectory and does NOT touch any real
system files.

Usage:
  python3 ransomware_simulator.py            # Simulate ransomware attack
  python3 ransomware_simulator.py --decrypt  # Simulate recovery
"""

import os
import sys
import time

try:
    import requests
    _requests_available = True
except ImportError:
    _requests_available = False

DEMO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_files")
RAILWAY_URL = os.environ.get("RAILWAY_URL", "").rstrip("/")
XOR_KEY = 0x5A  # Simple single-byte XOR key used for the simulation
ENCRYPTED_EXT = ".encrypted"

SAMPLE_FILES = {
    "report_q1.txt": "Q1 Financial Report\n====================\nRevenue: $1,200,000\nExpenses: $850,000\nNet Profit: $350,000\n",
    "customer_data.csv": "id,name,email\n1,Alice Smith,alice@example.com\n2,Bob Jones,bob@example.com\n3,Carol White,carol@example.com\n",
    "backup_config.json": '{"server": "prod-01", "schedule": "daily", "retention_days": 30, "last_backup": "2024-01-15"}\n',
    "notes.txt": "Important meeting notes:\n- Review disaster recovery plan\n- Update firewall rules\n- Test backup restoration\n",
}


def print_banner():
    print("")
    print("=" * 60)
    print("  ⚠️  CYBER RESILIENCE DEMO - RANSOMWARE SIMULATOR  ⚠️")
    print("  ** SIMULATION ONLY - NO REAL FILES ARE HARMED **")
    print("=" * 60)
    print("")


def xor_bytes(data: bytes) -> bytes:
    """Apply single-byte XOR transformation (reversible)."""
    return bytes(b ^ XOR_KEY for b in data)


def notify_dashboard(event: str, state: str, message: str) -> None:
    """Send an event notification to the Railway dashboard API (best-effort)."""
    if not RAILWAY_URL or not _requests_available:
        return
    try:
        requests.post(
            f"{RAILWAY_URL}/api/attack",
            json={"event": event, "state": state, "message": message},
            timeout=5,
        )
    except requests.exceptions.RequestException:
        pass


def ensure_demo_files():
    """Create the demo_files directory and populate it with sample files if needed."""
    os.makedirs(DEMO_DIR, exist_ok=True)
    created = 0
    for filename, content in SAMPLE_FILES.items():
        path = os.path.join(DEMO_DIR, filename)
        if not os.path.exists(path):
            with open(path, "w") as f:
                f.write(content)
            created += 1
    if created:
        print(f"[SIMULATION] Created {created} sample demo file(s) in '{DEMO_DIR}'")


def simulate_attack():
    """Encrypt all non-encrypted files in demo_files/ to simulate a ransomware attack."""
    ensure_demo_files()

    targets = [
        f for f in os.listdir(DEMO_DIR)
        if not f.endswith(ENCRYPTED_EXT)
    ]

    if not targets:
        print("[SIMULATION] No files to encrypt. Run without --decrypt first.")
        return

    print(f"[SIMULATION] 🔴 RANSOMWARE ATTACK STARTING on {len(targets)} file(s)...")
    print("")
    notify_dashboard("attack_started", "attack", f"🔴 Ransomware attack initiated - targeting {len(targets)} files")

    start_time = time.time()
    total_bytes = 0

    for filename in targets:
        src = os.path.join(DEMO_DIR, filename)
        dst = os.path.join(DEMO_DIR, filename + ENCRYPTED_EXT)
        with open(src, "rb") as f:
            data = f.read()
        encrypted = xor_bytes(data)
        with open(dst, "wb") as f:
            f.write(encrypted)
        os.remove(src)
        total_bytes += len(data)
        print(f"[SIMULATION] Encrypting: {filename} -> {filename}{ENCRYPTED_EXT}  ({len(data)} bytes)")
        notify_dashboard("file_encrypted", "attack", f"Encrypting: {filename} ({len(data)} bytes)")
        time.sleep(0.3)

    elapsed = time.time() - start_time
    print("")
    print("=" * 60)
    print(f"  [SIMULATION] ☠️  ATTACK COMPLETE")
    print(f"  Files encrypted : {len(targets)}")
    print(f"  Total bytes     : {total_bytes}")
    print(f"  Time elapsed    : {elapsed:.2f}s")
    print("=" * 60)
    print("")
    print("[SIMULATION] In a real attack, files would now be inaccessible.")
    print("[SIMULATION] Run with --decrypt to simulate recovery.")
    print("")
    notify_dashboard("attack_complete", "attack", f"☠️ Attack complete - {len(targets)} files encrypted, {total_bytes} bytes affected")


def simulate_recovery():
    """Decrypt all encrypted files in demo_files/ to simulate ransomware recovery."""
    targets = [
        f for f in os.listdir(DEMO_DIR)
        if f.endswith(ENCRYPTED_EXT)
    ] if os.path.isdir(DEMO_DIR) else []

    if not targets:
        print("[SIMULATION] No encrypted files found. Run the attack simulation first.")
        return

    print(f"[SIMULATION] 🟢 RECOVERY STARTING - restoring {len(targets)} file(s)...")
    print("")
    notify_dashboard("recovery_started", "recovery", f"🟢 Recovery initiated - restoring {len(targets)} files")

    start_time = time.time()
    total_bytes = 0

    for filename in targets:
        src = os.path.join(DEMO_DIR, filename)
        original_name = filename[: -len(ENCRYPTED_EXT)]
        dst = os.path.join(DEMO_DIR, original_name)
        with open(src, "rb") as f:
            data = f.read()
        decrypted = xor_bytes(data)
        with open(dst, "wb") as f:
            f.write(decrypted)
        os.remove(src)
        total_bytes += len(data)
        print(f"[SIMULATION] Recovering: {filename} -> {original_name}  ({len(data)} bytes)")
        notify_dashboard("file_decrypted", "recovery", f"Recovering: {filename} ({len(data)} bytes)")
        time.sleep(0.3)

    elapsed = time.time() - start_time
    print("")
    print("=" * 60)
    print(f"  [SIMULATION] ✅ RECOVERY COMPLETE")
    print(f"  Files recovered : {len(targets)}")
    print(f"  Total bytes     : {total_bytes}")
    print(f"  Time elapsed    : {elapsed:.2f}s")
    print("=" * 60)
    print("")
    print("[SIMULATION] All files have been restored successfully.")
    print("[SIMULATION] This demonstrates the importance of backups and recovery plans.")
    print("")
    notify_dashboard("recovery_complete", "normal", f"✅ Recovery complete - {len(targets)} files restored")


def main():
    print_banner()

    decrypt_mode = "--decrypt" in sys.argv

    if decrypt_mode:
        simulate_recovery()
    else:
        simulate_attack()


if __name__ == "__main__":
    main()
