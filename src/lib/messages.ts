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
  const res = (await browser.runtime.sendMessage(req)) as BackgroundResponse<T> | undefined
  if (!res) throw new Error('扩展后台没有响应，请刷新页面后重试')
  if (!res.ok) throw new Error(res.error)
  return res.data
}
