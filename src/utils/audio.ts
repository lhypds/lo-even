const WAV_HEADER_BYTES = 44;

export function hasSpeech(pcm: Uint8Array): boolean {
  if (pcm.byteLength < 2) return false;
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] / 32768;
    energy += sample * sample;
  }
  return Math.sqrt(energy / samples.length) > 0.004;
}

export function conditionPcm(pcm: Uint8Array): Uint8Array {
  const input = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const output = new Int16Array(input.length);
  let previousIn = 0;
  let previousOut = 0;
  for (let index = 0; index < input.length; index += 1) {
    const current = input[index] / 32768;
    const highPassed = current - previousIn + 0.995 * previousOut;
    previousIn = current;
    previousOut = highPassed;
    const gained = highPassed * 1.2;
    const limited = Math.abs(gained) <= 0.78 ? gained : Math.sign(gained) * (0.78 + 0.22 * Math.tanh((Math.abs(gained) - 0.78) / 0.22));
    output[index] = Math.max(-32768, Math.min(32767, Math.round(limited * 32767)));
  }
  return new Uint8Array(output.buffer);
}

export function pcm16ToWav(pcm: Uint8Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + pcm.byteLength);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Uint8Array(buffer, WAV_HEADER_BYTES).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}

let cachedApiKey: string | null = null;

async function apiKey(): Promise<string> {
  if (cachedApiKey !== null) return cachedApiKey;
  const response = await fetch("https://cli.simple-ai.io/api/key");
  if (!response.ok) throw new Error("Speech service unavailable");
  const data = (await response.json()) as { key?: string };
  cachedApiKey = data.key ?? "";
  return cachedApiKey;
}

export async function transcribe(pcm: Uint8Array, sampleRate: number, language: string): Promise<string> {
  if (!hasSpeech(pcm)) return "";
  const key = await apiKey();
  if (!key) throw new Error("Speech service unavailable");
  const form = new FormData();
  form.append("file", pcm16ToWav(pcm, sampleRate), "speech.wav");
  form.append("model", "gpt-4o-transcribe");
  form.append("response_format", "json");
  if (language) form.append("language", language);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Transcription failed (${response.status})`);
  const data = (await response.json()) as { text?: string };
  return (data.text ?? "").trim();
}

