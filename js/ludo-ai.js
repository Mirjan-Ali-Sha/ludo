/**
 * Ludo Universe - AI Brain
 * Contains heuristic scoring logic to choose the best token to move.
 */

window.LudoAI = {
    // Safe zone indices on the common path (0 to 51)
    safeZones: [0, 8, 13, 21, 26, 34, 39, 47],
    
    /**
     * Determines the best token to move based on heuristics and selected personality.
     * @param {Array} movableTokens - Tokens that can legally move this turn.
     * @param {Array} allTokens - The global state of all tokens on the board.
     * @param {number} currentPlayerIndex - The ID of the computer player.
     * @param {number} diceRoll - The value rolled.
     * @param {string} aiMode - 'aggressive' or 'balanced'.
     * @returns {Object|null} The best token to move.
     */
    getBestMove: function(movableTokens, allTokens, currentPlayerIndex, diceRoll, aiMode = 'balanced', blockadeRuleEnabled = false) {
        if (!movableTokens || movableTokens.length === 0) return null;
        if (movableTokens.length === 1) return movableTokens[0];
        
        let bestToken = null;
        let bestScore = -Infinity;
        
        for (const token of movableTokens) {
            let score = 0;
            const newPos = token.status === 'home' ? 0 : token.position + diceRoll;
            
            // 1. Exiting Home Base
            if (token.status === 'home') {
                score += 50; 
                if (aiMode === 'balanced') {
                    // Balanced AI prioritizes getting all tokens out on the board
                    score += 25; 
                }
            }
            
            // 2. Entering or Progressing in the Home Stretch
            if (newPos === 56) {
                // Guaranteed completion of a token is highly prioritized
                score += 150; 
            } else if (newPos > 51) {
                // Progressing towards the center inside the colored path
                score += 30 + (newPos * 2); 
            }
            
            // 3. Captures and Safe Zones (Only applies to common path 0-51)
            if (newPos >= 0 && newPos <= 51) {
                const globalPos = this.getGlobalPosition(currentPlayerIndex, newPos);
                const isSafe = this.safeZones.includes(globalPos);
                
                let willCapture = false;
                if (!isSafe) {
                    for (const other of allTokens) {
                        // Is this an active enemy token on the same global spot?
                        if (other.player !== currentPlayerIndex && other.status === 'active' && other.position <= 51) {
                            const otherGlobalPos = this.getGlobalPosition(other.player, other.position);
                            if (globalPos === otherGlobalPos) {
                                let invincible = false;
                                if (blockadeRuleEnabled) {
                                    const enemyCount = allTokens.filter(t => 
                                        t.player === other.player && t.status === 'active' && t.position <= 51 &&
                                        this.getGlobalPosition(t.player, t.position) === otherGlobalPos
                                    ).length;
                                    if (enemyCount >= 2) invincible = true;
                                }

                                if (!invincible) {
                                    willCapture = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Scoring a Capture
                if (willCapture) {
                    // Aggressive AI prioritizes kills over almost anything else
                    score += (aiMode === 'aggressive') ? 200 : 90;
                }
                
                // Scoring Landing on a Safe Zone
                if (isSafe && token.status !== 'home') {
                    score += 40;
                }
                
                // Fleeing Danger: Check if the token currently is threatened
                // (This adds logic to protect pieces if balanced)
                if (token.status === 'active' && aiMode === 'balanced') {
                    // Very rudimentary danger check: Are there enemies 1-6 spaces behind?
                    const currentGlobalPos = this.getGlobalPosition(currentPlayerIndex, token.position);
                    if (!this.safeZones.includes(currentGlobalPos)) {
                        for (const other of allTokens) {
                            if (other.player !== currentPlayerIndex && other.status === 'active' && other.position <= 51) {
                                const otherGlobalPos = this.getGlobalPosition(other.player, other.position);
                                const dist = (currentGlobalPos - otherGlobalPos + 52) % 52;
                                if (dist >= 1 && dist <= 6) {
                                    // Moving this threatened token escapes danger
                                    score += 35;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            // 4. General Progress Weighting
            // Helps prevent tokens from sitting idly; favor moving those further down the track
            if (token.status === 'active') {
                // Base progress score (0 to ~50)
                score += token.position;
            }
            
            // Random jitter to tie-break equivalent moves unpredictably
            score += Math.random() * 2;
            
            if (score > bestScore) {
                bestScore = score;
                bestToken = token;
            }
        }
        
        return bestToken;
    },
    
    /**
     * Converts a player-relative position (0-51) to an absolute board position (0-51).
     */
    getGlobalPosition: function(playerIndex, relativePos) {
        if (relativePos < 0 || relativePos > 51) return -1;
        const startOffsets = [0, 13, 26, 39];
        return (relativePos + startOffsets[playerIndex]) % 52;
    }
};
