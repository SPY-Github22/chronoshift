# Chronoshift: Neon Overdrive ⚡

[![Play Game](https://img.shields.io/badge/Play%20Live-GitHub%20Pages-00f3ff?style=for-the-badge&logo=github)](https://spy-github22.github.io/chronoshift/)
[![Build & Deploy](https://github.com/SPY-Github22/chronoshift/actions/workflows/deploy.yml/badge.svg)](https://github.com/SPY-Github22/chronoshift/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **🎮 Live Playable Game:** [https://spy-github22.github.io/chronoshift/](https://spy-github22.github.io/chronoshift/)

An adrenaline-pumping, retro-cyberpunk arcade evasion game where time bends to your will. Dodge phase lasers, homing missiles, and cosmic pulsars in dilated slow-motion while racking up explosive combo multipliers.

---

## 🌌 The Campaign Sectors

- **Sector 1: The Firewall Perimeter**: Fast evasion against automated purge sentinels, laser telegraph sweeps, and tachyon grazing fundamentals.
- **Sector 2: The Quantum Foundry [LEVEL 2]**: Industrial cyber-forge featuring gravitational singularity vortexes, Newtonian inverse-square curving, and the **A.P.E.X. Forge Sentinel MK-II** boss.
- **Sector 3: The Sub-Zero Null Zone [LEVEL 3]**: Absolute-zero temporal cryogenic stasis where Chronoshift flash-freezes hazards into brittle ice shards, allowing players to shatter them with EMP cascades against **Cryo-Archon Glaciex-09**!
- **Sector 4: The Hyper-Tachyon Slipstream [LEVEL 4]**: Relativistic warp tunnel with speed gates, paired Black Hole / White Hole teleportation portals, and an Ace Combat dogfight duel against rival **Nemesis-00 'Chronos-Omega'**!
- **Sector 5: The Singularity Core [FINALE - LEVEL 5]**: The epicenter of the temporal collapse! Face the ultimate progenitor rogue intelligence **A.P.E.X. Prime** in a climactic 4-phase reality war:
  - *Phase 1 (Quantum Mirror)*: Dimensional shield rotation and chronal orb sweeps.
  - *Phase 2 (Graviton Overcharge)*: Twin gravity wells warping projectiles and player vectors.
  - *Phase 3 (Absolute Zero Cascade)*: Cryogenic blizzard frost accumulation and ice projectile barrages.
  - *Phase 4 (Cosmic Collapse)*: Warp portals, tachyonic speed gates, and 12-way Supernova bullet-hell barrages! Defeat A.P.E.X. Prime to restore the spacetime continuum and unlock the Grand Campaign Victory epilogue.

## 🕹️ Core Game Mechanics

- **🛡️ Safe Harbor & Ready Staging**: Rounds never begin before you are prepared. Ships spawn in a designated lower safe harbor with a **3.5s Warp Shield** aura and a 200px exclusion zone keeping bosses, gravity wells, and projectiles at bay until you initiate engagement.
- **⏸️ Tactical Pause Modal**: Pause the action instantly with `P`, `Escape`, or the HUD `⏸ PAUSE` button to inspect wave stats, resume, retry, or abort without penalty.
- **⚡ Chrono Dilation (Bullet Time)**: Hold `Space` or `Right-Click` to dilate time to 22% speed. Time slows down around you while maintaining snappy ship control.
- **🎯 Near-Miss Graze System**: Brush dangerously close to lethal hazards without taking a hit to recharge your Chrono Capacitor and build combo multipliers (up to **16x**!).
- **💥 Tactical EMP Shockwave**: Graze hazards and collect magnetic energy cores to charge your EMP battery. When full, unleash a screen-clearing pulse that vaporizes hazards for cascade points.
- **🎁 Tactical Power-Up Drops**:
  - **🛡️ Shield Repair (`+`)**: Restores 1 lost shield heart.
  - **⚡ Chrono Overdrive (`∞`)**: 6 seconds of continuous, zero-drain bullet time.
  - **☢️ Tactical Nuke (`☢`)**: Instantly purges all hazards with massive bonus points.
- **🎵 In-Engine Procedural Audio Synth**: Zero external sound files! Powered completely by the Web Audio API with a dynamic 16-step Synthwave BGM, lowpass filter dilation on slow-mo, retro chiptune leads, and punchy FM bass kicks.
- **📱 Responsive & Touch Ready**: Full keyboard/mouse controls on desktop and on-screen dual touch buttons on mobile/tablet.

---

## 🚀 Controls

| Action | Desktop (Keyboard & Mouse) | Mobile & Tablet (Touch) |
|---|---|---|
| **Move Ship** | `W`, `A`, `S`, `D` or Arrow Keys / Mouse Track | Drag anywhere on screen |
| **Chrono-Shift (Slow-Mo)** | `Space` or Right-Click | Tap/Hold `⚡ SLOW-MO` button (or 2-finger touch) |
| **EMP Blast** | `E` or Left-Click (when charged) | Tap `💥 EMP BLAST` button |
| **Tactical Pause / Resume** | `P` or `Escape` | Tap HUD `⏸ PAUSE` button |
| **Toggle Audio** | `M` or click HUD Audio Button | Tap `🔊 AUDIO` button |

---

## 🛠️ Tech Stack & Architecture

- **Language & Runtime**: TypeScript 5 with strict compilation (`noEmit`, strict nulls, unused locals checking)
- **Bundler & Dev Server**: Vite 5
- **Unit Testing**: Vitest test runner (29 unit tests across 6 suites covering vector algebra, ready/pause state management, gravity wells, cryo mechanics, wormhole slipstreams, and A.P.E.X. Prime multi-phase boss mechanics)
- **Graphics**: Hardware-accelerated HTML5 Canvas 2D with particle pooling, screen-shake impulse physics, and retro CRT scanline styling
- **Audio Engine**: Embedded Web Audio API procedural synthesizer (oscillators, biquad filter sweeps, and noise buffers)
- **CI/CD**: GitHub Actions workflow automatically testing, building, and deploying directly to GitHub Pages on every push to `main`

---

## 📦 Local Development

```bash
# Clone the repository
git clone https://github.com/SPY-Github22/chronoshift.git
cd chronoshift

# Install dependencies
npm install

# Run local development server
npm run dev

# Run unit tests
npm test

# Production build and typecheck
npm run build
```

---

## 📜 License
Distributed under the MIT License. Built with ❤️.
