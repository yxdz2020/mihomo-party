const { existsSync, readFileSync } = require('fs')
const { join, dirname } = require('path')

const { platform, arch } = process

let nativeBinding = null
let loadError = null

function isMusl() {
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = require('child_process').execSync('which ldd').toString().trim()
      return readFileSync(lddPath, 'utf8').includes('musl')
    } catch {
      return true
    }
  } else {
    const { glibcVersionRuntime } = process.report.getReport().header
    return !glibcVersionRuntime
  }
}

function getBindingName() {
  switch (platform) {
    case 'win32':
      if (arch === 'x64') return 'sysproxy.win32-x64-msvc.node'
      if (arch === 'ia32') return 'sysproxy.win32-ia32-msvc.node'
      if (arch === 'arm64') return 'sysproxy.win32-arm64-msvc.node'
      break
    case 'darwin':
      if (arch === 'x64') return 'sysproxy.darwin-x64.node'
      if (arch === 'arm64') return 'sysproxy.darwin-arm64.node'
      break
    case 'linux':
      if (isMusl()) {
        if (arch === 'x64') return 'sysproxy.linux-x64-musl.node'
        if (arch === 'arm64') return 'sysproxy.linux-arm64-musl.node'
      } else {
        if (arch === 'x64') return 'sysproxy.linux-x64-gnu.node'
        if (arch === 'arm64') return 'sysproxy.linux-arm64-gnu.node'
      }
      break
  }
  throw new Error(`Unsupported platform: ${platform}-${arch}`)
}

function getResourcesPath() {
  // 开发环境：优先使用 process.cwd()
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'extra', 'sidecar'))) {
    return cwd
  }
  // Electron 打包后的路径
  if (process.resourcesPath && existsSync(join(process.resourcesPath, 'sidecar'))) {
    return process.resourcesPath
  }
  // 备选：使用 app.getAppPath() (Electron 特有)
  try {
    const { app } = require('electron')
    const appPath = app.getAppPath()
    if (existsSync(join(appPath, 'extra', 'sidecar'))) {
      return appPath
    }
  } catch {}
  // 备选：从 __dirname 向上查找
  let currentDir = __dirname
  while (currentDir !== dirname(currentDir)) {
    if (existsSync(join(currentDir, 'extra', 'sidecar'))) {
      return currentDir
    }
    currentDir = dirname(currentDir)
  }
  return cwd
}

function loadBinding() {
  const bindingName = getBindingName()
  const resourcesPath = getResourcesPath()

  const searchPaths = [
    join(resourcesPath, 'sidecar', bindingName),
    join(resourcesPath, 'extra', 'sidecar', bindingName)
  ]

  for (const sidecarPath of searchPaths) {
    if (existsSync(sidecarPath)) {
      try {
        nativeBinding = require(sidecarPath)
        return nativeBinding
      } catch (e) {
        loadError = e
      }
    }
  }

  if (loadError) {
    throw loadError
  }
  throw new Error(`Native binding not found: ${bindingName}`)
}

const binding = loadBinding()

module.exports.triggerManualProxy = binding.triggerManualProxy
module.exports.triggerAutoProxy = binding.triggerAutoProxy
module.exports.getSystemProxy = binding.getSystemProxy
module.exports.getAutoProxy = binding.getAutoProxy
module.exports.setSystemProxy = binding.setSystemProxy
module.exports.setAutoProxy = binding.setAutoProxy
