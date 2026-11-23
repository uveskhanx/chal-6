# SaansAI System Architecture & Engineering Blueprint

This document details the architectural design, security protocols, mathematical models, and quality engineering standards implemented in SaansAI.

---

## 1. Architectural Philosophy: Clean, Layered & Guarded

SaansAI follows Clean Architecture principles, ensuring complete decoupling between transport layers, core domain logic, external telemetry providers, and presentation views.

```
┌─────────────────────────────────────────────────────────────┐
│                       Presentation Layer                    │
│      Next.js 15 App Router • React 19 • Tailwind CSS        │
│   (Dashboard, Commute Lab, Indoor Sanctuary, AI Assistant)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    API & Transport Layer                    │
│  Edge Middleware • Rate Limiting • Strict CSP • CORS Router │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Domain Services Engine                   │
│   • CPCB NAQI Statutory Calculator                          │
│   • Diurnal Boundary Layer Recommendation Engine            │
│   • Mass-Balance Indoor Aerosol ODE Simulator               │
│   • ICRP 66 Human Respiratory Dosimetry & Carbon Model      │
│   • Autonomous GenAI 15-Tool Agent Registry                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 Telemetry & Provider Layer                  │
│    CPCB CAAQMS • OpenAQ v3 • Open-Meteo • OSRM Geometry     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Mathematical & Scientific Formulations

### A. Indoor Particle Decay (Mass-Balance ODE)
The dynamic indoor PM2.5 and PM10 concentration $C(t)$ inside an enclosed space is governed by:

$$\frac{dC(t)}{dt} = P \cdot \lambda \cdot C_{out} + \frac{S(t)}{V} - (\lambda + k_d + k_f) \cdot C(t)$$

- $P$: Building envelope particle penetration fraction (0.70 for standard Indian apartment).
- $\lambda$: Air exchange rate (h⁻¹).
- $C_{out}$: Ambient outdoor concentration (µg/m³).
- $S(t)$: Indoor source emission rate (µg/h), e.g., cooking tadka or incense.
- $V$: Room volume (m³).
- $k_d$: Natural particle deposition rate on indoor surfaces (0.24 h⁻¹ for PM2.5, 0.65 h⁻¹ for PM10).
- $k_f$: Filtration clearance rate from HEPA air purifiers: $k_f = \frac{\text{CADR}}{V}$ (h⁻¹).

The analytical closed-form solution during steady generation and decay periods is computed in constant time $O(1)$, guaranteeing sub-50ms latency without numerical approximation errors.

### B. Respiratory Tract Deposition Dosimetry (ICRP Publication 66)
Inhaled and deposited particulate dose across transit modes is calculated using:

$$\text{Inhaled Mass } (\mu\text{g}) = \sum_{i=1}^{N} C_i \cdot (1 - \eta_{\text{mask}}) \cdot P_{\text{cabin}} \cdot \dot{V}_E \cdot \Delta t_i$$

$$\text{Deposited Dose } (\mu\text{g}) = \text{Inhaled Mass} \cdot DF$$

- $C_i$: Spatial segment PM2.5 concentration via Inverse Distance Weighting (IDW).
- $\eta_{\text{mask}}$: Validated filtration efficiency (N95: 95%, Surgical: 60%, Cloth: 30%, None: 0%).
- $P_{\text{cabin}}$: Vehicle cabin penetration factor (Metro: 0.20, Car AC Recirc: 0.15, Auto Rickshaw: 0.90).
- $\dot{V}_E$: Minute ventilation volume based on physical activity (Sedentary: 6 L/min, Active Cycling: 43 L/min).
- $DF$: Total respiratory tract deposition fraction (0.48 for PM2.5, 0.72 for PM10).

---

## 3. Security Architecture & Threat Mitigation

1. **Content Security Policy (CSP)**: Strict headers configured preventing cross-site scripting and unauthorized script execution.
2. **Edge Sliding-Window Rate Limiting**: 120 requests/minute per client IP with RFC 6585 `429 Too Many Requests` and `Retry-After` headers.
3. **Payload Inspection & DoS Defense**: Enforces a 1MB payload ceiling returning `413 Payload Too Large` to prevent memory flooding.
4. **Injection & Path Traversal Guards**: Strict blocking of directory traversal (`..`) and null bytes (`%00`) returning `400 Bad Request`.
5. **Zero-Hallucination Agent Framework**: Gemini Flash 2.5 is constrained to execute registered tools with validated Zod schemas. If required telemetry is unavailable, it explicitly marks data provenance as synthetic fallback rather than fabricating numbers.

---

## 4. Verification & Testing Strategy

- **179 Unit, Integration & Security Tests**: Executed across 77 test suites with zero failures.
- **Node.js Native Test Runner**: Automated coverage reporting via `--experimental-test-coverage` with >93% coverage.
- **Zero Linter Warnings**: Zero ESLint issues under Next.js Core Web Vitals config and zero disabled lint rules.
- **Strict TypeScript**: `npx tsc --noEmit` verified with zero type errors.
