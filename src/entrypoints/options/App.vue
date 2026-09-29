<template>
  <!-- 未登录：页面正中一个和弹出面板一样的登录窗口 -->
  <div v-if="ready && !configured" class="op-login">
    <LoginCard class="op-login__window" @done="onLogin" />
  </div>

  <div v-else-if="ready" class="op">
    <header class="op-head">
      <img :src="logo" alt="" width="36" height="36" />
      <div>
        <h1>BerryWiki 知识助手</h1>
        <p>版本 {{ version }}</p>
      </div>
    </header>

    <!-- 账号 -->
    <section class="bw-card op-account">
      <span class="op-avatar">{{ initial }}</span>
      <div class="op-account__who">
        <b>{{ ws ? displayName(ws.me) : '正在连接…' }}</b>
        <small>
          <span v-if="ws?.me.tenant?.name">{{ ws.me.tenant.name }} · </span>
          <a :href="web" target="_blank" rel="noopener noreferrer">{{ web }}</a>
        </small>
        <span v-if="error" class="op-state is-error">{{ error }}</span>
        <span v-else-if="ws" class="op-state">
          <i class="op-dot" />已连接 · {{ ws.knowledgeBases.length }} 个知识库 · {{ ws.agents.length }} 个智能体
        </span>
      </div>
      <div class="op-account__actions">
        <a class="bw-btn" :href="web" target="_blank" rel="noopener noreferrer">打开 OneBerryWiki</a>
        <button type="button" class="bw-btn" @click="signOut">{{ error ? '重新登录' : '退出登录' }}</button>
      </div>
    </section>

    <section v-if="ws" class="bw-card op-card">
      <h2>默认设置</h2>
      <div class="op-grid">
        <div>
          <label class="bw-label" for="bw-kb">剪藏、速记默认保存到</label>
          <select id="bw-kb" v-model="defaults.defaultKbId" class="bw-input" @change="saveDefaults">
            <option v-for="kb in writableKbs" :key="kb.id" :value="kb.id">{{ kb.name }}</option>
          </select>
        </div>
        <div>
          <label class="bw-label" for="bw-agent">问答默认使用的智能体</label>
          <select id="bw-agent" v-model="defaults.defaultAgentId" class="bw-input" @change="saveDefaults">
            <option v-for="a in ws.agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
      </div>
    </section>

    <section class="bw-card op-card">
      <h2>快捷键</h2>
      <table class="op-keys">
        <tr v-for="c in commands" :key="c.name">
          <td>{{ c.description || '打开 BerryWiki 知识助手' }}</td>
          <td><kbd v-if="c.shortcut">{{ c.shortcut }}</kbd><span v-else class="bw-muted">未设置</span></td>
        </tr>
      </table>
      <p class="op-hint">
        浏览器不允许扩展自己改快捷键，请到
        <a href="#" @click.prevent="openShortcuts">扩展快捷键设置</a> 里修改。
        另外，在网页上<b>右键</b>也能智能剪藏、框选剪藏、保存选中文字，或把选中的内容拿去问知识库。
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { browser } from 'wxt/browser'
import LoginCard from '@/components/LoginCard.vue'
import { logout, pickDefaults } from '@/lib/connect'
import { getSettings, isConfigured, saveSettings, webBaseUrl } from '@/lib/settings'
import { displayName, loadWorkspace, writableKnowledgeBases, type Workspace } from '@/lib/workspace'

const logo = browser.runtime.getURL('/icon/128.png')
const version = browser.runtime.getManifest().version
const ready = ref(false)
const configured = ref(false)
const web = ref('')
const error = ref('')
const ws = ref<Workspace | null>(null)
const defaults = reactive({ defaultKbId: '', defaultAgentId: '' })
interface Command { name?: string; description?: string; shortcut?: string }
const commands = ref<Command[]>([])

const writableKbs = computed(() => writableKnowledgeBases(ws.value?.knowledgeBases || []))
const initial = computed(() => [...(ws.value ? displayName(ws.value.me) : 'B')][0]?.toUpperCase() || 'B')

onMounted(async () => {
  commands.value = (await browser.commands.getAll()) as Command[]
  await init()
})

async function init(loaded?: Workspace) {
  const s = await getSettings()
  configured.value = isConfigured(s)
  web.value = webBaseUrl(s.baseUrl)
  ready.value = true
  if (!configured.value) return
  error.value = ''
  try {
    ws.value = loaded ?? (await loadWorkspace())
    const picked = pickDefaults(ws.value, s.defaultKbId, s.defaultAgentId)
    Object.assign(defaults, picked)
    if (picked.defaultKbId !== s.defaultKbId || picked.defaultAgentId !== s.defaultAgentId) await saveDefaults()
  } catch (e) {
    error.value = (e as Error).message
  }
}

function onLogin(loaded: Workspace) {
  void init(loaded)
}

async function signOut() {
  await logout()
  ws.value = null
  await init()
}

async function saveDefaults() {
  await saveSettings({ ...defaults })
}

function openShortcuts() {
  void browser.tabs.create({ url: navigator.userAgent.includes('Edg/') ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts' })
}
</script>

<style scoped>
.op-login {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(60% 50% at 20% 10%, color-mix(in srgb, var(--bw-brand) 14%, transparent), transparent 70%),
    radial-gradient(50% 50% at 90% 90%, color-mix(in srgb, #38bdf8 14%, transparent), transparent 70%),
    var(--bw-bg);
}

.op-login__window {
  width: 400px;
  min-height: 540px;
  border-radius: 24px;
  box-shadow: 0 30px 70px -30px rgba(8, 47, 73, 0.55), 0 2px 6px rgba(15, 23, 42, 0.08);
}

.op { max-width: 720px; margin: 0 auto; padding: 32px 20px 48px; }

.op-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.op-head h1 { margin: 0; font-size: 19px; }
.op-head p { margin: 0; color: var(--bw-text-3); font-size: 12px; }

.op-account {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 20px 22px;
  background:
    radial-gradient(80% 120% at 0% 0%, color-mix(in srgb, var(--bw-brand) 12%, transparent), transparent 70%),
    var(--bw-card);
}

.op-avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22d3ee, var(--bw-brand) 55%, var(--bw-brand-strong));
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  box-shadow: 0 10px 22px -12px var(--bw-brand);
}

.op-account__who { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.op-account__who b { font-size: 16px; }
.op-account__who small { overflow: hidden; color: var(--bw-text-2); font-size: 12.5px; text-overflow: ellipsis; white-space: nowrap; }
.op-account__who small a { color: inherit; text-decoration: none; }
.op-account__who small a:hover { color: var(--bw-brand); }

.op-state { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; color: var(--bw-success); font-size: 12px; }
.op-state.is-error { color: var(--bw-danger); }

.op-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 20%, transparent);
}

.op-account__actions { display: flex; flex-shrink: 0; gap: 8px; }
.op-account__actions a { color: inherit; text-decoration: none; }

.op-card { margin-bottom: 16px; padding: 20px 22px; }
.op-card h2 { margin: 0 0 14px; font-size: 15px; }

.op-hint { margin: 10px 0 0; color: var(--bw-text-3); font-size: 12px; }
.op-hint a { color: var(--bw-brand); }

.op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.op-keys { width: 100%; border-collapse: collapse; font-size: 13px; }
.op-keys td { padding: 8px 0; border-bottom: 1px solid var(--bw-line); }
.op-keys td:last-child { text-align: right; }

kbd {
  padding: 2px 8px;
  border: 1px solid var(--bw-line);
  border-radius: 6px;
  background: var(--bw-bg);
  font: 12px ui-monospace, Consolas, monospace;
}
</style>
