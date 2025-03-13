import { app, BrowserWindow, ipcMain } from 'electron'
import started from 'electron-squirrel-startup'
import path from 'node:path'
import { AppInfo, IPC_CHANNELS, IpcResponse } from './lib/ipc'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Set up IPC handlers
const setupIpcHandlers = () => {
  ipcMain.handle(
    IPC_CHANNELS.GET_APP_INFO,
    async (): Promise<IpcResponse<AppInfo>> => {
      try {
        const appInfo: AppInfo = {
          version: app.getVersion(),
          platform: process.platform,
          arch: process.arch,
        }
        await sleep(1000)
        return { success: true, data: appInfo }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }
  )
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false, // Security: Keep disabled
      contextIsolation: true, // Security: Keep enabled
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    )
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  setupIpcHandlers()
  createWindow()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
