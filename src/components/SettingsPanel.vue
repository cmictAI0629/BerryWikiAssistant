<template>
  <!-- 设置面板：弹出面板、侧边栏里原地打开，设置页里居中显示成窗口。列表式，和原版「知识管理助手」一样。 -->
  <div class="st">
    <header class="st-head">
      <button v-if="backable" type="button" class="st-back" title="返回" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
      <h1>设置</h1>
    </header>

    <div class="st-body">
      <section class="st-group">
        <div class="st-row st-account">
          <span class="st-avatar">{{ initial }}</span>
          <div class="st-account__who">
            <b>{{ ws ? displayName(ws.me) : '正在连接…' }}</b>
            <small>{{ ws?.me.tenant?.name || web }}</small>
          </div>
          <span v-if="error" class="st-state is-error" :title="error">连接失败</span>
          <span v-else-if="ws" class="st-state"><i />已连接</span>
        </div>
        <a class="st-row st-link" :href="web" target="_blank" rel="noopener noreferrer">
          <span>服务器</span>
          <span class="st-value st-value--mono">{{ web.replace(/^https?:\/\//, '') }} ›</span>
        </a>
      </section>

      <section class="st-group">
        <label class="st-row">
          <span>剪藏知识库</span>
          <select v-model="defaults.defaultKbId" class="st-select" :disabled="!ws" @change="save({ defaultKbId: defaults.defaultKbId })">
            <option v-if="!ws" value="">加载中…</option>
            <option v-for="kb in writableKbs" :key="kb.id" :value="kb.id">{{ kb.name }}</option>
          </select>
        </label>
        <label class="st-row">
          <span>默认智能体</span>
          <select v-model="defaults.defaultAgentId" class="st-select" :disabled="!ws" @change="save({ defaultAgentId: defaults.defaultAgentId })">
            <option v-if="!ws" value="">加载中…</option>
            <option v-for="a in ws?.agents || []" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <div class="st-row">
          <span>
            选中文字弹出操作
            <small class="st-sub">在网页上选中文字后，旁边出现「保存 / 问知识助手」</small>
          </span>
          <button type="button" role="switch" class="st-switch" :class="{ on: toolbar }" :aria-checked="toolbar"
            @click="toggleToolbar" />
        </div>
        <div v-for="h in disabledHosts" :key="h" class="st-row st-row--sub">
          <span class="st-host">{{ h }} <small>已禁用</small></span>
          <button type="button" class="st-mini" @click="enableHost(h)">恢复</button>
        </div>
      </section>

      <section class="st-group">
        <div class="st-group__title">快捷键</div>
        <div v-for="c in commands" :key="c.name" class="st-row">
          <span>{{ commandLabel(c) }}</span>
          <kbd v-if="c.shortcut" class="st-chip">{{ c.shortcut }}</kbd>
          <span v-else class="st-chip st-chip--empty">未设置</span>
        </div>
        <a href="#" class="st-row st-link" @click.prevent="openShortcuts">
          <span>修改快捷键</span>
          <span class="st-value">浏览器扩展快捷键设置 ›</span>
        </a>
      </section>

      <section class="st-group">
        <div class="st-row">
          <span>版本</span>
          <span class="st-value">v{{ version }}</span>
        </div>
        <a class="st-row st-link" :href="REPO_URL" target="_blank" rel="noopener noreferrer">
          <span>开源项目</span>
          <span class="st-value st-value--brand">GitHub ›</span>
        </a>
      </section>

      <button type="button" class="st-logout" @click="signOut">退出登录</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { browser } from 'wxt/browser'
import { logout, pickDefaults } from '@/lib/connect'
import { getSettings, saveSettings, settingsItem, webBaseUrl, type Settings } from '@/lib/settings'
import { cachedWorkspace, displayName, loadWorkspace, writableKnowledgeBases, type Workspace } from '@/lib/workspace'

withDefaults(defineProps<{ backable?: boolean }>(), { backable: true })
const emit = defineEmits<{ back: []; logout: [] }>()

const REPO_URL = 'https://github.com/cmictAI0629/BerryWikiAssistant'
const version = browser.runtime.getManifest().version

const ws = ref<Workspace | null>(null)
const error = ref('')
const web = ref('')
const toolbar = ref(true)
const disabledHosts = ref<string[]>([])
const defaults = reactive({ defaultKbId: '', defaultAgentId: '' })
interface Command { name?: string; description?: string; shortcut?: string }
const commands = ref<Command[]>([])

const writableKbs = computed(() => writableKnowledgeBases(ws.value?.knowledgeBases || []))
const initial = computed(() => [...(ws.value ? displayName(ws.value.me) : 'B')][0]?.toUpperCase() || 'B')

function applySettings(s: Settings) {
  web.value = webBaseUrl(s.baseUrl)
  toolbar.value = s.selectionToolbar
  disabledHosts.value = s.selectionDisabledHosts
}

// 网页上的工具条「在此网站禁用」也会改设置，这里跟着刷新
const unwatch = settingsItem.watch((v) => { if (v) applySettings({ ...(v as Settings) }) })
onUnmounted(unwatch)

onMounted(async () => {
  commands.value = (await browser.commands.getAll()) as Command[]
  const s = await getSettings()
  applySettings(s)
  ws.value = await cachedWorkspace()
  if (ws.value) Object.assign(defaults, pickDefaults(ws.value, s.defaultKbId, s.defaultAgentId))
  try {
    ws.value = await loadWorkspace()
    const picked = pickDefaults(ws.value, s.defaultKbId, s.defaultAgentId)
    Object.assign(defaults, picked)
    if (picked.defaultKbId !== s.defaultKbId || picked.defaultAgentId !== s.defaultAgentId) await save(picked)
  } catch (e) {
    error.value = (e as Error).message
  }
})

async function save(patch: Partial<Settings>) {
  await saveSettings(patch)
}

async function toggleToolbar() {
  toolbar.value = !toolbar.value
  await save({ selectionToolbar: toolbar.value })
}

async function enableHost(host: string) {
  disabledHosts.value = disabledHosts.value.filter((h) => h !== host)
  await save({ selectionDisabledHosts: disabledHosts.value })
}

function commandLabel(c: Command): string {
  return c.description || (c.name === '_execute_action' ? '打开 BerryWiki 知识助手' : c.name || '')
}

function openShortcuts() {
  void browser.tabs.create({ url: navigator.userAgent.includes('Edg/') ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts' })
}

async function signOut() {
  await logout()
  emit('logout')
}
</script>

<style scoped>
.st { display: flex; flex-direction: column; min-height: 0; background: var(--bw-bg); }

.st-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--bw-line);
  background: var(--bw-card);
}

.st-head h1 { margin: 0; font-size: 16px; }

.st-back {
  position: absolute;
  left: 12px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 10px;
  background: color-mix(in srgb, var(--bw-text) 6%, transparent);
  color: var(--bw-text-2);
  cursor: pointer;
}

.st-back:hover { background: var(--bw-brand-soft); color: var(--bw-brand); }

.st-body { display: flex; flex: 1; flex-direction: column; gap: 12px; min-height: 0; overflow-y: auto; padding: 12px; }

.st-group {
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--bw-text) 6%, transparent);
  border-radius: 14px;
  background: var(--bw-card);
}

.st-group__title { padding: 10px 14px 2px; color: var(--bw-text-3); font-size: 12px; }

.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 46px;
  padding: 8px 14px;
  color: var(--bw-text);
  font-size: 13.5px;
  text-decoration: none;
}

.st-row + .st-row { border-top: 1px solid var(--bw-line); }
.st-row--sub { min-height: 38px; padding-left: 26px; font-size: 12.5px; }

.st-link { cursor: pointer; }
.st-link:hover { background: color-mix(in srgb, var(--bw-brand) 5%, transparent); }

.st-sub { display: block; margin-top: 2px; color: var(--bw-text-3); font-size: 11.5px; }

.st-value { overflow: hidden; color: var(--bw-text-3); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.st-value--mono { max-width: 60%; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.st-value--brand { color: var(--bw-brand); }

.st-account { gap: 10px; min-height: 60px; }

.st-avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22d3ee, var(--bw-brand) 55%, var(--bw-brand-strong));
  color: #fff;
  font-weight: 700;
}

.st-account__who { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.st-account__who b, .st-account__who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-account__who small { color: var(--bw-text-3); font-size: 12px; }

.st-state { display: inline-flex; flex-shrink: 0; align-items: center; gap: 5px; color: var(--bw-success); font-size: 12px; }
.st-state i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.st-state.is-error { color: var(--bw-danger); }

.st-select {
  max-width: 58%;
  padding: 2px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--bw-brand);
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  cursor: pointer;
}

.st-select option { color: var(--bw-text); font-weight: 400; }

.st-switch {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bw-text) 18%, transparent);
  cursor: pointer;
  transition: background 0.2s ease;
}

.st-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
  transition: transform 0.2s ease;
}

.st-switch.on { background: var(--bw-brand); }
.st-switch.on::after { transform: translateX(18px); }

.st-host { color: var(--bw-text-2); font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.st-host small { margin-left: 4px; color: var(--bw-text-3); font-family: var(--bw-font); }

.st-mini {
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--bw-line);
  border-radius: 999px;
  background: var(--bw-card);
  color: var(--bw-brand);
  font-size: 12px;
  cursor: pointer;
}

.st-chip {
  flex-shrink: 0;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--bw-brand) 25%, transparent);
  border-radius: 6px;
  background: var(--bw-brand-soft);
  color: var(--bw-brand-strong);
  font: 12px ui-monospace, Consolas, monospace;
}

.st-chip--empty { font-family: var(--bw-font); }

@media (prefers-color-scheme: dark) {
  .st-chip { color: #67e8f9; }
}

.st-logout {
  flex-shrink: 0;
  height: 42px;
  border: 1px solid color-mix(in srgb, var(--bw-danger) 25%, transparent);
  border-radius: 12px;
  background: var(--bw-card);
  color: var(--bw-danger);
  font-size: 13.5px;
  cursor: pointer;
}

.st-logout:hover { background: color-mix(in srgb, var(--bw-danger) 6%, var(--bw-card)); }
</style>
