# 🏹 SmartDeal Hunter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/tahamtandariush/smartdeal-hunter/releases)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v0.1.0-green.svg)](https://chrome.google.com/webstore)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)

**SmartDeal Hunter** is a privacy-first Amazon shopping assistant that helps you make smarter purchases through on-device analysis. Unlike traditional extensions, it never tracks your browsing history, injects affiliate links, or sends your personal data to remote servers.

---

## 🌟 Key Features

### 🧠 Genome Engine

Your shopping preferences are unique. The **Genome Engine** builds a local profile of what matters to you—whether it's review quality, brand trust, or extreme discount depth.

- **Personal Fit Score:** Every product is scored against your specific priorities.
- **On-Device Learning:** Learns from your feedback (Saved, Purchased, Not Interested) without ever leaving your machine.

### ⚖️ True Value Analysis

Get an objective 0–100 quality signal for any product.

- Combines price trends, review sentiment (local analysis), and brand reliability.
- **Scout Panel:** A non-intrusive shadow-DOM overlay that appears only when you need it.

### 🛡️ Privacy by Design

- **Zero Telemetry:** No tracking, no advertising IDs, no background scraping.
- **Local Encryption:** Your profile is encrypted with **AES-GCM-256** using a key derived via **PBKDF2** (600,000 iterations).
- **Opt-in Only:** Advanced features like "Deep Check" (via Amazon Creators API) require explicit user consent and are rate-limited.

### 📦 Ethical Bundle Optimizer

Discover product combinations that actually make sense for your needs, generated locally from your history and preferences.

---

## 🛠 Tech Stack

- **Framework:** [WXT 0.20](https://wxt.dev/) (Web Extension Toolbox)
- **UI:** [React 19](https://react.dev/), [shadcn/ui](https://ui.shadcn.com/), [Tailwind CSS v4](https://tailwindcss.com/)
- **State:** [Genome State Management](https://github.com/tahamtandariush/smartdeal-hunter/blob/main/lib/genome.ts)
- **ML/Inference:** [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- **Security:** Web Crypto API (AES-GCM, PBKDF2)
- **Testing:** [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/)

---

## 🚀 Getting Started

### Installation (Developer Channel)

1. Download the latest [Release Zip](https://github.com/tahamtandariush/smartdeal-hunter/releases).
2. Unzip the file.
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer Mode** (top right toggle).
5. Click **Load unpacked** and select the `.output/chrome-mv3` folder.

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server with HMR
pnpm dev

# Run unit and integration tests
pnpm test:run

# Build production version
pnpm build
```

---

## 📊 Project Status: Phase 2 COMPLETE

We have successfully delivered the core pillars of SmartDeal Hunter:

- [x] **Secure Architecture:** PBKDF2-backed local encryption.
- [x] **Scout & Genome:** Fully functional on-device scoring.
- [x] **Options & Privacy:** Comprehensive user control and audit logs.
- [x] **Test Coverage:** Maintained >90% coverage across all modules.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ for privacy-conscious shoppers.
</p>
