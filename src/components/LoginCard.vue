<template>
  <!-- 登录卡片：弹出面板、侧边栏、设置页共用。第一屏是品牌页，点「登录」在卡片里填地址和 Key。 -->
  <div class="lc">
    <span class="lc-orb lc-orb--a" aria-hidden="true" />
    <span class="lc-orb lc-orb--b" aria-hidden="true" />

    <Transition name="lc-step" mode="out-in">
      <section v-if="step === 'welcome'" key="welcome" class="lc-welcome">
        <div class="lc-logo"><img :src="logo" alt="" /></div>
        <h1 class="lc-title">BerryWiki 知识助手</h1>
        <p class="lc-sub">知识库问答 · 网页剪藏 · Markdown 速记</p>

        <div class="lc-buttons">
          <button type="button" class="lc-btn lc-btn--solid" @click="toForm">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>
            登录 OneBerryWiki
          </button>
          <a class="lc-btn lc-btn--ghost" :href="HELP_URL" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/></svg>
            怎么获取 API Key
          </a>
        </div>

        <p class="lc-foot">
          连接你自己部署的 OneBerryWiki · <a :href="REPO_URL" target="_blank" rel="noopener noreferrer">GitHub</a> · v{{ version }}
        </p>
      </section>

      <form v-else key="form" class="lc-form" @submit.prevent="submit">
        <div class="lc-form__head">
          <button type="button" class="lc-back" title="返回" :disabled="loading" @click="step = 'welcome'">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <div class="lc-logo lc-logo--sm"><img :src="logo" alt="" /></div>
          <h2>登录 OneBerryWiki</h2>
        </div>

        <label class="lc-label" for="lc-url">服务器地址</label>
        <div class="lc-field">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>
          <input id="lc-url" ref="urlInput" v-model="baseUrl" placeholder="网页地址，如 http://10.0.0.8:15481" autocomplete="url" spellcheck="false" />
        </div>

        <label class="lc-label" for="lc-key">API Key</label>
        <div class="lc-field">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>
          <input id="lc-key" ref="keyInput" v-model="apiKey" :type="showKey ? 'text' : 'password'" placeholder="sk-…" autocomplete="off" spellcheck="false" />
          <button type="button" class="lc-eye" :title="showKey ? '隐藏' : '显示'" @click="showKey = !showKey">
            <svg v-if="showKey" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
          </button>
        </div>
        <p class="lc-hint">
          在 OneBerryWiki「设置 → API 信息」创建，能力至少勾选「检索知识库」「对话能力」「写入知识库内容」。Key 只保存在这台电脑的浏览器里。
        </p>

        <p v-if="error" class="lc-error" role="alert">{{ error }}</p>

        <button type="submit" class="lc-btn lc-btn--solid lc-submit" :disabled="loading">
          <span v-if="loading" class="lc-spin" aria-hidden="true" />
          {{ loading ? '正在连接…' : '登录' }}
        </button>
      </form>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { browser } from 'wxt/browser'
import { connect } from '@/lib/connect'
import { getSettings, webBaseUrl } from '@/lib/settings'
import type { Workspace } from '@/lib/workspace'

const emit = defineEmits<{ done: [Workspace] }>()

const REPO_URL = 'https://github.com/cmictAI0629/BerryWikiAssistant'
const HELP_URL = `${REPO_URL}#安装`

const logo = browser.runtime.getURL('/icon/128.png')
const version = browser.runtime.getManifest().version
const step = ref<'welcome' | 'form'>('welcome')
const baseUrl = ref('')
const apiKey = ref('')
const showKey = ref(false)
const loading = ref(false)
const error = ref('')
const urlInput = ref<HTMLInputElement>()
const keyInput = ref<HTMLInputElement>()

onMounted(async () => {
  // 退出登录时服务器地址是留着的，填回来
  baseUrl.value = webBaseUrl((await getSettings()).baseUrl)
})

async function toForm() {
  step.value = 'form'
  error.value = ''
  await nextTick()
  // Transition 是 out-in，等新表单挂上再聚焦
  setTimeout(() => (baseUrl.value ? keyInput : urlInput).value?.focus(), 220)
}

async function submit() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    emit('done', await connect(baseUrl.value, apiKey.value))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.lc {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  padding: 28px 26px 18px;
  background:
    radial-gradient(120% 70% at 15% 0%, rgba(103, 232, 249, 0.55), transparent 60%),
    radial-gradient(90% 60% at 100% 100%, rgba(14, 116, 144, 0.9), transparent 70%),
    linear-gradient(160deg, #06a3c4 0%, #0891b2 45%, #0e7490 100%);
  color: #fff;
  isolation: isolate;
}

/* 背景里两团慢慢漂的光 */
.lc-orb {
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  filter: blur(36px);
  opacity: 0.55;
  animation: lc-float 14s ease-in-out infinite alternate;
}

.lc-orb--a { top: -60px; right: -40px; width: 200px; height: 200px; background: #a5f3fc; }
.lc-orb--b { bottom: -80px; left: -60px; width: 240px; height: 240px; background: #0369a1; animation-duration: 18s; }

@keyframes lc-float {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(-24px, 18px) scale(1.12); }
}

@media (prefers-reduced-motion: reduce) {
  .lc-orb { animation: none; }
}

/* 侧边栏拉宽时内容不跟着变宽 */
.lc-welcome, .lc-form { width: 100%; max-width: 340px; margin: 0 auto; }

.lc-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.lc-logo {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 30px -14px rgba(8, 47, 73, 0.7);
}

.lc-logo img { width: 50px; height: 50px; }
.lc-logo--sm { width: 34px; height: 34px; border-radius: 10px; box-shadow: none; }
.lc-logo--sm img { width: 24px; height: 24px; }

.lc-title { margin: 18px 0 4px; font-size: 21px; font-weight: 700; letter-spacing: 0.5px; }
.lc-sub { margin: 0; font-size: 12.5px; opacity: 0.88; }

.lc-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin-top: 30px;
}

.lc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 14.5px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.lc-btn:hover:not(:disabled) { transform: translateY(-1px); }
.lc-btn:disabled { cursor: default; opacity: 0.85; }

.lc-btn--solid {
  background: #fff;
  color: #0e7490;
  box-shadow: 0 10px 24px -12px rgba(8, 47, 73, 0.8);
}

.lc-btn--solid:hover:not(:disabled) { background: #f0fdff; }

.lc-btn--ghost {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.lc-btn--ghost:hover { background: rgba(255, 255, 255, 0.22); }

.lc-foot { margin: 22px 0 0; font-size: 11.5px; opacity: 0.8; }
.lc-foot a { color: inherit; }

/* 第二屏：表单 */
.lc-form { display: flex; flex-direction: column; }

.lc-form__head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.lc-form__head h2 { margin: 0; font-size: 17px; }

.lc-back {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  cursor: pointer;
}

.lc-back:hover:not(:disabled) { background: rgba(255, 255, 255, 0.28); }

.lc-label { margin: 10px 0 6px; font-size: 12.5px; font-weight: 600; opacity: 0.95; }

.lc-field {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  color: #5b6270;
  transition: box-shadow 0.15s ease;
}

.lc-field:focus-within { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35); }
.lc-field svg { flex-shrink: 0; }

.lc-field input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #1f2328;
  font-size: 13.5px;
}

.lc-field input::placeholder { color: #9aa3b2; }

.lc-eye {
  display: grid;
  place-items: center;
  padding: 4px;
  border: none;
  background: none;
  color: #9aa3b2;
  cursor: pointer;
}

.lc-eye:hover { color: #0e7490; }

.lc-hint { margin: 8px 0 0; font-size: 11.5px; line-height: 1.6; opacity: 0.85; }

.lc-error {
  margin: 12px 0 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.95);
  color: #d54941;
  font-size: 12.5px;
}

.lc-submit { margin-top: 18px; }

.lc-spin {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(14, 116, 144, 0.25);
  border-top-color: #0e7490;
  border-radius: 50%;
  animation: lc-rot 0.8s linear infinite;
}

@keyframes lc-rot { to { transform: rotate(360deg); } }

/* 两屏之间的切换 */
.lc-step-enter-active, .lc-step-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.lc-step-enter-from { opacity: 0; transform: translateX(16px); }
.lc-step-leave-to { opacity: 0; transform: translateX(-16px); }
</style>
