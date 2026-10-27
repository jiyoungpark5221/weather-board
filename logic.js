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

// 기상청 단기예보 격자(nx, ny) : 위경도를 기상청 Lambert 투영식으로 변환
function kmaGrid(lat, lon) {
  const D = Math.PI / 180;
  const re = 6371.00877 / 5.0;
  const slat1 = 30.0 * D, slat2 = 60.0 * D, olon = 126.0 * D, olat = 38.0 * D;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lon * D - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5),
  };
}

// 한국 시간 기준 날짜 글자 (nowMs 는 Date.now() 값, offsetDays 로 며칠 전후 계산)
function kstDateString(nowMs, offsetDays) {
  const d = new Date(nowMs + 9 * 3600 * 1000 + (offsetDays || 0) * 86400 * 1000);
  return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
}

// 기상청 단기예보 호출 주소 (키는 호출하는 쪽이 넘김 · 주소를 로그나 응답에 내보내지 말 것)
// 02:10 이후는 오늘 02시 발표, 그 전에는 어제 23시 발표를 씀
function buildKmaUrl(region, key, nowMs) {
  const c = Object.prototype.hasOwnProperty.call(REGION_COORDS, region) ? REGION_COORDS[region] : null;
  if (!c || !key) return null;
  const k = new Date(nowMs + 9 * 3600 * 1000);
  const early = k.getUTCHours() * 60 + k.getUTCMinutes() < 2 * 60 + 10;
  const g = kmaGrid(c.lat, c.lon);
  const serviceKey = key.includes('%') ? decodeURIComponent(key) : key;
  return 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
    + '?serviceKey=' + encodeURIComponent(serviceKey)
    + '&pageNo=1&numOfRows=1000&dataType=JSON'
    + '&base_date=' + kstDateString(nowMs, early ? -1 : 0)
    + '&base_time=' + (early ? '2300' : '0200')
    + '&nx=' + g.nx + '&ny=' + g.ny;
}

// 기상청 응답 해석 → { tempMax, windMax, rainProb } (오늘 하루 최댓값, 이상하면 null)
// today : 'YYYYMMDD'
function parseKmaWeather(json, today) {
  const r = json && json.response;
  if (!r || !r.header || r.header.resultCode !== '00') return null;
  const items = r.body && r.body.items && r.body.items.item;
  if (!Array.isArray(items)) return null;
  const vals = (cat) => items
    .filter((i) => i.category === cat && String(i.fcstDate) === today)
    .map((i) => parseFloat(i.fcstValue))
    .filter(Number.isFinite);
  const tmx = vals('TMX'), tmp = vals('TMP'), wsd = vals('WSD'), pop = vals('POP');
  const tempList = tmx.length ? tmx : tmp;
  if (!tempList.length || !wsd.length || !pop.length) return null;
  return { tempMax: Math.max(...tempList), windMax: Math.max(...wsd), rainProb: Math.max(...pop) };
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

if (typeof module !== 'undefined') module.exports = {
  RULES, judge, REGION_COORDS, buildWeatherUrl, parseWeather, buildMarkdown,
  kmaGrid, kstDateString, buildKmaUrl, parseKmaWeather,
};
