import { createRoot } from 'react-dom/client'
import { useAppInfo } from './hooks/useAppInfo'

const App = () => {
  const { appInfo, loading, error } = useAppInfo()

  if (loading) {
    return <div>Loading app info...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Electron App Info</h2>
      {appInfo && (
        <ul>
          <li>Version: {appInfo.version}</li>
          <li>Platform: {appInfo.platform}</li>
          <li>Architecture: {appInfo.arch}</li>
        </ul>
      )}
    </div>
  )
}

const container = document.getElementById('root') || document.body
const root = createRoot(container)
root.render(<App />)
