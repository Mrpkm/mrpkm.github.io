import { useState, useRef, useEffect, useCallback } from "react";
import { Wand2, Shuffle, Eraser, Upload, FolderUp, MapIcon, Sparkles, X, Loader2, ChevronRight, ChevronLeft, Paintbrush, Layers, Grid3X3, MousePointerClick, Save, Images, Trash2, Clock, ZoomIn, Inbox } from "lucide-react";

const GRID_SIZE = 16;
const EMPTY = -1;

const makeDefaults = () => [
  { id: "grass", name: "Grass Plain", color: "#5fa83a", accent: "#7fc04f", pattern: "grass" },
  { id: "forest", name: "Forest", color: "#1f5c2f", accent: "#0d3a1c", pattern: "forest" },
  { id: "mountain", name: "Mountain", color: "#6e7480", accent: "#cdd2d9", pattern: "mountain" },
  { id: "swamp", name: "Swamp", color: "#5c5832", accent: "#3a4d4a", pattern: "swamp" },
];

const patternSvg = (kind, color, accent) => {
  const svgs = {
    grass: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><rect width='24' height='24' fill='${color}'/><rect x='3' y='5' width='1' height='3' fill='${accent}'/><rect x='8' y='9' width='1' height='3' fill='${accent}'/><rect x='15' y='4' width='1' height='3' fill='${accent}'/><rect x='19' y='13' width='1' height='3' fill='${accent}'/><rect x='5' y='17' width='1' height='3' fill='${accent}'/><rect x='13' y='19' width='1' height='3' fill='${accent}'/></svg>`,
    forest: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><rect width='24' height='24' fill='#3a8049'/><polygon points='6,4 9,11 3,11' fill='${color}'/><polygon points='6,8 10,16 2,16' fill='${color}'/><rect x='5' y='16' width='2' height='2' fill='#4a2a1a'/><polygon points='17,5 20,12 14,12' fill='${accent}'/><polygon points='17,9 21,17 13,17' fill='${accent}'/><rect x='16' y='17' width='2' height='2' fill='#4a2a1a'/></svg>`,
    mountain: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><rect width='24' height='24' fill='#4a8030'/><polygon points='12,3 22,21 2,21' fill='${color}'/><polygon points='12,3 18,12 12,12' fill='${accent}'/><polygon points='12,3 14,7 10,7' fill='#ffffff'/><polygon points='5,14 9,21 1,21' fill='#5a626e'/></svg>`,
    swamp: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><rect width='24' height='24' fill='${color}'/><ellipse cx='8' cy='10' rx='5' ry='3' fill='#2d5050'/><ellipse cx='17' cy='17' rx='4' ry='2.5' fill='#2d5050'/><rect x='3' y='3' width='1' height='2' fill='#1a3020'/><rect x='14' y='4' width='1' height='2' fill='#1a3020'/></svg>`,
  };
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgs[kind] || svgs.grass)}`;
};

const tileImageSrc = (tile) => tile.image || patternSvg(tile.pattern, tile.color, tile.accent);
const emptyBoard = () => Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(EMPTY));

const generateBiomes = (numTiles) => {
  if (numTiles === 0) return emptyBoard();
  const seedCount = Math.min(numTiles * 2 + Math.floor(Math.random() * 4), 14);
  const seeds = Array.from({ length: seedCount }, () => ({
    r: Math.random() * GRID_SIZE, c: Math.random() * GRID_SIZE, tile: Math.floor(Math.random() * numTiles),
  }));
  return Array(GRID_SIZE).fill(null).map((_, r) =>
    Array(GRID_SIZE).fill(null).map((_, c) => {
      let best = seeds[0], bestDist = Infinity;
      for (const s of seeds) {
        const d = (s.r - r) ** 2 + (s.c - c) ** 2 + Math.random() * 0.6;
        if (d < bestDist) { bestDist = d; best = s; }
      }
      return best.tile;
    })
  );
};

const ERASER_ID = "__eraser__";

// Bounding box of non-empty cells — used by the gallery to auto-zoom.
const computeBBox = (grid) => {
  let minR = GRID_SIZE, maxR = -1, minC = GRID_SIZE, maxC = -1;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== EMPTY) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR === -1) return null;
  return { minR, maxR, minC, maxC, w: maxC - minC + 1, h: maxR - minR + 1 };
};

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

// Crop an image data URL to its non-transparent bounding box.
// Removes transparent borders so object-fit:cover fills the cell with only visible content
// (effectively zooming the visible part to fully occupy whatever space it's placed in).
const cropTransparent = (dataUrl) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) { resolve(dataUrl); return; }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    let imageData;
    try { imageData = ctx.getImageData(0, 0, w, h); }
    catch (_) { resolve(dataUrl); return; } // tainted canvas — bail

    const data = imageData.data;
    const ALPHA_THRESHOLD = 8; // pixels with alpha <= 8 treated as transparent
    let minX = w, maxX = -1, minY = h, maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Image fully transparent — keep original to avoid empty crop.
    if (maxX === -1) { resolve(dataUrl); return; }
    // Already edge-to-edge — no crop needed.
    if (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1) {
      resolve(dataUrl); return;
    }

    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
    resolve(out.toDataURL("image/png"));
  };
  img.onerror = () => resolve(dataUrl);
  img.src = dataUrl;
});

export default function App() {
  const [page, setPage] = useState(1);
  const [tiles, setTiles] = useState(makeDefaults);
  const [board, setBoard] = useState(emptyBoard);
  const [selectedTile, setSelectedTile] = useState(0);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [isPainting, setIsPainting] = useState(false);
  const [hoverCell, setHoverCell] = useState(null);
  const [savedMaps, setSavedMaps] = useState([]); // in-memory only — resets on artifact reload
  const [savedFlash, setSavedFlash] = useState(false); // visual feedback after saving
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    const stop = () => setIsPainting(false);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => { window.removeEventListener("mouseup", stop); window.removeEventListener("touchend", stop); };
  }, []);

  const paintCell = useCallback((r, c) => {
    const val = selectedTile === ERASER_ID ? EMPTY : selectedTile;
    setBoard(prev => {
      if (prev[r][c] === val) return prev;
      const next = prev.map(row => [...row]);
      next[r][c] = val;
      return next;
    });
  }, [selectedTile]);

  const onCellDown = (r, c) => { setIsPainting(true); paintCell(r, c); };
  const onCellEnter = (r, c) => { setHoverCell([r, c]); if (isPainting) paintCell(r, c); };
  const randomGenerate = () => setBoard(generateBiomes(tiles.length));
  const clearBoard = () => setBoard(emptyBoard());

  // DONE — snapshot the current board to in-memory gallery.
  // Empty cells stay empty in the snapshot, producing asymmetrical/holey shapes.
  const saveMap = () => {
    const bbox = computeBBox(board);
    if (!bbox) return; // refuse to save a fully empty board
    const filled = board.reduce((a, row) => a + row.filter(c => c !== EMPTY).length, 0);
    const newMap = {
      id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      grid: board.map(row => [...row]),
      tilesSnapshot: tiles.map(t => ({ ...t })),
      bbox,
      filled,
    };
    setSavedMaps(prev => [newMap, ...prev]);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  };

  const deleteMap = (id) => setSavedMaps(prev => prev.filter(m => m.id !== id));

  const fileToTile = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const name = file.name.replace(/\.[^.]+$/, "").replace(/^AI[-_ ]?game[-_ ]?/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase()).trim() || "Tile";
      // Strip transparent borders so the visible content fills the cell.
      const cropped = await cropTransparent(reader.result);
      resolve({ id: `tile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, image: cropped, color: "#374151" });
    };
    reader.readAsDataURL(file);
  });

  const handleFiles = async (fileList) => {
    const imageFiles = Array.from(fileList).filter(f => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const newTiles = await Promise.all(imageFiles.map(fileToTile));
    setTiles(prev => [...prev, ...newTiles]);
  };

  const removeTile = (idx) => {
    if (tiles.length <= 1) return;
    setTiles(prev => prev.filter((_, i) => i !== idx));
    setBoard(prev => prev.map(row => row.map(v => v === idx ? EMPTY : v > idx ? v - 1 : v)));
    if (typeof selectedTile === "number") setSelectedTile(s => Math.min(s, tiles.length - 2));
  };

  const renameTile = (idx, name) => setTiles(prev => prev.map((t, i) => i === idx ? { ...t, name } : t));

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setError("");
    try {
      const tilesList = tiles.map((t, i) => `  ${i} = ${t.name}`).join("\n");
      const promptText = `You are a tile map generator for a top-down 2D game. Generate a ${GRID_SIZE}x${GRID_SIZE} grid.

Available tile indices:
${tilesList}
  -1 = empty (no tile)

User description: "${aiPrompt}"

Rules:
- Natural biome layouts (cohesive regions, not noise)
- Row 0=north/top, Row 15=south/bottom, Col 0=west/left, Col 15=east/right
- Use -1 for empty areas
- Only valid indices

Output ONLY a JSON array of ${GRID_SIZE} arrays of ${GRID_SIZE} integers. No markdown, no text.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: promptText }] }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      let text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
      text = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/g, "").trim();
      const s = text.indexOf("["), e = text.lastIndexOf("]");
      if (s >= 0 && e > s) text = text.slice(s, e + 1);
      const grid = JSON.parse(text);
      const maxIdx = tiles.length - 1;
      const sanitized = Array(GRID_SIZE).fill(null).map((_, r) => {
        const row = Array.isArray(grid[r]) ? grid[r] : [];
        return Array(GRID_SIZE).fill(null).map((_, c) => {
          const v = parseInt(row[c]);
          if (isNaN(v) || v < 0) return EMPTY;
          return Math.min(v, maxIdx);
        });
      });
      setBoard(sanitized);
      setPage(2);
    } catch (err) {
      setError(`Generation failed: ${err.message || "unknown"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const tileCounts = tiles.map((_, i) => board.reduce((acc, row) => acc + row.filter(c => c === i).length, 0));
  const filledCount = board.reduce((acc, row) => acc + row.filter(c => c !== EMPTY).length, 0);

  const selectedName = selectedTile === ERASER_ID ? "ERASER" : tiles[selectedTile]?.name?.toUpperCase() || "NONE";

  return (
    <div className="min-h-screen text-stone-100 font-mono" style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", background: "radial-gradient(ellipse at top,#1a2818 0%,#0a0e0a 50%,#000 100%)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .pixel-font{font-family:'Press Start 2P',monospace}
        .pixel-tile{image-rendering:pixelated;image-rendering:crisp-edges}
        .scanline-bg{background-image:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 3px)}
        .panel{background:linear-gradient(180deg,rgba(20,30,20,0.85) 0%,rgba(10,15,10,0.85) 100%);backdrop-filter:blur(8px);border:2px solid #2d4a2d;box-shadow:0 0 0 1px rgba(0,0,0,0.4) inset,0 4px 20px rgba(0,0,0,0.5)}
        .btn-primary{background:linear-gradient(180deg,#d4a017,#b8860b);color:#1a1208;border:2px solid #5c3d05;box-shadow:inset 0 1px 0 rgba(255,220,140,0.6),0 2px 0 #5c3d05;transition:all 80ms}
        .btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,220,140,0.8),0 3px 0 #5c3d05}
        .btn-primary:active:not(:disabled){transform:translateY(1px)}
        .btn-primary:disabled{opacity:.4;cursor:not-allowed}
        .btn-secondary{background:linear-gradient(180deg,#3a5a3a,#2a402a);color:#d4e8c4;border:2px solid #1a2a1a;box-shadow:inset 0 1px 0 rgba(180,220,140,0.3),0 2px 0 #1a2a1a;transition:all 80ms}
        .btn-secondary:hover:not(:disabled){background:linear-gradient(180deg,#4a6a4a,#3a503a)}
        .btn-secondary:active:not(:disabled){transform:translateY(1px)}
        .btn-emerald{background:linear-gradient(180deg,#4ade80,#16a34a);color:#0a1a0a;border:2px solid #14532d;box-shadow:inset 0 1px 0 rgba(190,255,180,0.6),0 2px 0 #14532d;transition:all 80ms}
        .btn-emerald:hover:not(:disabled){transform:translateY(-1px)}
        .btn-emerald:active:not(:disabled){transform:translateY(1px)}
        .btn-emerald:disabled{opacity:.4;cursor:not-allowed}
        .tile-card{transition:transform 100ms,box-shadow 100ms}
        .tile-card.selected{transform:translateY(-2px) scale(1.04);box-shadow:0 0 0 3px #fbbf24,0 0 18px rgba(251,191,36,0.4)}
        .input-pixel{background:#0a140a;border:2px solid #2d4a2d;color:#d4e8c4;box-shadow:inset 0 2px 0 rgba(0,0,0,0.5)}
        .input-pixel:focus{outline:none;border-color:#fbbf24;box-shadow:inset 0 2px 0 rgba(0,0,0,0.5),0 0 0 1px #fbbf24}
        .page-tab{padding:10px 20px;font-size:11px;font-weight:700;letter-spacing:.12em;cursor:pointer;border:2px solid transparent;transition:all 120ms;position:relative;border-radius:4px 4px 0 0}
        .page-tab.active{color:#fbbf24;border-color:#fbbf24;background:rgba(251,191,36,0.08)}
        .page-tab.active::after{content:'';position:absolute;bottom:-3px;left:20%;right:20%;height:2px;background:#fbbf24}
        .page-tab:not(.active){color:#6b7280;border-color:#2d4a2d}
        .page-tab:not(.active):hover{color:#9ca3af;border-color:#4a7a3a}
        .crt-flicker{animation:flicker 4s infinite}
        @keyframes flicker{0%,95%,100%{opacity:1}97%{opacity:.94}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 300ms ease-out forwards}
        @keyframes savedPulse{0%{transform:scale(1);box-shadow:inset 0 1px 0 rgba(190,255,180,0.6),0 2px 0 #14532d,0 0 0 0 rgba(74,222,128,0.7)}50%{transform:scale(1.05);box-shadow:inset 0 1px 0 rgba(255,255,200,0.9),0 2px 0 #14532d,0 0 0 8px rgba(74,222,128,0)}100%{transform:scale(1);box-shadow:inset 0 1px 0 rgba(190,255,180,0.6),0 2px 0 #14532d,0 0 0 0 rgba(74,222,128,0)}}
        .saved-flash{animation:savedPulse 700ms ease-out 2}
        .gallery-card{transition:transform 120ms,box-shadow 120ms}
        .gallery-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.6),0 0 0 1px rgba(251,191,36,0.3)}
        .checker-bg{background-image:conic-gradient(#3a3a3a 25%,#1a1a1a 0 50%,#3a3a3a 0 75%,#1a1a1a 0);background-size:14px 14px;background-color:#3a3a3a}
      `}</style>

      <div className="scanline-bg min-h-screen p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="pixel-font text-amber-400 text-base md:text-xl crt-flicker" style={{ textShadow: "2px 2px 0 #5c3d05,0 0 12px rgba(251,191,36,0.4)" }}>
                ⚔ TILE FORGE ⚔
              </h1>
              <p className="text-xs text-emerald-300/70 mt-1 tracking-wider">16×16 BIOME EDITOR</p>
            </div>
            <div className="text-right text-[10px] text-stone-400 leading-relaxed">
              <div>tiles: <span className="text-amber-300">{tiles.length}</span></div>
              <div>filled: <span className="text-amber-300">{filledCount}</span> / {GRID_SIZE * GRID_SIZE}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            <button onClick={() => setPage(1)} className={`page-tab flex items-center gap-2 ${page === 1 ? "active" : ""}`}>
              <Layers size={13} /> SETUP
            </button>
            <button onClick={() => setPage(2)} className={`page-tab flex items-center gap-2 ${page === 2 ? "active" : ""}`}>
              <Grid3X3 size={13} /> BOARD
            </button>
            <button onClick={() => setPage(3)} className={`page-tab flex items-center gap-2 ${page === 3 ? "active" : ""}`}>
              <Images size={13} /> GALLERY
              {savedMaps.length > 0 && (
                <span className="ml-1 bg-amber-400 text-stone-900 px-1.5 py-0.5 rounded text-[8px] font-bold leading-none">
                  {savedMaps.length}
                </span>
              )}
            </button>
          </div>

          {/* ═══════ PAGE 1 — SETUP ═══════ */}
          {page === 1 && (
            <div className="fade-in grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Palette */}
              <div className="panel rounded p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                  <Sparkles size={14} className="text-amber-400" />
                  <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">TILE PALETTE</h2>
                  <span className="ml-auto text-[10px] text-stone-500">{tiles.length} tiles</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {tiles.map((tile, idx) => (
                    <div key={tile.id} className={`tile-card relative ${selectedTile === idx ? "selected" : ""}`}>
                      <button onClick={() => setSelectedTile(idx)} className="w-full aspect-square rounded overflow-hidden border-2 border-stone-900 relative" style={{ backgroundColor: tile.color }}>
                        <img src={tileImageSrc(tile)} alt={tile.name} className="w-full h-full object-cover pixel-tile" draggable={false} />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1.5 pt-3 pb-1">
                          <span className="text-[9px] font-bold text-white block truncate">{tile.name}</span>
                          <span className="text-[8px] text-amber-300/80">{tileCounts[idx]} cells</span>
                        </div>
                      </button>
                      {tiles.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); removeTile(idx); }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded bg-red-600 hover:bg-red-500 text-white flex items-center justify-center border-2 border-stone-900 z-10">
                          <X size={10} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-900/50">
                  <button onClick={() => fileInputRef.current?.click()} className="btn-secondary px-3 py-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-2 tracking-wider">
                    <Upload size={12} /> FILES
                  </button>
                  <button onClick={() => folderInputRef.current?.click()} className="btn-secondary px-3 py-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-2 tracking-wider">
                    <FolderUp size={12} /> FOLDER
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} className="hidden" />
                  <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} className="hidden" />
                </div>
                <p className="text-[9px] text-stone-500 leading-relaxed">Upload PNG/JPG tiles — each file becomes a new tile. Supports multi-select and folder upload.</p>

                {typeof selectedTile === "number" && tiles[selectedTile] && (
                  <div className="pt-3 border-t border-emerald-900/50">
                    <label className="text-[9px] text-emerald-300/70 tracking-wider uppercase block mb-1.5">Rename "{tiles[selectedTile].name}"</label>
                    <input type="text" value={tiles[selectedTile].name} onChange={(e) => renameTile(selectedTile, e.target.value)} className="input-pixel w-full px-2 py-1.5 rounded text-xs" maxLength={24} />
                  </div>
                )}

                <button onClick={() => setPage(2)} className="btn-primary w-full px-4 py-3 rounded text-[11px] font-bold flex items-center justify-center gap-2 tracking-wider mt-2">
                  OPEN BOARD <ChevronRight size={14} />
                </button>
              </div>

              {/* AI + Quick Actions */}
              <div className="space-y-4">
                <div className="panel rounded p-5 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                    <Wand2 size={14} className="text-amber-400" />
                    <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">AI ORACLE</h2>
                  </div>
                  <p className="text-[10px] text-stone-400 leading-relaxed">
                    Describe a map using tile names + directions (<span className="text-amber-300">north</span>, <span className="text-amber-300">center</span>, <span className="text-amber-300">corner</span>). Claude fills the board.
                  </p>
                  <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generateWithAI(); }}
                    placeholder={`e.g. "Grass center, forest ring, mountains north, swamp southeast"`}
                    className="input-pixel w-full h-32 px-3 py-2 rounded text-xs resize-none leading-relaxed" />
                  <button onClick={generateWithAI} disabled={isGenerating || !aiPrompt.trim()}
                    className="btn-emerald w-full px-3 py-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-2 tracking-wider">
                    {isGenerating ? <><Loader2 size={12} className="animate-spin" /> CONJURING...</> : <><Wand2 size={12} /> GENERATE MAP</>}
                  </button>
                  <div className="text-[9px] text-stone-500 text-center">⌘/Ctrl+Enter · auto-opens board</div>
                  {error && <div className="px-3 py-2 bg-red-950/50 border-2 border-red-900 rounded text-[10px] text-red-300">⚠ {error}</div>}
                </div>

                <div className="panel rounded p-5 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                    <Shuffle size={14} className="text-amber-400" />
                    <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">QUICK ACTIONS</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { randomGenerate(); setPage(2); }} className="btn-primary px-3 py-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-2 tracking-wider">
                      <Shuffle size={12} /> RANDOM
                    </button>
                    <button onClick={clearBoard} className="btn-secondary px-3 py-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-2 tracking-wider">
                      <Eraser size={12} /> CLEAR
                    </button>
                  </div>
                  {filledCount > 0 && (
                    <div className="pt-3 border-t border-emerald-900/50">
                      <div className="text-[9px] text-emerald-300/70 tracking-wider uppercase mb-2">Distribution</div>
                      <div className="flex h-3 rounded overflow-hidden border border-stone-900">
                        {tiles.map((tile, i) => {
                          if (!tileCounts[i]) return null;
                          return <div key={tile.id} title={`${tile.name}: ${tileCounts[i]}`} style={{ width: `${(tileCounts[i] / (GRID_SIZE * GRID_SIZE)) * 100}%`, backgroundColor: tile.color, backgroundImage: `url(${tileImageSrc(tile)})`, backgroundSize: "cover", imageRendering: "pixelated" }} />;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ PAGE 2 — BOARD ═══════ */}
          {page === 2 && (
            <div className="fade-in grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-4">
              <div className="panel rounded p-4 flex flex-col">
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-emerald-900/50 flex-wrap">
                  <button onClick={() => setPage(1)} className="btn-secondary px-2.5 py-1.5 rounded text-[11px] font-bold flex items-center gap-1 tracking-wider">
                    <ChevronLeft size={12} /> SETUP
                  </button>
                  <MapIcon size={14} className="text-amber-400 ml-1" />
                  <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">BOARD</h2>
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <button onClick={randomGenerate} className="btn-primary px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider">
                      <Shuffle size={12} /> RANDOM
                    </button>
                    <button onClick={clearBoard} className="btn-secondary px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider">
                      <Eraser size={12} /> CLEAR
                    </button>
                    <button
                      onClick={saveMap}
                      disabled={filledCount === 0}
                      className={`btn-emerald px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider ${savedFlash ? "saved-flash" : ""}`}
                      title={filledCount === 0 ? "Place at least one tile first" : "Save current map to gallery"}
                    >
                      {savedFlash ? <><Save size={12} /> SAVED!</> : <><Save size={12} /> DONE</>}
                    </button>
                  </div>
                </div>

                {hoverCell && (
                  <div className="text-[10px] text-stone-500 mb-2 text-center tracking-wider">
                    cell: <span className="text-amber-300">[{hoverCell[0]},{hoverCell[1]}]</span>
                    {board[hoverCell[0]][hoverCell[1]] !== EMPTY && (
                      <> · <span className="text-emerald-300">{tiles[board[hoverCell[0]][hoverCell[1]]]?.name}</span></>
                    )}
                  </div>
                )}

                <div className="flex-1 flex items-center justify-center py-2">
                  <div
                    className="grid select-none pixel-tile"
                    style={{
                      gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                      gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
                      width: "min(100%, 640px)",
                      aspectRatio: "1 / 1",
                      border: "3px solid #555",
                      boxShadow: "0 0 0 2px #000, 0 0 0 4px #3a3a3a, 0 8px 32px rgba(0,0,0,0.7)",
                      borderRadius: "2px",
                    }}
                    onMouseLeave={() => { setIsPainting(false); setHoverCell(null); }}
                  >
                    {board.map((row, r) =>
                      row.map((cellIdx, c) => {
                        const isEmpty = cellIdx === EMPTY;
                        const tile = isEmpty ? null : (tiles[cellIdx] || null);
                        const isLight = (r + c) % 2 === 0;
                        const checkerColor = isLight ? "#3a3a3a" : "#1a1a1a";
                        const isHover = hoverCell && hoverCell[0] === r && hoverCell[1] === c;

                        return (
                          <div
                            key={`${r}-${c}`}
                            onMouseDown={(e) => { e.preventDefault(); onCellDown(r, c); }}
                            onMouseEnter={() => onCellEnter(r, c)}
                            style={{
                              position: "relative",
                              backgroundColor: checkerColor,
                              cursor: "crosshair",
                              overflow: "hidden",
                              boxShadow: isHover
                                ? selectedTile === ERASER_ID
                                  ? "inset 0 0 0 2px #f87171"
                                  : "inset 0 0 0 2px #fbbf24"
                                : "none",
                              transition: "box-shadow 80ms",
                            }}
                          >
                            {tile && (
                              <img
                                src={tileImageSrc(tile)}
                                alt=""
                                draggable={false}
                                style={{
                                  position: "absolute",
                                  top: 0, left: 0,
                                  width: "100%", height: "100%",
                                  objectFit: "cover",
                                  imageRendering: "pixelated",
                                  pointerEvents: "none",
                                  display: "block",
                                }}
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-stone-500 mt-3 text-center tracking-wider flex items-center justify-center gap-2">
                  <MousePointerClick size={12} />
                  CLICK TO PLACE · DRAG TO PAINT ·
                  <span className="text-amber-300 font-bold">{selectedName}</span>
                </div>
              </div>

              {/* Right sidebar — brush picker */}
              <div className="panel rounded p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                  <Paintbrush size={14} className="text-amber-400" />
                  <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">BRUSH</h2>
                </div>

                <button onClick={() => setSelectedTile(ERASER_ID)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded border-2 transition-all text-[11px] font-bold tracking-wider ${selectedTile === ERASER_ID ? "border-red-400 bg-red-400/10 text-red-300" : "border-stone-800 bg-stone-900/50 text-stone-400 hover:border-stone-600"}`}>
                  <Eraser size={13} /> ERASER
                </button>

                <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                  {tiles.map((tile, idx) => {
                    const isSelected = selectedTile === idx;
                    return (
                      <button key={tile.id} onClick={() => setSelectedTile(idx)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded border-2 transition-all ${isSelected ? "border-amber-400 bg-amber-400/10" : "border-stone-800 bg-stone-900/40 hover:border-stone-600"}`}>
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 border border-stone-700 pixel-tile" style={{ backgroundColor: tile.color }}>
                          <img src={tileImageSrc(tile)} alt="" className="w-full h-full object-cover pixel-tile" draggable={false} />
                        </div>
                        <div className="text-left min-w-0">
                          <div className={`text-[10px] font-bold truncate ${isSelected ? "text-amber-300" : "text-stone-300"}`}>{tile.name}</div>
                          <div className="text-[8px] text-stone-500">{tileCounts[idx]} cells</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {filledCount > 0 && (
                  <div className="pt-3 border-t border-emerald-900/50">
                    <div className="text-[9px] text-emerald-300/70 tracking-wider uppercase mb-2">{filledCount}/{GRID_SIZE * GRID_SIZE} filled</div>
                    <div className="flex h-2.5 rounded overflow-hidden border border-stone-900">
                      {tiles.map((tile, i) => {
                        if (!tileCounts[i]) return null;
                        return <div key={tile.id} title={`${tile.name}: ${tileCounts[i]}`} style={{ width: `${(tileCounts[i] / (GRID_SIZE * GRID_SIZE)) * 100}%`, backgroundColor: tile.color, backgroundImage: `url(${tileImageSrc(tile)})`, backgroundSize: "cover", imageRendering: "pixelated" }} />;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ PAGE 3 — GALLERY ═══════ */}
          {page === 3 && (
            <div className="fade-in">
              {savedMaps.length === 0 ? (
                <div className="panel rounded p-12 text-center">
                  <Inbox size={48} className="text-stone-600 mx-auto mb-4" strokeWidth={1.2} />
                  <h3 className="pixel-font text-[11px] text-amber-400 tracking-widest mb-2">EMPTY GALLERY</h3>
                  <p className="text-[11px] text-stone-400 leading-relaxed max-w-md mx-auto mb-5">
                    No maps saved yet. Head to the board, paint a few cells, then press <span className="text-emerald-300 font-bold">DONE</span> to immortalize your creation here.
                  </p>
                  <p className="text-[9px] text-stone-600 leading-relaxed max-w-sm mx-auto mb-5">
                    Empty squares at save time become holes in the saved map — the gallery zooms automatically to frame whatever shape you made.
                  </p>
                  <button onClick={() => setPage(2)} className="btn-primary px-5 py-2.5 rounded text-[11px] font-bold inline-flex items-center gap-2 tracking-wider">
                    <Grid3X3 size={12} /> GO TO BOARD
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4 panel rounded px-4 py-3">
                    <Images size={14} className="text-amber-400" />
                    <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">SAVED MAPS</h2>
                    <span className="text-[10px] text-stone-500 ml-2">{savedMaps.length} in memory</span>
                    <span className="text-[9px] text-stone-600 ml-auto italic">resets when artifact reloads</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {savedMaps.map((m, idx) => {
                      const { bbox } = m;
                      const totalCells = GRID_SIZE * GRID_SIZE;
                      const missing = totalCells - m.filled;
                      // Auto-zoom factor: ratio of original 16x16 to bbox dimensions.
                      // Smaller bbox → larger zoom factor.
                      const zoomFactor = (GRID_SIZE / Math.max(bbox.w, bbox.h)).toFixed(1);

                      return (
                        <div key={m.id} className="gallery-card panel rounded overflow-hidden flex flex-col">
                          {/* Thumbnail with auto-zoom */}
                          <div className="relative checker-bg p-3 flex items-center justify-center" style={{ aspectRatio: "1 / 1" }}>
                            <div
                              className="pixel-tile"
                              style={{
                                display: "grid",
                                gridTemplateColumns: `repeat(${bbox.w}, 1fr)`,
                                gridTemplateRows: `repeat(${bbox.h}, 1fr)`,
                                aspectRatio: `${bbox.w} / ${bbox.h}`,
                                width: bbox.w >= bbox.h ? "100%" : "auto",
                                height: bbox.h >= bbox.w ? "100%" : "auto",
                                maxWidth: "100%",
                                maxHeight: "100%",
                                gap: 0,
                              }}
                            >
                              {Array.from({ length: bbox.h }).map((_, rr) =>
                                Array.from({ length: bbox.w }).map((_, cc) => {
                                  const cellIdx = m.grid[bbox.minR + rr][bbox.minC + cc];
                                  const tile = cellIdx === EMPTY ? null : m.tilesSnapshot[cellIdx];
                                  return (
                                    <div
                                      key={`${rr}-${cc}`}
                                      style={{
                                        position: "relative",
                                        backgroundColor: "transparent",
                                      }}
                                    >
                                      {tile && (
                                        <img
                                          src={tileImageSrc(tile)}
                                          alt=""
                                          draggable={false}
                                          style={{
                                            position: "absolute",
                                            top: 0, left: 0,
                                            width: "100%", height: "100%",
                                            objectFit: "cover",
                                            imageRendering: "pixelated",
                                            display: "block",
                                          }}
                                        />
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Zoom badge — shown when zoom is meaningful */}
                            {parseFloat(zoomFactor) > 1.1 && (
                              <div className="absolute top-2 right-2 bg-amber-400 text-stone-900 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider flex items-center gap-1 border border-stone-900">
                                <ZoomIn size={9} strokeWidth={3} /> {zoomFactor}×
                              </div>
                            )}

                            {/* Map number */}
                            <div className="absolute top-2 left-2 bg-stone-900/90 text-amber-300 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border border-amber-900/50">
                              #{savedMaps.length - idx}
                            </div>
                          </div>

                          {/* Card body */}
                          <div className="p-3 border-t-2 border-stone-900 bg-stone-950/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[10px] text-emerald-300/80">
                                <Clock size={10} /> {formatTime(m.createdAt)}
                              </div>
                              <button
                                onClick={() => deleteMap(m.id)}
                                className="text-stone-500 hover:text-red-400 transition-colors p-1 -m-1"
                                title="Delete from gallery"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-stone-400">
                              <span>{bbox.w}×{bbox.h} bounds</span>
                              <span><span className="text-amber-300">{m.filled}</span> tiles · <span className="text-stone-500">{missing} holes</span></span>
                            </div>
                            {/* Mini distribution */}
                            <div className="flex h-1.5 rounded overflow-hidden border border-stone-900">
                              {m.tilesSnapshot.map((t, i) => {
                                const count = m.grid.reduce((acc, row) => acc + row.filter(c => c === i).length, 0);
                                if (!count) return null;
                                return (
                                  <div
                                    key={t.id}
                                    title={`${t.name}: ${count}`}
                                    style={{
                                      width: `${(count / m.filled) * 100}%`,
                                      backgroundColor: t.color,
                                      backgroundImage: `url(${tileImageSrc(t)})`,
                                      backgroundSize: "cover",
                                      imageRendering: "pixelated",
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-center mt-6 text-[9px] text-stone-600 tracking-widest">⚙ TILES × CLAUDE × YOUR IMAGINATION ⚙</div>
        </div>
      </div>
    </div>
  );
}
