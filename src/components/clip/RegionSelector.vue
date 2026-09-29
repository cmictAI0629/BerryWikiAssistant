<template>
  <div class="rs" :class="{ 'has-rect': !!rect }" @mousedown="onDown">
    <div v-if="!rect" class="rs__hint">拖动鼠标框选要剪藏的区域 · <kbd>Esc</kbd> 取消</div>
    <template v-if="rect">
      <div class="rs__box" :style="boxStyle" @mousedown.stop="startDrag($event, 'move')">
        <span v-for="h in HANDLES" :key="h" class="rs__handle" :class="`rs__handle--${h}`"
          @mousedown.stop="startDrag($event, h)" />
      </div>
      <div class="rs__bar" :style="barStyle" @mousedown.stop>
        <span class="rs__size">{{ Math.round(rect.width) }} × {{ Math.round(rect.height) }}</span>
        <button type="button" class="rs__btn" @click="emit('cancel')">取消 <kbd>Esc</kbd></button>
        <button type="button" class="rs__btn rs__btn--ok" @click="confirm">确认截取 <kbd>↵</kbd></button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Rect } from '@/lib/extract'

const emit = defineEmits<{ confirm: [Rect]; cancel: [] }>()

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
type Mode = 'draw' | 'move' | (typeof HANDLES)[number]

const rect = ref<Rect | null>(null)
let mode: Mode | null = null
let startX = 0
let startY = 0
let startRect: Rect | null = null

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const boxStyle = computed(() => rect.value && ({
  left: `${rect.value.left}px`,
  top: `${rect.value.top}px`,
  width: `${rect.value.width}px`,
  height: `${rect.value.height}px`,
}))

// 操作条放在选区下方；贴近底部时挪到选区里面的底边
const barStyle = computed(() => {
  if (!rect.value) return {}
  const below = rect.value.top + rect.value.height + 10
  const top = below + 44 > window.innerHeight ? rect.value.top + rect.value.height - 46 : below
  return { left: `${clamp(rect.value.left, 8, window.innerWidth - 330)}px`, top: `${Math.max(8, top)}px` }
})

function onDown(e: MouseEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  rect.value = { left: e.clientX, top: e.clientY, width: 0, height: 0 }
  startDrag(e, 'draw')
}

function startDrag(e: MouseEvent, m: Mode) {
  if (e.button !== 0) return
  e.preventDefault()
  mode = m
  startX = e.clientX
  startY = e.clientY
  startRect = rect.value && { ...rect.value }
  window.addEventListener('mousemove', onMove, true)
  window.addEventListener('mouseup', onUp, true)
}

function onMove(e: MouseEvent) {
  if (!mode || !startRect) return
  const x = clamp(e.clientX, 0, window.innerWidth)
  const y = clamp(e.clientY, 0, window.innerHeight)
  const dx = x - startX
  const dy = y - startY
  const r = { ...startRect }
  if (mode === 'draw') {
    r.left = Math.min(startX, x)
    r.top = Math.min(startY, y)
    r.width = Math.abs(dx)
    r.height = Math.abs(dy)
  } else if (mode === 'move') {
    r.left = clamp(startRect.left + dx, 0, window.innerWidth - startRect.width)
    r.top = clamp(startRect.top + dy, 0, window.innerHeight - startRect.height)
  } else {
    if (mode.includes('e')) r.width = Math.max(20, startRect.width + dx)
    if (mode.includes('s')) r.height = Math.max(20, startRect.height + dy)
    if (mode.includes('w')) {
      const w = Math.max(20, startRect.width - dx)
      r.left = startRect.left + startRect.width - w
      r.width = w
    }
    if (mode.includes('n')) {
      const h = Math.max(20, startRect.height - dy)
      r.top = startRect.top + startRect.height - h
      r.height = h
    }
  }
  rect.value = r
}

function onUp() {
  window.removeEventListener('mousemove', onMove, true)
  window.removeEventListener('mouseup', onUp, true)
  // 只是点了一下、没拖出选区：清掉，重新框
  if (mode === 'draw' && rect.value && (rect.value.width < 8 || rect.value.height < 8)) rect.value = null
  mode = null
}

function confirm() {
  if (rect.value) emit('confirm', { ...rect.value })
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); emit('cancel') }
  else if (e.key === 'Enter' && rect.value) { e.preventDefault(); e.stopPropagation(); confirm() }
}

onMounted(() => window.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('mousemove', onMove, true)
  window.removeEventListener('mouseup', onUp, true)
})
</script>

<style scoped>
.rs {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  background: rgba(15, 23, 42, 0.32);
  cursor: crosshair;
  user-select: none;
}

/* 有选区后遮罩改由选区的大阴影提供，选区本身透明 */
.rs.has-rect { background: transparent; }

.rs__hint {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.82);
  color: #fff;
  font-size: 13px;
  pointer-events: none;
}

.rs__box {
  position: absolute;
  border: 2px solid var(--bw-brand);
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.32);
  cursor: move;
}

.rs__handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid var(--bw-brand);
  border-radius: 2px;
  background: #fff;
}

.rs__handle--n, .rs__handle--s { left: calc(50% - 5px); cursor: ns-resize; }
.rs__handle--e, .rs__handle--w { top: calc(50% - 5px); cursor: ew-resize; }
.rs__handle--n { top: -6px; }
.rs__handle--s { bottom: -6px; }
.rs__handle--e { right: -6px; }
.rs__handle--w { left: -6px; }
.rs__handle--ne { top: -6px; right: -6px; cursor: nesw-resize; }
.rs__handle--sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.rs__handle--nw { top: -6px; left: -6px; cursor: nwse-resize; }
.rs__handle--se { bottom: -6px; right: -6px; cursor: nwse-resize; }

.rs__bar {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
}

.rs__size {
  padding: 0 10px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.82);
  color: #fff;
  font: 12px/1 ui-monospace, Consolas, monospace;
}

.rs__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: #fff;
  color: #1f2328;
  font-size: 13px;
  box-shadow: 0 6px 16px -6px rgba(15, 23, 42, 0.4);
  cursor: pointer;
}

.rs__btn--ok {
  background: var(--bw-brand);
  color: #fff;
  font-weight: 600;
}

kbd {
  padding: 0 5px;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.18);
  font: 11px/16px ui-monospace, Consolas, monospace;
}
</style>
