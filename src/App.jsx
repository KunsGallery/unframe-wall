import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { Send, Settings, Smartphone, Monitor } from 'lucide-react';

// --- [중요] Firebase 콘솔에서 복사한 설정을 여기에 붙여넣으세요 ---
const firebaseConfig = {
  apiKey: "AIzaSyDw4WUKu9kOO9OiHsY5eGvVSaqwI6drxtA",
  authDomain: "unframe-wall.firebaseapp.com",
  projectId: "unframe-wall",
  storageBucket: "unframe-wall.firebasestorage.app",
  messagingSenderId: "820393508690",
  appId: "1:820393508690:web:d7fce7b49011fd1348448b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('display'); // 'input', 'display', 'admin'
  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState({ 
    question: "이 전시를 통해 느낀 당신의 '프레임'은 무엇인가요?", 
    subtitle: "전시장 벽면의 QR을 통해 의견을 남겨주세요." 
  });
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth & Data Sync
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribeAuth = onAuthStateChanged(auth, setUser);

    // Sync Topic
    const topicDocRef = doc(db, 'config', 'currentTopic');
    const unsubscribeTopic = onSnapshot(topicDocRef, (docSnap) => {
      if (docSnap.exists()) setTopic(docSnap.data());
    });

    // Sync Messages (Real-time)
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'));
    const unsubscribeMsgs = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeTopic();
      unsubscribeMsgs();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting || !user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'messages'), {
        text: inputText,
        timestamp: serverTimestamp(),
        userId: user.uid
      });
      setInputText('');
      alert("메시지가 전시장 모니터로 전송되었습니다.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTopic = async (q, s) => {
    await setDoc(doc(db, 'config', 'currentTopic'), { question: q, subtitle: s });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans overflow-hidden">
      {/* Navigation for Testing */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-neutral-900/80 p-1 rounded-full border border-neutral-800 text-xs">
        <button onClick={() => setView('input')} className={`px-4 py-2 rounded-full ${view === 'input' ? 'bg-white text-black' : ''}`}>참여하기</button>
        <button onClick={() => setView('display')} className={`px-4 py-2 rounded-full ${view === 'display' ? 'bg-white text-black' : ''}`}>모니터</button>
        <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-full ${view === 'admin' ? 'bg-white text-black' : ''}`}>관리</button>
      </nav>

      {view === 'input' && <VisitorInput topic={topic} inputText={inputText} setInputText={setInputText} handleSubmit={handleSubmit} isSubmitting={isSubmitting} />}
      {view === 'display' && <DisplayWall topic={topic} messages={messages} />}
      {view === 'admin' && <AdminPanel topic={topic} onUpdate={updateTopic} />}

      <style>{`
        @keyframes fall {
          0% { transform: translateY(-100px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
      `}</style>
    </div>
  );
}

function VisitorInput({ topic, inputText, setInputText, handleSubmit, isSubmitting }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-md mx-auto text-center">
      <h1 className="text-3xl font-light mb-4">{topic.question}</h1>
      <p className="text-neutral-500 mb-10 text-sm">{topic.subtitle}</p>
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-5 h-40 focus:ring-1 focus:ring-white outline-none resize-none"
          placeholder="여기에 적어주세요..."
        />
        <button type="submit" disabled={isSubmitting} className="w-full bg-white text-black py-4 rounded-full font-bold flex items-center justify-center gap-2">
          <Send size={18} /> {isSubmitting ? "전송 중..." : "전송하기"}
        </button>
      </form>
    </div>
  );
}

function DisplayWall({ topic, messages }) {
  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center text-center px-10">
      <div className="z-10">
        <h2 className="text-7xl font-light mb-6 tracking-tighter">{topic.question}</h2>
        <p className="text-neutral-500 text-xl tracking-[0.3em] uppercase">{topic.subtitle}</p>
      </div>
      <div className="absolute inset-0 z-0">
        {messages.slice(0, 20).map((msg, i) => (
          <div 
            key={msg.id} 
            className="absolute p-6 max-w-xs bg-neutral-900/40 border border-neutral-800 rounded-xl backdrop-blur-sm animate-fall"
            style={{
              left: `${(i * 17) % 85 + 5}%`,
              animationDuration: `${20 + (i % 5) * 5}s`,
              animationDelay: `${(i % 10) * 2}s`
            }}
          >
            <p className="text-lg font-light leading-relaxed">{msg.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminPanel({ topic, onUpdate }) {
  const [q, setQ] = useState(topic.question);
  const [s, setS] = useState(topic.subtitle);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-md mx-auto">
      <div className="w-full bg-neutral-900 p-8 rounded-3xl border border-neutral-800 space-y-6">
        <h2 className="text-xl flex items-center gap-2"><Settings size={20}/> 전시 관리</h2>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">메인 질문</label>
          <input value={q} onChange={e => setQ(e.target.value)} className="w-full bg-neutral-800 p-3 rounded-lg outline-none" />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">서브 타이틀</label>
          <input value={s} onChange={e => setS(e.target.value)} className="w-full bg-neutral-800 p-3 rounded-lg outline-none" />
        </div>
        <button onClick={() => onUpdate(q, s)} className="w-full bg-white text-black py-3 rounded-lg font-bold">변경사항 적용</button>
      </div>
    </div>
  );
}