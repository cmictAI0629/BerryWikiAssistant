<template>
  <div class="op">
    <header class="op-head">
      <img :src="logo" alt="" width="40" height="40" />
      <div>
        <h1>BerryWiki 知识助手</h1>
        <p>连接你自己部署的 OneBerryWiki，在浏览器里提问、剪藏、速记。版本 {{ version }}</p>
      </div>
    </header>

    <section class="bw-card op-card">
      <h2>连接 OneBerryWiki</h2>
      <label class="bw-label" for="bw-url">服务器地址</label>
      <input id="bw-url" v-model="form.baseUrl" class="bw-input" placeholder="例如 http://10.0.0.8:15481 或 https://wiki.example.com" />
      <p class="op-hint">填网页地址或 API 地址都行，会自动补上 <code>/api/v1</code>。在 OneBerryWiki「设置 → API 集成」里可以复制。</p>

      <label class="bw-label" for="bw-key">API Key</label>
      <div class="op-key">
        <input id="bw-key" v-model="form.apiKey" class="bw-input" :type="showKey ? 'text' : 'password'" placeholder="sk-…"
          autocomplete="off" spellcheck="false" />
        <button type="button" class="bw-btn" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
      </div>
      <p class="op-hint">
        在「设置 → API 集成」新建一个 Key。建议单独给插件建一个，能力至少勾选<b>检索、对话、入库</b>，
        也可以直接给完整权限。Key 只保存在这台电脑的浏览器里。
      </p>

      <div class="op-actions">
        <button type="button" class="bw-btn bw-btn--primary" :disabled="testing" @click="testAndSave">
          {{ testing ? '连接中…' : '保存并测试连接' }}
        </button>
        <span v-if="status" class="op-status" :class="{ 'is-error': statusError }">{{ status }}</span>
      </div>
    </section>

    <section v-if="ws" class="bw-card op-card">
      <h2>默认设置</h2>
      <div class="op-grid">
        <div>
          <label class="bw-label" for="bw-kb">剪藏、速记默认保存到</label>
          <select id="bw-kb" v-model="form.defaultKbId" class="bw-input" @change="saveDefaults">
            <option v-for="kb in writableKbs" :key="kb.id" :value="kb.id">{{ kb.name }}</option>
          </select>
        </div>
        <div>
          <label class="bw-label" for="bw-agent">问答默认使用的智能体</label>
          <select id="bw-agent" v-model="form.defaultAgentId" class="bw-input" @change="saveDefaults">
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
import { getMe } from '@/lib/api'
import { getSettings, normalizeBaseUrl, saveSettings, type Settings } from '@/lib/settings'
import { clearWorkspaceCache, displayName, loadWorkspace, writableKnowledgeBases, type Workspace } from '@/lib/workspace'

const logo = browser.runtime.getURL('/icon/128.png')
const version = browser.runtime.getManifest().version
const form = reactive<Settings>({ baseUrl: '', apiKey: '', defaultKbId: '', defaultAgentId: '' })
const showKey = ref(false)
const testing = ref(false)
const status = ref('')
const statusError = ref(false)
const ws = ref<Workspace | null>(null)
interface Command { name?: string; description?: string; shortcut?: string }
const commands = ref<Command[]>([])

const writableKbs = computed(() => writableKnowledgeBases(ws.value?.knowledgeBases || []))

onMounted(async () => {
  Object.assign(form, await getSettings())
  commands.value = (await browser.commands.getAll()) as Command[]
  if (form.baseUrl && form.apiKey) {
    try {
      ws.value = await loadWorkspace()
      if (fillDefaults()) await saveDefaults()
      status.value = `已连接：${displayName(ws.value.me)}${ws.value.me.tenant?.name ? ` · ${ws.value.me.tenant.name}` : ''}`
    } catch (e) {
      statusError.value = true
      status.value = (e as Error).message
    }
  }
})

async function testAndSave() {
  testing.value = true
  status.value = ''
  statusError.value = false
  const candidate: Settings = { ...form, baseUrl: normalizeBaseUrl(form.baseUrl), apiKey: form.apiKey.trim() }
  try {
    if (!candidate.baseUrl || !candidate.apiKey) throw new Error('请填写服务器地址和 API Key')
    const me = await getMe(candidate) // 先验证，通过了才保存
    Object.assign(form, candidate)
    await saveSettings(candidate)
    await clearWorkspaceCache()
    ws.value = await loadWorkspace()
    fillDefaults()
    await saveDefaults()
    status.value = `连接成功：${displayName(me)}${me.tenant?.name ? ` · ${me.tenant.name}` : ''}，可以看到 ${ws.value.knowledgeBases.length} 个知识库`
  } catch (e) {
    statusError.value = true
    status.value = (e as Error).message
  } finally {
    testing.value = false
  }
}

/** 默认知识库、智能体没设或已经不存在时，补上第一个可写知识库和智能推理。返回是否有改动。 */
function fillDefaults(): boolean {
  const before = `${form.defaultKbId}|${form.defaultAgentId}`
  if (!writableKbs.value.some((k) => k.id === form.defaultKbId)) form.defaultKbId = writableKbs.value[0]?.id || ''
  const agents = ws.value?.agents || []
  if (!agents.some((a) => a.id === form.defaultAgentId)) {
    form.defaultAgentId = agents.find((a) => a.id === 'builtin-smart-reasoning')?.id || agents[0]?.id || ''
  }
  return before !== `${form.defaultKbId}|${form.defaultAgentId}`
}

async function saveDefaults() {
  await saveSettings({ defaultKbId: form.defaultKbId, defaultAgentId: form.defaultAgentId })
}

function openShortcuts() {
  void browser.tabs.create({ url: navigator.userAgent.includes('Edg/') ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts' })
}
</script>

<style scoped>
.op { max-width: 720px; margin: 0 auto; padding: 32px 20px 48px; }

.op-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.op-head h1 { margin: 0; font-size: 20px; }
.op-head p { margin: 2px 0 0; color: var(--bw-text-2); font-size: 13px; }

.op-card { margin-bottom: 16px; padding: 20px 22px; }
.op-card h2 { margin: 0 0 14px; font-size: 15px; }
.op-card .bw-label { margin-top: 12px; }

.op-hint { margin: 6px 0 0; color: var(--bw-text-3); font-size: 12px; }
.op-hint code { padding: 0 4px; border-radius: 4px; background: var(--bw-brand-soft); }
.op-hint a { color: var(--bw-brand); }

.op-key { display: flex; gap: 8px; }
.op-actions { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
.op-status { color: var(--bw-success); font-size: 13px; }
.op-status.is-error { color: var(--bw-danger); }

.op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.op-grid .bw-label { margin-top: 0; }

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
