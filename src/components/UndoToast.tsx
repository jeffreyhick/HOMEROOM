import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastState {
  message: string
  undo?: () => void
}

interface ToastContextValue {
  showToast: (message: string, undo?: () => void) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
const TOAST_DURATION_MS = 4500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, undo?: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, undo })
    timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }, [])

  function handleUndo() {
    if (timerRef.current) clearTimeout(timerRef.current)
    toast?.undo?.()
    setToast(null)
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${toast ? ' is-on' : ''}`}>
        <span>{toast?.message}</span>
        <button type="button" onClick={handleUndo} hidden={!toast?.undo}>
          Undo
        </button>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
