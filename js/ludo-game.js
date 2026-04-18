/**
 * Ludo Universe — board, rules, UI, save/load, two-player mode.
 * Add optional scripts after this file (e.g. AI) or split further under js/.
 */
document.addEventListener('DOMContentLoaded', () => {
    const splashScreen = document.getElementById('splash-screen');
    const gameWrapper = document.querySelector('.game-wrapper');
    const canvas = document.getElementById('ludo-canvas');
    const ctx = canvas.getContext('2d');
    const diceBox = document.getElementById('dice-box');
    const diceEl = document.getElementById('dice');
    const turnIndicatorEl = document.getElementById('turn-indicator');
    const gameMessageEl = document.getElementById('game-message');
    const saveBtn = document.getElementById('save-btn');
    const resetBtn = document.getElementById('reset-btn');
    const muteBtn = document.getElementById('mute-btn');
    const installBanner = document.getElementById('install-banner');
    const installBannerTitle = document.getElementById('install-banner-title');
    const installBannerText = document.getElementById('install-banner-text');
    const installButton = document.getElementById('install-button');
    const installClose = document.getElementById('install-close');
    const twoPlayerCheckbox = document.getElementById('two-player-checkbox');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsBackdrop = document.getElementById('settings-backdrop');
    const modeToggleCheckbox = document.getElementById('mode-toggle-checkbox');
    const mainGameTitle = document.getElementById('main-game-title');

    let gameMode = 'ludo'; // 'ludo' or 'snake'

    function updateGameTitle() {
        if (mainGameTitle) {
            if (gameMode === 'snake') {
                mainGameTitle.innerHTML = 'Ludo <span class="game-title__sub">Universe</span>';
            } else {
                mainGameTitle.innerHTML = 'Ludo <span class="game-title__sub">Universe</span>';
            }
        }
    }
    const aiCheckboxes = [
        document.getElementById('ai-player-0'),
        document.getElementById('ai-player-1'),
        document.getElementById('ai-player-2'),
        document.getElementById('ai-player-3')
    ];
    const aiModeCheckbox = document.getElementById('ai-mode-checkbox');
    const aiModeLabel = document.getElementById('ai-mode-label');
    const blockadeCheckbox = document.getElementById('blockade-checkbox');
    const ludoRulesGroup = document.getElementById('ludo-rules-group');
    const snakeRulesGroup = document.getElementById('snake-rules-group');
    const snakeUnlockCheckbox = document.getElementById('snake-unlock-checkbox');
    const snakeUnlockLabel = document.getElementById('snake-unlock-label');
    const singleWinCheckbox = document.getElementById('single-win-checkbox');
    const gameoverModal = document.getElementById('gameover-modal');

    let snakeUnlockNumber = 1; // 1 or 6
    const gameoverWinnersList = document.getElementById('gameover-winners');
    const gameoverResetBtn = document.getElementById('gameover-reset-btn');
    const getBadgeBtn = document.getElementById('get-badge-btn');
    const playerNameInputs = [
        document.getElementById('player-name-input-0'),
        document.getElementById('player-name-input-1'),
        document.getElementById('player-name-input-2'),
        document.getElementById('player-name-input-3')
    ];
    const DEFAULT_PLAYER_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
    let playerNames = [...DEFAULT_PLAYER_NAMES];
    let boardSize;
    let SQUARE_SIZE;
    let TOKEN_RADIUS;
    let isMuted = false;
    let deferredInstallPrompt = null;
    let installBannerTimer = null;
    let installedKnown = false;

    const installMessage = 'Install this game for faster access and a cleaner full-screen board.';
    const installFallbackMessage = 'Use your browser menu and choose "Install App" or "Add to Home Screen".';
    const openMessage = 'Ludo Universe is already installed. Open it for the full-screen version.';
    const installStateKey = 'ludo-universe-installed';

    const sounds = {
        roll: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0 } }).toDestination(),
        move: new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.1 } }).toDestination(),
        capture: new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.1 } }).toDestination(),
        finish: new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.05, release: 0.1 } }).toDestination(),
        win: new Tone.PolySynth(Tone.Synth).toDestination()
    };

    function playSound(sound) {
        if (isMuted || Tone.context.state !== 'running') return;
        switch (sound) {
            case 'roll': sounds.roll.triggerAttackRelease("8n"); break;
            case 'move': sounds.move.triggerAttackRelease("C5", "16n"); break;
            case 'capture': sounds.capture.triggerAttackRelease("G3", "8n"); break;
            case 'finish': sounds.finish.triggerAttackRelease("G5", "16n"); break;
            case 'win':
                const now = Tone.now();
                sounds.win.triggerAttackRelease(["C4", "E4", "G4"], "8n", now);
                sounds.win.triggerAttackRelease(["G4", "B4", "D5"], "8n", now + 0.2);
                sounds.win.triggerAttackRelease(["C5", "E5", "G5"], "4n", now + 0.4);
                break;
        }
    }

    function isStandaloneMode() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function updateInstallButtonState() {
        installButton.textContent = installedKnown ? 'Open' : 'Install';
    }

    async function refreshInstalledState() {
        installedKnown = isStandaloneMode() || localStorage.getItem(installStateKey) === 'true';

        if (!installedKnown && 'getInstalledRelatedApps' in navigator) {
            try {
                const relatedApps = await navigator.getInstalledRelatedApps();
                if (relatedApps.length > 0) {
                    installedKnown = true;
                    localStorage.setItem(installStateKey, 'true');
                }
            } catch (error) {
                console.log('Installed app check failed:', error);
            }
        }

        updateInstallButtonState();
    }

    function isGoodConnection() {
        // @ts-ignore
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!conn) return true;
        if (conn.saveData) return false;
        // Types that are considered "good" for automatic updates
        const goodTypes = ['4g', 'wifi'];
        return !conn.effectiveType || goodTypes.includes(conn.effectiveType);
    }

    function showInstallBanner(mode = 'install') {
        if (isStandaloneMode()) return;
        if (sessionStorage.getItem('ludo-banner-suppressed') === 'true' && mode !== 'update') return;

        let title = 'Install Ludo Universe';
        let message = installMessage;
        let btnText = 'Install';

        installButton.classList.remove('install-banner-action--update');

        if (mode === 'open') {
            title = 'Ludo Universe';
            message = openMessage;
            btnText = 'Open';
        } else if (mode === 'update') {
            title = 'Update Available';
            message = 'A new version of Ludo Universe is ready with fresh features and improvements.';
            btnText = 'Update Now';
            installButton.classList.add('install-banner-action--update');
        } else if (!deferredInstallPrompt) {
            message = installFallbackMessage;
        }

        if (installBannerTitle) installBannerTitle.textContent = title;
        if (installBannerText) installBannerText.textContent = message;
        if (installButton) installButton.textContent = btnText;

        installButton.dataset.mode = mode;
        installBanner.hidden = false;
        requestAnimationFrame(() => installBanner.classList.add('show'));
    }

    function hideInstallBanner(isManual = false) {
        if (isManual) {
            sessionStorage.setItem('ludo-banner-suppressed', 'true');
        }
        installBanner.classList.remove('show');
        setTimeout(() => {
            if (!installBanner.classList.contains('show')) {
                installBanner.hidden = true;
            }
        }, 350);
    }

    function scheduleInstallBanner(delay = 2800) {
        clearTimeout(installBannerTimer);
        installBannerTimer = setTimeout(() => {
            if (installedKnown) {
                showInstallBanner('open');
            } else {
                showInstallBanner('install');
            }
        }, delay);
    }

    function toggleMute(shouldBeMuted) {
        isMuted = shouldBeMuted;
        if (muteBtn) {
            muteBtn.textContent = isMuted ? 'Sound: off' : 'Sound: on';
            muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
        }
        localStorage.setItem('ludoSoundSetting', JSON.stringify({ muted: isMuted }));
    }

    function openSettings() {
        if (!settingsModal) return;

        // Sync rules visibility to mode
        if (ludoRulesGroup) {
            if (gameMode === 'snake') ludoRulesGroup.classList.add('hidden');
            else ludoRulesGroup.classList.remove('hidden');
        }
        if (snakeRulesGroup) {
            if (gameMode !== 'snake') snakeRulesGroup.classList.add('hidden');
            else snakeRulesGroup.classList.remove('hidden');
        }

        settingsModal.classList.remove('hidden');
        settingsModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        // Push a fake history entry so browser back/gesture closes settings
        history.pushState({ settingsOpen: true }, '');
    }

    function closeSettings() {
        if (!settingsModal) return;
        settingsModal.classList.add('hidden');
        settingsModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        // Clean up the history entry we pushed
        if (history.state && history.state.settingsOpen) {
            history.back();
        }
    }

    // Browser back button / gesture closes settings
    window.addEventListener('popstate', (e) => {
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
            settingsModal.classList.add('hidden');
            settingsModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
        if (gameoverModal && !gameoverModal.classList.contains('hidden')) {
            gameoverModal.classList.add('hidden');
            gameoverModal.setAttribute('aria-hidden', 'true');
        }
    });

    const PLAYER_HEX = ['#ff4757', '#2ed573', '#ffa502', '#1e90ff'];

    function savePlayerNames() {
        localStorage.setItem('ludoPlayerNames', JSON.stringify(playerNames));
    }

    function syncAILabels() {
        playerNames.forEach((name, i) => {
            const el = document.querySelector(`.ai-name-${i}`);
            if (el) el.textContent = name || DEFAULT_PLAYER_NAMES[i];
        });
    }

    function showGameOver() {
        gameMessageEl.textContent = 'Game Over!';
        if (!gameoverModal || !gameoverWinnersList) return;
        gameoverWinnersList.innerHTML = '';
        playerRanks.forEach((pIdx) => {
            const li = document.createElement('li');
            const dot = document.createElement('span');
            dot.className = 'winner-color';
            dot.style.background = PLAYER_HEX[pIdx];
            li.appendChild(dot);
            const label = document.createElement('span');
            const displayName = playerNames[pIdx] || DEFAULT_PLAYER_NAMES[pIdx];
            label.textContent = `${displayName} (${DEFAULT_PLAYER_NAMES[pIdx]})`;
            li.appendChild(label);
            gameoverWinnersList.appendChild(li);
        });
        gameoverModal.classList.remove('hidden');
        gameoverModal.setAttribute('aria-hidden', 'false');
        history.pushState({ gameoverOpen: true }, '');
    }

    function hideGameOver() {
        if (!gameoverModal) return;
        gameoverModal.classList.add('hidden');
        gameoverModal.setAttribute('aria-hidden', 'true');
        if (history.state && history.state.gameoverOpen) {
            history.back();
        }
    }

    function syncDiceToActivePlayer() {
        // Obsolete, keeping an empty hook if needed or entirely removing its body to avoid errors
    }

    function downloadBadge() {
        if (!gameoverModal) return;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1080;
        canvas.height = 1080;

        // 1. Background
        const grad = ctx.createLinearGradient(0, 0, 0, 1080);
        grad.addColorStop(0, '#1a2a3a');
        grad.addColorStop(1, '#0f1a28');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1080);

        // 2. Decorative Gold Border
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 20;
        ctx.strokeRect(40, 40, 1000, 1000);
        ctx.lineWidth = 2;
        ctx.strokeRect(60, 60, 960, 960);

        // 3. App Title & Icon
        const img = new Image();
        img.onload = () => {
            // Draw Icon
            ctx.drawImage(img, 540 - 100, 120, 200, 200);

            // Draw Title
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 72px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('LUDO UNIVERSE', 540, 380);

            // Game Mode subtitle
            const modeName = gameMode === 'snake' ? '🐍 Snake & Ladder' : '🎲 Ludo';
            ctx.fillStyle = '#e0e0e0';
            ctx.font = 'bold 34px sans-serif';
            ctx.fillText(modeName, 540, 425);

            ctx.fillStyle = '#ffffff';
            ctx.font = '38px sans-serif';
            ctx.fillText('Official Victory Certificate', 540, 475);

            // 4. Match Summary
            ctx.fillStyle = '#bdc3c7';
            ctx.font = '30px sans-serif';
            const dateStr = new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            ctx.fillText(`Match played on ${dateStr}`, 540, 520);

            // 5. Rankings
            let y = 640;
            const participants = [0, 1, 2, 3].filter(p => isPlayerActive(p));
            const winners = playerRanks;
            const remaining = participants.filter(p => !winners.includes(p));

            if (singleWinMode) {
                // Single Player Win Mode
                const winnerIdx = winners[0];
                const winnerName = playerNames[winnerIdx] || DEFAULT_PLAYER_NAMES[winnerIdx];

                // Winner
                ctx.fillStyle = '#f1c40f';
                ctx.font = 'bold 58px sans-serif';
                ctx.fillText(`🥇 1st Prize: ${winnerName}`, 540, y);
                y += 100;

                // Others
                ctx.fillStyle = '#ecf0f1';
                ctx.font = '36px sans-serif';
                ctx.fillText('Remaining Players:', 540, y);
                y += 50;

                ctx.fillStyle = '#bdc3c7';
                ctx.font = '32px sans-serif';
                remaining.forEach(p => {
                    const name = playerNames[p] || DEFAULT_PLAYER_NAMES[p];
                    ctx.fillText(name, 540, y);
                    y += 45;
                });
            } else if (twoPlayerMode) {
                // 2-Player Mode
                const winnerIdx = winners[0];
                const loserIdx = remaining[0];
                const winnerName = playerNames[winnerIdx] || DEFAULT_PLAYER_NAMES[winnerIdx];
                const loserName = playerNames[loserIdx] || DEFAULT_PLAYER_NAMES[loserIdx];

                ctx.fillStyle = '#f1c40f';
                ctx.font = 'bold 58px sans-serif';
                ctx.fillText(`🥇 Winner: ${winnerName}`, 540, y);
                y += 100;

                ctx.fillStyle = '#ecf0f1';
                ctx.font = '38px sans-serif';
                ctx.fillText(`🥈 Runner Up: ${loserName}`, 540, y);
            } else {
                // Normal 4-Player Mode
                const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
                winners.forEach((pIdx, i) => {
                    const name = playerNames[pIdx] || DEFAULT_PLAYER_NAMES[pIdx];
                    ctx.fillStyle = i === 0 ? '#f1c40f' : '#ecf0f1';
                    ctx.font = i === 0 ? 'bold 54px sans-serif' : '42px sans-serif';
                    ctx.fillText(`${medals[i]} Place: ${name}`, 540, y);
                    y += 80;
                });

                if (remaining.length > 0) {
                    y += 30;
                    const lastIdx = remaining[0];
                    const lastName = playerNames[lastIdx] || DEFAULT_PLAYER_NAMES[lastIdx];
                    ctx.fillStyle = '#95a5a6';
                    ctx.font = '38px sans-serif';
                    ctx.fillText(`🥄 Last Place: ${lastName}`, 540, y);
                }
            }

            // 6. Credit
            ctx.fillStyle = 'rgba(212, 175, 55, 0.9)';
            ctx.font = 'italic 30px sans-serif';
            ctx.fillText('Created By Mirjan Ali Sha', 540, 1010);

            // 7. Download
            const link = document.createElement('a');
            const badgeMode = gameMode === 'snake' ? 'Snake_Ladder' : 'Ludo';
            link.download = `Ludo_Universe_${badgeMode}_Badge.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = 'Ludo_App-icon.png';
    }

    document.body.addEventListener('click', async () => {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
    }, { once: true });


    const PLAYER_COLORS = {
        p1: { light: '#ff7979', dark: '#ff4757', faint: '#ffebee' },
        p2: { light: '#55ef90', dark: '#2ed573', faint: '#e8f5e9' },
        p3: { light: '#ffc048', dark: '#ffa502', faint: '#fff8e1' },
        p4: { light: '#74b9ff', dark: '#1e90ff', faint: '#e3f2fd' }
    };
    const INACTIVE_CORNER_COLORS = { light: '#b2bec3', dark: '#95a5a6', faint: '#dfe6e9' };
    const PLAYER_CSS_COLORS = ['var(--player1-color)', 'var(--player2-color)', 'var(--player3-color)', 'var(--player4-color)'];
    let twoPlayerMode = false;

    function isPlayerActive(p) {
        if (!twoPlayerMode) return true;
        return p === 0 || p === 2;
    }

    function ranksNeededToEndMatch() {
        if (singleWinMode) return 1;
        return twoPlayerMode ? 1 : 3;
    }

    function cornerPalette(i) {
        const list = [PLAYER_COLORS.p1, PLAYER_COLORS.p2, PLAYER_COLORS.p3, PLAYER_COLORS.p4];
        if (twoPlayerMode && (i === 1 || i === 3)) return INACTIVE_CORNER_COLORS;
        return list[i];
    }

    function tokenPalette(playerIndex) {
        if (twoPlayerMode && (playerIndex === 1 || playerIndex === 3)) return INACTIVE_CORNER_COLORS;
        return [PLAYER_COLORS.p1, PLAYER_COLORS.p2, PLAYER_COLORS.p3, PLAYER_COLORS.p4][playerIndex];
    }

    function ensureCurrentPlayerIsActive() {
        if (isPlayerActive(currentPlayerIndex) && !playerRanks.includes(currentPlayerIndex)) return;
        for (let i = 0; i < 4; i++) {
            if (isPlayerActive(i) && !playerRanks.includes(i)) {
                currentPlayerIndex = i;
                return;
            }
        }
    }

    const homePositions = [
        [{ x: 1.5, y: 1.5 }, { x: 4.5, y: 1.5 }, { x: 1.5, y: 4.5 }, { x: 4.5, y: 4.5 }],
        [{ x: 10.5, y: 1.5 }, { x: 13.5, y: 1.5 }, { x: 10.5, y: 4.5 }, { x: 13.5, y: 4.5 }],
        [{ x: 10.5, y: 10.5 }, { x: 13.5, y: 10.5 }, { x: 10.5, y: 13.5 }, { x: 13.5, y: 13.5 }],
        [{ x: 1.5, y: 10.5 }, { x: 4.5, y: 10.5 }, { x: 1.5, y: 13.5 }, { x: 4.5, y: 13.5 }]
    ];

    const path = [
        { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
        { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 },
        { x: 7, y: 0 }, { x: 8, y: 0 },
        { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
        { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
        { x: 14, y: 7 }, { x: 14, y: 8 },
        { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
        { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 },
        { x: 7, y: 14 }, { x: 6, y: 14 },
        { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
        { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
        { x: 0, y: 7 }, { x: 0, y: 6 }
    ];

    const homePaths = [
        [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }],
        [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }],
        [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }],
        [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }]
    ];

    const startOffsets = [0, 13, 26, 39];
    const safeZones = [0, 8, 13, 21, 26, 34, 39, 47];

    // --- Snake and Ladders Data ---
    const SNAKE_LADDERS = {
        ladders: { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 71: 91 },
        snakes: { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78 }
    };

    function getSnakeGridPos(index) {
        // index 0-99 (represents square 1-100)
        const row = Math.floor(index / 10);
        let col = index % 10;
        // Boustrophedon (zig-zag) pattern
        if (row % 2 !== 0) {
            col = 9 - col;
        }
        return {
            x: col + 0.5,
            y: 9 - row + 0.5
        };
    }

    let diceBag = [];
    let tokens = [];
    let currentPlayerIndex = 0;
    let diceRoll = 0;
    let gameState = 'roll';
    let movableTokens = [];
    let captureMadeThisTurn = false;
    let tokenFinishedThisTurn = false;
    let isGameSaved = true;
    let playerRanks = [];
    let computerPlayers = [false, false, false, false];
    let aiMode = 'balanced'; // 'balanced' or 'aggressive'
    let blockadeRuleEnabled = false;
    let singleWinMode = false;

    function fillAndShuffleDiceBag() {
        diceBag = [];
        const distribution = { 1: 8, 2: 9, 3: 10, 4: 11, 5: 12, 6: 12 };
        for (const number in distribution) {
            for (let i = 0; i < distribution[number]; i++) {
                diceBag.push(parseInt(number));
            }
        }
        for (let i = diceBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [diceBag[i], diceBag[j]] = [diceBag[j], diceBag[i]];
        }
    }

    function initializeGame() {
        tokens = [];
        if (gameMode === 'ludo') {
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    tokens.push({ player: i, id: j, position: -1, status: 'home' });
                }
            }
        } else {
            // Snake and Ladders: 1 token per player
            for (let i = 0; i < 4; i++) {
                // Tokens start at 'home' (inactive)
                tokens.push({ player: i, id: 0, position: -1, status: 'home' });
            }
        }
        fillAndShuffleDiceBag();
        currentPlayerIndex = 0;
        gameState = 'roll';
        diceRoll = 0;
        isGameSaved = true;
        playerRanks = [];
        captureMadeThisTurn = false;
        tokenFinishedThisTurn = false;
        ensureCurrentPlayerIsActive();
        updateTurnIndicator();
        diceEl.className = 'dice';
        if (diceBox) diceBox.style.cursor = 'pointer';
        gameMessageEl.textContent = 'Roll the dice to start!';
        handleResize();
        drawEverything();

        if (computerPlayers[currentPlayerIndex]) {
            if (diceBox) diceBox.style.cursor = 'not-allowed';
            setTimeout(() => {
                if (gameState === 'roll') handleRollDice();
            }, 1000);
        }
    }

    function resetGame() {
        localStorage.removeItem('ludoGameState');
        hideGameOver();
        initializeGame();
    }

    function saveGame() {
        const gameStateToSave = {
            tokens: tokens,
            currentPlayerIndex: currentPlayerIndex,
            playerRanks: playerRanks,
            twoPlayerMode: twoPlayerMode,
            gameMode: gameMode
        };
        localStorage.setItem('ludoGameState', JSON.stringify(gameStateToSave));
        isGameSaved = true;
        gameMessageEl.textContent = "Game Saved!";
        setTimeout(() => {
            if (gameState === 'roll') gameMessageEl.textContent = 'Roll the dice!';
            else if (gameState === 'move') gameMessageEl.textContent = 'Click a highlighted token to move.';
        }, 2000);
    }

    function loadGame() {
        try {
            const savedRaw = localStorage.getItem('ludoGameState');
            if (!savedRaw) return false;

            const savedState = JSON.parse(savedRaw);
            if (!savedState || !Array.isArray(savedState.tokens)) {
                console.warn('Ludo: Saved state is invalid or incomplete. Initializing fresh game.');
                return false;
            }

            gameMode = savedState.gameMode || 'ludo';
            updateGameTitle();
            tokens = savedState.tokens;
            currentPlayerIndex = savedState.currentPlayerIndex !== undefined ? savedState.currentPlayerIndex : 0;
            playerRanks = savedState.playerRanks || [];
            twoPlayerMode = !!savedState.twoPlayerMode;
            if (twoPlayerCheckbox) twoPlayerCheckbox.checked = twoPlayerMode;

            fillAndShuffleDiceBag();
            gameState = 'roll';
            diceRoll = 0;
            isGameSaved = true;
            ensureCurrentPlayerIsActive();

            updateTurnIndicator();
            diceEl.className = 'dice';
            gameMessageEl.textContent = 'Game Loaded. Roll the dice!';
            if (diceBox) diceBox.style.cursor = 'pointer';

            handleResize();
            drawEverything();
            return true;
        } catch (error) {
            console.error('Ludo: Failed to load game state:', error);
            return false;
        }
    }

    function handleRollDice() {
        if (gameState !== 'roll') return;
        captureMadeThisTurn = false;
        tokenFinishedThisTurn = false;
        gameState = 'rolling';
        if (diceBox) diceBox.style.cursor = 'not-allowed';
        diceEl.className = 'dice rolling';
        playSound('roll');
        setTimeout(() => {
            if (diceBag.length === 0) fillAndShuffleDiceBag();
            diceRoll = diceBag.pop();
            diceEl.className = 'dice';
            diceEl.classList.add(`show-${diceRoll}`);
            checkForMovableTokens();
        }, 1500);
    }

    function switchPlayer() {
        let nextPlayer = (currentPlayerIndex + 1) % 4;
        for (let step = 0; step < 8; step++) {
            const skip = playerRanks.includes(nextPlayer) || !isPlayerActive(nextPlayer);
            if (!skip) break;
            if (playerRanks.length >= ranksNeededToEndMatch()) {
                gameState = 'gameover';
                if (diceBox) diceBox.style.cursor = 'not-allowed';
                showGameOver();
                return;
            }
            nextPlayer = (nextPlayer + 1) % 4;
        }
        currentPlayerIndex = nextPlayer;

        gameState = 'roll';
        if (diceBox) diceBox.style.cursor = 'pointer';
        updateTurnIndicator();
        gameMessageEl.textContent = 'Roll the dice!';

        if (computerPlayers[currentPlayerIndex]) {
            if (diceBox) diceBox.style.cursor = 'not-allowed';
            setTimeout(() => {
                if (gameState === 'roll') {
                    handleRollDice();
                }
            }, 800);
        }
    }

    function checkForMovableTokens() {
        movableTokens = [];
        const enterRoll = (gameMode === 'ludo' ? 6 : snakeUnlockNumber);
        const playerTokens = tokens.filter(t => t.player === currentPlayerIndex);
        playerTokens.forEach(token => {
            if (gameMode === 'ludo') {
                if ((token.status === 'home' && diceRoll === 6) || (token.status === 'active' && token.position + diceRoll <= 56)) {
                    movableTokens.push(token);
                }
            } else {
                // Snake mode: 1 token, starts at -1 (home), needs a 1 or 6 to enter
                if (token.status === 'home' && diceRoll === enterRoll) {
                    movableTokens.push(token);
                } else if (token.status === 'active' && token.position + diceRoll <= 99) {
                    movableTokens.push(token);
                }
            }
        });

        if (movableTokens.length === 1) {
            gameMessageEl.textContent = 'Only one move! Moving automatically.';
            drawEverything();
            setTimeout(() => moveToken(movableTokens[0]), 1000);
        } else if (movableTokens.length > 1) {
            if (computerPlayers[currentPlayerIndex] && window.LudoAI) {
                gameMessageEl.textContent = 'Computer is thinking...';
                drawEverything();
                // AI picks best move
                setTimeout(() => {
                    const best = window.LudoAI.getBestMove(movableTokens, tokens, currentPlayerIndex, diceRoll, aiMode, blockadeRuleEnabled, gameMode);
                    moveToken(best || movableTokens[0]);
                }, 800);
            } else {
                gameState = 'move';
                gameMessageEl.textContent = 'Click a highlighted token to move.';
                drawEverything();
            }
        } else {
            gameMessageEl.textContent = `No valid moves.`;
            setTimeout(switchPlayer, 1500);
        }
    }

    function moveToken(token) {
        if (gameState !== 'move' && gameState !== 'rolling') return;
        isGameSaved = false;
        gameState = 'animating';
        movableTokens = [];
        gameMessageEl.textContent = 'Moving...';

        const enterRoll = (gameMode === 'ludo' ? 6 : snakeUnlockNumber);
        if (token.status === 'home' && diceRoll === enterRoll) {
            token.status = 'active';
            // Snake: Move to Square 2 (index 1) on entry roll, Ludo starts at index 0
            token.position = (gameMode === 'snake' ? 1 : 0);
            drawEverything();
            playSound('move');
            finalizeMove(token);
        } else {
            animateTokenMove(token, diceRoll);
        }
    }

    // ── VISUAL EFFECTS SYSTEM ───────────────────────────────────
    let activeEffects = []; // running VFX overlays
    let pathAnimOverride = null; // {token, x, y} — overrides drawTokens position

    // Helpers reused from drawSnakesAndLadders (must match exactly)
    function _getOffset(s, e, factor) {
        const seed = (s * 7 + e * 13) % 100;
        return (seed / 100 - 0.5) * factor;
    }
    function _bezAt(t, p0, cp1, cp2, p1) {
        const i = 1 - t;
        return i * i * i * p0 + 3 * i * i * t * cp1 + 3 * i * t * t * cp2 + t * t * t * p1;
    }

    // Compute the pixel path for a snake body (matches drawing code exactly)
    function getSnakeBodyPath(startSquare, endSquare) {
        const cellSize = boardSize / 10;
        const sIdx = startSquare - 1, eIdx = endSquare - 1;
        const sp = getSnakeGridPos(sIdx), ep = getSnakeGridPos(eIdx);
        const x1 = sp.x * cellSize, y1 = sp.y * cellSize;
        const x2 = ep.x * cellSize, y2 = ep.y * cellSize;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len, ny = dx / len;
        const off1 = _getOffset(sIdx, eIdx, cellSize * 1.5);
        const off2 = _getOffset(eIdx, sIdx, cellSize * 1.5);
        const wave = cellSize * 0.5 * ((sIdx * 3 + eIdx * 5) % 7 + 3) / 10;
        const cp1x = x1 + dx * 0.25 + off1 + nx * wave;
        const cp1y = y1 + dy * 0.25 + ny * wave;
        const cp2x = x1 + dx * 0.75 + off2 - nx * wave;
        const cp2y = y1 + dy * 0.75 - ny * wave;
        // Sample points along the bezier
        const points = [];
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            points.push({
                x: _bezAt(t, x1, cp1x, cp2x, x2),
                y: _bezAt(t, y1, cp1y, cp2y, y2)
            });
        }
        return points;
    }

    // Compute the pixel path for a ladder (straight line along rail)
    function getLadderPath(startSquare, endSquare) {
        const cellSize = boardSize / 10;
        const sIdx = startSquare - 1, eIdx = endSquare - 1;
        const sp = getSnakeGridPos(sIdx), ep = getSnakeGridPos(eIdx);
        const x1 = sp.x * cellSize, y1 = sp.y * cellSize;
        const x2 = ep.x * cellSize, y2 = ep.y * cellSize;
        const points = [];
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            points.push({
                x: x1 + (x2 - x1) * t,
                y: y1 + (y2 - y1) * t
            });
        }
        return points;
    }

    function spawnParticleBurst(cx, cy, color, count) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = 1.5 + Math.random() * 3;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: 2 + Math.random() * 4,
                alpha: 1, color
            });
        }
        const startTime = Date.now();
        activeEffects.push({
            type: 'particles', startTime, duration: 900, particles,
            draw(ctx) {
                const progress = Math.min((Date.now() - this.startTime) / this.duration, 1);
                this.particles.forEach(p => {
                    p.x += p.vx; p.y += p.vy; p.vy += 0.08;
                    p.alpha = 1 - progress; p.r *= 0.98;
                    ctx.globalAlpha = p.alpha;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
                return progress < 1;
            }
        });
    }

    function spawnFloatingText(cx, cy, text, color, fontSize) {
        const startTime = Date.now();
        activeEffects.push({
            type: 'text', startTime, duration: 1400,
            draw(ctx) {
                const progress = Math.min((Date.now() - this.startTime) / this.duration, 1);
                const scale = 0.3 + 0.7 * Math.min(progress / 0.2, 1);
                const fadeOut = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
                ctx.save();
                ctx.globalAlpha = fadeOut;
                ctx.translate(cx, cy - progress * 40);
                ctx.scale(scale, scale);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(text, 2, 2);
                ctx.fillStyle = color;
                ctx.fillText(text, 0, 0);
                ctx.restore();
                return progress < 1;
            }
        });
    }

    function spawnGlowRing(cx, cy, color) {
        const startTime = Date.now();
        activeEffects.push({
            type: 'glow', startTime, duration: 800,
            draw(ctx) {
                const progress = Math.min((Date.now() - this.startTime) / this.duration, 1);
                const r = 8 + progress * 25;
                const a = (1 - progress) * 0.6;
                ctx.globalAlpha = a;
                ctx.strokeStyle = color; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = a * 0.4;
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                return progress < 1;
            }
        });
    }

    function startScreenShake(intensity, duration) {
        const startTime = Date.now();
        activeEffects.push({
            type: 'shake', startTime, duration, intensity,
            draw() { return Date.now() - this.startTime < this.duration; },
            getOffset() {
                const decay = 1 - Math.min((Date.now() - this.startTime) / this.duration, 1);
                return {
                    x: (Math.random() - 0.5) * this.intensity * decay * 2,
                    y: (Math.random() - 0.5) * this.intensity * decay * 2
                };
            }
        });
    }

    function drawEffectsOverlay() {
        if (activeEffects.length === 0) return;
        activeEffects = activeEffects.filter(fx => fx.draw(ctx));
        if (activeEffects.length > 0) {
            requestAnimationFrame(() => {
                drawEverything();
                drawEffectsOverlay();
            });
        }
    }

    function getTokenScreenPos(token) {
        const cellSize = boardSize / 10;
        if (gameMode === 'snake' && token.status === 'active') {
            const pos = getSnakeGridPos(token.position);
            return { x: pos.x * cellSize, y: pos.y * cellSize };
        }
        return { x: boardSize / 2, y: boardSize / 2 };
    }

    // ── ANIMATION FUNCTIONS ──────────────────────────────────────

    function animateTokenMove(token, stepsLeft) {
        if (stepsLeft <= 0) {
            if (gameMode === 'snake') {
                const square = token.position + 1;
                const ladderDest = SNAKE_LADDERS.ladders[square];
                const snakeDest = SNAKE_LADDERS.snakes[square];
                if (ladderDest) {
                    // Animate climbing the ladder visually
                    gameMessageEl.textContent = '🪜 Ladder! Climbing up...';
                    playSound('finish');
                    const pos = getTokenScreenPos(token);
                    spawnParticleBurst(pos.x, pos.y, '#ffd700', 20);
                    spawnFloatingText(pos.x, pos.y - 15, '🪜 LADDER!', '#ffd700', Math.round(boardSize / 14));
                    spawnGlowRing(pos.x, pos.y, '#ffd700');
                    drawEffectsOverlay();
                    setTimeout(() => {
                        animateAlongPath(token, getLadderPath(square, ladderDest), 'ladder', ladderDest - 1, () => finalizeMove(token));
                    }, 450);
                    return;
                } else if (snakeDest) {
                    // Animate sliding down the snake body
                    gameMessageEl.textContent = '🐍 Snake! Sliding down...';
                    playSound('capture');
                    const pos = getTokenScreenPos(token);
                    spawnParticleBurst(pos.x, pos.y, '#ff1744', 20);
                    spawnFloatingText(pos.x, pos.y - 15, '🐍 SNAKE!', '#ff1744', Math.round(boardSize / 14));
                    spawnGlowRing(pos.x, pos.y, '#ff1744');
                    startScreenShake(4, 500);
                    drawEffectsOverlay();
                    setTimeout(() => {
                        animateAlongPath(token, getSnakeBodyPath(square, snakeDest), 'snake', snakeDest - 1, () => finalizeMove(token));
                    }, 550);
                    return;
                }
            }
            finalizeMove(token);
            return;
        }
        token.position++;
        playSound('move');
        drawEverything();
        const stepDelay = gameMode === 'snake' ? 200 : 350;
        setTimeout(() => animateTokenMove(token, stepsLeft - 1), stepDelay);
    }

    // Animate token along a pixel path (snake body curve or ladder rail)
    function animateAlongPath(token, pathPoints, type, destPosition, callback) {
        const glowColor = type === 'ladder' ? '#ffd700' : '#ff1744';
        const trailColor = type === 'ladder' ? '#fff9c4' : '#ff8a80';
        const trailPositions = [];
        let stepIdx = 0;
        const totalSteps = pathPoints.length;
        const stepDelay = type === 'ladder' ? 45 : 35; // Snakes are slightly faster (slithery)

        function doStep() {
            if (stepIdx >= totalSteps) {
                // Arrived — set final position, clear override
                pathAnimOverride = null;
                token.position = destPosition;
                drawEverything();
                // Arrival effects
                const dest = getTokenScreenPos(token);
                if (type === 'ladder') {
                    spawnParticleBurst(dest.x, dest.y, '#4caf50', 18);
                    spawnFloatingText(dest.x, dest.y - 10, '✨', '#ffd700', Math.round(boardSize / 18));
                } else {
                    spawnParticleBurst(dest.x, dest.y, '#ff5722', 18);
                }
                spawnGlowRing(dest.x, dest.y, glowColor);
                drawEffectsOverlay();
                playSound(type === 'ladder' ? 'finish' : 'capture');
                setTimeout(callback, 300);
                return;
            }

            const pt = pathPoints[stepIdx];
            trailPositions.push({ x: pt.x, y: pt.y });

            // Set override so drawTokens renders this token at pt.x, pt.y
            pathAnimOverride = { token, x: pt.x, y: pt.y };

            // Play step sound every few frames
            if (stepIdx % 4 === 0) playSound('move');

            drawEverything();

            // Draw glowing trail over the board
            const cellSize = boardSize / 10;
            ctx.save();
            if (trailPositions.length > 1) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                const maxTrail = Math.min(trailPositions.length, 15);
                for (let i = trailPositions.length - maxTrail; i < trailPositions.length - 1; i++) {
                    const age = (i - (trailPositions.length - maxTrail)) / maxTrail;
                    ctx.globalAlpha = age * 0.55;
                    ctx.strokeStyle = glowColor;
                    ctx.lineWidth = cellSize * 0.1 * age;
                    ctx.beginPath();
                    ctx.moveTo(trailPositions[i].x, trailPositions[i].y);
                    ctx.lineTo(trailPositions[i + 1].x, trailPositions[i + 1].y);
                    ctx.stroke();
                }
            }
            // Glow halo on the token
            ctx.globalAlpha = 0.35;
            const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, cellSize * 0.3);
            grad.addColorStop(0, glowColor);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, cellSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();

            // Tiny sparkle particles along the path
            if (stepIdx % 5 === 0) {
                spawnParticleBurst(pt.x, pt.y, trailColor, 3);
            }
            drawEffectsOverlay();

            stepIdx++;
            setTimeout(doStep, stepDelay);
        }
        doStep();
    }

    function finalizeMove(token) {
        if (gameMode === 'ludo') {
            if (token.position === 56) {
                token.status = 'finished';
                tokenFinishedThisTurn = true;
                playSound('finish');
            }
            checkForCapture(token);
        } else {
            // Snake mode — teleport is now handled by animateTeleport in animateTokenMove
            // finalizeMove only handles win detection for snake mode

            if (token.position === 99) {
                token.status = 'finished';
                tokenFinishedThisTurn = true;
                playSound('finish');
            }
        }
        const winner = checkForWinner();

        if (winner !== -1) {
            playerRanks.push(winner);
            const winnerName = playerNames[winner] || DEFAULT_PLAYER_NAMES[winner];
            gameMessageEl.textContent = `${winnerName} finished!`;
            playSound('win');
        }

        if (playerRanks.length >= ranksNeededToEndMatch()) {
            gameState = 'gameover';
            if (diceBox) diceBox.style.cursor = 'not-allowed';
            showGameOver();
        } else {
            const reRollVal = (gameMode === 'ludo' ? 6 : 1);
            if (diceRoll === reRollVal || captureMadeThisTurn || tokenFinishedThisTurn) {
                gameState = 'roll';
                if (diceBox) diceBox.style.cursor = 'pointer';
                if (tokenFinishedThisTurn) gameMessageEl.textContent = 'Token is home! Roll again.';
                else if (captureMadeThisTurn) gameMessageEl.textContent = 'You captured a token! Roll again.';
                else gameMessageEl.textContent = `You rolled a ${reRollVal}! Roll again.`;

                if (computerPlayers[currentPlayerIndex]) {
                    if (diceBox) diceBox.style.cursor = 'not-allowed';
                    setTimeout(() => {
                        if (gameState === 'roll') handleRollDice();
                    }, 800);
                }
            } else {
                switchPlayer();
            }
        }
        drawEverything();
    }

    function checkForCapture(movedToken) {
        if (gameMode !== 'ludo') return; // No capture in Snake mode
        if (movedToken.status !== 'active' || movedToken.position < 0) return;

        // FIX: Must check BEFORE the modulo calculation
        if (movedToken.position > 50) return;

        const movedTokenGlobalPos = (movedToken.position + startOffsets[movedToken.player]) % 52;

        if (safeZones.includes(movedTokenGlobalPos)) return;

        tokens.forEach(token => {
            if (token.player !== movedToken.player &&
                token.status === 'active' &&
                token.position >= 0) {

                // FIX: Skip tokens in home path
                if (token.position > 50) return;

                const opponentGlobalPos = (token.position + startOffsets[token.player]) % 52;

                if (movedTokenGlobalPos === opponentGlobalPos) {
                    let blockadeCount = 1;
                    if (blockadeRuleEnabled) {
                        blockadeCount = tokens.filter(t =>
                            t.player === token.player &&
                            t.status === 'active' &&
                            t.position <= 50 &&
                            ((t.position + startOffsets[t.player]) % 52 === opponentGlobalPos)
                        ).length;
                    }

                    if (blockadeRuleEnabled && blockadeCount >= 2) {
                        // Invincible blockade
                        return;
                    }

                    token.status = 'home';
                    token.position = -1;
                    captureMadeThisTurn = true;
                    playSound('capture');
                }
            }
        });
    }


    function drawSnakeBoard() {
        const cellSize = boardSize / 10;
        ctx.clearRect(0, 0, boardSize, boardSize);

        // Background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, boardSize, boardSize);
        bgGrad.addColorStop(0, '#f8f9fa');
        bgGrad.addColorStop(0.5, '#e9ecef');
        bgGrad.addColorStop(1, '#dee2e6');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, boardSize, boardSize);

        // Row color bands for visual interest
        const rowColors = [
            ['#fff8e1', '#fff3c4'], // row 0 (bottom, sq 1-10)
            ['#e8f5e9', '#c8e6c9'],
            ['#e3f2fd', '#bbdefb'],
            ['#fce4ec', '#f8bbd0'],
            ['#f3e5f5', '#e1bee7'],
            ['#e0f7fa', '#b2ebf2'],
            ['#fff3e0', '#ffe0b2'],
            ['#e8eaf6', '#c5cae9'],
            ['#e0f2f1', '#b2dfdb'],
            ['#fbe9e7', '#ffccbc'], // row 9 (top, sq 91-100)
        ];

        for (let i = 0; i < 100; i++) {
            const pos = getSnakeGridPos(i);
            const px = (pos.x - 0.5) * cellSize;
            const py = (pos.y - 0.5) * cellSize;
            const row = Math.floor(i / 10);
            const isDark = (row + (i % 10)) % 2 === 0;

            const colors = rowColors[row];
            const grad = ctx.createLinearGradient(px, py, px + cellSize, py + cellSize);
            grad.addColorStop(0, isDark ? colors[0] : colors[1]);
            grad.addColorStop(1, isDark ? colors[1] : colors[0]);
            ctx.fillStyle = grad;
            ctx.fillRect(px, py, cellSize, cellSize);

            // Inner border
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

            // Square number — high contrast, readable
            const fontSize = cellSize * 0.30;
            ctx.font = `800 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Text shadow for legibility
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(i + 1, px + cellSize / 2 + 1, py + cellSize / 2 + 1);
            ctx.fillStyle = 'rgba(0, 0, 40, 0.55)';
            ctx.fillText(i + 1, px + cellSize / 2, py + cellSize / 2);
        }

        // Draw Snakes and Ladders on top
        drawSnakesAndLadders(cellSize);
    }

    function drawSnakesAndLadders(cellSize) {
        // Deterministic offset — stable across redraws
        const getOffset = (s, e, factor) => {
            const seed = (s * 7 + e * 13) % 100;
            return (seed / 100 - 0.5) * factor;
        };

        // Bezier point evaluator
        const bezAt = (t, p0, cp1, cp2, p1) => {
            const i = 1 - t;
            return i * i * i * p0 + 3 * i * i * t * cp1 + 3 * i * t * t * cp2 + t * t * t * p1;
        };

        ctx.save();

        // ── LADDERS ──────────────────────────────────────────────
        Object.entries(SNAKE_LADDERS.ladders).forEach(([start, end]) => {
            const sIdx = parseInt(start) - 1;
            const eIdx = parseInt(end) - 1;
            const sp = getSnakeGridPos(sIdx);
            const ep = getSnakeGridPos(eIdx);
            const x1 = sp.x * cellSize, y1 = sp.y * cellSize;
            const x2 = ep.x * cellSize, y2 = ep.y * cellSize;

            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len, uy = dy / len;
            const railOff = cellSize * 0.22;

            // Shadow layer
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = cellSize * 0.2;
            ctx.shadowOffsetX = cellSize * 0.1;
            ctx.shadowOffsetY = cellSize * 0.1;

            // Rails — wooden 3D gradient
            const railGrad = ctx.createLinearGradient(
                x1 - uy * railOff, y1 + ux * railOff,
                x1 + uy * railOff, y1 - ux * railOff
            );
            railGrad.addColorStop(0, '#6d4c41');
            railGrad.addColorStop(0.3, '#a1887f');
            railGrad.addColorStop(0.5, '#d7ccc8');
            railGrad.addColorStop(0.7, '#a1887f');
            railGrad.addColorStop(1, '#4e342e');

            ctx.lineWidth = cellSize * 0.13;
            ctx.lineCap = 'round';
            ctx.strokeStyle = railGrad;

            // Left rail
            ctx.beginPath();
            ctx.moveTo(x1 - uy * railOff, y1 + ux * railOff);
            ctx.lineTo(x2 - uy * railOff, y2 + ux * railOff);
            ctx.stroke();
            // Right rail
            ctx.beginPath();
            ctx.moveTo(x1 + uy * railOff, y1 - ux * railOff);
            ctx.lineTo(x2 + uy * railOff, y2 - ux * railOff);
            ctx.stroke();

            // Disable shadow for rungs (otherwise double-shadow)
            ctx.shadowColor = 'transparent';

            // Rungs
            const rungs = Math.max(3, Math.floor(len / (cellSize * 0.35)));
            for (let i = 1; i < rungs; i++) {
                const t = i / rungs;
                const rx = x1 + dx * t;
                const ry = y1 + dy * t;

                // Rung gradient (subtle 3D)
                const rGrad = ctx.createLinearGradient(
                    rx - uy * railOff, ry + ux * railOff,
                    rx + uy * railOff, ry - ux * railOff
                );
                rGrad.addColorStop(0, '#8d6e63');
                rGrad.addColorStop(0.5, '#bcaaa4');
                rGrad.addColorStop(1, '#6d4c41');
                ctx.strokeStyle = rGrad;
                ctx.lineWidth = cellSize * 0.07;
                ctx.beginPath();
                ctx.moveTo(rx - uy * railOff, ry + ux * railOff);
                ctx.lineTo(rx + uy * railOff, ry - ux * railOff);
                ctx.stroke();
            }

            // Wood grain highlights along rails
            ctx.globalAlpha = 0.12;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.setLineDash([cellSize * 0.15, cellSize * 0.25]);
            ctx.beginPath();
            ctx.moveTo(x1 - uy * (railOff * 0.5), y1 + ux * (railOff * 0.5));
            ctx.lineTo(x2 - uy * (railOff * 0.5), y2 + ux * (railOff * 0.5));
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        });

        // ── SNAKES (cartoon-style, colorful) ─────────────────────
        // Vibrant color palettes — each snake gets a unique color like the reference
        const snakePalettes = [
            { body: '#4caf50', stripe: '#81c784', dark: '#2e7d32', light: '#c8e6c9' }, // green
            { body: '#ff9800', stripe: '#ffb74d', dark: '#e65100', light: '#ffe0b2' }, // orange
            { body: '#e91e63', stripe: '#f06292', dark: '#880e4f', light: '#f8bbd0' }, // pink
            { body: '#2196f3', stripe: '#64b5f6', dark: '#0d47a1', light: '#bbdefb' }, // blue
            { body: '#9c27b0', stripe: '#ba68c8', dark: '#4a148c', light: '#e1bee7' }, // purple
            { body: '#f44336', stripe: '#ef9a9a', dark: '#b71c1c', light: '#ffcdd2' }, // red
            { body: '#ff5722', stripe: '#ff8a65', dark: '#bf360c', light: '#ffccbc' }, // deep orange
            { body: '#009688', stripe: '#4db6ac', dark: '#004d40', light: '#b2dfdb' }, // teal
        ];
        let snakeIdx = 0;
        Object.entries(SNAKE_LADDERS.snakes).forEach(([start, end]) => {
            const pal = snakePalettes[snakeIdx % snakePalettes.length];
            snakeIdx++;
            const sIdx = parseInt(start) - 1;
            const eIdx = parseInt(end) - 1;
            const sp = getSnakeGridPos(sIdx);
            const ep = getSnakeGridPos(eIdx);
            const x1 = sp.x * cellSize, y1 = sp.y * cellSize;
            const x2 = ep.x * cellSize, y2 = ep.y * cellSize;

            // Undulating S-curve control points
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len, ny = dx / len;
            const off1 = getOffset(sIdx, eIdx, cellSize * 1.5);
            const off2 = getOffset(eIdx, sIdx, cellSize * 1.5);
            const wave = cellSize * 0.5 * ((sIdx * 3 + eIdx * 5) % 7 + 3) / 10;
            const cp1x = x1 + dx * 0.25 + off1 + nx * wave;
            const cp1y = y1 + dy * 0.25 + ny * wave;
            const cp2x = x1 + dx * 0.75 + off2 - nx * wave;
            const cp2y = y1 + dy * 0.75 - ny * wave;

            // Shadow
            ctx.shadowColor = 'rgba(0,0,0,0.30)';
            ctx.shadowBlur = cellSize * 0.18;
            ctx.shadowOffsetX = cellSize * 0.06;
            ctx.shadowOffsetY = cellSize * 0.06;

            // ── BODY: thick, tapered, with per-segment 3D shading ──
            const segs = 28;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let i = 0; i < segs; i++) {
                const t0 = i / segs, t1 = (i + 1) / segs;
                const tMid = (t0 + t1) / 2;
                // Thick at head, thin at tail
                const w = cellSize * (0.26 - 0.18 * tMid);
                const px0 = bezAt(t0, x1, cp1x, cp2x, x2);
                const py0 = bezAt(t0, y1, cp1y, cp2y, y2);
                const px1 = bezAt(t1, x1, cp1x, cp2x, x2);
                const py1 = bezAt(t1, y1, cp1y, cp2y, y2);

                // Per-segment cross gradient for 3D roundness
                const segNx = -(py1 - py0), segNy = (px1 - px0);
                const segLen = Math.sqrt(segNx * segNx + segNy * segNy) || 1;
                const snx = segNx / segLen, sny = segNy / segLen;
                const grd = ctx.createLinearGradient(
                    px0 + snx * w * 0.5, py0 + sny * w * 0.5,
                    px0 - snx * w * 0.5, py0 - sny * w * 0.5
                );
                grd.addColorStop(0, pal.dark);
                grd.addColorStop(0.25, pal.body);
                grd.addColorStop(0.5, pal.light);
                grd.addColorStop(0.75, pal.body);
                grd.addColorStop(1, pal.dark);

                ctx.strokeStyle = grd;
                ctx.lineWidth = w;
                ctx.beginPath();
                ctx.moveTo(px0, py0);
                ctx.lineTo(px1, py1);
                ctx.stroke();

                if (i === 0) ctx.shadowColor = 'transparent';
            }

            // ── HORIZONTAL STRIPE BANDS (like reference image) ──
            for (let t = 0.08; t < 0.92; t += 0.07) {
                const px = bezAt(t, x1, cp1x, cp2x, x2);
                const py = bezAt(t, y1, cp1y, cp2y, y2);
                const w = cellSize * (0.26 - 0.18 * t);
                // Get perpendicular direction for the stripe
                const dt = 0.01;
                const tdx = bezAt(Math.min(t + dt, 1), x1, cp1x, cp2x, x2) - bezAt(Math.max(t - dt, 0), x1, cp1x, cp2x, x2);
                const tdy = bezAt(Math.min(t + dt, 1), y1, cp1y, cp2y, y2) - bezAt(Math.max(t - dt, 0), y1, cp1y, cp2y, y2);
                const tLen2 = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                const pnx = -tdy / tLen2, pny = tdx / tLen2;

                // Draw stripe band across the body
                ctx.strokeStyle = pal.stripe;
                ctx.lineWidth = Math.max(2, cellSize * 0.035);
                ctx.globalAlpha = 0.55;
                ctx.beginPath();
                ctx.moveTo(px + pnx * w * 0.4, py + pny * w * 0.4);
                ctx.lineTo(px - pnx * w * 0.4, py - pny * w * 0.4);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // ── Belly highlight ──
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = pal.light;
            ctx.lineWidth = cellSize * 0.05;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // ── Outline (dark border around body for definition) ──
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = pal.dark;
            ctx.lineWidth = cellSize * 0.28;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
            // Don't actually stroke a big outline — use a thin one
            ctx.globalAlpha = 1;
            ctx.strokeStyle = pal.dark;
            ctx.lineWidth = Math.max(1, cellSize * 0.02);
            ctx.stroke();

            // ── HEAD (big, round, cartoon-style like reference) ──
            const bodyAngle = Math.atan2(cp1y - y1, cp1x - x1);
            const headR = cellSize * 0.22;
            ctx.save();
            ctx.translate(x1, y1);
            ctx.rotate(bodyAngle);

            // Head shape — round/oval, slightly wider than body
            const hGrad = ctx.createRadialGradient(0, 0, headR * 0.1, 0, 0, headR);
            hGrad.addColorStop(0, pal.light);
            hGrad.addColorStop(0.4, pal.body);
            hGrad.addColorStop(1, pal.dark);
            ctx.fillStyle = hGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, headR, headR * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
            // Head outline
            ctx.strokeStyle = pal.dark;
            ctx.lineWidth = Math.max(1.5, cellSize * 0.02);
            ctx.stroke();

            // ── BIG GOOGLY EYES (like reference — large, white, round) ──
            const eyeX = headR * 0.25;
            const eyeY = headR * 0.35;
            const eyeR = cellSize * 0.065;

            // Left eye white
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = Math.max(1, cellSize * 0.012);
            ctx.beginPath(); ctx.arc(eyeX, -eyeY, eyeR, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            // Right eye white
            ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();

            // Big round pupils (looking forward/down)
            const pupilR = eyeR * 0.55;
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(eyeX + eyeR * 0.15, -eyeY + eyeR * 0.1, pupilR, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(eyeX + eyeR * 0.15, eyeY + eyeR * 0.1, pupilR, 0, Math.PI * 2); ctx.fill();

            // Eye glints (large, bright)
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(eyeX + eyeR * 0.05, -eyeY - eyeR * 0.15, eyeR * 0.22, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(eyeX + eyeR * 0.05, eyeY - eyeR * 0.15, eyeR * 0.22, 0, Math.PI * 2); ctx.fill();

            // ── CUTE SMILE / MOUTH ──
            ctx.strokeStyle = pal.dark;
            ctx.lineWidth = Math.max(1.5, cellSize * 0.018);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(headR * 0.4, 0, headR * 0.32, -0.5, 0.5);
            ctx.stroke();

            // ── NOSTRILS ──
            ctx.fillStyle = pal.dark;
            ctx.beginPath(); ctx.arc(headR * 0.8, -headR * 0.12, cellSize * 0.015, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(headR * 0.8, headR * 0.12, cellSize * 0.015, 0, Math.PI * 2); ctx.fill();

            // ── FORKED TONGUE (red, extending from mouth) ──
            const tLen = cellSize * 0.20;
            ctx.strokeStyle = '#e53935';
            ctx.lineWidth = Math.max(1.5, cellSize * 0.02);
            ctx.lineCap = 'round';
            // Tongue stem
            ctx.beginPath();
            ctx.moveTo(headR * 0.9, 0);
            ctx.lineTo(headR * 0.9 + tLen * 0.55, 0);
            ctx.stroke();
            // Left fork
            ctx.beginPath();
            ctx.moveTo(headR * 0.9 + tLen * 0.55, 0);
            ctx.lineTo(headR * 0.9 + tLen, -tLen * 0.22);
            ctx.stroke();
            // Right fork
            ctx.beginPath();
            ctx.moveTo(headR * 0.9 + tLen * 0.55, 0);
            ctx.lineTo(headR * 0.9 + tLen, tLen * 0.22);
            ctx.stroke();

            ctx.restore();

            // ── TAIL TIP (rounded/curled) ──
            const tailAngle = Math.atan2(y2 - cp2y, x2 - cp2x);
            const tailTipLen = cellSize * 0.06;
            ctx.fillStyle = pal.body;
            ctx.beginPath();
            ctx.arc(x2 + Math.cos(tailAngle) * tailTipLen * 0.5, y2 + Math.sin(tailAngle) * tailTipLen * 0.5, cellSize * 0.03, 0, Math.PI * 2);
            ctx.fill();

            // Re-enable shadow for next element
            ctx.shadowColor = 'rgba(0,0,0,0.30)';
            ctx.shadowBlur = cellSize * 0.18;
            ctx.shadowOffsetX = cellSize * 0.06;
            ctx.shadowOffsetY = cellSize * 0.06;
        });

        ctx.restore();
    }

    function drawBoard() {
        const homeSize = SQUARE_SIZE * 6;
        ctx.clearRect(0, 0, boardSize, boardSize);
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(0, 0, boardSize, boardSize);

        for (let i = 0; i < 4; i++) {
            let x, y, grad;
            const corner = cornerPalette(i);
            if (i === 0) { x = 0; y = 0; grad = ctx.createLinearGradient(0, 0, homeSize, homeSize); }
            if (i === 1) { x = boardSize - homeSize; y = 0; grad = ctx.createLinearGradient(x + homeSize, 0, x, homeSize); }
            if (i === 2) { x = boardSize - homeSize; y = boardSize - homeSize; grad = ctx.createLinearGradient(x + homeSize, y + homeSize, x, y); }
            if (i === 3) { x = 0; y = boardSize - homeSize; grad = ctx.createLinearGradient(0, y + homeSize, homeSize, y); }

            grad.addColorStop(0, corner.light);
            grad.addColorStop(1, corner.dark);
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, homeSize, homeSize);

            let w_x, w_y, w_s = homeSize - 2 * SQUARE_SIZE;
            if (i === 0) { w_x = SQUARE_SIZE; w_y = SQUARE_SIZE; }
            if (i === 1) { w_x = boardSize - homeSize + SQUARE_SIZE; w_y = SQUARE_SIZE; }
            if (i === 2) { w_x = boardSize - homeSize + SQUARE_SIZE; w_y = boardSize - homeSize + SQUARE_SIZE; }
            if (i === 3) { w_x = SQUARE_SIZE; w_y = boardSize - homeSize + SQUARE_SIZE; }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(w_x, w_y, w_s, w_s);
        }

        const glossGradient = ctx.createLinearGradient(0, 0, boardSize, boardSize);
        glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        glossGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
        glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0.25)');

        const drawGoldenStroke = (x, y, w, h) => {
            ctx.strokeStyle = '#D4AF37';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 2;
            ctx.lineWidth = 0.2;
            ctx.strokeRect(x, y, w, h);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        };

        for (let i = 0; i < path.length; i++) {
            const pos = path[i];
            const px = pos.x * SQUARE_SIZE;
            const py = pos.y * SQUARE_SIZE;

            let quadrantColor = '#FFFFFF';
            if (pos.y <= 5 && pos.x >= 6 && pos.x <= 8) quadrantColor = cornerPalette(0).faint;
            else if (pos.x >= 9 && pos.y >= 6 && pos.y <= 8) quadrantColor = cornerPalette(1).faint;
            else if (pos.y >= 9 && pos.x >= 6 && pos.x <= 8) quadrantColor = cornerPalette(2).faint;
            else if (pos.x <= 5 && pos.y >= 6 && pos.y <= 8) quadrantColor = cornerPalette(3).faint;

            const grad = ctx.createLinearGradient(px, py, px + SQUARE_SIZE, py + SQUARE_SIZE);
            grad.addColorStop(0, 'white');
            grad.addColorStop(1, quadrantColor);
            ctx.fillStyle = grad;
            ctx.fillRect(px, py, SQUARE_SIZE, SQUARE_SIZE);


            drawGoldenStroke(pos.x * SQUARE_SIZE, pos.y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            if (safeZones.includes(i)) {
                const starX = (pos.x + 0.5) * SQUARE_SIZE;
                const starY = (pos.y + 0.5) * SQUARE_SIZE;
                const starSize = SQUARE_SIZE * 0.6;
                const gradient = ctx.createRadialGradient(starX, starY, starSize * 0.1, starX, starY, starSize * 0.5);
                gradient.addColorStop(0, '#FFD700');
                gradient.addColorStop(1, '#FFA500');
                ctx.font = `${starSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fillText('★', starX + 1, starY + 1);
                ctx.fillStyle = gradient;
                ctx.fillText('★', starX, starY);
            }
        }

        for (let i = 0; i < 4; i++) {
            const hp = cornerPalette(i);
            for (let j = 0; j < 6; j++) {
                const pos = homePaths[i][j];
                const grad = ctx.createLinearGradient(pos.x * SQUARE_SIZE, pos.y * SQUARE_SIZE, (pos.x + 1) * SQUARE_SIZE, (pos.y + 1) * SQUARE_SIZE);
                grad.addColorStop(0, hp.light);
                grad.addColorStop(1, hp.dark);
                ctx.fillStyle = grad;
                ctx.fillRect(pos.x * SQUARE_SIZE, pos.y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
                drawGoldenStroke(pos.x * SQUARE_SIZE, pos.y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            }
        }

        const center_x = boardSize / 2;
        const center_y = boardSize / 2;
        const topLeft = { x: homeSize, y: homeSize };
        const topRight = { x: boardSize - homeSize, y: homeSize };
        const bottomLeft = { x: homeSize, y: boardSize - homeSize };
        const bottomRight = { x: boardSize - homeSize, y: boardSize - homeSize };

        const grad1 = ctx.createLinearGradient(topLeft.x, topLeft.y, center_x, center_y);
        grad1.addColorStop(0, PLAYER_COLORS.p1.light); grad1.addColorStop(1, PLAYER_COLORS.p1.dark);
        ctx.fillStyle = grad1;
        ctx.beginPath(); ctx.moveTo(topLeft.x, topLeft.y); ctx.lineTo(bottomLeft.x, bottomLeft.y); ctx.lineTo(center_x, center_y); ctx.closePath(); ctx.fill();

        const c2 = twoPlayerMode ? INACTIVE_CORNER_COLORS : PLAYER_COLORS.p2;
        const grad2 = ctx.createLinearGradient(topRight.x, topLeft.y, center_x, center_y);
        grad2.addColorStop(0, c2.light); grad2.addColorStop(1, c2.dark);
        ctx.fillStyle = grad2;
        ctx.beginPath(); ctx.moveTo(topLeft.x, topLeft.y); ctx.lineTo(topRight.x, topRight.y); ctx.lineTo(center_x, center_y); ctx.closePath(); ctx.fill();

        const grad3 = ctx.createLinearGradient(topRight.x, bottomRight.y, center_x, center_y);
        grad3.addColorStop(0, PLAYER_COLORS.p3.light); grad3.addColorStop(1, PLAYER_COLORS.p3.dark);
        ctx.fillStyle = grad3;
        ctx.beginPath(); ctx.moveTo(topRight.x, topRight.y); ctx.lineTo(bottomRight.x, bottomRight.y); ctx.lineTo(center_x, center_y); ctx.closePath(); ctx.fill();

        const c4 = twoPlayerMode ? INACTIVE_CORNER_COLORS : PLAYER_COLORS.p4;
        const grad4 = ctx.createLinearGradient(bottomLeft.x, bottomRight.y, center_x, center_y);
        grad4.addColorStop(0, c4.light); grad4.addColorStop(1, c4.dark);
        ctx.fillStyle = grad4;
        ctx.beginPath(); ctx.moveTo(bottomLeft.x, bottomLeft.y); ctx.lineTo(bottomRight.x, bottomRight.y); ctx.lineTo(center_x, center_y); ctx.closePath(); ctx.fill();

        ctx.fillStyle = glossGradient;
        ctx.fillRect(0, 0, boardSize, boardSize);
    }

    function drawTokens() {
        tokens.forEach(token => {
            let x, y;
            const playerColorSet = tokenPalette(token.player);
            if (token.status === 'home') {
                if (gameMode === 'ludo') {
                    const homePos = homePositions[token.player][token.id];
                    x = homePos.x * SQUARE_SIZE;
                    y = homePos.y * SQUARE_SIZE;
                } else {
                    // Snake mode: Start tokens near square 1 (bottom left)
                    const cellSize = boardSize / 10;
                    const pos = getSnakeGridPos(0); // Square 1
                    // Offset slightly so they are visible but "off center"
                    x = (pos.x - 0.25) * cellSize;
                    y = pos.y * cellSize + (token.player - 1.5) * (cellSize * 0.2);
                }
            } else if (token.status === 'active') {
                if (gameMode === 'ludo') {
                    if (token.position > 50) {
                        const homePathPos = homePaths[token.player][token.position - 51];
                        x = (homePathPos.x + 0.5) * SQUARE_SIZE;
                        y = (homePathPos.y + 0.5) * SQUARE_SIZE;
                    } else {
                        const pathPos = path[(token.position + startOffsets[token.player]) % 52];
                        x = (pathPos.x + 0.5) * SQUARE_SIZE;
                        y = (pathPos.y + 0.5) * SQUARE_SIZE;
                    }
                } else {
                    // Snake and Ladders grid
                    const cellSize = boardSize / 10;
                    const pos = getSnakeGridPos(token.position);
                    x = pos.x * cellSize;
                    y = pos.y * cellSize;
                }
            } else if (token.status === 'finished') {
                if (gameMode === 'ludo') {
                    const homePathPos = homePaths[token.player][5];
                    x = (homePathPos.x + 0.5) * SQUARE_SIZE;
                    y = (homePathPos.y + 0.5) * SQUARE_SIZE;
                } else {
                    const cellSize = boardSize / 10;
                    const pos = getSnakeGridPos(99); // Square 100
                    x = pos.x * cellSize;
                    y = pos.y * cellSize;
                }
            }

            // Path animation override — render at pixel position along snake/ladder
            if (pathAnimOverride && pathAnimOverride.token === token) {
                x = pathAnimOverride.x;
                y = pathAnimOverride.y;
            }

            if (x !== undefined) {

                let drawY = y;
                if (movableTokens.includes(token)) {
                    drawY = y - TOKEN_RADIUS * 0.3;
                }

                if (movableTokens.includes(token)) {
                    const pinRadius = TOKEN_RADIUS * 1.2;
                    const pinTipY = drawY + TOKEN_RADIUS * 1.9;
                    ctx.fillStyle = playerColorSet.dark;
                    ctx.globalAlpha = 0.6;
                    ctx.beginPath();
                    ctx.arc(x, drawY, pinRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(x - pinRadius, drawY);
                    ctx.lineTo(x + pinRadius, drawY);
                    ctx.lineTo(x, pinTipY);
                    ctx.closePath();
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                }
                const grad = ctx.createRadialGradient(x - TOKEN_RADIUS * 0.2, drawY - TOKEN_RADIUS * 0.2, TOKEN_RADIUS * 0.1, x, drawY, TOKEN_RADIUS);
                grad.addColorStop(0, playerColorSet.light);
                grad.addColorStop(1, playerColorSet.dark);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, drawY, TOKEN_RADIUS, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    function drawEverything() {
        if (gameMode === 'ludo') {
            drawBoard();
            drawTokens();
        } else {
            drawSnakeBoard();
            drawTokens();
        }
    }

    function updateTurnIndicator() {
        const name = playerNames[currentPlayerIndex] || DEFAULT_PLAYER_NAMES[currentPlayerIndex];
        turnIndicatorEl.textContent = `${name}'s Turn`;
        turnIndicatorEl.style.backgroundColor = PLAYER_CSS_COLORS[currentPlayerIndex];
        syncDiceToActivePlayer();
    }

    function checkForWinner() {
        for (let i = 0; i < 4; i++) {
            if (!isPlayerActive(i)) continue;
            if (!playerRanks.includes(i) && tokens.filter(t => t.player === i).every(t => t.status === 'finished')) return i;
        }
        return -1;
    }

    function handleCanvasClick(event) {
        if (gameState !== 'move') return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (event.clientX - rect.left) * scaleX;
        const clickY = (event.clientY - rect.top) * scaleY;
        let clickedToken = null;
        let closestDistance = TOKEN_RADIUS * 2;

        movableTokens.forEach(token => {
            let tokenX, tokenY;
            if (token.status === 'home') {
                if (gameMode === 'ludo') {
                    const homePos = homePositions[token.player][token.id];
                    tokenX = homePos.x * SQUARE_SIZE;
                    tokenY = homePos.y * SQUARE_SIZE;
                } else {
                    const cellSize = boardSize / 10;
                    const pos = getSnakeGridPos(0);
                    tokenX = (pos.x - 0.25) * cellSize;
                    tokenY = pos.y * cellSize + (token.player - 1.5) * (cellSize * 0.2);
                }
            } else if (token.status === 'active') {
                if (gameMode === 'ludo') {
                    if (token.position > 50) {
                        const homePathPos = homePaths[token.player][token.position - 51];
                        tokenX = (homePathPos.x + 0.5) * SQUARE_SIZE;
                        tokenY = (homePathPos.y + 0.5) * SQUARE_SIZE;
                    } else {
                        const pathPos = path[(token.position + startOffsets[token.player]) % 52];
                        tokenX = (pathPos.x + 0.5) * SQUARE_SIZE;
                        tokenY = (pathPos.y + 0.5) * SQUARE_SIZE;
                    }
                } else {
                    const cellSize = boardSize / 10;
                    const pos = getSnakeGridPos(token.position);
                    tokenX = pos.x * cellSize;
                    tokenY = pos.y * cellSize;
                }
            }
            if (tokenX !== undefined) {
                const distance = Math.sqrt(Math.pow(clickX - tokenX, 2) + Math.pow(clickY - tokenY, 2));
                if (distance < closestDistance) {
                    closestDistance = distance;
                    clickedToken = token;
                }
            }
        });
        if (clickedToken) moveToken(clickedToken);
    }

    let lastBoardSize = 0;
    function handleResize() {
        const controlsHeight = document.querySelector('.controls')?.offsetHeight || 0;
        const headerHeight = document.querySelector('.game-header')?.offsetHeight || 0;

        const totalVerticalSpace = window.innerHeight;
        const nonCanvasHeight = controlsHeight + headerHeight + 50;

        const availableHeight = totalVerticalSpace - nonCanvasHeight;
        const availableWidth = window.innerWidth * 0.95;

        let newBoardSize;
        if (window.matchMedia("(min-width: 800px) and (min-height: 500px)").matches) {
            newBoardSize = Math.max(120, Math.min(window.innerHeight * 0.85, window.innerWidth * 0.6));
        } else {
            newBoardSize = Math.max(120, Math.floor(Math.min(availableWidth, availableHeight)));
        }

        if (newBoardSize === lastBoardSize) return;
        lastBoardSize = newBoardSize;
        boardSize = newBoardSize;

        canvas.style.width = `${boardSize}px`;
        canvas.style.height = `${boardSize}px`;
        canvas.width = boardSize;
        canvas.height = boardSize;
        SQUARE_SIZE = boardSize / 15;
        TOKEN_RADIUS = SQUARE_SIZE * 0.35;
        drawEverything();
    }

    if (diceBox) diceBox.addEventListener('click', handleRollDice);
    function saveAIPref() {
        localStorage.setItem('ludoAIPref', JSON.stringify({ players: computerPlayers, mode: aiMode }));
    }

    function updateAITogglesState() {
        if (twoPlayerMode) {
            // Disable players 2 (Green) and 4 (Blue) UI toggles unconditionally.
            if (aiCheckboxes[1]) {
                aiCheckboxes[1].disabled = true;
                aiCheckboxes[1].checked = false;
                computerPlayers[1] = false;
                document.getElementById('ai-player-1-wrap').style.opacity = '0.5';
            }
            if (aiCheckboxes[3]) {
                aiCheckboxes[3].disabled = true;
                aiCheckboxes[3].checked = false;
                computerPlayers[3] = false;
                document.getElementById('ai-player-3-wrap').style.opacity = '0.5';
            }
        } else {
            if (aiCheckboxes[1]) {
                aiCheckboxes[1].disabled = false;
                document.getElementById('ai-player-1-wrap').style.opacity = '1';
            }
            if (aiCheckboxes[3]) {
                aiCheckboxes[3].disabled = false;
                document.getElementById('ai-player-3-wrap').style.opacity = '1';
            }
        }
        saveAIPref();
    }

    aiCheckboxes.forEach((checkbox, i) => {
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                computerPlayers[i] = e.target.checked;
                saveAIPref();
            });
        }
    });

    if (blockadeCheckbox) {
        blockadeCheckbox.addEventListener('change', (e) => {
            blockadeRuleEnabled = e.target.checked;
            localStorage.setItem('ludoBlockadePref', JSON.stringify(blockadeRuleEnabled));
        });
    }

    if (snakeUnlockCheckbox) {
        snakeUnlockCheckbox.addEventListener('change', (e) => {
            snakeUnlockNumber = e.target.checked ? 6 : 1;
            if (snakeUnlockLabel) snakeUnlockLabel.textContent = `Unlock token with ${snakeUnlockNumber}`;
            localStorage.setItem('ludoSnakeUnlockPref', JSON.stringify(snakeUnlockNumber));
        });
    }

    playerNameInputs.forEach((input, i) => {
        if (input) {
            input.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                playerNames[i] = val || DEFAULT_PLAYER_NAMES[i];
                savePlayerNames();
                syncAILabels();
                updateTurnIndicator();
            });
        }
    });

    if (blockadeCheckbox) {
        blockadeCheckbox.addEventListener('change', (e) => {
            blockadeRuleEnabled = e.target.checked;
            localStorage.setItem('ludoBlockadePref', JSON.stringify(blockadeRuleEnabled));
        });
    }

    if (aiModeCheckbox) {
        aiModeCheckbox.addEventListener('change', (e) => {
            aiMode = e.target.checked ? 'aggressive' : 'balanced';
            if (aiModeLabel) aiModeLabel.textContent = e.target.checked ? 'Aggressive' : 'Balanced';
            saveAIPref();
        });
    }

    if (twoPlayerCheckbox) {
        twoPlayerCheckbox.addEventListener('change', () => {
            twoPlayerMode = twoPlayerCheckbox.checked;
            localStorage.setItem('ludoTwoPlayerPref', JSON.stringify(twoPlayerMode));
            localStorage.removeItem('ludoGameState');
            updateAITogglesState();
            initializeGame();
        });
    }

    if (modeToggleCheckbox) {
        modeToggleCheckbox.addEventListener('change', (e) => {
            gameMode = e.target.checked ? 'snake' : 'ludo';
            updateGameTitle();
            localStorage.setItem('ludoGameMode', gameMode);
            localStorage.removeItem('ludoGameState'); // Reset on mode switch
            initializeGame();
        });
    }
    if (saveBtn) saveBtn.addEventListener('click', saveGame);
    if (resetBtn) resetBtn.addEventListener('click', () => { closeSettings(); resetGame(); });
    if (muteBtn) muteBtn.addEventListener('click', () => toggleMute(!isMuted));
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (settingsClose) settingsClose.addEventListener('click', closeSettings);
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);

    if (singleWinCheckbox) {
        singleWinCheckbox.addEventListener('change', (e) => {
            singleWinMode = e.target.checked;
            localStorage.setItem('ludoSingleWinPref', JSON.stringify(singleWinMode));
        });
    }

    if (gameoverResetBtn) {
        gameoverResetBtn.addEventListener('click', () => {
            resetGame();
        });
    }

    if (getBadgeBtn) {
        getBadgeBtn.addEventListener('click', downloadBadge);
    }

    installClose.addEventListener('click', () => hideInstallBanner(installButton.dataset.mode !== 'update'));
    installButton.addEventListener('click', async () => {
        const mode = installButton.dataset.mode;

        if (mode === 'update') {
            if (swRegistration && swRegistration.waiting) {
                swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            hideInstallBanner();
            return;
        }

        if (mode === 'open') {
            const appUrl = new URL('./', window.location.href).href;
            const openedWindow = window.open(appUrl, '_blank');
            if (!openedWindow) {
                window.location.href = appUrl;
            }
            hideInstallBanner();
            return;
        }

        if (!deferredInstallPrompt) {
            showInstallBanner('install');
            return;
        }

        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;

        if (outcome === 'accepted') {
            hideInstallBanner();
        } else {
            showInstallBanner('install');
        }
    });
    canvas.addEventListener('click', handleCanvasClick);
    window.addEventListener('resize', handleResize);

    window.addEventListener('keydown', (e) => {
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
            if (e.key === 'Escape') closeSettings();
            return;
        }
        if (gameoverModal && !gameoverModal.classList.contains('hidden')) {
            if (e.key === 'Escape') hideGameOver();
            return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === '5') {
            if (e.key === ' ') e.preventDefault();
            handleRollDice();
        }
    });

    let swRegistration = null;

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => {
                    swRegistration = reg;
                    console.log('Service Worker: Registered');

                    if (reg.waiting) {
                        handleSWUpdate(reg);
                    }

                    reg.onupdatefound = () => {
                        const newWorker = reg.installing;
                        newWorker.onstatechange = () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                handleSWUpdate(reg);
                            }
                        };
                    };
                })
                .catch(err => console.error('Service Worker: Registration Failed: ', err));
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }

    function handleSWUpdate(reg) {
        if (isGoodConnection()) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
            showInstallBanner('update');
        }
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        scheduleInstallBanner(3200);
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        installedKnown = true;
        localStorage.setItem(installStateKey, 'true');
        updateInstallButtonState();
        hideInstallBanner();
    });

    splashScreen.addEventListener('transitionend', () => {
        splashScreen.classList.add('hidden');
        document.body.style.overflow = 'auto';

        gameWrapper.classList.remove('hidden');

        const savedSoundSetting = JSON.parse(localStorage.getItem('ludoSoundSetting'));
        toggleMute(savedSoundSetting ? savedSoundSetting.muted : false);

        const savedGameState = JSON.parse(localStorage.getItem('ludoGameState'));

        const modePref = localStorage.getItem('ludoGameMode');
        if (modePref) {
            gameMode = modePref;
        } else if (savedGameState && savedGameState.gameMode) {
            gameMode = savedGameState.gameMode;
        }

        if (modeToggleCheckbox) modeToggleCheckbox.checked = (gameMode === 'snake');
        updateGameTitle();

        const prefRaw = localStorage.getItem('ludoTwoPlayerPref');
        if (prefRaw !== null) {
            try {
                twoPlayerMode = JSON.parse(prefRaw);
                if (twoPlayerCheckbox) twoPlayerCheckbox.checked = twoPlayerMode;
            } catch (e) { /* ignore */ }
        }

        const aiPrefRaw = localStorage.getItem('ludoAIPref');
        if (aiPrefRaw !== null) {
            try {
                const config = JSON.parse(aiPrefRaw);
                computerPlayers = config.players || [false, false, false, false];
                aiMode = config.mode || 'balanced';
                for (let i = 0; i < 4; i++) {
                    if (aiCheckboxes[i]) aiCheckboxes[i].checked = computerPlayers[i];
                }
                if (aiModeCheckbox) {
                    aiModeCheckbox.checked = (aiMode === 'aggressive');
                    if (aiModeLabel) aiModeLabel.textContent = aiMode === 'aggressive' ? 'Aggressive' : 'Balanced';
                }
            } catch (e) { /* ignore */ }
        }
        updateAITogglesState();

        const blockadePrefRaw = localStorage.getItem('ludoBlockadePref');
        if (blockadePrefRaw !== null) {
            try {
                blockadeRuleEnabled = JSON.parse(blockadePrefRaw);
                if (blockadeCheckbox) blockadeCheckbox.checked = blockadeRuleEnabled;
            } catch (e) { /* ignore */ }
        }

        const snakeUnlockPref = localStorage.getItem('ludoSnakeUnlockPref');
        if (snakeUnlockPref !== null) {
            try {
                snakeUnlockNumber = JSON.parse(snakeUnlockPref);
                if (snakeUnlockCheckbox) snakeUnlockCheckbox.checked = (snakeUnlockNumber === 6);
                if (snakeUnlockLabel) snakeUnlockLabel.textContent = `Unlock token with ${snakeUnlockNumber}`;
            } catch (e) { /* ignore */ }
        }

        const singleWinPrefRaw = localStorage.getItem('ludoSingleWinPref');
        if (singleWinPrefRaw !== null) {
            try {
                singleWinMode = JSON.parse(singleWinPrefRaw);
                if (singleWinCheckbox) singleWinCheckbox.checked = singleWinMode;
            } catch (e) { /* ignore */ }
        }

        const namePrefRaw = localStorage.getItem('ludoPlayerNames');
        if (namePrefRaw !== null) {
            try {
                playerNames = JSON.parse(namePrefRaw);
                playerNames.forEach((name, i) => {
                    if (playerNameInputs[i]) playerNameInputs[i].value = (name !== DEFAULT_PLAYER_NAMES[i]) ? name : '';
                });
                syncAILabels();
            } catch (e) { /* ignore */ }
        }

        if (!loadGame()) {
            initializeGame();
        }

        requestAnimationFrame(() => {
            handleResize();
            requestAnimationFrame(handleResize);
        });

        refreshInstalledState().finally(() => {
            scheduleInstallBanner(500);
        });
    }, { once: true });

    setTimeout(() => {
        splashScreen.style.opacity = '0';
    }, 3000);
});
