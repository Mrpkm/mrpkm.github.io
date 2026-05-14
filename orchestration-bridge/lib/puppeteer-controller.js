'use strict';

const puppeteer = require('puppeteer');
const path = require('path');

let _browser = null;
let _page = null;
const _verbose = process.argv.includes('--verbose');

function _log(msg) {
  if (_verbose) console.log('[puppeteer]', msg);
}

async function launch() {
  _log('Launching Chromium...');
  _browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files'
    ]
  });

  _page = await _browser.newPage();
  _page.setDefaultNavigationTimeout(30000);

  if (_verbose) {
    _page.on('console', msg => {
      if (msg.type() !== 'warning') {
        console.log('[artifact]', msg.type(), msg.text());
      }
    });
    _page.on('pageerror', err => console.error('[artifact error]', err.message));
  }

  // Build a proper file:// URL — handles Windows backslashes
  const artifactAbs = path.resolve(__dirname, '../artifact/game-engine.html');
  const artifactUrl = 'file:///' + artifactAbs.replace(/\\/g, '/');
  _log('Loading artifact: ' + artifactUrl);

  await _page.goto(artifactUrl, { waitUntil: 'networkidle0', timeout: 15000 });

  await _page.waitForFunction(
    () => typeof window.engineReady === 'function' && typeof window.analyzeGameState === 'function',
    { timeout: 10000 }
  );

  const ready = await _page.evaluate(() => window.engineReady());
  console.log('[puppeteer] Engine ready v' + ready.version + ' — ' + ready.functions.length + ' functions loaded');
}

async function callFunction(name, ...args) {
  if (!_page) throw new Error('[puppeteer] Not launched — call launch() first');

  try {
    const result = await _page.evaluate(
      (fnName, fnArgs) => {
        const fn = window[fnName];
        if (typeof fn !== 'function') {
          return { error: 'Function not found: ' + fnName };
        }
        return Promise.resolve(fn(...fnArgs));
      },
      name,
      args
    );
    return result;
  } catch (err) {
    throw new Error('[puppeteer] callFunction(' + name + ') failed: ' + err.message);
  }
}

async function shutdown() {
  if (_browser) {
    _log('Shutting down Chromium...');
    await _browser.close();
    _browser = null;
    _page = null;
  }
}

module.exports = { launch, callFunction, shutdown };
