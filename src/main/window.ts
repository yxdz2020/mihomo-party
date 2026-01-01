import { BrowserWindow, Menu, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import windowStateKeeper from 'electron-window-state'
import { join } from 'path'
import { getAppConfig } from './config'
import { quitWithoutCore, stopCore } from './core/manager'
import { triggerSysProxy } from './sys/sysproxy'
import { hideDockIcon, showDockIcon } from './resolve/tray'
import icon from '../resources/icon.png?asset'

export let mainWindow: BrowserWindow | null = null
let quitTimeout: NodeJS.Timeout | null = null

export async function createWindow(): Promise<void> {
  const { useWindowFrame = false } = await getAppConfig()
  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600,
    file: 'window-state.json'
  })

  Menu.setApplicationMenu(null)
  mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    show: false,
    frame: useWindowFrame,
    fullscreenable: false,
    titleBarStyle: useWindowFrame ? 'default' : 'hidden',
    titleBarOverlay: useWindowFrame
      ? false
      : {
          height: 49
        },
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      spellcheck: false,
      sandbox: false,
      devTools: true
    }
  })

  mainWindowState.manage(mainWindow)
  setupWindowEvents(mainWindow, mainWindowState)

  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupWindowEvents(
  window: BrowserWindow,
  windowState: ReturnType<typeof windowStateKeeper>
): void {
  window.on('ready-to-show', async () => {
    const {
      silentStart = false,
      autoQuitWithoutCore = false,
      autoQuitWithoutCoreDelay = 60
    } = await getAppConfig()

    if (autoQuitWithoutCore && !window.isVisible()) {
      scheduleQuitWithoutCore(autoQuitWithoutCoreDelay)
    }

    if (!silentStart) {
      clearQuitTimeout()
      window.show()
      window.focusOnWebView()
    }
  })

  window.webContents.on('did-fail-load', () => {
    window.webContents.reload()
  })

  window.on('show', () => {
    showDockIcon()
  })

  window.on('close', async (event) => {
    event.preventDefault()
    window.hide()

    const {
      autoQuitWithoutCore = false,
      autoQuitWithoutCoreDelay = 60,
      useDockIcon = true
    } = await getAppConfig()

    if (!useDockIcon) {
      hideDockIcon()
    }

    if (autoQuitWithoutCore) {
      scheduleQuitWithoutCore(autoQuitWithoutCoreDelay)
    }
  })

  window.on('resized', () => {
    windowState.saveState(window)
  })

  window.on('move', () => {
    windowState.saveState(window)
  })

  window.on('session-end', async () => {
    await triggerSysProxy(false)
    await stopCore()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

function scheduleQuitWithoutCore(delaySeconds: number): void {
  clearQuitTimeout()
  quitTimeout = setTimeout(async () => {
    await quitWithoutCore()
  }, delaySeconds * 1000)
}

export function clearQuitTimeout(): void {
  if (quitTimeout) {
    clearTimeout(quitTimeout)
    quitTimeout = null
  }
}

export function triggerMainWindow(force?: boolean): void {
  if (!mainWindow) return

  getAppConfig()
    .then(({ triggerMainWindowBehavior = 'toggle' }) => {
      if (force === true || triggerMainWindowBehavior === 'toggle') {
        if (mainWindow?.isVisible()) {
          closeMainWindow()
        } else {
          showMainWindow()
        }
      } else {
        showMainWindow()
      }
    })
    .catch(showMainWindow)
}

export function showMainWindow(): void {
  if (mainWindow) {
    clearQuitTimeout()
    mainWindow.show()
    mainWindow.focusOnWebView()
  }
}

export function closeMainWindow(): void {
  mainWindow?.close()
}
