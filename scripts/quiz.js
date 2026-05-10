/* =========================================================
   quiz.js — Full quiz engine
   Modes: Practice, Exam (40 Qs, 1-hr timer), Infinity
   Persistence: localStorage (survives refresh)
   ========================================================= */

// ---- Subject → JSON file mapping ----
const SUBJECT_MAP = {
  FCN:           { file: 'FCN_Fundamentals_of_Computer_Networking_MCQ.json',  name: 'FCN — Fundamentals of Computer Networking', icon: '🌐' },
  COSA:          { file: 'COSA_Operating_System_Administration_MCQ.json',     name: 'COSA — OS & Administration',                icon: '🖥️' },
  Compliance:    { file: 'Compliance_Audit_MCQ.json',                          name: 'Compliance Audit',                           icon: '✅' },
  CyberForensics:{ file: 'Cyber_Forensics_MCQ.json',                           name: 'Cyber Forensics',                            icon: '🔍' },
  NDC:           { file: 'NDC_Network_Defense_Countermeasures_MCQ.json',       name: 'NDC — Network Defense',                     icon: '🛡️' },
  DevOps:        { file: 'IT_Infrastructure_DevOps_MCQ.json',                   name: 'IT Infrastructure & DevOps',                icon: '⚙️' },
  Security:      { file: 'Security_Concepts_MCQ.json',                          name: 'Security Concepts',                          icon: '🔐' },
  PKI:           { file: 'PKI_Public_Key_Infrastructure_MCQ.json',              name: 'PKI — Public Key Infrastructure',           icon: '🔑' },
  Programming:   { file: 'Programming_Concepts_MCQ.json',                       name: 'Programming Concepts',                       icon: '💻' },
  Ports:         { file: 'Ports_Network_Port_Numbers_MCQ.json',                  name: 'Ports — Network Port Numbers',               icon: '🔌' },
};

// ---- State ----
let state = {
  subject:      null,
  mode:         'practice',   // practice | exam | infinity
  allQuestions: [],
  questions:    [],           // current ordered/filtered list
  currentIndex: 0,
  answers:      {},           // { qIndex: { selected, correct } }
  skipped:      {},           // { qIndex: true }
  examStarted:  false,
  examTimer:    3600,         // seconds remaining
  examInterval: null,
  diffFilter:   'all',
  infinityPool: [],
  infinityIndex:0,
};

const storageKey = () => `pe_quiz_${state.subject}`;

// ---- Boot ----
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  state.subject = params.get('subject');

  if (!state.subject || !SUBJECT_MAP[state.subject]) {
    document.getElementById('loadingState').innerHTML = '<p style="color:var(--red)">Invalid subject. <a href="index.html">Go back</a></p>';
    return;
  }

  // Populate subject info
  const info = SUBJECT_MAP[state.subject];
  document.title = `ping_exams — ${info.name}`;
  document.getElementById('subjectIcon').textContent = info.icon;
  document.getElementById('subjectName').textContent = info.name;
  document.getElementById('subjectFile').textContent = info.file;


  // Restore or load fresh
  const saved = loadSession();
  if (saved) {
    restoreSession(saved);
  } else {
    loadQuestions();
  }
});

// ---- Load JSON ----
async function loadQuestions() {
  showElement('loadingState');
  hideElement('quizCard');
  hideElement('qNavigator');
  hideElement('examResultScreen');

  const info = SUBJECT_MAP[state.subject];
  try {
    const resp = await fetch(`data/${info.file}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    state.allQuestions = sanitizeQuestions(data.questions || []);
    startMode(state.mode, true);
  } catch(e) {
    document.getElementById('loadingState').innerHTML =
      `<p style="color:var(--red)">Failed to load <strong>${info.file}</strong>.<br>Ensure JSON file exists in <code>data/</code> folder.<br><small>${e.message}</small></p>
       <a href="index.html" style="margin-top:14px;color:var(--accent)">← Back to subjects</a>`;
  }
}

// ---- Sanitize ----
function sanitizeQuestions(qs) {
  return qs.map((q, i) => ({
    id:          q.id !== undefined ? q.id : i,
    difficulty:  (q.difficulty || 'medium').toLowerCase(),
    question:    String(q.question || '').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    options:     (q.options || []).map(o => String(o).replace(/</g,'&lt;').replace(/>/g,'&gt;')),
    correct:     Number(q.correct),
    explanation: String(q.explanation || ''),
    takeaway:    String(q.takeaway || ''),
  }));
}

// ---- Start / Switch Mode ----
function startMode(mode, freshLoad = false) {
  clearInterval(state.examInterval);
  state.mode        = mode;
  state.currentIndex= 0;
  state.answers     = {};
  state.skipped     = {};
  state.examStarted = false;
  state.examTimer   = 3600;

  // Update mode buttons
  ['practice','exam','infinity'].forEach(m => {
    document.getElementById('btn-' + m).classList.toggle('active', m === mode);
  });

  // Show/hide exam start + infinity panels
  const examCard = document.getElementById('examStartCard');
  const infCard  = document.getElementById('infinityCard');
  const remainBox= document.getElementById('remainBox');
  examCard.style.display = mode === 'exam'     ? 'block' : 'none';
  infCard.style.display  = mode === 'infinity' ? 'block' : 'none';
  remainBox.style.display= mode === 'exam'     ? 'flex'  : 'none';

  if (mode === 'practice') {
    state.questions = sortEasyFirst([...state.allQuestions]).slice(0, 40);
  } else if (mode === 'exam') {
    state.questions = sortEasyFirst([...state.allQuestions]).slice(0, 40);
    resetTimerDisplay();
  } else if (mode === 'infinity') {
    buildInfinityPool();
  }

  if (mode !== 'infinity') {
    renderNavigator();
    hideElement('infinityProgressWrap');
  } else {
    document.getElementById('navDots').innerHTML = '';
    hideElement('qNavigator');
    showElement('infinityProgressWrap');
    updateInfinityProgress();
  }
  renderQuestion();
  updateStats();
  if (!freshLoad) saveSession();
}

function switchMode(mode) {
  if (mode === state.mode) return;
  // Warn if exam is running
  if (state.mode === 'exam' && state.examStarted) {
    if (!confirm('Switch mode? Exam progress will be lost.')) return;
    clearInterval(state.examInterval);
  }
  startMode(mode);
}

// ---- Infinity pool ----
function buildInfinityPool() {
  let src = [...state.allQuestions];
  if (state.diffFilter !== 'all') src = src.filter(q => q.difficulty === state.diffFilter);
  if (src.length === 0) src = [...state.allQuestions];
  state.infinityPool  = sortEasyFirst(src);
  state.infinityIndex = 0;
  state.questions     = state.infinityPool;
  state.currentIndex  = 0;
}

function setDifficulty(diff) {
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  state.diffFilter = diff;
  if (state.mode === 'infinity') {
    state.answers = {}; state.skipped = {};
    buildInfinityPool();
    renderQuestion();
    updateStats();
  }
}

// ---- Render Question ----
function renderQuestion() {
  const q = currentQuestion();
  if (!q) return;

  hideElement('loadingState');
  hideElement('examResultScreen');
  showElement('quizCard');
  if (state.mode !== 'infinity') {
    showElement('qNavigator');
    hideElement('infinityProgressWrap');
  } else {
    hideElement('qNavigator');
    showElement('infinityProgressWrap');
    updateInfinityProgress();
  }

  const total = state.mode === 'infinity' ? '∞' : state.questions.length;

  document.getElementById('qNum').textContent        = `Q ${state.currentIndex + 1}`;
  document.getElementById('qProgressText').textContent = `${state.currentIndex + 1} of ${total}`;
  document.getElementById('questionText').textContent  = q.question;

  // Difficulty badge
  const diff = document.getElementById('qDiff');
  diff.textContent  = capitalize(q.difficulty);
  diff.className    = `q-diff-badge ${q.difficulty}`;

  // Options
  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  const letters = ['A','B','C','D'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span><span class="option-text">${opt}</span>`;
    btn.onclick = () => selectOption(i);
    grid.appendChild(btn);
  });

  // Lock options visually and functionally if exam not started
  if (state.mode === 'exam' && !state.examStarted) {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.style.cursor = 'not-allowed';
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    });
    document.getElementById('btnSubmit').disabled = true;
    document.getElementById('btnSubmit').style.pointerEvents = 'none';
    document.getElementById('btnSkip').disabled = true;
    document.getElementById('btnSkip').style.pointerEvents = 'none';
  } else {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.style.cursor = '';
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    });
    document.getElementById('btnSubmit').style.pointerEvents = '';
    document.getElementById('btnSkip').style.pointerEvents = '';
    document.getElementById('btnSkip').disabled = false;
  }

  // Restore answer state if revisiting
  const saved = state.answers[state.currentIndex];
  if (saved !== undefined) {
    applyAnswerVisuals(saved.selected, saved.correct, q.correct);
    showExplanation(q, saved.correct);
    document.getElementById('btnSubmit').disabled = true;
  } else {
    hideExplanation();
    document.getElementById('btnSubmit').disabled = false;
  }

  // Restore skipped
  if (state.skipped[state.currentIndex] && saved === undefined) {
    // just show no answer
  }

  updateProgress();
  updateStats();
  highlightNavDot();
}

function currentQuestion() {
  if (state.mode === 'infinity') {
    if (state.currentIndex >= state.questions.length) {
      // Extend pool
      const more = shuffle([...state.allQuestions]);
      state.questions = [...state.questions, ...more];
    }
  }
  return state.questions[state.currentIndex];
}

// ---- Select Option ----
let selectedOption = null;

function selectOption(idx) {
  if (state.mode === 'exam' && !state.examStarted) return;
  const saved = state.answers[state.currentIndex];
  if (saved !== undefined) return; // already answered

  selectedOption = idx;
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === idx);
    const letter = btn.querySelector('.option-letter');
    if (i === idx) letter.style.background = 'var(--accent)';
    else letter.style.background = '';
    if (i === idx) letter.style.color = '#fff';
    else letter.style.color = '';
  });
  document.getElementById('btnSubmit').disabled = false;
}

// ---- Submit ----
function submitAnswer() {
  if (state.mode === 'exam' && !state.examStarted) return;
  const saved = state.answers[state.currentIndex];
  if (saved !== undefined) return;
  if (selectedOption === null) {
    shakeBtnSubmit();
    return;
  }

  const q = currentQuestion();
  const isCorrect = selectedOption === q.correct;

  state.answers[state.currentIndex] = { selected: selectedOption, correct: isCorrect };
  if (state.skipped[state.currentIndex]) delete state.skipped[state.currentIndex];

  applyAnswerVisuals(selectedOption, isCorrect, q.correct);
  showExplanation(q, isCorrect);

  document.getElementById('btnSubmit').disabled = true;
  selectedOption = null;

  updateStats();
  updateNavDot(state.currentIndex);
  if (state.mode === 'infinity') updateInfinityProgress();
  saveSession();
}

function shakeBtnSubmit() {
  const btn = document.getElementById('btnSubmit');
  btn.style.animation = 'none';
  void btn.offsetWidth;
  btn.style.animation = 'shake .4s ease';
  setTimeout(() => btn.style.animation = '', 400);
}

function applyAnswerVisuals(selected, isCorrect, correct) {
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    btn.classList.remove('selected','correct','wrong');
    const letter = btn.querySelector('.option-letter');
    letter.style.background = '';
    letter.style.color = '';
    if (i === correct) { btn.classList.add('correct'); }
    if (i === selected && !isCorrect) { btn.classList.add('wrong'); }
  });
}

// ---- Skip ----
function skipQuestion() {
  const saved = state.answers[state.currentIndex];
  if (saved !== undefined) { nextQuestion(); return; }
  state.skipped[state.currentIndex] = true;
  selectedOption = null;
  updateNavDot(state.currentIndex);
  updateStats();
  if (state.mode === 'infinity') updateInfinityProgress();
  saveSession();
  nextQuestion();
}

// ---- Navigation ----
function nextQuestion() {
  // Exam mode end check
  if (state.mode === 'exam' && state.currentIndex >= state.questions.length - 1) {
    showExamResult();
    return;
  }
  // Infinity: always advance
  if (state.mode === 'infinity') {
    state.currentIndex++;
    selectedOption = null;
    renderQuestion();
    saveSession();
    return;
  }
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    selectedOption = null;
    renderQuestion();
    saveSession();
  } else if (state.mode === 'practice') {
    showPracticeResult();
  }
}

function prevQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    selectedOption = null;
    renderQuestion();
    saveSession();
  }
}

function goRandomQuestion() {
  const len = state.mode === 'infinity' ? state.questions.length : state.questions.length;
  const idx = Math.floor(Math.random() * len);
  state.currentIndex = idx;
  selectedOption = null;
  renderQuestion();
}

// ---- Explanation ----
function showExplanation(q, isCorrect) {
  const box   = document.getElementById('explanationBox');
  const hdr   = document.getElementById('explHeader');
  const icon  = document.getElementById('explIcon');
  const title = document.getElementById('explTitle');
  const text  = document.getElementById('explText');
  const take  = document.getElementById('explTakeaway');

  box.style.display = 'block';
  box.className = isCorrect ? 'explanation-box correct-expl' : 'explanation-box wrong-expl';
  icon.textContent  = isCorrect ? '✓' : '✗';
  title.textContent = isCorrect ? 'Correct!' : 'Incorrect';
  text.textContent  = q.explanation;
  take.textContent  = q.takeaway;
}

function hideExplanation() {
  const box = document.getElementById('explanationBox');
  box.style.display = 'none';
}

// ---- Navigator ----
function renderNavigator() {
  const nav = document.getElementById('navDots');
  nav.innerHTML = '';
  state.questions.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'nav-dot';
    dot.textContent = i + 1;
    dot.title = `Question ${i + 1}`;
    dot.onclick = () => {
      state.currentIndex = i;
      selectedOption = null;
      renderQuestion();
    };
    nav.appendChild(dot);
  });
  highlightNavDot();
}

function updateNavDot(idx) {
  const dots = document.querySelectorAll('.nav-dot');
  if (!dots[idx]) return;
  dots[idx].classList.remove('current','answered-correct','answered-wrong','skipped');
  if (state.answers[idx] !== undefined) {
    dots[idx].classList.add(state.answers[idx].correct ? 'answered-correct' : 'answered-wrong');
  } else if (state.skipped[idx]) {
    dots[idx].classList.add('skipped');
  }
}

function highlightNavDot() {
  const dots = document.querySelectorAll('.nav-dot');
  dots.forEach((d, i) => {
    d.classList.remove('current');
    updateNavDot(i);
  });
  if (dots[state.currentIndex]) {
    dots[state.currentIndex].classList.add('current');
  }
}

// ---- Stats ----
function updateStats() {
  const answers = Object.values(state.answers);
  const correct = answers.filter(a => a.correct).length;
  const wrong   = answers.filter(a => !a.correct).length;
  const skipped = Object.keys(state.skipped).length;
  const remain  = state.mode === 'exam' ? Math.max(0, state.questions.length - Object.keys(state.answers).length - skipped) : 0;

  document.getElementById('statCorrect').textContent = correct;
  document.getElementById('statWrong').textContent   = wrong;
  document.getElementById('statSkipped').textContent  = skipped;
  document.getElementById('statRemain').textContent   = state.mode === 'exam' ? remain : '—';
}

// ---- Progress ----
function updateProgress() {
  const progressWrap = document.querySelector('.progress-wrap');
  if (state.mode === 'infinity') {
    if (progressWrap) progressWrap.style.display = 'none';
    return;
  }
  if (progressWrap) progressWrap.style.display = '';
  const total = state.questions.length || 1;
  const pct   = Math.min(100, Math.round((state.currentIndex / total) * 100));
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = `${state.currentIndex + 1} / ${total}`;
}

// ---- Infinity Progress Bar ----
function updateInfinityProgress() {
  const answered = Object.keys(state.answers).length;
  const total    = state.allQuestions.length;
  const pct      = Math.min(100, Math.round((answered / total) * 100));
  const fill = document.getElementById('infProgressFill');
  const lbl  = document.getElementById('infProgressLabel');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent  = answered + ' / ' + total + ' answered';
}

// ---- Exam Timer ----
function startExamTimer() {
  if (state.examStarted) return;
  state.examStarted = true;
  document.getElementById('startExamBtn').disabled = true;
  document.getElementById('startExamBtn').textContent = 'Timer Running';
  // Unlock options and controls
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.style.cursor = '';
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  });
  document.getElementById('btnSubmit').style.pointerEvents = '';
  document.getElementById('btnSkip').style.pointerEvents = '';
  document.getElementById('btnSkip').disabled = false;
  document.getElementById('btnSubmit').disabled = true;

  state.examInterval = setInterval(() => {
    state.examTimer--;
    updateTimerDisplay();
    if (state.examTimer <= 0) {
      clearInterval(state.examInterval);
      showExamResult(true);
    }
    saveSession();
  }, 1000);
}

function resetTimerDisplay() {
  const disp = document.getElementById('examTimerDisplay');
  if (!disp) return;
  disp.textContent = '60:00';
  disp.className   = 'exam-timer-display';
}

function updateTimerDisplay() {
  const disp = document.getElementById('examTimerDisplay');
  if (!disp) return;
  const m = Math.floor(state.examTimer / 60).toString().padStart(2,'0');
  const s = (state.examTimer % 60).toString().padStart(2,'0');
  disp.textContent = `${m}:${s}`;
  disp.className = 'exam-timer-display';
  if (state.examTimer <= 300)      disp.classList.add('danger');
  else if (state.examTimer <= 600) disp.classList.add('warning');
  else disp.classList.add('running');
}

// ---- Exam Result ----
function showExamResult(timedOut = false) {
  clearInterval(state.examInterval);
  hideElement('quizCard');
  hideElement('qNavigator');
  showElement('examResultScreen');

  const answers = Object.values(state.answers);
  const correct = answers.filter(a => a.correct).length;
  const wrong   = answers.filter(a => !a.correct).length;
  const skipped = Object.keys(state.skipped).length;
  const total   = state.questions.length;
  const pct     = Math.round((correct / total) * 100);

  document.getElementById('resFinalCorrect').textContent = correct;
  document.getElementById('resFinalWrong').textContent   = wrong;
  document.getElementById('resFinalSkipped').textContent  = skipped;
  document.getElementById('resFinalPercent').textContent  = pct + '%';

  const titleEl = document.querySelector('.result-title');
  if (titleEl) titleEl.textContent = timedOut ? "Time's Up!" : 'Exam Complete!';

  const restartBtn = document.getElementById('resultRestartBtn');
  if (restartBtn) { restartBtn.textContent = 'Retake Exam'; restartBtn.setAttribute('onclick', 'restartExam()'); }

  clearSession();
}

function restartExam() {
  clearSession();
  startMode('exam');
}

// ---- Practice Result (auto-show when all 40 Qs done) ----
function showPracticeResult() {
  hideElement('quizCard');
  hideElement('qNavigator');
  showElement('examResultScreen');

  const answers = Object.values(state.answers);
  const correct = answers.filter(a => a.correct).length;
  const wrong   = answers.filter(a => !a.correct).length;
  const skipped = Object.keys(state.skipped).length;
  const total   = state.questions.length;
  const pct     = Math.round((correct / total) * 100);

  document.getElementById('resFinalCorrect').textContent = correct;
  document.getElementById('resFinalWrong').textContent   = wrong;
  document.getElementById('resFinalSkipped').textContent  = skipped;
  document.getElementById('resFinalPercent').textContent  = pct + '%';

  const titleEl = document.querySelector('.result-title');
  if (titleEl) titleEl.textContent = 'Practice Complete!';

  // Show restart practice button, hide exam restart
  const restartBtn = document.getElementById('resultRestartBtn');
  if (restartBtn) restartBtn.setAttribute('onclick', 'restartPractice()');

  clearSession();
}

function restartPractice() {
  clearSession();
  startMode('practice');
}

// ---- Infinity Score (on-demand via button) ----
function showInfinityScore() {
  hideElement('quizCard');
  hideElement('qNavigator');
  showElement('examResultScreen');

  const answers = Object.values(state.answers);
  const correct = answers.filter(a => a.correct).length;
  const wrong   = answers.filter(a => !a.correct).length;
  const skipped = Object.keys(state.skipped).length;
  const attempted = answers.length;
  const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

  document.getElementById('resFinalCorrect').textContent = correct;
  document.getElementById('resFinalWrong').textContent   = wrong;
  document.getElementById('resFinalSkipped').textContent  = skipped;
  document.getElementById('resFinalPercent').textContent  = pct + '%';

  const titleEl = document.querySelector('.result-title');
  if (titleEl) titleEl.textContent = `Infinity Score (${attempted} answered)`;

  const restartBtn = document.getElementById('resultRestartBtn');
  if (restartBtn) restartBtn.setAttribute('onclick', 'resumeInfinity()');
  if (restartBtn) restartBtn.textContent = '← Resume Infinity';
}

function resumeInfinity() {
  hideElement('examResultScreen');
  showElement('quizCard');
  renderQuestion();
}

// ---- Session Persistence ----
function saveSession() {
  try {
    const data = {
      mode:         state.mode,
      currentIndex: state.currentIndex,
      questions:    state.questions.map(q => q.id),
      answers:      state.answers,
      skipped:      state.skipped,
      examStarted:  state.examStarted,
      examTimer:    state.examTimer,
      diffFilter:   state.diffFilter,
      ts:           Date.now(),
    };
    sessionStorage.setItem(storageKey(), JSON.stringify(data));
  } catch(e) {}
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after 4 hours
    if (Date.now() - data.ts > 4 * 3600 * 1000) { sessionStorage.removeItem(storageKey()); return null; }
    return data;
  } catch(e) { return null; }
}

function clearSession() {
  sessionStorage.removeItem(storageKey());
}

async function restoreSession(saved) {
  showElement('loadingState');
  const info = SUBJECT_MAP[state.subject];
  try {
    const resp = await fetch(`data/${info.file}`);
    const data = await resp.json();
    state.allQuestions = sanitizeQuestions(data.questions || []);

    // Reconstruct ordered question list by saved IDs
    const idMap = {};
    state.allQuestions.forEach(q => { idMap[q.id] = q; });
    const orderedQs = saved.questions.map(id => idMap[id]).filter(Boolean);
    if (orderedQs.length === 0) { startMode('practice', true); return; }

    state.mode         = saved.mode || 'practice';
    state.questions    = orderedQs;
    state.currentIndex = saved.currentIndex || 0;
    state.answers      = saved.answers || {};
    state.skipped      = saved.skipped || {};
    state.examStarted  = saved.examStarted || false;
    state.examTimer    = saved.examTimer || 3600;
    state.diffFilter   = saved.diffFilter || 'all';

    // Restore mode buttons
    ['practice','exam','infinity'].forEach(m => {
      document.getElementById('btn-' + m).classList.toggle('active', m === state.mode);
    });

    const examCard = document.getElementById('examStartCard');
    const infCard  = document.getElementById('infinityCard');
    const remainBox= document.getElementById('remainBox');
    examCard.style.display = state.mode === 'exam'     ? 'block' : 'none';
    infCard.style.display  = state.mode === 'infinity' ? 'block' : 'none';
    remainBox.style.display= state.mode === 'exam'     ? 'flex'  : 'none';

    if (state.mode === 'exam') {
      updateTimerDisplay();
      if (state.examStarted) {
        // Resume timer
        document.getElementById('startExamBtn').disabled = true;
        document.getElementById('startExamBtn').textContent = 'Timer Running';
        state.examInterval = setInterval(() => {
          state.examTimer--;
          updateTimerDisplay();
          if (state.examTimer <= 0) {
            clearInterval(state.examInterval);
            showExamResult(true);
          }
          saveSession();
        }, 1000);
      }
    }

    if (state.mode !== 'infinity') {
      renderNavigator();
      hideElement('infinityProgressWrap');
    } else {
      hideElement('qNavigator');
      showElement('infinityProgressWrap');
      updateInfinityProgress();
    }
    renderQuestion();
    updateStats();

  } catch(e) {
    startMode('practice', true);
  }
}

// ---- Utilities ----
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function showElement(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hideElement(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

// ---- CSS for shake animation (injected) ----
const style = document.createElement('style');
style.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`;
document.head.appendChild(style);


// ---- Sort: first 10 easy, rest random ----
function sortEasyFirst(arr) {
  const easy   = shuffle(arr.filter(q => q.difficulty === 'easy'));
  const others = shuffle(arr.filter(q => q.difficulty !== 'easy'));
  const first10easy = easy.slice(0, 10);
  const remaining   = shuffle([...easy.slice(10), ...others]);
  return [...first10easy, ...remaining];
}
