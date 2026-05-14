# Strategy Game — Current Status

> **Read this first** at the start of every new chat. This file is
> the single source of truth for *where the design is right now*.
>
> **Update this file at the end of every session.** Overwrite freely —
> history lives in `CHANGELOG.md`, this file is just the current
> snapshot.

---

## At a glance

| Field | Value |
|---|---|
| Current version | **v0.18** |
| Last updated | **2026-05-02** |
| Overall completion | **~95%** (base ruleset functionally closed; UI/UX outstanding) |
| Files in document set | 6 (game_core, units_and_entities, combat, economy, ui_and_feedback, open_questions) |
| Open questions | **0 base-ruleset items**; ~3 UI-layout items remaining in `ui_and_feedback.md` |
| Resolved this version | 13 (heavy-unit tactics applicability, tank reach as adjacency, minimum damage floor, stamina bookkeeping, Plain vanilla confirmation, default facing flipped, rotation timing, multi-rotation, formation rotation, F/S/R mapping, starting placement, board/terrain authoring style, turn limit + tiebreak, mid-game reinforcements, leftover war points) |

---

## Completion by system

| System | % | Status |
|---|---|---|
| Infantry (full unit) | 100 | ✅ Done |
| Cavalry (full unit) | 100 | ✅ Done |
| Tanks (full stats + tactics) | 100 | ✅ Done |
| Motorized Infantry (full stats + tactics) | 100 | ✅ Done |
| Artillery (full stats + tactics) | 100 | ✅ Done |
| Core mechanics (dice, grid, IGOUGO) | 100 | ✅ Done |
| Movement style (jump-based) | 100 | ✅ Done |
| Terrain types | 95 | ✅ Done (per-map terrain layout authored, not procedural) |
| Combat tactics (full applicability) | 100 | ✅ Done |
| Counter-attack | 95 | ✅ Done |
| Minimum damage floor | 100 | ✅ Done |
| Trench rules (full escalation) | 100 | ✅ Done |
| Doctrine framework | 100 | ✅ Done |
| Blitzkrieg doctrine | 95 | ✅ Done |
| Superior Firepower doctrine | 95 | ✅ Done |
| Plain doctrine | 100 | ✅ Done (vanilla confirmed) |
| Economy (war points, per-doctrine budgets, leftover forfeit) | 100 | ✅ Done |
| HQ / win condition (incl. turn-limit tiebreak) | 100 | ✅ Done |
| Formation rules (incl. independent rotation) | 100 | ✅ Done |
| Heavy-unit progression + stamina bookkeeping | 100 | ✅ Done |
| Facing system (rotation timing, multi-rotation, formation rotation, F/S/R, default) | 100 | ✅ Done |
| Starting placement | 95 | ✅ Done (half-and-half free placement) |
| Match flow (turn limit, no reinforcements, leftover points forfeit) | 100 | ✅ Done |
| UI / feedback | 15 | 🔴 Skeletal (single-menu confirmed; layout / validation / HUD surfaces TBD) |

---

## Recommended next focus

**The base ruleset is closed.** All remaining work lives in
`ui_and_feedback.md`:

1. **Pre-game menu layout.** The single shared menu is confirmed
   (doctrine pick, war-point spending, unit placement on the
   half-board, XP allocation, formation pairing, entrenchment
   toggles). The actual flow, validation rules, point-tracker
   display, and how the menu surfaces caps and remaining budget
   are still TBD.
2. **In-game HUD surfaces for tracked state.** Unit facing,
   cumulative Blitzkrieg still-penalty counter, trench-active
   status (and which tier — 3 / 4 / 6), XP/rank, active doctrine
   effects, HQ HP and capture-timer progress (5-turn occupy
   counter), and turn count toward the 1000-turn limit.
3. **Map authoring tooling.** Since maps and terrain are
   handcrafted, the design pipeline needs an editor or schema —
   not strictly a UI question for the player, but adjacent.
   Probably worth scoping separately.

---

## Source-of-truth rules

- **Version numbers** live in this file's "At a glance" table. Bump
  the version when a meaningful design decision is made.
- **Decision history** lives in `CHANGELOG.md` — never delete from it.
- **Live open questions** live in `open_questions.md` — that file is
  the working list, this file's "next focus" is just a shortlist.
- **If a rule changes**, the rule file gets updated, the changelog
  gets a new entry, *and* this file's completion table gets re-scored.

---

## Known gotchas for future sessions

- Some files (the v0.14 rules doc, the v0.1 open-questions doc)
  are **historical snapshots**, not live truth. The v0.15+ truth
  lives in the split files. Always cross-check against the split
  files before treating the v0.14 doc as current.
- The economy resolved the v0.14 "player-chosen units" mechanism.
  If you see "+5 flex slots" or "+2 heavy flex" anywhere, that's
  pre-v0.15 language and has been replaced by the war-point system.
- **The 20-point uniform budget is gone (v0.16).** If you see a
  reference to "20 war points" as a default, that's pre-v0.16 — the
  current per-doctrine budgets are Plain 30 / SF 35 / Blitzkrieg 25.
- **"Smaller unit" XP rule is gone (v0.16).** XP now triggers on
  defeating a *stronger* unit (higher rank, higher raw strength, or
  doctrine-modified). If you see "smaller enemy unit" anywhere, that's
  pre-v0.16 language.
- **Heavy progression is now level-based, not a separate tech tree
  (v0.16).** The earlier "different (yet to be designed) system"
  speculation for tanks/motorized/artillery is dropped.
- **The 4-turn trench tier is re-occupiable, not a single-unit
  carry-over (v0.17).** v0.16 framed it as "the original unit gets
  4 more turns of bonus after moving." v0.17 corrected this: the
  trench is a board feature, any Inf/Cav can enter it, and the timer
  resets on a new occupant's full 4-turn hold.
- **The 6-turn permanent trench's +1 modifier is locked (v0.17).**
  Once reduced from +2 / +1.5 to +1, the modifier stays +1 regardless
  of who occupies it later. No restoration path exists.
- **Default facing is no longer "North for all" (v0.18).** Both sides
  spawn facing each other (toward the opposing half of the board).
  v0.14 decision #15 is overturned. Since rotation is free, this only
  matters at spawn.
- **Artillery has zero tactics (v0.18).** No encirclement, no rear/
  side bonuses, no double attack, no formation, no trench, no terrain
  attack-bonus. If you see artillery getting a positional modifier
  anywhere, that's a bug.
- **Tank reach counts as adjacency for tactics (v0.18).** A tank
  doesn't need to be next to a target to contribute to double attack,
  encirclement, or rear/side direction — it just needs the target
  inside its 4-ortho / 3-diag reach. Encirclement-via-reach for tanks
  triggers at 2+ tanks "hugging" rather than the usual 4-orthogonal-
  neighbor threshold.
- **Minimum damage = 1 (v0.18).** The only exception is the
  Blitzkrieg Corporal-tank bounce rule, which can produce up to −3
  damage as an over-exhaustion penalty.
