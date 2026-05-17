# SalmonRush

A deployable full-stack classroom simulator for a 10-team tragedy-of-the-commons fishing game.

## Features

- 10 fixed team logins: Group 1 through Group 10
- Instructor and super-admin login roles
- Multi-device play through a central Node/Express + Socket.IO backend
- Persistent game instances in SQLite
- 10 annual rounds
- 2.5-minute live ascending bank auction/trade phase
- 2.5-minute construction/deployment phase
- 5 bank ships auctioned each year
- Reserve schedule: `300,300,300,300,300,200,100,100,1,1`
- Teams can revise bank auction bids during the auction period
- Highest bid and bidder visible during the bank auction
- Team-to-team ship listings and bids
- Hidden fish stocks for teams during play
- Instructor sees fish stocks throughout
- Debrief mode reveals fish stock and valuation history
- In-game chat with instructor broadcast and per-group messaging
- CSV exports for classroom analysis

## Quick start

```bash
npm install
npm run dev
```

Open the frontend URL printed by Vite. The backend runs on port `8787` by default.

## Production deployment

Frontend is deployed to GitHub Pages. Backend runs on Render with a persistent disk for SQLite.

- Frontend: https://AtalayAtasu.github.io/salmonrush
- Backend: https://salmonrush.onrender.com
