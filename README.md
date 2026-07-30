# 오늘의 주식 브리핑 — 실시간판

완전 무료(신용카드/유료 구독 불필요)로 아래 세 가지를 실제로 구현했습니다.

- **지수(코스피·코스닥·다우·S&P500·나스닥·SOX)**: 접속/새로고침 시점에 Yahoo Finance에서 실제로 실시간 조회
- **뉴스 요약·추천종목·지정학 리스크·정책 이슈**: Google News RSS로 수집한 실제 최신 헤드라인을 근거로, Google Gemini 무료 API가 그 자리에서 분석해 생성
- **데이터 기준 시각 표기**: 화면 곳곳의 "데이터 기준"이 실제로 데이터를 가져온 시각(KST)으로 자동 표시

## 원래 파일과 달라진 점 (중요)

업로드해주신 `stock_briefing_v5.html`을 확인해보니:

1. 지수는 브라우저에서 Yahoo Finance API를 **직접** 호출하고 있었는데, 브라우저는 CORS 정책 때문에 이 호출을 대부분 차단합니다. 그래서 실제로는 거의 항상 실패하고 코드에 박혀있는 예전 폴백 숫자(6,755.75 등)만 보였을 가능성이 높습니다.
2. S&P500 지수는 내부 키 이름이 `sp500`인데 화면 요소 id는 `sp`로 되어 있어 **아예 갱신되지 않는 버그**가 있었습니다.
3. 뉴스 요약·추천종목·지정학 리스크·"대통령" 탭 내용은 전부 특정 시점(2026.07.25~27)에 사람이 작성한 **고정 텍스트**였고, "재분석" 버튼은 실제 재분석 없이 진행률 애니메이션만 보여주는 연출이었습니다.

이번 버전에서는:

- 지수 조회를 **Netlify 서버리스 함수**로 옮겨 CORS 문제를 근본적으로 해결하고, `sp500`/`sp` id 불일치 버그도 수정했습니다.
- Google News RSS(무료, 키 불필요)로 실제 헤드라인을 가져온 뒤, **Gemini 무료 API**로 그 헤드라인에 근거한 분석을 생성하도록 백엔드를 새로 만들었습니다.
- "재분석" 버튼은 이제 애니메이션이 끝나야 완료되는 게 아니라, **실제 서버 응답이 도착해야** 완료됩니다.
- "대통령" 탭은 특정 인물의 일정처럼 AI가 확인 없이 지어내기 쉬운 내용이라 "정책·이슈" 탭으로 바꾸고, 확정 사실은 공식 발표로 확인하라는 안내 문구를 넣었습니다.
- AI·데이터센터/코스닥/유튜브 탭은 이번 범위에서는 실시간화하지 않고, "실시간 갱신 대상 아님"이라고 정직하게 표시했습니다 (아래 "한계" 참고).

## 폴더 구조

```
stock-briefing/
├── public/
│   └── index.html          ← 실제 화면 (Netlify가 이 폴더를 통째로 배포)
├── netlify/
│   └── functions/
│       ├── indices.js      ← 지수 실시간 조회 함수
│       └── analysis.js     ← 뉴스 수집 + Gemini 분석 함수
├── netlify.toml             ← Netlify 배포 설정
├── package.json
└── README.md (이 파일)
```

## 1단계. Gemini 무료 API 키 발급 (2분, 무료)

1. https://aistudio.google.com/apikey 접속 후 구글 계정으로 로그인
2. **Create API key** 클릭 → 새 프로젝트 또는 기존 프로젝트 선택
3. 생성된 키(`AIza...`로 시작하는 문자열)를 복사해 잠시 메모장에 보관

> 신용카드 등록 없이 무료로 발급되며, 무료 티어는 분당 호출 횟수 제한이 있습니다(모델에 따라 다름). 재분석 버튼을 짧은 시간에 연속으로 여러 번 누르면 일시적으로 오류가 날 수 있습니다.

## 2단계. GitHub 저장소에 코드 올리기

이미 사용 중이신 `https://github.com/hajoni/hajoni72/` 저장소에 올리는 경우:

```bash
git clone https://github.com/hajoni/hajoni72.git
cd hajoni72
# 이 대화에서 받은 stock-briefing 폴더의 내용물을 저장소 루트(또는 원하는 하위 폴더)로 복사
cp -r /경로/stock-briefing/* .
cp -r /경로/stock-briefing/.gitignore .
git add .
git commit -m "실시간 지수+AI 뉴스 분석 주식 브리핑 앱 추가"
git push
```

Git 명령어가 익숙하지 않다면, GitHub 저장소 페이지에서 **Add file → Upload files**로 `stock-briefing` 폴더 안의 파일들(폴더 구조 그대로)을 드래그 앤 드롭해서 올려도 됩니다.

> 새 저장소로 배포하고 싶다면 GitHub에서 **New repository**로 빈 저장소를 만들고 위와 동일하게 push하면 됩니다.

## 3단계. Netlify에 배포하기 (무료)

1. https://app.netlify.com/ 접속 → GitHub 계정으로 로그인/가입 (무료)
2. **Add new site → Import an existing project** 클릭
3. **Deploy with GitHub** 선택 → 방금 올린 저장소(`hajoni72` 등) 선택
4. Build settings 입력 (저장소 루트에 이 프로젝트를 올렸다면):
   - **Base directory**: 비워둠 (하위 폴더에 올렸다면 그 폴더 경로 입력, 예: `stock-briefing`)
   - **Build command**: 비워둠 (정적 사이트라 빌드 불필요)
   - **Publish directory**: `public`
   - Functions directory는 `netlify.toml`에 이미 `netlify/functions`로 지정되어 있어 자동 인식됩니다.
5. **Deploy site** 클릭 → 1분 내 배포 완료, `https://무작위이름.netlify.app` 형태의 무료 URL 발급

## 4단계. 환경변수(API 키) 등록 — 반드시 필요

1. 배포된 사이트의 Netlify 대시보드에서 **Site configuration → Environment variables** 이동
2. **Add a variable** 클릭
   - Key: `GEMINI_API_KEY`
   - Value: 1단계에서 발급받은 키
3. 저장 후, **Deploys** 탭에서 **Trigger deploy → Deploy site**로 한 번 더 재배포 (환경변수는 재배포해야 함수에 반영됩니다)

## 5단계. 확인

- 배포된 URL로 접속하면 자동으로 지수·뉴스 분석을 조회해서 화면을 채웁니다.
- 우측 상단 새로고침(⟳) 버튼을 누르면 실제로 다시 뉴스 수집 → AI 분석 → 지수 조회를 수행합니다 (수 초 소요).
- 각 탭 상단의 "데이터 기준" 문구가 실제 조회 시각(KST)으로 표시되는지 확인하세요.
- (선택) **Site configuration → Change site name**에서 URL을 원하는 이름으로 바꿀 수 있습니다. 여전히 무료입니다.

## 무료 한도 참고

| 서비스 | 무료 한도 (2026년 기준, 변동 가능) |
|---|---|
| Netlify Free | 대역폭 100GB/월, 서버리스 함수 호출 125,000회/월 |
| Google Gemini API 무료 티어 | 모델별 분당/일일 요청 수 제한 (과금 없음, 초과 시 일시 오류) |
| Google News RSS, Yahoo Finance 조회 | 별도 키 불필요, 공식 유료 API 아님 |

일반적인 개인 사용(하루 수십~수백 회 새로고침) 범위에서는 비용이 전혀 발생하지 않습니다.

## 한계 및 참고사항 (정직하게 안내)

- Yahoo Finance, Google News RSS는 **공식 유료 API가 아닌 공개 엔드포인트**를 이용한 것이라 언제든 응답 형식이 바뀌거나 일시적으로 차단될 수 있습니다. 그런 경우 지수는 폴백 숫자와 "⚠ 조회 실패" 표시로, 분석은 "⚠ 실시간 AI 분석 실패" 문구로 전환되어 화면이 깨지지는 않습니다.
- AI가 생성하는 뉴스 요약·추천종목은 **그 순간 수집된 헤드라인 몇 건**에 근거한 추정이며, 투자 자문이 아닙니다. 특히 특정 인물의 일정, 정부 발표 세부 내용처럼 확인이 중요한 정보는 반드시 공식 출처로 재확인하세요.
- "AI·데이터센터", "코스닥", "유튜브" 탭은 이번 작업 범위에서는 실시간화하지 않았습니다. 필요하시면 같은 방식(RSS 수집 + Gemini 분석)으로 확장할 수 있습니다.
- Netlify 함수 실행 제한 시간(기본 10초 내외) 안에 "뉴스 수집 + AI 응답"이 끝나야 합니다. 네트워크 상황에 따라 가끔 타임아웃이 날 수 있으며, 이 경우도 화면은 "⚠ 실패" 표시로 안전하게 대체됩니다.
