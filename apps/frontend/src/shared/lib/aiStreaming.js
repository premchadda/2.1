/**
 * AI Streaming Service - SSE-based streaming for AI mentor chat
 * Uses native fetch with ReadableStream for Server-Sent Events
 *
 * SECURITY: Auth relies on httpOnly cookies (sent automatically via
 * `credentials: 'include'`). The previous `getAuthToken()` read from
 * localStorage — a dead key that contradicted the cookie auth model and
 * would be XSS-stealable if ever populated. Removed.
 */

import { API_BASE_URL } from './apiBase'
import { getCsrfToken } from '@trstprep/shared-config'

const STREAM_ENDPOINT = '/api/ai/mentor/chat/stream'

export function isStreamingSupported() {
  return (
    typeof window !== 'undefined' &&
    'ReadableStream' in window &&
    'fetch' in window
  )
}

function buildHeaders(csrfToken) {
  const headers = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('trstprep_auth_token') || localStorage.getItem('trstprep_token')
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }
  return headers
}

function parseSSELine(line) {
  if (!line.startsWith('data: ')) return null
  const payload = line.slice(6).trim()
  if (payload === '[DONE]') return { done: true }
  try {
    return JSON.parse(payload)
  } catch {
    return { text: payload }
  }
}

/**
 * Stream chat messages via SSE using ReadableStream.
 * Calls onChunk({ text, done, raw }) for each parsed event.
 * Returns an AbortController so the caller can cancel.
 */
export function streamChat(messages, onChunk, conversationId = null) {
  const controller = new AbortController()

  ;(async () => {
    try {
      const csrfToken = getCsrfToken()
      const res = await fetch(`${API_BASE_URL}${STREAM_ENDPOINT}`, {
        method: 'POST',
        headers: buildHeaders(csrfToken),
        body: JSON.stringify({ messages, conversationId }),
        signal: controller.signal,
        credentials: 'include'
      })

      if (!res.ok) {
        const err = await res.text()
        onChunk({ text: '', done: true, error: err || `HTTP ${res.status}` })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done: streamDone } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const event = parseSSELine(trimmed)
          if (!event) continue
          if (event.done) {
            onChunk({ text: '', done: true, raw: event })
            return
          }
          onChunk({ text: event.content || event.text || '', done: false, raw: event })
        }
      }

      if (buffer.trim()) {
        const event = parseSSELine(buffer.trim())
        if (event && !event.done) {
          onChunk({ text: event.content || event.text || '', done: false, raw: event })
        }
      }
      onChunk({ text: '', done: true, raw: null })
    } catch (err) {
      if (err.name !== 'AbortError') {
        onChunk({ text: '', done: true, error: err.message })
      }
    }
  })()

  return controller
}

/**
 * Async iterator wrapper around streamChat.
 * Yields { text, done } objects.
 */
export async function* streamChatAsync(messages) {
  const _controller = new AbortController()
  const queue = []
  let resolve = null
  let error = null
  let finished = false

  const push = (chunk) => {
    if (chunk.error) {
      error = chunk.error
      finished = true
    } else if (chunk.done) {
      finished = true
    } else if (chunk.text) {
      queue.push(chunk.text)
    }
    if (resolve) {
      resolve()
      resolve = null
    }
  }

  streamChat(messages, push)

  while (!finished || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise((r) => { resolve = r })
    }
    while (queue.length > 0) {
      yield { text: queue.shift(), done: false }
    }
  }

  if (error) throw new Error(error)
  yield { text: '', done: true }
}
