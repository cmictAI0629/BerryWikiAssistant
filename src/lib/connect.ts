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
  return ws
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
