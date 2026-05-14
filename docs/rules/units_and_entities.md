# Units and Entities

## 2. Units

### 2.1 Unit roster

| Unit | HP (1 + bonus) | Movement | Attack reach | Base strength | Base defense | Notes |
|---|---|---|---|---|---|---|
| **Infantry** | 1 + 3 = **4** | 2 ortho / 1 diag | 1 sq (8-side) | **1** | **0** | Frontline striker |
| **Cavalry** | 1 + 2 = **3** | 2 in every direction | 2 sq (8-side) | **0.5** | **1** | Skirmisher with reach |
| **Tanks** | 1 + 7 = **8** | 3 ortho / 0 diag *(base — overridable by doctrine)* | **4 sq ortho / 3 sq diag** | **3** | **3** | Heavy mech, doctrine-dependent identity |
| **Motorized Infantry** | 1 + 5 = **6** | 3 ortho / 2 diag | 3 sq (8-side) | **2** | **1** | Tank support |
| **Artillery** | 1 + 1 = **2** | 1 ortho / 1 diag | **6 sq base** *(overridable by doctrine)* | **3** | **0.5** | Indirect-fire support; no positional tactics (combat.md → §5.10) |

> **HP formula:** `HP = 1 (base) + unit-type bonus`
>
> **Doctrine override:** A doctrine can change a unit's stats (movement,
> reach, etc.) entirely — see §8. This is not a "bonus" applied on top of
> base stats; it's a replacement.
>
> **Tank attack reach asymmetry (v0.17):** Tanks are the only unit whose
> attack reach differs between orthogonal and diagonal directions
> (4 ortho vs. 3 diag). All other units use a uniform 8-side reach.
>
> **Tank reach-as-adjacency (v0.18):** A tank's attack reach counts as
> "adjacency" for the purposes of positional tactics — see combat.md → §5.10.

### 2.2 Movement footprints (currently defined)

**Infantry (2 orthogonal, 1 diagonal):** 12 reachable tiles. Plus-shape with reach.

**Cavalry (2 in all 8 directions):** 24 reachable tiles. Square footprint.

**Tank (base, no doctrine):** 3 squares orthogonal, **0 diagonal**.
```
. . ▣ . .
. . ▣ . .
. . ▣ . .
▣ ▣ ● ▣ ▣
. . ▣ . .
. . ▣ . .
. . ▣ . .
```
12 reachable tiles. Tracks shape — long lines, no corners.

### 2.3 Attack reach footprints

**Infantry (1 in any direction):** 8 attackable tiles.

**Cavalry (up to 2 in any direction):** 24 attackable tiles. Cavalry can
strike at range — they don't need to be adjacent.

**Tank (base, no doctrine):** **4 squares orthogonal, 3 squares diagonal.**
Tanks have **asymmetric attack reach** — the only unit type that does.
This gives them strong long lines of fire on the cardinal directions while
diagonals are slightly shorter.

**Motorized Infantry:** **3 squares in any direction (8-side).**

**Artillery (base, no doctrine):** **6 squares in any direction (8-side).**
Doctrine modifiers (notably Superior Firepower's range extension and
falloff) override this base reach — see §8.

### 2.4 Movement style
- **Resolved (v0.15): Jump-based.**
- A unit moves by selecting any tile inside its movement footprint.
  Tiles between the unit's origin and destination are not traced.
  Friendlies and enemies on intermediate tiles do not block the move.
- The destination tile must be:
  1. Inside the unit's movement footprint
  2. Not occupied by another unit (formation stacking is the only exception — see §4)
  3. Legal for the unit type given the destination terrain (see §2.5)
- "Attacking through bad terrain" (combat.md → §5.2) is interpreted as
  "the **attacker stands on** bad terrain at the moment of attack,"
  since there is no traced path under jump-based movement.

### 2.5 Terrain types

There are **four terrain types**. Each tile on the board is one of them.
Terrain affects (a) which units can enter the tile, (b) movement-range
modifiers when entering, (c) defense modifiers while standing on it,
and (d) whether units can dig in (trench) on it.

#### 2.5.1 Grasslands (default)
- The default tile type. No modifiers of any kind.
- All units may enter freely.
- Trench-digging works normally for Infantry and Cavalry (combat.md → §5.6).

#### 2.5.2 Swamp
| Unit | Movement when entering swamp | Defense while in swamp | Trench? |
|---|---|---|---|
| Infantry | −1 to movement range | +1 | **No** |
| Cavalry | −1 to movement range | +1 | **No** |
| Artillery | −1 to movement range, **and may move in any of 8 directions but only 1 square** | +1 | No (no trench rule for artillery yet) |
| Tanks | No movement penalty | +0.5 | No (no trench rule for tanks yet) |
| Motorized Infantry | No movement penalty | +0.5 | No (no trench rule for motorized yet) |

- The artillery rule is a **special override**: in swamp, artillery's
  normal movement is replaced by "1 square in any of 8 directions."
  Combined with the −1 modifier, swamps effectively neutralize artillery
  movement — a deliberate flavor choice (the swamp will kill it).

#### 2.5.3 Forest
| Unit | Movement when entering forest | Defense while in forest | Trench? |
|---|---|---|---|
| Infantry | −1 to movement range | +1.5 | **Yes** |
| Cavalry | −1 to movement range | +1.5 | **Yes** |
| Tanks | −1 to movement range | +1.5 | No (no trench rule for tanks yet) |
| Motorized Infantry | −1 to movement range | +1.5 | No |
| Artillery | **Cannot enter forest.** Artillery may only move on grasslands. | n/a | n/a |

#### 2.5.4 Mountains
| Unit | May enter? | Defense while in mountains | Trench? |
|---|---|---|---|
| Infantry | Yes | +2 | **Yes** |
| Cavalry | Yes | +2 | **Yes** |
| Tanks | **No** | n/a | n/a |
| Motorized Infantry | **No** | n/a | n/a |
| Artillery | **No** | n/a | n/a |

- Only Infantry and Cavalry can climb mountains.

#### 2.5.5 Trench in non-grassland terrain
- When Infantry or Cavalry **dig in on forest or mountain**, the trench
  bonus stacks on top of the terrain's defense bonus exactly the same
  way it does on grasslands. The terrain modifiers behave normally —
  trench is purely additive.
- Example: Infantry trenched in forest = base def + 2 (trench) + 1.5 (forest).

> 📎 Cross-reference: See combat.md → §5.6 for the trench-digging trigger
> (no movement for 3 turns) and combat.md → §5.2 / §5.3 for how terrain
> defense bonuses combine with attack-direction modifiers.

---

## 3. Experience / Progression

> **Design rule:** Each unit type has its own progression table.
> All five units (Infantry, Cavalry, Tanks, Motorized Infantry, Artillery)
> use the same **level-based progression system** (1st / 2nd / 3rd level,
> gained by defeating stronger enemies — see §3.3). The earlier note
> about a "different (yet to be designed) system" for heavy units is
> superseded as of v0.16: **Tank/Motorized and Artillery progression
> tables are now defined below.**

### 3.1 Infantry progression

| Level | Bonus gained | Cumulative effect |
|---|---|---|
| **1st** | +1 strength, +1 defense | str 2, def 1 |
| **2nd** | +1 health, +1 defense | str 2, HP 5, def 2 |
| **3rd** | +1 strength, +1 defense | str 3, HP 5, def 3 |

### 3.2 Cavalry progression

| Level | Bonus gained | Cumulative effect |
|---|---|---|
| **1st** | +1 strength, +1 defense | str 1.5, def 2 |
| **2nd** | +1 defense, **+2 movement in every direction** | str 1.5, def 3, mvmt 4/4 |
| **3rd** | +1 strength, +1 defense | str 2.5, def 4, mvmt 4/4 |

### 3.2a Tank / Motorized Infantry progression

> Tanks and Motorized Infantry share this progression table.

| Level | Bonus gained | Drawback / interaction |
|---|---|---|
| **1st** | **+1 square orthogonal movement** | If the bonus square is used: **−1 attack stamina this turn** *(applies to the same turn the bonus square is used — v0.18)*, **and the unit cannot move next turn**. **Under Blitzkrieg**, using the bonus square also produces an extra **−1 defence** (interacts inversely with the still-penalty; see §8.3 and combat.md → §5.3). |
| **2nd** | **+1 attack stamina** | If the bonus attack is used, **the unit cannot attack next turn** *(penalty applies on the following turn — v0.18)*; movement is unaffected on either turn. |
| **3rd** | **Wait 1 turn → +2 defence** the following turn | **Under Blitzkrieg**, the still-penalty interacts: net **+1 defence** on the wait-turn, then immediately **−2 defence** on the turn after (the bonus expires while the still-penalty continues to compound). |

> **Stamina bookkeeping (resolved v0.18):**
> - Level-1 bonus square: the −1 attack stamina hits **this turn** (so a
>   tank that has already used 1 of its 2 attacks this turn and then uses
>   its bonus square has 0 attacks remaining for the rest of the turn);
>   the no-move penalty is **next turn**.
> - Level-2 bonus attack: the no-attack penalty is **next turn**.

### 3.2b Artillery progression

| Level | Bonus gained | Notes |
|---|---|---|
| **1st** | **+1 attack reach, no drawback** | Stacks cleanly with **Superior Firepower**: the SF falloff threshold shifts from 8 → 9, and max range shifts from 12 → 13. |
| **2nd** | **+2 strength** when the target is within **5 squares** | Close-range damage spike; does not apply at longer ranges. |
| **3rd** | **+1 orthogonal movement** | |

### 3.3 How experience is gained
- **Default rule (in-game):** A unit gains a level when it **defeats a
  stronger enemy unit**. *(Resolved v0.16 — was previously "smaller".)*
- A defeated enemy is considered **stronger** if **any** of the following holds:
  1. It has a **higher rank** than the attacker.
  2. Its **total strength without drawbacks** exceeds the attacker's.
  3. It is benefiting from **doctrine modifiers** at the time of combat.
- **Second path (pre-game):** A unit may also be **spawned at a higher level**
  by spending war points at army setup. See economy.md → §E.3.

### 3.4 Naming of ranks
- **Resolved (v0.16):** Ranks use named tiers — **Corporal / Captain / Colonel**
  (corresponding to 1st / 2nd / 3rd level).

---

## 4. Formation

### 4.1 Rules
- **Two units stack on the same square** to form a formation.
- **Restriction:** Infantry can only form with infantry or cavalry.
- **Heavy units cannot form formations** *(resolved v0.16)*. Tanks,
  Motorized Infantry, and Artillery are not allowed to stack into a
  formation with anything.
- **Pre-game option:** Two light units may be spawned **already in formation**
  at army setup for 5 war points. See economy.md → §E.4.

### 4.2 Advantages
- Immune to **double attack**.
- Combined defense — both units' defense values added together.

### 4.3 Disadvantages
- Cannot move while in formation.
- Cannot counter-attack together.

### 4.4 Formation rotation (resolved v0.18)
- **Each unit in a formation rotates independently.** Stacked units
  keep their own facings — turning one does not turn the other.
- This is the **only directional decision** available to a formation,
  since formations cannot move. A stacked Infantry/Cavalry pair can
  cover two different arcs by facing opposite directions, for example.
- Rotation cost is the same as for any unit: **free, anytime in your turn
  (and pre-game)** — see §6.3.

> 📎 Cross-reference: See combat.md → §5 Combat for double attack and counter-attack rules referenced here.

---

## 6. Facing system

### 6.1 Core rules
- **4 facings:** N / S / E / W only.
- **Default facing at spawn (resolved v0.18):** **Both sides face each
  other** — each player's units spawn facing the opposing half of the
  board. Replaces the v0.14 "all units spawn facing North" default.
  Since rotation is free, this only matters at spawn.
- **Free rotation:** No cost. Rotation is deliberate, not reactive.
- **No reactive turn:** Being attacked does NOT change facing.

### 6.2 Front / Side / Rear mapping (for a unit facing a given direction)

For a unit facing North:

```
   NW   N   NE
       ↓
   W ← ● → E
       ↑
   SW   S   SE
```

- **Front (3 tiles):** N, NW, NE
- **Side (2 tiles):** E, W
- **Rear (3 tiles):** S, SW, SE

The same 3/2/3 split applies for each of the four facings (rotated
appropriately). The 1/2/2/2/1 finer mapping was considered and
**not adopted (v0.18)**.

### 6.3 Rotation timing (resolved v0.18)

- **Rotation is free, anytime in your turn** — including before any
  movement, between actions, or after the unit has spent both
  actions. Rotation does **not** consume an action.
- **Multiple rotations per turn are allowed.** A unit may rotate →
  move → rotate again in the same turn. There is no per-turn cap on
  the number of rotations.
- **Pre-game rotation is also free.** Players may freely set initial
  facings for every unit at the pre-game menu (in addition to choosing
  positions within their half — see §8.1).
- **Formations rotate per-unit.** See §4.4.

> 📎 Cross-reference: See combat.md → §5.2/§5.3 for how facing direction modifies attack/defense.

---

## 8. Doctrines

### 8.1 What doctrines are
A doctrine is a **strategic-layer choice** that defines:

1. **Starting army composition** — fixed unit counts the doctrine grants for free
2. **Point-buy caps** — limits on how the player may spend war points (see economy.md → §E.2 / §E.3)
3. **Starting placement** — half-and-half free placement (see §8.1.1)
4. **Signature rule(s)** — special rules that override or add to the
   base rules, often changing how specific unit types behave

A doctrine is a **whole strategic identity**, not just a passive bonus.

### 8.1.1 Starting placement (resolved v0.18)
- The board is **divided into two equal halves** at pre-game — one half
  per player.
- Within their half, each player **freely places their starting army**
  (the free doctrine starting army plus any units bought via war points).
- **All starting units of every doctrine are repositionable pre-game**
  — there are no fixed unit slots within a doctrine. The doctrine
  determines *what* you have; the player decides *where*.
- Initial **facings** are also set freely at this stage — see §6.3.
- The half-and-half line is the only placement constraint; HQs sit in
  their assigned corners (game_core.md → §1.2) and are not moved.

### 8.2 Structural notes
- A doctrine can **override unit stats** (e.g. a Superior Firepower tank
  has different movement than a Blitzkrieg tank). The override replaces
  base stats — it does not stack.
- Doctrines can introduce **new mechanical primitives** (like artillery
  range falloff under SF) that didn't exist in base rules.
- Doctrines reflect real-world WWII military philosophies and are
  designed to feel historically authentic.

---

### 8.3 Blitzkrieg (Villámháború)

> *Real-world inspiration: rapid armored breakthrough, combined arms
> warfare, momentum offense. Stop moving and you're dead.*

#### Starting army (free, granted by doctrine)
| Unit | Count |
|---|---|
| Tanks | 6 |
| Motorized Infantry | 4 |
| Infantry | 4 |

> **Note (v0.16):** Blitzkrieg's pre-game war-point budget is **25 points**
> (per-doctrine budgets resolved v0.16; was a uniform 20 in v0.15). Players
> spend these on additional units, XP, and spawn bonuses on top of the free
> starting army above. Blitzkrieg's point-buy caps: **0 heavy units**, up to
> 4 infantry, up to 2 cavalry, up to 2 special (artillery). XP-upgrade caps:
> heavy units 1×, light infantry 2×, **cavalry 0×, artillery 0×** *(the
> previously-unspecified "—" rows are resolved as 0× — v0.16).*
> See economy.md → §E.1, §E.2, §E.3.

#### Signature rule: "Tanks must keep moving"
- **Blitzkrieg tank movement:** 4 squares orthogonal, **0 diagonal**
  (overrides base 3 orthogonal).
- **Still-penalty:** Each turn a Blitzkrieg tank does NOT move, it accrues
  **−1 cumulative defense**:
  - Turn 1 still: −1 defense
  - Turn 2 still: −2 defense
  - Turn 3 still: −3 defense
  - …and so on
- **Reset:** The penalty resets to 0 the moment the tank moves on its
  next turn.

#### Design intent
- Captures Blitzkrieg's historical truth: momentum is everything,
  stopping kills you.
- Creates a *thematic inversion* with infantry trenches: infantry get
  stronger by sitting still (+2 def trench), tanks get weaker.
- Forces the player into aggressive play — perfect for the doctrine.

---

### 8.4 Superior Firepower (Tűzfölény)

> *Real-world inspiration: long-range overwhelm, artillery dominance,
> "no problem can't be solved with more shells."*

#### Starting army (free, granted by doctrine)
| Unit | Count |
|---|---|
| Artillery | 6 |
| Cavalry | 4 |
| Infantry | 4 |

> **Note (v0.16):** Superior Firepower's pre-game war-point budget is
> **35 points** (per-doctrine budgets resolved v0.16; was a uniform 20 in v0.15).
> Players spend these on additional units, XP, and spawn bonuses on top of the
> free starting army above. Superior Firepower's point-buy caps: up to 2 heavy,
> up to 2 infantry, up to 2 cavalry, up to 2 special (artillery). XP-upgrade caps:
> infantry 3×, cavalry 3×, artillery 1×, **heavy 0×** *(the previously-unspecified
> "—" row is resolved as 0× — v0.16).*
> See economy.md → §E.1, §E.2, §E.3.

#### Signature rule 1: Extended artillery range with falloff
- **Base artillery range:** 6 squares.
- **Under Superior Firepower:** maximum range becomes **12 squares**.
- **Falloff:** Beyond the **8th square**, attacks suffer **−0.5 strength**
  (i.e. squares 9–12 are weaker shots).
- Up to and including range 8 = full power.

> 📎 Cross-reference: See combat.md → §5.7 Range falloff for the general mechanic.

#### Signature rule 2: Tank profile (if heavy unit chosen is tanks)
- **SF tanks:** **2 squares orthogonal, 1 square diagonal** movement
  (overrides base 3 ortho / 0 diag).
- **No still-penalty** — SF tanks may sit motionless without consequence.
- This makes SF tanks a slower but more flexible heavy unit, fitting a
  defensive/firepower army that doesn't need to charge.

#### Design intent
- Captures Superior Firepower's historical truth: range and volume of
  fire matter more than speed.
- The tank profile contrast vs. Blitzkrieg shows how doctrines reshape
  unit identity — same unit, totally different feel.

---

### 8.5 Plain (default / no specialization)

> *A no-specialization baseline doctrine. Used when neither Blitzkrieg nor
> Superior Firepower fits the player's intended strategy.*

#### Starting army (resolved v0.16)
- **14 total starting units**, matching the unit count of Blitzkrieg and
  Superior Firepower.
- The player **chooses the composition** at pre-game setup: **up to 5 units
  per class**, summing to 14.
- Available classes are the same five unit types: Infantry, Cavalry, Tanks,
  Motorized Infantry, Artillery.

#### Signature rule (resolved v0.16, vanilla confirmed v0.18)
- **Tank profile:** Plain tanks move **2 squares orthogonal, 0 diagonal**
  (overrides base 3 ortho / 0 diag).
- **No other signature rules.** Plain is intentionally vanilla — this is
  a final design choice, not a TBD. *(Confirmed v0.18.)*

#### Pre-game economy (resolved v0.16)
- **War-point budget:** **30 points** (between Blitzkrieg's 25 and SF's 35).
- **Point-buy cap:** **up to 5 units per class** at pre-game.
- **XP-upgrade cap:** **up to 2nd level per class** at pre-game.
- See economy.md → §E.1, §E.2, §E.3 for the full point-buy mechanics.

---

### 8.6 Doctrine open questions
1. ~~**How are doctrines selected?**~~ **Resolved (v0.16):** Doctrine is
   chosen on the **pre-game menu** — the same shared menu used for all
   pre-game tactical setup (war-point spending, unit placement, XP
   allocation, formation pairing, entrenchment toggles).
2. ~~**Symmetry**~~ **Resolved (v0.17):** **Both players pick from the
   same shared pool.** Doctrines are *not* tied to factions or sides,
   and **both players may select the same doctrine** — identical-doctrine
   matchups (e.g. Blitzkrieg vs. Blitzkrieg) are allowed.
3. ~~**Other doctrines beyond these three**~~ **Resolved (v0.17):**
   **Only Plain, Blitzkrieg, and Superior Firepower exist** in the base
   game. The set could be expanded in future versions but is closed for
   now.
4. ~~**Doctrine combinations**~~ **Resolved (v0.17):** **One doctrine per
   army.** Doctrines are not stackable.
5. ~~**Doctrine-locked units**~~ **Resolved (v0.17):** **No unit is
   doctrine-locked.** Every unit type is purchasable at pre-game by any
   doctrine (subject to the per-doctrine point-buy caps in
   economy.md → §E.2).

> 📎 Cross-reference: For the war-point system that replaced the v0.14
> "player-chosen units" budget (and which now defines what "heavy" means
> as a unit class), see economy.md.
