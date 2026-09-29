import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askStream, createManualKnowledge, type StreamEvent } from '@/lib/api'
import { normalizeBaseUrl, saveSettings, webBaseUrl } from '@/lib/settings'

const BASE = 'http://wiki.test/api/v1'

function sseResponse(chunks: string[]): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(enc.encode(c)))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

const ev = (o: object) => `event:message\ndata:${JSON.stringify(o)}\n\n`

describe('settings', () => {
  it('normalizes whatever the user pastes into an /api/v1 base URL', () => {
    expect(normalizeBaseUrl('http://10.0.0.8:15481')).toBe('http://10.0.0.8:15481/api/v1')
    expect(normalizeBaseUrl('http://10.0.0.8:15481/api/v1/')).toBe('http://10.0.0.8:15481/api/v1')
    expect(normalizeBaseUrl(' wiki.example.com ')).toBe('http://wiki.example.com/api/v1')
    expect(normalizeBaseUrl('https://wiki.example.com')).toBe('https://wiki.example.com/api/v1')
    expect(normalizeBaseUrl('')).toBe('')
    expect(webBaseUrl('https://wiki.example.com/api/v1')).toBe('https://wiki.example.com')
  })
})

describe('api', () => {
  beforeEach(async () => {
    await saveSettings({ baseUrl: BASE, apiKey: 'sk-test' })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('parses SSE events split across arbitrary chunk boundaries and stops at complete', async () => {
    const body = ev({ response_type: 'agent_query', assistant_message_id: 'm1', done: true })
      + ev({ response_type: 'answer', content: '你好', done: false })
      + ev({ response_type: 'answer', content: '，世界', done: true })
      + ev({ response_type: 'complete', done: true, data: { final_content: '你好，世界' } })
      + ev({ response_type: 'answer', content: '不该读到这里' })
    // 按 7 字节切，保证有事件被切成两半（含多字节汉字被切开）
    const bytes = new TextEncoder().encode(body)
    const dec = new TextDecoder()
    const chunks: string[] = []
    for (let i = 0; i < bytes.length; i += 7) chunks.push(dec.decode(bytes.slice(i, i + 7), { stream: true }))
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(chunks))
    vi.stubGlobal('fetch', fetchMock)

    const events: StreamEvent[] = []
    await askStream('s1', { query: '问题', agentId: 'builtin-smart-reasoning', onEvent: (e) => events.push(e) })

    expect(events.map((e) => e.response_type)).toEqual(['agent_query', 'answer', 'answer', 'complete'])
    expect(events.filter((e) => e.response_type === 'answer').map((e) => e.content).join('')).toBe('你好，世界')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${BASE}/agent-chat/s1`)
    expect(init.headers['X-API-Key']).toBe('sk-test')
    expect(JSON.parse(init.body)).toMatchObject({ query: '问题', agent_id: 'builtin-smart-reasoning', agent_enabled: true })
  })

  it('treats an error event with done as the end of the stream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([
      ev({ response_type: 'error', content: '模型不可用', done: true }),
      ev({ response_type: 'answer', content: 'x' }),
    ])))
    const events: StreamEvent[] = []
    await askStream('s1', { query: 'q', agentId: 'a', onEvent: (e) => events.push(e) })
    expect(events).toHaveLength(1)
    expect(events[0]!.content).toBe('模型不可用')
  })

  it('publishes manual knowledge so it gets indexed (status=publish)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 'k1' } })))
    vi.stubGlobal('fetch', fetchMock)
    await createManualKnowledge('kb1', '标题', '# 正文')
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body).toEqual({ title: '标题', content: '# 正文', status: 'publish', channel: 'browser_extension' })
  })

  it('turns the three server error shapes into readable messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized: invalid API key' }), { status: 401 })))
    await expect(createManualKnowledge('kb1', 't', 'c')).rejects.toThrow(/API Key 无效/)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Forbidden: API key scope does not allow this operation' }), { status: 403 })))
    await expect(createManualKnowledge('kb1', 't', 'c')).rejects.toThrow(/权限不够/)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 400, message: '内容不能为空' } }), { status: 400 })))
    await expect(createManualKnowledge('kb1', 't', 'c')).rejects.toThrow('内容不能为空')
  })
})
