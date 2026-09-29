import { describe, expect, it } from 'vitest'
import { extractArticle, extractSmart } from '@/lib/extract'

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

describe('extractSmart', () => {
  it('uses the whole page on app pages so short blocks such as the user message are kept', () => {
    const reply = '我已经尝试在必应上搜索，但遇到人机验证阻挡，浏览器任务被暂停，需要你在本地帮助通过验证。'.repeat(10)
    const doc = makeDoc(`
      <head><title>OneBerryWiki</title></head>
      <body>
        <div class="aside_box"><div class="menu_item">新对话</div><div class="menu_item">知识库</div><div>历史对话一</div></div>
        <div class="chat_page">
          <header class="chat-header"><span>中移集成知乎口碑评价</span><button>分享</button></header>
          <div class="msg msg--user"><div class="bubble">给我去知乎搜索中移集成，查看前10篇文章，然后给我一个口碑评价</div></div>
          <div class="msg msg--assistant"><div class="md"><p>${reply}</p><p>${reply}</p></div></div>
          <div class="composer"><textarea placeholder="输入问题"></textarea><button>发送</button></div>
          <div style="display:none">隐藏的内容</div>
        </div>
      </body>`, 'http://36.140.144.144:15481/platform/chat/1')
    const r = extractSmart(doc)
    expect(r.mode).toBe('page')
    expect(r.page).toContain('给我去知乎搜索中移集成')
    expect(r.page).toContain('我已经尝试在必应上搜索')
    expect(r.page).not.toContain('历史对话一')
    expect(r.page).not.toContain('发送')
    expect(r.page).not.toContain('隐藏的内容')
  })

  it('defaults to the article body on pages that declare themselves articles', () => {
    const doc = makeDoc(`
      <head><title>合肥 AI 产业简报</title><meta property="og:type" content="article"></head>
      <body>
        <nav><a href="/">首页</a></nav>
        <div class="content"><h1>合肥 AI 产业简报</h1><p>${LONG}</p><p>${LONG}</p></div>
        <div class="related"><h3>相关推荐</h3><ul><li><a href="/a">另一篇文章</a></li></ul></div>
      </body>`)
    const r = extractSmart(doc)
    expect(r.mode).toBe('article')
    expect(r.article).toContain('合肥人工智能产业')
    expect(r.page).toContain('合肥人工智能产业')
  })
})
