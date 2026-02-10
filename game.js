// ============================================================
// LAAAME - Slipping Jimmy's Endless Run
// Full game: audio, day/night, dash, mic mode, voice easter egg
// ============================================================

(function () {
    "use strict";

    // ---- DOM refs ----
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");

    const screens = {
        loading: document.getElementById("loading-screen"),
        disclaimer: document.getElementById("disclaimer-screen"),
        menu: document.getElementById("menu-screen"),
        game: document.getElementById("game-screen"),
        pause: document.getElementById("pause-screen"),
        gameover: document.getElementById("gameover-screen"),
        win: document.getElementById("win-screen"),
    };

    const hud = {
        score: document.getElementById("hud-score"),
        target: document.getElementById("hud-target"),
        difficulty: document.getElementById("hud-difficulty"),
        dash: document.getElementById("hud-dash"),
    };

    const loadingBar = document.getElementById("loading-bar-inner");
    const loadingText = document.getElementById("loading-text");

    const speechBubble = document.getElementById("jimmy-speech");
    const speechText = document.getElementById("jimmy-speech-text");

    const voiceMeterEl = document.getElementById("voice-meter");
    const voiceMeterFill = document.getElementById("voice-meter-fill");

    // ---- Constants ----
    const LANE_COUNT = 3;
    const DIFFICULTIES = {
        easy:    { target: 333,    speedBase: 4,  speedGrowth: 0.0004, spawnRate: 1.6, label: "EASY" },
        medium:  { target: 3333,   speedBase: 6,  speedGrowth: 0.0007, spawnRate: 1.2, label: "MEDIUM" },
        hard:    { target: 33333,  speedBase: 8,  speedGrowth: 0.001,  spawnRate: 0.8, label: "HARD" },
        extreme: { target: 99999,  speedBase: 10, speedGrowth: 0.0015, spawnRate: 0.5, label: "EXTREME" },
    };

    const OBSTACLE_TYPES = [
        { name: "caseFiles", color: "#c9a227", width: 60, height: 50, speed: 1 },
        { name: "hammer",    color: "#888",    width: 45, height: 55, speed: 1.6 },
        { name: "gun",       color: "#e94560", width: 55, height: 35, speed: 1.3, shoots: true },
    ];

    // ---- Catchphrases ----
    // Context-aware phrase pools
    const PHRASES_NORMAL = [
        "Let's get down to brass tacks!",
        "I'm a lawyer, not a runner!",
        "The wheels of justice!",
        "Did you know you have rights?",
        "Better call... ME!",
        "Lightning won't strike twice!",
        "I'm like a cockroach!",
        "That's showmanship, baby!",
        "The law is sacred!",
        "I just talk my way out!",
        "Winners don't quit!",
        "Justice never sleeps!",
        "My middle name is Hustle!",
        "The truth is on my side!",
    ];

    const PHRASES_CONFIDENT = [
        "I'm on FIRE!",
        "Can't touch this!",
        "Too fast, too furious!",
        "Unstoppable!",
        "I was born for this!",
        "This? This is nothing!",
        "You want it? I got it!",
        "Can't stop, won't stop!",
        "Objection! ...to losing!",
    ];

    const PHRASES_FRUSTRATED = [
        "Not again!",
        "I need a better lawyer!",
        "This is rigged!",
        "Okay okay, focus Jimmy...",
        "Third time's the charm... right?",
        "The system is broken!",
        "I've had tougher juries!",
        "Pain is temporary!",
    ];

    const MILESTONE_PHRASES = {
        200:   "Now we're cooking!",
        500:   "Halfway to glory!",
        1000:  "A thousand! Who's counting?",
        2000:  "Two grand! Cha-ching!",
        3000:  "Almost there, baby!",
        5000:  "Five K! I'm unstoppable!",
        10000: "Ten thousand! Legend!",
        20000: "Twenty K! They can't catch me!",
        30000: "Thirty thousand! S'all GOOD!",
        50000: "FIFTY K! I'm IMMORTAL!",
        75000: "Seventy-five K! This is insanity!",
        90000: "Ninety K! The finish line!",
    };

    // ---- Audio System ----
    const audio = {
        menuSong: null,
        gameSongs: [],
        currentGameSong: null,
        sfx: { caseFile: null, hammer: null, gun: null },
        muted: false,
        loaded: false,
    };

    const AUDIO_FILES = [
        { key: "menuSong",    path: "Assets/Music/Menu Song.mp3",            type: "music" },
        { key: "gameSong1",   path: "Assets/Music/In-Game Music 1.mp3",      type: "gameMusic" },
        { key: "gameSong2",   path: "Assets/Music/In-Game Music 2.mp3",      type: "gameMusic" },
        { key: "sfxCaseFile", path: "Assets/Sound Effects/Case File Sound.mp3", type: "sfx" },
        { key: "sfxHammer",   path: "Assets/Sound Effects/Hammer Sound.mp3",    type: "sfx" },
        { key: "sfxGun",      path: "Assets/Sound Effects/Gun Sound.mp3",       type: "sfx" },
    ];

    // ---- Game State ----
    let state = "loading";
    let difficulty = "easy";
    let isDayTheme = false;
    let micModeEnabled = false;
    let unlockedLevels = JSON.parse(localStorage.getItem("laaame_unlocked") || '["easy"]');
    let highScores = JSON.parse(localStorage.getItem("laaame_highscores") || '{}');

    let score = 0;
    let gameSpeed = 0;
    let elapsed = 0;
    let spawnTimer = 0;

    // Dash system
    let dashReady = true;
    let dashCooldown = 0;
    const DASH_COOLDOWN_TIME = 5;
    const DASH_DURATION = 0.5;
    let dashTimer = 0;       // > 0 means currently dashing
    let isDashing = false;

    let player = {};
    let obstacles = [];
    let bullets = [];
    let particles = [];
    let bgOffset = 0;
    let scorePopups = [];

    // Speech system — slower, context-aware
    let currentSpeechTimer = 0;
    let speechCooldown = 0;      // minimum time between ANY speech
    const MIN_SPEECH_COOLDOWN = 6; // 6 seconds between any speech
    let deathCount = 0;           // persists across retries in session
    let milestoneKeys = Object.keys(MILESTONE_PHRASES).map(Number).sort((a, b) => a - b);

    // Screen shake system
    let shakeTimer = 0;
    let shakeIntensity = 0;
    const SHAKE_DURATION = 0.4;   // seconds
    const SHAKE_MAX = 12;         // max pixel offset

    // Phone collectible system
    let phonePickups = [];
    let phoneAnimTimer = 0;       // > 0 means Jimmy is holding phone up
    const PHONE_ANIM_DURATION = 1.5;
    const PHONE_BONUS = 500;
    const PHONE_SPAWN_CHANCE = 0.04; // 4% chance per obstacle spawn cycle

    // Lane geometry
    let laneHeight = 0;
    let laneYPositions = [];
    let groundY = 0;

    // Mic system
    let micAudioContext = null;
    let micAnalyser = null;
    let micStream = null;
    let micDataArray = null;
    let micAmplitude = 0;           // raw amplitude
    let micSmoothed = 0;            // smoothed amplitude (what we actually use)
    let micTargetLane = 1;          // where the mic wants the player
    let micLaneSettleTimer = 0;     // prevent rapid lane jitter
    const MIC_SMOOTH_UP = 0.35;    // fast rise when voice detected
    const MIC_SMOOTH_DOWN = 0.06;  // VERY slow fall — keeps value high between syllables
    const MIC_NOISE_FLOOR = 0.02;  // below this = silence (ignore ambient noise)
    // Thresholds WITH hysteresis + hold timers
    const MIC_LOUD_ENTER = 0.18;   // speak at normal volume to go up
    const MIC_LOUD_EXIT = 0.08;    // must drop very low to leave "up" zone
    const MIC_QUIET_ENTER = 0.03;  // true silence to go down
    const MIC_QUIET_EXIT = 0.07;   // any speaking at all leaves "down" zone
    let micCurrentZone = "center";  // "up", "center", "down" — with hysteresis
    let micZoneHoldTimer = 0;       // once in a zone, hold for minimum time
    const MIC_ZONE_HOLD_TIME = 0.5; // hold zone for at least 0.5s before allowing exit

    // Easter egg — typed catchphrase detection (works in both modes, no popups)
    let easterEggBuffer = "";
    const EASTER_EGG_PHRASES = ["saulgoodman", "sallgoodman", "itsgoodman", "allgoodman"];
    const EASTER_EGG_MAX_LEN = 15; // max buffer length before trimming

    // Sprite support
    const sprites = {};
    const SPRITE_FILES = [
        { key: "jimmy",    path: "Assets/Sprites/jimmy.png" },
        { key: "caseFiles", path: "Assets/Sprites/casefiles.png" },
        { key: "hammer",   path: "Assets/Sprites/hammer.png" },
        { key: "gun",      path: "Assets/Sprites/gun.png" },
    ];

    // ============================================================
    // LOADING SYSTEM
    // ============================================================

    async function loadAllAssets() {
        const totalAssets = AUDIO_FILES.length + SPRITE_FILES.length;
        let loadedCount = 0;

        function updateProgress(label) {
            loadedCount++;
            const pct = Math.round((loadedCount / totalAssets) * 100);
            loadingBar.style.width = pct + "%";
            loadingText.textContent = label;
        }

        for (const af of AUDIO_FILES) {
            try {
                const audioEl = new Audio();
                audioEl.preload = "auto";
                await new Promise((resolve) => {
                    audioEl.addEventListener("canplaythrough", resolve, { once: true });
                    audioEl.addEventListener("error", resolve, { once: true });
                    audioEl.src = af.path;
                    setTimeout(resolve, 5000);
                });

                if (af.type === "music") {
                    audio.menuSong = audioEl;
                    audioEl.loop = true;
                    audioEl.volume = 0.4;
                } else if (af.type === "gameMusic") {
                    audioEl.loop = false;
                    audioEl.volume = 0.35;
                    audio.gameSongs.push(audioEl);
                } else if (af.type === "sfx") {
                    audioEl.volume = 0.5;
                    if (af.key === "sfxCaseFile") audio.sfx.caseFile = audioEl;
                    if (af.key === "sfxHammer")   audio.sfx.hammer = audioEl;
                    if (af.key === "sfxGun")      audio.sfx.gun = audioEl;
                }
                updateProgress("Loaded: " + af.path.split("/").pop());
            } catch (e) {
                updateProgress("Skipped: " + af.path.split("/").pop());
            }
        }

        for (const sf of SPRITE_FILES) {
            try {
                const img = new Image();
                await new Promise((resolve) => {
                    img.onload = () => { sprites[sf.key] = img; resolve(); };
                    img.onerror = resolve;
                    img.src = sf.path;
                    setTimeout(resolve, 2000);
                });
                updateProgress("Sprite: " + sf.path.split("/").pop());
            } catch (e) {
                updateProgress("No sprite: " + sf.key);
            }
        }

        loadingBar.style.width = "100%";
        loadingText.textContent = "Ready!";
        audio.loaded = true;

        await new Promise((r) => setTimeout(r, 600));
        showScreen("disclaimer");
        state = "disclaimer";
    }

    // ============================================================
    // AUDIO HELPERS — mute/unmute now pauses/resumes, doesn't restart
    // ============================================================

    function playMenuMusic() {
        stopAllGameMusic();
        if (audio.menuSong && !audio.muted) {
            audio.menuSong.currentTime = 0;
            audio.menuSong.play().catch(() => {});
        }
    }

    function playGameMusic() {
        // Stop menu music fully
        if (audio.menuSong) {
            audio.menuSong.pause();
            audio.menuSong.currentTime = 0;
        }
        if (audio.gameSongs.length === 0 || audio.muted) return;
        const idx = Math.floor(Math.random() * audio.gameSongs.length);
        audio.currentGameSong = audio.gameSongs[idx];
        audio.currentGameSong.currentTime = 0;
        audio.currentGameSong.play().catch(() => {});
        audio.currentGameSong.onended = () => {
            if (state === "playing") playGameMusic();
        };
    }

    function stopAllGameMusic() {
        audio.gameSongs.forEach((s) => {
            s.pause();
            s.currentTime = 0;
            s.onended = null;
        });
        audio.currentGameSong = null;
    }

    function stopAllMusic() {
        if (audio.menuSong) {
            audio.menuSong.pause();
            audio.menuSong.currentTime = 0;
        }
        stopAllGameMusic();
    }

    function toggleMute() {
        audio.muted = !audio.muted;
        updateMuteIcons();

        if (audio.muted) {
            // Just pause — don't reset currentTime
            if (audio.menuSong) audio.menuSong.pause();
            if (audio.currentGameSong) audio.currentGameSong.pause();
        } else {
            // Resume from where it was paused
            if (state === "menu" && audio.menuSong) {
                audio.menuSong.play().catch(() => {});
            } else if ((state === "playing") && audio.currentGameSong) {
                audio.currentGameSong.play().catch(() => {});
            }
        }
    }

    function updateMuteIcons() {
        const icon = audio.muted ? "🔇" : "🔊";
        document.getElementById("mute-icon").textContent = icon;
        document.getElementById("mute-icon-game").textContent = icon;
    }

    function playSFX(type) {
        if (audio.muted) return;
        let sfx = null;
        if (type === 0 && audio.sfx.caseFile) sfx = audio.sfx.caseFile;
        if (type === 1 && audio.sfx.hammer)   sfx = audio.sfx.hammer;
        if (type === 2 && audio.sfx.gun)      sfx = audio.sfx.gun;
        if (sfx) {
            const clone = sfx.cloneNode();
            clone.volume = sfx.volume;
            clone.play().catch(() => {});
        }
    }

    // ============================================================
    // DAY / NIGHT THEME
    // ============================================================

    function setTheme(isDay) {
        isDayTheme = isDay;
        if (isDay) {
            document.body.classList.add("day-theme");
            document.getElementById("theme-icon").textContent = "☀️";
            document.getElementById("theme-text").textContent = "Day";
        } else {
            document.body.classList.remove("day-theme");
            document.getElementById("theme-icon").textContent = "🌙";
            document.getElementById("theme-text").textContent = "Night";
        }
    }

    // ============================================================
    // MIC SYSTEM — Web Audio API amplitude detection
    // ============================================================

    async function initMicSystem() {
        if (micAnalyser) return; // already initialized, don't re-request permission
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            micAnalyser = micAudioContext.createAnalyser();
            micAnalyser.fftSize = 256;
            const source = micAudioContext.createMediaStreamSource(micStream);
            source.connect(micAnalyser);
            micDataArray = new Uint8Array(micAnalyser.fftSize);
        } catch (e) {
            console.warn("Mic access denied or unavailable:", e);
            micModeEnabled = false;
            // Revert to keyboard mode in the UI
            const kbBtn = document.getElementById("btn-mode-keyboard");
            const vcBtn = document.getElementById("btn-mode-voice");
            if (kbBtn) kbBtn.classList.add("mode-active");
            if (vcBtn) vcBtn.classList.remove("mode-active");
            document.getElementById("mic-privacy-notice").classList.add("hidden");
            const hint = document.getElementById("controls-hint");
            if (hint) hint.textContent = "⌨️ ↑ / ↓ to move • SPACE to dash • ESC to pause";
        }
    }

    function cleanupMicSystem() {
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
            micStream = null;
        }
        if (micAudioContext) {
            micAudioContext.close().catch(() => {});
            micAudioContext = null;
        }
        micAnalyser = null;
        micDataArray = null;
        micAmplitude = 0;
        micSmoothed = 0;
        micCurrentZone = "center";
        micTargetLane = 1;
        micZoneHoldTimer = 0;
    }

    function updateMicAmplitude() {
        if (!micAnalyser || !micDataArray) { micAmplitude = 0; micSmoothed = 0; return; }
        micAnalyser.getByteTimeDomainData(micDataArray);
        // Calculate RMS amplitude normalized 0-1
        let sum = 0;
        for (let i = 0; i < micDataArray.length; i++) {
            const val = (micDataArray[i] - 128) / 128;
            sum += val * val;
        }
        const rms = Math.sqrt(sum / micDataArray.length);
        micAmplitude = Math.min(1, rms * 6); // scale up for sensitivity

        // Apply noise floor — anything below ambient noise = treat as 0
        const cleaned = micAmplitude < MIC_NOISE_FLOOR ? 0 : micAmplitude;

        // Asymmetric exponential moving average:
        // - Fast rise: respond quickly when voice starts
        // - VERY slow fall: keep value high during natural speech pauses
        //   between syllables/words so the zone doesn't flicker
        if (cleaned > micSmoothed) {
            micSmoothed += (cleaned - micSmoothed) * MIC_SMOOTH_UP;
        } else {
            micSmoothed += (cleaned - micSmoothed) * MIC_SMOOTH_DOWN;
        }
    }

    function updateVoiceMeter() {
        if (!micModeEnabled || state !== "playing") {
            voiceMeterEl.classList.add("hidden");
            return;
        }
        voiceMeterEl.classList.remove("hidden");
        voiceMeterFill.style.height = Math.round(micSmoothed * 100) + "%";

        // Color-code the meter based on current zone
        if (micCurrentZone === "up") {
            voiceMeterFill.style.background = "linear-gradient(to top, #4ecca3, #00e676)";
        } else if (micCurrentZone === "down") {
            voiceMeterFill.style.background = "linear-gradient(to top, #e94560, #ff6b6b)";
        } else {
            voiceMeterFill.style.background = "linear-gradient(to top, #ffd700, #ffab00)";
        }
    }

    // ============================================================
    // EASTER EGG — Typed catchphrase detection (keyboard input)
    // Works in BOTH keyboard and voice modes. No popups, no mic API.
    // Type "saulgoodman" (or close variations) during gameplay to win.
    // ============================================================

    function checkEasterEgg(key) {
        if (state !== "playing") return;
        // Only track letter keys
        if (key.length === 1 && /[a-zA-Z]/.test(key)) {
            easterEggBuffer += key.toLowerCase();
            // Keep buffer from growing too large
            if (easterEggBuffer.length > EASTER_EGG_MAX_LEN) {
                easterEggBuffer = easterEggBuffer.slice(-EASTER_EGG_MAX_LEN);
            }
            // Check if any phrase matches the end of the buffer
            for (const phrase of EASTER_EGG_PHRASES) {
                if (easterEggBuffer.endsWith(phrase)) {
                    easterEggBuffer = "";
                    forceShowSpeech("S'all good, man!");
                    setTimeout(() => {
                        if (state === "playing") winLevel();
                    }, 500);
                    return;
                }
            }
        }
    }

    // ============================================================
    // SPEECH BUBBLE SYSTEM — context-aware, slower
    // ============================================================

    let speechHideTimeout = null;

    let speechVisible = false;

    function showSpeech(text) {
        // Check minimum cooldown between any speech
        if (speechCooldown > 0) return;

        speechText.textContent = '"' + text + '"';
        speechBubble.classList.remove("hidden");
        speechVisible = true;
        updateSpeechBubblePosition(); // set initial position

        speechCooldown = MIN_SPEECH_COOLDOWN;

        if (speechHideTimeout) clearTimeout(speechHideTimeout);
        speechHideTimeout = setTimeout(() => {
            speechBubble.classList.add("hidden");
            speechVisible = false;
        }, 2000); // 2 seconds max
    }

    // Force show (bypasses cooldown — for catchphrase easter egg)
    function forceShowSpeech(text) {
        speechCooldown = 0;
        showSpeech(text);
    }

    function hideSpeech() {
        speechBubble.classList.add("hidden");
        speechVisible = false;
        if (speechHideTimeout) clearTimeout(speechHideTimeout);
    }

    // Keep the speech bubble tracking the player's position
    function updateSpeechBubblePosition() {
        if (!speechVisible) return;
        speechBubble.style.top = (player.y - 20) + "px";
    }

    function pickContextPhrase() {
        // Frustrated: died 3+ times this session
        if (deathCount >= 3 && Math.random() < 0.4) {
            return PHRASES_FRUSTRATED[Math.floor(Math.random() * PHRASES_FRUSTRATED.length)];
        }
        // Confident: high speed (doing well)
        if (gameSpeed > 6 && Math.random() < 0.35) {
            return PHRASES_CONFIDENT[Math.floor(Math.random() * PHRASES_CONFIDENT.length)];
        }
        // Normal
        return PHRASES_NORMAL[Math.floor(Math.random() * PHRASES_NORMAL.length)];
    }

    // ---- Resize ----
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        computeLanes();
    }

    function computeLanes() {
        const playAreaTop = 60;
        const playAreaBottom = canvas.height - 30;
        const playAreaHeight = playAreaBottom - playAreaTop;
        laneHeight = playAreaHeight / LANE_COUNT;
        laneYPositions = [];
        for (let i = 0; i < LANE_COUNT; i++) {
            laneYPositions.push(playAreaTop + laneHeight * i + laneHeight / 2);
        }
        groundY = playAreaBottom;
    }

    window.addEventListener("resize", resize);
    resize();

    // ---- Input ----
    const keys = {};
    window.addEventListener("keydown", (e) => {
        keys[e.code] = true;

        if (state === "playing") {
            if (e.code === "ArrowUp" || e.code === "KeyW") { movePlayer(-1); e.preventDefault(); }
            if (e.code === "ArrowDown" || e.code === "KeyS") { movePlayer(1); e.preventDefault(); }
            if (e.code === "Space") { activateDash(); e.preventDefault(); }
            if (e.code === "Escape") { pauseGame(); e.preventDefault(); }
            if (e.code === "KeyM") { toggleMute(); e.preventDefault(); }
            // Easter egg: track typed letters
            checkEasterEgg(e.key);
        } else if (state === "paused") {
            if (e.code === "Escape") { resumeGame(); e.preventDefault(); }
        }
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });

    // ---- Screen management ----
    function showScreen(name) {
        Object.values(screens).forEach((s) => s.classList.remove("active"));
        screens[name].classList.add("active");
    }

    function showOverlay(name) {
        screens[name].classList.add("active");
    }

    function hideOverlay(name) {
        screens[name].classList.remove("active");
    }

    // ---- Menu ----
    function refreshMenu() {
        ["easy", "medium", "hard", "extreme"].forEach((diff) => {
            const btn = document.getElementById("btn-" + diff);
            if (!btn) return;
            if (unlockedLevels.includes(diff)) {
                btn.classList.remove("locked");
                const lock = btn.querySelector(".lock-icon");
                if (lock) lock.style.display = "none";
            }
        });
    }

    // ---- Button Events ----
    document.getElementById("btn-accept-disclaimer").addEventListener("click", () => {
        state = "menu";
        showScreen("menu");
        refreshMenu();
        playMenuMusic();
    });

    document.getElementById("btn-easy").addEventListener("click", () => startGame("easy"));
    document.getElementById("btn-medium").addEventListener("click", () => {
        if (unlockedLevels.includes("medium")) startGame("medium");
    });
    document.getElementById("btn-hard").addEventListener("click", () => {
        if (unlockedLevels.includes("hard")) startGame("hard");
    });
    document.getElementById("btn-extreme").addEventListener("click", () => {
        if (unlockedLevels.includes("extreme")) startGame("extreme");
    });
    document.getElementById("btn-resume").addEventListener("click", resumeGame);
    document.getElementById("btn-quit").addEventListener("click", quitToMenu);
    document.getElementById("btn-retry").addEventListener("click", () => startGame(difficulty));
    document.getElementById("btn-menu").addEventListener("click", quitToMenu);
    document.getElementById("btn-next").addEventListener("click", quitToMenu);

    // Mute buttons
    document.getElementById("btn-mute").addEventListener("click", toggleMute);
    document.getElementById("btn-mute-game").addEventListener("click", toggleMute);

    // Day/Night toggle
    document.getElementById("toggle-daynight").addEventListener("change", (e) => {
        setTheme(e.target.checked);
    });

    // Control mode buttons (Keyboard vs Voice)
    const btnModeKeyboard = document.getElementById("btn-mode-keyboard");
    const btnModeVoice = document.getElementById("btn-mode-voice");
    const controlsHint = document.getElementById("controls-hint");

    btnModeKeyboard.addEventListener("click", () => {
        micModeEnabled = false;
        btnModeKeyboard.classList.add("mode-active");
        btnModeVoice.classList.remove("mode-active");
        document.getElementById("mic-privacy-notice").classList.add("hidden");
        controlsHint.textContent = "⌨️ ↑ / ↓ to move • SPACE to dash • ESC to pause";
        cleanupMicSystem();
    });

    btnModeVoice.addEventListener("click", () => {
        micModeEnabled = true;
        btnModeVoice.classList.add("mode-active");
        btnModeKeyboard.classList.remove("mode-active");
        document.getElementById("mic-privacy-notice").classList.remove("hidden");
        controlsHint.textContent = "🎤 Loud = Up • Quiet = Down • Normal = Center • SPACE to dash";
        // Pre-init mic so permission is asked now (in the menu, not in-game)
        initMicSystem();
    });

    refreshMenu();

    // ---- Game init ----
    function startGame(diff) {
        difficulty = diff;
        const cfg = DIFFICULTIES[diff];

        score = 0;
        elapsed = 0;
        gameSpeed = cfg.speedBase;
        spawnTimer = 0;
        dashReady = true;
        dashCooldown = 0;
        dashTimer = 0;
        isDashing = false;
        obstacles = [];
        bullets = [];
        particles = [];
        phonePickups = [];
        phoneAnimTimer = 0;
        shakeTimer = 0;
        bgOffset = 0;
        scorePopups = [];
        speechCooldown = 0;
        currentSpeechTimer = 8; // first random phrase after 8 seconds

        player = {
            lane: 1,
            x: 120,
            y: laneYPositions[1],
            targetY: laneYPositions[1],
            width: 70,
            height: 90,
            animFrame: 0,
            coatFlap: 0,
        };

        hud.target.textContent = "Target: " + cfg.target.toLocaleString();
        hud.difficulty.textContent = cfg.label;
        updateHUD();

        state = "playing";
        showScreen("game");
        hideOverlay("pause");
        hideOverlay("gameover");
        hideOverlay("win");
        hideSpeech();

        stopAllMusic();
        playGameMusic();

        // Start mic if enabled (already init'd from menu toggle, won't re-request)
        if (micModeEnabled && !micAnalyser) {
            initMicSystem();
        }

        // Reset mic state for clean start
        micSmoothed = 0;
        micCurrentZone = "center";
        micLaneSettleTimer = 0;
        micZoneHoldTimer = 0;

        // Reset easter egg buffer
        easterEggBuffer = "";
    }

    function pauseGame() {
        state = "paused";
        showOverlay("pause");
        if (audio.currentGameSong) audio.currentGameSong.pause();
    }

    function resumeGame() {
        state = "playing";
        hideOverlay("pause");
        if (audio.currentGameSong && !audio.muted) {
            audio.currentGameSong.play().catch(() => {});
        }
    }

    function quitToMenu() {
        state = "menu";
        showScreen("menu");
        refreshMenu();
        hideSpeech();
        voiceMeterEl.classList.add("hidden");
        stopAllMusic();
        playMenuMusic();
    }

    // ---- Player movement ----
    function movePlayer(dir) {
        const newLane = player.lane + dir;
        if (newLane < 0 || newLane >= LANE_COUNT) return;
        player.lane = newLane;
        player.targetY = laneYPositions[newLane];
    }

    // ---- Dash system ----
    function activateDash() {
        if (!dashReady || isDashing) return;
        dashReady = false;
        dashCooldown = DASH_COOLDOWN_TIME;
        dashTimer = DASH_DURATION;
        isDashing = true;

        // Dash particles burst
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: player.x - 10,
                y: player.y + (Math.random() - 0.5) * 30,
                vx: -3 - Math.random() * 4,
                vy: (Math.random() - 0.5) * 2,
                life: 0.3 + Math.random() * 0.2,
                maxLife: 0.5,
                size: 2 + Math.random() * 3,
                color: "rgba(0,180,216,0.7)",
            });
        }
    }

    function winLevel() {
        state = "win";
        const cfg = DIFFICULTIES[difficulty];
        score = Math.max(score, cfg.target);

        stopAllMusic();

        const levels = ["easy", "medium", "hard", "extreme"];
        const idx = levels.indexOf(difficulty);
        if (idx < levels.length - 1) {
            const next = levels[idx + 1];
            if (!unlockedLevels.includes(next)) {
                unlockedLevels.push(next);
                localStorage.setItem("laaame_unlocked", JSON.stringify(unlockedLevels));
                document.getElementById("win-unlock").textContent = "Unlocked: " + next.toUpperCase() + " mode!";
            } else {
                document.getElementById("win-unlock").textContent = "";
            }
        } else {
            document.getElementById("win-unlock").textContent = "You conquered EXTREME! You're a legend!";
        }

        saveHighScore();
        document.getElementById("win-score").textContent = "Score: " + Math.floor(score).toLocaleString();

        for (let i = 0; i < 60; i++) {
            particles.push(createConfetti(canvas.width / 2, canvas.height / 2));
        }

        showOverlay("win");
    }

    function gameOver() {
        state = "gameover";
        deathCount++;

        // Trigger screen shake
        shakeTimer = SHAKE_DURATION;
        shakeIntensity = SHAKE_MAX;

        stopAllMusic();
        saveHighScore();
        document.getElementById("gameover-score").textContent = "Score: " + Math.floor(score).toLocaleString();
        document.getElementById("gameover-highscore").textContent = "Best: " + (highScores[difficulty] || 0).toLocaleString();
        hideSpeech();
        showOverlay("gameover");
    }

    function saveHighScore() {
        const prev = highScores[difficulty] || 0;
        if (Math.floor(score) > prev) {
            highScores[difficulty] = Math.floor(score);
            localStorage.setItem("laaame_highscores", JSON.stringify(highScores));
        }
    }

    // ---- Obstacle spawning ----
    function spawnObstacle() {
        let typeIdx;
        const r = Math.random();
        if (difficulty === "easy") {
            typeIdx = r < 0.6 ? 0 : r < 0.85 ? 1 : 2;
        } else if (difficulty === "medium") {
            typeIdx = r < 0.4 ? 0 : r < 0.7 ? 1 : 2;
        } else if (difficulty === "hard") {
            typeIdx = r < 0.25 ? 0 : r < 0.55 ? 1 : 2;
        } else {
            // extreme — mostly guns and hammers
            typeIdx = r < 0.15 ? 0 : r < 0.40 ? 1 : 2;
        }

        const type = OBSTACLE_TYPES[typeIdx];
        const lane = Math.floor(Math.random() * LANE_COUNT);

        obstacles.push({
            type: typeIdx,
            x: canvas.width + type.width,
            y: laneYPositions[lane],
            lane: lane,
            width: type.width,
            height: type.height,
            speed: gameSpeed * type.speed,
            shootTimer: type.shoots ? 1.5 + Math.random() : 999,
            hit: false,
        });
    }

    function spawnBullet(obs) {
        bullets.push({
            x: obs.x - 10,
            y: obs.y,
            width: 12,
            height: 4,
            speed: gameSpeed * 2.5,
        });
        playSFX(2); // gun sound when bullet fires
    }

    // ---- Phone Collectible ----
    function spawnPhonePickup() {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        phonePickups.push({
            x: canvas.width + 40,
            y: laneYPositions[lane],
            lane: lane,
            bobTimer: Math.random() * Math.PI * 2, // start at random phase for bob
        });
    }

    function drawPhonePickup(ph) {
        ctx.save();
        // Gentle floating bob
        const bobY = Math.sin(ph.bobTimer * 3) * 5;
        ctx.translate(ph.x, ph.y + bobY);

        // Glow aura
        ctx.save();
        ctx.shadowColor = "#4ecca3";
        ctx.shadowBlur = 15 + Math.sin(ph.bobTimer * 4) * 5;
        ctx.fillStyle = "rgba(78,204,163,0.12)";
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Phone body
        ctx.fillStyle = "#1a1a2e";
        ctx.beginPath();
        ctx.roundRect(-10, -16, 20, 32, 3);
        ctx.fill();

        // Phone border
        ctx.strokeStyle = "#4ecca3";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-10, -16, 20, 32, 3);
        ctx.stroke();

        // Screen
        const screenGrad = ctx.createLinearGradient(-7, -12, -7, 10);
        screenGrad.addColorStop(0, "#2a5a4a");
        screenGrad.addColorStop(1, "#1a3a2a");
        ctx.fillStyle = screenGrad;
        ctx.fillRect(-7, -12, 14, 22);

        // Screen content — tiny "CALL" text
        ctx.fillStyle = "#4ecca3";
        ctx.font = "bold 5px monospace";
        ctx.textAlign = "center";
        ctx.fillText("CALL", 0, -3);
        ctx.fillText("SAUL", 0, 4);

        // Phone icon on screen
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.arc(0, -8, 2, 0, Math.PI * 2);
        ctx.fill();

        // Home button
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.arc(0, 13, 2, 0, Math.PI * 2);
        ctx.fill();

        // Sparkle rotation indicator
        const sparkAngle = ph.bobTimer * 2;
        ctx.strokeStyle = "rgba(255,215,0,0.4)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const a = sparkAngle + (i * Math.PI / 2);
            const dist = 18;
            const sx = Math.cos(a) * dist;
            const sy = Math.sin(a) * dist;
            ctx.beginPath();
            ctx.moveTo(sx - 2, sy);
            ctx.lineTo(sx + 2, sy);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx, sy - 2);
            ctx.lineTo(sx, sy + 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawPhoneHoldAnimation() {
        // Draw a phone next to Jimmy's head when he just picked one up
        if (phoneAnimTimer <= 0) return;

        const alpha = Math.min(1, phoneAnimTimer / 0.3); // fade out in last 0.3s
        ctx.save();
        ctx.globalAlpha = alpha;

        const phX = player.x + player.width / 2 + 8;
        const phY = player.y - player.height / 3 - 5;

        // Arm holding phone
        ctx.strokeStyle = "#d4a574";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 4, player.y - player.height / 7);
        ctx.quadraticCurveTo(phX - 5, phY + 10, phX, phY + 5);
        ctx.stroke();

        // Phone in hand
        ctx.fillStyle = "#1a1a2e";
        ctx.beginPath();
        ctx.roundRect(phX - 6, phY - 10, 12, 20, 2);
        ctx.fill();
        ctx.strokeStyle = "#4ecca3";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(phX - 6, phY - 10, 12, 20, 2);
        ctx.stroke();

        // Screen glow
        ctx.fillStyle = "#2a5a4a";
        ctx.fillRect(phX - 4, phY - 8, 8, 14);

        // Signal waves coming from phone
        const wave = (PHONE_ANIM_DURATION - phoneAnimTimer) * 4;
        ctx.strokeStyle = `rgba(78,204,163,${0.5 * alpha})`;
        ctx.lineWidth = 1.5;
        for (let w = 0; w < 3; w++) {
            const waveSize = 6 + wave * 3 + w * 6;
            if (waveSize > 30) continue;
            ctx.beginPath();
            ctx.arc(phX, phY - 5, waveSize, -Math.PI * 0.6, -Math.PI * 0.1);
            ctx.stroke();
        }

        ctx.restore();
    }

    // ---- Particles ----
    function createHitParticle(x, y) {
        return {
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 0.5 + Math.random() * 0.4,
            maxLife: 0.9,
            size: 3 + Math.random() * 5,
            color: "#e94560",
        };
    }

    function createConfetti(x, y) {
        const colors = ["#e94560", "#4ecca3", "#ffd700", "#00b4d8", "#ff6b6b", "#a855f7"];
        return {
            x, y,
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.5) * 14 - 4,
            life: 1.5 + Math.random() * 1.5,
            maxLife: 3,
            size: 4 + Math.random() * 7,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 10,
        };
    }

    function createDustParticle(x, y) {
        return {
            x, y,
            vx: -1 - Math.random() * 2,
            vy: (Math.random() - 0.5) * 1,
            life: 0.3 + Math.random() * 0.2,
            maxLife: 0.5,
            size: 2 + Math.random() * 3,
            color: isDayTheme ? "rgba(160,140,110,0.5)" : "rgba(100,100,130,0.4)",
        };
    }

    // ---- Collision ----
    function rectsOverlap(a, b) {
        return (
            a.x - a.width / 2 < b.x + b.width / 2 &&
            a.x + a.width / 2 > b.x - b.width / 2 &&
            a.y - a.height / 2 < b.y + b.height / 2 &&
            a.y + a.height / 2 > b.y - b.height / 2
        );
    }

    // ---- HUD ----
    function updateHUD() {
        hud.score.textContent = "Score: " + Math.floor(score).toLocaleString();
        if (dashReady) {
            hud.dash.textContent = "DASH [SPACE]";
            hud.dash.classList.add("dash-ready");
        } else {
            const cd = Math.ceil(dashCooldown);
            hud.dash.textContent = "DASH: " + cd + "s";
            hud.dash.classList.remove("dash-ready");
        }
    }

    // ============================================================
    // DRAWING FUNCTIONS
    // ============================================================

    function drawBackground(dt) {
        // Let bgOffset grow continuously — no modulo wrapping here
        bgOffset += gameSpeed * 30 * dt;

        if (isDayTheme) {
            drawDayBackground();
        } else {
            drawNightBackground();
        }

        drawLanes();
    }

    function drawNightBackground() {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, "#050510");
        grad.addColorStop(0.3, "#0a0a1a");
        grad.addColorStop(0.7, "#16213e");
        grad.addColorStop(1, "#1a1a2e");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Moon
        ctx.save();
        ctx.fillStyle = "rgba(255,250,220,0.9)";
        ctx.shadowColor = "rgba(255,250,200,0.4)";
        ctx.shadowBlur = 40;
        ctx.beginPath();
        ctx.arc(canvas.width - 120, 100, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(200,190,160,0.3)";
        ctx.beginPath();
        ctx.arc(canvas.width - 128, 94, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width - 112, 108, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Stars
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        for (let i = 0; i < 80; i++) {
            const sx = (i * 137 + 50) % canvas.width;
            const sy = (i * 97 + 30) % (canvas.height * 0.35);
            const size = (i % 3 === 0) ? 2 : 1;
            ctx.fillRect(sx, sy, size, size);
        }

        const twinkle = Math.sin(Date.now() / 500);
        ctx.fillStyle = `rgba(255,255,200,${0.3 + twinkle * 0.2})`;
        for (let i = 0; i < 15; i++) {
            const sx = (i * 211 + 100) % canvas.width;
            const sy = (i * 173 + 20) % (canvas.height * 0.25);
            ctx.fillRect(sx, sy, 2, 2);
        }

        drawBuildings("#0c1225", "#0f1629", "rgba(255,200,50,0.2)", "rgba(255,200,50,0.08)");
    }

    function drawDayBackground() {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, "#87ceeb");
        grad.addColorStop(0.4, "#b0d8f0");
        grad.addColorStop(0.7, "#d4e8c0");
        grad.addColorStop(1, "#c8bf9e");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Sun
        ctx.save();
        ctx.fillStyle = "rgba(255,220,50,0.9)";
        ctx.shadowColor = "rgba(255,200,50,0.5)";
        ctx.shadowBlur = 60;
        ctx.beginPath();
        ctx.arc(canvas.width - 150, 90, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,220,50,0.15)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Date.now() / 3000;
            ctx.beginPath();
            ctx.moveTo(canvas.width - 150 + Math.cos(angle) * 42, 90 + Math.sin(angle) * 42);
            ctx.lineTo(canvas.width - 150 + Math.cos(angle) * 58, 90 + Math.sin(angle) * 58);
            ctx.stroke();
        }
        ctx.restore();

        // Clouds
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        const cw = canvas.width + 200;
        drawCloud(((200 - bgOffset * 0.1) % cw + cw) % cw - 100, 70, 1);
        drawCloud(((500 - bgOffset * 0.15) % cw + cw) % cw - 100, 110, 0.7);
        drawCloud(((800 - bgOffset * 0.08) % cw + cw) % cw - 100, 50, 1.2);

        drawBuildings("#b0a890", "#c8b898", "rgba(150,200,255,0.3)", "rgba(100,150,200,0.15)");
    }

    function drawCloud(x, y, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.arc(25, -5, 15, 0, Math.PI * 2);
        ctx.arc(-20, 2, 15, 0, Math.PI * 2);
        ctx.arc(10, 5, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawBuildings(colorBack, colorFront, windowLit, windowDark) {
        // Seamless scrolling: each building has a fixed position in a repeating strip
        // Far buildings
        const farCount = 15;
        const farSpacing = 150;
        const farStripWidth = farCount * farSpacing;
        ctx.fillStyle = colorBack;
        for (let i = 0; i < farCount; i++) {
            const basePos = i * farSpacing;
            const bx = ((basePos - bgOffset * 0.15) % farStripWidth + farStripWidth) % farStripWidth - farSpacing;
            const bw = 60 + (i * 37) % 80;
            const bh = 100 + (i * 53) % 180;
            ctx.fillRect(bx, groundY - bh, bw, bh);
        }

        // Near buildings
        const nearCount = 20;
        const nearSpacing = 120;
        const nearStripWidth = nearCount * nearSpacing;
        ctx.fillStyle = colorFront;
        for (let i = 0; i < nearCount; i++) {
            const basePos = i * nearSpacing;
            const bx = ((basePos - bgOffset * 0.3) % nearStripWidth + nearStripWidth) % nearStripWidth - nearSpacing;
            const bw = 50 + (i * 41) % 70;
            const bh = 60 + (i * 47) % 140;
            ctx.fillRect(bx, groundY - bh, bw, bh);

            for (let wy = groundY - bh + 10; wy < groundY - 10; wy += 18) {
                for (let wx = bx + 7; wx < bx + bw - 7; wx += 14) {
                    const isLit = ((wx * 7 + wy * 3) % 5) < 2;
                    ctx.fillStyle = isLit ? windowLit : windowDark;
                    ctx.fillRect(wx, wy, 6, 8);
                }
            }
            ctx.fillStyle = colorFront;
        }
    }

    function drawLanes() {
        const laneColor = isDayTheme ? "rgba(139,90,43,0.15)" : "rgba(233,69,96,0.12)";
        ctx.strokeStyle = laneColor;
        ctx.lineWidth = 1;
        for (let i = 0; i <= LANE_COUNT; i++) {
            const ly = 60 + laneHeight * i;
            ctx.beginPath();
            ctx.setLineDash([20, 15]);
            ctx.moveTo(0, ly);
            ctx.lineTo(canvas.width, ly);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        const groundColor = isDayTheme ? "#8B7355" : "#e94560";
        ctx.strokeStyle = groundColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(canvas.width, groundY);
        ctx.stroke();

        if (isDayTheme) {
            ctx.fillStyle = "rgba(139,115,85,0.3)";
            const gxOff = bgOffset % 30;
            for (let gx = -gxOff; gx < canvas.width; gx += 30) {
                ctx.fillRect(gx, groundY + 2, 15, 2);
            }
        }
    }

    function drawPlayer() {
        const px = player.x;
        const py = player.y;
        let w = player.width;
        let h = player.height;

        // Dash afterimage trail
        if (isDashing) {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.translate(px - 25, py);
            drawPlayerBody(w, h);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 0.12;
            ctx.translate(px - 50, py);
            drawPlayerBody(w, h);
            ctx.restore();
        }

        // Sprite
        if (sprites.jimmy) {
            ctx.save();
            ctx.translate(px, py);
            if (isDashing) {
                ctx.globalAlpha = 0.9;
                ctx.shadowColor = "#00b4d8";
                ctx.shadowBlur = 20;
                // Increase size during dash
                w = 120;
                h = 120;
            }
            ctx.drawImage(sprites.jimmy, -w / 2, -h / 2, w, h);
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(px, py);

        if (isDashing) {
            ctx.shadowColor = "#00b4d8";
            ctx.shadowBlur = 20;
        }

        drawPlayerBody(w, h);
        ctx.restore();
    }

    function drawPlayerBody(w, h) {
        // Shadow
        ctx.fillStyle = isDayTheme ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, h / 2 + 2, w / 2 + 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        const legSwing = Math.sin(player.animFrame * 10) * 12;
        const legColor = isDayTheme ? "#3a3a5a" : "#2a2a4a";
        ctx.strokeStyle = legColor;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";

        const shoeColor = isDayTheme ? "#5a3a20" : "#4a2a1a";

        const lx = -7 + legSwing;
        const ly = h / 2 - 2;
        ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.fillStyle = shoeColor; ctx.fillRect(lx - 5, ly - 2, 10, 5);

        const rx = 7 - legSwing;
        const ry = h / 2 - 2;
        ctx.beginPath(); ctx.moveTo(7, 12); ctx.lineTo(rx, ry); ctx.stroke();
        ctx.fillStyle = shoeColor; ctx.fillRect(rx - 5, ry - 2, 10, 5);

        // Body
        ctx.fillStyle = isDayTheme ? "#4a6a8a" : "#2a3a5a";
        ctx.fillRect(-w / 4, -h / 5, w / 2, h / 2.5);

        // Coat
        const flapAngle = Math.sin(player.coatFlap) * (isDashing ? 0.3 : 0.12);
        ctx.save();
        ctx.rotate(flapAngle);
        ctx.fillStyle = isDayTheme ? "#7a5a38" : "#4a3728";
        ctx.beginPath();
        ctx.moveTo(-w / 2 - 4, -h / 5 + 3);
        ctx.lineTo(-w / 2 + 6, h / 4 + 8);
        ctx.lineTo(w / 2 - 6, h / 4 + 8);
        ctx.lineTo(w / 2 + 4, -h / 5 + 3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isDayTheme ? "#8a6a48" : "#5c4a3a";
        ctx.beginPath(); ctx.moveTo(-4, -h / 5 + 2); ctx.lineTo(-10, h / 7); ctx.lineTo(0, h / 7); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(4, -h / 5 + 2); ctx.lineTo(10, h / 7); ctx.lineTo(0, h / 7); ctx.closePath(); ctx.fill();
        ctx.fillRect(-w / 3 - 2, -h / 5 - 1, w / 1.4, 7);
        ctx.restore();

        // Tie
        ctx.fillStyle = "#e94560";
        ctx.beginPath(); ctx.moveTo(0, -h / 5 + 6); ctx.lineTo(-4, h / 8); ctx.lineTo(0, h / 8 + 4); ctx.lineTo(4, h / 8); ctx.closePath(); ctx.fill();

        // Arms
        const armSwing = Math.sin(player.animFrame * 10) * 8;
        ctx.strokeStyle = isDayTheme ? "#7a5a38" : "#4a3728";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-w / 3, -h / 7); ctx.lineTo(-w / 2 - 5 - armSwing, h / 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w / 3, -h / 7); ctx.lineTo(w / 2 + 5 + armSwing, h / 6); ctx.stroke();

        // Briefcase
        ctx.fillStyle = "#8B6914";
        const bcX = w / 2 + 5 + armSwing;
        const bcY = h / 6;
        ctx.fillRect(bcX - 6, bcY - 2, 12, 10);
        ctx.strokeStyle = "#6a5010"; ctx.lineWidth = 1; ctx.strokeRect(bcX - 6, bcY - 2, 12, 10);
        ctx.fillStyle = "#c9a227"; ctx.fillRect(bcX - 1, bcY + 1, 2, 2);

        // Head
        ctx.fillStyle = "#d4a574";
        ctx.beginPath(); ctx.arc(0, -h / 3 - 3, 13, 0, Math.PI * 2); ctx.fill();

        // Hair
        ctx.fillStyle = isDayTheme ? "#5a4530" : "#4a3520";
        ctx.beginPath(); ctx.arc(0, -h / 3 - 9, 12, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        ctx.fillRect(-12, -h / 3 - 6, 3, 8);
        ctx.fillRect(9, -h / 3 - 6, 3, 8);

        // Eyes
        ctx.fillStyle = "#222";
        ctx.fillRect(-6, -h / 3 - 4, 3, 3);
        ctx.fillRect(4, -h / 3 - 4, 3, 3);
        ctx.fillStyle = "#fff";
        ctx.fillRect(-5, -h / 3 - 3, 1, 1);
        ctx.fillRect(5, -h / 3 - 3, 1, 1);

        // Eyebrows
        ctx.strokeStyle = isDayTheme ? "#4a3520" : "#3a2510";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-7, -h / 3 - 7); ctx.lineTo(-3, -h / 3 - 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3, -h / 3 - 8); ctx.lineTo(7, -h / 3 - 7); ctx.stroke();

        // Mouth
        ctx.strokeStyle = "#8a5a3a"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(1, -h / 3 + 4, 5, 0.1, Math.PI * 0.5); ctx.stroke();

        // Nose
        ctx.fillStyle = "#c49060";
        ctx.beginPath(); ctx.moveTo(0, -h / 3 - 1); ctx.lineTo(-2, -h / 3 + 3); ctx.lineTo(2, -h / 3 + 3); ctx.closePath(); ctx.fill();
    }

    function drawObstacle(obs) {
        const type = OBSTACLE_TYPES[obs.type];

        if (sprites[type.name]) {
            ctx.save();
            ctx.translate(obs.x, obs.y);
            ctx.drawImage(sprites[type.name], -obs.width / 2, -obs.height / 2, obs.width, obs.height);
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(obs.x, obs.y);

        ctx.fillStyle = isDayTheme ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, obs.height / 2 + 2, obs.width / 2, 5, 0, 0, Math.PI * 2); ctx.fill();

        if (obs.type === 0) {
            for (let i = 0; i < 4; i++) {
                const fileColors = ["#c9a227", "#b8922a", "#d4a83a", "#a88420"];
                ctx.fillStyle = fileColors[i % fileColors.length];
                const yOff = -obs.height / 2 + i * 13;
                const xOff = Math.sin(i * 1.5) * 3;
                ctx.fillRect(-obs.width / 2 + xOff, yOff, obs.width - 2, 11);
                ctx.strokeStyle = "#8a6f1a"; ctx.lineWidth = 1;
                ctx.strokeRect(-obs.width / 2 + xOff, yOff, obs.width - 2, 11);
                ctx.strokeStyle = "rgba(100,70,20,0.3)";
                ctx.beginPath(); ctx.moveTo(-obs.width / 2 + xOff + 6, yOff + 4); ctx.lineTo(obs.width / 2 + xOff - 8, yOff + 4); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-obs.width / 2 + xOff + 6, yOff + 7); ctx.lineTo(obs.width / 2 + xOff - 12, yOff + 7); ctx.stroke();
            }
            ctx.fillStyle = "rgba(233,69,96,0.6)"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center";
            ctx.fillText("CASE", 0, -2); ctx.fillText("FILES", 0, 8);

        } else if (obs.type === 1) {
            ctx.fillStyle = "#8B4513"; ctx.fillRect(-3, -2, 6, obs.height - 8);
            ctx.fillStyle = "#654321";
            for (let hy = 5; hy < obs.height - 15; hy += 8) { ctx.fillRect(-4, hy, 8, 3); }
            const headGrad = ctx.createLinearGradient(-obs.width / 2, -obs.height / 2, -obs.width / 2, -obs.height / 2 + 20);
            headGrad.addColorStop(0, "#aaa"); headGrad.addColorStop(0.5, "#777"); headGrad.addColorStop(1, "#555");
            ctx.fillStyle = headGrad; ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, 20);
            ctx.strokeStyle = "#444"; ctx.lineWidth = 1.5; ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, 20);
            ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(-obs.width / 2 + 4, -obs.height / 2 + 3, obs.width - 15, 4);

        } else if (obs.type === 2) {
            // --- Improved Gun: detailed semi-auto pistol ---
            const gw = obs.width;
            const gh = obs.height;

            // Danger glow aura
            ctx.save();
            ctx.shadowColor = "#e94560";
            ctx.shadowBlur = 18;
            ctx.fillStyle = "rgba(233,69,96,0.06)";
            ctx.fillRect(-gw / 2 - 5, -gh / 2 - 5, gw + 10, gh + 10);
            ctx.restore();

            // Slide (top of gun) — dark metallic with highlights
            const slideGrad = ctx.createLinearGradient(-gw / 2, -gh / 2, -gw / 2, -gh / 2 + gh * 0.4);
            slideGrad.addColorStop(0, "#3a3a3a");
            slideGrad.addColorStop(0.4, "#1a1a1a");
            slideGrad.addColorStop(0.6, "#2a2a2a");
            slideGrad.addColorStop(1, "#111");
            ctx.fillStyle = slideGrad;
            ctx.beginPath();
            ctx.roundRect(-gw / 2, -gh / 2, gw * 0.85, gh * 0.42, [3, 3, 1, 1]);
            ctx.fill();
            ctx.strokeStyle = "#444"; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.roundRect(-gw / 2, -gh / 2, gw * 0.85, gh * 0.42, [3, 3, 1, 1]);
            ctx.stroke();

            // Slide serrations (rear grip lines)
            ctx.strokeStyle = "rgba(80,80,80,0.5)";
            ctx.lineWidth = 0.8;
            for (let s = 0; s < 5; s++) {
                const sx = -gw / 2 + gw * 0.6 + s * 3;
                ctx.beginPath();
                ctx.moveTo(sx, -gh / 2 + 2);
                ctx.lineTo(sx, -gh / 2 + gh * 0.38);
                ctx.stroke();
            }

            // Top highlight (chrome edge)
            ctx.strokeStyle = "rgba(140,140,140,0.3)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-gw / 2 + 2, -gh / 2 + 1);
            ctx.lineTo(-gw / 2 + gw * 0.82, -gh / 2 + 1);
            ctx.stroke();

            // Barrel / muzzle
            const barrelGrad = ctx.createLinearGradient(-gw / 2 - 4, 0, -gw / 2, 0);
            barrelGrad.addColorStop(0, "#111");
            barrelGrad.addColorStop(0.5, "#222");
            barrelGrad.addColorStop(1, "#1a1a1a");
            ctx.fillStyle = barrelGrad;
            ctx.fillRect(-gw / 2 - 6, -gh / 2 + 4, 8, gh * 0.32);
            // Muzzle dark hole
            ctx.fillStyle = "#000";
            ctx.beginPath(); ctx.arc(-gw / 2 - 3, -gh / 2 + gh * 0.21, 2.5, 0, Math.PI * 2); ctx.fill();

            // Frame (lower receiver)
            const frameGrad = ctx.createLinearGradient(-gw / 2, -gh / 2 + gh * 0.4, -gw / 2, gh * 0.1);
            frameGrad.addColorStop(0, "#2a2a2a");
            frameGrad.addColorStop(1, "#1a1a1a");
            ctx.fillStyle = frameGrad;
            ctx.beginPath();
            ctx.roundRect(-gw / 2 + 2, -gh / 2 + gh * 0.4, gw * 0.55, gh * 0.25, 1);
            ctx.fill();

            // Trigger guard (curved)
            ctx.strokeStyle = "#2a2a2a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-gw / 2 + gw * 0.18, -gh / 2 + gh * 0.42);
            ctx.quadraticCurveTo(-gw / 2 + gw * 0.12, -gh / 2 + gh * 0.72, -gw / 2 + gw * 0.32, -gh / 2 + gh * 0.65);
            ctx.stroke();

            // Trigger
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-gw / 2 + gw * 0.22, -gh / 2 + gh * 0.46);
            ctx.lineTo(-gw / 2 + gw * 0.20, -gh / 2 + gh * 0.58);
            ctx.stroke();

            // Grip (handle) — angled
            ctx.save();
            ctx.translate(-gw / 2 + gw * 0.45, -gh / 2 + gh * 0.62);
            ctx.rotate(0.15); // slight angle
            const gripGrad = ctx.createLinearGradient(-8, 0, 8, 0);
            gripGrad.addColorStop(0, "#222");
            gripGrad.addColorStop(0.5, "#333");
            gripGrad.addColorStop(1, "#222");
            ctx.fillStyle = gripGrad;
            ctx.beginPath();
            ctx.roundRect(-8, -2, 16, gh * 0.45, [0, 0, 3, 3]);
            ctx.fill();

            // Grip texture (cross-hatch)
            ctx.strokeStyle = "rgba(80,80,80,0.4)";
            ctx.lineWidth = 0.5;
            for (let t = 0; t < 4; t++) {
                const ty = 2 + t * 3.5;
                ctx.beginPath(); ctx.moveTo(-5, ty); ctx.lineTo(5, ty); ctx.stroke();
            }
            ctx.restore();

            // Magazine base plate (bottom of grip)
            ctx.fillStyle = "#1a1a1a";
            ctx.save();
            ctx.translate(-gw / 2 + gw * 0.45, -gh / 2 + gh * 0.62);
            ctx.rotate(0.15);
            ctx.fillRect(-9, gh * 0.40, 18, 3);
            ctx.restore();

            // Rear sight
            ctx.fillStyle = "#333";
            ctx.fillRect(-gw / 2 + gw * 0.68, -gh / 2 - 3, 6, 4);
            ctx.fillRect(-gw / 2 + gw * 0.68, -gh / 2 - 3, 2, 4);
            ctx.fillRect(-gw / 2 + gw * 0.72, -gh / 2 - 3, 2, 4);

            // Front sight
            ctx.fillStyle = "#333";
            ctx.fillRect(-gw / 2 + 4, -gh / 2 - 2, 3, 3);

            // Red dot on front sight
            ctx.fillStyle = "#ff3333";
            ctx.beginPath(); ctx.arc(-gw / 2 + 5.5, -gh / 2 - 1, 1, 0, Math.PI * 2); ctx.fill();

            // Ejection port
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(-gw / 2 + gw * 0.35, -gh / 2 + 3, gw * 0.18, gh * 0.12);
            ctx.strokeStyle = "rgba(100,100,100,0.3)"; ctx.lineWidth = 0.5;
            ctx.strokeRect(-gw / 2 + gw * 0.35, -gh / 2 + 3, gw * 0.18, gh * 0.12);
        }

        ctx.restore();
    }

    function drawBullet(b) {
        ctx.save();
        ctx.translate(b.x, b.y);
        const trailGrad = ctx.createLinearGradient(0, 0, 30, 0);
        trailGrad.addColorStop(0, "rgba(233,69,96,0.5)");
        trailGrad.addColorStop(1, "rgba(233,69,96,0)");
        ctx.fillStyle = trailGrad; ctx.fillRect(0, -3, 30, 6);
        ctx.fillStyle = "#ffd700";
        ctx.beginPath(); ctx.ellipse(0, 0, b.width / 2, b.height / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.ellipse(-1, -1, 2, 1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawParticles() {
        for (const p of particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.save();
            ctx.translate(p.x, p.y);
            if (p.rotation !== undefined) ctx.rotate(p.rotation);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    function addScorePopup(x, y, text) {
        scorePopups.push({ x, y, text, life: 1.2 });
    }

    function drawScorePopups(dt) {
        for (let i = scorePopups.length - 1; i >= 0; i--) {
            const sp = scorePopups[i];
            sp.life -= dt;
            sp.y -= 35 * dt;
            if (sp.life <= 0) { scorePopups.splice(i, 1); continue; }
            ctx.save();
            ctx.globalAlpha = Math.min(1, sp.life * 2);
            ctx.fillStyle = "#4ecca3";
            ctx.font = "bold 14px 'Press Start 2P', monospace";
            ctx.textAlign = "center";
            ctx.fillText(sp.text, sp.x, sp.y);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Dash visual: motion lines ----
    function drawDashLines() {
        if (!isDashing) return;
        ctx.save();
        ctx.strokeStyle = "rgba(0,180,216,0.3)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            const lx = player.x - 30 - Math.random() * 40;
            const ly = player.y - 20 + Math.random() * 40;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - 20 - Math.random() * 15, ly);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ============================================================
    // MAIN UPDATE
    // ============================================================

    function update(dt) {
        if (state !== "playing") return;

        const cfg = DIFFICULTIES[difficulty];
        elapsed += dt;

        gameSpeed = cfg.speedBase + elapsed * cfg.speedGrowth * cfg.speedBase;

        const prevScore = Math.floor(score);
        score += gameSpeed * dt * 10;
        const newScore = Math.floor(score);

        if (score >= cfg.target) {
            winLevel();
            return;
        }

        // Speech cooldown
        if (speechCooldown > 0) speechCooldown -= dt;

        // Milestone phrases
        for (const mk of milestoneKeys) {
            if (prevScore < mk && newScore >= mk && MILESTONE_PHRASES[mk]) {
                showSpeech(MILESTONE_PHRASES[mk]);
                currentSpeechTimer = 15 + Math.random() * 10; // reset random timer
                break;
            }
        }

        // Random catchphrases — slower: every 15-25 seconds
        currentSpeechTimer -= dt;
        if (currentSpeechTimer <= 0) {
            showSpeech(pickContextPhrase());
            currentSpeechTimer = 15 + Math.random() * 10;
        }

        // Dash system
        if (isDashing) {
            dashTimer -= dt;
            if (dashTimer <= 0) {
                isDashing = false;
                dashTimer = 0;
            }
        }
        if (!dashReady) {
            dashCooldown -= dt;
            if (dashCooldown <= 0) {
                dashReady = true;
                dashCooldown = 0;
            }
        }

        // Player animation
        player.animFrame += dt;
        player.coatFlap += dt * (isDashing ? 15 : 7);

        // Smooth lane transition
        const dy = player.targetY - player.y;
        player.y += dy * 14 * dt;

        // Keep speech bubble following the player
        updateSpeechBubblePosition();

        // Mic-based movement — smoothed with hysteresis + hold timers
        // Speaking = lane 0 (top), Medium = lane 1 (center), Silent = lane 2 (bottom)
        if (micModeEnabled && micAnalyser) {
            updateMicAmplitude();
            updateVoiceMeter();

            // Count down the hold timer
            if (micZoneHoldTimer > 0) micZoneHoldTimer -= dt;

            // Determine zone with hysteresis + hold timer
            // Hold timer prevents zone exit for a minimum period — keeps you "locked"
            // in the zone even during natural pauses between syllables
            const prevZone = micCurrentZone;

            if (micCurrentZone === "up") {
                // Currently speaking — only exit if hold timer expired AND amplitude dropped
                if (micZoneHoldTimer <= 0 && micSmoothed < MIC_LOUD_EXIT) {
                    micCurrentZone = micSmoothed < MIC_QUIET_ENTER ? "down" : "center";
                }
            } else if (micCurrentZone === "down") {
                // Currently silent — exit as soon as any sound detected (responsive)
                if (micSmoothed > MIC_QUIET_EXIT) {
                    micCurrentZone = micSmoothed > MIC_LOUD_ENTER ? "up" : "center";
                }
            } else {
                // Currently center — check if we should go up or down
                if (micSmoothed > MIC_LOUD_ENTER) {
                    micCurrentZone = "up";
                } else if (micZoneHoldTimer <= 0 && micSmoothed < MIC_QUIET_ENTER) {
                    micCurrentZone = "down";
                }
            }

            // Reset hold timer when zone changes
            if (micCurrentZone !== prevZone) {
                micZoneHoldTimer = MIC_ZONE_HOLD_TIME;
            }

            // Map zone to target lane
            const zoneLane = micCurrentZone === "up" ? 0 : micCurrentZone === "down" ? 2 : 1;

            // Only change lane if target differs and settle timer allows it
            micLaneSettleTimer -= dt;
            if (zoneLane !== player.lane && micLaneSettleTimer <= 0) {
                // Move toward target one lane at a time
                if (zoneLane < player.lane) movePlayer(-1);
                else if (zoneLane > player.lane) movePlayer(1);
                micLaneSettleTimer = 0.15; // small settle delay between lane steps
            }
        }

        // Dust trail
        if (Math.random() < (isDashing ? 0.8 : 0.4)) {
            particles.push(createDustParticle(player.x - 15, player.y + player.height / 2 - 5));
        }

        // Spawn obstacles
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnObstacle();
            spawnTimer = cfg.spawnRate * (0.7 + Math.random() * 0.6);

            // Rare phone collectible spawn
            if (Math.random() < PHONE_SPAWN_CHANCE) {
                spawnPhonePickup();
            }
        }

        // Phone hold animation countdown
        if (phoneAnimTimer > 0) {
            phoneAnimTimer -= dt;
        }

        // Update phone pickups
        for (let i = phonePickups.length - 1; i >= 0; i--) {
            const ph = phonePickups[i];
            ph.x -= gameSpeed * 60 * dt;
            ph.bobTimer += dt;

            // Off screen
            if (ph.x < -40) { phonePickups.splice(i, 1); continue; }

            // Collision with player
            if (rectsOverlap(
                { x: player.x, y: player.y, width: player.width * 0.6, height: player.height * 0.65 },
                { x: ph.x, y: ph.y, width: 28, height: 36 }
            )) {
                // Collect!
                phonePickups.splice(i, 1);
                score += PHONE_BONUS;
                addScorePopup(ph.x, ph.y - 20, "+" + PHONE_BONUS + " 📱");
                forceShowSpeech("Better Call Saul!");
                phoneAnimTimer = PHONE_ANIM_DURATION;

                // Sparkle particles
                for (let j = 0; j < 12; j++) {
                    particles.push({
                        x: ph.x, y: ph.y,
                        vx: (Math.random() - 0.5) * 8,
                        vy: (Math.random() - 0.5) * 8 - 2,
                        life: 0.6 + Math.random() * 0.4,
                        maxLife: 1,
                        size: 3 + Math.random() * 4,
                        color: ["#4ecca3", "#ffd700", "#00b4d8", "#a855f7"][Math.floor(Math.random() * 4)],
                    });
                }
                continue;
            }
        }

        // Update obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.speed = gameSpeed * OBSTACLE_TYPES[obs.type].speed;
            obs.x -= obs.speed * 60 * dt;

            // Gun shoots
            if (OBSTACLE_TYPES[obs.type].shoots && obs.x < canvas.width - 50) {
                obs.shootTimer -= dt;
                if (obs.shootTimer <= 0) {
                    spawnBullet(obs);
                    obs.shootTimer = 2 + Math.random() * 1.5;
                }
            }

            // Off screen = dodged — NO SFX on dodge
            if (obs.x < -obs.width) {
                obstacles.splice(i, 1);
                addScorePopup(80, player.y - 30, "+50");
                score += 50;
                continue;
            }

            // Collision — skip if dashing (invincible)
            if (!isDashing && !obs.hit && rectsOverlap(
                { x: player.x, y: player.y, width: player.width * 0.6, height: player.height * 0.65 },
                { x: obs.x, y: obs.y, width: obs.width * 0.75, height: obs.height * 0.75 }
            )) {
                for (let j = 0; j < 15; j++) {
                    particles.push(createHitParticle(player.x, player.y));
                }
                playSFX(obs.type); // SFX on collision ONLY
                gameOver();
                return;
            }
        }

        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x -= b.speed * 60 * dt;

            if (b.x < -20) { bullets.splice(i, 1); continue; }

            // Bullet collision — skip if dashing
            if (!isDashing && rectsOverlap(
                { x: player.x, y: player.y, width: player.width * 0.5, height: player.height * 0.5 },
                { x: b.x, y: b.y, width: b.width, height: b.height }
            )) {
                for (let j = 0; j < 10; j++) {
                    particles.push(createHitParticle(player.x, player.y));
                }
                playSFX(2); // gun SFX on bullet hit
                bullets.splice(i, 1);
                gameOver();
                return;
            }
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * 60 * dt;
            p.y += p.vy * 60 * dt;
            p.vy += 4 * dt;
            p.life -= dt;
            if (p.rotation !== undefined) p.rotation += p.rotSpeed * dt;
            if (p.life <= 0) particles.splice(i, 1);
        }

        updateHUD();
    }

    // ============================================================
    // MAIN DRAW
    // ============================================================

    function draw(dt) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === "menu" || state === "loading" || state === "disclaimer") return;

        // Screen shake — apply canvas offset
        let shaking = false;
        if (shakeTimer > 0) {
            shakeTimer -= dt;
            const progress = Math.max(0, shakeTimer / SHAKE_DURATION);
            const currentIntensity = shakeIntensity * progress; // decay over time
            const shakeX = (Math.random() - 0.5) * 2 * currentIntensity;
            const shakeY = (Math.random() - 0.5) * 2 * currentIntensity;
            ctx.save();
            ctx.translate(shakeX, shakeY);
            shaking = true;
        }

        drawBackground(dt);
        drawParticles();

        if (state === "playing" || state === "paused") {
            for (const ph of phonePickups) drawPhonePickup(ph);
            for (const obs of obstacles) drawObstacle(obs);
            for (const b of bullets) drawBullet(b);
            drawDashLines();
            drawPlayer();
            drawPhoneHoldAnimation();
            drawScorePopups(dt);

            // Progress bar
            const cfg = DIFFICULTIES[difficulty];
            const progress = Math.min(score / cfg.target, 1);
            const barW = 220;
            const barH = 8;
            const barX = canvas.width / 2 - barW / 2;
            const barY = canvas.height - 20;

            ctx.fillStyle = isDayTheme ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
            ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();

            const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            barGrad.addColorStop(0, "#4ecca3"); barGrad.addColorStop(1, "#45b393");
            ctx.fillStyle = barGrad;
            ctx.beginPath(); ctx.roundRect(barX, barY, barW * progress, barH, 4); ctx.fill();

            ctx.strokeStyle = isDayTheme ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.stroke();

            ctx.fillStyle = isDayTheme ? "#555" : "#888";
            ctx.font = "9px monospace"; ctx.textAlign = "center";
            ctx.fillText(Math.floor(progress * 100) + "%", canvas.width / 2, barY - 4);
        }

        if (state === "win" || state === "gameover") {
            for (const obs of obstacles) drawObstacle(obs);
            drawPlayer();
            drawParticles();
        }

        // Close screen shake transform
        if (shaking) {
            ctx.restore();
        }
    }

    // ============================================================
    // GAME LOOP
    // ============================================================

    let lastTime = 0;

    function gameLoop(timestamp) {
        const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;
        update(dt);
        draw(dt);
        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame((t) => {
        lastTime = t;
        requestAnimationFrame(gameLoop);
    });

    // Start loading
    loadAllAssets();
})();
