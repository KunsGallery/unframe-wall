export const DEFAULT_SESSION = {
  title: 'UNFRAME LIVE',
  status: 'live',
  moderationMode: 'post',
  stage: {
    mode: 'wall',
    artworkId: null,
    phase: null,
    runId: null,
  },
  createdAt: null,
  display: {
    question: '지금, 당신의 마음에 남은 장면은 무엇인가요?',
    subtitle: 'Your perspective becomes part of the room',
    questionSize: '76px',
    fontFamily: 'font-sans',
    accent: '#1648ff',
  },
  input: {
    question: '당신의 감상을 들려주세요.',
    subtitle: '짧은 한 문장이 공간의 새로운 장면이 됩니다.',
    placeholder: '지금 떠오르는 생각을 자유롭게 적어주세요.',
    buttonText: '생각 보내기',
    eventGuide: '감상을 남기고 생성된 Aura Ticket을 저장해 보세요.',
    fontFamily: 'font-sans',
  },
};

export const AURA_THEMES = {
  BLUE: { rgb: [22, 72, 255], label: 'Blue', color: '#1648ff' },
  MINT: { rgb: [56, 189, 167], label: 'Mint', color: '#38bda7' },
  ORANGE: { rgb: [255, 142, 60], label: 'Orange', color: '#ff8e3c' },
  VIOLET: { rgb: [136, 92, 246], label: 'Violet', color: '#885cf6' },
};

export const mergeSession = (data = {}) => ({
  ...DEFAULT_SESSION,
  ...data,
  display: { ...DEFAULT_SESSION.display, ...(data.display || {}) },
  input: { ...DEFAULT_SESSION.input, ...(data.input || {}) },
  stage: { ...DEFAULT_SESSION.stage, ...(data.stage || {}) },
});

export const normalizeCode = (value = '') => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

export const createSessionCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
};

export const getAuraColor = (scores = {}) => {
  const normalized = Object.fromEntries(
    Object.keys(AURA_THEMES).map((key) => [key, Number(scores[key] ?? 25)]),
  );
  const total = Object.values(normalized).reduce((sum, score) => sum + Number(score || 0), 0) || 100;
  const rgb = [0, 1, 2].map((channel) =>
    Math.round(
      Object.entries(AURA_THEMES).reduce(
        (sum, [key, theme]) => sum + (Number(normalized[key] || 0) / total) * theme.rgb[channel],
        0,
      ),
    ),
  );
  return `rgb(${rgb.join(', ')})`;
};

export const createAuraSpectrum = (text) => {
  const seed = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const raw = [
    20 + (seed % 31),
    16 + ((seed * 3) % 29),
    12 + ((seed * 5) % 25),
    18 + ((seed * 7) % 28),
  ];
  const total = raw.reduce((sum, value) => sum + value, 0);
  const values = raw.map((value) => Math.round((value / total) * 100));
  values[0] += 100 - values.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.keys(AURA_THEMES).map((key, index) => [key, values[index]]));
};

export const resolveRoute = () => {
  const params = new URLSearchParams(window.location.search);
  const legacyView = params.get('view');
  const legacyCode = normalizeCode(params.get('session') || params.get('code') || '');
  if (legacyView) return { view: legacyView === 'display' ? 'wall' : legacyView, code: legacyCode };

  const [view, rawCode] = window.location.pathname.split('/').filter(Boolean);
  if (['join', 'wall', 'admin', 'remote'].includes(view)) return { view, code: normalizeCode(rawCode) };
  return { view: 'home', code: '' };
};

export const routeTo = (view, code = '') => {
  const next = view === 'home' ? '/' : `/${view}/${normalizeCode(code)}`;
  window.history.pushState({}, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
