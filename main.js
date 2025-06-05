const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn } = require('child_process');
const fs = require('fs');

const store = new Store();
let flaskServer = null;
let mainWindow = null;

console.log('Starting application...');
console.log('Current directory:', __dirname);
console.log('Index.html path:', path.join(__dirname, 'dist', 'index.html'));

function createWindow() {
  console.log('Creating main window...');
  
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
      },
      title: 'Brain Tumor Detector',
      icon: path.join(__dirname, 'assets/icon.png')
    });

    console.log('Window created successfully');
    console.log('Loading index.html...');
    
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Loading file from:', indexPath);
    
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('index.html not found at:', indexPath);
      dialog.showErrorBox('Error', 'Could not find index.html file. Please make sure the application is built correctly.');
      app.quit();
    }
    
    if (process.argv.includes('--dev')) {
      console.log('Opening DevTools...');
      mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
      console.error('Failed URL:', mainWindow.webContents.getURL());
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Window loaded successfully');
      console.log('Current URL:', mainWindow.webContents.getURL());
    });

    mainWindow.on('closed', () => {
      console.log('Window closed');
      mainWindow = null;
    });

    mainWindow.on('ready-to-show', () => {
      console.log('Window is ready to show');
      mainWindow.show();
    });

    mainWindow.on('show', () => {
      console.log('Window is shown');
    });

  } catch (error) {
    console.error('Error creating window:', error);
  }
}

function startFlaskServer() {
  console.log('Starting Flask server...');
  return new Promise((resolve, reject) => {
    // Kill any existing Flask server process
    if (flaskServer) {
      console.log('Killing existing Flask server...');
      flaskServer.kill();
      flaskServer = null;
    }

    // Start new Flask server
    flaskServer = spawn('python', ['server.py'], {
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    const checkReady = (data) => {
      console.log(`Flask server: ${data}`);
      if (data.toString().includes('Running on')) {
        console.log('Flask server is ready');
        resolve();
      }
    };

    flaskServer.stdout.on('data', checkReady);
    flaskServer.stderr.on('data', checkReady);

    flaskServer.on('error', (error) => {
      console.error('Flask server failed to start:', error);
      reject(error);
    });

    // Add error handling for process exit
    flaskServer.on('exit', (code, signal) => {
      console.log(`Flask server exited with code ${code} and signal ${signal}`);
      if (code !== 0) {
        reject(new Error(`Flask server exited with code ${code}`));
      }
    });
  });
}

app.on('ready', async () => {
  console.log('Electron app is ready');
  try {
    await startFlaskServer();
    console.log('Flask server started, creating window...');
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (flaskServer) {
    console.log('Killing Flask server');
    flaskServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle file selection
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'dicom'] }
    ]
  });
  return result.filePaths;
});

// Handle saving results
ipcMain.handle('save-results', async (event, results) => {
  const result = await dialog.showSaveDialog({
    title: 'Save Detection Results',
    defaultPath: path.join(app.getPath('documents'), 'detection-results.json'),
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  
  if (!result.canceled) {
    store.set('lastResults', results);
    return result.filePath;
  }
  return null;
});

// Handle tumor detection
ipcMain.handle('detect-tumor', async (event, imagePath) => {
  try {
    // Check if file exists and is readable
    if (!fs.existsSync(imagePath)) {
      throw new Error('Image file does not exist');
    }

    // Check if Flask server is running and restart if needed
    let serverRunning = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (!serverRunning && retryCount < maxRetries) {
      try {
        const serverCheck = await fetch('http://127.0.0.1:5000/api/health', { 
          timeout: 5000,
          headers: {
            'Accept': 'application/json'
          }
        });
        if (serverCheck.ok) {
          serverRunning = true;
        } else {
          throw new Error('Server responded with error');
        }
      } catch (error) {
        console.log(`Server check attempt ${retryCount + 1} failed:`, error);
        if (flaskServer) {
          flaskServer.kill();
        }
        await startFlaskServer();
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }
    }

    if (!serverRunning) {
      throw new Error('Failed to start Flask server after multiple attempts');
    }

    // Read and validate image
    const imageBuffer = fs.readFileSync(imagePath);
    if (imageBuffer.length === 0) {
      throw new Error('Image file is empty');
    }

    const base64Image = imageBuffer.toString('base64');
    
    const response = await fetch('http://127.0.0.1:5000/api/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Image}` }),
      timeout: 60000, // Increased timeout to 60 seconds
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${errorText}`);
    }

    const result = await response.json();
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from server');
    }

    return result;
  } catch (error) {
    console.error('Detection error:', error);
    throw new Error('Failed to process image: ' + error.message);
  }
}); 