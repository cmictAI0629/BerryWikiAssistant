<template>
  <div class="sp">
    <header class="sp-head">
      <img class="sp-head__logo" :src="logo" alt="" />
      <div class="sp-tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="tab === 'chat'" :class="{ on: tab === 'chat' }" @click="tab = 'chat'">问答</button>
        <button type="button" role="tab" :aria-selected="tab === 'note'" :class="{ on: tab === 'note' }" @click="tab = 'note'">速记</button>
      </div>
      <span class="sp-head__spacer" />
      <button v-if="tab === 'chat'" type="button" class="bw-icon-btn" title="新对话" @click="chat?.reset()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <button type="button" class="bw-icon-btn" title="设置" @click="openOptions">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
      </button>
    </header>

    <div v-if="ready && !configured" class="sp-empty">
      <img :src="logo" alt="" width="48" height="48" />
      <h2>连接你的 OneBerryWiki</h2>
      <p>填写服务器地址和 API Key 后就能开始提问和记速记。</p>
      <button type="button" class="bw-btn bw-btn--primary" @click="openOptions">去设置</button>
    </div>
    <p v-else-if="error" class="sp-error">{{ error }}</p>

    <main v-if="configured" class="sp-main">
      <ChatView v-show="tab === 'chat'" ref="chat" :agents="ws?.agents || []" :knowledge-bases="ws?.knowledgeBases || []"
        :default-agent-id="settings.defaultAgentId" />
      <NoteView v-show="tab === 'note'" :knowledge-bases="writableKnowledgeBases(ws?.knowledgeBases || [])"
        :default-kb-id="settings.defaultKbId" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { browser } from 'wxt/browser'
import ChatView from '@/components/chat/ChatView.vue'
import NoteView from '@/components/NoteView.vue'
import { pendingQuestionItem, pendingTabItem, takePendingQuestion, takePendingTab, type SidePanelTab } from '@/lib/pending'
import { DEFAULT_SETTINGS, getSettings, isConfigured, settingsItem } from '@/lib/settings'
import { cachedWorkspace, loadWorkspace, writableKnowledgeBases, type Workspace } from '@/lib/workspace'

const logo = browser.runtime.getURL('/icon/48.png')
const tab = ref<SidePanelTab>('chat')
const ready = ref(false)
const configured = ref(false)
const ws = ref<Workspace | null>(null)
const error = ref('')
const settings = reactive({ ...DEFAULT_SETTINGS })
const chat = ref<InstanceType<typeof ChatView>>()

async function init() {
  Object.assign(settings, await getSettings())
  configured.value = isConfigured(settings)
  ready.value = true
  if (!configured.value) return
  ws.value = await cachedWorkspace()
  try {
    ws.value = await loadWorkspace()
    error.value = ''
  } catch (e) {
    if (!ws.value) error.value = (e as Error).message
  }
}

async function consumePending() {
  const t = await takePendingTab()
  if (t) tab.value = t
  const q = await takePendingQuestion()
  if (q) {
    tab.value = 'chat'
    await nextTick()
    await chat.value?.ask(q.query, { agentId: q.agentId, knowledgeBaseIds: q.knowledgeBaseIds })
  }
}

onMounted(async () => {
  await init()
  await consumePending()
  // 侧边栏已经开着时，弹出面板 / 右键菜单再转交问题过来
  pendingQuestionItem.watch((v) => { if (v) void consumePending() })
  pendingTabItem.watch((v) => { if (v) void consumePending() })
  // 在设置页改了连接，侧边栏跟着刷新
  settingsItem.watch(() => void init())
})

function openOptions() {
  void browser.runtime.openOptionsPage()
}
</script>

<style scoped>
.sp { display: flex; flex-direction: column; height: 100vh; }

.sp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bw-line);
  background: var(--bw-card);
}

.sp-head__logo { width: 24px; height: 24px; }
.sp-head__spacer { flex: 1; }

.sp-tabs {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bw-text) 6%, transparent);
}

.sp-tabs button {
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: none;
  color: var(--bw-text-2);
  cursor: pointer;
}

.sp-tabs button.on {
  background: var(--bw-card);
  color: var(--bw-brand);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.1);
}

.sp-main { flex: 1; min-height: 0; }

.sp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 24px;
  text-align: center;
}

.sp-empty h2 { margin: 6px 0 0; font-size: 16px; }
.sp-empty p { margin: 0 0 8px; color: var(--bw-text-2); font-size: 13px; }
.sp-error { margin: 10px 14px 0; color: var(--bw-danger); font-size: 12px; }
</style>
