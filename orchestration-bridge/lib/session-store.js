const crypto = require('crypto');

const _sessions = new Map();

function createSession(gameState) {
  const id = crypto.randomUUID();
  _sessions.set(id, {
    id,
    createdAt: new Date().toISOString(),
    lastAccess: new Date().toISOString(),
    gameState,
    history: []
  });
  return id;
}

function getSession(id) {
  const session = _sessions.get(id);
  if (!session) return null;
  session.lastAccess = new Date().toISOString();
  return session;
}

function updateState(id, newState) {
  const session = _sessions.get(id);
  if (!session) return false;
  session.history.push({
    turn: session.gameState.turnNumber,
    timestamp: new Date().toISOString()
  });
  session.gameState = newState;
  session.lastAccess = new Date().toISOString();
  return true;
}

function applyUpdates(id, stateUpdates) {
  const session = _sessions.get(id);
  if (!session) return null;

  const state = JSON.parse(JSON.stringify(session.gameState));

  if (stateUpdates.unitUpdates) {
    stateUpdates.unitUpdates.forEach(update => {
      for (const player of state.players) {
        const unit = player.units.find(u => u.id === update.unitId);
        if (unit) {
          unit[update.field] = update.value;
          break;
        }
      }
    });
  }

  if (stateUpdates.nextPlayer != null) state.activePlayer = stateUpdates.nextPlayer;
  if (stateUpdates.nextTurnNumber != null) state.turnNumber = stateUpdates.nextTurnNumber;

  session.history.push({
    turn: session.gameState.turnNumber,
    timestamp: new Date().toISOString()
  });
  session.gameState = state;
  session.lastAccess = new Date().toISOString();

  return state;
}

function deleteSession(id) {
  return _sessions.delete(id);
}

function listSessions() {
  return Array.from(_sessions.values()).map(s => ({
    id: s.id,
    createdAt: s.createdAt,
    lastAccess: s.lastAccess,
    turnNumber: s.gameState?.turnNumber,
    historyLength: s.history.length
  }));
}

module.exports = { createSession, getSession, updateState, applyUpdates, deleteSession, listSessions };
