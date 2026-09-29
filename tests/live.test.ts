/**
 * 连真实 OneBerryWiki 的冒烟测试（只读 + 问答，不往知识库里写东西）。
 * 默认跳过；设置环境变量后运行：
 *   BW_LIVE_URL=http://host:port BW_LIVE_KEY=sk-... npx vitest run tests/live.test.ts
 */
import { describe, expect, it } from 'vitest'
import {
  askStream, createSession, getMe, listAgents, listKnowledgeBases, listRecentKnowledge, type StreamEvent,
} from '@/lib/api'
import { normalizeBaseUrl, saveSettings } from '@/lib/settings'

const URL_ = process.env.BW_LIVE_URL
const KEY = process.env.BW_LIVE_KEY

describe.skipIf(!URL_ || !KEY)('live OneBerryWiki', () => {
  it('connects, lists resources and answers through both agent modes', { timeout: 240_000 }, async () => {
    await saveSettings({ baseUrl: normalizeBaseUrl(URL_!), apiKey: KEY! })

    const me = await getMe()
    expect(me.tenant?.id).toBeTruthy()

    const kbs = await listKnowledgeBases()
    const agents = await listAgents()
    console.log(`knowledge bases: ${kbs.length}, agents: ${agents.map((a) => a.id).join(', ')}`)
    expect(agents.some((a) => a.id === 'builtin-quick-answer')).toBe(true)
    expect(agents.some((a) => a.id === 'builtin-wiki-fixer')).toBe(false)

    if (kbs[0]) {
      const docs = await listRecentKnowledge(kbs[0].id, 3)
      console.log(`recent docs in "${kbs[0].name}": ${docs.map((d) => d.title || d.file_name).join(' / ')}`)
      expect(docs.length).toBeLessThanOrEqual(3)
    }

    for (const agentId of ['builtin-quick-answer', 'builtin-smart-reasoning']) {
      const sessionId = await createSession(`扩展冒烟测试 ${agentId}`)
      const events: StreamEvent[] = []
      await askStream(sessionId, { query: '用一句话介绍一下你自己。', agentId, onEvent: (e) => events.push(e) })
      const types = [...new Set(events.map((e) => e.response_type))]
      const answer = events.filter((e) => e.response_type === 'answer').map((e) => e.content).join('')
      const final = events.find((e) => e.response_type === 'complete')?.data?.final_content
      const error = events.find((e) => e.response_type === 'error')
      console.log(`[${agentId}] events: ${types.join(',')} | answer: ${(final || answer).slice(0, 80)}${error ? ` | error: ${error.content}` : ''}`)
      expect(error).toBeUndefined()
      expect((final || answer).length).toBeGreaterThan(0)
    }
  })
})
