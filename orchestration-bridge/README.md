# Orchestration Bridge — Strategy Game

Node.js server + Claude Artifact that acts as the programmable game engine
for the WWII strategy game (v0.18 ruleset). Puppeteer loads the Artifact in
a headless browser; the server exposes REST endpoints that the frontend
(or any automation) can call.

---

## Architecture

```
┌──────────────┐       HTTP/JSON        ┌──────────────────┐
│   Frontend   │ ────────────────────►  │  Node.js Bridge  │
│  (game UI)   │ ◄────────────────────  │   server.js      │
└──────────────┘                        │   :3400           │
                                        └────────┬─────────┘
                                                 │ Puppeteer
                                                 │ page.evaluate()
                                        ┌────────▼─────────┐
                                        │  Claude Artifact  │
                                        │  game-engine.html │
                                        │                   │
                                        │  window.functions:│
                                        │  • analyzeGame…   │
                                        │  • resolveCombat  │
                                        │  • getLegalMoves  │
                                        │  • executeMove    │
                                        │  • getAttackTar…  │
                                        │  • rotateUnit     │
                                        │  • getNextStrat…  │
                                        │  • endTurn        │
                                        │  • thinkWithClaude│──► Anthropic API
                                        │  • getApiUsage    │    (proxy, no key)
                                        │  • engineReady    │
                                        └──────────────────┘
```

**Data flow:**
1. Frontend sends JSON game state to a Bridge endpoint
2. Bridge passes it to the Artifact via `page.evaluate()`
3. Artifact computes result (combat, moves, strategy) and returns JSON
4. For `/think` — the Artifact calls Claude via the claude.ai proxy
   (plain `fetch()`, no API key — uses host's Pro subscription)
5. Bridge applies state mutations and returns the result + updated state

---

## Prerequisites

- **Node.js 18+** — [download](https://nodejs.org/)
- **npm** (bundled with Node.js)

Puppeteer downloads its own Chromium automatically on `npm install`.

---

## Setup

```bash
cd orchestration-bridge
npm install
npm start
```

The server starts on `http://localhost:3400`. Pass `--verbose` to see
Artifact console output:

```bash
node server.js --verbose
```

---

## API Reference

### Health

```
GET /health
→ { "bridge": "ok", "engine": { "status": "ready", "version": "1.0.0", "functions": [...] } }
```

### Sessions

```
POST /sessions
Body (optional): { "gameState": <GameState> }
→ 201 { "sessionId": "uuid", "gameState": <GameState> }

GET  /sessions          → [{ id, createdAt, turnNumber, historyLength }]
GET  /sessions/:id      → { id, gameState, history }
DELETE /sessions/:id    → { "deleted": true }
```

If no `gameState` is provided, a sample Blitzkrieg vs. Superior Firepower
match is created automatically.

### Analysis

```
POST /sessions/:id/analyze   → { turnNumber, players[], threatAssessment[], boardControl }
POST /sessions/:id/validate  → { valid: boolean, errors: string[] }
```

### Unit Queries

```
GET /sessions/:id/units/:unitId/moves
→ { unitId, unitType, currentPos, legalMoves: [{ row, col, terrain }], moveCount }

GET /sessions/:id/units/:unitId/targets
→ { unitId, unitType, targets: [{ unitId, type, position, direction, distance, currentHp }] }
```

### Actions (mutate session state)

**Move a unit:**
```
POST /sessions/:id/move
Body: { "unitId": "p0_tank_1", "toRow": 5, "toCol": 3 }
→ { action: "move", from, to, terrain, stateUpdates, updatedState }
```

**Attack:**
```
POST /sessions/:id/attack
Body: { "attackerUnitId": "p0_tank_1", "defenderUnitId": "p1_cav_1", "diceRoll": 4 }
→ { action: "combat", diceRoll, damage, killed, modifiers, stateUpdates, updatedState }
```
`diceRoll` is optional — omit for a random 1d6 roll.

**Rotate facing (free action):**
```
POST /sessions/:id/rotate
Body: { "unitId": "p0_inf_1", "facing": "E" }
→ { action: "rotate", unitId, newFacing, cost: 0 }
```

**End turn:**
```
POST /sessions/:id/end-turn
→ { action: "end_turn", nextPlayer, nextTurnNumber, unitUpdates[], hqStatus, gameOver, winner }
```

### Strategic AI

```
POST /sessions/:id/advise
→ {
    recommendation: { type: "attack"|"move"|"end_turn", unitId, priority, reasoning },
    alternatives: [...],
    analysis: { ownUnits, enemyUnits, hqHp, threats },
    strategicNotes: [...]
  }
```

### Claude AI Thinking (built-in proxy — no API key needed)

Sends the game state to Claude for deep strategic reasoning. The Artifact
calls the Anthropic API via the claude.ai proxy — authentication is handled
automatically using the host's Pro subscription. **No API key required.**

**Check status:**
```
GET /claude/status
→ { apiBuiltIn: true, usage, billing: "...", models: {...} }
```

**Token usage this session:**
```
GET /claude/usage
→ { inputTokens, outputTokens, requests }
```

**Ask Claude to think about the board:**
```
POST /sessions/:id/think
Body: {
  "model": "claude-sonnet-4-20250514",   // optional, default sonnet
  "maxTokens": 1024,                     // optional
  "question": "Should I push tanks or defend?" // optional, for specific questions
}
→ {
    source: "artifact_built_in_api",
    model: "claude-sonnet-4-20250514",
    response: {
      assessment: "...",
      recommendation: { action, unitId, details, reasoning },
      alternatives: [...],
      strategicNotes: [...],
      riskLevel: "low|medium|high|critical"
    },
    usage: { inputTokens, outputTokens }
  }
```

**Available models (all covered by host Pro subscription):**
| Model | Speed | Best for |
|---|---|---|
| `claude-haiku-4-5-20251001` | Fast | Quick tactical checks |
| `claude-sonnet-4-20250514` (default) | Balanced | Strategic reasoning |
| `claude-opus-4-6` | Deep | Complex multi-turn planning |

### Direct Engine Call (escape hatch)

```
POST /engine/call
Body: { "functionName": "analyzeGameState", "args": [<gameState>] }
→ <raw function result>
```

---

## Game State Schema

```typescript
interface GameState {
  turnNumber: number;           // starts at 1
  activePlayer: 0 | 1;
  phase: 'action' | 'end_turn';
  board: {
    rows: number;
    cols: number;
    grid: number[][];           // 0=grassland 1=swamp 2=forest 3=mountain
    terrainKey: Record<number, string>;
  };
  players: [PlayerState, PlayerState];
}

interface PlayerState {
  playerIndex: 0 | 1;
  doctrine: 'Plain' | 'Blitzkrieg' | 'SuperiorFirepower';
  hqHp: number;                // starts at 20
  hqPosition: { row: number; col: number };
  hqOccupyTimer: number;       // turns enemy unit inside HQ reach
  units: UnitState[];
}

interface UnitState {
  id: string;
  type: 'Infantry' | 'Cavalry' | 'Tanks' | 'Motorized' | 'Artillery';
  level: number;               // 0=base, 1=Corporal, 2=Captain, 3=Colonel
  row: number;
  col: number;
  facing: 'N' | 'E' | 'S' | 'W';
  currentHp: number;
  actionsRemaining: number;    // max 2 per turn
  movedThisTurn: boolean;
  trenchTurns?: number;        // Infantry/Cavalry only; >=3 = trench active
  stillTurns?: number;         // Blitzkrieg Tanks; cumulative defense penalty
  formationWith?: string;      // id of paired unit
  cantMove?: boolean;          // progression drawback flag
  atkStamina?: number;         // for bounce-rule check
}
```

---

## Artifact Window Functions

These are the functions exposed on `window` inside `game-engine.html`.
They accept plain objects and return plain objects (no DOM, no side effects
beyond the testing UI update).

| Function | Signature | Returns |
|---|---|---|
| `engineReady()` | `() → Object` | `{ status, version, apiBuiltIn, functions[] }` |
| `validateGameState(gs)` | `(GameState) → Object` | `{ valid, errors[] }` |
| `analyzeGameState(gs)` | `(GameState) → Object` | `{ players[], threatAssessment[], boardControl }` |
| `resolveCombat(gs, atkId, defId, dice?)` | `(GameState, string, string, number?) → Object` | `{ damage, killed, modifiers, stateUpdates }` |
| `getLegalMoves(gs, unitId)` | `(GameState, string) → Object` | `{ legalMoves[], moveCount }` |
| `getAttackTargets(gs, unitId)` | `(GameState, string) → Object` | `{ targets[] }` |
| `executeMove(gs, unitId, row, col)` | `(GameState, string, number, number) → Object` | `{ from, to, stateUpdates }` |
| `rotateUnit(gs, unitId, facing)` | `(GameState, string, string) → Object` | `{ newFacing, cost: 0 }` |
| `getNextStrategicAction(gs)` | `(GameState) → Object` | `{ recommendation, alternatives[], strategicNotes[] }` |
| `endTurn(gs)` | `(GameState) → Object` | `{ nextPlayer, unitUpdates[], hqStatus, gameOver }` |
| **`thinkWithClaude(gs, opts?)`** | `(GameState, Object?) → Promise` | `{ response, usage }` — calls Claude via built-in proxy (no API key) |
| **`getApiUsage()`** | `() → Object` | `{ inputTokens, outputTokens, requests }` |

---

## Example: Full Turn Cycle

```bash
# 1. Create a session
curl -X POST http://localhost:3400/sessions | jq .sessionId

# 2. Analyze the board
curl -X POST http://localhost:3400/sessions/SESSION_ID/analyze | jq .

# 3. Get AI recommendation
curl -X POST http://localhost:3400/sessions/SESSION_ID/advise | jq .recommendation

# 4. Execute the recommended move
curl -X POST http://localhost:3400/sessions/SESSION_ID/move \
  -H "Content-Type: application/json" \
  -d '{"unitId":"p0_tank_1","toRow":5,"toCol":3}'

# 5. Attack a target
curl -X POST http://localhost:3400/sessions/SESSION_ID/attack \
  -H "Content-Type: application/json" \
  -d '{"attackerUnitId":"p0_tank_2","defenderUnitId":"p1_cav_1"}'

# 6. End the turn
curl -X POST http://localhost:3400/sessions/SESSION_ID/end-turn
```

---

## File Structure

```
orchestration-bridge/
├── server.js                  # Express server — all REST endpoints
├── package.json               # Only 2 deps: express + puppeteer
├── artifact/
│   └── game-engine.html       # Claude Artifact — game engine + built-in Claude API
└── lib/
    ├── puppeteer-controller.js # Launches Chromium, calls window functions
    ├── session-store.js        # In-memory session + state management
    └── sample-state.js         # Demo game state (Blitzkrieg vs SF)
```
