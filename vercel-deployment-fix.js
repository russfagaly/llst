// === STEP 1: Create vercel.json in project root ===
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "build" }
    }
  ],
  "routes": [
    { "handle": "filesystem" },
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}

// === STEP 2: Update package.json with correct scripts ===
// package.json (partial)
{
  "name": "little-league-stats-tracker",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.14.0",
    "chart.js": "^4.3.0",
    "react-chartjs-2": "^5.2.0",
    "tesseract.js": "^4.1.1"
    // Note: remove server-side only dependencies like chokidar
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}

// === STEP 3: Modify the app to work without backend file watching ===
// Replace fileWatcherService.js with a stub (since it won't work on Vercel)
// src/services/fileWatcherService.js
export const startFileWatcher = (folderPath) => {
  console.log('File watching is not available in the web version');
  return null;
};

export const stopFileWatcher = () => {
  console.log('File watching is not available in the web version');
};

// === STEP 4: Update databaseService.js to use localStorage ===
// src/services/databaseService.js
// Switch from in-memory arrays to localStorage for persistence

// Initialize the database
export const initDatabase = async () => {
  console.log('Initializing database...');
  
  // Check if we already have data in localStorage
  if (!localStorage.getItem('games')) {
    console.log('Adding sample data...');
    
    // Sample teams
    const teams = [
      { id: 1, name: 'Tigers' },
      { id: 2, name: 'Eagles' },
      { id: 3, name: 'Sharks' },
      { id: 4, name: 'Hawks' }
    ];
    
    // Sample games
    const games = [
      { 
        id: 1, 
        date: new Date(2024, 4, 15).toISOString(), 
        awayTeam: 'Tigers', 
        homeTeam: 'Eagles',
        awayScore: 5,
        homeScore: 3,
        venue: 'Main Field',
        processed: true
      },
      { 
        id: 2, 
        date: new Date(2024, 4, 16).toISOString(), 
        awayTeam: 'Sharks', 
        homeTeam: 'Hawks',
        awayScore: 2,
        homeScore: 7,
        venue: 'East Field',
        processed: true
      }
    ];
    
    // Sample player statistics
    const players = [
      // Game 1 players
      { id: 1, name: 'Alex Smith', team: 'Tigers', gameId: 1, at_bats: 4, hits: 2, runs: 1, rbi: 2, doubles: 1, triples: 0, home_runs: 0, stolen_bases: 1, batting_avg: 0.500 },
      { id: 2, name: 'Jordan Lee', team: 'Tigers', gameId: 1, at_bats: 3, hits: 1, runs: 1, rbi: 0, doubles: 0, triples: 0, home_runs: 0, stolen_bases: 2, batting_avg: 0.333 },
      { id: 3, name: 'Casey Jones', team: 'Eagles', gameId: 1, at_bats: 4, hits: 2, runs: 1, rbi: 1, doubles: 1, triples: 0, home_runs: 0, stolen_bases: 0, batting_avg: 0.500 },
      { id: 4, name: 'Riley Wong', team: 'Eagles', gameId: 1, at_bats: 3, hits: 0, runs: 0, rbi: 0, doubles: 0, triples: 0, home_runs: 0, stolen_bases: 0, batting_avg: 0.000 },
      
      // Game 2 players
      { id: 5, name: 'Taylor Reed', team: 'Sharks', gameId: 2, at_bats: 4, hits: 1, runs: 1, rbi: 1, doubles: 0, triples: 0, home_runs: 1, stolen_bases: 0, batting_avg: 0.250 },
      { id: 6, name: 'Morgan Chen', team: 'Sharks', gameId: 2, at_bats: 3, hits: 0, runs: 0, rbi: 0, doubles: 0, triples: 0, home_runs: 0, stolen_bases: 0, batting_avg: 0.000 },
      { id: 7, name: 'Jamie Garcia', team: 'Hawks', gameId: 2, at_bats: 4, hits: 3, runs: 2, rbi: 3, doubles: 1, triples: 0, home_runs: 1, stolen_bases: 0, batting_avg: 0.750 },
      { id: 8, name: 'Dakota Kim', team: 'Hawks', gameId: 2, at_bats: 3, hits: 2, runs: 1, rbi: 1, doubles: 0, triples: 1, home_runs: 0, stolen_bases: 1, batting_avg: 0.667 }
    ];
    
    // Store in localStorage
    localStorage.setItem('teams', JSON.stringify(teams));
    localStorage.setItem('games', JSON.stringify(games));
    localStorage.setItem('players', JSON.stringify(players));
  }
  
  console.log('Database initialized');
  return true;
};

// Get recent games
export const getRecentGames = async (limit = 5) => {
  const gamesData = JSON.parse(localStorage.getItem('games') || '[]');
  
  // Sort by date descending
  const sortedGames = gamesData.sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  return sortedGames.slice(0, limit);
};

// Save a new game
export const saveGame = async (gameData) => {
  const gamesData = JSON.parse(localStorage.getItem('games') || '[]');
  const gameId = gamesData.length > 0 
    ? Math.max(...gamesData.map(g => g.id)) + 1 
    : 1;
  
  const newGame = {
    id: gameId,
    ...gameData,
    date: new Date(gameData.date).toISOString()
  };
  
  gamesData.push(newGame);
  localStorage.setItem('games', JSON.stringify(gamesData));
  
  console.log(`Game saved with ID: ${gameId}`);
  return gameId;
};

// Save player statistics
export const savePlayers = async (playersData, gameId) => {
  const playersStorage = JSON.parse(localStorage.getItem('players') || '[]');
  
  const newPlayers = playersData.map((player, index) => {
    const playerId = playersStorage.length > 0 
      ? Math.max(...playersStorage.map(p => p.id)) + index + 1 
      : index + 1;
    
    return {
      id: playerId,
      ...player,
      gameId
    };
  });
  
  playersStorage.push(...newPlayers);
  localStorage.setItem('players', JSON.stringify(playersStorage));
  
  console.log(`Saved ${newPlayers.length} player statistics`);
  return newPlayers.map(p => p.id);
};

// Get statistical leaders 
export const getStatsLeaders = async (category, limit = 10) => {
  const playersData = JSON.parse(localStorage.getItem('players') || '[]');
  
  // Group players by name and team
  const playerGroups = {};
  
  playersData.forEach(player => {
    const key = `${player.name}_${player.team}`;
    
    if (!playerGroups[key]) {
      playerGroups[key] = {
        id: player.id,
        name: player.name,
        team: player.team,
        games: 0,
        at_bats: 0,
        hits: 0,
        runs: 0,
        rbi: 0,
        doubles: 0,
        triples: 0,
        home_runs: 0,
        stolen_bases: 0
      };
    }
    
    const group = playerGroups[key];
    group.games++;
    group.at_bats += player.at_bats;
    group.hits += player.hits;
    group.runs += player.runs;
    group.rbi += player.rbi;
    group.doubles += player.doubles;
    group.triples += player.triples;
    group.home_runs += player.home_runs;
    group.stolen_bases += player.stolen_bases;
  });
  
  // Rest of the function remains the same...
  const playerStats = Object.values(playerGroups).map(player => {
    return {
      ...player,
      batting_avg: player.at_bats > 0 ? player.hits / player.at_bats : 0,
      on_base_pct: 0.33, // Simplified calculation
      slugging_pct: player.at_bats > 0 ? 
        (player.hits + player.doubles + 2 * player.triples + 3 * player.home_runs) / player.at_bats : 0
    };
  });
  
  // Sort by the requested category
  let sortedPlayers;
  
  switch (category) {
    case 'batting_avg':
      sortedPlayers = playerStats
        .filter(p => p.at_bats >= 10) // Minimum at-bats qualifier
        .sort((a, b) => b.batting_avg - a.batting_avg);
      break;
    case 'home_runs':
      sortedPlayers = playerStats.sort((a, b) => b.home_runs - a.home_runs);
      break;
    case 'rbi':
      sortedPlayers = playerStats.sort((a, b) => b.rbi - a.rbi);
      break;
    case 'runs':
      sortedPlayers = playerStats.sort((a, b) => b.runs - a.runs);
      break;
    case 'stolen_bases':
      sortedPlayers = playerStats.sort((a, b) => b.stolen_bases - a.stolen_bases);
      break;
    // Add more categories as needed
    default:
      sortedPlayers = playerStats.sort((a, b) => b.batting_avg - a.batting_avg);
  }
  
  // Format the return values
  return sortedPlayers.slice(0, limit).map(player => {
    let value;
    
    switch (category) {
      case 'batting_avg':
        value = player.batting_avg.toFixed(3);
        break;
      case 'era':
        value = 0.00; // Not calculated in this demo
        break;
      default:
        value = player[category];
    }
    
    return {
      id: player.id,
      name: player.name,
      team: player.team,
      value
    };
  });
};

// === STEP 5: Update the Dashboard.js file to disable file watching UI ===
// src/components/Dashboard.js (partial)
function Dashboard({
  isDbInitialized,
  isWatcherRunning,
  watchFolder,
  setWatchFolder,
  onStartWatcher,
  onStopWatcher
}) {
  const [recentGames, setRecentGames] = useState([]);
  
  useEffect(() => {
    if (isDbInitialized) {
      loadRecentGames();
    }
    
    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(() => {
      if (isDbInitialized) {
        loadRecentGames();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isDbInitialized]);
  
  const loadRecentGames = async () => {
    const games = await getRecentGames(5);
    setRecentGames(games);
  };
  
  return (
    <div className="dashboard">
      <section className="status-section">
        <h2>System Status</h2>
        <div className="status-indicators">
          <div className="status-item">
            <span className="status-label">Database:</span>
            <span className={`status-value ${isDbInitialized ? 'active' : 'inactive'}`}>
              {isDbInitialized ? 'Connected' : 'Initializing...'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Vercel Mode:</span>
            <span className="status-value active">
              Active (File watching disabled)
            </span>
          </div>
        </div>
      </section>
      
      <section className="note-section">
        <div className="note-box">
          <h3>Web Deployment Note</h3>
          <p>
            This application is running in web mode. Automatic file watching is disabled.
            Please use the Upload Box Score page to manually upload box score images.
          </p>
        </div>
      </section>
      
      <section className="recent-games">
        <h2>Recently Added Games</h2>
        {recentGames.length > 0 ? (
          <table className="games-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Teams</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map(game => (
                <tr key={game.id}>
                  <td>{new Date(game.date).toLocaleDateString()}</td>
                  <td>{game.awayTeam} @ {game.homeTeam}</td>
                  <td>{game.awayScore} - {game.homeScore}</td>
                  <td>{game.processed ? 'Processed' : 'Pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">No games have been added yet.</p>
        )}
      </section>
    </div>
  );
}

// === STEP 6: Update the FileUploader.js to focus on web upload ===
// src/components/FileUploader.js
import React, { useState } from 'react';
import { processImage } from '../services/ocrService';
import './FileUploader.css';

function FileUploader() {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  
  const handleFileSelect = (e) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray);
    }
  };
  
  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadResults([]);
    
    const results = [];
    
    for (const file of files) {
      try {
        // Process the image with OCR
        const result = await processImage(file);
        
        results.push({
          fileName: file.name,
          success: true,
          message: `Successfully processed: ${result.summary}`
        });
      } catch (error) {
        results.push({
          fileName: file.name,
          success: false,
          message: `Error: ${error.message}`
        });
      }
    }
    
    setUploadResults(results);
    setIsUploading(false);
  };
  
  return (
    <div className="file-uploader">
      <h2>Upload Box Score Images</h2>
      
      <div className="info-box">
        <h3>Web Upload Instructions</h3>
        <p>
          Since this app is running on Vercel, please manually upload your box score images here.
          The app will process them using browser-based OCR and add them to the database.
        </p>
      </div>
      
      <div className="upload-area">
        <div 
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) {
              const fileArray = Array.from(e.dataTransfer.files);
              setFiles(fileArray);
            }
          }}
        >
          <p>Drag & drop box score images here</p>
          <p>or</p>
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            onChange={handleFileSelect} 
            id="file-input"
            hidden
          />
          <label htmlFor="file-input" className="file-input-label">
            Select Files
          </label>
        </div>
        
        {files.length > 0 && (
          <div className="selected-files">
            <h3>Selected Files ({files.length})</h3>
            <ul>
              {files.map((file, index) => (
                <li key={index}>
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </li>
              ))}
            </ul>
            
            <button 
              className="upload-button"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? 'Processing...' : 'Process Selected Files'}
            </button>
          </div>
        )}
      </div>
      
      {uploadResults.length > 0 && (
        <div className="upload-results">
          <h3>Processing Results</h3>
          <ul>
            {uploadResults.map((result, index) => (
              <li 
                key={index}
                className={result.success ? 'success' : 'error'}
              >
                <strong>{result.fileName}</strong>: {result.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default FileUploader;
