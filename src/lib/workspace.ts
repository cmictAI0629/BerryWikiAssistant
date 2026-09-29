import { storage } from 'wxt/utils/storage'
import { getMe, listAgents, listKnowledgeBases, type Agent, type KnowledgeBase, type Me } from './api'
import { getSettings } from './settings'

export interface Workspace {
  me: Me
  knowledgeBases: KnowledgeBase[]
  agents: Agent[]
  /** 缓存对应的连接（换了服务器或 Key 就作废） */
  connection: string
  at: number
}

// 缓存在 session 区：弹出面板每次打开都是新页面，有缓存就先显示、后台再刷新
const cacheItem = storage.defineItem<Workspace | null>('session:workspace', { fallback: null })
const TTL = 5 * 60_000

async function connectionKey(): Promise<string> {
  const s = await getSettings()
  return `${s.baseUrl}|${s.apiKey.slice(-8)}`
}

export async function cachedWorkspace(): Promise<Workspace | null> {
  const [cached, key] = await Promise.all([cacheItem.getValue(), connectionKey()])
  return cached && cached.connection === key && Date.now() - cached.at < TTL ? cached : null
}

export async function loadWorkspace(): Promise<Workspace> {
  const [me, knowledgeBases, agents] = await Promise.all([getMe(), listKnowledgeBases(), listAgents()])
  const ws: Workspace = { me, knowledgeBases, agents, connection: await connectionKey(), at: Date.now() }
  await cacheItem.setValue(ws)
  return ws
}

export async function clearWorkspaceCache() {
  await cacheItem.setValue(null)
}

/** 剪藏、速记只能写文档型 / Wiki 知识库（FAQ 库不接受文件与网页） */
export function writableKnowledgeBases(kbs: KnowledgeBase[]): KnowledgeBase[] {
  return kbs.filter((kb) => kb.type !== 'faq')
}

export function displayName(me?: Me): string {
  return me?.user?.username || me?.user?.email || me?.tenant?.name || 'OneBerryWiki'
}

/** 「3 分钟前」「昨天」「9月22日」 */
export function relativeTime(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`
  if (diff < 2 * 86400_000) return '昨天'
  const d = new Date(t)
  return d.getFullYear() === new Date().getFullYear() ? `${d.getMonth() + 1}月${d.getDate()}日` : d.toLocaleDateString('zh-CN')
}
