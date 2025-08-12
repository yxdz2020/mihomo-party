import { is } from '@electron-toolkit/utils'
import { BrowserWindow, ipcMain } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { join } from 'path'
import { getAppConfig, patchAppConfig } from '../config'
import { applyTheme } from './theme'
import { buildContextMenu, showTrayIcon } from './tray'
import { floatingWindowLogger } from '../utils/logger'

export let floatingWindow: BrowserWindow | null = null

// 悬浮窗日志记录 - 使用统一的日志工具
async function logFloatingWindow(message: string, error?: any): Promise<void> {
  await floatingWindowLogger.log(message, error)
}

async function createFloatingWindow(): Promise<void> {
  try {
    await logFloatingWindow('Starting to create floating window...')
    const floatingWindowState = windowStateKeeper({
      file: 'floating-window-state.json'
    })
    await logFloatingWindow('Window state keeper initialized')
    const { customTheme = 'default.css', floatingWindowCompatMode = true } = await getAppConfig()
    await logFloatingWindow(`App config loaded, theme: ${customTheme}, compatMode: ${floatingWindowCompatMode}`)

    const safeMode = process.env.FLOATING_SAFE_MODE === 'true'
    const forceWin10Mode = process.env.FLOATING_WIN10_MODE === 'true'
    const useCompatMode = floatingWindowCompatMode || forceWin10Mode || safeMode

    await logFloatingWindow(`Safe mode: ${safeMode}`)
    await logFloatingWindow(`Force Win10 mode: ${forceWin10Mode}`)
    await logFloatingWindow(`Compat mode from config: ${floatingWindowCompatMode}`)
    await logFloatingWindow(`Platform: ${process.platform}, System version: ${process.getSystemVersion()}`)
    await logFloatingWindow(`Using compatibility mode: ${useCompatMode}`)

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: 120,
      height: 42,
      x: floatingWindowState.x,
      y: floatingWindowState.y,
      show: false,
      frame: safeMode ? true : false,
      alwaysOnTop: !safeMode,
      resizable: safeMode,
      transparent: !safeMode && !useCompatMode, // 兼容模式下禁用透明
      skipTaskbar: !safeMode,
      minimizable: safeMode,
      maximizable: safeMode,
      fullscreenable: false,
      closable: safeMode,
      backgroundColor: safeMode ? '#ffffff' : (useCompatMode ? '#f0f0f0' : '#00000000'), // 兼容模式使用浅灰色
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

    try {
      floatingWindow = new BrowserWindow(windowOptions)
      await logFloatingWindow('BrowserWindow created successfully')
    } catch (error) {
      await logFloatingWindow('Failed to create BrowserWindow', error)
      throw error
    }

    try {
      await logFloatingWindow('Attaching window state management...')
      floatingWindowState.manage(floatingWindow)
      await logFloatingWindow('Window state management attached')
    } catch (error) {
      await logFloatingWindow('Failed to attach window state management', error)
      throw error
    }

    await logFloatingWindow('Setting up event listeners...')

    try {
      await logFloatingWindow('Adding render-process-gone listener...')
      floatingWindow.webContents.on('render-process-gone', async (_, details) => {
        await logFloatingWindow('Render process gone', details.reason)
        floatingWindow = null
      })
      await logFloatingWindow('Render-process-gone listener added')
    } catch (error) {
      await logFloatingWindow('Failed to add render-process-gone listener', error)
      throw error
    }

    await logFloatingWindow('Adding ready-to-show listener...')
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
    await logFloatingWindow('Ready-to-show listener added')

    await logFloatingWindow('Adding moved listener...')
    floatingWindow.on('moved', () => {
      if (floatingWindow) floatingWindowState.saveState(floatingWindow)
    })
    await logFloatingWindow('Moved listener added')
    await logFloatingWindow('Adding IPC listener...')
    ipcMain.on('updateFloatingWindow', () => {
      if (floatingWindow) {
        floatingWindow?.webContents.send('controledMihomoConfigUpdated')
        floatingWindow?.webContents.send('appConfigUpdated')
      }
    })
    await logFloatingWindow('IPC listener added')

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

    // 如果已经是兼容模式还是崩溃，说明问题很严重，自动禁用悬浮窗
    const { floatingWindowCompatMode = true } = await getAppConfig()
    if (floatingWindowCompatMode) {
      await logFloatingWindow('Compatibility mode was already enabled, disabling floating window completely')
      await patchAppConfig({ showFloatingWindow: false })
    } else {
      await logFloatingWindow('Enabling compatibility mode and retrying')
      await patchAppConfig({ floatingWindowCompatMode: true })
    }

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
