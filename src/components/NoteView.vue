<template>
  <div class="note">
    <div class="note__row">
      <input v-model="draft.title" class="bw-input note__title" placeholder="标题（可不填，默认用第一行）" maxlength="200" />
    </div>
    <div class="note__row">
      <span class="note__label">保存到</span>
      <select v-model="kbId" class="bw-select note__kb" aria-label="知识库">
        <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">{{ kb.name }}</option>
      </select>
      <span class="note__saved">{{ draftHint }}</span>
    </div>
    <MarkdownEditor v-model="draft.content" class="note__editor"
      placeholder="随手记点什么……支持 Markdown：# 标题、- 列表、**加粗**、`代码`" />
    <p v-if="message" class="note__msg" :class="{ 'is-error': isError }">
      {{ message }}
      <a v-if="viewUrl" href="#" @click.prevent="openView">去看看</a>
    </p>
    <div class="note__actions">
      <button type="button" class="bw-btn" :disabled="!draft.content && !draft.title" @click="clear">清空</button>
      <button type="button" class="bw-btn bw-btn--primary" :disabled="!canSave" @click="save">
        {{ saving ? '保存中…' : '保存到知识库' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { createManualKnowledge, type KnowledgeBase } from '@/lib/api'
import { getSettings, saveSettings, webBaseUrl } from '@/lib/settings'

const props = defineProps<{ knowledgeBases: KnowledgeBase[]; defaultKbId: string }>()

// 草稿存在 local 区：关掉浏览器也不丢
const draftItem = storage.defineItem<{ title: string; content: string }>('local:noteDraft', { fallback: { title: '', content: '' } })
const draft = reactive({ title: '', content: '' })
const kbId = ref('')
const saving = ref(false)
const message = ref('')
const isError = ref(false)
const viewUrl = ref('')
const draftSavedAt = ref(0)

void draftItem.getValue().then((d) => Object.assign(draft, d))

let timer: ReturnType<typeof setTimeout> | undefined
watch(draft, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    void draftItem.setValue({ ...draft })
    draftSavedAt.value = Date.now()
  }, 500)
})

watch(() => [props.knowledgeBases, props.defaultKbId] as const, ([kbs, def]) => {
  if (kbs.some((k) => k.id === kbId.value)) return
  kbId.value = kbs.some((k) => k.id === def) ? def : kbs[0]?.id || ''
}, { immediate: true })
watch(kbId, (id, old) => { if (id && old) void saveSettings({ defaultKbId: id }) })

const draftHint = computed(() => (draftSavedAt.value && draft.content ? '草稿已自动保存' : ''))
const canSave = computed(() => !saving.value && !!kbId.value && !!draft.content.trim())

function autoTitle(content: string): string {
  const first = content.split('\n').map((l) => l.replace(/^#+\s*|[*_`>-]/g, '').trim()).find(Boolean) || ''
  return first.slice(0, 40) || `速记 ${new Date().toLocaleString('zh-CN', { hour12: false })}`
}

async function save() {
  saving.value = true
  message.value = ''
  isError.value = false
  viewUrl.value = ''
  try {
    const title = draft.title.trim() || autoTitle(draft.content)
    await createManualKnowledge(kbId.value, title, draft.content)
    const kb = props.knowledgeBases.find((k) => k.id === kbId.value)
    message.value = `已保存「${title}」到「${kb?.name || '知识库'}」，正在解析入库。`
    const web = webBaseUrl((await getSettings()).baseUrl)
    viewUrl.value = web ? `${web}/platform/knowledge-bases/${encodeURIComponent(kbId.value)}` : ''
    draft.title = ''
    draft.content = ''
    await draftItem.setValue({ title: '', content: '' })
  } catch (e) {
    isError.value = true
    message.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

function clear() {
  if (draft.content && !confirm('清空这篇速记？')) return
  draft.title = ''
  draft.content = ''
  message.value = ''
}

function openView() {
  if (viewUrl.value) void browser.tabs.create({ url: viewUrl.value })
}
</script>

<style scoped>
.note {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding: 12px 14px 14px;
}

.note__row { display: flex; align-items: center; gap: 8px; }
.note__title { font-weight: 600; }
.note__label { color: var(--bw-text-2); font-size: 12px; }
.note__kb { max-width: 60%; }
.note__saved { margin-left: auto; color: var(--bw-text-3); font-size: 12px; }
.note__editor { flex: 1; min-height: 240px; }
.note__msg { margin: 0; color: var(--bw-success); font-size: 13px; }
.note__msg.is-error { color: var(--bw-danger); }
.note__msg a { color: var(--bw-brand); }
.note__actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
