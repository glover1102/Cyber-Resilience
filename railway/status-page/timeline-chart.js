/**
 * Timeline Chart - Canvas-based real-time line chart
 * Displays CPU Load, Network Traffic, and Alert Count over time
 */
class TimelineChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.maxPoints = 45;
        this.data = {
            cpu:     Array(this.maxPoints).fill(0),
            network: Array(this.maxPoints).fill(0),
            alerts:  Array(this.maxPoints).fill(0),
        };
        this.labels = {
            cpu:     { color: '#10b981', label: 'CPU %' },
            network: { color: '#3b82f6', label: 'Network %' },
            alerts:  { color: '#ef4444', label: 'Alerts' },
        };

        this._resizeObserver = new ResizeObserver(() => this._resize());
        this._resizeObserver.observe(this.canvas.parentElement);
        this._resize();
        this.draw();
    }

    _resize() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        this.canvas.width  = parent.clientWidth  || 400;
        this.canvas.height = parent.clientHeight || 200;
        this.draw();
    }

    /** Push new data values and redraw */
    push(cpu, network, alerts) {
        this.data.cpu.push(cpu);
        this.data.network.push(network);
        this.data.alerts.push(Math.min(alerts * 10, 100)); // scale alert count to 0-100

        // Trim to maxPoints
        ['cpu', 'network', 'alerts'].forEach(k => {
            if (this.data[k].length > this.maxPoints) {
                this.data[k].shift();
            }
        });

        this.draw();
    }

    reset() {
        this.data = {
            cpu:     Array(this.maxPoints).fill(0),
            network: Array(this.maxPoints).fill(0),
            alerts:  Array(this.maxPoints).fill(0),
        };
        this.draw();
    }

    draw() {
        if (!this.ctx) return;
        const { ctx, canvas } = this;
        const w = canvas.width;
        const h = canvas.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        ctx.fillStyle = isDark ? 'rgba(20, 24, 54, 0.8)' : 'rgba(240, 242, 245, 0.8)';
        ctx.fillRect(0, 0, w, h);

        const padding = { top: 20, right: 20, bottom: 40, left: 45 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        if (chartW <= 0 || chartH <= 0) return;

        const gridColor   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        const labelColor  = isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.5)';
        const axisColor   = isDark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.2)';

        // Grid lines (Y)
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartW, y);
            ctx.stroke();

            // Y labels (100, 75, 50, 25, 0)
            ctx.fillStyle = labelColor;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${100 - i * 25}%`, padding.left - 6, y + 4);
        }

        // Axes
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartH);
        ctx.lineTo(padding.left + chartW, padding.top + chartH);
        ctx.stroke();

        // X labels (time markers every ~9 points)
        ctx.fillStyle = labelColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const points = this.maxPoints;
        for (let i = 0; i <= 4; i++) {
            const idx = Math.round((points / 4) * i);
            const x   = padding.left + (chartW / (points - 1)) * idx;
            const sec = -(points - 1 - idx);
            ctx.fillText(`${sec}s`, x, padding.top + chartH + 16);
        }

        // Draw each data series
        Object.entries(this.data).forEach(([key, values]) => {
            const { color } = this.labels[key];
            this._drawLine(ctx, values, padding, chartW, chartH, color);
        });

        // Legend
        const legendItems = Object.values(this.labels);
        const legendX = padding.left + chartW - (legendItems.length * 90);
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        legendItems.forEach(({ color, label }, i) => {
            const lx = legendX + i * 90;
            const ly = padding.top + 12;
            ctx.fillStyle = color;
            ctx.fillRect(lx, ly - 6, 14, 3);
            ctx.fillStyle = labelColor;
            ctx.fillText(label, lx + 18, ly);
        });
    }

    _drawLine(ctx, values, padding, chartW, chartH, color) {
        const n = values.length;
        if (n < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Filled area under line
        ctx.beginPath();
        values.forEach((v, i) => {
            const x = padding.left + (chartW / (this.maxPoints - 1)) * i;
            const y = padding.top + chartH - (v / 100) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        // Close path for fill
        const lastX = padding.left + (chartW / (this.maxPoints - 1)) * (n - 1);
        ctx.lineTo(lastX, padding.top + chartH);
        ctx.lineTo(padding.left, padding.top + chartH);
        ctx.closePath();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Line
        ctx.beginPath();
        values.forEach((v, i) => {
            const x = padding.left + (chartW / (this.maxPoints - 1)) * i;
            const y = padding.top + chartH - (v / 100) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
    }
}

// Instantiated in app.js after DOM ready
let timelineChart = null;
