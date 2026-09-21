import { DOMSerializer, Fragment, type Node as PMNode, type Schema } from '@tiptap/pm/model'
import { TextSelection, NodeSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'
import { pageFormat, accentValue, canonicalize, hydrate, p, textOf, type Block, type FacetDocument } from '../core/model'
export const PX_PER_MM = 96 / 25.4
export const PAGE_WIDTH = 210 * PX_PER_MM
export const PAGE_HEIGHT = 297 * PX_PER_MM
export type LayoutIssue = { id:string; message:string }
export type LayoutResult = { pages:Block[]; issues:LayoutIssue[]; outline:{id:string;text:string;level:number;page:number}[] }
export class Paginator {
  private host:HTMLDivElement
  private cache=new Map<string,number>()
  private serializer:DOMSerializer
  constructor(private schema:Schema, private frame?:{width:number;height:number;className:string}) {
    this.serializer=DOMSerializer.fromSchema(schema)
    this.host=document.createElement('div');this.host.className='facet-measure document-content';if(frame)this.host.classList.add(frame.className);this.host.setAttribute('aria-hidden','true');document.body.appendChild(this.host)
  }
  destroy(){this.host.remove()}
  height(node:Block) {
    const key=this.host.style.width+JSON.stringify(node)
    if(this.cache.has(key)) return this.cache.get(key)!
    this.host.replaceChildren(this.serializer.serializeNode(this.schema.nodeFromJSON(node)))
    // Match ProseMirror's trailing break in empty text blocks, including list items.
    this.host.querySelectorAll('p:empty').forEach(p=>p.appendChild(document.createElement('br')))
    const e=this.host.firstElementChild as HTMLElement
    const s=getComputedStyle(e)
    const height=e.getBoundingClientRect().height+(parseFloat(s.marginTop)||0)+(parseFloat(s.marginBottom)||0)
    this.cache.set(key,height);return height
  }
  private split(node:Block,available:number):[Block,Block]|null {
    const n=this.schema.nodeFromJSON(node)
    if(n.isTextblock) {
      if(['heading','part'].includes(node.type??'')||n.content.size<2) return null
      let lo=1,hi=n.content.size-1,best=0
      while(lo<=hi){const mid=Math.floor((lo+hi)/2);const candidate={...node,content:n.content.cut(0,mid).toJSON()??[]};if(this.height(candidate)<=available){best=mid;lo=mid+1}else hi=mid-1}
      if(best<1) return null
      // Avoid splitting a UTF-16 surrogate and leave at least two visual lines where possible.
      const fullText=n.textContent
      if(best<fullText.length && /[\uD800-\uDBFF]/.test(fullText[best-1]??'')) best--
      if(best<1) return null
      const left={...node,content:n.content.cut(0,best).toJSON()??[]}
      const right={...node,attrs:{...node.attrs,continuation:true,fragmentOffset:(Number(node.attrs?.fragmentOffset)||0)+best},content:n.content.cut(best).toJSON()??[]}
      if(this.height(left)<40 && available<80) return null
      return [left,right]
    }
    if(node.type==='columns') {
      const originalWidth=this.host.style.width,width=parseFloat(originalWidth),gap=Number(node.attrs?.gap??24),ratio=Math.max(20,Math.min(80,Number(node.attrs?.ratio)||50))
      const left:Block[]=[],right:Block[]=[];let progressed=false,remaining=false
      const empty=(column:Block):Block=>({...column,content:[{...p(),attrs:{...p().attrs,layoutRepeat:true}}]})
      try {
        for(const [index,column] of (node.content??[]).entries()) {
          this.host.style.width=`${(width-gap)*(index===0?ratio:100-ratio)/100}px`
          if(this.height(column)<=available-18){left.push(column);right.push(empty(column));if((column.content??[]).some(n=>!n.attrs?.layoutRepeat))progressed=true;continue}
          const pair=this.split(column,available-18)
          if(pair){left.push(pair[0]);right.push(pair[1]);progressed=true;remaining=true}
          else{left.push(empty(column));right.push(column);remaining=true}
        }
      } finally {this.host.style.width=originalWidth}
      if(!progressed||!remaining)return null
      const first={...node,content:left}
      if(this.height(first)>available)return null
      return [first,{...node,attrs:{...node.attrs,continuation:true},content:right}]
    }
    if(node.type==='table') {
      const rows=node.content??[]
      const headers=rows.filter(row=>(row.content??[]).every(c=>c.type==='tableHeader'))
      let best=0
      for(let i=1;i<rows.length;i++){if(this.height({...node,content:rows.slice(0,i)})<=available) best=i;else break}
      if(best<=headers.length || best>=rows.length) return null
      return [{...node,content:rows.slice(0,best)},{...node,attrs:{...node.attrs,continuation:true},content:[...headers.map(h=>({...h,attrs:{...h.attrs,layoutRepeat:true}})),...rows.slice(best)]}]
    }
    if(!node.content?.length || n.isAtom) return null
    const left:Block[]=[]
    for(let i=0;i<node.content.length;i++) {
      const child=node.content[i]
      if(this.height({...node,content:[...left,child]})<=available){left.push(child);continue}
      const overhead=this.height({...node,content:left})
      const pair=this.split(child,available-overhead)
      if(pair && this.height({...node,content:[...left,pair[0]]})<=available) {
        return [{...node,content:[...left,pair[0]]},{...node,attrs:{...node.attrs,continuation:true,...(node.type==='orderedList'?{start:(node.attrs?.start??1)+left.length}:{})},content:[pair[1],...node.content.slice(i+1)]}]
      }
      if(left.length) return [{...node,content:left},{...node,attrs:{...node.attrs,continuation:true,...(node.type==='orderedList'?{start:(node.attrs?.start??1)+left.length}:{})},content:node.content.slice(i)}]
      return null
    }
    return null
  }
  layout(doc:FacetDocument):LayoutResult {
    const format=pageFormat(doc.page)
    const width=this.frame?.width??(format.width*PX_PER_MM-doc.page.margin*PX_PER_MM*2)
    const height=this.frame?.height??(format.height*PX_PER_MM-doc.page.margin*PX_PER_MM*2)
    this.host.dataset.orientation=doc.page.orientation||'portrait'
    this.host.style.width=`${width}px`;this.host.style.setProperty('--accent',accentValue(doc.page.accent));this.host.style.setProperty('--content-height',`${height}px`);this.cache.clear()
    const queue=hydrate(doc);for(const n of queue)if(n.type==='documentTitle'||n.type==='tableOfContents')n.attrs={...n.attrs,renderVersion:JSON.stringify(doc.metadata)+JSON.stringify(doc.page)};const pages:Block[][]=[[]],issues:LayoutIssue[]=[]
    let used=0,iterations=0;const headingCounts=[0,0,0]
    for(const n of queue) if(n.type==='heading') {
      const level=Math.max(1,Math.min(3,n.attrs?.level??1));headingCounts[level-1]++;headingCounts.fill(0,level)
      n.attrs={...n.attrs,number:n.attrs?.numbered?headingCounts.slice(0,level).join('.')+' ':''}
    }
    while(queue.length && iterations++<10000) {
      const node=queue.shift()!;let page=pages[pages.length-1]
      if(node.type==='part'){
        if(page.length){pages.push([]);page=pages.at(-1)!}
        page.push(node);used=0
        if(queue.length)pages.push([])
        continue
      }
      if(node.type==='pageBreak'){page.push(node);pages.push([]);used=0;continue}
      if(node.type==='documentTitle' && page.length===0){page.push(node);pages.push([]);used=0;continue}
      if(node.type==='tableOfContents' && page.length===0){page.push(node);pages.push([]);used=0;continue}
      const measured=this.height(node)
      if(['heading','part'].includes(node.type??'') && page.length && queue.length && height-used < measured+48){pages.push([]);page=pages.at(-1)!;used=0}
      if(measured<=height-used+0.1){page.push(node);used+=measured;continue}
      if(node.type==='callout'&&measured<=height&&used>0){pages.push([]);used=0;queue.unshift(node);continue}
      const split=this.split(node,height-used)
      if(split){page.push(split[0]);pages.push([]);used=0;queue.unshift(split[1]);continue}
      if(used>0){pages.push([]);used=0;queue.unshift(node);continue}
      // Oversized atoms are retained, diagnosed, and never cause an endless page loop.
      page.push(node);used+=measured
      issues.push({id:node.attrs?.id??'',message:node.type==='table'?'表格中的一行超过一页，请减少单元格内容。':node.type==='mathBlock'?'公式超过页面范围，请分行或缩短。':'组件超过页面可用高度，请拆分或调整。'})
    }
    if(queue.length) issues.push({id:'',message:'文档超过当前分页容量，请拆分为多个文档。'})
    if(!pages.at(-1)!.length) pages.at(-1)!.push(p())
    const outline:LayoutResult['outline']=[]
    pages.forEach((nodes,index)=>nodes.forEach(n=>{if(['heading','part'].includes(n.type??'') && n.attrs?.toc!==false && !n.attrs?.continuation) outline.push({id:n.attrs?.id,text:(n.attrs?.number??'')+textOf(n),level:n.type==='part'?0:n.attrs?.level??1,page:index+1})}))
    return {pages:pages.map((content,i)=>({type:'page',attrs:{index:i+1,total:pages.length,isCover:i===0&&content.some(n=>n.type==='documentTitle'),layoutKey:JSON.stringify(doc.page)+JSON.stringify(doc.metadata)},content:content.length?content:[p()]})),issues,outline}
  }
}
export type PointBookmark={id:string;offset:number;fallback:number;node?:boolean}
export function capturePoint(state:EditorState,pos:number):PointBookmark {
  const resolved=state.doc.resolve(Math.max(0,Math.min(pos,state.doc.content.size)))
  for(let depth=resolved.depth;depth>0;depth--) {
    const node=resolved.node(depth)
    if(node.isTextblock && node.attrs.id) return {id:node.attrs.id,offset:(node.attrs.fragmentOffset??0)+resolved.pos-resolved.start(depth),fallback:pos}
  }
  const next=resolved.nodeAfter
  return {id:next?.attrs.id??'',offset:0,fallback:pos,node:!!next?.isAtom}
}
export function resolvePoint(doc:PMNode,b:PointBookmark) {
  let found:number|undefined
  doc.descendants((n,pos)=>{
    if(n.attrs.id!==b.id || found!==undefined) return
    if(b.node){found=pos;return false}
    const start=Number(n.attrs.fragmentOffset)||0
    if(n.isTextblock&&b.offset>=start&&b.offset<=start+n.content.size) found=pos+1+Math.min(n.content.size,b.offset-start)
  })
  return Math.min(doc.content.size,Math.max(0,found??b.fallback))
}
export function applyLayout(editor:Editor,result:LayoutResult) {
  const before=editor.state,anchor=capturePoint(before,before.selection.anchor),head=capturePoint(before,before.selection.head)
  const next=editor.schema.node('doc',null,result.pages.map(p=>editor.schema.nodeFromJSON(p)))
  const start=before.doc.content.findDiffStart(next.content)
  if(start===null)return
  const diffEnd=before.doc.content.findDiffEnd(next.content)!
  let endA=diffEnd.a,endB=diffEnd.b
  const overlap=start-Math.min(endA,endB)
  if(overlap>0){endA+=overlap;endB+=overlap}
  const tr=before.tr.replace(start,endA,next.slice(start,endB)).setMeta('pagination',true).setMeta('addToHistory',false)
  const a=resolvePoint(tr.doc,anchor),h=resolvePoint(tr.doc,head)
  try{tr.setSelection(anchor.node && tr.doc.nodeAt(a)?.isAtom?NodeSelection.create(tr.doc,a):TextSelection.between(tr.doc.resolve(a),tr.doc.resolve(h)))}catch{}
  editor.view.dispatch(tr)
}
export function documentFromEditor(editor:Editor,doc:FacetDocument):FacetDocument {
  return {...doc,content:canonicalize(editor.getJSON().content??[])}
}
