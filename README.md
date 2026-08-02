# UNFRAME LIVE WALL

오프라인 모임의 질문, 응답, 공감이 모바일과 앞 화면에 실시간으로 연결되는 참여형 웹 경험입니다.

## 화면

- `/` — 참여 코드 입력
- `/join/:code` — 참여자 모바일
- `/wall/:code` — 앞 모니터 Live Wall + QR
- `/admin` — 관리자 로그인 및 세션 생성
- `/admin/:code` — 세션 운영 콘솔
- `/remote/:code` — 진행자 모바일 리모컨

기존 `?view=input|display|admin&session=CODE` 주소도 호환됩니다.

## 로컬 실행

```bash
cp .env.example .env
npm install
npm run dev
```

Aura 색상과 포스터 대표 색상은 외부 AI나 API 호출 없이 브라우저 안에서 생성·추출합니다.

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

4. Firestore와 Storage 규칙을 배포합니다.

```bash
npx firebase-tools deploy --only firestore:rules,storage
```

관리자 문서는 클라이언트에서 생성하거나 변경할 수 없도록 규칙으로 차단되어 있습니다.

## 데이터 구조

```text
artifacts/{appId}
├── admins/{uid}
└── sessions/{code}
    ├── artworks/{artworkId}
    │   └── titles/{runId}_{participantUid}
    ├── artworkDetails/{artworkId}
    ├── decks/{deckId}
    ├── messages/{messageId}
    └── participants/{uid}
        ├── likes/{messageId}
        └── titleVotes/{titleId}
```

세션별로 설정·메시지·좋아요가 분리됩니다. `moderationMode`가 `pre`이면 운영자의 승인 전까지 응답이 공개 화면에 나타나지 않습니다.
참여자 문서의 서버 타임스탬프를 메시지와 같은 batch에 기록해 계정별 최소 3초 제출 간격도 Firestore 규칙에서 강제합니다.

## Artwork Title Lab

관리자는 세션의 `Artwork Title Lab`에서 작품 이미지, 실제 작품명, 작가명과 설명을 미리 등록합니다. 실제 작품 정보는 별도의 `artworkDetails` 문서에 분리되며 Firestore 규칙상 수집·투표 단계에서는 참여자가 읽을 수 없습니다.

1. 관리자 또는 `/remote/:code` 리모컨이 작품을 선택합니다.
2. 발표 화면은 작품을 크게 보여주고 참여자는 모바일에서 자신만의 작품명을 한 번 제출합니다.
3. 제출 수만 발표 화면에 익명 캡션으로 반영됩니다.
4. 관리자가 투표를 열면 제목 텍스트가 공개되고 참여자는 여러 제목에 공감할 수 있습니다.
5. 좋아요가 쌓일수록 발표 화면의 제목 팻말이 커지고 황금색으로 변합니다.
6. `정답 공개` 단계에서 실제 작품명·작가·설명이 나타납니다.

작품 이미지는 Firebase Storage의 `artifacts/{appId}/sessions/{code}/artworks/` 경로에 저장되며 이미지 파일만 최대 12MB까지 허용됩니다. 같은 작품을 다시 시작하면 새로운 `runId`가 발급되어 리허설이나 재진행 시 이전 제출과 분리됩니다.

## 포스터 자동 컬러 테마

세션을 만들 때 JPG, PNG, WEBP 포스터를 선택하면 브라우저가 이미지를 작게 샘플링해 대표 색상 3개를 추출합니다. 지나치게 밝거나 어두운 픽셀을 제외하고 서로 충분히 다른 색을 선택하며, 주요 버튼색은 흰 글자가 읽히도록 자동 보정됩니다.

- 새 세션: `/admin`의 세션 생성 화면에서 포스터 선택
- 기존 세션: `Experience` → `포스터 컬러`에서 포스터 교체 → `새 테마 적용`
- 저장 경로: `artifacts/{appId}/sessions/{code}/poster/`
- 제한: 이미지 파일, 12MB 미만

포스터 원본과 추출된 팔레트는 세션의 `theme`에 연결되어 참여자 화면, Live Wall, 관리자 화면과 모바일 리모컨의 강조색에 공통 적용됩니다.

## PDF Presentation

PDF는 Mozilla PDF.js의 브라우저 렌더러로 표시합니다. 업로드 시 페이지 수를 확인하고 첫 페이지의 썸네일을 생성하며, 발표 중에는 세션의 `stage`에 현재 PDF와 페이지 번호가 저장됩니다. 따라서 관리자 콘솔과 모바일 리모컨에서 페이지를 넘기면 앞 발표 화면이 실시간으로 따라갑니다.

- 관리자 등록: `PDF Presentation` → PDF 선택 → 자료명 확인 → `PDF 등록`
- 발표 시작: 등록한 자료의 `화면에 띄우기`
- 페이지 이동: 관리자 콘솔의 `이전/다음` 또는 `/remote/:code` 리모컨
- Live Wall 복귀: `종료` 또는 리모컨 하단 `Live Wall`
- 저장 경로: `artifacts/{appId}/sessions/{code}/decks/{deckId}/`
- 제한: PDF 파일, 50MB 미만

PPTX는 현재 지원하지 않습니다.

## 관리자 빠른 사용법

1. `/admin`에서 로그인하고 세션 이름·참여 코드를 정합니다. 포스터가 있으면 이 단계에서 함께 선택합니다.
2. `Invite & QR`에서 참여자 QR, 앞 모니터용 Live Wall 링크, 진행자 리모컨 QR을 엽니다.
3. 앞 컴퓨터에서 `/wall/:code`를 전체 화면으로 열어 둡니다.
4. `PDF Presentation`에서 PDF를 미리 등록하고, 발표할 자료의 `화면에 띄우기`를 누릅니다.
5. 휴대폰에서 진행자 리모컨 QR로 접속해 로그인한 뒤 `이전 장`·`다음 장`으로 발표합니다.
6. 질문·응답 화면으로 돌아갈 때는 리모컨 하단의 `Live Wall`을 누릅니다.
