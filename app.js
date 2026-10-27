// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

// 기본 일정은 data/tasks.json 을 먼저 읽고, 화면에서 추가한 일정(localStorage)을 뒤에 붙임
async function loadTasks() {
  const msg = document.getElementById('dataMsg');
  let base = [];
  try {
    const res = await fetch('data/tasks.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    base = await res.json();
    msg.textContent = '';
  } catch (err) {
    msg.textContent = '배포주소로 열어주세요';
  }
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = base.concat(saved);
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

async function addTask(e) {
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
  await loadTasks();
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
function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function showToday() {
  document.getElementById('todayDate').textContent = todayString();
}

// 오늘 판단을 md 파일로 내려받기
function saveMarkdown() {
  const date = todayString();
  const md = buildMarkdown(tasks, weatherByRegion, date);
  const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '현장일정_판단_' + date + '.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('taskForm').addEventListener('submit', addTask);
document.getElementById('saveMdBtn').addEventListener('click', saveMarkdown);
showToday();
loadTasks().then(() => {
  renderTasks();
  loadWeather();
});
