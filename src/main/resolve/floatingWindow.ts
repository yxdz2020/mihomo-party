import { is } from '@electron-toolkit/utils'
import { BrowserWindow, ipcMain } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { join } from 'path'
import { getAppConfig, patchAppConfig } from '../config'
import { applyTheme } from './theme'
import { buildContextMenu, showTrayIcon } from './tray'
import { writeFile } from 'fs/promises'
import { logDir } from '../utils/dirs'
import path from 'path'

export let floatingWindow: BrowserWindow | null = null

// 悬浮窗日志记录
async function logFloatingWindow(message: string, error?: any): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    const logMessage = error
      ? `[${timestamp}] [FloatingWindow] ${message}: ${error}\n`
      : `[${timestamp}] [FloatingWindow] ${message}\n`

    const logPath = path.join(logDir(), 'floating-window.log')
    await writeFile(logPath, logMessage, { flag: 'a' })

    if (error) {
      console.error(`[FloatingWindow] ${message}:`, error)
    } else {
      console.log(`[FloatingWindow] ${message}`)
    }
  } catch (logError) {

    console.error('[FloatingWindow] Failed to write log:', logError)
    console.log(`[FloatingWindow] Original message: ${message}`, error)
  }
}

async function createFloatingWindow(): Promise<void> {
  try {
    await logFloatingWindow('Starting to create floating window...')
    const floatingWindowState = windowStateKeeper({
      file: 'floating-window-state.json'
    })
    await logFloatingWindow('Window state keeper initialized')
    const { customTheme = 'default.css' } = await getAppConfig()
    await logFloatingWindow(`App config loaded, theme: ${customTheme}`)

    const safeMode = process.env.FLOATING_SAFE_MODE === 'true'
    await logFloatingWindow(`Safe mode: ${safeMode}`)

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: 120,
      height: 42,
      x: floatingWindowState.x,
      y: floatingWindowState.y,
      show: false,
      frame: safeMode ? true : false,
      alwaysOnTop: !safeMode,
      resizable: safeMode,
      transparent: !safeMode,
      skipTaskbar: !safeMode,
      minimizable: safeMode,
      maximizable: safeMode,
      fullscreenable: false,
      closable: safeMode,
      backgroundColor: safeMode ? '#ffffff' : '#00000000',
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
      windowOptions.hasShadow = !safeMode
      windowOptions.webPreferences!.offscreen = false
    }

    await logFloatingWindow(`Creating BrowserWindow with options: ${JSON.stringify(windowOptions, null, 2)}`)
    floatingWindow = new BrowserWindow(windowOptions)
    await logFloatingWindow('BrowserWindow created successfully')
    floatingWindowState.manage(floatingWindow)
    await logFloatingWindow('Window state management attached')

    floatingWindow.webContents.on('render-process-gone', async (_, details) => {
      await logFloatingWindow('Render process gone', details.reason)
      floatingWindow = null
    })

    floatingWindow.on('ready-to-show', async () => {
      try {
        await logFloatingWindow('Window ready to show, applying theme...')
        applyTheme(customTheme)
        await logFloatingWindow('Theme applied, showing window...')
        floatingWindow?.show()
        await logFloatingWindow('Window shown, setting always on top...')
        floatingWindow?.setAlwaysOnTop(true, 'screen-saver')
        await logFloatingWindow('Floating window setup completed successfully')
      } catch (error) {
        await logFloatingWindow('Error in ready-to-show', error)
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

    await logFloatingWindow('Loading page...')
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const devUrl = `${process.env['ELECTRON_RENDERER_URL']}/floating.html`
      await logFloatingWindow(`Loading dev URL: ${devUrl}`)
      await floatingWindow.loadURL(devUrl)
    } else {
      const filePath = join(__dirname, '../renderer/floating.html')
      await logFloatingWindow(`Loading file: ${filePath}`)
      await floatingWindow.loadFile(filePath)
    }
    await logFloatingWindow('Page loaded successfully')
  } catch (error) {
    await logFloatingWindow('Failed to create floating window', error)
    if (error instanceof Error) {
      await logFloatingWindow(`Error stack: ${error.stack}`)
    }
    floatingWindow = null
    throw error
  }
}

export async function showFloatingWindow(): Promise<void> {
  try {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      await logFloatingWindow('Showing existing floating window')
      floatingWindow.show()
    } else {
      await logFloatingWindow('Creating new floating window')
      await createFloatingWindow()
    }
  } catch (error) {
    await logFloatingWindow('Failed to show floating window', error)
    await patchAppConfig({ showFloatingWindow: false })
    await logFloatingWindow('Disabled floating window in config due to error')
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
