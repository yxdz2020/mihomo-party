import { controledMihomoConfigPath } from '../utils/dirs'
import { readFile, writeFile } from 'fs/promises'
import yaml from 'yaml'
import { generateProfile } from '../core/factory'
import { getAppConfig } from './app'
import { defaultControledMihomoConfig } from '../utils/template'
import { deepMerge } from '../utils/merge'

let controledMihomoConfig: Partial<IMihomoConfig> // mihomo.yaml

export async function getControledMihomoConfig(force = false): Promise<Partial<IMihomoConfig>> {
  if (force || !controledMihomoConfig) {
    const data = await readFile(controledMihomoConfigPath(), 'utf-8')
    controledMihomoConfig = yaml.parse(data, { merge: true }) || defaultControledMihomoConfig
  }
  if (typeof controledMihomoConfig !== 'object')
    controledMihomoConfig = defaultControledMihomoConfig
  return controledMihomoConfig
}

export async function patchControledMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  const { useNameserverPolicy, controlDns = true, controlSniff = true } = await getAppConfig()

  if (patch.hosts) {
    controledMihomoConfig.hosts = patch.hosts
  }
  if (patch.dns?.['nameserver-policy']) {
    controledMihomoConfig.dns = controledMihomoConfig.dns || {}
    controledMihomoConfig.dns['nameserver-policy'] = patch.dns['nameserver-policy']
  }
  controledMihomoConfig = deepMerge(controledMihomoConfig, patch)

  // 覆写开关控制
  let configForProfile = { ...controledMihomoConfig }

  if (!controlDns) {
    delete configForProfile.dns
    delete configForProfile.hosts
  } else {
    if (configForProfile.dns?.ipv6 === undefined) {
      configForProfile.dns = defaultControledMihomoConfig.dns
    }
  }
  if (!controlSniff) {
    delete configForProfile.sniffer
  } else {
    if (!configForProfile.sniffer) {
      configForProfile.sniffer = defaultControledMihomoConfig.sniffer
    }
  }

  if (!useNameserverPolicy) {
    delete configForProfile?.dns?.['nameserver-policy']
  }
  if (process.platform === 'darwin') {
    delete configForProfile?.tun?.device
  }

  const originalConfig = controledMihomoConfig
  controledMihomoConfig = configForProfile
  await generateProfile()
  controledMihomoConfig = originalConfig

  await writeFile(controledMihomoConfigPath(), yaml.stringify(controledMihomoConfig), 'utf-8')
}
