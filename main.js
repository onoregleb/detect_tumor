const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn } = require('child_process');

const store = new Store();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Brain Tumor Detector',
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');
  
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
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
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', ['detect.py', imagePath]);
    
    let result = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(error || 'Detection failed'));
        return;
      }
      try {
        resolve(JSON.parse(result));
      } catch (e) {
        reject(new Error('Invalid detection result'));
      }
    });
  });
}); 