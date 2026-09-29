import { describe, expect, it } from 'vitest'
import { extractArticle } from '@/lib/extract'

function makeDoc(html: string, url = 'https://news.example.com/2026/09/article.html'): Document {
  const doc = document.implementation.createHTMLDocument('')
  doc.documentElement.innerHTML = html
  const base = doc.createElement('base')
  base.href = url
  doc.head.appendChild(base)
  return doc
}

const LONG = '合肥人工智能产业在过去一年持续增长，重点企业营收同比提升，产业链上下游协同更加紧密。'.repeat(8)

describe('extractArticle', () => {
  it('keeps the article body as markdown and drops navigation and scripts', () => {
    const doc = makeDoc(`
      <head><title>合肥 AI 产业简报 - 新闻网</title></head>
      <body>
        <nav><a href="/">首页</a><a href="/news">新闻</a></nav>
        <article>
          <h1>合肥 AI 产业简报</h1>
          <p>${LONG}</p>
          <h2>重点数据</h2>
          <ul><li>企业数量增长 18%</li><li>营收增长 23%</li></ul>
          <p>详见 <a href="/report.pdf">完整报告</a>。${LONG}</p>
          <table><tr><th>指标</th><th>数值</th></tr><tr><td>企业数</td><td>1,280</td></tr></table>
          <script>alert(1)</script>
        </article>
        <footer>版权所有</footer>
      </body>`)
    const r = extractArticle(doc)
    expect(r.title).toContain('合肥 AI 产业简报')
    expect(r.markdown).toContain('## 重点数据')
    expect(r.markdown).toMatch(/- 企业数量增长 18%/)
    // 相对链接改成了绝对地址
    expect(r.markdown).toContain('(https://news.example.com/report.pdf)')
    // 表格转成 Markdown 表格
    expect(r.markdown).toContain('| 指标 | 数值 |')
    expect(r.markdown).not.toContain('alert(1)')
    expect(r.markdown).not.toContain('版权所有')
  })
})
