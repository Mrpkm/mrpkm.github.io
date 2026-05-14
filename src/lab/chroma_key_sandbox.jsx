import { useState, useRef, useEffect } from 'react';
import { Upload, Pipette, RefreshCw, Film, Image as ImageIcon, Move, Layers, Wand2, AlertTriangle, Keyboard } from 'lucide-react';

export default function ChromaKeySandbox() {
  const [bgUrl, setBgUrl] = useState(null);
  const [bgNatural, setBgNatural] = useState({ w: 1024, h: 1024 });
  const [hasGif, setHasGif] = useState(false);
  const [gifSize, setGifSize] = useState({ w: 0, h: 0 });
  const [frameCount, setFrameCount] = useState(0);
  const [keyColor, setKeyColor] = useState({ r: 168, g: 230, b: 116 });
  const [tolerance, setTolerance] = useState(60);
  const [pickerMode, setPickerMode] = useState(false);
  const [position, setPosition] = useState({ x: 0.4, y: 0.4 }); // normalized 0..1 over stage
  const [rotation, setRotation] = useState(0); // degrees, 0=N, 90=E, 180=S, 270=W
  const [scale, setScale] = useState(0.5);
  const [moveSpeed, setMoveSpeed] = useState(0.4); // normalized units / second
  const [pixelated, setPixelated] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Refs for things that should NOT trigger re-render
  const framesRef = useRef([]);              // [{ image: VideoFrame, duration: ms }]
  const currentFrameIdxRef = useRef(0);
  const keyColorRef = useRef(keyColor);
  const toleranceRef = useRef(tolerance);
  const rotationRef = useRef(rotation);
  const moveSpeedRef = useRef(moveSpeed);
  const pressedKeysRef = useRef({ up: false, down: false, left: false, right: false });

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  /* keep refs in sync with state */
  useEffect(() => { keyColorRef.current = keyColor; }, [keyColor]);
  useEffect(() => { toleranceRef.current = tolerance; }, [tolerance]);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);
  useEffect(() => { moveSpeedRef.current = moveSpeed; }, [moveSpeed]);

  /* ------------------------- File handling ------------------------- */
  const handleGifUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    if (typeof window.ImageDecoder === 'undefined') {
      setErrorMsg('Your browser does not support the ImageDecoder API. Try a recent Chrome, Edge, Firefox, or Safari.');
      return;
    }
    try {
      const supported = await window.ImageDecoder.isTypeSupported('image/gif');
      if (!supported) {
        setErrorMsg('GIF decoding is not supported in this browser.');
        return;
      }
    } catch {
      // some browsers throw — fall through and try anyway
    }

    try {
      // Free memory from any previous GIF
      framesRef.current.forEach((f) => { try { f.image.close?.(); } catch {} });
      framesRef.current = [];
      setHasGif(false);
      setFrameCount(0);

      const buffer = await file.arrayBuffer();
      const decoder = new window.ImageDecoder({
        data: buffer,
        type: file.type || 'image/gif',
      });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const count = track.frameCount || 1;

      const frames = [];
      for (let i = 0; i < count; i++) {
        // eslint-disable-next-line no-await-in-loop
        const result = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
        // image.duration is in microseconds; clamp to a sensible minimum
        const durMs = (result.image.duration || 100000) / 1000;
        frames.push({
          image: result.image,
          duration: Math.max(20, durMs),
        });
      }

      if (!frames.length) {
        setErrorMsg('No frames could be decoded from this file.');
        return;
      }

      framesRef.current = frames;
      currentFrameIdxRef.current = 0;
      setGifSize({ w: frames[0].image.displayWidth, h: frames[0].image.displayHeight });
      setFrameCount(frames.length);
      setHasGif(true);
      detectKeyColorFromFrame(frames[0].image);
    } catch (err) {
      console.error(err);
      setErrorMsg(`Could not decode GIF: ${err.message || err}`);
    }
  };

  const handleBgUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const probe = new Image();
      probe.onload = () => setBgNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
      probe.src = dataUrl;
      setBgUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  /* ------------------------- Auto-detect chroma key color ------------------------- */
  const detectKeyColorFromFrame = (videoFrame) => {
    const W = videoFrame.displayWidth;
    const H = videoFrame.displayHeight;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoFrame, 0, 0);
    const samples = [
      [2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3],
      [W >> 1, 2], [W >> 1, H - 3], [2, H >> 1], [W - 3, H >> 1],
    ];
    let r = 0, g = 0, b = 0, n = 0;
    for (const [x, y] of samples) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      r += d[0]; g += d[1]; b += d[2]; n++;
    }
    setKeyColor({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) });
  };

  /* ------------------------- Frame playback + chroma key ------------------------- */
  // Drawing reads chroma settings from refs so slider changes don't restart playback.
  useEffect(() => {
    if (!hasGif || !canvasRef.current || gifSize.w === 0) return;
    const canvas = canvasRef.current;
    canvas.width = gifSize.w;
    canvas.height = gifSize.h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const drawCurrentFrame = () => {
      const frames = framesRef.current;
      if (!frames.length) return;
      const idx = currentFrameIdxRef.current % frames.length;
      const frame = frames[idx];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame.image, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = imgData.data;
      const tol = toleranceRef.current;
      const tol2 = tol * tol;
      const { r: kr, g: kg, b: kb } = keyColorRef.current;
      for (let i = 0; i < px.length; i += 4) {
        const dr = px[i] - kr;
        const dg = px[i + 1] - kg;
        const db = px[i + 2] - kb;
        if (dr * dr + dg * dg + db * db < tol2) {
          px[i + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };

    let cancelled = false;
    let timeoutId = null;

    const tick = () => {
      if (cancelled) return;
      const frames = framesRef.current;
      if (!frames.length) return;
      drawCurrentFrame();
      const frame = frames[currentFrameIdxRef.current % frames.length];
      timeoutId = setTimeout(() => {
        currentFrameIdxRef.current = (currentFrameIdxRef.current + 1) % frames.length;
        tick();
      }, frame.duration);
    };

    // Listen for an external "redraw now" signal so chroma slider changes
    // give immediate feedback instead of waiting for the next frame.
    const onRedraw = () => drawCurrentFrame();
    window.addEventListener('chroma-redraw', onRedraw);

    tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('chroma-redraw', onRedraw);
    };
    // Only restart when the GIF itself changes
  }, [hasGif, gifSize.w, gifSize.h, frameCount]);

  // Trigger an immediate redraw whenever chroma settings change
  useEffect(() => {
    window.dispatchEvent(new Event('chroma-redraw'));
  }, [keyColor, tolerance]);

  /* ------------------------- Drag + pick ------------------------- */
  const onCanvasPointerDown = (e) => {
    if (pickerMode && framesRef.current.length) {
      const canvas = canvasRef.current;
      // Get the canvas's rotated bounding box, find its center
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Click delta from center, in viewport pixels
      const dxView = e.clientX - cx;
      const dyView = e.clientY - cy;
      // Inverse the canvas's rotation to get coords in the unrotated canvas frame
      const rad = (rotation * Math.PI) / 180;
      const cs = Math.cos(rad);
      const sn = Math.sin(rad);
      const dxLocal = dxView * cs + dyView * sn;
      const dyLocal = -dxView * sn + dyView * cs;
      // Map screen-pixels to canvas-bitmap pixels.
      // Note: rect is the rotated AABB, so its size != display size when rotated.
      // The unrotated display size is spriteW × spriteH, so we use that.
      const scaleX = canvas.width / spriteW;
      const scaleY = canvas.height / spriteH;
      const x = Math.round(dxLocal * scaleX + canvas.width / 2);
      const y = Math.round(dyLocal * scaleY + canvas.height / 2);

      const t = document.createElement('canvas');
      t.width = canvas.width;
      t.height = canvas.height;
      const tctx = t.getContext('2d', { willReadFrequently: true });
      const idx = currentFrameIdxRef.current % framesRef.current.length;
      tctx.drawImage(framesRef.current[idx].image, 0, 0);
      const xx = Math.max(0, Math.min(x, canvas.width - 1));
      const yy = Math.max(0, Math.min(y, canvas.height - 1));
      const d = tctx.getImageData(xx, yy, 1, 1).data;
      setKeyColor({ r: d[0], g: d[1], b: d[2] });
      setPickerMode(false);
      return;
    }
    draggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current || !stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragStartRef.current.x) / rect.width;
      const dy = (e.clientY - dragStartRef.current.y) / rect.height;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };
    const onUp = () => { draggingRef.current = false; };
    const onTouchMove = (e) => {
      if (!draggingRef.current || !e.touches[0]) return;
      onMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  /* ------------------------- Keyboard: WASD rotation + arrow movement ------------------------- */
  useEffect(() => {
    const isTextInput = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };

    const onKeyDown = (e) => {
      if (isTextInput(e.target)) return;
      const k = e.key.toLowerCase();

      // WASD => set rotation (compass directions, 0=N going clockwise)
      if (k === 'w') { setRotation(0); e.preventDefault(); return; }
      if (k === 'd') { setRotation(90); e.preventDefault(); return; }
      if (k === 's') { setRotation(180); e.preventDefault(); return; }
      if (k === 'a') { setRotation(270); e.preventDefault(); return; }

      // Arrow keys => continuous movement
      if (e.key === 'ArrowUp')    { pressedKeysRef.current.up = true;    e.preventDefault(); }
      if (e.key === 'ArrowDown')  { pressedKeysRef.current.down = true;  e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { pressedKeysRef.current.left = true;  e.preventDefault(); }
      if (e.key === 'ArrowRight') { pressedKeysRef.current.right = true; e.preventDefault(); }
    };

    const onKeyUp = (e) => {
      if (e.key === 'ArrowUp')    pressedKeysRef.current.up = false;
      if (e.key === 'ArrowDown')  pressedKeysRef.current.down = false;
      if (e.key === 'ArrowLeft')  pressedKeysRef.current.left = false;
      if (e.key === 'ArrowRight') pressedKeysRef.current.right = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // rAF loop for smooth arrow-key movement (independent of frame rate)
  useEffect(() => {
    let rafId = null;
    let lastT = performance.now();
    const tick = (now) => {
      const dt = (now - lastT) / 1000;
      lastT = now;
      const k = pressedKeysRef.current;
      if (k.up || k.down || k.left || k.right) {
        const speed = moveSpeedRef.current * dt;
        let dx = 0, dy = 0;
        if (k.up) dy -= speed;
        if (k.down) dy += speed;
        if (k.left) dx -= speed;
        if (k.right) dx += speed;
        setPosition((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  /* ------------------------- Cleanup on unmount ------------------------- */
  useEffect(() => {
    return () => {
      framesRef.current.forEach((f) => { try { f.image.close?.(); } catch {} });
      framesRef.current = [];
    };
  }, []);

  /* ------------------------- Layout maths ------------------------- */
  const stageMaxW = 640;
  const stageW = stageMaxW;
  const stageH = bgUrl ? Math.round(stageMaxW * (bgNatural.h / bgNatural.w)) : 480;
  const spriteW = gifSize.w ? gifSize.w * scale * 0.6 : 0;
  const spriteH = gifSize.h ? gifSize.h * scale * 0.6 : 0;

  const keyHex = `#${[keyColor.r, keyColor.g, keyColor.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-pixel { font-family: 'Press Start 2P', ui-monospace, monospace; letter-spacing: 0.02em; }
        .font-mono-x { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .pixelated { image-rendering: pixelated; image-rendering: crisp-edges; }
        .checker {
          background-image:
            linear-gradient(45deg, #14142a 25%, transparent 25%),
            linear-gradient(-45deg, #14142a 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #14142a 75%),
            linear-gradient(-45deg, transparent 75%, #14142a 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0;
          background-color: #0a0a18;
        }
        .scanlines::after {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px);
          pointer-events: none;
          mix-blend-mode: multiply;
        }
        .glow-lime { box-shadow: 0 0 0 2px #0a0a18, 0 0 0 4px #a8e674, 0 0 24px -2px rgba(168,230,116,0.45); }
        .btn-pixel {
          font-family: 'Press Start 2P', monospace;
          font-size: 10px;
          padding: 10px 14px;
          background: #1a1a2e;
          color: #e8ffd4;
          border: 2px solid #2a2a44;
          box-shadow: inset 0 -3px 0 0 rgba(0,0,0,0.4), 0 2px 0 #0a0a18;
          transition: transform 0.06s, box-shadow 0.06s, background 0.12s;
          cursor: pointer;
          user-select: none;
        }
        .btn-pixel:hover { background: #232342; }
        .btn-pixel:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 0 rgba(0,0,0,0.4), 0 0 0 #0a0a18; }
        .btn-pixel.active { background: #a8e674; color: #0a0a18; border-color: #d6ffae; }
        .btn-pixel:disabled { opacity: 0.4; cursor: not-allowed; }
        input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; }
        input[type="range"]::-webkit-slider-runnable-track { height: 8px; background: #1a1a2e; border: 2px solid #2a2a44; }
        input[type="range"]::-moz-range-track { height: 8px; background: #1a1a2e; border: 2px solid #2a2a44; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 14px; background: #a8e674; border: 2px solid #0a0a18; margin-top: -7px; cursor: grab; }
        input[type="range"]::-moz-range-thumb { height: 18px; width: 14px; background: #a8e674; border: 2px solid #0a0a18; cursor: grab; border-radius: 0; }
      `}</style>

      <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-mono-x" style={{ background: 'radial-gradient(ellipse at top, #14142a 0%, #06060f 70%)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <header className="mb-8 border-b-2 border-dashed border-slate-700 pb-6">
            <div className="flex items-end gap-3 mb-2 flex-wrap">
              <h1 className="font-pixel text-2xl md:text-3xl text-lime-300 leading-tight">CHROMA<span className="text-amber-300">·</span>KEY</h1>
              <span className="font-pixel text-[10px] text-slate-500 mb-1">v0.2 // sprite sandbox</span>
            </div>
            <p className="text-slate-400 text-sm">Drop a GIF with a flat background and an image to drop it on. Drag the sprite anywhere.</p>
          </header>

          {/* Error */}
          {errorMsg && (
            <div className="mb-4 border-2 border-red-500/50 bg-red-950/40 px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-pixel text-[10px] text-red-300 mb-1">decode error</div>
                <div className="text-sm text-red-100">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Upload row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <UploadCard
              label="01 // Sprite (GIF)"
              icon={<Film size={18} />}
              fileName={hasGif ? `sprite loaded · ${frameCount} frames` : null}
              accept="image/gif,image/webp,image/png,image/apng"
              onChange={handleGifUpload}
              accent="lime"
            />
            <UploadCard
              label="02 // Background"
              icon={<ImageIcon size={18} />}
              fileName={bgUrl ? 'background loaded' : null}
              accept="image/*"
              onChange={handleBgUpload}
              accent="amber"
            />
          </div>

          {/* Stage */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-lime-300" />
              <span className="font-pixel text-[10px] text-slate-400">// stage</span>
            </div>
            <div
              ref={stageRef}
              className="relative mx-auto checker glow-lime overflow-hidden"
              style={{ width: stageW, maxWidth: '100%', height: stageH, aspectRatio: `${bgNatural.w} / ${bgNatural.h}` }}
            >
              {bgUrl && (
                <img
                  src={bgUrl}
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover ${pixelated ? 'pixelated' : ''}`}
                  draggable={false}
                />
              )}
              {hasGif && gifSize.w > 0 && (
                <div
                  onMouseDown={onCanvasPointerDown}
                  onTouchStart={(e) => {
                    if (!e.touches[0]) return;
                    onCanvasPointerDown({
                      clientX: e.touches[0].clientX,
                      clientY: e.touches[0].clientY,
                      preventDefault: () => {},
                    });
                  }}
                  className="absolute select-none"
                  style={{
                    left: `${position.x * 100}%`,
                    top: `${position.y * 100}%`,
                    width: spriteW,
                    height: spriteH,
                    cursor: pickerMode ? 'crosshair' : 'grab',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      transform: `rotate(${rotation}deg)`,
                      transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      filter: 'drop-shadow(2px 4px 0 rgba(0,0,0,0.4))',
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      className={`w-full h-full ${pixelated ? 'pixelated' : ''}`}
                      style={{ display: 'block' }}
                    />
                  </div>
                </div>
              )}
              {!bgUrl && !hasGif && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Move size={32} className="mx-auto mb-3 text-slate-600" />
                    <p className="font-pixel text-[10px] text-slate-500">upload a sprite + background</p>
                  </div>
                </div>
              )}
              {!bgUrl && hasGif && (
                <div className="absolute top-3 right-3 font-pixel text-[8px] text-slate-500 bg-slate-900/80 px-2 py-1">no background yet</div>
              )}
            </div>
            <p className="text-center text-xs text-slate-500 mt-3">
              {pickerMode
                ? <span className="text-amber-300 font-pixel text-[10px]">// click a sprite pixel to set it transparent</span>
                : <>drag with mouse · <span className="text-lime-300">arrows</span> move · <span className="text-amber-300">WASD</span> rotate</>}
            </p>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 border-t-2 border-dashed border-slate-700 pt-6">
            {/* Left: key color */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wand2 size={14} className="text-lime-300" />
                <span className="font-pixel text-[10px] text-slate-400">// chroma key</span>
              </div>
              <div className="bg-slate-900/60 border-2 border-slate-800 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 border-2 border-slate-700"
                    style={{ background: keyHex, boxShadow: 'inset 0 0 0 2px #0a0a18' }}
                    aria-label="key color swatch"
                  />
                  <div className="flex-1">
                    <div className="font-pixel text-[10px] text-slate-300 mb-1">key color</div>
                    <div className="font-mono-x text-xs text-slate-500">
                      rgb({keyColor.r}, {keyColor.g}, {keyColor.b}) · {keyHex}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`btn-pixel ${pickerMode ? 'active' : ''}`}
                    onClick={() => setPickerMode((p) => !p)}
                    disabled={!hasGif}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Pipette size={12} /> {pickerMode ? 'cancel' : 'pick'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-pixel"
                    onClick={() => {
                      const f = framesRef.current[0];
                      if (f) detectKeyColorFromFrame(f.image);
                    }}
                    disabled={!hasGif}
                  >
                    <span className="inline-flex items-center gap-2"><RefreshCw size={12} /> redetect</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: sliders */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Move size={14} className="text-amber-300" />
                <span className="font-pixel text-[10px] text-slate-400">// transform</span>
              </div>
              <div className="bg-slate-900/60 border-2 border-slate-800 p-4 space-y-5">
                <SliderRow
                  label="tolerance"
                  value={tolerance}
                  min={0}
                  max={200}
                  onChange={setTolerance}
                  hint="how aggressively similar colors get cut"
                />
                <SliderRow
                  label="scale"
                  value={scale}
                  min={0.1}
                  max={2}
                  step={0.05}
                  onChange={setScale}
                  display={`${scale.toFixed(2)}×`}
                />
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[10px] text-slate-300">pixelated rendering</span>
                  <button
                    type="button"
                    className={`btn-pixel ${pixelated ? 'active' : ''}`}
                    onClick={() => setPixelated((p) => !p)}
                  >
                    {pixelated ? 'on' : 'off'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Controls / keyboard */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Keyboard size={14} className="text-lime-300" />
              <span className="font-pixel text-[10px] text-slate-400">// controls</span>
            </div>
            <div className="bg-slate-900/60 border-2 border-slate-800 p-4 grid grid-cols-1 md:grid-cols-[auto_1fr_1fr] gap-6 items-center">
              {/* Compass */}
              <div className="flex items-center justify-center">
                <CompassDial rotation={rotation} />
              </div>

              {/* Keyboard legend */}
              <div>
                <div className="font-pixel text-[10px] text-slate-300 mb-3">keys</div>
                <div className="flex flex-wrap gap-3 items-start">
                  <div>
                    <div className="font-pixel text-[8px] text-amber-300 mb-1">rotate</div>
                    <KeyCluster
                      keys={{ up: 'W', down: 'S', left: 'A', right: 'D' }}
                      activeKey={rotation === 0 ? 'up' : rotation === 90 ? 'right' : rotation === 180 ? 'down' : rotation === 270 ? 'left' : null}
                    />
                  </div>
                  <div>
                    <div className="font-pixel text-[8px] text-lime-300 mb-1">move</div>
                    <KeyCluster
                      keys={{ up: '↑', down: '↓', left: '←', right: '→' }}
                    />
                  </div>
                </div>
              </div>

              {/* Speed + reset */}
              <div className="space-y-4">
                <SliderRow
                  label="move speed"
                  value={moveSpeed}
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  onChange={setMoveSpeed}
                  display={`${moveSpeed.toFixed(2)}/s`}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-pixel"
                    onClick={() => { setPosition({ x: 0.5, y: 0.5 }); setRotation(0); }}
                  >
                    re-center
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  click the stage area first if keys don't respond — your browser may need it focused.
                </p>
              </div>
            </div>
          </div>

          <footer className="mt-10 text-center font-pixel text-[8px] text-slate-600">
            ★ press · drag · paint ★
          </footer>
        </div>
      </div>
    </>
  );
}

function UploadCard({ label, icon, fileName, accept, onChange, accent = 'lime' }) {
  const inputRef = useRef(null);
  const accentClass = accent === 'lime' ? 'border-lime-700' : 'border-amber-700';
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={`relative bg-slate-900/60 border-2 border-dashed ${fileName ? 'border-slate-700' : accentClass} p-5 text-left hover:bg-slate-900 transition-colors group cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`font-pixel text-[10px] ${accent === 'lime' ? 'text-lime-300' : 'text-amber-300'}`}>{label}</span>
        <span className="text-slate-500 group-hover:text-slate-300 transition-colors">{icon}</span>
      </div>
      <div className="flex items-center gap-3">
        <Upload size={20} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
        <div>
          <div className="text-sm text-slate-200">{fileName || 'click to upload'}</div>
          <div className="text-xs text-slate-500">{fileName ? 'tap to replace' : accept.replace(/image\//g, '').replace(/,/g, ' · ')}</div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
      />
    </button>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange, display, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-pixel text-[10px] text-slate-300">{label}</span>
        <span className="font-mono-x text-xs text-lime-300">{display ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <div className="text-[10px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function CompassDial({ rotation }) {
  // The needle points "up" by default and rotates with the sprite's rotation
  return (
    <div className="relative w-20 h-20">
      <div className="absolute inset-0 rounded-full border-2 border-slate-700 bg-slate-950" />
      <div className="absolute inset-0 flex items-start justify-center pt-1 font-pixel text-[8px] text-amber-300">N</div>
      <div className="absolute inset-0 flex items-end justify-center pb-1 font-pixel text-[8px] text-slate-500">S</div>
      <div className="absolute inset-0 flex items-center justify-start pl-1 font-pixel text-[8px] text-slate-500">W</div>
      <div className="absolute inset-0 flex items-center justify-end pr-1 font-pixel text-[8px] text-slate-500">E</div>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div className="w-0.5 h-7 bg-lime-300" style={{ transformOrigin: 'bottom center', transform: 'translateY(-50%)' }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-lime-300 ring-2 ring-slate-950" />
      </div>
    </div>
  );
}

function KeyCluster({ keys, activeKey }) {
  const KeyCap = ({ children, active }) => (
    <div
      className={`w-7 h-7 flex items-center justify-center font-pixel text-[10px] border-2 ${
        active ? 'bg-lime-300 text-slate-950 border-lime-200' : 'bg-slate-800 text-slate-300 border-slate-700'
      }`}
      style={{ boxShadow: active ? 'inset 0 -2px 0 rgba(0,0,0,0.3)' : 'inset 0 -2px 0 rgba(0,0,0,0.4)' }}
    >
      {children}
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-1 w-fit">
      <div />
      <KeyCap active={activeKey === 'up'}>{keys.up}</KeyCap>
      <div />
      <KeyCap active={activeKey === 'left'}>{keys.left}</KeyCap>
      <KeyCap active={activeKey === 'down'}>{keys.down}</KeyCap>
      <KeyCap active={activeKey === 'right'}>{keys.right}</KeyCap>
    </div>
  );
}
