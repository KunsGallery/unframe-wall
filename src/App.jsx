import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Clock3,
  Copy,
  Download,
  Eye,
  EyeOff,
  Heart,
  Images,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageCircleMore,
  MonitorUp,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { appId, auth, db, isFirebaseReady, storage } from './lib/firebase';
import {
  AURA_THEMES,
  createAuraSpectrum,
  createSessionCode,
  DEFAULT_SESSION,
  getAuraColor,
  mergeSession,
  normalizeCode,
  resolveRoute,
  routeTo,
} from './lib/session';
import {
  ArtworkManager,
  ArtworkParticipant,
  ArtworkStage,
  RemoteController,
} from './components/ArtworkExperience';

const sessionRef = (code) => doc(db, 'artifacts', appId, 'sessions', code);
const messagesRef = (code) => collection(db, 'artifacts', appId, 'sessions', code, 'messages');
const likesRef = (code, uid) => collection(db, 'artifacts', appId, 'sessions', code, 'participants', uid, 'likes');
const artworksRef = (code) => collection(db, 'artifacts', appId, 'sessions', code, 'artworks');
const artworkDetailsRef = (code) => collection(db, 'artifacts', appId, 'sessions', code, 'artworkDetails');
const titlesRef = (code, artworkId) => collection(db, 'artifacts', appId, 'sessions', code, 'artworks', artworkId, 'titles');
const titleVotesRef = (code, uid) => collection(db, 'artifacts', appId, 'sessions', code, 'participants', uid, 'titleVotes');

export default function App() {
  const [route, setRoute] = useState(resolveRoute);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [likedIds, setLikedIds] = useState(new Set());
  const [artworks, setArtworks] = useState([]);
  const [artworkDetails, setArtworkDetails] = useState([]);
  const [artworkTitles, setArtworkTitles] = useState([]);
  const [votedTitleIds, setVotedTitleIds] = useState(new Set());
  const [ticket, setTicket] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const syncRoute = () => setRoute(resolveRoute());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    if (!auth) return undefined;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser || nextUser.isAnonymous || !db) {
        setIsAdmin(false);
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, 'artifacts', appId, 'admins', nextUser.uid));
        setIsAdmin(adminSnap.exists() && adminSnap.data().active !== false);
      } catch {
        setIsAdmin(false);
      }
    });

    if (!auth.currentUser) {
      const initialToken = globalThis.__initial_auth_token;
      const signIn = initialToken
        ? signInWithCustomToken(auth, initialToken)
        : signInAnonymously(auth);
      signIn.catch((error) => setNotice(error.message));
    }
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!db || !route.code || !user) {
      return undefined;
    }

    const stopSession = onSnapshot(
      sessionRef(route.code),
      (snapshot) => setSession(snapshot.exists() ? mergeSession({ id: snapshot.id, ...snapshot.data() }) : null),
      () => setSession(null),
    );

    const source = route.view === 'admin' && isAdmin
      ? messagesRef(route.code)
      : query(messagesRef(route.code), where('status', '==', 'approved'));
    const stopMessages = onSnapshot(
      source,
      (snapshot) => {
        const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        next.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setMessages(next);
      },
      () => setMessages([]),
    );

    const stopLikes = onSnapshot(
      likesRef(route.code, user.uid),
      (snapshot) => setLikedIds(new Set(snapshot.docs.map((item) => item.id))),
      () => setLikedIds(new Set()),
    );

    return () => {
      stopSession();
      stopMessages();
      stopLikes();
    };
  }, [route.code, route.view, user, isAdmin]);

  useEffect(() => {
    if (!db || !route.code || !user) return undefined;
    const stopArtworks = onSnapshot(
      artworksRef(route.code),
      (snapshot) => {
        const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        next.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        setArtworks(next);
      },
      () => setArtworks([]),
    );
    const stopVotes = onSnapshot(
      titleVotesRef(route.code, user.uid),
      (snapshot) => setVotedTitleIds(new Set(snapshot.docs.map((item) => item.id))),
      () => setVotedTitleIds(new Set()),
    );
    return () => {
      stopArtworks();
      stopVotes();
    };
  }, [route.code, user]);

  useEffect(() => {
    if (!db || !route.code || !user) return undefined;
    const activeId = session?.stage?.artworkId;
    const source = isAdmin
      ? artworkDetailsRef(route.code)
      : session?.stage?.phase === 'reveal' && activeId
        ? doc(artworkDetailsRef(route.code), activeId)
        : null;
    if (!source) return undefined;
    return onSnapshot(
      source,
      (snapshot) => {
        const next = 'docs' in snapshot
          ? snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
          : snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : [];
        setArtworkDetails(next);
      },
      () => setArtworkDetails([]),
    );
  }, [route.code, user, isAdmin, session?.stage?.artworkId, session?.stage?.phase]);

  useEffect(() => {
    const artworkId = session?.stage?.artworkId;
    const runId = session?.stage?.runId;
    if (!db || !route.code || !user || !artworkId || !runId) return undefined;
    const canSeeAllTitles = isAdmin || ['vote', 'reveal'].includes(session.stage.phase);
    const source = canSeeAllTitles
      ? query(titlesRef(route.code, artworkId), where('runId', '==', runId))
      : doc(titlesRef(route.code, artworkId), `${runId}_${user.uid}`);
    const stopTitles = onSnapshot(
      source,
      (snapshot) => {
        const next = 'docs' in snapshot
          ? snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
          : snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : [];
        next.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        setArtworkTitles(next);
      },
      () => setArtworkTitles([]),
    );
    return stopTitles;
  }, [route.code, user, isAdmin, session?.stage?.artworkId, session?.stage?.phase, session?.stage?.runId]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const createSession = async (code, initial = {}) => {
    if (!isAdmin) throw new Error('관리자 권한이 필요합니다.');
    const normalized = normalizeCode(code || createSessionCode());
    const target = sessionRef(normalized);
    if ((await getDoc(target)).exists()) throw new Error('이미 사용 중인 참여 코드입니다.');
    await setDoc(target, {
      ...DEFAULT_SESSION,
      ...initial,
      code: normalized,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    routeTo('admin', normalized);
  };

  const updateSession = async (next) => {
    await updateDoc(sessionRef(route.code), { ...next, updatedAt: serverTimestamp() });
    showNotice('설정을 저장했습니다.');
  };

  const submitMessage = async (text) => {
    if (!user || session.status !== 'live') throw new Error('현재 참여가 잠시 멈춰 있습니다.');
    const scores = createAuraSpectrum(text);
    const payload = {
      text: text.trim(),
      scores,
      likes: 0,
      userId: user.uid,
      status: session.moderationMode === 'pre' ? 'pending' : 'approved',
      createdAt: serverTimestamp(),
    };
    const created = doc(messagesRef(route.code));
    const participant = doc(db, 'artifacts', appId, 'sessions', route.code, 'participants', user.uid);
    const batch = writeBatch(db);
    batch.set(created, payload);
    batch.set(participant, { lastSubmittedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    const nextTicket = { ...payload, id: created.id };
    setTicket(nextTicket);
    return nextTicket;
  };

  const toggleLike = async (messageId) => {
    if (!user) return;
    const like = doc(likesRef(route.code, user.uid), messageId);
    const message = doc(messagesRef(route.code), messageId);
    await runTransaction(db, async (transaction) => {
      const [likeSnap, messageSnap] = await Promise.all([transaction.get(like), transaction.get(message)]);
      if (!messageSnap.exists()) return;
      const currentLikes = Math.max(0, Number(messageSnap.data().likes || 0));
      if (likeSnap.exists()) {
        transaction.delete(like);
        transaction.update(message, { likes: Math.max(0, currentLikes - 1) });
      } else {
        transaction.set(like, { createdAt: serverTimestamp() });
        transaction.update(message, { likes: currentLikes + 1 });
      }
    });
  };

  const setMessageStatus = (messageId, status) =>
    updateDoc(doc(messagesRef(route.code), messageId), { status, moderatedAt: serverTimestamp() });

  const deleteMessage = (messageId) => deleteDoc(doc(messagesRef(route.code), messageId));

  const clearMessages = async () => {
    let snapshot = await getDocs(query(messagesRef(route.code), limit(400)));
    while (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.docs.forEach((item) => batch.delete(item.ref));
      await batch.commit();
      snapshot = await getDocs(query(messagesRef(route.code), limit(400)));
    }
    showNotice('모든 응답을 삭제했습니다.');
  };

  const uploadArtwork = async ({ file, title, artist, description }) => {
    if (!isAdmin || !storage) throw new Error('작품을 업로드할 관리자 권한이 필요합니다.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WEBP 이미지만 등록할 수 있습니다.');
    if (file.size >= 12 * 1024 * 1024) throw new Error('이미지는 12MB 미만으로 등록해 주세요.');
    const artworkDoc = doc(artworksRef(route.code));
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `artifacts/${appId}/sessions/${route.code}/artworks/${artworkDoc.id}/original.${extension}`;
    const target = storageRef(storage, path);
    await uploadBytes(target, file, { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' });
    const imageUrl = await getDownloadURL(target);
    const batch = writeBatch(db);
    batch.set(artworkDoc, {
      imageUrl,
      storagePath: path,
      submissionCount: 0,
      order: Date.now(),
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
    batch.set(doc(artworkDetailsRef(route.code), artworkDoc.id), {
      title: title.trim(),
      artist: artist.trim(),
      description: description.trim(),
      artworkId: artworkDoc.id,
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (error) {
      await deleteObject(target).catch(() => undefined);
      throw error;
    }
    showNotice('작품을 등록했습니다.');
  };

  const removeArtwork = async (artwork) => {
    if (!isAdmin) return;
    let titleSnapshot = await getDocs(query(titlesRef(route.code, artwork.id), limit(400)));
    while (!titleSnapshot.empty) {
      const titleBatch = writeBatch(db);
      titleSnapshot.docs.forEach((item) => titleBatch.delete(item.ref));
      await titleBatch.commit();
      titleSnapshot = await getDocs(query(titlesRef(route.code, artwork.id), limit(400)));
    }
    const batch = writeBatch(db);
    batch.delete(doc(artworksRef(route.code), artwork.id));
    batch.delete(doc(artworkDetailsRef(route.code), artwork.id));
    await batch.commit();
    if (artwork.storagePath && storage) {
      await deleteObject(storageRef(storage, artwork.storagePath)).catch(() => undefined);
    }
    if (session.stage?.artworkId === artwork.id) {
      await updateSession({ stage: { mode: 'wall', artworkId: null, phase: null } });
    }
    showNotice('작품을 삭제했습니다.');
  };

  const startArtwork = async (artworkId) => {
    const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
    const batch = writeBatch(db);
    batch.update(doc(artworksRef(route.code), artworkId), { submissionCount: 0, currentRunId: runId, lastSubmissionId: null });
    batch.update(sessionRef(route.code), {
      status: 'live',
      stage: { mode: 'artwork', artworkId, phase: 'collect', runId },
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    showNotice('작품 제목 수집을 시작했습니다.');
  };

  const setArtworkPhase = (phase) => {
    if (!session.stage?.artworkId) return Promise.resolve();
    return updateSession({ stage: { ...session.stage, mode: 'artwork', phase } });
  };

  const stopArtwork = () => updateSession({ stage: { mode: 'wall', artworkId: null, phase: null } });

  const submitArtworkTitle = async (text) => {
    const artworkId = session.stage?.artworkId;
    const runId = session.stage?.runId;
    if (!user || session.stage?.mode !== 'artwork' || session.stage?.phase !== 'collect' || !artworkId || !runId) {
      throw new Error('현재는 제목을 제출할 수 없습니다.');
    }
    const titleDoc = doc(titlesRef(route.code, artworkId), `${runId}_${user.uid}`);
    if ((await getDoc(titleDoc)).exists()) throw new Error('이 작품에는 이미 제목을 제출했습니다.');
    const artworkDoc = doc(artworksRef(route.code), artworkId);
    const batch = writeBatch(db);
    batch.set(titleDoc, {
      text: text.trim(),
      artworkId,
      runId,
      userId: user.uid,
      likes: 0,
      createdAt: serverTimestamp(),
    });
    batch.update(artworkDoc, { submissionCount: increment(1), lastSubmissionId: titleDoc.id });
    await batch.commit();
  };

  const toggleTitleVote = async (title) => {
    if (!user || session.stage?.phase !== 'vote') return;
    const artworkId = session.stage.artworkId;
    const voteDoc = doc(titleVotesRef(route.code, user.uid), title.id);
    const titleDoc = doc(titlesRef(route.code, artworkId), title.id);
    await runTransaction(db, async (transaction) => {
      const [voteSnap, titleSnap] = await Promise.all([transaction.get(voteDoc), transaction.get(titleDoc)]);
      if (!titleSnap.exists()) return;
      const likes = Math.max(0, Number(titleSnap.data().likes || 0));
      if (voteSnap.exists()) {
        transaction.delete(voteDoc);
        transaction.update(titleDoc, { likes: Math.max(0, likes - 1) });
      } else {
        transaction.set(voteDoc, { artworkId, createdAt: serverTimestamp() });
        transaction.update(titleDoc, { likes: likes + 1 });
      }
    });
  };

  if (!isFirebaseReady) return <ConfigurationRequired />;
  if (!authReady) return <LoadingScreen label="공간을 준비하고 있습니다" />;

  const visibleSession = session === null
    ? null
    : route.code && session?.id !== route.code
      ? undefined
      : session;
  const activeArtworkId = visibleSession?.stage?.artworkId;
  const activeRunId = visibleSession?.stage?.runId;
  const mergedArtworks = artworks.map((artwork) => ({
    ...artwork,
    ...(artworkDetails.find((detail) => detail.id === artwork.id) || {}),
  }));
  const activeArtwork = mergedArtworks.find((artwork) => artwork.id === activeArtworkId) || null;
  const activeTitles = artworkTitles.filter((title) => title.artworkId === activeArtworkId && title.runId === activeRunId);
  const myArtworkTitle = activeTitles.find((title) => title.userId === user?.uid) || null;
  const artworkMode = visibleSession?.stage?.mode === 'artwork';

  return (
    <div className="app-shell">
      {route.view === 'home' && <Home onJoin={(code) => routeTo('join', code)} onAdmin={() => routeTo('admin')} />}
      {route.view === 'join' && (
        <SessionGate session={visibleSession} code={route.code}>
          {artworkMode ? (
            <ArtworkParticipant
              artwork={activeArtwork}
              phase={visibleSession.stage.phase}
              titles={activeTitles}
              myTitle={myArtworkTitle}
              votedTitleIds={votedTitleIds}
              onSubmit={submitArtworkTitle}
              onVote={toggleTitleVote}
            />
          ) : (
            <VisitorExperience
              session={visibleSession}
              messages={messages.slice(0, 12)}
              likedIds={likedIds}
              onLike={toggleLike}
              onSubmit={submitMessage}
            />
          )}
        </SessionGate>
      )}
      {route.view === 'wall' && (
        <SessionGate session={visibleSession} code={route.code}>
          {artworkMode ? (
            <ArtworkStage
              artwork={activeArtwork}
              phase={visibleSession.stage.phase}
              titles={activeTitles}
              submissionCount={activeArtwork?.submissionCount || 0}
            />
          ) : <DisplayWall session={visibleSession} messages={messages} code={route.code} />}
        </SessionGate>
      )}
      {route.view === 'admin' && (
        isAdmin ? (
          <AdminArea
            user={user}
            code={route.code}
            session={visibleSession}
            messages={messages}
            onCreate={createSession}
            onUpdate={updateSession}
            onModerate={setMessageStatus}
            onDelete={deleteMessage}
            onClear={clearMessages}
            artworks={mergedArtworks}
            artworkTitles={activeTitles}
            onUploadArtwork={uploadArtwork}
            onDeleteArtwork={removeArtwork}
            onStartArtwork={startArtwork}
            onArtworkPhase={setArtworkPhase}
            onStopArtwork={stopArtwork}
            onSignOut={() => signOut(auth)}
          />
        ) : (
          <AdminLogin user={user} />
        )
      )}
      {route.view === 'remote' && (
        isAdmin ? (
          <SessionGate session={visibleSession} code={route.code}>
            <RemoteController
              code={route.code}
              session={visibleSession}
              artworks={mergedArtworks}
              activeArtwork={activeArtwork}
              titleCount={activeArtwork?.submissionCount || 0}
              onStart={startArtwork}
              onPhase={setArtworkPhase}
              onStop={stopArtwork}
              onOpenWall={() => window.open(`${window.location.origin}/wall/${route.code}`, '_blank')}
              onSignOut={() => signOut(auth)}
            />
          </SessionGate>
        ) : <AdminLogin user={user} />
      )}
      {ticket && <SuccessTicket ticket={ticket} session={visibleSession} onClose={() => setTicket(null)} />}
      {notice && <div className="toast"><Check size={16} /> {notice}</div>}
    </div>
  );
}

function ConfigurationRequired() {
  return (
    <main className="state-page">
      <div className="state-icon"><Settings2 /></div>
      <p className="eyebrow">Configuration required</p>
      <h1>Firebase 연결이 필요합니다.</h1>
      <p>프로젝트의 <code>.env</code> 파일에 Firebase 환경 변수를 설정해 주세요.</p>
    </main>
  );
}

function LoadingScreen({ label }) {
  return (
    <main className="state-page">
      <div className="brand-orbit"><span /></div>
      <p className="eyebrow">UNFRAME LIVE</p>
      <p>{label}</p>
    </main>
  );
}

function SessionGate({ session, code, children }) {
  if (session === undefined) return <LoadingScreen label="세션에 연결하고 있습니다" />;
  if (!code || session === null) {
    return (
      <main className="state-page">
        <button className="back-link" onClick={() => routeTo('home')}><ArrowLeft size={16} /> 처음으로</button>
        <div className="state-icon"><QrCode /></div>
        <p className="eyebrow">Session not found</p>
        <h1>참여 코드를 확인해 주세요.</h1>
        <p>{code ? `${code} 세션을 찾을 수 없습니다.` : '세션 코드가 비어 있습니다.'}</p>
      </main>
    );
  }
  return children;
}

function Home({ onJoin, onAdmin }) {
  const [code, setCode] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (normalizeCode(code).length >= 4) onJoin(normalizeCode(code));
  };

  return (
    <main className="home-page">
      <nav className="home-nav">
        <Logo />
        <button className="text-button" onClick={onAdmin}><LockKeyhole size={15} /> 운영자</button>
      </nav>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> The room is listening</p>
          <h1>생각이 모이면,<br /><em>공간이 반응합니다.</em></h1>
          <p className="hero-description">질문에 답하고 서로의 감정에 공감해 보세요. 당신의 한 문장이 이 공간의 일부가 됩니다.</p>
          <form className="join-form" onSubmit={submit}>
            <label htmlFor="session-code">참여 코드</label>
            <div className="join-control">
              <input id="session-code" value={code} onChange={(event) => setCode(normalizeCode(event.target.value))} placeholder="예: FRAME7" autoComplete="off" />
              <button disabled={code.length < 4} aria-label="세션 입장"><ArrowRight /></button>
            </div>
          </form>
          <p className="join-hint">앞 화면의 QR을 촬영했다면 코드 입력 없이 바로 연결됩니다.</p>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="aura aura-one" />
          <div className="aura aura-two" />
          <div className="aura aura-three" />
          <div className="floating-note note-one">어제와 다른<br />시선으로 보게 됐어요.</div>
          <div className="floating-note note-two">낯선 감각이<br />오래 남아요.</div>
          <div className="floating-note note-three">우리의 생각이<br />하나의 장면으로.</div>
        </div>
      </section>
      <footer className="home-footer"><span>UNFRAME © 2026</span><span>Live participatory experience</span></footer>
    </main>
  );
}

function Logo({ inverse = false }) {
  return <div className={`logo ${inverse ? 'inverse' : ''}`}><span className="logo-mark" />UNFRAME <b>LIVE</b></div>;
}

function VisitorExperience({ session, messages, likedIds, onLike, onSubmit }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const isPaused = session.status !== 'live';

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || sending || isPaused) return;
    setSending(true);
    setError('');
    try {
      await onSubmit(text);
      setText('');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="visitor-page">
      <header className="visitor-header">
        <Logo />
        <span className={`status-pill ${isPaused ? 'paused' : ''}`}><span /> {isPaused ? 'PAUSED' : 'LIVE'}</span>
      </header>
      <section className="visitor-intro">
        <span className="step-number">01</span>
        <p className="eyebrow">Today’s question</p>
        <h1>{session.input.question}</h1>
        <p>{session.input.subtitle}</p>
      </section>
      <section className="composer-card">
        <form onSubmit={send}>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={isPaused ? '진행자가 참여를 잠시 멈췄습니다.' : session.input.placeholder}
            maxLength={180}
            disabled={isPaused || sending}
          />
          <div className="composer-meta"><span>{text.length} / 180</span><span>익명으로 공유됩니다</span></div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={!text.trim() || sending || isPaused}>
            {sending ? <><LoaderCircle className="spin" /> 생각 보내는 중</> : <><Send /> {session.input.buttonText}</>}
          </button>
        </form>
        <div className="event-guide"><Sparkles /><p><b>Aura Ticket</b>{session.input.eventGuide}</p></div>
      </section>
      <section className="recent-section">
        <div className="section-heading"><div><p className="eyebrow">Shared by the room</p><h2>방금 도착한 생각</h2></div><span>{messages.length} traces</span></div>
        <div className="trace-list">
          {messages.length === 0 && <div className="empty-card">첫 번째 생각을 남겨보세요.</div>}
          {messages.map((message) => (
            <article className="trace-card" key={message.id}>
              <span className="trace-aura" style={{ background: getAuraColor(message.scores) }} />
              <p>{message.text}</p>
              <button className={likedIds.has(message.id) ? 'liked' : ''} onClick={() => onLike(message.id)} aria-label="공감하기">
                <Heart /> <span>{message.likes || 0}</span>
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function DisplayWall({ session, messages, code }) {
  const joinUrl = `${window.location.origin}/join/${code}`;
  return (
    <main className="wall-page">
      <div className="wall-grid" />
      <header className="wall-header"><Logo inverse /><div className="wall-meta"><span><span className="live-dot" /> {session.status === 'live' ? 'LIVE SESSION' : 'PAUSED'}</span><span>{messages.length} RESPONSES</span></div></header>
      <section className="wall-question">
        <p className="eyebrow">Question of the room</p>
        <h1 style={{ fontSize: `clamp(42px, 6vw, ${session.display.questionSize})` }}>{session.display.question}</h1>
        <p>{session.display.subtitle}</p>
      </section>
      <div className="wall-messages">
        {messages.slice(0, 16).map((message, index) => <WallMessage key={`${message.id}-${message.likes || 0}`} message={message} index={index} />)}
      </div>
      <aside className="wall-join-card">
        <QrImage value={joinUrl} size={116} />
        <div><p>SCAN TO JOIN</p><strong>{code}</strong><span>휴대폰 카메라로 참여하세요</span></div>
      </aside>
      <footer className="wall-footer"><span>Every perspective changes the room.</span><span>UNFRAME LIVE / {code}</span></footer>
    </main>
  );
}

function WallMessage({ message, index }) {
  const position = useMemo(() => {
    const seed = Array.from(message.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return {
      left: 4 + ((seed * 17) % 78),
      top: 9 + ((seed * 11) % 72),
      rotate: -4 + (seed % 9),
    };
  }, [message.id]);

  const strongest = Object.entries(message.scores || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    <article
      className={`wall-message ${message.likes ? 'pulse' : ''}`}
      style={{
        '--x': `${position.left}vw`,
        '--y': `${position.top}vh`,
        '--rotation': `${position.rotate}deg`,
        '--delay': `${(index % 8) * -2.2}s`,
        '--aura': getAuraColor(message.scores),
      }}
    >
      <p>{message.text}</p>
      <div><span>{strongest ? AURA_THEMES[strongest]?.label : 'Trace'}</span>{message.likes > 0 && <span><Heart /> {message.likes}</span>}</div>
    </article>
  );
}

function QrImage({ value, size = 160 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: '#101522', light: '#ffffff' } }).then(setSrc);
  }, [value, size]);
  return src ? <img className="qr-image" src={src} width={size} height={size} alt="참여 QR 코드" /> : <div className="qr-placeholder" />;
}

function SuccessTicket({ ticket, session, onClose }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const auraColor = getAuraColor(ticket.scores);

  useEffect(() => {
    confetti({ particleCount: 130, spread: 78, origin: { y: 0.72 }, colors: ['#1648ff', '#38bda7', '#ff8e3c', '#885cf6'] });
  }, []);

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, backgroundColor: '#f7f4ee' });
      const link = document.createElement('a');
      link.download = `UNFRAME-AURA-${ticket.id.slice(0, 6).toUpperCase()}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setSaving(false);
    }
  };

  const topAuras = Object.entries(ticket.scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-title">
      <button className="modal-close" onClick={onClose} aria-label="닫기"><X /></button>
      <div className="ticket-intro"><CheckCircle2 /><p className="eyebrow">Your thought is now live</p><h2 id="ticket-title">생각이 공간에 도착했습니다.</h2></div>
      <article className="aura-ticket" ref={cardRef} style={{ '--ticket-aura': auraColor }}>
        <header><Logo /><span>#{ticket.id.slice(0, 6).toUpperCase()}</span></header>
        <div className="ticket-orb"><span /></div>
        <div className="ticket-copy"><p>A perspective from today</p><blockquote>“{ticket.text}”</blockquote></div>
        <div className="aura-bars">
          {topAuras.map(([key, value]) => <div key={key}><span>{AURA_THEMES[key]?.label}</span><i><b style={{ width: `${value}%`, background: AURA_THEMES[key]?.color }} /></i><strong>{value}%</strong></div>)}
        </div>
        <footer><span>{session.title}</span><span>{new Date().toLocaleDateString('ko-KR')}</span></footer>
      </article>
      <button className="primary-button save-ticket" onClick={save} disabled={saving}><Download /> {saving ? '이미지 만드는 중' : 'Aura Ticket 저장'}</button>
      <button className="text-button" onClick={onClose}>다른 생각 둘러보기</button>
    </div>
  );
}

function AdminLogin({ user }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('이메일, 비밀번호 또는 관리자 권한을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login">
      <section className="login-brand">
        <Logo inverse />
        <div><p className="eyebrow">Control the room</p><h1>모임의 흐름을<br />한 화면에서.</h1><p>세션을 만들고 질문을 바꾸며, 도착하는 목소리를 안전하게 운영하세요.</p></div>
        <div className="security-note"><ShieldCheck /><span><b>Protected workspace</b>Firebase 관리자 계정으로만 접근할 수 있습니다.</span></div>
      </section>
      <section className="login-panel">
        <button className="back-link" onClick={() => routeTo('home')}><ArrowLeft /> 참여 화면으로</button>
        <form onSubmit={submit}>
          <p className="eyebrow">Admin access</p>
          <h2>운영자 로그인</h2>
          <p className="login-description">등록된 관리자 계정으로 로그인해 주세요.</p>
          <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="host@unframe.kr" required /></label>
          <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <KeyRound />} 로그인</button>
          {user && !user.isAnonymous && <p className="permission-warning">로그인은 됐지만 관리자 문서가 없습니다. Firebase의 admins 컬렉션을 확인해 주세요.</p>}
        </form>
      </section>
    </main>
  );
}

function AdminArea({ user, code, session, messages, onCreate, onUpdate, onModerate, onDelete, onClear, artworks, artworkTitles, onUploadArtwork, onDeleteArtwork, onStartArtwork, onArtworkPhase, onStopArtwork, onSignOut }) {
  if (!code) return <SessionCreator user={user} onCreate={onCreate} onSignOut={onSignOut} />;
  if (session === undefined) return <LoadingScreen label="관리자 콘솔을 불러오고 있습니다" />;
  if (session === null) return <MissingAdminSession code={code} onCreate={onCreate} />;
  return <AdminConsole {...{ user, code, session, messages, onUpdate, onModerate, onDelete, onClear, artworks, artworkTitles, onUploadArtwork, onDeleteArtwork, onStartArtwork, onArtworkPhase, onStopArtwork, onSignOut }} />;
}

function SessionCreator({ user, onCreate, onSignOut }) {
  const [code, setCode] = useState(createSessionCode);
  const [title, setTitle] = useState('UNFRAME LIVE');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      await onCreate(code, { title });
    } catch (createError) {
      setError(createError.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="creator-page">
      <header><Logo /><div><span>{user.email}</span><button className="icon-button" onClick={onSignOut} title="로그아웃"><LogOut /></button></div></header>
      <section className="creator-card">
        <div className="creator-copy"><p className="eyebrow">Start a new room</p><h1>새로운 라이브 세션을<br />열어볼까요?</h1><p>참여 코드는 QR과 함께 생성됩니다. 세션을 만든 뒤 질문과 운영 방식을 세밀하게 설정할 수 있어요.</p></div>
        <form onSubmit={submit}>
          <label>세션 이름<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={50} /></label>
          <label>참여 코드<div className="code-input"><input value={code} onChange={(event) => setCode(normalizeCode(event.target.value))} minLength={4} /><button type="button" onClick={() => setCode(createSessionCode())}><RefreshCw /></button></div></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={creating || code.length < 4}><Plus /> {creating ? '세션 만드는 중' : '세션 만들기'}</button>
        </form>
      </section>
    </main>
  );
}

function MissingAdminSession({ code, onCreate }) {
  const [creating, setCreating] = useState(false);
  return (
    <main className="state-page">
      <div className="state-icon"><Plus /></div><p className="eyebrow">Empty session</p><h1>{code} 세션이 아직 없습니다.</h1>
      <p>이 참여 코드로 새 세션을 바로 만들 수 있습니다.</p>
      <button className="primary-button compact" disabled={creating} onClick={async () => { setCreating(true); await onCreate(code); }}><Plus /> 세션 생성</button>
    </main>
  );
}

function AdminConsole({ code, session, messages, onUpdate, onModerate, onDelete, onClear, artworks, artworkTitles, onUploadArtwork, onDeleteArtwork, onStartArtwork, onArtworkPhase, onStopArtwork, onSignOut }) {
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState(session);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [filter, setFilter] = useState('all');
  const joinUrl = `${window.location.origin}/join/${code}`;
  const wallUrl = `${window.location.origin}/wall/${code}`;
  const remoteUrl = `${window.location.origin}/remote/${code}`;

  useEffect(() => setDraft(session), [session]);

  const copy = async (value, label) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1400);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate({
        title: draft.title,
        status: draft.status,
        moderationMode: draft.moderationMode,
        display: draft.display,
        input: draft.input,
      });
    } finally {
      setSaving(false);
    }
  };

  const setNested = (section, key, value) => setDraft((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  const pending = messages.filter((message) => message.status === 'pending').length;
  const approved = messages.filter((message) => message.status === 'approved').length;
  const likes = messages.reduce((sum, message) => sum + Number(message.likes || 0), 0);
  const filtered = messages.filter((message) => filter === 'all' || message.status === filter);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Logo inverse />
        <div className="session-chip"><span className={session.status} /><div><small>SESSION</small><b>{code}</b></div></div>
        <nav>
          <AdminNav icon={LayoutDashboard} label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
          <AdminNav icon={Settings2} label="Experience" active={tab === 'experience'} onClick={() => setTab('experience')} />
          <AdminNav icon={Images} label="Artwork Title Lab" count={session.stage?.mode === 'artwork' ? artworkTitles.length || undefined : undefined} active={tab === 'artworks'} onClick={() => setTab('artworks')} />
          <AdminNav icon={MessageCircleMore} label="Responses" count={pending || undefined} active={tab === 'responses'} onClick={() => setTab('responses')} />
          <AdminNav icon={QrCode} label="Invite & QR" active={tab === 'invite'} onClick={() => setTab('invite')} />
        </nav>
        <div className="sidebar-bottom"><button onClick={() => window.open(wallUrl, '_blank')}><MonitorUp /> 월 화면 열기</button><button onClick={onSignOut}><LogOut /> 로그아웃</button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar"><div><p className="eyebrow">{session.title}</p><h1>{adminTitle(tab)}</h1></div><div className="top-actions"><span className={`status-pill ${session.status !== 'live' ? 'paused' : ''}`}><span /> {session.status.toUpperCase()}</span><button className="secondary-button" onClick={() => window.open(wallUrl, '_blank')}><Eye /> Live wall</button></div></header>

        {tab === 'overview' && (
          <div className="admin-content">
            <div className="metric-grid"><Metric icon={MessageCircleMore} label="전체 응답" value={messages.length} detail={`${approved}개 공개 중`} /><Metric icon={Clock3} label="승인 대기" value={pending} detail={pending ? '확인이 필요해요' : '모두 확인했어요'} accent={pending > 0} /><Metric icon={Heart} label="공감" value={likes} detail="참여자 반응 합계" /><Metric icon={Users} label="세션 상태" value={session.status === 'live' ? 'ON' : 'OFF'} detail={session.status === 'live' ? '응답을 받고 있어요' : '참여가 멈춰 있어요'} /></div>
            <div className="overview-grid">
              <article className="panel current-question"><div className="panel-heading"><div><p className="eyebrow">Current question</p><h2>지금 화면에 보이는 질문</h2></div><button className="text-button" onClick={() => setTab('experience')}>편집 <ChevronRight /></button></div><blockquote>{session.display.question}</blockquote><p>{session.display.subtitle}</p><button className={`session-toggle ${session.status}`} onClick={() => onUpdate({ status: session.status === 'live' ? 'paused' : 'live' })}>{session.status === 'live' ? <CirclePause /> : <CirclePlay />}{session.status === 'live' ? '참여 일시정지' : '참여 다시 시작'}</button></article>
              <article className="panel quick-join"><div className="panel-heading"><div><p className="eyebrow">Quick join</p><h2>참여 QR</h2></div></div><div className="quick-qr"><QrImage value={joinUrl} size={150} /><div><strong>{code}</strong><p>QR을 앞 화면에 띄우거나 링크를 공유하세요.</p><button className="secondary-button" onClick={() => copy(joinUrl, 'join')}>{copied === 'join' ? <Check /> : <Copy />} {copied === 'join' ? '복사됨' : '링크 복사'}</button></div></div></article>
            </div>
            <article className="panel recent-admin"><div className="panel-heading"><div><p className="eyebrow">Latest responses</p><h2>최근 도착한 생각</h2></div><button className="text-button" onClick={() => setTab('responses')}>전체 보기 <ChevronRight /></button></div><ResponseRows messages={messages.slice(0, 5)} onModerate={onModerate} onDelete={onDelete} compact /></article>
          </div>
        )}

        {tab === 'experience' && (
          <div className="admin-content settings-layout">
            <section className="panel settings-form">
              <div className="panel-heading"><div><p className="eyebrow">Live content</p><h2>질문과 참여 화면</h2></div></div>
              <Field label="세션 이름" value={draft.title} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} />
              <Field label="월 메인 질문" value={draft.display.question} onChange={(value) => setNested('display', 'question', value)} textarea />
              <Field label="월 보조 문구" value={draft.display.subtitle} onChange={(value) => setNested('display', 'subtitle', value)} />
              <div className="field-row"><Field label="모바일 질문" value={draft.input.question} onChange={(value) => setNested('input', 'question', value)} /><Field label="전송 버튼" value={draft.input.buttonText} onChange={(value) => setNested('input', 'buttonText', value)} /></div>
              <Field label="모바일 안내 문구" value={draft.input.subtitle} onChange={(value) => setNested('input', 'subtitle', value)} />
              <Field label="입력창 예시" value={draft.input.placeholder} onChange={(value) => setNested('input', 'placeholder', value)} />
              <div className="field-row"><Field label="질문 크기" type="range" value={parseInt(draft.display.questionSize, 10) || 76} onChange={(value) => setNested('display', 'questionSize', `${value}px`)} /><SelectField label="응답 공개" value={draft.moderationMode} onChange={(value) => setDraft((current) => ({ ...current, moderationMode: value }))} options={[['post', '즉시 공개'], ['pre', '승인 후 공개']]} /></div>
              <button className="primary-button save-settings" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Check />} {saving ? '저장 중' : '변경사항 저장'}</button>
            </section>
            <aside className="phone-preview"><div className="phone-frame"><div className="phone-notch" /><p className="eyebrow">Today’s question</p><h3>{draft.input.question}</h3><p>{draft.input.subtitle}</p><div className="preview-textarea">{draft.input.placeholder}</div><div className="preview-button">{draft.input.buttonText}</div></div><p>모바일 미리보기</p></aside>
          </div>
        )}

        {tab === 'responses' && (
          <div className="admin-content">
            <article className="panel response-panel"><div className="response-toolbar"><div className="filter-tabs">{[['all', '전체'], ['pending', '승인 대기'], ['approved', '공개'], ['hidden', '숨김']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}<span>{value === 'all' ? messages.length : messages.filter((item) => item.status === value).length}</span></button>)}</div><div><button className="secondary-button" onClick={() => exportCsv(messages, code)}><Download /> CSV</button><button className="danger-button" onClick={() => window.confirm('이 세션의 모든 응답을 삭제할까요? 복구할 수 없습니다.') && onClear()}><Trash2 /> 전체 삭제</button></div></div><ResponseRows messages={filtered} onModerate={onModerate} onDelete={onDelete} /></article>
          </div>
        )}

        {tab === 'artworks' && (
          <ArtworkManager
            artworks={artworks}
            activeArtworkId={session.stage?.artworkId}
            phase={session.stage?.phase}
            titleCount={session.stage?.artworkId ? artworks.find((artwork) => artwork.id === session.stage.artworkId)?.submissionCount || 0 : 0}
            onUpload={onUploadArtwork}
            onDelete={onDeleteArtwork}
            onStart={onStartArtwork}
            onPhase={onArtworkPhase}
            onStop={onStopArtwork}
          />
        )}

        {tab === 'invite' && (
          <div className="admin-content invite-layout">
            <article className="panel invite-hero"><p className="eyebrow">Invite participants</p><h2>QR을 스캔하고<br />바로 참여하세요.</h2><QrImage value={joinUrl} size={260} /><strong>{code}</strong><p>{joinUrl}</p></article>
            <section className="invite-actions"><article className="panel"><QrCode /><div><h3>참여자 모바일</h3><p>답변을 작성하고 다른 참여자의 생각에 공감하는 화면입니다.</p><button className="secondary-button" onClick={() => copy(joinUrl, 'mobile')}>{copied === 'mobile' ? <Check /> : <Copy />} 링크 복사</button></div></article><article className="panel"><MonitorUp /><div><h3>앞 모니터 Live Wall</h3><p>질문, QR, 참여자의 응답이 실시간으로 반영되는 화면입니다.</p><div className="inline-actions"><button className="secondary-button" onClick={() => copy(wallUrl, 'wall')}>{copied === 'wall' ? <Check /> : <Copy />} 링크 복사</button><button className="primary-button compact" onClick={() => window.open(wallUrl, '_blank')}><Eye /> 열기</button></div></div></article><article className="panel"><Images /><div><h3>진행자 모바일 리모컨</h3><p>작품을 선택하고 제목 수집·투표·정답 공개를 휴대폰에서 제어합니다.</p><div className="remote-invite-compact"><QrImage value={remoteUrl} size={104} /><div className="inline-actions"><button className="secondary-button" onClick={() => copy(remoteUrl, 'remote')}>{copied === 'remote' ? <Check /> : <Copy />} 링크 복사</button><button className="primary-button compact" onClick={() => window.open(remoteUrl, '_blank')}><Eye /> 열기</button></div></div></div></article></section>
          </div>
        )}
      </section>
    </main>
  );
}

function adminTitle(tab) {
  return { overview: '오늘의 세션', experience: '경험 설정', artworks: 'Artwork Title Lab', responses: '응답 관리', invite: '참여 초대' }[tab];
}

function AdminNav({ icon, label, count, active, onClick }) {
  const IconComponent = icon;
  return <button className={active ? 'active' : ''} onClick={onClick}><IconComponent /> <span>{label}</span>{count && <b>{count}</b>}</button>;
}

function Metric({ icon, label, value, detail, accent }) {
  const IconComponent = icon;
  return <article className={`metric-card ${accent ? 'accent' : ''}`}><div><span><IconComponent /></span><small>{label}</small></div><strong>{value}</strong><p>{detail}</p></article>;
}

function Field({ label, value, onChange, textarea = false, type = 'text' }) {
  return <label className="admin-field"><span>{label}{type === 'range' && <b>{value}px</b>}</span>{textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input type={type} min={42} max={120} value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function SelectField({ label, value, onChange, options }) {
  return <label className="admin-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function ResponseRows({ messages, onModerate, onDelete, compact = false }) {
  if (!messages.length) return <div className="empty-responses"><MessageCircleMore /><p>아직 도착한 응답이 없습니다.</p></div>;
  return <div className={`response-list ${compact ? 'compact' : ''}`}>{messages.map((message) => <article className="response-row" key={message.id}><span className="response-aura" style={{ background: getAuraColor(message.scores) }} /><div className="response-copy"><p>{message.text}</p><span>#{message.id.slice(0, 6).toUpperCase()} · {formatTime(message.createdAt)}</span></div><span className={`moderation-status ${message.status}`}>{message.status === 'approved' ? '공개' : message.status === 'pending' ? '대기' : '숨김'}</span><span className="like-count"><Heart /> {message.likes || 0}</span><div className="response-actions">{message.status !== 'approved' && <button title="공개" onClick={() => onModerate(message.id, 'approved')}><Eye /></button>}{message.status === 'approved' && <button title="숨기기" onClick={() => onModerate(message.id, 'hidden')}><EyeOff /></button>}<button className="delete" title="삭제" onClick={() => window.confirm('이 응답을 삭제할까요?') && onDelete(message.id)}><Trash2 /></button></div></article>)}</div>;
}

function formatTime(timestamp) {
  if (!timestamp?.toDate) return '방금 전';
  return timestamp.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function exportCsv(messages, code) {
  const header = ['id', 'text', 'status', 'likes', 'blue', 'mint', 'orange', 'violet'];
  const rows = messages.map((message) => [message.id, message.text, message.status, message.likes || 0, message.scores?.BLUE || 0, message.scores?.MINT || 0, message.scores?.ORANGE || 0, message.scores?.VIOLET || 0]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  link.download = `unframe-${code}-responses.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
