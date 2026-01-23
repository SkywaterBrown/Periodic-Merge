// game_logic.js

// Import periodic coordinates
let periodicCoordinates = {};
let getElementCoordinates = () => null;
let getPeriodicTableGridSize = () => ({ rows: 1, cols: 1 });

// Load periodic coordinates
async function loadPeriodicCoordinates() {
    try {
        const response = await fetch('periodic_coordinates.js');
        if (!response.ok) {
            throw new Error('Failed to load periodic coordinates');
        }
        
        const coordinatesScript = await response.text();
        
        // Extract the coordinates object from the script
        const coordinatesMatch = coordinatesScript.match(/const periodicCoordinates = ({[\s\S]*?});/);
        if (coordinatesMatch) {
            // Use Function constructor to safely evaluate the object
            const getCoords = new Function('return ' + coordinatesMatch[1]);
            periodicCoordinates = getCoords();
            
            // Also create helper functions
            getElementCoordinates = function(elementNumber) {
                return periodicCoordinates[elementNumber] || null;
            };
            
            getPeriodicTableGridSize = function() {
                let maxRow = 0;
                let maxCol = 0;
                
                for (const coords of Object.values(periodicCoordinates)) {
                    if (coords[0] > maxRow) maxRow = coords[0];
                    if (coords[1] > maxCol) maxCol = coords[1];
                }
                
                return {
                    rows: maxRow + 1,
                    cols: maxCol + 1
                };
            };
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading periodic coordinates:', error);
        return false;
    }
}

// Global variables that will be populated after loading data
let elements = [];
let elementMap = {};
let elementByNumber = {};

// Leaderboard state
// Leaderboard state
let leaderboards = {
    topFusions: [],
    elementsFound: [],
    highestEnergy: []
};

// AUTO-SAVE STATE
let autoSave = {
    enabled: true,
    interval: 30000, // Save every 30 seconds
    lastSaveTime: 0
};

// CLOUD SAVE STATE
let cloudSave = {
    enabled: false,
    apiEndpoint: '/.netlify/functions/cloud-save',
    apiKey: '',
    lastSyncTime: 0,
    syncInterval: 300000, // Sync every 5 minutes
    conflictResolution: 'local' // 'local', 'remote', or 'newest'
};

// Player name (for leaderboard)
let playerName = localStorage.getItem('elementFusionPlayerName') || 'Anonymous';

// Game state
let gameState = {
    elementsFound: 10,
    mergeCount: 0,
    discoveredElements: new Set(['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne']),
    mergeElements: [],
    draggingElement: null,
    dragOffset: { x: 0, y: 0 },
    fusionEnergy: 100,
    isMerging: false,
    // Nuclear Reactor state
    reactorLevel: 1,
    reactorEnergyStored: 0,
    reactorMaxStorage: 50,
    reactorProductionRate: 1, // energy per second
    reactorUpgradeCost: 50,
    lastUpdateTime: Date.now()
};

const LEADERBOARD_API = {
    baseUrl: '',
    endpoints: {
        submit: '.netlify/functions/submit-score',
        get: '.netlify/functions/get-leaderboard',
        stats: '.netlify/functions/get-player-stats'
    },
    categories: {
        totalScore: 'Total Score',
        elementsFound: 'Elements Discovered',
        topFusions: 'Fusion Reactions',
        highestEnergy: 'Energy Achieved',
        reactorLevel: 'Reactor Level'
    }
};

// Device ID for tracking
const deviceId = localStorage.getItem('elementFusionDeviceId') || 
                 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('elementFusionDeviceId', deviceId);

// Country detection (fallback to IP detection via API)
let playerCountry = localStorage.getItem('elementFusionCountry') || '??';

// Load element data from external file
async function loadElementData() {
    try {
        console.log("Loading element data...");
        
        // Try to load from elements.data file
        const response = await fetch('elements.data');
        
        if (!response.ok) {
            throw new Error(`Failed to load elements.data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error('Element data is not an array');
        }
        
        if (data.length === 0) {
            throw new Error('Element data array is empty');
        }
        
        console.log(`Loaded ${data.length} elements from elements.data`);
        
        // Process the loaded data
        elements = data;
        
        // Create element maps for quick lookup
        elementMap = {};
        elementByNumber = {};
        
        elements.forEach(element => {
            elementMap[element.symbol] = element;
            elementByNumber[element.number] = element;
			if (!element.facts) element.facts = getDefaultFacts(element);
            if (!element.uses) element.uses = getDefaultUses(element);
            if (!element.discovery) element.discovery = getDefaultDiscoveryInfo(element);
            if (!element.description) element.description = getDefaultDescription(element);
		});
        
        // Check if we have the starting elements
        const startingElements = ['H', 'He', 'Li', 'Be', 'B'];
        const missingElements = startingElements.filter(symbol => !elementMap[symbol]);
        
        if (missingElements.length > 0) {
            console.warn(`Missing starting elements: ${missingElements.join(', ')}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('Error loading element data:', error);
        
        // Fallback to default data if file fails to load
        console.log('Using fallback element data');
        elements = [
            { number: 1, symbol: 'H', name: 'Hydrogen', category: 'nonmetal', mass: 1.008, color: '#FF6B6B' },
            { number: 2, symbol: 'He', name: 'Helium', category: 'noble', mass: 4.0026, color: '#FFD166' },
            { number: 3, symbol: 'Li', name: 'Lithium', category: 'alkali', mass: 6.94, color: '#06D6A0' },
            { number: 4, symbol: 'Be', name: 'Beryllium', category: 'alkaline', mass: 9.0122, color: '#118AB2' },
            { number: 5, symbol: 'B', name: 'Boron', category: 'metalloid', mass: 10.81, color: '#EF476F' },
            { number: 6, symbol: 'C', name: 'Carbon', category: 'nonmetal', mass: 12.011, color: '#073B4C' },
            { number: 7, symbol: 'N', name: 'Nitrogen', category: 'nonmetal', mass: 14.007, color: '#118AB2' },
            { number: 8, symbol: 'O', name: 'Oxygen', category: 'nonmetal', mass: 15.999, color: '#06D6A0' },
            { number: 9, symbol: 'F', name: 'Fluorine', category: 'halogen', mass: 18.998, color: '#FFD166' },
            { number: 10, symbol: 'Ne', name: 'Neon', category: 'noble', mass: 20.180, color: '#FF6B6B' },
            { number: 11, symbol: 'Na', name: 'Sodium', category: 'alkali', mass: 22.990, color: '#06D6A0' },
            { number: 12, symbol: 'Mg', name: 'Magnesium', category: 'alkaline', mass: 24.305, color: '#118AB2' },
            { number: 13, symbol: 'Al', name: 'Aluminum', category: 'metal', mass: 26.982, color: '#EF476F' },
            { number: 14, symbol: 'Si', name: 'Silicon', category: 'metalloid', mass: 28.085, color: '#073B4C' },
            { number: 15, symbol: 'P', name: 'Phosphorus', category: 'nonmetal', mass: 30.974, color: '#118AB2' },
            { number: 16, symbol: 'S', name: 'Sulfur', category: 'nonmetal', mass: 32.06, color: '#06D6A0' },
            { number: 17, symbol: 'Cl', name: 'Chlorine', category: 'halogen', mass: 35.45, color: '#FFD166' },
            { number: 18, symbol: 'Ar', name: 'Argon', category: 'noble', mass: 39.948, color: '#FF6B6B' },
            { number: 19, symbol: 'K', name: 'Potassium', category: 'alkali', mass: 39.098, color: '#06D6A0' },
            { number: 20, symbol: 'Ca', name: 'Calcium', category: 'alkaline', mass: 40.078, color: '#118AB2' }
        ];
        
        // Recreate maps with fallback data
        elementMap = {};
        elementByNumber = {};
        elements.forEach(element => {
            elementMap[element.symbol] = element;
            elementByNumber[element.number] = element;
        });
        
        return true;
    }
}
function getDefaultFacts(element) {
    const defaultFacts = {
        'H': ['Hydrogen is the most abundant element in the universe'],
        'He': ['Helium was discovered on the Sun before it was found on Earth'],
        'C': ['Carbon is the basis of all known life'],
        'O': ['Oxygen makes up about 21% of Earth\'s atmosphere'],
        'Au': ['Gold is so malleable that one ounce can be stretched into a wire 50 miles long'],
        'Fe': ['Iron is the most abundant element on Earth by mass']
    };
    
    return defaultFacts[element.symbol] || [
        `This element has atomic number ${element.number}`,
        `It belongs to the ${element.category} category`
    ];
}

function getDefaultUses(element) {
    const defaultUses = {
        'H': ['Rocket fuel', 'Hydrogen fuel cells'],
        'He': ['Party balloons', 'Cooling MRI machines'],
        'C': ['Pencil lead (graphite)', 'Diamond jewelry'],
        'O': ['Medical oxygen', 'Steel production'],
        'Au': ['Jewelry', 'Electronics'],
        'Fe': ['Steel production', 'Construction materials']
    };
    
    return defaultUses[element.symbol] || [
        'Scientific research',
        'Industrial applications'
    ];
}

function getDefaultDiscoveryInfo(element) {
    const defaultDiscovery = {
        'H': 'Discovered by Henry Cavendish in 1766',
        'He': 'Discovered independently by Pierre Janssen and Norman Lockyer in 1868',
        'O': 'Discovered independently by Carl Wilhelm Scheele and Joseph Priestley in the 1770s',
        'Au': 'Known since ancient times',
        'Fe': 'Known since ancient times, first smelted around 2000 BCE',
        'U': 'Discovered by Martin Heinrich Klaproth in 1789'
    };
    
    return defaultDiscovery[element.symbol] || 'Discovered through scientific research';
}

function getDefaultDescription(element) {
    return `${element.name} is element number ${element.number} in the periodic table.`;
}
// Check if elements can be merged
function canMerge(symbol1, symbol2) {
    // For now, only allow merging identical elements
    return symbol1 === symbol2;
}

// Get result of merging two elements
function getMergeResult(symbol1, symbol2) {
    if (!canMerge(symbol1, symbol2)) {
        return null;
    }
    
    const currentElement = elementMap[symbol1];
    if (!currentElement) {
        return null;
    }
    
    // For identical elements, get next element in sequence
    const nextNumber = currentElement.number + 1;
    const nextElement = elementByNumber[nextNumber];
    
    // Check if merge requires energy
    const energyCost = Math.floor(currentElement.mass * 5);
    if (gameState.fusionEnergy < energyCost) {
        return { success: false, message: `Not enough fusion energy! Need ${energyCost}` };
    }
    
    return nextElement ? { 
        success: true, 
        element: nextElement,
        energyCost: energyCost
    } : null;
}

// Update reactor energy production
function updateReactorEnergy() {
    const now = Date.now();
    const elapsedSeconds = (now - gameState.lastUpdateTime) / 1000;
    
    // Calculate energy produced
    const energyProduced = elapsedSeconds * gameState.reactorProductionRate;
    gameState.reactorEnergyStored = Math.min(
        gameState.reactorMaxStorage,
        gameState.reactorEnergyStored + energyProduced
    );
    
    gameState.lastUpdateTime = now;
    
    // Update reactor display
    updateReactorDisplay();
}

// Update reactor display
function updateReactorDisplay() {
    const reactorBar = document.getElementById('reactorBar');
    const storedEnergyEl = document.getElementById('storedEnergy');
    const reactorLevelEl = document.getElementById('reactorLevel');
    const productionRateEl = document.getElementById('productionRate');
    const upgradeCostEl = document.getElementById('upgradeCost');
    const harvestBtn = document.getElementById('harvestBtn');
    const upgradeBtn = document.getElementById('upgradeReactorBtn');
    
    if (reactorBar && storedEnergyEl) {
        const percentage = (gameState.reactorEnergyStored / gameState.reactorMaxStorage) * 100;
        reactorBar.style.width = `${percentage}%`;
        
        storedEnergyEl.textContent = Math.floor(gameState.reactorEnergyStored);
        reactorLevelEl.textContent = `Level ${gameState.reactorLevel}`;
        productionRateEl.textContent = `${gameState.reactorProductionRate}/sec`;
        upgradeCostEl.textContent = `${gameState.reactorUpgradeCost} energy`;
        
        // Update harvest button
        if (harvestBtn) {
            if (gameState.reactorEnergyStored >= 10) {
                harvestBtn.classList.add('harvest-available');
                harvestBtn.disabled = false;
                harvestBtn.textContent = `Harvest ${Math.floor(gameState.reactorEnergyStored)} Energy`;
            } else {
                harvestBtn.classList.remove('harvest-available');
                harvestBtn.disabled = true;
                harvestBtn.textContent = 'Harvest Energy (Min: 10)';
            }
        }
        
        // Update upgrade button
        if (upgradeBtn) {
            upgradeBtn.disabled = gameState.fusionEnergy < gameState.reactorUpgradeCost;
            upgradeBtn.textContent = `Upgrade (Cost: ${gameState.reactorUpgradeCost})`;
        }
    }
}

// Harvest reactor energy
function harvestReactorEnergy() {
    if (gameState.reactorEnergyStored >= 10) {
        const harvested = Math.floor(gameState.reactorEnergyStored);
        gameState.fusionEnergy += harvested;
        gameState.reactorEnergyStored = 0;
        
        updateGameStats();
        updateReactorDisplay();
        updateMergeResult(`Harvested ${harvested} fusion energy from reactor!`, true);
    }
}

// Upgrade reactor
function upgradeReactor() {
    if (gameState.fusionEnergy >= gameState.reactorUpgradeCost) {
        gameState.fusionEnergy -= gameState.reactorUpgradeCost;
        gameState.reactorLevel++;
        gameState.reactorProductionRate = Math.floor(gameState.reactorLevel * 1.5);
        gameState.reactorMaxStorage = gameState.reactorLevel * 50;
        
        // Increase upgrade cost for next level
        gameState.reactorUpgradeCost = Math.floor(gameState.reactorUpgradeCost * 1.5);
        
        updateGameStats();
        updateReactorDisplay();
        updateMergeResult(`Reactor upgraded to Level ${gameState.reactorLevel}! Production: ${gameState.reactorProductionRate}/sec`, true);
    }
}

// Initialize the game after loading data
async function initGame() {
    // Show loading screen
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
    
    // Load element data and periodic coordinates
    await Promise.all([
        loadElementData(),
        loadPeriodicCoordinates()
    ]);
    
    // Initialize game
    createPeriodicTable();
	createCategoryLegend();
    setupEventListeners();
    setupReactorEventListeners();
	initializeLeaderboards();
	initializeEducationalContent();
	initializeAutoSave();
    setupCloudSaveControls();
	checkMobileOrientation();
    updateGameStats();
    updateProgressBar();
    updateReactorDisplay();
    
    // Start reactor update interval
    setInterval(updateReactorEnergy, 1000);
    
    // Hide loading screen and show main content
    setTimeout(() => {
        document.getElementById('loadingOverlay').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'flex';
		setTimeout(showOrientationWarning, 500);
        updateMergeResult(`Loaded ${elements.length} elements. Drag discovered elements to start!`);
    }, 500);
}
// Auto-save Functions
function initializeAutoSave() {
    // Load saved game if it exists
    loadGameFromLocalStorage();
    
    // Set up auto-save interval
    setInterval(() => {
        if (autoSave.enabled) {
            saveGameToLocalStorage();
        }
    }, autoSave.interval);
    
    // Also save before page unload
    window.addEventListener('beforeunload', () => {
        if (autoSave.enabled) {
            saveGameToLocalStorage();
        }
    });
    
    // Save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveGameToLocalStorage();
            updateMergeResult('Game saved successfully!', true);
        });
    }
    
    // Load button
    const loadBtn = document.getElementById('loadBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            if (loadGameFromLocalStorage()) {
                updateMergeResult('Game loaded successfully!', true);
            }
        });
    }
}

function saveGameToLocalStorage() {
    try {
        const saveData = {
            version: '1.0',
            timestamp: Date.now(),
            playerName: playerName,
            gameState: {
                elementsFound: gameState.elementsFound,
                mergeCount: gameState.mergeCount,
                discoveredElements: Array.from(gameState.discoveredElements),
                fusionEnergy: gameState.fusionEnergy,
                // Reactor state
                reactorLevel: gameState.reactorLevel,
                reactorEnergyStored: gameState.reactorEnergyStored,
                reactorMaxStorage: gameState.reactorMaxStorage,
                reactorProductionRate: gameState.reactorProductionRate,
                reactorUpgradeCost: gameState.reactorUpgradeCost,
                lastUpdateTime: gameState.lastUpdateTime
            },
            mergeElements: gameState.mergeElements,
            // Save the current merge area elements
            mergeAreaElements: Array.from(document.querySelectorAll('.merge-element')).map(el => ({
                symbol: el.dataset.symbol,
                x: parseFloat(el.style.left),
                y: parseFloat(el.style.top)
            }))
        };
        
        localStorage.setItem('elementFusionSaveData', JSON.stringify(saveData));
        localStorage.setItem('elementFusionSaveTime', Date.now().toString());
        
        autoSave.lastSaveTime = Date.now();
        updateSaveIndicator('saved');
        
        console.log('Game saved to localStorage');
        return true;
    } catch (error) {
        console.error('Error saving game:', error);
        updateSaveIndicator('error');
        return false;
    }
}

function loadGameFromLocalStorage() {
    try {
        const saveDataStr = localStorage.getItem('elementFusionSaveData');
        if (!saveDataStr) {
            console.log('No saved game found');
            return false;
        }
        
        const saveData = JSON.parse(saveDataStr);
        
        // Basic validation
        if (!saveData.version || !saveData.gameState) {
            console.error('Invalid save data format');
            return false;
        }
        
        // Load player name
        if (saveData.playerName) {
            playerName = saveData.playerName;
        }
        
        // Load game state
        if (saveData.gameState) {
            gameState.elementsFound = saveData.gameState.elementsFound || 10;
            gameState.mergeCount = saveData.gameState.mergeCount || 0;
            gameState.discoveredElements = new Set(saveData.gameState.discoveredElements || ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne']);
            gameState.fusionEnergy = saveData.gameState.fusionEnergy || 100;
            
            // Reactor state
            gameState.reactorLevel = saveData.gameState.reactorLevel || 1;
            gameState.reactorEnergyStored = saveData.gameState.reactorEnergyStored || 0;
            gameState.reactorMaxStorage = saveData.gameState.reactorMaxStorage || 50;
            gameState.reactorProductionRate = saveData.gameState.reactorProductionRate || 1;
            gameState.reactorUpgradeCost = saveData.gameState.reactorUpgradeCost || 50;
            gameState.lastUpdateTime = saveData.gameState.lastUpdateTime || Date.now();
        }
        
        // Update UI
        updateGameStats();
        updateProgressBar();
        updateReactorDisplay();
        createPeriodicTable();
        
        // Clear and restore merge area
        const mergeArea = document.getElementById('mergeArea');
        if (mergeArea && saveData.mergeAreaElements) {
            mergeArea.innerHTML = '';
            gameState.mergeElements = [];
            
            saveData.mergeAreaElements.forEach(el => {
                if (el.symbol) {
                    addElementToMergeArea(el.symbol, el.x, el.y);
                }
            });
        }
        
        // Update leaderboards from localStorage
        const savedLeaderboards = localStorage.getItem('elementFusionLeaderboards');
        if (savedLeaderboards) {
            leaderboards = JSON.parse(savedLeaderboards);
        }
        
        updateSaveIndicator('loaded');
        console.log('Game loaded from localStorage');
        return true;
        
    } catch (error) {
        console.error('Error loading game:', error);
        updateSaveIndicator('error');
        return false;
    }
}

function updateSaveIndicator(status) {
    const saveIndicator = document.getElementById('saveIndicator');
    if (!saveIndicator) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    switch(status) {
        case 'saved':
            saveIndicator.innerHTML = `💾 Saved at ${timeStr}`;
            saveIndicator.style.color = '#81c784';
            break;
        case 'loaded':
            saveIndicator.innerHTML = `🔄 Loaded at ${timeStr}`;
            saveIndicator.style.color = '#4fc3f7';
            break;
        case 'error':
            saveIndicator.innerHTML = '❌ Save Error';
            saveIndicator.style.color = '#ef5350';
            break;
        case 'syncing':
            saveIndicator.innerHTML = '☁️ Syncing...';
            saveIndicator.style.color = '#ff9800';
            break;
        case 'synced':
            saveIndicator.innerHTML = `☁️ Synced at ${timeStr}`;
            saveIndicator.style.color = '#9c27b0';
            break;
    }
    
    // Fade out after 3 seconds
    setTimeout(() => {
        if (saveIndicator.innerHTML.includes('at')) {
            saveIndicator.style.opacity = '0.7';
        }
    }, 3000);
}

// Cloud Save Functions
async function syncToCloud() {
    if (!cloudSave.enabled || !cloudSave.apiKey) {
        return false;
    }
    
    try {
        updateSaveIndicator('syncing');
        
        const saveData = {
            version: '1.0',
            timestamp: Date.now(),
            playerName: playerName,
            gameState: {
                elementsFound: gameState.elementsFound,
                mergeCount: gameState.mergeCount,
                discoveredElements: Array.from(gameState.discoveredElements),
                fusionEnergy: gameState.fusionEnergy,
                reactorLevel: gameState.reactorLevel,
                reactorEnergyStored: gameState.reactorEnergyStored,
                reactorProductionRate: gameState.reactorProductionRate
            },
            deviceId: localStorage.getItem('elementFusionDeviceId') || generateDeviceId()
        };
        
        // Generate device ID if not exists
        if (!localStorage.getItem('elementFusionDeviceId')) {
            localStorage.setItem('elementFusionDeviceId', saveData.deviceId);
        }
        
        const response = await fetch(cloudSave.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cloudSave.apiKey}`
            },
            body: JSON.stringify(saveData)
        });
        
        if (response.ok) {
            cloudSave.lastSyncTime = Date.now();
            updateSaveIndicator('synced');
            return true;
        } else {
            throw new Error('Cloud save failed');
        }
    } catch (error) {
        console.error('Cloud sync error:', error);
        updateSaveIndicator('error');
        return false;
    }
}

async function loadFromCloud() {
    if (!cloudSave.enabled || !cloudSave.apiKey) {
        return false;
    }
    
    try {
        updateSaveIndicator('syncing');
        
        const deviceId = localStorage.getItem('elementFusionDeviceId');
        if (!deviceId) {
            console.log('No device ID found');
            return false;
        }
        
        const response = await fetch(`${cloudSave.apiEndpoint}?deviceId=${deviceId}`, {
            headers: {
                'Authorization': `Bearer ${cloudSave.apiKey}`
            }
        });
        
        if (response.ok) {
            const cloudData = await response.json();
            
            // Handle conflict resolution
            const localSaveTime = parseInt(localStorage.getItem('elementFusionSaveTime') || '0');
            
            if (cloudSave.conflictResolution === 'remote' || 
                (cloudSave.conflictResolution === 'newest' && cloudData.timestamp > localSaveTime)) {
                
                // Apply cloud data
                gameState.elementsFound = cloudData.gameState.elementsFound;
                gameState.mergeCount = cloudData.gameState.mergeCount;
                gameState.discoveredElements = new Set(cloudData.gameState.discoveredElements);
                gameState.fusionEnergy = cloudData.gameState.fusionEnergy;
                gameState.reactorLevel = cloudData.gameState.reactorLevel;
                gameState.reactorEnergyStored = cloudData.gameState.reactorEnergyStored;
                gameState.reactorProductionRate = cloudData.gameState.reactorProductionRate;
                
                playerName = cloudData.playerName || playerName;
                
                // Update UI
                updateGameStats();
                updateProgressBar();
                updateReactorDisplay();
                createPeriodicTable();
                
                updateMergeResult('Game loaded from cloud!', true);
            }
            
            cloudSave.lastSyncTime = Date.now();
            updateSaveIndicator('synced');
            return true;
        }
    } catch (error) {
        console.error('Cloud load error:', error);
        updateSaveIndicator('error');
        return false;
    }
}

function generateDeviceId() {
    return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function setupCloudSaveControls() {
    const cloudToggle = document.getElementById('cloudToggle');
    const cloudSyncBtn = document.getElementById('cloudSyncBtn');
    const cloudLoadBtn = document.getElementById('cloudLoadBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    
    if (cloudToggle) {
        cloudToggle.checked = cloudSave.enabled;
        cloudToggle.addEventListener('change', function() {
            cloudSave.enabled = this.checked;
            localStorage.setItem('elementFusionCloudEnabled', this.checked.toString());
        });
    }
    
    if (cloudSyncBtn) {
        cloudSyncBtn.addEventListener('click', syncToCloud);
    }
    
    if (cloudLoadBtn) {
        cloudLoadBtn.addEventListener('click', loadFromCloud);
    }
    
    if (apiKeyInput) {
        const savedKey = localStorage.getItem('elementFusionApiKey');
        if (savedKey) {
            apiKeyInput.value = savedKey;
            cloudSave.apiKey = savedKey;
        }
        apiKeyInput.addEventListener('change', function() {
            cloudSave.apiKey = this.value;
            localStorage.setItem('elementFusionApiKey', this.value);
        });
    }
    
    // Load saved cloud settings
    const savedCloudEnabled = localStorage.getItem('elementFusionCloudEnabled');
    if (savedCloudEnabled) {
        cloudSave.enabled = savedCloudEnabled === 'true';
    }
    
    const savedConflictRes = localStorage.getItem('elementFusionConflictRes');
    if (savedConflictRes) {
        cloudSave.conflictResolution = savedConflictRes;
    }
    
    // Set up cloud sync interval
    if (cloudSave.enabled) {
        setInterval(syncToCloud, cloudSave.syncInterval);
    }

    const conflictResSelect = document.getElementById('conflictRes');
    if (conflictResSelect) {
        conflictResSelect.value = cloudSave.conflictResolution;
        conflictResSelect.addEventListener('change', function() {
            cloudSave.conflictResolution = this.value;
            localStorage.setItem('elementFusionConflictRes', this.value);
        });
    }

}
// Leaderboard Functions
function initializeLeaderboards() {
    // Try to detect country
    detectCountry();
    
    // Load leaderboards from localStorage as cache
    const savedLeaderboards = localStorage.getItem('elementFusionLeaderboards');
    if (savedLeaderboards) {
        try {
            leaderboards = JSON.parse(savedLeaderboards);
        } catch (e) {
            console.warn('Failed to parse saved leaderboards');
        }
    }
    
    // Setup leaderboard button
    const leaderboardBtn = document.getElementById('leaderboardBtn');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', showLeaderboard);
    }
    
    // Setup close button
    const closeBtn = document.getElementById('closeLeaderboard');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideLeaderboard);
    }
    
    // Setup tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Add active class to clicked tab
            this.classList.add('active');
            const tabId = this.dataset.tab + 'Tab';
            document.getElementById(tabId).classList.add('active');
            
            // Load fresh data for this tab
            loadLeaderboardTab(this.dataset.tab);
        });
    });
    
    // Setup submit score button
    const submitBtn = document.getElementById('submitScoreBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitCurrentScore);
    }
    
    // Setup refresh button
    const refreshBtn = document.getElementById('refreshLeaderboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshAllLeaderboards);
    }
    
    // Update current score display periodically
    setInterval(updateCurrentScoreDisplay, 2000);
    
    // Pre-load global leaderboards in background
    setTimeout(() => {
        loadGlobalLeaderboards();
    }, 3000);
}

// Country detection
async function detectCountry() {
    if (playerCountry !== '??') return;
    
    try {
        // Try to get country from free API
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            const data = await response.json();
            playerCountry = data.country_code || '??';
            localStorage.setItem('elementFusionCountry', playerCountry);
        }
    } catch (error) {
        console.log('Country detection failed, using default');
    }
}

// Load all global leaderboards
async function loadGlobalLeaderboards() {
    const categories = ['totalScore', 'elementsFound', 'topFusions', 'highestEnergy', 'reactorLevel'];
    
    for (const category of categories) {
        try {
            await loadLeaderboardTab(category);
        } catch (error) {
            console.warn(`Failed to load ${category} leaderboard:`, error);
        }
    }
}

// Load a specific leaderboard tab
aasync function loadLeaderboardTab(category) {
    const listElement = document.getElementById(`${category}List`);
    if (!listElement) return;
    
    // Show loading state
    listElement.innerHTML = '<div class="empty-leaderboard">🌍 Loading global scores...</div>';
    
    try {
        // Use absolute URL for Netlify functions
        const response = await fetch(
            `${LEADERBOARD_API.endpoints.get}?category=${category}&playerName=${encodeURIComponent(playerName)}&limit=20`
        );
        
        if (!response.ok) throw new Error('Network response failed');
        
        const data = await response.json();
        
        if (data.success && data.leaderboard) {
            updateLeaderboardTabDisplay(category, data.leaderboard);
            
            // Cache in localStorage
            leaderboards[category] = data.leaderboard;
            localStorage.setItem('elementFusionLeaderboards', JSON.stringify(leaderboards));
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error(`Error loading ${category} leaderboard:`, error);
        
        // Fallback to cached data
        if (leaderboards[category] && leaderboards[category].length > 0) {
            updateLeaderboardTabDisplay(category, leaderboards[category]);
            listElement.innerHTML += '<div class="leaderboard-warning">⚠️ Showing cached data</div>';
        } else {
            listElement.innerHTML = '<div class="empty-leaderboard">⚠️ Connection failed. Try again later.</div>';
        }
    }
}
// Update leaderboard tab display
function updateLeaderboardTabDisplay(category, entries) {
    const listElement = document.getElementById(`${category}List`);
    if (!listElement) return;
    
    if (!entries || entries.length === 0) {
        listElement.innerHTML = '<div class="empty-leaderboard">No scores yet. Be the first!</div>';
        return;
    }
    
    listElement.innerHTML = '';
    
    // Filter out duplicates and limit to top 20
    const uniqueEntries = [];
    const seenPlayers = new Set();
    
    for (const entry of entries) {
        if (!seenPlayers.has(entry.player_name) && uniqueEntries.length < 20) {
            seenPlayers.add(entry.player_name);
            uniqueEntries.push(entry);
        }
    }
    
    uniqueEntries.forEach((entry, index) => {
        const entryElement = document.createElement('div');
        entryElement.className = 'leaderboard-entry';
        
        // Highlight current player's entry
        if (entry.player_name === playerName) {
            entryElement.classList.add('highlight');
        }
        
        const rankClass = `rank-${entry.rank || index + 1}`;
        const countryFlag = entry.country && entry.country !== '??' ? 
            `<span class="country-flag">${getCountryFlag(entry.country)}</span>` : '';
        
        entryElement.innerHTML = `
            <div class="rank ${rankClass}">#${entry.rank || index + 1}</div>
            <div class="player-info">
                <div class="player-name">
                    ${countryFlag}
                    ${entry.player_name}
                </div>
                <div class="player-meta">
                    ${entry.device_id ? `<span class="device-id">📱</span>` : ''}
                    <span class="player-date">${formatTimeAgo(entry.submitted_at)}</span>
                </div>
            </div>
            <div class="player-score">${entry.score.toLocaleString()}</div>
        `;
        
        listElement.appendChild(entryElement);
    });
    
    // Add player's rank if not in top list
    const playerEntry = entries.find(e => e.player_name === playerName);
    if (!playerEntry && entries.length > 0) {
        // Player is not in top list, show their rank separately
        showPlayerRank(category);
    }
}

// Submit score to global leaderboard
async function submitScoreToGlobal(playerName, score, category) {
    try {
        const response = await fetch(`${LEADERBOARD_API.baseUrl}/${LEADERBOARD_API.endpoints.submit}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                playerName,
                score,
                category,
                deviceId,
                country: playerCountry
            })
        });
        
        if (!response.ok) throw new Error('Submission failed');
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error submitting score:', error);
        throw error;
    }
}

// Refresh all leaderboards
async function refreshAllLeaderboards() {
    const tabs = document.querySelectorAll('.tab-content.active');
    if (tabs.length > 0) {
        const activeTab = tabs[0].id.replace('Tab', '');
        await loadLeaderboardTab(activeTab);
    }
}

// Get player statistics
async function updatePlayerStats() {
    try {
        const response = await fetch(
            `${LEADERBOARD_API.baseUrl}/${LEADERBOARD_API.endpoints.stats}?playerName=${encodeURIComponent(playerName)}`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Update stats display
                updateStatsDisplay(data);
            }
        }
    } catch (error) {
        console.warn('Failed to fetch player stats:', error);
    }
}

// Helper functions
function getCountryFlag(countryCode) {
    // Convert country code to flag emoji
    if (!countryCode || countryCode.length !== 2) return '🏴';
    
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    
    return String.fromCodePoint(...codePoints);
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
}

// Show player's rank if not in top list
async function showPlayerRank(category) {
    try {
        const response = await fetch(
            `${LEADERBOARD_API.baseUrl}/${LEADERBOARD_API.endpoints.get}?category=${category}&playerName=${encodeURIComponent(playerName)}&limit=50`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.leaderboard) {
                const playerEntry = data.leaderboard.find(e => e.player_name === playerName);
                if (playerEntry) {
                    const listElement = document.getElementById(`${category}List`);
                    const separator = document.createElement('div');
                    separator.className = 'player-rank-separator';
                    separator.innerHTML = `<div class="separator-text">Your Rank</div>`;
                    listElement.appendChild(separator);
                    
                    const entryElement = document.createElement('div');
                    entryElement.className = 'leaderboard-entry highlight';
                    entryElement.innerHTML = `
                        <div class="rank rank-player">#${playerEntry.rank}</div>
                        <div class="player-info">
                            <div class="player-name">${playerName} (You)</div>
                            <div class="player-date">${formatTimeAgo(playerEntry.submitted_at)}</div>
                        </div>
                        <div class="player-score">${playerEntry.score.toLocaleString()}</div>
                    `;
                    listElement.appendChild(entryElement);
                }
            }
        }
    } catch (error) {
        // Silently fail
    }
}

function showLeaderboard() {
    updateCurrentScoreDisplay();
    
    // Find active tab and load its data
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        loadLeaderboardTab(activeTab.dataset.tab);
    } else {
        // Default to first tab
        loadLeaderboardTab('totalScore');
    }
    
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    leaderboardContainer.style.display = 'flex';
    
    // Add escape key listener
    document.addEventListener('keydown', handleEscapeKey);
    
    // Add click outside to close
    setTimeout(() => {
        leaderboardContainer.addEventListener('click', function(e) {
            if (e.target === this) {
                hideLeaderboard();
            }
        });
    }, 100);
}function hideLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    leaderboardContainer.style.display = 'none';
    
    // Remove escape key listener
    document.removeEventListener('keydown', handleEscapeKey);
}

// Educational Content Functions
function initializeEducationalContent() {
	// Set up hover tooltips for elements
	setupElementHoverTooltips();    
    // Setup educational tips rotation
    startEducationalTips();
}
function setupElementHoverTooltips() {
    // We'll use event delegation for dynamically created elements
    document.addEventListener('mouseover', function(e) {
        const elementSlot = e.target.closest('.element-slot[data-symbol]');
        const mergeElement = e.target.closest('.merge-element[data-symbol]');
        
        let targetElement = null;
        let elementSymbol = null;
        
        if (elementSlot && elementSlot.dataset.symbol !== '?') {
            targetElement = elementSlot;
            elementSymbol = elementSlot.dataset.symbol;
        } else if (mergeElement) {
            targetElement = mergeElement;
            elementSymbol = mergeElement.dataset.symbol;
        }
        
        if (targetElement && elementSymbol && !targetElement.hasAttribute('data-tooltip-active')) {
            // Show tooltip after a short delay
            targetElement.setAttribute('data-tooltip-active', 'true');
            const hoverTimer = setTimeout(() => {
                showElementTooltip(targetElement, elementSymbol);
            }, 800); // 0.8 second delay before showing
            
            // Store timer reference on element
            targetElement.setAttribute('data-hover-timer', hoverTimer);
        }
    });
    
document.addEventListener('mouseout', function(e) {
    const elementSlot = e.target.closest('.element-slot[data-symbol]');
    const mergeElement = e.target.closest('.merge-element[data-symbol]');
    
    const targetElement = elementSlot || mergeElement;
    const relatedTarget = e.relatedTarget;
    
    if (targetElement && targetElement.hasAttribute('data-tooltip-active')) {
        // Check if we're moving to the tooltip itself
        if (relatedTarget && relatedTarget.closest('.element-tooltip')) {
            // We're moving to the tooltip - don't hide it yet
            return;
        }
        
        // Clear the hover timer
        const hoverTimer = targetElement.getAttribute('data-hover-timer');
        if (hoverTimer) {
            clearTimeout(parseInt(hoverTimer));
        }
        
        // Remove active attribute
        targetElement.removeAttribute('data-tooltip-active');
        targetElement.removeAttribute('data-hover-timer');
        
        // Start a timer to hide the tooltip (gives user time to move to it)
        const hideTimer = setTimeout(() => {
            // Check if mouse is still over the tooltip or element
            const currentTooltip = document.querySelector('.element-tooltip');
            if (currentTooltip) {
                const tooltipRect = currentTooltip.getBoundingClientRect();
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                
                // If mouse is not over tooltip, hide it
                if (mouseX < tooltipRect.left || 
                    mouseX > tooltipRect.right || 
                    mouseY < tooltipRect.top || 
                    mouseY > tooltipRect.bottom) {
                    hideElementTooltip();
                }
            }
        }, 500); // 300ms delay before checking
        
        targetElement.setAttribute('data-hide-timer', hideTimer);
    }
});    
    // Also hide tooltip when clicking anywhere
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.element-tooltip') && !e.target.closest('.element-info-modal')) {
            hideElementTooltip();
        }
    });
}

let currentTooltip = null;
let tooltipHideTimer = null;

function showElementTooltip(element, elementSymbol) {
    // Hide any existing tooltip first
    hideElementTooltip();
    
    const elementData = elementMap[elementSymbol];
    if (!elementData) return;
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'element-tooltip';
    tooltip.setAttribute('data-for-element', elementSymbol);
    
    // Get position of target element
    const rect = element.getBoundingClientRect();
    const isMergeElement = element.classList.contains('merge-element');
    
    // Position tooltip
    let top, left;
    
    if (isMergeElement) {
        // Position above merge elements
        top = rect.top - 10;
        left = rect.left + (rect.width / 2);
        tooltip.style.transform = 'translate(-50%, -100%)';
    } else {
        // Position below periodic table elements
        top = rect.bottom + 10;
        left = rect.left + (rect.width / 2);
        tooltip.style.transform = 'translate(-50%, 0)';
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    
    // Create tooltip content
    tooltip.innerHTML = `
        <div class="tooltip-header" style="background-color: ${elementData.color || '#3949ab'}">
            <h4>${elementData.name} (${elementData.symbol})</h4>
            <div class="tooltip-basic-info">
                <span>#${elementData.number}</span>
                <span>${elementData.mass}</span>
                <span>${elementData.category}</span>
            </div>
        </div>
        <div class="tooltip-body">
            <p class="tooltip-description">${elementData.description || 'No description available.'}</p>
            <div class="tooltip-actions">
                <button class="tooltip-more-info" data-symbol="${elementSymbol}">
                    ℹ️ More Info
                </button>
                <button class="tooltip-close">
                    ✕
                </button>
            </div>
        </div>
        <div class="tooltip-arrow"></div>
    `;
    
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;
    
    // Add event listeners
    tooltip.querySelector('.tooltip-more-info').addEventListener('click', function() {
        hideElementTooltip();
        showElementInfo(elementSymbol);
    });
    
    tooltip.querySelector('.tooltip-close').addEventListener('click', hideElementTooltip);
    
    // Add mouse events to tooltip to prevent it from disappearing
    tooltip.addEventListener('mouseenter', function() {
        // Clear any hide timers when mouse enters tooltip
        const element = document.querySelector(`[data-symbol="${elementSymbol}"]`);
        if (element && element.hasAttribute('data-hide-timer')) {
            const timerId = element.getAttribute('data-hide-timer');
            if (timerId) {
                clearTimeout(parseInt(timerId));
                element.removeAttribute('data-hide-timer');
            }
        }
    });
    
    tooltip.addEventListener('mouseleave', function(e) {
        // Hide tooltip when mouse leaves it
        setTimeout(() => {
            if (currentTooltip === this) {
                hideElementTooltip();
            }
        }, 300);
    });
    
    // Auto-hide after 10 seconds
    tooltipHideTimer = setTimeout(hideElementTooltip, 10000);
}
function hideElementTooltip() {
    if (tooltipHideTimer) {
        clearTimeout(tooltipHideTimer);
        tooltipHideTimer = null;
    }
    
    // Clear any hide timers on elements
    document.querySelectorAll('[data-hide-timer]').forEach(el => {
        const timerId = el.getAttribute('data-hide-timer');
        if (timerId) {
            clearTimeout(parseInt(timerId));
            el.removeAttribute('data-hide-timer');
        }
    });
    
    if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
    }
    
    // Clear all active tooltip states
    document.querySelectorAll('[data-tooltip-active]').forEach(el => {
        el.removeAttribute('data-tooltip-active');
        const hoverTimer = el.getAttribute('data-hover-timer');
        if (hoverTimer) {
            clearTimeout(parseInt(hoverTimer));
            el.removeAttribute('data-hover-timer');
        }
    });
}
function showElementInfo(elementSymbol) {
    const element = elementMap[elementSymbol];
    if (!element) return;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'element-info-modal';
    
    // Get interesting facts about the element
    const facts = getElementFacts(element);
    const uses = getElementUses(element);
    
    modal.innerHTML = `
        <div class="element-info-content">
            <div class="element-info-header" style="background-color: ${element.color || '#3949ab'}">
                <button class="close-info-btn">✕</button>
                <h3>${element.name} (${element.symbol})</h3>
                <div class="element-info-basic">
                    <span class="info-badge">Atomic Number: ${element.number}</span>
                    <span class="info-badge">Atomic Mass: ${element.mass}</span>
                    <span class="info-badge">Category: ${element.category}</span>
                </div>
            </div>
            
            <div class="element-info-body">
                <div class="info-section">
                    <h4>📚 Interesting Facts</h4>
                    <ul class="element-facts">
                        ${facts.map(fact => `<li>${fact}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="info-section">
                    <h4>🔧 Common Uses</h4>
                    <ul class="element-uses">
                        ${uses.map(use => `<li>${use}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="info-section">
                    <h4>📊 Discovery</h4>
                    <p>${getDiscoveryInfo(element)}</p>
                </div>
                
                ${element.description ? `
                <div class="info-section">
                    <h4>📖 Description</h4>
                    <p>${element.description}</p>
                </div>
                ` : ''}
            </div>
            
            <div class="element-info-footer">
                <button class="next-element-btn" data-next="${element.number + 1}">Next Element →</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.close-info-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.next-element-btn').addEventListener('click', (e) => {
        const nextNumber = parseInt(e.target.dataset.next);
        const nextElement = elementByNumber[nextNumber];
        if (nextElement) {
            document.body.removeChild(modal);
            setTimeout(() => showElementInfo(nextElement.symbol), 100);
        }
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Add escape key to close
    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
	
	function startEducationalTips() {
    // ... (same as before)
}
}

function getElementFacts(element) {
    const factsDatabase = {
        'H': [
            'Hydrogen is the most abundant element in the universe',
            'It makes up about 75% of all normal matter',
            'The Sun fuses hydrogen into helium'
        ],
        'He': [
            'Helium is the second lightest element',
            'It was discovered on the Sun before Earth',
            'Helium balloons float because it\'s lighter than air'
        ],
        'C': [
            'Carbon is the basis of all known life',
            'Diamonds are pure carbon in a crystal structure',
            'Carbon can form more compounds than any other element'
        ],
        'O': [
            'Oxygen makes up about 21% of Earth\'s atmosphere',
            'It\'s essential for respiration in most living organisms',
            'Oxygen is the third most abundant element in the universe'
        ],
        'Au': [
            'Gold is so malleable that one ounce can be stretched into a wire 50 miles long',
            'All the gold ever mined would fit into three Olympic-sized swimming pools',
            'Gold is chemically inert and doesn\'t rust or tarnish'
        ],
        'Fe': [
            'Iron is the most abundant element on Earth by mass',
            'The Earth\'s core is mostly iron',
            'Iron is essential for hemoglobin in blood'
        ]
    };
    
    return factsDatabase[element.symbol] || [
        `This element has atomic number ${element.number}`,
        `It belongs to the ${element.category} category`,
        gameState.discoveredElements.has(element.symbol) 
            ? 'You have discovered this element!' 
            : 'You have not discovered this element yet'
    ];
}

function getElementUses(element) {
    const usesDatabase = {
        'H': ['Rocket fuel', 'Hydrogen fuel cells', 'Ammonia production'],
        'He': ['Party balloons', 'Cooling MRI machines', 'Airships'],
        'C': ['Pencil lead (graphite)', 'Diamond jewelry', 'Steel production'],
        'O': ['Medical oxygen', 'Steel production', 'Water treatment'],
        'Al': ['Aircraft construction', 'Cans and foil', 'Electrical wiring'],
        'Si': ['Computer chips', 'Solar panels', 'Glass manufacturing'],
        'Cu': ['Electrical wiring', 'Coins', 'Plumbing pipes'],
        'Au': ['Jewelry', 'Electronics', 'Financial reserves'],
        'Fe': ['Steel production', 'Magnets', 'Construction materials'],
        'Ag': ['Jewelry', 'Photography', 'Antibacterial coatings']
    };
    
    return usesDatabase[element.symbol] || [
        'Scientific research',
        'Industrial applications',
        'Specialized manufacturing'
    ];
}

function getDiscoveryInfo(element) {
    const discoveryInfo = {
        'H': 'Discovered by Henry Cavendish in 1766',
        'He': 'Discovered independently by Pierre Janssen and Norman Lockyer in 1868',
        'O': 'Discovered independently by Carl Wilhelm Scheele and Joseph Priestley in 1770s',
        'Au': 'Known since ancient times',
        'Fe': 'Known since ancient times, used since ~1200 BCE',
        'U': 'Discovered by Martin Heinrich Klaproth in 1789'
    };
    
    return discoveryInfo[element.symbol] || 'Discovered through scientific research';
}

function startEducationalTips() {
    // Show periodic educational tips
    const tips = [
        "💡 Tip: Did you know? Hydrogen makes up about 75% of all normal matter in the universe!",
        "🔬 Tip: Elements in the same column (group) have similar chemical properties!",
        "⚡ Tip: Upgrade your reactor regularly to generate more fusion energy!",
        "🎯 Tip: Try to discover elements in order - it's more energy efficient!",
        "🌟 Tip: Gold (Au) is so malleable that one ounce can be stretched into a wire 50 miles long!"
    ];
    
    let tipIndex = 0;
    
    // Show a tip every 2 minutes
    setInterval(() => {
        updateMergeResult(tips[tipIndex], true);
        tipIndex = (tipIndex + 1) % tips.length;
    }, 120000); // 2 minutes
}

function celebrateHighScore(rank) {
    const messages = [
        "🥇 AMAZING! You're #1 on the leaderboard! 🥇",
        "🥈 INCREDIBLE! You're #2 on the leaderboard! 🥈",
        "🥉 EXCELLENT! You're #3 on the leaderboard! 🥉"
    ];
    
    if (rank <= 3) {
        const message = messages[rank - 1];
        updateMergeResult(message, true);
        
        // Add visual celebration
        const mergeResult = document.getElementById('mergeResult');
        mergeResult.style.animation = 'pulse 1s 3';
        
        if (rank === 1) {
            setTimeout(() => {
                updateMergeResult("🏆🏆 CHAMPION! #1 ON THE LEADERBOARD! 🏆🏆", true);
            }, 1500);
        }
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        hideLeaderboard();
    }
}

function calculateScore() {
    // Calculate total score based on multiple factors
    let score = 0;
    
    // Points for elements discovered
    score += gameState.elementsFound * 100;
    
    // Points for fusions completed
    score += gameState.mergeCount * 50;
    
    // Points for reactor level (exponential)
    score += Math.pow(gameState.reactorLevel, 2) * 100;
    
    // Points for energy (logarithmic, diminishing returns)
    score += Math.log10(gameState.fusionEnergy + 1) * 100;
    
    // Bonus for discovery percentage
    const discoveryPercentage = (gameState.elementsFound / elements.length) * 100;
    score += discoveryPercentage * 50;
    
    // Penalty for time? (optional)
    // score -= gameState.mergeCount * 0.1; // Small penalty for many merges
    
    return Math.floor(score);
}

function updateCurrentScoreDisplay() {
    const currentScore = document.getElementById('currentScore');
    const bestScore = document.getElementById('bestScore');
    
    if (currentScore && bestScore) {
        const score = calculateScore();
        currentScore.textContent = score.toLocaleString();
        
        // Get best score from leaderboards
        const best = getBestScore();
        bestScore.textContent = best.toLocaleString();
    }
}

function getBestScore() {
    // Check all leaderboards for player's best score
    const playerScores = [];
    
    // Check topFusions leaderboard
    leaderboards.topFusions.forEach(entry => {
        if (entry.name === playerName) {
            playerScores.push(entry.score);
        }
    });
    
    // Check elementsFound leaderboard
    leaderboards.elementsFound.forEach(entry => {
        if (entry.name === playerName) {
            playerScores.push(entry.score);
        }
    });
    
    // Check highestEnergy leaderboard
    leaderboards.highestEnergy.forEach(entry => {
        if (entry.name === playerName) {
            playerScores.push(entry.score);
        }
    });
    
    return playerScores.length > 0 ? Math.max(...playerScores) : 0;
}

function updateLeaderboardDisplay() {
    // Update each leaderboard tab
    updateLeaderboardTab('topFusions', 'Fusions');
    updateLeaderboardTab('elementsFound', 'Elements');
    updateLeaderboardTab('highestEnergy', 'Energy');
}

function updateLeaderboardTab(leaderboardKey, scoreLabel) {
    const listElement = document.getElementById(`${leaderboardKey}List`);
    if (!listElement) return;
    
    const entries = leaderboards[leaderboardKey];
    
    if (entries.length === 0) {
        listElement.innerHTML = '<div class="empty-leaderboard">No scores yet. Be the first!</div>';
        return;
    }
    
    listElement.innerHTML = '';
    
    entries.forEach((entry, index) => {
        const entryElement = document.createElement('div');
        entryElement.className = 'leaderboard-entry';
        
        // Highlight current player's entry
        if (entry.name === playerName) {
            entryElement.classList.add('highlight');
        }
        
        const rankClass = `rank-${index + 1}`;
        
        entryElement.innerHTML = `
            <div class="rank ${rankClass}">#${index + 1}</div>
            <div class="player-info">
                <div class="player-name">${entry.name}</div>
                <div class="player-date">${new Date(entry.date).toLocaleDateString()}</div>
            </div>
            <div class="player-score">${entry.score.toLocaleString()} ${scoreLabel}</div>
        `;
        
        listElement.appendChild(entryElement);
    });
}

async function submitCurrentScore() {
    // Ask for player name if not set
    if (playerName === 'Anonymous' || playerName.trim() === '') {
        const name = prompt('Enter your name for the global leaderboard (3-20 characters):', playerName);
        if (name && name.trim()) {
            const trimmedName = name.trim().substring(0, 20);
            if (trimmedName.length < 3) {
                updateMergeResult('Name must be at least 3 characters', false);
                return;
            }
            playerName = trimmedName;
            localStorage.setItem('elementFusionPlayerName', playerName);
        } else {
            return;
        }
    }
    
    // Calculate scores for all categories
    const scores = {
        totalScore: calculateScore(),
        elementsFound: gameState.elementsFound,
        topFusions: gameState.mergeCount,
        highestEnergy: gameState.fusionEnergy,
        reactorLevel: gameState.reactorLevel
    };
    
    // Show loading message
    updateMergeResult('📡 Submitting to global leaderboard...', true);
    
    let submittedCount = 0;
    let bestRank = Infinity;
    let bestCategory = '';
    let globalError = false;
    
    // Submit each category to global
    for (const [category, score] of Object.entries(scores)) {
        if (score > 0) {
            try {
                const response = await fetch(LEADERBOARD_API.endpoints.submit, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        playerName,
                        score,
                        category,
                        deviceId,
                        country: playerCountry
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        submittedCount++;
                        if (result.rank < bestRank) {
                            bestRank = result.rank;
                            bestCategory = category;
                        }
                    }
                } else {
                    throw new Error('Submission failed');
                }
            } catch (error) {
                console.warn(`Failed to submit ${category}:`, error);
                globalError = true;
            }
        }
    }
    
    // Update local leaderboards as backup
    const currentDate = new Date().toISOString();
    Object.entries(scores).forEach(([category, score]) => {
        if (score > 0) {
            addToLeaderboard(category, {
                name: playerName,
                score: score,
                date: currentDate,
                category: category
            });
        }
    });
    
    saveLeaderboards();
    updateLeaderboardDisplay();
    updateCurrentScoreDisplay();
    
    if (submittedCount > 0) {
        // Update leaderboard display
        refreshAllLeaderboards();
        
        // Show success message
        if (bestRank <= 10) {
            const categoryName = LEADERBOARD_API.categories[bestCategory] || bestCategory;
            updateMergeResult(`🎉 Rank #${bestRank} globally in ${categoryName}!`, true);
            
            // Special celebration for top 3
            if (bestRank <= 3) {
                celebrateHighScore(bestRank);
            }
        } else {
            updateMergeResult(`${submittedCount} scores submitted to global leaderboard!`, true);
        }
        
        // Update player stats
        updatePlayerStats();
    } else if (globalError) {
        updateMergeResult('⚠️ Submitted locally (offline mode). Try again when online.', false);
    } else {
        updateMergeResult('Submitted to local leaderboard!', true);
    }
}

function addToLeaderboard(leaderboardKey, newEntry) {
    let leaderboard = leaderboards[leaderboardKey];
    
    // Remove existing entry for this player (keep only best score)
    leaderboard = leaderboard.filter(entry => entry.name !== newEntry.name);
    
    // Add new entry
    leaderboard.push(newEntry);
    
    // Sort by score (descending)
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep only top 10 entries
    leaderboard = leaderboard.slice(0, 10);
    
    leaderboards[leaderboardKey] = leaderboard;
}

function getPlayerRank(playerName, leaderboardKey) {
    const leaderboard = leaderboards[leaderboardKey];
    const index = leaderboard.findIndex(entry => entry.name === playerName);
    return index !== -1 ? index + 1 : 'Not ranked';
}

function saveLeaderboards() {
    localStorage.setItem('elementFusionLeaderboards', JSON.stringify(leaderboards));
}

// Also save highest energy achieved
function checkAndSaveHighestEnergy() {
    const highestEnergy = localStorage.getItem('elementFusionHighestEnergy') || 0;
    if (gameState.fusionEnergy > highestEnergy) {
        localStorage.setItem('elementFusionHighestEnergy', gameState.fusionEnergy);
    }
}
function createCategoryLegend() {
    const categories = {
        'alkali': 'Alkali Metals',
        'alkaline': 'Alkaline Earth',
        'transition': 'Transition Metals',
        'metal': 'Basic Metals',
        'metalloid': 'Metalloids',
        'nonmetal': 'Nonmetals',
        'halogen': 'Halogens',
        'noble': 'Noble Gases',
        'lanthanide': 'Lanthanides',
        'actinide': 'Actinides'
    };
    
    const colors = {
        'alkali': '#06D6A0',
        'alkaline': '#118AB2',
        'transition': '#FF5252',
        'metal': '#EF476F',
        'metalloid': '#073B4C',
        'nonmetal': '#4FC3F7',
        'halogen': '#FFD166',
        'noble': '#FF6B6B',
        'lanthanide': '#9C27B0',
        'actinide': '#E91E63'
    };
    
    const legend = document.getElementById('categoryLegend');
    legend.innerHTML = '';
    
    for (const [category, name] of Object.entries(categories)) {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            <div class="category-color" style="background-color: ${colors[category]}"></div>
            <span>${name}</span>
        `;
        legend.appendChild(item);
    }
}
// Create the periodic table grid with proper layout
function createPeriodicTable() {
    const table = document.getElementById('periodicTable');
    table.innerHTML = '';
    
    // Get grid size from coordinates
    const gridSize = getPeriodicTableGridSize();
    
    // Update CSS grid template to always use 18 columns
    table.style.gridTemplateColumns = `repeat(18, 1fr)`;
    table.style.gridTemplateRows = `repeat(${gridSize.rows}, 1fr)`;
    
    // Create empty grid cells - always 18 columns x rows
    const totalCells = 18 * gridSize.rows;
    
    for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / 18);
        const col = i % 18;
        
        const elementSlot = document.createElement('div');
        elementSlot.className = 'element-slot empty-slot';
        elementSlot.dataset.row = row;
        elementSlot.dataset.col = col;
        
        // Check if there's an element at this position
        let elementAtPosition = null;
        for (const [elementNumber, coords] of Object.entries(periodicCoordinates)) {
            if (coords[0] === row && coords[1] === col) {
                elementAtPosition = elements.find(el => el.number === parseInt(elementNumber));
                break;
            }
        }
        
        if (elementAtPosition) {
            const elementData = elementAtPosition;
            elementSlot.dataset.symbol = elementData.symbol;
            elementSlot.dataset.name = elementData.name;
            elementSlot.dataset.mass = elementData.mass;
            elementSlot.dataset.number = elementData.number;
            
            // Check if element is discovered
            const isDiscovered = gameState.discoveredElements.has(elementData.symbol);
            
            if (isDiscovered) {
                elementSlot.classList.remove('empty-slot');
                elementSlot.classList.add('filled', 'discovered');
                elementSlot.draggable = true;
                elementSlot.title = `Drag ${elementData.name} to Fusion Zone`;
            } else {
                elementSlot.classList.add('undiscovered');
                elementSlot.draggable = false;
                elementSlot.title = 'Not discovered yet';
            }
            
            elementSlot.innerHTML = `
                <div class="element-number">${elementData.number}</div>
                <div class="element-symbol">${elementData.symbol}</div>
                <div class="element-name">${elementData.name}</div>
            `;
            
            // Color code
            if (elementData.color) {
                elementSlot.style.backgroundColor = elementData.color + (isDiscovered ? 'CC' : '33');
                elementSlot.style.borderColor = elementData.color;
            }
        } else {
            // Empty cell - make it invisible but maintain grid structure
            elementSlot.style.visibility = 'hidden';
            elementSlot.style.pointerEvents = 'none';
        }
        
        table.appendChild(elementSlot);
    }
    
    // Reattach event listeners to all discovered elements
    setupElementEventListeners();
}
// Setup event listeners for periodic table elements
function setupElementEventListeners() {
    // Remove old listeners first to prevent duplicates
    const oldSlots = document.querySelectorAll('.element-slot');
    oldSlots.forEach(slot => {
        slot.replaceWith(slot.cloneNode(true));
    });
    
    // Get fresh references to all slots
    const slots = document.querySelectorAll('.element-slot.discovered');
    
    // Add event listeners to discovered elements
    slots.forEach(slot => {
        slot.addEventListener('dragstart', handleDragStart);
        slot.addEventListener('click', handleElementClick);
        
        // Ensure drag is enabled
        slot.draggable = true;
    });

	setupTouchEvents();
    setupLongPress();

}
// Touch Event Handlers for Mobile
function setupTouchEvents() {
    const mergeArea = document.getElementById('mergeArea');
    
    if ('ontouchstart' in window) {
        console.log('Touch device detected, setting up touch events');
        
        // Replace mouse events with touch for merge elements
        document.querySelectorAll('.merge-element').forEach(element => {
            element.removeEventListener('mousedown', startDragMergeElement);
            element.addEventListener('touchstart', handleTouchStart, { passive: false });
        });
        
        // Make periodic table elements tappable on mobile
        document.querySelectorAll('.element-slot.discovered').forEach(slot => {
            slot.addEventListener('touchend', handleElementTap);
        });
        
        // Prevent context menu on long press
        document.addEventListener('contextmenu', function(e) {
            if (e.target.classList.contains('element-slot') || 
                e.target.classList.contains('merge-element')) {
                e.preventDefault();
            }
        });
        
        // Prevent zoom on double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(e) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }
}

function handleTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (gameState.isMerging) return;
    
    const touch = e.touches[0];
    const element = this;
    const rect = element.getBoundingClientRect();
    const mergeArea = document.getElementById('mergeArea');
    const areaRect = mergeArea.getBoundingClientRect();
    
    // Calculate offset from touch to element position
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    
    gameState.draggingElement = {
        element: element,
        symbol: element.dataset.symbol,
        offsetX: offsetX,
        offsetY: offsetY,
        startX: rect.left - areaRect.left,
        startY: rect.top - areaRect.top
    };
    
    element.classList.add('dragging');
    
    // Add touch event listeners
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    // Highlight merge targets
    highlightMergeTargets(element.dataset.symbol);
}

function handleTouchMove(e) {
    if (!gameState.draggingElement || gameState.isMerging) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const mergeArea = document.getElementById('mergeArea');
    const areaRect = mergeArea.getBoundingClientRect();
    
    // Calculate new position
    let x = touch.clientX - areaRect.left - gameState.draggingElement.offsetX;
    let y = touch.clientY - areaRect.top - gameState.draggingElement.offsetY;
    
    // Constrain to merge area bounds
    const maxX = areaRect.width - 75;
    const maxY = areaRect.height - 75;
    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));
    
    // Update element position
    gameState.draggingElement.element.style.left = `${x}px`;
    gameState.draggingElement.element.style.top = `${y}px`;
    
    // Check for overlap with other elements
    checkForMerge(gameState.draggingElement.element, x, y);
}

function handleTouchEnd(e) {
    if (!gameState.draggingElement) return;
    
    e.preventDefault();
    
    // Remove dragging class
    gameState.draggingElement.element.classList.remove('dragging');
    
    // Remove merge highlights
    document.querySelectorAll('.merge-element.merge-highlight').forEach(el => {
        el.classList.remove('merge-highlight');
    });
    
    // Update element position in game state
    const elementId = gameState.draggingElement.element.id;
    const elementIndex = gameState.mergeElements.findIndex(el => el.id === elementId);
    if (elementIndex !== -1) {
        const rect = gameState.draggingElement.element.getBoundingClientRect();
        const mergeArea = document.getElementById('mergeArea');
        const areaRect = mergeArea.getBoundingClientRect();
        
        gameState.mergeElements[elementIndex].x = rect.left - areaRect.left;
        gameState.mergeElements[elementIndex].y = rect.top - areaRect.top;
    }
    
    // Remove event listeners
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    gameState.draggingElement = null;
}

function handleElementTap(e) {
    e.preventDefault();
    const symbol = this.dataset.symbol;
    if (symbol && symbol !== '?') {
        addElementToMergeArea(symbol);
    }
}

// Long press for element info on mobile
let touchTimer;
function setupLongPress() {
    if ('ontouchstart' in window) {
        document.querySelectorAll('.element-slot[data-symbol], .merge-element[data-symbol]').forEach(element => {
            element.addEventListener('touchstart', function(e) {
                touchTimer = setTimeout(() => {
                    const symbol = this.dataset.symbol;
                    if (symbol && symbol !== '?') {
                        e.preventDefault();
                        showElementInfo(symbol);
                    }
                }, 800); // 800ms for long press
            });
            
            element.addEventListener('touchend', function() {
                clearTimeout(touchTimer);
            });
            
            element.addEventListener('touchmove', function() {
                clearTimeout(touchTimer);
            });
        });
    }
}
// Setup reactor event listeners
function setupReactorEventListeners() {
    const harvestBtn = document.getElementById('harvestBtn');
    const upgradeBtn = document.getElementById('upgradeReactorBtn');
    
    if (harvestBtn) {
        harvestBtn.addEventListener('click', harvestReactorEnergy);
    }
    
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', upgradeReactor);
    }
}

// Create a merge element in the merge area
function createMergeElement(symbol, x, y, id, isNew = false) {
    const elementData = elementMap[symbol];
    if (!elementData) {
        console.log(`Element ${symbol} not found in elementMap`);
        return null;
    }
    
    const mergeElement = document.createElement('div');
    mergeElement.className = 'merge-element';
    if (isNew) {
        mergeElement.classList.add('new-element');
    }
    mergeElement.id = id || `merge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    mergeElement.dataset.symbol = symbol;
    mergeElement.dataset.name = elementData.name;
    mergeElement.dataset.mass = elementData.mass;
    mergeElement.style.left = `${x}px`;
    mergeElement.style.top = `${y}px`;
    
    // Apply element color
    if (elementData.color) {
        mergeElement.style.background = `linear-gradient(135deg, ${elementData.color}CC, ${elementData.color}99)`;
        mergeElement.style.borderColor = elementData.color;
    }
    
    mergeElement.innerHTML = `
        <div class="element-symbol">${symbol}</div>
        <div class="element-name">${elementData.name}</div>
    `;
    
    // Add drag functionality for desktop, touch for mobile
    if ('ontouchstart' in window) {
        mergeElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    } else {
        mergeElement.addEventListener('mousedown', startDragMergeElement);
    }
    
    return mergeElement;
}

// Add an element to the merge area
function addElementToMergeArea(symbol, x = null, y = null, isNew = false) {
    const mergeArea = document.getElementById('mergeArea');
    const areaRect = mergeArea.getBoundingClientRect();
    
    // Use provided coordinates or generate random ones
    const maxX = areaRect.width - 75;
    const maxY = areaRect.height - 75;
    
    let posX, posY;
    if (x !== null && y !== null) {
        posX = Math.max(20, Math.min(maxX, x));
        posY = Math.max(20, Math.min(maxY, y));
    } else {
        posX = Math.max(20, Math.min(maxX, Math.random() * maxX));
        posY = Math.max(20, Math.min(maxY, Math.random() * maxY));
    }
    
    const mergeElement = createMergeElement(symbol, posX, posY, null, isNew);
    if (mergeElement) {
        mergeArea.appendChild(mergeElement);
        gameState.mergeElements.push({
            id: mergeElement.id,
            symbol: symbol,
            x: posX,
            y: posY
        });
        
        if (isNew) {
            updateMergeResult(`Created new element: ${symbol}!`, true);
            // Remove the glow animation after it completes
            setTimeout(() => {
                if (mergeElement.parentNode) {
                    mergeElement.classList.remove('new-element');
                }
            }, 1500);
        }
    }
}

// Start dragging a merge element
function startDragMergeElement(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (gameState.isMerging) return; // Don't allow dragging during merge
    
    const element = this;
    const rect = element.getBoundingClientRect();
    const mergeArea = document.getElementById('mergeArea');
    const areaRect = mergeArea.getBoundingClientRect();
    
    // Calculate offset from mouse to element position
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    gameState.draggingElement = {
        element: element,
        symbol: element.dataset.symbol,
        offsetX: offsetX,
        offsetY: offsetY,
        startX: rect.left - areaRect.left,
        startY: rect.top - areaRect.top
    };
    
    element.classList.add('dragging');
    
    // Add event listeners for dragging
    document.addEventListener('mousemove', dragMergeElement);
    document.addEventListener('mouseup', stopDragMergeElement);
    
    // Highlight other elements that can be merged with
    highlightMergeTargets(element.dataset.symbol);
}

// Drag merge element - debounced version
let lastMoveTime = 0;
function dragMergeElement(e) {
    if (!gameState.draggingElement || gameState.isMerging) return;
    
    // Simple debouncing
    const now = Date.now();
    if (now - lastMoveTime < 16) return; // ~60fps
    lastMoveTime = now;
    
    const mergeArea = document.getElementById('mergeArea');
    const areaRect = mergeArea.getBoundingClientRect();
    
    // Calculate new position
    let x = e.clientX - areaRect.left - gameState.draggingElement.offsetX;
    let y = e.clientY - areaRect.top - gameState.draggingElement.offsetY;
    
    // Constrain to merge area bounds
    const maxX = areaRect.width - 75;
    const maxY = areaRect.height - 75;
    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));
    
    // Update element position
    gameState.draggingElement.element.style.left = `${x}px`;
    gameState.draggingElement.element.style.top = `${y}px`;
    
    // Check for overlap with other elements
    checkForMerge(gameState.draggingElement.element, x, y);
}

// Stop dragging a merge element
function stopDragMergeElement() {
    if (!gameState.draggingElement) return;
    
    // Remove dragging class
    gameState.draggingElement.element.classList.remove('dragging');
    
    // Remove merge highlights
    document.querySelectorAll('.merge-element.merge-highlight').forEach(el => {
        el.classList.remove('merge-highlight');
    });
    
    // Update element position in game state
    const elementId = gameState.draggingElement.element.id;
    const elementIndex = gameState.mergeElements.findIndex(el => el.id === elementId);
    if (elementIndex !== -1) {
        const rect = gameState.draggingElement.element.getBoundingClientRect();
        const mergeArea = document.getElementById('mergeArea');
        const areaRect = mergeArea.getBoundingClientRect();
        
        gameState.mergeElements[elementIndex].x = rect.left - areaRect.left;
        gameState.mergeElements[elementIndex].y = rect.top - areaRect.top;
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', dragMergeElement);
    document.removeEventListener('mouseup', stopDragMergeElement);
    
    gameState.draggingElement = null;
    lastMoveTime = 0;
}

// Highlight elements that can be merged with the current element
function highlightMergeTargets(symbol) {
    document.querySelectorAll('.merge-element').forEach(element => {
        if (element !== gameState.draggingElement.element && element.dataset.symbol === symbol) {
            element.classList.add('merge-highlight');
        }
    });
}

// Check if dragging element overlaps with another element for merging
function checkForMerge(draggingElement, x, y) {
    if (gameState.isMerging) return; // Prevent multiple merges
    
    const draggingRect = {
        left: x,
        top: y,
        right: x + 75,
        bottom: y + 75
    };
    
    let targetElement = null;
    
    // Find the first overlapping element
    document.querySelectorAll('.merge-element').forEach(element => {
        if (element === draggingElement || !element.classList.contains('merge-highlight')) return;
        
        const rect = element.getBoundingClientRect();
        const mergeArea = document.getElementById('mergeArea');
        const areaRect = mergeArea.getBoundingClientRect();
        
        const elementRect = {
            left: rect.left - areaRect.left,
            top: rect.top - areaRect.top,
            right: (rect.left - areaRect.left) + 75,
            bottom: (rect.top - areaRect.top) + 75
        };
        
        // Check for overlap
        const overlap = !(draggingRect.right < elementRect.left || 
                         draggingRect.left > elementRect.right || 
                         draggingRect.bottom < elementRect.top || 
                         draggingRect.top > elementRect.bottom);
        
        if (overlap && !targetElement) {
            targetElement = element;
        }
    });
    
    if (targetElement) {
        // Elements are overlapping - merge them!
        gameState.isMerging = true;
        attemptMerge(draggingElement, targetElement, draggingElement.dataset.symbol);
    }
}

// Attempt to merge two elements
function attemptMerge(element1, element2, symbol) {
    const mergeResult = getMergeResult(symbol, symbol);
    
    if (!mergeResult) {
        updateMergeResult(`${symbol} cannot be merged further!`, false);
        gameState.isMerging = false;
        return;
    }
    
    if (!mergeResult.success) {
        updateMergeResult(mergeResult.message, false);
        gameState.isMerging = false;
        return;
    }
    
    // Check if we have enough energy
    if (gameState.fusionEnergy < mergeResult.energyCost) {
        updateMergeResult(`Not enough fusion energy! Need ${mergeResult.energyCost}`, false);
        gameState.isMerging = false;
        return;
    }
    
    // Deduct energy cost
    gameState.fusionEnergy -= mergeResult.energyCost;
    
    // Merge successful!
    completeMerge(element1, element2, symbol, mergeResult.element);
}

// Complete a merge operation
function completeMerge(element1, element2, originalSymbol, newElement) {
    // Check if this is a new discovery
    const isNewDiscovery = !gameState.discoveredElements.has(newElement.symbol);
    
    // Update game state
    if (isNewDiscovery) {
        gameState.discoveredElements.add(newElement.symbol);
        gameState.elementsFound++;
    }
    
    gameState.mergeCount++;
    
    // Get positions for new element
    const rect1 = element1.getBoundingClientRect();
    const mergeArea = document.getElementById('mergeArea');
    const areaRect = mergeArea.getBoundingClientRect();
    
    const x = (rect1.left - areaRect.left + (parseFloat(element2.style.left) || 0)) / 2;
    const y = (rect1.top - areaRect.top + (parseFloat(element2.style.top) || 0)) / 2;
    
    // Remove old elements from arrays first
    const element1Id = element1.id;
    const element2Id = element2.id;
    
    gameState.mergeElements = gameState.mergeElements.filter(
        el => el.id !== element1Id && el.id !== element2Id
    );
    
    // Animate the merge
    element1.classList.add('merge-success');
    element2.classList.add('merge-success');
    
    // Fade out old elements
    element1.style.animation = 'fadeOut 0.5s forwards';
    element2.style.animation = 'fadeOut 0.5s forwards';
    
    setTimeout(() => {
        // Remove old elements from DOM
        if (element1.parentNode) element1.remove();
        if (element2.parentNode) element2.remove();
        
        // Add new element
        addElementToMergeArea(newElement.symbol, x, y, isNewDiscovery);
        
        // Update UI
        updateGameStats();
        createPeriodicTable(); // Recreate to update discovered status
        updateProgressBar();
        
        // Update message
        if (isNewDiscovery) {
            updateMergeResult(`New Discovery! ${originalSymbol} + ${originalSymbol} = ${newElement.symbol}`, true);
        } else {
            updateMergeResult(`Fusion successful! ${originalSymbol} + ${originalSymbol} = ${newElement.symbol} (Rediscovered)`, true);
        }
        
        // Check for win condition
        if (gameState.elementsFound >= elements.length) {
            setTimeout(() => {
                updateMergeResult("🎉 Amazing! You've discovered all available elements! 🎉", true);
            }, 500);
        }
        
        // Reset merging flag
        gameState.isMerging = false;
        
        // Force stop any dragging
        if (gameState.draggingElement) {
            stopDragMergeElement();
        }
    }, 500);
}

// Update progress bar
function updateProgressBar() {
    const progress = document.getElementById('discoveryProgress');
    const percentage = (gameState.elementsFound / elements.length) * 100;
    progress.style.width = `${percentage}%`;
}

// Update game stats display
function updateGameStats() {
    document.getElementById('fusionEnergy').textContent = Math.floor(gameState.fusionEnergy);
    document.getElementById('elementsFound').textContent = `${gameState.elementsFound}/${elements.length}`;
    document.getElementById('mergeCount').textContent = gameState.mergeCount;
	
	checkAndSaveHighestEnergy();
}

// Update merge result
function updateMergeResult(message, isSuccess = true) {
    const resultDiv = document.getElementById('mergeResult');
    resultDiv.textContent = message;
    resultDiv.style.color = isSuccess ? '#81c784' : '#ef5350';
}

// Setup event listeners for buttons and drop zone
function setupEventListeners() {
    // Remove old button listeners first
    const oldHintBtn = document.getElementById('hintBtn');
    const oldClearBtn = document.getElementById('clearBtn');
    const oldResetBtn = document.getElementById('resetBtn');
	const oldLeaderboardBtn = document.getElementById('leaderboardBtn');
    
    const newHintBtn = oldHintBtn.cloneNode(true);
    const newClearBtn = oldClearBtn.cloneNode(true);
    const newResetBtn = oldResetBtn.cloneNode(true);
	const newLeaderboardBtn = oldLeaderboardBtn.cloneNode(true);
    
    oldHintBtn.parentNode.replaceChild(newHintBtn, oldHintBtn);
    oldClearBtn.parentNode.replaceChild(newClearBtn, oldClearBtn);
    oldResetBtn.parentNode.replaceChild(newResetBtn, oldResetBtn);
	oldLeaderboardBtn.parentNode.replaceChild(newLeaderboardBtn, oldLeaderboardBtn);
    
    // Merge area drop zone
    const mergeArea = document.getElementById('mergeArea');
    
    // Clear old event listeners on merge area
    const newMergeArea = mergeArea.cloneNode(true);
    mergeArea.parentNode.replaceChild(newMergeArea, mergeArea);
    
    // Get fresh reference
    const freshMergeArea = document.getElementById('mergeArea');
    
    freshMergeArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('active-drop');
    });
    
    freshMergeArea.addEventListener('dragleave', function(e) {
        this.classList.remove('active-drop');
    });
    
    freshMergeArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('active-drop');
        
        const symbol = e.dataTransfer.getData('text/plain');
        if (symbol && symbol !== '?') {
            addElementToMergeArea(symbol);
        }
    });
    
    // Button events
    newHintBtn.addEventListener('click', function() {
        updateMergeResult("💡 Hint: Drag discovered elements to the Fusion Zone, then drag identical elements onto each other to create new elements! Each fusion costs energy based on the element's mass. Upgrade your reactor to generate more energy!", true);
    });
	
    newLeaderboardBtn.addEventListener('click', showLeaderboard);
	
    newClearBtn.addEventListener('click', function() {
        const mergeArea = document.getElementById('mergeArea');
        mergeArea.innerHTML = '';
        gameState.mergeElements = [];
        gameState.isMerging = false;
        gameState.draggingElement = null;
        updateMergeResult("Fusion Zone cleared");
    });
    
    newResetBtn.addEventListener('click', function() {
        if (confirm("Are you sure you want to reset the game? All progress will be lost.")) {
            // Reset game state
            gameState = {
                elementsFound: 10,
                mergeCount: 0,
                discoveredElements: new Set(['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne']),
                mergeElements: [],
                draggingElement: null,
                dragOffset: { x: 0, y: 0 },
                fusionEnergy: 100,
                isMerging: false,
                // Nuclear Reactor state
                reactorLevel: 1,
                reactorEnergyStored: 0,
                reactorMaxStorage: 50,
                reactorProductionRate: 1,
                reactorUpgradeCost: 50,
                lastUpdateTime: Date.now()
            };
            
            updateGameStats();
            createPeriodicTable();
            updateReactorDisplay();
            
            const mergeArea = document.getElementById('mergeArea');
            mergeArea.innerHTML = '';
            
            updateMergeResult("Game reset! Drag discovered elements to start!");
        }
    });
}

// Handle drag start from periodic table
function handleDragStart(e) {
    const symbol = this.dataset.symbol;
    if (!symbol || symbol === '?') {
        e.preventDefault();
        return;
    }
    
    this.classList.add('dragging');
    e.dataTransfer.setData('text/plain', symbol);
    e.dataTransfer.effectAllowed = 'move';
    
    // Set a custom drag image
    const dragIcon = document.createElement('div');
    dragIcon.textContent = symbol;
    dragIcon.style.position = 'absolute';
    dragIcon.style.top = '-1000px';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 10, 10);
    
    setTimeout(() => {
        document.body.removeChild(dragIcon);
    }, 0);
}

// Handle element click (alternative to drag)
function handleElementClick(e) {
    const symbol = this.dataset.symbol;
    if (symbol && symbol !== '?') {
        addElementToMergeArea(symbol);
    }
}
// Mobile Detection and Orientation
function checkMobileOrientation() {
    if (window.innerHeight > window.innerWidth) {
        // Portrait mode
        document.body.classList.add('portrait');
        document.body.classList.remove('landscape');
    } else {
        // Landscape mode
        document.body.classList.add('landscape');
        document.body.classList.remove('portrait');
    }
}

function showOrientationWarning() {
    if (window.innerWidth < 768 && window.innerHeight > window.innerWidth) {
        // Show orientation warning for mobile portrait
        const warning = document.createElement('div');
        warning.id = 'orientationWarning';
        warning.innerHTML = `
            <div class="orientation-warning-content">
                <div class="orientation-icon">📱</div>
                <h3>Rotate Your Device</h3>
                <p>For the best experience, please rotate your device to landscape mode.</p>
                <button onclick="this.parentElement.parentElement.style.display='none'">Continue Anyway</button>
            </div>
        `;
        document.body.appendChild(warning);
    } else {
        // Remove warning if exists
        const warning = document.getElementById('orientationWarning');
        if (warning) {
            warning.remove();
        }
    }
}

// Add CSS for orientation warning
const orientationWarningCSS = `
    #orientationWarning {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.9);
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(5px);
    }
    
    .orientation-warning-content {
        background: linear-gradient(135deg, #1a237e, #283593);
        padding: 30px;
        border-radius: 15px;
        text-align: center;
        max-width: 90%;
        border: 3px solid #3949ab;
        animation: pulse 2s infinite;
    }
    
    .orientation-icon {
        font-size: 4rem;
        margin-bottom: 20px;
        animation: rotate 3s infinite linear;
    }
    
    .orientation-warning-content h3 {
        color: #ffeb3b;
        margin: 0 0 15px 0;
        font-size: 1.8rem;
    }
    
    .orientation-warning-content p {
        color: #ccc;
        margin-bottom: 25px;
        line-height: 1.5;
    }
    
    .orientation-warning-content button {
        background: linear-gradient(135deg, #4fc3f7, #2196f3);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: bold;
    }
    
    @keyframes rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    @media (min-width: 769px) {
        #orientationWarning {
            display: none !important;
        }
    }
    
    /* Landscape mode optimizations */
    body.landscape .game-area {
        flex-direction: row !important;
    }
    
    body.landscape .left-panel {
        width: 50% !important;
    }
    
    body.landscape .right-panel {
        width: 50% !important;
    }
    
    body.portrait .periodic-table {
        grid-template-columns: repeat(6, 1fr) !important;
    }
`;

// Add the CSS to the document
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = orientationWarningCSS;
document.head.appendChild(styleSheet);

// Check orientation on load and resize
window.addEventListener('load', function() {
    checkMobileOrientation();
    showOrientationWarning();
});

window.addEventListener('resize', function() {
    checkMobileOrientation();
    showOrientationWarning();
});

window.addEventListener('orientationchange', function() {
    setTimeout(function() {
        checkMobileOrientation();
        showOrientationWarning();
        // Only recreate if needed for orientation
        createPeriodicTable();
        createCategoryLegend();
    }, 300);
});
// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', initGame);
