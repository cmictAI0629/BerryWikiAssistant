<template>
  <div class="md-editor" :class="{ 'is-preview': preview }">
    <div class="md-editor__toolbar">
      <button v-for="t in TOOLS" :key="t.key" type="button" class="md-editor__tool" :title="t.title"
        :disabled="preview" @mousedown.prevent @click="apply(t.key)" v-html="t.icon" />
      <span class="md-editor__spacer" />
      <span class="md-editor__count">{{ modelValue.length.toLocaleString() }} 字</span>
      <button type="button" class="md-editor__mode" @click="preview = !preview">{{ preview ? '编辑' : '预览' }}</button>
    </div>
    <textarea v-show="!preview" ref="area" class="md-editor__area" :value="modelValue" :placeholder="placeholder"
      spellcheck="false" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @keydown="onKeydown" />
    <div v-if="preview" class="md-editor__preview bw-md" v-html="html" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { renderMarkdown } from '@/lib/markdown'

const props = defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const area = ref<HTMLTextAreaElement>()
const preview = ref(false)
const html = computed(() => renderMarkdown(props.modelValue))

const svg = (d: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const TOOLS = [
  { key: 'bold', title: '加粗（Ctrl+B）', icon: svg('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>') },
  { key: 'heading', title: '标题', icon: svg('<path d="M6 5v14M18 5v14M6 12h12"/>') },
  { key: 'ul', title: '无序列表', icon: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>') },
  { key: 'ol', title: '有序列表', icon: svg('<path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 15.5a1 1 0 0 1 2 0c0 1-2 1.5-2 2.5h2"/>') },
  { key: 'link', title: '链接', icon: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>') },
  { key: 'image', title: '图片', icon: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>') },
  { key: 'code', title: '代码', icon: svg('<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>') },
] as const

type ToolKey = (typeof TOOLS)[number]['key']

function edit(fn: (sel: string) => { text: string; select?: [number, number] }, lineMode = false) {
  const el = area.value
  if (!el) return
  const value = props.modelValue
  let start = el.selectionStart
  let end = el.selectionEnd
  if (lineMode) {
    start = value.lastIndexOf('\n', start - 1) + 1
    const nl = value.indexOf('\n', end)
    end = nl === -1 ? value.length : nl
  }
  const { text, select } = fn(value.slice(start, end))
  emit('update:modelValue', value.slice(0, start) + text + value.slice(end))
  requestAnimationFrame(() => {
    el.focus()
    const [a, b] = select ?? [text.length, text.length]
    el.setSelectionRange(start + a, start + b)
  })
}

function wrap(before: string, after: string, fallback: string) {
  edit((sel) => {
    const inner = sel || fallback
    return { text: before + inner + after, select: [before.length, before.length + inner.length] }
  })
}

function prefixLines(prefix: (i: number) => string) {
  edit((sel) => {
    const lines = (sel || '').split('\n')
    const text = lines.map((l, i) => prefix(i) + l.replace(/^(#{1,6}\s|[-*]\s|\d+\.\s)/, '')).join('\n')
    return { text }
  }, true)
}

function apply(key: ToolKey) {
  switch (key) {
    case 'bold': return wrap('**', '**', '加粗文字')
    case 'heading': return prefixLines(() => '## ')
    case 'ul': return prefixLines(() => '- ')
    case 'ol': return prefixLines((i) => `${i + 1}. `)
    case 'link': return wrap('[', '](https://)', '链接文字')
    case 'image': return wrap('![', '](https://)', '图片说明')
    case 'code': {
      const el = area.value
      const multiline = el && props.modelValue.slice(el.selectionStart, el.selectionEnd).includes('\n')
      return multiline ? wrap('```\n', '\n```', '') : wrap('`', '`', 'code')
    }
  }
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    apply('bold')
  }
}
</script>

<style scoped>
.md-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--bw-line);
  border-radius: 12px;
  background: var(--bw-card);
  overflow: hidden;
}

.md-editor:focus-within {
  border-color: var(--bw-brand);
  box-shadow: 0 0 0 3px var(--bw-brand-soft);
}

.md-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--bw-line);
}

.md-editor__tool {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--bw-text-2);
  cursor: pointer;
}

.md-editor__tool:hover:not(:disabled) {
  background: var(--bw-brand-soft);
  color: var(--bw-brand);
}

.md-editor__tool:disabled {
  opacity: 0.35;
  cursor: default;
}

.md-editor__spacer { flex: 1; }

.md-editor__count {
  margin-right: 6px;
  color: var(--bw-text-3);
  font-size: 12px;
}

.md-editor__mode {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--bw-line);
  border-radius: 999px;
  background: transparent;
  color: var(--bw-text-2);
  font-size: 12px;
  cursor: pointer;
}

.md-editor__mode:hover { color: var(--bw-brand); border-color: var(--bw-brand); }

.md-editor__area,
.md-editor__preview {
  flex: 1;
  min-height: 160px;
  padding: 12px 14px;
  overflow: auto;
}

.md-editor__area {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  font: 13px/1.7 ui-monospace, SFMono-Regular, Consolas, "Microsoft YaHei", monospace;
}

.md-editor__preview { font-size: 13px; }
</style>
