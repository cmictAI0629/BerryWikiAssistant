<template>
  <RegionSelector v-if="state.mode === 'selecting'" @confirm="onRegion" @cancel="close" />
  <div v-else-if="state.mode === 'working'" class="cw">{{ state.message }}</div>
  <ClipDialog v-else-if="state.mode === 'dialog'" :key="state.key" :heading="state.heading" :initial-title="state.title"
    :initial-markdown="state.markdown" :source="state.source" :screenshot="state.screenshot" @close="close" />
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import ClipDialog from './ClipDialog.vue'
import RegionSelector from './RegionSelector.vue'
import { extractArticle, extractRegion, type Rect } from '@/lib/extract'
import { callBackground, type ClipCommand } from '@/lib/messages'
import TurndownService from 'turndown'

const props = defineProps<{ host: () => Element | undefined }>()

const state = reactive({
  mode: 'idle' as 'idle' | 'selecting' | 'working' | 'dialog',
  message: '',
  key: 0,
  heading: '',
  title: '',
  markdown: '',
  source: '',
  screenshot: '' as string | undefined,
})

function openDialog(heading: string, title: string, markdown: string, screenshot?: string) {
  Object.assign(state, {
    mode: 'dialog', key: state.key + 1, heading, title, markdown, screenshot,
    source: location.href,
  })
}

function close() {
  state.mode = 'idle'
}

/** 后台发来的命令 */
function run(cmd: ClipCommand) {
  if (cmd.type === 'bw:region-clip') {
    state.mode = 'selecting'
  } else if (cmd.type === 'bw:smart-clip') {
    state.mode = 'working'
    state.message = '正在提取正文…'
    // 让「提取中」先画出来再做同步的重活
    setTimeout(() => {
      const r = extractArticle(document)
      openDialog('智能剪藏', r.title || document.title, r.markdown)
    }, 30)
  } else if (cmd.type === 'bw:selection-clip') {
    openDialog('保存选中内容', document.title, selectionMarkdown() || cmd.text)
  }
}

function selectionMarkdown(): string {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return ''
  const box = document.createElement('div')
  for (let i = 0; i < sel.rangeCount; i++) box.appendChild(sel.getRangeAt(i).cloneContents())
  return new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' }).turndown(box).trim()
}

async function onRegion(rect: Rect) {
  // 先把选框藏起来、等浏览器重绘，再截图，截图里才不会有选框
  state.mode = 'idle'
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  let screenshot: string | undefined
  try {
    const full = await callBackground<string>({ type: 'bw:capture' })
    screenshot = await crop(full, rect)
  } catch {
    screenshot = undefined // 截图失败（比如页面禁止）不影响文字剪藏
  }
  const r = extractRegion(rect, document, props.host())
  openDialog('保存剪藏', document.title, r.markdown, screenshot)
}

/** captureVisibleTab 截的是整个视口（物理像素），按比例裁出选区 */
async function crop(dataUrl: string, rect: Rect): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = img.naturalWidth / window.innerWidth
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(rect.width * scale)
  canvas.height = Math.round(rect.height * scale)
  canvas.getContext('2d')!.drawImage(img, rect.left * scale, rect.top * scale, canvas.width, canvas.height,
    0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

defineExpose({ run })
</script>

<style scoped>
.cw {
  position: fixed;
  top: 24px;
  left: 50%;
  z-index: 2147483646;
  transform: translateX(-50%);
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.86);
  color: #fff;
  font: 13px/1.4 var(--bw-font);
  box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.5);
}
</style>
