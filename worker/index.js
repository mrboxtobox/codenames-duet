import { CodenamesDuetGame } from './game-logic.js';

export class GameState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.game = new CodenamesDuetGame();
    this.sessions = new Map(); // WebSocket sessions
    this.gameCode = null;
    this.createdAt = null;
  }

  validateInput(input, type) {
    switch (type) {
      case 'clue':
        if (!input.clue || typeof input.clue !== 'string') return false;
        if (input.clue.length > 50 || input.clue.length < 1) return false;
        if (!/^[a-zA-Z]+$/.test(input.clue)) return false; // Only letters
        if (!input.number || typeof input.number !== 'number') return false;
        if (input.number < 1 || input.number > 5) return false;
        return true;
      
      case 'guess':
        if (typeof input.row !== 'number' || typeof input.col !== 'number') return false;
        if (input.row < 0 || input.row >= 5) return false;
        if (input.col < 0 || input.col >= 5) return false;
        return true;
      
      default:
        return false;
    }
  }

  generateShortCode() {
    // Generate a 6-character code using consonants and vowels for readability
    const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
    const vowels = 'AEIOU';
    let code = '';
    
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) {
        code += consonants[Math.floor(Math.random() * consonants.length)];
      } else {
        code += vowels[Math.floor(Math.random() * vowels.length)];
      }
    }
    
    return code;
  }

  broadcast(message) {
    // Send message to all connected WebSocket sessions
    for (const [sessionId, session] of this.sessions) {
      try {
        session.webSocket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to session:', sessionId, error);
        this.sessions.delete(sessionId);
      }
    }
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // WebSocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocket(request);
      }

      if (request.method === 'GET' && path === '/game/state') {
        const gameState = this.game.getGameState();
        gameState.gameCode = this.gameCode;
        gameState.playerCount = this.sessions.size;
        return new Response(JSON.stringify(gameState), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST' && path === '/game/new') {
        this.game.reset();
        
        // Check if a game code was passed in the URL
        const providedGameCode = url.searchParams.get('gameCode');
        if (providedGameCode) {
          this.gameCode = providedGameCode;
          this.createdAt = Date.now();
        } else if (!this.gameCode) {
          // Only generate a new code if we don't already have one
          this.gameCode = this.generateShortCode();
          this.createdAt = Date.now();
        }
        
        const gameState = this.game.getGameState();
        gameState.gameCode = this.gameCode;
        gameState.playerCount = this.sessions.size;
        
        // Broadcast new game to all connected players
        this.broadcast({
          type: 'gameStateUpdate',
          gameState: gameState
        });
        
        return new Response(JSON.stringify(gameState), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST' && path === '/game/clue') {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (!this.validateInput(body, 'clue')) {
          return new Response(JSON.stringify({ error: 'Invalid clue format' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const result = this.game.giveClue(body.clue, body.number);
        const gameState = this.game.getGameState();
        gameState.gameCode = this.gameCode;
        gameState.playerCount = this.sessions.size;
        
        // Broadcast clue to all players
        this.broadcast({
          type: 'clueGiven',
          clue: body.clue,
          number: body.number,
          gameState: gameState
        });
        
        return new Response(JSON.stringify({
          ...result,
          gameState: gameState
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST' && path === '/game/guess') {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (!this.validateInput(body, 'guess')) {
          return new Response(JSON.stringify({ error: 'Invalid guess format' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const result = this.game.makeGuess(body.row, body.col);
        const gameState = this.game.getGameState();
        gameState.gameCode = this.gameCode;
        gameState.playerCount = this.sessions.size;
        
        // Broadcast guess to all players
        this.broadcast({
          type: 'guessMade',
          row: body.row,
          col: body.col,
          result: result.result,
          gameState: gameState
        });
        
        return new Response(JSON.stringify({
          ...result,
          gameState: gameState
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST' && path === '/game/end-turn') {
        this.game.endTurn();
        const gameState = this.game.getGameState();
        gameState.gameCode = this.gameCode;
        gameState.playerCount = this.sessions.size;
        
        // Broadcast turn end to all players
        this.broadcast({
          type: 'turnEnded',
          gameState: gameState
        });
        
        return new Response(JSON.stringify(gameState), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'GET' && path === '/game/join') {
        // Return game state for joining
        if (!this.gameCode) {
          return new Response(JSON.stringify({ error: 'No active game' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const gameState = this.game.getGameState();
        gameState.gameCode = this.gameCode;
        gameState.playerCount = this.sessions.size;
        
        return new Response(JSON.stringify(gameState), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('GameState error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async handleWebSocket(request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    const sessionId = crypto.randomUUID();
    
    server.accept();
    
    // Store the WebSocket session
    this.sessions.set(sessionId, {
      webSocket: server,
      connectedAt: Date.now()
    });
    
    // Send initial game state
    const gameState = this.game.getGameState();
    gameState.gameCode = this.gameCode;
    gameState.playerCount = this.sessions.size;
    
    server.send(JSON.stringify({
      type: 'connected',
      sessionId: sessionId,
      gameState: gameState
    }));
    
    // Notify other players of new connection
    this.broadcast({
      type: 'playerJoined',
      playerCount: this.sessions.size
    });
    
    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
      // Notify remaining players
      this.broadcast({
        type: 'playerLeft',
        playerCount: this.sessions.size
      });
    });
    
    server.addEventListener('error', () => {
      this.sessions.delete(sessionId);
    });
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
}

// Rate limiting using Cloudflare's built-in rate limiting
const RATE_LIMIT = {
  requests: 100,
  window: 60 // 100 requests per minute
};

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

async function rateLimitCheck(request, env) {
  const clientIP = getClientIP(request);
  const key = `rate_limit:${clientIP}`;
  
  // Simple rate limiting - in production, consider using Cloudflare's rate limiting features
  const current = await env.RATE_LIMIT?.get(key);
  const count = current ? parseInt(current) : 0;
  
  if (count >= RATE_LIMIT.requests) {
    return false;
  }
  
  await env.RATE_LIMIT?.put(key, (count + 1).toString(), { expirationTtl: RATE_LIMIT.window });
  return true;
}

function sanitizeGameId(gameId) {
  // Only allow alphanumeric characters and hyphens, max 50 chars
  return gameId.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 50);
}

function validateRequest(request, url) {
  // Check Content-Type for POST requests
  if (request.method === 'POST') {
    const contentType = request.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return { valid: false, message: 'Invalid Content-Type' };
    }
  }
  
  // Validate path
  if (!url.pathname.startsWith('/api/game/')) {
    return { valid: false, message: 'Invalid path' };
  }
  
  return { valid: true };
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      
      // Security headers for all responses
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
      };
      
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            ...securityHeaders,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          }
        });
      }
      
      // Rate limiting
      if (env.RATE_LIMIT && !(await rateLimitCheck(request, env))) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: {
            ...securityHeaders,
            'Content-Type': 'application/json',
            'Retry-After': '60'
          }
        });
      }
      
      // Request validation
      const validation = validateRequest(request, url);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.message }), {
          status: 400,
          headers: {
            ...securityHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Generate a new game with code route
      if (url.pathname === '/api/game/create' && request.method === 'POST') {
        // Generate a short code for consonants and vowels readability
        const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
        const vowels = 'AEIOU';
        let gameCode = '';
        
        for (let i = 0; i < 6; i++) {
          if (i % 2 === 0) {
            gameCode += consonants[Math.floor(Math.random() * consonants.length)];
          } else {
            gameCode += vowels[Math.floor(Math.random() * vowels.length)];
          }
        }
        
        // Create the game using the generated code as the ID
        const id = env.GAME_STATE.idFromName(gameCode);
        const gameState = env.GAME_STATE.get(id);
        
        // Create a new URL for the durable object call
        const doUrl = new URL(request.url);
        doUrl.pathname = '/game/new';
        doUrl.searchParams.set('gameCode', gameCode);
        
        const response = await gameState.fetch(doUrl.toString(), {
          method: 'POST',
          headers: request.headers,
          body: request.body
        });
        
        const newResponse = new Response(response.body, response);
        Object.entries(securityHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        
        return newResponse;
      }
      
      // Game code lookup route
      if (url.pathname === '/api/game/lookup' && request.method === 'GET') {
        const gameCode = url.searchParams.get('code');
        if (!gameCode || gameCode.length !== 6) {
          return new Response(JSON.stringify({ error: 'Invalid game code' }), {
            status: 400,
            headers: {
              ...securityHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        
        // Use game code as the game ID for Durable Object
        const id = env.GAME_STATE.idFromName(gameCode.toUpperCase());
        const gameState = env.GAME_STATE.get(id);
        
        // Create a new URL for the durable object call
        const doUrl = new URL(request.url);
        doUrl.pathname = '/game/join';
        doUrl.search = ''; // Remove query parameters
        
        const response = await gameState.fetch(doUrl.toString(), {
          method: 'GET',
          headers: request.headers
        });
        
        const newResponse = new Response(response.body, response);
        Object.entries(securityHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        
        return newResponse;
      }
      
      // Game API routes
      if (url.pathname.startsWith('/api/game/')) {
        const gameId = sanitizeGameId(url.searchParams.get('gameId') || url.searchParams.get('code') || 'default');
        
        // Validate game ID length
        if (gameId.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid game ID' }), {
            status: 400,
            headers: {
              ...securityHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        
        const id = env.GAME_STATE.idFromName(gameId);
        const gameState = env.GAME_STATE.get(id);
        
        // Forward request to durable object
        const newUrl = new URL(request.url);
        newUrl.pathname = newUrl.pathname.replace('/api', '');
        
        const response = await gameState.fetch(newUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        
        const newResponse = new Response(response.body, response);
        
        // Add security headers and CORS
        Object.entries(securityHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        return newResponse;
      }
      
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json'
        }
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }
  }
};