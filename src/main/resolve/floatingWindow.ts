import { is } from '@electron-toolkit/utils'
import { BrowserWindow, ipcMain } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { join } from 'path'
import { getAppConfig, patchAppConfig } from '../config'
import { applyTheme } from './theme'
import { buildContextMenu, showTrayIcon } from './tray'

export let floatingWindow: BrowserWindow | null = null

async function createFloatingWindow(): Promise<void> {
  try {
    const floatingWindowState = windowStateKeeper({
      file: 'floating-window-state.json'
    })
    const { customTheme = 'default.css' } = await getAppConfig()

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: 120,
      height: 42,
      x: floatingWindowState.x,
      y: floatingWindowState.y,
      show: false,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      transparent: true,
      skipTaskbar: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      closable: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        spellcheck: false,
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    }

    // windows 添加兼容性处理
    if (process.platform === 'win32') {
      windowOptions.hasShadow = false
      windowOptions.webPreferences!.offscreen = false
    }

    floatingWindow = new BrowserWindow(windowOptions)
    floatingWindowState.manage(floatingWindow)

    floatingWindow.webContents.on('render-process-gone', (_, details) => {
      console.error('Floating window render process gone:', details.reason)
      floatingWindow = null
    })

    floatingWindow.on('ready-to-show', () => {
      try {
        applyTheme(customTheme)
        floatingWindow?.show()
        floatingWindow?.setAlwaysOnTop(true, 'screen-saver')
      } catch (error) {
        console.error('Error in floating window ready-to-show:', error)
      }
    })

    floatingWindow.on('moved', () => {
      if (floatingWindow) floatingWindowState.saveState(floatingWindow)
    })
    ipcMain.on('updateFloatingWindow', () => {
      if (floatingWindow) {
        floatingWindow?.webContents.send('controledMihomoConfigUpdated')
        floatingWindow?.webContents.send('appConfigUpdated')
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      await floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/floating.html`)
    } else {
      await floatingWindow.loadFile(join(__dirname, '../renderer/floating.html'))
    }
  } catch (error) {
    console.error('Failed to create floating window:', error)
    floatingWindow = null
    throw error
  }
}

export async function showFloatingWindow(): Promise<void> {
  try {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.show()
    } else {
      await createFloatingWindow()
    }
  } catch (error) {
    console.error('Failed to show floating window:', error)
    await patchAppConfig({ showFloatingWindow: false })
    throw error
  }
}

export async function triggerFloatingWindow(): Promise<void> {
  if (floatingWindow?.isVisible()) {
    await patchAppConfig({ showFloatingWindow: false })
    await closeFloatingWindow()
  } else {
    await patchAppConfig({ showFloatingWindow: true })
    await showFloatingWindow()
  }
}

export async function closeFloatingWindow(): Promise<void> {
  if (floatingWindow) {
    floatingWindow.close()
    floatingWindow.destroy()
    floatingWindow = null
  }
  await showTrayIcon()
  await patchAppConfig({ disableTray: false })
}

export async function showContextMenu(): Promise<void> {
  const menu = await buildContextMenu()
  menu.popup()
}
