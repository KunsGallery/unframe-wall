import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  LoaderCircle,
  MonitorPlay,
  Play,
  Trash2,
  Upload,
} from 'lucide-react';
import { pdfjs } from '../lib/pdf';

export function PdfPageCanvas({ url, pageNumber, className = '' }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [state, setState] = useState('loading');
  const [document, setDocument] = useState(null);
  const [layoutVersion, setLayoutVersion] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let disposed = false;
    const loadingTask = pdfjs.getDocument(url);
    loadingTask.promise.then((nextDocument) => {
      if (!disposed) {
        setState('loading');
        setDocument(nextDocument);
      }
    }).catch(() => {
      if (!disposed) setState('error');
    });
    return () => {
      disposed = true;
      setDocument(null);
      loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setLayoutVersion((value) => value + 1));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document || !pageNumber) return undefined;
    let disposed = false;
    let renderTask;
    document.getPage(pageNumber).then((page) => {
      if (disposed) return;
      setState('loading');
      const host = hostRef.current;
      const canvas = canvasRef.current;
      const base = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(280, host.clientWidth - 16);
      const availableHeight = Math.max(240, host.clientHeight - 16);
      const scale = Math.min(availableWidth / base.width, availableHeight / base.height);
      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({
        canvas,
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      });
      return renderTask.promise;
    }).then(() => {
      if (!disposed) setState('ready');
    }).catch((error) => {
      if (!disposed && error?.name !== 'RenderingCancelledException') setState('error');
    });
    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, layoutVersion]);

  return (
    <div ref={hostRef} className={`pdf-canvas-host ${className} ${state}`}>
      {state === 'loading' && <div className="pdf-render-state"><LoaderCircle className="spin" /> 페이지 준비 중</div>}
      {state === 'error' && <div className="pdf-render-state error"><FileText /> PDF 페이지를 표시하지 못했습니다.</div>}
      <canvas ref={canvasRef} aria-label={`PDF ${pageNumber}페이지`} />
    </div>
  );
}

export function PdfStage({ deck, pageNumber, sessionTitle }) {
  if (!deck) return <PdfStageMissing />;
  const progress = Math.round((pageNumber / Math.max(1, deck.pageCount)) * 100);
  return (
    <main className="pdf-stage">
      <header><div className="stage-brand"><span /> UNFRAME LIVE</div><div><b>{deck.title}</b><span>{sessionTitle}</span></div><p><i /> PRESENTING</p></header>
      <section className="pdf-stage-page"><PdfPageCanvas url={deck.fileUrl} pageNumber={pageNumber} /></section>
      <footer><span>{String(pageNumber).padStart(2, '0')} / {String(deck.pageCount).padStart(2, '0')}</span><i><b style={{ width: `${progress}%` }} /></i><p>PDF PRESENTATION</p></footer>
    </main>
  );
}

function PdfStageMissing() {
  return <main className="pdf-stage missing"><FileText /><h1>발표 자료를 준비하고 있습니다.</h1></main>;
}

export function PdfParticipant({ deck, pageNumber }) {
  return (
    <main className="pdf-participant">
      <header className="art-mobile-header"><div className="participant-brand"><span /> UNFRAME LIVE</div><b><i /> PRESENTATION</b></header>
      <section>
        <div className="pdf-mobile-icon"><MonitorPlay /></div>
        <p className="eyebrow">Now presenting</p>
        <h1>{deck?.title || '발표가 진행 중입니다.'}</h1>
        <p>진행자가 앞 화면에서 자료를 설명하고 있어요.<br />화면을 함께 바라봐 주세요.</p>
        {deck && <div className="pdf-mobile-progress"><img src={deck.thumbnailUrl} alt="발표 자료 표지" /><div><b>{pageNumber}</b><span>/ {deck.pageCount} PAGE</span></div></div>}
      </section>
    </main>
  );
}

export function PdfManager({ decks, activeDeckId, pageNumber, onUpload, onDelete, onStart, onPage, onStop }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await onUpload({ file, title: title.trim() || file.name.replace(/\.pdf$/i, '') });
      setFile(null);
      setTitle('');
      form.reset();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };
  const activeDeck = decks.find((deck) => deck.id === activeDeckId);
  return (
    <div className="admin-content pdf-admin-layout">
      <section className="panel pdf-library">
        <div className="panel-heading"><div><p className="eyebrow">Presentation library</p><h2>PDF 발표 자료</h2></div><span>{decks.length} files</span></div>
        {activeDeck && <div className="pdf-live-controls"><div><span><i /> NOW LIVE</span><b>{activeDeck.title}</b></div><button onClick={() => onPage(pageNumber - 1)} disabled={pageNumber <= 1}><ArrowLeft /> 이전</button><strong>{pageNumber} / {activeDeck.pageCount}</strong><button onClick={() => onPage(pageNumber + 1)} disabled={pageNumber >= activeDeck.pageCount}>다음 <ArrowRight /></button><button onClick={onStop}>종료</button></div>}
        <div className="pdf-admin-grid">
          {decks.map((deck) => <article className={`pdf-admin-card ${activeDeckId === deck.id ? 'active' : ''}`} key={deck.id}><button className="pdf-select" onClick={() => onStart(deck)}><img src={deck.thumbnailUrl} alt={`${deck.title} 표지`} /><span><Play /> {activeDeckId === deck.id ? `${pageNumber}페이지 발표 중` : '화면에 띄우기'}</span></button><div><h3>{deck.title}</h3><p>{deck.pageCount} pages · PDF</p><button aria-label="PDF 삭제" onClick={() => window.confirm('이 PDF를 삭제할까요?') && onDelete(deck)}><Trash2 /></button></div></article>)}
          {!decks.length && <div className="empty-responses"><FileText /><p>첫 PDF 발표 자료를 등록해 주세요.</p></div>}
        </div>
      </section>
      <form className="panel pdf-upload" onSubmit={submit}>
        <div className="panel-heading"><div><p className="eyebrow">Add presentation</p><h2>새 PDF 등록</h2></div></div>
        <label className={`pdf-dropzone ${file ? 'has-file' : ''}`}><FileText /><b>{file?.name || 'PDF 파일 선택'}</b><span>{file ? `${(file.size / 1024 / 1024).toFixed(1)}MB` : 'PDF · 50MB 미만'}</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const next = event.target.files?.[0] || null; setFile(next); setTitle(next?.name.replace(/\.pdf$/i, '') || ''); }} /></label>
        <label className="admin-field"><span>발표 자료명</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="예: UNFRAME 8월 모임" /></label>
        <p className="pdf-upload-note">업로드할 때 페이지 수와 표지 이미지를 자동으로 생성합니다.</p>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={!file || uploading}>{uploading ? <LoaderCircle className="spin" /> : <Upload />} {uploading ? '분석 및 업로드 중' : 'PDF 등록'}</button>
      </form>
    </div>
  );
}
