import { storage } from 'wxt/utils/storage'

/**
 * 从弹出面板或右键菜单「转交」给侧边栏的问题。侧边栏打开后读取并清空。
 * 存在 session 区：浏览器关闭就没了，不会在下次打开时冒出一个旧问题。
 */
export interface PendingQuestion {
  query: string
  agentId?: string
  knowledgeBaseIds?: string[]
  at: number
}

export const pendingQuestionItem = storage.defineItem<PendingQuestion | null>('session:pendingQuestion', { fallback: null })

export async function setPendingQuestion(query: string, extra: Partial<PendingQuestion> = {}) {
  await pendingQuestionItem.setValue({ query, ...extra, at: Date.now() })
}

export async function takePendingQuestion(): Promise<PendingQuestion | null> {
  const value = await pendingQuestionItem.getValue()
  if (!value) return null
  await pendingQuestionItem.setValue(null)
  // 超过 1 分钟的不算（比如侧边栏当时没打开成功）
  return Date.now() - value.at < 60_000 ? value : null
}

/** 侧边栏该显示哪一页（弹出面板的「速记」按钮打开侧边栏时用） */
export type SidePanelTab = 'chat' | 'note'
export const pendingTabItem = storage.defineItem<SidePanelTab | null>('session:pendingTab', { fallback: null })

export async function setPendingTab(tab: SidePanelTab) {
  await pendingTabItem.setValue(tab)
}

export async function takePendingTab(): Promise<SidePanelTab | null> {
  const tab = await pendingTabItem.getValue()
  if (tab) await pendingTabItem.setValue(null)
  return tab
}
