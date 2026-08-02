import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  FileText,
  Heart,
  ImagePlus,
  Images,
  LoaderCircle,
  Medal,
  MonitorUp,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  Trophy,
  Vote,
} from 'lucide-react';

const phaseLabel = {
  collect: '제목 수집 중',
  vote: '제목 투표 중',
  reveal: '작품 정보 공개',
};

export function ArtworkParticipant({ artwork, phase, titles, myTitle, votedTitleIds, onSubmit, onVote }) {
  if (!artwork) return <ParticipantWaiting />;
  if (phase === 'collect') {
    return <ArtworkTitleSubmit artwork={artwork} myTitle={myTitle} onSubmit={onSubmit} />;
  }
  return <ArtworkTitleVote artwork={artwork} phase={phase} titles={titles} votedTitleIds={votedTitleIds} onVote={onVote} />;
}

function ParticipantWaiting() {
  return (
    <main className="art-participant waiting">
      <div className="participant-brand"><span /> UNFRAME LIVE</div>
      <div className="waiting-orbit"><Images /></div>
      <p className="eyebrow">Waiting for the host</p>
      <h1>다음 작품을<br />준비하고 있어요.</h1>
      <p>앞 화면을 함께 바라봐 주세요.</p>
    </main>
  );
}

function ArtworkTitleSubmit({ artwork, myTitle, onSubmit }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || sending || myTitle) return;
    setSending(true);
    setError('');
    try {
      await onSubmit(text.trim());
      setText('');
    } catch (submitError) {
      setError(submitError.code === 'permission-denied' ? '이미 제목을 제출했거나 수집이 종료됐습니다.' : submitError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="art-participant">
      <header className="art-mobile-header"><div className="participant-brand"><span /> UNFRAME LIVE</div><b><i /> TITLE LAB</b></header>
      <section className="art-mobile-hero">
        <p className="eyebrow">Look, imagine, name it</p>
        <h1>이 작품에<br />제목을 붙인다면?</h1>
        <p>정답은 잠시 잊고, 지금 떠오르는 제목을 적어보세요.</p>
      </section>
      <div className="art-mobile-preview"><img src={artwork.imageUrl} alt="제목을 추측할 작품" /></div>
      {myTitle ? (
        <section className="title-submitted-card">
          <div><Check /></div><p className="eyebrow">Your title arrived</p><h2>“{myTitle.text}”</h2><span>진행자가 투표를 열면 다른 제목들을 만나볼 수 있어요.</span>
        </section>
      ) : (
        <form className="title-submit-form" onSubmit={submit}>
          <label htmlFor="artwork-title">나만의 작품명</label>
          <input id="artwork-title" value={text} onChange={(event) => setText(event.target.value)} maxLength={60} placeholder="예: 파란 오후의 대화" autoComplete="off" />
          <div><span>{text.length} / 60</span><span>한 번만 제출할 수 있어요</span></div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={!text.trim() || sending}>{sending ? <LoaderCircle className="spin" /> : <Send />} {sending ? '전달하는 중' : '이 제목으로 제출'}</button>
        </form>
      )}
    </main>
  );
}

function ArtworkTitleVote({ artwork, phase, titles, votedTitleIds, onVote }) {
  const sorted = useMemo(() => [...titles].sort((a, b) => (b.likes || 0) - (a.likes || 0) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)), [titles]);
  return (
    <main className="art-participant vote-page">
      <header className="art-mobile-header"><div className="participant-brand"><span /> UNFRAME LIVE</div><b><i /> {phase === 'reveal' ? 'REVEAL' : 'VOTE NOW'}</b></header>
      <section className="vote-intro">
        <p className="eyebrow">The titles are here</p>
        <h1>{phase === 'reveal' ? '작품의 이야기를 확인해 보세요.' : '마음에 드는 제목에 공감해 주세요.'}</h1>
        <p>{phase === 'reveal' ? `${artwork.artist || '작가 미상'} · ${artwork.title || '제목 미상'}` : '여러 제목에 공감할 수 있으며 선택은 실시간으로 반영됩니다.'}</p>
      </section>
      <div className="vote-artwork-thumb"><img src={artwork.imageUrl} alt="투표 중인 작품" /></div>
      <section className="mobile-title-list">
        {sorted.map((title, index) => (
          <article className={`mobile-title-card ${index === 0 && title.likes > 0 ? 'leading' : ''}`} key={title.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h2>{title.text}</h2>
            <button disabled={phase !== 'vote'} className={votedTitleIds.has(title.id) ? 'voted' : ''} onClick={() => onVote(title)} aria-label={`${title.text}에 공감`}><Heart /><b>{title.likes || 0}</b></button>
          </article>
        ))}
        {!sorted.length && <div className="empty-card">도착한 제목을 기다리고 있어요.</div>}
      </section>
      {phase === 'reveal' && <section className="artwork-reveal-mobile"><p className="eyebrow">Original artwork</p><h2>{artwork.title || '제목 미상'}</h2>{artwork.artist && <h3>{artwork.artist}</h3>}{artwork.description && <p>{artwork.description}</p>}</section>}
    </main>
  );
}

export function ArtworkStage({ artwork, phase, titles, submissionCount }) {
  if (!artwork) return null;
  if (phase === 'collect') return <ArtworkCollectStage artwork={artwork} submissionCount={submissionCount} />;
  return <ArtworkTrophyStage artwork={artwork} phase={phase} titles={titles} />;
}

function ArtworkCollectStage({ artwork, submissionCount }) {
  const captions = Array.from({ length: Math.min(submissionCount, 28) }, (_, index) => index);
  return (
    <main className="gallery-stage collect-stage">
      <div className="gallery-ceiling" />
      <header><div className="stage-brand"><span /> UNFRAME LIVE</div><p><i /> TITLE LAB · COLLECTING</p></header>
      <section className="gallery-artwork-main"><div className="artwork-halo" /><div className="museum-frame"><img src={artwork.imageUrl} alt="제목을 맞히는 작품" /></div></section>
      <div className="caption-cluster left">{captions.filter((index) => index % 2 === 0).map((index) => <MysteryCaption key={index} index={index} />)}</div>
      <div className="caption-cluster right">{captions.filter((index) => index % 2 === 1).map((index) => <MysteryCaption key={index} index={index} />)}</div>
      <footer><div><b>{submissionCount}</b><span>개의 제목이 도착했어요</span></div><p>작품을 보고 당신만의 제목을 지어주세요.</p></footer>
    </main>
  );
}

function MysteryCaption({ index }) {
  return (
    <div className="mystery-caption" style={{ '--caption-delay': `${index * -0.35}s` }}>
      <i /><span><b /><b /><b /></span>
    </div>
  );
}

function ArtworkTrophyStage({ artwork, phase, titles }) {
  const sorted = [...titles].sort((a, b) => (b.likes || 0) - (a.likes || 0) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  const maxLikes = Math.max(1, ...sorted.map((title) => title.likes || 0));
  return (
    <main className={`gallery-stage trophy-stage ${phase === 'reveal' ? 'revealed' : ''}`}>
      <div className="gallery-ceiling" />
      <header><div className="stage-brand"><span /> UNFRAME LIVE</div><p><i /> {phase === 'reveal' ? 'ORIGINAL REVEALED' : 'VOTING LIVE'}</p></header>
      <section className="trophy-artwork"><div className="museum-frame"><img src={artwork.imageUrl} alt="현재 작품" /></div>{phase === 'reveal' && <div className="original-caption"><b>{artwork.title || '제목 미상'}</b><span>{artwork.artist || '작가 미상'}</span></div>}</section>
      <section className="title-trophy-grid">
        {sorted.map((title, index) => {
          const strength = (title.likes || 0) / maxLikes;
          return (
            <article className={`title-trophy ${index === 0 && title.likes > 0 ? 'winner' : ''}`} key={title.id} style={{ '--gold': strength, '--title-scale': 1 + Math.min(title.likes || 0, 10) * 0.035 }}>
              {index === 0 && title.likes > 0 ? <Trophy /> : <Medal />}
              <h2>{title.text}</h2><span><Heart /> {title.likes || 0}</span>
            </article>
          );
        })}
        {!sorted.length && <div className="trophy-empty">제목들이 곧 이곳에 전시됩니다.</div>}
      </section>
      <footer><div><b>{sorted.length}</b><span>개의 새로운 작품명</span></div><p>{phase === 'reveal' ? artwork.description || '작품의 원래 이야기를 함께 나눠보세요.' : '휴대폰에서 마음에 드는 제목에 공감해 주세요.'}</p></footer>
    </main>
  );
}

export function ArtworkManager({ artworks, activeArtworkId, phase, titleCount, onUpload, onDelete, onStart, onPhase, onStop }) {
  const [form, setForm] = useState({ title: '', artist: '', description: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const chooseFile = (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await onUpload({ file, ...form });
      if (preview) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview('');
      setForm({ title: '', artist: '', description: '' });
      event.currentTarget.reset();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-content artwork-admin-layout">
      <section className="panel artwork-library">
        <div className="panel-heading"><div><p className="eyebrow">Artwork library</p><h2>작품 이미지</h2></div><span>{artworks.length} works</span></div>
        {activeArtworkId && <div className="desktop-art-controls"><div><span><i /> NOW LIVE</span><b>{titleCount}개의 제목</b></div><button className={phase === 'collect' ? 'active' : ''} onClick={() => onPhase('collect')}>제목 받기</button><button className={phase === 'vote' ? 'active' : ''} onClick={() => onPhase('vote')}>투표 열기</button><button className={phase === 'reveal' ? 'active' : ''} onClick={() => onPhase('reveal')}>정답 공개</button><button onClick={onStop}>종료</button></div>}
        <div className="artwork-admin-grid">
          {artworks.map((artwork) => (
            <article className={`artwork-admin-card ${activeArtworkId === artwork.id ? 'active' : ''}`} key={artwork.id}>
              <button className="artwork-select" onClick={() => onStart(artwork.id)}><img src={artwork.imageUrl} alt={artwork.title || '등록 작품'} /><span>{activeArtworkId === artwork.id ? phaseLabel[phase] : '화면에 띄우기'} <ChevronRight /></span></button>
              <div><h3>{artwork.title || '제목 비공개 작품'}</h3><p>{artwork.artist || '작가 정보 없음'}</p><span>{artwork.submissionCount || 0} titles</span><button onClick={() => window.confirm('이 작품을 삭제할까요?') && onDelete(artwork)}><Trash2 /></button></div>
            </article>
          ))}
          {!artworks.length && <div className="empty-responses"><Images /><p>첫 작품을 등록해 주세요.</p></div>}
        </div>
      </section>
      <form className="panel artwork-upload" onSubmit={submit}>
        <div className="panel-heading"><div><p className="eyebrow">Add artwork</p><h2>새 작품 등록</h2></div></div>
        <label className={`artwork-dropzone ${preview ? 'has-image' : ''}`}>
          {preview ? <img src={preview} alt="업로드 미리보기" /> : <><ImagePlus /><b>작품 이미지 선택</b><span>JPG, PNG, WEBP · 12MB 미만</span></>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} required />
        </label>
        <label className="admin-field"><span>실제 작품명</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="투표 종료 전까지 참여자에게 숨겨집니다" /></label>
        <label className="admin-field"><span>작가명</span><input value={form.artist} onChange={(event) => setForm({ ...form, artist: event.target.value })} /></label>
        <label className="admin-field"><span>작품 설명</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={!file || uploading}>{uploading ? <LoaderCircle className="spin" /> : <ImagePlus />} {uploading ? '업로드 중' : '작품 등록'}</button>
      </form>
    </div>
  );
}

export function RemoteController({ code, session, artworks, activeArtwork, titleCount, decks, activeDeck, pdfPage, onStart, onPhase, onStop, onStartPdf, onPdfPage, onOpenWall, onSignOut }) {
  const stage = session.stage || { mode: 'wall' };
  const isPdf = stage.mode === 'pdf' && activeDeck;
  const isArtwork = stage.mode === 'artwork' && activeArtwork;
  return (
    <main className="remote-page">
      <header className="remote-header"><div><div className="participant-brand"><span /> UNFRAME REMOTE</div><p>{session.title} · {code}</p></div><button onClick={onSignOut}><Square /> 종료</button></header>
      <section className={`remote-now ${isArtwork ? 'artwork-live' : ''} ${isPdf ? 'pdf-live' : ''}`}>
        <div className="remote-now-heading"><div><p className="eyebrow">Now on screen</p><h1>{isArtwork ? phaseLabel[stage.phase] : isPdf ? 'PDF 발표 중' : '기본 Live Wall'}</h1></div><span><i /> LIVE</span></div>
        {isArtwork ? <div className="remote-active-art"><img src={activeArtwork.imageUrl} alt="현재 작품" /><div><h2>{activeArtwork.title || '제목 비공개 작품'}</h2><p>{activeArtwork.artist || '작가 정보 없음'}</p><strong>{titleCount}<span> titles</span></strong></div></div> : isPdf ? <div className="remote-active-art remote-active-pdf"><img src={activeDeck.thumbnailUrl} alt="현재 PDF 표지" /><div><h2>{activeDeck.title}</h2><p>PDF PRESENTATION</p><strong>{pdfPage}<span> / {activeDeck.pageCount} pages</span></strong></div></div> : <div className="remote-wall-placeholder"><MonitorUp /><p>질문과 참여 QR이 앞 화면에 보입니다.</p></div>}
        {isArtwork && <div className="remote-phase-actions"><button className={stage.phase === 'collect' ? 'active' : ''} onClick={() => onPhase('collect')}><Sparkles /> 제목 받기</button><button className={stage.phase === 'vote' ? 'active' : ''} onClick={() => onPhase('vote')}><Vote /> 투표 열기</button><button className={stage.phase === 'reveal' ? 'active' : ''} onClick={() => onPhase('reveal')}><Eye /> 정답 공개</button></div>}
        {isPdf && <div className="remote-pdf-actions"><button onClick={() => onPdfPage(pdfPage - 1)} disabled={pdfPage <= 1}><ArrowLeft /> 이전 장</button><span><b>{pdfPage}</b> / {activeDeck.pageCount}</span><button onClick={() => onPdfPage(pdfPage + 1)} disabled={pdfPage >= activeDeck.pageCount}>다음 장 <ArrowRight /></button></div>}
      </section>
      <section className="remote-library">
        <div className="remote-section-title"><div><p className="eyebrow">Choose artwork</p><h2>작품 선택</h2></div><span>{artworks.length}</span></div>
        <div className="remote-art-scroll">{artworks.map((artwork) => <button className={activeArtwork?.id === artwork.id ? 'active' : ''} key={artwork.id} onClick={() => onStart(artwork.id)}><img src={artwork.imageUrl} alt={artwork.title || '작품'} /><span>{artwork.title || '제목 비공개'}</span>{activeArtwork?.id === artwork.id && <Play />}</button>)}</div>
      </section>
      <section className="remote-library remote-pdf-library">
        <div className="remote-section-title"><div><p className="eyebrow">Choose presentation</p><h2>PDF 발표</h2></div><span>{decks.length}</span></div>
        <div className="remote-art-scroll">{decks.map((deck) => <button className={activeDeck?.id === deck.id ? 'active' : ''} key={deck.id} onClick={() => onStartPdf(deck)}><img src={deck.thumbnailUrl} alt={`${deck.title} 표지`} /><span>{deck.title} · {deck.pageCount}p</span>{activeDeck?.id === deck.id ? <Play /> : <FileText />}</button>)}</div>
      </section>
      <footer className="remote-dock"><button onClick={onOpenWall}><MonitorUp /><span>화면 보기</span></button><button className="remote-home" onClick={onStop}><RotateCcw /><span>Live Wall</span></button>{isPdf ? <button className="remote-next" onClick={() => onPdfPage(pdfPage + 1)} disabled={pdfPage >= activeDeck.pageCount}><ArrowRight /><span>다음 장</span></button> : isArtwork ? <button className="remote-next" onClick={() => stage.phase === 'reveal' ? onStop() : onPhase(stage.phase === 'collect' ? 'vote' : 'reveal')}>{stage.phase === 'collect' ? <Vote /> : stage.phase === 'vote' ? <Eye /> : <RotateCcw />}<span>{stage.phase === 'collect' ? '투표로' : stage.phase === 'vote' ? '공개' : '마치기'}</span></button> : <button disabled><ArrowLeft /><span>자료 선택</span></button>}</footer>
    </main>
  );
}
