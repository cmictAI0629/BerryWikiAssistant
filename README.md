# BerryWiki 知识助手

连接你自己部署的 [OneBerryWiki](https://github.com/cmictAI0629)，在浏览器里向知识库提问、把网页剪藏进知识库、随手记 Markdown 笔记。
Chrome / Edge 扩展（Manifest V3）。

## 功能

| 功能 | 说明 |
| --- | --- |
| 弹出窗口 | 当前账号、知识库切换、最近 3 篇文档；框选剪藏 / 智能剪藏 / 速记三个入口；直接提问 |
| 问答（侧边栏） | 选知识库范围和智能体，流式回答，显示检索、阅读文档等步骤和引用；可附带当前网页内容、粘贴图片（智能体开启图片上传时） |
| 智能剪藏 | 用 Readability 提取网页正文，转成 Markdown，确认后存入知识库 |
| 框选剪藏 | 在网页上拖出一个区域，同时截图和提取区域内的文字，截图可一并入库 |
| 选中文字剪藏 | 右键选中的文字 → 剪藏到知识库 |
| 速记 | 侧边栏里的 Markdown 编辑器，草稿自动保存，一键存入知识库 |
| 右键提问 | 右键选中的文字 → 向知识库提问 |

剪藏和速记都以「手动创建的文档」写入知识库，状态为已发布，会自动解析、建索引，之后就能被检索到。

### 快捷键

| 快捷键 | 作用 |
| --- | --- |
| `Alt+Shift+K` | 打开弹出窗口 |
| `Alt+Shift+J` | 在侧边栏打开问答 |
| `Alt+Shift+S` | 智能剪藏当前网页 |
| `Alt+Shift+A` | 框选剪藏 |

可在 `chrome://extensions/shortcuts`（Edge 为 `edge://extensions/shortcuts`）里修改。

## 安装

一般从 OneBerryWiki 里下载：「插件」页面的浏览器扩展卡片提供与服务端版本配套的安装包。也可以在本仓库的 Releases 下载。

1. 解压 `BerryWikiAssistant-x.y.z.zip`；
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`），打开「开发者模式」；
3. 点「加载已解压的扩展程序」，选择解压出来的文件夹；
4. 安装后会自动打开登录页（点工具栏上的扩展图标也一样），点「登录 OneBerryWiki」，填写：
   - **服务器地址**：OneBerryWiki 的网页地址即可（如 `http://10.0.0.8:15481`），会自动补上 `/api/v1`；
   - **API Key**：在 OneBerryWiki「设置 → API 信息」新建。建议单独为插件建一个，能力至少勾选 **检索知识库、对话能力、写入知识库内容**；
5. 点「登录」，验证通过即可使用。默认知识库、默认智能体可以在设置页修改；换账号或服务器先「退出登录」。

API Key 只保存在本机浏览器里。

## 开发

需要 Node.js 22。

```bash
npm install
npm run dev        # 开发模式，自动打开带扩展的 Chrome
npm run compile    # 类型检查
npm test           # 单元测试
npm run zip        # 打包到 .output/
```

连真实服务的冒烟测试（只读 + 问答，不写知识库），默认跳过：

```bash
BW_LIVE_URL=http://host:port BW_LIVE_KEY=sk-... npx vitest run tests/live.test.ts
```

### 目录

```
src/
  entrypoints/
    background.ts          右键菜单、快捷键、截图、保存剪藏
    popup/                 弹出窗口
    sidepanel/             侧边栏：问答、速记
    options/               设置页
    clipper.content/       剪藏界面（按需注入，Shadow DOM）
  components/              问答、速记、Markdown 编辑器、框选、剪藏弹窗
  lib/
    api.ts                 OneBerryWiki 接口（X-API-Key，SSE 流式问答）
    extract.ts             正文提取、区域提取、HTML → Markdown
    agentLogos.ts          内置智能体图标，需与 OneBerryWiki frontend/src/config/builtinAgentLogos.ts 保持一致
```

### 用到的 OneBerryWiki 接口

| 用途 | 接口 | Key 能力 |
| --- | --- | --- |
| 账号信息 | `GET /auth/me` | — |
| 知识库、最近文档 | `GET /knowledge-bases`、`GET /knowledge-bases/:id/knowledge` | 检索知识库 |
| 智能体 | `GET /agents` | 对话能力（或读取智能体） |
| 问答 | `POST /sessions`、`POST /agent-chat/:session_id`（SSE）、`POST /sessions/:id/stop` | 对话能力 |
| 剪藏、速记 | `POST /knowledge-bases/:id/knowledge/manual`（`status: publish`） | 写入知识库内容 |
| 截图 | `POST /knowledge-bases/:id/knowledge/file` | 写入知识库内容 |

插件建的会话归属于 API Key，不会出现在网页端的对话历史里。

## 发版

1. 修改 `package.json` 的 `version`，在 `CHANGELOG.md` 记录变更；
2. 提交后打标签 `v<version>` 并推送，GitHub Actions 会构建并发布 `BerryWikiAssistant-<version>.zip`；
3. 在 OneBerryWiki 仓库更新锁定的版本（见其 `docs/oneberry/external-repos.md`）。

## 许可

[MIT](LICENSE)
