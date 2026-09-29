import { afterEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { detectServerFromActiveTab } from '@/lib/connect'

const activeTab = (url: string) =>
  vi.spyOn(browser.tabs, 'query').mockResolvedValue([{ url } as Awaited<ReturnType<typeof browser.tabs.query>>[number]])

const respond = (routes: Record<string, Response>) =>
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = new URL(url).pathname
    return routes[path]?.clone() ?? new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
  }))

describe('detectServerFromActiveTab', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('recognizes a server that ships the extension package', async () => {
    activeTab('http://10.0.0.8:15481/platform/settings?section=integration-api')
    respond({
      '/downloads/berrywiki-assistant/release.json': Response.json({ repository: 'https://github.com/cmictAI0629/BerryWikiAssistant' }),
    })
    expect(await detectServerFromActiveTab()).toBe('http://10.0.0.8:15481')
  })

  it('falls back to the unauthenticated /auth/me reply on older servers', async () => {
    activeTab('https://wiki.example.com/platform/knowledge-bases')
    respond({ '/api/v1/auth/me': Response.json({ error: 'Unauthorized: missing authentication' }, { status: 401 }) })
    expect(await detectServerFromActiveTab()).toBe('https://wiki.example.com')
  })

  it('ignores ordinary sites and browser pages', async () => {
    activeTab('https://news.example.com/article')
    respond({})
    expect(await detectServerFromActiveTab()).toBe('')

    activeTab('chrome://extensions')
    expect(await detectServerFromActiveTab()).toBe('')
  })
})
