import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'
import { getMe } from './api'
import { DEFAULT_SETTINGS, getSettings, normalizeBaseUrl, saveSettings } from './settings'
import { clearWorkspaceCache, loadWorkspace, writableKnowledgeBases, type Workspace } from './workspace'

/**
 * 登录：先用填的地址和 Key 调 /auth/me 验证，通过了才保存（填错不会把原来能用的连接覆盖掉）。
 * 保存后拉一次知识库和智能体，顺手补上默认知识库、默认智能体。
 */
export async function connect(baseUrlInput: string, apiKeyInput: string): Promise<Workspace> {
  const baseUrl = normalizeBaseUrl(baseUrlInput)
  const apiKey = apiKeyInput.trim()
  if (!baseUrl) throw new Error('请填写服务器地址')
  if (!apiKey) throw new Error('请填写 API Key')
  await getMe({ ...DEFAULT_SETTINGS, baseUrl, apiKey })
  const prev = await getSettings()
  await saveSettings({ baseUrl, apiKey })
  await clearWorkspaceCache()
  const ws = await loadWorkspace()
  await saveSettings(pickDefaults(ws, prev.defaultKbId, prev.defaultAgentId))
  await Promise.all([loginDraftItem.setValue(null), keyDraftItem.setValue('')])
  return ws
}

/**
 * 登录表单的草稿。弹出面板一失焦就会被浏览器关掉：填完地址去网页上复制 Key，回来地址就没了。
 * 所以边填边存：地址存 local；Key 只存 session（内存里，浏览器关了就没），登录成功后都清掉。
 */
export const loginDraftItem = storage.defineItem<{ baseUrl: string; form: boolean } | null>('local:loginDraft', { fallback: null })
export const keyDraftItem = storage.defineItem<string>('session:loginKeyDraft', { fallback: '' })

/**
 * 当前标签页如果就是 OneBerryWiki（用户多半正开着它复制 Key），返回它的网页地址，否则返回空串。
 * 新版服务端带扩展安装包的版本记录，一看便知；老版本退而看未登录时 /auth/me 的 401 报错（这句是 OneBerryWiki 特有的）。
 */
export async function detectServerFromActiveTab(): Promise<string> {
  let origin = ''
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    const url = tab?.url ? new URL(tab.url) : null
    if (!url || !/^https?:$/.test(url.protocol)) return ''
    origin = url.origin
  } catch {
    return ''
  }
  const get = (path: string) => fetch(`${origin}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
  try {
    const res = await get('/downloads/berrywiki-assistant/release.json')
    const data = res.ok ? await res.json() : null
    if (typeof data?.repository === 'string' && data.repository.includes('BerryWikiAssistant')) return origin
  } catch { /* 不是 JSON（前端把未知路径回退成 index.html）或请求失败，继续看下一种 */ }
  try {
    const res = await get('/api/v1/auth/me')
    const data = res.status === 401 ? await res.json() : null
    if (typeof data?.error === 'string' && data.error.includes('missing authentication')) return origin
  } catch { /* 识别不出来就算了 */ }
  return ''
}

/** 退出登录：只清掉 Key，服务器地址留着，下次登录不用重填。 */
export async function logout() {
  await saveSettings({ apiKey: '' })
  await clearWorkspaceCache()
}

/** 默认知识库、智能体没设或已经不存在时，换成第一个可写知识库和智能推理。 */
export function pickDefaults(ws: Workspace, kbId: string, agentId: string) {
  const kbs = writableKnowledgeBases(ws.knowledgeBases)
  return {
    defaultKbId: kbs.some((k) => k.id === kbId) ? kbId : kbs[0]?.id || '',
    defaultAgentId: ws.agents.some((a) => a.id === agentId)
      ? agentId
      : ws.agents.find((a) => a.id === 'builtin-smart-reasoning')?.id || ws.agents[0]?.id || '',
  }
}
