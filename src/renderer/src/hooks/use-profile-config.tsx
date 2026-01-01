import React, { createContext, ReactNode, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { showError } from '@renderer/utils/error-display'
import useSWR from 'swr'
import {
  addProfileItem as add,
  changeCurrentProfile as change,
  getProfileConfig,
  removeProfileItem as remove,
  setProfileConfig as set,
  updateProfileItem as update
} from '@renderer/utils/ipc'

interface ProfileConfigContextType {
  profileConfig: IProfileConfig | undefined
  setProfileConfig: (config: IProfileConfig) => Promise<void>
  mutateProfileConfig: () => void
  addProfileItem: (item: Partial<IProfileItem>) => Promise<void>
  updateProfileItem: (item: IProfileItem) => Promise<void>
  removeProfileItem: (id: string) => Promise<void>
  changeCurrentProfile: (id: string) => Promise<void>
}

const ProfileConfigContext = createContext<ProfileConfigContextType | undefined>(undefined)

export const ProfileConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
  const { data: profileConfig, mutate: mutateProfileConfig } = useSWR('getProfileConfig', () =>
    getProfileConfig()
  )
  const targetProfileId = React.useRef<string | null>(null)
  const pendingTask = React.useRef<Promise<void> | null>(null)

  const setProfileConfig = async (config: IProfileConfig): Promise<void> => {
    try {
      await set(config)
    } catch (e) {
      await showError(e, t('common.error.saveProfileConfigFailed'))
    } finally {
      mutateProfileConfig()
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  const addProfileItem = async (item: Partial<IProfileItem>): Promise<void> => {
    try {
      await add(item)
    } catch (e) {
      await showError(e, t('common.error.addProfileFailed'))
    } finally {
      mutateProfileConfig()
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  const removeProfileItem = async (id: string): Promise<void> => {
    try {
      await remove(id)
    } catch (e) {
      await showError(e, t('common.error.deleteProfileFailed'))
    } finally {
      mutateProfileConfig()
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  const updateProfileItem = async (item: IProfileItem): Promise<void> => {
    try {
      await update(item)
    } catch (e) {
      await showError(e, t('common.error.updateProfileFailed'))
    } finally {
      mutateProfileConfig()
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  const changeCurrentProfile = async (id: string): Promise<void> => {
    if (targetProfileId.current === id) {
      return
    }

    // 立即更新 UI 状态和托盘菜单，提供即时反馈
    if (profileConfig) {
      const optimisticUpdate = { ...profileConfig, current: id }
      mutateProfileConfig(optimisticUpdate, false)
      window.electron.ipcRenderer.send('updateTrayMenu')
    }

    targetProfileId.current = id
    await processChange()
  }

  const processChange = async () => {
    if (pendingTask.current) {
      return
    }

    while (targetProfileId.current) {
      const targetId = targetProfileId.current
      targetProfileId.current = null

      pendingTask.current = change(targetId)
      try {
        // 异步执行后台切换，不阻塞 UI
        await pendingTask.current
      } catch (e) {
        const errorMsg = (e as { message?: string })?.message || String(e)
        // 处理 IPC 超时错误
        if (errorMsg.includes('reply was never sent')) {
          setTimeout(() => mutateProfileConfig(), 1000)
        } else {
          await showError(errorMsg, t('common.error.switchProfileFailed'))
          mutateProfileConfig()
        }
      } finally {
        pendingTask.current = null
      }
    }
  }

  React.useEffect(() => {
    const handler = (): void => {
      mutateProfileConfig()
    }
    window.electron.ipcRenderer.on('profileConfigUpdated', handler)
    return (): void => {
      // 清理待处理任务，防止内存泄漏
      targetProfileId.current = null
      window.electron.ipcRenderer.removeListener('profileConfigUpdated', handler)
    }
  }, [])

  return (
    <ProfileConfigContext.Provider
      value={{
        profileConfig,
        setProfileConfig,
        mutateProfileConfig,
        addProfileItem,
        removeProfileItem,
        updateProfileItem,
        changeCurrentProfile
      }}
    >
      {children}
    </ProfileConfigContext.Provider>
  )
}

export const useProfileConfig = (): ProfileConfigContextType => {
  const context = useContext(ProfileConfigContext)
  if (context === undefined) {
    throw new Error('useProfileConfig must be used within a ProfileConfigProvider')
  }
  return context
}
