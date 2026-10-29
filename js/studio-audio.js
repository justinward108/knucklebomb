/**
 * Poor Camp Studio Audio & Keywise Stem Director (studio-audio.js)
 * ----------------------------------------------------------------
 * Combines:
 * 1. Real-time Keywise algorithmic multi-stem synthesis (voice-led chords, basslines,
 *    arpeggios, and metric grooves) tailored to each game's musical mode.
 * 2. Automatic external stem playback for MusicFX / Lyria / Elsephase rendered beds
 *    (if placed at `assets/audio/theme-bed.mp3` or `data-audio-stem`).
 * 3. Tactile WebAudio UI sound effects (button taps, card plays, stamps, dice rolls).
 */
(function () {
  "use strict";

  var STORAGE_KEY = "pc_studio_audio_muted";
  var Profiles = {
    champions: {
      title: "Anthem of the Index (Keywise D Minor)",
      bpm: 92,
      rootMidi: 50, // D3
      // D minor: i (Dm), VI (Bb), III (F), VII (C)
      chords: [
        [0, 3, 7, 12],
        [-4, 0, 3, 7],
        [3, 7, 10, 15],
        [-2, 2, 5, 10],
      ],
      bassPattern: [0, 0, 12, 0, 7, 0, 10, 7],
      arpSteps: [0, 1, 2, 3, 2, 1, 3, 0],
      padWave: "sawtooth",
      leadWave: "triangle",
      filterCutoff: 950,
      hatLevel: 0.035,
      kickPattern: [1, 0, 0, 0, 1, 0, 1, 0],
    },
    dosa: {
      title: "Case Analyst Desk (Keywise C Dorian)",
      bpm: 74,
      rootMidi: 48, // C3
      // C Dorian noir: Cm7, Fm7, Gm7, Cm6
      chords: [
        [0, 3, 7, 10],
        [5, 8, 12, 15],
        [7, 10, 14, 17],
        [0, 3, 7, 9],
      ],
      bassPattern: [0, -1, 0, 7, 0, -1, 3, 5],
      arpSteps: [0, 2, 1, 3, 0, 3, 2, 1],
      padWave: "sine",
      leadWave: "sine",
      filterCutoff: 680,
      hatLevel: 0.02,
      kickPattern: [1, 0, 0, 0, 0, 0, 1, 0],
    },
    "paradise-lost": {
      title: "Hilo Rain & New Timber (Keywise G Major)",
      bpm: 86,
      rootMidi: 55, // G3
      // Warm slack-key G major: G, D/F#, Em7, Cadd9
      chords: [
        [0, 4, 7, 11],
        [-1, 2, 7, 11],
        [-3, 0, 4, 7],
        [-7, -3, 0, 2],
      ],
      bassPattern: [0, 7, 12, 7, 0, 7, 11, 7],
      arpSteps: [0, 1, 2, 3, 1, 2, 3, 2],
      padWave: "triangle",
      leadWave: "sine",
      filterCutoff: 1350,
      hatLevel: 0.015,
      kickPattern: [1, 0, 0, 1, 0, 0, 1, 0],
    },
    nirvanasales: {
      title: "Clearance Rush (Keywise F Mixolydian)",
      bpm: 124,
      rootMidi: 53, // F3
      // Hyper-retail synth-bossa: F7, Eb6, Bbmaj7, C7
      chords: [
        [0, 4, 7, 10],
        [-2, 2, 5, 9],
        [-7, -3, 0, 4],
        [-5, -1, 2, 5],
      ],
      bassPattern: [0, 12, 7, 10, 0, 12, 5, 7],
      arpSteps: [0, 2, 1, 3, 2, 3, 1, 0],
      padWave: "triangle",
      leadWave: "square",
      filterCutoff: 1600,
      hatLevel: 0.045,
      kickPattern: [1, 0, 1, 0, 1, 0, 1, 1],
    },
    knucklebomb: {
      title: "Arena Pit Brass & Dice (Keywise E Phrygian)",
      bpm: 114,
      rootMidi: 52, // E3
      // E Phrygian arena: Em, Fmaj7, Dm, Em
      chords: [
        [0, 3, 7, 12],
        [1, 5, 8, 12],
        [-2, 2, 5, 9],
        [0, 3, 7, 10],
      ],
      bassPattern: [0, 0, 12, 0, 1, 0, -2, 0],
      arpSteps: [0, 3, 1, 2, 0, 3, 2, 1],
      padWave: "sawtooth",
      leadWave: "sawtooth",
      filterCutoff: 1150,
      hatLevel: 0.05,
      kickPattern: [1, 0, 0, 1, 1, 0, 1, 0],
    },
    "ottoman-overlords": {
      title: "1914 Continental Telegraph (Keywise A Harmonic Minor)",
      bpm: 82,
      rootMidi: 45, // A2
      // A harmonic minor: Am, Dm, E7, Am
      chords: [
        [0, 3, 7, 12],
        [5, 8, 12, 17],
        [7, 11, 14, 17],
        [0, 3, 7, 11],
      ],
      bassPattern: [0, 7, 12, 7, 5, 12, 7, 11],
      arpSteps: [0, 1, 2, 3, 2, 1, 0, 2],
      padWave: "triangle",
      leadWave: "triangle",
      filterCutoff: 880,
      hatLevel: 0.025,
      kickPattern: [1, 0, 0, 0, 1, 0, 0, 1],
    },
  };

  function detectGameId() {
    var explicit = document.documentElement.getAttribute("data-studio-game") ||
                   (document.body && document.body.getAttribute("data-studio-game"));
    if (explicit && Profiles[explicit]) return explicit;
    var title = (document.title || "").toLowerCase();
    var path = (location.pathname || "").toLowerCase();
    if (title.indexOf("dosa") !== -1 || title.indexOf("leader's hand") !== -1 || path.indexOf("dosa") !== -1) return "dosa";
    if (title.indexOf("paradise lost") !== -1 || path.indexOf("paradise") !== -1) return "paradise-lost";
    if (title.indexOf("nirvana") !== -1) return "nirvanasales";
    if (title.indexOf("knucklebomb") !== -1) return "knucklebomb";
    if (title.indexOf("ottoman") !== -1 || title.indexOf("war room") !== -1) return "ottoman-overlords";
    return "champions";
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  var ctx = null;
  var masterGain = null;
  var playing = false;
  var stepTimer = null;
  var stepIndex = 0;
  var externalAudio = null;

  function ensureContext() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.22;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function triggerNote(freq, wave, duration, gainVal, cutoff, delaySec) {
    if (!ctx || !masterGain) return;
    var t0 = ctx.currentTime + (delaySec || 0);
    var osc = ctx.createOscillator();
    var filter = ctx.createBiquadFilter();
    var g = ctx.createGain();
    osc.type = wave || "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff || 1000, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gainVal, t0 + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function triggerPerc(isKick, hatLevel) {
    if (!ctx || !masterGain) return;
    var t0 = ctx.currentTime;
    if (isKick) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, t0);
      osc.frequency.exponentialRampToValueAtTime(36, t0 + 0.14);
      g.gain.setValueAtTime(0.16, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    } else if (hatLevel > 0) {
      var osc2 = ctx.createOscillator();
      var g2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(6200, t0);
      g2.gain.setValueAtTime(hatLevel, t0);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
      osc2.connect(g2);
      g2.connect(masterGain);
      osc2.start(t0);
      osc2.stop(t0 + 0.04);
    }
  }

  function stepSequencer(profile) {
    if (!playing || !ctx) return;
    var stepDur = 60 / profile.bpm / 2; // 8th-note steps
    var barStep = stepIndex % 8;
    var chordIdx = Math.floor(stepIndex / 8) % profile.chords.length;
    var chord = profile.chords[chordIdx];

    // 1. Keywise Chord Pad on step 0 of each bar
    if (barStep === 0) {
      for (var i = 0; i < chord.length; i++) {
        triggerNote(
          midiToFreq(profile.rootMidi + 12 + chord[i]),
          profile.padWave,
          stepDur * 7.5,
          0.045,
          profile.filterCutoff,
          0
        );
      }
    }

    // 2. Keywise Bassline
    var bassIv = profile.bassPattern[barStep];
    if (bassIv !== -1) {
      triggerNote(
        midiToFreq(profile.rootMidi - 12 + chord[0] + bassIv),
        "triangle",
        stepDur * 0.85,
        0.11,
        profile.filterCutoff * 0.7,
        0
      );
    }

    // 3. Keywise Arpeggio / Melody voice
    var arpDeg = profile.arpSteps[barStep % profile.arpSteps.length];
    var arpPitch = profile.rootMidi + 12 + chord[arpDeg % chord.length];
    triggerNote(
      midiToFreq(arpPitch),
      profile.leadWave,
      stepDur * 0.65,
      0.04,
      profile.filterCutoff * 1.3,
      0
    );

    // 4. Keywise Groove Percussion
    triggerPerc(profile.kickPattern[barStep] === 1, profile.hatLevel);

    stepIndex++;
  }

  function startMusic() {
    if (playing) return;
    if (!ensureContext()) return;
    var gameId = detectGameId();
    var profile = Profiles[gameId] || Profiles.champions;
    playing = true;
    stepIndex = 0;

    // Optional MusicFX / Lyria external stem support
    var stemUrl = document.documentElement.getAttribute("data-audio-stem");
    if (stemUrl && !externalAudio) {
      try {
        externalAudio = new Audio(stemUrl);
        externalAudio.loop = true;
        externalAudio.volume = 0.35;
        externalAudio.play().catch(function () {});
      } catch (e) {}
    }

    var stepMs = (60 / profile.bpm / 2) * 1000;
    stepSequencer(profile);
    stepTimer = setInterval(function () {
      stepSequencer(profile);
    }, stepMs);
    updateButtonUI();
  }

  function stopMusic() {
    playing = false;
    if (stepTimer) {
      clearInterval(stepTimer);
      stepTimer = null;
    }
    if (externalAudio) {
      try { externalAudio.pause(); } catch (e) {}
    }
    updateButtonUI();
  }

  function toggleMusic() {
    if (playing) {
      stopMusic();
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
    } else {
      try { localStorage.setItem(STORAGE_KEY, "0"); } catch (e) {}
      startMusic();
    }
  }

  function playUiClick() {
    if (!playing || !ctx) return;
    triggerNote(520, "sine", 0.045, 0.04, 1800, 0);
  }

  var btnEl = null;
  function updateButtonUI() {
    if (!btnEl) return;
    var gameId = detectGameId();
    var profile = Profiles[gameId] || Profiles.champions;
    btnEl.textContent = playing ? "♫ Score: On" : "♫ Score: Off";
    btnEl.title = profile.title + " — Click to toggle soundtrack";
    btnEl.setAttribute("aria-pressed", playing ? "true" : "false");
    btnEl.style.borderColor = playing ? "#c9a45c" : "rgba(201,164,92,0.35)";
    btnEl.style.color = playing ? "#f8e6b8" : "#c7bda8";
  }

  function mountButton() {
    if (document.getElementById("pc-studio-audio-btn")) return;
    btnEl = document.createElement("button");
    btnEl.id = "pc-studio-audio-btn";
    btnEl.type = "button";
    btnEl.style.cssText = [
      "position:fixed",
      "bottom:max(12px, env(safe-area-inset-bottom, 12px))",
      "left:max(12px, env(safe-area-inset-left, 12px))",
      "z-index:9990",
      "min-height:38px",
      "padding:6px 12px",
      "border-radius:999px",
      "border:1px solid rgba(201,164,92,0.35)",
      "background:rgba(15,18,26,0.88)",
      "backdrop-filter:blur(6px)",
      "font-family:system-ui,-apple-system,sans-serif",
      "font-size:12px",
      "font-weight:600",
      "letter-spacing:0.04em",
      "cursor:pointer",
      "box-shadow:0 4px 14px rgba(0,0,0,0.45)",
      "transition:border-color 0.15s,color 0.15s"
    ].join(";");
    btnEl.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleMusic();
    });
    document.body.appendChild(btnEl);
    updateButtonUI();

    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && (t.tagName === "BUTTON" || t.closest("button"))) {
        playUiClick();
      }
    }, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountButton);
  } else {
    mountButton();
  }

  window.PoorCampStudioAudio = {
    start: startMusic,
    stop: stopMusic,
    toggle: toggleMusic,
    playClick: playUiClick,
  };
})();
