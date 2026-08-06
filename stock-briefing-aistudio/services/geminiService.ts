import { GoogleGenAI } from '@google/genai';
import type { Briefing, StockPick, GeoRisk, IndexPoint } from '../types';

// AI Studio에서 배포하면 이 키는 서버 측 환경변수로 자동 주입되고,
// 브라우저로는 절대 노출되지 않도록 AI Studio가 자동으로 프록시합니다.
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY가 설정되어 있지 않습니다. AI Studio 좌측 Secrets 패널에서 키가 등록되어 있는지 확인하세요.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

const PROMPT = `당신은 신중하고 사실에 기반해 분석하는 한국 증권사 애널리스트입니다.
Google 검색 도구를 사용해 지금 이 순간 기준 실제 뉴스와 지수를 직접 찾아본 뒤,
아래 형식에 정확히 맞춰 한국어로만 답하세요.

절대 규칙:
- 설명, 인사말, 마크다운 코드블록(\`\`\`) 없이 아래 "===SECTION===" 구분자 형식 그대로만 출력하세요.
- 각 항목은 한 줄에 하나씩, 표 형태 섹션은 파이프(|)로 필드를 구분하세요.
- 검색으로 확인되지 않는 수치는 지어내지 말고 "확인불가"라고 적으세요.
- 불확실한 내용은 "~전망", "~관측" 등 추정 표현을 쓰세요.
- 특정 인물(대통령 등)의 비공개 일정처럼 확인되지 않은 사실은 단정하지 마세요.

===INDICES===
KOSPI|현재가(숫자만)|전일대비증감(부호포함 숫자만)|등락률(부호포함 숫자, % 제외)
KOSPI200|현재가|전일대비증감|등락률
KOSDAQ|현재가|전일대비증감|등락률
DOW|현재가|전일대비증감|등락률
SP500|현재가|전일대비증감|등락률
NASDAQ|현재가|전일대비증감|등락률
SOX|현재가|전일대비증감|등락률

===KR_SUMMARY===
- 국내 시장 관련 최신 뉴스 기반 문장 (3~5개, 각 한 줄)

===US_SUMMARY===
- 미국 시장 관련 최신 뉴스 기반 문장 (3~5개, 각 한 줄)

===KR_TOP5===
종목코드|종목명|목표수익률(예: +8~12%)|추천이유(한 문장)|매도기준(한 문장)
(정확히 5줄)

===US_TOP5===
티커|종목명|목표수익률(예: +8~12%)|추천이유(한 문장)|매도기준(한 문장)
(정확히 5줄)

===GEOPOLITICS===
낮음 또는 중간 또는 높음|이슈 제목|1~2문장 설명
(2~4줄)

===POLICY===
- 국내외 정책·제도 관련 이슈 문장 (2~4개, 각 한 줄)

투자 손실 가능성이 있다는 점을 감안해 과장 없이, 실제로 검색되는 내용 위주로 서술하세요.`;

async function callModel(model: string): Promise<{ text: string; sources: { title: string; uri: string }[] }> {
  const ai = getClient();
  const res = await ai.models.generateContent({
    model,
    contents: PROMPT,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = res.text ?? '';
  if (!text.trim()) {
    throw new Error(model + ' 응답이 비어 있습니다.');
  }

  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c: any) => ({ title: (c.web?.title as string) || '', uri: (c.web?.uri as string) || '' }))
    .filter((s: { uri: string }) => s.uri);

  return { text, sources };
}

function section(text: string, name: string): string[] {
  const re = new RegExp('===' + name + '===([\\s\\S]*?)(?====[A-Z0-9_]+===|$)');
  const m = text.match(re);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseBullets(lines: string[]): string[] {
  return lines.map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}

function parsePicks(lines: string[]): StockPick[] {
  return lines
    .map((l) => l.split('|').map((p) => p.trim()))
    .filter((p) => p.length >= 5)
    .map(([ticker, name, target, reason, sell]) => ({ ticker, name, target, reason, sell }));
}

function parseGeo(lines: string[]): GeoRisk[] {
  return lines
    .map((l) => l.split('|').map((p) => p.trim()))
    .filter((p) => p.length >= 3)
    .map(([level, title, body]) => ({ level, title, body }));
}

function parseIndices(lines: string[]): Record<string, IndexPoint> {
  const map: Record<string, IndexPoint> = {};
  lines.forEach((l) => {
    const parts = l.split('|').map((p) => p.trim());
    if (parts.length < 4) return;
    const [key, valRaw, chgRaw, pctRaw] = parts;
    const val = parseFloat(valRaw.replace(/,/g, ''));
    const chg = parseFloat(chgRaw.replace(/[+,]/g, ''));
    const pct = parseFloat(pctRaw.replace(/[+%]/g, ''));
    if (!Number.isNaN(val)) {
      map[key.toUpperCase()] = {
        val,
        chg: Number.isNaN(chg) ? null : chg,
        pct: Number.isNaN(pct) ? null : pct,
      };
    }
  });
  return map;
}

export async function fetchBriefing(): Promise<Briefing> {
  let lastErr: unknown = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const { text, sources } = await callModel(model);

      const krSummary = parseBullets(section(text, 'KR_SUMMARY'));
      const usSummary = parseBullets(section(text, 'US_SUMMARY'));
      const krTop5 = parsePicks(section(text, 'KR_TOP5'));
      const usTop5 = parsePicks(section(text, 'US_TOP5'));
      const geopolitics = parseGeo(section(text, 'GEOPOLITICS'));
      const policyNotes = parseBullets(section(text, 'POLICY'));
      const indices = parseIndices(section(text, 'INDICES'));

      if (!krSummary.length && !usSummary.length && !krTop5.length && !usTop5.length) {
        throw new Error('AI 응답 형식을 해석하지 못했습니다.');
      }

      return {
        fetchedAt: new Date().toISOString(),
        krSummary,
        usSummary,
        krTop5,
        usTop5,
        geopolitics,
        policyNotes,
        indices,
        sources: sources.slice(0, 8),
      };
    } catch (e) {
      lastErr = e; // 다음 후보 모델로 재시도
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('AI 분석에 실패했습니다.');
}
