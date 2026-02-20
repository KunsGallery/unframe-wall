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
  where,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { Send, Settings, Smartphone, Monitor, Heart, Sparkles, BrainCircuit, Download, CheckCircle2, UserCircle, MessageSquare, X, Trash2, Sliders, AlertCircle, BarChart3, FileJson, History, Info } from 'lucide-react';

/**
 * [환경 변수 안전 로딩]
 */
const getEnv = (key) => {
  try {
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

let app, auth, db;
const isValidKey = isCanvas || (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10);

if (isValidKey) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Init Error:", e);
  }
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'unframe-interactive-wall';
const apiKey = isCanvas ? "" : getEnv('VITE_GEMINI_API_KEY');

const BASE_THEMES = {
  POSITIVE: { r: 0, g: 74, b: 173, label: 'Joy', color: '#004aad' },
  CALM: { r: 45, g: 212, b: 191, label: 'Calm', color: '#2dd4bf' },
  ENERGETIC: { r: 245, g: 158, b: 11, label: 'Power', color: '#f59e0b' },
  DEEP: { r: 139, g: 92, b: 246, label: 'Deep', color: '#8b5cf6' }
};

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
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, setUser);
    loadExternalLibs();
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'appSettings');
    const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    const likesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'user_likes');
    const unsubscribeLikes = onSnapshot(likesCollection, (snapshot) => {
      setLikedMessageIds(new Set(snapshot.docs.map(doc => doc.id)));
    });

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
    if (!db || !window.confirm("이 메시지를 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', msgId));
    } catch (e) { console.error(e); }
  };

  const clearAllMessages = async () => {
    if (!db || !window.confirm("모든 메시지를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("모든 데이터가 삭제되었습니다.");
  };

  if (!isValidKey && !isCanvas) {
    return (
      <div className="min-h-screen bg-[#f3efea] text-[#004aad] flex flex-col items-center justify-center p-8 text-center font-sans">
        <AlertCircle className="w-16 h-16 mb-6" />
        <h1 className="text-2xl font-bold mb-4 italic">Environment Required</h1>
        <p className="text-neutral-600 mb-8 max-w-sm">Firebase 설정이 비어있습니다.</p>
      </div>
    );
  }

  if (!settings) return (
    <div className="min-h-screen bg-[#f3efea] flex flex-col items-center justify-center font-sans gap-4">
      <div className="w-8 h-8 border-2 border-[#004aad] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[#004aad] tracking-[0.3em] uppercase text-[10px] font-bold">Unframe Networking...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3efea] text-[#111] overflow-hidden font-sans selection:bg-[#004aad] selection:text-white">
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
          onClearAll={clearAllMessages}
          onBack={() => setView('display')} 
        />
      )}

      {showSuccess && <SuccessTicket data={showSuccess} onClose={() => setShowSuccess(null)} />}
      
      <style>{`
        @keyframes float-down {
          0% { transform: translateY(-120%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
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
    const systemPrompt = `Analyze the sentiment of this art exhibition message. YOU MUST PROVIDE VARIED SCORES. Return ONLY JSON: {"POSITIVE": score, "CALM": score, "ENERGETIC": score, "DEEP": score}. Total 100.`;
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
        let raw = result.candidates[0].content.parts[0].text;
        const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(clean);
        if (Object.values(parsed).every(v => v === 25)) return { POSITIVE: 45, CALM: 20, ENERGETIC: 10, DEEP: 25 };
        return parsed;
      }
      throw new Error();
    } catch (err) { 
      const r = () => Math.floor(Math.random() * 50);
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
      userId: user.uid
    };
    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), msgData);
      // 티켓 고유 ID로 사용하기 위해 문서 ID 추가
      onSuccess({ ...msgData, id: docRef.id });
      setText('');
    } finally { setIsAnalyzing(false); }
  };

  return (
    <div className={`flex flex-col min-h-screen p-8 max-w-md mx-auto py-16 ${settings.fontFamily}`}>
      <header className="mb-12">
        <div className="w-12 h-px bg-[#004aad] mb-6"></div>
        <h1 className="text-3xl font-light mb-3 leading-tight text-[#004aad]">{settings.question}</h1>
        <p className="text-neutral-500 text-[10px] tracking-[0.2em] uppercase font-bold">{settings.subtitle}</p>
      </header>
      
      <form onSubmit={send} className="mb-16">
        <div className="relative group">
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full bg-white/50 border border-neutral-200 rounded-4xl p-7 h-48 focus:border-[#004aad] outline-none transition-all mb-6 text-lg font-light backdrop-blur-sm shadow-sm" placeholder={settings.placeholder} maxLength={150} />
          {isAnalyzing && (
            <div className="absolute inset-0 bg-white/70 rounded-4xl flex flex-col items-center justify-center backdrop-blur-md z-20">
              <BrainCircuit className="text-[#004aad] animate-pulse mb-3" size={32} />
              <p className="text-[10px] font-bold tracking-widest text-[#004aad]">ANALYZING AURA...</p>
            </div>
          )}
        </div>
        <button disabled={!text.trim() || isAnalyzing} className="w-full bg-[#004aad] text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-blue-200">
          <Send size={18} /> {isAnalyzing ? "처리 중..." : settings.buttonText}
        </button>
      </form>

      <div className="space-y-5">
        <h3 className="text-[10px] text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-6 font-bold"><Sparkles size={14} className="text-[#004aad]"/> Recent Traces</h3>
        {messages.map(msg => (
          <div key={msg.id} className="bg-white/40 border border-neutral-200 p-6 rounded-3xl flex items-center justify-between transition-all hover:border-neutral-300 shadow-sm animate-in fade-in duration-500">
            <p className="text-sm font-light text-neutral-700 pr-6 leading-relaxed">{msg.text}</p>
            <button onClick={() => onToggleLike(msg.id)} className="flex flex-col items-center gap-1 group/heart">
              <Heart size={18} className={likedMessageIds.has(msg.id) ? "fill-[#004aad] text-[#004aad] scale-110 transition-all" : "text-neutral-300 hover:text-neutral-400"} />
              <span className="text-[10px] font-mono text-neutral-400 font-bold">{msg.likes || 0}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Component: 전시 메인 화면 ---
function DisplayWall({ settings, messages }) {
  const qStyle = {
    fontSize: settings.questionSize || '72px',
    fontFamily: settings.fontFamily || 'inherit'
  };

  return (
    <div className={`relative w-full h-screen bg-[#f3efea] flex items-center justify-center`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,74,173,0.05)_0%,transparent_80%)] z-0"></div>
      
      <div className="relative z-30 flex flex-col items-center pointer-events-none px-12 max-w-7xl">
        <div className="bg-[#f3efea]/90 backdrop-blur-xl p-16 rounded-[4rem] border border-[#004aad]/5 shadow-2xl shadow-[#004aad]/10 text-center animate-in fade-in zoom-in duration-1000">
          <h2 style={qStyle} className="font-light mb-10 tracking-tighter leading-tight text-[#004aad] drop-shadow-sm">{settings.question}</h2>
          <div className="flex items-center justify-center gap-8 text-[#004aad]/40">
            <div className="h-px w-24 bg-current"></div>
            <p className="text-2xl tracking-[0.4em] uppercase font-light italic">{settings.subtitle}</p>
            <div className="h-px w-24 bg-current"></div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {messages.map((msg, i) => <MessageCard key={msg.id + i} msg={msg} index={i} />)}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#f3efea] to-transparent z-40 pointer-events-none"></div>
    </div>
  );
}

function MessageCard({ msg, index }) {
  const [pulse, setPulse] = useState(false);
  const [pos, setPos] = useState({ x: Math.random() * 80 + 10, rot: Math.random() * 10 - 5 });

  const handleIteration = () => {
    setPos({ x: Math.random() * 80 + 10, rot: Math.random() * 10 - 5 });
  };

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
      onAnimationIteration={handleIteration}
      className={`absolute p-10 rounded-[2.5rem] border border-[#004aad]/5 backdrop-blur-3xl animate-float transition-all duration-700 ${pulse ? 'animate-beat z-20 brightness-110' : 'z-0'}`} 
      style={{ 
        left: `${pos.x}%`, 
        animationDuration: `${28 + (index % 8) * 5}s`, 
        animationDelay: `${(index % 15) * 1.8}s`, 
        backgroundColor: 'rgba(255, 255, 255, 0.6)', 
        boxShadow: `0 0 40px ${mixedColor.replace('rgb', 'rgba').replace(')', ', 0.25)')}`, 
        transform: `rotate(${pos.rot}deg)`, 
        maxWidth: '380px' 
      }}
    >
      <p className="text-2xl font-light leading-relaxed text-[#004aad] mb-8">{msg.text}</p>
      <div className="flex items-center justify-between opacity-30">
        <div className="flex flex-wrap gap-2 max-w-[220px]">
          {msg.scores && Object.entries(msg.scores).sort((a,b)=>b[1]-a[1]).slice(0,2).filter(([_, v]) => v > 20).map(([k, _]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `rgb(${BASE_THEMES[k].r}, ${BASE_THEMES[k].g}, ${BASE_THEMES[k].b})` }}></div>
              <span className="text-[8px] font-mono tracking-widest uppercase font-bold">{BASE_THEMES[k].label}</span>
            </div>
          ))}
        </div>
        {msg.likes > 0 && <div className="flex items-center gap-1.5 text-[#004aad] animate-in zoom-in font-bold font-mono text-xs"><Heart size={12} className="fill-current" />{msg.likes}</div>}
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
      window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.75 }, colors: ['#004aad', '#f3efea', '#2dd4bf', '#8b5cf6'] });
    }
  }, []);

  const saveTicket = async () => {
    if (!ticketRef.current || !window.html2canvas) return;
    setIsSaving(true);
    try {
      const canvas = await window.html2canvas(ticketRef.current, { 
        backgroundColor: '#f3efea', 
        scale: 4, 
        useCORS: true,
        logging: false,
        allowTaint: true
      });
      const link = document.createElement('a');
      link.download = `Unframe-Aura-Ticket-${data.id.slice(0, 5)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) { console.error("Capture Failed:", e); }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#f3efea]/95 backdrop-blur-2xl animate-in fade-in duration-500 font-sans">
      <div className="max-w-xs w-full flex flex-col items-center">
        <div className="mb-8 text-center animate-in slide-in-from-top-4 duration-700 text-[#004aad]">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-bold tracking-tight">생각이 전달되었습니다</h2>
          <p className="text-neutral-500 text-sm mt-1">분석된 당신의 아우라 티켓을 보관하세요.</p>
        </div>

        <div ref={ticketRef} className="relative w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-neutral-100 ticket-mask p-9 flex flex-col gap-8 text-[#004aad] min-h-[420px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] text-neutral-400 font-mono uppercase tracking-widest leading-none font-bold">Unframe Ticket</p>
              <h3 className="text-2xl font-black tracking-tighter text-[#004aad] mt-1.5 italic">Aura Spectrum</h3>
            </div>
            <div className="w-14 h-14 rounded-full blur-3xl opacity-60" style={{ backgroundColor: mixedColor }}></div>
          </div>
          <div className="h-px w-full border-dashed border-t border-neutral-100"></div>
          <div className="space-y-4">
            <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest font-bold">Exhibition Trace</p>
            <p className="text-base font-light leading-relaxed italic text-neutral-800 line-clamp-6">"{data.text}"</p>
          </div>
          <div className="mt-auto pt-8 flex justify-between items-end border-t border-neutral-50">
            <div>
              <p className="text-[8px] text-neutral-300 font-mono uppercase font-bold text-[#004aad]">Ticket ID</p>
              <p className="text-[10px] text-neutral-400 font-mono font-bold">#{data.id.toUpperCase()}</p>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1" style={{ color: mixedColor }}>Visualized</p>
          </div>
        </div>

        <div className="mt-10 flex gap-3 w-full">
          <button onClick={saveTicket} disabled={isSaving} className="flex-1 bg-[#004aad] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-blue-200">
            <Download size={18} /> {isSaving ? "처리 중..." : "이미지로 저장"}
          </button>
          <button onClick={onClose} className="w-14 h-14 bg-white border border-neutral-100 text-neutral-400 rounded-2xl flex items-center justify-center active:scale-95 transition-all">
            <X size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Component: 관리자 대시보드 ---
function AdminPanel({ settings, messages, onUpdate, onDelete, onClearAll, onBack }) {
  const [local, setLocal] = useState(settings);
  const [tab, setTab] = useState('settings');

  const stats = useMemo(() => {
    const total = messages.length || 1;
    const sums = { POSITIVE: 0, CALM: 0, ENERGETIC: 0, DEEP: 0 };
    messages.forEach(m => {
      if (m.scores) Object.keys(sums).forEach(k => sums[k] += (m.scores[k] || 0));
    });
    return Object.keys(sums).map(k => ({ key: k, value: Math.round(sums[k] / total) }));
  }, [messages]);

  const exportCSV = () => {
    const headers = "ID,Content,UID,Likes,Sentiment\n";
    const rows = messages.map(m => `"${m.id}","${m.text.replace(/"/g, '""')}","${m.userId}",${m.likes || 0},"${Object.entries(m.scores).sort((a,b)=>b[1]-a[1])[0][0]}"`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Unframe-Messages-${Date.now()}.csv`;
    link.click();
  };

  const handleChange = (section, field, value) => setLocal(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));

  return (
    <div className="p-16 max-w-7xl mx-auto space-y-12 font-sans h-screen overflow-y-auto pb-40 text-neutral-800 animate-in fade-in duration-700">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tight italic text-[#004aad] leading-none">Management</h1>
          <p className="text-neutral-400 text-xs tracking-widest uppercase mt-3 font-bold">Unframe Control Hub</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-white rounded-full p-1 border border-neutral-200 shadow-sm">
            <button onClick={() => setTab('settings')} className={`px-7 py-2.5 rounded-full text-xs font-bold transition-all ${tab === 'settings' ? 'bg-[#004aad] text-white' : 'text-neutral-400 hover:text-[#004aad]'}`}>Settings</button>
            <button onClick={() => setTab('messages')} className={`px-7 py-2.5 rounded-full text-xs font-bold transition-all ${tab === 'messages' ? 'bg-[#004aad] text-white' : 'text-neutral-400 hover:text-[#004aad]'}`}>Database</button>
          </div>
          <button onClick={onBack} className="px-6 py-2.5 border border-neutral-200 bg-white rounded-full text-xs font-bold text-neutral-400 hover:text-[#004aad] transition-all uppercase tracking-widest">Exit</button>
        </div>
      </div>

      {tab === 'settings' ? (
        <div className="grid md:grid-cols-3 gap-10">
          {/* Wall Control */}
          <div className="md:col-span-2 bg-white/60 p-10 rounded-[3rem] border border-neutral-100 shadow-xl space-y-10">
            <h2 className="text-[#004aad] text-xs font-bold uppercase tracking-widest border-b border-neutral-100 pb-4 flex items-center gap-2 font-black"><Monitor size={14}/> Wall Display</h2>
            <AdminField label="Main Question" value={local.display.question} onChange={v => handleChange('display', 'question', v)} />
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                 <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold flex justify-between">Font Size <span>{local.display.questionSize}</span></label>
                 <div className="flex gap-4 items-center font-sans">
                   <input type="range" min="30" max="150" value={parseInt(local.display.questionSize) || 72} onChange={e => handleChange('display', 'questionSize', `${e.target.value}px`)} className="flex-1 h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-[#004aad]" />
                 </div>
              </div>
              <AdminField label="Subtitle" value={local.display.subtitle} onChange={v => handleChange('display', 'subtitle', v)} />
            </div>
            <div className="bg-[#f3efea]/50 p-8 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase text-[#004aad] flex items-center gap-2"><BarChart3 size={14} /> Global Aura Analytics</h3>
              <div className="flex items-end gap-3 h-24 pt-4">
                {stats.map(s => (
                  <div key={s.key} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full bg-[#004aad]/10 rounded-lg relative overflow-hidden" style={{ height: `${s.value}%` }}>
                      <div className="absolute inset-0 opacity-40" style={{ backgroundColor: BASE_THEMES[s.key].color }}></div>
                    </div>
                    <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter">{s.key} {s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visitor App Control */}
          <div className="bg-white/60 p-10 rounded-[3rem] border border-neutral-100 shadow-xl space-y-8 flex flex-col justify-between">
            <div className="space-y-8">
              <h2 className="text-emerald-600 text-xs font-bold uppercase tracking-widest border-b border-neutral-100 pb-4 flex items-center gap-2 font-black"><Smartphone size={14}/> Visitor Interface</h2>
              <AdminField label="App Title" value={local.input.question} onChange={v => handleChange('input', 'question', v)} />
              <AdminField label="Description" value={local.input.subtitle} onChange={v => handleChange('input', 'subtitle', v)} />
              <AdminField label="Button Text" value={local.input.buttonText} onChange={v => handleChange('input', 'buttonText', v)} />
            </div>
            <button onClick={async () => { await onUpdate(local); alert('Updated!'); }} className="w-full bg-[#004aad] text-white py-6 rounded-[2rem] font-bold text-xl hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-blue-100 uppercase tracking-widest">Apply Config</button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <h2 className="text-xl font-black text-[#004aad] flex items-center gap-3 font-sans"><MessageSquare size={20} /> Collected Traces ({messages.length})</h2>
            <div className="flex gap-3">
              <button onClick={exportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 text-white rounded-full text-xs font-bold hover:bg-neutral-900 transition-all"><Download size={14} /> Export CSV</button>
              <button onClick={onClearAll} className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600 transition-all"><History size={14} /> Reset DB</button>
            </div>
          </div>
          <div className="bg-white/80 rounded-[2.5rem] border border-neutral-100 shadow-xl overflow-hidden backdrop-blur-md">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-neutral-50 text-neutral-400 text-[10px] uppercase font-bold border-b border-neutral-100">
                <tr>
                  <th className="p-6">Content</th>
                  <th className="p-6">User ID / Verification ID</th>
                  <th className="p-6">Aura Status</th>
                  <th className="p-6">Engagement</th>
                  <th className="p-6 text-center">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {messages.map(msg => (
                  <tr key={msg.id} className="hover:bg-[#004aad]/[0.02] transition-colors group font-sans text-neutral-600">
                    <td className="p-6 leading-relaxed max-w-sm font-medium">{msg.text}</td>
                    <td className="p-6 font-mono text-[10px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-[#004aad] font-bold">UID: {msg.userId}</span>
                        <span className="text-neutral-300 font-bold">Ticket: #{msg.id.toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-wrap gap-1.5">
                        {msg.scores && Object.entries(msg.scores).sort((a,b)=>b[1]-a[1]).slice(0,1).map(([k, v]) => (
                          <span key={k} className="text-[9px] px-2.5 py-1 rounded-full border border-neutral-100 bg-white shadow-sm uppercase font-bold text-neutral-400">{k} {v}%</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-6 text-neutral-400 font-bold font-mono flex items-center gap-1.5">
                      <Heart size={12} className="text-red-300" /> {msg.likes || 0}
                    </td>
                    <td className="p-6 text-center">
                      <button onClick={() => onDelete(msg.id)} className="p-2.5 text-neutral-200 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {messages.length === 0 && <div className="p-40 text-center text-neutral-400 text-sm font-light italic flex flex-col items-center gap-4"><Info size={32} className="opacity-20" />데이터가 비어있습니다.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminField({ label, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold ml-1 font-sans">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="w-full bg-neutral-50 border border-neutral-100 p-5 rounded-2xl outline-none focus:border-[#004aad] transition-all font-bold text-[#004aad] font-sans" />
    </div>
  );
}

function AdminSelect({ label, options, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold ml-1 font-sans">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-neutral-50 border border-neutral-100 p-5 rounded-2xl outline-none focus:border-[#004aad] transition-all font-bold appearance-none text-[#004aad] font-sans">{options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
    </div>
  );
}