# UNFRAME LIVE WALL

오프라인 모임의 질문, 응답, 공감이 모바일과 앞 화면에 실시간으로 연결되는 참여형 웹 경험입니다.

## 화면

- `/` — 참여 코드 입력
- `/join/:code` — 참여자 모바일
- `/wall/:code` — 앞 모니터 Live Wall + QR
- `/admin` — 관리자 로그인 및 세션 생성
- `/admin/:code` — 세션 운영 콘솔

기존 `?view=input|display|admin&session=CODE` 주소도 호환됩니다.

## 로컬 실행

```bash
cp .env.example .env
npm install
npm run dev
```

Netlify Function까지 함께 테스트하려면 Netlify CLI로 실행합니다.

```bash
npx netlify dev
```

AI 프록시가 연결되지 않은 로컬 Vite 환경에서는 텍스트로부터 결정론적인 Aura 점수를 생성하므로 참여 흐름은 계속 동작합니다.

## Firebase 설정

1. Firebase Authentication에서 **Anonymous**와 **Email/Password** 로그인을 활성화합니다.
2. 관리자 이메일 계정을 Authentication에 만듭니다.
3. 해당 사용자의 UID로 다음 문서를 Firebase Console에서 생성합니다.

```text
artifacts/{VITE_UNFRAME_APP_ID}/admins/{ADMIN_UID}
```

문서 필드:

```json
{ "active": true, "email": "host@example.com" }
```

4. Firestore 규칙을 배포합니다.

```bash
npx firebase-tools deploy --only firestore:rules
```

관리자 문서는 클라이언트에서 생성하거나 변경할 수 없도록 규칙으로 차단되어 있습니다.

## Netlify 환경 변수

Firebase의 `VITE_...` 변수와 함께 다음 서버 전용 변수를 설정합니다.

- `GEMINI_API_KEY`
- `GEMINI_MODEL` — 기본값 `gemini-3.5-flash`
- `PUBLIC_SITE_URL` — 배포된 사이트 origin

`GEMINI_API_KEY`에는 `VITE_` 접두사를 붙이지 마세요. 브라우저 번들에 포함되지 않고 `netlify/functions/analyze-aura.mjs`에서만 사용됩니다.

## 데이터 구조

```text
artifacts/{appId}
├── admins/{uid}
└── sessions/{code}
    ├── messages/{messageId}
    └── participants/{uid}/likes/{messageId}
```

세션별로 설정·메시지·좋아요가 분리됩니다. `moderationMode`가 `pre`이면 운영자의 승인 전까지 응답이 공개 화면에 나타나지 않습니다.
참여자 문서의 서버 타임스탬프를 메시지와 같은 batch에 기록해 계정별 최소 3초 제출 간격도 Firestore 규칙에서 강제합니다.
