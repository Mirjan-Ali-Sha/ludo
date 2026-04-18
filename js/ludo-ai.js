/**
 * Ludo Universe - AI Brain
 * Contains heuristic scoring logic to choose the best token to move.
 */

window.LudoAI = {
    // Safe zone indices on the common path (0 to 51)
    safeZones: [0, 8, 13, 21, 26, 34, 39, 47],
    
    /**
     * Determines the best token to move based on heuristics and selected personality.
     */
    getBestMove: function(movableTokens, allTokens, currentPlayerIndex, diceRoll, aiMode = 'balanced', blockadeRuleEnabled = false, gameMode = 'ludo') {
        if (!movableTokens || movableTokens.length === 0) return null;
        if (movableTokens.length === 1) return movableTokens[0];
        
        let bestToken = null;
        let bestScore = -Infinity;
        
        for (const token of movableTokens) {
            let score = 0;
            
            if (gameMode === 'snake') {
                const newPos = token.status === 'home' ? 0 : token.position + diceRoll;
                
                // Snake and Ladders Heuristics
                if (newPos === 99) {
                    score += 500; // Finish is best
                }
                
                // Progress is good
                score += newPos;

                // Entering the board from home is a high priority (especially since it gives a bonus turn on 1)
                if (token.status === 'home') {
                    score += 100;
                }

                // Random jitter to keep it moving
                score += Math.random() * 5;

            } else {
                // Ludo Heuristics
                const newPos = token.status === 'home' ? 0 : token.position + diceRoll;
                
                // 1. Exiting Home Base
                if (token.status === 'home') {
                    score += 50; 
                    if (aiMode === 'balanced') {
                        score += 25; 
                    }
                }
                
                // 2. Entering or Progressing in the Home Stretch
                if (newPos === 56) {
                    score += 150; 
                } else if (newPos > 51) {
                    score += 30 + (newPos * 2); 
                }
                
                // 3. Captures and Safe Zones
                if (newPos >= 0 && newPos <= 51) {
                    const globalPos = this.getGlobalPosition(currentPlayerIndex, newPos);
                    const isSafe = this.safeZones.includes(globalPos);
                    
                    let willCapture = false;
                    if (!isSafe) {
                        for (const other of allTokens) {
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
                    
                    if (willCapture) {
                        score += (aiMode === 'aggressive') ? 200 : 90;
                    }
                    
                    if (isSafe && token.status !== 'home') {
                        score += 40;
                    }
                    
                    // Fleeing Danger
                    if (token.status === 'active' && aiMode === 'balanced') {
                        const currentGlobalPos = this.getGlobalPosition(currentPlayerIndex, token.position);
                        if (!this.safeZones.includes(currentGlobalPos)) {
                            for (const other of allTokens) {
                                if (other.player !== currentPlayerIndex && other.status === 'active' && other.position <= 51) {
                                    const otherGlobalPos = this.getGlobalPosition(other.player, other.position);
                                    const dist = (currentGlobalPos - otherGlobalPos + 52) % 52;
                                    if (dist >= 1 && dist <= 6) {
                                        score += 35;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                
                // 4. General Progress
                if (token.status === 'active') {
                    score += token.position;
                }
                
                score += Math.random() * 2;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestToken = token;
            }
        }
        
        return bestToken;
    },
    
    getGlobalPosition: function(playerIndex, relativePos) {
        if (relativePos < 0 || relativePos > 51) return -1;
        const startOffsets = [0, 13, 26, 39];
        return (relativePos + startOffsets[playerIndex]) % 52;
    }
};
