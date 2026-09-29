import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { DEFAULT_SETTINGS, saveSettings, settingsItem, type Settings } from '@/lib/settings'

/**
 * 选中文字工具条：在网页上选中文字后，旁边弹出「保存 / 问知识助手 / ×」。
 * 这个脚本每个网页都会加载，所以不用 Vue，只用原生 DOM + Shadow DOM，尽量轻。
 * 「保存」交给后台注入剪藏界面（和右键菜单同一套）；「问知识助手」让后台打开侧边栏提问。
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    let settings: Settings = { ...DEFAULT_SETTINGS }
    void settingsItem.getValue().then((v) => { settings = { ...DEFAULT_SETTINGS, ...v } })
    const unwatch = settingsItem.watch((v) => {
      settings = { ...DEFAULT_SETTINGS, ...v }
      if (!enabled()) hide()
    })
    ctx.onInvalidated(unwatch)

    const siteHost = location.hostname
    const enabled = () =>
      settings.selectionToolbar && !!settings.apiKey && !!settings.baseUrl && !settings.selectionDisabledHosts.includes(siteHost)

    const toolbar = createToolbar()
    ctx.onInvalidated(() => toolbar.host.remove())
    let selectedText = ''

    const hide = () => {
      toolbar.host.style.display = 'none'
      toolbar.menu.hidden = true
    }

    const inOwnUi = (e: Event) =>
      e.composedPath().some((n) => n instanceof Element && (n === toolbar.host || n.tagName === 'BERRYWIKI-CLIPPER'))

    ctx.addEventListener(document, 'mousedown', (e) => { if (!inOwnUi(e)) hide() }, { capture: true })
    ctx.addEventListener(window, 'scroll', hide, { capture: true, passive: true })
    ctx.addEventListener(window, 'blur', hide)
    ctx.addEventListener(document, 'keydown', (e) => { if (e.key === 'Escape') hide() })
    ctx.addEventListener(document, 'mouseup', (e) => {
      if (e.button !== 0 || inOwnUi(e) || !enabled()) return
      // 等浏览器把选区定下来（双击选词时 mouseup 先于选区更新）
      ctx.setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim() || ''
        if (!sel || sel.isCollapsed || text.length < 2 || inEditable(sel)) return hide()
        selectedText = text
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        show(toolbar, rect, e.clientX, e.clientY)
      }, 10)
    })

    const send = async (type: 'bw:selection-save' | 'bw:selection-ask') => {
      const text = selectedText
      hide()
      if (!text) return
      try {
        await browser.runtime.sendMessage({ type, text })
      } catch {
        // 扩展刚重新加载过，这个网页里的脚本已经断开
        flash(toolbar, '扩展刚更新过，请刷新网页后再试')
      }
    }
    toolbar.save.addEventListener('click', () => void send('bw:selection-save'))
    toolbar.ask.addEventListener('click', () => void send('bw:selection-ask'))
    toolbar.close.addEventListener('click', () => { toolbar.menu.hidden = !toolbar.menu.hidden })
    toolbar.disableSite.addEventListener('click', async () => {
      await saveSettings({ selectionDisabledHosts: [...new Set([...settings.selectionDisabledHosts, siteHost])] })
      flash(toolbar, '已在此网站关闭，可在扩展设置里重新开启')
    })
    toolbar.disableAll.addEventListener('click', async () => {
      await saveSettings({ selectionToolbar: false })
      flash(toolbar, '已关闭，可在扩展设置里重新开启')
    })
  },
})

/** 在输入框、可编辑区域里选字是在编辑，不弹。 */
function inEditable(sel: Selection): boolean {
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true
  const node = sel.anchorNode
  const el = node instanceof Element ? node : node?.parentElement
  return !!el?.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')
}

interface Toolbar {
  host: HTMLElement
  bar: HTMLElement
  save: HTMLButtonElement
  ask: HTMLButtonElement
  close: HTMLButtonElement
  menu: HTMLElement
  disableSite: HTMLButtonElement
  disableAll: HTMLButtonElement
  toast: HTMLElement
}

const ICON = {
  save: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  ask: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  site: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
  all: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
}

const STYLE = `
:host { all: initial; }
.bar {
  position: fixed; z-index: 2147483646; display: flex; align-items: center; gap: 2px; padding: 4px;
  border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 12px; background: #fff; color: #1f2328;
  box-shadow: 0 8px 28px -10px rgba(15, 23, 42, 0.35), 0 1px 3px rgba(15, 23, 42, 0.08);
  font: 13px/1 "Microsoft YaHei UI", "PingFang SC", -apple-system, "Segoe UI", sans-serif;
  animation: bw-in 0.12s ease-out;
}
@keyframes bw-in { from { transform: translateY(4px); } }
button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.act { height: 30px; padding: 0 10px; border-radius: 8px; white-space: nowrap; }
.act:hover { background: rgba(8, 145, 178, 0.1); color: #0e7490; }
.act svg { color: #0891b2; }
.sep { width: 1px; height: 16px; margin: 0 2px; background: rgba(15, 23, 42, 0.1); }
.x { justify-content: center; width: 26px; height: 26px; border-radius: 7px; color: #9aa3b2; }
.x:hover { background: rgba(15, 23, 42, 0.06); color: #5b6270; }
.menu {
  position: absolute; top: calc(100% + 6px); right: 0; display: flex; flex-direction: column; min-width: 150px; padding: 4px;
  border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 10px; background: #fff;
  box-shadow: 0 8px 28px -10px rgba(15, 23, 42, 0.35);
}
.menu[hidden], .toast[hidden] { display: none; }
.menu button { height: 32px; padding: 0 10px; border-radius: 7px; color: #5b6270; white-space: nowrap; }
.menu button:hover { background: rgba(15, 23, 42, 0.05); color: #1f2328; }
.toast { padding: 0 10px; height: 30px; display: inline-flex; align-items: center; color: #0e7490; white-space: nowrap; }
@media (prefers-color-scheme: dark) {
  .bar, .menu { border-color: rgba(255, 255, 255, 0.08); background: #1f232b; color: #e8eaed; }
  .sep { background: rgba(255, 255, 255, 0.12); }
  .menu button { color: #a3a9b5; }
  .menu button:hover { background: rgba(255, 255, 255, 0.06); color: #e8eaed; }
  .act:hover { color: #67e8f9; }
  .toast { color: #67e8f9; }
}
`

function createToolbar(): Toolbar {
  const host = document.createElement('berrywiki-selection')
  host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483646;display:none;'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>${STYLE}</style>
    <div class="bar" role="toolbar" aria-label="BerryWiki 知识助手">
      <button class="act save" type="button">${ICON.save}保存</button>
      <span class="sep"></span>
      <button class="act ask" type="button">${ICON.ask}问知识助手</button>
      <span class="sep"></span>
      <button class="x" type="button" title="关闭">${ICON.close}</button>
      <span class="toast" hidden></span>
      <div class="menu" hidden>
        <button class="site" type="button">${ICON.site}在此网站禁用</button>
        <button class="all" type="button">${ICON.all}所有网站禁用</button>
      </div>
    </div>`
  // 点工具条不能让网页的选区丢掉
  root.addEventListener('mousedown', (e) => e.preventDefault())
  document.documentElement.appendChild(host)
  const q = <T extends Element>(s: string) => root.querySelector(s) as T
  return {
    host,
    bar: q('.bar'),
    save: q('.save'),
    ask: q('.ask'),
    close: q('.x'),
    menu: q('.menu'),
    disableSite: q('.site'),
    disableAll: q('.all'),
    toast: q('.toast'),
  }
}

function show(t: Toolbar, rect: DOMRect, mouseX: number, mouseY: number) {
  t.menu.hidden = true
  t.toast.hidden = true
  for (const el of t.bar.querySelectorAll<HTMLElement>('.act, .sep, .x')) el.style.display = ''
  t.host.style.display = 'block'
  const w = t.bar.offsetWidth || 260
  const h = t.bar.offsetHeight || 40
  // 优先放在选区上方、靠近鼠标；上方放不下就放到鼠标下方
  const top = rect.height && rect.top - h - 10 > 8 ? rect.top - h - 10 : Math.min(mouseY + 16, window.innerHeight - h - 8)
  const left = Math.max(8, Math.min(mouseX - w / 2, window.innerWidth - w - 8))
  t.bar.style.top = `${top}px`
  t.bar.style.left = `${left}px`
}

/** 在工具条位置短暂显示一句提示，然后收起。 */
function flash(t: Toolbar, text: string) {
  t.menu.hidden = true
  for (const el of t.bar.querySelectorAll<HTMLElement>('.act, .sep, .x')) el.style.display = 'none'
  t.toast.textContent = text
  t.toast.hidden = false
  t.host.style.display = 'block'
  setTimeout(() => { t.host.style.display = 'none' }, 2200)
}
