#!/usr/bin/env python3
"""
generate_qr.py — Generate a QR code for the dashboard URL
==========================================================
Usage:
    python3 scripts/generate_qr.py https://your-app.railway.app
    python3 scripts/generate_qr.py https://your-app.railway.app --output dashboard_qr.png

Dependencies:
    pip install qrcode[pil] pillow

If qrcode is not installed, the script prints a text-art fallback using
only the standard library and displays the URL prominently.
"""

import sys
import argparse
import os

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
try:
    from colorama import Fore, Style, init as _colorama_init
    _colorama_init(autoreset=True)
    GREEN = Fore.GREEN
    CYAN = Fore.CYAN
    YELLOW = Fore.YELLOW
    RED = Fore.RED
    RESET = Style.RESET_ALL
except ImportError:
    GREEN = CYAN = YELLOW = RED = RESET = ""


def _c(colour: str, text: str) -> str:
    return f"{colour}{text}{RESET}"


# ---------------------------------------------------------------------------
# QR generation (requires qrcode + Pillow)
# ---------------------------------------------------------------------------

def generate_qr_image(url: str, output_path: str) -> bool:
    """
    Generate a PNG QR code and save it to output_path.
    Returns True on success, False if the library is missing.
    """
    try:
        import qrcode  # type: ignore
    except ImportError:
        return False

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_path)
    return True


def print_qr_terminal(url: str) -> None:
    """
    Print a text-art QR code to the terminal using the qrcode library.
    Falls back to a simple URL display if the library is missing.
    """
    try:
        import qrcode  # type: ignore

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=1,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)
        # print_ascii uses █ / space characters
        qr.print_ascii(invert=True)
    except ImportError:
        # Fallback — just show the URL in a box
        border = "─" * (len(url) + 4)
        print(f"┌{border}┐")
        print(f"│  {url}  │")
        print(f"└{border}┘")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a QR code for the Cyber Resilience dashboard URL.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 scripts/generate_qr.py https://my-app.railway.app\n"
            "  python3 scripts/generate_qr.py https://my-app.railway.app --output qr.png\n"
            "\n"
            "Install optional dependency:\n"
            "  pip install 'qrcode[pil]' pillow\n"
        ),
    )
    parser.add_argument("url", help="Dashboard URL to encode")
    parser.add_argument(
        "--output",
        "-o",
        default="dashboard_qr.png",
        metavar="FILE",
        help="Output PNG filename (default: dashboard_qr.png)",
    )
    parser.add_argument(
        "--no-terminal",
        action="store_true",
        help="Skip terminal display (only save PNG)",
    )

    args = parser.parse_args()
    url = args.url.strip()

    print("")
    print(_c(CYAN, "================================================"))
    print(_c(CYAN, "  🛡️  Cyber Resilience — QR Code Generator"))
    print(_c(CYAN, "================================================"))
    print("")
    print(f"  URL: {_c(GREEN, url)}")
    print("")

    # --- Terminal display ---
    if not args.no_terminal:
        print(_c(CYAN, "  ── Terminal QR Code ────────────────────────"))
        print("")
        print_qr_terminal(url)
        print("")

    # --- PNG output ---
    success = generate_qr_image(url, args.output)
    if success:
        abs_path = os.path.abspath(args.output)
        print(_c(GREEN, f"  ✓ QR code saved to: {abs_path}"))
        print("")
        print("  Display this image on your slides or projector so the")
        print("  audience can scan it and follow the dashboard live.")
    else:
        print(_c(YELLOW, "  ⚠  'qrcode[pil]' not installed — PNG not generated."))
        print("     Install with:  pip install 'qrcode[pil]' pillow")
        print(_c(CYAN, f"\n  ✓ Dashboard URL: {url}"))

    print("")


if __name__ == "__main__":
    main()
