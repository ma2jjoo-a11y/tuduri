// Google API 설정 - Google Cloud Console에서 발급 후 아래에 입력
const GOOGLE_CLIENT_ID = '112150475059-0su7lvaksudsn8179rfiqdq17hbvjd0k.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyAx9kFA2Gn5OQiUOz3kDchmV2cxYzLWQ2U';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

// 학사 일정 데이터
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

// 트랙 소개 자료 할 일 데이터
const PHASES = [
  {
    id: 'phase1a',
    title: 'Phase 1-1. 기획 (6/23 ~ 6/25)',
    tasks: [
      { id: 't1', label: 'PPT 목차 구성' },
      { id: 't2', label: '트랙 소개 내용 자료 조사 (커리큘럼, 교수진, 특징)' },
      { id: 't3', label: '참고 레퍼런스 PPT 2~3개 수집' },
    ]
  },
  {
    id: 'phase1b',
    title: 'Phase 1-2. 제작 (6/26 ~ 7/4)',
    tasks: [
      { id: 't4', label: 'PPT 초안 작성 (내용 채우기)' },
      { id: 't5', label: '디자인 작업' },
      { id: 't6', label: '이미지/그래픽 소재 준비' },
    ]
  },
  {
    id: 'phase1c',
    title: 'Phase 1-3. 1차 마무리 (7/5 ~ 7/7)',
    tasks: [
      { id: 't7', label: '전체 내용 검토 및 수정' },
      { id: 't8', label: '⭐ 여행 전 저장본 백업' },
    ]
  },
  {
    id: 'phase2',
    title: 'Phase 2. 여행 후 최종 마무리 (7/13 ~ 7/16)',
    tasks: [
      { id: 't9', label: '눈 새로 뜨고 최종 검토' },
      { id: 't10', label: '수정 사항 반영' },
      { id: 't11', label: 'PDF 변환' },
      { id: 't12', label: '제출 이메일 초안 작성' },
    ]
  },
  {
    id: 'phase3',
    title: '✅ Phase 3. 제출 (7/17)',
    tasks: [
      { id: 't13', label: 'kimjinyong@hanyang.ac.kr 이메일 발송' },
    ]
  },
  {
    id: 'optional',
    title: '🎬 [선택] 홍보영상 (7/5~7/7, 우선순위 낮음)',
    tasks: [
      { id: 't14', label: 'AI 영상 툴 조사 (Sora, Runway, Vrew 등)' },
      { id: 't15', label: '30초~1분 스크립트 작성' },
      { id: 't16', label: '영상 생성 시도' },
    ]
  },
];

// 상태 관리
let taskState = JSON.parse(localStorage.getItem('tuduri-tasks') || '{}');
let tokenClient = null;
let gapiInited = false;
let gisInited = false;

// 탭 전환
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// 오늘 날짜 표시
function renderTodayDate() {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  document.getElementById('today-date').textContent =
    `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
}

// D-day 계산
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

// 학사 일정 타임라인 렌더
function renderTimeline() {
  const el = document.getElementById('semester-timeline');
  el.innerHTML = SEMESTER_SCHEDULE.map(item => `
    <div class="timeline-item">
      <div class="tl-date">${item.date}</div>
      <div class="tl-dot"></div>
      <div class="tl-content ${item.urgent ? 'urgent' : ''}">${item.label}</div>
    </div>
  `).join('');
}

// 할 일 목록 렌더
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

  // 체크박스 이벤트
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

// 오늘의 할 일 (오늘 날짜 기준 phase 자동 선택)
function renderTodayTasks() {
  const today = new Date();
  const el = document.getElementById('today-tasks');
  const allTasks = PHASES.flatMap(p => p.tasks);
  const pending = allTasks.filter(t => !taskState[t.id]).slice(0, 3);
  if (pending.length === 0) {
    el.innerHTML = '<div class="loading">✅ 오늘 할 일이 없어요!</div>';
    return;
  }
  el.innerHTML = pending.map(task => `
    <div class="task-item ${taskState[task.id] ? 'done' : ''}">
      <input type="checkbox" id="today-${task.id}" ${taskState[task.id] ? 'checked' : ''} />
      <label for="today-${task.id}">${task.label}</label>
    </div>
  `).join('');

  document.querySelectorAll('#today-tasks input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const realId = cb.id.replace('today-', '');
      taskState[realId] = cb.checked;
      localStorage.setItem('tuduri-tasks', JSON.stringify(taskState));
      cb.closest('.task-item').classList.toggle('done', cb.checked);
      renderProgress();
      renderPhases();
    });
  });
}

// 진행률
function renderProgress() {
  const allTasks = PHASES.flatMap(p => p.tasks);
  const done = allTasks.filter(t => taskState[t.id]).length;
  const pct = Math.round((done / allTasks.length) * 100);
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

// Google Calendar 연동
function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({ apiKey: GOOGLE_API_KEY, discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'] });
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
      loadCalendarEvents();
    },
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (!gapiInited || !gisInited) return;
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Google 캘린더 연결';
  btn.disabled = false;
}

document.getElementById('login-btn').addEventListener('click', () => {
  if (!gapiInited || !gisInited) {
    alert('Google API 로딩 중이에요. 잠시 후 다시 눌러주세요.');
    return;
  }
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    loadCalendarEvents();
  }
});

async function loadCalendarEvents() {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const resp = await gapi.client.calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: twoWeeksLater.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20,
  });

  const events = resp.result.items || [];
  renderCalendarEvents(events, 'week-events');
  renderCalendarEvents(events, 'calendar-events');
}

function renderCalendarEvents(events, containerId) {
  const el = document.getElementById(containerId);
  if (!events.length) { el.innerHTML = '<div class="loading">일정이 없어요</div>'; return; }
  el.innerHTML = events.map(ev => {
    const start = ev.start.dateTime || ev.start.date;
    const d = new Date(start);
    const timeStr = ev.start.dateTime
      ? `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
      : `${d.getMonth()+1}/${d.getDate()} 종일`;
    return `
      <div class="event-item" data-event-id="${ev.id}">
        <div class="event-dot"></div>
        <div class="event-info">
          <div class="event-title">${ev.summary || '(제목 없음)'}</div>
          <div class="event-time">${timeStr}</div>
        </div>
      </div>
    `;
  }).join('');

  // 일정 클릭 시 수정 모달
  el.querySelectorAll('.event-item').forEach(item => {
    item.addEventListener('click', () => openEditModal(item.dataset.eventId, events));
  });
}

// 일정 추가/수정 모달
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

function toLocalISOString(d) {
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

document.getElementById('add-task-btn').addEventListener('click', () => {
  editingEventId = null;
  document.getElementById('modal-title').textContent = '일정 추가';
  document.getElementById('event-title-input').value = '';
  document.getElementById('event-start-input').value = '';
  document.getElementById('event-end-input').value = '';
  document.getElementById('event-desc-input').value = '';
  document.getElementById('event-modal').classList.remove('hidden');
});

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
    loadCalendarEvents();
  } catch(e) {
    alert('Google 캘린더 연결 후 사용 가능해요');
  }
});

// 초기 렌더
renderTodayDate();
renderDday();
renderTimeline();
renderPhases();
renderTodayTasks();
