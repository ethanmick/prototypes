import { useEffect, useState } from 'react'
import { AppInfo } from '../lib/ipc'

export const useAppInfo = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        const response = await window.electron.getAppInfo()
        if (response.success && response.data) {
          setAppInfo(response.data)
        } else {
          setError(response.error || 'Failed to fetch app info')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchAppInfo()
  }, [])

  return { appInfo, loading, error }
}
