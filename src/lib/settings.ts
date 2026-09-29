import { storage } from 'wxt/utils/storage'

/** 连接与偏好设置，存在 chrome.storage.local（只在本机，不同步到其他设备：里面有 API Key）。 */
export interface Settings {
  /** OneBerryWiki 的 API 地址，如 http://10.0.0.8:8080/api/v1 或 https://wiki.example.com/api/v1 */
  baseUrl: string
  apiKey: string
  /** 剪藏、速记默认写入的知识库 */
  defaultKbId: string
  /** 问答默认用的智能体 */
  defaultAgentId: string
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '',
  apiKey: '',
  defaultKbId: '',
  defaultAgentId: '',
}

export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS })

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch }
  await settingsItem.setValue(next)
  return next
}

export function isConfigured(s: Settings): boolean {
  return !!s.baseUrl && !!s.apiKey
}

/**
 * 用户可能填网页地址（http://host:15481）、带 /api/v1 的 API 地址，或多一个斜杠。
 * 统一成以 /api/v1 结尾、没有尾部斜杠的形式。
 */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '')
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`
  if (!/\/api\/v\d+$/i.test(url)) url = `${url}/api/v1`
  return url
}

/** API 地址对应的网页地址（去掉 /api/v1），用于「在 OneBerryWiki 中打开」。 */
export function webBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/api\/v\d+$/i, '')
}
