  const { useState, useEffect } = React;

  function parsePoly(s) {
    return s.trim().split(/\s+/).map(p => p.split(',').map(Number));
  }
  function stringifyPoly(arr) {
    return arr.map(p => p.join(',')).join(' ');
  }
  function centroid(pts) {
    const n = pts.length;
    let sx = 0, sy = 0;
    pts.forEach(([x,y]) => { sx += x; sy += y; });
    return [sx/n, sy/n];
  }
  function scalePoly(pts, factor) {
    const [cx, cy] = centroid(pts);
    return pts.map(([x,y]) => [
      Math.round(cx + (x - cx) * factor),
      Math.round(cy + (y - cy) * factor),
    ]);
  }
  function translatePoly(pts, dx, dy) {
    return pts.map(([x,y]) => [Math.round(x+dx), Math.round(y+dy)]);
  }

  function PolyEditor({ id, name, value, onChange }) {
    const pts = parsePoly(value);
    const setPt = (i, axis, v) => {
      const next = pts.map(p => p.slice());
      next[i][axis] = v;
      onChange(stringifyPoly(next));
    };
    const nudge = (dx, dy) => onChange(stringifyPoly(translatePoly(pts, dx, dy)));
    const scale = (f) => onChange(stringifyPoly(scalePoly(pts, f)));

    const corners = ['TL','TR','BR','BL'];
    return (
      <>
        <TweakSection label={name} />
        <div style={{display:'flex', gap:4, marginBottom:6}}>
          <button className="twk-btn" onClick={() => scale(1.05)}>+ size</button>
          <button className="twk-btn" onClick={() => scale(0.95)}>&#8722; size</button>
          <button className="twk-btn" onClick={() => nudge(0,-4)}>&#8593;</button>
          <button className="twk-btn" onClick={() => nudge(0,4)}>&#8595;</button>
          <button className="twk-btn" onClick={() => nudge(-4,0)}>&#8592;</button>
          <button className="twk-btn" onClick={() => nudge(4,0)}>&#8594;</button>
        </div>
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <TweakSlider label={`${corners[i]} X`} value={p[0]} min={0} max={1408} step={1} unit="px"
              onChange={(v)=>setPt(i,0,v)} />
            <TweakSlider label={`${corners[i]} Y`} value={p[1]} min={0} max={768} step={1} unit="px"
              onChange={(v)=>setPt(i,1,v)} />
          </React.Fragment>
        ))}
      </>
    );
  }

  function LabelTweaks() {
    const [t, setTweak] = useTweaks(window.__TWEAK_DEFAULTS);
    const [showPolyMarkers, setShowPolyMarkers] = useState(false);
    const [tab, setTab] = useState('labels');

    useEffect(() => { window.__applyTweaks(t); }, [t]);

    useEffect(() => {
      const overlay = document.getElementById('overlay');
      if (!overlay) return;
      overlay.classList.toggle('show-all', tab === 'polys');
    }, [tab]);

    const labels = [
      ['records',  'RECORDS',         'rec'],
      ['patch',    'PATCH NOTES',     'patch'],
      ['whatsnew', "WHAT'S NEW?",     'new'],
      ['play',     'PLAY GAME',       'play'],
      ['setup',    'PRE-GAME SETUP',  'setup'],
      ['rules',    'GAME RULES',      'rules'],
    ];

    const polyKeys = [
      ['poly_records',  'RECORDS box'],
      ['poly_patch',    'PATCH NOTES box'],
      ['poly_whatsnew', "WHAT'S NEW? box"],
      ['poly_play',     'PLAY GAME box'],
      ['poly_setup',    'PRE-GAME SETUP box'],
      ['poly_recon',    'RECON box (extra)'],
      ['poly_rules',    'GAME RULES box'],
    ];

    return (
      <TweaksPanel title="Menu Tweaks">
        <div style={{display:'flex', gap:4, marginBottom:8}}>
          <button className={'twk-tab ' + (tab==='labels'?'on':'')}
            onClick={()=>setTab('labels')}>Labels</button>
          <button className={'twk-tab ' + (tab==='polys'?'on':'')}
            onClick={()=>setTab('polys')}>Hotspot shapes</button>
          <button className={'twk-tab ' + (tab==='custom'?'on':'')}
            onClick={()=>setTab('custom')}>Custom</button>
        </div>

        {tab === 'labels' && <>
          <TweakSection label="Global" />
          <TweakSlider label="Label size"
            value={t.labelSize} min={12} max={48} step={1} unit="px"
            onChange={(v) => setTweak('labelSize', v)} />
          {labels.map(([key, name, prefix]) => (
            <React.Fragment key={key}>
              <TweakSection label={name} />
              <TweakSlider label="X" value={t[`${prefix}_x`]} min={0} max={1408} step={1} unit="px"
                onChange={(v) => setTweak(`${prefix}_x`, v)} />
              <TweakSlider label="Y" value={t[`${prefix}_y`]} min={0} max={768} step={1} unit="px"
                onChange={(v) => setTweak(`${prefix}_y`, v)} />
            </React.Fragment>
          ))}
        </>}

        {tab === 'polys' && <>
          <p style={{fontSize:11, color:'#666', margin:'4px 0 8px'}}>
            All hotspot shapes are visible while this tab is active. Each box has 4 corners (TL/TR/BR/BL).
          </p>
          {polyKeys.map(([key, name]) => (
            <PolyEditor
              key={key} id={key} name={name}
              value={t[key]}
              onChange={(v) => setTweak(key, v)}
            />
          ))}
        </>}

        {tab === 'custom' && <CustomItemsEditor t={t} setTweak={setTweak} />}

        <TweakSection label="Reset" />
        <TweakButton label="Restore defaults" onClick={() => {
          Object.entries(window.__TWEAK_DEFAULTS).forEach(([k, v]) => setTweak(k, v));
        }} />
      </TweaksPanel>
    );
  }

  function CustomItemsEditor({ t, setTweak }) {
    const items = (() => { try { return JSON.parse(t.custom_items || '[]'); } catch { return []; }})();
    const save = (next) => setTweak('custom_items', JSON.stringify(next));

    const addItem = () => {
      const id = 'c' + Date.now();
      const next = [...items, {
        id,
        title: 'NEW ITEM',
        body: 'Click to view details.',
        lx: 200, ly: 200, size: 22,
        poly: '150,150 350,150 350,250 150,250',
      }];
      save(next);
    };

    const update = (idx, patch) => {
      const next = items.map((it, i) => i === idx ? { ...it, ...patch } : it);
      save(next);
    };
    const remove = (idx) => save(items.filter((_, i) => i !== idx));

    useEffect(() => {
      const overlay = document.getElementById('overlay');
      if (!overlay) return;
      overlay.classList.add('show-all');
      return () => overlay.classList.remove('show-all');
    }, []);

    return (
      <>
        <p style={{fontSize:11, color:'#666', margin:'4px 0 8px'}}>
          Add your own menu points. Each gets a label and a 4-corner hotspot box.
        </p>
        <TweakButton label="+ Add custom item" onClick={addItem} />
        {items.length === 0 && (
          <p style={{fontSize:11, fontStyle:'italic', color:'#999', marginTop:8}}>
            No custom items yet. Click "+ Add" to create one.
          </p>
        )}
        {items.map((it, i) => (
          <div key={it.id} style={{
            border:'1px solid rgba(0,0,0,0.15)', borderRadius:6,
            padding:8, marginTop:10, background:'rgba(255,255,255,0.4)'
          }}>
            <div style={{display:'flex', gap:4, marginBottom:6}}>
              <input
                type="text" value={it.title}
                onChange={(e)=>update(i, {title: e.target.value})}
                style={{flex:1, padding:'3px 6px', fontSize:11,
                        border:'1px solid rgba(0,0,0,0.2)', borderRadius:4,
                        fontFamily:'inherit'}}
                placeholder="Title" />
              <button className="twk-btn" style={{flex:'0 0 auto', color:'#a33'}}
                onClick={()=>remove(i)}>&#x2715;</button>
            </div>
            <textarea
              value={it.body || ''}
              onChange={(e)=>update(i, {body: e.target.value})}
              placeholder="Description (shown when clicked)"
              rows={2}
              style={{width:'100%', fontSize:11, padding:'3px 6px',
                      border:'1px solid rgba(0,0,0,0.2)', borderRadius:4,
                      fontFamily:'inherit', resize:'vertical', marginBottom:6}} />
            <TweakSlider label="Size" value={it.size || 22} min={12} max={48} step={1} unit="px"
              onChange={(v)=>update(i, {size: v})} />
            <TweakSlider label="Label X" value={it.lx} min={0} max={1408} step={1} unit="px"
              onChange={(v)=>update(i, {lx: v})} />
            <TweakSlider label="Label Y" value={it.ly} min={0} max={768} step={1} unit="px"
              onChange={(v)=>update(i, {ly: v})} />
            <PolyEditor
              id={it.id} name="Hotspot box"
              value={it.poly}
              onChange={(v)=>update(i, {poly: v})}
            />
          </div>
        ))}
      </>
    );
  }

  ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<LabelTweaks />);