<template>
  <span class="agent-avatar" :class="{ 'is-image': !!image, 'is-letter': !image && !emoji }" :style="letterStyle"
    aria-hidden="true">
    <img v-if="image" :src="image" alt="" />
    <template v-else-if="emoji">{{ emoji }}</template>
    <template v-else>{{ letter }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Agent } from '@/lib/api'
import { builtinAgentLogo } from '@/lib/agentLogos'

// 与网页端一致：自己上传的 Logo（图片）> emoji > 内置智能体默认 Logo > 首字
const props = defineProps<{ agent?: Agent | null; size?: number }>()

const avatar = computed(() => props.agent?.avatar?.trim() || '')
const image = computed(() => {
  if (/^(data:image\/|https?:\/\/)/.test(avatar.value)) return avatar.value
  if (!avatar.value) return builtinAgentLogo(props.agent?.id)
  return ''
})
const emoji = computed(() => (!image.value && avatar.value && [...avatar.value].length <= 2 ? avatar.value : ''))
const letter = computed(() => [...(props.agent?.name || '?')][0])

const letterStyle = computed(() => {
  const size = `${props.size ?? 22}px`
  const base = { width: size, height: size, fontSize: `${Math.round((props.size ?? 22) * 0.55)}px` }
  if (image.value || emoji.value) return base
  // 按名字取一个稳定的色相
  let h = 0
  for (const ch of props.agent?.name || '') h = (h * 31 + ch.charCodeAt(0)) % 360
  return { ...base, background: `linear-gradient(135deg, hsl(${h} 70% 62%), hsl(${(h + 30) % 360} 65% 45%))` }
})
</script>

<style scoped>
.agent-avatar {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: 30%;
  background: var(--bw-brand-soft);
  line-height: 1;
  overflow: hidden;
}

.agent-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.agent-avatar.is-image { background: none; }
.agent-avatar.is-letter { color: #fff; font-weight: 700; }
</style>
