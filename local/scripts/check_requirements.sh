#!/bin/bash
# check_requirements.sh - Verify all dependencies required by the demo environment.
# Exit codes: 0 = all OK, 1 = one or more requirements missing.

PASS=0
FAIL=1
status=$PASS

echo "=================================================="
echo "  🔍  Cyber Resilience Demo - Requirements Check"
echo "=================================================="
echo ""

# ── 1. Python 3 ──────────────────────────────────────────────────────────────
echo "Checking Python 3..."
if command -v python3 &>/dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    echo "  ✓ $PYTHON_VERSION found"
else
    echo "  ✗ Python 3 is NOT installed."
    echo "    Install it from https://www.python.org/downloads/ or via your package manager."
    echo "    e.g. sudo apt install python3   (Debian/Ubuntu)"
    echo "         brew install python        (macOS)"
    status=$FAIL
fi
echo ""

# ── 2. pip ───────────────────────────────────────────────────────────────────
echo "Checking pip..."
if command -v pip3 &>/dev/null; then
    PIP_VERSION=$(pip3 --version 2>&1)
    echo "  ✓ $PIP_VERSION found"
elif command -v pip &>/dev/null; then
    PIP_VERSION=$(pip --version 2>&1)
    echo "  ✓ $PIP_VERSION found"
else
    echo "  ✗ pip is NOT installed."
    echo "    Install it with: python3 -m ensurepip --upgrade"
    status=$FAIL
fi
echo ""

# ── 3. Required Python packages ───────────────────────────────────────────────
echo "Checking Python packages..."

check_package() {
    local pkg="$1"
    if python3 -c "import $pkg" 2>/dev/null; then
        local ver
        ver=$(python3 -c "import $pkg; print(getattr($pkg, '__version__', 'unknown'))" 2>/dev/null)
        echo "  ✓ $pkg ($ver)"
    else
        echo "  ✗ $pkg is NOT installed."
        echo "    Install it with: pip3 install $pkg"
        status=$FAIL
    fi
}

check_package "requests"
check_package "psutil"
echo ""

# ── 4. Virtual environment ────────────────────────────────────────────────────
echo "Checking virtual environment..."
if [ -n "$VIRTUAL_ENV" ]; then
    echo "  ✓ Virtual environment active: $VIRTUAL_ENV"
else
    echo "  ⚠  No virtual environment detected."
    echo "    It is recommended to use a virtual environment to isolate dependencies."
    echo "    Create one with: python3 -m venv venv && source venv/bin/activate"
    echo "    Then install dependencies: pip3 install -r local/forwarder/requirements.txt"
fi
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "=================================================="
if [ "$status" -eq "$PASS" ]; then
    echo "  ✅ All requirements satisfied. Ready to run the demo!"
else
    echo "  ❌ Some requirements are missing. Please address the issues above."
fi
echo "=================================================="
echo ""

exit $status
