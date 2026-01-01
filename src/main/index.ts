import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, dialog } from 'electron'
import { registerIpcMainHandlers } from './utils/ipc'
import { getAppConfig, patchAppConfig } from './config'
import {
  startCore,
  checkAdminRestartForTun,
  checkHighPrivilegeCore,
  restartAsAdmin,
  initAdminStatus,
  checkAdminPrivileges
} from './core/manager'
import { createTray } from './resolve/tray'
import { init, initBasic, safeShowErrorBox } from './utils/init'
import { initShortcut } from './resolve/shortcut'
import { initProfileUpdater } from './core/profileUpdater'
import { startMonitor } from './resolve/trafficMonitor'
import { showFloatingWindow } from './resolve/floatingWindow'
import { initI18n } from '../shared/i18n'
import i18next from 'i18next'
import { logger } from './utils/logger'
import { createLogger } from './utils/logger'
import { initWebdavBackupScheduler } from './resolve/backup'

const mainLogger = createLogger('Main')
import {
  createWindow,
  mainWindow,
  showMainWindow,
  triggerMainWindow,
  closeMainWindow
} from './window'
import { handleDeepLink } from './deeplink'
import {
  fixUserDataPermissions,
  setupPlatformSpecifics,
  setupAppLifecycle,
  getSystemLanguage
} from './lifecycle'

export { mainWindow, showMainWindow, triggerMainWindow, closeMainWindow }

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

async function initApp(): Promise<void> {
  await fixUserDataPermissions()
}

initApp().catch((e) => {
  safeShowErrorBox('common.error.initFailed', `${e}`)
  app.quit()
})

setupPlatformSpecifics()

async function checkHighPrivilegeCoreEarly(): Promise<void> {
  if (process.platform !== 'win32') return

  try {
    await initBasic()
    const isCurrentAppAdmin = await checkAdminPrivileges()
    if (isCurrentAppAdmin) return

    const hasHighPrivilegeCore = await checkHighPrivilegeCore()
    if (!hasHighPrivilegeCore) return

    try {
      const appConfig = await getAppConfig()
      const language = appConfig.language || (app.getLocale().startsWith('zh') ? 'zh-CN' : 'en-US')
      await initI18n({ lng: language })
    } catch {
      await initI18n({ lng: 'zh-CN' })
    }

    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      title: i18next.t('core.highPrivilege.title'),
      message: i18next.t('core.highPrivilege.message'),
      buttons: [i18next.t('common.confirm'), i18next.t('common.cancel')],
      defaultId: 0,
      cancelId: 1
    })

    if (choice === 0) {
      try {
        await restartAsAdmin(false)
        process.exit(0)
      } catch (error) {
        safeShowErrorBox('common.error.adminRequired', `${error}`)
        process.exit(1)
      }
    } else {
      process.exit(0)
    }
  } catch (e) {
    mainLogger.error('Failed to check high privilege core', e)
  }
}

async function initHardwareAcceleration(): Promise<void> {
  try {
    await initBasic()
    const { disableHardwareAcceleration = false } = await getAppConfig()
    if (disableHardwareAcceleration) {
      app.disableHardwareAcceleration()
    }
  } catch (e) {
    mainLogger.warn('Failed to read hardware acceleration config', e)
  }
}

initHardwareAcceleration()
setupAppLifecycle()

app.on('second-instance', async (_event, commandline) => {
  showMainWindow()
  const url = commandline.pop()
  if (url) {
    await handleDeepLink(url)
  }
})

app.on('open-url', async (_event, url) => {
  showMainWindow()
  await handleDeepLink(url)
})

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('party.mihomo.app')

  await initBasic()
  await checkHighPrivilegeCoreEarly()
  await initAdminStatus()

  try {
    await init()
    const appConfig = await getAppConfig()
    if (!appConfig.language) {
      const systemLanguage = getSystemLanguage()
      await patchAppConfig({ language: systemLanguage })
      appConfig.language = systemLanguage
    }
    await initI18n({ lng: appConfig.language })
  } catch (e) {
    safeShowErrorBox('common.error.initFailed', `${e}`)
    app.quit()
  }

  try {
    const [startPromise] = await startCore()
    startPromise.then(async () => {
      await initProfileUpdater()
      await initWebdavBackupScheduler()
      await checkAdminRestartForTun()
    })
  } catch (e) {
    safeShowErrorBox('mihomo.error.coreStartFailed', `${e}`)
  }

  try {
    await startMonitor()
  } catch {
    // ignore
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const { showFloatingWindow: showFloating = false, disableTray = false } = await getAppConfig()
  registerIpcMainHandlers()
  await createWindow()

  if (showFloating) {
    try {
      await showFloatingWindow()
    } catch (error) {
      await logger.error('Failed to create floating window on startup', error)
    }
  }

  if (!disableTray) {
    await createTray()
  }

  await initShortcut()

  app.on('activate', () => {
    showMainWindow()
  })
})
