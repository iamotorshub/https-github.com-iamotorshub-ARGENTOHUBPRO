# ARGENTO HUB PRO V14 - FRONTE-END SYSTEM DESIGN & INTEGRATION SPEC

> 🚨 **MIGRATION NOTICE:** If you are migrating this project to the production environment (GentHub), please refer to **`MIGRATION_BIBLE.md`**. It contains the specific prompts, architectural changes, and aesthetic rules required for the transplant.

## 1. VISION & ARCHITECTURE
ArgentoHub is designed as a **"Cinematic Neural Interface"**. Unlike traditional SaaS dashboards (flat, white, grid-based), this system mimics high-end sci-fi interfaces (think Jarvis, Minority Report) but built with web technologies.

### Core Stack
- **Framework:** React 19 (Experimental/Latest) with Hooks.
- **Styling:** Tailwind CSS + Custom CSS Variables for depth/animations.
- **AI Core:** `@google/genai` (Gemini 2.5/3 Pro & Flash) for Multimodal interactions.
- **Audio:** Web Audio API (native `AudioContext`, `ScriptProcessor`) for real-time PCM streaming + ElevenLabs API integration ready.

## 2. UI/UX DESIGN SYSTEM (THE "ARGENTO" AESTHETIC)

To integrate another tool into this ecosystem, it MUST adhere to these strict rules:

### A. Color Palette (Dark Mode Only)
The background is NEVER pure black, but a deep void with vignettes.
- **Background:** `#020202` (Base) overlaid with `rgba(8, 8, 12, 0.35)` glass layers.
- **Accent Primary:** Indigo `#6366f1` (Buttons, Active States).
- **Accent Glow:** `rgba(99, 102, 241, 0.4)` (Shadows, borders).
- **Success:** Emerald `#10b981`.
- **Text:** Slate-300 for body, White for headers.

### B. Glassmorphism & Depth (The "Gaussian Glass")
We do not use standard cards. We use "Floating Layers".
```css
.gaussian-glass {
    background: rgba(8, 8, 12, 0.35);
    backdrop-filter: blur(25px) saturate(210%);
    border: 1px solid rgba(255, 255, 255, 0.07);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
}
```
*Integration Rule:* Any new widget must be wrapped in this class.

### C. Typography
- **Font:** 'Plus Jakarta Sans'.
- **Usage:**
  - Headers: Uppercase, Ultra-Black weight (800/900), tracking-tighter or tracking-widest.
  - Labels: Uppercase, tracking `[0.4em]`, tiny font size (10px).
  - Body: Medium weight, large line-height for readability.

### D. Micro-Interactions
- **Hover:** Elements don't just change color; they scale (`scale-105`), glow (`shadow-lg`), or reflect light.
- **Transitions:** Always `cubic-bezier(0.34, 1.56, 0.64, 1)` for "bouncy" feels.

## 3. FUNCTIONAL MODULES (INTEGRATION POINTS)

### A. The "Live" Session (Home)
- **Audio Engine:** Handles raw PCM chunks (16-bit, 24kHz).
- **State:** `sessionRef` persists the WebSocket connection.
- *Integration:* If external agents connect, they must send audio in chunks to be decoded by `decodeAudioData` service.

### B. Agent Studio (Editor)
- **Data Structure:** `Agent` object (see `types.ts`).
- **Export:** The new "Export" tab generates a JSON config.
- *Integration:* To embed an agent in another site, the generated `<argentohub-agent>` widget (future implementation) will consume this JSON.

### C. Audio Lab (ElevenLabs Integration)
- **Inputs:** `elevenLabsApiKey` & `elevenLabsVoiceId`.
- **Logic:** The App currently switches between Gemini TTS and ElevenLabs Logic based on `audioProvider` state.
- *Integration:* Ensure backend proxy handles the actual ElevenLabs API call to hide the API Key in production.

## 4. INTEGRATION PLAN: ARGENTO HUB + AGENT HUB

To merge this frontend with an existing "Agent Hub":

1.  **Wrapper Component:** Wrap the external tool in the `gaussian-glass` container.
2.  **State Sync:** Use the `Agent` interface as the source of truth. If the external tool has a database, map its columns to:
    - `instruction` (System Prompt)
    - `voiceSettings` (Speed/Pitch)
    - `knowledge` (RAG Documents)
3.  **Visual Bridge:**
    - Replace all standard `<input>` with: `bg-transparent border-b border-white/5 focus:border-indigo-500`.
    - Replace all `<button>` with: `rounded-full uppercase tracking-widest font-black`.

## 5. EXAMPLE COMPONENT CODE (FOR CONSISTENCY)

Use this structure for any new panel:

```tsx
<div className="gaussian-glass p-8 rounded-[3rem] border border-white/5 animate-in fade-in">
   <h3 className="text-xl font-black uppercase tracking-widest text-indigo-400 mb-6">Title</h3>
   <div className="space-y-4">
      <div className="space-y-2">
         <label className="text-[10px] font-black uppercase text-slate-500">Label</label>
         <input className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 transition-all" />
      </div>
      <button className="w-full py-4 bg-white text-black rounded-xl font-black uppercase hover:scale-105 transition-transform">Action</button>
   </div>
</div>
```