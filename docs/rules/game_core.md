# Strategy Game — Consolidated Rules (v0.18)

> **Status:** Base ruleset functionally closed. All non-UI open
> questions resolved as of v0.18.
> **Format:** Digital game (computer manages all state — no manual bookkeeping).
> **Style:** Light, chess-like tactical game with WWII-era doctrines.

---

## 1. Core concepts

### 1.1 Platform
- **Digital game** — the computer holds all memory: turn counts,
  experience, hidden state, facing directions, doctrine effects,
  cumulative still-penalties, etc.
- The doctrines layer (§8) makes a digital implementation essential —
  manually tracking army-wide modifiers and unit overrides would be
  impractical.

### 1.2 Win condition
- **Capture the enemy HQ.**
- **HQ placement (resolved v0.16):** HQs are placed on the **bottom-left and
  top-right corners**, symmetrically — one per player.
- **HQ reach:** Each HQ has a **3-square reach in every direction**.
- **Damage trigger:** When an enemy unit is within the HQ's 3-square reach,
  the HQ takes damage.
- **Capture conditions (either path triggers a win):**
  1. **Occupation:** A unit stays inside the HQ's reach for **5 turns** → HQ captured.
  2. **Damage:** The HQ is dealt **20 damage** (cumulative, by any unit).
- **Tiebreak at turn limit (resolved v0.18):** If neither HQ has fallen by
  the **1000-turn limit** (or by an external real-time timer if one is in
  use), the winner is the side whose HQ has **more remaining HP**. Equal
  HQ HP at the limit is a draw. See §1.8.

### 1.3 Dice
- **1d6** for all combat rolls (range 1–6, average 3.5).
- Half-point bonuses (e.g. +0.5) are valid and meaningful — the computer
  handles the arithmetic.
- **Damage floor (resolved v0.18):** Final damage is clamped to a minimum
  of 1, except for the Blitzkrieg Corporal-tank bounce rule which can
  produce up to −3. See combat.md → §5.1, §5.9.

### 1.4 Board
- **Square grid** with **8-direction movement** (4 orthogonal + 4 diagonal).
- **Maps are handcrafted (resolved v0.18).** Board size, shape, and
  terrain placement are all designer-authored per map. There is no
  fixed canonical board size and no procedural generation — maps are
  content. The four terrain types (grasslands, swamp, forest, mountains
  — see units_and_entities.md → §2.5) are placed by the map author.
- **Orthogonal directions:** North, South, East, West.
- **Diagonal directions:** NE, NW, SE, SW.

> **Design signature:** Different unit types have different movement
> rules for orthogonal vs. diagonal — a deliberate distinction that
> gives each unit a unique footprint and feel.

> 📎 Cross-reference: HQ placement is fixed at bottom-left and top-right
> corners (§1.2). Starting unit placement is half-and-half free
> placement within each player's half — see units_and_entities.md → §8.1.1.

### 1.5 Unit facing (summary — full rules in §6 of units_and_entities.md)
- Every unit has a tracked facing direction (one of **4: N/S/E/W**).
- **Default facing at spawn (resolved v0.18):** **Both sides face each
  other** — units spawn facing the opposing player's half of the board.
  Replaces the v0.14 "all units spawn facing North" default.
- **Free rotation** (no penalty) — anytime in your turn, including
  pre-game; multiple rotations per turn allowed; formations rotate
  per-unit (resolved v0.18).
- **No reactive turn** — being attacked from rear does NOT change the
  defender's facing.

> 📎 Cross-reference: See units_and_entities.md → §6 Facing system for full rules.

### 1.6 Turn structure
- **IGOUGO** (I-Go-You-Go) — one player takes their full turn (moving,
  attacking, rotating any of their units), then the other player does the same.
- **Actions per unit (resolved v0.16):** Each unit can **move or attack 2 times**
  per turn. The two actions can be split across move/attack as the player
  chooses.
- **Stamina interactions:** Tank/Motorized level-1 and level-2 progression
  bonuses spend or borrow against this 2-action budget — see
  units_and_entities.md → §3.2a for the full bookkeeping.

### 1.7 Game design philosophy
- **Two layers of decision-making:**
  - **Tactical layer:** per-unit movement, attacks, facing, formation
  - **Strategic layer:** doctrine choice, army composition, HQ defense
- **Fragility by design:** Base units die quickly from clean hits.
  Modifiers (positioning, terrain, trench, formation, experience,
  doctrines) are how units actually survive. This creates room for
  tanks to feel powerful without being broken.
- **Doctrines define your game.** Each doctrine = a different starting
  army, different placement, and different signature rules. Two players
  with the same doctrines vs. different doctrines play *very different*
  games.

### 1.8 Turn limit and time-out resolution (resolved v0.18)
- **Hard turn cap: 1000 turns** (counting both players' turns
  consecutively, or per the implementation's chosen counting convention —
  the canonical limit is 1000).
- **Optional real-time timer:** Implementations may also impose a
  wall-clock match timer; if either limit is reached, the same tiebreak
  applies.
- **Tiebreak rule:** When the limit is reached without an HQ falling,
  the **side with more remaining HQ HP wins**. Equal HQ HP at the
  limit results in a **draw**.
- **No mid-game reinforcements** (resolved v0.18): The army you set up
  pre-game is the army you finish the match with, minus losses. Leftover
  war points are forfeit. See economy.md → §E.5.

---

## 10. Decisions log

| # | Decision | Reasoning |
|---|---|---|
| 1 | Win = HQ capture | Chess-like feel; gives infantry defensive purpose |
| 2 | Positional attacks use **split system** | Doubles positioning impact |
| 3 | Trench is **flat +2 def** for infantry | +3 was a transcription error |
| 4 | Dice = **1d6** | Light, fast, chess-like |
| 5 | HP = **1 + unit-type bonus** | User-defined formula; clean scaling |
| 6 | Each unit has its **own progression table** | Different roles, different growth |
| 7 | Other units exist (motorized, tanks, artillery) | Different progression system |
| 8 | **Square grid, 8 directions** | Allows directional movement asymmetry |
| 9 | **Infantry: 2 ortho / 1 diag movement** | Unique footprint |
| 10 | **Cavalry: 2 in every direction movement** | Flexible identity |
| 11 | Cavalry rank-2 bonus = movement becomes 4/4 | Hit-and-run role |
| 12 | **Encirclement bonus is orthogonal-only** | Reachable; rewards committed pressure |
| 13 | **Units have a tracked facing direction** | Eliminates ambiguity |
| 14 | **4 facings (N/S/E/W only)** | Simpler, cleaner |
| 15 | ~~Default facing = North for all units~~ **OVERTURNED v0.18 — both sides face each other** | Spawn intuitiveness; rotation already free so this only matters at spawn |
| 16 | **Free rotation, no penalty** | Tactical without punishing players |
| 17 | **No reactive turn when hit from rear** | Facing is deliberate, not reflexive |
| 18 | **Infantry: base str 1, base def 0, attack reach 1** | Frontline striker |
| 19 | **Cavalry: base str 0.5, base def 1, attack reach 2** | Skirmisher with range |
| 20 | **All tactics apply to both Infantry and Cavalry** | Simpler ruleset |
| 21 | **Damage formula additive: (roll + base + bonuses) − (def + bonuses)** | Base stats are modifiers |
| 22 | **Fragility is intentional** | Creates room for tank power tier |
| 23 | **Doctrines are army-defining packages** | Each doctrine = units + placement + signature rules, not just modifiers |
| 24 | **Turn structure: IGOUGO** | Classic tactical pacing |
| 25 | **Tank base movement: 3 ortho / 0 diag** | Treads-don't-turn-on-corners flavor |
| 26 | **Doctrines override unit stats, not just stack on top** | Same unit, different doctrine = different unit |
| 27 | **Blitzkrieg tank: 4 ortho / 0 diag, cumulative −1 def per still turn (resets on move)** | Forces aggressive play, mirrors trench mechanic in reverse |
| 28 | **Superior Firepower tank (if chosen as heavy): 2 ortho / 1 diag, no penalty** | Different doctrine = different tank identity |
| 29 | **Artillery base attack range: 6 squares** | Default for non-doctrine artillery |
| 30 | **Superior Firepower artillery: range 12, −0.5 str after square 8** | Range falloff is a new mechanical primitive |
| 31 | **Range falloff added as combat concept (§5.7)** | Generalizable for future doctrines/units |
| 32 | **Movement style = jump-based** | Destination-only; intermediate tiles don't block; simpler implementation |
| 33 | **Four terrain types: grasslands, swamp, forest, mountains** | Per-unit movement / defense / trench interactions defined for all five units |
| 34 | **Bad terrain = mountains only, all units** | The cavalry exemption is removed; rule applies uniformly |
| 35 | **Player-chosen units replaced by 20-point war-point system** | Free fixed army + point-buy layer; doctrine caps constrain spending |
| 36 | **"Heavy" class = tanks + motorized infantry; artillery is its own "special" class** | Required for clean point-buy categorization |
| 37 | **HQ placement = bottom-left and top-right corners (symmetric)** | Standard symmetric setup |
| 38 | **HQ reach = 3 squares; capture by 5-turn occupation OR 20 damage** | Two parallel win paths |
| 39 | **Each unit gets 2 actions/turn (move or attack, freely split)** | Resolves IGOUGO action budget |
| 40 | **Heavy unit progression tables defined (Tank/Motorized + Artillery)** | Same level system as Inf/Cav, no separate tech tree needed |
| 41 | **XP trigger: defeat a "stronger" unit, not "smaller"** | Rank, raw strength, or doctrine-modified all qualify |
| 42 | **Ranks named: Corporal / Captain / Colonel** | Flavor over numbered tiers |
| 43 | **Heavy units cannot form formations** | Formation is light-only |
| 44 | **Long-term trench: 4 turns held → 4 more turns of bonus; 6 turns → permanent (reduced to +1)** | Rewards prolonged static defense |
| 45 | **Counter-attack defined: defender D6 if attack-stamina remains; bonus D6 if attacker exhausted (6=+3 str, scaling 0.5/step)** | Resolves §5.9 counter-attack |
| 46 | **Diagonal does not count as an attack-direction tactic** | Resolves diagonal-double-attack question |
| 47 | **Blitzkrieg "bounce" rule: corporal tanks unable to move at 1 attack stamina can roll up to −3 attack** | Over-exhaustion penalty |
| 48 | **Plain doctrine defined: 14 starting units (up to 5 per class), tank 2 ortho/0 diag, no signature rule** | Third doctrine populated |
| 49 | **Per-doctrine war-point budgets: Plain 30, SF 35, Blitzkrieg 25** | Replaces the uniform 20-point budget |
| 50 | **Plain pre-game caps: up to 5 units per class, up to 2nd-level XP per class** | Plain economy filled in |
| 51 | **Doctrine "—" XP rows resolved as 0× (no upgrade allowed)** | Clears Blitzkrieg cav/artillery, SF heavy |
| 52 | **All pre-game tactical setup happens on a single shared menu** | UI direction noted |
| 53 | **Tank stats: HP 8, str 3, def 3, reach 4 ortho / 3 diag** | Heavy mech with asymmetric attack reach (the only unit with split ortho/diag reach) |
| 54 | **Motorized Infantry stats: HP 6, movement 3 ortho / 2 diag, reach 3, str 2, def 1** | Tank-support role |
| 55 | **Artillery stats: HP 2, movement 1 ortho / 1 diag, reach 6, str 3, def 0.5** | Glass cannon — highest base strength, lowest defense and HP |
| 56 | **Only 3 doctrines exist in base game (Plain, Blitzkrieg, Superior Firepower)** | Set is closed but expandable |
| 57 | **One doctrine per army; doctrines not stackable** | Single strategic identity per side |
| 58 | **Both players pick from same shared pool; identical-doctrine matchups allowed** | Doctrines are not faction-locked |
| 59 | **No doctrine-locked units — all units purchasable subject to point-buy caps** | Doctrines shape spending, not unit availability |
| 60 | **Trench escalation tiers: 3-turn vanish, 4-turn re-occupiable carry-over, 6-turn permanent at locked +1** | Replaces the simpler v0.16 "carry-for-4-more-turns" model |
| 61 | **Heavy-unit tactics applicability: Motorized = full light tactics; Tanks = via reach; Artillery = none** *(v0.18)* | Closes the largest remaining tactics gap |
| 62 | **Tank reach counts as adjacency for positional tactics; 2+ tanks reach-hugging triggers encirclement** *(v0.18)* | Tanks need a reach-aware tactics model since their 4-ortho reach extends past adjacency |
| 63 | **Minimum damage = 1, except Blitzkrieg Corporal-tank bounce rule** *(v0.18)* | Closes minimum-damage-floor question |
| 64 | **Tank/Motorized stamina bookkeeping: L1 −1 atk stamina this turn + no-move next turn; L2 no-attack next turn** *(v0.18)* | Resolves IGOUGO stamina interaction with progression |
| 65 | **Default facing: both sides face each other (overturns N/S/E/W = N default)** *(v0.18)* | Spawn intuitiveness |
| 66 | **Rotation is free, anytime in your turn (and pre-game); multiple rotations/turn allowed; formations rotate per-unit** *(v0.18)* | Closes the three facing-system open questions |
| 67 | **Front/Side/Rear mapping kept at 3/2/3** *(v0.18)* | Finer 1/2/2/2/1 split rejected |
| 68 | **Starting placement: board halved, free placement within your half; all doctrine starting armies repositionable pre-game** *(v0.18)* | Resolves placement-mechanic question |
| 69 | **Maps are handcrafted (board size, shape, and terrain layout authored per map)** *(v0.18)* | No procedural generation; maps are content |
| 70 | **Turn limit = 1000 turns (or external timer); tiebreak = highest remaining HQ HP** *(v0.18)* | Closes match-flow question |
| 71 | **No mid-game reinforcements; leftover war points forfeit** *(v0.18)* | Strict pre-game economy confirmed |
| 72 | **Plain confirmed vanilla — no signature rule beyond slow tank profile** *(v0.18)* | Plain-as-baseline finalized |
