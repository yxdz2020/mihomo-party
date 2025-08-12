import { getAppConfig } from './app'
import { addOverrideItem, removeOverrideItem, getOverrideItem } from './override'
import { overrideLogger } from '../utils/logger'

const SMART_OVERRIDE_ID = 'smart-core-override'

/**
 * Smart 内核的覆写配置模板
 */
function generateSmartOverrideTemplate(useLightGBM: boolean, collectData: boolean, strategy: string): string {
  return `
// 配置会在启用 Smart 内核时自动应用

function main(config) {
  try {
    // 确保配置对象存在
    if (!config || typeof config !== 'object') {
      console.log('[Smart Override] Invalid config object')
      return config
    }

    // 确保代理组配置存在
    if (!config['proxy-groups']) {
      config['proxy-groups'] = []
    }

    // 确保代理组是数组
    if (!Array.isArray(config['proxy-groups'])) {
      console.log('[Smart Override] proxy-groups is not an array, converting...')
      config['proxy-groups'] = []
    }

    // 查找现有的 Smart 代理组并更新
    let smartGroupExists = false
    for (let i = 0; i < config['proxy-groups'].length; i++) {
      const group = config['proxy-groups'][i]
      if (group && group.type === 'smart') {
        smartGroupExists = true
        console.log('[Smart Override] Found existing smart group:', group.name)

        if (!group['policy-priority']) {
          group['policy-priority'] = ''  // policy-priority: <1 means lower priority, >1 means higher priority, the default is 1, pattern support regex and string
        }
        group.uselightgbm = ${useLightGBM}
        group.collectdata = ${collectData}
        group.strategy = '${strategy}'
        break
      }
    }

    // 如果没有 Smart 组且有可用代理，创建示例组
    if (!smartGroupExists && config.proxies && Array.isArray(config.proxies) && config.proxies.length > 0) {
      console.log('[Smart Override] Creating new smart group with', config.proxies.length, 'proxies')

      // 获取所有代理的名称
      const proxyNames = config.proxies
        .filter(proxy => proxy && typeof proxy === 'object' && proxy.name)
        .map(proxy => proxy.name)

      if (proxyNames.length > 0) {
        const smartGroup = {
          name: 'Smart Group',
          type: 'smart',
          'policy-priority': '',  // policy-priority: <1 means lower priority, >1 means higher priority, the default is 1, pattern support regex and string
          uselightgbm: ${useLightGBM},
          collectdata: ${collectData},
          strategy: '${strategy}',
          proxies: proxyNames
        }
        config['proxy-groups'].unshift(smartGroup)
        console.log('[Smart Override] Created smart group at first position with proxies:', proxyNames)
      } else {
        console.log('[Smart Override] No valid proxies found, skipping smart group creation')
      }
    } else if (!smartGroupExists) {
      console.log('[Smart Override] No proxies available, skipping smart group creation')
    }

    // 处理规则替换
    if (config.rules && Array.isArray(config.rules)) {
      console.log('[Smart Override] Processing rules, original count:', config.rules.length)

      // 收集所有代理组名称
      const proxyGroupNames = new Set()
      if (config['proxy-groups'] && Array.isArray(config['proxy-groups'])) {
        config['proxy-groups'].forEach(group => {
          if (group && group.name) {
            proxyGroupNames.add(group.name)
          }
        })
      }

      // 添加常见的内置目标
      const builtinTargets = new Set([
        'DIRECT',
        'REJECT',
        'REJECT-DROP',
        'PASS',
        'COMPATIBLE'
      ])

      // 添加常见的规则参数，不应该替换
      const ruleParams = new Set(['no-resolve', 'force-remote-dns', 'prefer-ipv6'])

      console.log('[Smart Override] Found', proxyGroupNames.size, 'proxy groups:', Array.from(proxyGroupNames))

      let replacedCount = 0
      config.rules = config.rules.map(rule => {
        if (typeof rule === 'string') {
          // 检查是否是复杂规则格式（包含括号的嵌套规则）
          if (rule.includes('((') || rule.includes('))')) {
            console.log('[Smart Override] Skipping complex nested rule:', rule)
            return rule
          }

          // 处理字符串格式的规则
          const parts = rule.split(',').map(part => part.trim())
          if (parts.length >= 2) {
            // 找到代理组名称的位置
            let targetIndex = -1
            let targetValue = ''

            // 处理 MATCH 规则
            if (parts[0] === 'MATCH' && parts.length === 2) {
              targetIndex = 1
              targetValue = parts[1]
            } else if (parts.length >= 3) {
              // 处理其他规则
              for (let i = 2; i < parts.length; i++) {
                const part = parts[i]
                if (!ruleParams.has(part)) {
                  targetIndex = i
                  targetValue = part
                  break
                }
              }
            }

            if (targetIndex !== -1 && targetValue) {
              // 检查是否应该替换
              const shouldReplace = !builtinTargets.has(targetValue) &&
                                   (proxyGroupNames.has(targetValue) ||
                                    !ruleParams.has(targetValue))

              if (shouldReplace) {
                parts[targetIndex] = 'Smart Group'
                replacedCount++
                console.log('[Smart Override] Replaced rule target:', targetValue, '→ Smart Group')
                return parts.join(',')
              }
            }
          }
        } else if (typeof rule === 'object' && rule !== null) {
          // 处理对象格式
          let targetField = ''
          let targetValue = ''

          if (rule.target) {
            targetField = 'target'
            targetValue = rule.target
          } else if (rule.proxy) {
            targetField = 'proxy'
            targetValue = rule.proxy
          }

          if (targetField && targetValue) {
            const shouldReplace = !builtinTargets.has(targetValue) &&
                                 (proxyGroupNames.has(targetValue) ||
                                  !ruleParams.has(targetValue))

            if (shouldReplace) {
              rule[targetField] = 'Smart Group'
              replacedCount++
              console.log('[Smart Override] Replaced rule target:', targetValue, '→ Smart Group')
            }
          }
        }
        return rule
      })

      console.log('[Smart Override] Rules processed, replaced', replacedCount, 'non-DIRECT rules with Smart Group')
    } else {
      console.log('[Smart Override] No rules found or rules is not an array')
    }

    console.log('[Smart Override] Configuration processed successfully')
    return config
  } catch (error) {
    console.error('[Smart Override] Error processing config:', error)
    // 发生错误时返回原始配置，避免破坏整个配置
    return config
  }
}
`
}

/**
 * 创建或更新 Smart 内核覆写配置
 */
export async function createSmartOverride(): Promise<void> {
  try {
    // 获取应用配置
    const {
      smartCoreUseLightGBM = false,
      smartCoreCollectData = false,
      smartCoreStrategy = 'sticky-sessions'
    } = await getAppConfig()

    // 生成覆写模板
    const template = generateSmartOverrideTemplate(
      smartCoreUseLightGBM,
      smartCoreCollectData,
      smartCoreStrategy
    )

    // 检查是否已存在 Smart 覆写配置
    const existingOverride = await getOverrideItem(SMART_OVERRIDE_ID)

    if (existingOverride) {
      // 如果已存在，更新配置
      await addOverrideItem({
        id: SMART_OVERRIDE_ID,
        name: 'Smart Core Override',
        type: 'local',
        ext: 'js',
        global: true,
        file: template
      })
    } else {
      // 如果不存在，创建新的覆写配置
      await addOverrideItem({
        id: SMART_OVERRIDE_ID,
        name: 'Smart Core Override',
        type: 'local',
        ext: 'js',
        global: true,
        file: template
      })
    }
  } catch (error) {
    await overrideLogger.error('Failed to create Smart override', error)
    throw error
  }
}

/**
 * 删除 Smart 内核覆写配置
 */
export async function removeSmartOverride(): Promise<void> {
  try {
    const existingOverride = await getOverrideItem(SMART_OVERRIDE_ID)
    if (existingOverride) {
      await removeOverrideItem(SMART_OVERRIDE_ID)
    }
  } catch (error) {
    await overrideLogger.error('Failed to remove Smart override', error)
    throw error
  }
}

/**
 * 根据应用配置管理 Smart 覆写
 */
export async function manageSmartOverride(): Promise<void> {
  const { enableSmartCore = true, enableSmartOverride = true, core } = await getAppConfig()

  if (enableSmartCore && enableSmartOverride && core === 'mihomo-smart') {
    await createSmartOverride()
  } else {
    await removeSmartOverride()
  }
}

/**
 * 检查 Smart 覆写是否存在
 */
export async function isSmartOverrideExists(): Promise<boolean> {
  try {
    const override = await getOverrideItem(SMART_OVERRIDE_ID)
    return !!override
  } catch {
    return false
  }
}
