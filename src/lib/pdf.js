import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const canvasBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PDF 미리보기를 만들 수 없습니다.'))), 'image/jpeg', 0.86);
});

export async function inspectPdf(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('PDF 파일만 등록할 수 있습니다.');
  if (file.size >= 50 * 1024 * 1024) throw new Error('PDF는 50MB 미만으로 등록해 주세요.');
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    const page = await document.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 900 / base.width, 620 / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return { pageCount: document.numPages, thumbnail: await canvasBlob(canvas) };
  } finally {
    await document.destroy();
  }
}

export { pdfjs };
