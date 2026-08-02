import { useEffect, useState } from 'react';
import { ImagePlus, LoaderCircle, Palette, RefreshCw } from 'lucide-react';
import { buildSessionTheme, extractPalette } from '../lib/colorPalette';

export function PosterThemePicker({ value, onChange, currentPosterUrl = '' }) {
  const [preview, setPreview] = useState(currentPosterUrl);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setPreview(currentPosterUrl), [currentPosterUrl]);
  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  const choose = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setError('');
    try {
      const palette = await extractPalette(file);
      const nextPreview = URL.createObjectURL(file);
      setPreview((previous) => {
        if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
        return nextPreview;
      });
      onChange({ file, palette, theme: buildSessionTheme(palette) });
    } catch (extractError) {
      setError(extractError.message);
    } finally {
      setExtracting(false);
      event.target.value = '';
    }
  };

  const palette = value?.palette || value?.theme?.palette || [];
  return (
    <div className="poster-theme-picker">
      <label className={`poster-dropzone ${preview ? 'has-poster' : ''}`}>
        {preview ? <img src={preview} alt="세션 포스터 미리보기" /> : <><ImagePlus /><b>모임 포스터 선택</b><span>대표 색상 3개를 자동으로 찾습니다</span></>}
        {extracting && <span className="poster-extracting"><LoaderCircle className="spin" /> 색상 분석 중</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={extracting} />
      </label>
      <div className="palette-result">
        <div><Palette /><span><b>자동 컬러 팔레트</b>{palette.length ? '포스터에서 추출됨' : '포스터는 선택 사항입니다'}</span></div>
        <div className="palette-swatches">{palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
        {preview && <label className="palette-replace"><RefreshCw /> 포스터 교체<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} /></label>}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
