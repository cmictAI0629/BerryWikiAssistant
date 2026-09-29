<template>
  <div class="cd-mask" @mousedown.self="emit('close')">
    <div class="cd" role="dialog" aria-modal="true" aria-label="保存剪藏">
      <header class="cd__head">
        <span class="cd__logo" aria-hidden="true"><img :src="logo" alt="" /></span>
        <h2>{{ heading }}</h2>
        <button type="button" class="cd__close" aria-label="关闭" @click="emit('close')">✕</button>
      </header>

      <!-- 还没连接 -->
      <div v-if="ctx && !ctx.configured" class="cd__state">
        <p>还没有连接 OneBerryWiki。先在设置里填写服务器地址和 API Key。</p>
        <button type="button" class="cd-btn cd-btn--primary" @click="openOptions">打开设置</button>
      </div>

      <!-- 已保存 -->
      <div v-else-if="saved" class="cd__state cd__state--ok">
        <div class="cd__ok-icon">✓</div>
        <p><b>已保存到「{{ kbName }}」</b></p>
        <p class="cd__muted">正在解析入库，稍后即可在知识库里检索到。{{ saved.screenshotSaved ? '截图已一并上传。' : '' }}</p>
        <div class="cd__ok-actions">
          <a v-if="viewUrl" class="cd-btn" :href="viewUrl" target="_blank" rel="noopener">在 OneBerryWiki 中查看</a>
          <button type="button" class="cd-btn cd-btn--primary" @click="emit('close')">完成</button>
        </div>
      </div>

      <template v-else>
        <div class="cd__body">
          <aside class="cd__side">
            <label class="cd__label" for="bw-clip-title">文档标题</label>
            <input id="bw-clip-title" v-model="title" class="cd__input" maxlength="200" />

            <label class="cd__label" for="bw-clip-kb">保存到知识库</label>
            <select id="bw-clip-kb" v-model="kbId" class="cd__input" :disabled="!ctx">
              <option v-if="!ctx" value="">加载中…</option>
              <option v-for="kb in ctx?.knowledgeBases || []" :key="kb.id" :value="kb.id">{{ kb.name }}</option>
            </select>

            <div class="cd__meta">
              <span class="cd__label">创建时间</span>
              <span>{{ createdAt }}</span>
            </div>
            <div class="cd__meta">
              <span class="cd__label">来源</span>
              <a :href="source" target="_blank" rel="noopener" class="cd__source">{{ source }}</a>
            </div>

            <template v-if="screenshot">
              <img :src="screenshot" class="cd__shot" alt="框选截图" />
              <label class="cd__check">
                <input v-model="saveShot" type="checkbox" /> 同时保存截图（图片会单独入库）
              </label>
            </template>
          </aside>

          <section class="cd__main">
            <span class="cd__label">文档内容</span>
            <MarkdownEditor v-model="markdown" class="cd__editor" placeholder="没有提取到文字，可以在这里补充…" />
          </section>
        </div>

        <footer class="cd__foot">
          <span v-if="error" class="cd__error">{{ error }}</span>
          <button type="button" class="cd-btn" @click="emit('close')">取消</button>
          <button type="button" class="cd-btn cd-btn--primary" :disabled="!canSave" @click="save">
            {{ saving ? '保存中…' : '确认保存' }}
          </button>
        </footer>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { browser } from 'wxt/browser'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { callBackground, type ClipContext, type SaveClipResult } from '@/lib/messages'

const props = defineProps<{
  heading: string
  initialTitle: string
  initialMarkdown: string
  source: string
  screenshot?: string
}>()
const emit = defineEmits<{ close: [] }>()

const logo = browser.runtime.getURL('/icon/48.png')
const title = ref(props.initialTitle)
const markdown = ref(props.initialMarkdown)
const saveShot = ref(true)
const ctx = ref<ClipContext | null>(null)
const kbId = ref('')
const saving = ref(false)
const saved = ref<SaveClipResult | null>(null)
const error = ref('')
const createdAt = new Date().toLocaleString('zh-CN', { hour12: false })

const kbName = computed(() => ctx.value?.knowledgeBases.find((k) => k.id === kbId.value)?.name || '')
const canSave = computed(() => !saving.value && !!kbId.value && (!!markdown.value.trim() || (!!props.screenshot && saveShot.value)))
const viewUrl = computed(() => ctx.value?.webBaseUrl && kbId.value
  ? `${ctx.value.webBaseUrl}/platform/knowledge-bases/${encodeURIComponent(kbId.value)}` : '')

onMounted(async () => {
  window.addEventListener('keydown', onKey, true)
  try {
    ctx.value = await callBackground<ClipContext>({ type: 'bw:clip-context' })
    kbId.value = ctx.value.defaultKbId
    if (ctx.value.configured && !ctx.value.knowledgeBases.length) error.value = '这个 API Key 下没有可写入的知识库'
  } catch (e) {
    error.value = (e as Error).message
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close') }
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    saved.value = await callBackground<SaveClipResult>({
      type: 'bw:save-clip',
      payload: {
        kbId: kbId.value,
        title: title.value.trim() || props.initialTitle,
        markdown: markdown.value.trim() || '（仅截图）',
        source: props.source,
        screenshot: props.screenshot && saveShot.value ? props.screenshot : undefined,
      },
    })
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

function openOptions() {
  void callBackground({ type: 'bw:open-options' })
  emit('close')
}
</script>

<style scoped>
.cd-mask {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
  font: 14px/1.55 var(--bw-font);
  color: var(--bw-text);
}

.cd {
  display: flex;
  flex-direction: column;
  width: min(1080px, 100%);
  max-height: min(820px, 100%);
  border-radius: 20px;
  background: var(--bw-card);
  box-shadow: 0 30px 80px -20px rgba(15, 23, 42, 0.5);
  overflow: hidden;
  animation: cd-in 0.18s ease-out;
}

@keyframes cd-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

.cd__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--bw-line);
}

.cd__head h2 { flex: 1; margin: 0; font-size: 16px; }
.cd__logo img { display: block; width: 24px; height: 24px; }

.cd__close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--bw-line);
  border-radius: 50%;
  background: transparent;
  color: var(--bw-text-2);
  cursor: pointer;
}

.cd__close:hover { color: var(--bw-brand); border-color: var(--bw-brand); }

.cd__body {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.cd__side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 20px;
  border-right: 1px solid var(--bw-line);
  overflow: auto;
}

.cd__main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 18px 20px;
}

.cd__editor { flex: 1; min-height: 360px; }

.cd__label { color: var(--bw-text-2); font-size: 12px; font-weight: 600; }

.cd__input {
  width: 100%;
  height: 38px;
  margin-bottom: 6px;
  padding: 0 12px;
  border: 1px solid var(--bw-line);
  border-radius: 10px;
  background: var(--bw-card);
  color: var(--bw-text);
  font: inherit;
  outline: none;
}

.cd__input:focus { border-color: var(--bw-brand); box-shadow: 0 0 0 3px var(--bw-brand-soft); }

.cd__meta { display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; font-size: 13px; }

.cd__source {
  color: var(--bw-brand);
  word-break: break-all;
  text-decoration: none;
}

.cd__shot {
  width: 100%;
  margin-top: 6px;
  border: 1px solid var(--bw-line);
  border-radius: 10px;
}

.cd__check { display: flex; align-items: center; gap: 6px; color: var(--bw-text-2); font-size: 12px; }

.cd__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--bw-line);
}

.cd__error { flex: 1; color: var(--bw-danger); font-size: 13px; }

.cd__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 48px 24px;
  text-align: center;
}

.cd__state p { margin: 0; }
.cd__muted { color: var(--bw-text-2); font-size: 13px; }

.cd__ok-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bw-success) 14%, transparent);
  color: var(--bw-success);
  font-size: 26px;
  font-weight: 700;
}

.cd__ok-actions { display: flex; gap: 10px; margin-top: 12px; }

.cd-btn {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 18px;
  border: 1px solid var(--bw-line);
  border-radius: 999px;
  background: var(--bw-card);
  color: var(--bw-text);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.cd-btn:hover { border-color: var(--bw-brand); color: var(--bw-brand); }

.cd-btn--primary {
  border: none;
  background: linear-gradient(135deg, color-mix(in srgb, var(--bw-brand) 70%, #38bdf8), var(--bw-brand));
  color: #fff;
  box-shadow: 0 8px 18px -10px var(--bw-brand);
}

.cd-btn--primary:hover { color: #fff; filter: brightness(1.05); }
.cd-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 760px) {
  .cd__body { grid-template-columns: minmax(0, 1fr); }
  .cd__side { border-right: none; border-bottom: 1px solid var(--bw-line); }
}
</style>
