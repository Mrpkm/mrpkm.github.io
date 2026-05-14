const fs = require('fs');
const path = require('path');

class SharedMemory {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.journalPath = path.join(dataDir, 'learning-journal.md');
    this.phase = 'idle';
    this.currentCycle = 0;
    this.agentLogs = new Map();
    fs.mkdirSync(dataDir, { recursive: true });
  }

  beginCycle(cycle, agents) {
    this.phase = 'play';
    this.currentCycle = cycle;
    this.agentLogs = new Map(agents.map((agent) => [agent.id, []]));
  }

  appendMatchEvent(agentId, event) {
    // State isolation pattern:
    // During play, agents get a write-only sink. They can preserve every match event,
    // but cannot inspect their own history or another agent's history until reflection.
    if (this.phase !== 'play') {
      throw new Error('Match writes are accepted only during the play phase.');
    }

    const log = this.agentLogs.get(agentId);
    if (!log) throw new Error(`Unknown agent ${agentId}`);
    log.push({
      ...event,
      cycle: this.currentCycle,
      recordedAt: new Date().toISOString(),
    });
  }

  getReflectionSnapshot() {
    // The reflection phase is the only read window. This snapshot is copied so the
    // analyzer can compare agents without mutating the raw match logs.
    if (this.phase !== 'reflection') {
      throw new Error('Shared memory is locked until reflection begins.');
    }

    return {
      cycle: this.currentCycle,
      priorMarkdown: this.readJournal(),
      agentLogs: Array.from(this.agentLogs.entries()).map(([agentId, matches]) => ({
        agentId,
        matches: matches.map((match) => ({ ...match })),
      })),
    };
  }

  unlockForReflection() {
    this.phase = 'reflection';
  }

  appendMarkdown(markdown) {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const existing = this.readJournal();
    const next = existing ? `${existing.trim()}\n\n---\n\n${markdown.trim()}\n` : `${markdown.trim()}\n`;
    fs.writeFileSync(this.journalPath, next, 'utf8');
    return next;
  }

  readJournal() {
    if (!fs.existsSync(this.journalPath)) return '';
    return fs.readFileSync(this.journalPath, 'utf8');
  }

  finishCycle() {
    this.phase = 'idle';
  }
}

module.exports = { SharedMemory };
