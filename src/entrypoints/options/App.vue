<template>
  <!-- 设置页：和弹出面板一样的窗口，居中显示。未登录是登录卡片，登录后是设置面板。 -->
  <div v-if="ready" class="op">
    <LoginCard v-if="!configured" class="op-window op-window--login" @done="init" />
    <SettingsPanel v-else class="op-window" :backable="false" @logout="init" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import LoginCard from '@/components/LoginCard.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { getSettings, isConfigured, settingsItem } from '@/lib/settings'

const ready = ref(false)
const configured = ref(false)

async function init() {
  configured.value = isConfigured(await getSettings())
  ready.value = true
}

onMounted(async () => {
  await init()
  // 在弹出面板 / 侧边栏里登录或退出，这里跟着切换
  settingsItem.watch(() => void init())
})
</script>

<style scoped>
.op {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(60% 50% at 20% 10%, color-mix(in srgb, var(--bw-brand) 14%, transparent), transparent 70%),
    radial-gradient(50% 50% at 90% 90%, color-mix(in srgb, #38bdf8 14%, transparent), transparent 70%),
    var(--bw-bg);
}

.op-window {
  width: 400px;
  height: min(680px, calc(100vh - 48px));
  overflow: hidden;
  border-radius: 24px;
  box-shadow: 0 30px 70px -30px rgba(8, 47, 73, 0.55), 0 2px 6px rgba(15, 23, 42, 0.08);
}

.op-window--login { height: auto; min-height: 540px; }
</style>
