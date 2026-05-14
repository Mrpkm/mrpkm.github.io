// chroma-renderer.js — Background-removal utility for unit sprites.
// Exposes window.ChromaRenderer. Loaded as a plain <script> (IIFE, no ES module).
//
// Algorithm: BFS flood-fill from all 4 corners with Chebyshev colour tolerance.
// Same algorithm as the chromaKey() function in pregame-setup.html, extended to
// support animated GIFs via the ImageDecoder API.
//
// API:
//   ChromaRenderer.createSprite(src, { tolerance }) → Promise<{ el, destroy }>
//   ChromaRenderer.createStaticSprite(src, { tolerance }) → Promise<{ el, destroy }>
//   ChromaRenderer.createGifSprite(src, { tolerance }) → Promise<{ el, destroy }>

(function () {
  'use strict';

  const TOL_DEFAULT = 45;
  const FEATHER_EXTRA = 25; // alpha ramp width past the hard tolerance

  // Modifies px (Uint8ClampedArray, RGBA) in-place.
  // Removes the background region connected to the four corners.
  function _removeBackground(px, W, H, tol) {
    // Sample corners to derive background colour.
    let sR = 0, sG = 0, sB = 0, cnt = 0;
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
      const i = (y * W + x) * 4;
      if (px[i + 3] > 0) { sR += px[i]; sG += px[i + 1]; sB += px[i + 2]; cnt++; }
    }
    if (!cnt) return; // all corners transparent — nothing to remove

    const bgR = sR / cnt, bgG = sG / cnt, bgB = sB / cnt;

    function isClose(pi) {
      return px[pi + 3] > 0 &&
        Math.max(
          Math.abs(px[pi] - bgR),
          Math.abs(px[pi + 1] - bgG),
          Math.abs(px[pi + 2] - bgB)
        ) <= tol;
    }

    // BFS flood-fill from all 4 corners — only removes connected background.
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

  // Returns Promise<{ el: HTMLCanvasElement, destroy: () => void }>
  function createStaticSprite(src, { tolerance = TOL_DEFAULT } = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const W = img.naturalWidth, H = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        try {
          const data = ctx.getImageData(0, 0, W, H);
          _removeBackground(data.data, W, H, tolerance);
          ctx.putImageData(data, 0, 0);
        } catch (_) {
          // SecurityError from cross-origin canvas — serve over HTTP to avoid this.
        }
        resolve({ el: canvas, destroy: () => {} });
      };
      img.onerror = () => reject(new Error('ChromaRenderer: failed to load "' + src + '"'));
      img.src = src;
    });
  }

  // Returns Promise<{ el: HTMLCanvasElement, destroy: () => void }>
  // Decodes GIF frames via ImageDecoder, applies BFS removal per frame, animates.
  function createGifSprite(src, { tolerance = TOL_DEFAULT } = {}) {
    if (typeof window.ImageDecoder === 'undefined') {
      // ImageDecoder not available — fall through to static render of first frame.
      return createStaticSprite(src, { tolerance });
    }

    return fetch(src)
      .then(r => {
        if (!r.ok) throw new Error('ChromaRenderer: HTTP ' + r.status + ' loading "' + src + '"');
        return r.arrayBuffer();
      })
      .then(async buffer => {
        const decoder = new window.ImageDecoder({ data: buffer, type: 'image/gif' });
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const count = track.frameCount || 1;

        const frames = [];
        for (let i = 0; i < count; i++) {
          // eslint-disable-next-line no-await-in-loop
          const result = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
          const vf = result.image;
          const W = vf.displayWidth, H = vf.displayHeight;

          const tmp = document.createElement('canvas');
          tmp.width = W; tmp.height = H;
          const ctx = tmp.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(vf, 0, 0);
          const imgData = ctx.getImageData(0, 0, W, H);
          _removeBackground(imgData.data, W, H, tolerance);

          frames.push({
            data: imgData,
            duration: Math.max(20, (vf.duration || 100000) / 1000),
            W, H,
          });
          try { vf.close(); } catch (_) {}
        }

        if (!frames.length) throw new Error('ChromaRenderer: no frames decoded from "' + src + '"');

        const canvas = document.createElement('canvas');
        canvas.width = frames[0].W;
        canvas.height = frames[0].H;
        const ctx = canvas.getContext('2d');

        let frameIdx = 0;
        let timeoutId = null;

        function tick() {
          ctx.putImageData(frames[frameIdx].data, 0, 0);
          const dur = frames[frameIdx].duration;
          timeoutId = setTimeout(() => {
            frameIdx = (frameIdx + 1) % frames.length;
            tick();
          }, dur);
        }
        tick();

        return {
          el: canvas,
          destroy: () => { if (timeoutId !== null) clearTimeout(timeoutId); },
        };
      });
  }

  // createSprite: dispatches to GIF or static handler based on file extension.
  function createSprite(src, opts) {
    if (src.toLowerCase().endsWith('.gif')) return createGifSprite(src, opts);
    return createStaticSprite(src, opts);
  }

  window.ChromaRenderer = { createSprite, createStaticSprite, createGifSprite };
})();
