# VERITRACE AI — FINAL 5-MINUTE LIVE DEMONSTRATION SCRIPT
## SIH 2026 | Grand Finale | Team DOOMDAY | Problem Statement: SIH26231
**Role: Live Demonstration Protocol & Spoken Word-by-Word Script**

---

## ⏱️ Exact 5-Minute Time Breakdown

| Time Window | Segment | Primary Screen | Key Objective |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:20** | Problem Context | Dashboard (`/`) | Uncontrolled field lighting + naked-eye bias + zero evidence trail |
| **0:20 – 0:45** | Solution Overview | Dashboard (`/`) | Smartphone companion for existing kits without new hardware |
| **0:45 – 1:15** | Core Innovation | Dashboard Reference Card Modal | In-frame 18% neutral gray card + dynamic illuminant gain normalization |
| **1:15 – 1:30** | Demo Transition | Tap "＋ Start New Test" | Enter calibrated capture workflow (`/capture`) |
| **1:30 – 2:15** | Capture + Calibration | Capture Screen (`/capture`) | Select kit (Scott), select Demonstration Scenario, show gain adaptation |
| **2:15 – 2:50** | Automated Classification | Post-Capture Swatches | Positive outcome badge, ΔE Euclidean color distance, confidence metric |
| **2:50 – 3:25** | Digital Evidence Record | Post-Capture Details & Save | UTC timestamp, GPS, Operator ID, SHA-256 hash, HMAC-SHA256 signature |
| **3:25 – 3:50** | Verification & Tamper Demo | Records Inspection Modal | Green "UNTAMPERED" -> Tap "Simulate Tampering" -> Red "TAMPER DETECTED" |
| **3:50 – 4:15** | Architecture & Evidence | Records Export / About | Offline-first SQLite WAL, JSON courtroom certificate, QR roadside slip |
| **4:15 – 4:35** | Impact & Operations | Records Screen (`/records`) | Searchable field outbreak telemetry, chain of custody ledger |
| **4:35 – 4:50** | Validation & Roadmap | Overview Screen (`/about`) | Calibrated spectral libraries, ArUco rectification, edge neural segmentation |
| **4:50 – 5:00** | Closing Summary | Final Overview Screen | Mandatory regulatory disclaimer: Presumptive result only; lab confirmation essential |

---

## 🎬 Screen-by-Screen Verbal Script

### 0:00 – 0:20 | Step 1: The Problem
- **Screen**: Open App Home Dashboard (`http://localhost:8081` or mobile device)
- **Presenter Action**: Point to the top header on Home Dashboard.
- **Spoken Script**:
  > *"Respected Grand Jury, law enforcement and border agencies worldwide rely on colorimetric field chemical kits—like Scott Reagent for cocaine or Marquis for opiates. However, these field tests rely on visual naked-eye interpretation of liquid chemical reactions. In the real world, lighting conditions—warm sodium streetlights at night, fluorescent office bulbs, or dark shadows—completely distort the observed color. What one officer sees as positive, another sees as negative. Crucially, visual interpretation leaves zero objective evidence trail, making presumptive field tests vulnerable to suppression in court."*

---

### 0:20 – 0:45 | Step 2: The Solution
- **Screen**: Home Dashboard — Outbreak Telemetry Counters
- **Presenter Action**: Highlight the Total Tests, Positive, Negative, and Inconclusive metrics.
- **Spoken Script**:
  > *"We present VeriTrace AI, developed by Team DOOMDAY for problem statement SIH26231. VeriTrace AI is an offline-first smartphone companion application that works directly alongside existing field drug-testing kits without requiring any expensive optical hardware or proprietary sensors. It transforms ordinary smartphone cameras into calibrated optical spectrophotometers and generates tamper-evident digital evidence records."*

---

### 0:45 – 1:15 | Step 3: Core Innovation — Reference-Card Calibration
- **Screen**: Home Dashboard -> Tap **"📄 Show Reference Card"**
- **Presenter Action**: Open the on-screen 18% neutral gray spectrophotometric reference card.
- **Spoken Script**:
  > *"Our primary technical innovation is In-Frame Spectrophotometric Lighting Normalization. When an officer photographs a field reaction, an in-frame 18% neutral gray card—nominal RGB [128, 128, 128]—is captured in the same frame under the exact same ambient light. Our computer vision engine extracts channel gains: G_R = 128 over R_ref, G_G = 128 over G_ref, and G_B = 128 over B_ref. This chromatic adaptation mathematically strips away illuminant color casts before any classification occurs."*

---

### 1:15 – 1:30 | Step 4: Demo Transition
- **Screen**: Tap **"Close"** on reference card -> Tap **"＋ Start New Test"**
- **Presenter Action**: Navigate seamlessly to the Capture screen (`/capture`).
- **Spoken Script**:
  > *"Let us run a live field test. The officer selects the reagent kit from the top carousel—here we choose the Scott Reagent kit for presumptive cocaine screening. Notice the dual-zone reticle designed to frame both the reference card and the reaction ampoule."*

---

### 1:30 – 2:15 | Step 5: Capture & Illumination Adaptation
- **Screen**: Capture Screen -> Tap **"⚡ Test Presets (Instant Demo)"**
- **Presenter Action**: Select **"🧪 Scott Reagent: Cocaine HCl (Warm Tungsten Illumination)"**.
- **Spoken Script**:
  > *"To evaluate the system deterministically without hazardous illicit chemicals, we select our calibrated benchmark scenario: Scott Reagent under a 2700K warm incandescent lamp. Notice the raw reference card is heavily yellow-shifted at [155, 126, 98]. Instantly, our edge engine calculates the correction matrix: red gain 0.826 and blue gain 1.306, adapting the uncalibrated reaction into its true spectrophotometric baseline."*

---

### 2:15 – 2:50 | Step 6: Automated Classification
- **Screen**: Post-Capture Review Screen
- **Presenter Action**: Point out the **Outcome Badge**, **Confidence Tag**, and **Side-by-Side Swatches**.
- **Spoken Script**:
  > *"Look at the results: The system automatically classifies the reaction as 'POSITIVE: Cocaine (HCl / Base) (Presumptive)' with a confidence score of 96%. Here you see the side-by-side color swatches: the raw uncalibrated reaction, the true illumination-normalized color, and the reference card. Our classification engine computes the Euclidean color distance—ΔE = 13.1—well within our positive threshold of 110. If ambient lighting is degraded below 28 lux or overexposed by glare, our Lighting Quality Index safely halts classification and flags INCONCLUSIVE."*

---

### 2:50 – 3:25 | Step 7: Digital Evidence Record Creation
- **Screen**: Evidence Metadata Section -> Tap **"💾 Save Signed Record"**
- **Presenter Action**: Point to the Record ID, GPS coordinates, Operator ID, SHA-256 hash, and HMAC-SHA256 signature before pressing Save.
- **Spoken Script**:
  > *"Simultaneously, the digital evidence record is formed: a tamper-evident UTC timestamp, live GPS coordinates, operator identifier, and a hardware-accelerated SHA-256 hash of the raw captured image. All parameters are canonically serialized into deterministic JSON and digitally signed with HMAC-SHA256. When I tap 'Save Signed Record', this self-authenticating evidence certificate is committed to our local offline SQLite database."*

---

### 3:25 – 3:50 | Step 8: Verification & Live Tamper Demonstration
- **Screen**: Tap **"View Records"** -> Select the newly created record in `/records`
- **Presenter Action**: 
  1. Show green verification banner: `✓ CRYPTOGRAPHIC SIGNATURE VERIFIED: UNTAMPERED`.
  2. Tap **"⚠️ Simulate Tampering (Judge Demo)"**.
  3. Show the banner instantly turn red: `⚠ TAMPER DETECTED / INVALID SIGNATURE`.
  4. Tap **"✓ Restore Authentic State"** to show it return to green.
- **Spoken Script**:
  > *"In the Records tab, we open the saved record. The app immediately re-runs cryptographic verification: 'CRYPTOGRAPHIC SIGNATURE VERIFIED: UNTAMPERED'. Now, let us demonstrate active tamper detection for the jury. I tap 'Simulate Tampering'. Instantly, the signature check fails and flashes a bright red warning: 'TAMPER DETECTED / INVALID SIGNATURE'. Any post-capture alteration—whether someone changes the sample ID, modifies the operator badge, or alters the record payload—causes the cryptographic signature verification to fail immediately. I restore it, and the record returns to verified status."*

---

### 3:50 – 4:15 | Step 9: Architecture & Export Certificates
- **Screen**: Modal Actions -> Tap **"📄 Export Evidence Certificate (JSON)"** -> Tap **"📱 Show QR Roadside Slip"**
- **Presenter Action**: Show the exported JSON certificate and QR handover slip.
- **Spoken Script**:
  > *"For standardized digital evidence auditability, the officer can export a cryptographically verifiable JSON evidence package containing the full cryptographic digest, or display a compact QR verification slip for roadside custody handover to the forensic laboratory."*

---

### 4:15 – 4:35 | Step 10: Operational Impact & Searchable Log
- **Screen**: Records List Screen (`/records`)
- **Presenter Action**: Type in the search box, click filter chips: `All`, `Positive`, `Negative`, `Inconclusive`.
- **Spoken Script**:
  > *"VeriTrace AI transforms isolated field tests into an auditable, searchable digital log. Supervisory officers can filter tests by outcome, search by sample ID or operator, reduce manual transcription, and review regional test patterns offline, syncing to central FastAPI audit servers whenever network connectivity is available."*

---

### 4:35 – 4:50 | Step 11: Validation & Engineering Roadmap
- **Screen**: Top Navigation -> Tap **"Overview (SIH)"** (`/about`)
- **Presenter Action**: Briefly show the 5-Step Workflow and Supported Reagents Matrix.
- **Spoken Script**:
  > *"Our mathematical engine supports implemented benchmark profiles across standard field reagents—Scott, Marquis, and Duquenois-Levine. Our next development milestone is broader controlled validation across different camera hardware, lighting chambers, and representative drug cuts in partnership with state forensic science laboratories."*

---

### 4:50 – 5:00 | Step 12: Mandatory Regulatory Closing
- **Screen**: Point to the persistent Regulatory Guardrail banner on screen.
- **Presenter Action**: Make direct eye contact with the jury.
- **Spoken Script**:
  > *"In closing, VeriTrace AI connects the physical field test with a standardized, traceable, and cryptographically verifiable digital record — while remaining a presumptive field-test tool that does not replace laboratory confirmation. We are Team DOOMDAY. Thank you."*

---

## 🛡️ Critical Guidelines for Presenters
1. **Always use Demo Presets during the live demonstration**: They reliably demonstrate tungsten illumination, fluorescent lighting, daylight, non-reactive negative, and low-light inconclusive guardrails without risking room-lighting variations.
2. **Never claim Deep Learning / YOLO drug detection**: If asked, state clearly: *"Our active classification is Computer Vision and Mathematical Colorimetry using calibrated Euclidean color distance (ΔE) and reference-card gain normalization. This delivers sub-millisecond, 100% offline, deterministic classification on mobile devices."*
3. **Always emphasize the Presumptive Result disclaimer**: This builds immediate credibility with forensic and legal judges.
