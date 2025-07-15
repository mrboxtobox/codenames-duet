# Codenames: Duet

A web-based implementation of the cooperative word game Codenames: Duet, built with Cloudflare technologies.

## Features

- **Cooperative gameplay**: Two players work together to find all green cards
- **Real-time updates**: Built with Cloudflare Workers and Durable Objects
- **Minimal dependencies**: Uses vanilla JavaScript and CSS
- **Mobile-friendly**: Responsive design that works on all devices

## How to Play

1. **Objective**: Find all 15 green cards before running out of moves (9 total)
2. **Turns**: Players alternate giving clues and making guesses
3. **Clues**: Give a one-word clue and a number indicating how many cards relate to it
4. **Guessing**: Click on cards to reveal them
5. **Card Types**:
   - **Green**: Good! You need to find all 15
   - **Neutral**: Safe but ends your turn
   - **Assassin**: Game over! Avoid these 3 cards

## Development

### Prerequisites

- Node.js (v18 or later)
- Cloudflare account
- Wrangler CLI

### Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Wrangler (first time only):
```bash
npx wrangler login
```

3. Create a Durable Objects namespace:
```bash
npx wrangler publish --dry-run
```

### Local Development

1. Start the worker in development mode:
```bash
npm run worker:dev
```

2. In another terminal, start the Pages development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:8788`

### Deployment

1. Deploy the worker:
```bash
npm run worker:deploy
```

2. Deploy the frontend:
```bash
npm run deploy
```

## Architecture

- **Frontend**: Static HTML/CSS/JS served via Cloudflare Pages
- **Backend**: Cloudflare Workers with Durable Objects for game state
- **Storage**: Durable Objects provide persistent, real-time game state

## Game Rules

Codenames: Duet is a cooperative variant where:
- 25 cards are arranged in a 5x5 grid
- 15 cards are "green" (your targets)
- 3 cards are "assassins" (avoid these!)
- 7 cards are neutral
- Players have 9 total moves to find all green cards
- Hitting an assassin ends the game immediately

## File Structure

```
codenames-duet/
├── public/           # Frontend assets
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── worker/           # Cloudflare Worker
│   ├── index.js
│   └── game-logic.js
├── package.json
├── wrangler.toml
└── _headers         # Cloudflare Pages headers
```