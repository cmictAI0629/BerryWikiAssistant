import { createApp } from 'vue'
import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import ClipperApp from '@/components/clip/ClipperApp.vue'
import type { ClipCommand } from '@/lib/messages'
import '@/styles/base.css'

declare global {
  interface Window { __berrywikiClipper?: { alive: () => boolean; dispose: () => void } }
}

/** 扩展重新加载 / 升级后，网页里之前注入的脚本就和扩展断开了（runtime.id 变成 undefined）。 */
function extensionAlive(): boolean {
  try {
    return !!browser.runtime?.id
  } catch {
    return false
  }
}

// 按需注入：后台在用户点「剪藏」时用 scripting.executeScript 注入，不常驻每个网页。
// 同一页面可能被注入多次：已有实例还连着扩展就沿用它；已经断开（扩展重新加载过）就拆掉，由这次注入接管，
// 否则命令会落到断开的旧实例上，保存时报「Receiving end does not exist」。
export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const prev = window.__berrywikiClipper
    if (prev?.alive()) return
    prev?.dispose()

    let app: InstanceType<typeof ClipperApp> | null = null
    // 先挂监听：后台注入后马上发命令，界面还没挂好时先排队
    const queue: ClipCommand[] = []
    const alive = () => !ctx.isInvalid && extensionAlive()
    const listener = (msg: ClipCommand) => {
      if (!msg?.type?.startsWith('bw:') || !alive()) return
      if (app) app.run(msg)
      else queue.push(msg)
    }
    browser.runtime.onMessage.addListener(listener)

    const ui = await createShadowRootUi(ctx, {
      name: 'berrywiki-clipper',
      position: 'overlay',
      zIndex: 2147483646,
      onMount(container, _shadow, host) {
        const vue = createApp(ClipperApp, { host: () => host })
        app = vue.mount(container) as InstanceType<typeof ClipperApp>
        return vue
      },
      onRemove(vue) {
        vue?.unmount()
      },
    })
    ui.mount()
    window.__berrywikiClipper = {
      alive,
      dispose: () => {
        try { browser.runtime.onMessage.removeListener(listener) } catch { /* 已断开 */ }
        ui.remove()
      },
    }
    queue.splice(0).forEach((cmd) => app?.run(cmd))
  },
})
