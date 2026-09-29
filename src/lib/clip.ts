import { browser } from 'wxt/browser'
import type { ClipCommand } from './messages'

/**
 * 把剪藏界面注入指定标签页（按需注入，不常驻每个网页），再发命令。
 * 后台（右键菜单、快捷键）和弹出面板的剪藏按钮共用。
 */
export async function sendClip(tabId: number, cmd: ClipCommand): Promise<boolean> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/clipper.js'] })
    await browser.tabs.sendMessage(tabId, cmd)
    return true
  } catch {
    // chrome://、应用商店、PDF 查看器等页面不允许扩展注入
    await browser.notifications?.create({
      type: 'basic',
      iconUrl: '/icon/128.png',
      title: 'BerryWiki 知识助手',
      message: '这个页面不支持剪藏（浏览器内置页面、应用商店、PDF 等）',
    }).catch(() => {})
    return false
  }
}

export async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}
