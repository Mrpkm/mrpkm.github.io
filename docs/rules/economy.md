# Economy

> **Status:** Resolved as of v0.15. The economy is a **pre-game point-buy system**
> layered on top of each doctrine's free starting army. It is *not* a mid-game
> production or resource-generation system — there is no in-game economy after
> setup is complete.

> 📎 Cross-reference: See units_and_entities.md → §8.3 / §8.4 for the **free**
> doctrine starting armies that the point-buy system tops up.

> 📎 Cross-reference: See open_questions.md for items still TBD (Plain doctrine
> details, the pre-game setup UI itself, mid-game reinforcements).

---

## E.1 War points (pre-game budget)

- **Per-doctrine starting budgets (resolved v0.16):**

  | Doctrine | War-point budget |
  |---|---|
  | **Plain** | **30 points** |
  | **Superior Firepower** | **35 points** |
  | **Blitzkrieg** | **25 points** |

  *(Was a uniform 20 points across all doctrines in v0.15; the 20-point
  ambiguity flag is resolved.)*
- War points are spent on three things:
  1. **Buying additional units** (on top of the free doctrine starting army)
  2. **Buying experience levels** for any unit at spawn
  3. **Buying spawn-state bonuses** (start entrenched, start in formation)
- Doctrines cap *how* you may spend (per category below). The budget is
  shared across all categories — the player decides the split.
- Unspent points are forfeit (no carry-over into the game).

---

## E.2 Buying units

Each doctrine grants a **free fixed starting army** (see units_and_entities.md
→ §8.3, §8.4). War points are spent on **additional** units beyond that free army.

### Unit costs

| Unit class | Examples | Cost per unit |
|---|---|---|
| **Light** | Infantry, Cavalry | **3 points** |
| **Heavy** | Tanks, Motorized Infantry | **5 points** |
| **Special** | Artillery | **5 points** |

### Doctrine caps on additional units bought

| Doctrine | Heavy | Light infantry | Light cavalry | Special |
|---|---|---|---|---|
| **Plain** | up to 5 | up to 5 | up to 5 | up to 5 |
| **Blitzkrieg** | **0** | up to 4 | up to 2 | up to 2 |
| **Superior Firepower** | up to 2 | up to 2 | up to 2 | up to 2 |

- Caps are **ceilings**, not requirements. A player may buy fewer than the cap
  in any category, including zero.
- Caps deliberately exceed what the budget can fund — the player must choose
  where to invest. (Plain max-buy ≈ 60 pts vs. 30-pt budget; Blitzkrieg max-buy
  = 28 pts vs. 25-pt budget; SF max-buy = 32 pts vs. 35-pt budget.)
- Blitzkrieg's "0 heavy" cap is **by design**: Blitzkrieg already gets 6 tanks
  and 4 motorized infantry for free in its starting army (units_and_entities.md
  → §8.3), so the point-buy layer pushes the player to round out the army with
  light units and artillery rather than stacking more heavies.
- Plain's flat "up to 5 per class" caps mirror the same flexibility used to
  pick its starting army (units_and_entities.md → §8.5) — Plain is the
  "compose your own" doctrine.

---

## E.3 Buying experience levels (pre-game XP)

Any unit in the player's army (free starting unit *or* point-bought) may be
**spawned at a higher experience level** by paying additional war points.

### XP costs per level (cumulative purchase)

| Buying up to… | Cost | Total spent on this unit's XP |
|---|---|---|
| 1st level | **2 points** | 2 |
| 2nd level | **4 points** | 6 |
| 3rd level | **5 points** | 11 |

- Costs are **per unit, per level purchased**.
- The progression (2 → 4 → 5) is **deliberately irregular** — the third tier is
  cheaper than a strict doubling would predict. This is intentional design.

### Doctrine caps on how many times a class may be XP-upgraded

| Doctrine | Light infantry | Cavalry | Heavy (tanks, motorized) | Artillery |
|---|---|---|---|---|
| **Plain** | up to 2nd level | up to 2nd level | up to 2nd level | up to 2nd level |
| **Blitzkrieg** | up to 2× | **0×** | up to 1× | **0×** |
| **Superior Firepower** | up to 3× | up to 3× | **0×** | up to 1× |

- "Up to N×" means: the player may purchase XP upgrades on up to N units of
  that class total (not "N levels per unit").
- **Plain's cap (resolved v0.16):** Plain may upgrade any unit up to **2nd
  level (Captain)** at pre-game, with no per-class count limit beyond the
  budget. Plain cannot pre-game upgrade a unit to 3rd level (Colonel).
- **"—" rows resolved (v0.16):** All previously-unspecified rows are now
  **0×** (no upgrades allowed in those classes for that doctrine).
  Specifically: Blitzkrieg cavalry and artillery, Superior Firepower heavy.

> 📎 Cross-reference: This is a **second XP path**, parallel to the in-game
> "defeat a smaller enemy unit" rule in units_and_entities.md → §3.3. Both paths
> coexist; pre-game XP simply gives a unit a head start.

---

## E.4 Spawn-state bonuses

A unit may be spawned in a non-default state by paying extra at setup.

| Bonus | Cost | Eligible units | Effect |
|---|---|---|---|
| **Spawn entrenched** | **3 points** | Any unit that can normally trench | Unit begins the game with the trench bonus already active, bypassing the 3-turn no-movement timer (combat.md → §5.6). |
| **Spawn in formation** | **5 points** | **Light units only** (Infantry + Cavalry) | Two light units spawn already stacked as a formation (units_and_entities.md → §4). |

- Both bonuses are paid out of the same 20-point budget.
- Available across all doctrines (no doctrine cap currently defined).
- The 5-point formation bonus pays for the formation itself — the two units
  participating must still be acquired separately (free from the starting army
  or bought via §E.2).

> 📎 Cross-reference: Spawn-entrenched is the only documented way to bypass
> combat.md → §5.6's 3-turn trench trigger. Spawn-formation places units in
> the §4 formation state from turn 1.

---

## E.5 What is *not* in the economy
- No mid-game production or resource generation.
- No income, upkeep, or unit cost during play.
- No mid-game purchases — all spending happens at setup.
- Reinforcements during play are still an open question (see open_questions.md).

> ⚠️ FLAG: The pre-game setup itself is a UI mechanism, with a partial
> resolution in v0.16: doctrine selection and **all pre-game tactical
> adjustments share a single menu** (war-point spending, unit placement,
> XP allocation, formation pairing, entrenchment toggles, doctrine pick).
> The actual interface layout, flow, and validation rules are still TBD.
> See ui_and_feedback.md.
