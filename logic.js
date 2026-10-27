// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
  if (kind === '고소' && w.windMax >= RULES.wind) return { level: 'stop', text: '중지 검토 (강풍)' };
  if (w.tempMax >= RULES.heat) return { level: 'warn', text: '폭염 휴식' };
  if (w.rainProb >= RULES.rain) return { level: 'warn', text: '우천 주의' };
  return { level: 'ok', text: '진행' };
}

// 지역별 좌표 (대략적인 위치)
const REGION_COORDS = {
  세종: { lat: 36.48, lon: 127.29 },
  대전: { lat: 36.35, lon: 127.38 },
  태안: { lat: 36.75, lon: 126.30 },
  보령: { lat: 36.33, lon: 126.61 },
};

// Open-Meteo 호출 주소 만들기 (키 없음, 오늘 하루 최댓값)
function buildWeatherUrl(region) {
  const c = REGION_COORDS[region];
  if (!c) return null;
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + c.lat + '&longitude=' + c.lon
    + '&daily=temperature_2m_max,wind_speed_10m_max,precipitation_probability_max'
    + '&wind_speed_unit=ms&timezone=Asia%2FSeoul&forecast_days=1';
}

// 응답 해석 → { tempMax, windMax, rainProb } (이상하면 null). test==='wind' 이면 풍속을 12로 바꿈
function parseWeather(json, test) {
  const d = json && json.daily;
  if (!d) return null;
  const tempMax = d.temperature_2m_max && d.temperature_2m_max[0];
  const windMax = d.wind_speed_10m_max && d.wind_speed_10m_max[0];
  const rainProb = d.precipitation_probability_max && d.precipitation_probability_max[0];
  if (![tempMax, windMax, rainProb].every(Number.isFinite)) return null;
  return { tempMax, windMax: test === 'wind' ? 12 : windMax, rainProb };
}

// 표 칸에 넣을 글자 정리 ( | 는 표를 깨므로 바꾸고, 줄바꿈은 공백으로)
function mdCell(v) {
  return String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

// 오늘 판단을 마크다운 문서로 만들기
function buildMarkdown(tasks, weatherByRegion, dateStr) {
  const lines = [
    '# 현장 일정 판단 (' + dateStr + ')',
    '',
    '| 일정 | 지역 | 구분 | 담당 | 날씨 | 판단 |',
    '|---|---|---|---|---|---|',
  ];
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const wText = w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
    lines.push('| ' + [t.title, t.region, t.kind, t.owner, wText, judge(t.kind, w).text].map(mdCell).join(' | ') + ' |');
  }
  lines.push('');
  lines.push('판단 기준(교육용 가상): 고소 풍속 ' + RULES.wind + 'm/s 이상 중지 검토 · 최고기온 ' + RULES.heat
    + '℃ 이상 폭염 휴식 · 강수확률 ' + RULES.rain + '% 이상 우천 주의 · 실내는 영향 없음');
  return lines.join('\n') + '\n';
}

if (typeof module !== 'undefined') module.exports = { RULES, judge, REGION_COORDS, buildWeatherUrl, parseWeather, buildMarkdown };
