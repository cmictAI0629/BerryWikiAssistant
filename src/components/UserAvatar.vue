<template>
  <!-- 用户头像：OneBerryWiki 里上传过头像就显示头像（/auth/me 直接带回 data URL），否则显示名字首字母 -->
  <span class="ua" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }">
    <img v-if="src && !broken" :src="src" alt="" @error="broken = true" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Me } from '@/lib/api'
import { displayName } from '@/lib/workspace'

const props = withDefaults(defineProps<{ me?: Me | null; size?: number }>(), { size: 36 })

const broken = ref(false)
const src = computed(() => {
  const a = props.me?.user?.avatar?.trim() || ''
  return /^(data:image\/|https?:\/\/)/i.test(a) ? a : ''
})
watch(src, () => { broken.value = false })
const initial = computed(() => [...(props.me ? displayName(props.me) : 'B')][0]?.toUpperCase() || 'B')
</script>

<style scoped>
.ua {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(135deg, #22d3ee, var(--bw-brand) 55%, var(--bw-brand-strong));
  color: #fff;
  font-weight: 700;
}

.ua img { width: 100%; height: 100%; object-fit: cover; }
</style>
