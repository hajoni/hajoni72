// netlify/functions/indices.js
//
// 브라우저에서 Yahoo Finance를 직접 호출하면 CORS 정책으로 거의 항상 차단된다.
// 이 함수는 Netlify 서버(브라우저가 아님) 측에서 대신 조회해서 CORS 문제를 우회한다.
// 별도의 API 키나 유료 구독이 필요 없다.

const TICKERS = {
  kospi: '^KS11',
  kospi200: '^KS200',
  kosdaq: '^KQ11',
  dow: '^DJI',
  sp500: '^GSPC',
  nasdaq: '^IXIC',
  sox: '^SOX',
};

async function fetchOne(ticker) {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(ticker) +
    '?interval=1d&range=5d';

  const res = await fetch(url, {
    headers: {
      // Yahoo가 서버 트래픽을 봇으로 차단하지 않도록 일반 브라우저 UA를 사용
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('HTTP ' + res.status);
  }

  const json = await res.json();
  const result = json && json.chart && json.chart.result && json.chart.result[0];
  if (!result || !result.meta) {
    throw new Error('예상치 못한 응답 형식');
  }

  const meta = result.meta;
  const price = meta.regularMarketPrice ?? meta.previousClose;
  const prev = meta.chartPreviousClose ?? meta.previousClose;

  if (price == null || prev == null) {
    throw new Error('가격 정보 없음');
  }

  const chg = price - prev;
  const pct = prev ? (chg / prev) * 100 : null;
  const marketTime = meta.regularMarketTime
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : null;

  return { val: price, chg, pct, marketTime, ok: true };
}

exports.handler = async function () {
  const entries = Object.entries(TICKERS);

  const results = await Promise.all(
    entries.map(async ([key, ticker]) => {
      try {
        const data = await fetchOne(ticker);
        return [key, data];
      } catch (e) {
        return [key, { ok: false, error: String(e && e.message ? e.message : e) }];
      }
    })
  );

  const data = Object.fromEntries(results);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      fetchedAt: new Date().toISOString(),
      data,
    }),
  };
};
