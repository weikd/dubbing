import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  Copy, 
  Check, 
  Trash2, 
  Download, 
  Languages, 
  Sliders, 
  BookOpen, 
  Volume2, 
  HelpCircle,
  Clock,
  AudioLines,
  QrCode,
  VolumeX,
  Info,
  Sparkles,
  RefreshCw,
  Search,
  User,
  ExternalLink
} from "lucide-react";

interface EdgeVoice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  SuggestedCodec: string;
  FriendlyName: string;
  Status: string;
  CustomDesc?: string; // friendly custom description
}

interface LocalVoiceWrap {
  voice: SpeechSynthesisVoice;
  index: number;
}

interface HistoryItem {
  id: string;
  text: string;
  engine: "edge" | "local";
  voiceName: string;
  voiceShortName?: string;
  langName: string;
  date: string;
  rate: number;
  pitch: number;
  volume: number;
  playUrl?: string; // Relative or absolute URL to stream/download
}

// Curation of highly customized online voices with evocative friendly narrative labels
const CORE_PREMIUM_DESCRIPTIONS: Record<string, string> = {
  "zh-CN-XiaoxiaoNeural": "【晓晓 · 女声】 活泼温暖，富情感起伏。极适合言情小说、情感散文及小说女主配音。",
  "zh-CN-YunxiNeural": "【云希 · 男声】 阳光极速，温柔并蓄。推文中用得最多的小说男主、游戏解说、故事旁白音色。",
  "zh-CN-YunjianNeural": "【云健 · 男声】 磁性沉稳，沉着端庄。适合仙侠武侠、玄幻修仙小说叙事、旁白说书演绎。",
  "zh-CN-YunyangNeural": "【云扬 · 男声】 专业宏亮，正统播音。最适合科普、商业宣传解说、企业纪录片配音。",
  "zh-CN-XiaoyiNeural": "//zh-CN-XiaoyiNeural", // fallback placeholder to avoid duplicate match if needed, but easier is simple direct keys
  "zh-CN-XiaoxuanNeural": "【晓轩 · 女声】 情绪起伏跌宕，极具戏剧张力。极佳的动漫搞怪、广播剧冲突情节配音人。",
  "zh-HK-HiuMaanNeural": "【晓佳 · 粤语】 标准正宗香港腔，利落清脆。适合本地生活化短视频粤语配音旁白。",
  "zh-TW-HsiaoChenNeural": "【晓臻 · 台湾】 温柔甜美，自带治愈感台腔。言情小说配音、二次元ASMR、广播推荐好音符。",
  "en-US-JennyNeural": "【Jenny · 英文】 国际化标准美语女声，自然流利、大方自信。适合外语少儿阅读及商务解说。",
  "en-US-GuyNeural": "【Guy · 英文】 优雅大气的精英派男声，低音醇厚有磁性。小说英文段落、高端数码解说必备。",
  "ja-JP-NanamiNeural": "【七海 · 日文】 萌系婉转，纯正和风。自媒体动漫短视频、日语听力及日常教学必备伴奏。"
};

CORE_PREMIUM_DESCRIPTIONS["zh-CN-XiaoyiNeural"] = "【晓伊 · 女声】 甜美温润，邻家女孩办自然。适合温馨短文、深夜树洞、生活好物广告。";

const SAMPLE_TEXTS = [
  {
    name: "🍂 温暖小说散文",
    text: "听，风吹过远山森林的声音，那是大自然最深挚的呼吸。在这充满喧嚣的世界里，慢下脚步，愿这缕清风，拂去你心中的焦躁与不安。"
  },
  {
    name: "📖 仙侠大作主角",
    text: "落叶纷飞，溪边的柳树在暮色中摇曳。那一晚，她慢慢抬起头，望着远方的重山与归鸟，冷声笑道：‘这一剑，便当我还清了你们的养育之恩。’"
  },
  {
    name: "🛒 舒爽小说推文广告",
    text: "欢迎来到漫步推文空间。在这里，你可以把生活过得像一首曼妙抒情诗，尽情品味天然原产薰衣草香氛带来的治愈呼吸。今日订购，立享静谧时刻。"
  },
  {
    name: "🇬🇧 English Narration",
    text: "Welcome to the Natural Tones Voiceover Studio. Experience beauty of neural voice cloning with fine control of speech speed and vocal pitch."
  }
];

export default function App() {
  const [engine, setEngine] = useState<"edge" | "local">("edge");
  const [script, setScript] = useState(SAMPLE_TEXTS[0].text);

  // Prosody states
  const [rate, setRate] = useState(1.0); // Speed: 0.5 to 2.0 (1.0 default)
  const [pitch, setPitch] = useState(1.0); // Pitch: 0.5 to 1.5 (1.0 default)
  const [volume, setVolume] = useState(1.0); // Volume: 0.0 to 1.0 (1.0 default)

  // Edge voices states
  const [edgeVoices, setEdgeVoices] = useState<EdgeVoice[]>([]);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number>(0);
  const [searchEdgeQuery, setSearchEdgeQuery] = useState("");
  const [edgeLocaleFilter, setEdgeLocaleFilter] = useState("zh-CN"); // Default focus is Chinese Mandarine
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

  // Local device SpeechSynthesis voices states
  const [localVoices, setLocalVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedLocalIndex, setSelectedLocalIndex] = useState<number>(0);
  const [searchLocalQuery, setSearchLocalQuery] = useState("");
  const [localLangFilter, setLocalLangFilter] = useState("All");

  // Player and historical playlist states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Auxiliary UI States
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [shareQrVisible, setShareQrVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Fetch Voice catalog on launch
  useEffect(() => {
    fetchEdgeVoices();
    loadLocalSpeechSynthesisVoices();

    const savedHistory = localStorage.getItem("natural_studio_client_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        localStorage.removeItem("natural_studio_client_history");
      }
    }

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Fetch Microsoft Edge Online Voices from API
  const fetchEdgeVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const response = await fetch("/api/voices");
      if (response.ok) {
        const list: EdgeVoice[] = await response.json();
        const processed = list.map(v => ({
          ...v,
          CustomDesc: CORE_PREMIUM_DESCRIPTIONS[v.ShortName] || `【${v.Gender === "Female" ? "女声" : "男声"} · 朗读】 ${v.FriendlyName.replace("Microsoft ", "").replace("Online (Natural)", "")}`
        }));
        setEdgeVoices(processed);
        
        // Pick Xiaoxiao as the initial voice
        const xiaoxiaoIdx = processed.findIndex(v => v.ShortName === "zh-CN-XiaoxiaoNeural");
        if (xiaoxiaoIdx !== -1) {
          setSelectedEdgeIndex(xiaoxiaoIdx);
        } else if (processed.length > 0) {
          setSelectedEdgeIndex(0);
        }
      }
    } catch (err) {
      console.error("Failed to load backend edge voices:", err);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  // Load standard system offline voices
  const loadLocalSpeechSynthesisVoices = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const updateList = () => {
        const voices = window.speechSynthesis.getVoices();
        setLocalVoices(voices);
        const zhIndex = voices.findIndex(v => v.lang.startsWith("zh") || v.lang.startsWith("ZH"));
        if (zhIndex !== -1) {
          setSelectedLocalIndex(zhIndex);
        } else if (voices.length > 0) {
          setSelectedLocalIndex(0);
        }
      };

      updateList();
      window.speechSynthesis.onvoiceschanged = updateList;
    }
  };

  // Canvas Wave Animation synchronization
  useEffect(() => {
    if (isPlaying) {
      startVisualizer();
    } else {
      stopVisualizer();
      drawStaticVisualizer();
    }
  }, [isPlaying]);

  const startVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;
    const renderWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2.5;

      const lines = [
        { color: "rgba(90, 89, 75, 0.8)", amp: 14, freq: 0.04, speed: 0.15 },
        { color: "rgba(180, 178, 150, 0.61)", amp: 9, freq: 0.07, speed: 0.22 },
        { color: "rgba(90, 89, 75, 0.25)", amp: 18, freq: 0.02, speed: 0.08 }
      ];

      lines.forEach((l) => {
        ctx.beginPath();
        ctx.strokeStyle = l.color;
        for (let x = 0; x < canvas.width; x++) {
          const y = canvas.height / 2 + Math.sin(x * l.freq + phase) * l.amp * (Math.sin(phase * l.speed) * 0.4 + 0.6);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      phase += 0.12;
      animationRef.current = requestAnimationFrame(renderWave);
    };

    renderWave();
  };

  const stopVisualizer = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const drawStaticVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.strokeStyle = "rgba(90, 89, 75, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  // Filter lists
  const filteredEdgeVoices = edgeVoices.filter(v => {
    const query = searchEdgeQuery.toLowerCase();
    const matchesSearch = v.FriendlyName.toLowerCase().includes(query) || v.ShortName.toLowerCase().includes(query);
    const matchesLocale = edgeLocaleFilter === "All" || v.Locale.startsWith(edgeLocaleFilter);
    return matchesSearch && matchesLocale;
  });

  const uniqueLocalLangs = Array.from(new Set(localVoices.map(v => v.lang)));
  const filteredLocalVoices: LocalVoiceWrap[] = localVoices
    .map((v, index) => ({ voice: v, index }))
    .filter(w => {
      const query = searchLocalQuery.toLowerCase();
      const matchesSearch = w.voice.name.toLowerCase().includes(query) || w.voice.lang.toLowerCase().includes(query);
      const matchesLang = localLangFilter === "All" || w.voice.lang === localLangFilter;
      return matchesSearch && matchesLang;
    });

  // Synthesize Click Trigger
  const handleVocalSpeak = () => {
    if (!script.trim()) {
      showToast("请输入需要合成人声的文本！");
      return;
    }

    if (engine === "edge") {
      // 0. Clean and initiate player
      if (audioRef.current) {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        audioRef.current.pause();

        const activeVoice = filteredEdgeVoices[selectedEdgeIndex] || edgeVoices[selectedEdgeIndex] || edgeVoices[0];
        if (!activeVoice) {
          showToast("暂无可用的微软 Edge 音色包，请检查网络后重试。");
          return;
        }

        const params = new URLSearchParams({
          text: script,
          voice: activeVoice.ShortName,
          rate: rate.toString(),
          pitch: pitch.toString(),
          volume: volume.toString()
        });

        const finalTtsUrl = `/api/tts?${params.toString()}`;
        
        audioRef.current.src = finalTtsUrl;
        audioRef.current.volume = volume;
        audioRef.current.play().catch(err => {
          console.error("Failed to play edge speech stream:", err);
          showToast("声音生成失败，请检查浏览器连接，或缩短文本重试！");
        });

        // Save history item locally
        const newHist: HistoryItem = {
          id: "edge_" + Date.now(),
          text: script,
          engine: "edge",
          voiceName: activeVoice.FriendlyName.replace("Microsoft ", "").replace("Online (Natural)", ""),
          voiceShortName: activeVoice.ShortName,
          langName: `${activeVoice.Locale} (在线神经云)`,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
          rate,
          pitch,
          volume,
          playUrl: finalTtsUrl
        };

        setCurrentPlaylistId(newHist.id);
        saveHistory(newHist);
        showToast(`已请求“${activeVoice.ShortName}”多媒体转换流...`);
      }
    } else {
      // Offline local SpeechSynthesisUtterance
      if (!window.speechSynthesis) {
        showToast("您的浏览器对本地原生语音 (Web Speech API) 暂不兼容！");
        return;
      }
      window.speechSynthesis.cancel();
      audioRef.current?.pause();

      const activeVoice = localVoices[selectedLocalIndex];
      const selectedName = activeVoice ? activeVoice.name : "System Standard";
      const selectedLang = activeVoice ? activeVoice.lang : "zh-CN";

      const utterance = new SpeechSynthesisUtterance(script);
      if (activeVoice) {
        utterance.voice = activeVoice;
      }
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      utterance.onstart = () => {
        setIsPlaying(true);
      };
      utterance.onend = () => {
        setIsPlaying(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };

      const newHist: HistoryItem = {
        id: "local_" + Date.now(),
        text: script,
        engine: "local",
        voiceName: selectedName,
        langName: `${selectedLang} (本地设备离线)`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        rate,
        pitch,
        volume
      };

      saveHistory(newHist);
      window.speechSynthesis.speak(utterance);
    }
  };

  const saveHistory = (item: HistoryItem) => {
    const updated = [item, ...history.slice(0, 24)];
    setHistory(updated);
    localStorage.setItem("natural_studio_client_history", JSON.stringify(updated));
  };

  const playHistoryRecord = (item: HistoryItem) => {
    if (item.engine === "local") {
      if (!window.speechSynthesis) {
        showToast("设备本地暂不兼容声音合成！");
        return;
      }
      window.speechSynthesis.cancel();
      audioRef.current?.pause();

      const utterance = new SpeechSynthesisUtterance(item.text);
      const match = localVoices.find(v => v.name === item.voiceName);
      if (match) {
        utterance.voice = match;
      }
      utterance.rate = item.rate;
      utterance.pitch = item.pitch;
      utterance.volume = item.volume;

      utterance.onstart = () => {
        setIsPlaying(true);
        setCurrentPlaylistId(item.id);
      };
      utterance.onend = () => {
        setIsPlaying(false);
        setCurrentPlaylistId(null);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setCurrentPlaylistId(null);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      if (audioRef.current && item.playUrl) {
        window.speechSynthesis?.cancel();
        if (currentPlaylistId === item.id && isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.src = item.playUrl;
          audioRef.current.volume = item.volume;
          audioRef.current.play().catch(e => console.error("Playback error", e));
          setCurrentPlaylistId(item.id);
        }
      }
    }
  };

  const deleteHistoryRecord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem("natural_studio_client_history", JSON.stringify(updated));
    if (currentPlaylistId === id) {
      stopGlobalPlayback();
    }
  };

  const toggleGlobalPlayPause = () => {
    if (engine === "local") {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        if (isPlaying) {
          window.speechSynthesis.pause();
          setIsPlaying(false);
        } else {
          window.speechSynthesis.resume();
          setIsPlaying(true);
        }
      }
    } else {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play().catch(e => console.warn(e));
          setIsPlaying(true);
        }
      }
    }
  };

  const stopGlobalPlayback = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentPlaylistId(null);
  };

  const copyAppUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      showToast("配音面板共享链接复制成功！");
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const copyScriptText = () => {
    navigator.clipboard.writeText(script).then(() => {
      setCopiedScript(true);
      showToast("配音文本已复制到剪贴板！");
      setTimeout(() => setCopiedScript(false), 2000);
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#4a473f] antialiased pb-20 font-sans">
      
      {/* Toast notifications */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#5A5A40] text-[#f7f5f0] px-5 py-2.5 rounded-lg text-xs font-semibold shadow-xl flex items-center gap-2 border border-[#eae6df]/15">
          <Sparkles className="h-4 w-4 fill-current text-[#eae6df]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Elegant Swiss Header */}
      <header className="border-b border-[#5A5A40]/15 bg-[#fbfaf8] py-4.5 px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[#5A5A40] text-[#f7f5f0] shadow-sm">
              <AudioLines className="h-5.5 w-5.5" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold tracking-tight text-[#4a473f] flex items-center gap-1.5 flex-wrap">
                神经网络声音朗读坊 <span className="font-sans text-[11px] font-bold text-[#5A5A40] bg-[#5A5A40]/12 px-2.5 py-0.5 rounded-full">高保真 Edge Neural TTS</span>
              </h1>
              <p className="text-[11px] text-[#4a473f]/65 mt-0.5">高真实感自然人声配音。支持晓晓、云希等多语种标准音频流，自主调节语速与音调。</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={copyAppUrl}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#5A5A40]/10 text-[#5A5A40] hover:bg-[#5A5A40] hover:text-[#f7f5f0] transition-colors cursor-pointer active:scale-95 shadow-2xs"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copiedLink ? "已复制" : "复制网站链接"}</span>
            </button>
            <button
              onClick={() => setShareQrVisible(!shareQrVisible)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#4a473f]/10 text-[#4a473f] hover:bg-[#4a473f] hover:text-[#f7f5f0] transition-colors cursor-pointer active:scale-95 shadow-2xs"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>手机同步听</span>
            </button>
          </div>
        </div>
      </header>

      {/* QR Code section */}
      {shareQrVisible && (
        <div className="bg-[#eae6df]/75 border-b border-[#5A5A40]/12 py-5.5 flex justify-center">
          <div className="max-w-md bg-[#fbfaf8] border border-[#5A5A40]/15 p-5 rounded-xl shadow-md flex flex-col sm:flex-row items-center gap-5">
            <div className="flex-shrink-0">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.href)}&color=5A-5A-40&bgcolor=fbfaf8`}
                alt="Scan QR" 
                referrerPolicy="no-referrer"
                className="w-32 h-32 rounded-lg border border-[#5A5A40]/15 p-1 bg-white shadow-2xs object-contain"
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <span className="inline-flex bg-[#5A5A40]/15 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-[#5A5A40] mb-1.5">
                移动端音频互动
              </span>
              <h3 className="text-sm font-bold font-serif text-[#4a473f] mb-1">可在手机或平板完美使用</h3>
              <p className="text-xs text-[#4a473f]/75 leading-relaxed">
                无需任何配置。使用手机扫描此二维码即可开启手机专属音响朗读，支持在后台流畅发声，不占额外本地缓存。
              </p>
              <button
                onClick={() => setShareQrVisible(false)}
                className="mt-2.5 text-xs text-[#5A5A40] font-bold underline hover:no-underline cursor-pointer"
              >
                收起二维码
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6.5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          
          {/* Left panel is script entry & voice settings */}
          <section className="lg:col-span-7 flex flex-col gap-6.5">
            
            {/* Box 1: Text Script Entry */}
            <div className="bg-[#fbfaf8] rounded-xl border border-[#5A5A40]/12 p-5.5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#5A5A40]/10 pb-3">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-[#5A5A40] fill-[#5A5A40]" />
                  <h2 className="font-serif font-bold text-[14.5px] text-[#4a473f]">配音文案稿件</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={copyScriptText}
                    className="text-xs text-[#4a473f]/80 bg-[#4a473f]/5 hover:bg-[#4a473f]/10 px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer font-semibold"
                  >
                    {copiedScript ? <Check className="h-3 w-3 text-emerald-800" /> : <Copy className="h-3 w-3" />}
                    <span>复制文案</span>
                  </button>
                  <button 
                    onClick={() => setScript("")}
                    className="text-xs text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md font-semibold cursor-pointer"
                  >
                    极速清空
                  </button>
                </div>
              </div>

              {/* Sample loader */}
              <div className="flex items-center gap-2 flex-wrap pb-1.5">
                <span className="text-[11px] font-semibold text-[#4a473f]/50 mr-1 flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5 text-[#5A5A40]" /> 快速载入示范文本:
                </span>
                {SAMPLE_TEXTS.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setScript(tpl.text)}
                    className="text-[10.5px] px-2.5 py-1 rounded-full border border-[#5A5A40]/15 bg-[#fbfaf8] hover:bg-[#5A5A40]/10 hover:border-[#5A5A40]/35 transition-all text-[#4a473f] font-medium cursor-pointer"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>

              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="在这输入要配音转换的内容..."
                className="w-full h-42 p-4 rounded-lg bg-[#faf9f4] border border-[#5A5A40]/20 focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] outline-none text-[#4a473f] text-xs sm:text-sm placeholder-[#4a473f]/40 leading-relaxed resize-none font-sans shadow-inner"
              />
              <div className="flex justify-end text-[10px] text-[#4a473f]/50 font-mono">
                共计 {script.length} 个字符
              </div>
            </div>

            {/* Box 2: Selector Engine and voices */}
            <div className="bg-[#fbfaf8] rounded-xl border border-[#5A5A40]/12 p-5.5 shadow-sm flex flex-col gap-4.5">
              
              {/* Tabs selector */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[#5A5A40]/10 pb-3.5 gap-3">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-[#5A5A40]" />
                  <h2 className="font-serif font-bold text-[14.5px] text-[#4a473f]">配音引擎与发声人选择</h2>
                </div>

                <div className="bg-[#eae6df] p-1 rounded-lg flex items-center shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      setEngine("edge");
                      stopGlobalPlayback();
                    }}
                    className={`text-xs px-3.5 py-1 rounded-md font-bold cursor-pointer transition-all ${
                      engine === "edge" 
                        ? "bg-[#5A5A40] text-[#f7f5f0] shadow-sm" 
                        : "text-[#4a473f]/75 hover:text-[#4a473f]"
                    }`}
                  >
                    微软 Edge 神经网络
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEngine("local");
                      stopGlobalPlayback();
                    }}
                    className={`text-xs px-3.5 py-1 rounded-md font-bold cursor-pointer transition-all ${
                      engine === "local" 
                        ? "bg-[#5A5A40] text-[#f7f5f0] shadow-sm" 
                        : "text-[#4a473f]/75 hover:text-[#4a473f]"
                    }`}
                  >
                    本机设备原生发声
                  </button>
                </div>
              </div>

              {/* Dynamic selection panel depending on active TTS engine */}
              {engine === "edge" ? (
                <div className="flex flex-col gap-3">
                  <div className="bg-[#5A5A40]/5 rounded-lg p-3 text-xs leading-relaxed flex gap-2 border border-[#5A5A40]/10">
                    <Info className="h-4 w-4 text-[#5A5A40] flex-shrink-0 mt-0.5" />
                    <p className="text-[#4a473f]/85">
                      <strong>神经网络云音色:</strong> 由微软 Read Aloud 服务供电，无收费、无需第三方 API 钥匙。晓晓、云希音质栩栩如生，<strong>可在右侧历史中直接下载高清 MP3 文件保存</strong>。
                    </p>
                  </div>

                  {/* Filter elements */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="搜索 Edge 音色..."
                        value={searchEdgeQuery}
                        onChange={(e) => setSearchEdgeQuery(e.target.value)}
                        className="w-full text-xs bg-[#faf9f4] border border-[#5A5A40]/20 rounded-lg pl-8.5 pr-3 py-2 outline-none focus:border-[#5A5A40] shadow-2xs text-[#4a473f]"
                      />
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#4a473f]/55" />
                    </div>

                    <select
                      value={edgeLocaleFilter}
                      onChange={(e) => {
                        setEdgeLocaleFilter(e.target.value);
                        setSelectedEdgeIndex(0); // Reset index to avoid overflow
                      }}
                      className="text-xs bg-[#faf9f4] border border-[#5A5A40]/20 rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-[#5A5A40] shadow-2xs font-semibold text-[#4a473f]"
                    >
                      <option value="All">所有地区/语种</option>
                      <option value="zh-CN">国语普通话 (Mandarin)</option>
                      <option value="zh-HK">粤语/香港港腔 (Cantonese)</option>
                      <option value="zh-TW">闽南台腔/台湾 (Taiwanese)</option>
                      <option value="en-US">美式英语 (English US)</option>
                      <option value="en-GB">英式英语 (English UK)</option>
                      <option value="ja-JP">日语 (Japanese)</option>
                    </select>
                  </div>

                  {/* Render list of Edge voices */}
                  {isLoadingVoices && edgeVoices.length === 0 ? (
                    <div className="py-12 border border-dashed border-[#5A5A40]/15 rounded-xl text-center flex flex-col items-center justify-center gap-2 bg-[#fbfaf8]">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#5A5A40]" />
                      <span className="text-xs text-[#4a473f]/65">正在连接微软神经发音库，请稍后...</span>
                    </div>
                  ) : (
                    <div className="max-h-62 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[#5A5A40]/10 rounded-lg p-2 bg-[#faf9f4]/50 shadow-inner">
                      {filteredEdgeVoices.map((v, idx) => {
                        const isSelected = selectedEdgeIndex === idx;
                        return (
                          <div
                            key={v.ShortName}
                            onClick={() => setSelectedEdgeIndex(idx)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1.5 ${
                              isSelected
                                ? "border-[#5A5A40] bg-[#5A5A40]/7 shadow-2xs pointer-events-auto"
                                : "border-[#5A5A40]/10 bg-white hover:bg-[#eae6df]/15"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold text-[#4a473f] block truncate">{v.FriendlyName.replace("Microsoft ", "").replace("Online (Natural)", "")}</span>
                                <span className="text-[9px] font-mono bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.2 rounded mt-1 inline-block">{v.ShortName}</span>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold flexitems-center ${
                                v.Gender === "Female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {v.Gender === "Female" ? "女" : "男"}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#4a473f]/75 border-t border-[#5A5A40]/5 pt-1.5 leading-relaxed italic">
                              {CORE_PREMIUM_DESCRIPTIONS[v.ShortName] || `【朗读音色】 微软标准 ${v.Locale} 发音。`}
                            </p>
                          </div>
                        );
                      })}

                      {filteredEdgeVoices.length === 0 && (
                        <div className="col-span-full py-10 text-center text-xs text-[#4a473f]/50">
                          暂无符合当前地区、关键词过滤条件的音色。请更换筛项。
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                /* Native local systems offline fallback voices */
                <div className="flex flex-col gap-3">
                  <div className="bg-[#5A5A40]/5 rounded-lg p-3 text-xs leading-relaxed flex gap-2 border border-[#5A5A40]/10">
                    <Info className="h-4 w-4 text-[#5A5A40] flex-shrink-0 mt-0.5" />
                    <p className="text-[#4a473f]/85">
                      <strong>系统自备原声:</strong> 占用您设备本身的朗读芯片硬件运行，无字数限制、无任何流量损耗，但在绝大多数设备上仅有普通电子机器合成感。无法生成和下载多媒体文件。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="搜索本地人声..."
                        value={searchLocalQuery}
                        onChange={(e) => setSearchLocalQuery(e.target.value)}
                        className="w-full text-xs bg-[#faf9f4] border border-[#5A5A40]/20 rounded-lg pl-8.5 pr-3 py-2 outline-none focus:border-[#5A5A40] shadow-2xs text-[#4a473f]"
                      />
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#4a473f]/55" />
                    </div>

                    <select
                      value={localLangFilter}
                      onChange={(e) => {
                        setLocalLangFilter(e.target.value);
                        setSelectedLocalIndex(0);
                      }}
                      className="text-xs bg-[#faf9f4] border border-[#5A5A40]/20 rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-[#5A5A40] shadow-2xs font-semibold text-[#4a473f]"
                    >
                      <option value="All">本地所有语言 ({uniqueLocalLangs.length}种)</option>
                      {uniqueLocalLangs.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>

                  {localVoices.length === 0 ? (
                    <div className="p-4 border border-dashed border-[#5A5A40]/15 rounded-lg text-center text-xs text-[#4a473f]/60 bg-[#fbfaf8]">
                      正在解析或尚未发现您设备本地自带的发音程序包。
                    </div>
                  ) : (
                    <div className="max-h-62 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[#5A5A40]/10 rounded-lg p-2 bg-[#faf9f4]/50 shadow-inner">
                      {filteredLocalVoices.map((wrap) => {
                        const isSelected = selectedLocalIndex === wrap.index;
                        return (
                          <div
                            key={wrap.index}
                            onClick={() => setSelectedLocalIndex(wrap.index)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 ${
                              isSelected
                                ? "border-[#5A5A40] bg-[#5A5A40]/7 shadow-2xs"
                                : "border-[#5A5A40]/10 bg-white hover:bg-[#eae6df]/15"
                            }`}
                          >
                            <span className="text-xs font-bold text-[#4a473f] truncate block">{wrap.voice.name}</span>
                            <span className="text-[10px] text-[#4a473f]/60 font-mono">{wrap.voice.lang} {wrap.voice.default ? "· 系统默认" : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Box 3: Slider controllers */}
            <div className="bg-[#fbfaf8] rounded-xl border border-[#5A5A40]/12 p-5.5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-[#5A5A40]/10 pb-3">
                <Sliders className="h-4 w-4 text-[#5A5A40]" />
                <h2 className="font-serif font-bold text-[14.5px] text-[#4a473f]">人声细粒度音质参数设置</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                
                {/* Rate speed */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#4a473f]">
                    <span>语调速度 (Rate)</span>
                    <span className="font-mono text-[#5A5A40] font-bold">{rate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.05"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value))}
                    className="w-full accent-[#5A5A40] h-1.5 rounded-lg bg-[#eae6df] cursor-ew-resize outline-none"
                  />
                  <div className="flex justify-between text-[9px] text-[#4a473f]/50 font-medium">
                    <span>极慢 (0.5x)</span>
                    <span>1.0x (常速)</span>
                    <span>超速 (5.0x)</span>
                  </div>
                </div>

                {/* Pitch slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#4a473f]">
                    <span>音调高低 (Pitch)</span>
                    <span className="font-mono text-[#5A5A40] font-bold">{pitch}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full accent-[#5A5A40] h-1.5 rounded-lg bg-[#eae6df] cursor-ew-resize outline-none"
                  />
                  <div className="flex justify-between text-[9px] text-[#4a473f]/50 font-medium">
                    <span>沉闷 (0.5x)</span>
                    <span>1.0x (常调)</span>
                    <span>高昂 (1.5x)</span>
                  </div>
                </div>

                {/* Volume slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#4a473f]">
                    <span>广播音量 (Volume)</span>
                    <span className="font-mono text-[#5A5A40] font-bold">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.0"
                    step="0.1"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#5A5A40] h-1.5 rounded-lg bg-[#eae6df] cursor-ew-resize outline-none"
                  />
                  <div className="flex justify-between text-[9px] text-[#4a473f]/50 font-medium">
                    <span>静音 (0%)</span>
                    <span>100% (最高)</span>
                  </div>
                </div>

              </div>
            </div>

            {/* SYNTHESIZE TRIGGER BUTTON */}
            <button
              onClick={handleVocalSpeak}
              className="w-full py-4 rounded-xl flex items-center justify-center gap-2.5 font-serif font-bold text-[14.5px] text-[#f7f5f0] bg-[#5A5A40] hover:bg-[#4a473f] active:scale-[0.98] cursor-pointer shadow-md border border-[#5A5A40]/10 transition-all font-semibold"
            >
              <Sparkles className="h-4.5 w-4.5 fill-[#f7f5f0]" />
              <span>立即转换并播放 (Synthesize Speech)</span>
            </button>

          </section>

          {/* Right portion is Visualizer, Player & History list */}
          <section className="lg:col-span-5 flex flex-col gap-6.5">
            
            {/* Box 4: Wave visualizer & direct control */}
            <div className="bg-[#fbfaf8] rounded-xl border border-[#5A5A40]/12 p-5.5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-[#5A5A40]/10 pb-3">
                <Volume2 className="h-4 w-4 text-[#5A5A40]" />
                <h2 className="font-serif font-bold text-[14.5px] text-[#4a473f]">音频波动频率</h2>
              </div>

              {/* Sine canvas */}
              <div className="bg-[#faf9f4] rounded-lg border border-[#5A5A40]/10 p-3 h-22 flex items-center justify-center relative overflow-hidden shadow-inner">
                <canvas 
                  ref={canvasRef}
                  width={340}
                  height={80}
                  className="w-full h-full object-cover"
                />

                {!isPlaying && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#faf9f4]/94 gap-1.5">
                    <AudioLines className="h-5 w-5 text-[#5A5A40]/40" />
                    <span className="text-[10px] text-[#4a473f]/55 font-medium">音频未处于活动接收中</span>
                  </div>
                )}
              </div>

              {/* Master player */}
              <div className="flex flex-col gap-3 pt-1">
                <audio
                  ref={audioRef}
                  onPlay={() => {
                    setIsPlaying(true);
                    if (audioRef.current) {
                      audioRef.current.playbackRate = rate;
                    }
                  }}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedMetadata={() => {
                    if (audioRef.current) {
                      audioRef.current.playbackRate = rate;
                    }
                  }}
                  onRateChange={() => {
                    if (audioRef.current && audioRef.current.playbackRate !== rate) {
                      audioRef.current.playbackRate = rate;
                    }
                  }}
                  className="w-full h-8.5 rounded-lg accent-[#5A5A40] outline-none"
                  controls
                />

                <div className="flex items-center justify-center gap-3 mt-1">
                  <button
                    onClick={toggleGlobalPlayPause}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[#5A5A40]/10 text-[#5A5A40] hover:bg-[#5A5A40]/15 active:scale-95 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    <span>{isPlaying ? "暂停配音" : "继续播放"}</span>
                  </button>
                  <button
                    onClick={stopGlobalPlayback}
                    className="py-1.5 px-3 rounded-lg bg-red-100/45 text-red-700 hover:bg-red-100/60 active:scale-95 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <VolumeX className="h-3.5 w-3.5" />
                    <span>全部清空停止</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Box 5: History Records */}
            <div className="bg-[#fbfaf8] rounded-xl border border-[#5A5A40]/12 p-5.5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#5A5A40]/10 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#5A5A40]" />
                  <h2 className="font-serif font-bold text-[14.5px] text-[#4a473f]">历史生成记录 (下载 MP3)</h2>
                </div>
                <span className="text-[10px] text-[#4a473f]/50 font-mono font-bold bg-[#4a473f]/10 px-2.5 py-0.5 rounded-full">
                  已缓存最多25条
                </span>
              </div>

              {/* History list */}
              <div className="flex flex-col gap-2.5 max-h-76 overflow-y-auto pr-1">
                {history.map((item) => {
                  const isCurrent = currentPlaylistId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => playHistoryRecord(item)}
                      className={`group p-3 rounded-lg border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                        isCurrent 
                          ? "border-[#5A5A40] bg-[#5A5A40]/5 shadow-2xs"
                          : "border-[#5A5A40]/10 bg-white hover:bg-[#eae6df]/15"
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2.5">
                        
                        <div className={`h-7.5 w-7.5 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                          isCurrent 
                            ? "bg-[#5A5A40] text-[#f7f5f0]" 
                            : "bg-[#4a473f]/10 text-[#4a473f] group-hover:bg-[#5A5A40] group-hover:text-white"
                        }`}>
                          {isCurrent && isPlaying ? (
                            <Pause className="h-3 w-3 animate-pulse" />
                          ) : (
                            <Play className="h-3 w-3 fill-current" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#4a473f] truncate">
                            {item.text}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-[9.5px] text-[#4a473f]/65 flex-wrap">
                            <span className="font-semibold bg-[#4a473f]/10 px-1 py-0.2 rounded-sm text-[8.5px] uppercase">
                              {item.engine === "edge" ? "Edge神经网络" : "设备原生"}
                            </span>
                            <span className="truncate">{item.voiceName}</span>
                            <span>•</span>
                            <span className="font-mono">{item.date}</span>
                          </div>
                        </div>

                      </div>

                      {/* Download element */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {item.playUrl ? (
                          <a
                            href={item.playUrl}
                            download={`neural_voice_${item.id}.mp3`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 rounded-md text-[#4a473f]/80 hover:bg-[#4a473f]/10 flex items-center justify-center transition-all bg-[#eae6df]/35 shadow-3xs"
                            title="保存到物理媒介 (MP3 音频文件下载)"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <button
                            onClick={() => showToast("设备自备原生人声无法离线下载。请切换至‘Edge神经网络’发声。”")}
                            className="h-7 w-7 rounded-md text-[#4a473f]/25 cursor-help flex items-center justify-center transition-all"
                            title="本地自生不支持在线下载"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => deleteHistoryRecord(item.id, e)}
                          className="h-7 w-7 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50/70 flex items-center justify-center transition-all active:scale-95"
                          title="删除记录"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                    </div>
                  );
                })}

                {history.length === 0 && (
                  <div className="py-12 border border-dashed border-[#5A5A40]/15 rounded-xl text-center flex flex-col items-center justify-center gap-2 bg-[#fbfaf8]">
                    <AudioLines className="h-7 w-7 text-[#5A5A40]/25" />
                    <span className="text-xs text-[#4a473f]/60 font-semibold">生成记录为空</span>
                    <span className="text-[10px] text-[#4a473f]/50 px-5">
                      点击左侧 “立即转换并播放” 按钮开始配音您的第一篇大作吧！
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* FAQ Helper block */}
            <div className="bg-[#4a473f]/5 rounded-xl border border-[#5A5A40]/10 p-5 shadow-sm flex flex-col gap-3">
              <h4 className="text-xs font-bold text-[#4a473f] flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-[#5A5A40]" /> 神经配音音像下载指南
              </h4>
              <ul className="text-[10.5px] text-[#4a473f]/80 flex flex-col gap-2 list-disc pl-4.5 leading-relaxed">
                <li><strong className="text-[#5A5A40]">如何离线存盘 MP3 文件？</strong> 切换到<strong>“微软 Edge 神经网络”</strong>引擎，点击朗读，在新加的历史记录上点击 <Download className="inline h-3 w-3" /> 按钮即可直接下载 24kHz 高保真 MP3。</li>
                <li><strong className="text-[#5A5A40]">语速 Rate 调节细节:</strong> 范围从 0.5x 到 5.0x。我们内部将它们微调映射为微软 Azure 的 prosody 相对偏移百分比，高精、非跳级、无卡顿段落。</li>
                <li><strong className="text-[#5A5A40]">手机上怎么下载到系统库？</strong> 扫码使用后，在生成的条目长按或轻点下载按钮另存为，或点击分享至微信转发直接共享。</li>
              </ul>
            </div>

          </section>

        </div>
      </main>

      <footer className="mt-14 text-center text-[10px] text-[#4a473f]/40 font-mono flex flex-col items-center justify-center gap-1 pb-4">
        <span>© 2026 Natural Neural Tones Recording Studio. No keys required.</span>
        <span>A completely free audio deck configured with premium Microsoft Edge Neural speech layers.</span>
      </footer>

    </div>
  );
}
