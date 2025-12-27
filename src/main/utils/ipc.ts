import { app, ipcMain } from 'electron'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  mihomoGroupDelay,
  mihomoGroups,
  mihomoProxies,
  mihomoProxyDelay,
  mihomoProxyProviders,
  mihomoRuleProviders,
  mihomoRules,
  mihomoUnfixedProxy,
  mihomoUpdateProxyProviders,
  mihomoUpdateRuleProviders,
  mihomoUpgrade,
  mihomoUpgradeGeo,
  mihomoUpgradeUI,
  mihomoUpgradeConfig,
  mihomoVersion,
  patchMihomoConfig,
  mihomoSmartGroupWeights,
  mihomoSmartFlushCache
} from '../core/mihomoApi'
import { checkAutoRun, disableAutoRun, enableAutoRun } from '../sys/autoRun'
import { installMihomoCore, getGitHubTags, clearVersionCache } from './github'
import {
  getAppConfig,
  patchAppConfig,
  getControledMihomoConfig,
  patchControledMihomoConfig,
  getProfileConfig,
  getCurrentProfileItem,
  getProfileItem,
  addProfileItem,
  removeProfileItem,
  changeCurrentProfile,
  getProfileStr,
  getFileStr,
  setFileStr,
  setProfileStr,
  updateProfileItem,
  setProfileConfig,
  getOverrideConfig,
  setOverrideConfig,
  getOverrideItem,
  addOverrideItem,
  removeOverrideItem,
  getOverride,
  setOverride,
  updateOverrideItem,
  convertMrsRuleset
} from '../config'
import {
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer,
  downloadSubStore,
  subStoreFrontendPort,
  subStorePort
} from '../resolve/server'
import {
  quitWithoutCore,
  restartCore,
  checkTunPermissions,
  grantTunPermissions,
  manualGrantCorePermition,
  checkAdminPrivileges,
  restartAsAdmin,
  checkMihomoCorePermissions,
  requestTunPermissions,
  checkHighPrivilegeCore,
  showTunPermissionDialog,
  showErrorDialog
} from '../core/manager'
import { triggerSysProxy } from '../sys/sysproxy'
import { checkUpdate, downloadAndInstallUpdate } from '../resolve/autoUpdater'
import {
  getFilePath,
  openFile,
  openUWPTool,
  readTextFile,
  resetAppConfig,
  setNativeTheme,
  setupFirewall
} from '../sys/misc'
import { getRuntimeConfig, getRuntimeConfigStr } from '../core/factory'
import {
  listWebdavBackups,
  webdavBackup,
  webdavDelete,
  webdavRestore,
  exportLocalBackup,
  importLocalBackup,
  reinitScheduler
} from '../resolve/backup'
import { getInterfaces } from '../sys/interface'
import {
  closeTrayIcon,
  copyEnv,
  showTrayIcon,
  updateTrayIcon,
  updateTrayIconImmediate
} from '../resolve/tray'
import { registerShortcut } from '../resolve/shortcut'
import { closeMainWindow, mainWindow, showMainWindow, triggerMainWindow } from '..'
import {
  applyTheme,
  fetchThemes,
  importThemes,
  readTheme,
  resolveThemes,
  writeTheme
} from '../resolve/theme'
import { subStoreCollections, subStoreSubs } from '../core/subStoreApi'
import { logDir, rulePath } from './dirs'
import path from 'path'
import v8 from 'v8'
import { getGistUrl } from '../resolve/gistApi'
import { getImageDataURL } from './image'
import { startMonitor } from '../resolve/trafficMonitor'
import { closeFloatingWindow, showContextMenu, showFloatingWindow } from '../resolve/floatingWindow'
import i18next from 'i18next'
import { addProfileUpdater, removeProfileUpdater } from '../core/profileUpdater'
import { readFile, writeFile } from 'fs/promises'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T> | { invokeError: unknown }> {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e && typeof e === 'object') {
        if ('message' in e) {
          return { invokeError: e.message }
        }
        return { invokeError: JSON.stringify(e) }
      }
      if (typeof e === 'string') {
        return { invokeError: e }
      }
      return { invokeError: 'Unknown Error' }
    }
  }
}

async function fetchMihomoTags(
  forceRefresh = false
): Promise<{ name: string; zipball_url: string; tarball_url: string }[]> {
  return await getGitHubTags('MetaCubeX', 'mihomo', forceRefresh)
}

async function installSpecificMihomoCore(version: string): Promise<void> {
  clearVersionCache('MetaCubeX', 'mihomo')
  return await installMihomoCore(version)
}

async function clearMihomoVersionCache(): Promise<void> {
  clearVersionCache('MetaCubeX', 'mihomo')
}

async function getRuleStr(id: string): Promise<string> {
  return await readFile(rulePath(id), 'utf-8')
}

async function setRuleStr(id: string, str: string): Promise<void> {
  await writeFile(rulePath(id), str, 'utf-8')
}

async function getSmartOverrideContent(): Promise<string | null> {
  try {
    const override = await getOverrideItem('smart-core-override')
    return override?.file || null
  } catch {
    return null
  }
}

async function changeLanguage(lng: string): Promise<void> {
  await i18next.changeLanguage(lng)
  ipcMain.emit('updateTrayMenu')
}

async function setTitleBarOverlay(overlay: Electron.TitleBarOverlayOptions): Promise<void> {
  if (mainWindow && typeof mainWindow.setTitleBarOverlay === 'function') {
    mainWindow.setTitleBarOverlay(overlay)
  }
}

export function registerIpcMainHandlers(): void {
  // Mihomo API
  ipcMain.handle('mihomoVersion', wrapAsync(mihomoVersion))
  ipcMain.handle('mihomoCloseConnection', (_e, id: string) => wrapAsync(mihomoCloseConnection)(id))
  ipcMain.handle('mihomoCloseAllConnections', wrapAsync(mihomoCloseAllConnections))
  ipcMain.handle('mihomoRules', wrapAsync(mihomoRules))
  ipcMain.handle('mihomoProxies', wrapAsync(mihomoProxies))
  ipcMain.handle('mihomoGroups', wrapAsync(mihomoGroups))
  ipcMain.handle('mihomoProxyProviders', wrapAsync(mihomoProxyProviders))
  ipcMain.handle('mihomoUpdateProxyProviders', (_e, name: string) =>
    wrapAsync(mihomoUpdateProxyProviders)(name)
  )
  ipcMain.handle('mihomoRuleProviders', wrapAsync(mihomoRuleProviders))
  ipcMain.handle('mihomoUpdateRuleProviders', (_e, name: string) =>
    wrapAsync(mihomoUpdateRuleProviders)(name)
  )
  ipcMain.handle('mihomoChangeProxy', (_e, group: string, proxy: string) =>
    wrapAsync(mihomoChangeProxy)(group, proxy)
  )
  ipcMain.handle('mihomoUnfixedProxy', (_e, group: string) => wrapAsync(mihomoUnfixedProxy)(group))
  ipcMain.handle('mihomoUpgradeGeo', wrapAsync(mihomoUpgradeGeo))
  ipcMain.handle('mihomoUpgrade', wrapAsync(mihomoUpgrade))
  ipcMain.handle('mihomoUpgradeUI', wrapAsync(mihomoUpgradeUI))
  ipcMain.handle('mihomoUpgradeConfig', wrapAsync(mihomoUpgradeConfig))
  ipcMain.handle('mihomoProxyDelay', (_e, proxy: string, url?: string) =>
    wrapAsync(mihomoProxyDelay)(proxy, url)
  )
  ipcMain.handle('mihomoGroupDelay', (_e, group: string, url?: string) =>
    wrapAsync(mihomoGroupDelay)(group, url)
  )
  ipcMain.handle('patchMihomoConfig', (_e, patch: Partial<IMihomoConfig>) =>
    wrapAsync(patchMihomoConfig)(patch)
  )
  ipcMain.handle('mihomoSmartGroupWeights', (_e, groupName: string) =>
    wrapAsync(mihomoSmartGroupWeights)(groupName)
  )
  ipcMain.handle('mihomoSmartFlushCache', (_e, configName?: string) =>
    wrapAsync(mihomoSmartFlushCache)(configName)
  )

  // AutoRun
  ipcMain.handle('checkAutoRun', wrapAsync(checkAutoRun))
  ipcMain.handle('enableAutoRun', wrapAsync(enableAutoRun))
  ipcMain.handle('disableAutoRun', wrapAsync(disableAutoRun))

  // Config
  ipcMain.handle('getAppConfig', (_e, force?: boolean) => wrapAsync(getAppConfig)(force))
  ipcMain.handle('patchAppConfig', (_e, config: Partial<IAppConfig>) =>
    wrapAsync(patchAppConfig)(config)
  )
  ipcMain.handle('getControledMihomoConfig', (_e, force?: boolean) =>
    wrapAsync(getControledMihomoConfig)(force)
  )
  ipcMain.handle('patchControledMihomoConfig', (_e, config: Partial<IMihomoConfig>) =>
    wrapAsync(patchControledMihomoConfig)(config)
  )
  ipcMain.handle('resetAppConfig', () => resetAppConfig())

  // Profile
  ipcMain.handle('getProfileConfig', (_e, force?: boolean) => wrapAsync(getProfileConfig)(force))
  ipcMain.handle('setProfileConfig', (_e, config: IProfileConfig) =>
    wrapAsync(setProfileConfig)(config)
  )
  ipcMain.handle('getCurrentProfileItem', wrapAsync(getCurrentProfileItem))
  ipcMain.handle('getProfileItem', (_e, id?: string) => wrapAsync(getProfileItem)(id))
  ipcMain.handle('getProfileStr', (_e, id: string) => wrapAsync(getProfileStr)(id))
  ipcMain.handle('setProfileStr', (_e, id: string, str: string) =>
    wrapAsync(setProfileStr)(id, str)
  )
  ipcMain.handle('addProfileItem', (_e, item: Partial<IProfileItem>) =>
    wrapAsync(addProfileItem)(item)
  )
  ipcMain.handle('removeProfileItem', (_e, id: string) => wrapAsync(removeProfileItem)(id))
  ipcMain.handle('updateProfileItem', (_e, item: IProfileItem) => wrapAsync(updateProfileItem)(item))
  ipcMain.handle('changeCurrentProfile', (_e, id: string) => wrapAsync(changeCurrentProfile)(id))
  ipcMain.handle('addProfileUpdater', (_e, item: IProfileItem) => wrapAsync(addProfileUpdater)(item))
  ipcMain.handle('removeProfileUpdater', (_e, id: string) => wrapAsync(removeProfileUpdater)(id))

  // Override
  ipcMain.handle('getOverrideConfig', (_e, force?: boolean) => wrapAsync(getOverrideConfig)(force))
  ipcMain.handle('setOverrideConfig', (_e, config: IOverrideConfig) =>
    wrapAsync(setOverrideConfig)(config)
  )
  ipcMain.handle('getOverrideItem', (_e, id: string) => wrapAsync(getOverrideItem)(id))
  ipcMain.handle('addOverrideItem', (_e, item: Partial<IOverrideItem>) =>
    wrapAsync(addOverrideItem)(item)
  )
  ipcMain.handle('removeOverrideItem', (_e, id: string) => wrapAsync(removeOverrideItem)(id))
  ipcMain.handle('updateOverrideItem', (_e, item: IOverrideItem) =>
    wrapAsync(updateOverrideItem)(item)
  )
  ipcMain.handle('getOverride', (_e, id: string, ext: 'js' | 'yaml' | 'log') =>
    wrapAsync(getOverride)(id, ext)
  )
  ipcMain.handle('setOverride', (_e, id: string, ext: 'js' | 'yaml', str: string) =>
    wrapAsync(setOverride)(id, ext, str)
  )

  // File
  ipcMain.handle('getFileStr', (_e, filePath: string) => wrapAsync(getFileStr)(filePath))
  ipcMain.handle('setFileStr', (_e, filePath: string, str: string) =>
    wrapAsync(setFileStr)(filePath, str)
  )
  ipcMain.handle('convertMrsRuleset', (_e, filePath: string, behavior: string) =>
    wrapAsync(convertMrsRuleset)(filePath, behavior)
  )
  ipcMain.handle('getRuntimeConfig', wrapAsync(getRuntimeConfig))
  ipcMain.handle('getRuntimeConfigStr', wrapAsync(getRuntimeConfigStr))
  ipcMain.handle('getSmartOverrideContent', wrapAsync(getSmartOverrideContent))
  ipcMain.handle('getRuleStr', (_e, id: string) => wrapAsync(getRuleStr)(id))
  ipcMain.handle('setRuleStr', (_e, id: string, str: string) => wrapAsync(setRuleStr)(id, str))
  ipcMain.handle('getFilePath', (_e, ext: string[]) => getFilePath(ext))
  ipcMain.handle('readTextFile', (_e, filePath: string) => wrapAsync(readTextFile)(filePath))
  ipcMain.handle('openFile', (_e, type: 'profile' | 'override', id: string, ext?: 'yaml' | 'js') =>
    openFile(type, id, ext)
  )

  // Core
  ipcMain.handle('restartCore', wrapAsync(restartCore))
  ipcMain.handle('startMonitor', (_e, detached?: boolean) => wrapAsync(startMonitor)(detached))
  ipcMain.handle('quitWithoutCore', wrapAsync(quitWithoutCore))

  // System
  ipcMain.handle('triggerSysProxy', (_e, enable: boolean) => wrapAsync(triggerSysProxy)(enable))
  ipcMain.handle('checkTunPermissions', wrapAsync(checkTunPermissions))
  ipcMain.handle('grantTunPermissions', wrapAsync(grantTunPermissions))
  ipcMain.handle('manualGrantCorePermition', wrapAsync(manualGrantCorePermition))
  ipcMain.handle('checkAdminPrivileges', wrapAsync(checkAdminPrivileges))
  ipcMain.handle('restartAsAdmin', (_e, forTun?: boolean) => wrapAsync(restartAsAdmin)(forTun))
  ipcMain.handle('checkMihomoCorePermissions', wrapAsync(checkMihomoCorePermissions))
  ipcMain.handle('requestTunPermissions', wrapAsync(requestTunPermissions))
  ipcMain.handle('checkHighPrivilegeCore', wrapAsync(checkHighPrivilegeCore))
  ipcMain.handle('showTunPermissionDialog', wrapAsync(showTunPermissionDialog))
  ipcMain.handle('showErrorDialog', (_e, title: string, message: string) =>
    wrapAsync(showErrorDialog)(title, message)
  )
  ipcMain.handle('openUWPTool', wrapAsync(openUWPTool))
  ipcMain.handle('setupFirewall', wrapAsync(setupFirewall))
  ipcMain.handle('getInterfaces', getInterfaces)
  ipcMain.handle('setNativeTheme', (_e, theme: 'system' | 'light' | 'dark') => setNativeTheme(theme))
  ipcMain.handle('copyEnv', (_e, type: 'bash' | 'cmd' | 'powershell') => wrapAsync(copyEnv)(type))

  // Update
  ipcMain.handle('checkUpdate', wrapAsync(checkUpdate))
  ipcMain.handle('downloadAndInstallUpdate', (_e, version: string) =>
    wrapAsync(downloadAndInstallUpdate)(version)
  )
  ipcMain.handle('getVersion', () => app.getVersion())
  ipcMain.handle('platform', () => process.platform)
  ipcMain.handle('fetchMihomoTags', (_e, forceRefresh?: boolean) =>
    wrapAsync(fetchMihomoTags)(forceRefresh)
  )
  ipcMain.handle('installSpecificMihomoCore', (_e, version: string) =>
    wrapAsync(installSpecificMihomoCore)(version)
  )
  ipcMain.handle('clearMihomoVersionCache', wrapAsync(clearMihomoVersionCache))

  // Backup
  ipcMain.handle('webdavBackup', wrapAsync(webdavBackup))
  ipcMain.handle('webdavRestore', (_e, filename: string) => wrapAsync(webdavRestore)(filename))
  ipcMain.handle('listWebdavBackups', wrapAsync(listWebdavBackups))
  ipcMain.handle('webdavDelete', (_e, filename: string) => wrapAsync(webdavDelete)(filename))
  ipcMain.handle('reinitWebdavBackupScheduler', wrapAsync(reinitScheduler))
  ipcMain.handle('exportLocalBackup', wrapAsync(exportLocalBackup))
  ipcMain.handle('importLocalBackup', wrapAsync(importLocalBackup))

  // SubStore
  ipcMain.handle('startSubStoreFrontendServer', wrapAsync(startSubStoreFrontendServer))
  ipcMain.handle('stopSubStoreFrontendServer', wrapAsync(stopSubStoreFrontendServer))
  ipcMain.handle('startSubStoreBackendServer', wrapAsync(startSubStoreBackendServer))
  ipcMain.handle('stopSubStoreBackendServer', wrapAsync(stopSubStoreBackendServer))
  ipcMain.handle('downloadSubStore', wrapAsync(downloadSubStore))
  ipcMain.handle('subStorePort', () => subStorePort)
  ipcMain.handle('subStoreFrontendPort', () => subStoreFrontendPort)
  ipcMain.handle('subStoreSubs', wrapAsync(subStoreSubs))
  ipcMain.handle('subStoreCollections', wrapAsync(subStoreCollections))

  // Theme
  ipcMain.handle('resolveThemes', wrapAsync(resolveThemes))
  ipcMain.handle('fetchThemes', wrapAsync(fetchThemes))
  ipcMain.handle('importThemes', (_e, files: string[]) => wrapAsync(importThemes)(files))
  ipcMain.handle('readTheme', (_e, theme: string) => wrapAsync(readTheme)(theme))
  ipcMain.handle('writeTheme', (_e, theme: string, css: string) =>
    wrapAsync(writeTheme)(theme, css)
  )
  ipcMain.handle('applyTheme', (_e, theme: string) => wrapAsync(applyTheme)(theme))

  // Tray
  ipcMain.handle('showTrayIcon', wrapAsync(showTrayIcon))
  ipcMain.handle('closeTrayIcon', wrapAsync(closeTrayIcon))
  ipcMain.handle('updateTrayIcon', wrapAsync(updateTrayIcon))
  ipcMain.handle('updateTrayIconImmediate', (_e, sysProxyEnabled: boolean, tunEnabled: boolean) =>
    updateTrayIconImmediate(sysProxyEnabled, tunEnabled)
  )

  // Window
  ipcMain.handle('showMainWindow', showMainWindow)
  ipcMain.handle('closeMainWindow', closeMainWindow)
  ipcMain.handle('triggerMainWindow', (_e, force?: boolean) => triggerMainWindow(force))
  ipcMain.handle('showFloatingWindow', wrapAsync(showFloatingWindow))
  ipcMain.handle('closeFloatingWindow', wrapAsync(closeFloatingWindow))
  ipcMain.handle('showContextMenu', wrapAsync(showContextMenu))
  ipcMain.handle('setTitleBarOverlay', (_e, overlay: Electron.TitleBarOverlayOptions) =>
    wrapAsync(setTitleBarOverlay)(overlay)
  )
  ipcMain.handle('setAlwaysOnTop', (_e, alwaysOnTop: boolean) =>
    mainWindow?.setAlwaysOnTop(alwaysOnTop)
  )
  ipcMain.handle('isAlwaysOnTop', () => mainWindow?.isAlwaysOnTop())
  ipcMain.handle('openDevTools', () => mainWindow?.webContents.openDevTools())
  ipcMain.handle('createHeapSnapshot', () =>
    v8.writeHeapSnapshot(path.join(logDir(), `${Date.now()}.heapsnapshot`))
  )

  // Shortcut
  ipcMain.handle('registerShortcut', (_e, oldShortcut: string, newShortcut: string, action: string) =>
    wrapAsync(registerShortcut)(oldShortcut, newShortcut, action)
  )

  // Misc
  ipcMain.handle('getGistUrl', wrapAsync(getGistUrl))
  ipcMain.handle('getImageDataURL', (_e, url: string) => wrapAsync(getImageDataURL)(url))
  ipcMain.handle('relaunchApp', () => {
    app.relaunch()
    app.quit()
  })
  ipcMain.handle('quitApp', () => app.quit())
  ipcMain.handle('changeLanguage', (_e, lng: string) => wrapAsync(changeLanguage)(lng))
}
