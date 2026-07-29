const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

const PRODUCTION_URL = 'https://sheconomy.in'
const isDev = !app.isPackaged
const APP_URL =
  process.env.SHECONOMY_DESKTOP_URL || (isDev ? 'http://localhost:8081' : PRODUCTION_URL)

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'SHEconomy',
    backgroundColor: '#fef5f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.loadURL(APP_URL)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url)
      const allowed = new URL(APP_URL)
      if (target.origin !== allowed.origin) {
        event.preventDefault()
        shell.openExternal(url)
      }
    } catch {
      event.preventDefault()
    }
  })

  if (isDev) {
    win.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        if (!win.isDestroyed()) win.loadURL(APP_URL)
      }, 1500)
    })
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
