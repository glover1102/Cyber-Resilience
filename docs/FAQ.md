# Frequently Asked Questions

---

## General

### What is this demo about?

This platform demonstrates **cyber resilience** — the ability of an organisation to
withstand and recover from a ransomware attack. It shows a simulated attack lifecycle
(reconnaissance → encryption → impact) followed by a recovery using the
**3-2-1-1-0 backup strategy**.

The goal is educational: to help IT professionals, security teams, and decision-makers
understand what a ransomware incident looks like in real-time and how good planning
makes recovery fast and predictable.

---

### Do I need real VMs to run this demo?

No. The metrics forwarder (`local/forwarder/metrics_forwarder.py`) **simulates** metrics
for six virtual systems using sinusoidal variation + random noise. The demo works
entirely without any VMs.

If you want to connect to real machines, replace the simulated values in
`metrics_forwarder.py` with `psutil` calls (or any monitoring agent output) and
POST them to the Railway API.

---

### Is this actual ransomware?

**No.** The ransomware simulator (`local/attack/ransomware_simulator.py`) is an
educational script that:

- Prints coloured output describing each attack phase
- Creates a plain-text `ransom_note.txt` file
- Renames demo files in a safe sandbox directory

It does **not**:

- Encrypt files with a real cipher
- Contact any command-and-control server
- Spread across a network
- Harm your system in any way

It will refuse to run outside of `/tmp` or `./test` directories as a safety guard.

---

### Can I customise this for my organisation's branding?

Yes. The platform is MIT licensed and designed to be modified.

Common customisations:

- **Logo/colours** — edit `railway/status-page/style.css` CSS variables
- **System names** — update the `SYSTEMS` dict in `metrics_forwarder.py` and the card IDs in `index.html`
- **Attack narrative** — modify the messages in `server.js` → `simulate-attack` handler
- **Slide deck** — the slide outline in `docs/PRESENTATION.md` is a starting point, not a template

---

## Railway / Deployment

### How much does Railway cost?

Railway offers a **free tier** that includes:

- 500 hours of compute per month (enough for a demo)
- 1 GB RAM
- Shared CPU

For a one-hour conference presentation, the free tier is sufficient. Paid plans start
at **$5/month** for a Hobby plan with 8 GB RAM.

See [railway.app/pricing](https://railway.app/pricing) for current pricing.

---

### Can I deploy this somewhere other than Railway?

Yes. The API is a standard Express.js application and will run on any Node.js 18+
hosting platform:

- **Render** — free tier available, similar to Railway
- **Fly.io** — free tier available, Docker-based
- **Heroku** — paid plans only now
- **VPS** (DigitalOcean, Linode, AWS EC2) — use the provided `Dockerfile`
- **Locally** — `cd railway/api && npm start` — useful for offline presentations

---

### My Railway deployment keeps restarting. Why?

Common causes:

1. **PORT not bound** — ensure `server.js` listens on `process.env.PORT`
2. **Missing dependencies** — check the build logs with `railway logs`
3. **Memory limit** — the free tier has 512 MB RAM; SSE connections use ~1 KB each

---

## Security

### Is it safe to run this on a shared network?

The ransomware simulator is **local only** and restricted to safe directories. The
Railway API has no authentication on the `/api/simulate-attack` endpoint — do not
expose it on a public-facing production server without adding auth.

For conference demos, the default setup is safe: the simulator runs on your laptop,
and the Railway API is used only during the presentation.

---

### Does the forwarder send any personal data to Railway?

No. The forwarder sends only simulated numeric metrics (CPU percentages, memory
percentages, network throughput values) and system status strings. No hostnames,
IP addresses, usernames, or personal data are transmitted.

If you enable real `psutil` metrics, the CPU and memory values of your machine are
sent — no identifying information.

---

## Using This Demo

### Can I use this for my own conference talk?

Yes — the repository is **MIT licensed**. You are free to use, modify, and present
this platform. Attribution is appreciated but not required.

If you give a talk using this platform, please consider:

- Opening a GitHub issue to let us know — we love hearing about it!
- Submitting improvements back as a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

### How do I add more systems to the dashboard?

1. Add a new card to `railway/status-page/index.html` (copy an existing card, update IDs)
2. Add the system key and base metrics to `SYSTEMS` in `local/forwarder/metrics_forwarder.py`
3. Add default state to `systemStatus` in `railway/api/server.js`

---

### The demo worked in rehearsal but failed on stage. Help!

See the [Backup Plans section of PRESENTATION.md](PRESENTATION.md#5-backup-plans) for
fallback options.

The most common on-stage failure is a network issue. To prepare:

1. Test on the conference WiFi the day before
2. Have a mobile hotspot as a backup
3. Know how to run everything locally if Railway is unreachable
