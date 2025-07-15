class CodenamesDuetApp {
    constructor() {
        this.gameId = 'default';
        this.gameState = null;
        // Use the worker URL directly for API calls
        this.apiBase = 'https://codenames-duet-worker.oluwasanya-awe.workers.dev/api';
        this.wsUrl = 'wss://codenames-duet-worker.oluwasanya-awe.workers.dev/api/game/';
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.playerName = '';
        this.theme = 'green';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkForGameCode();
        this.loadGameState();
    }
    
    checkForGameCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameCode = urlParams.get('code');
        if (gameCode) {
            this.joinGameByCode(gameCode);
        }
    }

    setupEventListeners() {
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('show-clue-input-btn').addEventListener('click', () => this.showClueInput());
        document.getElementById('give-clue-btn').addEventListener('click', () => this.giveClue());
        document.getElementById('cancel-clue-btn').addEventListener('click', () => this.hideClueInput());
        document.getElementById('end-turn-btn').addEventListener('click', () => this.endTurn());
        document.getElementById('share-game-btn').addEventListener('click', () => this.shareGame());
        document.getElementById('join-game-btn').addEventListener('click', () => this.showJoinGameInput());
        document.getElementById('join-by-code-btn').addEventListener('click', () => this.joinGameByCodeInput());
        document.getElementById('cancel-join-btn').addEventListener('click', () => this.hideJoinGameInput());
        document.getElementById('copy-code-btn').addEventListener('click', () => this.copyGameCode());
        document.getElementById('copy-link-btn').addEventListener('click', () => this.copyShareLink());
        document.getElementById('player-name').addEventListener('change', () => this.updatePlayerName());
        document.getElementById('theme-select').addEventListener('change', () => this.updateTheme());
        
        // Load saved preferences
        this.loadPreferences();
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        let url;
        if (endpoint.includes('?')) {
            url = `${this.apiBase}${endpoint}`;
        } else {
            url = `${this.apiBase}${endpoint}?gameId=${this.gameId}`;
        }
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    async loadGameState() {
        try {
            this.gameState = await this.apiCall('/game/state');
            this.updateUI();
        } catch (error) {
            console.error('Error loading game state:', error);
            // Create new game if state loading fails
            this.newGame();
        }
    }

    async newGame() {
        try {
            this.disconnectWebSocket();
            // Use the new create endpoint that generates a game code
            this.gameState = await this.apiCall('/game/create', 'POST');
            if (this.gameState.gameCode) {
                this.gameId = this.gameState.gameCode;
                this.connectWebSocket();
            }
            this.updateUI();
        } catch (error) {
            console.error('Error creating new game:', error);
            alert('Error creating new game. Please refresh the page.');
        }
    }

    async giveClue() {
        const clueWord = document.getElementById('clue-word').value.trim();
        const clueNumber = document.getElementById('clue-number').value;

        if (!clueWord || !clueNumber) {
            alert('Please enter both a clue word and number');
            return;
        }

        // Client-side validation
        if (!/^[a-zA-Z]+$/.test(clueWord)) {
            alert('Clue word must contain only letters');
            return;
        }

        if (clueWord.length > 50 || clueWord.length < 1) {
            alert('Clue word must be between 1 and 50 characters');
            return;
        }

        const number = parseInt(clueNumber);
        if (isNaN(number) || number < 1 || number > 5) {
            alert('Number must be between 1 and 5');
            return;
        }

        try {
            const result = await this.apiCall('/game/clue', 'POST', {
                clue: clueWord,
                number: number
            });
            
            // Check for Easter eggs
            this.checkEasterEggs(clueWord);

            if (result.success) {
                this.gameState = result.gameState;
                this.updateUI();
                this.hideClueInput();
            } else {
                alert(result.message);
            }
        } catch (error) {
            alert('Error giving clue: ' + error.message);
        }
    }

    async makeGuess(row, col) {
        if (this.gameState.guessesLeft <= 0) {
            return;
        }

        try {
            const result = await this.apiCall('/game/guess', 'POST', { row, col });

            if (result.success) {
                this.gameState = result.gameState;
                this.updateUI();

                if (result.gameOver) {
                    this.showGameOverMessage(result.won);
                }
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error making guess:', error);
        }
    }

    async endTurn() {
        try {
            this.gameState = await this.apiCall('/game/end-turn', 'POST');
            this.updateUI();
        } catch (error) {
            console.error('Error ending turn:', error);
        }
    }

    showClueInput() {
        document.getElementById('clue-input').classList.remove('hidden');
        document.getElementById('show-clue-input-btn').classList.add('hidden');
        document.getElementById('clue-word').focus();
    }

    hideClueInput() {
        document.getElementById('clue-input').classList.add('hidden');
        document.getElementById('show-clue-input-btn').classList.remove('hidden');
        document.getElementById('clue-word').value = '';
        document.getElementById('clue-number').value = '';
    }

    updateUI() {
        if (!this.gameState) return;

        // Update player info with personalization
        const currentPlayerText = this.playerName 
            ? `${this.playerName}'s Turn` 
            : `Player ${this.gameState.currentPlayer}'s Turn`;
        document.getElementById('current-player').textContent = currentPlayerText;
        document.getElementById('moves-left').textContent = `Moves: ${this.gameState.moves}/${this.gameState.maxMoves}`;

        // Update player count and game code info
        if (this.gameState.playerCount !== undefined) {
            this.updatePlayerCount(this.gameState.playerCount);
        }
        
        // Show/hide game code display and share button
        const gameCodeDisplay = document.getElementById('game-code-display');
        const shareBtn = document.getElementById('share-game-btn');
        if (this.gameState.gameCode) {
            this.showGameCode(this.gameState.gameCode);
            shareBtn.classList.remove('hidden');
            shareBtn.title = `Game Code: ${this.gameState.gameCode}`;
        } else {
            gameCodeDisplay.classList.add('hidden');
            shareBtn.classList.add('hidden');
        }

        // Update clue info
        const clueText = this.gameState.clue 
            ? `${this.gameState.clue.word} (${this.gameState.clue.number})`
            : 'No clue given';
        document.getElementById('clue-text').textContent = clueText;

        const guessesText = this.gameState.guessesLeft > 0 
            ? `Guesses left: ${this.gameState.guessesLeft}`
            : '';
        document.getElementById('guesses-left').textContent = guessesText;

        // Update button visibility
        const canGiveClue = this.gameState.guessesLeft === 0 && !this.gameState.gameOver;
        const canEndTurn = this.gameState.guessesLeft > 0 && !this.gameState.gameOver;

        document.getElementById('show-clue-input-btn').classList.toggle('hidden', !canGiveClue);
        document.getElementById('end-turn-btn').classList.toggle('hidden', !canEndTurn);

        // Update board
        this.updateBoard();

        // Update game status
        this.updateGameStatus();
    }

    updateBoard() {
        const board = document.getElementById('game-board');
        board.innerHTML = '';

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const card = this.gameState.board[row][col];
                const cardElement = document.createElement('div');
                cardElement.className = 'card';
                cardElement.textContent = card.word;

                if (card.revealed) {
                    cardElement.classList.add('revealed');
                    cardElement.classList.add(card.type);
                } else if (!this.gameState.gameOver) {
                    cardElement.addEventListener('click', () => this.makeGuess(row, col));
                }

                board.appendChild(cardElement);
            }
        }
    }

    updateGameStatus() {
        const winMessage = document.getElementById('win-message');
        const loseMessage = document.getElementById('lose-message');
        const timeoutMessage = document.getElementById('timeout-message');

        // Hide all messages first
        winMessage.classList.add('hidden');
        loseMessage.classList.add('hidden');
        timeoutMessage.classList.add('hidden');

        if (this.gameState.gameOver) {
            if (this.gameState.won) {
                winMessage.classList.remove('hidden');
            } else if (this.gameState.moves >= this.gameState.maxMoves) {
                timeoutMessage.classList.remove('hidden');
            } else {
                loseMessage.classList.remove('hidden');
            }
        }
    }

    showGameOverMessage(won) {
        setTimeout(() => {
            if (won) {
                alert('Congratulations! You found all the green cards! 🎉');
            } else {
                alert('Game Over! Better luck next time! 💚');
            }
        }, 500);
    }
    
    checkEasterEggs(clueWord) {
        const word = clueWord.toLowerCase();
        const easterEggs = {
            'tbaby': '💚 T Baby is the best teammate ever! 💚',
            't baby': '💚 T Baby is the best teammate ever! 💚',
            'tfunds': '💰 T Funds bringing the financial wisdom! 💰',
            't funds': '💰 T Funds bringing the financial wisdom! 💰',
            'tomisin': '👑 Queen Tomisin graces us with her presence! 👑',
            'baby': '🍼 Such a sweet clue! 🍼',
            'love': '💕 Love is in the air! 💕',
            'heart': '❤️ My heart skips a beat! ❤️',
            'beautiful': '🌸 Just like someone I know! 🌸',
            'queen': '👸 Yes, your majesty! 👸',
            'princess': '🏰 Princess vibes! 🏰',
            'angel': '😇 Heavenly clue! 😇',
            'sunshine': '☀️ You brighten my day! ☀️',
            'star': '⭐ You\'re my shining star! ⭐',
            'gem': '💎 Precious like a gem! 💎',
            'treasure': '🏆 The real treasure is playing with you! 🏆'
        };
        
        if (easterEggs[word]) {
            this.showEasterEgg(easterEggs[word]);
        }
    }
    
    showEasterEgg(message) {
        const easterEggDiv = document.createElement('div');
        easterEggDiv.className = 'easter-egg';
        easterEggDiv.textContent = message;
        document.body.appendChild(easterEggDiv);
        
        setTimeout(() => {
            easterEggDiv.remove();
        }, 3000);
    }
    
    connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }
        
        const wsUrl = `${this.wsUrl}?gameId=${this.gameId}`;
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
        };
        
        this.websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
        };
        
        this.websocket.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus(false);
            this.attemptReconnect();
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    disconnectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                console.log(`Reconnection attempt ${this.reconnectAttempts}`);
                this.connectWebSocket();
            }, 1000 * this.reconnectAttempts);
        }
    }
    
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'connected':
                this.gameState = message.gameState;
                this.updateUI();
                break;
            case 'gameStateUpdate':
            case 'clueGiven':
            case 'guessMade':
            case 'turnEnded':
                this.gameState = message.gameState;
                this.updateUI();
                if (message.type === 'clueGiven') {
                    this.showNotification(`Clue given: ${message.clue} (${message.number})`);
                } else if (message.type === 'guessMade') {
                    this.showNotification(`Card revealed: ${message.result}`);
                }
                break;
            case 'playerJoined':
                this.showNotification('A player joined the game!');
                this.updatePlayerCount(message.playerCount);
                break;
            case 'playerLeft':
                this.showNotification('A player left the game.');
                this.updatePlayerCount(message.playerCount);
                break;
        }
    }
    
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.className = connected ? 'connected' : 'disconnected';
        }
    }
    
    updatePlayerCount(count) {
        const countElement = document.getElementById('player-count');
        if (countElement) {
            countElement.textContent = `Players: ${count}`;
        }
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }
    
    async shareGame() {
        if (!this.gameState?.gameCode) {
            alert('No active game to share!');
            return;
        }
        
        const gameUrl = `${window.location.origin}${window.location.pathname}?code=${this.gameState.gameCode}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Codenames Duet Game',
                    text: `Join my Codenames Duet game with code: ${this.gameState.gameCode}`,
                    url: gameUrl
                });
            } catch (error) {
                console.log('Share failed:', error);
                this.copyToClipboard(gameUrl);
            }
        } else {
            this.copyToClipboard(gameUrl);
        }
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Game link copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Game link copied to clipboard!');
        });
    }
    
    showJoinGameInput() {
        document.getElementById('join-game-input').classList.remove('hidden');
        document.getElementById('join-game-btn').classList.add('hidden');
        document.getElementById('game-code-input').focus();
    }
    
    hideJoinGameInput() {
        document.getElementById('join-game-input').classList.add('hidden');
        document.getElementById('join-game-btn').classList.remove('hidden');
        document.getElementById('game-code-input').value = '';
    }
    
    async joinGameByCodeInput() {
        const gameCode = document.getElementById('game-code-input').value.trim().toUpperCase();
        if (!gameCode || gameCode.length !== 6) {
            alert('Please enter a valid 6-character game code');
            return;
        }
        
        await this.joinGameByCode(gameCode);
        this.hideJoinGameInput();
    }
    
    async joinGameByCode(gameCode) {
        try {
            this.disconnectWebSocket();
            const response = await fetch(`${this.apiBase}/game/lookup?code=${gameCode}`);
            
            if (!response.ok) {
                throw new Error('Game not found');
            }
            
            this.gameState = await response.json();
            this.gameId = gameCode;
            this.connectWebSocket();
            this.updateUI();
            
            // Update URL without page reload
            window.history.pushState({}, '', `?code=${gameCode}`);
            
            this.showNotification(`Joined game: ${gameCode}`);
        } catch (error) {
            console.error('Error joining game:', error);
            alert('Could not join game. Please check the code and try again.');
        }
    }
    
    showGameCode(gameCode) {
        const gameCodeDisplay = document.getElementById('game-code-display');
        const gameCodeText = document.getElementById('game-code-text');
        const shareUrl = document.getElementById('share-url');
        
        gameCodeText.textContent = gameCode;
        const gameUrl = `${window.location.origin}${window.location.pathname}?code=${gameCode}`;
        shareUrl.value = gameUrl;
        
        gameCodeDisplay.classList.remove('hidden');
    }
    
    copyGameCode() {
        const gameCodeText = document.getElementById('game-code-text').textContent;
        navigator.clipboard.writeText(gameCodeText).then(() => {
            this.showNotification('Game code copied! 📋');
        }).catch(() => {
            this.showNotification('Failed to copy game code');
        });
    }
    
    copyShareLink() {
        const shareUrl = document.getElementById('share-url').value;
        navigator.clipboard.writeText(shareUrl).then(() => {
            this.showNotification('Share link copied! 🔗');
        }).catch(() => {
            this.showNotification('Failed to copy share link');
        });
    }
    
    updatePlayerName() {
        const playerName = document.getElementById('player-name').value.trim();
        this.playerName = playerName;
        localStorage.setItem('codenames-player-name', playerName);
        
        if (playerName) {
            this.checkEasterEggs(playerName);
        }
    }
    
    updateTheme() {
        const theme = document.getElementById('theme-select').value;
        this.theme = theme;
        document.body.className = `theme-${theme}`;
        localStorage.setItem('codenames-theme', theme);
        
        this.showNotification(`Theme changed to ${theme}! ✨`);
    }
    
    loadPreferences() {
        const savedName = localStorage.getItem('codenames-player-name');
        const savedTheme = localStorage.getItem('codenames-theme') || 'green';
        
        if (savedName) {
            document.getElementById('player-name').value = savedName;
            this.playerName = savedName;
        }
        
        document.getElementById('theme-select').value = savedTheme;
        this.theme = savedTheme;
        document.body.className = `theme-${savedTheme}`;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CodenamesDuetApp();
});