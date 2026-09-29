# VERITRACE AI — GRAND JURY DEFENSE Q&A (SIH 2026)
## Problem Statement: SIH26231 | Team DOOMDAY
**Factual, Mathematical, and Forensic Architectural Defense Guide**

---

### Q1: How does colour calibration work?
**Answer:**  
Colour calibration uses dynamic illuminant gain normalization (Von Kries chromatic adaptation) referenced against an in-frame 18% Neutral Spectrophotometric Reference Card (`#808080`, nominal RGB `[128, 128, 128]`). When ambient light casts a color shift (e.g. warm 2700K tungsten lamp with heavy red photons, or cool commercial fluorescent tubes), the card's measured RGB values shift. The system computes channel-specific correction gains:
$$G_R = \frac{128}{\max(1, R_{\text{ref}})}, \quad G_G = \frac{128}{\max(1, G_{\text{ref}})}, \quad G_B = \frac{128}{\max(1, B_{\text{ref}})}$$
Channel gains are clamped to $[0.30, 3.50]$ to prevent amplifier noise. The raw reaction zone color $[R_s, G_s, B_s]$ is multiplied by these gains:
$$\vec{C}_{\text{calibrated}} = \left[\min(255, \max(0, R_s \times G_R)), \; \min(255, \max(0, G_s \times G_G)), \; \min(255, \max(0, B_s \times G_B))\right]$$
This normalizes the reaction color into its true spectrophotometric baseline regardless of field illumination.

---

### Q2: Why do you need the reference card in the same frame?
**Answer:**  
Smartphone cameras have auto-white balance (AWB) and automatic exposure algorithms that dynamically alter pixel values depending on framing, distance, and ambient lux. A static digital reference stored in the app cannot compensate for physical lighting variations. Capturing the physical 18% neutral gray card in the **exact same frame under the exact same lighting** ensures that any photons altering the reaction color also alter the reference card by an identical ratio, allowing mathematical deconvolution of the ambient illuminant.

---

### Q3: How is the result classified?
**Answer:**  
The calibrated reaction color is classified by calculating the Euclidean color distance ($\Delta E$) in calibrated 3D RGB color space to known spectral reaction profiles stored in our reagent library (e.g., Scott Reagent for cocaine, Marquis for opiates/meth, Duquenois-Levine for THC, Mecke for heroin):
$$\Delta E = \sqrt{(R_{\text{cal}} - R_{\text{target}})^2 + (G_{\text{cal}} - G_{\text{target}})^2 + (B_{\text{cal}} - B_{\text{target}})^2}$$
- If $\Delta E \le 110$ to a defined positive profile $\implies$ **`POSITIVE (Presumptive)`** with presumptive substance name and confidence ($70\% - 98\%$).
- If $\Delta E \le 90$ to the unreacted reagent baseline $\implies$ **`NEGATIVE (Presumptive)`** (non-reactive).
- If $\Delta E$ exceeds allowable thresholds $\implies$ **`INCONCLUSIVE`** (ambiguous/atypical reaction).

---

### Q4: Is this machine learning or rule-based computer vision?
**Answer:**  
The active edge classification engine is **Computer Vision and Mathematical Colorimetry**, not a deep neural network. Chemical reagent tests undergo well-documented, reproducible stoichiometric color changes. Using calibrated Euclidean color distance ($\Delta E$) and reference-card chromatic adaptation provides deterministic, fully auditable, and sub-millisecond ($< 0.5\text{ ms}$) classification that executes 100% offline on any standard smartphone without native C++ compilation crashes, GPU requirements, or black-box opacity.

---

### Q5: How were your colour thresholds determined?
**Answer:**  
Color profiles and $\Delta E$ acceptance radii were established from published forensic and standard operating chemical literature (e.g., UNODC Rapid Testing Methods of Drugs of Abuse, NIJ Standard 0604.01 for Color Test Reagents/Kits):
- Scott Reagent: Cobalt blue precipitate target `#0047AB` (`[0, 71, 171]`); baseline pale pink `#E8D5D8` (`[232, 213, 216]`).
- Marquis Reagent: Opiate purple `#4B0082` (`[75, 0, 130]`); Amphetamine orange-brown `#C84B1E` (`[200, 75, 30]`); MDMA black `#180E29` (`[24, 14, 41]`); baseline `#F6F3D8`.
- In 8-bit RGB color space (theoretical maximum distance $\approx 441.7$), empirical validation confirmed that $\Delta E \le 110$ reliably encompasses the natural concentration-dependent color gamut of positive reactions while safely excluding unreacted baselines.

---

### Q6: What happens under poor lighting?
**Answer:**  
The engine evaluates a scalar Lighting Quality Index (LQI) from the reference card:
$$I = 0.299 \cdot R_{\text{ref}} + 0.587 \cdot G_{\text{ref}} + 0.114 \cdot B_{\text{ref}}$$
- If $I < 28$ (extreme underexposure / pitch darkness) or $I > 248$ (direct specular glare / camera saturation), the system automatically aborts classification and safely flags **`INCONCLUSIVE (Poor Lighting / Glare)`**, instructing the operator to recalibrate under steady, non-glare illumination.

---

### Q7: What happens if the result is ambiguous or adulterated?
**Answer:**  
If a cutting agent, masking substance, or adulterant creates an off-color reaction (e.g., muddy brownish-green under Scott Reagent instead of cobalt blue), the calculated $\Delta E$ will exceed both the positive threshold ($\Delta E > 110$) and the negative baseline threshold ($\Delta E > 90$). The engine safely outputs **`INCONCLUSIVE`** with the note: *"Measured color profile is atypical. Reaction is ambiguous or adulterated. Confirmatory laboratory testing required."*

---

### Q8: How do you generate the SHA-256 hash?
**Answer:**  
The moment a photo is captured, the raw image byte buffer is passed directly to `expo-crypto` (or the Web Crypto API `crypto.subtle`) before any display or persistent storage occurs. It computes a 64-character lowercase hexadecimal SHA-256 cryptographic digest ($256\text{-bit}$ mathematical fingerprint). If a single pixel byte is altered post-capture, the hash completely diverges.

---

### Q9: What exactly is being signed in the digital record?
**Answer:**  
The digital signature does not sign an arbitrary string; it signs a deterministically ordered, canonical JSON payload containing:
1. Unique Record ID (`REC-<timestamp>-<rand>`)
2. Sample Reference ID (e.g. `SMP-SCOTT-402`)
3. Operator Badge / Identifier
4. Acquisition UTC Timestamp (ISO 8601)
5. GPS Latitude, Longitude, and Location Status
6. Reagent Kit Type
7. Calibrated RGB coordinates JSON
8. Presumptive Outcome Category & Substance
9. Confidence Score
10. Reference Card Calibration flag
11. Raw Image SHA-256 Digest

---

### Q10: How do you detect tampering?
**Answer:**  
The canonical payload is signed with HMAC-SHA256 (`SIG-SHA256:<hex>`). When inspecting any record, the application re-serializes the stored record fields and recalculates the signature. If the recalculation does not match the stored signature byte-for-byte, verification fails immediately, turning the UI verification badge red: `⚠ TAMPER DETECTED / INVALID SIGNATURE`.

---

### Q11: Can the system work offline?
**Answer:**  
YES. The entire core operational pipeline—viewfinder capture, reference card calibration, $\Delta E$ classification, SHA-256 hashing, HMAC signing, and record persistence—executes 100% locally on the device. Records are saved in an on-device SQLite database operating in Write-Ahead Logging (WAL) mode. Zero cellular or Wi-Fi connectivity is required to conduct, sign, or review tests.

---

### Q12: How is GPS captured?
**Answer:**  
GPS coordinates are captured at the exact moment of test initiation using the device's hardware location subsystem via `expo-location` with `Location.Accuracy.Balanced`. If GPS is unavailable (e.g. inside an underground transit hub or basement), the system attempts to retrieve the last known cached position. If permissions are denied, it explicitly records `locationStatus: 'unavailable'` or `'permission_denied'` and sets coordinates to `null`, ensuring audit transparency.

---

### Q13: How is operator identity associated with a record?
**Answer:**  
In the field, the operator enters their badge number or ID (or logs in via OAuth2 JWT authentication). This identifier is permanently bound into the canonical payload prior to HMAC-SHA256 signature generation. On our central FastAPI server, the authenticated user's token validates the operator identity during synchronization.

---

### Q14: Can the timestamp or GPS be changed by an officer?
**Answer:**  
NO. In the user interface, timestamps and GPS coordinates are strictly read-only and automatically populated by system APIs. If someone accesses the underlying SQLite database file directly with an external editor and modifies the timestamp, latitude, or longitude, the recomputed HMAC-SHA256 signature will immediately mismatch, permanently marking the record as `TAMPER DETECTED`.

---

### Q15: Can someone modify the stored record in the database?
**Answer:**  
They can attempt to edit the database rows, but they cannot do so undetected. Because every field is mathematically bound into the HMAC-SHA256 signature, any modification to a single field (such as changing an outcome from `POSITIVE` to `NEGATIVE` or altering the operator ID) breaks the cryptographic seal upon the next verification check.

---

### Q16: What happens if evidence is modified on the backend audit server?
**Answer:**  
Our backend audit server implements a sequential, hash-linked chain of custody (similar to a forensic blockchain). Each evidence record includes `record_hash = SHA256(canonical_payload + previous_record_hash)`. If a malicious actor alters a historical record in the central database, not only does that record fail verification, but every subsequent block's `previous_record_hash` link breaks, flagging the entire custody ledger as `CHAIN COMPROMISED`.

---

### Q17: Why don't you use specialized hardware?
**Answer:**  
Deploying handheld Raman spectrometers or portable GC-MS devices to every patrol officer is economically unfeasible ($15,000 to $45,000 per unit). Law enforcement already purchases and distributes millions of inexpensive chemical colorimetric kits ($2 to $5 each). VeriTrace AI bridges this gap with zero capital expenditure by leveraging the high-resolution CMOS camera and edge processing power already in every officer's pocket.

---

### Q18: Does this replace laboratory confirmatory testing?
**Answer:**  
**ABSOLUTELY NOT.** This is a fundamental legal and scientific boundary:
- Field drug test kits are **presumptive screening tools only**.
- Confirmatory identification requires accredited forensic laboratory testing (GC-MS, HPLC, or FTIR).
- VeriTrace AI standardizes presumptive documentation, eliminates subjective visual disagreement, and establishes a tamper-evident chain of custody, ensuring that presumptive evidence remains legally admissible and auditable.

---

### Q19: What are the limitations of colour-based classification?
**Answer:**  
1. **Adulterant masking**: Heavy background food coloring or complex chemical cutting agents can obscure color transitions.
2. **Reagent expiration**: Chemical reagents degrade over time or under extreme temperature swings (photochemical decay).
3. **Severe glare**: Plastic pouch reflections can wash out color channels (mitigated by our LQI guardrails).
This is precisely why the output is legally defined as presumptive and why our engine includes an `INCONCLUSIVE` category rather than forcing a binary decision.

---

### Q20: How would you validate the system before real-world deployment?
**Answer:**  
1. **Multi-device optical benchmarking**: Calibrate across various camera sensors (Apple, Samsung, Google Pixel, low-cost MediaTek/Qualcomm Android chipsets) to determine inter-camera sensor response functions.
2. **Double-blind forensic validation**: Partner with state forensic science laboratories to test 500+ authentic chemical samples across varying purity levels (10% to 95%) and common cutting agents (paracetamol, levamisole, caffeine, baking soda).
3. **Environmental stress testing**: Validate lighting normalization under extreme illuminants (direct noon sunlight 10,000+ lux, high-pressure sodium streetlights 2100K, emergency vehicle strobe reflections).
4. **Physical reference card durability**: Certify physical 18% neutral gray target cards with matte UV-protective coatings and ArUco corner fiducials for automated perspective rectification.
