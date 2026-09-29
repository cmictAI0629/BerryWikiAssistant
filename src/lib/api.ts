/**
 * OneBerryWiki API 客户端（只在扩展页面和后台里用；内容脚本通过 runtime 消息让后台代发，避开网页的 CORS）。
 *
 * 认证：请求头 X-API-Key。工作空间 Key 自带空间，不要发 X-Tenant-ID。
 * 需要的 Key 能力：retrieve（列知识库、查入库进度）、chat（会话、问答、列智能体）、ingest（剪藏、速记）。
 */
import { getSettings, type Settings } from './settings'

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
  }
}

export const CHANNEL = 'browser_extension'

async function request<T>(path: string, init: RequestInit = {}, settings?: Settings): Promise<T> {
  const s = settings ?? (await getSettings())
  if (!s.baseUrl || !s.apiKey) throw new ApiError('还没有连接 OneBerryWiki，请先在设置里填写服务器地址和 API Key', 0)
  let res: Response
  try {
    res = await fetch(`${s.baseUrl}${path}`, {
      ...init,
      headers: {
        'X-API-Key': s.apiKey,
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(`连不上服务器（${s.baseUrl}），请检查地址和网络`, 0)
  }
  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { /* 非 JSON */ }
  if (!res.ok || body?.success === false) {
    // 三种错误格式：{success:false,error:{message}} / {error:"..."} / {message:"..."}
    const message = body?.error?.message || (typeof body?.error === 'string' ? body.error : '') || body?.message
      || `请求失败（HTTP ${res.status}）`
    throw new ApiError(friendlyError(res.status, message), res.status, body?.code)
  }
  return body as T
}

function friendlyError(status: number, message: string): string {
  if (status === 401) return 'API Key 无效或已被吊销，请检查后重新登录'
  if (status === 403 && /scope/i.test(message)) return 'API Key 的权限不够：需要「检索知识库」「对话能力」「写入知识库内容」，或完整权限'
  return message
}

// ---------------------------------------------------------------- 类型

export interface Me {
  user?: { id: string; username?: string; email?: string; avatar?: string }
  tenant?: { id: number; name?: string }
}

export interface KnowledgeBase {
  id: string
  name: string
  type?: 'document' | 'faq' | 'wiki'
  description?: string
  is_temporary?: boolean
  knowledge_count?: number
}

export interface Agent {
  id: string
  name: string
  description?: string
  avatar?: string
  is_builtin?: boolean
  config?: { agent_mode?: 'quick-answer' | 'smart-reasoning'; image_upload_enabled?: boolean }
}

export interface Knowledge {
  id: string
  knowledge_base_id: string
  type?: 'file' | 'url' | 'manual'
  title?: string
  file_name?: string
  source?: string
  parse_status?: string
  error_message?: string
  created_at?: string
  updated_at?: string
}

export interface Reference {
  id: string
  content?: string
  knowledge_id?: string
  knowledge_title?: string
  knowledge_filename?: string
  knowledge_source?: string
  knowledge_base_id?: string
  score?: number
}

export interface StreamEvent {
  id?: string
  response_type: string
  content?: string
  done?: boolean
  session_id?: string
  assistant_message_id?: string
  knowledge_references?: Reference[]
  data?: Record<string, any>
}

// ---------------------------------------------------------------- 接口

/** 测试连接 / 当前身份：任何有效 Key 都能调 */
export async function getMe(settings?: Settings): Promise<Me> {
  return (await request<{ data: Me }>('/auth/me', {}, settings)).data
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const res = await request<{ data: KnowledgeBase[] }>('/knowledge-bases')
  return (res.data || []).filter((kb) => !kb.is_temporary)
}

// 这两个内置智能体是系统内部用的（修 Wiki、装技能），不给用户在扩展里选
const HIDDEN_AGENTS = new Set(['builtin-wiki-fixer', 'builtin-skill-installer'])

export async function listAgents(): Promise<Agent[]> {
  const res = await request<{ data: Agent[]; disabled_own_agent_ids?: string[] }>('/agents')
  const disabled = new Set(res.disabled_own_agent_ids || [])
  return (res.data || []).filter((a) => !HIDDEN_AGENTS.has(a.id) && !disabled.has(a.id))
}

export async function listRecentKnowledge(kbId: string, pageSize = 3): Promise<Knowledge[]> {
  const q = new URLSearchParams({ page: '1', page_size: String(pageSize), sort_by: 'updated_at', sort_order: 'desc' })
  return (await request<{ data: Knowledge[] }>(`/knowledge-bases/${encodeURIComponent(kbId)}/knowledge?${q}`)).data || []
}

export async function getKnowledge(id: string): Promise<Knowledge> {
  return (await request<{ data: Knowledge }>(`/knowledge/${encodeURIComponent(id)}`)).data
}

/** 速记 / 剪藏正文：Markdown，最多 20 万字。必须 status=publish，否则只存成草稿、不会建索引。 */
export async function createManualKnowledge(kbId: string, title: string, content: string): Promise<Knowledge> {
  return (await request<{ data: Knowledge }>(`/knowledge-bases/${encodeURIComponent(kbId)}/knowledge/manual`, {
    method: 'POST',
    body: JSON.stringify({ title, content, status: 'publish', channel: CHANNEL }),
  })).data
}

/** 保存链接：由服务器去抓取网页（需要登录、内网的页面抓不到，那种情况用正文剪藏） */
export async function importUrl(kbId: string, url: string, title?: string): Promise<Knowledge> {
  return (await request<{ data: Knowledge }>(`/knowledge-bases/${encodeURIComponent(kbId)}/knowledge/url`, {
    method: 'POST',
    body: JSON.stringify({ url, title: title || undefined, channel: CHANNEL }),
  })).data
}

export async function uploadFile(kbId: string, file: Blob, fileName: string): Promise<Knowledge> {
  const form = new FormData()
  form.append('file', file, fileName)
  form.append('fileName', fileName)
  form.append('channel', CHANNEL)
  return (await request<{ data: Knowledge }>(`/knowledge-bases/${encodeURIComponent(kbId)}/knowledge/file`, {
    method: 'POST',
    body: form,
  })).data
}

export async function createSession(title: string): Promise<string> {
  return (await request<{ data: { id: string } }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })).data.id
}

export async function stopGeneration(sessionId: string, messageId: string): Promise<void> {
  await request(`/sessions/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  })
}

/** 智能推理模式不在流里推送引用，结束后从消息记录里取 */
export async function loadAssistantReferences(sessionId: string, messageId: string): Promise<Reference[]> {
  const res = await request<{ data: any[] }>(`/messages/${encodeURIComponent(sessionId)}/load?limit=10`)
  const msg = (res.data || []).find((m) => m.id === messageId)
  return msg?.knowledge_references || []
}

export interface AskOptions {
  query: string
  agentId: string
  knowledgeBaseIds?: string[]
  images?: string[] // data:image/png;base64,...
  signal?: AbortSignal
  onEvent: (e: StreamEvent) => void
}

/**
 * 流式问答：POST /agent-chat/:session_id，带 agent_id 时按智能体自己的模式走（快速问答或智能推理）。
 * 返回 SSE（event:message / data:{...}），浏览器的 EventSource 不能 POST，所以用 fetch 读流自己拆行。
 * 以 complete、带 done 的 error、stop 为结束。
 */
export async function askStream(sessionId: string, opts: AskOptions): Promise<void> {
  const s = await getSettings()
  if (!s.baseUrl || !s.apiKey) throw new ApiError('还没有连接 OneBerryWiki', 0)
  const body = {
    query: opts.query,
    agent_id: opts.agentId,
    agent_enabled: true,
    knowledge_base_ids: opts.knowledgeBaseIds?.length ? opts.knowledgeBaseIds : undefined,
    images: opts.images?.length ? opts.images.map((data) => ({ data })) : undefined,
    channel: 'api',
  }
  let res: Response
  try {
    res = await fetch(`${s.baseUrl}/agent-chat/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'X-API-Key': s.apiKey, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw new ApiError(`连不上服务器（${s.baseUrl}）`, 0)
  }
  if (!res.ok || !res.body) {
    let message = `提问失败（HTTP ${res.status}）`
    try {
      const j = await res.json()
      message = j?.error?.message || j?.error || j?.message || message
    } catch { /* ignore */ }
    throw new ApiError(friendlyError(res.status, message), res.status)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const block = buffer.slice(0, idx)
        buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, '')
        const data = block.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n')
        if (!data) continue
        let event: StreamEvent
        try { event = JSON.parse(data) } catch { continue }
        opts.onEvent(event)
        if (event.response_type === 'complete' || event.response_type === 'stop'
          || (event.response_type === 'error' && event.done)) {
          await reader.cancel().catch(() => {})
          return
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  }
}
