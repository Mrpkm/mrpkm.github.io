# UI and Feedback

> ⚠️ FLAG: The source document (Strategy Game Rules v0.15) does not define any UI, HUD, visual feedback, or audio feedback. The only player-facing presentation note in the source is the platform statement that "the computer holds all memory: turn counts, experience, hidden state, facing directions, doctrine effects, cumulative still-penalties, etc." — which describes state ownership, not how state is displayed. This file is created per the splitting brief but has no source content to populate it.

> 📎 Cross-reference: See game_core.md → §1.1 Platform for the full statement on computer-managed state.

> 📎 Cross-reference: Several rules implicitly require UI surfacing once designed — e.g. tracked facing direction (units_and_entities.md → §6), cumulative Blitzkrieg still-penalty counter (combat.md → §5.3), trench-active status (combat.md → §5.6), experience level (units_and_entities.md → §3), and active doctrine effects (units_and_entities.md → §8). None of these have defined display rules.

> 📎 Cross-reference: The **pre-game army setup** (war-point spending — see
> economy.md) is also a UI surface, partially resolved in v0.16. The economy
> rules define *what* a player can buy (units, XP levels, spawn-state bonuses)
> and the doctrine caps that constrain spending.

## Pre-game menu (partial resolution, v0.16)

- **Single shared menu.** Doctrine selection and *all* pre-game tactical
  adjustments happen on **one combined pre-game menu** — this includes:
  - Doctrine pick (Plain / Blitzkrieg / Superior Firepower)
  - War-point spending (additional units, XP, spawn bonuses)
  - Unit placement on the board
  - Formation pairing
  - Entrenchment toggles
  - XP allocation per unit
- **Still TBD:** the actual interface layout, flow, validation rules,
  point-tracker, and how the menu surfaces caps and remaining budget.
