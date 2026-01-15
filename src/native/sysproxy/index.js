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
  // Electron 打包后的路径
  if (process.resourcesPath) {
    return process.resourcesPath
  }
  // 开发环境：从 __dirname 向上查找项目根目录
  let currentDir = __dirname
  while (currentDir !== dirname(currentDir)) {
    if (existsSync(join(currentDir, 'package.json'))) {
      return currentDir
    }
    currentDir = dirname(currentDir)
  }
  return __dirname
}

function loadBinding() {
  const bindingName = getBindingName()
  const resourcesPath = getResourcesPath()

  // 可能的路径列表
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
