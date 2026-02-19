import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  setDoc,
  updateDoc,
  increment,
  query,
  orderBy,
  limit,
  deleteDoc,
  getDoc,
  where
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { Send, Settings, Smartphone, Monitor, Heart, Sparkles, BrainCircuit, Download, CheckCircle2, UserCircle, MessageSquare, X, Trash2, Sliders, AlertCircle } from 'lucide-react';

/**
 * [환경 변수 안전 로딩 및 컴파일 오류 방지]
 * es2015 타겟 환경에서 import.meta 참조 시 발생하는 오류를 방지하기 위해 
 * 런타임 체크 및 안전한 접근 방식을 사용하여 Firebase API 키 에러를 근본적으로 차단합니다.
 */
const getEnv = (key) => {
  try {
    // Vite 빌드 시에는 import.meta.env.KEY가 실제 값으로 치환됩니다.
    // 하지만 미리보기 환경의 정적 분석기 경고를 피하기 위해 조건부 접근을 사용합니다.
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    return env[key] || "";
  } catch (e) {
    return "";
  }
};

const isCanvas = typeof __firebase_config !== 'undefined';

const firebaseConfig = isCanvas 
  ? JSON.parse(__firebase_config)
  : {
      apiKey: getEnv('VITE_FIREBASE_API_KEY'),
      authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnv('VITE_FIREBASE_APP_ID')
    };

// Firebase 초기화 (Safe Init)
let app, auth, db;
const isValidKey = isCanvas || (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10);

if (isValidKey) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase 초기화 중 오류가 발생했습니다:", e);
  }
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'unframe-interactive-wall';
const apiKey = isCanvas ? "" : getEnv('VITE_GEMINI_API_KEY');

const BASE_THEMES = {
  POSITIVE: { r: 0, g: 74, b: 173, label: 'Joy' },
  CALM: { r: 45, g: 212, b: 191, label: 'Calm' },
  ENERGETIC: { r: 245, g: 158, b: 11, label: 'Power' },
  DEEP: { r: 139, g: 92, b: 246, label: 'Deep' }
};

// 외부 라이브러리 동적 로드 (Confetti, html2canvas)
const loadExternalLibs = () => {
  const libs = [
    { id: 'confetti-lib', src: "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js" },
    { id: 'html2canvas-lib', src: "https://html2canvas.hertzen.com/dist/html2canvas.min.js" }
  ];
  libs.forEach(lib => {
    if (!document.getElementById(lib.id)) {
      const script = document.createElement('script');
      script.id = lib.id;
      script.src = lib.src;
      document.head.appendChild(script);
    }
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [settings, setSettings] = useState(null);
  const [likedMessageIds, setLikedMessageIds] = useState(new Set());
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'input');
  const [showSuccess, setShowSuccess] = useState(null);

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("인증 처리 중 오류:", err); }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, setUser);
    loadExternalLibs();
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    // 실시간 설정 동기화
    const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'appSettings');
    const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    // 좋아요 상태 동기화
    const likesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'user_likes');
    const unsubscribeLikes = onSnapshot(likesCollection, (snapshot) => {
      setLikedMessageIds(new Set(snapshot.docs.map(doc => doc.id)));
    });

    // 메시지 데이터 동기화
    const msgCollection = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const unsubscribeMsgs = onSnapshot(msgCollection, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });

    return () => { unsubscribeSettings(); unsubscribeLikes(); unsubscribeMsgs(); };
  }, [user]);

  const toggleLike = async (messageId) => {
    if (!user || !db) return;
    const likeDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'user_likes', messageId);
    const messageDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'messages', messageId);
    try {
      const likeDoc = await getDoc(likeDocRef);
      if (likeDoc.exists()) {
        await deleteDoc(likeDocRef);
        await updateDoc(messageDocRef, { likes: increment(-1) });
      } else {
        await setDoc(likeDocRef, { messageId, timestamp: serverTimestamp() });
        await updateDoc(messageDocRef, { likes: increment(1) });
      }
    } catch (err) { console.error(err); }
  };

  const deleteMessage = async (msgId) => {
    if (!db || !window.confirm("이 메시지를 삭제하시겠습니까? 전시장 화면에서도 즉시 사라집니다.")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', msgId));
    } catch (e) { console.error(e); }
  };

  if (!isValidKey && !isCanvas) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center font-sans">
        <AlertCircle className="text-amber-500 w-16 h-16 mb-6" />
        <h1 className="text-2xl font-bold mb-4">설정이 완료되지 않았습니다</h1>
        <p className="text-neutral-400 mb-8 max-w-sm leading-relaxed">
          Firebase API 키를 불러올 수 없습니다. <code className="bg-neutral-900 px-2 py-1 rounded text-amber-200">.env</code> 파일 혹은 Netlify 설정에 <code className="text-white">VITE_FIREBASE_API_KEY</code>가 정확히 입력되었는지 확인해 주세요.
        </p>
      </div>
    );
  }

  if (!settings) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans gap-4 text-white">
      <div className="w-8 h-8 border-2 border-[#004aad] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-neutral-500 tracking-[0.3em] uppercase text-[10px]">Connecting Exhibition Network...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-[#004aad] selection:text-white">
      {view === 'input' && (
        <VisitorInput 
          settings={settings.input} 
          messages={messages.slice(0, 10)} 
          user={user} 
          likedMessageIds={likedMessageIds} 
          onToggleLike={toggleLike} 
          onSuccess={(data) => setShowSuccess(data)}
        />
      )}
      {view === 'display' && <DisplayWall settings={settings.display} messages={messages} />}
      {view === 'admin' && (
        <AdminPanel 
          settings={settings} 
          messages={messages}
          onUpdate={(s) => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'appSettings'), s)} 
          onDelete={deleteMessage}
          onBack={() => setView('display')} 
        />
      )}

      {showSuccess && <SuccessTicket data={showSuccess} onClose={() => setShowSuccess(null)} />}
      
      <style>{`
        @keyframes float-down {
          0% { transform: translateY(-120%) scale(0.9); opacity: 0; }
          10% { opacity: 1; transform: translateY(-100%) scale(1); }
          90% { opacity: 1; }
          100% { transform: translateY(110vh) scale(0.95); opacity: 0; }
        }
        @keyframes heart-beat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); filter: brightness(1.2); }
        }
        .animate-float { animation: float-down linear infinite; }
        .animate-beat { animation: heart-beat 0.6s ease-in-out; }
        .aura-glow { box-shadow: 0 0 60px var(--aura-color); }
        .ticket-mask { 
          mask-image: radial-gradient(circle at 0% 65%, transparent 15px, black 16px), 
                      radial-gradient(circle at 100% 65%, transparent 15px, black 16px); 
        }
      `}</style>
    </div>
  );
}

// --- Component: 관객 입력창 ---
function VisitorInput({ settings, messages, user, likedMessageIds, onToggleLike, onSuccess }) {
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const callGeminiAI = async (inputText) => {
    const systemPrompt = `You are a sentiment analyzer for an art exhibition.
    Analyze the message and give highly contrasted scores (0-100) for 4 categories.
    Return ONLY a JSON: {"POSITIVE": score, "CALM": score, "ENERGETIC": score, "DEEP": score}.
    The sum must be 100. DO NOT give balanced scores like 25/25/25/25.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: "${inputText}"` }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        let rawContent = result.candidates[0].content.parts[0].text;
        const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        // 만약 AI가 중립적인 점수를 준다면 유의미한 편차(지터)를 인위적으로 추가
        if (Object.values(parsed).every(v => v === 25)) return { POSITIVE: 45, CALM: 20, ENERGETIC: 10, DEEP: 25 };
        return parsed;
      }
      throw new Error();
    } catch (err) { 
      const r = () => Math.floor(Math.random() * 60);
      return { POSITIVE: r(), CALM: r(), ENERGETIC: r(), DEEP: r() };
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || isAnalyzing || !user) return;
    setIsAnalyzing(true);
    
    const scores = await callGeminiAI(text);
    const msgData = {
      text,
      timestamp: serverTimestamp(),
      scores,
      likes: 0,
      userId: user.uid,
      posX: Math.floor(Math.random() * 80) + 10,
      rotation: Math.floor(Math.random() * 10) - 5
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), msgData);
      onSuccess(msgData);
      setText('');
    } finally { setIsAnalyzing(false); }
  };

  return (
    <div className={`flex flex-col min-h-screen p-8 max-w-md mx-auto py-16 ${settings.fontFamily}`}>
      <header className="mb-12">
        <div className="w-12 h-px bg-[#004aad] mb-6"></div>
        <h1 className="text-3xl font-light mb-3 leading-tight">{settings.question}</h1>
        <p className="text-neutral-500 text-[10px] tracking-[0.2em] uppercase">{settings.subtitle}</p>
      </header>
      
      <form onSubmit={send} className="mb-16">
        <div className="relative group">
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            className="w-full bg-neutral-900 border border-neutral-800 rounded-4xl p-7 h-48 focus:border-[#004aad] outline-none transition-all mb-6 text-lg font-light backdrop-blur-sm" 
            placeholder={settings.placeholder} 
            maxLength={150} 
          />
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/70 rounded-4xl flex flex-col items-center justify-center backdrop-blur-md z-20">
              <BrainCircuit className="text-[#004aad] animate-pulse mb-3" size={32} />
              <p className="text-[10px] font-mono tracking-widest text-neutral-400">ANALYZING MOOD...</p>
            </div>
          )}
        </div>
        <button disabled={!text.trim() || isAnalyzing} className="w-full bg-[#004aad] py-5 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-[#004aad]/20">
          <Send size={18} /> {isAnalyzing ? "분석 중..." : settings.buttonText}
        </button>
      </form>

      <div className="space-y-5">
        <h3 className="text-[10px] text-neutral-600 uppercase tracking-widest flex items-center gap-2 mb-6"><Sparkles size={14} className="text-[#004aad]"/> Recent Reflections</h3>
        {messages.map(msg => (
          <div key={msg.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-3xl flex items-center justify-between transition-all hover:bg-neutral-800/60">
            <p className="text-sm font-light text-neutral-300 pr-6 leading-relaxed">{msg.text}</p>
            <button onClick={() => onToggleLike(msg.id)} className="flex flex-col items-center gap-1 group/heart">
              <Heart size={18} className={likedMessageIds.has(msg.id) ? "fill-[#004aad] text-[#004aad] scale-110 transition-all" : "text-neutral-600 group-hover:text-neutral-400"} />
              <span className="text-[10px] font-mono text-neutral-500">{msg.likes || 0}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Component: 전시 메인 화면 (레이어 최적화) ---
function DisplayWall({ settings, messages }) {
  const qStyle = {
    fontSize: settings.questionSize || '72px',
    fontFamily: settings.fontFamily || 'inherit'
  };

  return (
    <div className={`relative w-full h-screen bg-black flex items-center justify-center`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,74,173,0.12)_0%,transparent_80%)] z-0"></div>
      
      {/* Question Overlay (z-30: 항상 메시지보다 위에 위치) */}
      <div className="relative z-30 text-center pointer-events-none px-12">
        <h2 style={qStyle} className="font-light mb-10 tracking-tighter max-w-6xl leading-tight drop-shadow-[0_0_50px_rgba(0,0,0,1)] text-white">{settings.question}</h2>
        <div className="flex items-center justify-center gap-8 text-[#004aad] opacity-80">
          <div className="h-px w-20 bg-current"></div>
          <p className="text-xl tracking-[0.5em] uppercase font-light italic">{settings.subtitle}</p>
          <div className="h-px w-20 bg-current"></div>
        </div>
      </div>

      {/* Messages Layer (z-10: 질문 뒤로 지나감) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {messages.map((msg, i) => <MessageCard key={msg.id} msg={msg} index={i} />)}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent z-40 pointer-events-none"></div>
    </div>
  );
}

function MessageCard({ msg, index }) {
  const [pulse, setPulse] = useState(false);
  const mixedColor = useMemo(() => {
    const s = msg.scores || { POSITIVE: 25, CALM: 25, ENERGETIC: 25, DEEP: 25 };
    const r = (s.POSITIVE * BASE_THEMES.POSITIVE.r + s.CALM * BASE_THEMES.CALM.r + s.ENERGETIC * BASE_THEMES.ENERGETIC.r + s.DEEP * BASE_THEMES.DEEP.r) / 100;
    const g = (s.POSITIVE * BASE_THEMES.POSITIVE.g + s.CALM * BASE_THEMES.CALM.g + s.ENERGETIC * BASE_THEMES.ENERGETIC.g + s.DEEP * BASE_THEMES.DEEP.g) / 100;
    const b = (s.POSITIVE * BASE_THEMES.POSITIVE.b + s.CALM * BASE_THEMES.CALM.b + s.ENERGETIC * BASE_THEMES.ENERGETIC.b + s.DEEP * BASE_THEMES.DEEP.b) / 100;
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }, [msg.scores]);

  useEffect(() => {
    if (msg.likes > 0) {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }
  }, [msg.likes]);

  return (
    <div 
      className={`absolute p-10 rounded-4xl border border-white/5 backdrop-blur-3xl animate-float transition-all duration-700 ${pulse ? 'animate-beat z-20 brightness-125' : 'z-0'}`} 
      style={{ left: `${msg.posX || 50}%`, animationDuration: `${28 + (index % 8) * 5}s`, animationDelay: `${(index % 15) * 1.8}s`, backgroundColor: 'rgba(10, 10, 10, 0.45)', boxShadow: `0 0 50px ${mixedColor.replace('rgb', 'rgba').replace(')', ', 0.35)')}`, transform: `rotate(${msg.rotation || 0}deg)`, maxWidth: '380px' }}
    >
      <p className="text-2xl font-light leading-relaxed text-neutral-100 mb-8">{msg.text}</p>
      <div className="flex items-center justify-between opacity-40">
        <div className="flex flex-wrap gap-2 max-w-[220px]">
          {msg.scores && Object.entries(msg.scores).sort((a,b)=>b[1]-a[1]).slice(0,2).filter(([_, v]) => v > 20).map(([k, _]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `rgb(${BASE_THEMES[k].r}, ${BASE_THEMES[k].g}, ${BASE_THEMES[k].b})` }}></div>
              <span className="text-[8px] font-mono tracking-widest uppercase font-light">{BASE_THEMES[k].label}</span>
            </div>
          ))}
        </div>
        {msg.likes > 0 && <div className="flex items-center gap-1.5 text-[#004aad] animate-in zoom-in"><Heart size={14} className="fill-current" /><span className="text-xs font-mono font-bold">{msg.likes}</span></div>}
      </div>
    </div>
  );
}

// --- Component: 축포 및 티켓 저장 팝업 ---
function SuccessTicket({ data, onClose }) {
  const ticketRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (window.confetti) {
      window.confetti({ 
        particleCount: 150, 
        spread: 80, 
        origin: { y: 0.75 }, 
        colors: ['#004aad', '#ffffff', '#2dd4bf', '#8b5cf6'],
        disableForReducedMotion: true
      });
    }
  }, []);

  const saveTicket = async () => {
    if (!ticketRef.current || !window.html2canvas) return;
    setIsSaving(true);
    try {
      const canvas = await window.html2canvas(ticketRef.current, { 
        backgroundColor: '#000000', 
        scale: 3, 
        useCORS: true,
        logging: false
      });
      const link = document.createElement('a');
      link.download = `Unframe-Aura-Ticket-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) { console.error("티켓 저장 실패:", e); }
    setIsSaving(false);
  };

  const mixedColor = useMemo(() => {
    const s = data.scores;
    const r = (s.POSITIVE * BASE_THEMES.POSITIVE.r + s.CALM * BASE_THEMES.CALM.r + s.ENERGETIC * BASE_THEMES.ENERGETIC.r + s.DEEP * BASE_THEMES.DEEP.r) / 100;
    const g = (s.POSITIVE * BASE_THEMES.POSITIVE.g + s.CALM * BASE_THEMES.CALM.g + s.ENERGETIC * BASE_THEMES.ENERGETIC.g + s.DEEP * BASE_THEMES.DEEP.g) / 100;
    const b = (s.POSITIVE * BASE_THEMES.POSITIVE.b + s.CALM * BASE_THEMES.CALM.b + s.ENERGETIC * BASE_THEMES.ENERGETIC.b + s.DEEP * BASE_THEMES.DEEP.b) / 100;
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }, [data]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-500 font-sans">
      <div className="max-w-xs w-full flex flex-col items-center">
        <div className="mb-8 text-center animate-in slide-in-from-top-4 duration-700">
          <CheckCircle2 className="text-[#004aad] w-12 h-12 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-bold tracking-tight">생각이 전달되었습니다</h2>
          <p className="text-neutral-500 text-sm mt-1">분석된 당신의 아우라 티켓을 보관하세요.</p>
        </div>

        <div ref={ticketRef} className="relative w-full bg-[#111] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 ticket-mask p-9 flex flex-col gap-8 text-white min-h-[420px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest leading-none">Exhibition Identity</p>
              <h3 className="text-2xl font-black tracking-tighter text-[#004aad] mt-1.5">UNFRAME</h3>
            </div>
            <div className="w-14 h-14 rounded-full blur-3xl opacity-80" style={{ backgroundColor: mixedColor }}></div>
          </div>
          <div className="h-px w-full border-dashed border-t border-white/20"></div>
          <div className="space-y-4">
            <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">My Reflection</p>
            <p className="text-base font-light leading-relaxed italic text-neutral-100 line-clamp-6">"{data.text}"</p>
          </div>
          <div className="mt-auto pt-8 flex justify-between items-end border-t border-white/5">
            <div>
              <p className="text-[8px] text-neutral-600 font-mono uppercase">User Identity (UID)</p>
              <p className="text-[10px] text-neutral-400 font-mono truncate w-28">{data.userId}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-neutral-600 font-mono uppercase">Analyzed Aura</p>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: mixedColor }}>Visualized</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex gap-3 w-full">
          <button onClick={saveTicket} disabled={isSaving} className="flex-1 bg-white text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl">
            <Download size={18} /> {isSaving ? "저장 중..." : "이미지로 저장"}
          </button>
          <button onClick={onClose} className="w-14 h-14 bg-neutral-800 rounded-2xl flex items-center justify-center active:scale-95 transition-all">
            <X size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Component: 관리자 대시보드 ---
function AdminPanel({ settings, messages, onUpdate, onDelete, onBack }) {
  const [local, setLocal] = useState(settings);
  const [tab, setTab] = useState('settings');

  const fontOptions = [{ label: 'Modern Sans', value: 'font-sans' }, { label: 'Elegant Serif', value: 'font-serif' }, { label: 'Minimal Mono', value: 'font-mono' }];

  const handleChange = (section, field, value) => setLocal(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));

  return (
    <div className="p-16 max-w-6xl mx-auto space-y-12 font-sans h-screen overflow-y-auto pb-40 text-neutral-300">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-10">
        <div>
          <h1 className="text-4xl font-light tracking-tight italic text-white leading-none">Management</h1>
          <p className="text-neutral-500 text-xs tracking-widest uppercase mt-3">Exhibition Space Control</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-neutral-900 rounded-full p-1 border border-neutral-800 backdrop-blur-lg">
            <button onClick={() => setTab('settings')} className={`px-7 py-2.5 rounded-full text-xs font-bold transition-all ${tab === 'settings' ? 'bg-[#004aad] text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Settings</button>
            <button onClick={() => setTab('messages')} className={`px-7 py-2.5 rounded-full text-xs font-bold transition-all ${tab === 'messages' ? 'bg-[#004aad] text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Messages</button>
          </div>
          <button onClick={onBack} className="px-6 py-2.5 border border-neutral-700 rounded-full text-xs font-medium hover:bg-neutral-800 transition-all uppercase tracking-widest">Back</button>
        </div>
      </div>

      {tab === 'settings' ? (
        <div className="grid md:grid-cols-2 gap-10 animate-in fade-in duration-500">
          <div className="bg-neutral-900/40 p-10 rounded-[3rem] border border-neutral-800 space-y-10 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-[#004aad] border-b border-neutral-800 pb-4">
              <Monitor size={18}/>
              <h2 className="text-xs font-bold uppercase tracking-widest">Wall Display</h2>
            </div>
            <AdminField label="Main Question" value={local.display.question} onChange={v => handleChange('display', 'question', v)} />
            
            <div className="space-y-4">
               <label className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold ml-1 flex justify-between">
                 Font Size (px) <span>{local.display.questionSize}</span>
               </label>
               <div className="flex gap-4 items-center font-sans">
                 <input 
                   type="range" min="30" max="150" step="1"
                   value={parseInt(local.display.questionSize) || 72}
                   onChange={e => handleChange('display', 'questionSize', `${e.target.value}px`)}
                   className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#004aad]"
                 />
                 <input 
                   type="text" value={local.display.questionSize}
                   onChange={e => handleChange('display', 'questionSize', e.target.value)}
                   className="w-20 bg-black border border-neutral-800 p-2.5 rounded-xl text-xs text-center font-mono"
                 />
               </div>
            </div>
            
            <AdminSelect label="Font Style" options={fontOptions} value={local.display.fontFamily} onChange={v => handleChange('display', 'fontFamily', v)} />
            <AdminField label="Bottom Subtitle" value={local.display.subtitle} onChange={v => handleChange('display', 'subtitle', v)} />
          </div>

          <div className="bg-neutral-900/40 p-10 rounded-[3rem] border border-neutral-800 space-y-10 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-emerald-500 border-b border-neutral-800 pb-4">
              <Smartphone size={18}/>
              <h2 className="text-xs font-bold uppercase tracking-widest">Visitor Interface</h2>
            </div>
            <AdminField label="App Title" value={local.input.question} onChange={v => handleChange('input', 'question', v)} />
            <AdminField label="Description" value={local.input.subtitle} onChange={v => handleChange('input', 'subtitle', v)} />
            <AdminField label="Placeholder" value={local.input.placeholder} onChange={v => handleChange('input', 'placeholder', v)} />
            <AdminField label="Button Text" value={local.input.buttonText} onChange={v => handleChange('input', 'buttonText', v)} />
            <button onClick={async () => { await onUpdate(local); alert('모든 설정이 업데이트되었습니다.'); }} className="w-full bg-[#004aad] py-6 rounded-[2rem] font-bold text-xl hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-[#004aad]/30 uppercase tracking-widest">Deploy Config</button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-end">
            <h2 className="text-xl font-bold text-white flex items-center gap-3 font-sans"><MessageSquare className="text-[#004aad]" /> Message Feed ({messages.length})</h2>
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest">당첨자 확인 시 Identity UID를 대조하세요.</p>
          </div>
          <div className="bg-neutral-900/50 rounded-[2.5rem] border border-neutral-800 overflow-hidden backdrop-blur-md">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-black/40 text-neutral-500 text-[10px] uppercase font-mono border-b border-neutral-800">
                <tr>
                  <th className="p-6 font-bold">Content</th>
                  <th className="p-6 font-bold">Identity (UID)</th>
                  <th className="p-6 font-bold">Analysis</th>
                  <th className="p-6 font-bold">Likes</th>
                  <th className="p-6 text-center font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40">
                {messages.map(msg => (
                  <tr key={msg.id} className="hover:bg-white/[0.03] transition-colors group font-sans">
                    <td className="p-6 text-neutral-200 leading-relaxed max-w-sm font-light">{msg.text}</td>
                    <td className="p-6 font-mono text-[10px] text-[#004aad] opacity-80">{msg.userId}</td>
                    <td className="p-6">
                      <div className="flex flex-wrap gap-1.5">
                        {msg.scores && Object.entries(msg.scores).sort((a,b)=>b[1]-a[1]).slice(0,1).map(([k, v]) => (
                          <span key={k} className="text-[9px] px-2.5 py-1 rounded-full border border-neutral-700 bg-neutral-800/50 uppercase font-mono">{k} {v}%</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-6 text-neutral-400 font-mono">{msg.likes || 0}</td>
                    <td className="p-6 text-center">
                      <button onClick={() => onDelete(msg.id)} className="p-2.5 text-neutral-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {messages.length === 0 && <div className="p-32 text-center text-neutral-600 text-sm font-light italic">데이터가 없습니다.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminField({ label, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold ml-1">{label}</label>
      <input 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full bg-black/40 border border-neutral-800 p-5 rounded-2xl outline-none focus:border-neutral-500 transition-all font-light text-neutral-200 font-sans" 
      />
    </div>
  );
}

function AdminSelect({ label, options, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold ml-1">{label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full bg-black/40 border border-neutral-800 p-5 rounded-2xl outline-none focus:border-neutral-500 transition-all font-light appearance-none text-neutral-200 font-sans"
      >
        {options.map(opt => <option key={opt.value} value={opt.value} className="bg-neutral-900 font-sans">{opt.label}</option>)}
      </select>
    </div>
  );
}