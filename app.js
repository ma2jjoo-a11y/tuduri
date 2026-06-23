const GOOGLE_CLIENT_ID = '112150475059-0su7lvaksudsn8179rfiqdq17hbvjd0k.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyAx9kFA2Gn5OQiUOz3kDchmV2cxYzLWQ2U';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

const SEMESTER_SCHEDULE = [
  { date: '7/17', label: '트랙별 소개 자료 제출', urgent: true },
  { date: '8/8', label: '입학식/OT (용산 드래곤시티)' },
  { date: '8/18~22', label: '수강신청 기간' },
  { date: '8/21', label: '91기 졸업식' },
  { date: '9/1', label: '개강' },
  { date: '9/5', label: '트랙 간담회 + 사자후' },
  { date: '9/12', label: '동아리 간담회' },
  { date: '9/28~10/8', label: '중간 강의 평가' },
  { date: '11/28', label: '학술제' },
  { date: '11/30~12/18', label: '기말 강의 평가' },
  { date: '12/12', label: '종강파티' },
  { date: '12/19', label: '원우회 해단식' },
  { date: '12/21', label: '종강' },
];

const PHASES = [
  {
    id: 'phase1a', title: 'Phase 1-1. 기획 (6/23 ~ 6/25)',
    tasks: [
      { id: 't1', label: 'PPT 목차 구성' },
      { id: 't2', label: '트랙 소개 내용 자료 조사 (커리큘럼, 교수진, 특징)' },
      { id: 't3', label: '참고 레퍼런스 PPT 2~3개 수집' },
    ]
  },
  {
    id: 'phase1b', title: 'Phase 1-2. 제작 (6/26 ~ 7/4)',
    tasks: [
      { id: 't4', label: 'PPT 초안 작성 (내용 채우기)' },
      { id: 't5', label: '디자인 작업' },
      { id: 't6', label: '이미지/그래픽 소재 준비' },
    ]
  },
  {
    id: 'phase1c', title: 'Phase 1-3. 1차 마무리 (7/5 ~ 7/7)',
    tasks: [
      { id: 't7', label: '전체 내용 검토 및 수정' },
      { id: 't8', label: '⭐ 여행 전 저장본 백업' },
    ]
  },
  {
    id: 'phase2', title: 'Phase 2. 여행 후 최종 마무리 (7/13 ~ 7/16)',
    tasks: [
      { id: 't9', label: '눈 새로 뜨고 최종 검토' },
      { id: 't10', label: '수정 사항 반영' },
      { id: 't11', label: 'PDF 변환' },
      { id: 't12', label: '제출 이메일 초안 작성' },
    ]
  },
  {
    id: 'phase3', title: '✅ Phase 3. 제출 (7/17)',
    tasks: [{ id: 't13', label: 'kimjinyong@hanyang.ac.kr 이메일 발송' }]
  },
  {
    id: 'optional', title: '🎬 [선택] 홍보영상 (7/5~7/7, 우선순위 낮음)',
    tasks: [
      { id: 't14', label: 'AI 영상 툴 조사 (Sora, Runway, Vrew 등)' },
      { id: 't15', label: '30초~1분 스크립트 작성' },
      { id: 't16', label: '영상 생성 시도' },
    ]
  },
];

// ── 상태 ──
let taskState = JSON.parse(localStorage.getItem('tuduri-tasks') || '{}');
let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let weekOffset = 0;
let monthYear = new Date().getFullYear();
let monthMonth = new Date().getMonth();
let cachedWeekEvents = [];
let cachedMonthEvents = [];
let selectedDate = null;
let allLoadedEvents = [];

// ── 유틸 ──
function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toLocalISOString(d) {
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function getWeekStart(offset) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

// ── 탭 전환 ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'week') loadWeekEvents();
    if (tab.dataset.tab === 'month') loadMonthEvents();
  });
});

// ── 오늘 탭 ──
function renderTodayDate() {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  document.getElementById('today-date').textContent =
    `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
}

function renderDday() {
  const deadline = new Date('2026-07-17');
  const today = new Date();
  today.setHours(0,0,0,0);
  deadline.setHours(0,0,0,0);
  const diff = Math.ceil((deadline - today) / (1000*60*60*24));
  const el = document.getElementById('dday-display');
  if (diff > 0) el.textContent = `D-${diff} · 7월 17일 마감`;
  else if (diff === 0) el.textContent = 'D-DAY · 오늘 마감!';
  else el.textContent = `마감 ${Math.abs(diff)}일 경과`;
}

function renderTodayTasks() {
  const el = document.getElementById('today-tasks');
  const allTasks = PHASES.flatMap(p => p.tasks);
  const pending = allTasks.filter(t => !taskState[t.id]).slice(0, 3);
  if (!pending.length) { el.innerHTML = '<div class="loading">✅ 오늘 할 일이 없어요!</div>'; return; }
  el.innerHTML = pending.map(task => `
    <div class="task-item ${taskState[task.id] ? 'done' : ''}">
      <input type="checkbox" id="today-${task.id}" ${taskState[task.id] ? 'checked' : ''} />
      <label for="today-${task.id}">${task.label}</label>
    </div>
  `).join('');
  document.querySelectorAll('#today-tasks input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const rid = cb.id.replace('today-', '');
      taskState[rid] = cb.checked;
      localStorage.setItem('tuduri-tasks', JSON.stringify(taskState));
      cb.closest('.task-item').classList.toggle('done', cb.checked);
      renderProgress();
      renderPhases();
    });
  });
}

// ── 할 일 탭 ──
function renderPhases() {
  const el = document.getElementById('phase-list');
  el.innerHTML = PHASES.map(phase => `
    <div class="phase-card">
      <div class="phase-title">${phase.title}</div>
      ${phase.tasks.map(task => `
        <div class="task-item ${taskState[task.id] ? 'done' : ''}">
          <input type="checkbox" id="${task.id}" ${taskState[task.id] ? 'checked' : ''} />
          <label for="${task.id}">${task.label}</label>
        </div>
      `).join('')}
    </div>
  `).join('');
  document.querySelectorAll('#phase-list input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      taskState[cb.id] = cb.checked;
      localStorage.setItem('tuduri-tasks', JSON.stringify(taskState));
      cb.closest('.task-item').classList.toggle('done', cb.checked);
      renderProgress();
    });
  });
  renderProgress();
}

function renderProgress() {
  const all = PHASES.flatMap(p => p.tasks);
  const done = all.filter(t => taskState[t.id]).length;
  const pct = Math.round((done / all.length) * 100);
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

// ── 주간 뷰 ──
async function loadWeekEvents() {
  const mon = getWeekStart(weekOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);

  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const startLabel = `${mon.getMonth()+1}/${mon.getDate()}`;
  const endLabel = `${sun.getMonth()+1}/${sun.getDate()}`;
  document.getElementById('week-title').textContent = `${startLabel} ~ ${endLabel}`;

  if (!gapiInited || !gisInited || !gapi.client.getToken()) {
    renderWeekView(mon, []);
    return;
  }
  try {
    const resp = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: mon.toISOString(),
      timeMax: sun.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });
    cachedWeekEvents = resp.result.items || [];
  } catch(e) { cachedWeekEvents = []; }
  renderWeekView(mon, cachedWeekEvents);
}

function renderWeekView(mon, events) {
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
  const today = toDateKey(new Date());
  const el = document.getElementById('week-view');

  const eventMap = {};
  events.forEach(ev => {
    const start = ev.start.dateTime || ev.start.date;
    const key = start.slice(0, 10);
    if (!eventMap[key]) eventMap[key] = [];
    eventMap[key].push(ev);
  });

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key = toDateKey(d);
    const isToday = key === today;
    const dayEvs = eventMap[key] || [];

    const evHtml = dayEvs.length
      ? dayEvs.map(ev => {
          const s = ev.start.dateTime || ev.start.date;
          const sd = new Date(s);
          const timeStr = ev.start.dateTime
            ? `${sd.getHours()}:${String(sd.getMinutes()).padStart(2,'0')}`
            : '종일';
          return `<div class="week-event-item" data-event-id="${ev.id}">
            <div class="week-event-dot"></div>
            <div class="week-event-label">${ev.summary || '(제목 없음)'}</div>
            <div class="week-event-time">${timeStr}</div>
          </div>`;
        }).join('')
      : '<div class="week-no-event">일정 없음</div>';

    html += `
      <div class="week-day">
        <div class="week-day-header ${isToday ? 'today' : ''}">
          <div class="week-day-name">${DAY_NAMES[d.getDay()]}요일</div>
          <div class="week-day-date">${d.getDate()}</div>
        </div>
        <div class="week-day-events">${evHtml}</div>
      </div>`;
  }
  el.innerHTML = html;

  el.querySelectorAll('.week-event-item').forEach(item => {
    item.addEventListener('click', () => openEditModal(item.dataset.eventId, cachedWeekEvents));
  });
}

document.getElementById('week-prev').addEventListener('click', () => { weekOffset--; loadWeekEvents(); });
document.getElementById('week-next').addEventListener('click', () => { weekOffset++; loadWeekEvents(); });

// ── 월간 뷰 ──
async function loadMonthEvents() {
  const start = new Date(monthYear, monthMonth, 1);
  const end = new Date(monthYear, monthMonth + 1, 0, 23, 59, 59);

  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  document.getElementById('month-title').textContent = `${monthYear}년 ${months[monthMonth]}`;

  if (!gapiInited || !gisInited || !gapi.client.getToken()) {
    renderMonthView([]);
    return;
  }
  try {
    const resp = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });
    cachedMonthEvents = resp.result.items || [];
  } catch(e) { cachedMonthEvents = []; }
  renderMonthView(cachedMonthEvents);
}

function renderMonthView(events) {
  const today = toDateKey(new Date());
  const eventMap = {};
  events.forEach(ev => {
    const key = (ev.start.dateTime || ev.start.date).slice(0, 10);
    if (!eventMap[key]) eventMap[key] = [];
    eventMap[key].push(ev);
  });

  const firstDay = new Date(monthYear, monthMonth, 1).getDay();
  const daysInMonth = new Date(monthYear, monthMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(monthYear, monthMonth, 0).getDate();

  let html = `
    <div class="month-grid">
      <div class="month-weekdays">
        ${['일','월','화','수','목','금','토'].map(d => `<div class="month-weekday">${d}</div>`).join('')}
      </div>
      <div class="month-days">`;

  // 이전 달 빈칸
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrevMonth - firstDay + 1 + i;
    html += `<div class="month-day other-month"><div class="day-num">${d}</div></div>`;
  }

  // 이번 달
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${monthYear}-${String(monthMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = key === today;
    const isSelected = selectedDate === key;
    const evs = eventMap[key] || [];
    const dots = evs.slice(0, 3).map(() => '<div class="event-dot-sm"></div>').join('');
    html += `
      <div class="month-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${key}">
        <div class="day-num">${d}</div>
        <div class="event-dots">${dots}</div>
      </div>`;
  }

  // 다음 달 빈칸
  const total = firstDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="month-day other-month"><div class="day-num">${i}</div></div>`;
  }

  html += `</div></div>`;
  document.getElementById('month-grid').innerHTML = html;

  // 날짜 클릭 → 해당 날 일정 표시
  document.querySelectorAll('.month-day:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => {
      selectedDate = cell.dataset.date;
      const evs = eventMap[selectedDate] || [];
      const [y, m, d] = selectedDate.split('-');
      const titleEl = document.getElementById('selected-day-title');
      titleEl.textContent = `${parseInt(m)}월 ${parseInt(d)}일 일정`;
      titleEl.style.display = 'block';
      const evEl = document.getElementById('selected-day-events');
      if (!evs.length) {
        evEl.innerHTML = '<div class="loading">일정이 없어요</div>';
      } else {
        evEl.innerHTML = evs.map(ev => {
          const s = ev.start.dateTime || ev.start.date;
          const sd = new Date(s);
          const timeStr = ev.start.dateTime
            ? `${sd.getHours()}:${String(sd.getMinutes()).padStart(2,'0')}`
            : '종일';
          return `<div class="event-item" data-event-id="${ev.id}">
            <div class="event-dot"></div>
            <div class="event-info">
              <div class="event-title">${ev.summary || '(제목 없음)'}</div>
              <div class="event-time">${timeStr}</div>
            </div>
          </div>`;
        }).join('');
        evEl.querySelectorAll('.event-item').forEach(item => {
          item.addEventListener('click', () => openEditModal(item.dataset.eventId, cachedMonthEvents));
        });
      }
      renderMonthView(events);
    });
  });
}

document.getElementById('month-prev').addEventListener('click', () => {
  monthMonth--;
  if (monthMonth < 0) { monthMonth = 11; monthYear--; }
  selectedDate = null;
  document.getElementById('selected-day-title').style.display = 'none';
  document.getElementById('selected-day-events').innerHTML = '';
  loadMonthEvents();
});
document.getElementById('month-next').addEventListener('click', () => {
  monthMonth++;
  if (monthMonth > 11) { monthMonth = 0; monthYear++; }
  selectedDate = null;
  document.getElementById('selected-day-title').style.display = 'none';
  document.getElementById('selected-day-events').innerHTML = '';
  loadMonthEvents();
});

// ── 오늘 탭 이번 주 캘린더 ──
async function loadTodayWeekEvents() {
  if (!gapiInited || !gisInited || !gapi.client.getToken()) return;
  const now = new Date();
  const endOfWeek = new Date(now);
  const dow = now.getDay();
  endOfWeek.setDate(now.getDate() + (dow === 0 ? 0 : 7 - dow));
  endOfWeek.setHours(23, 59, 59, 999);
  try {
    const resp = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: endOfWeek.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    });
    renderSimpleEvents(resp.result.items || [], 'week-events');
  } catch(e) {}
}

function renderSimpleEvents(events, containerId) {
  const el = document.getElementById(containerId);
  if (!events.length) { el.innerHTML = '<div class="loading">이번 주 일정이 없어요</div>'; return; }
  el.innerHTML = events.map(ev => {
    const s = ev.start.dateTime || ev.start.date;
    const d = new Date(s);
    const timeStr = ev.start.dateTime
      ? `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
      : `${d.getMonth()+1}/${d.getDate()} 종일`;
    return `<div class="event-item" data-event-id="${ev.id}">
      <div class="event-dot"></div>
      <div class="event-info">
        <div class="event-title">${ev.summary || '(제목 없음)'}</div>
        <div class="event-time">${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Google Auth ──
function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    });
    gapiInited = true;
    maybeEnableButtons();
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) return;
      document.getElementById('login-btn').textContent = '✅ 캘린더 연결됨';
      document.getElementById('login-btn').classList.add('connected');
      loadTodayWeekEvents();
    },
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (!gapiInited || !gisInited) return;
  document.getElementById('login-btn').disabled = false;
}

document.getElementById('login-btn').addEventListener('click', () => {
  if (!gapiInited || !gisInited) {
    alert('Google API 로딩 중이에요. 잠시 후 다시 눌러주세요.');
    return;
  }
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    loadTodayWeekEvents();
  }
});

// ── 일정 추가/수정 모달 ──
let editingEventId = null;

function openEditModal(eventId, events) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  editingEventId = eventId;
  document.getElementById('modal-title').textContent = '일정 수정';
  document.getElementById('event-title-input').value = ev.summary || '';
  document.getElementById('event-desc-input').value = ev.description || '';
  const startDt = ev.start.dateTime ? new Date(ev.start.dateTime) : null;
  const endDt = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
  if (startDt) document.getElementById('event-start-input').value = toLocalISOString(startDt);
  if (endDt) document.getElementById('event-end-input').value = toLocalISOString(endDt);
  document.getElementById('event-modal').classList.remove('hidden');
}

function openAddModal() {
  editingEventId = null;
  document.getElementById('modal-title').textContent = '일정 추가';
  ['event-title-input','event-start-input','event-end-input','event-desc-input']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('event-modal').classList.remove('hidden');
}

document.getElementById('add-task-btn').addEventListener('click', openAddModal);
document.getElementById('add-week-btn').addEventListener('click', openAddModal);
document.getElementById('add-month-btn').addEventListener('click', openAddModal);
document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('event-modal').classList.add('hidden');
});

document.getElementById('modal-save').addEventListener('click', async () => {
  const title = document.getElementById('event-title-input').value.trim();
  const startVal = document.getElementById('event-start-input').value;
  const endVal = document.getElementById('event-end-input').value;
  const desc = document.getElementById('event-desc-input').value;
  if (!title || !startVal) return alert('제목과 시작 시간을 입력해주세요');

  const event = {
    summary: title,
    description: desc,
    start: { dateTime: new Date(startVal).toISOString(), timeZone: 'Asia/Seoul' },
    end: { dateTime: new Date(endVal || startVal).toISOString(), timeZone: 'Asia/Seoul' },
  };

  try {
    if (editingEventId) {
      await gapi.client.calendar.events.update({ calendarId: 'primary', eventId: editingEventId, resource: event });
    } else {
      await gapi.client.calendar.events.insert({ calendarId: 'primary', resource: event });
    }
    document.getElementById('event-modal').classList.add('hidden');
    loadTodayWeekEvents();
    const activeTab = document.querySelector('.tab.active')?.dataset.tab;
    if (activeTab === 'week') loadWeekEvents();
    if (activeTab === 'month') loadMonthEvents();
  } catch(e) {
    alert('Google 캘린더 연결 후 사용 가능해요');
  }
});

// ── 초기 렌더 ──
renderTodayDate();
renderDday();
renderPhases();
renderTodayTasks();
// 주간/월간 타이틀 초기 세팅
loadWeekEvents();
loadMonthEvents();
