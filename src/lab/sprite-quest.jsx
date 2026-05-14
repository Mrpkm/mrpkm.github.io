import { useState, useRef, useEffect, useCallback } from "react";
import {
  Wand2, Shuffle, Eraser, Upload, FolderUp, MapIcon, Sparkles, X, Loader2,
  ChevronRight, ChevronLeft, Paintbrush, Layers, Grid3X3, MousePointerClick,
  Play, Flag, Footprints, Ban, Pipette, RefreshCw, Film, AlertTriangle,
  RotateCcw, Crosshair,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
   SPRITE QUEST — a tiny tile-RPG sandbox
   - tile-map-builder logic: palette, painting, AI/random, distribution
   - chroma_key logic: GIF decode → frames → per-pixel alpha cutoff
   - new: walkability, spawn, BFS pathfinding, click-to-move, smooth lerp
   ════════════════════════════════════════════════════════════════════ */

const GRID_SIZE = 16;
const EMPTY = -1;
const ERASER_ID = "__eraser__";
const WALK_SPEED = 6; // cells per second

/* ─────────── default tile palette (with walkability) ─────────── */
const makeDefaults = () => [
  { id: "grass",    name: "Grass Plain", color: "#5fa83a", accent: "#7fc04f", pattern: "grass",    walkable: true  },
  { id: "forest",   name: "Forest",      color: "#1f5c2f", accent: "#0d3a1c", pattern: "forest",   walkable: true  },
  { id: "mountain", name: "Mountain",    color: "#6e7480", accent: "#cdd2d9", pattern: "mountain", walkable: false },
  { id: "swamp",    name: "Swamp",       color: "#5c5832", accent: "#3a4d4a", pattern: "swamp",    walkable: false },
];

const patternSvg = (kind, color, accent) => {
  const svgs = {
    grass:    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><rect width='24' height='24' fill='${color}'/><rect x='3' y='5' width='1' height='3' fill='${accent}'/><rect x='8' y='9' width='1' height='3' fill='${accent}'/><rect x='15' y='4' width='1' height='3' fill='${accent}'/><rect x='19' y='13' width='1' height='3' fill='${accent}'/><rect x='5' y='17' width='1' height='3' fill='${accent}'/><rect x='13' y='19' width='1' height='3' fill='${accent}'/></svg>`,
    forest:   `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><rect width='24' height='24' fill='#3a8049'/><polygon points='6,4 9,11 3,11' fill='${color}'/><polygon points='6,8 10,16 2,16' fill='${color}'/><rect x='5' y='16' width='2' height='2' fill='#4a2a1a'/><polygon points='17,5 20,12 14,12' fill='${accent}'/><polygon points='17,9 21,17 13,17' fill='${accent}'/><rect x='16' y='17' width='2' height='2' fill='#4a2a1a'/></svg>`,
    mountain: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><rect width='24' height='24' fill='#4a8030'/><polygon points='12,3 22,21 2,21' fill='${color}'/><polygon points='12,3 18,12 12,12' fill='${accent}'/><polygon points='12,3 14,7 10,7' fill='#ffffff'/><polygon points='5,14 9,21 1,21' fill='#5a626e'/></svg>`,
    swamp:    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><rect width='24' height='24' fill='${color}'/><ellipse cx='8' cy='10' rx='5' ry='3' fill='#2d5050'/><ellipse cx='17' cy='17' rx='4' ry='2.5' fill='#2d5050'/><rect x='3' y='3' width='1' height='2' fill='#1a3020'/><rect x='14' y='4' width='1' height='2' fill='#1a3020'/></svg>`,
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

/* ─────────── crop transparent borders so uploaded tiles fill cells ─────────── */
const cropTransparent = (dataUrl) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) { resolve(dataUrl); return; }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    let imgData;
    try { imgData = ctx.getImageData(0, 0, w, h); }
    catch { resolve(dataUrl); return; }
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
    if (maxX === -1) { resolve(dataUrl); return; }
    if (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1) { resolve(dataUrl); return; }
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = cw; out.height = ch;
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
    resolve(out.toDataURL("image/png"));
  };
  img.onerror = () => resolve(dataUrl);
  img.src = dataUrl;
});

/* ─────────── BFS pathfinding ─────────── */
const isWalkable = (board, tiles, r, c) => {
  if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
  const idx = board[r][c];
  if (idx === EMPTY) return false;
  return tiles[idx]?.walkable !== false;
};

const findPath = (board, tiles, start, goal) => {
  if (start.r === goal.r && start.c === goal.c) return [];
  if (!isWalkable(board, tiles, goal.r, goal.c)) return null;
  const visited = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));
  const parent = new Map();
  visited[start.r][start.c] = true;
  const queue = [start];
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.r === goal.r && cur.c === goal.c) {
      const out = [];
      let key = `${cur.r},${cur.c}`;
      let p = cur;
      while (!(p.r === start.r && p.c === start.c)) {
        out.unshift(p);
        const pk = parent.get(key);
        if (!pk) break;
        p = pk;
        key = `${p.r},${p.c}`;
      }
      return out;
    }
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (!isWalkable(board, tiles, nr, nc)) continue;
      if (visited[nr][nc]) continue;
      visited[nr][nc] = true;
      parent.set(`${nr},${nc}`, cur);
      queue.push({ r: nr, c: nc });
    }
  }
  return null;
};

/* dx/dy → compass degrees (0=N, 90=E, 180=S, 270=W) */
const computeRotation = (from, to) => {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  if (Math.abs(dr) > Math.abs(dc)) return dr < 0 ? 0 : 180;
  return dc > 0 ? 90 : 270;
};

/* ════════════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════════════ */
export default function SpriteQuest() {
  const [page, setPage] = useState(1);
  const [tiles, setTiles] = useState(makeDefaults);
  const [board, setBoard] = useState(emptyBoard);
  const [selectedTile, setSelectedTile] = useState(0);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [isPainting, setIsPainting] = useState(false);
  const [hoverCell, setHoverCell] = useState(null);
  const [spawn, setSpawn] = useState(null);                  // {r,c} | null
  const [placeMode, setPlaceMode] = useState("paint");       // "paint" | "spawn"
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  /* ── chroma / GIF state ── */
  const [hasGif, setHasGif] = useState(false);
  const [gifSize, setGifSize] = useState({ w: 0, h: 0 });
  const [frameCount, setFrameCount] = useState(0);
  const [frameIdx, setFrameIdx] = useState(0);               // single source of truth for playback
  const [keyColor, setKeyColor] = useState({ r: 0, g: 255, b: 0 });
  const [tolerance, setTolerance] = useState(80);
  const [pickerMode, setPickerMode] = useState(false);
  const [chromaError, setChromaError] = useState(null);
  const framesRef = useRef([]);                              // VideoFrame[] — held in ref because they're not React-y

  /* ── unit (game) state ── */
  const [unit, setUnit] = useState(null);                    // { r, c, rotation, path, renderPos }
  const [invalidFlash, setInvalidFlash] = useState(null);    // {r,c} for unreachable click feedback

  const setupPreviewCanvasRef = useRef(null);                // animated preview on Setup
  const playCanvasRef = useRef(null);                        // unit on the play board

  /* ════════ board paint ════════ */
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

  const onBuildCellDown = (r, c) => {
    if (placeMode === "spawn") {
      // require walkable
      if (board[r][c] !== EMPTY && tiles[board[r][c]]?.walkable !== false) {
        setSpawn({ r, c });
        setPlaceMode("paint");
      } else {
        setInvalidFlash({ r, c });
        setTimeout(() => setInvalidFlash(null), 350);
      }
      return;
    }
    setIsPainting(true);
    paintCell(r, c);
  };
  const onBuildCellEnter = (r, c) => {
    setHoverCell([r, c]);
    if (placeMode === "paint" && isPainting) paintCell(r, c);
  };

  const randomGenerate = () => setBoard(generateBiomes(tiles.length));
  const clearBoard = () => { setBoard(emptyBoard()); setSpawn(null); };

  /* if spawn becomes invalid (painted over), clear it */
  useEffect(() => {
    if (!spawn) return;
    if (!isWalkable(board, tiles, spawn.r, spawn.c)) setSpawn(null);
  }, [board, tiles, spawn]);

  /* ════════ tile palette mgmt ════════ */
  const fileToTile = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const name = file.name.replace(/\.[^.]+$/, "")
        .replace(/^AI[-_ ]?game[-_ ]?/i, "")
        .replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase()).trim() || "Tile";
      const cropped = await cropTransparent(reader.result);
      resolve({
        id: `tile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name, image: cropped, color: "#374151", walkable: true,
      });
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
  const toggleWalkable = (idx) => setTiles(prev => prev.map((t, i) => i === idx ? { ...t, walkable: !t.walkable } : t));

  /* ════════ GIF / chroma ════════ */
  const detectKeyColorFromFrame = (videoFrame) => {
    const W = videoFrame.displayWidth, H = videoFrame.displayHeight;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
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

  const handleGifUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChromaError(null);

    if (typeof window.ImageDecoder === "undefined") {
      setChromaError("Your browser does not support the ImageDecoder API. Try a recent Chrome, Edge, Firefox, or Safari.");
      return;
    }
    try {
      const supported = await window.ImageDecoder.isTypeSupported(file.type || "image/gif");
      if (!supported) {
        setChromaError(`This browser cannot decode ${file.type || "this file type"}. GIF or animated WebP usually works.`);
        return;
      }
    } catch {}

    try {
      // Pause the current playback first so we don't draw a closed frame.
      const oldFrames = framesRef.current;
      setHasGif(false);
      setFrameCount(0);
      framesRef.current = [];

      const buf = await file.arrayBuffer();
      const decoder = new window.ImageDecoder({ data: buf, type: file.type || "image/gif" });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const count = track.frameCount || 1;
      const frames = [];
      for (let i = 0; i < count; i++) {
        // eslint-disable-next-line no-await-in-loop
        const result = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
        const durMs = (result.image.duration || 100000) / 1000;
        frames.push({ image: result.image, duration: Math.max(20, durMs) });
      }
      if (!frames.length) {
        setChromaError("No frames could be decoded from this file.");
        e.target.value = "";
        return;
      }

      // Now safe to close the old frames — the timer effect has already
      // cleaned up because hasGif flipped to false above.
      setTimeout(() => {
        oldFrames.forEach((f) => { try { f.image.close?.(); } catch {} });
      }, 50);

      framesRef.current = frames;
      setFrameIdx(0);
      setGifSize({ w: frames[0].image.displayWidth, h: frames[0].image.displayHeight });
      setFrameCount(frames.length);
      setHasGif(true);
      detectKeyColorFromFrame(frames[0].image);
    } catch (err) {
      setChromaError(`Could not decode: ${err.message || err}`);
    }
    e.target.value = "";
  };

  /* ── single playback timer: advances frameIdx through frame durations ── */
  useEffect(() => {
    if (!hasGif) return;
    if (!framesRef.current.length) return;
    let cancelled = false;
    let timeoutId = null;
    let cur = 0;
    setFrameIdx(0);
    const tick = () => {
      if (cancelled) return;
      const fs = framesRef.current;
      if (!fs.length) return;
      cur = (cur + 1) % fs.length;
      setFrameIdx(cur);
      const f = fs[cur];
      timeoutId = setTimeout(tick, f.duration);
    };
    timeoutId = setTimeout(tick, framesRef.current[0].duration);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasGif, frameCount]);

  /* ── shared draw fn: writes one frame to the given canvas with chroma key applied ── */
  const drawFrameTo = useCallback((canvas) => {
    if (!canvas) return;
    const fs = framesRef.current;
    if (!fs.length) return;
    const f = fs[frameIdx % fs.length];
    if (!f) return;
    if (canvas.width !== f.image.displayWidth) canvas.width = f.image.displayWidth;
    if (canvas.height !== f.image.displayHeight) canvas.height = f.image.displayHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try { ctx.drawImage(f.image, 0, 0); } catch { return; }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const tol2 = tolerance * tolerance;
    const { r: kr, g: kg, b: kb } = keyColor;
    for (let i = 0; i < px.length; i += 4) {
      const dr = px[i] - kr, dg = px[i+1] - kg, db = px[i+2] - kb;
      if (dr * dr + dg * dg + db * db < tol2) px[i+3] = 0;
    }
    ctx.putImageData(data, 0, 0);
  }, [frameIdx, keyColor, tolerance]);

  /* ── redraw whichever canvas(es) are mounted whenever frame/chroma changes ── */
  useEffect(() => {
    if (!hasGif) return;
    if (page === 1) drawFrameTo(setupPreviewCanvasRef.current);
    if (page === 3) drawFrameTo(playCanvasRef.current);
  }, [hasGif, page, drawFrameTo]);

  /* eyedropper on preview canvas */
  const onPreviewClick = (e) => {
    if (!pickerMode || !framesRef.current.length || !setupPreviewCanvasRef.current) return;
    const canvas = setupPreviewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
    const t = document.createElement("canvas");
    t.width = canvas.width; t.height = canvas.height;
    const tctx = t.getContext("2d", { willReadFrequently: true });
    const idx = frameIdx % framesRef.current.length;
    try { tctx.drawImage(framesRef.current[idx].image, 0, 0); } catch { return; }
    const xx = Math.max(0, Math.min(x, canvas.width - 1));
    const yy = Math.max(0, Math.min(y, canvas.height - 1));
    const d = tctx.getImageData(xx, yy, 1, 1).data;
    setKeyColor({ r: d[0], g: d[1], b: d[2] });
    setPickerMode(false);
  };

  /* cleanup on unmount */
  useEffect(() => () => {
    framesRef.current.forEach((f) => { try { f.image.close?.(); } catch {} });
    framesRef.current = [];
  }, []);

  /* ════════ unit lifecycle / movement ════════ */
  // (re)spawn unit when entering Play
  useEffect(() => {
    if (page !== 3) return;
    if (!hasGif) return;
    if (unit) return;
    // pick spawn: explicit > first walkable > nothing
    let s = spawn;
    if (!s) {
      outer: for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (isWalkable(board, tiles, r, c)) { s = { r, c }; break outer; }
        }
      }
    }
    if (!s) return;
    setUnit({
      r: s.r, c: s.c,
      rotation: 180,
      path: [],
      renderPos: { r: s.r, c: s.c },
    });
  }, [page, hasGif, spawn, board, tiles, unit]);

  // if board changes such that unit's tile is no longer walkable, just stop the unit but leave it
  useEffect(() => {
    if (!unit) return;
    if (!isWalkable(board, tiles, unit.r, unit.c)) {
      setUnit((u) => u ? { ...u, path: [] } : u);
    }
  }, [board, tiles, unit]);

  // movement rAF loop
  useEffect(() => {
    if (page !== 3) return;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1); // clamp
      last = now;
      setUnit((u) => {
        if (!u || !u.path.length) return u;
        const target = u.path[0];
        const dr = target.r - u.renderPos.r;
        const dc = target.c - u.renderPos.c;
        const dist = Math.hypot(dr, dc);
        const move = WALK_SPEED * dt;
        if (dist <= move || dist === 0) {
          const newPath = u.path.slice(1);
          let rotation = u.rotation;
          if (newPath.length) rotation = computeRotation(target, newPath[0]);
          return {
            ...u,
            r: target.r, c: target.c,
            renderPos: { r: target.r, c: target.c },
            path: newPath,
            rotation,
          };
        }
        return {
          ...u,
          renderPos: {
            r: u.renderPos.r + (dr / dist) * move,
            c: u.renderPos.c + (dc / dist) * move,
          },
        };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [page]);

  const onPlayCellClick = (r, c) => {
    if (!unit) return;
    if (!isWalkable(board, tiles, r, c)) {
      setInvalidFlash({ r, c });
      setTimeout(() => setInvalidFlash(null), 350);
      return;
    }
    const path = findPath(board, tiles, { r: unit.r, c: unit.c }, { r, c });
    if (!path) {
      setInvalidFlash({ r, c });
      setTimeout(() => setInvalidFlash(null), 350);
      return;
    }
    if (!path.length) return; // already there
    const rotation = computeRotation({ r: unit.r, c: unit.c }, path[0]);
    setUnit((u) => u ? { ...u, path, rotation } : u);
  };

  const resetUnit = () => {
    if (!spawn && !unit) return;
    const s = spawn || (unit ? { r: unit.r, c: unit.c } : null);
    if (!s) return;
    setUnit({
      r: s.r, c: s.c,
      rotation: 180,
      path: [],
      renderPos: { r: s.r, c: s.c },
    });
  };

  /* ════════ AI generate (Sonnet) ════════ */
  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setError("");
    try {
      const tilesList = tiles.map((t, i) =>
        `  ${i} = ${t.name} (${t.walkable === false ? "BLOCKED" : "walkable"})`
      ).join("\n");
      const promptText = `You are a tile map generator for a top-down 2D game. Generate a ${GRID_SIZE}x${GRID_SIZE} grid.

Available tile indices:
${tilesList}
  -1 = empty / void (no tile)

User description: "${aiPrompt}"

Rules:
- Natural biome layouts (cohesive regions, not noise)
- Row 0=north/top, Row 15=south/bottom, Col 0=west/left, Col 15=east/right
- Use -1 sparingly for void areas
- Make sure most of the map is reachable from a center point through walkable tiles
- Only valid indices

Output ONLY a JSON array of ${GRID_SIZE} arrays of ${GRID_SIZE} integers. No markdown, no text.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: promptText }],
        }),
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

  /* ════════ derived ════════ */
  const tileCounts = tiles.map((_, i) => board.reduce((acc, row) => acc + row.filter(c => c === i).length, 0));
  const filledCount = board.reduce((acc, row) => acc + row.filter(c => c !== EMPTY).length, 0);
  const walkableCount = board.reduce((acc, row) => acc + row.filter(c => c !== EMPTY && tiles[c]?.walkable !== false).length, 0);
  const selectedName = selectedTile === ERASER_ID ? "ERASER" : tiles[selectedTile]?.name?.toUpperCase() || "NONE";
  const keyHex = `#${[keyColor.r, keyColor.g, keyColor.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  const playReady = hasGif && walkableCount > 0;

  return (
    <div className="min-h-screen text-stone-100 font-mono"
         style={{ fontFamily: "'JetBrains Mono','Courier New',monospace",
                  background: "radial-gradient(ellipse at top,#1a2818 0%,#0a0e0a 50%,#000 100%)" }}>
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
        .btn-ruby{background:linear-gradient(180deg,#dc2626,#991b1b);color:#fff5f5;border:2px solid #5c0505;box-shadow:inset 0 1px 0 rgba(255,180,180,0.5),0 2px 0 #5c0505;transition:all 80ms}
        .btn-ruby:hover:not(:disabled){transform:translateY(-1px)}
        .tile-card{transition:transform 100ms,box-shadow 100ms}
        .tile-card.selected{transform:translateY(-2px) scale(1.04);box-shadow:0 0 0 3px #fbbf24,0 0 18px rgba(251,191,36,0.4)}
        .input-pixel{background:#0a140a;border:2px solid #2d4a2d;color:#d4e8c4;box-shadow:inset 0 2px 0 rgba(0,0,0,0.5)}
        .input-pixel:focus{outline:none;border-color:#fbbf24;box-shadow:inset 0 2px 0 rgba(0,0,0,0.5),0 0 0 1px #fbbf24}
        .page-tab{padding:10px 20px;font-size:11px;font-weight:700;letter-spacing:.12em;cursor:pointer;border:2px solid transparent;transition:all 120ms;position:relative;border-radius:4px 4px 0 0;background:transparent}
        .page-tab.active{color:#fbbf24;border-color:#fbbf24;background:rgba(251,191,36,0.08)}
        .page-tab.active::after{content:'';position:absolute;bottom:-3px;left:20%;right:20%;height:2px;background:#fbbf24}
        .page-tab:not(.active){color:#6b7280;border-color:#2d4a2d}
        .page-tab:not(.active):hover{color:#9ca3af;border-color:#4a7a3a}
        .crt-flicker{animation:flicker 4s infinite}
        @keyframes flicker{0%,95%,100%{opacity:1}97%{opacity:.94}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 300ms ease-out forwards}
        @keyframes invalidPulse{0%,100%{box-shadow:inset 0 0 0 2px #ef4444}50%{box-shadow:inset 0 0 0 3px #fca5a5,0 0 12px rgba(239,68,68,0.5)}}
        .invalid-flash{animation:invalidPulse 350ms ease-out}
        .checker-bg{background-image:conic-gradient(#3a3a3a 25%,#1a1a1a 0 50%,#3a3a3a 0 75%,#1a1a1a 0);background-size:14px 14px;background-color:#3a3a3a}
        input[type="range"]{-webkit-appearance:none;appearance:none;background:transparent;width:100%}
        input[type="range"]::-webkit-slider-runnable-track{height:8px;background:#0a140a;border:2px solid #2d4a2d}
        input[type="range"]::-moz-range-track{height:8px;background:#0a140a;border:2px solid #2d4a2d}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;height:18px;width:14px;background:#fbbf24;border:2px solid #0a0a0a;margin-top:-7px;cursor:grab}
        input[type="range"]::-moz-range-thumb{height:18px;width:14px;background:#fbbf24;border:2px solid #0a0a0a;cursor:grab;border-radius:0}
        .spawn-flag{filter:drop-shadow(0 0 6px rgba(251,191,36,0.7))}
      `}</style>

      <div className="scanline-bg min-h-screen p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto">
          {/* ─── Header ─── */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="pixel-font text-amber-400 text-base md:text-xl crt-flicker"
                  style={{ textShadow: "2px 2px 0 #5c3d05,0 0 12px rgba(251,191,36,0.4)" }}>
                ⚔ SPRITE QUEST ⚔
              </h1>
              <p className="text-xs text-emerald-300/70 mt-1 tracking-wider">FORGE THE LAND · SUMMON A HERO · WALK</p>
            </div>
            <div className="text-right text-[10px] text-stone-400 leading-relaxed">
              <div>tiles: <span className="text-amber-300">{tiles.length}</span> · sprite: <span className={hasGif ? "text-emerald-300" : "text-stone-600"}>{hasGif ? `${frameCount}f` : "none"}</span></div>
              <div>walkable: <span className="text-amber-300">{walkableCount}</span> / {GRID_SIZE * GRID_SIZE} · spawn: <span className={spawn ? "text-emerald-300" : "text-stone-600"}>{spawn ? `${spawn.r},${spawn.c}` : "auto"}</span></div>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="flex gap-2 mb-5 flex-wrap">
            <button onClick={() => setPage(1)} className={`page-tab flex items-center gap-2 ${page === 1 ? "active" : ""}`}>
              <Layers size={13} /> SETUP
            </button>
            <button onClick={() => setPage(2)} className={`page-tab flex items-center gap-2 ${page === 2 ? "active" : ""}`}>
              <Grid3X3 size={13} /> BUILD
            </button>
            <button onClick={() => setPage(3)} className={`page-tab flex items-center gap-2 ${page === 3 ? "active" : ""}`}>
              <Play size={13} /> PLAY
              {!playReady && <span className="ml-1 text-[8px] text-red-400/80">!</span>}
            </button>
          </div>

          {/* ════════ PAGE 1 — SETUP ════════ */}
          {page === 1 && (
            <div className="fade-in grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tile palette */}
              <div className="panel rounded p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                  <Sparkles size={14} className="text-amber-400" />
                  <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">TILES</h2>
                  <span className="ml-auto text-[10px] text-stone-500">{tiles.length} loaded</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {tiles.map((tile, idx) => (
                    <div key={tile.id} className={`tile-card relative ${selectedTile === idx ? "selected" : ""}`}>
                      <button onClick={() => setSelectedTile(idx)}
                              className="w-full aspect-square rounded overflow-hidden border-2 border-stone-900 relative"
                              style={{ backgroundColor: tile.color }}>
                        <img src={tileImageSrc(tile)} alt={tile.name} className="w-full h-full object-cover pixel-tile" draggable={false} />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1.5 pt-3 pb-1">
                          <span className="text-[9px] font-bold text-white block truncate">{tile.name}</span>
                          <span className="text-[8px] text-amber-300/80">{tileCounts[idx]} cells</span>
                        </div>
                      </button>
                      {/* walkable toggle */}
                      <button onClick={(e) => { e.stopPropagation(); toggleWalkable(idx); }}
                              title={tile.walkable === false ? "BLOCKED — click to allow" : "WALKABLE — click to block"}
                              className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded flex items-center justify-center border-2 border-stone-900 z-10 ${tile.walkable === false ? "bg-red-600 text-white" : "bg-emerald-500 text-stone-900"}`}>
                        {tile.walkable === false ? <Ban size={11} strokeWidth={3} /> : <Footprints size={11} strokeWidth={2.5} />}
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
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
                  <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
                </div>
                <p className="text-[9px] text-stone-500 leading-relaxed">
                  Each upload becomes a new tile. Click the green boot icon to mark a tile <span className="text-emerald-300">walkable</span>; the red ban icon means the unit can't enter.
                </p>

                {typeof selectedTile === "number" && tiles[selectedTile] && (
                  <div className="pt-3 border-t border-emerald-900/50">
                    <label className="text-[9px] text-emerald-300/70 tracking-wider uppercase block mb-1.5">Rename "{tiles[selectedTile].name}"</label>
                    <input type="text" value={tiles[selectedTile].name} onChange={(e) => renameTile(selectedTile, e.target.value)} className="input-pixel w-full px-2 py-1.5 rounded text-xs" maxLength={24} />
                  </div>
                )}
              </div>

              {/* Sprite uploader + chroma controls */}
              <div className="space-y-4">
                <div className="panel rounded p-5 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                    <Film size={14} className="text-amber-400" />
                    <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">UNIT SPRITE</h2>
                    {hasGif && <span className="ml-auto text-[10px] text-emerald-300">{frameCount} frames · {gifSize.w}×{gifSize.h}</span>}
                  </div>

                  {chromaError && (
                    <div className="border-2 border-red-500/50 bg-red-950/40 px-3 py-2 flex items-start gap-2 rounded">
                      <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                      <div className="text-[11px] text-red-100 leading-relaxed">{chromaError}</div>
                    </div>
                  )}

                  <label className="block cursor-pointer">
                    <div className="flex items-center gap-3 px-3 py-3 border-2 border-dashed border-emerald-900/60 hover:border-emerald-600 rounded transition-colors">
                      <Upload size={18} className="text-emerald-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-stone-200 font-bold">{hasGif ? "Replace sprite" : "Upload animated GIF"}</div>
                        <div className="text-[9px] text-stone-500 truncate">a flat-background animation works best</div>
                      </div>
                    </div>
                    <input type="file" accept="image/gif,image/webp,image/png,image/apng" onChange={handleGifUpload} className="hidden" />
                  </label>

                  {hasGif && (
                    <div className="grid grid-cols-[120px_1fr] gap-3 pt-2 border-t border-emerald-900/50">
                      <div className="checker-bg rounded border-2 border-stone-900 aspect-square flex items-center justify-center overflow-hidden relative"
                           onClick={onPreviewClick}
                           style={{ cursor: pickerMode ? "crosshair" : "default" }}>
                        <canvas ref={setupPreviewCanvasRef} className="w-full h-full pixel-tile" style={{ objectFit: "contain" }} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 border-2 border-stone-900" style={{ background: keyHex }} />
                          <div className="text-[10px] text-stone-300 leading-tight">
                            <div className="font-bold">key color</div>
                            <div className="text-stone-500 text-[9px] font-mono">rgb({keyColor.r},{keyColor.g},{keyColor.b})</div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          <button onClick={() => setPickerMode((p) => !p)}
                                  className={`px-2 py-1.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1 ${pickerMode ? "btn-primary" : "btn-secondary"}`}>
                            <Pipette size={10} /> {pickerMode ? "CANCEL" : "PICK"}
                          </button>
                          <button onClick={() => { const f = framesRef.current[0]; if (f) detectKeyColorFromFrame(f.image); }}
                                  className="btn-secondary px-2 py-1.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1">
                            <RefreshCw size={10} /> AUTO
                          </button>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[9px] text-emerald-300/80 tracking-wider uppercase">tolerance</span>
                            <span className="text-[10px] text-amber-300 font-mono">{tolerance}</span>
                          </div>
                          <input type="range" min={0} max={200} value={tolerance} onChange={(e) => setTolerance(parseInt(e.target.value))} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI generate */}
                <div className="panel rounded p-5 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                    <Wand2 size={14} className="text-amber-400" />
                    <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">AI ORACLE</h2>
                  </div>
                  <p className="text-[10px] text-stone-400 leading-relaxed">
                    Describe a map. Claude fills the board, biased toward reachable layouts.
                  </p>
                  <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generateWithAI(); }}
                            placeholder={`e.g. "Grass meadow with a forest spiral path leading to a mountain peak in the north"`}
                            className="input-pixel w-full h-24 px-3 py-2 rounded text-xs resize-none leading-relaxed" />
                  <button onClick={generateWithAI} disabled={isGenerating || !aiPrompt.trim()}
                          className="btn-emerald w-full px-3 py-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-2 tracking-wider">
                    {isGenerating ? <><Loader2 size={12} className="animate-spin" /> CONJURING...</> : <><Wand2 size={12} /> GENERATE</>}
                  </button>
                  {error && <div className="px-3 py-2 bg-red-950/50 border-2 border-red-900 rounded text-[10px] text-red-300">⚠ {error}</div>}
                </div>

                <button onClick={() => setPage(2)} className="btn-primary w-full px-4 py-3 rounded text-[11px] font-bold flex items-center justify-center gap-2 tracking-wider">
                  TO THE BUILDER <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ════════ PAGE 2 — BUILD ════════ */}
          {page === 2 && (
            <div className="fade-in grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-4">
              <div className="panel rounded p-4 flex flex-col">
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-emerald-900/50 flex-wrap">
                  <button onClick={() => setPage(1)} className="btn-secondary px-2.5 py-1.5 rounded text-[11px] font-bold flex items-center gap-1 tracking-wider">
                    <ChevronLeft size={12} /> SETUP
                  </button>
                  <MapIcon size={14} className="text-amber-400 ml-1" />
                  <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">BUILD</h2>
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <button onClick={() => setPlaceMode(placeMode === "spawn" ? "paint" : "spawn")}
                            className={`px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider ${placeMode === "spawn" ? "btn-primary" : "btn-secondary"}`}>
                      <Flag size={12} /> {placeMode === "spawn" ? "PLACING..." : "SET SPAWN"}
                    </button>
                    <button onClick={randomGenerate} className="btn-secondary px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider">
                      <Shuffle size={12} /> RANDOM
                    </button>
                    <button onClick={clearBoard} className="btn-secondary px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider">
                      <Eraser size={12} /> CLEAR
                    </button>
                    <button onClick={() => setPage(3)} disabled={!playReady}
                            className="btn-emerald px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider">
                      <Play size={12} /> PLAY
                    </button>
                  </div>
                </div>

                {hoverCell && (
                  <div className="text-[10px] text-stone-500 mb-2 text-center tracking-wider">
                    cell: <span className="text-amber-300">[{hoverCell[0]},{hoverCell[1]}]</span>
                    {board[hoverCell[0]][hoverCell[1]] !== EMPTY && (
                      <> · <span className="text-emerald-300">{tiles[board[hoverCell[0]][hoverCell[1]]]?.name}</span>
                         <> · {tiles[board[hoverCell[0]][hoverCell[1]]]?.walkable === false
                              ? <span className="text-red-400">blocked</span>
                              : <span className="text-emerald-400">walkable</span>}</>
                      </>
                    )}
                  </div>
                )}

                {placeMode === "spawn" && (
                  <div className="text-center text-[10px] text-amber-300 mb-2 tracking-wider">
                    <Crosshair size={11} className="inline mr-1" /> click a walkable cell to place hero spawn
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
                        const isSpawn = spawn && spawn.r === r && spawn.c === c;
                        const isInvalid = invalidFlash && invalidFlash.r === r && invalidFlash.c === c;
                        const blocked = !isEmpty && tile?.walkable === false;
                        const hoverColor = placeMode === "spawn"
                          ? (blocked ? "#ef4444" : "#fbbf24")
                          : (selectedTile === ERASER_ID ? "#f87171" : "#fbbf24");

                        return (
                          <div
                            key={`${r}-${c}`}
                            onMouseDown={(e) => { e.preventDefault(); onBuildCellDown(r, c); }}
                            onMouseEnter={() => onBuildCellEnter(r, c)}
                            className={isInvalid ? "invalid-flash" : ""}
                            style={{
                              position: "relative",
                              backgroundColor: checkerColor,
                              cursor: placeMode === "spawn" ? "crosshair" : "crosshair",
                              overflow: "hidden",
                              boxShadow: isHover ? `inset 0 0 0 2px ${hoverColor}` : "none",
                              transition: "box-shadow 80ms",
                            }}
                          >
                            {tile && (
                              <img
                                src={tileImageSrc(tile)}
                                alt=""
                                draggable={false}
                                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                                         objectFit: "cover", imageRendering: "pixelated", pointerEvents: "none", display: "block" }}
                              />
                            )}
                            {/* dim non-walkable when in spawn mode */}
                            {placeMode === "spawn" && (isEmpty || blocked) && (
                              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", pointerEvents: "none" }} />
                            )}
                            {isSpawn && (
                              <div className="spawn-flag" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                                <Flag size={Math.min(14, 320 / GRID_SIZE)} className="text-amber-300" strokeWidth={3} fill="#fbbf24" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-stone-500 mt-3 text-center tracking-wider flex items-center justify-center gap-2 flex-wrap">
                  <MousePointerClick size={12} />
                  CLICK & DRAG TO PAINT · BRUSH:
                  <span className="text-amber-300 font-bold">{selectedName}</span>
                </div>
              </div>

              {/* Brush sidebar */}
              <div className="panel rounded p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                  <Paintbrush size={14} className="text-amber-400" />
                  <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">BRUSH</h2>
                </div>

                <button onClick={() => { setSelectedTile(ERASER_ID); setPlaceMode("paint"); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded border-2 transition-all text-[11px] font-bold tracking-wider ${selectedTile === ERASER_ID && placeMode === "paint" ? "border-red-400 bg-red-400/10 text-red-300" : "border-stone-800 bg-stone-900/50 text-stone-400 hover:border-stone-600"}`}>
                  <Eraser size={13} /> ERASER
                </button>

                <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                  {tiles.map((tile, idx) => {
                    const isSelected = selectedTile === idx && placeMode === "paint";
                    return (
                      <button key={tile.id} onClick={() => { setSelectedTile(idx); setPlaceMode("paint"); }}
                              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded border-2 transition-all ${isSelected ? "border-amber-400 bg-amber-400/10" : "border-stone-800 bg-stone-900/40 hover:border-stone-600"}`}>
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 border border-stone-700 pixel-tile relative" style={{ backgroundColor: tile.color }}>
                          <img src={tileImageSrc(tile)} alt="" className="w-full h-full object-cover pixel-tile" draggable={false} />
                          {tile.walkable === false && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <Ban size={14} className="text-red-300" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <div className={`text-[10px] font-bold truncate ${isSelected ? "text-amber-300" : "text-stone-300"}`}>{tile.name}</div>
                          <div className="text-[8px] text-stone-500">{tileCounts[idx]} cells · {tile.walkable === false ? "blocked" : "walk"}</div>
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
                        return <div key={tile.id} title={`${tile.name}: ${tileCounts[i]}`}
                                    style={{ width: `${(tileCounts[i] / (GRID_SIZE * GRID_SIZE)) * 100}%`,
                                             backgroundColor: tile.color, backgroundImage: `url(${tileImageSrc(tile)})`,
                                             backgroundSize: "cover", imageRendering: "pixelated" }} />;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ PAGE 3 — PLAY ════════ */}
          {page === 3 && (
            <div className="fade-in">
              {!playReady ? (
                <div className="panel rounded p-12 text-center">
                  <Play size={48} className="text-stone-600 mx-auto mb-4" strokeWidth={1.2} />
                  <h3 className="pixel-font text-[11px] text-amber-400 tracking-widest mb-3">NOT READY</h3>
                  <p className="text-[11px] text-stone-400 leading-relaxed max-w-md mx-auto mb-5">
                    {!hasGif && walkableCount === 0 && "You need a unit sprite (Setup) and at least one walkable tile painted (Build) before you can play."}
                    {!hasGif && walkableCount > 0 && "Upload an animated GIF on the Setup tab — that's your unit."}
                    {hasGif && walkableCount === 0 && filledCount === 0 && "Paint at least one walkable cell on the Build tab so your unit has somewhere to stand."}
                    {hasGif && walkableCount === 0 && filledCount > 0 && "Every tile on your map is marked BLOCKED. Mark at least one tile walkable in the palette (green boot icon) so your hero can stand on it."}
                  </p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {!hasGif && <button onClick={() => setPage(1)} className="btn-primary px-5 py-2.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider"><Layers size={12} /> SETUP</button>}
                    {walkableCount === 0 && <button onClick={() => setPage(filledCount === 0 ? 2 : 1)} className="btn-primary px-5 py-2.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider">{filledCount === 0 ? <><Grid3X3 size={12} /> BUILD</> : <><Layers size={12} /> SETUP</>}</button>}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-4">
                  <div className="panel rounded p-4 flex flex-col">
                    <div className="flex items-center gap-2 pb-3 mb-3 border-b border-emerald-900/50 flex-wrap">
                      <button onClick={() => setPage(2)} className="btn-secondary px-2.5 py-1.5 rounded text-[11px] font-bold flex items-center gap-1 tracking-wider">
                        <ChevronLeft size={12} /> BUILD
                      </button>
                      <Play size={14} className="text-amber-400 ml-1" />
                      <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">PLAY</h2>
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={resetUnit} className="btn-secondary px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 tracking-wider">
                          <RotateCcw size={12} /> RESET
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-stone-500 mb-2 text-center tracking-wider">
                      {unit?.path?.length
                        ? <span className="text-emerald-300">walking · {unit.path.length} step{unit.path.length === 1 ? "" : "s"} remaining</span>
                        : <>click a <span className="text-emerald-300">walkable</span> cell to walk there · <span className="text-red-400">red cells</span> are blocked</>}
                    </div>

                    <div className="flex-1 flex items-center justify-center py-2">
                      <div
                        className="relative pixel-tile"
                        style={{
                          width: "min(100%, 640px)",
                          aspectRatio: "1 / 1",
                          border: "3px solid #555",
                          boxShadow: "0 0 0 2px #000, 0 0 0 4px #3a3a3a, 0 8px 32px rgba(0,0,0,0.7)",
                          borderRadius: "2px",
                        }}
                      >
                        {/* tile grid */}
                        <div className="grid select-none absolute inset-0"
                             style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` }}>
                          {board.map((row, r) =>
                            row.map((cellIdx, c) => {
                              const isEmpty = cellIdx === EMPTY;
                              const tile = isEmpty ? null : (tiles[cellIdx] || null);
                              const isLight = (r + c) % 2 === 0;
                              const checkerColor = isLight ? "#3a3a3a" : "#1a1a1a";
                              const isInvalid = invalidFlash && invalidFlash.r === r && invalidFlash.c === c;
                              const walkable = !isEmpty && tile?.walkable !== false;
                              const onPath = unit?.path?.some(p => p.r === r && p.c === c);
                              return (
                                <div
                                  key={`${r}-${c}`}
                                  onClick={() => onPlayCellClick(r, c)}
                                  className={isInvalid ? "invalid-flash" : ""}
                                  style={{
                                    position: "relative",
                                    backgroundColor: checkerColor,
                                    cursor: walkable ? "pointer" : "not-allowed",
                                    overflow: "hidden",
                                  }}
                                >
                                  {tile && (
                                    <img src={tileImageSrc(tile)} alt="" draggable={false}
                                         style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                                                  objectFit: "cover", imageRendering: "pixelated", pointerEvents: "none", display: "block" }} />
                                  )}
                                  {/* path breadcrumbs */}
                                  {onPath && (
                                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                                                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <div style={{ width: "32%", height: "32%", borderRadius: "50%",
                                                    background: "rgba(251,191,36,0.55)",
                                                    boxShadow: "0 0 6px rgba(251,191,36,0.8)" }} />
                                    </div>
                                  )}
                                  {/* dim blocked tiles slightly to clarify */}
                                  {!walkable && !isEmpty && (
                                    <div style={{ position: "absolute", inset: 0, background: "rgba(20,0,0,0.25)", pointerEvents: "none" }} />
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* unit overlay */}
                        {unit && (() => {
                          const maxCells = 1.6;
                          const aspect = gifSize.w / Math.max(1, gifSize.h);
                          const widthCells  = aspect >= 1 ? maxCells : maxCells * aspect;
                          const heightCells = aspect >= 1 ? maxCells / aspect : maxCells;
                          return (
                            <div
                              style={{
                                position: "absolute",
                                left: `${((unit.renderPos.c + 0.5) / GRID_SIZE) * 100}%`,
                                top: `${((unit.renderPos.r + 0.5) / GRID_SIZE) * 100}%`,
                                width: `${(widthCells / GRID_SIZE) * 100}%`,
                                height: `${(heightCells / GRID_SIZE) * 100}%`,
                                transform: "translate(-50%, -55%)",
                                pointerEvents: "none",
                                filter: "drop-shadow(2px 4px 0 rgba(0,0,0,0.5))",
                              }}
                            >
                              <div style={{ width: "100%", height: "100%",
                                            transform: `rotate(${unit.rotation}deg)`,
                                            transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                                <canvas ref={playCanvasRef} className="pixel-tile"
                                        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="text-[10px] text-stone-500 mt-3 text-center tracking-wider flex items-center justify-center gap-2 flex-wrap">
                      <MousePointerClick size={12} />
                      hero @ <span className="text-amber-300 font-bold">{unit ? `[${unit.r},${unit.c}]` : "—"}</span>
                      {spawn && <> · spawn @ <span className="text-emerald-300">[{spawn.r},{spawn.c}]</span></>}
                    </div>
                  </div>

                  {/* HUD */}
                  <div className="panel rounded p-4 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-emerald-900/50">
                      <Sparkles size={14} className="text-amber-400" />
                      <h2 className="pixel-font text-[10px] text-amber-400 tracking-widest">HERO</h2>
                    </div>

                    {/* sprite info — no live mini canvas (single canvas keeps playback simple) */}
                    <div className="checker-bg rounded border-2 border-stone-900 aspect-square flex flex-col items-center justify-center overflow-hidden relative p-3">
                      <Footprints size={28} className="text-amber-300 mb-2" strokeWidth={2} />
                      <div className="text-center">
                        <div className="text-[9px] text-emerald-300/80 tracking-wider uppercase">sprite</div>
                        <div className="text-[10px] text-stone-200 font-bold">{frameCount} frames</div>
                        <div className="text-[9px] text-stone-500">{gifSize.w}×{gifSize.h}</div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[10px]">
                      <Stat label="position" value={unit ? `${unit.r},${unit.c}` : "—"} />
                      <Stat label="facing" value={
                        unit?.rotation === 0 ? "north" :
                        unit?.rotation === 90 ? "east" :
                        unit?.rotation === 180 ? "south" :
                        unit?.rotation === 270 ? "west" : "—"
                      } />
                      <Stat label="path" value={unit ? `${unit.path.length} cell${unit.path.length === 1 ? "" : "s"}` : "—"} />
                      <Stat label="state" value={unit?.path?.length ? "walking" : "idle"} accent={unit?.path?.length ? "emerald" : "stone"} />
                    </div>

                    <div className="pt-3 border-t border-emerald-900/50 space-y-2">
                      <div className="text-[9px] text-emerald-300/70 tracking-wider uppercase">map legend</div>
                      <div className="space-y-1 max-h-[24vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                        {tiles.map((t, i) => tileCounts[i] > 0 && (
                          <div key={t.id} className="flex items-center gap-2 text-[10px]">
                            <div className="w-5 h-5 rounded border border-stone-800 flex-shrink-0 pixel-tile relative" style={{ backgroundColor: t.color }}>
                              <img src={tileImageSrc(t)} alt="" className="w-full h-full object-cover pixel-tile" draggable={false} />
                            </div>
                            <span className={`flex-1 truncate ${t.walkable === false ? "text-red-300" : "text-stone-300"}`}>{t.name}</span>
                            <span className="text-stone-500">{tileCounts[i]}</span>
                            {t.walkable === false && <Ban size={10} className="text-red-400" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-center mt-6 text-[9px] text-stone-600 tracking-widest">⚙ TILES × SPRITES × BFS × CLAUDE ⚙</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = "amber" }) {
  const cls = accent === "emerald" ? "text-emerald-300" : accent === "stone" ? "text-stone-400" : "text-amber-300";
  return (
    <div className="flex justify-between border-b border-stone-900 pb-1">
      <span className="text-stone-500 uppercase tracking-wider text-[9px]">{label}</span>
      <span className={`${cls} font-bold tabular-nums`}>{value}</span>
    </div>
  );
}
