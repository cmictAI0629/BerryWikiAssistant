import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { createManualKnowledge, listKnowledgeBases, uploadFile } from '@/lib/api'
import type { BackgroundRequest, BackgroundResponse, ClipContext, SaveClipResult } from '@/lib/messages'
import { getSettings, isConfigured, webBaseUrl } from '@/lib/settings'
import { setPendingQuestion } from '@/lib/pending'
import { activeTabId, sendClip } from '@/lib/clip'

const MENU = {
  smartClip: 'bw-smart-clip',
  regionClip: 'bw-region-clip',
  selectionClip: 'bw-selection-clip',
  askSelection: 'bw-ask-selection',
} as const

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await browser.contextMenus.removeAll()
    browser.contextMenus.create({ id: MENU.smartClip, title: '智能剪藏本页到 BerryWiki', contexts: ['page'] })
    browser.contextMenus.create({ id: MENU.regionClip, title: '框选剪藏…', contexts: ['page', 'image'] })
    browser.contextMenus.create({ id: MENU.selectionClip, title: '保存选中内容到 BerryWiki', contexts: ['selection'] })
    browser.contextMenus.create({ id: MENU.askSelection, title: '向知识库提问：「%s」', contexts: ['selection'] })
    // 点扩展图标打开弹出面板；侧边栏只在「对话」时打开
    await browser.sidePanel?.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
    if (reason === 'install' && !isConfigured(await getSettings())) {
      await browser.runtime.openOptionsPage()
    }
  })

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return
    if (info.menuItemId === MENU.askSelection) {
      // 打开侧边栏必须在用户手势里同步调用，先开再写待问问题（侧边栏会监听变化）
      void browser.sidePanel.open({ tabId: tab.id })
      await setPendingQuestion(askSelectionQuery(info.selectionText ?? ''))
      return
    }
    if (info.menuItemId === MENU.smartClip) await sendClip(tab.id, { type: 'bw:smart-clip' })
    else if (info.menuItemId === MENU.regionClip) await sendClip(tab.id, { type: 'bw:region-clip' })
    else if (info.menuItemId === MENU.selectionClip) {
      await sendClip(tab.id, { type: 'bw:selection-clip', text: info.selectionText ?? '' })
    }
  })

  browser.commands.onCommand.addListener(async (command, tab) => {
    const tabId = tab?.id ?? (await activeTabId())
    if (!tabId) return
    if (command === 'open-side-panel') void browser.sidePanel.open({ tabId })
    else if (command === 'smart-clip') await sendClip(tabId, { type: 'bw:smart-clip' })
    else if (command === 'region-clip') await sendClip(tabId, { type: 'bw:region-clip' })
  })

  browser.runtime.onMessage.addListener((msg: BackgroundRequest, sender, sendResponse) => {
    // 选中文字「问知识助手」：侧边栏只能在用户手势里打开，必须在这里同步调用，不能等到 await 之后
    if (msg.type === 'bw:selection-ask' && sender.tab?.id) {
      browser.sidePanel.open({ tabId: sender.tab.id }).catch(() => {})
    }
    handle(msg, sender.tab)
      .then((data) => sendResponse({ ok: true, data } satisfies BackgroundResponse<unknown>))
      .catch((e: Error) => sendResponse({ ok: false, error: e.message || String(e) } satisfies BackgroundResponse<unknown>))
    return true // 异步回复
  })
})

function askSelectionQuery(text: string): string {
  return `请结合知识库解释：\n\n${text.trim()}`
}

async function handle(msg: BackgroundRequest, tab?: { id?: number; windowId?: number }): Promise<unknown> {
  switch (msg.type) {
    case 'bw:capture':
      return browser.tabs.captureVisibleTab(tab?.windowId ?? browser.windows.WINDOW_ID_CURRENT, { format: 'png' })
    case 'bw:selection-save':
      if (tab?.id) await sendClip(tab.id, { type: 'bw:selection-clip', text: msg.text })
      return null
    case 'bw:selection-ask':
      await setPendingQuestion(askSelectionQuery(msg.text))
      return null
    case 'bw:clip-context': {
      const s = await getSettings()
      if (!isConfigured(s)) return { configured: false, knowledgeBases: [], defaultKbId: '', webBaseUrl: '' } satisfies ClipContext
      const kbs = (await listKnowledgeBases()).filter((kb) => kb.type !== 'faq')
      return {
        configured: true,
        knowledgeBases: kbs,
        defaultKbId: kbs.some((kb) => kb.id === s.defaultKbId) ? s.defaultKbId : kbs[0]?.id ?? '',
        webBaseUrl: webBaseUrl(s.baseUrl),
      } satisfies ClipContext
    }
    case 'bw:save-clip': {
      const { kbId, title, markdown, source, screenshot } = msg.payload
      const content = source ? `${markdown}\n\n---\n来源：[${title || source}](${source})\n` : markdown
      const knowledge = await createManualKnowledge(kbId, title, content)
      let screenshotSaved = false
      if (screenshot) {
        const blob = await (await fetch(screenshot)).blob()
        await uploadFile(kbId, blob, `${safeFileName(title || '剪藏')}-截图.png`)
        screenshotSaved = true
      }
      return { knowledge, screenshotSaved } satisfies SaveClipResult
    }
    case 'bw:open-options':
      await browser.runtime.openOptionsPage()
      return null
  }
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, ' ').trim().slice(0, 60) || '剪藏'
}
