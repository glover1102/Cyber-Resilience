# Presenter's Guide

A complete presentation framework for the Cyber Resilience live demonstration.

---

## Table of Contents

1. [Slide Deck Outline (32 slides)](#1-slide-deck-outline)
2. [20-Minute Demo Script](#2-20-minute-demo-script)
3. [Talking Points by Section](#3-talking-points-by-section)
4. [Audience Engagement Strategies](#4-audience-engagement-strategies)
5. [Backup Plans](#5-backup-plans)
6. [Q&A Preparation](#6-qa-preparation)
7. [Conference Setup Checklist](#7-conference-setup-checklist)

---

## 1. Slide Deck Outline

| # | Section | Title | Notes |
|---|---|---|---|
| 1 | Cover | Cyber Resilience: Live Demo | Company logo, your name |
| 2 | Agenda | What We'll Cover Today | 3-2-1-1-0, Architecture, Live Demo |
| 3 | Context | The Ransomware Reality | Statistics: frequency, cost, downtime |
| 4 | Context | Why Resilience, Not Just Prevention | Assume breach mindset |
| 5 | Framework | The 3-2-1-1-0 Backup Strategy | Diagram |
| 6 | Framework | 3 Copies of Data | Primary + 2 backups |
| 7 | Framework | 2 Different Media | Disk + tape / cloud |
| 8 | Framework | 1 Offsite Copy | Geographic separation |
| 9 | Framework | 1 Offline Copy | Air-gapped / immutable |
| 10 | Framework | 0 Errors After Restore Test | Verification is mandatory |
| 11 | MITRE | ATT&CK Framework Overview | Tactics & techniques |
| 12 | MITRE | Ransomware Kill Chain | Initial access → impact |
| 13 | MITRE | T1486 — Data Encrypted for Impact | How attackers encrypt |
| 14 | Architecture | Demo Platform Overview | ASCII diagram |
| 15 | Architecture | Local Components | VMs, simulator, forwarder |
| 16 | Architecture | Cloud Components | Railway API, SSE, dashboard |
| 17 | Architecture | Data Flow | Metrics → API → Browser |
| 18 | Demo | QR Code — Follow Along | Display dashboard URL |
| 19 | Demo | Normal State | Show green dashboard |
| 20 | Demo | Attack: Reconnaissance | First alert |
| 21 | Demo | Attack: Lateral Movement | Spreading |
| 22 | Demo | Attack: Encryption | Primary DC offline |
| 23 | Demo | Incident Response | SOC/NOC activity spike |
| 24 | Demo | Failover to Secondary DC | Resilience in action |
| 25 | Demo | Recovery: Restore from Backup | 3-2-1-1-0 pays off |
| 26 | Demo | Recovery: System Back Online | Green dashboard |
| 27 | Lessons | What Just Happened? | Recap with MITRE ATT&CK |
| 28 | Lessons | Why Did We Recover Quickly? | Backup strategy + automation |
| 29 | Lessons | What Would Have Gone Wrong? | Without good backups |
| 30 | Takeaways | 5 Actions You Can Take Today | Practical advice |
| 31 | Resources | Further Reading | NIST, CISA, MITRE links |
| 32 | Close | Questions & Contact | QR code for slides/repo |

---

## 2. 20-Minute Demo Script

### Pre-demo (2 min before start)

- Open the dashboard in a browser: `$RAILWAY_URL`
- Start the metrics forwarder: `bash local/scripts/start_demo.sh`
- Confirm all 6 cards are green
- Have curl commands ready in a separate terminal

---

### 00:00 — Introduction (2 min)

> *"Good morning/afternoon everyone. Today I'm going to show you something different —
> instead of talking about ransomware defences in theory, I'm going to demonstrate
> a live attack and recovery on screen, right now."*

- Introduce yourself briefly (30 seconds)
- Ask: "How many of you have had to deal with a ransomware incident?" (show of hands)
- Point to the dashboard on screen: "This is our environment. Six systems, all green."

---

### 02:00 — The Setup (3 min)

> *"Let me explain what you're looking at. We have a hybrid architecture — local VMs
> simulating a corporate environment, connected to a cloud dashboard you can follow
> on your phones."*

- Walk through the 6 status cards (Primary DC, Secondary DC, SOC, NOC, Backup, Application)
- Explain the metrics: CPU, memory, network
- Invite audience to scan QR code and open on their phones

---

### 05:00 — The 3-2-1-1-0 Strategy (3 min)

> *"Before the attack, let's understand why we're confident we can recover.
> The 3-2-1-1-0 backup strategy is our safety net."*

- Walk through each digit (slides 6–10)
- Emphasise: "The zero is the most important — verified restores, not hoped-for restores"

---

### 08:00 — Attack Begins (4 min)

> *"Now let's run the attack."*

**Action:** Run in terminal:
```bash
curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"start"}'
```

> *"The alert banner has appeared — ransomware detected on the Primary DC.
> Notice the CPU has spiked to 95% and the status has turned amber.
> The SOC is seeing alerts. This is the reconnaissance phase."*

Pause 30 seconds for audience to absorb.

**Action:**
```bash
curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"spreading"}'
```

> *"Now the ransomware is spreading and encrypting files. The Primary DC is going offline."*

---

### 12:00 — Encryption + Failover (3 min)

**Action:**
```bash
curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"encrypted"}'
```

> *"Primary DC is down. Application server is offline. In a real scenario, this is the
> moment of panic. But because we have 3-2-1-1-0, we have an immutable offline copy
> of our data. The Secondary DC can take over."*

- Point to the Secondary DC card: still online, CPU increasing (load shift)
- Timeline shows the failover event

---

### 15:00 — Recovery (3 min)

**Action:**
```bash
curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"recovery"}'
```

> *"Recovery initiated. We're restoring from our verified offline backup.
> Watch the dashboard — systems are coming back online."*

- Alert banner disappears
- Cards return to green one by one
- Timeline logs each recovery event

> *"Total simulated downtime: about 7 minutes. Real-world target with a good plan:
> under 4 hours RTO, under 1 hour RPO."*

---

### 18:00 — Lessons Learned (2 min)

> *"What just happened? Let's map it to MITRE ATT&CK."*

- Initial Access → Execution → Defense Evasion → Impact (T1486)
- What saved us: offline backup, Secondary DC, automated failover
- What would have failed us: single copy of data, no test restores, no incident response plan

---

### 20:00 — Close

> *"The takeaway is simple: assume you WILL be breached. The question is how fast
> you recover. 3-2-1-1-0 + a tested incident response plan = cyber resilience."*

---

## 3. Talking Points by Section

### On backup strategy

- "The 0 in 3-2-1-1-0 is what most organisations miss — they have backups, they just never test them."
- "An untested backup is a hope, not a plan."
- "Immutable backups mean ransomware cannot reach back and encrypt your recovery copies."

### On MITRE ATT&CK

- "ATT&CK is not a compliance checklist — it's a shared language for describing how attacks actually work."
- "Every technique in that framework has been observed in the wild."
- "Use it to identify gaps in your detection and response capabilities."

### On the demo platform

- "This is production-quality code you can deploy yourself — the link is in the QR code."
- "The metrics forwarder can connect to real VMs — swap in psutil calls for actual system data."

---

## 4. Audience Engagement Strategies

- **QR code early** — put it up at slide 18 and keep the URL visible throughout the demo
- **Live poll** — "How many of you test your backups quarterly?" (use Mentimeter or show of hands)
- **Pause after each attack phase** — let the audience read the dashboard before moving on
- **Invite a volunteer** to run a curl command on their laptop
- **Ask questions** — "What do you think happens if we DON'T have the Secondary DC?"

---

## 5. Backup Plans

### If Railway is down

- Run the API locally: `cd railway/api && npm start`
- Use `localhost:3000` for all dashboard / API calls
- Display `http://localhost:3000` via screen share

### If metrics forwarder fails

- Open the browser console on the dashboard — metrics updates are visible as SSE events
- Manually trigger status updates via curl: `curl $URL/api/simulate-attack -d '{"phase":"start"}'`
- Explain: "In a real environment this would be connected to your SIEM"

### If curl commands fail

- Prepare a Postman collection as a backup
- Have the curl commands in a text file to copy-paste

### If the internet is down

- Run everything locally: `cd railway/api && npm start`
- Use `localhost:3000`

---

## 6. Q&A Preparation

**Q: Is this real ransomware?**
A: No. The simulator uses Python to rename files and write a text file — it does not encrypt with a real key and cannot spread across a network.

**Q: How much does Railway cost?**
A: The free tier is sufficient for this demo (500 hours/month). A paid plan starts at $5/month.

**Q: Can I use this for my own presentation?**
A: Yes — the repository is MIT licensed. See CONTRIBUTING.md for guidelines.

**Q: How do you connect this to real VMs?**
A: Replace the simulated metric generation in `metrics_forwarder.py` with real `psutil` calls or Prometheus scraping. The API interface is the same.

**Q: What is the RTO/RPO in the demo?**
A: The demo simulates ~7 minutes of downtime (RTO) and near-zero data loss (RPO). Real-world targets depend on your SLA and backup frequency.

---

## 7. Conference Setup Checklist

### Day before

- [ ] Deploy API to Railway and verify dashboard loads
- [ ] Test all attack phases end-to-end
- [ ] Share dashboard URL with co-presenter / AV team
- [ ] Print QR code (backup in case projector URL is hard to read)
- [ ] Charge laptop to 100%
- [ ] Test presentation laptop on conference WiFi (or hotspot)

### 30 minutes before

- [ ] Open browser with dashboard: `$RAILWAY_URL`
- [ ] Start metrics forwarder: `bash local/scripts/start_demo.sh`
- [ ] Confirm all 6 cards are green
- [ ] Open terminal with curl commands ready
- [ ] Increase terminal font size for visibility
- [ ] Test projector resolution (1920×1080 recommended)

### On stage

- [ ] Switch browser to full-screen (F11)
- [ ] Disable browser notifications
- [ ] Disable system notifications
- [ ] Set power settings to "Never sleep"
- [ ] Have water nearby

### After the talk

- [ ] Run recovery phase if attack is still active
- [ ] Share slide deck URL in Slack / conference app
- [ ] Thank attendees who followed along on their phones
