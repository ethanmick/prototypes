import { useCallback, useState } from 'react'
import { StreamChunk } from '../lib/ipc'

export const useStreamResponse = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<string>('')
  const [isDone, setIsDone] = useState(false)

  const streamResponse = useCallback(async (content: string) => {
    setLoading(true)
    setError(null)
    setResponse('')
    setIsDone(false)

    const cleanup = window.electron.streamResponse(
      content,
      (chunk: StreamChunk) => {
        if (chunk.type === 'chunk' && chunk.content) {
          setResponse((prev) => prev + chunk.content)
        } else if (chunk.type === 'done') {
          setIsDone(true)
          setLoading(false)
        } else if (chunk.error) {
          setError(chunk.error)
          setLoading(false)
        }
      }
    )

    // Cleanup when streaming is done
    return cleanup
  }, [])

  return { response, loading, error, isDone, streamResponse }
}
