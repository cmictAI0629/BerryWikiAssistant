<template>
  <div class="chat">
    <div ref="scroller" class="chat__list">
      <div v-if="!messages.length" class="chat__empty">
        <AgentAvatar :agent="currentAgent" :size="48" />
        <h2>{{ currentAgent?.name || 'BerryWiki' }}</h2>
        <p>{{ currentAgent?.description || '向你的知识库提问，边浏览边问，不打断当前工作。' }}</p>
        <div class="chat__tips">
          <button type="button" @click="askAboutPage('总结一下这个网页的要点')">总结当前网页</button>
          <button type="button" @click="askAboutPage('这个网页的内容和知识库里哪些资料相关？')">找知识库里的相关资料</button>
        </div>
      </div>

      <div v-for="(m, i) in messages" :key="i" class="msg" :class="`msg--${m.role}`">
        <template v-if="m.role === 'user'">
          <div class="msg__bubble">
            <div v-if="m.pageTitle" class="msg__page">📄 附带网页：{{ m.pageTitle }}</div>
            <img v-for="(img, k) in m.images || []" :key="k" :src="img" class="msg__img" alt="" />
            <div class="msg__text">{{ m.content }}</div>
          </div>
        </template>
        <template v-else>
          <details v-if="m.thinking" class="msg__thinking">
            <summary>{{ m.streaming && !m.content ? '思考中…' : '思考过程' }}</summary>
            <div class="bw-md" v-html="renderMarkdown(m.thinking)" />
          </details>
          <ul v-if="m.steps?.length" class="msg__steps">
            <li v-for="s in m.steps" :key="s.id" :class="`is-${s.status}`">
              <span class="msg__step-dot" />{{ toolLabel(s.name) }}
              <small v-if="s.status === 'failed'">失败</small>
            </li>
          </ul>
          <div v-if="m.content" class="msg__answer bw-md" v-html="renderMarkdown(m.content)" />
          <div v-else-if="m.streaming && !m.thinking && !m.steps?.length" class="msg__typing"><i /><i /><i /></div>
          <p v-if="m.error" class="msg__error">{{ m.error }}</p>
          <details v-if="m.references?.length" class="msg__refs">
            <summary>引用了 {{ m.references.length }} 条资料</summary>
            <a v-for="(r, k) in m.references" :key="r.id || k" class="msg__ref" href="#" @click.prevent="openReference(r)">
              <b>{{ k + 1 }}. {{ r.knowledge_title || r.knowledge_filename || '未命名文档' }}</b>
              <span>{{ snippet(r.content) }}</span>
            </a>
          </details>
          <div v-if="!m.streaming && m.content" class="msg__tools">
            <button type="button" title="复制回答" @click="copy(m.content)">{{ copied === i ? '已复制' : '复制' }}</button>
          </div>
        </template>
      </div>
    </div>

    <div class="composer bw-card" :class="{ 'is-busy': busy }">
      <div v-if="images.length || withPage" class="composer__chips">
        <span v-if="withPage" class="composer__chip">📄 附带当前网页 <button type="button" @click="withPage = false">✕</button></span>
        <span v-for="(img, k) in images" :key="k" class="composer__thumb">
          <img :src="img" alt="" /><button type="button" @click="images.splice(k, 1)">✕</button>
        </span>
      </div>
      <textarea ref="input" v-model="query" class="composer__input" rows="2"
        :placeholder="`向${currentAgent?.name || '知识库'}提问…（Enter 发送，Shift+Enter 换行）`"
        @keydown.enter.exact.prevent="send()" @paste="onPaste" />
      <div class="composer__bar">
        <select v-model="kbScope" class="bw-select composer__scope" aria-label="提问范围">
          <option value="">全部知识库</option>
          <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">{{ kb.name }}</option>
        </select>
        <label class="composer__agent">
          <AgentAvatar :agent="currentAgent" :size="18" />
          <select v-model="agentId" class="bw-select" aria-label="智能体">
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <button type="button" class="composer__icon" :class="{ 'is-on': withPage }" title="附带当前网页内容一起提问"
          @click="withPage = !withPage">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>
        </button>
        <button v-if="busy" type="button" class="composer__send is-stop" title="停止生成" @click="stop">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        </button>
        <button v-else type="button" class="composer__send" :disabled="!query.trim()" title="发送" @click="send()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'
import AgentAvatar from '@/components/AgentAvatar.vue'
import {
  askStream, createSession, stopGeneration,
  type Agent, type KnowledgeBase, type Reference, type StreamEvent,
} from '@/lib/api'
import { renderMarkdown } from '@/lib/markdown'
import { saveSettings, webBaseUrl, getSettings } from '@/lib/settings'

interface Step { id: string; name: string; status: 'running' | 'done' | 'failed' }
interface Message {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  steps?: Step[]
  references?: Reference[]
  error?: string
  streaming?: boolean
  images?: string[]
  pageTitle?: string
}

const props = defineProps<{ agents: Agent[]; knowledgeBases: KnowledgeBase[]; defaultAgentId: string }>()

// 对话存在 session 区：关掉侧边栏再打开还在，关浏览器就清掉
const conversationItem = storage.defineItem<{ sessionId: string; messages: Message[] } | null>('session:conversation', { fallback: null })

const messages = ref<Message[]>([])
const sessionId = ref('')
const query = ref('')
const images = ref<string[]>([])
const withPage = ref(false)
const kbScope = ref('')
const agentId = ref('')
const busy = ref(false)
const copied = ref(-1)
const scroller = ref<HTMLElement>()
const input = ref<HTMLTextAreaElement>()
let controller: AbortController | null = null
let assistantMessageId = ''

const currentAgent = computed(() => props.agents.find((a) => a.id === agentId.value) || null)

watch(() => [props.agents, props.defaultAgentId] as const, ([agents, def]) => {
  if (agents.some((a) => a.id === agentId.value)) return
  agentId.value = agents.some((a) => a.id === def) ? def
    : agents.find((a) => a.id === 'builtin-smart-reasoning')?.id || agents[0]?.id || ''
}, { immediate: true })
watch(agentId, (id, old) => { if (id && old) void saveSettings({ defaultAgentId: id }) })

void conversationItem.getValue().then((c) => {
  if (c && !messages.value.length) {
    sessionId.value = c.sessionId
    messages.value = c.messages.map((m) => ({ ...m, streaming: false }))
    scrollToEnd()
  }
})

function persist() {
  void conversationItem.setValue({ sessionId: sessionId.value, messages: messages.value.slice(-40) })
}

function scrollToEnd() {
  void nextTick(() => scroller.value?.scrollTo({ top: scroller.value.scrollHeight }))
}

const TOOL_LABELS: Record<string, string> = {
  knowledge_search: '检索知识库',
  search_knowledge: '检索知识库',
  search_memory: '回忆历史对话',
  query_knowledge_graph: '查询知识图谱',
  list_documents: '浏览文档列表',
  grep_chunks: '全文检索',
  list_knowledge_chunks: '读取文档片段',
  get_document_info: '查看文档信息',
  read_document: '阅读文档',
  web_search: '联网搜索',
  web_fetch: '读取网页',
  database_query: '查询数据库',
  data_analysis: '数据分析',
  sequentialthinking: '分步思考',
  todo_write: '整理任务',
  shell_exec: '在沙箱中执行',
  read_file: '读取文件',
}
function toolLabel(name: string) {
  return TOOL_LABELS[name] || (name.startsWith('wiki_') ? '查阅 Wiki' : `调用 ${name}`)
}

function snippet(text?: string) {
  // 片段是 Markdown 原文，去掉标题、加粗、表格等符号再截断
  const t = (text || '').replace(/[#*`>|_]+|-{3,}|\.{3}/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > 90 ? `${t.slice(0, 90)}…` : t
}

async function openReference(r: Reference) {
  if (r.knowledge_source && /^https?:\/\//.test(r.knowledge_source)) {
    void browser.tabs.create({ url: r.knowledge_source })
    return
  }
  const web = webBaseUrl((await getSettings()).baseUrl)
  if (web && r.knowledge_base_id) void browser.tabs.create({ url: `${web}/platform/knowledge-bases/${encodeURIComponent(r.knowledge_base_id)}` })
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  copied.value = messages.value.findIndex((m) => m.content === text)
  setTimeout(() => { copied.value = -1 }, 1500)
}

/** 读当前标签页的标题、地址和正文（最多 12000 字） */
async function readActivePage(): Promise<{ title: string; url: string; text: string } | null> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.id) return null
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ title: document.title, url: location.href, text: (document.body?.innerText || '').slice(0, 12000) }),
    })
    return (res?.result as { title: string; url: string; text: string }) || null
  } catch {
    return null // 浏览器内置页面等读不了
  }
}

function askAboutPage(q: string) {
  withPage.value = true
  void send(q)
}

function onPaste(e: ClipboardEvent) {
  const file = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'))?.getAsFile()
  if (!file) return
  if (!currentAgent.value?.config?.image_upload_enabled) return // 这个智能体不支持图片，当普通粘贴
  e.preventDefault()
  const reader = new FileReader()
  reader.onload = () => images.value.push(String(reader.result))
  reader.readAsDataURL(file)
}

/** 外部（弹出面板、右键菜单）转交过来的问题 */
async function ask(q: string, opts: { agentId?: string; knowledgeBaseIds?: string[] } = {}) {
  if (opts.agentId && props.agents.some((a) => a.id === opts.agentId)) agentId.value = opts.agentId
  if (opts.knowledgeBaseIds) kbScope.value = opts.knowledgeBaseIds[0] || ''
  await send(q)
}

async function send(text?: string) {
  const q = (text ?? query.value).trim()
  if (!q || busy.value || !agentId.value) return
  busy.value = true
  query.value = ''
  const imgs = images.value.splice(0)

  let page: Awaited<ReturnType<typeof readActivePage>> = null
  if (withPage.value) page = await readActivePage()
  const fullQuery = page
    ? `以下是我正在浏览的网页，请结合它回答。\n【网页标题】${page.title}\n【网页地址】${page.url}\n【网页内容】\n${page.text}\n\n【我的问题】${q}`
    : q

  messages.value.push({ role: 'user', content: q, images: imgs, pageTitle: page?.title })
  const reply: Message = { role: 'assistant', content: '', streaming: true, steps: [] }
  messages.value.push(reply)
  const msg = messages.value[messages.value.length - 1]! // 取响应式代理，后面的修改才会刷新界面
  scrollToEnd()

  controller = new AbortController()
  assistantMessageId = ''
  try {
    if (!sessionId.value) sessionId.value = await createSession(q.slice(0, 40))
    await askStream(sessionId.value, {
      query: fullQuery,
      agentId: agentId.value,
      knowledgeBaseIds: kbScope.value ? [kbScope.value] : undefined,
      images: imgs,
      signal: controller.signal,
      onEvent: (e) => onEvent(msg, e),
    })
  } catch (e) {
    msg.error = (e as Error).message
  } finally {
    msg.streaming = false
    busy.value = false
    controller = null
    persist()
    scrollToEnd()
  }
}

function onEvent(msg: Message, e: StreamEvent) {
  switch (e.response_type) {
    case 'agent_query':
      assistantMessageId = e.assistant_message_id || e.data?.assistant_message_id || ''
      break
    case 'thinking':
      if (e.content) msg.thinking = (msg.thinking || '') + e.content
      break
    case 'answer':
      if (e.content) msg.content += e.content
      break
    case 'tool_call':
      msg.steps!.push({ id: e.data?.tool_call_id || String(msg.steps!.length), name: e.data?.tool_name || '工具', status: 'running' })
      // 工具调用前的回答只是开场白，最终答案以 complete 里的为准
      break
    case 'tool_result': {
      const step = msg.steps!.find((s) => s.id === e.data?.tool_call_id)
      if (step) step.status = e.data?.success === false ? 'failed' : 'done'
      collectReferences(msg, e.data)
      break
    }
    case 'references':
      if (e.knowledge_references?.length) msg.references = e.knowledge_references
      break
    case 'error':
      msg.error = e.content || e.data?.error || '回答出错了'
      break
    case 'complete':
      if (typeof e.data?.final_content === 'string' && e.data.final_content) msg.content = e.data.final_content
      msg.steps!.forEach((s) => { if (s.status === 'running') s.status = 'done' })
      break
  }
  scrollToEnd()
}

/**
 * 智能推理模式不单独推送引用（只有快速问答会发 references 事件），引用藏在工具结果里：
 * 检索类工具的 data.results（片段），读文档类工具的 knowledge_id / knowledge_title（整篇）。
 * 按文档去重；读过全文的排在前面，最多 8 条。
 */
function collectReferences(msg: Message, data?: Record<string, any>) {
  if (!data || data.success === false) return
  const refs = msg.references ? [...msg.references] : []
  const add = (r: Reference, front = false) => {
    if (!r.knowledge_id) return
    const i = refs.findIndex((x) => x.knowledge_id === r.knowledge_id)
    if (i >= 0) {
      const existing = refs[i]!
      refs[i] = { ...r, ...existing, knowledge_base_id: existing.knowledge_base_id || r.knowledge_base_id }
      if (front) refs.unshift(...refs.splice(i, 1))
    } else if (front) refs.unshift(r)
    else refs.push(r)
  }
  if (Array.isArray(data.results)) {
    for (const r of data.results) {
      add({
        id: r.chunk_id || r.id || r.knowledge_id,
        knowledge_id: r.knowledge_id,
        knowledge_title: r.knowledge_title,
        knowledge_base_id: r.knowledge_base_id,
        knowledge_source: r.knowledge_source,
        content: r.match_snippet || r.content,
      })
    }
  } else if (data.knowledge_id) {
    add({
      id: data.knowledge_id,
      knowledge_id: data.knowledge_id,
      knowledge_title: data.knowledge_title || data.document?.file_name || data.document?.title,
      knowledge_base_id: data.knowledge_base_id || data.document?.knowledge_base_id,
      knowledge_source: data.document?.source,
      content: data.document?.description,
    }, true)
  }
  msg.references = refs.slice(0, 8)
}

async function stop() {
  controller?.abort()
  if (sessionId.value && assistantMessageId) await stopGeneration(sessionId.value, assistantMessageId).catch(() => {})
}

function reset() {
  if (busy.value) void stop()
  messages.value = []
  sessionId.value = ''
  withPage.value = false
  images.value = []
  void conversationItem.setValue(null)
  void nextTick(() => input.value?.focus())
}

defineExpose({ ask, reset })
</script>

<style scoped>
.chat { display: flex; flex-direction: column; height: 100%; min-height: 0; }

.chat__list {
  flex: 1;
  min-height: 0;
  padding: 12px 14px 8px;
  overflow-y: auto;
}

.chat__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 48px 12px 24px;
  text-align: center;
}

.chat__empty h2 { margin: 6px 0 0; font-size: 16px; }
.chat__empty p { margin: 0; color: var(--bw-text-2); font-size: 13px; }
.chat__tips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 14px; }

.chat__tips button {
  padding: 7px 14px;
  border: 1px solid var(--bw-line);
  border-radius: 999px;
  background: var(--bw-card);
  font-size: 12px;
  cursor: pointer;
}

.chat__tips button:hover { border-color: var(--bw-brand); color: var(--bw-brand); }

.msg { margin-bottom: 14px; }
.msg--user { display: flex; justify-content: flex-end; }

.msg__bubble {
  max-width: 88%;
  padding: 9px 13px;
  border-radius: 16px 16px 4px 16px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--bw-brand) 72%, #38bdf8), var(--bw-brand));
  color: #fff;
}

.msg__text { white-space: pre-wrap; word-break: break-word; }
.msg__page { margin-bottom: 4px; font-size: 12px; opacity: 0.9; }
.msg__img { display: block; max-width: 100%; max-height: 160px; margin-bottom: 6px; border-radius: 8px; }

.msg__thinking, .msg__refs {
  margin-bottom: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--bw-text) 4%, transparent);
  font-size: 12px;
  color: var(--bw-text-2);
}

.msg__thinking summary, .msg__refs summary { cursor: pointer; }
.msg__thinking .bw-md { margin-top: 6px; font-size: 12px; }

.msg__steps { margin: 0 0 8px; padding: 0; list-style: none; font-size: 12px; color: var(--bw-text-2); }
.msg__steps li { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.msg__steps small { color: var(--bw-danger); }

.msg__step-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--bw-success);
}

.is-running .msg__step-dot { background: var(--bw-brand); animation: pulse 1s ease-in-out infinite; }
.is-failed .msg__step-dot { background: var(--bw-danger); }

@keyframes pulse { 50% { opacity: 0.3; } }

.msg__answer { font-size: 14px; }
.msg__error { margin: 6px 0 0; color: var(--bw-danger); font-size: 13px; }

.msg__typing { display: inline-flex; gap: 4px; padding: 6px 0; }
.msg__typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--bw-text-3); animation: pulse 1s ease-in-out infinite; }
.msg__typing i:nth-child(2) { animation-delay: 0.15s; }
.msg__typing i:nth-child(3) { animation-delay: 0.3s; }

.msg__ref {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.msg__ref:hover { background: var(--bw-brand-soft); }
.msg__ref b { color: var(--bw-text); font-weight: 600; }

.msg__tools button {
  margin-top: 4px;
  padding: 2px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--bw-text-3);
  font-size: 12px;
  cursor: pointer;
}

.msg__tools button:hover { background: var(--bw-brand-soft); color: var(--bw-brand); }

.composer { margin: 0 10px 10px; padding: 8px 10px; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.composer:focus-within { border-color: color-mix(in srgb, var(--bw-brand) 50%, transparent); box-shadow: 0 0 0 3px var(--bw-brand-soft); }

.composer__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }

.composer__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bw-brand-soft);
  color: var(--bw-brand);
  font-size: 12px;
}

.composer__chip button, .composer__thumb button {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 11px;
}

.composer__thumb { position: relative; }
.composer__thumb img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; }
.composer__thumb button { position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%; background: var(--bw-text); color: var(--bw-card); }

.composer__input {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  line-height: 1.6;
}

.composer__bar { display: flex; align-items: center; gap: 6px; }
.composer__scope { max-width: 110px; }
.composer__agent { display: inline-flex; flex: 1; align-items: center; gap: 4px; min-width: 0; }
.composer__agent .bw-select { flex: 1; min-width: 0; }

.composer__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 9px;
  background: none;
  color: var(--bw-text-2);
  cursor: pointer;
}

.composer__icon:hover, .composer__icon.is-on { background: var(--bw-brand-soft); color: var(--bw-brand); }

.composer__send {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in srgb, var(--bw-brand) 68%, #38bdf8), var(--bw-brand));
  color: #fff;
  cursor: pointer;
}

.composer__send:disabled { background: var(--bw-brand-soft-2); color: color-mix(in srgb, var(--bw-brand) 50%, transparent); cursor: default; }
.composer__send.is-stop { background: var(--bw-text); color: var(--bw-card); }
</style>
