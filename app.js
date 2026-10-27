// app.js – 화면 동작 (목록 그리기, 일정 추가)

// 01 단원 : 일정 목록을 코드 안에 둠 (가상 데이터) → 04 단원에서 data/tasks.json 으로 분리
const SAMPLE_TASKS = [
  { title: '다중이용시설 안전점검', region: '세종', kind: '야외', owner: '김안전' },
  { title: '시민 안전체험 행사 운영', region: '보령', kind: '야외', owner: '이행사' },
  { title: '옥상 태양광 설비 점검', region: '태안', kind: '고소', owner: '박설비' },
  { title: '하천 수위계 확인', region: '대전', kind: '야외', owner: '최현장' },
  { title: '청사 외벽 간판 보수', region: '세종', kind: '고소', owner: '정시설' },
  { title: '비상연락 훈련', region: '대전', kind: '실내', owner: '한상황' },
];

let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

function loadTasks() {
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = SAMPLE_TASKS.concat(saved);
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  loadTasks();
  renderTasks();
}

// 지역별 오늘 날씨 받기 (실패해도 일정 목록은 그대로 보임)
async function loadWeather() {
  const box = document.getElementById('weatherBox');
  const test = new URLSearchParams(location.search).get('test');
  box.textContent = '날씨를 불러오는 중...';
  let failed = 0;
  await Promise.all(Object.keys(REGION_COORDS).map(async (region) => {
    try {
      const res = await fetch(buildWeatherUrl(region));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const w = parseWeather(await res.json(), test);
      if (!w) throw new Error('응답 형식 오류');
      weatherByRegion[region] = w;
    } catch (err) {
      failed++;
    }
  }));
  renderTasks();
  if (failed === 0) box.textContent = '오늘 날씨를 받았습니다 (Open-Meteo)' + (test === 'wind' ? ' · 시험 모드: 풍속 12 m/s' : '');
  else box.textContent = '날씨를 불러오지 못한 지역이 ' + failed + '곳 있습니다. 해당 일정은 "날씨 확인 전"으로 표시됩니다.';
}

// 오늘 날짜(PC 기준, YYYY-MM-DD)
function showToday() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  document.getElementById('todayDate').textContent = d.getFullYear() + '-' + mm + '-' + dd;
}

document.getElementById('taskForm').addEventListener('submit', addTask);
showToday();
loadTasks();
renderTasks();
loadWeather();
