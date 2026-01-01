import { triggerAutoProxy, triggerManualProxy } from '@mihomo-party/sysproxy'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { pacPort, startPacServer, stopPacServer } from '../resolve/server'
import { promisify } from 'util'
import { exec, execFile } from 'child_process'
import path from 'path'
import { resourcesFilesDir } from '../utils/dirs'
import { net } from 'electron'
import axios from 'axios'
import fs from 'fs'
import { proxyLogger } from '../utils/logger'

let triggerSysProxyTimer: NodeJS.Timeout | null = null
const helperSocketPath = '/tmp/mihomo-party-helper.sock'

const defaultBypass: string[] = (() => {
  switch (process.platform) {
    case 'linux':
      return ['localhost', '127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '::1']
    case 'darwin':
      return [
        '127.0.0.1',
        '192.168.0.0/16',
        '10.0.0.0/8',
        '172.16.0.0/12',
        'localhost',
        '*.local',
        '*.crashlytics.com',
        '<local>'
      ]
    case 'win32':
      return [
        'localhost',
        '127.*',
        '192.168.*',
        '10.*',
        '172.16.*',
        '172.17.*',
        '172.18.*',
        '172.19.*',
        '172.20.*',
        '172.21.*',
        '172.22.*',
        '172.23.*',
        '172.24.*',
        '172.25.*',
        '172.26.*',
        '172.27.*',
        '172.28.*',
        '172.29.*',
        '172.30.*',
        '172.31.*',
        '<local>'
      ]
    default:
      return ['localhost', '127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '::1']
  }
})()

export async function triggerSysProxy(enable: boolean): Promise<void> {
  if (net.isOnline()) {
    if (enable) {
      await disableSysProxy()
      await enableSysProxy()
    } else {
      await disableSysProxy()
    }
  } else {
    if (triggerSysProxyTimer) clearTimeout(triggerSysProxyTimer)
    triggerSysProxyTimer = setTimeout(() => triggerSysProxy(enable), 5000)
  }
}

async function enableSysProxy(): Promise<void> {
  await startPacServer()
  const { sysProxy } = await getAppConfig()
  const { mode, host, bypass = defaultBypass } = sysProxy
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  const execFilePromise = promisify(execFile)
  switch (mode || 'manual') {
    case 'auto': {
      if (process.platform === 'win32') {
        try {
          await execFilePromise(path.join(resourcesFilesDir(), 'sysproxy.exe'), [
            'pac',
            `http://${host || '127.0.0.1'}:${pacPort}/pac`
          ])
        } catch {
          triggerAutoProxy(true, `http://${host || '127.0.0.1'}:${pacPort}/pac`)
        }
      } else if (process.platform === 'darwin') {
        await helperRequest(() =>
          axios.post(
            'http://localhost/pac',
            { url: `http://${host || '127.0.0.1'}:${pacPort}/pac` },
            {
              socketPath: helperSocketPath
            }
          )
        )
      } else {
        triggerAutoProxy(true, `http://${host || '127.0.0.1'}:${pacPort}/pac`)
      }

      break
    }

    case 'manual': {
      if (process.platform === 'win32') {
        try {
          await execFilePromise(path.join(resourcesFilesDir(), 'sysproxy.exe'), [
            'global',
            `${host || '127.0.0.1'}:${port}`,
            bypass.join(';')
          ])
        } catch {
          triggerManualProxy(true, host || '127.0.0.1', port, bypass.join(','))
        }
      } else if (process.platform === 'darwin') {
        await helperRequest(() =>
          axios.post(
            'http://localhost/global',
            { host: host || '127.0.0.1', port: port.toString(), bypass: bypass.join(',') },
            {
              socketPath: helperSocketPath
            }
          )
        )
      } else {
        triggerManualProxy(true, host || '127.0.0.1', port, bypass.join(','))
      }
      break
    }
  }
}

async function disableSysProxy(): Promise<void> {
  await stopPacServer()
  const execFilePromise = promisify(execFile)
  if (process.platform === 'win32') {
    try {
      await execFilePromise(path.join(resourcesFilesDir(), 'sysproxy.exe'), ['set', '1'])
    } catch {
      triggerAutoProxy(false, '')
      triggerManualProxy(false, '', 0, '')
    }
  } else if (process.platform === 'darwin') {
    await helperRequest(() =>
      axios.get('http://localhost/off', {
        socketPath: helperSocketPath
      })
    )
  } else {
    triggerAutoProxy(false, '')
    triggerManualProxy(false, '', 0, '')
  }
}

// Helper function to check if socket file exists
function isSocketFileExists(): boolean {
  try {
    return fs.existsSync(helperSocketPath)
  } catch {
    return false
  }
}

// Check if helper process is running (no admin privileges needed)
async function isHelperRunning(): Promise<boolean> {
  try {
    const execPromise = promisify(exec)
    const { stdout } = await execPromise('pgrep -f party.mihomo.helper')
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

// Start or restart helper service via launchctl
async function startHelperService(): Promise<void> {
  const execPromise = promisify(exec)
  const shell = `launchctl kickstart -k system/party.mihomo.helper`
  const command = `do shell script "${shell}" with administrator privileges`
  await execPromise(`osascript -e '${command}'`)
  await new Promise((resolve) => setTimeout(resolve, 1500))
}

// Send signal to recreate socket (only if process is running)
async function requestSocketRecreation(): Promise<void> {
  try {
    const execPromise = promisify(exec)
    const shell = `pkill -USR1 -f party.mihomo.helper`
    const command = `do shell script "${shell}" with administrator privileges`
    await execPromise(`osascript -e '${command}'`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  } catch (error) {
    await proxyLogger.error('Failed to send signal to helper', error)
    throw error
  }
}

// Wrapper function for helper requests with auto-retry on socket issues
async function helperRequest(requestFn: () => Promise<unknown>, maxRetries = 2): Promise<unknown> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn()
    } catch (error) {
      lastError = error as Error
      const errCode = (error as NodeJS.ErrnoException).code
      const errMsg = (error as Error).message || ''

      if (
        attempt < maxRetries &&
        (errCode === 'ECONNREFUSED' ||
          errCode === 'ENOENT' ||
          errMsg.includes('connect ECONNREFUSED') ||
          errMsg.includes('ENOENT'))
      ) {
        await proxyLogger.info(
          `Helper request failed (attempt ${attempt + 1}/${maxRetries + 1}), checking helper status...`
        )

        const helperRunning = await isHelperRunning()
        const socketExists = isSocketFileExists()

        if (!helperRunning) {
          await proxyLogger.info('Helper process not running, starting service...')
          try {
            await startHelperService()
            await proxyLogger.info('Helper service started, retrying...')
            continue
          } catch (startError) {
            await proxyLogger.warn('Failed to start helper service', startError)
          }
        } else if (!socketExists) {
          await proxyLogger.info('Socket file missing but helper running, requesting recreation...')
          try {
            await requestSocketRecreation()
            await proxyLogger.info('Socket recreation requested, retrying...')
            continue
          } catch (signalError) {
            await proxyLogger.warn('Failed to request socket recreation', signalError)
          }
        }
      }

      if (attempt === maxRetries) {
        throw lastError
      }
    }
  }

  throw lastError
}
