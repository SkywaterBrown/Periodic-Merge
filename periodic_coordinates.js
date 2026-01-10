// periodic_coordinates.js

// This file contains the coordinates for elements in a proper periodic table layout
// Format: { number: [row, column] } where row and column are 0-indexed
// Empty cells are handled by checking if a coordinate has an element

const periodicCoordinates = {
    // Row 1 (Period 1)
    1: [0, 0],   // H
    2: [0, 17],  // He
    
    // Row 2 (Period 2)
    3: [1, 0],   // Li
    4: [1, 1],   // Be
    5: [1, 12],  // B
    6: [1, 13],  // C
    7: [1, 14],  // N
    8: [1, 15],  // O
    9: [1, 16],  // F
    10: [1, 17], // Ne
    
    // Row 3 (Period 3)
    11: [2, 0],  // Na
    12: [2, 1],  // Mg
    13: [2, 12], // Al
    14: [2, 13], // Si
    15: [2, 14], // P
    16: [2, 15], // S
    17: [2, 16], // Cl
    18: [2, 17], // Ar
    
    // Row 4 (Period 4)
    19: [3, 0],  // K
    20: [3, 1],  // Ca
    21: [3, 2],  // Sc
    22: [3, 3],  // Ti
    23: [3, 4],  // V
    24: [3, 5],  // Cr
    25: [3, 6],  // Mn
    26: [3, 7],  // Fe
    27: [3, 8],  // Co
    28: [3, 9],  // Ni
    29: [3, 10], // Cu
    30: [3, 11], // Zn
    31: [3, 12], // Ga
    32: [3, 13], // Ge
    33: [3, 14], // As
    34: [3, 15], // Se
    35: [3, 16], // Br
    36: [3, 17], // Kr
    
    // Row 5 (Period 5)
    37: [4, 0],  // Rb
    38: [4, 1],  // Sr
    39: [4, 2],  // Y
    40: [4, 3],  // Zr
    41: [4, 4],  // Nb
    42: [4, 5],  // Mo
    43: [4, 6],  // Tc
    44: [4, 7],  // Ru
    45: [4, 8],  // Rh
    46: [4, 9],  // Pd
    47: [4, 10], // Ag
    48: [4, 11], // Cd
    49: [4, 12], // In
    50: [4, 13], // Sn
    51: [4, 14], // Sb
    52: [4, 15], // Te
    53: [4, 16], // I
    54: [4, 17], // Xe
    
    // Row 6 (Period 6)
    55: [5, 0],  // Cs
    56: [5, 1],  // Ba
    // Lanthanides (separate row)
    57: [8, 2],  // La
    58: [8, 3],  // Ce
    59: [8, 4],  // Pr
    60: [8, 5],  // Nd
    61: [8, 6],  // Pm
    62: [8, 7],  // Sm
    63: [8, 8],  // Eu
    64: [8, 9],  // Gd
    65: [8, 10], // Tb
    66: [8, 11], // Dy
    67: [8, 12], // Ho
    68: [8, 13], // Er
    69: [8, 14], // Tm
    70: [8, 15], // Yb
    71: [8, 16], // Lu
    // Back to main table
    72: [5, 3],  // Hf
    73: [5, 4],  // Ta
    74: [5, 5],  // W
    75: [5, 6],  // Re
    76: [5, 7],  // Os
    77: [5, 8],  // Ir
    78: [5, 9],  // Pt
    79: [5, 10],  // Au
    80: [5, 11], // Hg
    81: [5, 12], // Tl
    82: [5, 13], // Pb
    83: [5, 14], // Bi
    84: [5, 15], // Po
    85: [5, 16], // At
    86: [5, 17], // Rn
    
    // Row 7 (Period 7)
    87: [6, 0],  // Fr
    88: [6, 1],  // Ra
    // Actinides (separate row)
    89: [9, 2],  // Ac
    90: [9, 3],  // Th
    91: [9, 4],  // Pa
    92: [9, 5],  // U
    93: [9, 6],  // Np
    94: [9, 7],  // Pu
    95: [9, 8],  // Am
    96: [9, 9],  // Cm
    97: [9, 10], // Bk
    98: [9, 11], // Cf
    99: [9, 12], // Es
    100: [9, 13], // Fm
    101: [9, 14], // Md
    102: [9, 15], // No
    103: [9, 16], // Lr
    // Back to main table (elements 104-118 would go here if we had them)
    104: [6, 3], // Rf
    105: [6, 4], // Db
    106: [6, 5], // Sg
    107: [6, 6], // Bh
    108: [6, 7], // Hs
    109: [6, 8], // Mt
    110: [6, 9], // Ds
    111: [6, 10], // Rg
    112: [6, 11], // Cn
    113: [6, 12], // Nh
    114: [6, 13], // Fl
    115: [6, 14], // Mc
    116: [6, 15], // Lv
    117: [6, 16], // Ts
    118: [6, 17]  // Og
};

// Function to get coordinates for an element
function getElementCoordinates(elementNumber) {
    return periodicCoordinates[elementNumber] || null;
}

// Function to get the grid dimensions needed
function getPeriodicTableGridSize() {
    let maxRow = 0;
    let maxCol = 0;
    
    for (const coords of Object.values(periodicCoordinates)) {
        if (coords[0] > maxRow) maxRow = coords[0];
        if (coords[1] > maxCol) maxCol = coords[1];
    }
    
    // Add 1 because rows/columns are 0-indexed
    return {
        rows: maxRow + 1,
        cols: maxCol + 1
    };
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        periodicCoordinates,
        getElementCoordinates,
        getPeriodicTableGridSize
    };
}
