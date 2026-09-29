import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

/** Markdown → 安全的 HTML（回答内容来自服务端 / 模型，必须过滤脚本与事件属性）。 */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source || '', { async: false }) as string
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
  // 链接一律新标签页打开
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
}
