(() => {
  "use strict";

  const STORAGE_KEY = "dietExerciseTracker.v1";
  const SCORE = { poor: 1, neutral: 2, good: 3 };
  const LABEL = { poor: "Poor", neutral: "Neutral", good: "Good" };
  const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // ---------- Storage ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted storage, start fresh */ }
    return { entries: {} };
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- Date helpers (local time, no UTC drift) ----------
  function toKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function fromKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function startOfWeek(date) {
    // Monday-first week
    const d = new Date(date);
    const dow = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function isSameDay(a, b) {
    return toKey(a) === toKey(b);
  }

  function fmtShort(date) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // ---------- App state ----------
  let logDate = new Date();
  let weekRef = new Date();
  let monthRef = new Date();

  const el = {
    dayDate: document.getElementById("dayDate"),
    dayPicker: document.getElementById("dayPicker"),
    prevDayBtn: document.getElementById("prevDayBtn"),
    nextDayBtn: document.getElementById("nextDayBtn"),
    clearDayBtn: document.getElementById("clearDayBtn"),
    ratingGroups: document.querySelectorAll(".rating-buttons"),

    weekLabel: document.getElementById("weekLabel"),
    weekDays: document.getElementById("weekDays"),
    weekDietSummary: document.getElementById("weekDietSummary"),
    weekExerciseSummary: document.getElementById("weekExerciseSummary"),
    prevWeekBtn: document.getElementById("prevWeekBtn"),
    nextWeekBtn: document.getElementById("nextWeekBtn"),

    monthLabel: document.getElementById("monthLabel"),
    monthWeekdayRow: document.getElementById("monthWeekdayRow"),
    monthGrid: document.getElementById("monthGrid"),
    monthDietSummary: document.getElementById("monthDietSummary"),
    monthExerciseSummary: document.getElementById("monthExerciseSummary"),
    prevMonthBtn: document.getElementById("prevMonthBtn"),
    nextMonthBtn: document.getElementById("nextMonthBtn"),

    tabs: document.querySelectorAll(".tab-btn"),
    views: document.querySelectorAll(".view"),
  };

  function getEntry(key) {
    return state.entries[key] || null;
  }

  function setRating(key, category, value) {
    const entry = state.entries[key] || {};
    entry[category] = value;
    state.entries[key] = entry;
    saveState();
  }

  // ---------- Log view ----------
  function renderLog() {
    const key = toKey(logDate);
    const today = new Date();
    el.dayDate.textContent = isSameDay(logDate, today)
      ? `Today · ${fmtShort(logDate)}`
      : logDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    el.dayPicker.value = key;

    const entry = getEntry(key) || {};
    el.ratingGroups.forEach((group) => {
      const category = group.dataset.category;
      group.querySelectorAll(".rate-btn").forEach((btn) => {
        btn.classList.toggle("selected", entry[category] === btn.dataset.value);
      });
    });
  }

  el.ratingGroups.forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".rate-btn");
      if (!btn) return;
      const category = group.dataset.category;
      const key = toKey(logDate);
      const current = getEntry(key) || {};
      // tap the already-selected value again to clear it
      const value = current[category] === btn.dataset.value ? null : btn.dataset.value;
      if (value === null) {
        delete current[category];
        state.entries[key] = current;
        if (!current.diet && !current.exercise) delete state.entries[key];
        saveState();
      } else {
        setRating(key, category, value);
      }
      renderLog();
    });
  });

  el.prevDayBtn.addEventListener("click", () => { logDate = addDays(logDate, -1); renderLog(); });
  el.nextDayBtn.addEventListener("click", () => { logDate = addDays(logDate, 1); renderLog(); });
  el.dayPicker.addEventListener("change", () => {
    if (el.dayPicker.value) {
      logDate = fromKey(el.dayPicker.value);
      renderLog();
    }
  });
  el.clearDayBtn.addEventListener("click", () => {
    const key = toKey(logDate);
    if (!state.entries[key]) return;
    if (!confirm("Clear the diet and exercise rating for this day?")) return;
    delete state.entries[key];
    saveState();
    renderLog();
  });

  // ---------- Week view ----------
  function buildSummary(counts, total) {
    const rows = ["poor", "neutral", "good"].map((k) => `
      <div class="summary-row">
        <span>${LABEL[k]}</span>
        <span class="count">${counts[k]}</span>
      </div>`).join("");
    let avgLine = "";
    if (total > 0) {
      const avg = (counts.poor * 1 + counts.neutral * 2 + counts.good * 3) / total;
      avgLine = `<div class="summary-avg">Avg score: ${avg.toFixed(1)} / 3 (${total} logged)</div>`;
    } else {
      avgLine = `<div class="summary-avg">No days logged</div>`;
    }
    return rows + avgLine;
  }

  function renderWeek() {
    const start = startOfWeek(weekRef);
    const end = addDays(start, 6);
    el.weekLabel.textContent = `${fmtShort(start)} – ${fmtShort(end)}, ${end.getFullYear()}`;

    const today = new Date();
    const dietCounts = { poor: 0, neutral: 0, good: 0 };
    const exerciseCounts = { poor: 0, neutral: 0, good: 0 };
    let dietTotal = 0, exerciseTotal = 0;

    let rowsHtml = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const key = toKey(d);
      const entry = getEntry(key) || {};
      if (entry.diet) { dietCounts[entry.diet]++; dietTotal++; }
      if (entry.exercise) { exerciseCounts[entry.exercise]++; exerciseTotal++; }

      const dietPill = entry.diet
        ? `<div class="pill ${entry.diet}">${LABEL[entry.diet]}</div>`
        : `<div class="pill">–</div>`;
      const exercisePill = entry.exercise
        ? `<div class="pill ${entry.exercise}">${LABEL[entry.exercise]}</div>`
        : `<div class="pill">–</div>`;

      rowsHtml += `
        <div class="week-day-row ${isSameDay(d, today) ? "is-today" : ""}">
          <div class="week-day-label">${WEEKDAY_SHORT[i]}<span class="wd-num">${d.getDate()}</span></div>
          ${dietPill}
          ${exercisePill}
        </div>`;
    }
    el.weekDays.innerHTML = rowsHtml;
    el.weekDietSummary.innerHTML = buildSummary(dietCounts, dietTotal);
    el.weekExerciseSummary.innerHTML = buildSummary(exerciseCounts, exerciseTotal);
  }

  el.prevWeekBtn.addEventListener("click", () => { weekRef = addDays(weekRef, -7); renderWeek(); });
  el.nextWeekBtn.addEventListener("click", () => { weekRef = addDays(weekRef, 7); renderWeek(); });

  // ---------- Month view ----------
  function renderMonthWeekdayRow() {
    el.monthWeekdayRow.innerHTML = WEEKDAY_SHORT.map((w) => `<div>${w}</div>`).join("");
  }

  function renderMonth() {
    const year = monthRef.getFullYear();
    const month = monthRef.getMonth();
    el.monthLabel.textContent = monthRef.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingEmpty = (firstOfMonth.getDay() + 6) % 7; // Monday-first offset

    const today = new Date();
    const dietCounts = { poor: 0, neutral: 0, good: 0 };
    const exerciseCounts = { poor: 0, neutral: 0, good: 0 };
    let dietTotal = 0, exerciseTotal = 0;

    let cells = "";
    for (let i = 0; i < leadingEmpty; i++) {
      cells += `<div class="month-cell empty"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const key = toKey(d);
      const entry = getEntry(key) || {};
      if (entry.diet) { dietCounts[entry.diet]++; dietTotal++; }
      if (entry.exercise) { exerciseCounts[entry.exercise]++; exerciseTotal++; }

      const dietDot = `<i class="dot ${entry.diet || "none"}"></i>`;
      const exerciseDot = `<i class="dot ${entry.exercise || "none"}"></i>`;

      cells += `
        <div class="month-cell ${isSameDay(d, today) ? "is-today" : ""}" data-key="${key}">
          <div class="cell-num">${day}</div>
          <div class="cell-dots">${dietDot}${exerciseDot}</div>
        </div>`;
    }
    el.monthGrid.innerHTML = cells;
    el.monthDietSummary.innerHTML = buildSummary(dietCounts, dietTotal);
    el.monthExerciseSummary.innerHTML = buildSummary(exerciseCounts, exerciseTotal);
  }

  el.monthGrid.addEventListener("click", (e) => {
    const cell = e.target.closest(".month-cell[data-key]");
    if (!cell) return;
    logDate = fromKey(cell.dataset.key);
    renderLog();
    switchView("logView");
  });

  el.prevMonthBtn.addEventListener("click", () => {
    monthRef = new Date(monthRef.getFullYear(), monthRef.getMonth() - 1, 1);
    renderMonth();
  });
  el.nextMonthBtn.addEventListener("click", () => {
    monthRef = new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 1);
    renderMonth();
  });

  // ---------- Tab switching ----------
  function switchView(viewId) {
    el.views.forEach((v) => v.classList.toggle("hidden", v.id !== viewId));
    el.tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === viewId));
    if (viewId === "weekView") renderWeek();
    if (viewId === "monthView") renderMonth();
  }

  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  // ---------- Init ----------
  renderMonthWeekdayRow();
  renderLog();

  // ---------- PWA service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
