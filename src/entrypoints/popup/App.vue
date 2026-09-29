<template>
  <div class="pp">
    <!-- 未连接 -->
    <section v-if="!configured && ready" class="pp-welcome bw-card">
      <img class="pp-welcome__logo" :src="logo" alt="" />
      <h1>连接你的 OneBerryWiki</h1>
      <p>填写服务器地址和 API Key 后，就能在任意网页向知识库提问、剪藏网页、记速记。</p>
      <button type="button" class="bw-btn bw-btn--primary" @click="openOptions">去设置</button>
    </section>

    <template v-else-if="configured">
      <header class="pp-head">
        <span class="pp-avatar">{{ initial }}</span>
        <div class="pp-who">
          <b>{{ name }}</b>
          <small v-if="ws?.me.tenant?.name">{{ ws.me.tenant.name }}</small>
        </div>
        <button type="button" class="bw-icon-btn" title="在侧边栏打开对话" @click="openSidePanel()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>
        </button>
        <div class="pp-more">
          <button type="button" class="bw-icon-btn" title="更多" @click="menuOpen = !menuOpen">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
          </button>
          <div v-if="menuOpen" class="pp-menu bw-card" @click="menuOpen = false">
            <button type="button" @click="openWeb()">打开 OneBerryWiki</button>
            <button type="button" @click="openOptions">设置</button>
            <button type="button" @click="openShortcuts">快捷键</button>
          </div>
        </div>
      </header>

      <p v-if="error" class="pp-error">{{ error }} <a href="#" @click.prevent="openOptions">检查设置</a></p>

      <!-- 知识库卡片：最近文档 + 剪藏 -->
      <section class="pp-kb bw-card">
        <div class="pp-kb__head">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" class="pp-kb__icon"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>
          <select v-model="kbId" class="pp-kb__select" aria-label="知识库">
            <option v-for="kb in writableKbs" :key="kb.id" :value="kb.id">{{ kb.name }}</option>
          </select>
          <a href="#" class="pp-kb__more" @click.prevent="openWeb(kbId)">更多…</a>
        </div>
        <ul class="pp-docs">
          <li v-if="docsLoading" class="pp-docs__empty">加载中…</li>
          <li v-else-if="!docs.length" class="pp-docs__empty">这个知识库还没有文档，剪藏一篇试试</li>
          <li v-for="d in docs" :key="d.id" class="pp-doc" :title="d.title || d.file_name" @click="openWeb(kbId)">
            <span class="pp-doc__icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>
            </span>
            <span class="pp-doc__title">{{ d.title || d.file_name }}</span>
            <span class="pp-doc__time">{{ relativeTime(d.updated_at || d.created_at) }}</span>
          </li>
        </ul>
        <div class="pp-actions">
          <button type="button" class="pp-action" title="框选剪藏：在网页上框出一块区域，连同截图一起保存" @click="clip('bw:region-clip')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/></svg>
          </button>
          <button type="button" class="pp-action pp-action--main" title="智能剪藏：自动提取本页正文保存" @click="clip('bw:smart-clip')">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>
          </button>
          <button type="button" class="pp-action" title="Markdown 速记" @click="openSidePanel('note')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>
          </button>
        </div>
      </section>

      <!-- 提问 -->
      <section class="pp-ask bw-card">
        <textarea v-model="query" class="pp-ask__input" rows="2" placeholder="向知识库提问…（Enter 发送）"
          @keydown.enter.exact.prevent="ask" />
        <div class="pp-ask__bar">
          <select v-model="askKbId" class="bw-select pp-ask__scope" aria-label="提问范围">
            <option value="">全部知识库</option>
            <option v-for="kb in ws?.knowledgeBases || []" :key="kb.id" :value="kb.id">{{ kb.name }}</option>
          </select>
          <label class="pp-ask__agent">
            <AgentAvatar :agent="currentAgent" :size="18" />
            <select v-model="agentId" class="bw-select" aria-label="智能体">
              <option v-for="a in ws?.agents || []" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </label>
          <button type="button" class="pp-send" :disabled="!query.trim()" title="发送" @click="ask">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>
          </button>
        </div>
      </section>
    </template>

    <footer class="pp-foot">Powered by OneBerryWiki</footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { browser } from 'wxt/browser'
import AgentAvatar from '@/components/AgentAvatar.vue'
import { listRecentKnowledge, type Knowledge } from '@/lib/api'
import { activeTabId, sendClip } from '@/lib/clip'
import { setPendingQuestion, setPendingTab } from '@/lib/pending'
import { getSettings, isConfigured, saveSettings, webBaseUrl } from '@/lib/settings'
import { cachedWorkspace, displayName, loadWorkspace, relativeTime, writableKnowledgeBases, type Workspace } from '@/lib/workspace'

const logo = browser.runtime.getURL('/icon/128.png')
const ready = ref(false)
const configured = ref(false)
const ws = ref<Workspace | null>(null)
const error = ref('')
const menuOpen = ref(false)
const kbId = ref('')
const askKbId = ref('')
const agentId = ref('')
const query = ref('')
const docs = ref<Knowledge[]>([])
const docsLoading = ref(false)
let windowId: number | undefined
let baseUrl = ''

const name = computed(() => displayName(ws.value?.me))
const initial = computed(() => [...name.value][0]?.toUpperCase() || 'B')
const writableKbs = computed(() => writableKnowledgeBases(ws.value?.knowledgeBases || []))
const currentAgent = computed(() => ws.value?.agents.find((a) => a.id === agentId.value) || null)

onMounted(async () => {
  // 打开侧边栏要在点击里同步调用，窗口 ID 先准备好
  windowId = (await browser.windows.getCurrent().catch(() => undefined))?.id
  const s = await getSettings()
  configured.value = isConfigured(s)
  baseUrl = s.baseUrl
  ready.value = true
  if (!configured.value) return
  const cached = await cachedWorkspace()
  if (cached) applyWorkspace(cached, s.defaultKbId, s.defaultAgentId)
  try {
    applyWorkspace(await loadWorkspace(), s.defaultKbId, s.defaultAgentId)
  } catch (e) {
    if (!cached) error.value = (e as Error).message
  }
})

function applyWorkspace(w: Workspace, defaultKb: string, defaultAgent: string) {
  ws.value = w
  const kbs = writableKnowledgeBases(w.knowledgeBases)
  if (!kbs.some((k) => k.id === kbId.value)) kbId.value = kbs.some((k) => k.id === defaultKb) ? defaultKb : kbs[0]?.id || ''
  if (!w.agents.some((a) => a.id === agentId.value)) {
    agentId.value = w.agents.some((a) => a.id === defaultAgent) ? defaultAgent
      : w.agents.find((a) => a.id === 'builtin-smart-reasoning')?.id || w.agents[0]?.id || ''
  }
}

// 选的知识库记下来，下次打开还是它；剪藏默认也写进这个库
watch(kbId, async (id, old) => {
  if (!id) return
  if (old) void saveSettings({ defaultKbId: id })
  docsLoading.value = true
  try {
    docs.value = await listRecentKnowledge(id, 3)
  } catch {
    docs.value = []
  } finally {
    docsLoading.value = false
  }
})
watch(agentId, (id, old) => { if (id && old) void saveSettings({ defaultAgentId: id }) })

async function clip(type: 'bw:region-clip' | 'bw:smart-clip') {
  const tabId = await activeTabId()
  if (!tabId) return
  if (await sendClip(tabId, { type })) window.close()
}

function openSidePanel(tab?: 'chat' | 'note') {
  if (windowId === undefined) return
  void browser.sidePanel.open({ windowId })
  if (tab) void setPendingTab(tab)
  window.close()
}

function ask() {
  const q = query.value.trim()
  if (!q || windowId === undefined) return
  void browser.sidePanel.open({ windowId })
  void setPendingQuestion(q, { agentId: agentId.value, knowledgeBaseIds: askKbId.value ? [askKbId.value] : [] })
    .then(() => window.close())
}

function openOptions() {
  void browser.runtime.openOptionsPage()
  window.close()
}

function openWeb(kb?: string) {
  const web = webBaseUrl(baseUrl)
  if (!web) return
  void browser.tabs.create({ url: kb ? `${web}/platform/knowledge-bases/${encodeURIComponent(kb)}` : `${web}/platform/creatChat` })
  window.close()
}

function openShortcuts() {
  void browser.tabs.create({ url: navigator.userAgent.includes('Edg/') ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts' })
  window.close()
}
</script>

<style scoped>
.pp {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 380px;
  padding: 12px;
}

.pp-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 0;
}

.pp-avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in srgb, var(--bw-brand) 60%, #38bdf8), var(--bw-brand));
  color: #fff;
  font-weight: 700;
}

.pp-who { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.pp-who b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-who small { color: var(--bw-text-3); font-size: 12px; }

.pp-more { position: relative; }

.pp-menu {
  position: absolute;
  top: 36px;
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 140px;
  padding: 6px;
}

.pp-menu button {
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: none;
  text-align: left;
  cursor: pointer;
}

.pp-menu button:hover { background: var(--bw-brand-soft); color: var(--bw-brand); }

.pp-error { margin: 0; color: var(--bw-danger); font-size: 12px; }
.pp-error a { color: var(--bw-brand); }

.pp-kb { padding: 10px 10px 14px; }

.pp-kb__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px 8px;
  border-bottom: 1px solid var(--bw-line);
}

.pp-kb__icon { flex-shrink: 0; color: var(--bw-brand); }

.pp-kb__select {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-weight: 600;
  cursor: pointer;
  outline: none;
}

.pp-kb__more { color: var(--bw-text-3); font-size: 12px; text-decoration: none; }
.pp-kb__more:hover { color: var(--bw-brand); }

.pp-docs { margin: 4px 0 0; padding: 0; list-style: none; }
.pp-docs__empty { padding: 14px 6px; color: var(--bw-text-3); font-size: 12px; text-align: center; }

.pp-doc {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 6px;
  border-radius: 10px;
  cursor: pointer;
}

.pp-doc:hover { background: var(--bw-brand-soft); }

.pp-doc__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bw-text) 5%, transparent);
  color: var(--bw-text-2);
}

.pp-doc__title { flex: 1; min-width: 0; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.pp-doc__time { flex-shrink: 0; color: var(--bw-text-3); font-size: 12px; }

.pp-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 10px;
}

.pp-action {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bw-text) 6%, transparent);
  color: var(--bw-text-2);
  cursor: pointer;
  transition: transform 0.12s ease, background 0.15s ease, color 0.15s ease;
}

.pp-action:hover { background: var(--bw-brand-soft-2); color: var(--bw-brand); transform: translateY(-1px); }

.pp-action--main {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--bw-brand) 65%, #38bdf8), var(--bw-brand));
  color: #fff;
  box-shadow: 0 10px 22px -10px var(--bw-brand);
}

.pp-action--main:hover { background: linear-gradient(135deg, color-mix(in srgb, var(--bw-brand) 65%, #38bdf8), var(--bw-brand)); color: #fff; filter: brightness(1.06); }

.pp-ask { padding: 10px 10px 8px; }

.pp-ask__input {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  line-height: 1.6;
}

.pp-ask__bar { display: flex; align-items: center; gap: 6px; }
.pp-ask__scope { max-width: 110px; }

.pp-ask__agent {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.pp-ask__agent .bw-select { flex: 1; min-width: 0; }

.pp-send {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in srgb, var(--bw-brand) 68%, #38bdf8), var(--bw-brand));
  color: #fff;
  cursor: pointer;
}

.pp-send:disabled { background: var(--bw-brand-soft-2); color: color-mix(in srgb, var(--bw-brand) 50%, transparent); cursor: default; }

.pp-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 20px;
  text-align: center;
}

.pp-welcome__logo { width: 48px; height: 48px; }
.pp-welcome h1 { margin: 4px 0 0; font-size: 16px; }
.pp-welcome p { margin: 0 0 6px; color: var(--bw-text-2); font-size: 13px; }

.pp-foot { color: var(--bw-text-3); font-size: 11px; text-align: center; }
</style>
