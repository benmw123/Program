/* ============================================================
   IRON LOG — app logic
   Permanent data (mesocycle position, working weights, finished
   workout history) lives in Firestore, scoped to the signed-in
   account, so it survives cleared cookies/storage and follows
   you across devices. The in-progress (not yet finished) workout
   is cached locally in localStorage purely so a refresh mid
   -session doesn't lose what you've typed — it's written to
   Firestore for good once you tap "Finish Workout".
   ============================================================ */

import { PROGRAM, MESOCYCLE_LENGTH, DELOAD_WEEK, getWeekAdjustedTarget } from "./program.js";
import {
  watchAuth, signUpWithEmail, signInWithEmail, signInWithGoogle, resolveRedirectResult,
  resetPassword, signOutUser, fetchUserState, saveUserState, fetchHistory, addHistorySession
} from "./firebase.js";
import { ALLOWED_EMAIL } from "./firebase-config.js";

const LS_ACTIVE = "ironlog_active";
const DAY_ORDER = PROGRAM.days.map(d => d.id);

/* ---------------- in-memory data (hydrated from Firestore on login) ---------------- */

function defaultState(){
  return {
    onboarded: false,
    week: 1,
    dayIndex: 0,
    daysCompletedThisWeek: 0,
    cycleNumber: 1,
    weights: {}
  };
}

let currentUser = null;
let state = defaultState();
let history = [];
let active = loadActive();
let restTimerHandle = null;
let deferredInstallPrompt = null;

function loadActive(){
  try{
    const raw = localStorage.getItem(LS_ACTIVE);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function saveActive(a){ localStorage.setItem(LS_ACTIVE, JSON.stringify(a)); }
function clearActive(){ localStorage.removeItem(LS_ACTIVE); }

async function persistState(){
  if(!currentUser) return;
  try{
    await saveUserState(currentUser.uid, state);
  }catch(e){
    toast("Couldn't sync to the cloud — check your connection.");
  }
}

/* ---------------- view routing ---------------- */

function showView(id){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const el = document.getElementById("view-" + id);
  if(el) el.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.view === id);
  });
  window.scrollTo(0,0);
}

document.querySelectorAll(".nav-btn[data-view]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const view = btn.dataset.view;
    showView(view);
    if(view === "home") renderHome();
    if(view === "history") renderHistory();
    if(view === "settings") renderSettings();
  });
});
document.querySelectorAll(".nav-back").forEach(btn=>{
  btn.addEventListener("click", ()=>{ showView(btn.dataset.back); renderHome(); });
});

/* ---------------- toast ---------------- */

let toastTimeout = null;
function toast(msg, ms=2800){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=> t.classList.remove("show"), ms);
}

/* ---------------- formatting helpers ---------------- */

function fmtWeight(w){
  if(w === undefined || w === null || w === "") return "—";
  const n = Number(w);
  return (n % 1 === 0) ? String(n) : n.toFixed(1);
}

function findLastPerformance(exerciseId){
  for(let i = history.length - 1; i >= 0; i--){
    const sess = history[i];
    const ex = sess.exercises.find(e => e.id === exerciseId);
    if(ex && ex.sets && ex.sets.length){
      return { date: sess.date, week: sess.week, sets: ex.sets };
    }
  }
  return null;
}

function weekLabel(week){
  return week === DELOAD_WEEK ? "Deload" : "Overload";
}

/* ============================================================
   AUTH / LOGIN
   ============================================================ */

let authMode = "signin"; // or "signup"

document.getElementById("tab-signin").addEventListener("click", ()=> setAuthMode("signin"));
document.getElementById("tab-signup").addEventListener("click", ()=> setAuthMode("signup"));

function setAuthMode(mode){
  authMode = mode;
  document.getElementById("tab-signin").classList.toggle("active", mode==="signin");
  document.getElementById("tab-signup").classList.toggle("active", mode==="signup");
  document.getElementById("btn-auth-submit").textContent = mode==="signin" ? "Sign In" : "Create Account";
  document.getElementById("auth-error").textContent = "";
}

document.getElementById("btn-auth-submit").addEventListener("click", async ()=>{
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const errEl = document.getElementById("auth-error");
  errEl.textContent = "";
  if(!email || !password){ errEl.textContent = "Enter an email and password."; return; }
  if(password.length < 6){ errEl.textContent = "Password must be at least 6 characters."; return; }

  setLoginLoading(true);
  try{
    if(authMode === "signin"){
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password);
    }
    // onAuthStateChanged handles the rest
  }catch(e){
    errEl.textContent = friendlyAuthError(e);
  }finally{
    setLoginLoading(false);
  }
});

document.getElementById("btn-forgot-password").addEventListener("click", async ()=>{
  const email = document.getElementById("auth-email").value.trim();
  const errEl = document.getElementById("auth-error");
  if(!email){ errEl.textContent = "Enter your email above first."; return; }
  try{
    await resetPassword(email);
    errEl.style.color = "var(--success)";
    errEl.textContent = "Password reset email sent.";
  }catch(e){
    errEl.style.color = "";
    errEl.textContent = friendlyAuthError(e);
  }
});

document.getElementById("btn-google-signin").addEventListener("click", async ()=>{
  const errEl = document.getElementById("auth-error");
  errEl.textContent = "";
  setLoginLoading(true);
  try{
    await signInWithGoogle();
  }catch(e){
    errEl.textContent = friendlyAuthError(e);
  }finally{
    setLoginLoading(false);
  }
});

function setLoginLoading(isLoading){
  document.getElementById("login-loading").style.display = isLoading ? "block" : "none";
  document.getElementById("btn-auth-submit").disabled = isLoading;
}

function friendlyAuthError(e){
  const code = e && e.code ? e.code : "";
  const map = {
    "auth/email-already-in-use": "That email already has an account — try Sign In instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in was closed before finishing.",
    "auth/network-request-failed": "Network error — check your connection."
  };
  return map[code] || "Something went wrong. Please try again.";
}

document.getElementById("btn-sign-out").addEventListener("click", async ()=>{
  if(confirm("Sign out of Iron Log?")){
    await signOutUser();
  }
});

/* ============================================================
   ONBOARDING
   ============================================================ */

function allExercisesFlat(){
  const list = [];
  PROGRAM.days.forEach(day => day.exercises.forEach(ex => list.push(ex)));
  return list;
}

function renderOnboardingList(){
  const wrap = document.getElementById("onboard-exercise-list");
  wrap.innerHTML = "";
  allExercisesFlat().forEach(ex=>{
    const row = document.createElement("div");
    row.className = "onboard-row";
    row.innerHTML = `
      <div class="onboard-row-info">
        <p class="onboard-row-name">${ex.name}</p>
        <p class="onboard-row-meta">${ex.repLow}-${ex.repHigh} reps · ${ex.equipment}</p>
      </div>
      <input type="number" inputmode="decimal" placeholder="lbs" data-ex="${ex.id}" min="0" step="2.5" />
    `;
    wrap.appendChild(row);
  });
}

document.getElementById("btn-start-program").addEventListener("click", async ()=>{
  const inputs = document.querySelectorAll("#onboard-exercise-list input");
  inputs.forEach(inp=>{
    const v = parseFloat(inp.value);
    if(!isNaN(v) && v >= 0) state.weights[inp.dataset.ex] = v;
  });
  state.onboarded = true;
  await persistState();
  showView("home");
  renderHome();
});

/* ============================================================
   HOME
   ============================================================ */

function buildMesoRing(){
  const svg = document.getElementById("meso-ring-svg");
  svg.innerHTML = "";
  const segments = MESOCYCLE_LENGTH;
  const r = 52, cx = 60, cy = 60;
  const gapDeg = 6;
  const segDeg = (360 / segments) - gapDeg;

  const bgCircle = document.createElementNS("http://www.w3.org/2000/svg","circle");
  bgCircle.setAttribute("cx",cx); bgCircle.setAttribute("cy",cy); bgCircle.setAttribute("r",r);
  bgCircle.setAttribute("fill","none");
  bgCircle.setAttribute("stroke","#22242b");
  bgCircle.setAttribute("stroke-width","10");
  svg.appendChild(bgCircle);

  const circumference = 2 * Math.PI * r;
  for(let i=0;i<segments;i++){
    const weekNum = i+1;
    const startDeg = i * (360/segments);
    const dashLen = (segDeg/360) * circumference;
    const gapLen = circumference - dashLen;
    const offset = -(startDeg/360)*circumference;

    const seg = document.createElementNS("http://www.w3.org/2000/svg","circle");
    seg.setAttribute("cx",cx); seg.setAttribute("cy",cy); seg.setAttribute("r",r);
    seg.setAttribute("fill","none");
    seg.setAttribute("stroke-width","10");
    seg.setAttribute("stroke-linecap","round");
    seg.setAttribute("stroke-dasharray", `${dashLen} ${gapLen}`);
    seg.setAttribute("stroke-dashoffset", offset);

    let color = "#2A2C33";
    if(weekNum < state.week) color = "#3a3d47";
    if(weekNum === state.week) color = (weekNum===DELOAD_WEEK) ? "#F2C84B" : "#FF5A36";
    if(weekNum === DELOAD_WEEK && weekNum > state.week) color = "#4a4226";
    seg.setAttribute("stroke", color);
    svg.appendChild(seg);
  }
}

function renderHome(){
  document.getElementById("meso-week-num").textContent = state.week;
  buildMesoRing();
  const isDeload = state.week === DELOAD_WEEK;
  document.getElementById("meso-status").textContent =
    `Week ${state.week} of ${MESOCYCLE_LENGTH} · ${weekLabel(state.week)} · Cycle ${state.cycleNumber}`;
  document.getElementById("meso-substatus").textContent = isDeload
    ? "Lighter loads, higher reps in reserve — let fatigue dissipate before the next block."
    : "Add a rep or a little weight wherever you can versus last time.";

  const day = PROGRAM.days[state.dayIndex];
  document.getElementById("next-day-eyebrow").textContent =
    `Next session · Day ${state.dayIndex+1} of 3`;
  document.getElementById("next-day-name").textContent = day.name;
  document.getElementById("next-day-sub").textContent = day.subtitle;

  const meta = document.getElementById("next-day-meta");
  meta.innerHTML = "";
  const totalSets = day.exercises.reduce((sum,ex)=>{
    return sum + getWeekAdjustedTarget(ex, state.week).sets;
  },0);
  const estMinutes = Math.round(day.exercises.reduce((sum,ex)=>{
    const t = getWeekAdjustedTarget(ex, state.week);
    return sum + t.sets * (ex.restSeconds + 45);
  },0)/60);

  const chips = [
    `${day.exercises.length} exercises`,
    `${totalSets} sets`,
    `~${estMinutes} min`
  ];
  if(isDeload) chips.push("DELOAD");
  chips.forEach(c=>{
    const span = document.createElement("span");
    span.className = "meta-chip" + (c==="DELOAD" ? " deload" : "");
    span.textContent = c;
    meta.appendChild(span);
  });

  const stats = document.getElementById("quick-stats");
  stats.innerHTML = "";
  const statData = [
    [String(history.length), "Total Sessions"],
    [`${state.daysCompletedThisWeek}/3`, "This Week"],
    [`#${state.cycleNumber}`, "Mesocycle"]
  ];
  statData.forEach(([num,label])=>{
    const box = document.createElement("div");
    box.className = "stat-box";
    box.innerHTML = `<span class="stat-num">${num}</span><span class="stat-label">${label}</span>`;
    stats.appendChild(box);
  });

  updateInstallBannerVisibility();
}

document.getElementById("btn-open-settings").addEventListener("click", ()=>{
  showView("settings"); renderSettings();
});

document.getElementById("btn-start-workout").addEventListener("click", startWorkout);

/* ============================================================
   WORKOUT SESSION
   ============================================================ */

function suggestedWeight(ex, week){
  const base = state.weights[ex.id];
  if(base === undefined) return null;
  if(week === DELOAD_WEEK){
    return Math.round((base * 0.6)/2.5)*2.5;
  }
  return base;
}

function buildSessionFromProgram(day, week){
  return {
    week,
    dayId: day.id,
    dayName: day.name,
    startedAt: new Date().toISOString(),
    exercises: day.exercises.map(ex=>{
      const target = getWeekAdjustedTarget(ex, week);
      const sw = suggestedWeight(ex, week);
      return {
        id: ex.id,
        name: ex.name,
        equipment: ex.equipment,
        cue: ex.cue,
        repLow: target.repLow,
        repHigh: target.repHigh,
        rirTarget: target.rir,
        restSeconds: target.restSeconds,
        isDeload: target.isDeload,
        sets: Array.from({length: target.sets}, ()=>({
          weight: sw !== null ? sw : "",
          reps: "",
          rir: "",
          done: false
        }))
      };
    })
  };
}

function startWorkout(){
  const day = PROGRAM.days[state.dayIndex];
  active = buildActiveOrResume(day);
  saveActive(active);
  showView("workout");
  renderWorkout();
}

function buildActiveOrResume(day){
  if(active && active.dayId === day.id && active.week === state.week){
    return active;
  }
  return buildSessionFromProgram(day, state.week);
}

function totalSetsInActive(){
  return active.exercises.reduce((s,ex)=>s+ex.sets.length,0);
}
function doneSetsInActive(){
  return active.exercises.reduce((s,ex)=>s+ex.sets.filter(st=>st.done).length,0);
}

function renderWorkout(){
  document.getElementById("workout-day-label").textContent =
    `${active.dayName} · Week ${active.week}${active.exercises[0].isDeload ? " · Deload" : ""}`;
  document.getElementById("workout-day-name").textContent = active.dayName + " Day";
  updateProgressPill();

  const list = document.getElementById("exercise-list");
  list.innerHTML = "";

  active.exercises.forEach((ex, exIdx)=>{
    const card = document.createElement("div");
    card.className = "exercise-card" + (ex.sets.every(s=>s.done) ? " done" : "");

    const last = findLastPerformance(ex.id);
    let lastHtml = "";
    if(last){
      const setsStr = last.sets.map(s=>`${fmtWeight(s.weight)}×${s.reps||"?"}`).join(", ");
      lastHtml = `<div class="exercise-lastperf">Last time (wk ${last.week}): <b>${setsStr}</b></div>`;
    } else {
      lastHtml = `<div class="exercise-lastperf">No history yet — log your first set below.</div>`;
    }

    card.innerHTML = `
      <div class="exercise-card-head">
        <div>
          <p class="exercise-name">${ex.name}</p>
          <p class="exercise-equip">${ex.equipment}</p>
        </div>
        <span class="exercise-target">${ex.repLow}-${ex.repHigh} reps · RIR ${ex.rirTarget}</span>
      </div>
      <p class="exercise-cue">${ex.cue}</p>
      ${lastHtml}
      <div class="set-labels">
        <span>#</span><span>Weight</span><span>Reps</span><span>RIR</span><span></span>
      </div>
      <div class="set-rows" data-exidx="${exIdx}"></div>
    `;

    const rowsWrap = card.querySelector(".set-rows");
    ex.sets.forEach((set, setIdx)=>{
      const row = document.createElement("div");
      row.className = "set-row" + (set.done ? " logged" : "");
      row.innerHTML = `
        <span class="set-num">${setIdx+1}</span>
        <input type="number" inputmode="decimal" step="2.5" placeholder="lbs" value="${set.weight}" data-field="weight" />
        <input type="number" inputmode="numeric" placeholder="reps" value="${set.reps}" data-field="reps" />
        <input type="number" inputmode="numeric" placeholder="0-5" value="${set.rir}" data-field="rir" min="0" max="6" />
        <button class="set-check ${set.done?'checked':''}" data-field="done">${set.done ? "✓" : ""}</button>
      `;
      const weightInp = row.querySelector('[data-field="weight"]');
      const repsInp = row.querySelector('[data-field="reps"]');
      const rirInp = row.querySelector('[data-field="rir"]');
      const checkBtn = row.querySelector('[data-field="done"]');

      weightInp.addEventListener("input", ()=>{ set.weight = weightInp.value; saveActive(active); });
      repsInp.addEventListener("input", ()=>{ set.reps = repsInp.value; saveActive(active); });
      rirInp.addEventListener("input", ()=>{ set.rir = rirInp.value; saveActive(active); });

      checkBtn.addEventListener("click", ()=>{
        if(!set.done){
          if(repsInp.value === ""){ toast("Enter reps before marking the set done"); return; }
          set.done = true;
          checkBtn.classList.add("checked");
          checkBtn.textContent = "✓";
          row.classList.add("logged");
          saveActive(active);
          updateProgressPill();
          card.classList.toggle("done", ex.sets.every(s=>s.done));
          startRestTimer(ex);
        } else {
          set.done = false;
          checkBtn.classList.remove("checked");
          checkBtn.textContent = "";
          row.classList.remove("logged");
          saveActive(active);
          updateProgressPill();
          card.classList.remove("done");
        }
      });

      rowsWrap.appendChild(row);
    });

    list.appendChild(card);
  });
}

function updateProgressPill(){
  document.getElementById("workout-progress-pill").textContent =
    `${doneSetsInActive()}/${totalSetsInActive()} sets`;
}

document.getElementById("btn-exit-workout").addEventListener("click", ()=>{
  if(confirm("Exit workout? Your logged sets are saved and you can resume later.")){
    showView("home"); renderHome();
  }
});

document.getElementById("btn-finish-workout").addEventListener("click", finishWorkout);

async function finishWorkout(){
  const done = doneSetsInActive();
  if(done === 0){
    if(!confirm("No sets logged yet. Finish anyway?")) return;
  }

  const session = {
    date: new Date().toISOString(),
    week: active.week,
    dayId: active.dayId,
    dayName: active.dayName,
    exercises: active.exercises.map(ex=>({
      id: ex.id,
      name: ex.name,
      sets: ex.sets.filter(s=>s.done).map(s=>({
        weight: s.weight === "" ? null : Number(s.weight),
        reps: s.reps === "" ? null : Number(s.reps),
        rir: s.rir === "" ? null : Number(s.rir)
      }))
    })).filter(ex=>ex.sets.length>0)
  };

  if(active.week !== DELOAD_WEEK){
    active.exercises.forEach(ex=>{
      const loggedSets = ex.sets.filter(s=>s.done && s.reps !== "");
      if(loggedSets.length === 0) return;
      const hitTop = loggedSets.every(s => Number(s.reps) >= ex.repHigh);
      const isCompound = PROGRAM.days.flatMap(d=>d.exercises).find(e=>e.id===ex.id)?.type === "compound";
      const increment = isCompound ? 5 : 2.5;
      const currentWeight = Number(loggedSets[loggedSets.length-1].weight) || state.weights[ex.id] || 0;
      state.weights[ex.id] = hitTop ? currentWeight + increment : currentWeight;
    });
  }

  state.daysCompletedThisWeek += 1;
  state.dayIndex = (state.dayIndex + 1) % DAY_ORDER.length;

  let mesoFinished = false;
  if(state.daysCompletedThisWeek >= DAY_ORDER.length){
    state.daysCompletedThisWeek = 0;
    if(state.week === DELOAD_WEEK){
      state.week = 1;
      state.cycleNumber += 1;
      mesoFinished = true;
    } else {
      state.week += 1;
    }
  }

  const finishBtn = document.getElementById("btn-finish-workout");
  finishBtn.disabled = true;
  finishBtn.textContent = "Saving…";

  try{
    await addHistorySession(currentUser.uid, session);
    history.push(session);
    await persistState();
    clearActive();
    active = null;

    showView("home");
    renderHome();
    toast(mesoFinished
      ? "Deload complete — new mesocycle started. Nudge up any lift that felt easy!"
      : `Workout saved · ${done} set${done===1?"":"s"} logged`);
  }catch(e){
    toast("Couldn't save to the cloud — check your connection and try again.");
  }finally{
    finishBtn.disabled = false;
    finishBtn.textContent = "Finish Workout";
  }
}

/* ---------------- rest timer ---------------- */

function startRestTimer(ex){
  const overlay = document.getElementById("rest-overlay");
  const nameEl = document.getElementById("rest-exercise-name");
  const timeEl = document.getElementById("rest-time");
  const fillEl = document.getElementById("rest-bar-fill");

  let total = ex.restSeconds;
  let remaining = total;
  nameEl.textContent = ex.name;
  updateRestDisplay(remaining, total, timeEl, fillEl);
  overlay.classList.add("show");

  clearInterval(restTimerHandle);
  restTimerHandle = setInterval(()=>{
    remaining -= 1;
    if(remaining <= 0){
      clearInterval(restTimerHandle);
      overlay.classList.remove("show");
      if(navigator.vibrate) navigator.vibrate([120,60,120]);
      toast("Rest complete — next set");
      return;
    }
    updateRestDisplay(remaining, total, timeEl, fillEl);
  },1000);

  function adjust(delta){
    remaining = Math.max(0, remaining + delta);
    total = Math.max(total, remaining);
    updateRestDisplay(remaining, total, timeEl, fillEl);
  }
  document.getElementById("btn-rest-minus").onclick = ()=>adjust(-15);
  document.getElementById("btn-rest-plus").onclick = ()=>adjust(15);
  document.getElementById("btn-rest-skip").onclick = ()=>{
    clearInterval(restTimerHandle);
    overlay.classList.remove("show");
  };
}

function updateRestDisplay(remaining, total, timeEl, fillEl){
  const m = Math.floor(remaining/60);
  const s = remaining % 60;
  timeEl.textContent = `${m}:${String(s).padStart(2,"0")}`;
  fillEl.style.width = `${Math.max(0,(remaining/total)*100)}%`;
}

/* ============================================================
   HISTORY
   ============================================================ */

let historySelectedExercise = null;

function renderHistory(){
  const filterWrap = document.getElementById("history-exercise-filter");
  filterWrap.innerHTML = "";
  const exercises = allExercisesFlat();
  if(historySelectedExercise === null && exercises.length){
    historySelectedExercise = exercises[0].id;
  }
  exercises.forEach(ex=>{
    const chip = document.createElement("button");
    chip.className = "filter-chip" + (ex.id === historySelectedExercise ? " active" : "");
    chip.textContent = ex.name;
    chip.addEventListener("click", ()=>{
      historySelectedExercise = ex.id;
      renderHistory();
    });
    filterWrap.appendChild(chip);
  });

  renderHistoryChart();
  renderHistorySessions();
}

function renderHistoryChart(){
  const wrap = document.getElementById("history-chart-wrap");
  wrap.innerHTML = "";
  const points = [];
  history.forEach(sess=>{
    const ex = sess.exercises.find(e=>e.id===historySelectedExercise);
    if(ex && ex.sets.length){
      const top = Math.max(...ex.sets.map(s=>s.weight||0));
      points.push({ date: sess.date, value: top });
    }
  });

  if(points.length === 0){
    wrap.innerHTML = `<div class="chart-empty">No logged sets yet for this exercise.<br>Finish a workout to start tracking it.</div>`;
    return;
  }

  const latest = points[points.length-1].value;
  const first = points[0].value;
  const delta = latest - first;

  const meta = document.createElement("div");
  meta.className = "chart-meta";
  meta.innerHTML = `
    <div><span class="big">${fmtWeight(latest)} lb</span><br><span class="lbl">Most recent top set</span></div>
    <div style="text-align:right;"><span class="big" style="color:${delta>=0?'#38D996':'#ef6a6a'}">${delta>=0?'+':''}${fmtWeight(delta)} lb</span><br><span class="lbl">Since first log</span></div>
  `;
  wrap.appendChild(meta);

  const canvas = document.createElement("canvas");
  canvas.width = 520; canvas.height = 140;
  canvas.style.width = "100%"; canvas.style.height = "140px";
  wrap.appendChild(canvas);
  drawLineChart(canvas, points.map(p=>p.value));
}

function drawLineChart(canvas, values){
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const pad = 16;
  ctx.clearRect(0,0,W,H);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;

  ctx.strokeStyle = "#2A2C33";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad);
  ctx.stroke();

  const stepX = (W - pad*2) / Math.max(1, values.length-1);

  ctx.beginPath();
  values.forEach((v,i)=>{
    const x = pad + i*stepX;
    const y = H - pad - ((v - min)/range) * (H - pad*2);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.strokeStyle = "#FF5A36";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  values.forEach((v,i)=>{
    const x = pad + i*stepX;
    const y = H - pad - ((v - min)/range) * (H - pad*2);
    ctx.beginPath();
    ctx.arc(x,y,3.5,0,Math.PI*2);
    ctx.fillStyle = (i===values.length-1) ? "#FF5A36" : "#C2431F";
    ctx.fill();
  });
}

function renderHistorySessions(){
  const wrap = document.getElementById("history-sessions");
  wrap.innerHTML = "";
  if(history.length === 0){
    wrap.innerHTML = `<div class="empty-state">No workouts logged yet. Finish your first session and it'll show up here.</div>`;
    return;
  }
  [...history].reverse().forEach(sess=>{
    const dt = new Date(sess.date);
    const dateStr = dt.toLocaleDateString(undefined,{month:"short",day:"numeric"});
    const setCount = sess.exercises.reduce((s,e)=>s+e.sets.length,0);
    const card = document.createElement("div");
    card.className = "session-card";
    card.innerHTML = `
      <div class="session-card-top">
        <span class="session-day">${sess.dayName} · Week ${sess.week}</span>
        <span class="session-date">${dateStr}</span>
      </div>
      <div class="session-summary">${sess.exercises.length} exercise${sess.exercises.length===1?"":"s"} · ${setCount} set${setCount===1?"":"s"} logged</div>
    `;
    wrap.appendChild(card);
  });
}

/* ============================================================
   SETTINGS
   ============================================================ */

function renderSettings(){
  document.getElementById("account-email").textContent =
    currentUser && currentUser.email ? `Signed in as ${currentUser.email}` : "Signed in";

  const picker = document.getElementById("week-picker");
  picker.innerHTML = "";
  for(let w=1; w<=MESOCYCLE_LENGTH; w++){
    const chip = document.createElement("button");
    chip.className = "week-chip" + (w===state.week ? " active":"") + (w===DELOAD_WEEK ? " deload-chip":"");
    chip.textContent = w;
    chip.addEventListener("click", async ()=>{
      state.week = w;
      state.daysCompletedThisWeek = 0;
      await persistState();
      renderSettings();
      toast(`Jumped to week ${w}`);
    });
    picker.appendChild(chip);
  }

  const list = document.getElementById("settings-exercise-list");
  list.innerHTML = "";
  allExercisesFlat().forEach(ex=>{
    const row = document.createElement("div");
    row.className = "onboard-row";
    const current = state.weights[ex.id];
    row.innerHTML = `
      <div class="onboard-row-info">
        <p class="onboard-row-name">${ex.name}</p>
        <p class="onboard-row-meta">${ex.equipment}</p>
      </div>
      <input type="number" inputmode="decimal" step="2.5" placeholder="lbs" value="${current!==undefined?current:''}" data-ex="${ex.id}" />
    `;
    const inp = row.querySelector("input");
    inp.addEventListener("change", async ()=>{
      const v = parseFloat(inp.value);
      if(!isNaN(v) && v>=0){
        state.weights[ex.id] = v;
        await persistState();
        toast("Weight updated");
      }
    });
    list.appendChild(row);
  });

  updateInstallButtonVisibility();
}

document.getElementById("btn-reset-all").addEventListener("click", async ()=>{
  if(confirm("This will permanently erase all logged history and weights from your account. Continue?")){
    state = defaultState();
    history = [];
    active = null;
    clearActive();
    await persistState();
    showView("onboarding");
    renderOnboardingList();
  }
});

/* ============================================================
   INSTALL PROMPT (Add to Home Screen)
   ============================================================ */

window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallBannerVisibility();
  updateInstallButtonVisibility();
});

window.addEventListener("appinstalled", ()=>{
  deferredInstallPrompt = null;
  document.getElementById("install-banner").classList.remove("show");
  updateInstallButtonVisibility();
  toast("Installed — find Iron Log on your homescreen.");
});

function updateInstallBannerVisibility(){
  const banner = document.getElementById("install-banner");
  if(!banner) return;
  const dismissed = sessionStorage.getItem("ironlog_install_dismissed");
  banner.classList.toggle("show", !!deferredInstallPrompt && !dismissed);
}
function updateInstallButtonVisibility(){
  const btn = document.getElementById("btn-install-app-settings");
  if(btn) btn.style.display = deferredInstallPrompt ? "block" : "none";
}

async function triggerInstall(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById("install-banner").classList.remove("show");
  updateInstallButtonVisibility();
}

document.getElementById("btn-install-app").addEventListener("click", triggerInstall);
document.getElementById("btn-install-app-settings").addEventListener("click", triggerInstall);
document.getElementById("btn-install-dismiss").addEventListener("click", ()=>{
  sessionStorage.setItem("ironlog_install_dismissed","1");
  document.getElementById("install-banner").classList.remove("show");
});

/* ============================================================
   AUTH STATE → APP BOOT
   ============================================================ */

async function handleSignedIn(user){
  const userEmail = (user.email || "").toLowerCase().trim();
  const allowed = ALLOWED_EMAIL.toLowerCase().trim();
  if(userEmail !== allowed){
    await signOutUser().catch(()=>{});
    document.getElementById("auth-error").textContent =
      "This app is private and restricted to one account. Signed out.";
    showView("login");
    return;
  }

  currentUser = user;
  try{
    const [remoteState, remoteHistory] = await Promise.all([
      fetchUserState(user.uid),
      fetchHistory(user.uid)
    ]);
    state = remoteState ? { ...defaultState(), ...remoteState } : defaultState();
    history = remoteHistory || [];
  }catch(e){
    toast("Couldn't load your data — check your connection.");
    state = defaultState();
    history = [];
  }

  if(!state.onboarded){
    renderOnboardingList();
    showView("onboarding");
    return;
  }

  if(active){
    showView("workout");
    renderWorkout();
  } else {
    showView("home");
    renderHome();
  }
}

function handleSignedOut(){
  currentUser = null;
  state = defaultState();
  history = [];
  active = null;
  clearActive();
  document.getElementById("auth-email").value = "";
  document.getElementById("auth-password").value = "";
  document.getElementById("auth-error").textContent = "";
  showView("login");
}

async function init(){
  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("service-worker.js").catch(()=>{});
    });
  }

  await resolveRedirectResult().catch(()=>{});

  watchAuth((user)=>{
    if(user) handleSignedIn(user);
    else handleSignedOut();
  });
}

init();
