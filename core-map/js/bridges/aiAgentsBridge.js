(function () {
  'use strict';

  var BASE_URL = 'http://localhost:3500';
  var _eventSource = null;
  var _status = null;

  function _apiJson(urlPath, method, body) {
    var opts = { method: method || 'GET', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE_URL + urlPath, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (text) {
        throw new Error('HTTP ' + r.status + ': ' + text.slice(0, 180));
      });
      return r.json();
    });
  }

  function _render(status, error) {
    var root = document.getElementById('agent-loop-panel');
    if (!root) return;

    var phase = status?.phase || 'offline';
    var agents = status?.agents || [];
    var assigned = _assignedAgentLabel(status);
    var remaining = status?.phaseEndsAt ? Math.max(0, status.phaseEndsAt - Date.now()) : 0;
    var minutes = Math.floor(Math.ceil(remaining / 1000) / 60);
    var seconds = Math.ceil(remaining / 1000) % 60;
    var clock = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    root.innerHTML = [
      '<div class="agent-loop-head">',
      '<span>LOOP: <b>' + phase.toUpperCase() + '</b></span>',
      '<span>' + (status?.mode || 'real-game') + '</span>',
      '</div>',
      '<div class="agent-loop-clock">' + clock + '</div>',
      '<div class="agent-loop-note">Player 2: <b>' + _escape(assigned || 'queued on first AI turn') + '</b></div>',
      error ? '<div class="agent-loop-error">' + _escape(error) + '</div>' : '',
      '<div class="agent-loop-grid">',
      agents.map(function (agent) {
        return '<div><b>' + _escape(agent.name) + '</b><span>' +
          _escape(agent.status || 'idle') + ' / ' + (agent.matchesPlayed || 0) + '</span></div>';
      }).join(''),
      '</div>',
      '<div class="action-row" style="margin-top:6px;">',
      '<button id="btn-agent-loop-start">Assign P2</button>',
      '<button id="btn-agent-turn">AI Turn</button>',
      '<button id="btn-agent-loop-stop">Stop</button>',
      '</div>',
      '<div class="agent-loop-note">Four agents are queued. A new game keeps one assigned AI; the next game rotates to the next agent.</div>'
    ].join('');

    var startBtn = document.getElementById('btn-agent-loop-start');
    var turnBtn = document.getElementById('btn-agent-turn');
    var stopBtn = document.getElementById('btn-agent-loop-stop');
    if (startBtn) startBtn.addEventListener('click', assignOpponent);
    if (turnBtn) turnBtn.addEventListener('click', playAiTurn);
    if (stopBtn) stopBtn.addEventListener('click', stop);
  }

  function _assignedAgentLabel(status) {
    var sessionId = window.OrchestrationBridge?.getSessionId?.();
    var hit = (status?.queue?.assignments || []).find(function (item) {
      return item.sessionId === sessionId;
    });
    return hit?.agentName || status?.queue?.nextAgent;
  }

  function _escape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function connect() {
    if (_eventSource) return;
    _apiJson('/api/status')
      .then(function (status) {
        _status = status;
        _render(status);
      })
      .catch(function (err) {
        _render(null, 'Agent service offline: start ai-agents on port 3500.');
      });

    try {
      _eventSource = new EventSource(BASE_URL + '/api/events');
      _eventSource.onmessage = function (event) {
        _status = JSON.parse(event.data);
        _render(_status);
      };
      _eventSource.onerror = function () {
        _render(_status, 'Waiting for agent service...');
      };
    } catch (err) {
      _render(null, err.message);
    }
  }

  function startFromCurrentGame() {
    if (!window.OrchestrationBridge?.getCurrentGameState) {
      _render(_status, 'Orchestration bridge is not ready.');
      return;
    }

    var gameState = window.OrchestrationBridge.getCurrentGameState();
    if (!gameState) {
      _render(_status, 'Load a pre-game briefing before starting the AI loop.');
      return;
    }

    _apiJson('/api/integrations/core-map/start', 'POST', {
      source: 'core-map',
      bridgeSessionId: window.OrchestrationBridge.getSessionId?.(),
      gameState: gameState
    }).then(function (status) {
      _status = status;
      _render(status);
    }).catch(function (err) {
      _render(_status, err.message);
    });
  }

  function assignOpponent() {
    var sessionId = window.OrchestrationBridge?.getSessionId?.();
    if (!sessionId) {
      _render(_status, 'Load a briefing before assigning player 2.');
      return;
    }

    _apiJson('/api/integrations/core-map/assign-opponent', 'POST', {
      bridgeSessionId: sessionId
    }).then(function (result) {
      _status = Object.assign({}, _status || {}, { queue: result.queue });
      _render(_status, result.agent.name + ' assigned as player 2 for this game.');
    }).catch(function (err) {
      _render(_status, err.message);
    });
  }

  function playAiTurn() {
    var sessionId = window.OrchestrationBridge?.getSessionId?.();
    if (!sessionId) {
      _render(_status, 'Load a briefing before asking player 2 to move.');
      return;
    }

    _apiJson('/api/integrations/core-map/ai-opponent-turn', 'POST', {
      bridgeSessionId: sessionId
    }).then(function (result) {
      if (window.OrchestrationBridge?.applyBridgeState) {
        window.OrchestrationBridge.applyBridgeState(result.updatedState);
      }
      _status = Object.assign({}, _status || {}, { queue: result.queue });
      _render(_status, result.agent.name + ' completed ' + result.actions.length + ' player-2 action(s).');
    }).catch(function (err) {
      _render(_status, err.message);
    });
  }

  function stop() {
    _apiJson('/api/cycles/stop', 'POST')
      .then(function (status) {
        _status = status;
        _render(status);
      })
      .catch(function (err) {
        _render(_status, err.message);
      });
  }

  window.AIAgentsBridge = {
    connect: connect,
    startFromCurrentGame: startFromCurrentGame,
    assignOpponent: assignOpponent,
    playAiTurn: playAiTurn,
    stop: stop
  };
})();
