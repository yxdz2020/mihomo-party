import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { IoCheckmark, IoClose, IoAlertSharp, IoInformationSharp } from 'react-icons/io5'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastData {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
  exiting?: boolean
}

type ToastListener = (toasts: ToastData[]) => void

let toasts: ToastData[] = []
let listeners: ToastListener[] = []

const notifyListeners = (): void => {
  listeners.forEach((listener) => listener([...toasts]))
}

const addToast = (type: ToastType, message: string, title?: string, duration = 1500): void => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  toasts = [...toasts.slice(-4), { id, type, message, title, duration }]
  notifyListeners()
}

const markExiting = (id: string): void => {
  toasts = toasts.map((t) => (t.id === id ? { ...t, exiting: true } : t))
  notifyListeners()
}

const removeToast = (id: string): void => {
  toasts = toasts.filter((t) => t.id !== id)
  notifyListeners()
}

export const toast = {
  success: (message: string, title?: string): void => addToast('success', message, title),
  error: (message: string, title?: string): void => addToast('error', message, title, 1800),
  warning: (message: string, title?: string): void => addToast('warning', message, title),
  info: (message: string, title?: string): void => addToast('info', message, title)
}

const ToastItem: React.FC<{
  data: ToastData
  onRemove: (id: string) => void
}> = ({ data, onRemove }) => {
  useEffect(() => {
    const duration = data.duration || 3500
    const exitTimer = setTimeout(() => markExiting(data.id), duration - 200)
    const removeTimer = setTimeout(() => onRemove(data.id), duration)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [data.id, data.duration, onRemove])

  const theme: Record<ToastType, { icon: React.ReactNode; bg: string; iconBg: string }> = {
    success: {
      icon: <IoCheckmark className="text-white text-sm" />,
      bg: 'bg-content1',
      iconBg: 'bg-success'
    },
    error: {
      icon: <IoClose className="text-white text-sm" />,
      bg: 'bg-content1', 
      iconBg: 'bg-danger'
    },
    warning: {
      icon: <IoAlertSharp className="text-white text-sm" />,
      bg: 'bg-content1',
      iconBg: 'bg-warning'
    },
    info: {
      icon: <IoInformationSharp className="text-white text-sm" />,
      bg: 'bg-content1',
      iconBg: 'bg-primary'
    }
  }

  const { icon, iconBg } = theme[data.type]
  const duration = data.duration || 3500

  return (
    <div
      className={`
        relative overflow-hidden
        flex items-center gap-3 p-3
        bg-content1/80 rounded-large
        shadow-large border border-default-200/50
        backdrop-blur-xl backdrop-saturate-150
        ${data.exiting ? 'toast-exit' : 'toast-enter'}
      `}
      style={{ width: 340 }}
    >
      <div className={`flex-shrink-0 w-7 h-7 ${iconBg} rounded-full flex items-center justify-center`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        {data.title && (
          <p className="text-sm font-medium text-foreground">{data.title}</p>
        )}
        <p className="text-sm text-foreground-500 break-words select-text">
          {data.message}
        </p>
      </div>
      <button
        onClick={() => {
          markExiting(data.id)
          setTimeout(() => onRemove(data.id), 150)
        }}
        className="flex-shrink-0 p-1 rounded-full hover:bg-default-200/60 transition-colors"
      >
        <IoClose className="text-base text-foreground-400" />
      </button>
      <div
        className={`absolute bottom-0 left-0 h-[2px] ${iconBg} toast-progress`}
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  )
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentToasts, setCurrentToasts] = useState<ToastData[]>([])

  const handleRemove = useCallback((id: string) => {
    removeToast(id)
  }, [])

  useEffect(() => {
    const listener: ToastListener = (newToasts) => setCurrentToasts(newToasts)
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  return (
    <>
      {children}
      {currentToasts.length > 0 &&
        createPortal(
          <div className="fixed top-[60px] right-4 z-[9999] flex flex-col gap-2">
            {currentToasts.map((t) => (
              <ToastItem key={t.id} data={t} onRemove={handleRemove} />
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
