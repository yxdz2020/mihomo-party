import React, { createContext, useContext, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { showError } from '@renderer/utils/error-display'
import useSWR from 'swr'
import {
  getOverrideConfig,
  setOverrideConfig as set,
  addOverrideItem as add,
  removeOverrideItem as remove,
  updateOverrideItem as update
} from '@renderer/utils/ipc'

interface OverrideConfigContextType {
  overrideConfig: IOverrideConfig | undefined
  setOverrideConfig: (config: IOverrideConfig) => Promise<void>
  mutateOverrideConfig: () => void
  addOverrideItem: (item: Partial<IOverrideItem>) => Promise<void>
  updateOverrideItem: (item: IOverrideItem) => Promise<void>
  removeOverrideItem: (id: string) => Promise<void>
}

const OverrideConfigContext = createContext<OverrideConfigContextType | undefined>(undefined)

export const OverrideConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
  const { data: overrideConfig, mutate: mutateOverrideConfig } = useSWR('getOverrideConfig', () =>
    getOverrideConfig()
  )

  const setOverrideConfig = async (config: IOverrideConfig): Promise<void> => {
    try {
      await set(config)
    } catch (e) {
      await showError(e, t('common.error.saveOverrideConfigFailed'))
    } finally {
      mutateOverrideConfig()
    }
  }

  const addOverrideItem = async (item: Partial<IOverrideItem>): Promise<void> => {
    try {
      await add(item)
    } catch (e) {
      await showError(e, t('common.error.addOverrideFailed'))
    } finally {
      mutateOverrideConfig()
    }
  }

  const removeOverrideItem = async (id: string): Promise<void> => {
    try {
      await remove(id)
    } catch (e) {
      await showError(e, t('common.error.deleteOverrideFailed'))
    } finally {
      mutateOverrideConfig()
    }
  }

  const updateOverrideItem = async (item: IOverrideItem): Promise<void> => {
    try {
      await update(item)
    } catch (e) {
      await showError(e, t('common.error.updateOverrideFailed'))
    } finally {
      mutateOverrideConfig()
    }
  }

  return (
    <OverrideConfigContext.Provider
      value={{
        overrideConfig,
        setOverrideConfig,
        mutateOverrideConfig,
        addOverrideItem,
        removeOverrideItem,
        updateOverrideItem
      }}
    >
      {children}
    </OverrideConfigContext.Provider>
  )
}

export const useOverrideConfig = (): OverrideConfigContextType => {
  const context = useContext(OverrideConfigContext)
  if (context === undefined) {
    throw new Error('useOverrideConfig must be used within an OverrideConfigProvider')
  }
  return context
}
