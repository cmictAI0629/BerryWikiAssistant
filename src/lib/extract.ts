import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'

export interface ExtractResult {
  title: string
  markdown: string
  /** 摘要：剪藏预览、没有正文时兜底 */
  excerpt: string
}

function turndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  })
  // 脚本、样式、表单控件、隐藏内容都不要
  td.remove(['script', 'style', 'noscript', 'iframe', 'button', 'input', 'select', 'textarea', 'canvas'])
  td.remove((node) => node.nodeName.toLowerCase() === 'svg')
  // 简单表格转成 Markdown 表格（turndown 默认只输出纯文本）
  td.addRule('table', {
    filter: 'table',
    replacement(_content, node) {
      const rows = Array.from((node as HTMLTableElement).rows)
      if (!rows.length) return ''
      const cells = rows.map((r) => Array.from(r.cells).map((c) => (c.textContent || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()))
      const width = Math.max(...cells.map((r) => r.length))
      const line = (r: string[] = []) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`
      return `\n\n${line(cells[0])}\n| ${Array(width).fill('---').join(' | ')} |\n${cells.slice(1).map(line).join('\n')}\n\n`
    },
  })
  return td
}

/** 把相对链接、图片地址改成绝对地址，剪藏到知识库后还能点开。 */
function absolutize(root: Element, base: string) {
  root.querySelectorAll('a[href]').forEach((a) => {
    try { a.setAttribute('href', new URL(a.getAttribute('href') || '', base).href) } catch { /* 保留原样 */ }
  })
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || ''
    if (!src || src.startsWith('data:')) { img.remove(); return }
    try { img.setAttribute('src', new URL(src, base).href) } catch { img.remove() }
  })
}

function tidy(markdown: string): string {
  return markdown
    .replace(/^(\s*)([-*+]|\d+\.)[ \t]{2,}/gm, '$1$2 ') // turndown 在列表符号后补了三个空格
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

/** 智能剪藏：用 Readability 提取正文，转成 Markdown。提取不到正文时退回整页文字。 */
export function extractArticle(doc: Document = document): ExtractResult {
  const clone = doc.cloneNode(true) as Document
  const article = new Readability(clone, { charThreshold: 200 }).parse()
  const title = (article?.title || doc.title || '').trim()
  if (article?.content) {
    const container = doc.createElement('div')
    container.innerHTML = article.content
    absolutize(container, doc.baseURI)
    return {
      title,
      markdown: tidy(turndown().turndown(container)),
      excerpt: (article.excerpt || article.textContent || '').trim().slice(0, 200),
    }
  }
  const text = (doc.body?.innerText || '').trim()
  return { title, markdown: text, excerpt: text.slice(0, 200) }
}

export interface Rect { left: number; top: number; width: number; height: number }

function isVisible(el: Element): boolean {
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

/**
 * 框选剪藏：取完全落在选区里的最外层元素（按文档顺序），转成 Markdown。
 * 选区是视口坐标；判断时放宽 2px，避免边框压线的元素被漏掉。
 */
export function extractRegion(rect: Rect, doc: Document = document, ignore?: Element): ExtractResult {
  const tol = 2
  const inside = (r: DOMRect) =>
    r.left >= rect.left - tol && r.top >= rect.top - tol
    && r.right <= rect.left + rect.width + tol && r.bottom <= rect.top + rect.height + tol
  const picked: Element[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
  let node = walker.nextNode() as Element | null
  while (node) {
    if (ignore && (node === ignore || ignore.contains(node))) {
      node = (walker.nextSibling() as Element | null) ?? nextOutside(walker)
      continue
    }
    if (isVisible(node) && inside(node.getBoundingClientRect())) {
      picked.push(node)
      // 已经整体选中，子元素不必再看
      node = (walker.nextSibling() as Element | null) ?? nextOutside(walker)
      continue
    }
    node = walker.nextNode() as Element | null
  }
  const container = doc.createElement('div')
  picked.forEach((el) => container.appendChild(el.cloneNode(true)))
  absolutize(container, doc.baseURI)
  const markdown = tidy(turndown().turndown(container))
  return { title: doc.title.trim(), markdown, excerpt: (container.textContent || '').trim().slice(0, 200) }
}

/** TreeWalker 跳过当前子树：往上找到有下一个兄弟的祖先。 */
function nextOutside(walker: TreeWalker): Element | null {
  while (walker.parentNode()) {
    const sib = walker.nextSibling()
    if (sib) return sib as Element
  }
  return null
}
