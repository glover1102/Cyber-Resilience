#!/usr/bin/env bash
# check_requirements.sh — Verify all prerequisites for the Cyber Resilience demo
# Usage: bash check_requirements.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

pass() { echo -e "${GREEN}  ✓ $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $*${NC}"; }
fail() { echo -e "${RED}  ✗ $*${NC}"; FAILED=$((FAILED + 1)); }

FAILED=0

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}=================================================="
echo -e "  🛡️  Cyber Resilience — Requirements Checker"
echo -e "==================================================${NC}"
echo ""

# ---------------------------------------------------------------------------
# Operating System
# ---------------------------------------------------------------------------
echo -e "${CYAN}[OS]${NC}"
case "$(uname -s)" in
    Linux*)
        if grep -qi microsoft /proc/version 2>/dev/null; then
            pass "Windows Subsystem for Linux (WSL2) detected"
        else
            pass "Linux detected"
        fi
        ;;
    Darwin*)
        pass "macOS detected"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        warn "Windows (Git Bash / Cygwin) detected — WSL2 is recommended for best compatibility"
        ;;
    *)
        warn "Unknown OS — some features may not work as expected"
        ;;
esac
echo ""

# ---------------------------------------------------------------------------
# Python 3.8+
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Python]${NC}"
if command -v python3 &>/dev/null; then
    PY_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')
    PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info[0])')
    PY_MINOR=$(python3 -c 'import sys; print(sys.version_info[1])')
    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 8 ]; then
        pass "Python $PY_VERSION"
    else
        fail "Python $PY_VERSION found — Python 3.8+ is required"
        echo "     Install: https://www.python.org/downloads/"
    fi
else
    fail "Python 3 not found"
    echo "     Install: https://www.python.org/downloads/"
fi
echo ""

# ---------------------------------------------------------------------------
# Node.js 18+
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Node.js]${NC}"
if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        pass "Node.js v$NODE_VERSION"
    else
        fail "Node.js v$NODE_VERSION found — Node.js 18+ is required"
        echo "     Install: https://nodejs.org/en/download/"
    fi
else
    fail "Node.js not found"
    echo "     Install: https://nodejs.org/en/download/"
fi
echo ""

# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Git]${NC}"
if command -v git &>/dev/null; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    pass "Git $GIT_VERSION"
else
    fail "Git not found"
    echo "     Install: https://git-scm.com/downloads"
fi
echo ""

# ---------------------------------------------------------------------------
# RAM (recommend ≥ 16 GB; warn below 16 GB)
# ---------------------------------------------------------------------------
echo -e "${CYAN}[System Resources]${NC}"
if command -v free &>/dev/null; then
    TOTAL_RAM_KB=$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
    TOTAL_RAM_GB=$(echo "scale=1; $TOTAL_RAM_KB / 1048576" | bc 2>/dev/null || echo "?")
    if [ "$TOTAL_RAM_KB" -ge 16777216 ]; then
        pass "RAM: ${TOTAL_RAM_GB} GB"
    elif [ "$TOTAL_RAM_KB" -ge 8388608 ]; then
        warn "RAM: ${TOTAL_RAM_GB} GB (32 GB recommended for full VM lab; demo still works)"
    else
        fail "RAM: ${TOTAL_RAM_GB} GB — at least 8 GB required; 32 GB recommended for full lab"
    fi
elif command -v sysctl &>/dev/null; then
    # macOS
    TOTAL_RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    TOTAL_RAM_GB=$(echo "scale=1; $TOTAL_RAM_BYTES / 1073741824" | bc 2>/dev/null || echo "?")
    pass "RAM: ~${TOTAL_RAM_GB} GB"
else
    warn "Cannot determine total RAM"
fi

# Disk space — need at least 10 GB free
if command -v df &>/dev/null; then
    FREE_KB=$(df -k . 2>/dev/null | awk 'NR==2{print $4}')
    FREE_GB=$(echo "scale=1; ${FREE_KB:-0} / 1048576" | bc 2>/dev/null || echo "?")
    if [ "${FREE_KB:-0}" -ge 10485760 ]; then
        pass "Free disk space: ~${FREE_GB} GB"
    else
        fail "Free disk space: ~${FREE_GB} GB — at least 10 GB recommended"
    fi
fi
echo ""

# ---------------------------------------------------------------------------
# Python packages
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Python Packages]${NC}"
PYTHON_PKGS=("requests" "psutil" "cryptography" "colorama")
for pkg in "${PYTHON_PKGS[@]}"; do
    if python3 -c "import ${pkg}" 2>/dev/null; then
        VER=$(python3 -c "import ${pkg}; print(getattr(${pkg}, '__version__', 'installed'))" 2>/dev/null || echo "installed")
        pass "${pkg} (${VER})"
    else
        warn "${pkg} not installed — run: pip3 install ${pkg}"
    fi
done
echo ""

# ---------------------------------------------------------------------------
# Railway CLI
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Railway CLI]${NC}"
if command -v railway &>/dev/null; then
    RAILWAY_VERSION=$(railway --version 2>/dev/null || echo "unknown")
    pass "Railway CLI $RAILWAY_VERSION"
else
    warn "Railway CLI not installed (optional, but helpful)"
    echo "     Install: npm install -g @railway/cli"
    echo "     Or:      curl -fsSL https://railway.app/install.sh | sh"
fi
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo -e "${CYAN}=================================================="
echo -e "  Summary"
echo -e "==================================================${NC}"
if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}  ✅ All required checks passed! Ready to run the demo.${NC}"
    echo ""
    echo "  Next steps:"
    echo "  1. Deploy the API:  railway login && railway up"
    echo "  2. Start forwarder: bash local/scripts/start_demo.sh"
else
    echo -e "${RED}  ❌ $FAILED check(s) failed. Please resolve the issues above.${NC}"
    exit 1
fi
echo ""
