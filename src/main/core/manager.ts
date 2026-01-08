import { ChildProcess, execFile, spawn } from 'child_process'
import { readFile, rm, writeFile } from 'fs/promises'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import { createWriteStream, existsSync } from 'fs'
import chokidar from 'chokidar'
import { app, ipcMain } from 'electron'
import { mainWindow } from '../window'
import {
  getAppConfig,
  getControledMihomoConfig,
  patchControledMihomoConfig,
  manageSmartOverride
} from '../config'
import {
  dataDir,
  coreLogPath,
  mihomoCoreDir,
  mihomoCorePath,
  mihomoProfileWorkDir,
  mihomoTestDir,
  mihomoWorkConfigPath,
  mihomoWorkDir
} from '../utils/dirs'
import { uploadRuntimeConfig } from '../resolve/gistApi'
import { startMonitor } from '../resolve/trafficMonitor'
import { safeShowErrorBox } from '../utils/init'
import i18next from '../../shared/i18n'
import { managerLogger } from '../utils/logger'
import {
  startMihomoTraffic,
  startMihomoConnections,
  startMihomoLogs,
  startMihomoMemory,
  stopMihomoConnections,
  stopMihomoTraffic,
  stopMihomoLogs,
  stopMihomoMemory,
  patchMihomoConfig,
  getAxios
} from './mihomoApi'
import { generateProfile } from './factory'
import { getSessionAdminStatus } from './permissions'
import {
  cleanupSocketFile,
  cleanupWindowsNamedPipes,
  validateWindowsPipeAccess,
  waitForCoreReady
} from './process'
import { setPublicDNS, recoverDNS } from './dns'

// 重新导出权限相关函数
export {
  initAdminStatus,
  getSessionAdminStatus,
  checkAdminPrivileges,
  checkMihomoCorePermissions,
  checkHighPrivilegeCore,
  grantTunPermissions,
  restartAsAdmin,
  requestTunPermissions,
  showTunPermissionDialog,
  showErrorDialog,
  checkTunPermissions,
  manualGrantCorePermition
} from './permissions'

export { getDefaultDevice } from './dns'

const execFilePromise = promisify(execFile)

chokidar.watch(path.join(mihomoCoreDir(), 'meta-update'), {}).on('unlinkDir', async () => {
  try {
    await stopCore(true)
    await startCore()
  } catch (e) {
    safeShowErrorBox('mihomo.error.coreStartFailed', `${e}`)
  }
})

// 动态生成 IPC 路径
export const getMihomoIpcPath = (): string => {
  if (process.platform === 'win32') {
    const isAdmin = getSessionAdminStatus()
    const sessionId = process.env.SESSIONNAME || process.env.USERNAME || 'default'
    const processId = process.pid

    return isAdmin
      ? `\\\\.\\pipe\\MihomoParty\\mihomo-admin-${sessionId}-${processId}`
      : `\\\\.\\pipe\\MihomoParty\\mihomo-user-${sessionId}-${processId}`
  }

  const uid = process.getuid?.() || 'unknown'
  const processId = process.pid
  return `/tmp/mihomo-party-${uid}-${processId}.sock`
}

const ctlParam = process.platform === 'win32' ? '-ext-ctl-pipe' : '-ext-ctl-unix'

let child: ChildProcess
let retry = 10
let isRestarting = false

export async function startCore(detached = false): Promise<Promise<void>[]> {
  // 合并配置读取，避免多次 await
  const [appConfig, mihomoConfig] = await Promise.all([
    getAppConfig(),
    getControledMihomoConfig()
  ])

  const {
    core = 'mihomo',
    autoSetDNS = true,
    diffWorkDir = false,
    mihomoCpuPriority = 'PRIORITY_NORMAL'
  } = appConfig

  const { 'log-level': logLevel, tun } = mihomoConfig

  // 清理旧进程
  const pidPath = path.join(dataDir(), 'core.pid')
  if (existsSync(pidPath)) {
    const pid = parseInt(await readFile(pidPath, 'utf-8'))
    try {
      process.kill(pid, 'SIGINT')
    } catch {
      // ignore
    } finally {
      await rm(pidPath)
    }
  }

  const corePath = mihomoCorePath(core)

  // 管理 Smart 内核覆写配置
  await manageSmartOverride()

  // generateProfile 返回实际使用的 current
  const current = await generateProfile()
  await checkProfile(current, core, diffWorkDir)
  await stopCore()
  await cleanupSocketFile()

  if (tun?.enable && autoSetDNS) {
    try {
      await setPublicDNS()
    } catch (error) {
      managerLogger.error('set dns failed', error)
    }
  }

  // 获取动态 IPC 路径
  const dynamicIpcPath = getMihomoIpcPath()
  managerLogger.info(`Using IPC path: ${dynamicIpcPath}`)

  if (process.platform === 'win32') {
    await validateWindowsPipeAccess(dynamicIpcPath)
  }

  // 内核日志输出
  const stdout = createWriteStream(coreLogPath(), { flags: 'a' })
  const stderr = createWriteStream(coreLogPath(), { flags: 'a' })

  child = spawn(
    corePath,
    ['-d', diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), ctlParam, dynamicIpcPath],
    {
      detached,
      stdio: detached ? 'ignore' : undefined
    }
  )

  if (process.platform === 'win32' && child.pid) {
    os.setPriority(child.pid, os.constants.priority[mihomoCpuPriority])
  }

  if (detached) {
    managerLogger.info(
      `Core process detached successfully on ${process.platform}, PID: ${child.pid}`
    )
    child.unref()
    return [new Promise(() => {})]
  }

  child.on('close', async (code, signal) => {
    managerLogger.info(`Core closed, code: ${code}, signal: ${signal}`)

    if (isRestarting) {
      managerLogger.info('Core closed during restart, skipping auto-restart')
      return
    }

    if (retry) {
      managerLogger.info('Try Restart Core')
      retry--
      await restartCore()
    } else {
      await stopCore()
    }
  })

  child.stdout?.pipe(stdout)
  child.stderr?.pipe(stderr)

  return new Promise((resolve, reject) => {
    child.stdout?.on('data', async (data) => {
      const str = data.toString()

      if (str.includes('configure tun interface: operation not permitted')) {
        patchControledMihomoConfig({ tun: { enable: false } })
        mainWindow?.webContents.send('controledMihomoConfigUpdated')
        ipcMain.emit('updateTrayMenu')
        reject(i18next.t('tun.error.tunPermissionDenied'))
      }

      const isControllerError =
        (process.platform !== 'win32' && str.includes('External controller unix listen error')) ||
        (process.platform === 'win32' && str.includes('External controller pipe listen error'))

      if (isControllerError) {
        managerLogger.error('External controller listen error detected:', str)

        if (process.platform === 'win32') {
          managerLogger.info('Attempting Windows pipe cleanup and retry...')
          try {
            await cleanupWindowsNamedPipes()
            await new Promise((r) => setTimeout(r, 2000))
          } catch (cleanupError) {
            managerLogger.error('Pipe cleanup failed:', cleanupError)
          }
        }

        reject(i18next.t('mihomo.error.externalControllerListenError'))
      }

      const isApiReady =
        (process.platform !== 'win32' && str.includes('RESTful API unix listening at')) ||
        (process.platform === 'win32' && str.includes('RESTful API pipe listening at'))

      if (isApiReady) {
        resolve([
          new Promise((innerResolve) => {
            child.stdout?.on('data', async (innerData) => {
              if (
                innerData.toString().toLowerCase().includes('start initial compatible provider default')
              ) {
                try {
                  mainWindow?.webContents.send('groupsUpdated')
                  mainWindow?.webContents.send('rulesUpdated')
                  await uploadRuntimeConfig()
                } catch {
                  // ignore
                }
                await patchMihomoConfig({ 'log-level': logLevel })
                innerResolve()
              }
            })
          })
        ])

        await waitForCoreReady()
        await getAxios(true)
        await startMihomoTraffic()
        await startMihomoConnections()
        await startMihomoLogs()
        await startMihomoMemory()
        retry = 10
      }
    })
  })
}

export async function stopCore(force = false): Promise<void> {
  try {
    if (!force) {
      await recoverDNS()
    }
  } catch (error) {
    managerLogger.error('recover dns failed', error)
  }

  if (child) {
    child.removeAllListeners()
    child.kill('SIGINT')
  }

  stopMihomoTraffic()
  stopMihomoConnections()
  stopMihomoLogs()
  stopMihomoMemory()

  try {
    await getAxios(true)
  } catch (error) {
    managerLogger.warn('Failed to refresh axios instance:', error)
  }

  await cleanupSocketFile()
}

export async function restartCore(): Promise<void> {
  if (isRestarting) {
    managerLogger.info('Core restart already in progress, skipping duplicate request')
    return
  }

  isRestarting = true
  try {
    await startCore()
  } catch (e) {
    managerLogger.error('restart core failed', e)
    throw e
  } finally {
    isRestarting = false
  }
}

export async function keepCoreAlive(): Promise<void> {
  try {
    await startCore(true)
    if (child?.pid) {
      await writeFile(path.join(dataDir(), 'core.pid'), child.pid.toString())
    }
  } catch (e) {
    safeShowErrorBox('mihomo.error.coreStartFailed', `${e}`)
  }
}

export async function quitWithoutCore(): Promise<void> {
  managerLogger.info(`Starting lightweight mode on platform: ${process.platform}`)

  try {
    await startCore(true)
    if (child?.pid) {
      await writeFile(path.join(dataDir(), 'core.pid'), child.pid.toString())
      managerLogger.info(`Core started in lightweight mode with PID: ${child.pid}`)
    }
  } catch (e) {
    managerLogger.error('Failed to start core in lightweight mode:', e)
    safeShowErrorBox('mihomo.error.coreStartFailed', `${e}`)
  }

  await startMonitor(true)
  managerLogger.info('Exiting main process, core will continue running in background')
  app.exit()
}

async function checkProfile(
  current: string | undefined,
  core: string = 'mihomo',
  diffWorkDir: boolean = false
): Promise<void> {
  const corePath = mihomoCorePath(core)

  try {
    await execFilePromise(corePath, [
      '-t',
      '-f',
      diffWorkDir ? mihomoWorkConfigPath(current) : mihomoWorkConfigPath('work'),
      '-d',
      mihomoTestDir()
    ])
  } catch (error) {
    managerLogger.error('Profile check failed', error)

    if (error instanceof Error && 'stdout' in error) {
      const { stdout, stderr } = error as { stdout: string; stderr?: string }
      managerLogger.info('Profile check stdout', stdout)
      managerLogger.info('Profile check stderr', stderr)

      const errorLines = stdout
        .split('\n')
        .filter((line) => line.includes('level=error') || line.includes('error'))
        .map((line) => {
          if (line.includes('level=error')) {
            return line.split('level=error')[1]?.trim() || line
          }
          return line.trim()
        })
        .filter((line) => line.length > 0)

      if (errorLines.length === 0) {
        const allLines = stdout.split('\n').filter((line) => line.trim().length > 0)
        throw new Error(`${i18next.t('mihomo.error.profileCheckFailed')}:\n${allLines.join('\n')}`)
      } else {
        throw new Error(
          `${i18next.t('mihomo.error.profileCheckFailed')}:\n${errorLines.join('\n')}`
        )
      }
    } else {
      throw new Error(`${i18next.t('mihomo.error.profileCheckFailed')}: ${error}`)
    }
  }
}

// 权限检查入口（从 permissions.ts 调用）
export async function checkAdminRestartForTun(): Promise<void> {
  const { checkAdminRestartForTun: check } = await import('./permissions')
  await check(restartCore)
}
