# 🇦🇷 ARGENTO HUB PRO (V14.5)

**The Cinematic Neural Interface for AI Agents.**

> 🚨 **MIGRATION & INTEGRATION:**
> If you are looking to integrate this module into **GentHub** (Production), you **MUST** read [MIGRATION_BIBLE.md](./MIGRATION_BIBLE.md) first. It contains the "Aesthetic Takeover" protocols and the architectural refactoring plan.

## Overview

ArgentoHub is a high-fidelity frontend prototype designed to orchestrate AI Agents with:
- **Native Rioplatense Accents** (Prompt Engineering + TTS Tuning).
- **Multimodal Capabilities** (Gemini 2.5/3 Integration).
- **Cinematic UI** (Gaussian Glassmorphism, Parallax, Kinetic Typography).

## Tech Stack

- **Core:** React 19
- **AI:** Google GenAI SDK (`@google/genai`)
- **Audio:** Native Web Audio API (PCM Streaming)
- **Styling:** Tailwind CSS + Custom CSS Variables
- **Font:** Plus Jakarta Sans

## Key Features

1.  **The "Live" Session:** Real-time audio processing.
2.  **Agent Studio:** Full visual editor for Agent Identity, Voice, and Knowledge (RAG).
3.  **Aladino Omni-Model:** Multimodal chat interface (Files, Images, Voice).
4.  **Doblaje Studio:** Scene generation and dialogue simulation between two agents.

## Project Structure (Current Monolith)

- `App.tsx`: Main logic controller (View Router, State Management, AI Calls).
- `types.ts`: Core data definitions (`Agent`, `VoiceSettings`, `Scene`).
- `services/audioUtils.ts`: Low-level PCM decoding/encoding.
- `MIGRATION_BIBLE.md`: **READ THIS BEFORE REFACTORING.**

---
*Built with precision for the ArgentoHub Initiative.*
