// Codenames: Duet game logic
const WORDS = [
  "AFRICA", "AGENT", "AIR", "ALIEN", "ALPS", "AMAZON", "AMBULANCE", "AMERICA", "ANGEL", "ANTARCTICA",
  "APPLE", "ARM", "ATLANTIS", "AUSTRALIA", "AZTEC", "BACK", "BALL", "BAND", "BANK", "BAR",
  "BARK", "BAT", "BATTERY", "BEACH", "BEAR", "BEAT", "BED", "BEIJING", "BELL", "BELT",
  "BERLIN", "BERMUDA", "BERRY", "BILL", "BLOCK", "BOARD", "BOLT", "BOMB", "BOND", "BOOM",
  "BOOT", "BOTTLE", "BOW", "BOX", "BRIDGE", "BRUSH", "BUCK", "BUFFALO", "BUG", "BUGLE",
  "BUTTON", "CALF", "CANADA", "CAP", "CAPITAL", "CAR", "CARD", "CARROT", "CASINO", "CAST",
  "CAT", "CELL", "CENTAUR", "CENTER", "CHAIR", "CHANGE", "CHARGE", "CHECK", "CHESS", "CHICK",
  "CHINA", "CHOCOLATE", "CHURCH", "CIRCLE", "CLIFF", "CLOAK", "CLUB", "CODE", "COLD", "COMIC",
  "COMPOUND", "COMPUTER", "COOKIE", "COPPER", "COTTON", "COURT", "COVER", "CRANE", "CRASH", "CRICKET",
  "CROSS", "CROWN", "CYCLE", "CZECH", "DANCE", "DATE", "DAY", "DEATH", "DECK", "DEGREE",
  "DIAMOND", "DICE", "DINOSAUR", "DISEASE", "DOCTOR", "DOG", "DRAFT", "DRAGON", "DRESS", "DRILL",
  "DROP", "DUCK", "DWARF", "EAGLE", "EARTH", "EGG", "EGYPT", "EIGHT", "EMBASSY", "ENGINE",
  "ENGLAND", "EUROPE", "EYE", "FACE", "FAIR", "FALL", "FAN", "FENCE", "FIELD", "FIGHTER",
  "FIGURE", "FILE", "FILM", "FIRE", "FISH", "FLUTE", "FLY", "FOOT", "FORCE", "FOREST",
  "FORK", "FRANCE", "GAME", "GAS", "GENIUS", "GERMANY", "GHOST", "GIANT", "GLASS", "GLOVE",
  "GOLD", "GRACE", "GRASS", "GREECE", "GREEN", "GROUND", "HAM", "HAND", "HAWK", "HEAD",
  "HEART", "HELICOPTER", "HIMALAYAS", "HOLE", "HOLLYWOOD", "HONEY", "HOOD", "HOOK", "HORN", "HORSE",
  "HORSESHOE", "HOSPITAL", "HOTEL", "ICE", "ICE CREAM", "INDIA", "IRON", "IVORY", "JACK", "JAM",
  "JET", "JUPITER", "KANGAROO", "KETCHUP", "KEY", "KID", "KING", "KIWI", "KNIFE", "KNIGHT",
  "LAB", "LAP", "LASER", "LATIN", "LAVA", "LAWYER", "LEAD", "LEATHER", "LEAVES", "LEGAL",
  "LEMON", "LIFE", "LIGHT", "LIMOUSINE", "LINE", "LINK", "LION", "LITTER", "LOCH NESS", "LOCK",
  "LOG", "LONDON", "LUCK", "MAIL", "MAMMOTH", "MAPLE", "MARBLE", "MARCH", "MASS", "MATCH",
  "MERCURY", "MEXICO", "MICROSCOPE", "MILLIONAIRE", "MINE", "MINT", "MISSING", "MISSION", "MODEL", "MOLE",
  "MOON", "MOSCOW", "MOUNT", "MOUSE", "MOUTH", "MUD", "MUMMY", "NAIL", "NEEDLE", "NET",
  "NEW YORK", "NIGHT", "NINJA", "NOTE", "NOVEL", "NURSE", "NUT", "OCTOPUS", "OIL", "OLIVE",
  "OLYMPUS", "OPERA", "ORANGE", "ORGAN", "PALM", "PAN", "PANTS", "PAPER", "PARACHUTE", "PARK",
  "PART", "PASSENGER", "PASSPORT", "PASSWORD", "PASTE", "PENGUIN", "PHOENIX", "PIANO", "PIE", "PILOT",
  "PIN", "PIPE", "PIRATE", "PISTOL", "PIT", "PLATE", "PLATYPUS", "PLAY", "PLOT", "POINT",
  "POISON", "POLE", "POLICE", "POOL", "PORT", "POST", "POUND", "PRESS", "PRINCESS", "PUMPKIN",
  "PUPIL", "PYRAMID", "QUEEN", "RABBIT", "RACKET", "RAY", "REVOLUTION", "RING", "ROBIN", "ROBOT",
  "ROCK", "ROME", "ROOT", "ROSE", "ROULETTE", "ROUND", "ROW", "RULER", "SATELLITE", "SATURN",
  "SCALE", "SCHOOL", "SCIENTIST", "SCORPION", "SCREEN", "SCUBA DIVER", "SEAL", "SERVER", "SHADOW", "SHAKESPEARE",
  "SHARK", "SHIP", "SHOE", "SHOP", "SHOT", "SINK", "SKYSCRAPER", "SLIP", "SLUG", "SNAP",
  "SNOW", "SNOWMAN", "SOCK", "SOLDIER", "SOUL", "SOUND", "SPACE", "SPELL", "SPIDER", "SPIKE",
  "SPINE", "SPOT", "SPRING", "SPY", "SQUARE", "STADIUM", "STAFF", "STAR", "STATE", "STICK",
  "STOCK", "STRAW", "STREAM", "STRIKE", "STRING", "SUB", "SUGAR", "SUIT", "SUPERHERO", "SWING",
  "SWITCH", "TABLE", "TABLET", "TAG", "TAIL", "TAP", "TEACHER", "TELESCOPE", "TEMPLE", "THEATER",
  "THIEF", "THUMB", "TICK", "TIE", "TIME", "TOKYO", "TOOTH", "TORCH", "TOWER", "TRACK",
  "TRAIN", "TRIANGLE", "TRIP", "TRUCK", "TRUMP", "TUBE", "TURKEY", "UNDERTAKER", "UNICORN", "VACUUM",
  "VAN", "VET", "WAKE", "WALL", "WAR", "WASHER", "WASHINGTON", "WATCH", "WATER", "WAVE",
  "WEB", "WELL", "WHALE", "WHIP", "WIND", "WITCH", "WIZARD", "WOOD", "WOOL", "WORD",
  "YARD", "YOGURT", "ZONE"
];

class CodenamesDuetGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = this.generateBoard();
    this.greenCards = new Set();
    this.assassinCards = new Set();
    this.moves = 0;
    this.maxMoves = 9;
    this.gameOver = false;
    this.won = false;
    this.currentPlayer = 1;
    this.clue = null;
    this.guessesLeft = 0;
  }

  generateBoard() {
    // Select 25 random words
    const shuffled = [...WORDS].sort(() => 0.5 - Math.random());
    const selectedWords = shuffled.slice(0, 25);
    
    // Create the board layout
    const board = [];
    for (let i = 0; i < 5; i++) {
      board.push([]);
      for (let j = 0; j < 5; j++) {
        board[i].push({
          word: selectedWords[i * 5 + j],
          type: 'neutral', // neutral, green, assassin
          revealed: false
        });
      }
    }

    // Place green cards (15 total, shared between both players)
    const greenPositions = this.getRandomPositions(15);
    greenPositions.forEach(pos => {
      board[pos.row][pos.col].type = 'green';
    });

    // Place assassin cards (3 total)
    const assassinPositions = this.getRandomPositions(3, greenPositions);
    assassinPositions.forEach(pos => {
      board[pos.row][pos.col].type = 'assassin';
    });

    return board;
  }

  getRandomPositions(count, exclude = []) {
    const positions = [];
    const excludeSet = new Set(exclude.map(p => `${p.row},${p.col}`));
    
    while (positions.length < count) {
      const row = Math.floor(Math.random() * 5);
      const col = Math.floor(Math.random() * 5);
      const key = `${row},${col}`;
      
      if (!excludeSet.has(key)) {
        positions.push({ row, col });
        excludeSet.add(key);
      }
    }
    
    return positions;
  }

  giveClue(clue, number) {
    if (this.gameOver || this.guessesLeft > 0) {
      return { success: false, message: "Cannot give clue now" };
    }
    
    this.clue = { word: clue, number: parseInt(number) };
    this.guessesLeft = parseInt(number) + 1; // +1 for bonus guess
    this.moves++;
    
    return { success: true, clue: this.clue };
  }

  makeGuess(row, col) {
    if (this.gameOver || this.guessesLeft <= 0) {
      return { success: false, message: "Cannot make guess now" };
    }

    const card = this.board[row][col];
    if (card.revealed) {
      return { success: false, message: "Card already revealed" };
    }

    card.revealed = true;
    this.guessesLeft--;

    if (card.type === 'assassin') {
      this.gameOver = true;
      this.won = false;
      return { success: true, result: 'assassin', gameOver: true };
    }

    if (card.type === 'green') {
      this.greenCards.add(`${row},${col}`);
      
      // Check win condition
      if (this.greenCards.size === 15) {
        this.gameOver = true;
        this.won = true;
        return { success: true, result: 'green', gameOver: true, won: true };
      }
      
      return { success: true, result: 'green' };
    }

    // Neutral card - end turn
    this.guessesLeft = 0;
    this.switchPlayer();
    return { success: true, result: 'neutral' };
  }

  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.clue = null;
  }

  endTurn() {
    this.guessesLeft = 0;
    this.switchPlayer();
  }

  getGameState() {
    return {
      board: this.board,
      greenCards: Array.from(this.greenCards),
      moves: this.moves,
      maxMoves: this.maxMoves,
      gameOver: this.gameOver,
      won: this.won,
      currentPlayer: this.currentPlayer,
      clue: this.clue,
      guessesLeft: this.guessesLeft
    };
  }
}

export { CodenamesDuetGame };