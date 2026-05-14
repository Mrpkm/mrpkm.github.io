// multiplayerStub.js — Named exports for the future multiplayer / Commander layer.
// Replace this file with a real implementation when multiplayer is scoped.
// Nothing here touches window.storage, Claude API, or any network resource.

export function syncState() {
  throw new Error('multiplayerStub.syncState: not implemented');
}

export function broadcastMove() {
  throw new Error('multiplayerStub.broadcastMove: not implemented');
}

export function registerCommander() {
  throw new Error('multiplayerStub.registerCommander: not implemented');
}
