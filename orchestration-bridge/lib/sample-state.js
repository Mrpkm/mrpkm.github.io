function createSampleGameState() {
  const rows = 12;
  const cols = 11;

  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = new Array(cols).fill(0);
  }
  grid[3][4] = 2; grid[3][5] = 2; grid[3][6] = 2;
  grid[4][3] = 2;
  grid[7][5] = 1; grid[7][6] = 1;
  grid[8][7] = 1;
  grid[5][1] = 3; grid[5][2] = 3;
  grid[6][8] = 3; grid[6][9] = 3;

  return {
    turnNumber: 1,
    activePlayer: 0,
    phase: 'action',
    board: {
      rows,
      cols,
      grid,
      terrainKey: { 0: 'grassland', 1: 'swamp', 2: 'forest', 3: 'mountain' }
    },
    players: [
      {
        playerIndex: 0,
        doctrine: 'Blitzkrieg',
        hqHp: 20,
        hqPosition: { row: 1, col: 1 },
        hqOccupyTimer: 0,
        units: [
          { id: 'p0_tank_1', type: 'Tanks', level: 0, row: 2, col: 3, facing: 'S', currentHp: 8, actionsRemaining: 2, stillTurns: 0, movedThisTurn: false },
          { id: 'p0_tank_2', type: 'Tanks', level: 0, row: 2, col: 5, facing: 'S', currentHp: 8, actionsRemaining: 2, stillTurns: 0, movedThisTurn: false },
          { id: 'p0_tank_3', type: 'Tanks', level: 0, row: 2, col: 7, facing: 'S', currentHp: 8, actionsRemaining: 2, stillTurns: 0, movedThisTurn: false },
          { id: 'p0_mot_1',  type: 'Motorized', level: 0, row: 3, col: 2, facing: 'S', currentHp: 6, actionsRemaining: 2, stillTurns: 0, movedThisTurn: false },
          { id: 'p0_mot_2',  type: 'Motorized', level: 0, row: 3, col: 8, facing: 'S', currentHp: 6, actionsRemaining: 2, stillTurns: 0, movedThisTurn: false },
          { id: 'p0_inf_1',  type: 'Infantry', level: 0, row: 1, col: 2, facing: 'S', currentHp: 4, actionsRemaining: 2, trenchTurns: 0, movedThisTurn: false },
          { id: 'p0_inf_2',  type: 'Infantry', level: 0, row: 1, col: 4, facing: 'S', currentHp: 4, actionsRemaining: 2, trenchTurns: 0, movedThisTurn: false }
        ]
      },
      {
        playerIndex: 1,
        doctrine: 'SuperiorFirepower',
        hqHp: 20,
        hqPosition: { row: 12, col: 11 },
        hqOccupyTimer: 0,
        units: [
          { id: 'p1_art_1', type: 'Artillery', level: 0, row: 11, col: 9, facing: 'N', currentHp: 2, actionsRemaining: 2, movedThisTurn: false },
          { id: 'p1_art_2', type: 'Artillery', level: 0, row: 11, col: 7, facing: 'N', currentHp: 2, actionsRemaining: 2, movedThisTurn: false },
          { id: 'p1_art_3', type: 'Artillery', level: 0, row: 12, col: 8, facing: 'N', currentHp: 2, actionsRemaining: 2, movedThisTurn: false },
          { id: 'p1_cav_1', type: 'Cavalry', level: 0, row: 10, col: 5, facing: 'N', currentHp: 3, actionsRemaining: 2, trenchTurns: 0, movedThisTurn: false },
          { id: 'p1_cav_2', type: 'Cavalry', level: 0, row: 10, col: 7, facing: 'N', currentHp: 3, actionsRemaining: 2, trenchTurns: 0, movedThisTurn: false },
          { id: 'p1_inf_1', type: 'Infantry', level: 1, row: 11, col: 10, facing: 'N', currentHp: 4, actionsRemaining: 2, trenchTurns: 3, movedThisTurn: false },
          { id: 'p1_inf_2', type: 'Infantry', level: 0, row: 12, col: 10, facing: 'N', currentHp: 4, actionsRemaining: 2, trenchTurns: 0, movedThisTurn: false }
        ]
      }
    ]
  };
}

module.exports = { createSampleGameState };
