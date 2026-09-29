import { defineConfig } from 'wxt'

// BerryWiki 知识助手：OneBerryWiki 的浏览器扩展（问答、剪藏、速记）。
// 连接自己部署的 OneBerryWiki：服务器地址 + API Key，地址任意，所以要 <all_urls> 主机权限
// （扩展页发请求不受 CORS 限制、框选剪藏要截取当前页面、要往任意网页注入剪藏界面）。
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: 'src',
  manifest: {
    name: 'BerryWiki 知识助手',
    short_name: 'BerryWiki',
    description: '连接 OneBerryWiki：在浏览器里向知识库提问、一键剪藏网页、Markdown 速记。',
    permissions: ['storage', 'sidePanel', 'contextMenus', 'activeTab', 'scripting', 'tabs', 'notifications'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'BerryWiki 知识助手' },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    // 网页里的剪藏弹窗要显示扩展图标
    web_accessible_resources: [{ resources: ['icon/*.png'], matches: ['<all_urls>'] }],
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+K' },
        description: '打开 BerryWiki 知识助手',
      },
      'open-side-panel': {
        suggested_key: { default: 'Alt+Shift+J' },
        description: '在侧边栏打开问答',
      },
      'smart-clip': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: '智能剪藏当前网页',
      },
      'region-clip': {
        suggested_key: { default: 'Alt+Shift+A' },
        description: '框选剪藏',
      },
    },
  },
})
