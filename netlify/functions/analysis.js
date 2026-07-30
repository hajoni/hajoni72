// netlify/functions/analysis.js
//
// 1) Google News RSS(무료, 키 불필요)에서 실제 최신 헤드라인을 수집한다.
// 2) 수집한 헤드라인만 근거로 Gemini 무료 티어 API(GEMINI_API_KEY 환경변수 필요)에
//    분석을 요청해 오늘 시점의 뉴스 요약/추천종목/지정학 리스크/정책 이슈를 생성한다.
// 3) 결과를 JSON으로 반환한다. 비용은 발생하지 않지만, Gemini 무료 티어는
//    분당 호출 횟수 제한이 있으므로 너무 자주 호출하지 않도록 프론트엔드에서 조절한다.

const GEMINI_MODEL = 'gemini-2.0-flash';

async function fetchRSS(url, limit) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error('RSS HTTP ' + res.status + ' (' + url + ')');
  const xml = await res.text();

  const titles = [...xml.matchAll(/<title>([\s\S]*?)<\/title>/g)]
    .map((m) =>
      m[1]
        .replace('<![CDATA[', '')
        .replace(']]>', '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
    )
    .filter(Boolean);

  // RSS의 첫 <title>은 피드 자체 제목(예: "코스피 - Google 뉴스")이므로 제외
  return titles.slice(1, limit + 1);
}

function buildPrompt(krNews, usNews, techNews, nowKST) {
  return `당신은 신중하고 사실에 기반해 분석하는 한국 증권사 애널리스트입니다.
지금 시각은 ${nowKST} (한국 시간, KST) 입니다.

아래는 방금 수집한 실제 뉴스 헤드라인입니다. 반드시 이 헤드라인들에 근거해서만 분석하고,
헤드라인에 없는 구체적 수치(지수 종가, 실적 수치 등)는 추측해서 단정적으로 쓰지 마세요.
불확실한 내용은 "~전망", "~관측", "~가능성" 등 추정 표현을 사용하세요.

[국내 시장 관련 뉴스 헤드라인]
${krNews.map((t) => '- ' + t).join('\n') || '(수집된 헤드라인 없음)'}

[미국 시장 관련 뉴스 헤드라인]
${usNews.map((t) => '- ' + t).join('\n') || '(수집된 헤드라인 없음)'}

[AI·반도체 관련 뉴스 헤드라인]
${techNews.map((t) => '- ' + t).join('\n') || '(수집된 헤드라인 없음)'}

위 헤드라인만 근거로 삼아, 아래 JSON 스키마에 정확히 맞춰 한국어로 작성하세요.
설명, 코드블록, 마크다운 없이 순수 JSON 객체 하나만 출력하세요.

{
  "kr_market_summary": ["국내 시장 관련 문장 3~5개"],
  "us_market_summary": ["미국 시장 관련 문장 3~5개"],
  "kr_top5": [
    {"ticker":"6자리 종목코드 또는 빈 문자열","name":"종목명","target":"+n~n%","reason":"추천 이유 한 문장","sell":"매도 기준 한 문장"}
  ],
  "us_top5": [
    {"ticker":"티커","name":"종목명","target":"+n~n%","reason":"추천 이유 한 문장","sell":"매도 기준 한 문장"}
  ],
  "geopolitics": [
    {"level":"낮음 또는 중간 또는 높음","title":"이슈 제목","body":"1~2문장 설명"}
  ],
  "policy_notes": ["국내외 정책·제도 관련 이슈 문장 2~4개 (특정 인물의 일정처럼 확인 안 된 사실은 단정하지 말 것)"]
}

kr_top5, us_top5는 각각 정확히 5개, geopolitics는 2~4개 작성하세요.
추천 종목은 헤드라인에서 실제로 언급되거나 관련 섹터가 확인되는 종목을 우선하고,
근거가 부족하면 시가총액 상위의 널리 알려진 대표주를 신중하게 제시하세요.
투자 손실 가능성이 있는 의견이라는 점을 감안해 과장 없이 서술하세요.`;
}

exports.handler = async function () {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        error:
          'GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Netlify 사이트 설정 > Environment variables 에서 추가해주세요.',
      }),
    };
  }

  try {
    const [krNews, usNews, techNews] = await Promise.all([
      fetchRSS(
        'https://news.google.com/rss/search?q=%EC%BD%94%EC%8A%A4%ED%94%BC%20%EC%A6%9D%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko',
        10
      ),
      fetchRSS(
        'https://news.google.com/rss/search?q=stock%20market%20S%26P%20500&hl=en-US&gl=US&ceid=US:en',
        10
      ),
      fetchRSS(
        'https://news.google.com/rss/search?q=AI%20chip%20semiconductor&hl=en-US&gl=US&ceid=US:en',
        8
      ),
    ]);

    const nowKST = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

    const prompt = buildPrompt(krNews, usNews, techNews, nowKST);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error('Gemini API 오류 ' + geminiRes.status + ': ' + errText.slice(0, 300));
    }

    const geminiJson = await geminiRes.json();
    const text =
      geminiJson &&
      geminiJson.candidates &&
      geminiJson.candidates[0] &&
      geminiJson.candidates[0].content &&
      geminiJson.candidates[0].content.parts &&
      geminiJson.candidates[0].content.parts[0] &&
      geminiJson.candidates[0].content.parts[0].text;

    if (!text) {
      throw new Error('Gemini 응답에 텍스트가 없습니다.');
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('AI 응답을 JSON으로 해석하지 못했습니다.');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        fetchedAt: new Date().toISOString(),
        sources: { krNews, usNews, techNews },
        analysis: parsed,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: String(e && e.message ? e.message : e) }),
    };
  }
};
