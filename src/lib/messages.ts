/**
 * 后台（background）与网页内剪藏界面（content script）之间的消息。
 * 请求一律由后台代发：网页里直接 fetch 会受该网页 CORS 的限制；截图也只有后台能调 captureVisibleTab。
 */
import { browser } from 'wxt/browser'
import type { Knowledge, KnowledgeBase } from './api'

/** 后台 → 网页：打开剪藏界面 */
export type ClipCommand =
  | { type: 'bw:region-clip' }
  | { type: 'bw:smart-clip' }
  | { type: 'bw:selection-clip'; text: string }

export interface SaveClipPayload {
  kbId: string
  title: string
  markdown: string
  source: string
  /** 框选截图（PNG data URL）；勾选「同时保存截图」时一起上传 */
  screenshot?: string
}

/** 网页 → 后台 */
export type BackgroundRequest =
  | { type: 'bw:capture' }
  | { type: 'bw:clip-context' }
  | { type: 'bw:save-clip'; payload: SaveClipPayload }
  | { type: 'bw:open-options' }
  /** 选中文字工具条：保存选中内容（打开剪藏窗口）/ 拿选中内容去问知识助手（打开侧边栏） */
  | { type: 'bw:selection-save'; text: string }
  | { type: 'bw:selection-ask'; text: string }

export interface ClipContext {
  configured: boolean
  knowledgeBases: KnowledgeBase[]
  defaultKbId: string
  webBaseUrl: string
}

export type BackgroundResponse<T> = { ok: true; data: T } | { ok: false; error: string }

export interface SaveClipResult {
  knowledge: Knowledge
  screenshotSaved: boolean
}

/** 内容脚本调后台，把 {ok,error} 还原成异常 */
export async function callBackground<T>(req: BackgroundRequest): Promise<T> {
  let res: BackgroundResponse<T> | undefined
  try {
    res = (await browser.runtime.sendMessage(req)) as BackgroundResponse<T> | undefined
  } catch (e) {
    // 扩展重新加载 / 升级后，网页里旧的剪藏界面和扩展断开了
    if (/Receiving end does not exist|Extension context invalidated|Could not establish connection/i.test(String((e as Error)?.message ?? e))) {
      throw new Error('BerryWiki 知识助手刚更新过，和这个网页断开了连接。请刷新网页后再剪藏（已编辑的内容可先复制出来）')
    }
    throw e
  }
  if (!res) throw new Error('扩展后台没有响应，请刷新页面后重试')
  if (!res.ok) throw new Error(res.error)
  return res.data
}
