import type { Editor } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'
import { Paginator } from '../editor/pagination'
import { esc } from '../editor/extensions'
import { textOf, type Block, type FacetDocument } from './model'
import { snapshotStyles } from './export'
import { defaultPreferences, type BeamerSettings } from './preferences'
import zjuLogo from '../assets/zju-wordmark.png?inline'

// An independent PDF layout: the source note and its paper pagination stay intact.
export function beamerGroups(doc:FacetDocument) {
  const groups:{title:string;section:string;kind:'content'|'part';content:Block[]}[]=[]
  let section='',title=doc.metadata.title,current:typeof groups[number]|undefined
  for(const node of doc.content){
    if(node.type==='documentTitle'||node.type==='tableOfContents')continue
    if(node.type==='part'){
      section=textOf(node)||'未命名部分';title=section;current=undefined
      groups.push({title:section,section,kind:'part',content:[]});continue
    }
    if(node.type==='heading'){
      title=textOf(node)||'未命名标题'
      if(node.attrs?.level!==3){if(node.attrs?.level===1)section=title;current=undefined;continue}
      current={title,section,kind:'content',content:[]};groups.push(current);continue
    }
    if(!current){current={title,section,kind:'content',content:[]};groups.push(current)}
    current.content.push(node)
  }
  return groups.filter(g=>g.kind==='part'||g.content.length===0||g.content.some(n=>n.type!=='paragraph'||!!textOf(n)))
}

export async function beamerSnapshot(editor:Editor,doc:FacetDocument,options:BeamerSettings|string=defaultPreferences.beamer){
  const settings=typeof options==='string'?{...defaultPreferences.beamer,branding:'text' as const,tag:options}:options
  await document.fonts.ready
  await Promise.all(Array.from(editor.view.dom.querySelectorAll('img')).map(i=>i.decode()))
  const paginator=new Paginator(editor.schema,{width:1120,height:470,className:'beamer-content'})
  const serializer=DOMSerializer.fromSchema(editor.schema)
  const slides:{title:string;section:string;kind:string;body:string}[]=[]
  const m=doc.metadata
  if(settings.cover)slides.push({title:m.title,section:'',kind:'cover',body:`<div class="beamer-title-card">${esc(m.title)}</div>${[m.subtitle,m.author,m.institute,m.date].filter(Boolean).map(value=>`<p>${esc(value)}</p>`).join('')}`})
  try{
    for(const group of beamerGroups(doc)){
      if(group.kind==='part'){slides.push({...group,body:`<div class="beamer-title-card">${esc(group.title)}</div>`});continue}
      const result=paginator.layout({...doc,page:{...doc.page,orientation:'landscape'},content:group.content})
      if(result.issues.length)throw new Error(`Beamer「${group.title}」：${result.issues[0].message}`)
      for(const [i,page] of result.pages.entries()){
        const container=document.createElement('div')
        for(const node of page.content??[])if(node.type!=='pageBreak')container.append(serializer.serializeNode(editor.schema.nodeFromJSON(node)))
        // Pagination uses repeated table headers; keep these visible in the PDF.
        container.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'))
        slides.push({title:group.title+(i?`（续${i>1?' '+i:''}）`:''),section:group.section,kind:'content',body:container.innerHTML})
      }
    }
  }finally{paginator.destroy()}
  if(!slides.length)throw new Error('没有可导出的内容，请添加正文或启用封面。')
  const branding=settings.branding==='zju'?`<img class="beamer-logo" src="${zjuLogo}" alt="浙江大学 ZJU">`:settings.branding==='text'?`<b>${esc(settings.tag)}</b>`:''
  const root=document.createElement('main');root.className='beamer-deck document-content'
  root.innerHTML=slides.map((slide,i)=>`<section class="facet-page beamer-slide beamer-${slide.kind}"><header class="beamer-nav"><span>${esc(slide.section||m.title)}</span>${branding}</header>${slide.kind==='content'?`<div class="beamer-frame-title">${esc(slide.title)}</div>`:''}<div class="beamer-content beamer-body">${slide.body}</div><footer class="beamer-footer"${settings.footer?'':' style="display:none"'}><span>${esc(m.author)}</span><span>${esc(m.date)}</span><span>${esc(m.title)}</span><span>${i+1} / ${slides.length}</span></footer></section>`).join('')
  // Check the final DOM with the same fonts and sizing used by PDF printing.
  const host=document.createElement('div');host.style.cssText='position:absolute;left:-20000px;top:0;visibility:hidden';host.append(root);document.body.append(host)
  try{
    await Promise.all(Array.from(root.querySelectorAll('img')).map(i=>i.decode()))
    for(const slide of root.querySelectorAll<HTMLElement>('.beamer-slide')){
      const title=slide.querySelector<HTMLElement>('.beamer-frame-title');if(title&&title.scrollHeight>title.clientHeight+2)throw new Error('Beamer 标题超过两行，请缩短标题。')
      const body=slide.querySelector<HTMLElement>('.beamer-body')!
      if(body.scrollHeight>body.clientHeight+3||body.scrollWidth>body.clientWidth+3)throw new Error('Beamer 页面内容超出范围，请缩短标题或调整过大的图片、公式、表格。')
    }
    const css=await snapshotStyles()
    return {pageCount:slides.length,html:`<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"><title>${esc(m.title)} — Beamer</title><style>${css}\n@page{size:320mm 180mm;margin:0}html,body{margin:0!important;padding:0!important;background:white!important;display:block!important;overflow:visible!important}.beamer-deck .beamer-slide{margin:0;box-shadow:none;break-after:page;break-inside:avoid}.beamer-deck .beamer-slide:last-child{break-after:auto}</style></head><body>${root.outerHTML}</body></html>`}
  }finally{host.remove()}
}
