// chroma-renderer.js — Background-removal utility for unit sprites.
// Exposes window.ChromaRenderer. Loaded as a plain <script> (IIFE, no ES module).
//
// Algorithm: BFS flood-fill from all 4 corners with Chebyshev colour tolerance.
//
// API:
//   ChromaRenderer.createSprite(src, { tolerance, displayWidth, displayHeight })
//     → Promise<{ el: HTMLCanvasElement, destroy: () => void }>
//   ChromaRenderer.createStaticSprite(src, { tolerance, displayWidth, displayHeight })
//     → Promise<{ el, destroy }>
//   ChromaRenderer.createGifSprite(src, { tolerance, displayWidth, displayHeight })
//     → Promise<{ el, destroy }>
//
// GIF strategy: load via <img> (native browser decoder — instant first frame),
// then capture the current frame to canvas on each rAF tick and apply BFS chroma
// key there. Processing cost scales with displayWidth×displayHeight, not the raw
// GIF file size, so even 11 MB GIFs appear in < 1 s at 48×48 display size.

(function () {
  'use strict';

  const TOL_DEFAULT = 45;
  const FEATHER_EXTRA = 25;

  // Modifies px (Uint8ClampedArray, RGBA) in-place.
  // Removes the background region connected to the four corners via BFS.
  function _removeBackground(px, W, H, tol) {
    let sR = 0, sG = 0, sB = 0, cnt = 0;
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
      const i = (y * W + x) * 4;
      if (px[i + 3] > 0) { sR += px[i]; sG += px[i + 1]; sB += px[i + 2]; cnt++; }
    }
    if (!cnt) return;

    const bgR = sR / cnt, bgG = sG / cnt, bgB = sB / cnt;

    function isClose(pi) {
      return px[pi + 3] > 0 &&
        Math.max(
          Math.abs(px[pi] - bgR),
          Math.abs(px[pi + 1] - bgG),
          Math.abs(px[pi + 2] - bgB)
        ) <= tol;
    }

    const hit = new Uint8Array(W * H);
    const q = [];

    function enq(x, y) {
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const n = y * W + x;
      if (hit[n]) return;
      if (!isClose(n * 4)) return;
      hit[n] = 1;
      q.push(n);
    }

    enq(0, 0); enq(W - 1, 0); enq(0, H - 1); enq(W - 1, H - 1);

    for (let qi = 0; qi < q.length; qi++) {
      const n = q[qi], x = n % W, y = (n / W) | 0;
      px[n * 4 + 3] = 0;
      enq(x + 1, y); enq(x - 1, y); enq(x, y + 1); enq(x, y - 1);
    }

    // Feather anti-aliased edge pixels adjacent to removed region.
    for (let n = 0; n < W * H; n++) {
      if (hit[n] || px[n * 4 + 3] === 0) continue;
      const x = n % W, y = (n / W) | 0;
      const hasRemovedNeighbour =
        (x > 0     && hit[n - 1]) ||
        (x < W - 1 && hit[n + 1]) ||
        (y > 0     && hit[n - W]) ||
        (y < H - 1 && hit[n + W]);
      if (!hasRemovedNeighbour) continue;
      const d = Math.max(
        Math.abs(px[n * 4] - bgR),
        Math.abs(px[n * 4 + 1] - bgG),
        Math.abs(px[n * 4 + 2] - bgB)
      );
      if (d < tol + FEATHER_EXTRA) {
        px[n * 4 + 3] = Math.round(px[n * 4 + 3] * (d - tol) / FEATHER_EXTRA);
      }
    }
  }

  // Static images: decode once, apply BFS, done.
  // Returns Promise<{ el: HTMLCanvasElement, destroy: () => void }>
  function createStaticSprite(src, { tolerance = TOL_DEFAULT, displayWidth = 0, displayHeight = 0 } = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const W = displayWidth  || img.naturalWidth;
        const H = displayHeight || img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, W, H);
        try {
          const data = ctx.getImageData(0, 0, W, H);
          _removeBackground(data.data, W, H, tolerance);
          ctx.putImageData(data, 0, 0);
        } catch (_) {}
        resolve({ el: canvas, destroy: () => {} });
      };
      img.onerror = () => reject(new Error('ChromaRenderer: failed to load "' + src + '"'));
      img.src = src;
    });
  }

  // GIF sprites: let the browser decode and animate natively via <img>,
  // then capture the current frame to a canvas on every rAF tick and apply
  // BFS chroma key at display resolution. Resolves as soon as img.onload
  // fires (first frame ready) — typically < 100 ms even for large files.
  //
  // displayWidth / displayHeight: render at this size (defaults to natural).
  // Smaller values = faster per-frame BFS. Unit icons use 48×48; attack
  // overlays use a larger cap set by the caller.
  //
  // Returns Promise<{ el: HTMLCanvasElement, destroy: () => void }>
  function createGifSprite(src, { tolerance = TOL_DEFAULT, displayWidth = 0, displayHeight = 0 } = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        const W = displayWidth  || img.naturalWidth;
        const H = displayHeight || img.naturalHeight;

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let rafId;
        function tick() {
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          try {
            const imgData = ctx.getImageData(0, 0, W, H);
            _removeBackground(imgData.data, W, H, tolerance);
            ctx.putImageData(imgData, 0, 0);
          } catch (_) { /* cross-origin security guard — serve over HTTP */ }
          rafId = requestAnimationFrame(tick);
        }
        rafId = requestAnimationFrame(tick);

        resolve({ el: canvas, destroy: () => cancelAnimationFrame(rafId) });
      };
      img.onerror = () => reject(new Error('ChromaRenderer: failed to load "' + src + '"'));
      img.src = src;
    });
  }

  // Dispatches to GIF or static handler based on file extension.
  function createSprite(src, opts) {
    if (src.toLowerCase().endsWith('.gif')) return createGifSprite(src, opts);
    return createStaticSprite(src, opts);
  }

  window.ChromaRenderer = { createSprite, createStaticSprite, createGifSprite };
})();
