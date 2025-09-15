// script.js -- ASCII Car Radio with scrolling track name + EQ
(() => {
  const uiEl = document.getElementById("ascii-ui");

  // === State ===
  let isPlaying = false;
  let isPaused = false;
  let isMuted = false;
  let isLooping = false;
  let volume = 50;
  let lastVolume = volume;
  const trackName = "Ambient Instrumental 01 - Mixed Version";

  let playOffset = 0;
  let startAt = 0;

  // Marquee scroll settings
  let scrollIndex = 0;
  let lastScrollTime = 0;
  const SCROLL_SPEED_MS = 300; // move every 300ms
  const DISPLAY_WIDTH = 30;

  // EQ bands
  const EQ_BANDS = 20;
  let eqValues = new Array(EQ_BANDS).fill(0);

  // === Tone.js setup ===
  const player = new Tone.Player({
    url: "audio/ambient-instrumental-01.mp3", // ✅ corrected filename
    autostart: false,
    loop: false,
  });

  const lowShelf = new Tone.Filter(200, "lowshelf");
  const highShelf = new Tone.Filter(3000, "highshelf");
  const masterVol = new Tone.Volume(0);
  const analyser = new Tone.Analyser("waveform", 256); // ✅ fixed EQ source

  player.chain(lowShelf, highShelf, masterVol, analyser, Tone.Destination);

  player.onstop = () => {
    if (!isPaused) {
      isPlaying = false;
      playOffset = 0;
      render();
      if (isLooping) play();
    }
  };

  // === Helpers ===
  function gainToDb(g) {
    if (g <= 0) return -100;
    return 20 * Math.log10(g);
  }

  function getMoodSettings(hour = new Date().getHours()) {
    if (hour >= 5 && hour < 12)
      return {
        mood: "Sunrise Energy",
        pitch: "Bright",
        rate: 1.1,
        lowGain: 4,
        highGain: 4,
      };
    if (hour >= 12 && hour < 18)
      return {
        mood: "Afternoon Brightness",
        pitch: "Normal",
        rate: 1.0,
        lowGain: 0,
        highGain: 0,
      };
    if (hour >= 18 && hour < 23)
      return {
        mood: "Sunset Warmth",
        pitch: "Warm",
        rate: 0.95,
        lowGain: 5,
        highGain: -3,
      };
    return {
      mood: "Midnight Calm",
      pitch: "Low",
      rate: 0.9,
      lowGain: 6,
      highGain: -6,
    };
  }

  function applyMood() {
    const { rate, lowGain, highGain } = getMoodSettings();
    player.playbackRate = rate;
    lowShelf.gain.value = lowGain;
    highShelf.gain.value = highGain;
  }

  function updateMasterVolume(ramp = 0.02) {
    if (isMuted || volume === 0) {
      masterVol.volume.rampTo(-100, ramp);
    } else {
      masterVol.volume.rampTo(gainToDb(volume / 100), ramp);
    }
  }

  // === Controls ===
  function toggleMute() {
    if (!isMuted) {
      lastVolume = volume;
      isMuted = true;
    } else {
      isMuted = false;
      volume = Math.max(1, lastVolume || 50);
    }
    updateMasterVolume(0.05);
    render();
  }

  function changeVolume(delta) {
    if (isMuted) return;
    volume = Math.max(0, Math.min(100, volume + delta));
    updateMasterVolume();
    render();
  }

  async function ensureLoaded() {
    if (player.buffer) return;
    return new Promise((resolve) => (player.onload = resolve));
  }

  async function play() {
    await Tone.start();
    await ensureLoaded();
    applyMood();

    if (!isPlaying && !isPaused) {
      playOffset = 0;
      startAt = Tone.now();
      player.start(undefined, playOffset);
      isPlaying = true;
      isPaused = false;
    } else if (isPaused) {
      startAt = Tone.now();
      player.start(undefined, playOffset);
      isPaused = false;
    } else if (!isPlaying && playOffset === 0) {
      playOffset = 0;
      startAt = Tone.now();
      player.start(undefined, playOffset);
      isPlaying = true;
    }
    render();
  }

  function pause() {
    if (!isPlaying) return;
    if (!isPaused) {
      const elapsed = Tone.now() - startAt;
      playOffset += elapsed;
      try {
        player.stop();
      } catch {}
      isPaused = true;
    } else {
      startAt = Tone.now();
      player.start(undefined, playOffset);
      isPaused = false;
    }
    render();
  }

  function stop() {
    if (isPlaying || isPaused) {
      try {
        player.stop();
      } catch {}
      isPlaying = false;
      isPaused = false;
      playOffset = 0;
    }
    render();
  }

  function toggleLoop() {
    isLooping = !isLooping;
    render();
  }

  // === EQ ===
  function updateEQ() {
    const vals = analyser.getValue();
    if (!vals || vals.length === 0) {
      eqValues.fill(0);
      return;
    }

    const step = Math.floor(vals.length / EQ_BANDS);
    for (let b = 0; b < EQ_BANDS; b++) {
      let sum = 0;
      for (let i = b * step; i < (b + 1) * step; i++) {
        sum += Math.abs(vals[i]);
      }
      const avg = sum / step;
      const norm = Math.min(1, avg * 5);
      const level = Math.round(norm * 3);
      eqValues[b] = Math.max(level, Math.floor(eqValues[b] * 0.7));
    }
  }

  function asciiFromLevel(v) {
    if (v <= 0) return ".";
    if (v === 1) return ":";
    if (v === 2) return "|";
    return "#";
  }

  function getAsciiEQ() {
    return eqValues.map(asciiFromLevel).join(" ");
  }

  // === Rendering ===
  function render() {
    const now = new Date();
    const { mood } = getMoodSettings();
    const timeStr = now.toLocaleTimeString("en-GB");
    const status =
      isPlaying && !isPaused
        ? "▶ PLAYING"
        : isPaused
        ? "Ⅱ PAUSED"
        : "■ STOPPED";
    const volBar =
      "|".repeat(Math.round(volume / 10)) +
      "-".repeat(10 - Math.round(volume / 10));
    const eq = getAsciiEQ();

    const WIDTH = 48;
    const line = (txt) => `║ ${txt.padEnd(WIDTH, " ")} ║\n`;

    // === Marquee track name ===
    let trackDisplay = trackName;
    if (trackName.length > DISPLAY_WIDTH) {
      const padded = trackName + "   " + trackName;
      const nowTime = Date.now();
      if (nowTime - lastScrollTime > SCROLL_SPEED_MS) {
        scrollIndex = (scrollIndex + 1) % trackName.length;
        lastScrollTime = nowTime;
      }
      trackDisplay = padded.substring(scrollIndex, scrollIndex + DISPLAY_WIDTH);
    }

    let ui = "";
    ui += "╔" + "═".repeat(WIDTH + 2) + "╗\n";
    ui += line("📻  ASCII CAR RADIO v6           SIGNAL: ~~~");
    ui += "╠" + "═".repeat(WIDTH + 2) + "╣\n";
    ui += line(`░ TRACK: ${trackDisplay}`);
    ui += line(`░ STATUS: ${status}`);
    ui += line(`░ TIME: ${timeStr}`);
    ui += line(`░ MOOD: ${mood}`);
    ui += "╠" + "═".repeat(WIDTH + 2) + "╣\n";
    ui += line(
      `[VOL◉] [TUNE◯]   VOL [${volBar}] ${String(volume).padStart(3)}% ${
        isMuted ? "MUTE" : ""
      }`
    );
    ui += line("[ PLAY ] [ STOP ] [ PAUSE ] [ MUTE ] [ LOOP ]");
    ui += "╠" + "═".repeat(WIDTH + 2) + "╣\n";
    ui += line(`EQ: ${eq}`);
    ui += "╠" + "═".repeat(WIDTH + 2) + "╣\n";
    ui += line(`STATION DIAL: ${dial}`);
    ui += "╚" + "═".repeat(WIDTH + 2) + "╝\n";

    uiEl.textContent = ui;
  }

  // === Controls ===
  window.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      if (!isPlaying) play();
      else pause();
    }
    if (e.key.toLowerCase() === "s") stop();
    if (e.key === "+" || e.key === "=") changeVolume(10);
    if (e.key === "-") changeVolume(-10);
    if (e.key.toLowerCase() === "m") toggleMute();
    if (e.key.toLowerCase() === "l") toggleLoop();
  });

  uiEl.addEventListener("click", (e) => {
    const lines = (uiEl.textContent || "").split("\n");
    const ctrlLine = lines.find((l) => l.includes("[ PLAY ]"));
    if (!ctrlLine) return;

    const rect = uiEl.getBoundingClientRect();
    const charWidth = rect.width / ctrlLine.length;
    const y = Math.floor((e.clientY - rect.top) / (rect.height / lines.length));
    const x = Math.floor((e.clientX - rect.left) / charWidth);

    const check = (label, fn) => {
      const idx = ctrlLine.indexOf(label);
      if (idx >= 0 && x >= idx && x < idx + label.length) fn();
    };

    if (lines[y] === ctrlLine) {
      check("[ PLAY ]", play);
      check("[ STOP ]", stop);
      check("[ PAUSE ]", pause);
      check("[ MUTE ]", toggleMute);
      check("[ LOOP ]", toggleLoop);
    }
  });

  // === Loop ===
  function loop() {
    updateEQ();
    render();
    applyMood();
    requestAnimationFrame(loop);
  }

  // === Init ===
  updateMasterVolume(0);
  render();
  loop();
})();
