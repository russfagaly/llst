// Little League Stats Tracker
// This application monitors a folder for box score screenshots,
// extracts data using OCR, updates a database, and displays statistics.

// File Structure:
// - src/
//   - components/
//     - Dashboard.js
//     - StatsLeaders.js
//     - FileUploader.js
//   - services/
//     - ocrService.js
//     - databaseService.js
//     - fileWatcherService.js
//     - parserService.js
//   - models/
//     - Player.js
//     - Team.js
//     - Game.js
//   - App.js
//   - index.js

// Dependencies to install:
// npm install react react-dom react-router-dom tesseract.js chokidar sqlite3 chart.js

// ===============================
// src/index.js
// ===============================
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// ===============================
// src/App.js
// ===============================
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import StatsLeaders from './components/StatsLeaders';
import FileUploader from './components/FileUploader';
import { initDatabase } from './services/databaseService';
import { startFileWatcher } from './services/fileWatcherService';
import './App.css';

function App() {
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [isWatcherRunning, setIsWatcherRunning] = useState(false);
  const [watchFolder, setWatchFolder] = useState('./uploads');
  
  useEffect(() => {
    // Initialize database on app start
    const initApp = async () => {
      await initDatabase();
      setIsDbInitialized(true);
    };
    
    initApp();
  }, []);
  
  const handleStartWatcher = () => {
    startFileWatcher(watchFolder);
    setIsWatcherRunning(true);
  };
  
  const handleStopWatcher = () => {
    // Code to stop watcher would go here
    setIsWatcherRunning(false);
  };
  
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <h1>Little League Stats Tracker</h1>
          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/stats">Stats Leaders</Link>
            <Link to="/upload">Upload Box Score</Link>
          </nav>
        </header>
        
        <main className="app-content">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                isDbInitialized={isDbInitialized} 
                isWatcherRunning={isWatcherRunning}
                watchFolder={watchFolder}
                setWatchFolder={setWatchFolder}
                onStartWatcher={handleStartWatcher}
                onStopWatcher={handleStopWatcher}
              />
            } />
            <Route path="/stats" element={<StatsLeaders />} />
            <Route path="/upload" element={<FileUploader />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

// ===============================
// src/components/Dashboard.js
// ===============================
import React, { useState, useEffect } from 'react';
import { getRecentGames } from '../services/databaseService';
import './Dashboard.css';

function Dashboard({ 
  isDbInitialized, 
  isWatcherRunning,
  watchFolder,
  setWatchFolder,
  onStartWatcher,
  onStopWatcher
}) {
  const [recentGames, setRecentGames] = useState([]);
  const [processingCount, setProcessingCount] = useState(0);
  
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
            <span className="status-label">File Watcher:</span>
            <span className={`status-value ${isWatcherRunning ? 'active' : 'inactive'}`}>
              {isWatcherRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Processing Queue:</span>
            <span className="status-value">{processingCount} items</span>
          </div>
        </div>
      </section>
      
      <section className="watcher-config">
        <h2>File Watcher Configuration</h2>
        <div className="watcher-controls">
          <div className="form-group">
            <label>Watch Folder:</label>
            <input 
              type="text" 
              value={watchFolder}
              onChange={(e) => setWatchFolder(e.target.value)}
              disabled={isWatcherRunning}
            />
          </div>
          <div className="button-group">
            {!isWatcherRunning ? (
              <button 
                className="start-button"
                onClick={onStartWatcher}
                disabled={!isDbInitialized}
              >
                Start Watcher
              </button>
            ) : (
              <button 
                className="stop-button"
                onClick={onStopWatcher}
              >
                Stop Watcher
              </button>
            )}
          </div>
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

export default Dashboard;

// ===============================
// src/components/StatsLeaders.js
// ===============================
import React, { useState, useEffect } from 'react';
import { getStatsLeaders } from '../services/databaseService';
import { Bar } from 'react-chartjs-2';
import './StatsLeaders.css';

function StatsLeaders() {
  const [category, setCategory] = useState('batting_avg');
  const [leaders, setLeaders] = useState([]);
  const [chartData, setChartData] = useState(null);
  
  const categories = [
    { id: 'batting_avg', name: 'Batting Average' },
    { id: 'home_runs', name: 'Home Runs' },
    { id: 'rbi', name: 'RBIs' },
    { id: 'runs', name: 'Runs Scored' },
    { id: 'stolen_bases', name: 'Stolen Bases' },
    { id: 'wins', name: 'Pitcher Wins' },
    { id: 'strikeouts', name: 'Pitcher Strikeouts' },
    { id: 'era', name: 'ERA' },
  ];
  
  useEffect(() => {
    loadLeaders();
  }, [category]);
  
  const loadLeaders = async () => {
    const data = await getStatsLeaders(category, 10);
    setLeaders(data);
    
    // Prepare chart data
    setChartData({
      labels: data.map(player => player.name),
      datasets: [
        {
          label: getCategoryLabel(category),
          data: data.map(player => player.value),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    });
  };
  
  const getCategoryLabel = (cat) => {
    const found = categories.find(c => c.id === cat);
    return found ? found.name : cat;
  };
  
  return (
    <div className="stats-leaders">
      <h2>Statistical Leaders</h2>
      
      <div className="category-selector">
        <label>Select Category:</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>
      
      <div className="leaders-display">
        <div className="leaders-chart">
          {chartData && (
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
              height={300}
            />
          )}
        </div>
        
        <div className="leaders-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Team</th>
                <th>{getCategoryLabel(category)}</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((player, index) => (
                <tr key={player.id}>
                  <td>{index + 1}</td>
                  <td>{player.name}</td>
                  <td>{player.team}</td>
                  <td>{player.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StatsLeaders;

// ===============================
// src/components/FileUploader.js
// ===============================
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

// ===============================
// src/services/ocrService.js
// ===============================
import Tesseract from 'tesseract.js';
import { parseBoxScore } from './parserService';
import { saveGame, savePlayers } from './databaseService';

// Process image with OCR and save results to database
export const processImage = async (file) => {
  // Show progress in console
  console.log(`Starting OCR processing for ${file.name}...`);
  
  // Use Tesseract.js for OCR
  const result = await Tesseract.recognize(
    file,
    'eng',
    { 
      logger: progress => {
        if (progress.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(progress.progress * 100)}%`);
        }
      }
    }
  );
  
  const text = result.data.text;
  
  // Parse the extracted text into structured data
  console.log('OCR completed. Parsing box score...');
  const parsedData = parseBoxScore(text);
  
  // Save the parsed data to the database
  console.log('Saving parsed data to database...');
  const gameId = await saveGame(parsedData.game);
  await savePlayers(parsedData.players, gameId);
  
  return {
    success: true,
    summary: `${parsedData.game.awayTeam} ${parsedData.game.awayScore} @ ${parsedData.game.homeTeam} ${parsedData.game.homeScore}`,
    gameId
  };
};

// Process image file on disk
export const processImageFile = async (filePath) => {
  console.log(`Processing image file: ${filePath}`);
  
  // Use Tesseract.js for OCR
  const result = await Tesseract.recognize(
    filePath,
    'eng',
    { logger: progress => console.log('OCR Progress:', progress) }
  );
  
  const text = result.data.text;
  
  // Parse the extracted text into structured data
  const parsedData = parseBoxScore(text);
  
  // Save the parsed data to the database
  const gameId = await saveGame(parsedData.game);
  await savePlayers(parsedData.players, gameId);
  
  return {
    success: true,
    summary: `${parsedData.game.awayTeam} ${parsedData.game.awayScore} @ ${parsedData.game.homeTeam} ${parsedData.game.homeScore}`,
    gameId
  };
};

// ===============================
// src/services/fileWatcherService.js
// ===============================
import chokidar from 'chokidar';
import path from 'path';
import { processImageFile } from './ocrService';

let watcher = null;

export const startFileWatcher = (folderPath) => {
  console.log(`Starting file watcher on folder: ${folderPath}`);
  
  // Create watcher
  watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    awaitWriteFinish: true, // wait until the file is fully written
  });
  
  // Add event listeners
  watcher
    .on('add', handleNewFile)
    .on('error', error => console.error(`Watcher error: ${error}`));
  
  return watcher;
};

export const stopFileWatcher = () => {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log('File watcher stopped');
  }
};

const handleNewFile = async (filePath) => {
  console.log(`New file detected: ${filePath}`);
  
  // Check if it's an image file
  const ext = path.extname(filePath).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
  
  if (imageExts.includes(ext)) {
    try {
      console.log(`Processing image: ${filePath}`);
      const result = await processImageFile(filePath);
      console.log(`Image processed successfully: ${result.summary}`);
    } catch (error) {
      console.error(`Error processing image ${filePath}:`, error);
    }
  } else {
    console.log(`Ignoring non-image file: ${filePath}`);
  }
};

// ===============================
// src/services/parserService.js
// ===============================
// This service parses OCR text into structured data

export const parseBoxScore = (text) => {
  console.log('Parsing box score text...');
  
  // Real implementation would be more complex and use regex patterns
  // to extract team names, scores, and player statistics
  
  // For demo purposes, we'll use a simplified parser that looks for 
  // common patterns in baseball box scores
  
  // Extract game information
  const gameInfo = extractGameInfo(text);
  
  // Extract player statistics
  const players = extractPlayerStats(text, gameInfo);
  
  return {
    game: gameInfo,
    players: players
  };
};

const extractGameInfo = (text) => {
  // In a real implementation, this would use regex to find:
  // - Team names
  // - Final score
  // - Game date
  // - Venue
  
  // Simplified example:
  const lines = text.split('\n');
  let awayTeam = 'Unknown Team';
  let homeTeam = 'Unknown Team';
  let awayScore = 0;
  let homeScore = 0;
  let gameDate = new Date();
  
  // Look for team names and scores
  // This is simplified and would need to be adapted for real box score formats
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Try to extract team names
    if (line.includes('vs') || line.includes('at')) {
      const parts = line.split(/vs|at/);
      if (parts.length >= 2) {
        awayTeam = parts[0].trim();
        homeTeam = parts[1].trim();
      }
    }
    
    // Try to extract score
    const scoreRegex = /(\d+)\s*-\s*(\d+)/;
    const scoreMatch = line.match(scoreRegex);
    if (scoreMatch) {
      awayScore = parseInt(scoreMatch[1]);
      homeScore = parseInt(scoreMatch[2]);
    }
    
    // Try to extract date
    const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]);
      const day = parseInt(dateMatch[2]);
      const year = parseInt(dateMatch[3]);
      gameDate = new Date(year < 100 ? year + 2000 : year, month - 1, day);
    }
  }
  
  return {
    awayTeam,
    homeTeam,
    awayScore,
    homeScore,
    date: gameDate,
    venue: 'Unknown Venue', // Would be extracted in a real implementation
    processed: true
  };
};

const extractPlayerStats = (text, gameInfo) => {
  // In a real implementation, this would:
  // - Identify batting statistics tables
  // - Extract player names and stats
  // - Parse pitching statistics
  
  // Simplified example:
  const players = [];
  const lines = text.split('\n');
  let currentTeam = null;
  
  // Patterns to look for in boxscore
  const playerLineRegex = /^([A-Za-z\s.'-]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line indicates a team's batting statistics
    if (line.includes('Batting') || line.includes('BATTING')) {
      // Determine which team we're looking at
      if (line.includes(gameInfo.awayTeam) || 
          (i > 0 && lines[i-1].includes(gameInfo.awayTeam))) {
        currentTeam = gameInfo.awayTeam;
      } else if (line.includes(gameInfo.homeTeam) || 
                (i > 0 && lines[i-1].includes(gameInfo.homeTeam))) {
        currentTeam = gameInfo.homeTeam;
      }
      continue;
    }
    
    // Try to match player statistics
    const match = line.match(playerLineRegex);
    if (match && currentTeam) {
      const [_, playerName, ab, hits, runs, rbi] = match;
      
      players.push({
        name: playerName.trim(),
        team: currentTeam,
        at_bats: parseInt(ab),
        hits: parseInt(hits),
        runs: parseInt(runs),
        rbi: parseInt(rbi),
        // More statistics would be included in a real implementation
        doubles: 0,
        triples: 0,
        home_runs: 0,
        stolen_bases: 0,
        batting_avg: parseInt(hits) / parseInt(ab)
      });
    }
  }
  
  return players;
};

// ===============================
// src/services/databaseService.js
// ===============================
// This is a simplified database service for demo purposes
// In a production app, you'd use a real database like SQLite, PostgreSQL, etc.

// Simulated database tables
let games = [];
let players = [];
let teams = [];

// Initialize the database
export const initDatabase = async () => {
  console.log('Initializing database...');
  
  // In a real app, this would create tables if they don't exist
  // For this demo, we'll just use in-memory arrays
  
  // Add some sample data if empty
  if (games.length === 0) {
    console.log('Adding sample data...');
    
    // Sample teams
    teams = [
      { id: 1, name: 'Tigers' },
      { id: 2, name: 'Eagles' },
      { id: 3, name: 'Sharks' },
      { id: 4, name: 'Hawks' }
    ];
    
    // Sample games
    games = [
      { 
        id: 1, 
        date: new Date(2024, 4, 15), 
        awayTeam: 'Tigers', 
        homeTeam: 'Eagles',
        awayScore: 5,
        homeScore: 3,
        venue: 'Main Field',
        processed: true
      },
      { 
        id: 2, 
        date: new Date(2024, 4, 16), 
        awayTeam: 'Sharks', 
        homeTeam: 'Hawks',
        awayScore: 2,
        homeScore: 7,
        venue: 'East Field',
        processed: true
      }
    ];
    
    // Sample player statistics
    players = [
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
  }
  
  console.log('Database initialized with sample data');
  return true;
};

// Get recent games
export const getRecentGames = async (limit = 5) => {
  // Sort by date descending
  const sortedGames = [...games].sort((a, b) => b.date - a.date);
  return sortedGames.slice(0, limit);
};

// Save a new game
export const saveGame = async (gameData) => {
  const gameId = games.length > 0 ? Math.max(...games.map(g => g.id)) + 1 : 1;
  
  const newGame = {
    id: gameId,
    ...gameData,
    date: new Date(gameData.date)
  };
  
  games.push(newGame);
  console.log(`Game saved with ID: ${gameId}`);
  
  return gameId;
};

// Save player statistics
export const savePlayers = async (playersData, gameId) => {
  const newPlayers = playersData.map((player, index) => {
    const playerId = players.length > 0 ? Math.max(...players.map(p => p.id)) + index + 1 : index + 1;
    
    return {
      id: playerId,
      ...player,
      gameId
    };
  });
  
  players.push(...newPlayers);
  console.log(`Saved ${newPlayers.length} player statistics`);
  
  return newPlayers.map(p => p.id);
};

// Get statistical leaders
export const getStatsLeaders = async (category, limit = 10) => {
  // This is where aggregation would happen in a real database
  // For this demo, we'll manually calculate season totals
  
  // Group players by name and team
  const playerGroups = {};
  
  players.forEach(player => {
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
  
  // Calculate derived statistics
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

// ===============================
// CSS Files
// ===============================

// App.css, Dashboard.css, StatsLeaders.css, and FileUploader.css
// would be implemented to style the components properly
