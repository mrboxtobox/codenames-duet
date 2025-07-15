import { CodenamesDuetGame } from './game-logic.js';

export class GameState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.game = new CodenamesDuetGame();
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

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'GET' && path === '/game/state') {
        return new Response(JSON.stringify(this.game.getGameState()), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST' && path === '/game/new') {
        this.game.reset();
        return new Response(JSON.stringify(this.game.getGameState()), {
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
        return new Response(JSON.stringify({
          ...result,
          gameState: this.game.getGameState()
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
        return new Response(JSON.stringify({
          ...result,
          gameState: this.game.getGameState()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST' && path === '/game/end-turn') {
        this.game.endTurn();
        return new Response(JSON.stringify(this.game.getGameState()), {
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
      
      // Game API routes
      if (url.pathname.startsWith('/api/game/')) {
        const gameId = sanitizeGameId(url.searchParams.get('gameId') || 'default');
        
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