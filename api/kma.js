// api/kma.js – Vercel 서버 함수 : /api/kma?region=대전
// 그 지역의 일정(Supabase wx_tasks) + 오늘 날씨(기상청) + 일정별 판단을 JSON 으로 돌려줌
// 환경변수(Vercel) : KMA_KEY, SUPABASE_URL, SUPABASE_ANON_KEY (공개용 키만 · 비밀 키 금지)
const { REGION_COORDS, judge, buildKmaUrl, kstDateString, parseKmaWeather } = require('../logic.js');

async function readTasks(region) {
  const url = process.env.SUPABASE_URL + '/rest/v1/wx_tasks'
    + '?select=title,region,kind,owner&order=id&region=eq.' + encodeURIComponent(region);
  const res = await fetch(url, { headers: { apikey: process.env.SUPABASE_ANON_KEY } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// 실패하면 null (일정은 그대로 돌려주고 판단은 '날씨 확인 전')
async function readWeather(region, nowMs) {
  try {
    const url = buildKmaUrl(region, process.env.KMA_KEY, nowMs);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseKmaWeather(await res.json(), kstDateString(nowMs, 0));
  } catch (err) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  const region = String((req.query && req.query.region) || '');
  if (!Object.keys(REGION_COORDS).includes(region)) {
    return res.status(400).json({ error: 'region 은 세종 · 대전 · 태안 · 보령 중 하나여야 합니다' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: '서버 설정이 없습니다' });
  }

  const nowMs = Date.now();
  let tasks;
  try {
    tasks = await readTasks(region);
  } catch (err) {
    return res.status(502).json({ error: '일정을 불러오지 못했습니다' });
  }
  const weather = await readWeather(region, nowMs);

  const d = kstDateString(nowMs, 0);
  res.status(200).json({
    region,
    date: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8),
    source: '기상청 단기예보',
    weather,
    tasks: tasks.map((t) => ({ title: t.title, kind: t.kind, owner: t.owner, judge: judge(t.kind, weather) })),
  });
};
