# Strategy Game — Changelog

> **Purpose.** Append-only log of decisions made across chat sessions.
> One entry per session. Each entry lists what was *resolved*, what was
> *added*, and what *new questions* surfaced.
>
> **How to use.** At the end of every session, append a new section at the
> top under the version heading. Never edit old entries — if a previous
> decision is overturned, log the reversal as a new entry.
>
> **Companion file.** See `STATUS.md` for the current snapshot (latest
> version, completion %, open questions). This file is the *history*;
> `STATUS.md` is the *now*.

---

## v0.18 — 2026-05-02

> Closing pass on the remaining non-UI open questions. Three batched
> question sets resolved at once: heavy-unit tactics applicability,
> facing/rotation/placement, and match-flow/board. The ruleset is now
> functionally complete outside of UI/UX work.

### Resolved

**Combat & tactics**

- **Heavy-unit tactics applicability.**
  - **Motorized Infantry** uses the same tactics rules as the light
    units (Infantry, Cavalry) — all positional, terrain, formation,
    and trench tactics apply normally.
  - **Tanks** participate in tactics with a reach-based rule (next
    bullet).
  - **Artillery** has **no positional tactics** — encirclement,
    rear/side attack, double attack, formation, trench, and terrain
    attack-bonus modifiers all do not apply to artillery attacks.
  Cross-reference: combat.md → §5.10.
- **Tank reach counts as adjacency for positional tactics.** A tank's
  4-ortho / 3-diag attack reach is treated as positional adjacency for
  double attack, encirclement, and rear/side attack direction.
  **Encirclement-via-reach for tanks needs only 2 or more tanks
  "hugging" the target** (rather than the standard 4 orthogonal
  neighbors). Rear/side attack bonuses likewise resolve from the
  tank's relative direction to the defender, even when firing from
  range. Cross-reference: combat.md → §5.10.
- **Minimum damage floor → 1, with one exception.** All combat rolls
  resolve to a minimum of 1 damage. **Exception:** the Blitzkrieg
  Corporal-tank bounce rule (combat.md → §5.9) can still produce a
  negative attack via the over-exhaustion penalty (up to −3).
  Cross-reference: combat.md → §5.9.
- **Stamina bookkeeping for Tank/Motorized progression.**
  - Level-1 "use bonus +1 ortho square": **−1 attack stamina applies
    this turn**; the no-move penalty applies **next turn**.
  - Level-2 "use bonus attack": the no-attack penalty applies **next
    turn**; movement is unaffected on either turn.
  Cross-reference: units_and_entities.md → §3.2a.
- **Plain doctrine confirmed vanilla.** No signature rule beyond the
  slow 2-ortho / 0-diag tank profile. The "Plain has no signature
  rule" decision is intentional, not "TBD". Cross-reference:
  units_and_entities.md → §8.5.

**Facing, rotation, formations, placement**

- **Default facing → both sides face each other.** Replaces the v0.14
  "all units spawn facing North" default. Each side's units spawn
  facing the opposing player's half of the board.
  Cross-reference: game_core.md → §1.5, units_and_entities.md → §6.1.
- **Rotation timing → free, anytime in your turn (including pre-game).**
  Rotation does not consume an action and may happen any number of
  times during a unit's turn (rotate → move → rotate again is legal).
  Cross-reference: units_and_entities.md → §6.3.
- **Formation rotation → individual.** Stacked units in a formation
  rotate **independently** — each unit keeps its own facing. This
  matters because formations cannot move, so individual facing
  becomes the only directional decision available to the formation.
  Cross-reference: units_and_entities.md → §4.4, §6.3.
- **Front/Side/Rear mapping → keep 3/2/3.** Front N/NW/NE, Side E/W,
  Rear S/SW/SE confirmed; no finer 1/2/2/2/1 split.
  Cross-reference: units_and_entities.md → §6.2.
- **Starting placement → half-and-half free placement.** The board is
  divided into two equal halves at pre-game; within their half each
  player freely places their starting army. **Every doctrine starting
  army (Plain, Blitzkrieg, Superior Firepower) may be repositioned
  pre-game** — there are no fixed deployment slots beyond the half-line
  constraint. Cross-reference: units_and_entities.md → §8.1,
  game_core.md → §1.4.

**Match flow & board**

- **Board → handcrafted maps.** Both board layout (size, shape, HQ-
  corner placement details) and terrain population are designer-
  authored per map. No procedural generation.
  Cross-reference: game_core.md → §1.4.
- **Turn limit → 1000 turns (or external timer).** If the limit is
  reached without an HQ falling, **the winner is the side whose HQ has
  more remaining HP**. Equal HQ HP at the limit results in a draw.
  Cross-reference: game_core.md → §1.2, §1.8.
- **No mid-game reinforcements.** Strictly "what you start with."
  Cross-reference: economy.md → §E.5.
- **Leftover war points → forfeit, no mid-game spending.** Confirmed:
  unspent points remain unspent and never re-enter play. Cross-
  reference: economy.md → §E.5.

### Added

- **combat.md → §5.10 "Heavy-unit tactics applicability"** — new
  sub-section consolidating the per-tactic-per-unit rules for Tanks,
  Motorized Infantry, and Artillery, including the tank-reach-as-
  adjacency rule and the relaxed 2-tank encirclement.
- **game_core.md → §1.8 "Turn limit and time-out resolution"** — the
  1000-turn cap with HQ-HP tiebreak.
- **units_and_entities.md → §4.4** — formation rotation note (each
  stacked unit rotates independently).
- **units_and_entities.md → §8.1.1** — starting placement: board
  halved, free placement within your half, all doctrine armies
  repositionable pre-game.

### Changed

- **Default facing: North → "facing each other".** v0.14 decision #15
  ("Default facing = North for all units") is overturned. The new
  spawn default is opposing-side-facing, applied to both armies.
  This only matters at spawn since rotation is already free.
- **Encirclement for tanks: 4 neighbors → 2 hugs via reach.** Tanks
  get a relaxed encirclement threshold reflecting their long reach.
  Other units still require the standard 4-orthogonal-neighbor
  encirclement.
- **Minimum damage floor: open → 1 (with the existing Blitzkrieg-
  bounce exception).**

### New questions surfaced

- **None outside UI/UX.** The base ruleset is functionally closed.
  Remaining open work lives entirely in `ui_and_feedback.md`:
  pre-game menu layout, HUD surfaces for tracked state (facing,
  still-penalty counter, trench status, XP, doctrine effects),
  validation rules, and budget displays.

---

## v0.17 — 2026-05-02

> Source: PDF "AI game Heavy/Special units" — fills in the Tank,
> Motorized Infantry, and Artillery stat blocks, closes four
> doctrine-framework open questions, and refines the long-term trench
> escalation rules.

### Resolved
- **Tank base stat block.** HP 8 (1+7), base strength 3, base defense 3,
  attack reach 4 sq orthogonal / 3 sq diagonal. Base movement 3 ortho /
  0 diag was already on the books; the rest is new. Cross-reference:
  units_and_entities.md → §2.1, §2.3.
- **Motorized Infantry base stat block.** HP 6 (1+5), movement 3 ortho /
  2 diag, attack reach 3 sq (8-side), base strength 2, base defense 1.
  Cross-reference: units_and_entities.md → §2.1, §2.3.
- **Artillery base stat block.** HP 2 (1+1), movement 1 ortho / 1 diag,
  base strength 3, base defense 0.5. Reach 6 sq (already on the books)
  is confirmed as 8-side (diagonal fire is allowed). Cross-reference:
  units_and_entities.md → §2.1, §2.3.
- **Doctrine count → only 3 in the base game.** Plain, Blitzkrieg,
  Superior Firepower. Set is closed for now but flagged as expandable.
  Cross-reference: units_and_entities.md → §8.6.
- **Doctrine combinations → one per army.** Not stackable. Cross-reference:
  units_and_entities.md → §8.6.
- **Doctrine symmetry → same shared pool.** Doctrines are not faction-
  or side-locked. Identical-doctrine matchups (e.g. Blitzkrieg vs.
  Blitzkrieg) are allowed. Cross-reference: units_and_entities.md → §8.6.
- **Doctrine-locked units → none.** All five unit types are purchasable
  by any doctrine, subject only to per-doctrine point-buy caps.
  Cross-reference: units_and_entities.md → §8.6, economy.md → §E.2.
- **Trench reset → fully specified, 3-tier escalation.**
  - **3 turns held → exit:** trench disappears immediately. No carry-over.
  - **4 turns held → exit:** trench remains in place at full modifiers
    (Inf +2 / Cav +1.5). Other Inf/Cav may move onto the square and use
    the standing trench. A new occupant who stays a full 4 turns and
    then leaves resets the "trench remains" state. Empty trench
    eventually disappears.
  - **6 turns held → permanent:** trench locks in for the rest of the
    game, but both modifiers are reduced to **+1 defence**. Any Inf/Cav
    may freely use it; the reduced modifier cannot be restored to
    original values regardless of subsequent occupation.
  Cross-reference: combat.md → §5.6.

### Added
- **Tank attack-reach asymmetry note** (units_and_entities.md → §2.1, §2.3)
  — tanks are the only unit with different orthogonal vs. diagonal
  attack reach, called out explicitly so it doesn't read as a typo.
- **Re-occupation rules for the 4-turn trench tier** (combat.md → §5.6)
  — formalizes that a standing trench is shared infrastructure, not
  unit-bound, with a clear "if empty, eventually disappears" condition.

### Changed
- **Long-term trench (4-turn tier) → re-occupiable.** v0.16 said the
  bonus simply "carries over for 4 more turns." v0.17 replaces this
  with the full re-occupation model: the trench remains as a board
  feature, can be entered by any Inf/Cav, and the timer resets if a
  new occupant holds and leaves. The "4 more turns of free bonus on
  the original unit" framing is overturned.
- **Permanent trench (6-turn tier) → modifier locked, not just reduced.**
  v0.16 said the modifier was "reduced to +1." v0.17 clarifies that the
  reduction is **final** — re-occupation cannot restore the original
  +2 / +1.5 values.

### New questions surfaced
- **Tactics applicability to heavy units** — now that Tank/Motorized/
  Artillery have full base stats, the question of which combat tactics
  (encirclement, terrain attack bonuses, formation, trench, side/rear
  attack modifiers) apply to them is the most pressing remaining gap.
  Currently the only universal rule is "diagonal does not count as a
  positional tactic" (v0.16). Per-tactic per-unit applicability is
  unspecified.
- **Tank attack reach 4/3 in encirclement geometry** — a tank with
  4-square orthogonal reach can strike a target it is *not* adjacent
  to. Whether such attacks count toward "double attack" / "encirclement"
  bonuses (which currently require orthogonal *adjacency*) needs
  clarification once the heavy-tactics question above is addressed.

---

## v0.16 — 2026-05-01

> Source: PDF "Finishing the flagged questions" — a single document
> resolving roughly half of the v0.15 open-question backlog at once.

### Resolved
- **HQ win condition → fully defined.** HQs placed bottom-left and
  top-right (symmetric). Each HQ has a 3-square reach. Two parallel
  win paths: occupy the reach for 5 turns OR deal 20 damage.
  Cross-reference: game_core.md → §1.2.
- **HQ placement → corners (resolved).** Removes the v0.1
  companion-doc question. Cross-reference: game_core.md → §1.2.
- **IGOUGO actions per unit → 2 actions/turn.** Each unit may move or
  attack 2 times, freely split between movement and attack. Defines
  the "stamina" referenced by heavy-unit progression and the
  counter-attack rule. Cross-reference: game_core.md → §1.6.
- **Heavy-unit progression system → same level-based system.** The
  earlier "different (yet to be designed) system" speculation is
  dropped. Tank/Motorized share one progression table; Artillery has
  its own. Cross-reference: units_and_entities.md → §3.2a, §3.2b.
- **XP trigger → "stronger" not "smaller."** A unit gains XP when it
  defeats an enemy that is stronger by any of three criteria: higher
  rank, higher total raw strength, or currently benefiting from
  doctrine modifiers. Cross-reference: units_and_entities.md → §3.3.
- **Rank naming → Corporal / Captain / Colonel.** Named tiers
  confirmed over numbered. Cross-reference: units_and_entities.md → §3.4.
- **Heavy units cannot form formations.** Formation is light-only
  (Infantry + Cavalry). Cross-reference: units_and_entities.md → §4.1.
- **Long-term trench → escalation rules.** 4 turns held → bonus carries
  for 4 more turns even after the unit moves. 6 turns held → trench
  becomes permanent for the rest of the game, bonus reduced to +1 def
  for both Infantry and Cavalry. Cross-reference: combat.md → §5.6.
- **Counter-attack → defined.** Defender auto-rolls a counter-attack D6
  if it has attack-stamina remaining. If the attacker has fully
  exhausted its attacks that turn, the defender additionally gets a
  bonus D6 scaling 0.5 strength per pip (1→+0.5, 6→+3.0).
  Cross-reference: combat.md → §5.9.
- **Diagonal does not count as a positional-attack tactic.** This
  resolves the double-attack-adjacency question (diagonal neighbors
  do NOT contribute to the +1 strength double-attack bonus) and
  generalizes the encirclement-orthogonal-only rule to all positional
  bonuses. Cross-reference: combat.md → §5.9, §5.2, §7.
- **Plain doctrine → fully defined.** 14-unit starting army, player
  chooses up to 5 per class. Tank profile 2 ortho / 0 diag. No
  signature rule beyond the tank profile. War-point budget 30; up to
  5 units per class at point-buy; XP capped at 2nd level (Captain)
  per class. Cross-reference: units_and_entities.md → §8.5,
  economy.md → §E.1, §E.2, §E.3.
- **Per-doctrine war-point budgets.** Plain 30 / Superior Firepower
  35 / Blitzkrieg 25. Replaces the uniform 20. Cross-reference:
  economy.md → §E.1.
- **Unspecified XP-upgrade caps → all 0×.** All previously-"—" rows
  resolve to 0× (no upgrades): Blitzkrieg cavalry, Blitzkrieg
  artillery, Superior Firepower heavy. Cross-reference: economy.md → §E.3.
- **Doctrine selection method → pre-game pick on shared menu (partial).**
  Doctrine is chosen on the same combined pre-game menu used for
  war-point spending, placement, XP allocation, formation pairing,
  and entrenchment toggles. Cross-reference: units_and_entities.md →
  §8.6, ui_and_feedback.md, economy.md → §E.5.

### Added
- **Tank / Motorized progression table** (units_and_entities.md → §3.2a)
  — level 1 grants +1 ortho movement (with stamina-cost drawback);
  level 2 grants +1 attack stamina (with skip-attack drawback); level 3
  allows wait-1-turn for +2 def. Blitzkrieg interactions noted at each
  level.
- **Artillery progression table** (units_and_entities.md → §3.2b) —
  level 1 grants +1 reach with no drawback (stacks with SF range cap);
  level 2 grants +2 strength inside 5 squares; level 3 grants +1 ortho
  movement.
- **Counter-attack mechanic** (combat.md → §5.9) — D6 base; bonus D6
  vs. exhausted attacker.
- **Blitzkrieg "bounce" rule** (combat.md → §5.9) — Corporal-rank tanks
  unable to move at 1 attack stamina may roll up to −3 attack as an
  over-exhaustion penalty.
- **Long-term trench escalation** (combat.md → §5.6) — 4-turn carry-over
  and 6-turn permanent-with-reduced-bonus tiers.
- **Pre-game menu (UI section)** (ui_and_feedback.md) — confirms a
  single shared pre-game menu drives all setup; layout still TBD.

### Changed
- **Uniform 20-point budget → per-doctrine 30 / 35 / 25.** The "by
  default each player starts with 20 war points" rule is overturned;
  the budget is now doctrine-specific.
- **"Smaller enemy unit" → "stronger enemy unit"** as the XP-gain
  trigger. Same rule, opposite direction; criteria are now explicit
  (rank, raw strength, doctrine-modified).
- **Double attack +1 str** now requires **orthogonal** adjacency only
  (was unspecified). Updated in combat.md → §5.2 and §7.

### New questions surfaced
- **Tank base stat block** — HP, base strength, base defense, attack
  reach (progression now defined, but the *base* stats those bonuses
  modify are still TBD).
- **Motorized Infantry base stat block** — entirely TBD; only progression
  is defined (shared with tanks).
- **Artillery base stat block** — HP, base strength, base defense,
  movement (only base reach 6 is set).
- **Tank "stamina" interaction with IGOUGO** — the level-1 and level-2
  Tank/Motorized bonuses describe a "stamina" cost system that maps
  intuitively onto the 2-actions-per-turn rule from §1.6, but the exact
  bookkeeping (which action it consumes, how it interacts with the
  counter-attack stamina check) deserves a clean writeup once heavy
  base stats are filled in.
- **Plain "no signature rule"** — Plain has the slower tank profile but
  no other signature rule. Confirm this is intentional rather than
  "TBD."

---

## v0.15 — 2026-05-01 *(backfilled from doc set)*

> Inferred from the v0.15 markers in `economy.md`, `units_and_entities.md`,
> `combat.md`, and `open_questions.md`. Exact session date approximated to
> today's date because the original session date isn't recorded in the
> source files. Update this if you have the real date.

### Resolved
- **Movement style → jump-based.** Units select any tile inside their
  movement footprint; intermediate tiles do not block. Destination rules
  defined (units_and_entities.md → §2.4).
- **Terrain types → 4 defined.** Grasslands, swamp, forest, mountains —
  with full per-unit movement / defense / trench interactions
  (units_and_entities.md → §2.5).
- **Bad terrain → mountains only, all units.** The −1 attack-strength
  penalty applies when the attacker stands on a mountain tile. The
  cavalry exemption is removed (combat.md → §5.2, §5.9).
- **Player-chosen units → replaced by war-point system.** The "+5 flex"
  (Blitzkrieg) and "+2 heavy flex" (SF) entries from v0.14 are gone.
  Replaced by 20 war points spent pre-game on units, XP, and
  spawn-bonuses (economy.md → §E.1–§E.4).
- **"Heavy units" category → tanks and motorized infantry.** Artillery
  is its own "special" class (economy.md → §E.2).

### Added
- **`economy.md`** — full pre-game point-buy system: 20-point budget,
  unit costs (light 3 / heavy 5 / special 5), XP costs (2/4/5),
  spawn-bonus costs (entrench 3 / formation 5), per-doctrine caps for
  Blitzkrieg and SF.
- **Plain doctrine** — referenced as a third doctrine option in
  `economy.md` and `units_and_entities.md → §8.5`, but with no defined
  army, signature rules, or caps yet.
- **Document split** — the consolidated `strategy_game_rules_v0.14.md`
  was split into `game_core.md`, `units_and_entities.md`, `combat.md`,
  `economy.md`, `ui_and_feedback.md`, plus the consolidated
  `open_questions.md`.

### New questions surfaced
- Plain doctrine — full definition (army, signature rules, default caps).
- Pre-game setup UI — point tracker, doctrine picker, placement,
  formation pairing, entrenchment toggles, XP allocation.
- Per-doctrine 20-point budget — is the budget itself doctrine-modified?
- Unspecified XP-upgrade caps — are "—" rows "0 allowed" or "default"?
- Mid-game reinforcements vs. pre-game-only economy.

---

## v0.14 — *(date unknown — pre-split baseline)*

> The consolidated rules document `strategy_game_rules_v0.14.md` and its
> companion `strategy_game_open_questions_v0.1.md` are the baseline this
> changelog starts tracking from. The 31 decisions in §10 of the v0.14
> rules doc represent the cumulative result of all sessions before this
> file existed.

### Decisions log (carried forward from v0.14 §10)
1. Win = HQ capture
2. Positional attacks use split system
3. Trench is flat +2 def for infantry
4. Dice = 1d6
5. HP = 1 + unit-type bonus
6. Each unit has its own progression table
7. Other units exist (motorized, tanks, artillery)
8. Square grid, 8 directions
9. Infantry: 2 ortho / 1 diag movement
10. Cavalry: 2 in every direction movement
11. Cavalry rank-2 bonus = movement becomes 4/4
12. Encirclement bonus is orthogonal-only
13. Units have a tracked facing direction
14. 4 facings (N/S/E/W only)
15. Default facing = North for all units
16. Free rotation, no penalty
17. No reactive turn when hit from rear
18. Infantry: base str 1, base def 0, attack reach 1
19. Cavalry: base str 0.5, base def 1, attack reach 2
20. All tactics apply to both Infantry and Cavalry
21. Damage formula additive
22. Fragility is intentional
23. Doctrines are army-defining packages
24. Turn structure: IGOUGO
25. Tank base movement: 3 ortho / 0 diag
26. Doctrines override unit stats, not stack on top
27. Blitzkrieg tank: 4 ortho / 0 diag, cumulative −1 def per still turn
28. Superior Firepower tank: 2 ortho / 1 diag, no penalty
29. Artillery base attack range: 6 squares
30. Superior Firepower artillery: range 12, −0.5 str after square 8
31. Range falloff added as combat concept

---

## Template for new entries

```
## v0.XX — YYYY-MM-DD

### Resolved
- **Question name → resolution.** One-line summary.
  Cross-reference: file.md → §X.Y.

### Added
- **New thing** — what it is, where it lives.

### Changed
- **Old rule → new rule.** Why it was overturned.

### New questions surfaced
- Question name — one-line description.
```
