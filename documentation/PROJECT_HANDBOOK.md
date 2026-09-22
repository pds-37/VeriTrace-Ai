# VERITRACE AI / FIELD TEST COMPANION
## Comprehensive Technical Handbook & Operational Specification

---

```
  ███████╗██╗███████╗██╗     ██████╗     ████████╗███████╗███████╗████████╗
  ██╔════╝██║██╔════╝██║     ██╔══██╗    ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝
  █████╗  ██║█████╗  ██║     ██║  ██║       ██║   █████╗  ███████╗   ██║   
  ██╔══╝  ██║██╔══╝  ██║     ██║  ██║       ██║   ██╔══╝  ╚════██║   ██║   
  ██║     ██║███████╗███████╗██████╔╝       ██║   ███████╗███████║   ██║   
  ╚═╝     ╚═╝╚══════╝╚══════╝╚═════╝        ╚═╝   ╚══════╝╚══════╝   ╚═╝   
             COMPREHENSIVE ENGINEERING & FORENSIC HANDBOOK
```

---

## 1. Executive Summary & Problem Space

### 1.1 The Challenge of Field Drug Testing
Law enforcement agencies, border control authorities, and forensic field technicians worldwide rely on disposable chemical reagent kits (such as Marquis, Scott, Duquenois-Levine, and Mecke kits) to screen unknown substances at crime scenes, border crossings, and traffic stops.

These colorimetric tests function via liquid chemical reactions where specific alkaloids or functional groups cause an observable color shift. However, current field operations face critical vulnerabilities:

1. **Subjective Human Interpretation**: Ambient lighting variations (e.g., warm sodium streetlights, harsh fluorescent tubes, direct sunlight, deep shadows) dramatically shift perceived color. What one officer interprets as a positive reaction can appear negative or ambiguous to another.
2. **Zero Evidentiary Trail**: A visual observation leaves no mathematical record that the test was conducted correctly, at what exact location, by which operator, or at what time.
3. **Inadmissibility & Legal Exposure**: Because color cards are judged by the naked eye without lighting calibration or cryptographic hashing, field tests cannot presently serve as documentary or courtroom evidence, resulting in contested arrests or dropped charges prior to laboratory confirmation.

### 1.2 The VeriTrace AI Solution
**Field Test Companion (VeriTrace AI)** transforms ordinary smartphones into objective, calibrated optical spectrophotometers and tamper-evident evidence recorders—**without requiring any new hardware**.

```
[ Raw Camera Frame ] ──> [ Dual-Zone Alignment ] ──> [ Illuminant Gain Calibration ]
                                                            │
[ Tamper-Proof Record ] <── [ HMAC-SHA256 Signing ] <── [ Automated Classification ]
```

---

## 2. System Architecture

The application is engineered as an **offline-first, edge-computing architecture** ensuring that all computer vision, calibration, classification, and cryptographic signing execute 100% locally on the device with zero cloud latency.

### 2.1 Technology Stack
| Layer | Technologies Used | Purpose |
| :--- | :--- | :--- |
| **Mobile & Web UI** | React Native 0.86, Expo 57, TypeScript 6.0 | Cross-platform UI for iOS, Android, and Web |
| **Camera & Capture** | `expo-camera`, HTML5 Canvas API | Live high-resolution frame capture & barcode scanning |
| **Edge Computer Vision** | `jpeg-js`, Float32 luminance processing | In-memory pixel decoding, dual-target ROI extraction |
| **Cryptographic Security** | `expo-crypto`, Web Crypto API | SHA-256 image hashing, HMAC-SHA256 record signing |
| **Local Persistence** | `expo-sqlite` (WAL Mode), LocalStorage | Offline-first evidence persistence and query engine |
| **Forensic Backend** | Python 3.11+, FastAPI, SQLite, PyJWT | Hash-linked chain of custody and lab verification API |

---

## 3. Optical Lighting Calibration Pipeline

Ambient illumination is the primary source of error in colorimetric analysis. An incandescent 2700K bulb infuses an image with heavy yellow-red photons ($R > B$), whereas an overcast sky or commercial fluorescent light casts a strong blue-green bias.

### 3.1 The Standard Reference Colour Card
The system utilizes a standard, in-frame **18% Neutral Spectrophotometric Reference Card** placed adjacent to the chemical reaction ampoule or test cassette.

The reference card includes calibrated patches:
- **18% Neutral Gray** ($RGB_{\text{nominal}} = [128, 128, 128]$, Hex: `#808080`)
- **90% Calibrated White** ($RGB_{\text{nominal}} = [230, 230, 230]$, Hex: `#E6E6E6`)
- **Control Deep Black** ($RGB_{\text{nominal}} = [25, 25, 25]$, Hex: `#191919`)
- **Gamut Control Swatches**: Cyan (`#00AEEF`), Magenta (`#EC008C`), Yellow (`#FFF200`)

### 3.2 Illuminant Gain Calculation
The edge engine samples the measured RGB coordinates of the neutral reference target in the captured frame:

$$\vec{C}_{\text{ref}} = \begin{bmatrix} R_{\text{ref}} \\ G_{\text{ref}} \\ B_{\text{ref}} \end{bmatrix}$$

Using the ideal reference target ($\vec{C}_{\text{ideal}} = [128, 128, 128]^T$), the system computes channel-specific gain factors:

$$G_R = \frac{128}{\max(1, R_{\text{ref}})}, \quad G_G = \frac{128}{\max(1, G_{\text{ref}})}, \quad G_B = \frac{128}{\max(1, B_{\text{ref}})}$$

To prevent excessive amplifier noise under extreme lighting, gains are clamped to operational limits:

$$G_i \in [0.30, 3.50]$$

### 3.3 Chromatic Adaptation & Correction
The reaction zone's raw measured pixel values ($\vec{C}_{\text{raw}} = [R_{\text{sample}}, G_{\text{sample}}, B_{\text{sample}}]^T$) are transformed into the calibrated true color space:

$$\vec{C}_{\text{calibrated}} = \begin{bmatrix} \min(255, \max(0, R_{\text{sample}} \times G_R)) \\ \min(255, \max(0, G_{\text{sample}} \times G_G)) \\ \min(255, \max(0, B_{\text{sample}} \times G_B)) \end{bmatrix}$$

### 3.4 Lighting Quality Index (LQI) Guardrails
The engine evaluates scalar luminance intensity ($I$):

$$I = 0.299 \cdot R_{\text{ref}} + 0.587 \cdot G_{\text{ref}} + 0.114 \cdot B_{\text{ref}}$$

- **Optimal Lighting ($60 \le I \le 220$)**: Illumination calibration operates with maximum precision.
- **Marginal Lighting ($28 \le I < 60$ or $220 < I \le 248$)**: High gain factors applied; warning logged in evidence metadata.
- **Unreliable / Severe Underexposure ($I < 28$) or Saturation ($I > 248$)**: System immediately halts classification and flags **`INCONCLUSIVE (Poor Lighting / Glare)`**.

---

## 4. Automated Reagent Classification Engine

The application includes pre-calibrated spectral profiles for the most prevalent field drug-testing kits:

### 4.1 Reagent Reaction Library

| Reagent Kit | Target Substance | Reaction Mechanism | True Calibrated Hex | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Scott Reagent** | Cocaine HCl / Base | Cobalt thiocyanate 2-phase complex | `#0047AB` (Cobalt Blue) | **`POSITIVE`** |
| **Scott Reagent** | Negative / Sugar / Aspirin | Unreacted baseline solution | `#E8D5D8` (Pale Rose / Clear) | **`NEGATIVE`** |
| **Marquis Reagent** | Heroin / Morphine / Codeine | Acidic formaldehyde condensation | `#4B0082` (Deep Violet) | **`POSITIVE`** |
| **Marquis Reagent** | Amphetamine / Meth | Carbocation oxidation | `#C84B1E` (Orange / Red-Brown) | **`POSITIVE`** |
| **Marquis Reagent** | MDMA (Ecstasy) | Rapid polymolecular oxidation | `#180E29` (Dark Violet / Black)| **`POSITIVE`** |
| **Marquis Reagent** | Negative / Excipients | Baseline sulfuric reagent | `#F6F3D8` (Pale Straw Yellow) | **`NEGATIVE`** |
| **Duquenois-Levine** | Cannabis / THC / Concentrates | Vanillin condensation in chloroform| `#3B1F5E` (Violet-Indigo) | **`POSITIVE`** |
| **Duquenois-Levine** | Negative / Organic Material | Aqueous layer without extraction | `#F5F5DC` (Beige / Clear) | **`NEGATIVE`** |
| **Mecke Reagent** | Heroin / Morphine | Selenious acid complex | `#006A6B` (Teal / Blue-Green) | **`POSITIVE`** |
| **Fentanyl Strip** | Fentanyl / Analogues | Competitive lateral flow (1 Line)| `#B22222` (Control only) | **`POSITIVE`** |
| **Fentanyl Strip** | Negative (No Fentanyl) | Non-competitive binding (2 Lines)| `#C71585` (Control + Test) | **`NEGATIVE`** |

### 4.2 Mathematical Color Distance ($\Delta E$)
To evaluate the match against known profiles, the engine computes Euclidean color distance in calibrated 3D color space:

$$\Delta E = \sqrt{(R_{\text{cal}} - R_{\text{target}})^2 + (G_{\text{cal}} - G_{\text{target}})^2 + (B_{\text{cal}} - B_{\text{target}})^2}$$

### 4.3 Outcome Classification Logic
1. **`POSITIVE`**: Calibrated reaction falls within allowable distance threshold ($\Delta E \le 110$) of a validated positive profile. Confidence score is computed as:
   $$\text{Confidence} = 0.98 - \left(\frac{\Delta E}{110}\right) \times 0.28$$
2. **`NEGATIVE`**: Calibrated reaction matches baseline unreacted reagent ($\Delta E \le 90$).
3. **`INCONCLUSIVE`**:
   - Ambient lighting is out of bounds ($I < 28$ or $I > 248$).
   - Measured color does not match either positive or negative profiles within tolerance ($\Delta E > 110$).

---

## 5. Cryptographic Evidence & Chain of Custody

To guarantee evidentiary integrity for legal proceedings, every test generates an immutable digital record.

### 5.1 Image Hashing
Upon capture, the raw byte stream of the image is hashed before any rendering:
$$\text{ImageDigest} = \text{SHA-256}(\text{RawImageBytes})$$
This 64-character hexadecimal digest ensures the photographic evidence cannot be replaced or photoshopped.

### 5.2 Canonical Record Serialization
Record fields are sorted alphabetically into a standardized JSON string:
```json
{
  "calibratedRgb": "[0, 71, 171]",
  "confidenceScore": 0.96,
  "id": "REC-1774312800000-xyz789",
  "imageHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "kitType": "scott",
  "latitude": 37.774929,
  "locationStatus": "available",
  "longitude": -122.419416,
  "operatorId": "BADGE-402",
  "outcomeCategory": "POSITIVE",
  "presumptiveSubstance": "Cocaine (HCl / Base) (Presumptive)",
  "referenceCardCalibrated": true,
  "referenceId": "SMP-SCOTT-001",
  "timestamp": "2026-09-23T03:00:00.000Z"
}
```

### 5.3 HMAC-SHA256 Digital Signature
The canonical payload and its digest are cryptographically signed using a device-bound forensic key:
$$\text{Signature} = \text{HMAC-SHA256}(\text{DeviceKey}, \text{CanonicalPayload} \parallel \text{PayloadDigest})$$

### 5.4 Active Tamper Detection
When a record is inspected on device or by a judge:
1. The canonical payload is reconstructed from database columns.
2. The signature is independently recalculated.
3. If any field (even a single coordinate digit or timestamp second) was altered in SQLite, the signatures diverge:
   $$\text{Signature}_{\text{computed}} \ne \text{Signature}_{\text{stored}} \implies \mathbf{TAMPER\ DETECTED}$$

---

## 6. User Interface & Operational Workflows

### 6.1 Screen 1: Home Dashboard (`/index`)
- **Outbreak Metrics**: Real-time counter cards showing Total Tests, Positive matches (red), Negative non-reactions (green), and Inconclusive tests (amber).
- **One-Tap Actions**:
  - `＋ Start New Test`: Navigates to camera capture.
  - `📄 Show Reference Card`: Renders digital 18% neutral gray card on screen.
- **Evidentiary Status Indicators**: Live reporting of local storage status and backend synchronization queue.

### 6.2 Screen 2: Calibrated Capture Screen (`/capture`)
- **Reagent Kit Selection**: Horizontal carousel allowing immediate selection of reagent kit type (Scott, Marquis, Duquenois-Levine, Mecke, Fentanyl).
- **Dual-Zone Viewfinder**:
  - Target Box 1 (White Border): Guides alignment of in-frame reference card.
  - Target Box 2 (Emerald Border): Guides alignment of reagent reaction ampoule.
- **Input Channels**:
  - Live device camera with continuous QR/barcode scanning (auto-fills Sample ID).
  - Photo library / Web file upload button.
  - **⚡ Test Presets (Instant Demo)**: One-tap evaluation presets for judges.
- **Post-Capture Review Screen**:
  - Outcome Banner: Bold **`POSITIVE`**, **`NEGATIVE`**, or **`INCONCLUSIVE`** pill.
  - Telemetry Grid: Raw Reaction Color vs Calibrated True Color vs Reference Card Color.
  - Forensic Cards: Full SHA-256 hash, HMAC-SHA256 signature, GPS, and timestamp.

### 6.3 Screen 3: Searchable Test Records Log (`/records`)
- **Multi-Attribute Search Bar**: Instantly filters records by Sample ID, Operator ID, Record ID, or Substance.
- **Outcome Filter Chips**: Filter view to `ALL`, `POSITIVE`, `NEGATIVE`, or `INCONCLUSIVE`.
- **Reagent Kit Filter**: Filter view by reagent kit type.
- **Detail Modal**:
  - Live cryptographic tamper check (`✓ CRYPTOGRAPHIC SIGNATURE VERIFIED: UNTAMPERED`).
  - Calibrated swatch overlay on original image.
  - `📄 Export Evidence Certificate (JSON)`: Triggers download of signed digital certificate.
  - `📱 Show QR Roadside Slip`: Generates roadside custody transfer code.

---

## 7. Courtroom Evidence Standards & Legal Safeguards

> **Mandatory Regulatory Guardrail**:
> Every screen, digital certificate, and database export strictly enforces:
> *"The output of this application is a presumptive field-test result and a supporting digital record; it does not replace laboratory confirmatory testing (GC-MS / HPLC)."*

### 7.1 Courtroom Admissibility Checklist
Under the Federal Rules of Evidence (FRE 901 / FRE 902 for self-authenticating electronic records):
- **FRE 902(13) / (14) Certification**: Signed digital record with cryptographic SHA-256 hash ensures record has not been altered since generation.
- **Chain of Custody Tracking**: Operator ID and timestamp permanently embedded into HMAC signature.
- **Objective Reproducibility**: Colorimetric values are preserved as standardized integers ($R, G, B$) and illuminant gain factors rather than subjective officer opinions.

---

## 8. Developer & Evaluation Quickstart

### 8.1 Prerequisites
- Node.js 18+ & npm
- Python 3.10+ (for backend ledger)

### 8.2 Launching the Web Prototype
In PowerShell:
```powershell
cd "c:\Users\offic\Downloads\field-test-companion (2)\field-test-companion"
npm run web
```
Open **`http://localhost:8081`** in Google Chrome or any modern browser.

### 8.3 Executing Backend Test Suite
```powershell
cd "c:\Users\offic\Downloads\field-test-companion (2)\field-test-companion\backend"
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD="1"
python -m pytest
```
**Result**: 20/20 passed tests verifying hash-linked ledger, export, records, and sync.

### 8.4 Running Engine Verification Suite
```powershell
cd "c:\Users\offic\Downloads\field-test-companion (2)\field-test-companion"
node scratch/test_engine.js
```
**Result**: All 9 unit assertions passed (Scott Cocaine positive, Marquis Heroin positive, Scott negative, low-light inconclusive, tungsten gain calibration, and tamper detection).

---

## 9. Codebase File Map

| File Path | Description |
| :--- | :--- |
| [`services/reagentLibrary.ts`](../services/reagentLibrary.ts) | Spectral profiles, outcome classification engine ($\Delta E$), confidence scoring |
| [`services/colorCalibration.ts`](../services/colorCalibration.ts) | Reference card lighting calibration, gain matrix calculation, demo presets |
| [`services/digitalSignature.ts`](../services/digitalSignature.ts) | Canonical serialization, HMAC-SHA256 signing, tamper verification, certificate export |
| [`services/database.ts`](../services/database.ts) | SQLite database layer (WAL mode), migrations, multi-attribute search queries |
| [`services/database.web.ts`](../services/database.web.ts) | Web browser localStorage persistence mirror with search & filter |
| [`app/capture.tsx`](../app/capture.tsx) | Dual-zone camera viewfinder, preset selector, color telemetry review |
| [`app/records.tsx`](../app/records.tsx) | Searchable records log, outcome filtering, live tamper verification modal |
| [`app/(tabs)/index.tsx`](../app/(tabs)/index.tsx) | Home screen dashboard with outbreak statistics and digital reference card modal |
| [`scratch/test_engine.js`](../scratch/test_engine.js) | Standalone engine verification script |

---
*Field Test Companion (VeriTrace AI) — Engineered for Scientific Precision and Evidentiary Integrity.*
