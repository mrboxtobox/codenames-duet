class CodenamesDuetApp {
    constructor() {
        this.gameId = 'default';
        this.gameState = null;
        this.apiBase = window.location.origin + '/api';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadGameState();
    }

    setupEventListeners() {
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('show-clue-input-btn').addEventListener('click', () => this.showClueInput());
        document.getElementById('give-clue-btn').addEventListener('click', () => this.giveClue());
        document.getElementById('cancel-clue-btn').addEventListener('click', () => this.hideClueInput());
        document.getElementById('end-turn-btn').addEventListener('click', () => this.endTurn());
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        const url = `${this.apiBase}${endpoint}?gameId=${this.gameId}`;
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
            this.gameState = await this.apiCall('/game/new', 'POST');
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

        // Update player info
        document.getElementById('current-player').textContent = `Player ${this.gameState.currentPlayer}'s Turn`;
        document.getElementById('moves-left').textContent = `Moves: ${this.gameState.moves}/${this.gameState.maxMoves}`;

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
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CodenamesDuetApp();
});