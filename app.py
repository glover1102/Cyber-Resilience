#!/usr/bin/env python3
"""
Cyber Resilience Dashboard - Flask API
Receives metrics from local demo machine and serves the dashboard UI.
"""

import os
import time
import threading
from collections import deque
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# In-memory storage (no database needed for demo)
_lock = threading.Lock()
latest_metrics = {}
attack_events = deque(maxlen=50)
attack_status = {"state": "normal", "message": "System operating normally", "timestamp": None}


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/")
def index():
    """Serve the dashboard HTML page."""
    return render_template("dashboard.html")


@app.route("/api/metrics", methods=["GET", "POST"])
def metrics():
    """GET: return latest metrics. POST: store new metrics."""
    global latest_metrics
    if request.method == "POST":
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        with _lock:
            latest_metrics.clear()
            latest_metrics.update(data)
            latest_metrics["received_at"] = time.time()
        return jsonify({"status": "ok"}), 200
    with _lock:
        metrics_snapshot = dict(latest_metrics)
    return jsonify(metrics_snapshot)


@app.route("/api/attack", methods=["POST"])
def attack():
    """Receive attack simulation events."""
    global attack_status
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    event = {
        "event": data.get("event", "unknown"),
        "message": data.get("message", ""),
        "timestamp": time.time(),
    }
    new_status = {
        "state": data.get("state", "unknown"),
        "message": data.get("message", ""),
        "timestamp": event["timestamp"],
    }
    with _lock:
        attack_events.append(event)
        attack_status.update(new_status)
    return jsonify({"status": "ok"}), 200


@app.route("/api/status")
def status():
    """Return current attack/recovery status and recent events."""
    with _lock:
        status_snapshot = dict(attack_status)
        events_snapshot = list(attack_events)[-10:]
    return jsonify({"status": status_snapshot, "events": events_snapshot})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
