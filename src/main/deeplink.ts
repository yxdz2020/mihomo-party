import { Notification } from 'electron'
import i18next from 'i18next'
import { addProfileItem } from './config'
import { mainWindow } from './window'
import { safeShowErrorBox } from './utils/init'

export async function handleDeepLink(url: string): Promise<void> {
  if (!url.startsWith('clash://') && !url.startsWith('mihomo://')) return

  const urlObj = new URL(url)
  switch (urlObj.host) {
    case 'install-config': {
      try {
        const profileUrl = urlObj.searchParams.get('url')
        const profileName = urlObj.searchParams.get('name')
        if (!profileUrl) {
          throw new Error(i18next.t('profiles.error.urlParamMissing'))
        }
        await addProfileItem({
          type: 'remote',
          name: profileName ?? undefined,
          url: profileUrl
        })
        mainWindow?.webContents.send('profileConfigUpdated')
        new Notification({ title: i18next.t('profiles.notification.importSuccess') }).show()
      } catch (e) {
        safeShowErrorBox('profiles.error.importFailed', `${url}\n${e}`)
      }
      break
    }
  }
}
