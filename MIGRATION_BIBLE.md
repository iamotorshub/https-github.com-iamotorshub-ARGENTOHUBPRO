# 🚀 MIGRATION BIBLE: ARGENTOHUB PRO -> GENTHUB

**CONFIDENTIAL:** This document contains the "Technical Testament" required to transplant the ArgentoHub module into the GentHub production environment without losing its soul.

---

## 🤖 1. MASTER PROMPT FOR ENTIGRAVITY (AI AGENT)

*Copy and paste this section directly into the AI's context window.*

```markdown
ACT AS: Senior Lead Frontend Architect & Migration Specialist.
MISSION: Migrate the "ArgentoHub Pro" prototype (Source A) into the "AgentHub" production environment (Target B).
PRIORITY: Zero Data Loss, Pixel-Perfect Visual Fidelity, 100% Logic Preservation.

--- CONTEXTO DE ORIGEN (Source A - Lo que tenemos) ---
Stack: React 19, Tailwind, Native CSS Animations, Google GenAI SDK, Native Web Audio API.
Estado:
1.  **Frontend:** Altamente avanzado. Usa "Gaussian Glassmorphism", animaciones de paralaje, y componentes "Luxury".
2.  **Backend:** FALSO (Mocked).
    - Persistencia: Usa `localStorage` y un array estático `DEFAULT_AGENTS`.
    - API Keys: Las keys de Gemini y ElevenLabs están en el frontend o se piden al usuario.
    - Archivos: Los PDFs/Imágenes en "Aladino" se convierten a Base64 en memoria (no hay S3/Storage real).
3.  **Lógica Crítica (NO TOCAR):**
    - `ARGENTINE_PRESETS`: Lógica de prompts para acentos rioplatenses.
    - `services/audioUtils.ts`: Decodificación PCM raw para streaming de audio.
    - `types.ts`: La estructura de datos `Agent`, `VoiceSettings`, `Scene`. ESTO ES SAGRADO.

--- OBJETIVO DE MIGRACIÓN (Target B - Lo que queremos) ---
Integrar las vistas de ArgentoHub como un "Super-Módulo" dentro de la app productiva.
**STRICT DIRECTIVE:** The Target App (GentHub) must ADAPT to ArgentoHub's aesthetic for these modules, not the other way around. This is an AESTHETIC TAKEOVER.

--- INSTRUCCIONES DE EJECUCIÓN PASO A PASO ---

FASE 1: TRANSPLANTE ESTÉTICO (CSS & ASSETS)
1.  Extrae todo el CSS dentro del `<style>` de `index.html` del Source A.
2.  Crea un archivo `src/styles/argento-core.css` o inyéctalo globalmente.
3.  IMPORTANTE: No conviertas las animaciones CSS (tunnelZoom, float) a Tailwind arbitrario. Mantenlas como clases CSS puras para asegurar la fluidez original.
4.  Copia la configuración de la fuente 'Plus Jakarta Sans'.

FASE 2: LA COLUMNA VERTEBRAL (TYPES)
1.  Copia `types.ts` EXACTAMENTE como está.
2.  Si Target B ya tiene un tipo `Agent`, crea un adaptador o extiende la interfaz. NO elimines campos como `voiceSettings` o `argentinaPreset`, son vitales para la funcionalidad de voz.

FASE 3: REFRACTORIZACIÓN DE COMPONENTES (DE MONOLITO A MODULAR)
El archivo `App.tsx` actual es gigante. Rómpelo en:
- `components/argentohub/ArgentoLayout.tsx` (Nav, Video BG)
- `components/argentohub/HeroSection.tsx` (La vista 'home')
- `components/argentohub/TemplateGallery.tsx` (La vista 'templates' estilo Apple)
- `components/argentohub/StudioEditor.tsx` (La vista 'studio' con sus tabs)
- `components/argentohub/VoiceLab.tsx` (La vista 'test_lab')
- `components/argentohub/AladinoChat.tsx` (La vista 'aladino')
- `components/argentohub/DoblajeStudio.tsx` (La vista 'dialogues')
*Regla:* Cada componente debe mantener su encapsulamiento visual (el contenedor `.gaussian-glass`).

FASE 4: CAPA DE DATOS (EL PUENTE BACKEND)
Aquí es donde reemplazamos el "Fake Backend".
1.  Crea un hook `useAgentManager` o `useArgentoStore`.
2.  **Estado Actual (MVP):** Mantén la lógica de `localStorage` dentro de este hook para que la migración funcione HOY.
3.  **Preparado para Prod:** Deja marcados los puntos de inyección para la API real:
    - `saveAgent(agent)` -> Actualmente escribe en LocalStorage. Comenta: `// TODO: POST /api/agents`.
    - `uploadFile(file)` -> Actualmente hace Base64. Comenta: `// TODO: POST /api/upload -> Return URL`.

FASE 5: INTEGRACIÓN DE VOCES (CRÍTICO)
1.  La lógica de `generateAudioForText` en `App.tsx` contiene el "Salsa Secreta" de los acentos argentinos.
2.  Extrae esto a un servicio dedicado: `services/VoiceGenerationService.ts`.
3.  Asegúrate de que la integración con ElevenLabs (fetch de voces) siga funcionando con la API Key del usuario por ahora.

--- DEFINICIÓN DE TERMINADO ---
- El usuario entra a la nueva sección y ve EXACTAMENTE lo mismo que en el prototipo.
- Los botones "Luxury" tienen el mismo efecto de barrido.
- Al crear un agente "Tomy Vendedor de Autos", se guarda y persiste (aunque sea en local por ahora).
- Aladino responde y permite adjuntar archivos.
```

---

## 🎨 2. PROTOCOLO: AESTHETIC TAKEOVER (IMPERATIVO)

El sitio de destino debe importar y aplicar obligatoriamente estos estilos globales para las rutas de ArgentoHub. **El diseño de GentHub se subordina a ArgentoHub en estas vistas.**

### A. TIPOGRAFÍA (NO NEGOCIABLE)
- **Fuente:** `Plus Jakarta Sans` (Google Fonts).
- **Import:**
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;400;600;800&display=swap');
  ```
- **Regla CSS:** `font-family: 'Plus Jakarta Sans', sans-serif;`
- **Pesos:** `font-black` (800) para Títulos, `font-light` (200) para descripciones.

### B. PALETA DE COLORES (DARK VOID)
Ignora el tema claro de GentHub. En las secciones de Argento, fuerza estas variables:
```css
:root {
    --bg-void: #020202; /* Fondo Base */
    --glass-surface: rgba(8, 8, 12, 0.35); /* Superficie Cristal */
    --accent-indigo: #6366f1; /* Acción Principal */
    --text-primary: #f8fafc; /* Slate-50 */
    --text-secondary: #94a3b8; /* Slate-400 */
}
```

### C. EL EFECTO "GAUSSIAN GLASS"
No uses las tarjetas (Cards) existentes. Porta esta clase:
```css
.gaussian-glass {
    background: var(--glass-surface);
    backdrop-filter: blur(25px) saturate(210%);
    -webkit-backdrop-filter: blur(25px) saturate(210%);
    border: 1px solid rgba(255, 255, 255, 0.07);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
}
```

---

## 🏗️ 3. ARQUITECTURA DE MIGRACIÓN (CHECKLIST TÉCNICO)

### PASO 1: TRANSPLANTE DE ADN (ARCHIVOS BASE)
- [ ] Copiar `types.ts` -> `src/types/argento.ts`.
- [ ] Copiar `services/audioUtils.ts` -> `src/services/audioEngine.ts`.
- [ ] Copiar `components/Visualizer.tsx`.

### PASO 2: DESCOMPOSICIÓN DEL MONOLITO (`App.tsx`)
Refactorizar `App.tsx` en módulos dentro de `src/modules/ArgentoHub/`:
- [ ] `ArgentoLayout.tsx` (Nav, Video BG).
- [ ] `views/HomeView.tsx` (Hero Parallax).
- [ ] `views/TemplateGallery.tsx` (Grilla Apple).
- [ ] `views/StudioEditor.tsx` (Editor + ElevenLabs Logic).
- [ ] `views/AladinoChat.tsx`.
- [ ] `views/DoblajeStudio.tsx`.

### PASO 3: INYECCIÓN DE DATOS (FAKE BACKEND)
- [ ] Crear Hook `src/hooks/useArgentoStore.ts`.
- [ ] Mover lógica `useState` y `localStorage` aquí.
- [ ] Exportar `DEFAULT_AGENTS` y `ARGENTINE_PRESETS` a `src/data/argentoDefaults.ts`.

### PASO 4: PRESERVACIÓN DE LÓGICA DE VOZ
- [ ] Extraer lógica de `generateAudioForText` (Prompts Argentinos) a `src/services/VoiceSynthesizer.ts`.

---

## ✅ 4. CHECKLIST DE CALIDAD VISUAL (PIXEL PERFECT)

Al finalizar la migración, verifica:
1.  ¿El fondo tiene el video `mixkit-abstract...` con `filter: brightness(0.25)`?
2.  ¿Los botones tienen la clase `.btn-luxury` con el gradiente índigo y la animación de barrido?
3.  ¿El texto "ARGENTO HUB" usa la animación `Typewriter`?
4.  ¿Al pasar el mouse por las tarjetas de templates, se aplica el efecto `hover-spring` (zoom suave)?
