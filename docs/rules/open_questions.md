# Open Questions

> **Status (v0.18):** The base ruleset is **functionally closed**.
> All remaining open items below are either resolved or live entirely
> in `ui_and_feedback.md` (UI layout, HUD surfaces, validation flow).
>
> **Note:** This file consolidates open questions from two sources:
> (a) explicitly flagged items inside `strategy_game_rules_v0.15.md` (especially §11 and §8.5), and
> (b) the prior companion file `strategy_game_open_questions_v0.1.md`, whose curated list is preserved below.
> Where the same question appears in both, it is listed once with both sources cited.

---

## A. Questions extracted directly from the rules document

### Tank full stat block ✅ RESOLVED (v0.17)
**Source:** units_and_entities.md → §2.1 Unit roster; rules §9 High priority #1
**Question:** What are the full stats for Tanks (HP, base strength, base defense, attack reach)?
**Resolution:** **HP 8 (1+7), base strength 3, base defense 3, attack reach 4 sq orthogonal / 3 sq diagonal**, base movement 3 ortho / 0 diag (overridable by doctrine). Tanks are the only unit with asymmetric attack reach. See units_and_entities.md → §2.1.

### Motorized Infantry full stat block ✅ RESOLVED (v0.17)
**Source:** units_and_entities.md → §2.1 Unit roster; rules §9 High priority #2
**Question:** What are all stats for Motorized Infantry (HP, movement, attack reach, strength, defense)?
**Resolution:** **HP 6 (1+5), movement 3 orthogonal / 2 diagonal, attack reach 3 squares (8-side), base strength 2, base defense 1.** Notes column describes the unit as "tank support." See units_and_entities.md → §2.1.

### Artillery full stat block ✅ RESOLVED (v0.17)
**Source:** units_and_entities.md → §2.1 Unit roster; rules §9 High priority #3
**Question:** What are the full stats for Artillery (HP, strength, defense, movement, can it diagonal-fire)?
**Resolution:** **HP 2 (1+1), base strength 3, base defense 0.5, movement 1 orthogonal / 1 diagonal**, attack reach 6 squares base (8-side, overridable by doctrine). Diagonal fire is allowed (the 6-sq reach is 8-side, not ortho-only). Artillery has the highest strength and lowest defense in the roster — extremely fragile glass cannon. See units_and_entities.md → §2.1.

### HQ capture mechanic ✅ RESOLVED (v0.16)
**Source:** game_core.md → §1.2 Win condition; rules §9 High priority #4
**Question:** How does HQ capture actually work (walk-onto-it, must-be-undefended, HQ-as-unit, single vs. multiple HQs)?
**Resolution:** **Two parallel win paths.** (1) **Occupation:** any unit that stays inside the HQ's 3-square reach for 5 turns captures it. (2) **Damage:** the HQ falls when it has been dealt 20 cumulative damage by any source. HQs are placed on the bottom-left and top-right corners (symmetric), each with a 3-square reach in every direction. See game_core.md → §1.2.

### Other doctrines ✅ RESOLVED (v0.17)
**Source:** units_and_entities.md → §8.5, §8.6; rules §9 High priority #5
**Question:** What other doctrines exist beyond Blitzkrieg and Superior Firepower?
**Resolution:** **Only three doctrines exist in the base game: Plain, Blitzkrieg, and Superior Firepower.** The set is closed for now; the v0.17 PDF explicitly notes the list "could be expanded" in future versions but no other doctrine is currently defined. See units_and_entities.md → §8.6.

### Doctrine selection method ⚠️ PARTIALLY RESOLVED (v0.16)
**Source:** units_and_entities.md → §8.5; rules §9 High priority #6
**Question:** How are doctrines selected — pre-game pick, in-game research, campaign-earned, or other?
**Resolution (partial):** **Pre-game pick** — doctrine is selected on the shared pre-game menu (the same menu used for war-point spending, placement, XP allocation, formation pairing, and entrenchment toggles). The PDF establishes pre-game pick as the answer. **Still open:** whether in-game research / campaign progression could ever change a doctrine mid-match, but for the base game pre-game pick is canonical.

### Player-chosen units mechanism ✅ RESOLVED (v0.15)
**Source:** units_and_entities.md → §8.3, §8.4, §8.5; rules §9 High priority #7
**Question:** How does the player fill the flex slots (Blitzkrieg's +5, SF's +2)? Point buy? List with restrictions?
**Resolution:** Replaced entirely by the **war-point system** (see economy.md). Each player gets 20 war points to spend pre-game on additional units (3 pts light / 5 pts heavy / 5 pts special), pre-game XP levels (2/4/5), and spawn-state bonuses (entrench 3 pts, formation 5 pts). The "+5" / "+2 heavy" flex slots are gone — doctrines now grant a free fixed army plus point-buy caps that constrain how the 20 points may be spent.

### "Heavy units" category for SF ✅ RESOLVED (v0.15)
**Source:** units_and_entities.md → §8.4, §8.5
**Question:** What units count as "heavy" for SF's flex slots? Tanks only? Tanks + heavy artillery? Other?
**Resolution:** **Tanks and Motorized Infantry** are the "heavy" class (see economy.md → §E.2). Artillery is its own "special" class. The flex-slot system is replaced by war-point caps; SF's heavy cap is up to 2 heavy units bought via the point-buy system.

### Doctrine combinations ✅ RESOLVED (v0.17)
**Source:** units_and_entities.md → §8.6
**Question:** One doctrine per army, or stackable?
**Resolution:** **One doctrine per army.** Doctrines are not stackable — each player picks exactly one of Plain / Blitzkrieg / Superior Firepower at pre-game setup, and that doctrine governs the entire army for the whole match. See units_and_entities.md → §8.6.

### Doctrine symmetry ✅ RESOLVED (v0.17)
**Source:** units_and_entities.md → §8.6
**Question:** Both players pick from the same pool, or are doctrines side/faction-locked?
**Resolution:** **Same shared pool — doctrines are not faction- or side-locked.** Both players choose freely from {Plain, Blitzkrieg, Superior Firepower}, and **identical-doctrine matchups are allowed** (e.g. Blitzkrieg vs. Blitzkrieg). See units_and_entities.md → §8.6.

### Doctrine-locked units ✅ RESOLVED (v0.17)
**Source:** companion v0.1 → High priority #11; units_and_entities.md → §8.6
**Question:** Could some units only exist under specific doctrines?
**Resolution:** **No unit is doctrine-locked.** All five unit types (Infantry, Cavalry, Tanks, Motorized Infantry, Artillery) are purchasable at pre-game setup by any doctrine, subject only to the per-doctrine point-buy caps in economy.md → §E.2. See units_and_entities.md → §8.6.

### Movement style ✅ RESOLVED (v0.15)
**Source:** units_and_entities.md → §2.4; rules §9 Medium priority #12
**Question:** Path-based (must trace through legal squares, blocked by terrain/units) or jump-based (target any reachable tile)?
**Resolution:** **Jump-based.** Units select any tile inside their footprint; intermediate tiles do not block. Destination must be empty (formation aside) and legal for the unit type given the destination terrain. See units_and_entities.md → §2.4.

### Counter-attack rules ✅ RESOLVED (v0.16)
**Source:** combat.md → §5.9; rules §9 Medium priority #8
**Question:** Does the defender automatically hit back after taking an attack? At what strength? Does range matter?
**Resolution:** **Yes — conditionally.** The defender automatically rolls a counter-attack D6 if it still has at least one attack-stamina remaining. If the attacker has fully exhausted its attacks that turn, the defender additionally gets a **bonus counter-attack D6** that scales 0.5 strength per pip (roll 1 → +0.5, roll 6 → +3.0). See combat.md → §5.9.

### Minimum damage floor ✅ RESOLVED (v0.18)
**Source:** combat.md → §5.9; rules §9 Medium priority #9
**Question:** Can a roll produce 0 or negative damage (a "bounce")? Is there a guaranteed minimum of 1?
**Resolution:** **Minimum damage = 1, with one exception.** All combat rolls resolve to a minimum of 1 damage. The single exception is the **Blitzkrieg Corporal-tank bounce rule** (combat.md → §5.9), where over-exhausting a Corporal-rank Blitzkrieg tank with 1 attack stamina remaining and no movement available may produce an attack of up to −3 (the "bounced" attack penalty). See combat.md → §5.9.

### Adjacency for double attack ✅ RESOLVED (v0.16)
**Source:** combat.md → §5.9; rules §9 Medium priority #11
**Question:** Does diagonal count as "adjacent" for the +1 strength double-attack bonus?
**Resolution:** **No.** Diagonal does not count as any sort of attack-direction tactic — only orthogonal positioning grants positional combat bonuses. This generalizes the existing encirclement-orthogonal-only rule (§5.5) to all positional bonuses. Double attack now requires two friendlies orthogonally adjacent to the target. See combat.md → §5.9.

### Bad terrain definition ✅ RESOLVED (v0.15)
**Source:** combat.md → §5.9; rules §9 Medium priority #10
**Question:** What terrain types count as "bad" for the −1 attack penalty? And why is cavalry exempt — design intent?
**Resolution:** **Mountains** are the only "bad terrain" — attacks launched from a mountain tile suffer −1 strength. The penalty applies to **all unit types** — the original cavalry exemption has been **removed**. The four terrain types are defined in units_and_entities.md → §2.5; the mapping is fixed in combat.md → §5.2.

### Trench reset rule ✅ RESOLVED (v0.17)
**Source:** combat.md → §5.6
**Question:** When a trenched unit moves, does the trench instantly disappear? Does the trench remain on the square for a later unit?
**Resolution:** **Three-tier escalation, fully specified.**
(1) **3 turns held → exit:** trench disappears immediately; no carry-over.
(2) **4 turns held → exit:** trench remains in place at full modifiers (Inf +2 / Cav +1.5). Other Inf/Cav units may move onto the square and use the standing trench. A new occupant who stays a full 4 turns and then leaves resets the "trench remains" state again. If the trench is left empty without a new occupant, it disappears.
(3) **6 turns held → permanent:** trench becomes permanent for the rest of the game, but both modifiers are **locked at +1 defence** (reduced from +2 / +1.5). Any Inf/Cav unit may freely use it; the reduced modifier cannot be restored to original values regardless of subsequent occupation.
See combat.md → §5.6.

### Actions per turn under IGOUGO ✅ RESOLVED (v0.16)
**Source:** game_core.md → §1.6; rules §9 Medium priority #14
**Question:** Does each unit get one action, or can the player command all their units freely each turn?
**Resolution:** **Each unit can move or attack 2 times per turn**, freely split between movement and attack. This also defines the "attack stamina" / "move stamina" referenced by heavy-unit progression and by the counter-attack mechanic. See game_core.md → §1.6.

### Rotation timing ✅ RESOLVED (v0.18)
**Source:** units_and_entities.md → §6.3
**Question:** Is rotation truly free anytime in your turn, or does it consume that unit's action (rotate OR move OR attack)?
**Resolution:** **Free, anytime in your turn — and pre-game.** Rotation does not consume an action. A unit may rotate at any point during the player's turn (and also at pre-game setup). See units_and_entities.md → §6.3.

### Multiple rotations per turn ✅ RESOLVED (v0.18)
**Source:** units_and_entities.md → §6.3
**Question:** Can a unit rotate, move, then rotate again in the same turn?
**Resolution:** **Yes.** Multiple rotations per turn are allowed — rotate → move → rotate again is a legal sequence. See units_and_entities.md → §6.3.

### Formation rotation ✅ RESOLVED (v0.18)
**Source:** units_and_entities.md → §6.3; rules §9 Medium priority #15
**Question:** Can stacked units rotate? Do both share one facing, or each has their own?
**Resolution:** **Each unit in a formation rotates independently.** Stacked units keep their own facings; turning one does not turn the other. This is the only directional decision available to a formation, since formations cannot move. See units_and_entities.md → §4.4, §6.3.

### Front/Side/Rear mapping refinement ✅ RESOLVED (v0.18)
**Source:** units_and_entities.md → §6.2; rules §9 Lower priority #21
**Question:** Confirm the 3/2/3 split (Front: N/NW/NE | Side: E/W | Rear: S/SW/SE), or use a finer 1/2/2/2/1 mapping (front, front-side, side, rear-side, rear)?
**Resolution:** **Keep the 3/2/3 split.** Front N/NW/NE, Side E/W, Rear S/SW/SE confirmed. The finer 1/2/2/2/1 mapping is not adopted. See units_and_entities.md → §6.2.

### Tanks/motorized/artillery in formations ✅ RESOLVED (v0.16)
**Source:** units_and_entities.md → §4.1; rules §9 Medium priority #13
**Question:** Can heavy units stack? Same restrictions as infantry/cavalry?
**Resolution:** **No.** Heavy units (Tanks, Motorized Infantry, Artillery) **cannot form formations** at all. Formation is a light-only mechanic (Infantry + Cavalry). See units_and_entities.md → §4.1.

### Board size and shape ✅ RESOLVED (v0.18)
**Source:** game_core.md → §1.4; rules §9 Lower priority #17
**Question:** Square grid confirmed, but how big? 8×8? 12×12? Larger?
**Resolution:** **Handcrafted maps** — board size and shape are designer-authored per map, not a fixed game-wide parameter. No single canonical board size; maps are content. See game_core.md → §1.4.

### Terrain layout ✅ RESOLVED (v0.18)
**Source:** game_core.md → §1.4; rules §9 Lower priority #17
**Question:** Handcrafted maps? Random generation? Fixed terrain types (forest, river, mountain, road, etc.)?
**Resolution:** **Handcrafted maps — terrain placement is part of the authored map.** No procedural generation. The four terrain types (grasslands, swamp, forest, mountains — units_and_entities.md → §2.5) are placed by the map designer. See game_core.md → §1.4.

### HQ placement on the board ✅ RESOLVED (v0.16)
**Source:** companion v0.1 → Lower priority #26
**Question:** Corners, edges, center?
**Resolution:** **Corners, symmetric** — the two HQs spawn on the bottom-left and top-right corners of the board. See game_core.md → §1.2.

### Starting placement mechanic ✅ RESOLVED (v0.18)
**Source:** units_and_entities.md → §8.1; rules §9 Lower priority #18
**Question:** How do doctrine armies get placed at game start? Player chooses positions? Predetermined zones?
**Resolution:** **Half-and-half free placement.** The board is divided into two equal halves at pre-game; each player freely places their starting army within their own half. **All doctrine starting armies (Plain, Blitzkrieg, Superior Firepower) are repositionable pre-game** — there are no fixed unit slots beyond the half-line constraint. See units_and_entities.md → §8.1.

### Rank naming ✅ RESOLVED (v0.16)
**Source:** units_and_entities.md → §3.4; rules §9 Lower priority #19
**Question:** Corporal/Captain/Colonel (named) or 1st/2nd/3rd (numbered)?
**Resolution:** **Named** — Corporal (1st level), Captain (2nd level), Colonel (3rd level). See units_and_entities.md → §3.4.

### "Smaller unit" definition for XP ✅ RESOLVED (v0.16)
**Source:** units_and_entities.md → §3.3; rules §9 Lower priority #20
**Question:** Fewer HP? Lower rank? Earlier in unit hierarchy?
**Resolution:** **The trigger is changed from "smaller" to "stronger."** A unit gains XP when it defeats an enemy that is stronger by **any** of three criteria: (1) higher rank, (2) higher total strength without drawbacks, or (3) currently benefiting from doctrine modifiers. See units_and_entities.md → §3.3.

### Game length / time pressure ✅ RESOLVED (v0.18)
**Source:** companion v0.1 → Lower priority #30
**Question:** Turn limit? Sudden-death rules if no HQ falls?
**Resolution:** **Turn limit = 1000 turns (or external real-time timer).** If neither HQ has fallen by the limit, the winner is the side whose HQ has more remaining HP. Equal HQ HP at the limit results in a draw. See game_core.md → §1.8, §1.2.

### Reinforcements ✅ RESOLVED (v0.18)
**Source:** companion v0.1 → Lower priority #31
**Question:** Can new units arrive mid-game, or is it strictly "what you start with"?
**Resolution:** **Strictly what you start with — no mid-game reinforcements.** The army you set up at pre-game is the army you finish the match with (minus losses). See economy.md → §E.5.

### Progression system for non-Infantry/Cavalry units ✅ RESOLVED (v0.16)
**Source:** units_and_entities.md → §3
**Question:** Motorized Infantry, Tanks, and Artillery use a "different (yet to be designed) system — likely tech-tree, doctrine-tied, or upgrade-based." Which one, and how does it work?
**Resolution:** **Same level-based system as Infantry/Cavalry** — no separate tech tree. Tank/Motorized share one progression table; Artillery has its own. Both grant level-1 / level-2 / level-3 bonuses earned the same way (defeat a stronger enemy, or pre-game XP purchase). The earlier "different system" speculation is dropped. See units_and_entities.md → §3.2a (Tank/Motorized) and §3.2b (Artillery).

### Tactics applicability to heavy units ✅ RESOLVED (v0.18)
**Source:** combat.md → §5 preamble, §7 preamble
**Question:** Which combat tactics (positional bonuses, encirclement, double attack, terrain modifiers, trench, formation) apply to Tanks, Motorized Infantry, and Artillery?
**Resolution:**
- **Motorized Infantry:** all tactics apply normally (treated as a light unit for tactics purposes).
- **Tanks:** all tactics apply, with **attack reach counted as adjacency** for positional purposes. Encirclement-via-reach for tanks triggers at **2 or more tanks "hugging" the target** (rather than the standard 4 orthogonal neighbors). Rear/side attack bonuses also resolve through reach.
- **Artillery:** **no tactics apply.** Artillery attacks ignore positional bonuses (encirclement, rear/side, double attack), cannot form formations, cannot dig trenches, and do not benefit from terrain attack-bonus modifiers.
See combat.md → §5.10.

### Tank stamina bookkeeping under IGOUGO ✅ RESOLVED (v0.18)
**Source:** units_and_entities.md → §3.2a; combat.md → §5.9
**Question:** When a Tank/Motorized unit uses its level-1 bonus square or level-2 bonus attack, on which turn does the drawback apply (this turn vs. next turn)?
**Resolution:**
- **Level-1 bonus square:** the **−1 attack stamina penalty applies this turn** (same turn the bonus square is used). The no-move part applies **next turn**.
- **Level-2 bonus attack:** the **no-attack penalty applies next turn**; movement is unaffected on either turn.
See units_and_entities.md → §3.2a.

### Plain doctrine — full definition ✅ RESOLVED (v0.16, confirmed v0.18)
**Source:** economy.md → §E.2 / §E.3; units_and_entities.md → §8.5
**Question:** Plain is referenced in the economy as a third doctrine option with "default" caps. What is its free starting army? Does it have any signature rules? What are the actual numerical defaults for its unit-buy and XP-upgrade caps?
**Resolution:** **Starting army:** 14 units total, player-chosen up to 5 per class across the five unit types. **Signature rule:** tank profile is 2 ortho / 0 diag (slower than base 3 ortho); **no other signature rules — Plain is intentionally vanilla and that "no signature rule" is a final design choice, not TBD (v0.18).** **Pre-game economy:** 30-point war-point budget; up to 5 units per class at point-buy; XP upgrades capped at 2nd level (Captain) per class. See units_and_entities.md → §8.5 and economy.md → §E.1, §E.2, §E.3.

### Pre-game setup UI ⚠️ STILL OPEN (UI-only)
**Source:** economy.md → §E.5; ui_and_feedback.md
**Question:** What does the pre-game setup interface look like? How does a player browse units, allocate the war points, assign XP levels, pair units into formations, mark units as entrenched, and place them on the half-board?
**Status:** **Single shared menu** confirmed (v0.16) — doctrine selection and *all* pre-game tactical adjustments (war-point spending, placement, XP allocation, formation pairing, entrenchment toggles) live on one combined pre-game menu. **Still open (UI work):** the actual interface layout, flow, validation rules, point-tracker display, and how the menu surfaces caps and remaining budget.

### Per-doctrine 20-point budget ✅ RESOLVED (v0.16)
**Source:** economy.md → §E.1
**Question:** Is the 20-point starting budget the same for all doctrines, or could specific doctrines start with more/fewer war points?
**Resolution:** **Per-doctrine budgets:** Plain 30 / Superior Firepower 35 / Blitzkrieg 25. The uniform 20-point default is gone. Blitzkrieg's lower budget reflects its already-stacked free starting army (10 heavy units); SF's higher budget compensates for its weaker free composition; Plain sits in the middle. See economy.md → §E.1.

### Unspecified XP-upgrade caps ✅ RESOLVED (v0.16)
**Source:** economy.md → §E.3
**Question:** The PDF specifies XP-upgrade caps for some unit classes per doctrine but not all (e.g. Blitzkrieg specifies infantry and heavy but not cavalry or artillery; SF specifies infantry/cavalry/artillery but not heavy). Are unspecified rows "0 allowed" or "unlimited up to budget"?
**Resolution:** **All previously-unspecified "—" rows are 0×** (no upgrades allowed). Specifically: Blitzkrieg cavalry → 0×, Blitzkrieg artillery → 0×, Superior Firepower heavy → 0×. See economy.md → §E.3.

### Mid-game reinforcements vs. pre-game-only economy ✅ RESOLVED (v0.18)
**Source:** economy.md → §E.5
**Question:** The economy is currently pre-game only. Could leftover war points (or new points earned through gameplay) fund mid-game reinforcements? Or is "what you start with" strictly final?
**Resolution:** **Strictly pre-game only.** No mid-game reinforcements; **leftover war points are forfeit** and cannot be spent during the match. Whatever is left over at game start simply remains unresolved until the end of the match. See economy.md → §E.5.

---

## B. Structural / categorization questions surfaced by the document split

### Economy file has no source content ✅ RESOLVED (v0.15)
**Source:** economy.md
**Resolution:** Retained — the pre-game point-buy economy now fully populates this file. See economy.md.

### UI/feedback file has no source content ⚠️ STILL OPEN (UI-only)
**Source:** ui_and_feedback.md (created empty per splitting brief)
**Question:** Should `ui_and_feedback.md` be retained as a placeholder for future UI design, or merged elsewhere until UI rules are written?
**Status:** Retained as the home for all UI/HUD design work, which is the only remaining open work in the project. The single-pre-game-menu direction is confirmed (v0.16); HUD surfaces for tracked state (facing, still-penalty counter, trench tier, XP, doctrine effects, HQ HP, capture timer, turn count) all need UI design.

---

*Living document — base ruleset closed as of v0.18. Only UI-layout
items remain. Cross-reference with the other five split files for
full rule context.*
