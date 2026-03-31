import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react'

type PageHeaderValue = {
  subtitle: string | null
  setSubtitle: (value: string | null) => void
  headerActions: ReactNode | null
  setHeaderActions: (value: ReactNode | null) => void
}

export const PageHeaderContext = createContext<PageHeaderValue | null>(null)

export function PageHeaderProvider({ children }: PropsWithChildren) {
  const [subtitle, setSubtitleState] = useState<string | null>(null)
  const [headerActions, setHeaderActionsState] = useState<ReactNode | null>(null)
  const setSubtitle = useCallback((value: string | null) => {
    setSubtitleState(value)
  }, [])
  const setHeaderActions = useCallback((value: ReactNode | null) => {
    setHeaderActionsState(value)
  }, [])
  const value = useMemo(
    () => ({ subtitle, setSubtitle, headerActions, setHeaderActions }),
    [subtitle, setSubtitle, headerActions, setHeaderActions],
  )
  return (
    <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
  )
}

export function usePageHeader(): PageHeaderValue {
  const ctx = useContext(PageHeaderContext)
  if (!ctx) {
    throw new Error('usePageHeader must be used within PageHeaderProvider')
  }
  return ctx
}
