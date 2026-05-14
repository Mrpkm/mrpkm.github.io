// map-builder.jsx  (lives in src/menu/ so Babel can load it same-directory)
// Map Builder — reachable via menu > play game > board.
//
// Dependencies (loaded before this file):
//   window.Pathfinder    (pathfinder.js)   — BFS for move-animation
//   window.UnitMovement  (unit-movement.js) — game-spec reachable-tile calculation
//
// Exposed:  window.MapBuilder  (React component)
//
// Board state shape (Option C / hybrid):
//   grid[r][c]    : Int8Array   — terrain index (-1 = empty)
//   decorations   : Map<"r,c", {src, name}>  — one PNG per tile (static)
//   units         : UnitRecord[]  — {id, r, c, type, facing, rank}
//   unitIndex     : Map<"r,c", id>           — fast cell lookup

(function () {
  'use strict';
  const {
    useState, useRef, useEffect, useCallback, useMemo,
  } = React;

  // ── Constants ────────────────────────────────────────────────────────────

  const EMPTY = -1;
  const GRID_MIN = 4, GRID_MAX = 64, GRID_DEFAULT = 16;

  // Terrain types — index must match UnitMovement.js terrain constants
  const TERRAINS = [
    { id: 'grass',    name: 'Grasslands', color: '#5fa83a', accent: '#7fc04f' },
    { id: 'swamp',    name: 'Swamp',      color: '#5c5832', accent: '#3a4d4a' },
    { id: 'forest',   name: 'Forest',     color: '#1f5c2f', accent: '#0d3a1c' },
    { id: 'mountain', name: 'Mountains',  color: '#6e7480', accent: '#cdd2d9' },
  ];

  const UNIT_TYPES = [
    { id: 'infantry',  name: 'Infantry',   abbr: 'INF', color: '#3b82f6', hp: 4,  str: 1,   def: 0   },
    { id: 'cavalry',   name: 'Cavalry',    abbr: 'CAV', color: '#8b5cf6', hp: 3,  str: 0.5, def: 1   },
    { id: 'tanks',     name: 'Tanks',      abbr: 'TNK', color: '#ef4444', hp: 8,  str: 3,   def: 3   },
    { id: 'motorized', name: 'Motorized',  abbr: 'MOT', color: '#f59e0b', hp: 6,  str: 2,   def: 1   },
    { id: 'artillery', name: 'Artillery',  abbr: 'ART', color: '#10b981', hp: 2,  str: 3,   def: 0.5 },
  ];

  const FACINGS   = ['N', 'E', 'S', 'W'];
  const DOCTRINES = ['plain', 'blitzkrieg', 'sf'];

  // Tools
  const TOOL_TERRAIN    = 'terrain';
  const TOOL_DECORATION = 'decoration';
  const TOOL_UNIT       = 'unit';
  const TOOL_MOVE       = 'move';
  const TOOL_ERASE      = 'erase';

  // ── SVG tile patterns (verbatim from tile-map-builder.jsx) ──────────────

  function patternSvg(kind, color, accent) {
    const enc = (s) => encodeURIComponent(s);
    const svgs = {
      grass:    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' fill='${color}'/><rect x='3' y='5' width='1' height='3' fill='${accent}'/><rect x='8' y='9' width='1' height='3' fill='${accent}'/><rect x='15' y='4' width='1' height='3' fill='${accent}'/><rect x='19' y='13' width='1' height='3' fill='${accent}'/><rect x='5' y='17' width='1' height='3' fill='${accent}'/><rect x='13' y='19' width='1' height='3' fill='${accent}'/></svg>`,
      swamp:    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' fill='${color}'/><ellipse cx='8' cy='10' rx='5' ry='3' fill='#2d5050'/><ellipse cx='17' cy='17' rx='4' ry='2.5' fill='#2d5050'/><rect x='3' y='3' width='1' height='2' fill='#1a3020'/><rect x='14' y='4' width='1' height='2' fill='#1a3020'/></svg>`,
      forest:   `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' fill='#3a8049'/><polygon points='6,4 9,11 3,11' fill='${color}'/><polygon points='6,8 10,16 2,16' fill='${color}'/><rect x='5' y='16' width='2' height='2' fill='#4a2a1a'/><polygon points='17,5 20,12 14,12' fill='${accent}'/><polygon points='17,9 21,17 13,17' fill='${accent}'/><rect x='16' y='17' width='2' height='2' fill='#4a2a1a'/></svg>`,
      mountain: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' fill='#4a8030'/><polygon points='12,3 22,21 2,21' fill='${color}'/><polygon points='12,3 18,12 12,12' fill='${accent}'/><polygon points='12,3 14,7 10,7' fill='#ffffff'/><polygon points='5,14 9,21 1,21' fill='#5a626e'/></svg>`,
    };
    return `data:image/svg+xml;utf8,${enc(svgs[kind] || svgs.grass)}`;
  }
  const terrainSrc = (t) => patternSvg(t.id, t.color, t.accent);

  // ── Board utilities ──────────────────────────────────────────────────────

  const cellKey = (r, c) => `${r},${c}`;
  const makeGrid = (h, w) =>
    Array.from({ length: h }, () => new Int8Array(w).fill(EMPTY));

  function buildUnitIndex(units) {
    const idx = new Map();
    for (const u of units) idx.set(cellKey(u.r, u.c), u.id);
    return idx;
  }

  let nextUnitId = 1;
  const newUnit = (r, c, type, facing) => ({
    id: nextUnitId++,
    r, c,
    type,
    facing: facing || 'N',
    rank: 'Corporal',
  });

  // ── Crop transparent borders (from tile-map-builder.jsx) ────────────────

  function cropTransparent(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        if (!w || !h) { resolve(dataUrl); return; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let imgData;
        try { imgData = ctx.getImageData(0, 0, w, h); } catch { resolve(dataUrl); return; }
        const d = imgData.data;
        let minX = w, maxX = -1, minY = h, maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3] > 8) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX === -1 || (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1)) {
          resolve(dataUrl); return;
        }
        const cw = maxX - minX + 1, ch = maxY - minY + 1;
        const out = document.createElement('canvas');
        out.width = cw; out.height = ch;
        const octx = out.getContext('2d');
        octx.imageSmoothingEnabled = false;
        octx.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
        resolve(out.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // ── GIF sprite system (pattern from sprite-quest.jsx) ───────────────────
  // One sprite slot per unit type. All tokens of a type share the same frameIdx
  // (synchronized animation). Frames stored in a ref (VideoFrame[] are not React-y).

  function useUnitSprites() {
    const [sprites, setSprites] = useState(() =>
      Object.fromEntries(UNIT_TYPES.map((u) => [u.id, null]))
    );
    const timerRefs  = useRef({});
    const framesRefs = useRef({}); // { [type]: [{image: VideoFrame, duration: ms}] }

    const stopLoop = useCallback((type) => {
      clearTimeout(timerRefs.current[type]);
      timerRefs.current[type] = null;
    }, []);

    const startLoop = useCallback((type) => {
      stopLoop(type);
      let cur = 0;
      const tick = () => {
        const fs = framesRefs.current[type];
        if (!fs?.length) return;
        cur = (cur + 1) % fs.length;
        setSprites((prev) =>
          prev[type] ? { ...prev, [type]: { ...prev[type], frameIdx: cur } } : prev
        );
        timerRefs.current[type] = setTimeout(tick, fs[cur].duration);
      };
      const fs = framesRefs.current[type];
      if (fs?.length) timerRefs.current[type] = setTimeout(tick, fs[0].duration);
    }, [stopLoop]);

    const loadGif = useCallback(async (type, file) => {
      if (typeof window.ImageDecoder === 'undefined') {
        alert('GIF animation requires the ImageDecoder API (Chrome 94+, Edge 94+, Firefox 133+).\nPlaceholder token will be used instead.');
        return;
      }
      try {
        stopLoop(type);
        const buf = await file.arrayBuffer();
        const dec = new window.ImageDecoder({ data: buf, type: file.type || 'image/gif' });
        await dec.tracks.ready;
        const count = dec.tracks.selectedTrack.frameCount || 1;
        const frames = [];
        for (let i = 0; i < count; i++) {
          const res = await dec.decode({ frameIndex: i, completeFramesOnly: true });
          frames.push({
            image: res.image,
            duration: Math.max(20, (res.image.duration || 100000) / 1000),
          });
        }
        if (!frames.length) return;
        const w = frames[0].image.displayWidth;
        const h = frames[0].image.displayHeight;
        const tmpC = document.createElement('canvas');
        tmpC.width = w; tmpC.height = h;
        const tmpCtx = tmpC.getContext('2d');
        tmpCtx.drawImage(frames[0].image, 0, 0);
        const corner = tmpCtx.getImageData(0, 0, 1, 1).data;
        const keyColor = { r: corner[0], g: corner[1], b: corner[2] };
        framesRefs.current[type] = frames;
        setSprites((prev) => ({ ...prev, [type]: { frameIdx: 0, w, h, keyColor } }));
        startLoop(type);
      } catch (err) {
        console.error('GIF load error:', err);
      }
    }, [stopLoop, startLoop]);

    const clearSprite = useCallback((type) => {
      stopLoop(type);
      const old = framesRefs.current[type] || [];
      old.forEach((f) => { try { f.image.close?.(); } catch {} });
      framesRefs.current[type] = null;
      setSprites((prev) => ({ ...prev, [type]: null }));
    }, [stopLoop]);

    useEffect(() => () => {
      Object.keys(timerRefs.current).forEach(stopLoop);
      Object.entries(framesRefs.current).forEach(([, fs]) => {
        (fs || []).forEach((f) => { try { f.image.close?.(); } catch {} });
      });
    }, [stopLoop]);

    return { sprites, framesRefs, loadGif, clearSprite };
  }

  // ── UnitToken — draws GIF frame or coloured placeholder ─────────────────

  function UnitToken({ typeId, sprites, framesRefs, size }) {
    const canvasRef = useRef(null);
    const sp = sprites[typeId];
    const def = UNIT_TYPES.find((u) => u.id === typeId);

    useEffect(() => {
      if (!sp || !canvasRef.current) return;
      const frames = framesRefs.current[typeId];
      if (!frames?.length) return;
      const frame = frames[sp.frameIdx];
      if (!frame?.image) return;
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(frame.image, 0, 0, size, size);
      if (sp.keyColor) {
        const id = ctx.getImageData(0, 0, size, size);
        const d = id.data;
        const { r: kr, g: kg, b: kb } = sp.keyColor;
        const tol = 50;
        for (let i = 0; i < d.length; i += 4) {
          if (Math.abs(d[i] - kr) < tol && Math.abs(d[i + 1] - kg) < tol && Math.abs(d[i + 2] - kb) < tol) d[i + 3] = 0;
        }
        ctx.putImageData(id, 0, 0);
      }
    }, [sp?.frameIdx, typeId, size, framesRefs]);

    if (sp) {
      return (
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{ display: 'block', imageRendering: 'pixelated' }}
        />
      );
    }
    return (
      <div style={{
        width: size, height: size,
        background: def?.color || '#555',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.max(7, Math.floor(size * 0.3)),
        fontWeight: 700, color: '#fff',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        textShadow: '0 1px 2px rgba(0,0,0,.6)',
        letterSpacing: '0.02em',
      }}>
        {def?.abbr || '?'}
      </div>
    );
  }

  // ── Styles (inline — no extra CSS file) ─────────────────────────────────

  const S = {
    root: {
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      background: 'radial-gradient(ellipse at top,#1a2818 0%,#0a0e0a 50%,#000 100%)',
      color: '#d4e8c4', fontFamily: "'JetBrains Mono','Courier New',monospace",
      fontSize: 12,
    },
    topBar: {
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '8px 14px', borderBottom: '2px solid #2d4a2d',
      background: 'rgba(10,20,10,.7)', flexShrink: 0,
    },
    pixelTitle: {
      fontFamily: "'Press Start 2P','Courier New',monospace",
      fontSize: 11, color: '#fbbf24', letterSpacing: '.05em',
      textShadow: '1px 1px 0 #5c3d05, 0 0 10px rgba(251,191,36,.4)',
    },
    sidebar: {
      width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '2px solid #2d4a2d', overflow: 'hidden',
    },
    sideSection: {
      padding: '10px 12px', borderBottom: '1px solid #2d4a2d',
    },
    sideLabel: {
      fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      color: '#fbbf24', marginBottom: 7, display: 'block',
    },
    btn: (active) => ({
      display: 'flex', alignItems: 'center', gap: 6,
      width: '100%', padding: '6px 10px', marginBottom: 3,
      border: `2px solid ${active ? '#fbbf24' : '#2d4a2d'}`,
      borderRadius: 4, background: active ? 'rgba(251,191,36,.12)' : 'rgba(20,30,20,.7)',
      color: active ? '#fbbf24' : '#9ca3af', fontFamily: 'inherit', fontSize: 11,
      fontWeight: active ? 700 : 400, cursor: 'pointer', textAlign: 'left',
    }),
    inputBox: {
      background: '#0a140a', border: '2px solid #2d4a2d', color: '#d4e8c4',
      fontFamily: 'inherit', fontSize: 12, padding: '4px 8px', borderRadius: 3,
      outline: 'none', boxShadow: 'inset 0 2px 0 rgba(0,0,0,.5)',
      width: '100%',
    },
    pill: (active) => ({
      padding: '3px 10px', border: `1px solid ${active ? '#fbbf24' : '#2d4a2d'}`,
      borderRadius: 12, background: active ? '#fbbf24' : 'transparent',
      color: active ? '#1a1208' : '#9ca3af', fontSize: 10, fontWeight: 700,
      cursor: 'pointer', fontFamily: 'inherit',
    }),
  };

  // ── GridSizeForm ─────────────────────────────────────────────────────────

  function GridSizeForm({ initW, initH, onConfirm }) {
    const [w, setW] = useState(initW || GRID_DEFAULT);
    const [h, setH] = useState(initH || GRID_DEFAULT);

    const clamp = (v) => Math.max(GRID_MIN, Math.min(GRID_MAX, v | 0));

    const submit = (e) => {
      e.preventDefault();
      onConfirm(clamp(h), clamp(w));
    };

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: 1, padding: 24,
      }}>
        <form onSubmit={submit} style={{
          background: 'rgba(20,30,20,.85)', border: '2px solid #2d4a2d',
          borderRadius: 6, padding: '28px 36px', minWidth: 280,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ ...S.pixelTitle, textAlign: 'center', marginBottom: 8 }}>
            GRID SIZE
          </div>
          {[['Width (columns)', w, setW], ['Height (rows)', h, setH]].map(([lbl, val, set]) => (
            <label key={lbl} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '.06em' }}>{lbl.toUpperCase()}</span>
              <input
                type="number" value={val} min={GRID_MIN} max={GRID_MAX}
                onChange={(e) => set(Number(e.target.value))}
                style={S.inputBox}
              />
            </label>
          ))}
          <div style={{ fontSize: 10, color: '#4a7a3a', textAlign: 'center' }}>
            Valid range: {GRID_MIN}–{GRID_MAX}. Default: {GRID_DEFAULT}×{GRID_DEFAULT}.
          </div>
          <button type="submit" style={{
            padding: '10px 0', background: 'linear-gradient(180deg,#d4a017,#b8860b)',
            color: '#1a1208', border: '2px solid #5c3d05', borderRadius: 4,
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: '.08em',
            cursor: 'pointer',
          }}>
            CREATE BOARD
          </button>
        </form>
      </div>
    );
  }

  // ── Sidebar: Terrain palette ─────────────────────────────────────────────

  function TerrainPalette({ selected, onSelect }) {
    return (
      <div style={{ ...S.sideSection, flex: 1, overflowY: 'auto' }}>
        <span style={S.sideLabel}>Terrain</span>
        {TERRAINS.map((t, i) => (
          <button key={t.id} onClick={() => onSelect(i)} style={S.btn(selected === i)}>
            <img src={terrainSrc(t)} alt="" width={22} height={22}
              style={{ imageRendering: 'pixelated', borderRadius: 2, flexShrink: 0 }} />
            {t.name}
          </button>
        ))}
      </div>
    );
  }

  // ── Sidebar: Decoration palette ──────────────────────────────────────────

  function DecorationPalette({ decorSlots, onLoadFile, onSelect, selected, onRemoveSlot }) {
    const fileRef = useRef(null);
    const [pendingType, setPendingType] = useState(null);

    const pickFile = (idx) => {
      setPendingType(idx);
      fileRef.current.value = '';
      fileRef.current.click();
    };

    const handleFile = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const cropped = await cropTransparent(reader.result);
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'Decor';
        onLoadFile(pendingType, { src: cropped, name });
      };
      reader.readAsDataURL(file);
    };

    return (
      <div style={{ ...S.sideSection, flex: 1, overflowY: 'auto' }}>
        <span style={S.sideLabel}>Decorations (PNG)</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          {decorSlots.map((slot, i) => (
            <div key={i} style={{
              border: `2px solid ${selected === i ? '#fbbf24' : '#2d4a2d'}`,
              borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
              background: '#0a140a', position: 'relative',
            }} onClick={() => onSelect(i)}>
              {slot ? (
                <>
                  <img src={slot.src} alt={slot.name} style={{
                    width: '100%', aspectRatio: '1', objectFit: 'contain',
                    imageRendering: 'pixelated', display: 'block',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)',
                    opacity: 0, transition: 'opacity .15s', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 9,
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}>
                    <button onClick={(e) => { e.stopPropagation(); pickFile(i); }}
                      style={{ ...S.pill(false), fontSize: 9 }}>SWAP</button>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveSlot(i); }}
                      style={{ ...S.pill(false), fontSize: 9 }}>✕</button>
                  </div>
                  <div style={{
                    padding: '2px 4px', fontSize: 8, color: '#d4e8c4',
                    background: 'rgba(0,0,0,.7)', textOverflow: 'ellipsis',
                    overflow: 'hidden', whiteSpace: 'nowrap',
                  }}>{slot.name}</div>
                </>
              ) : (
                <div onClick={() => pickFile(i)} style={{
                  aspectRatio: '1', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#4a7a3a', fontSize: 22,
                  border: '2px dashed #2d4a2d', borderRadius: 2,
                }}>+</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: '#4a7a3a', lineHeight: 1.5 }}>
          Click a slot to load PNG. Then click cells to stamp.
          Transparent borders are auto-cropped.
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile}
          style={{ display: 'none' }} />
      </div>
    );
  }

  // ── Sidebar: Unit palette ─────────────────────────────────────────────────

  function UnitPalette({ selectedType, onSelect, sprites, framesRefs, loadGif, clearSprite,
                          doctrine, onDoctrine, selectedFacing, onFacing }) {
    const fileRefs = useRef({});
    const getRef = (id) => {
      if (!fileRefs.current[id]) fileRefs.current[id] = React.createRef();
      return fileRefs.current[id];
    };

    return (
      <div style={{ ...S.sideSection, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <span style={S.sideLabel}>Doctrine</span>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {DOCTRINES.map((d) => (
            <button key={d} style={S.pill(doctrine === d)} onClick={() => onDoctrine(d)}>
              {d.toUpperCase()}
            </button>
          ))}
        </div>

        <span style={S.sideLabel}>Facing</span>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {FACINGS.map((f) => (
            <button key={f} style={S.pill(selectedFacing === f)} onClick={() => onFacing(f)}>
              {f}
            </button>
          ))}
        </div>

        <span style={S.sideLabel}>Unit Type</span>
        {UNIT_TYPES.map((ut) => {
          const isSelected = selectedType === ut.id;
          const hasSprite  = !!sprites[ut.id];
          const ref = getRef(ut.id);
          return (
            <div key={ut.id} style={{
              border: `2px solid ${isSelected ? '#fbbf24' : '#2d4a2d'}`,
              borderRadius: 4, marginBottom: 6, overflow: 'hidden',
              background: isSelected ? 'rgba(251,191,36,.07)' : 'rgba(10,20,10,.5)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                cursor: 'pointer',
              }} onClick={() => onSelect(ut.id)}>
                <div style={{ width: 28, height: 28, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                  <UnitToken typeId={ut.id} sprites={sprites} framesRefs={framesRefs} size={28} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: isSelected ? '#fbbf24' : '#d4e8c4' }}>
                    {ut.name}
                  </div>
                  <div style={{ fontSize: 9, color: '#6b7280' }}>
                    HP {ut.hp} · STR {ut.str} · DEF {ut.def}
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex', gap: 4, padding: '4px 8px 6px',
                borderTop: '1px solid #2d4a2d',
              }}>
                <button style={{ ...S.pill(false), flex: 1, textAlign: 'center', fontSize: 9 }}
                  onClick={() => ref.current.click()}>
                  {hasSprite ? '↺ GIF' : '+ GIF'}
                </button>
                {hasSprite && (
                  <button style={{ ...S.pill(false), fontSize: 9 }}
                    onClick={() => clearSprite(ut.id)}>✕</button>
                )}
                <input ref={ref} type="file" accept="image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files?.[0]) loadGif(ut.id, e.target.files[0]); e.target.value = ''; }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 9, color: '#4a7a3a', marginTop: 4, lineHeight: 1.5 }}>
          Click cells to stage · Shift+click for multi-select · Confirm to place batch.
        </div>
      </div>
    );
  }

  // ── Sidebar: Move tool info ───────────────────────────────────────────────

  function MoveSidebarInfo({ selectedUnit }) {
    if (!selectedUnit) {
      return (
        <div style={{ ...S.sideSection, color: '#6b7280', fontSize: 11, lineHeight: 1.6 }}>
          <span style={S.sideLabel}>Move Unit</span>
          Click a unit on the board to select it. Reachable tiles highlight in green.
          Click a highlighted tile to move.
        </div>
      );
    }
    const def = UNIT_TYPES.find((u) => u.id === selectedUnit.type);
    return (
      <div style={S.sideSection}>
        <span style={S.sideLabel}>Selected Unit</span>
        <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>{def?.name}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.6 }}>
          Rank: {selectedUnit.rank}<br />
          Facing: {selectedUnit.facing}<br />
          Position: ({selectedUnit.c}, {selectedUnit.r})<br />
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
          {FACINGS.map((f) => (
            <button key={f} style={S.pill(selectedUnit.facing === f)} data-facing={f}>
              {f}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Tool toolbar ─────────────────────────────────────────────────────────

  const TOOL_META = [
    { id: TOOL_TERRAIN,    label: 'TERRAIN',    icon: '▦' },
    { id: TOOL_DECORATION, label: 'DECOR',      icon: '❋' },
    { id: TOOL_UNIT,       label: 'UNIT',       icon: '⚑' },
    { id: TOOL_MOVE,       label: 'MOVE',       icon: '✦' },
    { id: TOOL_ERASE,      label: 'ERASE',      icon: '✗' },
  ];

  function Toolbar({ tool, onTool }) {
    return (
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid #2d4a2d', flexShrink: 0 }}>
        {TOOL_META.map((t) => (
          <button key={t.id} onClick={() => onTool(t.id)} style={{
            ...S.pill(tool === t.id),
            fontSize: 10, padding: '4px 12px',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    );
  }

  // ── Board grid ────────────────────────────────────────────────────────────

  function BoardGrid({
    grid, gridH, gridW, decorations, units, unitIndex,
    tool, selectedTerrain, selectedDecorIdx, decorSlots,
    sprites, framesRefs,
    pendingCells, selectedUnitId, reachableTiles,
    onCellAction, onCellEnter, onMouseUp,
  }) {
    const isPainting = useRef(false);

    const maxCellPx = 40;
    const cellPx = useMemo(() => {
      const maxDim = Math.max(gridH, gridW);
      if (maxDim <= 20) return 40;
      if (maxDim <= 32) return 28;
      if (maxDim <= 48) return 20;
      return 16;
    }, [gridH, gridW]);

    const handleMouseDown = (e, r, c) => {
      e.preventDefault();
      isPainting.current = true;
      onCellAction(r, c, e.shiftKey);
    };
    const handleMouseEnter = (r, c) => {
      onCellEnter(r, c, isPainting.current);
    };
    const handleMouseUpGlobal = useCallback(() => {
      isPainting.current = false;
      onMouseUp?.();
    }, [onMouseUp]);

    useEffect(() => {
      window.addEventListener('mouseup', handleMouseUpGlobal);
      return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
    }, [handleMouseUpGlobal]);

    return (
      <div style={{
        flex: 1, overflow: 'auto', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'flex-start',
        padding: 16,
      }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridW}, ${cellPx}px)`,
            gridTemplateRows:    `repeat(${gridH}, ${cellPx}px)`,
            border: '3px solid #555',
            boxShadow: '0 0 0 2px #000, 0 0 0 4px #3a3a3a, 0 8px 32px rgba(0,0,0,.7)',
            userSelect: 'none',
          }}
          onMouseLeave={() => { isPainting.current = false; }}
        >
          {Array.from({ length: gridH }, (_, r) =>
            Array.from({ length: gridW }, (_, c) => {
              const terrainIdx = grid[r]?.[c] ?? EMPTY;
              const terrain    = terrainIdx >= 0 ? TERRAINS[terrainIdx] : null;
              const decor      = decorations.get(cellKey(r, c));
              const unitId     = unitIndex.get(cellKey(r, c));
              const unit       = unitId != null ? units.find((u) => u.id === unitId) : null;
              const key        = cellKey(r, c);
              const isChecker  = (r + c) % 2 === 0;
              const isPending  = pendingCells?.has(key);
              const isReach    = reachableTiles?.has(key);
              const isSelected = unit && unit.id === selectedUnitId;

              let borderCol = 'transparent';
              if (isPending)      borderCol = '#fbbf24';
              else if (isReach)   borderCol = '#22c55e';
              else if (isSelected) borderCol = '#60a5fa';

              return (
                <div
                  key={key}
                  onMouseDown={(e) => handleMouseDown(e, r, c)}
                  onMouseEnter={() => handleMouseEnter(r, c)}
                  style={{
                    position: 'relative',
                    backgroundColor: terrain ? terrain.color : (isChecker ? '#2a2a2a' : '#1a1a1a'),
                    cursor: 'crosshair',
                    overflow: 'hidden',
                    boxShadow: borderCol !== 'transparent' ? `inset 0 0 0 ${Math.max(2, cellPx / 12)}px ${borderCol}` : 'none',
                    transition: 'box-shadow 60ms',
                  }}
                >
                  {terrain && (
                    <img
                      src={terrainSrc(terrain)}
                      alt="" draggable={false}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover', imageRendering: 'pixelated',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {/* Reachable tile tint */}
                  {isReach && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(34,197,94,.25)',
                      pointerEvents: 'none',
                    }} />
                  )}
                  {decor && (
                    <img
                      src={decor.src}
                      alt={decor.name} draggable={false}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'contain', imageRendering: 'pixelated',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {unit && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        width: Math.floor(cellPx * 0.75), height: Math.floor(cellPx * 0.75),
                        borderRadius: 2, overflow: 'hidden',
                        border: `${Math.max(1, Math.floor(cellPx / 20))}px solid ${isSelected ? '#60a5fa' : 'rgba(255,255,255,.4)'}`,
                        boxShadow: '0 1px 4px rgba(0,0,0,.7)',
                      }}>
                        <UnitToken
                          typeId={unit.type}
                          sprites={sprites}
                          framesRefs={framesRefs}
                          size={Math.floor(cellPx * 0.75)}
                        />
                      </div>
                    </div>
                  )}
                  {/* Facing indicator on selected unit */}
                  {isSelected && unit && cellPx >= 20 && (
                    <div style={{
                      position: 'absolute', top: 1, right: 2,
                      fontSize: Math.max(6, cellPx * 0.18), color: '#60a5fa',
                      fontWeight: 900, lineHeight: 1, pointerEvents: 'none',
                      textShadow: '0 0 4px rgba(0,0,0,1)',
                    }}>{unit.facing}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Status bar ───────────────────────────────────────────────────────────

  function StatusBar({ gridH, gridW, unitCount, tool, hoveredCell, grid }) {
    const filled = useMemo(() => {
      let n = 0;
      for (let r = 0; r < gridH; r++)
        for (let c = 0; c < gridW; c++)
          if ((grid[r]?.[c] ?? EMPTY) !== EMPTY) n++;
      return n;
    }, [grid, gridH, gridW]);

    const hCell = hoveredCell;
    const terrain = hCell && (grid[hCell[0]]?.[hCell[1]] ?? EMPTY) >= 0
      ? TERRAINS[grid[hCell[0]][hCell[1]]].name : null;

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '5px 14px', borderTop: '1px solid #2d4a2d',
        fontSize: 10, color: '#6b7280', flexShrink: 0,
        background: 'rgba(0,0,0,.3)',
      }}>
        <span>Grid: <b style={{ color: '#d4e8c4' }}>{gridW}×{gridH}</b></span>
        <span>Painted: <b style={{ color: '#d4e8c4' }}>{filled}</b> / {gridW * gridH}</span>
        <span>Units: <b style={{ color: '#fbbf24' }}>{unitCount}</b></span>
        <span>Tool: <b style={{ color: '#fbbf24' }}>{tool.toUpperCase()}</b></span>
        {hCell && (
          <span>Cell: <b style={{ color: '#d4e8c4' }}>[{hCell[1]},{hCell[0]}]</b>
            {terrain ? <> · <span style={{ color: '#10b981' }}>{terrain}</span></> : null}
          </span>
        )}
      </div>
    );
  }

  // ── MapBuilder root ──────────────────────────────────────────────────────

  function MapBuilder({ onClose }) {
    // Board state
    const [gridH, setGridH]         = useState(0);
    const [gridW, setGridW]         = useState(0);
    const [grid, setGrid]           = useState(null);       // Int8Array[] | null
    const [decorations, setDecors]  = useState(new Map());  // "r,c" → {src,name}
    const [units, setUnits]         = useState([]);
    const unitIndex                 = useMemo(() => buildUnitIndex(units), [units]);

    // Tool state
    const [tool, setTool]                = useState(TOOL_TERRAIN);
    const [selectedTerrain, setSelTerr]  = useState(0);
    const [selectedDecorIdx, setSelDecor] = useState(0);
    const [decorSlots, setDecorSlots]    = useState(Array(8).fill(null));
    const [selectedUnitType, setSelUnit] = useState('infantry');
    const [doctrine, setDoctrine]        = useState('plain');
    const [selectedFacing, setFacing]    = useState('N');
    const [pendingCells, setPending]     = useState(new Set());   // for batch unit placement
    const [selectedUnitId, setSelUnitId] = useState(null);        // for move tool
    const [reachableTiles, setReachable] = useState(null);        // Set<"r,c">
    const [hoveredCell, setHovered]      = useState(null);

    const { sprites, framesRefs, loadGif, clearSprite } = useUnitSprites();

    // ── Grid init ───────────────────────────────────────────────────────────
    const initGrid = useCallback((h, w) => {
      setGridH(h); setGridW(w);
      setGrid(makeGrid(h, w));
      setDecors(new Map());
      setUnits([]);
      setPending(new Set());
      setSelUnitId(null);
      setReachable(null);
    }, []);

    const hasBoard = grid !== null;

    // ── Cell interaction ────────────────────────────────────────────────────
    const handleCellAction = useCallback((r, c, shiftKey) => {
      if (!grid) return;

      if (tool === TOOL_TERRAIN) {
        setGrid((prev) => {
          const next = prev.map((row) => new Int8Array(row));
          next[r][c] = selectedTerrain;
          return next;
        });
        return;
      }

      if (tool === TOOL_ERASE) {
        setGrid((prev) => {
          const next = prev.map((row) => new Int8Array(row));
          next[r][c] = EMPTY;
          return next;
        });
        setDecors((prev) => { const m = new Map(prev); m.delete(cellKey(r, c)); return m; });
        setUnits((prev) => prev.filter((u) => !(u.r === r && u.c === c)));
        return;
      }

      if (tool === TOOL_DECORATION) {
        const slot = decorSlots[selectedDecorIdx];
        if (!slot) return;
        setDecors((prev) => {
          const m = new Map(prev);
          const k = cellKey(r, c);
          if (m.get(k)?.src === slot.src) { m.delete(k); }  // toggle off
          else { m.set(k, slot); }
          return m;
        });
        return;
      }

      if (tool === TOOL_UNIT) {
        const k = cellKey(r, c);
        if (shiftKey) {
          // Multi-select: toggle cell in pending set
          setPending((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
          });
        } else {
          // Single click: place immediately (or stage a 1-cell pending)
          setPending(new Set([k]));
        }
        return;
      }

      if (tool === TOOL_MOVE) {
        const clickedUnitId = unitIndex.get(cellKey(r, c));
        if (clickedUnitId != null) {
          // Select this unit
          setSelUnitId(clickedUnitId);
          const u = units.find((x) => x.id === clickedUnitId);
          if (u && window.UnitMovement) {
            const occupied = new Set(
              units.filter((x) => x.id !== clickedUnitId).map((x) => cellKey(x.r, x.c))
            );
            const reach = window.UnitMovement.computeReachableTiles(
              grid, gridH, gridW, { r: u.r, c: u.c }, u.type, doctrine, occupied
            );
            setReachable(reach);
          }
          return;
        }
        // Click on reachable tile → move selected unit
        if (selectedUnitId != null && reachableTiles?.has(cellKey(r, c))) {
          setUnits((prev) =>
            prev.map((u) => u.id === selectedUnitId ? { ...u, r, c } : u)
          );
          setSelUnitId(null);
          setReachable(null);
        } else {
          // Deselect
          setSelUnitId(null);
          setReachable(null);
        }
        return;
      }
    }, [grid, tool, selectedTerrain, selectedDecorIdx, decorSlots,
        unitIndex, units, selectedUnitId, reachableTiles, doctrine, gridH, gridW]);

    // Drag-paint (terrain + erase only)
    const handleCellEnter = useCallback((r, c, painting) => {
      setHovered([r, c]);
      if (!painting) return;
      if (tool === TOOL_TERRAIN) {
        setGrid((prev) => {
          if ((prev[r]?.[c] ?? EMPTY) === selectedTerrain) return prev;
          const next = prev.map((row) => new Int8Array(row));
          next[r][c] = selectedTerrain;
          return next;
        });
      }
      if (tool === TOOL_ERASE) {
        setGrid((prev) => {
          if ((prev[r]?.[c] ?? EMPTY) === EMPTY) return prev;
          const next = prev.map((row) => new Int8Array(row));
          next[r][c] = EMPTY;
          return next;
        });
        setDecors((prev) => { const m = new Map(prev); m.delete(cellKey(r, c)); return m; });
        setUnits((prev) => prev.filter((u) => !(u.r === r && u.c === c)));
      }
    }, [tool, selectedTerrain]);

    // Confirm pending unit placement (batch)
    const confirmUnitPlacement = useCallback(() => {
      if (!pendingCells.size) return;
      const toPlace = [];
      for (const k of pendingCells) {
        const [r, c] = k.split(',').map(Number);
        if (unitIndex.has(k)) continue; // cell already occupied
        const t = grid[r]?.[c] ?? EMPTY;
        if (t === EMPTY) continue;       // no terrain painted
        toPlace.push(newUnit(r, c, selectedUnitType, selectedFacing));
      }
      setUnits((prev) => [...prev, ...toPlace]);
      setPending(new Set());
    }, [pendingCells, unitIndex, grid, selectedUnitType, selectedFacing]);

    // Decoration slot management
    const handleDecorSlotLoad = useCallback((idx, decor) => {
      setDecorSlots((prev) => { const next = [...prev]; next[idx] = decor; return next; });
      setSelDecor(idx);
    }, []);
    const handleDecorSlotRemove = useCallback((idx) => {
      setDecorSlots((prev) => { const next = [...prev]; next[idx] = null; return next; });
    }, []);

    // Rotate selected unit facing (move tool sidebar)
    const rotateUnit = useCallback((facing) => {
      if (selectedUnitId == null) return;
      setUnits((prev) =>
        prev.map((u) => u.id === selectedUnitId ? { ...u, facing } : u)
      );
    }, [selectedUnitId]);

    // ── Layout ────────────────────────────────────────────────────────────
    return (
      <div style={{ ...S.root, position: 'absolute', inset: 0 }}>
        {/* Top bar */}
        <div style={S.topBar}>
          <span style={S.pixelTitle}>MAP BUILDER</span>
          <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 4 }}>
            Strategy Game v0.18
          </span>
          {hasBoard && (
            <button onClick={() => {
              if (window.confirm('Reset board? All terrain, decorations and units will be lost.'))
                setGrid(null);
            }} style={{ ...S.pill(false), marginLeft: 'auto' }}>
              ↺ RESIZE
            </button>
          )}
          <button onClick={onClose} style={{
            ...S.pill(false), marginLeft: hasBoard ? 0 : 'auto',
            color: '#ef4444', borderColor: '#ef4444',
          }}>
            ✕ CLOSE
          </button>
        </div>

        {!hasBoard ? (
          <GridSizeForm initW={GRID_DEFAULT} initH={GRID_DEFAULT} onConfirm={initGrid} />
        ) : (
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* Sidebar */}
            <div style={{ ...S.sidebar, overflowY: 'auto' }}>
              <Toolbar tool={tool} onTool={(t) => {
                setTool(t);
                setPending(new Set());
                setSelUnitId(null);
                setReachable(null);
              }} />

              {tool === TOOL_TERRAIN && (
                <TerrainPalette selected={selectedTerrain} onSelect={setSelTerr} />
              )}
              {tool === TOOL_DECORATION && (
                <DecorationPalette
                  decorSlots={decorSlots}
                  onLoadFile={handleDecorSlotLoad}
                  onSelect={setSelDecor}
                  selected={selectedDecorIdx}
                  onRemoveSlot={handleDecorSlotRemove}
                />
              )}
              {tool === TOOL_UNIT && (
                <>
                  <UnitPalette
                    selectedType={selectedUnitType}
                    onSelect={setSelUnit}
                    sprites={sprites}
                    framesRefs={framesRefs}
                    loadGif={loadGif}
                    clearSprite={clearSprite}
                    doctrine={doctrine}
                    onDoctrine={setDoctrine}
                    selectedFacing={selectedFacing}
                    onFacing={setFacing}
                  />
                  {pendingCells.size > 0 && (
                    <div style={{ padding: '8px 12px', borderTop: '1px solid #2d4a2d' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>
                        {pendingCells.size} cell{pendingCells.size !== 1 ? 's' : ''} staged
                      </div>
                      <button onClick={confirmUnitPlacement} style={{
                        width: '100%', padding: '7px 0',
                        background: 'linear-gradient(180deg,#4ade80,#16a34a)',
                        color: '#0a1a0a', border: '2px solid #14532d', borderRadius: 4,
                        fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>
                        ✓ PLACE {pendingCells.size} UNIT{pendingCells.size !== 1 ? 'S' : ''}
                      </button>
                      <button onClick={() => setPending(new Set())} style={{
                        ...S.pill(false), width: '100%', textAlign: 'center',
                        display: 'block', marginTop: 5, fontSize: 10,
                      }}>
                        CANCEL
                      </button>
                    </div>
                  )}
                </>
              )}
              {tool === TOOL_MOVE && (
                <>
                  <MoveSidebarInfo
                    selectedUnit={units.find((u) => u.id === selectedUnitId) || null}
                  />
                  {selectedUnitId != null && (
                    <div style={{ padding: '8px 12px', borderTop: '1px solid #2d4a2d' }}>
                      <span style={S.sideLabel}>Set Facing</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {FACINGS.map((f) => {
                          const u = units.find((x) => x.id === selectedUnitId);
                          return (
                            <button key={f} style={S.pill(u?.facing === f)}
                              onClick={() => rotateUnit(f)}>{f}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
              {tool === TOOL_ERASE && (
                <div style={{ ...S.sideSection, color: '#6b7280', fontSize: 11, lineHeight: 1.6 }}>
                  <span style={S.sideLabel}>Erase</span>
                  Click or drag cells to remove terrain, decorations, and units.
                </div>
              )}
            </div>

            {/* Board area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <BoardGrid
                grid={grid} gridH={gridH} gridW={gridW}
                decorations={decorations} units={units} unitIndex={unitIndex}
                tool={tool}
                selectedTerrain={selectedTerrain}
                selectedDecorIdx={selectedDecorIdx}
                decorSlots={decorSlots}
                sprites={sprites} framesRefs={framesRefs}
                pendingCells={pendingCells}
                selectedUnitId={selectedUnitId}
                reachableTiles={reachableTiles}
                onCellAction={handleCellAction}
                onCellEnter={handleCellEnter}
                onMouseUp={() => {}}
              />
              <StatusBar
                gridH={gridH} gridW={gridW}
                unitCount={units.length}
                tool={tool}
                hoveredCell={hoveredCell}
                grid={grid}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  window.MapBuilder = MapBuilder;
})();
