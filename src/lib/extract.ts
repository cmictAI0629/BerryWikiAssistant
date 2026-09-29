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

/** 用 Readability 提取正文，转成 Markdown；提取不到返回 null。 */
export function readArticle(doc: Document = document): ExtractResult | null {
  const clone = doc.cloneNode(true) as Document
  const article = new Readability(clone, { charThreshold: 200 }).parse()
  if (!article?.content) return null
  const container = doc.createElement('div')
  container.innerHTML = article.content
  absolutize(container, doc.baseURI)
  return {
    title: (article.title || doc.title || '').trim(),
    markdown: tidy(turndown().turndown(container)),
    excerpt: (article.excerpt || article.textContent || '').trim().slice(0, 200),
  }
}

/** 只取正文；提取不到正文时退回整页。 */
export function extractArticle(doc: Document = document, ignore?: Element): ExtractResult {
  return readArticle(doc) ?? extractPage(doc, ignore)
}

// ---- 整页：保留页面上所有正文性质的内容，去掉导航、侧栏、页眉页脚、按钮输入框等「界面零件」 ----

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED',
  'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'NAV', 'ASIDE', 'DIALOG', 'LINK', 'META'])
const SKIP_ROLES = new Set(['navigation', 'banner', 'contentinfo', 'complementary', 'menu', 'menubar', 'toolbar',
  'tablist', 'dialog', 'alertdialog', 'search', 'tooltip'])
/** 类名 / id 像界面零件的（Readability 的 unlikelyCandidates 思路）。只在它不占页面大半文字时才去掉。 */
const CHROME_NAME = /(^|[-_\s])(aside|sidebar|side-bar|sidenav|navbar|nav|menu|menubar|breadcrumbs?|toolbar|topbar|footer|header|banner|cookie|popup|modal|tooltip|dropdown|share|social|advert|ads)([-_\s]|$)/i

function skipElement(el: Element, bodyTextLen: number, inArticle: boolean): boolean {
  if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true
  const role = el.getAttribute('role')
  if (role && SKIP_ROLES.has(role)) return true
  if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) return true
  if ((el as HTMLElement).isContentEditable && el.getAttribute('contenteditable') !== null) return true
  if (!inArticle && (el.tagName === 'HEADER' || el.tagName === 'FOOTER')) return true
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return true
  if (!inArticle) {
    const name = `${typeof el.className === 'string' ? el.className : ''} ${el.id}`
    if (CHROME_NAME.test(name) && (el.textContent?.length ?? 0) < bodyTextLen * 0.4) return true
  }
  return false
}

function cloneVisible(node: Node, doc: Document, bodyTextLen: number, ignore: Element | undefined, inArticle: boolean): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return node.cloneNode()
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as Element
  if (el === ignore || skipElement(el, bodyTextLen, inArticle)) return null
  const copy = el.cloneNode(false) as Element
  const nextInArticle = inArticle || el.tagName === 'ARTICLE' || el.tagName === 'MAIN' || el.getAttribute('role') === 'main'
  // 影子 DOM 里的内容（Web Components）也带上
  const children = el.shadowRoot ? [...el.shadowRoot.childNodes, ...el.childNodes] : [...el.childNodes]
  for (const child of children) {
    const c = cloneVisible(child, doc, bodyTextLen, ignore, nextInArticle)
    if (c) copy.appendChild(c)
  }
  return copy
}

/** 整页剪藏：按页面顺序保留所有可见的正文内容。 */
export function extractPage(doc: Document = document, ignore?: Element): ExtractResult {
  const body = doc.body
  const container = doc.createElement('div')
  if (body) {
    const len = body.textContent?.length ?? 0
    for (const child of [...body.childNodes]) {
      const c = cloneVisible(child, doc, len, ignore, false)
      if (c) container.appendChild(c)
    }
  }
  absolutize(container, doc.baseURI)
  const markdown = tidy(turndown().turndown(container))
  return { title: doc.title.trim(), markdown, excerpt: (container.textContent || '').trim().slice(0, 200) }
}

/** 页面自己声明是文章（新闻、博客）：这类页面整页有大量推荐、评论，默认只取正文。 */
export function looksLikeArticlePage(doc: Document = document): boolean {
  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || ''
  if (/article/i.test(ogType)) return true
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    if (/"@type"\s*:\s*"(News)?Article|"@type"\s*:\s*"BlogPosting"/.test(s.textContent || '')) return true
  }
  const bodyLen = doc.body?.textContent?.length ?? 0
  const article = doc.querySelector('article')
  return !!article && bodyLen > 0 && (article.textContent?.length ?? 0) > bodyLen * 0.5
}

export type ClipMode = 'article' | 'page'

export interface SmartClip {
  title: string
  /** 正文（Readability）；提取不到为 null */
  article: string | null
  page: string
  /** 默认用哪种：文章页用正文，其余（网页应用、对话页、列表页）用整页，免得漏内容 */
  mode: ClipMode
}

/** 智能剪藏：两种都提取，按页面类型选默认的，剪藏窗口里可以切换。 */
export function extractSmart(doc: Document = document, ignore?: Element): SmartClip {
  const article = readArticle(doc)
  const page = extractPage(doc, ignore)
  return {
    title: (article?.title || doc.title || '').trim(),
    article: article?.markdown || null,
    page: page.markdown,
    mode: article && looksLikeArticlePage(doc) ? 'article' : 'page',
  }
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
