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

Aura 색상은 외부 AI나 API 호출 없이 입력 문장에서 일관된 시각 스펙트럼을 생성합니다.

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
