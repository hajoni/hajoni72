import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBriefing } from './services/geminiService';
import type { Briefing, StockPick } from './types';

const TAB_LABELS = ['한눈요약', '국내뉴스', '해외뉴스', '지정학', '정책이슈', 'AI데이터', '코스닥', '유튜브'];
const TAB_ICONS = ['📊', '🇰🇷', '🇺🇸', '🌍', '🏛️', '🤖', '📈', '📺'];

const INDEX_META: { key: string; label: string }[] = [
  { key: 'KOSPI', label: 'KOSPI' },
  { key: 'KOSPI200', label: 'KOSPI 200' },
  { key: 'KOSDAQ', label: 'KOSDAQ' },
  { key: 'DOW', label: '다우존스' },
  { key: 'SP500', label: 'S&P 500' },
  { key: 'NASDAQ', label: 'NASDAQ' },
  { key: 'SOX', label: '필라델피아반도체' },
];

function fmtNum(v: number): string {
  return Math.abs(v) >= 1000
    ? v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toFixed(2);
}

function fmtKST(iso: string | null): string {
  if (!iso) return '조회 전';
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')} KST`;
}

function IndexCard({ label, point }: { label: string; point?: { val: number; chg: number | null; pct: number | null } }) {
  const hasData = !!point;
  const chgLabel =
    hasData && point!.chg !== null && point!.pct !== null
      ? `${point!.chg >= 0 ? '▲' : '▼'} ${Math.abs(point!.chg).toFixed(2)} (${point!.pct >= 0 ? '+' : ''}${point!.pct.toFixed(2)}%)`
      : '— 확인불가';
  const chgClass = hasData && point!.chg !== null ? (point!.chg >= 0 ? 'up' : 'dn') : 'nc';

  return (
    <div className="idx-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="idx-name">{label}</span>
      </div>
      <div className="idx-val">{hasData ? fmtNum(point!.val) : '—'}</div>
      <div className={`idx-chg ${chgClass}`}>{chgLabel}</div>
      <div className="idx-src">{hasData ? '실시간 검색 조회' : '조회 대기 중'}</div>
    </div>
  );
}

function InfoCard({ sentences }: { sentences: string[] }) {
  if (!sentences.length) {
    return (
      <div className="card">
        <div className="info-row">
          <span className="info-text">아직 데이터가 없습니다.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      {sentences.map((s, i) => (
        <div className="info-row" key={i}>
          <span className={`info-dot ${i % 3 === 0 ? 'grn' : i % 3 === 1 ? 'amb' : ''}`}></span>
          <span className="info-text">{s}</span>
        </div>
      ))}
    </div>
  );
}

function StockGrid({ items, badge }: { items: StockPick[]; badge: 'KR' | 'US' }) {
  if (!items.length) {
    return <p className="data-note">아직 추천 종목이 없습니다.</p>;
  }
  return (
    <div className="stock-grid">
      {items.map((it, i) => (
        <div className={`stock-card ${badge === 'KR' ? 'kr' : 'us'}`} key={i}>
          <span className={`mkt-badge ${badge === 'KR' ? 'badge-kr' : 'badge-us'}`}>{badge}</span>
          <div className="s-ticker">{it.ticker}</div>
          <div className="s-name">{it.name}</div>
          <div className="s-target">{it.target}</div>
          <div className="s-target-label">목표 수익률</div>
          <div className="s-reason">{it.reason}</div>
          <div className="s-sell">매도: {it.sell}</div>
        </div>
      ))}
    </div>
  );
}

function DetailTable({ items }: { items: StockPick[] }) {
  if (!items.length) return null;
  return (
    <table className="sum-table">
      <thead>
        <tr>
          <th>종목(코드)</th>
          <th>추천이유</th>
          <th>매도기준</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i}>
            <td>
              <strong>{it.name}</strong>
              <br />
              <span style={{ color: 'var(--text3)', fontSize: 10 }}>{it.ticker}</span>
            </td>
            <td>{it.reason}</td>
            <td>{it.sell}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [justUpdated, setJustUpdated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBriefing();
      setBriefing(data);
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stampText = useMemo(() => {
    if (loading) return '실시간 뉴스 검색 + AI 분석 진행 중...';
    if (error) return `⚠ 실시간 분석 실패: ${error}`;
    if (briefing) return `AI 분석 기준: ${fmtKST(briefing.fetchedAt)} (Google 검색 그라운딩 기반 실시간 생성)`;
    return '';
  }, [loading, error, briefing]);

  const headerDate = briefing
    ? fmtKST(briefing.fetchedAt)
    : new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  return (
    <>
      <div id="hdr">
        <div className="hdr-inner">
          <div>
            <div className="hdr-title">오늘의 주식 브리핑</div>
            <div className="hdr-sub" id="hdr-date">
              {loading ? '로딩 중...' : headerDate}
            </div>
          </div>
          <div className="hdr-actions">
            {justUpdated && <span className="badge-new">갱신됨</span>}
            <button className="btn-icon" title="재분석" onClick={load} disabled={loading}>
              {loading ? '⏳' : '↻'}
            </button>
          </div>
        </div>
      </div>

      <div id="tabbar">
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            className={`tab-btn${activeTab === i ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            <span className="tab-icon">{TAB_ICONS[i]}</span>
            {label}
          </button>
        ))}
      </div>

      <div id="idx-strip">
        {INDEX_META.map((m) => (
          <IndexCard key={m.key} label={m.label} point={briefing?.indices?.[m.key]} />
        ))}
      </div>

      <div id="main">
        {activeTab === 0 && (
          <div className="tab-pane active">
            <p className="data-note">{stampText}</p>
            {error && (
              <p className="data-note">
                ⚠ GEMINI_API_KEY 설정 또는 무료 티어 호출 제한(분당 요청 수)을 확인해주세요. 상단 ↻ 버튼으로 다시
                시도할 수 있습니다.
              </p>
            )}
            <div className="section">
              <div className="sec-title">국내 추천주 TOP 5</div>
              <StockGrid items={briefing?.krTop5 ?? []} badge="KR" />
            </div>
            <div className="section">
              <div className="sec-title">미국 추천주 TOP 5</div>
              <StockGrid items={briefing?.usTop5 ?? []} badge="US" />
            </div>
            {!!briefing?.sources.length && (
              <div className="section">
                <div className="sec-title">참고 출처 (Google 검색 그라운딩)</div>
                <div className="card">
                  {briefing.sources.map((s, i) => (
                    <div className="info-row" key={i}>
                      <span className="info-dot"></span>
                      <a
                        className="info-text"
                        href={s.uri}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--blue)' }}
                      >
                        {s.title || s.uri}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && (
          <div className="tab-pane active">
            <div className="section">
              <div className="sec-title">국내 시장 분석 {briefing ? `(${fmtKST(briefing.fetchedAt)} 기준)` : ''}</div>
              <InfoCard sentences={briefing?.krSummary ?? []} />
            </div>
            <div className="section">
              <div className="sec-title">국내 추천주 상세</div>
              <DetailTable items={briefing?.krTop5 ?? []} />
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="tab-pane active">
            <div className="section">
              <div className="sec-title">미국 증시 분석 {briefing ? `(${fmtKST(briefing.fetchedAt)} 기준)` : ''}</div>
              <InfoCard sentences={briefing?.usSummary ?? []} />
            </div>
            <div className="section">
              <div className="sec-title">미국 추천주 상세</div>
              <DetailTable items={briefing?.usTop5 ?? []} />
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="tab-pane active">
            <div className="section">
              <div className="sec-title">
                지정학 리스크 현황 {briefing ? `(${fmtKST(briefing.fetchedAt)} 기준)` : ''}
              </div>
              {(briefing?.geopolitics ?? []).map((g, i) => (
                <div className="risk-card" key={i}>
                  <span
                    className={`risk-level ${
                      g.level === '높음' ? 'risk-high' : g.level === '중간' ? 'risk-mid' : 'risk-low'
                    }`}
                  >
                    {g.level}
                  </span>
                  <div className="risk-title">{g.title}</div>
                  <div className="risk-body">{g.body}</div>
                </div>
              ))}
              {!briefing?.geopolitics?.length && <p className="data-note">아직 데이터가 없습니다.</p>}
            </div>
          </div>
        )}

        {activeTab === 4 && (
          <div className="tab-pane active">
            <div className="section">
              <div className="sec-title">정책·이슈 브리핑 {briefing ? `(${fmtKST(briefing.fetchedAt)} 기준)` : ''}</div>
              <InfoCard sentences={briefing?.policyNotes ?? []} />
              <p className="data-note">
                &#9432; 정부 정책·특정 인물 관련 세부 일정은 AI가 검색 결과만으로 추정한 내용이므로, 확정 사실은
                반드시 공식 발표로 재확인하세요.
              </p>
            </div>
          </div>
        )}

        {activeTab === 5 && (
          <div className="tab-pane active">
            <div className="section">
              <div className="sec-title">AI 데이터센터 공급망 분석</div>
              <p className="data-note">&#9432; 이 탭은 배경 참고자료로, 실시간 갱신 대상이 아닙니다.</p>
              <div className="card">
                <div className="info-row">
                  <span className="info-dot grn"></span>
                  <span className="info-text">
                    엔비디아 Blackwell/GB300 계열 GPU가 하이퍼스케일러 데이터센터 투자의 핵심 축으로 자리잡음
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-dot grn"></span>
                  <span className="info-text">HBM(고대역폭메모리) 수요 급증으로 삼성전자·SK하이닉스 공급 계약 확대</span>
                </div>
                <div className="info-row">
                  <span className="info-dot"></span>
                  <span className="info-text">TSMC CoWoS 패키징 캐파 증설이 전체 AI 반도체 공급망의 병목 지점</span>
                </div>
                <div className="info-row">
                  <span className="info-dot amb"></span>
                  <span className="info-text">데이터센터 전력 수요 급증으로 SMR(소형모듈원전)·전력기기 업체 동반 수혜</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 6 && (
          <div className="tab-pane active">
            <div className="section">
              <div className="sec-title">정부 코스닥 육성 정책</div>
              <p className="data-note">&#9432; 이 탭은 배경 참고자료로, 실시간 갱신 대상이 아닙니다.</p>
              <div className="card">
                <div className="info-row">
                  <span className="info-dot grn"></span>
                  <span className="info-text">코스닥 시장 활성화를 위한 중소·벤처기업 투자 확대 정책 기조 지속</span>
                </div>
                <div className="info-row">
                  <span className="info-dot"></span>
                  <span className="info-text">코스닥 상장 요건 완화 및 세제 지원 관련 논의가 지속적으로 진행 중</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 7 && (
          <div className="tab-pane active">
            <div className="section">
              <div className="sec-title">유튜브 시황 요약 (예시)</div>
              <p className="data-note">
                &#9432; 유튜브 콘텐츠 자동 수집은 이 앱 범위에 포함되어 있지 않습니다. 실제 방송 내용은 직접
                확인하세요.
              </p>
              <p className="data-note">
                본 앱의 뉴스·추천 종목 콘텐츠는 Gemini AI가 접속 시점 Google 검색 결과를 바탕으로 생성한 참고
                자료이며, 투자 자문이 아닙니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
