#!/bin/bash
# Start Demo Environment

set -e

echo "=================================================="
echo "  🛡️  Cyber Resilience Demo - Startup Script"
echo "=================================================="
echo ""

# Check if Railway URL is set
if [ -z "$RAILWAY_URL" ]; then
    echo "⚠️  Warning: RAILWAY_URL environment variable not set"
    echo "Please set it with: export RAILWAY_URL=https://your-app.railway.app"
echo ""
    read -p "Enter your Railway URL: " RAILWAY_URL
    export RAILWAY_URL
fi

echo "✓ Railway URL: $RAILWAY_URL"
echo ""

# Check Python dependencies
echo "Checking Python dependencies..."
if ! python3 -c "import requests, psutil" 2>/dev/null; then
    echo "Installing Python dependencies..."
    pip3 install -r local/forwarder/requirements.txt
fi
echo "✓ Python dependencies OK"
echo ""

# Start metrics forwarder
echo "Starting metrics forwarder..."
cd local/forwarder
python3 metrics_forwarder.py $RAILWAY_URL/api/metrics &
FORWARDER_PID=$!
echo "✓ Metrics forwarder started (PID: $FORWARDER_PID)"
echo ""

# Display instructions
echo "=================================================="
echo "  ✅ Demo Environment Ready!"
echo "=================================================="
echo ""
echo "📊 Dashboard URL: $RAILWAY_URL"
echo "📱 QR Code: Scan at dashboard to follow along"
echo ""
echo "🎯 To run attack simulation:"
echo "   cd local/attack"
echo "   python3 ransomware_simulator.py"
echo ""
echo "🔄 To run recovery:"
echo "   python3 ransomware_simulator.py --decrypt"
echo ""
echo "🛑 To stop metrics forwarder:"
echo "   kill $FORWARDER_PID"
echo ""
echo "=================================================="
echo ""
echo "Press Ctrl+C to stop forwarder"
echo ""

# Keep script running
wait $FORWARDER_PID
