import { TitleBarOverlayOptions } from 'electron'

function checkIpcError<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'invokeError' in response) {
    throw (response as { invokeError: unknown }).invokeError
  }
  return response as T
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const response = await window.electron.ipcRenderer.invoke(channel, ...args)
  return checkIpcError<T>(response)
}

// Mihomo API
export const mihomoVersion = (): Promise<IMihomoVersion> => invoke('mihomoVersion')
export const mihomoCloseConnection = (id: string): Promise<void> =>
  invoke('mihomoCloseConnection', id)
export const mihomoCloseAllConnections = (): Promise<void> => invoke('mihomoCloseAllConnections')
export const mihomoRules = (): Promise<IMihomoRulesInfo> => invoke('mihomoRules')
export const mihomoProxies = (): Promise<IMihomoProxies> => invoke('mihomoProxies')
export const mihomoGroups = (): Promise<IMihomoMixedGroup[]> => invoke('mihomoGroups')
export const mihomoProxyProviders = (): Promise<IMihomoProxyProviders> =>
  invoke('mihomoProxyProviders')
export const mihomoUpdateProxyProviders = (name: string): Promise<void> =>
  invoke('mihomoUpdateProxyProviders', name)
export const mihomoRuleProviders = (): Promise<IMihomoRuleProviders> =>
  invoke('mihomoRuleProviders')
export const mihomoUpdateRuleProviders = (name: string): Promise<void> =>
  invoke('mihomoUpdateRuleProviders', name)
export const mihomoChangeProxy = (group: string, proxy: string): Promise<IMihomoProxy> =>
  invoke('mihomoChangeProxy', group, proxy)
export const mihomoUnfixedProxy = (group: string): Promise<IMihomoProxy> =>
  invoke('mihomoUnfixedProxy', group)
export const mihomoUpgradeGeo = (): Promise<void> => invoke('mihomoUpgradeGeo')
export const mihomoUpgrade = (): Promise<void> => invoke('mihomoUpgrade')
export const mihomoUpgradeUI = (): Promise<void> => invoke('mihomoUpgradeUI')
export const mihomoUpgradeConfig = (): Promise<void> => invoke('mihomoUpgradeConfig')
export const mihomoProxyDelay = (proxy: string, url?: string): Promise<IMihomoDelay> =>
  invoke('mihomoProxyDelay', proxy, url)
export const mihomoGroupDelay = (group: string, url?: string): Promise<IMihomoGroupDelay> =>
  invoke('mihomoGroupDelay', group, url)
export const patchMihomoConfig = (patch: Partial<IMihomoConfig>): Promise<void> =>
  invoke('patchMihomoConfig', patch)
export const mihomoSmartGroupWeights = (groupName: string): Promise<Record<string, number>> =>
  invoke('mihomoSmartGroupWeights', groupName)
export const mihomoSmartFlushCache = (configName?: string): Promise<void> =>
  invoke('mihomoSmartFlushCache', configName)
export const getSmartOverrideContent = (): Promise<string | null> =>
  invoke('getSmartOverrideContent')

// AutoRun
export const checkAutoRun = (): Promise<boolean> => invoke('checkAutoRun')
export const enableAutoRun = (): Promise<void> => invoke('enableAutoRun')
export const disableAutoRun = (): Promise<void> => invoke('disableAutoRun')

// Config
export const getAppConfig = (force = false): Promise<IAppConfig> => invoke('getAppConfig', force)
export const patchAppConfig = (patch: Partial<IAppConfig>): Promise<void> =>
  invoke('patchAppConfig', patch)
export const getControledMihomoConfig = (force = false): Promise<Partial<IMihomoConfig>> =>
  invoke('getControledMihomoConfig', force)
export const patchControledMihomoConfig = (patch: Partial<IMihomoConfig>): Promise<void> =>
  invoke('patchControledMihomoConfig', patch)
export const resetAppConfig = (): Promise<void> => invoke('resetAppConfig')

// Profile
export const getProfileConfig = (force = false): Promise<IProfileConfig> =>
  invoke('getProfileConfig', force)
export const setProfileConfig = (config: IProfileConfig): Promise<void> =>
  invoke('setProfileConfig', config)
export const getCurrentProfileItem = (): Promise<IProfileItem> => invoke('getCurrentProfileItem')
export const getProfileItem = (id: string | undefined): Promise<IProfileItem> =>
  invoke('getProfileItem', id)
export const getProfileStr = (id: string): Promise<string> => invoke('getProfileStr', id)
export const setProfileStr = (id: string, str: string): Promise<void> =>
  invoke('setProfileStr', id, str)
export const addProfileItem = (item: Partial<IProfileItem>): Promise<void> =>
  invoke('addProfileItem', item)
export const removeProfileItem = (id: string): Promise<void> => invoke('removeProfileItem', id)
export const updateProfileItem = (item: IProfileItem): Promise<void> =>
  invoke('updateProfileItem', item)
export const changeCurrentProfile = (id: string): Promise<void> =>
  invoke('changeCurrentProfile', id)
export const addProfileUpdater = (item: IProfileItem): Promise<void> =>
  invoke('addProfileUpdater', item)
export const removeProfileUpdater = (id: string): Promise<void> =>
  invoke('removeProfileUpdater', id)

// Override
export const getOverrideConfig = (force = false): Promise<IOverrideConfig> =>
  invoke('getOverrideConfig', force)
export const setOverrideConfig = (config: IOverrideConfig): Promise<void> =>
  invoke('setOverrideConfig', config)
export const getOverrideItem = (id: string): Promise<IOverrideItem | undefined> =>
  invoke('getOverrideItem', id)
export const addOverrideItem = (item: Partial<IOverrideItem>): Promise<void> =>
  invoke('addOverrideItem', item)
export const removeOverrideItem = (id: string): Promise<void> => invoke('removeOverrideItem', id)
export const updateOverrideItem = (item: IOverrideItem): Promise<void> =>
  invoke('updateOverrideItem', item)
export const getOverride = (id: string, ext: 'js' | 'yaml' | 'log'): Promise<string> =>
  invoke('getOverride', id, ext)
export const setOverride = (id: string, ext: 'js' | 'yaml', str: string): Promise<void> =>
  invoke('setOverride', id, ext, str)

// File
export const getFileStr = (path: string): Promise<string> => invoke('getFileStr', path)
export const setFileStr = (path: string, str: string): Promise<void> =>
  invoke('setFileStr', path, str)
export const convertMrsRuleset = (path: string, behavior: string): Promise<string> =>
  invoke('convertMrsRuleset', path, behavior)
export const getRuntimeConfig = (): Promise<IMihomoConfig> => invoke('getRuntimeConfig')
export const getRuntimeConfigStr = (): Promise<string> => invoke('getRuntimeConfigStr')
export const getRuleStr = (id: string): Promise<string> => invoke('getRuleStr', id)
export const setRuleStr = (id: string, str: string): Promise<void> => invoke('setRuleStr', id, str)
export const getFilePath = (ext: string[]): Promise<string[] | undefined> =>
  invoke('getFilePath', ext)
export const readTextFile = (filePath: string): Promise<string> => invoke('readTextFile', filePath)
export const openFile = (
  type: 'profile' | 'override',
  id: string,
  ext?: 'yaml' | 'js'
): Promise<void> => invoke('openFile', type, id, ext)

// Core
export const restartCore = (): Promise<void> => invoke('restartCore')
export const startMonitor = (): Promise<void> => invoke('startMonitor')
export const quitWithoutCore = (): Promise<void> => invoke('quitWithoutCore')

// System
export const triggerSysProxy = (enable: boolean): Promise<void> => invoke('triggerSysProxy', enable)
export const checkTunPermissions = (): Promise<boolean> => invoke('checkTunPermissions')
export const grantTunPermissions = (): Promise<void> => invoke('grantTunPermissions')
export const manualGrantCorePermition = (): Promise<void> => invoke('manualGrantCorePermition')
export const checkAdminPrivileges = (): Promise<boolean> => invoke('checkAdminPrivileges')
export const restartAsAdmin = (): Promise<void> => invoke('restartAsAdmin')
export const checkMihomoCorePermissions = (): Promise<boolean> =>
  invoke('checkMihomoCorePermissions')
export const checkHighPrivilegeCore = (): Promise<boolean> => invoke('checkHighPrivilegeCore')
export const showTunPermissionDialog = (): Promise<boolean> => invoke('showTunPermissionDialog')
export const showErrorDialog = (title: string, message: string): Promise<void> =>
  invoke('showErrorDialog', title, message)
export const openUWPTool = (): Promise<void> => invoke('openUWPTool')
export const setupFirewall = (): Promise<void> => invoke('setupFirewall')
export const getInterfaces = (): Promise<Record<string, NetworkInterfaceInfo[]>> =>
  invoke('getInterfaces')
export const setNativeTheme = (theme: 'system' | 'light' | 'dark'): Promise<void> =>
  invoke('setNativeTheme', theme)
export const copyEnv = (type: 'bash' | 'cmd' | 'powershell'): Promise<void> =>
  invoke('copyEnv', type)

// Update
export const checkUpdate = (): Promise<IAppVersion | undefined> => invoke('checkUpdate')
export const downloadAndInstallUpdate = (version: string): Promise<void> =>
  invoke('downloadAndInstallUpdate', version)
export const getVersion = (): Promise<string> => invoke('getVersion')
export const getPlatform = (): Promise<NodeJS.Platform> => invoke('platform')
export const fetchMihomoTags = (
  forceRefresh = false
): Promise<{ name: string; zipball_url: string; tarball_url: string }[]> =>
  invoke('fetchMihomoTags', forceRefresh)
export const installSpecificMihomoCore = (version: string): Promise<void> =>
  invoke('installSpecificMihomoCore', version)
export const clearMihomoVersionCache = (): Promise<void> => invoke('clearMihomoVersionCache')

// Backup
export const webdavBackup = (): Promise<boolean> => invoke('webdavBackup')
export const webdavRestore = (filename: string): Promise<void> => invoke('webdavRestore', filename)
export const listWebdavBackups = (): Promise<string[]> => invoke('listWebdavBackups')
export const webdavDelete = (filename: string): Promise<void> => invoke('webdavDelete', filename)
export const reinitWebdavBackupScheduler = (): Promise<void> =>
  invoke('reinitWebdavBackupScheduler')
export const exportLocalBackup = (): Promise<boolean> => invoke('exportLocalBackup')
export const importLocalBackup = (): Promise<boolean> => invoke('importLocalBackup')

// SubStore
export const startSubStoreFrontendServer = (): Promise<void> =>
  invoke('startSubStoreFrontendServer')
export const stopSubStoreFrontendServer = (): Promise<void> => invoke('stopSubStoreFrontendServer')
export const startSubStoreBackendServer = (): Promise<void> => invoke('startSubStoreBackendServer')
export const stopSubStoreBackendServer = (): Promise<void> => invoke('stopSubStoreBackendServer')
export const downloadSubStore = (): Promise<void> => invoke('downloadSubStore')
export const subStorePort = (): Promise<number> => invoke('subStorePort')
export const subStoreFrontendPort = (): Promise<number> => invoke('subStoreFrontendPort')
export const subStoreSubs = (): Promise<ISubStoreSub[]> => invoke('subStoreSubs')
export const subStoreCollections = (): Promise<ISubStoreSub[]> => invoke('subStoreCollections')

// Theme
export const resolveThemes = (): Promise<{ key: string; label: string; content: string }[]> =>
  invoke('resolveThemes')
export const fetchThemes = (): Promise<void> => invoke('fetchThemes')
export const importThemes = (files: string[]): Promise<void> => invoke('importThemes', files)
export const readTheme = (theme: string): Promise<string> => invoke('readTheme', theme)
export const writeTheme = (theme: string, css: string): Promise<void> =>
  invoke('writeTheme', theme, css)

let applyThemeRunning = false
let pendingTheme: string | null = null

export async function applyTheme(theme: string): Promise<void> {
  if (applyThemeRunning) {
    pendingTheme = theme
    return
  }
  applyThemeRunning = true
  try {
    await invoke<void>('applyTheme', theme)
  } finally {
    applyThemeRunning = false
    if (pendingTheme !== null) {
      const nextTheme = pendingTheme
      pendingTheme = null
      await applyTheme(nextTheme)
    }
  }
}

// Tray
export const showTrayIcon = (): Promise<void> => invoke('showTrayIcon')
export const closeTrayIcon = (): Promise<void> => invoke('closeTrayIcon')
export const updateTrayIcon = (): Promise<void> => invoke('updateTrayIcon')
export function updateTrayIconImmediate(sysProxyEnabled: boolean, tunEnabled: boolean): void {
  window.electron.ipcRenderer.invoke('updateTrayIconImmediate', sysProxyEnabled, tunEnabled)
}

// Window
export const showMainWindow = (): Promise<void> => invoke('showMainWindow')
export const closeMainWindow = (): Promise<void> => invoke('closeMainWindow')
export const triggerMainWindow = (): Promise<void> => invoke('triggerMainWindow')
export const showFloatingWindow = (): Promise<void> => invoke('showFloatingWindow')
export const closeFloatingWindow = (): Promise<void> => invoke('closeFloatingWindow')
export const showContextMenu = (): Promise<void> => invoke('showContextMenu')
export async function setTitleBarOverlay(overlay: TitleBarOverlayOptions): Promise<void> {
  try {
    await invoke<void>('setTitleBarOverlay', overlay)
  } catch {
    // Not supported on this platform
  }
}
export const setAlwaysOnTop = (alwaysOnTop: boolean): Promise<void> =>
  invoke('setAlwaysOnTop', alwaysOnTop)
export const isAlwaysOnTop = (): Promise<boolean> => invoke('isAlwaysOnTop')
export const openDevTools = (): Promise<void> => invoke('openDevTools')
export const createHeapSnapshot = (): Promise<void> => invoke('createHeapSnapshot')

// Shortcut
export const registerShortcut = (
  oldShortcut: string,
  newShortcut: string,
  action: string
): Promise<boolean> => invoke('registerShortcut', oldShortcut, newShortcut, action)

// Misc
export const getGistUrl = (): Promise<string> => invoke('getGistUrl')
export const getImageDataURL = (url: string): Promise<string> => invoke('getImageDataURL', url)
export const relaunchApp = (): Promise<void> => invoke('relaunchApp')
export const quitApp = (): Promise<void> => invoke('quitApp')
