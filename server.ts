import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MsEdgeTTS } from "edge-tts-node";
import axios from "axios";

// Robust fallback list of premium voices if MsEdgeTTS getVoices() fails or is slow
const FAILBACK_VOICES = [
  {
    Name: "Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)",
    ShortName: "zh-CN-XiaoxiaoNeural",
    Gender: "Female",
    Locale: "zh-CN",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (zh-CN, YunxiNeural)",
    ShortName: "zh-CN-YunxiNeural",
    Gender: "Male",
    Locale: "zh-CN",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Yunxi Online (Natural) - Chinese (Mainland)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (zh-CN, YunjianNeural)",
    ShortName: "zh-CN-YunjianNeural",
    Gender: "Male",
    Locale: "zh-CN",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Yunjian Online (Natural) - Chinese (Mainland)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (zh-CN, YunyangNeural)",
    ShortName: "zh-CN-YunyangNeural",
    Gender: "Male",
    Locale: "zh-CN",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Yunyang Online (Natural) - Chinese (Mainland)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoyiNeural)",
    ShortName: "zh-CN-XiaoyiNeural",
    Gender: "Female",
    Locale: "zh-CN",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Xiaoyi Online (Natural) - Chinese (Mainland)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxuanNeural)",
    ShortName: "zh-CN-XiaoxuanNeural",
    Gender: "Female",
    Locale: "zh-CN",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Xiaoxuan Online (Natural) - Chinese (Mainland)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (zh-HK, HiuMaanNeural)",
    ShortName: "zh-HK-HiuMaanNeural",
    Gender: "Female",
    Locale: "zh-HK",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft HiuMaan Online (Natural) - Chinese (Hong Kong)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (zh-TW, HsiaoChenNeural)",
    ShortName: "zh-TW-HsiaoChenNeural",
    Gender: "Female",
    Locale: "zh-TW",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)",
    ShortName: "en-US-JennyNeural",
    Gender: "Female",
    Locale: "en-US",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Jenny Online (Natural) - English (United States)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (en-US, GuyNeural)",
    ShortName: "en-US-GuyNeural",
    Gender: "Male",
    Locale: "en-US",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Guy Online (Natural) - English (United States)",
    Status: "GA"
  },
  {
    Name: "Microsoft Server Speech Text to Speech Voice (ja-JP, NanamiNeural)",
    ShortName: "ja-JP-NanamiNeural",
    Gender: "Female",
    Locale: "ja-JP",
    SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
    FriendlyName: "Microsoft Nanami Online (Natural) - Japanese (Japan)",
    Status: "GA"
  }
];

import { GoogleGenAI } from "@google/genai";

function encodeWAV(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const header = Buffer.alloc(44);
  const dataLength = pcmBuffer.length;
  const fileLength = dataLength + 36;
  
  header.write("RIFF", 0);
  header.writeUInt32LE(fileLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  
  return Buffer.concat([header, pcmBuffer]);
}

function mapVoiceToGeminiTTSVoice(voiceName: string): string {
  if (!voiceName) return "Kore";
  const vn = voiceName.toLowerCase();
  
  // Male voices
  if (vn.includes("yunxi") || vn.includes("guy")) {
    return "Fenrir"; // Resonant male
  }
  if (vn.includes("yunjian")) {
    return "Charon"; // Deep/mature male
  }
  if (vn.includes("yunyang")) {
    return "Zephyr"; // Airy/clear male or neutral
  }
  
  // Female voices / others
  if (vn.includes("xiaoxiao") || vn.includes("hiumaan") || vn.includes("hsiaochen") || vn.includes("jenny")) {
    return "Kore"; // Pleasant female
  }
  if (vn.includes("xiaoyi") || vn.includes("nanami")) {
    return "Zephyr"; // Airy/clear female
  }
  if (vn.includes("xiaoxuan")) {
    return "Puck"; // Warm/playful female
  }
  
  // Default general fallbacks
  if (vn.includes("male") || vn.includes("guy") || vn.includes("yun")) {
    return "Fenrir";
  }
  return "Kore"; // Default female voice
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required (please add it in AI Studio Secrets panel)");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}

async function getGeminiTTSBuffer(text: string, voiceName: string): Promise<Buffer> {
  const ai = getGeminiClient();
  const selectedGeminiVoice = mapVoiceToGeminiTTSVoice(voiceName);

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [
      {
        parts: [
          {
            text: `Read the following text word-for-word, beautifully and naturally. Do not add any introductory or exit speech, and do not add any commentary. Just say the text itself:\n\n${text}`
          }
        ]
      }
    ],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: selectedGeminiVoice }
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Gemini TTS synthesis returned empty audio data.");
  }

  const pcmBuffer = Buffer.from(base64Audio, "base64");
  return encodeWAV(pcmBuffer, 24000);
}

function mapVoiceToGoogleLang(voiceName: string): string {
  if (!voiceName) return "zh-CN";
  if (voiceName.startsWith("zh-CN") || voiceName.includes("Xiaoxiao") || voiceName.includes("Yunxi") || voiceName.includes("Yunjian") || voiceName.includes("Yunyang") || voiceName.includes("Xiaoyi") || voiceName.includes("Xiaoxuan")) {
    return "zh-CN";
  }
  if (voiceName.startsWith("zh-HK") || voiceName.includes("HiuMaan")) {
    return "zh-HK";
  }
  if (voiceName.startsWith("zh-TW") || voiceName.includes("HsiaoChen")) {
    return "zh-TW";
  }
  if (voiceName.startsWith("ja-JP") || voiceName.includes("Nanami")) {
    return "ja";
  }
  if (voiceName.startsWith("en-") || voiceName.includes("Jenny") || voiceName.includes("Guy")) {
    return "en";
  }
  
  const match = voiceName.match(/([a-z]{2})-[A-Z]{2}/);
  if (match) {
    return match[1];
  }
  return "zh-CN";
}

async function getGoogleTTSBuffer(text: string, lang: string): Promise<Buffer> {
  // Split long texts by standard sentence structures or punctuation (max length is 180 chars for Google Translate TTS API limit)
  const sentences: string[] = [];
  const chars = text.split("");
  let currentSentence = "";
  
  for (const c of chars) {
    currentSentence += c;
    if (currentSentence.length >= 180 || "。！\n\r!?？;；".includes(c)) {
      if (currentSentence.trim()) {
        sentences.push(currentSentence.trim());
      }
      currentSentence = "";
    }
  }
  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }

  const buffers: Buffer[] = [];
  for (const sentence of sentences) {
    if (!sentence) continue;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(sentence)}`;
    try {
      const response = await axios({
        method: "get",
        url: url,
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 8000
      });
      buffers.push(Buffer.from(response.data));
    } catch (e) {
      console.error(`Google fallback synthesis failed for segment: "${sentence}"`, e);
    }
  }

  if (buffers.length === 0) {
    throw new Error("谷歌线上翻译辅助引擎未返回任何有效音频数据");
  }

  return Buffer.concat(buffers);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API Route: Get Microsoft Edge Online Voices
  app.get("/api/voices", async (req: Request, res: Response) => {
    try {
      const tts = new MsEdgeTTS({ enableLogger: false });
      const voices = await tts.getVoices();
      
      // Filter out voices that are not popular or are redundant, focusing on Chinese/HK/Taiwan/English/Japanese
      const targetedLocales = ["zh-CN", "zh-HK", "zh-TW", "en-US", "en-GB", "ja-JP"];
      const filtered = voices.filter(v => targetedLocales.some(locale => v.Locale.startsWith(locale)));
      
      if (filtered.length > 0) {
        res.json(filtered);
      } else {
        res.json(FAILBACK_VOICES);
      }
    } catch (err) {
      console.error("Failed to load voices dynamically, returning premium fallback list:", err);
      res.json(FAILBACK_VOICES);
    }
  });

  // API Route: Synthesize Text to Audio Stream
  app.get("/api/tts", async (req: Request, res: Response) => {
    const { text, voice, rate, pitch, volume } = req.query;

    if (!text) {
      res.status(400).send("Parameter 'text' is required");
      return;
    }

    const selectedVoice = (voice as string) || "zh-CN-XiaoxiaoNeural";

    // Transform sliders input directly into Microsoft Edge SSML markup compliant percentages
    const rateVal = parseFloat((rate as string) || "1.0");
    const pitchVal = parseFloat((pitch as string) || "1.0");
    const volumeVal = parseFloat((volume as string) || "1.0");

    // Rate: float 1.0 is default. Map rateVal e.g. 1.25 -> +25%, 0.75 -> -25%
    const relativeRatePercent = Math.round((rateVal - 1) * 100);
    const finalRate = relativeRatePercent >= 0 ? `+${relativeRatePercent}%` : `${relativeRatePercent}%`;

    // Pitch: float 1.0 is default. Map pitchVal e.g. 1.1 -> +10%, 0.9 -> -10%
    const relativePitchPercent = Math.round((pitchVal - 1) * 100);
    const finalPitch = relativePitchPercent >= 0 ? `+${relativePitchPercent}%` : `${relativePitchPercent}%`;

    // Volume: float from 0 to 1. Map to absolute percentage e.g. 1.0 -> 100%, 0.5 -> 50%
    const finalVolume = `${Math.round(volumeVal * 100)}%`;

    try {
      const tts = new MsEdgeTTS({ enableLogger: false });
      // Standard output format selection
      const format = MsEdgeTTS.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
      
      await tts.setMetadata(selectedVoice, format);
      
      const readableStream = tts.toStream(text as string, {
        pitch: finalPitch,
        rate: finalRate,
        volume: finalVolume
      });

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400"); // cache synthesized output for performance

      readableStream.on("error", (streamErr) => {
        console.error("Error inside audio TTS response piped stream:", streamErr);
        if (!res.headersSent) {
          res.status(500).send("Audio streaming pipeline error");
        }
      });

      readableStream.pipe(res);
    } catch (err) {
      console.error("Standard MsEdgeTTS synthesising failed (network/cloud environment block); triggering Google Gemini TTS fallback...");
      try {
        const audioBuffer = await getGeminiTTSBuffer(text as string, selectedVoice);

        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.end(audioBuffer);
      } catch (geminiErr) {
        console.warn("Gemini TTS synthesis fallback also failed or is unconfigured. Falling back to Google Translate:", geminiErr);
        try {
          const mappedLang = mapVoiceToGoogleLang(selectedVoice);
          const audioBuffer = await getGoogleTTSBuffer(text as string, mappedLang);

          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(audioBuffer);
        } catch (fallbackErr) {
          console.error("All text-to-speech engines failed:", fallbackErr);
          if (!res.headersSent) {
            res.status(500).send(`All standard, Gemini neural, and auxiliary translation fallback syntheses failed: ${(fallbackErr as Error).message}`);
          }
        }
      }
    }
  });

  // Vite middleware integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched on http://localhost:${PORT}`);
  });
}

startServer();
