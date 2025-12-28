import React, { createContext, useContext, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { showError } from '@renderer/utils/error-display'
import useSWR from 'swr'
import { getAppConfig, patchAppConfig as patch } from '@renderer/utils/ipc'

interface AppConfigContextType {
  appConfig: IAppConfig | undefined
  mutateAppConfig: () => void
  patchAppConfig: (value: Partial<IAppConfig>) => Promise<void>
}

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined)

export const AppConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
  const { data: appConfig, mutate: mutateAppConfig } = useSWR('getConfig', () => getAppConfig())

  const patchAppConfig = async (value: Partial<IAppConfig>): Promise<void> => {
    try {
      await patch(value)
    } catch (e) {
      await showError(e, t('common.error.updateAppConfigFailed'))
    } finally {
      mutateAppConfig()
    }
  }

  React.useEffect(() => {
    const handler = (): void => {
      mutateAppConfig()
    }
    window.electron.ipcRenderer.on('appConfigUpdated', handler)
    return (): void => {
      window.electron.ipcRenderer.removeListener('appConfigUpdated', handler)
    }
  }, [])

  return (
    <AppConfigContext.Provider value={{ appConfig, mutateAppConfig, patchAppConfig }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export const useAppConfig = (): AppConfigContextType => {
  const context = useContext(AppConfigContext)
  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppConfigProvider')
  }
  return context
}
