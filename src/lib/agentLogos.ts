/**
 * 内置智能体的默认 Logo：与 OneBerryWiki 网页端（frontend/src/config/builtinAgentLogos.ts）同一套，
 * 扩展里看到的智能体和网页端一致。改网页端那份时这里同步改。
 */
const BUILTIN_QUICK_ANSWER_ID = 'builtin-quick-answer'
const BUILTIN_SMART_REASONING_ID = 'builtin-smart-reasoning'
const BUILTIN_DATA_ANALYST_ID = 'builtin-data-analyst'
const BUILTIN_WIKI_RESEARCHER_ID = 'builtin-wiki-researcher'

function tile(from: string, to: string, glyph: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`
    + `<radialGradient id="h" cx=".2" cy=".1" r=".75">`
    + `<stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>`
    + `</radialGradient></defs>`
    + `<rect width="64" height="64" rx="16" fill="url(#g)"/><rect width="64" height="64" rx="16" fill="url(#h)"/>`
    + glyph
    + `</svg>`
}

const toDataURL = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`

// 快速问答：对话气泡里一道闪电——问一句，马上答（青蓝）
const QUICK_ANSWER = tile('#22d3ee', '#0369a1',
  `<path d="M22 15H42A8 8 0 0 1 50 23V34A8 8 0 0 1 42 42H30L21 50V42A8 8 0 0 1 14 34V23A8 8 0 0 1 22 15Z" fill="#fff"/>`
  + `<path d="M34.5 19L25 31.5H31.5L29.5 39L39.5 26H33L34.5 19Z" fill="#0284c7"/>`)

// 智能推理：三个相连的节点（一环扣一环的推理步骤）+ 一颗闪光星（紫罗兰）
const SMART_REASONING = tile('#a78bfa', '#5b21b6',
  `<path d="M19 43L31 22L45 41M19 43H45" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".85"/>`
  + `<circle cx="19" cy="43" r="6" fill="#fff"/><circle cx="31" cy="22" r="6" fill="#fff"/><circle cx="45" cy="41" r="6" fill="#fff"/>`
  + `<circle cx="31" cy="22" r="2.4" fill="#7c3aed"/>`
  + `<path d="M48 12L49.4 16.1L53.5 17.5L49.4 18.9L48 23L46.6 18.9L42.5 17.5L46.6 16.1Z" fill="#fef3c7"/>`)

// 维基问答：摊开的书，书页上有文字行——在 Wiki 知识库里深读（翠绿）
const WIKI_RESEARCHER = tile('#34d399', '#047857',
  `<path d="M13 19.5C13 18.1 14.1 17 15.5 17H27C29.8 17 32 19.2 32 22V47C32 44.8 30.2 43 28 43H15.5C14.1 43 13 41.9 13 40.5Z" fill="#fff"/>`
  + `<path d="M51 19.5C51 18.1 49.9 17 48.5 17H37C34.2 17 32 19.2 32 22V47C32 44.8 33.8 43 36 43H48.5C49.9 43 51 41.9 51 40.5Z" fill="#fff" opacity=".88"/>`
  + `<path d="M17.5 24H27M17.5 29H27M17.5 34H24M36.5 24H46.5M36.5 29H46.5M36.5 34H43" stroke="#10b981" stroke-width="2.2" stroke-linecap="round"/>`)

// 数据分析师：柱状图 + 上升趋势线（琥珀橙）
const DATA_ANALYST = tile('#fbbf24', '#ea580c',
  `<rect x="15" y="33" width="8" height="15" rx="2" fill="#fff" opacity=".7"/>`
  + `<rect x="28" y="26" width="8" height="22" rx="2" fill="#fff" opacity=".7"/>`
  + `<rect x="41" y="30" width="8" height="18" rx="2" fill="#fff" opacity=".7"/>`
  + `<path d="M15 28L26 20L36 24L49 13" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  + `<circle cx="49" cy="13" r="3.4" fill="#fff"/>`)

export const BUILTIN_AGENT_LOGOS: Record<string, string> = {
  [BUILTIN_QUICK_ANSWER_ID]: toDataURL(QUICK_ANSWER),
  [BUILTIN_SMART_REASONING_ID]: toDataURL(SMART_REASONING),
  [BUILTIN_WIKI_RESEARCHER_ID]: toDataURL(WIKI_RESEARCHER),
  [BUILTIN_DATA_ANALYST_ID]: toDataURL(DATA_ANALYST),
}

export function builtinAgentLogo(id?: string): string {
  return (id && BUILTIN_AGENT_LOGOS[id]) || ''
}

