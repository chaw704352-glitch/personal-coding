(() => {
  "use strict";

  const STORAGE_KEY = "hawkEagleCounter.v1";
  const SHEET_URL_KEY = "hawkEagleCounter.sheetUrl";
  const SOUND_KEY = "hawkEagleCounter.soundOn";

  const el = {
    hawkCount: document.getElementById("hawkCount"),
    eagleCount: document.getElementById("eagleCount"),
    totalCount: document.getElementById("totalCount"),
    hawkBtn: document.getElementById("hawkBtn"),
    eagleBtn: document.getElementById("eagleBtn"),
    hawkMinus: document.getElementById("hawkMinus"),
    eagleMinus: document.getElementById("eagleMinus"),
    undoBtn: document.getElementById("undoBtn"),
    resetBtn: document.getElementById("resetBtn"),
    tripDate: document.getElementById("tripDate"),
    menuBtn: document.getElementById("menuBtn"),
    closeMenuBtn: document.getElementById("closeMenuBtn"),
    menuOverlay: document.getElementById("menuOverlay"),
    soundToggle: document.getElementById("soundToggle"),
    sheetUrlInput: document.getElementById("sheetUrlInput"),
    saveSheetUrlBtn: document.getElementById("saveSheetUrlBtn"),
    sendToSheetBtn: document.getElementById("sendToSheetBtn"),
    sheetStatus: document.getElementById("sheetStatus"),
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted storage, start fresh */ }
    return { hawks: 0, eagles: 0, history: [], startDate: new Date().toISOString() };
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render() {
    el.hawkCount.textContent = state.hawks;
    el.eagleCount.textContent = state.eagles;
    el.totalCount.textContent = state.hawks + state.eagles;
    el.tripDate.textContent = new Date(state.startDate).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  // ---------- Sound effects (Web Audio API, no external files needed) ----------
  let audioCtx = null;
  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function soundEnabled() {
    return el.soundToggle.checked;
  }

  function playTone(freq, start, duration, type, gainPeak, glideTo) {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainPeak, start + duration * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  const hawkClip = new Audio("sounds/hawk.mp3");
  hawkClip.preload = "auto";

  function playHawkSynth() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    // sharp, quick "kee-yeer" chirp - two fast upward chirps
    playTone(1600, now, 0.12, "sawtooth", 0.15, 2400);
    playTone(1400, now + 0.13, 0.15, "sawtooth", 0.15, 2200);
  }

  function playHawkSound() {
    if (!soundEnabled()) return;
    getCtx(); // unlock audio on iOS/Android before playing the clip
    const clip = hawkClip.cloneNode(true);
    clip.play().catch(playHawkSynth);
  }

  const eagleClip = new Audio("sounds/eagle.mp3");
  eagleClip.preload = "auto";

  function playEagleSynth() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    // majestic descending call - lower, longer, with a little warble
    playTone(950, now, 0.35, "triangle", 0.18, 500);
    playTone(700, now + 0.3, 0.25, "triangle", 0.14, 420);
  }

  function playEagleSound() {
    if (!soundEnabled()) return;
    getCtx(); // unlock audio on iOS/Android before playing the clip
    const clip = eagleClip.cloneNode(true);
    clip.play().catch(playEagleSynth);
  }

  const fanfareClip = new Audio("sounds/fanfare.mp3");
  fanfareClip.preload = "auto";

  function playMilestoneFanfareSynth() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      playTone(freq, now + i * 0.11, 0.22, "square", 0.12, null);
    });
  }

  function playMilestoneFanfare() {
    if (!soundEnabled()) return;
    getCtx(); // unlock audio on iOS/Android before playing the clip
    const clip = fanfareClip.cloneNode(true);
    clip.play().catch(playMilestoneFanfareSynth);
  }

  const oopsClip = new Audio("sounds/oops.mp3");
  oopsClip.preload = "auto";

  function playOopsSynth() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    // sad little trombone "wah-wah"
    playTone(300, now, 0.25, "sawtooth", 0.14, 220);
    playTone(220, now + 0.22, 0.35, "sawtooth", 0.14, 160);
  }

  function playOopsSound() {
    if (!soundEnabled()) return;
    getCtx(); // unlock audio on iOS/Android before playing the clip
    const clip = oopsClip.cloneNode(true);
    clip.play().catch(playOopsSynth);
  }

  function showMilestoneFlash(total) {
    const flash = document.createElement("div");
    flash.className = "milestone-flash";
    flash.textContent = `🎉 ${total} birds! 🎉`;
    document.body.appendChild(flash);
    flash.addEventListener("animationend", () => flash.remove());
  }

  // ---------- Actions with undo history ----------
  function pushHistory(action) {
    state.history.push(action);
    if (state.history.length > 200) state.history.shift();
  }

  function addBird(kind) {
    const before = state.hawks + state.eagles;
    if (kind === "hawk") state.hawks++;
    else state.eagles++;
    pushHistory({ type: kind, delta: 1 });
    saveState();
    render();

    if (kind === "hawk") playHawkSound();
    else playEagleSound();

    const after = state.hawks + state.eagles;
    if (Math.floor(after / 10) > Math.floor(before / 10) && after > 0) {
      setTimeout(() => {
        playMilestoneFanfare();
        showMilestoneFlash(after);
      }, 350);
    }
  }

  function removeBird(kind) {
    if (kind === "hawk" && state.hawks <= 0) return;
    if (kind === "eagle" && state.eagles <= 0) return;
    if (kind === "hawk") state.hawks--;
    else state.eagles--;
    pushHistory({ type: kind, delta: -1 });
    saveState();
    render();
    playOopsSound();
  }

  function undoLast() {
    const last = state.history.pop();
    if (!last) return;
    if (last.type === "hawk") state.hawks -= last.delta;
    else state.eagles -= last.delta;
    if (state.hawks < 0) state.hawks = 0;
    if (state.eagles < 0) state.eagles = 0;
    saveState();
    render();
    playOopsSound();
  }

  function resetTrip() {
    if (!confirm("Reset the trip counter to zero? This can't be undone.")) return;
    state = { hawks: 0, eagles: 0, history: [], startDate: new Date().toISOString() };
    saveState();
    render();
  }

  // ---------- Event bindings ----------
  el.hawkBtn.addEventListener("click", () => addBird("hawk"));
  el.eagleBtn.addEventListener("click", () => addBird("eagle"));
  el.hawkMinus.addEventListener("click", () => removeBird("hawk"));
  el.eagleMinus.addEventListener("click", () => removeBird("eagle"));
  el.undoBtn.addEventListener("click", undoLast);
  el.resetBtn.addEventListener("click", resetTrip);

  // ---------- Settings drawer ----------
  el.menuBtn.addEventListener("click", () => el.menuOverlay.classList.remove("hidden"));
  el.closeMenuBtn.addEventListener("click", () => el.menuOverlay.classList.add("hidden"));
  el.menuOverlay.addEventListener("click", (e) => {
    if (e.target === el.menuOverlay) el.menuOverlay.classList.add("hidden");
  });

  el.soundToggle.checked = localStorage.getItem(SOUND_KEY) !== "off";
  el.soundToggle.addEventListener("change", () => {
    localStorage.setItem(SOUND_KEY, el.soundToggle.checked ? "on" : "off");
  });

  el.sheetUrlInput.value = localStorage.getItem(SHEET_URL_KEY) || "";
  el.saveSheetUrlBtn.addEventListener("click", () => {
    const url = el.sheetUrlInput.value.trim();
    localStorage.setItem(SHEET_URL_KEY, url);
    el.sheetStatus.textContent = url ? "Saved." : "Cleared.";
  });

  el.sendToSheetBtn.addEventListener("click", async () => {
    const url = (localStorage.getItem(SHEET_URL_KEY) || "").trim();
    if (!url) {
      el.sheetStatus.textContent = "Add your Google Apps Script URL above first.";
      return;
    }
    el.sheetStatus.textContent = "Saving...";
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      hawks: state.hawks,
      eagles: state.eagles,
      total: state.hawks + state.eagles,
    };
    try {
      // no-cors because Apps Script Web Apps don't return CORS headers;
      // we can't read the response, but the request still goes through.
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      el.sheetStatus.textContent = `Sent ${payload.date}: ${payload.hawks} hawks, ${payload.eagles} eagles.`;
    } catch (err) {
      el.sheetStatus.textContent = "Couldn't reach the sheet. Check your connection or URL.";
    }
  });

  // Resume audio context on first touch (mobile browsers require a user gesture)
  document.body.addEventListener("touchstart", () => getCtx(), { once: true });
  document.body.addEventListener("click", () => getCtx(), { once: true });

  render();

  // ---------- PWA service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
