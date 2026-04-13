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
    
    const aiCheckboxes = [
        document.getElementById('ai-player-0'),
        document.getElementById('ai-player-1'),
        document.getElementById('ai-player-2'),
        document.getElementById('ai-player-3')
    ];
    const aiModeCheckbox = document.getElementById('ai-mode-checkbox');
    const aiModeLabel = document.getElementById('ai-mode-label');
    const blockadeCheckbox = document.getElementById('blockade-checkbox');
    const singleWinCheckbox = document.getElementById('single-win-checkbox');
    const gameoverModal = document.getElementById('gameover-modal');
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
        switch(sound) {
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
            ctx.fillText('LUDO UNIVERSE', 540, 390);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '38px sans-serif';
            ctx.fillText('Official Victory Certificate', 540, 440);

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
            link.download = 'Ludo_Universe_Badge.png';
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
        [{x: 1, y: 7}, {x: 2, y: 7}, {x: 3, y: 7}, {x: 4, y: 7}, {x: 5, y: 7}, {x: 6, y: 7}],
        [{x: 7, y: 1}, {x: 7, y: 2}, {x: 7, y: 3}, {x: 7, y: 4}, {x: 7, y: 5}, {x: 7, y: 6}],
        [{x: 13, y: 7}, {x: 12, y: 7}, {x: 11, y: 7}, {x: 10, y: 7}, {x: 9, y: 7}, {x: 8, y: 7}],
        [{x: 7, y: 13}, {x: 7, y: 12}, {x: 7, y: 11}, {x: 7, y: 10}, {x: 7, y: 9}, {x: 7, y: 8}]
    ];
    
    const startOffsets = [0, 13, 26, 39];
    const safeZones = [0, 8, 13, 21, 26, 34, 39, 47];

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
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                tokens.push({ player: i, id: j, position: -1, status: 'home' });
            }
        }
        fillAndShuffleDiceBag();
        currentPlayerIndex = 0;
        gameState = 'roll';
        isGameSaved = true;
        playerRanks = [];
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
            twoPlayerMode: twoPlayerMode
        };
        localStorage.setItem('ludoGameState', JSON.stringify(gameStateToSave));
        isGameSaved = true;
        gameMessageEl.textContent = "Game Saved!";
        setTimeout(() => {
            if(gameState === 'roll') gameMessageEl.textContent = 'Roll the dice!';
            else if (gameState === 'move') gameMessageEl.textContent = 'Click a highlighted token to move.';
        }, 2000);
    }

    function loadGame() {
        try {
            const savedRaw = localStorage.getItem('ludoGameState');
            if (!savedRaw) return false;
            
            const savedState = JSON.parse(savedRaw);
            if (!savedState || !Array.isArray(savedState.tokens) || savedState.tokens.length < 16) {
                console.warn('Ludo: Saved state is invalid or incomplete. Initializing fresh game.');
                return false;
            }

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
        const playerTokens = tokens.filter(t => t.player === currentPlayerIndex);
        playerTokens.forEach(token => {
            if ((token.status === 'home' && diceRoll === 6) || (token.status === 'active' && token.position + diceRoll <= 56)) {
                movableTokens.push(token);
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
                    const best = window.LudoAI.getBestMove(movableTokens, tokens, currentPlayerIndex, diceRoll, aiMode, blockadeRuleEnabled);
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
        if (token.status === 'home' && diceRoll === 6) {
            token.status = 'active';
            token.position = 0;
            drawEverything();
            playSound('move');
            finalizeMove(token);
        } else {
            animateTokenMove(token, diceRoll);
        }
    }

    function animateTokenMove(token, stepsLeft) {
        if (stepsLeft <= 0) {
            finalizeMove(token);
            return;
        }
        token.position++;
        playSound('move');
        drawEverything();
        setTimeout(() => animateTokenMove(token, stepsLeft - 1), 350);
    }

    function finalizeMove(token) {
        if (token.position === 56) {
            token.status = 'finished';
            tokenFinishedThisTurn = true;
            playSound('finish');
        }
        checkForCapture(token);
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
        } else if (diceRoll === 6 || captureMadeThisTurn || tokenFinishedThisTurn) {
            gameState = 'roll';
            if (diceBox) diceBox.style.cursor = 'pointer';
            if (tokenFinishedThisTurn) gameMessageEl.textContent = 'Token is home! Roll again.';
            else if (captureMadeThisTurn) gameMessageEl.textContent = 'You captured a token! Roll again.';
            else gameMessageEl.textContent = 'You rolled a 6! Roll again.';

            if (computerPlayers[currentPlayerIndex]) {
                if (diceBox) diceBox.style.cursor = 'not-allowed';
                setTimeout(() => {
                    if (gameState === 'roll') handleRollDice();
                }, 800);
            }
        } else {
            switchPlayer();
        }
        drawEverything();
    }
    
    function checkForCapture(movedToken) {
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


    function drawBoard() {
        const homeSize = SQUARE_SIZE * 6;
        ctx.clearRect(0, 0, boardSize, boardSize);
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(0,0, boardSize, boardSize);
        
        for (let i = 0; i < 4; i++) {
            let x, y, grad;
            const corner = cornerPalette(i);
            if (i === 0) { x = 0; y = 0; grad = ctx.createLinearGradient(0,0, homeSize, homeSize); }
            if (i === 1) { x = boardSize - homeSize; y = 0; grad = ctx.createLinearGradient(x + homeSize, 0, x, homeSize); }
            if (i === 2) { x = boardSize - homeSize; y = boardSize - homeSize; grad = ctx.createLinearGradient(x + homeSize, y + homeSize, x, y); }
            if (i === 3) { x = 0; y = boardSize - homeSize; grad = ctx.createLinearGradient(0, y + homeSize, homeSize, y); }
            
            grad.addColorStop(0, corner.light);
            grad.addColorStop(1, corner.dark);
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, homeSize, homeSize);
            
            let w_x, w_y, w_s = homeSize - 2*SQUARE_SIZE;
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

        for(let i=0; i < path.length; i++) {
            const pos = path[i];
            const px = pos.x * SQUARE_SIZE;
            const py = pos.y * SQUARE_SIZE;
            
            let quadrantColor = '#FFFFFF';
            if(pos.y <=5 && pos.x >=6 && pos.x <= 8) quadrantColor = cornerPalette(0).faint;
            else if (pos.x >=9 && pos.y >=6 && pos.y <= 8) quadrantColor = cornerPalette(1).faint;
            else if (pos.y >=9 && pos.x >=6 && pos.x <= 8) quadrantColor = cornerPalette(2).faint;
            else if (pos.x <=5 && pos.y >=6 && pos.y <= 8) quadrantColor = cornerPalette(3).faint;

            const grad = ctx.createLinearGradient(px, py, px + SQUARE_SIZE, py + SQUARE_SIZE);
            grad.addColorStop(0, 'white');
            grad.addColorStop(1, quadrantColor);
            ctx.fillStyle = grad;
            ctx.fillRect(px, py, SQUARE_SIZE, SQUARE_SIZE);


            drawGoldenStroke(pos.x * SQUARE_SIZE, pos.y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            if(safeZones.includes(i)) {
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
                const grad = ctx.createLinearGradient(pos.x*SQUARE_SIZE, pos.y*SQUARE_SIZE, (pos.x+1)*SQUARE_SIZE, (pos.y+1)*SQUARE_SIZE);
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
                const homePos = homePositions[token.player][token.id];
                x = homePos.x * SQUARE_SIZE;
                y = homePos.y * SQUARE_SIZE;
            } else if (token.status === 'active') {
                if (token.position > 50) {
                    const homePathPos = homePaths[token.player][token.position - 51];
                    x = (homePathPos.x + 0.5) * SQUARE_SIZE;
                    y = (homePathPos.y + 0.5) * SQUARE_SIZE;
                } else {
                    const pathPos = path[(token.position + startOffsets[token.player]) % 52];
                    x = (pathPos.x + 0.5) * SQUARE_SIZE;
                    y = (pathPos.y + 0.5) * SQUARE_SIZE;
                }
            } else if (token.status === 'finished') {
                const homePathPos = homePaths[token.player][5];
                 x = (homePathPos.x + 0.5) * SQUARE_SIZE;
                 y = (homePathPos.y + 0.5) * SQUARE_SIZE;
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
        drawBoard();
        drawTokens();
    }

    function updateTurnIndicator() {
        const name = playerNames[currentPlayerIndex] || DEFAULT_PLAYER_NAMES[currentPlayerIndex];
        turnIndicatorEl.textContent = `${name}'s Turn`;
        turnIndicatorEl.style.backgroundColor = PLAYER_CSS_COLORS[currentPlayerIndex];
        syncDiceToActivePlayer();
    }
    
    function checkForWinner() {
        for(let i=0; i<4; i++) {
            if (!isPlayerActive(i)) continue;
            if(!playerRanks.includes(i) && tokens.filter(t => t.player === i).every(t => t.status === 'finished')) return i;
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
                const homePos = homePositions[token.player][token.id];
                tokenX = homePos.x * SQUARE_SIZE;
                tokenY = homePos.y * SQUARE_SIZE;
            } else if(token.status === 'active') {
                 if (token.position > 50) {
                    const homePathPos = homePaths[token.player][token.position - 51];
                    tokenX = (homePathPos.x + 0.5) * SQUARE_SIZE;
                    tokenY = (homePathPos.y + 0.5) * SQUARE_SIZE;
                 } else {
                    const pathPos = path[(token.position + startOffsets[token.player]) % 52];
                    tokenX = (pathPos.x + 0.5) * SQUARE_SIZE;
                    tokenY = (pathPos.y + 0.5) * SQUARE_SIZE;
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
