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
    flaskServer = spawn('python', ['server.py']);

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
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const response = await fetch('http://localhost:5000/api/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Image}` }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Detection error:', error);
    throw new Error('Failed to process image: ' + error.message);
  }
}); 