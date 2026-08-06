# 오늘의 주식 브리핑 — Google AI Studio 버전

이전에 만든 Netlify 버전과 기능은 동일하지만(실시간 지수 + 실제 뉴스 기반 AI 분석 + 데이터 기준 시각 표기),
Netlify 서버리스 함수 대신 **Google AI Studio의 Build 모드**에서 바로 만들고 배포할 수 있도록
React(Vite) 앱으로 새로 구성했습니다.

## Netlify 버전과 무엇이 다른가요

| | Netlify 버전 | AI Studio 버전 (이 프로젝트) |
|---|---|---|
| 지수 조회 | Netlify 함수가 Yahoo Finance 직접 호출 | Gemini의 **Google 검색 그라운딩**이 검색해서 알려줌 |
| 뉴스 수집 | Netlify 함수가 Google News RSS 직접 파싱 | 위와 동일, Gemini가 검색으로 직접 확인 |
| 백엔드 코드 | 직접 작성한 서버리스 함수 2개 | 없음 (AI Studio가 배포 시 자동으로 프록시 서버 생성) |
| 배포처 | Netlify (무료) | Google Cloud Run — AI Studio Starter Tier (첫 2개 앱 무료, 카드 등록 불필요) |
| API 키 | Netlify 환경변수에 직접 등록 | AI Studio가 Secrets 패널에서 자동 관리, 코드에 노출 안 됨 |

즉 이번 버전은 **직접 만든 백엔드가 전혀 없고**, 화면(React)에서 Gemini API를 호출할 때 `tools: [{ googleSearch: {} }]` 옵션을 켜서 Gemini가 그 순간 실제 웹을 검색하게 하고, 그 결과를 근거로 지수·뉴스·추천종목·지정학 리스크·정책 이슈를 한 번에 만들어냅니다. AI Studio가 배포 시 API 키를 서버 쪽에 자동으로 숨겨주기 때문에, 우리가 직접 서버리스 함수를 짤 필요가 없습니다.

**주의**: 지수는 이제 전용 금융 API가 아니라 Gemini의 검색 결과에서 뽑아내는 것이므로, Yahoo Finance만큼 소수점까지 정확하지 않을 수 있습니다. 정확한 소수점 시세가 중요하다면 Netlify 버전(지수는 Yahoo Finance 직접 조회)을 함께 쓰는 것을 권장합니다.

## 폴더 구조

```
stock-briefing-aistudio/
├── App.tsx                    ← 전체 UI (헤더/탭/지수/카드 등)
├── index.tsx                  ← React 진입점
├── index.html                 ← Vite HTML 엔트리
├── metadata.json              ← AI Studio 앱 메타데이터
├── styles.css                 ← 기존 다크 테마 스타일 그대로 재사용
├── types.ts                   ← 타입 정의
├── services/
│   └── geminiService.ts       ← Gemini 호출 + 응답 파싱 (핵심 로직)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md (이 파일)
```

## 1단계. GitHub에 올리기

AI Studio Build 모드는 "Import from GitHub" 기능으로 저장소를 그대로 가져올 수 있습니다. 기존에 쓰시던
`https://github.com/hajoni/hajoni72/` 저장소에 새 폴더(예: `stock-briefing-aistudio`)로 올리거나,
새 저장소를 만들어 올려도 됩니다.

```bash
git clone https://github.com/hajoni/hajoni72.git
cd hajoni72
mkdir -p stock-briefing-aistudio
cp -r /경로/stock-briefing-aistudio/* stock-briefing-aistudio/
cp /경로/stock-briefing-aistudio/.gitignore stock-briefing-aistudio/
git add stock-briefing-aistudio
git commit -m "Google AI Studio용 주식 브리핑 앱 추가"
git push
```

(GitHub 웹에서 **Add file → Upload files**로 폴더째 드래그 앤 드롭해도 됩니다.)

## 2단계. Google AI Studio에서 가져오기

1. https://aistudio.google.com 접속 → 구글 계정 로그인 (무료)
2. 좌측에서 **Build** 모드로 전환 (상단 토글이 "Prompt"가 아닌 "Build"인지 확인)
3. **Create New → App** (또는 새 앱 만들기)
4. 프롬프트 입력창의 **+ (Add files)** 아이콘 클릭 → **Import from GitHub** 선택
5. 방금 올린 저장소 URL 입력 (하위 폴더에 올렸다면 해당 경로까지, 예: `https://github.com/hajoni/hajoni72/tree/main/stock-briefing-aistudio`)
6. 가져오기가 끝나면 AI Studio가 자동으로 실행 가능한 형태로 변환하고, 우측 미리보기(Preview) 패널에 앱이 뜹니다.

> Import 기능이 저장소 구조를 완벽히 인식하지 못하는 경우, 대안으로 Build 모드에서 새 앱을 만든 뒤 좌측 **Code** 탭에서 파일을 하나씩 새로 만들고(`App.tsx`, `services/geminiService.ts`, `types.ts`, `styles.css`, `index.html`, `index.tsx`, `metadata.json`, `package.json`) 이 프로젝트의 내용을 그대로 붙여넣어도 동일하게 동작합니다.

## 3단계. API 키 확인

AI Studio에서 Gemini API를 쓰는 앱을 만들면 **GEMINI_API_KEY가 자동으로 설정**됩니다(별도 발급/입력 불필요).
좌측 **Secrets** 패널에서 키가 등록되어 있는지만 확인하면 됩니다. 만약 비어 있다면 Secrets 패널에서
Google AI Studio API 키를 새로 만들어 연결하세요 — 무료이며 카드 등록이 필요 없습니다.

## 4단계. 미리보기로 테스트

우측 Preview 패널에서 바로 앱이 동작합니다. 상단 ↻ 버튼을 눌러 실제로 Google 검색 + Gemini 분석이
동작하는지, 지수/추천종목/뉴스 요약이 실제 오늘 날짜 기준으로 채워지는지 확인하세요.

## 5단계. 배포 (Publish)

1. 우측 상단 **Publish** 버튼 클릭
2. **Get Started** → **Publish App**
3. 잠시 후 `https://xxxxx.run.app` 형태의 공개 URL이 발급됩니다 (Google Cloud Run, Starter Tier)
4. Starter Tier는 **첫 2개 앱을 결제 계정 설정 없이 무료로 배포**할 수 있습니다. 이미 결제가 설정된 프로젝트가 있다면 Cloud Run 자체의 넉넉한 무료 티어가 적용됩니다.

배포된 URL은 다른 사람과 공유할 수 있고, 그 URL로 앱을 쓰는 모든 사용자의 Gemini 호출은 여러분의
API 키/쿼터를 사용합니다(무료 티어 한도 내에서는 비용이 발생하지 않습니다).

## 무료 한도 참고

| 항목 | 내용 |
|---|---|
| AI Studio Cloud Run Starter Tier | 첫 2개 앱 무료 배포, 카드 등록 불필요 |
| Gemini API 무료 티어 | 모델별 분당/일일 요청 수 제한 (초과 시 과금이 아니라 일시 오류) |
| Google 검색 그라운딩 | 무료 티어에도 포함되지만 별도의 일일 호출 한도가 있을 수 있음 |

재분석 버튼을 짧은 시간에 여러 번 누르면 일시적으로 오류가 날 수 있습니다 — 무료 한도 초과일 뿐 정상입니다.

## 로컬에서 미리 테스트하기 (선택)

```bash
cd stock-briefing-aistudio
npm install
echo "GEMINI_API_KEY=발급받은키" > .env.local
npm run dev
```

`.env.local`은 `.gitignore`에 포함되어 있어 실수로 깃허브에 올라가지 않습니다.

## 한계 및 참고사항

- 지수·뉴스는 Gemini의 검색 그라운딩 결과에 의존하므로, 검색 결과가 부족하거나 형식이 어긋나면 해당
  값이 "확인불가"로 표시되거나 일부 카드가 비어 보일 수 있습니다. 이 경우 ↻로 다시 시도하면 대부분 해결됩니다.
- AI가 생성하는 추천 종목·지정학 리스크는 그 순간 검색된 정보에 근거한 추정이며 투자 자문이 아닙니다.
- "AI데이터", "코스닥", "유튜브" 탭은 이번에도 실시간화하지 않고 배경 참고자료로 유지했습니다.
