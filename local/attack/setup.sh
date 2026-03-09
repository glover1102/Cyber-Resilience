#!/bin/bash
# Setup script for ransomware simulator

set -e

echo "=================================================="
echo "  🛡️ Ransomware Simulator Setup"
echo "=================================================="
echo ""

# Check for Python dependencies
echo "Checking Python dependencies..."
REQUIRED_PKG=('cryptography' 'colorama')

for pkg in "${REQUIRED_PKG[@]}"; do
    if ! pip3 show $pkg > /dev/null 2>&1; then
        echo "  → Installing $pkg..."
        pip3 install $pkg
    else
        echo "  ✓ $pkg is already installed"
    fi
done
echo ""

# Create a safe demo directory
DEMO_DIR="/tmp/demo_files"
if [ ! -d "$DEMO_DIR" ]; then
    mkdir "$DEMO_DIR"
    echo "✓ Created demo directory at $DEMO_DIR"
else
    echo "✓ Demo directory already exists at $DEMO_DIR"
fi
echo ""

# Make the ransomware simulator executable
chmod +x ransomware_simulator.py
echo "✓ Made ransomware_simulator.py executable"
echo ""

# Provide instructions
echo "=================================================="
echo "  📋 Usage Instructions"
echo "=================================================="
echo ""
echo "To run the ATTACK simulation:"
echo "  cd /tmp/demo_files"
echo "  python3 ~/Cyber-Resilience/local/attack/ransomware_simulator.py"
echo ""
echo "To run the RECOVERY:"
echo "  python3 ~/Cyber-Resilience/local/attack/ransomware_simulator.py --decrypt"
echo ""
echo "=================================================="
echo "  ⚠️  Safety Warning"
echo "=================================================="
echo ""
echo "This is a DEMONSTRATION TOOL for education only!"
echo "• Only runs in /tmp/ or ./test directories"
echo "• Safe to use - won't harm your system"
echo "• For cybersecurity training purposes"
echo ""
echo "✅ Setup complete!"
echo ""