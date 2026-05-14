# Combat

## 5. Combat

> **Tactics scope (resolved v0.18):**
> - **Infantry, Cavalry, Motorized Infantry** — all tactics in this
>   section apply normally.
> - **Tanks** — all tactics apply, with the special **reach-as-adjacency**
>   rule (see §5.10).
> - **Artillery** — **no positional tactics apply at all.** Artillery
>   ignores encirclement, rear/side bonuses, double attack, formation,
>   trench, and terrain attack-bonus modifiers (see §5.10).

### 5.1 Combat sequence

1. **Check the distance** — is the target within the attacker's reach?
2. **Determine attack direction** relative to defender's facing.
3. **Apply attacker bonuses** (see §5.2).
4. **Roll 1d6** — base wound.
5. **Apply defender bonuses** (see §5.3).
6. **Calculate damage:**
   ```
   damage = (1d6 roll + attacker base strength + strength bonuses)
          − (defender base defense + defense bonuses)
   ```
7. **Floor (resolved v0.18):** Final damage is clamped to a minimum of
   **1**. The only exception is the **Blitzkrieg Corporal-tank bounce
   rule** (§5.9), which can produce up to **−3** as an over-exhaustion
   penalty.

### 5.2 Attacker (strength) modifiers

| Situation | Modifier |
|---|---|
| Frontal attack | +0 |
| **Side attack** | **+0.5 strength** |
| **Rear attack** | **+1 strength** |
| Double attack (2 friendlies **orthogonally** adjacent to target) | +1 strength |
| **Encirclement — orthogonal attacker only** | **+3 strength** |
| **Attacking from mountains (bad terrain)** | **−1 strength** *(applies to all units)* |
| Terrain bonus (e.g. attacking from forest) | +1 strength |
| Range falloff (e.g. SF artillery beyond range 8) | varies (see §8) |
| Active doctrine effects | varies (see §8) |

> **Artillery exemption (v0.18):** None of the positional or terrain
> attack-bonus modifiers in this table apply to **artillery attacks**.
> Artillery rolls strength + dice with no positional tactics layer.
> Doctrine effects (range falloff, level-2 close-range bonus) still apply.
> See §5.10.

> **Tank reach as adjacency (v0.18):** For tanks, "orthogonal adjacency"
> in this table is interpreted as **"target is within the tank's 4-ortho
> attack reach in an orthogonal direction"** — the tank does not need to
> be a literal neighbor of the target. See §5.10.

> 📎 Cross-reference: See units_and_entities.md → §8 Doctrines for active doctrine effects.

> 📎 Cross-reference: See units_and_entities.md → §2.5 Terrain types for
> the four terrain types (grasslands, swamp, forest, mountains) and their
> per-unit defense modifiers. Under jump-based movement (§2.4),
> "attacking from bad terrain" is interpreted as **attacker stands on
> bad terrain at the moment of attack**. The only terrain type currently
> classified as "bad" for the −1 attack-strength penalty is
> **mountains**, and the penalty applies to **all unit types**
> (no cavalry exemption).

### 5.3 Defender (defense) modifiers

| Situation | Modifier |
|---|---|
| Frontal attack | +0 |
| **Side attack received** | **−0.5 defense** |
| **Rear attack received** | **−1 defense** |
| **Encirclement received — orthogonal attacker only** | **−2 defense** |
| Trench dug in (Infantry) | +2 defense |
| Trench dug in (Cavalry) | +1.5 defense |
| Terrain bonus (e.g. defending in forest) | +1 defense |
| Per experience level | (subsumed by §3 progression) |
| **Blitzkrieg still-penalty** (Blitzkrieg tanks only) | **−1 per still turn (cumulative)** |
| Active doctrine effects | varies (see §8) |

> 📎 Cross-reference: See units_and_entities.md → §3 Experience / Progression for level-based defense bonuses.

### 5.4 Net effect of positional attacks

| Direction | Strength | Defense | Net swing |
|---|---|---|---|
| Frontal | +0 | +0 | **+0** |
| Side | +0.5 | −0.5 | **+1** |
| Rear | +1 | −1 | **+2** |
| Encirclement (orthogonal only) | +3 | −2 | **+5** |
| Encirclement attacked diagonally | +0 | +0 | **+0** |

### 5.5 Encirclement — detailed rule

**Trigger (default):** A target unit is "encircled" when enemy units
occupy all 4 of its **orthogonal neighbors** (N, S, E, W).

**Bonus:** Only orthogonal attackers benefit. Diagonal attackers get
no encirclement modifier.

**Tank exception (v0.18):** When 2 or more **tanks** have the target
inside their orthogonal attack reach (i.e. their reach "hugs" the
target from orthogonal directions), encirclement triggers even
without the standard 4-neighbor occupation. This relaxed threshold
is tank-specific and reflects tanks' long firing lines. See §5.10.

### 5.6 Trench digging
- Triggers when a unit **does not move for 3 turns**.
- Infantry: **+2 defense** when attacked.
- Cavalry: **+1.5 defense** when attacked.
- Stays active as long as the unit doesn't move.
- **Trench reset rules — full escalation (resolved v0.17):**
  - **3 turns then exit:** the trench **disappears immediately** when the
    unit leaves the square. No carry-over.
  - **4 turns then exit:** the trench **remains in place** with the same
    modifiers (Inf +2 / Cav +1.5). Other Infantry or Cavalry units may
    move onto that square and use the standing trench. If a new occupant
    stays there for another full 4-turn cycle and then leaves, the
    "trench remains" state resets again. If at any point the trench is
    left empty without a new occupant, **it disappears**.
  - **6 turns held → permanent:** if the original unit holds the trench
    for **6 turns total without moving**, the trench becomes
    **permanent for the rest of the game**. Both modifiers are
    **reduced to +1 defence** (Infantry +1, Cavalry +1). Any Infantry
    or Cavalry unit may freely use a permanent trench, but **the
    reduced modifier is final** — re-occupying or holding it longer
    does **not** restore the original +2 / +1.5 values.
- **Special rule — no trench in swamp:** Infantry and Cavalry **cannot**
  dig in while standing on a swamp tile. The 3-turn timer does not
  produce a trench bonus on swamp. Forest and mountain tiles allow
  trenching normally; the trench bonus stacks additively with the
  terrain's defense bonus (see units_and_entities.md → §2.5.5).
- **Trench restricted to Infantry and Cavalry (v0.18 confirmation):**
  Heavy units (Tanks, Motorized Infantry, Artillery) cannot trench.
  Motorized Infantry's "all light tactics" applicability stops short of
  trenching — trench remains an Infantry/Cavalry-only mechanic.
- **Pre-game option:** A unit may be **spawned already entrenched** at army
  setup for 3 war points, bypassing the 3-turn timer. The pre-spawned
  trench follows the same rules as a normally-dug trench (removed on
  movement, blocked on swamp tiles). See economy.md → §E.4.

### 5.7 Range falloff (NEW concept)
- Some ranged units (notably Superior Firepower artillery) lose
  effectiveness with distance.
- Format: full strength up to range X, then a per-square (or threshold)
  penalty beyond that point.
- Currently used by: **Superior Firepower artillery** (full power 1–8,
  −0.5 strength after 8th square, max range 12).

### 5.8 Worked examples

**Frontal infantry vs. infantry, no terrain, no trench:**
```
attacker:  1d6 (avg 3.5) + 1 (base str)    = 4.5 avg
defender:  0 (base def)                     = 0
damage:    4.5 avg → kills 4 HP infantry in ~1 hit
```

**Frontal infantry vs. dug-in infantry (with trench + 1 forest):**
```
attacker:  1d6 + 1                          = 4.5 avg
defender:  0 + 2 (trench) + 1 (forest)      = 3
damage:    1.5 avg → ~3 hits to kill (floored to min 1)
```

**Blitzkrieg tank that has been still for 3 turns, getting attacked:**
```
defender:  base def + 0 (frontal) − 3 (cumulative still) = effectively 3 defense LESS than normal
```
The tank becomes wide open. Either move or die.

### 5.9 Combat-rule resolutions

#### Resolved in v0.16

- **Counter-attack rule (resolved v0.16):**
  - When a unit is attacked, the defender automatically rolls a **D6 for
    its counter-attack** — but **only if the defender still has at least
    one attack-stamina** remaining (i.e. they have not used both of their
    attack actions this turn — see game_core.md → §1.6).
  - **Special case — exhausted attacker:** If the attacker has **already
    used all of their attacks** this turn, the defender gets a **bonus
    counter-attack D6**. Each face of that bonus die contributes
    **+0.5 strength per pip**, scaling linearly:
    - 1 → +0.5 str
    - 2 → +1.0 str
    - 3 → +1.5 str
    - 4 → +2.0 str
    - 5 → +2.5 str
    - 6 → +3.0 str
  - This bonus stacks on top of the regular counter-attack D6.

- **Bounce rule — Blitzkrieg over-exhaustion (resolved v0.16):**
  - Specifically applies to **Blitzkrieg tanks at the Corporal rank** that
    are **unable to move** and are down to **1 attack stamina**.
  - Such tanks may roll **up to −3 attack** as a penalty for over-exhausting
    the unit. (The tank can hit itself in effect — a "bounced" attack.)
  - This is a new penalty primitive specific to Blitzkrieg's stop-and-die
    flavor, and is **the only sanctioned exception to the §5.1 minimum-1
    damage floor** (v0.18).

- **Diagonal positioning (resolved v0.16):**
  - **Diagonal does not count as any sort of attack-direction tactic.**
  - This resolves the "double attack adjacency" question: diagonal
    neighbors do **not** count toward the +1 strength double-attack bonus.
  - Encirclement was already orthogonal-only (§5.5); this rule generalizes
    that principle: only orthogonal positioning grants positional combat
    bonuses.

#### Resolved in v0.18

- **Minimum damage floor → 1 (with bounce-rule exception).** Final
  damage after attacker/defender modifiers is clamped to a minimum of
  1. The **only** sanctioned negative-damage outcome is the
  Blitzkrieg Corporal-tank bounce rule above.

### 5.10 Heavy-unit tactics applicability (v0.18)

This section consolidates which combat tactics apply to which
heavy-class units. It is the authoritative reference; tables in
§5.2, §5.3, §5.5, §5.6, and §7 should be read with this section
in mind.

| Tactic | Tanks | Motorized Infantry | Artillery |
|---|---|---|---|
| Side attack (+0.5 str / −0.5 def) | ✅ via reach | ✅ standard | ❌ no |
| Rear attack (+1 str / −1 def) | ✅ via reach | ✅ standard | ❌ no |
| Double attack (+1 str) | ✅ via reach | ✅ standard | ❌ no |
| Encirclement (+3 str / −2 def) | ✅ **2-tank reach-hug threshold** | ✅ standard 4-neighbor | ❌ no |
| Formation | ❌ no (light-only) | ❌ no (light-only) | ❌ no (light-only) |
| Trench | ❌ no | ❌ no | ❌ no |
| Terrain attack bonus (e.g. forest +1 str) | ✅ standard | ✅ standard | ❌ no |
| Terrain defense bonus (while standing on tile) | ✅ standard | ✅ standard | ✅ standard |
| Mountain attack penalty (−1 str) | n/a (cannot enter mountains) | n/a (cannot enter mountains) | n/a (cannot enter mountains) |

#### Per-unit notes

**Tanks — reach as adjacency.**
- A tank's **4-square orthogonal / 3-square diagonal attack reach**
  counts as adjacency for positional tactics. The tank does not need
  to be a literal neighbor of the target.
- **Direction (rear/side):** the angle from tank to defender determines
  the attack direction relative to the defender's facing, exactly as
  if the tank were adjacent.
- **Double attack:** if a friendly tank has the target inside its
  orthogonal reach **and** another friendly (light or heavy) is
  orthogonally adjacent to the target, the +1 strength double-attack
  bonus applies.
- **Encirclement (relaxed for tanks):** if **2 or more tanks** have the
  target inside their orthogonal reach from orthogonal directions
  (i.e. their reach "hugs" the target), encirclement triggers — the
  attacking tank gets the +3 str / −2 def encirclement swing. This
  replaces the standard 4-neighbor encirclement requirement when the
  contributing units are tanks.
- **Diagonal still does not count.** Diagonal-direction reach contributes
  nothing to positional tactics, consistent with the v0.16 rule.

**Motorized Infantry — light-equivalent.**
- Treated as a light unit for tactics purposes. All standard rules
  (orthogonal adjacency for double attack and encirclement, full
  rear/side direction bonuses, terrain attack bonuses) apply normally.
- Cannot trench and cannot form formations (these are restricted by
  unit type elsewhere — see §5.6 and units_and_entities.md → §4.1).

**Artillery — no tactics.**
- Artillery attacks are **flat**: no encirclement, no rear/side bonus,
  no double attack, no terrain attack bonus.
- Artillery cannot form formations and cannot trench.
- Doctrine effects (Superior Firepower range cap, level-2 close-range
  +2 strength) still apply — those are doctrine/progression layers,
  not "tactics."
- Artillery still receives **terrain defense bonuses** while standing
  on bonus tiles (forest +1.5, mountain n/a since artillery can't
  enter — see units_and_entities.md → §2.5).

> 📎 Cross-reference: See units_and_entities.md → §2.5 for terrain
> entry restrictions (artillery cannot enter forest or mountains;
> swamp neutralizes artillery movement).

---

## 7. Tactics quick reference

> **Applicability:**
> - Infantry, Cavalry, Motorized Infantry → all tactics apply normally.
> - Tanks → all tactics apply via reach-as-adjacency (§5.10).
> - Artillery → no tactics apply (§5.10).

| Tactic | Effect |
|---|---|
| Frontal attack | +0 strength |
| Side attack | +0.5 str / −0.5 def to target |
| Rear attack | +1 str / −1 def to target |
| Trench (Infantry) | +2 defense |
| Trench (Cavalry) | +1.5 defense |
| Double attack (orthogonal only) | +1 strength |
| Encirclement (orthogonal attacker) | +3 str / −2 def to target |
| Encirclement (diagonal attacker) | **no bonus** |
| Encirclement (2+ tanks reach-hug) | **+3 str / −2 def — tank-only relaxed threshold** |
| Formation | Combined defense, immune to double attack, immobile |
| Terrain bonus | +1 strength OR defense (artillery: defense only) |
| Bad-terrain attack (attacking from mountains) | −1 strength (all units) |
| Rotate unit | **Free** (no cost, anytime in turn — including pre-game) |
| Range falloff | Per-doctrine, see §8 |
| Minimum damage floor | **1** (Blitzkrieg Corporal-tank bounce can go negative — §5.9) |

> 📎 Cross-reference: See units_and_entities.md → §4 Formation for full formation rules and §8 Doctrines for doctrine-specific tactics.
