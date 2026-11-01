import { useMemo, useState } from 'react';
import { Check, LoaderCircle, Snowflake, X } from 'lucide-react';
import { SEASONAL_PRESETS, applyPreset, cleanTheme, getPreset } from '../lib/seasonal';

export function Snowfall({ count = 36 }) {
  const flakes = useMemo(() => Array.from({ length: count }, (_, index) => {
    const seed = (index * 9301 + 49297) % 233280;
    return {
      left: (seed % 1000) / 10,
      size: 3 + (seed % 5),
      duration: 9 + (seed % 9),
      delay: -((seed % 140) / 10),
      drift: (seed % 2 ? 1 : -1) * (12 + (seed % 26)),
      opacity: 0.35 + (seed % 50) / 100,
    };
  }), [count]);

  return (
    <div className="snowfall" aria-hidden="true">
      {flakes.map((flake, index) => (
        <i
          key={index}
          style={{
            left: `${flake.left}%`,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            '--drift': `${flake.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

export function SeasonalThemeModal({ session, onApply, onClose }) {
  const [preset, setPreset] = useState(getPreset(session.theme));
  const [snow, setSnow] = useState(session.theme?.snow ?? true);
  const [withCopy, setWithCopy] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    setSaving(true);
    try {
      const next = { theme: cleanTheme(applyPreset(session.theme, preset, { snow })) };
      const copy = SEASONAL_PRESETS[preset].copy;
      if (withCopy && copy) {
        next.display = { ...session.display, ...copy.display };
        next.input = { ...session.input, ...copy.input };
      }
      await onApply(next);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="season-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="season-modal-title" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="season-modal">
        <header>
          <div><p className="eyebrow">Season theme</p><h2 id="season-modal-title">시즌 테마</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><X /></button>
        </header>

        <div className="season-options">
          {Object.entries(SEASONAL_PRESETS).map(([key, option]) => (
            <button key={key} className={`season-option ${preset === key ? 'active' : ''}`} onClick={() => setPreset(key)}>
              <span className="season-swatches">{option.swatches.map((color) => <i key={color} style={{ background: color }} />)}</span>
              <b>{option.label}</b>
              <small>{option.description}</small>
              {preset === key && <Check className="season-check" />}
            </button>
          ))}
        </div>

        {preset === 'christmas' && (
          <div className="season-toggles">
            <label><input type="checkbox" checked={snow} onChange={(event) => setSnow(event.target.checked)} /><Snowflake /> 월과 모바일에 눈 내리기</label>
            <label><input type="checkbox" checked={withCopy} onChange={(event) => setWithCopy(event.target.checked)} /> 연말 질문·안내 문구도 함께 바꾸기</label>
            {withCopy && <p className="season-copy-preview">“{SEASONAL_PRESETS.christmas.copy.display.question}”</p>}
          </div>
        )}

        <footer>
          <button className="text-button" onClick={onClose}>취소</button>
          <button className="primary-button" onClick={apply} disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Check />} {saving ? '적용 중' : '라이브에 적용'}</button>
        </footer>
      </section>
    </div>
  );
}
