
// Servicio dedicado para Google Cloud Text-to-Speech (Standard REST API)
// Documentación: https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize

interface TtsInput {
  text: string;
}

interface TtsVoice {
  languageCode: string;
  name: string; // 'es-AR-Neural2-A' (Fem) | 'es-AR-Neural2-B' (Masc)
}

interface TtsAudioConfig {
  audioEncoding: 'MP3' | 'LINEAR16';
  speakingRate?: number;
  pitch?: number;
}

interface TtsRequest {
  input: TtsInput;
  voice: TtsVoice;
  audioConfig: TtsAudioConfig;
}

export const synthesizeArgentineSpeech = async (
  text: string, 
  gender: 'Hombre' | 'Mujer' = 'Mujer',
  speed: number = 1.0,
  pitch: number = 0.0
): Promise<string | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found for TTS");
    return null;
  }

  // Selección de voz Neural Argentina
  // A: Femenina, B: Masculina (Rioplatense)
  const voiceName = gender === 'Hombre' ? 'es-AR-Neural2-B' : 'es-AR-Neural2-A';

  const payload: TtsRequest = {
    input: { text },
    voice: {
      languageCode: 'es-AR',
      name: voiceName
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: speed,
      pitch: pitch
    }
  };

  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("TTS Error:", err);
      throw new Error(err.error?.message || "Error en TTS");
    }

    const data = await response.json();
    // La API devuelve "audioContent" en base64
    if (data.audioContent) {
      // Convertir base64 a Blob URL jugable
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      return URL.createObjectURL(blob);
    }
    return null;

  } catch (error) {
    console.error("Fallo al sintetizar voz argentina:", error);
    return null;
  }
};
