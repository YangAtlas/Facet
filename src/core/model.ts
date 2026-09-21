import type { JSONContent } from '@tiptap/core'
export type PageOrientation = 'portrait' | 'landscape'
export const pageFormat = (page: {orientation?: PageOrientation}) => page.orientation === 'landscape'
  ? {width:320,height:180,label:'16:9 · 横版'}
  : {width:210,height:297,label:'A4 · 竖版'}
export type Block = JSONContent
export type Asset = { name: string; mime: string; data: string }
export interface FacetDocument {
  format: 'facet'; version: 1; id: string; revision: number;
  metadata: { title: string; subtitle: string; author: string; authorUrl: string; coverAssetId?: string; institute: string; date: string };
  page: { orientation?: PageOrientation; margin: number; header: string; footer: string; accent: string };
  content: Block[]; assets: Record<string, Asset>;
}
export const uid = () => crypto.randomUUID()
export const p = (text = ''): Block => ({ type: 'paragraph', attrs: { id: uid() }, content: text ? [{ type: 'text', text }] : [] })
export const colors: Record<string, string> = { darkblue: '#123b78', harvardcrimson: '#a51c30', emeraldgreen: '#00846c', royalpurple: '#663399', goldenyellow: '#c18a16', orange: '#bd692d', lightgray: '#707885' }
export const accentValue = (accent: string) => colors[accent] ?? (/^#[0-9a-f]{6}$/i.test(accent) ? accent : colors.darkblue)
export const variants: Record<string, { title: string; icon: string; color: string }> = {
  info: { title: '信息', icon: 'info-circle', color: 'darkblue' }, tip: { title: '建议', icon: 'lightbulb', color: 'emeraldgreen' },
  warning: { title: '注意', icon: 'exclamation-triangle', color: 'orange' }, important: { title: '重点', icon: 'exclamation-circle', color: 'harvardcrimson' },
  reflection: { title: '思考', icon: 'brain', color: 'royalpurple' }, highlight: { title: '', icon: '', color: 'goldenyellow' },
  custom: { title: '我的卡片', icon: 'star', color: 'royalpurple' }, definition: { title: '定义', icon: 'book', color: 'darkblue' },
  question: { title: '问题', icon: 'question-circle', color: 'orange' }, insight: { title: '洞见', icon: 'lightbulb', color: 'emeraldgreen' },
  experiment: { title: '实验', icon: 'flask', color: 'darkblue' }, result: { title: '结果', icon: 'chart-line', color: 'emeraldgreen' },
  conclusion: { title: '结论', icon: 'check-circle', color: 'harvardcrimson' }, literature: { title: '文献', icon: 'book-open', color: 'royalpurple' },
}
export const icons = ['book','lightbulb','rocket','flask','chart-line','graduation-cap','code','brain','check-circle','exclamation-triangle','star','arrow-right','tools','question-circle','heart','users','calendar-check','info-circle','exclamation-circle','book-open']
export const semanticItems = [
  { key: 'good', label: '完成', icon: 'check', color: 'emeraldgreen' }, { key: 'bad', label: '问题', icon: 'times', color: 'harvardcrimson' },
  { key: 'tool', label: '工具', icon: 'cog', color: 'darkblue' }, { key: 'idea', label: '想法', icon: 'lightbulb', color: 'goldenyellow' },
  { key: 'warning', label: '注意', icon: 'exclamation-triangle', color: 'orange' }, { key: 'star', label: '重点', icon: 'star', color: 'goldenyellow' },
  { key: 'arrow', label: '下一步', icon: 'arrow-right', color: 'darkblue' },
]
export function makeDocument(sample = false, orientation: PageOrientation = 'portrait'): FacetDocument {
  const title = sample ? '让想法，自成一页' : '未命名文档'
  return { format: 'facet', version: 1, id: uid(), revision: 0,
    metadata: { title, subtitle: sample ? '从一个问题开始，把思考慢慢写清楚。' : '', author: '', authorUrl: '', coverAssetId: '', institute: '', date: new Date().toISOString().slice(0,10) },
    page: { orientation, margin: orientation==='landscape'?18:25.4, header: 'RESEARCH NOTES', footer: 'Facet', accent: 'darkblue' }, assets: {},
    content: sample ? [
      { type: 'documentTitle', attrs: { id: uid(), cover: true } },
      { type: 'tableOfContents', attrs: { id: uid() } },
      { type: 'heading', attrs: { id: uid(), level: 1, icon: '', numbered: false, toc: true }, content: [{ type: 'text', text: '从这里开始' }] },
      p('这里是你的研究与写作空间。直接在纸面上记录，想法会自然流向下一页。文字、公式和重要的发现，都可以拥有自己的位置。'),
      { type: 'callout', attrs: { id: uid(), variant: 'tip', ...variants.tip }, content: [p('在右侧选择一个组件，就能把它插入到光标处。也可以在新的一行输入 /，快速找到你需要的内容。')] },
      { type: 'heading', attrs: { id: uid(), level: 2, numbered: false, toc: true }, content: [{ type: 'text', text: '给灵感一个清晰的结构' }] },
      p('试着记下一个问题、一条证据，或一个还没有答案的猜想。选中文字可以强调重点，点击公式可以再次编辑。'),
      { type: 'mathBlock', attrs: { id: uid(), latex: 'E = mc^2' } },
      { type: 'callout', attrs: { id: uid(), variant: 'reflection', ...variants.reflection }, content: [p('好的笔记不需要一次写完。先留下值得继续思考的部分。')] }, p(),
    ] : [{ type: 'documentTitle', attrs: { id: uid(), cover: true } }, { type: 'tableOfContents', attrs: { id: uid() } }, p()] }
}
export function walk(nodes: Block[], f: (n: Block) => void) { for (const n of nodes) { f(n); if(n.content) walk(n.content, f) } }
export function textOf(n: Block): string { return n.text ?? (n.content ?? []).map(textOf).join('') }
// Fragment identity is a layout concern. Merge only marked continuations, never ordinary adjacent blocks.
export function coalesce(nodes: Block[]): Block[] {
  const out: Block[] = []
  for (const original of nodes) {
    if(original.attrs?.layoutRepeat) continue
    const n = structuredClone(original), prev = out.at(-1)
    if(n.content) n.content = coalesce(n.content)
    if(prev && n.attrs?.continuation && prev.attrs?.id === n.attrs.id && prev.type === n.type) {
      if(n.type==='columns') prev.content=(prev.content??[]).map((column,index)=>({...column,content:coalesce([...(column.content??[]),...(n.content?.[index]?.content??[])])}))
      else prev.content = coalesce([...(prev.content ?? []), ...(n.content ?? [])])
    } else out.push(n)
  }
  return out
}
export function canonicalize(pages: Block[]): Block[] {
  const nodes = coalesce(pages.flatMap(page => page.type === 'page' ? page.content ?? [] : [page]))
  const seen = new Set<string>()
  walk(nodes, n => {
    if(n.type === 'text') return
    n.attrs = { ...n.attrs }
    delete n.attrs.continuation; delete n.attrs.fragmentOffset; delete n.attrs.renderVersion; delete n.attrs.layoutRepeat
    if(!n.attrs.id || seen.has(n.attrs.id)) n.attrs.id = uid()
    seen.add(n.attrs.id)
    if(n.type === 'image' && n.attrs.assetId) n.attrs.src = `asset:${n.attrs.assetId}`
    if(n.type === 'subfigure' && Array.isArray(n.attrs.items)) n.attrs.items = n.attrs.items.map((item: any) => ({ ...item, src: item.assetId ? `asset:${item.assetId}` : item.src }))
  })
  return nodes
}
export function hydrate(doc: FacetDocument): Block[] {
  const content = structuredClone(doc.content)
  walk(content, n => {
    if(n.type === 'image') { const a = doc.assets[n.attrs?.assetId]; if(a) n.attrs = { ...n.attrs, src: `data:${a.mime};base64,${a.data}` } }
    if(n.type === 'subfigure') n.attrs = { ...n.attrs, items: (n.attrs?.items ?? []).map((item: any) => { const a = doc.assets[item.assetId]; return a ? { ...item, src: `data:${a.mime};base64,${a.data}` } : item }) }
  })
  return content
}
const nodeTypes = new Set(['part','paragraph','text','heading','bulletList','orderedList','listItem','taskList','taskItem','blockquote','horizontalRule','hardBreak','callout','mathBlock','mathInline','codeBlock','image','subfigure','columns','column','table','tableRow','tableHeader','tableCell','pageBreak','badge','inlineIcon','semanticList','semanticItem','documentTitle','tableOfContents'])
const markTypes = new Set(['bold','italic','strike','code','link','underline','highlight','semanticStyle','textStyle'])
export function validateDocument(value: unknown): asserts value is FacetDocument {
  const d = value as FacetDocument
  if(!d || d.format !== 'facet' || d.version !== 1) throw new Error('此文件格式或版本尚不受支持；原文件不会被修改。')
  if(!d.id || !Array.isArray(d.content) || !d.metadata || typeof d.metadata.title !== 'string' || !d.page || !d.assets) throw new Error('文档结构不完整。请尝试恢复备份。')
  if(!Number.isFinite(d.page.margin) || d.page.margin < 10 || d.page.margin > 40 || !/^#[0-9a-f]{6}$/i.test(d.page.accent) && !colors[d.page.accent]) throw new Error('页面设置无效。')
  if(d.page.orientation!==undefined&&!['portrait','landscape'].includes(d.page.orientation))throw new Error('页面方向无效。')
  let count = 0
  walk(d.content, n => {
    if(++count > 50000 || !nodeTypes.has(n.type ?? '')) throw new Error('文档包含未知组件或超过当前容量，已停止打开以保护内容。')
    if(n.marks?.some(m => !markTypes.has(m.type))) throw new Error('文档包含尚不支持的文字样式，原文件保持不变。')
    if(n.type === 'image' && !d.assets[n.attrs?.assetId]) throw new Error('图片资源缺失。请恢复完整的 .facet 文件。')
  })
}
