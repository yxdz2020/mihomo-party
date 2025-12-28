import { addProfileItem, getCurrentProfileItem, getProfileConfig } from '../config'
import { Cron } from 'croner'
import { logger } from '../utils/logger'

const intervalPool: Record<string, Cron | NodeJS.Timeout> = {}

export async function initProfileUpdater(): Promise<void> {
  const { items, current } = await getProfileConfig()
  const currentItem = await getCurrentProfileItem()

  for (const item of items.filter((i) => i.id !== current)) {
    if (item.type === 'remote' && item.autoUpdate && item.interval) {
      if (typeof item.interval === 'number') {
        // 数字间隔使用 setInterval
        intervalPool[item.id] = setInterval(
          async () => {
            try {
              await addProfileItem(item)
            } catch (e) {
              await logger.warn(`[ProfileUpdater] Failed to update profile ${item.name}:`, e)
            }
          },
          item.interval * 60 * 1000
        )
      } else if (typeof item.interval === 'string') {
        // 字符串间隔使用 Cron
        intervalPool[item.id] = new Cron(item.interval, async () => {
          try {
            await addProfileItem(item)
          } catch (e) {
            await logger.warn(`[ProfileUpdater] Failed to update profile ${item.name}:`, e)
          }
        })
      }

      try {
        await addProfileItem(item)
      } catch (e) {
        await logger.warn(`[ProfileUpdater] Failed to init profile ${item.name}:`, e)
      }
    }
  }

  if (currentItem?.type === 'remote' && currentItem.autoUpdate && currentItem.interval) {
    if (typeof currentItem.interval === 'number') {
      intervalPool[currentItem.id] = setInterval(
        async () => {
          try {
            await addProfileItem(currentItem)
          } catch (e) {
            await logger.warn(`[ProfileUpdater] Failed to update current profile:`, e)
          }
        },
        currentItem.interval * 60 * 1000
      )

      setTimeout(
        async () => {
          try {
            await addProfileItem(currentItem)
          } catch (e) {
            await logger.warn(`[ProfileUpdater] Failed to update current profile:`, e)
          }
        },
        currentItem.interval * 60 * 1000 + 10000 // +10s
      )
    } else if (typeof currentItem.interval === 'string') {
      intervalPool[currentItem.id] = new Cron(currentItem.interval, async () => {
        try {
          await addProfileItem(currentItem)
        } catch (e) {
          await logger.warn(`[ProfileUpdater] Failed to update current profile:`, e)
        }
      })
    }

    try {
      await addProfileItem(currentItem)
    } catch (e) {
      await logger.warn(`[ProfileUpdater] Failed to init current profile:`, e)
    }
  }
}

export async function addProfileUpdater(item: IProfileItem): Promise<void> {
  if (item.type === 'remote' && item.autoUpdate && item.interval) {
    if (intervalPool[item.id]) {
      if (intervalPool[item.id] instanceof Cron) {
        ;(intervalPool[item.id] as Cron).stop()
      } else {
        clearInterval(intervalPool[item.id] as NodeJS.Timeout)
      }
    }

    if (typeof item.interval === 'number') {
      intervalPool[item.id] = setInterval(
        async () => {
          try {
            await addProfileItem(item)
          } catch (e) {
            await logger.warn(`[ProfileUpdater] Failed to update profile ${item.name}:`, e)
          }
        },
        item.interval * 60 * 1000
      )
    } else if (typeof item.interval === 'string') {
      intervalPool[item.id] = new Cron(item.interval, async () => {
        try {
          await addProfileItem(item)
        } catch (e) {
          await logger.warn(`[ProfileUpdater] Failed to update profile ${item.name}:`, e)
        }
      })
    }
  }
}

export async function removeProfileUpdater(id: string): Promise<void> {
  if (intervalPool[id]) {
    if (intervalPool[id] instanceof Cron) {
      ;(intervalPool[id] as Cron).stop()
    } else {
      clearInterval(intervalPool[id] as NodeJS.Timeout)
    }
    delete intervalPool[id]
  }
}
