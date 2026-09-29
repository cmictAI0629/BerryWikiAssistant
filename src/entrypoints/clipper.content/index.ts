import { createApp } from 'vue'
import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import ClipperApp from '@/components/clip/ClipperApp.vue'
import type { ClipCommand } from '@/lib/messages'
import '@/styles/base.css'

declare global {
  interface Window { __berrywikiClipper?: boolean }
}

// 按需注入：后台在用户点「剪藏」时用 scripting.executeScript 注入，不常驻每个网页。
// 同一页面可能被注入多次，只初始化一次，之后的命令由已有的监听器处理。
export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    if (window.__berrywikiClipper) return
    window.__berrywikiClipper = true

    let app: InstanceType<typeof ClipperApp> | null = null
    // 先挂监听：后台注入后马上发命令，界面还没挂好时先排队
    const queue: ClipCommand[] = []
    browser.runtime.onMessage.addListener((msg: ClipCommand) => {
      if (!msg?.type?.startsWith('bw:')) return
      if (app) app.run(msg)
      else queue.push(msg)
    })

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
    queue.splice(0).forEach((cmd) => app?.run(cmd))
  },
})
