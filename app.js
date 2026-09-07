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

  const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

    chartGranularity: document.getElementById("chartGranularity"),
    chartScroll: document.getElementById("chartScroll"),
    chartSvg: document.getElementById("chartSvg"),
    chartTooltip: document.getElementById("chartTooltip"),
    chartEmpty: document.getElementById("chartEmpty"),
    chartTable: document.getElementById("chartTable"),
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

  // ---------- Charts view ----------
  const SVGNS = "http://www.w3.org/2000/svg";
  const RATING_OF_SCORE = { 1: "poor", 2: "neutral", 3: "good" };
  let chartGranularity = "day";

  function scoreOf(rating) {
    return rating ? SCORE[rating] : null;
  }

  function avgScore(values) {
    const nums = values.filter((v) => v != null);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  }

  function ratingOfScore(v) {
    return RATING_OF_SCORE[Math.min(3, Math.max(1, Math.round(v)))];
  }

  function ratingLabel(v, showAvg) {
    const name = ratingOfScore(v);
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    return showAvg ? `${cap} (${v.toFixed(1)})` : cap;
  }

  function ratingClass(v) {
    return "rating-" + ratingOfScore(v);
  }

  function chartRange() {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
    return { start, end };
  }

  function buildDailyPoints() {
    const { start, end } = chartRange();
    const points = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const entry = getEntry(toKey(d)) || {};
      points.push({ date: new Date(d), diet: scoreOf(entry.diet), exercise: scoreOf(entry.exercise) });
    }
    return points;
  }

  function buildWeeklyPoints() {
    const { start, end } = chartRange();
    const points = [];
    for (let w = startOfWeek(start); w <= end; w = addDays(w, 7)) {
      const dietVals = [], exerciseVals = [];
      for (let i = 0; i < 7; i++) {
        const entry = getEntry(toKey(addDays(w, i))) || {};
        dietVals.push(scoreOf(entry.diet));
        exerciseVals.push(scoreOf(entry.exercise));
      }
      points.push({ date: new Date(w), diet: avgScore(dietVals), exercise: avgScore(exerciseVals) });
    }
    return points;
  }

  function buildMonthlyPoints() {
    const { start, end } = chartRange();
    const points = [];
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(start.getFullYear(), start.getMonth() + m, 1);
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      const dietVals = [], exerciseVals = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        if (d > end) break;
        const entry = getEntry(toKey(d)) || {};
        dietVals.push(scoreOf(entry.diet));
        exerciseVals.push(scoreOf(entry.exercise));
      }
      points.push({ date: monthDate, diet: avgScore(dietVals), exercise: avgScore(exerciseVals) });
    }
    return points;
  }

  function buildChartPoints(granularity) {
    if (granularity === "day") return buildDailyPoints();
    if (granularity === "week") return buildWeeklyPoints();
    return buildMonthlyPoints();
  }

  function monthYearShort(date) {
    return `${MONTH_SHORT[date.getMonth()]} '${String(date.getFullYear()).slice(2)}`;
  }

  function dateLabelFor(point, granularity) {
    if (granularity === "month") {
      return point.date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    if (granularity === "week") {
      const weekEnd = addDays(point.date, 6);
      return `Week of ${fmtShort(point.date)} – ${fmtShort(weekEnd)}, ${weekEnd.getFullYear()}`;
    }
    return point.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVGNS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function renderChartSVG(points, granularity) {
    const svg = el.chartSvg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const hasData = points.some((p) => p.diet != null || p.exercise != null);
    el.chartEmpty.classList.toggle("hidden", hasData);
    el.chartScroll.classList.toggle("hidden", !hasData);
    if (!hasData) {
      svg.setAttribute("width", 0);
      svg.setAttribute("height", 0);
      return;
    }

    const H = 220, topPad = 16, bottomPad = 34, leftPad = 58, rightPad = 100;
    const plotH = H - topPad - bottomPad;
    const n = points.length;
    const minPx = granularity === "day" ? 14 : granularity === "week" ? 20 : 40;
    const containerW = el.chartScroll.clientWidth || 320;
    const innerMin = Math.max(1, n - 1) * minPx;
    const W = Math.max(containerW, leftPad + rightPad + innerMin);

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);

    const xStep = n > 1 ? (W - leftPad - rightPad) / (n - 1) : 0;
    const xAt = (i) => leftPad + i * xStep;
    const yAt = (score) => topPad + ((3 - score) / 2) * plotH;

    // y gridlines with Poor/Neutral/Good reference dots (reusing the app's semantic colors)
    [
      { score: 3, cls: "axis-dot-good", label: "Good" },
      { score: 2, cls: "axis-dot-neutral", label: "Neutral" },
      { score: 1, cls: "axis-dot-poor", label: "Poor" },
    ].forEach((row) => {
      const y = yAt(row.score);
      svg.appendChild(svgEl("line", { class: "grid-hline", x1: leftPad, x2: W - rightPad, y1: y, y2: y, "stroke-width": 1 }));
      svg.appendChild(svgEl("circle", { class: row.cls, cx: 10, cy: y, r: 4 }));
      const t = svgEl("text", { class: "axis-label", x: 18, y: y + 3, "font-size": 10 });
      t.textContent = row.label;
      svg.appendChild(t);
    });

    // month-boundary vertical gridlines + x-axis labels
    let tickIdx;
    if (granularity === "month") {
      tickIdx = points.map((_, i) => i);
    } else {
      tickIdx = [];
      points.forEach((p, i) => {
        if (i === 0 || p.date.getMonth() !== points[i - 1].date.getMonth() || p.date.getFullYear() !== points[i - 1].date.getFullYear()) {
          tickIdx.push(i);
        }
      });
    }
    tickIdx.forEach((i) => {
      const x = xAt(i);
      if (granularity !== "month") {
        svg.appendChild(svgEl("line", { class: "grid-vline", x1: x, x2: x, y1: topPad, y2: topPad + plotH, "stroke-width": 1 }));
      }
      const t = svgEl("text", {
        class: "axis-label", x, y: H - 12, "font-size": 10,
        "text-anchor": granularity === "month" ? "middle" : "start",
      });
      t.textContent = monthYearShort(points[i].date);
      svg.appendChild(t);
    });

    // series lines + point markers
    function drawSeries(key, cls) {
      let d = "", open = false, lastI = -1;
      points.forEach((p, i) => {
        const v = p[key];
        if (v == null) { open = false; return; }
        const x = xAt(i), y = yAt(v);
        d += (open ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1) + " ";
        open = true;
      });
      if (d) {
        svg.appendChild(svgEl("path", {
          class: "line-" + cls, d: d.trim(), fill: "none",
          "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round",
        }));
      }
      points.forEach((p, i) => {
        const v = p[key];
        if (v == null) return;
        svg.appendChild(svgEl("circle", { class: "pt-" + cls + " pt-ring", cx: xAt(i), cy: yAt(v), r: 3, "stroke-width": 1.5 }));
        lastI = i;
      });
      return lastI;
    }

    const lastDietI = drawSeries("diet", "diet");
    const lastExerciseI = drawSeries("exercise", "exercise");

    // direct end-of-line labels (the one place these lines get labeled, per line-chart convention)
    function endLabel(idx, key, cls, dy) {
      if (idx < 0) return;
      const v = points[idx][key];
      const x = xAt(idx), y = yAt(v);
      svg.appendChild(svgEl("circle", { class: "pt-" + cls + " pt-ring", cx: x, cy: y, r: 5, "stroke-width": 2 }));
      const t = svgEl("text", { x: x + 9, y: y + dy, class: "axis-label-strong", "font-size": 11 });
      t.textContent = ratingLabel(v, granularity !== "day");
      svg.appendChild(t);
    }
    const sameEndpoint = lastDietI >= 0 && lastDietI === lastExerciseI && points[lastDietI].diet === points[lastDietI].exercise;
    if (sameEndpoint) {
      endLabel(lastDietI, "diet", "diet", -7);
      endLabel(lastExerciseI, "exercise", "exercise", 15);
    } else {
      endLabel(lastDietI, "diet", "diet", 4);
      endLabel(lastExerciseI, "exercise", "exercise", 4);
    }

    // crosshair + tap/hover tooltip
    const crosshair = svgEl("line", { class: "crosshair-line", x1: 0, x2: 0, y1: topPad, y2: topPad + plotH, "stroke-width": 1, opacity: 0 });
    svg.appendChild(crosshair);

    const hitRect = svgEl("rect", { x: leftPad, y: 0, width: Math.max(0, W - leftPad), height: H, fill: "transparent" });
    svg.appendChild(hitRect);

    function nearestIndex(clientX) {
      const rect = svg.getBoundingClientRect();
      const localX = (clientX - rect.left) * (W / rect.width);
      return Math.max(0, Math.min(n - 1, Math.round((localX - leftPad) / (xStep || 1))));
    }

    function showTooltip(idx) {
      const p = points[idx];
      const x = xAt(idx);
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.setAttribute("opacity", 1);

      el.chartTooltip.innerHTML = "";
      const dateEl = document.createElement("div");
      dateEl.className = "tt-date";
      dateEl.textContent = dateLabelFor(p, granularity);
      el.chartTooltip.appendChild(dateEl);

      [["diet", "Diet"], ["exercise", "Exercise"]].forEach(([key, name]) => {
        const row = document.createElement("div");
        row.className = "tt-row";
        const keySwatch = document.createElement("span");
        keySwatch.className = "tt-key " + key;
        row.appendChild(keySwatch);
        const nameEl = document.createElement("span");
        nameEl.textContent = name;
        row.appendChild(nameEl);
        const valEl = document.createElement("span");
        const v = p[key];
        valEl.className = "tt-value" + (v != null ? " " + ratingClass(v) : "");
        valEl.textContent = v != null ? ratingLabel(v, granularity !== "day") : "No log";
        row.appendChild(valEl);
        el.chartTooltip.appendChild(row);
      });

      el.chartTooltip.classList.remove("hidden");
      const sl = el.chartScroll.scrollLeft, cw = el.chartScroll.clientWidth, approxW = 150;
      let left = x + 10;
      if (left + approxW > sl + cw) left = x - approxW - 10;
      left = Math.max(sl + 4, Math.min(left, sl + cw - approxW - 4));
      el.chartTooltip.style.left = left + "px";
    }

    function hideTooltip() {
      crosshair.setAttribute("opacity", 0);
      el.chartTooltip.classList.add("hidden");
    }

    hitRect.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      showTooltip(nearestIndex(e.clientX));
    });
    hitRect.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      hideTooltip();
    });

    let touchStartX = null;
    hitRect.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") { showTooltip(nearestIndex(e.clientX)); return; }
      touchStartX = e.clientX;
    });
    hitRect.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      if (touchStartX != null && Math.abs(e.clientX - touchStartX) < 10) showTooltip(nearestIndex(e.clientX));
      touchStartX = null;
    });

    // open scrolled to the most recent data
    requestAnimationFrame(() => { el.chartScroll.scrollLeft = el.chartScroll.scrollWidth; });
  }

  function renderChartTable(points, granularity) {
    const table = el.chartTable;
    table.innerHTML = "";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Period", "Diet", "Exercise"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    points.forEach((p) => {
      if (p.diet == null && p.exercise == null) return;
      const tr = document.createElement("tr");
      const tdDate = document.createElement("td");
      tdDate.textContent = granularity === "month"
        ? monthYearShort(p.date)
        : granularity === "week"
          ? `${fmtShort(p.date)} – ${fmtShort(addDays(p.date, 6))}`
          : p.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      tr.appendChild(tdDate);
      ["diet", "exercise"].forEach((key) => {
        const td = document.createElement("td");
        const v = p[key];
        if (v == null) {
          td.textContent = "–";
        } else {
          td.textContent = ratingLabel(v, granularity !== "day");
          td.className = ratingClass(v);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function renderCharts() {
    const points = buildChartPoints(chartGranularity);
    renderChartSVG(points, chartGranularity);
    renderChartTable(points, chartGranularity);
  }

  el.chartGranularity.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    chartGranularity = btn.dataset.granularity;
    el.chartGranularity.querySelectorAll(".toggle-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderCharts();
  });

  window.addEventListener("resize", () => {
    if (!document.getElementById("chartsView").classList.contains("hidden")) renderCharts();
  });

  // ---------- Tab switching ----------
  function switchView(viewId) {
    el.views.forEach((v) => v.classList.toggle("hidden", v.id !== viewId));
    el.tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === viewId));
    if (viewId === "weekView") renderWeek();
    if (viewId === "monthView") renderMonth();
    if (viewId === "chartsView") renderCharts();
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
