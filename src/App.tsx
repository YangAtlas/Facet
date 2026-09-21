import {normalizeClipboardHTML,tabularTextHTML,hasEditableClipboardHTML} from './editor/clipboard'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { EditorState, TextSelection, NodeSelection } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'
import { Slice, Fragment } from '@tiptap/pm/model'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Search, FileText, ChevronDown, ChevronRight, Check, ArrowUpRight, Undo2, Redo2, Settings2, X, Download, FolderOpen, MoreHorizontal, GripVertical, Copy, Trash2, ArrowUp, ArrowDown, Bold, Italic, Highlighter, Link2, Minus, RotateCcw } from 'lucide-react'
import {WorkspaceTree} from './components/WorkspaceTree'
import {searchKey} from './editor/search'
import {pairTextarea} from './editor/pairs'
import { extensions, type RenderContext } from './editor/extensions'
import { applyLayout, capturePoint, resolvePoint, Paginator, PX_PER_MM, documentFromEditor, type LayoutIssue } from './editor/pagination'
import { pageFormat, type PageOrientation, makeDocument, hydrate, uid, colors, accentValue, icons, variants, semanticItems, textOf, walk, p, type Block, type FacetDocument } from './core/model'
import { registry, searchComponents, type ComponentItem } from './core/registry'
import { renderMath, normalizeMath } from './core/math'
import { encodeDocument, decodeDocument } from './core/archive'
import { latexArchive } from './core/latex'
import { readPreferences, type ExportFormat, type BeamerSettings } from './core/preferences'
import { beamerSnapshot } from './core/beamer'
import { pageSnapshot, download } from './core/export'
import { normalizeLink } from './core/links'
import { parseMarkdown } from './core/markdown'
import { usageGuide } from '../scripts/usage-guide'
import guidePDF from './assets/usage-guide.pdf?url'
const initial=makeDocument(true)
const fa=(icon:string)=> <i className={`fas fa-${icon}`} aria-hidden="true"/>
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
async function browserStore<T>(action:(store:IDBObjectStore)=>IDBRequest,write=false):Promise<T>{return new Promise((resolve,reject)=>{const req=indexedDB.open('facet-local',1);req.onupgradeneeded=()=>req.result.createObjectStore('drafts');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('drafts',write?'readwrite':'readonly'),request=action(tx.objectStore('drafts'));let result:T;request.onsuccess=()=>{result=request.result};tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error)}}})}
async function browserRecovery(bytes?:Uint8Array,id='latest',name=''):Promise<Uint8Array|null>{if(bytes){await browserStore(s=>s.put({bytes,id,name,modified:Date.now()},id),true);return bytes}const value=await browserStore<any>(s=>s.get(id));return value?.bytes??value??null}
async function browserDrafts():Promise<any[]>{const values=await browserStore<any[]>(s=>s.getAll());return values.map(v=>v.bytes?v:{id:'latest',name:'本机草稿',modified:0}).sort((a,b)=>b.modified-a.modified)}
const isMac = /Mac/.test(navigator.platform)
const commandShortcut = isMac ? '⌘⇧P' : 'Ctrl+Shift+P'

function Modal({title,description,children,onClose,wide=false}:{title:string;description?:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}){
  return <div className="modal-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={18}/></button></div>{children}</section></div>
}
function ColorPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
  return <div className="color-palette">{Object.entries(colors).map(([key,color])=><button type="button" key={key} title={`${colorName(key)} ${color}`} aria-label={colorName(key)} aria-pressed={value===key} className={value===key?'selected':''} style={{'--swatch':color} as React.CSSProperties} onClick={()=>onChange(key)}><i/>{colorName(key)}</button>)}<label className="custom-color-choice"><input aria-label="自定义组件颜色" type="color" value={accentValue(value)} onChange={e=>onChange(e.target.value)}/><span>自定义</span></label><small className="hex-value">{accentValue(value)}</small></div>
}
export default function App(){
  const [preferences,setPreferences]=useState(readPreferences),[appSettings,setAppSettings]=useState(false)
  const [settingsTab,setSettingsTab]=useState('封面'),[guideOpen,setGuideOpen]=useState(()=>!localStorage.getItem('facet-guide-seen')),[filesOpen,setFilesOpen]=useState(false)
  const [workspaceName,setWorkspaceName]=useState('本机文档'),[currentPath,setCurrentPath]=useState(''),[treeRefresh,setTreeRefresh]=useState(0)
  const [favoriteGroup,setFavoriteGroup]=useState('全部'),[favoriteQuery,setFavoriteQuery]=useState('')
  const [exportOpen,setExportOpen]=useState(false)
  const [findOpen,setFindOpen]=useState(false),[findText,setFindText]=useState(''),[findIndex,setFindIndex]=useState(0),[findCount,setFindCount]=useState(0),findInput=useRef<HTMLInputElement>(null)
  const [dirty,setDirty]=useState(false),dirtyRef=useRef(false),[unsavedOpen,setUnsavedOpen]=useState(false),[decisionSaving,setDecisionSaving]=useState(false),decisionBusy=useRef(false)
  const decision=useRef<{promise:Promise<boolean>;resolve:(value:boolean)=>void}|null>(null)
  function markDirty(value=true){dirtyRef.current=value;setDirty(value)}
  async function ensureSaved(){clearTimeout(saveTimer.current);await saveQueue.current;if(!dirtyRef.current)return true;if(decision.current)return decision.current.promise;let resolve!:(value:boolean)=>void;const promise=new Promise<boolean>(r=>{resolve=r});decision.current={promise,resolve};setUnsavedOpen(true);return promise}
  async function decideSave(choice:'save'|'discard'|'cancel'){
    if(decisionBusy.current||!decision.current)return
    if(choice==='save'){decisionBusy.current=true;setDecisionSaving(true);try{if(!await enqueueSave(true))return}catch{return}finally{decisionBusy.current=false;setDecisionSaving(false)}}
    const pending=decision.current;decision.current=null;setUnsavedOpen(false);pending.resolve(choice!=='cancel')
  }
  const pastePlain=useRef(false)
  const [pasteMenu,setPasteMenu]=useState<{x:number;y:number}|null>(null)
  function openSettings(tab:string){setSettingsTab(tab);setAppSettings(true)}
  function closeGuide(){localStorage.setItem('facet-guide-seen','true');setGuideOpen(false)}
  useEffect(()=>{localStorage.setItem('facet-preferences',JSON.stringify(preferences))},[preferences])
  const [doc,setDoc]=useState<FacetDocument>(initial),docRef=useRef(doc)
  const format=pageFormat(doc.page),pageWidth=format.width*PX_PER_MM,pageHeight=format.height*PX_PER_MM
  const [newDocumentOpen,setNewDocumentOpen]=useState(false),[newOrientation,setNewOrientation]=useState<PageOrientation>(preferences.orientation),[creatingDocument,setCreatingDocument]=useState(false)
  const context=useRef<RenderContext>({document:doc,outline:[]})
  const [left,setLeft]=useState(preferences.left),[right,setRight]=useState(preferences.right),[query,setQuery]=useState(''),[group,setGroup]=useState('收藏')
  const [recentComponents,setRecentComponents]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('facet-components')||'[]')}catch{return []}})
  const [outline,setOutline]=useState<RenderContext['outline']>([]),[pages,setPages]=useState(1),[currentPage,setCurrentPage]=useState(1)
  const [zoom,setZoom]=useState(preferences.fit?0.9:1),[fit,setFit]=useState(preferences.fit),workspace=useRef<HTMLDivElement>(null)
  const [status,setStatus]=useState('本地草稿'),[toast,setToast]=useState(''),[issues,setIssues]=useState<LayoutIssue[]>([]),[busy,setBusy]=useState(false)
  const [,setExportMenu]=useState(false)
  const [commandSelected,setCommandSelected]=useState(0),[tableAlignments,setTableAlignments]=useState<string[]>([])
  const [commandOpen,setCommandOpen]=useState(false),[componentPicker,setComponentPicker]=useState<'badge'|'icon'|'semantic'|null>(null),[tableSize,setTableSize]=useState<{rows:number;cols:number}|null>(null),[imageModal,setImageModal]=useState(false),[imageIntent,setImageIntent]=useState<'image'|'subfigure'>('image')
  const [linkDraft,setLinkDraft]=useState<string|null>(null)
  const tableLocked=useRef(false)
  const setTableLocked=(value:boolean)=>{tableLocked.current=value}
  const [exportSettings,setExportSettings]=useState<ExportFormat|null>(null),[exportName,setExportName]=useState('')
  function configureExport(type:ExportFormat){setExportMenu(false);setExportName(docRef.current.metadata.title+(type==='beamer'?'-beamer':''));setExportSettings(type)}
  function openExport(){configureExport(preferences.exportFormat);setExportOpen(true)}
  const [tableStyle,setTableStyle]=useState('academic')
  const [math,setMath]=useState<{latex:string;inline:boolean;pos?:number}|null>(null)
  const [editNode,setEditNode]=useState<{pos:number;type:string;attrs:Record<string,any>}|null>(null)
  const [recentFiles,setRecentFiles]=useState<any[]>([]),[recoveries,setRecoveries]=useState<any[]>([])
  const [slash,setSlash]=useState<{from:number;to:number;q:string;x:number;y:number;selected:number}|null>(null)
  useEffect(()=>{document.querySelector('.slash-menu button.active')?.scrollIntoView({block:'nearest'})},[slash?.selected,slash?.q])
  useEffect(()=>{setCommandSelected(0)},[query,commandOpen])
  useEffect(()=>{document.querySelector('.command-results button.active')?.scrollIntoView({block:'nearest'})},[commandSelected])
  const slashRef=useRef(slash);slashRef.current=slash
  const [selected,setSelected]=useState<{pos:number;type:string;attrs:any}|null>(null),[selectionText,setSelectionText]=useState(false)
  const token=useRef<string|undefined>(undefined),savedRevision=useRef(-1),saveTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),saveQueue=useRef(Promise.resolve(true)),layoutTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  const paginator=useRef<Paginator|null>(null),isPaginating=useRef(false),inserting=useRef<(c:ComponentItem)=>void>(()=>{}),reflowRef=useRef<()=>void>(()=>{}),changeRef=useRef<()=>void>(()=>{})
  const lastSelection=useRef<{anchor:any;head:any}|null>(null),fileInput=useRef<HTMLInputElement>(null),imageInput=useRef<HTMLInputElement>(null),subfigureInput=useRef<HTMLInputElement>(null),coverInput=useRef<HTMLInputElement>(null),flushRef=useRef<()=>Promise<void>>(async()=>{})
  const announce=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),6000)}
  const ext=useMemo(()=>extensions(()=>context.current),[])
  const editor=useEditor({extensions:ext,content:{type:'doc',content:[{type:'page',content:hydrate(initial)}]},editorProps:{
    attributes:{class:'document-content',spellcheck:'false','aria-label':'文档编辑区'},
    handleKeyDown(view,event){
      pastePlain.current=(event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='v'
      if(event.isComposing)return false
      if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.key.toLowerCase()==='p'){event.preventDefault();setCommandOpen(true);return true}
      if(event.key==='Enter'&&view.state.selection.$from.parent.type.name==='paragraph'&&['$$','$$$$'].includes(view.state.selection.$from.parent.textContent.trim())){event.preventDefault();const p=view.state.selection.$from;view.dispatch(view.state.tr.delete(p.start(),p.end()));setMath({latex:'',inline:false});return true}
      if(event.key===' '){
        const {$from}=view.state.selection
        if(view.state.selection.empty&&$from.parent.type.name==='paragraph'){
          const marker=$from.parent.textContent.match(/^#{1,3}$/)
          if(marker){event.preventDefault();const pos=$from.before();let tr=view.state.tr.setNodeMarkup(pos,view.state.schema.nodes.heading,{...$from.parent.attrs,level:marker[0].length});tr=tr.delete(pos+1,pos+1+marker[0].length);view.dispatch(tr);return true}
        }
      }
      const s=slashRef.current
      if(s){const matches=searchComponents(s.q);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setSlash({...s,selected:Math.max(0,Math.min(matches.length-1,s.selected+(event.key==='ArrowDown'?1:-1)))});return true}if(event.key==='Escape'){setPasteMenu(null);setFilesOpen(false);setSlash(null);return true}if(event.key==='Enter'&&matches[s.selected]){event.preventDefault();view.dispatch(view.state.tr.delete(s.from,s.to));setSlash(null);inserting.current(matches[s.selected]);return true}}
      if((event.metaKey||event.ctrlKey)&&event.key==='s'){event.preventDefault();void flushRef.current().catch(()=>{});return true}
      return false
    },
    transformPastedHTML(html){return normalizeClipboardHTML(html)},
    transformPasted(slice){return preparePastedSlice(slice)},
    handlePaste(_view,event){const data=event.clipboardData;if(!data)return false;const plain=pastePlain.current;pastePlain.current=false;if(plain)return false;if(data.getData('text/html')&&(hasEditableClipboardHTML(data.getData('text/html'))||!data.files.length))return false;const text=data.getData('text/plain'),table=tabularTextHTML(text);if(table){editor?.view.pasteHTML(table);return true}const image=Array.from(data.files).find(f=>/^image\/(png|jpeg|webp)$/.test(f.type));if(image){event.preventDefault();void importImages([image]);return true}if(text.includes('$')){editor?.commands.insertContent(parseMarkdown(text));return true}return false},
    handleDOMEvents:{contextmenu(_view,event){event.preventDefault();setPasteMenu({x:Math.min(event.clientX,window.innerWidth-230),y:Math.min(event.clientY,window.innerHeight-260)});return true},compositionend(){setTimeout(()=>reflowRef.current(),0);return false}},
  },onUpdate({transaction}){if(transaction.getMeta('pagination'))return;changeRef.current()},onSelectionUpdate({editor:e}){
    lastSelection.current={anchor:capturePoint(e.state,e.state.selection.anchor),head:capturePoint(e.state,e.state.selection.head)}
    const $p=e.state.selection.$from;let block=null
    if(e.state.selection instanceof NodeSelection){const n=e.state.selection.node;block={pos:e.state.selection.from,type:n.type.name,attrs:n.attrs}}
    else for(let d=$p.depth;d>0;d--){if($p.node(d-1).type.name==='page'){const n=$p.node(d);block={pos:$p.before(d),type:n.type.name,attrs:n.attrs};break}}
    setSelected(block);setSelectionText(!e.state.selection.empty)
    let page=1;for(let d=$p.depth;d>0;d--)if($p.node(d).type.name==='page')page=$p.node(d).attrs.index
    setCurrentPage(page)
  }})
  const syncDoc=(value:FacetDocument)=>{docRef.current=value;context.current.document=value;setDoc(value)}
  const updateRecent=()=>{setTreeRefresh(n=>n+1);void window.facetDesktop?.recent().then(setRecentFiles)}
  const enqueueSave=async(manual=false,saveAs=false)=>{
    const snapshot=structuredClone(docRef.current),fileToken=token.current
    const job=async()=>{
      const bytes=await encodeDocument(snapshot)
      if(window.facetDesktop){
        const recovery=await window.facetDesktop.recovery({id:snapshot.id,name:snapshot.metadata.title,bytes:Array.from(bytes)});if(recovery?.error)throw new Error(recovery.error)
        if(manual){
          const result=await window.facetDesktop.save({token:fileToken,name:snapshot.metadata.title,bytes:Array.from(bytes),saveAs})
          if(result?.error)throw new Error(result.error)
          if(result?.conflict)throw new Error('文件已被其他应用修改。恢复副本已保留，请使用“另存为”。')
          if(!result){setStatus('未保存 · 草稿已保留');return false}
          token.current=result.token;setCurrentPath(result.path||'');savedRevision.current=snapshot.revision
          if(docRef.current.revision===snapshot.revision)markDirty(false)
          setStatus(dirtyRef.current?'未保存':'已保存');updateRecent();return true
        }
      }else{
        await browserRecovery(bytes,snapshot.id,snapshot.metadata.title)
        if(manual){download(bytes,snapshot.metadata.title+'.facet','application/zip');savedRevision.current=snapshot.revision;if(docRef.current.revision===snapshot.revision)markDirty(false);setStatus('已保存');return true}
      }
      if(snapshot.id===docRef.current.id)setStatus(dirtyRef.current?'未保存 · 草稿已保留':'已保存');return true
    }
    const promise=saveQueue.current.then(job);saveQueue.current=promise.catch(e=>{setStatus('保存失败');announce(String(e.message??e));return false});return promise
  }
  const scheduleSave=()=>{clearTimeout(saveTimer.current);markDirty();setStatus('未保存');saveTimer.current=setTimeout(()=>void enqueueSave().catch(()=>{}),1000)}
  const paginate=useCallback(()=>{
    if(!editor||!paginator.current||isPaginating.current||editor.view.composing)return
    isPaginating.current=true
    try{
      let result=paginator.current.layout(docRef.current)
      if(JSON.stringify(result.outline)!==JSON.stringify(context.current.outline)) {context.current.outline=result.outline;result=paginator.current.layout(docRef.current)}
      context.current.outline=result.outline
      for(const page of result.pages)for(const node of page.content??[])if(node.type==='tableOfContents')node.attrs={...node.attrs,renderVersion:JSON.stringify(result.outline)}
      applyLayout(editor,result);setPages(result.pages.length);setOutline(result.outline);setIssues(result.issues)
      // Full-width atoms can overflow horizontally without increasing their measured height.
      const more:LayoutIssue[]=[]
      editor.view.dom.querySelectorAll('.math-block,.image-block,.subfigure').forEach((el)=>{if(el.scrollWidth>el.clientWidth+3)more.push({id:(el as HTMLElement).dataset.id??'',message:'此公式或图片超过正文宽度，请调整。'})})
      if(more.length)setIssues([...result.issues,...more])
    }catch(e){announce(`分页失败：${String(e)}`)}finally{isPaginating.current=false}
  },[editor])
  reflowRef.current=paginate
  changeRef.current=()=>{
    if(!editor)return
    const next=documentFromEditor(editor,docRef.current);next.revision++;syncDoc(next);scheduleSave()
    clearTimeout(layoutTimer.current);layoutTimer.current=setTimeout(paginate,100)
    const {from,$from,empty}=editor.state.selection
    if(empty&&$from.parent.type.name==='paragraph'&&!editor.view.composing){const before=$from.parent.textBetween(0,$from.parentOffset);const match=before.match(/^\/([^\s/]*)$/);if(match){const coords=editor.view.coordsAtPos(from);setSlash({from:from-before.length,to:from,q:match[1],x:coords.left,y:coords.bottom+8,selected:0});return}}
    setSlash(null)
  }
  flushRef.current=async()=>{clearTimeout(saveTimer.current);await enqueueSave(true)}
  useEffect(()=>{if(!editor)return;paginator.current=new Paginator(editor.schema);void document.fonts.ready.then(paginate);return()=>{paginator.current?.destroy();clearTimeout(layoutTimer.current);clearTimeout(saveTimer.current)}},[editor,paginate])
  useEffect(()=>{const el=workspace.current;if(!el)return;const resize=new ResizeObserver(()=>{if(fit)setZoom(Math.min(1.15,Math.max(.35,(el.clientWidth-80)/pageWidth)))});resize.observe(el);return()=>resize.disconnect()},[fit,left,right,pageWidth])
  useEffect(()=>{if(window.facetDesktop)return;const warn=(event:BeforeUnloadEvent)=>{if(dirtyRef.current){event.preventDefault();event.returnValue=''}};const save=()=>{if(document.visibilityState==='hidden'){clearTimeout(saveTimer.current);void enqueueSave().catch(()=>{})}};window.addEventListener('beforeunload',warn);document.addEventListener('visibilitychange',save);return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('visibilitychange',save)}},[])
  useEffect(()=>{updateRecent();if(window.facetDesktop){void window.facetDesktop.recoveries().then(setRecoveries)}else{void browserDrafts().then(setRecoveries)}},[])
  useEffect(()=>{if(!window.facetDesktop)return;return window.facetDesktop.onClose(()=>{void ensureSaved().then(ok=>{if(ok)window.facetDesktop!.closeReady();else window.facetDesktop!.cancelClose()}).catch(()=>window.facetDesktop!.cancelClose())})})
  useEffect(()=>{if(!window.facetDesktop)return;return window.facetDesktop.onOpen(data=>void openData(data))})
  useEffect(()=>{const handle=(event:KeyboardEvent)=>{if(event.defaultPrevented)return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){event.preventDefault();setFindOpen(true);requestAnimationFrame(()=>{findInput.current?.focus();findInput.current?.select()});return}if(event.key==='Escape'){if(decision.current){void decideSave('cancel');return}setExportOpen(false);setFindOpen(false);setPasteMenu(null);setFilesOpen(false);setAppSettings(false);setExportSettings(null);setNewDocumentOpen(false);setLinkDraft(null);setMath(null);setEditNode(null);setExportMenu(false);setSlash(null);setCommandOpen(false);setComponentPicker(null);setTableSize(null);setImageModal(false)}if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='p'){event.preventDefault();setQuery('');setCommandOpen(true)}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='n'){event.preventDefault();setNewOrientation(preferences.orientation);setNewDocumentOpen(true)}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void flushRef.current()}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)},[preferences.orientation])
  useEffect(()=>{if(!editor)return;const listener=(e:MouseEvent)=>{
    const target=e.target as HTMLElement
    if(target.closest('.document-title')){openSettings('封面');return}
    const el=target.closest('[data-math],.callout-title,.badge,[data-inline-icon],.image-block,.subfigure,blockquote,table,h1[data-id],h2[data-id],h3[data-id],.columns-editor,.semantic-list>li>i') as HTMLElement|null
    if(!el)return
    const parent=el.closest('[data-id]') as HTMLElement|null
    let found:{pos:number;node:any}|undefined
    editor.state.doc.descendants((node,pos)=>{if(found)return false;const dom=editor.view.nodeDOM(pos);if(node.type.name==='columns'&&!el.classList.contains('columns-editor'))return;if(dom instanceof HTMLElement && (dom===el||dom.contains(el)) && ['mathBlock','mathInline','callout','badge','inlineIcon','image','subfigure','semanticItem','blockquote','heading','columns','table'].includes(node.type.name)){found={pos,node};return false}})
    if(!found && parent)editor.state.doc.descendants((node,pos)=>{if(node.attrs.id===parent.dataset.id&&!found)found={pos,node}})
    if(found){if(found.node.type.name.startsWith('math'))setMath({latex:found.node.attrs.latex,inline:found.node.type.name==='mathInline',pos:found.pos});else setEditNode({pos:found.pos,type:found.node.type.name,attrs:{...found.node.attrs}})}
  };editor.view.dom.addEventListener('dblclick',listener)
  const single=(e:MouseEvent)=>{const external=(e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement|null;if(external&&(e.metaKey||e.ctrlKey)&&external.getAttribute('href')?.startsWith('#')){e.preventDefault();document.getElementById(decodeURIComponent(external.getAttribute('href')!.slice(1)))?.scrollIntoView({block:'center'});return}if(external&&(e.metaKey||e.ctrlKey)&&/^(https?:|mailto:|tel:)/i.test(external.href)){e.preventDefault();if(window.facetDesktop)void window.facetDesktop.openExternal(external.href);else window.open(external.href,'_blank','noopener,noreferrer');return}const link=(e.target as HTMLElement).closest('[data-toc-target]') as HTMLElement|null;if(link){e.preventDefault();const id=link.dataset.tocTarget;let pos:number|undefined;editor.state.doc.descendants((n,p)=>{if(['heading','part'].includes(n.type.name)&&n.attrs.id===id&&pos===undefined)pos=p});if(pos!==undefined){editor.commands.setTextSelection(pos+1);editor.view.focus();(editor.view.nodeDOM(pos) as HTMLElement)?.scrollIntoView({block:'start',behavior:'smooth'})}return}if((e.target as HTMLElement).closest('[data-math],.callout-title,.document-title,.semantic-list>li>i'))listener(e)}
  editor.view.dom.addEventListener('click',single);return()=>{editor.view.dom.removeEventListener('dblclick',listener);editor.view.dom.removeEventListener('click',single)}},[editor])

  function preparePastedSlice(slice:Slice):Slice{
    const assets={...docRef.current.assets}
    const adopt=(attrs:any)=>{if(typeof attrs.src!=='string')return attrs;const match=attrs.src.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);if(!match)return attrs;if(attrs.assetId&&assets[attrs.assetId])return attrs;const assetId=uid();assets[assetId]={name:'粘贴图片',mime:match[1],data:match[2]};return {...attrs,assetId}}
    const copy=(node:any):any=>{let attrs={...node.attrs};if(node.isBlock){attrs.id=uid();attrs.continuation=false;attrs.fragmentOffset=0;attrs.layoutRepeat=false;attrs.codeLineStart=1;attrs.codeContinues=false}if(node.type.name==='image')attrs=adopt(attrs);if(node.type.name==='subfigure')attrs.items=(attrs.items||[]).map(adopt);return node.isText?node:node.type.create(attrs,Fragment.fromArray(Array.from(node.content.content).map(copy)),node.marks)}
    const content=Fragment.fromArray(Array.from(slice.content.content).map(copy));docRef.current={...docRef.current,assets};context.current.document=docRef.current;return new Slice(content,slice.openStart,slice.openEnd)
  }
  function toggleDocumentBlock(type:'documentTitle'|'tableOfContents'){
    const content=structuredClone(docRef.current.content),index=content.findIndex(n=>n.type===type)
    if(index>=0)content.splice(index,1);else content.splice(type==='documentTitle'?0:content[0]?.type==='documentTitle'?1:0,0,{type,attrs:{id:uid()}})
    if(!content.length)content.push(p());updateSettings({content});resetEditorDocument({...docRef.current,content});paginate()
  }
  async function openGuideDocument(){try{if(!await ensureSaved())return;const next=await usageGuide();token.current=undefined;setCurrentPath('');syncDoc(next);resetEditorDocument(next);paginate();scheduleSave();closeGuide();setAppSettings(false)}catch(e){announce(String(e))}}
  async function refreshRecoveries(){if(window.facetDesktop)setRecoveries(await window.facetDesktop.recoveries());else setRecoveries(await browserDrafts())}
  async function pasteFromClipboard(mode:'rich'|'match'|'plain'|'markdown'|'image'){
    setPasteMenu(null);if(!editor)return;restoreSelection();editor.view.focus()
    try{
      const data=window.facetDesktop?await window.facetDesktop.readClipboard():null
      if(data?.error)throw new Error(data.error)
      let text=data?.text||'',html=data?.html||'',picture:Blob|null=null
      if(!data){if(['rich','match','image'].includes(mode)&&navigator.clipboard.read){const items=await navigator.clipboard.read();for(const item of items){if(item.types.includes('text/html'))html=await (await item.getType('text/html')).text();if(item.types.includes('text/plain'))text=await (await item.getType('text/plain')).text();if(item.types.includes('image/png'))picture=await item.getType('image/png')}}else text=await navigator.clipboard.readText()}
      if(data?.image){const encoded=data.image.slice(data.image.indexOf(',')+1);picture=new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'})}
      if(mode==='image'){if(!picture){announce('剪贴板中没有图片，请在来源应用中复制为图片。');return}await importImages([new File([picture],'剪贴板.png',{type:picture.type})]);return}
      if((mode==='rich'||mode==='match')&&html&&(hasEditableClipboardHTML(html)||!picture))editor.view.pasteHTML(normalizeClipboardHTML(html,mode==='match'))
      else if((mode==='rich'||mode==='match')&&tabularTextHTML(text))editor.view.pasteHTML(tabularTextHTML(text)!)
      else if((mode==='rich'||mode==='match')&&picture){await importImages([new File([picture],'剪贴板.png',{type:picture.type})])}
      else if(mode==='markdown'||mode==='rich'&&text.includes('$'))editor.commands.insertContent(parseMarkdown(text))
      else editor.view.pasteText(text)
    }catch(e){announce('读取剪贴板失败，请使用 Ctrl / ⌘ + V 粘贴。'+String(e))}
  }

  useEffect(()=>{if(!editor)return;const modifier=(e:KeyboardEvent)=>editor.view.dom.classList.toggle('link-modifier',e.ctrlKey||e.metaKey);const reset=()=>editor.view.dom.classList.remove('link-modifier');const dismiss=(e:MouseEvent)=>{if(!(e.target as HTMLElement).closest('.paste-menu'))setPasteMenu(null)};window.addEventListener('keydown',modifier);window.addEventListener('keyup',modifier);window.addEventListener('blur',reset);window.addEventListener('mousedown',dismiss);return()=>{window.removeEventListener('keydown',modifier);window.removeEventListener('keyup',modifier);window.removeEventListener('blur',reset);window.removeEventListener('mousedown',dismiss)}},[editor])

  useEffect(()=>{if(!editor)return;editor.view.dispatch(editor.state.tr.setMeta(searchKey,{query:findOpen?findText:'',index:findIndex}));const data=searchKey.getState(editor.state)!;setFindCount(data.matches.length);if(data.index!==findIndex)setFindIndex(data.index);const hit=data.matches[data.index];if(hit){const target=hit.code?editor.view.nodeDOM(hit.block) as HTMLElement:editor.view.dom.querySelector('.search-active') as HTMLElement;target?.scrollIntoView({block:'center'});if(hit.code){const area=target?.querySelector('textarea');area?.setSelectionRange(hit.from-hit.block-1,hit.parts[0].to-hit.block-1)}}},[editor,findText,findIndex,findOpen,doc,pages])
  function moveFind(delta:number){setFindIndex(i=>findCount?(i+delta+findCount)%findCount:0)}
  function restoreSelection(){if(!editor)return;if(lastSelection.current){const {anchor,head}=lastSelection.current;const a=resolvePoint(editor.state.doc,anchor),h=resolvePoint(editor.state.doc,head);try{editor.commands.setTextSelection({from:a,to:h})}catch{editor.commands.focus('end')}}else editor.commands.focus('end')}
  function insertBlock(value:Block){
    if(!editor)return;restoreSelection()
    let {tr,selection}=editor.state;let $pos=selection.$from
    const schema=editor.schema,node=schema.nodeFromJSON(value)
    if(node.isInline){tr=tr.replaceSelectionWith(node);editor.view.dispatch(tr.scrollIntoView());editor.view.focus();return}
    let topDepth=0;for(let d=$pos.depth;d>0;d--)if(['page','column'].includes($pos.node(d-1).type.name)){topDepth=d;break}
    if(topDepth&&$pos.node(topDepth-1).type.name==='column'&&!$pos.node(topDepth-1).type.validContent(Fragment.from(node))){announce('请在双栏外插入此组件。');return}
    const parent=topDepth?$pos.node(topDepth):null
    if(parent?.type.name==='paragraph'&&topDepth===$pos.depth){
      const before=$pos.before(topDepth),offset=$pos.parentOffset,leftPart=parent.cut(0,offset),rightPart=parent.cut(offset)
      const replacements=[] as any[]
      if(leftPart.content.size)replacements.push(leftPart)
      replacements.push(node)
      const afterParagraph=rightPart.content.size?rightPart.type.create({...rightPart.attrs,id:uid(),continuation:null,fragmentOffset:null},rightPart.content):schema.nodes.paragraph.create({id:uid()})
      replacements.push(afterParagraph)
      tr=tr.replaceWith(before,before+parent.nodeSize,replacements)
      const inserted=before+(leftPart.content.size?leftPart.nodeSize:0)
      try{tr=tr.setSelection(node.isAtom?NodeSelection.create(tr.doc,inserted):TextSelection.near(tr.doc.resolve(inserted+1)))}catch{}
    }else{
      const at=topDepth?$pos.after(topDepth):Math.max(1,tr.doc.content.size-1)
      tr=tr.insert(at,[node,schema.nodes.paragraph.create({id:uid()})]);try{tr=tr.setSelection(node.isAtom?NodeSelection.create(tr.doc,at):TextSelection.near(tr.doc.resolve(at+1)))}catch{}
    }
    editor.view.dispatch(tr.scrollIntoView());editor.view.focus()
  }
  function recordComponent(id:string){setRecentComponents(prev=>{const next=[id,...prev.filter(x=>x!==id)].slice(0,8);localStorage.setItem('facet-components',JSON.stringify(next));return next})}
  function insertTable(rows:number,cols:number){if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||rows>200||cols<1||cols>30)return;insertBlock({type:'table',attrs:{id:uid(),tableStyle},content:Array.from({length:rows},(_,row)=>({type:'tableRow',attrs:{id:uid()},content:Array.from({length:cols},(_,col)=>({type:row===0?'tableHeader':'tableCell',attrs:{id:uid(),textAlign:tableAlignments[col]||'left'},content:[p()]}))}))});setTableSize(null)}
  function editTable(action:'addRow'|'addColumn'|'deleteRow'|'deleteColumn'|'header'){
    if(!editor)return
    // Table commands must see all rows, not only the current page fragment.
    const anchor=capturePoint(editor.state,editor.state.selection.anchor),head=capturePoint(editor.state,editor.state.selection.head)
    const canonical=editor.schema.node('doc',null,[editor.schema.node('page',null,hydrate(documentFromEditor(editor,docRef.current)).map(n=>editor.schema.nodeFromJSON(n)))])
    const tr=editor.state.tr.replaceWith(0,editor.state.doc.content.size,canonical.content)
    tr.setSelection(TextSelection.between(tr.doc.resolve(resolvePoint(tr.doc,anchor)),tr.doc.resolve(resolvePoint(tr.doc,head))))
    editor.view.dispatch(tr)
    const chain=editor.chain().focus()
    const commands={addRow:()=>chain.addRowAfter(),addColumn:()=>chain.addColumnAfter(),deleteRow:()=>chain.deleteRow(),deleteColumn:()=>chain.deleteColumn(),header:()=>chain.toggleHeaderRow()}
    commands[action]().run()
  }
  function alignTableColumn(alignment:string){
    if(!editor)return
    const {$from}=editor.state.selection;let depth=$from.depth
    while(depth>0&&!['tableCell','tableHeader'].includes($from.node(depth).type.name))depth--
    if(depth<2)return
    const table=$from.node(depth-2),start=$from.start(depth-2),column=TableMap.get(table).findCell($from.before(depth)-start).left
    const tr=editor.state.tr
    tr.doc.descendants((node,pos)=>{if(node.type.name!=='table'||node.attrs.id!==table.attrs.id)return;const map=TableMap.get(node),seen=new Set<number>();for(let row=0;row<map.height;row++){const offset=map.map[row*map.width+column];if(offset===undefined||seen.has(offset))continue;seen.add(offset);const cell=node.nodeAt(offset);if(cell)tr.setNodeMarkup(pos+1+offset,undefined,{...cell.attrs,textAlign:alignment})}return false})
    editor.view.dispatch(tr);editor.view.focus()
  }
  function openImagePicker(intent:'image'|'subfigure'='image'){setImageIntent(intent);setImageModal(true)}
  function insertComponent(item:ComponentItem){recordComponent(item.id);setSlash(null)
    if(item.action==='equation'){setMath({latex:'',inline:false});return}
    if(item.action==='image'){openImagePicker();return}
    if(item.action==='subfigure'){openImagePicker('subfigure');return}
    if(item.action==='table'){setTableLocked(false);setTableAlignments([]);setTableSize({rows:3,cols:3});return}
    if(item.action==='badge'){setComponentPicker('badge');return}
    if(item.action==='icon'){setComponentPicker('icon');return}
    if(item.id==='semantic'){setComponentPicker('semantic');return}
    if(item.id==='part'){const numbers=docRef.current.content.filter(n=>n.type==='part').map(n=>Number((n.content?.map(c=>c.text||'').join('')||'').match(/^Part (\d+)/)?.[1])||0);insertBlock({type:'part',attrs:{id:uid()},content:[{type:'text',text:`Part ${Math.max(0,...numbers)+1}`}]});return}
    if(item.block)insertBlock(item.block())
  }
  inserting.current=insertComponent
  async function importImage(file:File){
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){announce('请选择 PNG、JPEG 或 WebP 图片');return}
    if(file.size>20*1024*1024){announce('单张图片请小于 20 MB');return}
    const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.onerror=reject;r.readAsDataURL(file)})
    const check=new Image();check.src=data;try{await check.decode()}catch{announce('图片无法解码，请换一个文件');return}
    const id=uid();const next={...docRef.current,assets:{...docRef.current.assets,[id]:{name:file.name,mime:file.type,data:data.split(',')[1]}}};syncDoc(next)
    insertBlock({type:'image',attrs:{id:uid(),assetId:id,src:data,caption:'',width:100}})
  }
  async function importImages(files:FileList|File[],intent:'image'|'subfigure'='image'){
    const selected=Array.from(files).filter(file=>/^image\/(png|jpeg|webp)$/.test(file.type)).slice(0,12)
    if(!selected.length){announce('请选择 PNG、JPEG 或 WebP 图片');return}
    const assets={...docRef.current.assets},items:any[]=[]
    for(const file of selected){if(file.size>20*1024*1024)continue;const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.onerror=reject;r.readAsDataURL(file)});const check=new Image();check.src=data;try{await check.decode()}catch{continue}const id=uid();assets[id]={name:file.name,mime:file.type,data:data.split(',')[1]};items.push({assetId:id,src:data,caption:''})}
    if(!items.length){announce('图片无法解码，请换一组文件');return}
    syncDoc({...docRef.current,assets});
    if(intent==='subfigure' || items.length>1)insertBlock({type:'subfigure',attrs:{id:uid(),items,columns:Math.min(3,Math.max(1,items.length)),width:100,gap:12}});else insertBlock({type:'image',attrs:{id:uid(),assetId:items[0].assetId,src:items[0].src,caption:'',width:100}})
    setImageModal(false)
  }
  async function setCoverImage(file:File){
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){announce('封面请选择 PNG、JPEG 或 WebP 图片');return}
    const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.onerror=reject;r.readAsDataURL(file)})
    const id=uid();const assets={...docRef.current.assets,[id]:{name:file.name,mime:file.type,data:data.split(',')[1]}}
    updateSettings({assets,metadata:{...docRef.current.metadata,coverAssetId:id}})
  }
  function resetEditorDocument(next:FacetDocument){
    if(!editor)return
    clearTimeout(layoutTimer.current)
    const content=editor.schema.nodeFromJSON({type:'doc',content:[{type:'page',content:hydrate(next)}]})
    // Switching files starts a fresh history; undo must never restore a different document.
    const state=EditorState.create({schema:editor.schema,doc:content,plugins:editor.state.plugins,selection:TextSelection.atEnd(content)})
    editor.view.updateState(state)
    lastSelection.current={anchor:capturePoint(state,state.selection.anchor),head:capturePoint(state,state.selection.head)}
    setSelected(null);setSelectionText(false);setSlash(null)
  }
  async function openData(data:any){if(!data)return;if(data.error){announce(data.error);return}try{const next=await decodeDocument(new Uint8Array(data.bytes));if(!await ensureSaved())return;clearTimeout(saveTimer.current);token.current=data.token;setCurrentPath(data.path||'');markDirty(!!data.recovered);savedRevision.current=next.revision;syncDoc(next);lastSelection.current=null;resetEditorDocument(next);context.current.outline=[];paginate();setStatus(data.token?'已保存':'已恢复草稿');updateRecent();setRecoveries([])}catch(e){announce(String((e as Error).message))}}
  async function newDocument(orientation:PageOrientation){if(creatingDocument)return;setCreatingDocument(true);try{if(!await ensureSaved())return;clearTimeout(saveTimer.current);const next=makeDocument(false,orientation);token.current=undefined;setCurrentPath('');syncDoc(next);lastSelection.current=null;context.current.outline=[];resetEditorDocument(next);paginate();scheduleSave();setNewDocumentOpen(false);openSettings('封面')}catch(e){announce(String(e))}finally{setCreatingDocument(false)}}
  async function openDocument(index?:number){if(window.facetDesktop)await openData(await window.facetDesktop.open(index));else fileInput.current?.click()}
  async function recover(id:string){const data=window.facetDesktop?await window.facetDesktop.recover(id):{bytes:Array.from(await browserRecovery(undefined,id)??[])};await openData({...data,recovered:true})}
  function updateSettings(patch:Partial<FacetDocument>){const next={...docRef.current,...patch,revision:docRef.current.revision+1};syncDoc(next);scheduleSave();setTimeout(()=>{
    // Atom views (title/contents) use metadata and must be recreated even when the content is unchanged.
    editor?.view.updateState(editor.state.reconfigure({plugins:editor.state.plugins}));paginate()
    if(editor){const tr=editor.state.tr;tr.doc.descendants((n,pos)=>{if(n.type.name==='documentTitle'||n.type.name==='tableOfContents')tr.setNodeMarkup(pos,undefined,{...n.attrs,id:n.attrs.id})});tr.setMeta('pagination',true).setMeta('addToHistory',false);editor.view.dispatch(tr)}
  },0)}
  async function exportFile(type:'pdf'|'latex'|'beamer'){
    if(!editor)return;setExportMenu(false);setBusy(true)
    try{
      clearTimeout(layoutTimer.current);await document.fonts.ready;await Promise.all(Array.from(editor.view.dom.querySelectorAll('img')).map(i=>i.decode()));paginate();await wait(100)
      if(editor.view.dom.querySelector('.invalid-math'))throw new Error('文档包含错误公式，请点击红色公式修复后导出。')
      const check=paginator.current!.layout(docRef.current);if(type!=='beamer'&&check.issues.length)throw new Error(check.issues[0].message)
      if(Array.from(editor.view.dom.querySelectorAll('.math-block')).some(e=>e.scrollWidth>e.clientWidth+3))throw new Error('公式超过正文宽度，请分行后导出。')
      const snapshot=structuredClone(docRef.current);await enqueueSave()
      let result:any
      if(type==='latex'){const bytes=await latexArchive(snapshot);if(window.facetDesktop)result=await window.facetDesktop.exportArchive({name:exportName||snapshot.metadata.title,bytes:Array.from(bytes)});else download(bytes,`${exportName||snapshot.metadata.title}-latex.zip`,'application/zip')}
      else {const slides=type==='beamer'?await beamerSnapshot(editor,snapshot,preferences.beamer):null;const html=slides?.html??await pageSnapshot(editor,snapshot.metadata.title);if(window.facetDesktop)result=await window.facetDesktop.exportPDF({name:exportName||snapshot.metadata.title,html,pageCount:slides?.pageCount??editor.state.doc.childCount});else{const w=window.open('','facet-print');if(!w)throw new Error('请允许打印窗口，或使用桌面应用直接导出 PDF。');w.document.write(html);w.document.close();await w.document.fonts.ready;w.focus();w.print()}}
      if(result?.error)throw new Error(result.error)
      if(result?.token){setOutput(result);announce(`已导出 ${result.name}`)}
    }catch(e){announce((e as Error).message)}finally{setBusy(false)}
  }
  const [output,setOutput]=useState<{token:string;name:string}|null>(null)
  function selectedAction(action:string){if(!editor||!selected)return;const {pos}=selected,n=editor.state.doc.nodeAt(pos);if(!n)return
    if(action==='settings'){setEditNode({pos,type:n.type.name,attrs:{...n.attrs}});return}
    if(action==='delete'){editor.view.dispatch(editor.state.tr.delete(pos,pos+n.nodeSize));return}
    if(action==='copy'){const json=n.toJSON();walk([json],x=>{if(x.attrs?.id)x.attrs.id=uid()});editor.view.dispatch(editor.state.tr.insert(pos+n.nodeSize,editor.schema.nodeFromJSON(json)));return}
    // Move whole canonical blocks so fragments of a long component stay together.
    const canonical=docRef.current.content,at=canonical.findIndex(b=>b.attrs?.id===n.attrs.id),to=at+(action==='up'?-1:1)
    if(at<0||to<0||to>=canonical.length)return
    const reordered=[...canonical];[reordered[at],reordered[to]]=[reordered[to],reordered[at]]
    editor.commands.setContent({type:'doc',content:[{type:'page',content:hydrate({...docRef.current,content:reordered})}]})
  }
  const matches=searchComponents(query)
  const common=preferences.favorites
  const visible=query?matches:group==='收藏'?common.map(id=>registry.find(x=>x.id===id)!).filter(Boolean):group==='最近使用'?recentComponents.map(id=>registry.find(x=>x.id===id)!).filter(Boolean):matches.filter(x=>x.group===group)
  const mathResult=useMemo(()=>{if(!math)return {html:'',error:''};try{return {html:renderMath(normalizeMath(math.latex),!math.inline),error:''}}catch(e){return {html:'',error:(e as Error).message.replace(/^KaTeX parse error: /,'')}}},[math])
  const words=doc.content.map(textOf).join('').replace(/\s/g,'').length
  useEffect(()=>{if(import.meta.env.DEV)window.__facet={editor,getDocument:()=>docRef.current,paginate,exportBeamer:(tag:BeamerSettings|string=preferences.beamer)=>editor?beamerSnapshot(editor,docRef.current,tag):null,exportHTML:()=>editor?pageSnapshot(editor,docRef.current.metadata.title):null,load:(next:FacetDocument)=>{syncDoc(next);resetEditorDocument(next);paginate()},getLayout:()=>paginator.current?.layout(docRef.current),encode:()=>encodeDocument(docRef.current)}},[editor,paginate,preferences.beamer])
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">◈</span><span>Facet</span><span className="brand-separator"/><span className="workspace-label" title={currentPath}>{workspaceName}</span></div><div className="document-status"><span>{doc.metadata.title}</span><span className="status-dot"/><small>{status}</small></div><div className="top-actions"><button className="primary-button" disabled={busy} onClick={openExport}><Download size={16}/>{busy?'正在导出…':'导出'}</button></div></header>
    <div className="main-layout">
      {left&&<aside className="left-panel"><div className="panel-heading"><span>文档</span><button className="icon-button" title="收起导航" onClick={()=>setLeft(false)}><PanelLeftClose size={17}/></button></div><button className="new-document" onClick={()=>{setNewOrientation(preferences.orientation);setNewDocumentOpen(true)}}><Plus size={16}/>新建文档<span>{isMac ? '⌘ N' : 'Ctrl+N'}</span></button><button className="nav-link" onClick={()=>void openDocument()}><FolderOpen size={16}/>打开文档</button><button className="nav-link" onClick={()=>{updateRecent();void refreshRecoveries();setFilesOpen(true)}}><FolderOpen size={16}/>文件管理</button><button className="nav-link" onClick={()=>void flushRef.current().catch(()=>{})}><Download size={16}/>保存文档</button><WorkspaceTree refresh={treeRefresh} currentPath={currentPath} onOpen={data=>void openData(data)} onRoot={setWorkspaceName} onError={announce}/>
      <div className="outline-heading">文档大纲<span>{outline.length}</span></div><nav className="outline">{outline.length?outline.map(o=><button key={o.id} className={o.level===0?'outline-part':''} style={{paddingLeft:o.level===0?8:16+(o.level-1)*13}} onClick={()=>{const el=editor?.view.dom.querySelector(`[data-id="${o.id}"]`);el?.scrollIntoView({block:'center',behavior:'smooth'})}}><span className="outline-line"/>{o.text||'未命名标题'}</button>):<p className="muted-empty">插入标题后，结构会出现在这里。</p>}</nav>
      {recoveries.length>0&&<button className="recovery-card" onClick={()=>void recover(recoveries[0].id)}><RotateCcw size={15}/><span>恢复最近的本机草稿<small>保留你的上一次思考</small></span></button>}
      <div className="sidebar-bottom"><button className="nav-link" onClick={()=>openSettings('封面')}><Settings2 size={16}/>设置</button></div></aside>}
      <main className="workspace" ref={workspace}>
        {findOpen&&<div className="find-bar" role="search" aria-label="文档搜索"><Search size={15}/><input ref={findInput} autoFocus aria-label="搜索文档" placeholder="搜索文档…" value={findText} onChange={e=>{setFindText(e.target.value);setFindIndex(0)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();moveFind(e.shiftKey?-1:1)}if(e.key==='Escape'){e.stopPropagation();setFindOpen(false);editor?.commands.focus()}}}/><span>{findCount?findIndex+1:0} / {findCount}</span><button aria-label="上一个匹配" onClick={()=>moveFind(-1)}><ArrowUp size={15}/></button><button aria-label="下一个匹配" onClick={()=>moveFind(1)}><ArrowDown size={15}/></button><button aria-label="关闭搜索" onClick={()=>setFindOpen(false)}><X size={15}/></button></div>}<div className="canvas-toolbar"><div>{!left&&<><button className="icon-button" aria-label="设置" onClick={()=>openSettings('封面')}><Settings2 size={16}/></button><button className="icon-button" title="展开导航" onClick={()=>setLeft(true)}><PanelLeftOpen size={17}/></button></>}<span className="breadcrumb">文档 <ChevronRight size={12}/> {doc.metadata.title}</span></div><div><button className="writing-trigger" onClick={()=>setCommandOpen(true)}><Search size={13}/>书写命令 <kbd>{commandShortcut}</kbd></button><span className="paper-label">{format.label}</span>{!right&&<button className="icon-button" title="展开组件" onClick={()=>setRight(true)}><PanelRightOpen size={17}/></button>}</div></div>
        <div className="format-toolbar" onMouseDown={e=>e.preventDefault()}><button title="加粗" aria-label="加粗" onClick={()=>editor?.chain().focus().toggleBold().run()}><Bold size={15}/></button><button title="斜体" aria-label="斜体" onClick={()=>editor?.chain().focus().toggleItalic().run()}><Italic size={15}/></button><button title="高亮" aria-label="高亮" onClick={()=>editor?.chain().focus().toggleHighlight().run()}><Highlighter size={15}/></button><button title="链接" aria-label="链接" onClick={()=>setLinkDraft(editor?.getAttributes('link').href||'')}><Link2 size={15}/></button><span/><button className="style-button style-important" onClick={()=>editor?.chain().focus().toggleMark('semanticStyle',{kind:'important'}).run()}>重点</button><button className="style-button style-success" onClick={()=>editor?.chain().focus().toggleMark('semanticStyle',{kind:'success'}).run()}>成功</button><button className="style-button style-muted" onClick={()=>editor?.chain().focus().toggleMark('semanticStyle',{kind:'muted'}).run()}>弱化</button><button className="style-button" onClick={()=>editor?.chain().focus().toggleMark('semanticStyle',{kind:'theme'}).run()}>主题色</button><span/><button title="上移组件" aria-label="上移组件" disabled={!selected} onClick={()=>selectedAction('up')}><ArrowUp size={15}/></button><button title="下移组件" aria-label="下移组件" disabled={!selected} onClick={()=>selectedAction('down')}><ArrowDown size={15}/></button><button title="复制组件" aria-label="复制组件" disabled={!selected} onClick={()=>selectedAction('copy')}><Copy size={14}/></button><button title="删除组件" aria-label="删除组件" disabled={!selected} onClick={()=>selectedAction('delete')}><Trash2 size={14}/></button><span/><button title="撤销" aria-label="撤销" className="icon-button" onClick={()=>editor?.chain().focus().undo().run()}><Undo2 size={17}/></button><button title="重做" aria-label="重做" className="icon-button" onClick={()=>editor?.chain().focus().redo().run()}><Redo2 size={17}/></button></div>
        {editor?.isActive('table')&&<div className="table-toolbar" onMouseDown={e=>e.preventDefault()}><button onClick={()=>editTable('addRow')}>＋ 行</button><button onClick={()=>editTable('addColumn')}>＋ 列</button><button onClick={()=>editTable('deleteRow')}>删除行</button><button onClick={()=>editTable('deleteColumn')}>删除列</button><button onClick={()=>editTable('header')}>表头</button><label className="toolbar-label">表格样式 <select aria-label="表格样式" value={editor.getAttributes('table').tableStyle||'academic'} onMouseDown={e=>e.stopPropagation()} onChange={e=>{const id=editor.getAttributes('table').id,tr=editor.state.tr;tr.doc.descendants((node,pos)=>{if(node.type.name==='table'&&node.attrs.id===id)tr.setNodeMarkup(pos,undefined,{...node.attrs,tableStyle:e.target.value})});editor.view.dispatch(tr);editor.view.focus()}}><option value="academic">三线学术</option><option value="grid">实线网格</option></select></label><span className="toolbar-label">当前列</span>{(['left','center','right'] as const).map((align,i)=><button key={align} onClick={()=>alignTableColumn(align)}>{['左对齐','居中','右对齐'][i]}</button>)}</div>}
        <div className="paper-scroll" onScroll={e=>{const container=e.currentTarget,rect=container.getBoundingClientRect();let nearest=1;editor?.view.dom.querySelectorAll('.facet-page').forEach((p,i)=>{if(p.getBoundingClientRect().top<rect.top+rect.height/2)nearest=i+1});setCurrentPage(nearest)}}><div className="paper-stage" style={{width:pageWidth*zoom,height:(pageHeight+28)*pages*zoom}}><div className="paper-scale" style={{transform:`scale(${zoom})`,width:pageWidth,'--accent':accentValue(doc.page.accent),'--content-height':`${pageHeight-doc.page.margin*PX_PER_MM*2}px`} as React.CSSProperties}><EditorContent editor={editor}/></div></div><div className="page-end-note">思考值得被好好记录。</div></div>
        {issues.length>0&&<div className="layout-warning"><span>{issues[0].message}</span><button onClick={()=>editor?.view.dom.querySelector(`[data-id="${issues[0].id}"]`)?.scrollIntoView({block:'center'})}>定位</button></div>}
      </main>
      {right&&<aside className="right-panel"><div className="panel-heading"><span>组件工具箱</span><button className="icon-button" title="收起组件" onClick={()=>setRight(false)}><PanelRightClose size={17}/></button></div><p className="panel-description">为想法找到合适的表达。</p><label className="component-search"><Search size={15}/><input placeholder="搜索组件…" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>/</kbd></label><div className="component-tabs">{['收藏','最近使用','基础','提示框','多媒体','页面'].map(g=><button key={g} className={g===group?'active':''} onClick={()=>{setGroup(g);setQuery('')}}>{g}</button>)}</div><div className="component-list"><div className="component-section-heading">{query?'搜索结果':group}<span>{visible.length}</span></div>{visible.map(item=><button key={item.id} data-component={item.id} className={`component-card ${item.variant?'has-swatch':''}`} onMouseDown={e=>e.preventDefault()} onClick={()=>insertComponent(item)}><span className="component-icon" style={item.variant?{'--component-color':colors[variants[item.variant].color]} as React.CSSProperties:{}}>{fa(item.icon)}</span><span className="component-copy"><strong>{item.label}</strong><small>{item.description}</small>{item.syntax&&<code className="component-syntax">{item.syntax}</code>}</span><Plus className="component-plus" size={14}/>{item.variant&&<span className="component-swatch" style={{background:colors[variants[item.variant].color]}}/>}</button>)}{!visible.length&&<p className="muted-empty">{group==='最近使用'?'使用过的组件会出现在这里。':'没有找到匹配的组件。'}</p>}</div><div className="quickadd-note"><kbd>/</kbd><div><strong>也可以用键盘，更快一点</strong><span>输入 / 搜索组件，按 Enter 插入</span></div></div></aside>}
    </div>
    <footer className="statusbar"><div><span className="local-indicator"/>Academic<span className="footer-divider"/>本地文档</div><div>{words.toLocaleString()} 字<span className="footer-divider"/>第 {currentPage} / {pages} 页</div><div><button title="缩小" aria-label="缩小" onClick={()=>{setFit(false);setZoom(z=>Math.max(.35,z-.1))}}><Minus size={13}/></button><button onClick={()=>setFit(false)}>{Math.round(zoom*100)}%</button><button title="放大" aria-label="放大" onClick={()=>{setFit(false);setZoom(z=>Math.min(2,z+.1))}}><Plus size={13}/></button><span className="footer-divider"/><button onClick={()=>setFit(true)}>适合宽度</button></div></footer>
    {slash&&<div className="slash-menu" style={{left:Math.min(slash.x,window.innerWidth-310),top:Math.min(slash.y,window.innerHeight-340)}}><div className="slash-heading">插入组件 <kbd>ESC</kbd></div>{searchComponents(slash.q).map((item,i)=><button key={item.id} className={i===slash.selected?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>{editor?.commands.deleteRange({from:slash.from,to:slash.to});setSlash(null);insertComponent(item)}}>{fa(item.icon)}<span>{item.label}<small>{item.description}</small>{item.syntax&&<code className="component-syntax">{item.syntax}</code>}</span><kbd>↵</kbd></button>)}{!searchComponents(slash.q).length&&<p className="muted-empty">没有找到匹配的组件。</p>}</div>}
    {math&&<Modal title="编辑公式" description="上方输入 LaTeX，下方立即查看结果。" onClose={()=>setMath(null)} wide><div className="math-mode"><button className={!math.inline?'active':''} onClick={()=>setMath({...math,inline:false})}>独立公式</button><button className={math.inline?'active':''} onClick={()=>setMath({...math,inline:true})}>行内公式</button></div><label className="field-label">LATEX 源码</label><textarea className="math-source" autoFocus placeholder={'例如：\\frac{a}{b} 或直接粘贴公式'} value={math.latex} onChange={e=>setMath({...math,latex:e.target.value})} onKeyDown={e=>{if(pairTextarea(e.nativeEvent,e.currentTarget,value=>setMath({...math,latex:value})))return;if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();commitMath()}}}/><div className="math-preview-label">实时渲染</div><div className={`math-preview ${mathResult.error?'error':''}`}>{mathResult.error?<p>{mathResult.error}</p>:<div dangerouslySetInnerHTML={{__html:mathResult.html}}/>}</div><div className="modal-actions"><span>{mathResult.error?'可保留错误草稿，导出前需修复。':'支持分数、积分、矩阵与对齐公式。'}</span><button className="secondary-button" onClick={()=>setMath(null)}>取消</button><button className="primary-button" onClick={commitMath}>完成 <kbd>{isMac ? '⌘ ↵' : 'Ctrl+Enter'}</kbd></button></div></Modal>}
    {linkDraft!==null&&<Modal title="编辑链接" description="选中文字后添加链接；未选中时插入地址。按住 ⌘ / Ctrl 点击正文链接可打开。" onClose={()=>setLinkDraft(null)}><label className="link-field">链接地址<input autoFocus aria-label="链接地址" placeholder="网址、邮箱、https://… 或 #锚点" value={linkDraft} onChange={e=>setLinkDraft(e.target.value)}/></label><div className="modal-actions"><button className="secondary-button" onClick={()=>{restoreSelection();editor?.chain().focus().extendMarkRange('link').unsetLink().run();setLinkDraft(null)}}>移除链接</button><button className="primary-button" disabled={!normalizeLink(linkDraft)} onClick={()=>{if(!editor)return;restoreSelection();const href=normalizeLink(linkDraft);if(editor.state.selection.empty&&!editor.isActive('link'))editor.chain().focus().insertContent({type:'text',text:href,marks:[{type:'link',attrs:{href}}]}).run();else editor.chain().focus().extendMarkRange('link').setLink({href}).run();setLinkDraft(null)}}>应用链接</button></div></Modal>}
    {newDocumentOpen&&<Modal title="新建文档" description="选择页面方向，开始新的书写。" onClose={()=>{if(!creatingDocument)setNewDocumentOpen(false)}}><div className="page-format-options" role="radiogroup" aria-label="页面方向">{(['portrait','landscape'] as const).map(orientation=><button key={orientation} type="button" role="radio" aria-checked={newOrientation===orientation} className={newOrientation===orientation?'selected':''} onClick={()=>setNewOrientation(orientation)}><div className="page-format-preview"><i className={orientation}><span/><span/><span/></i></div><strong>{orientation==='portrait'?'竖版 · A4':'横版 · 16:9'}</strong><small>{orientation==='portrait'?'适合研究笔记与长文阅读':'适合展示、图文与双栏排版'}</small></button>)}</div><p className="command-hint">两种方向均支持在光标处插入组件，也可以输入 / 使用书写命令。</p><div className="modal-actions"><button className="secondary-button" disabled={creatingDocument} onClick={()=>setNewDocumentOpen(false)}>取消</button><button className="primary-button" disabled={creatingDocument} onClick={()=>void newDocument(newOrientation)}>{creatingDocument?'正在创建…':'创建文档'}</button></div></Modal>}

    {commandOpen&&<Modal title="快速命令" description={`输入组件名称，或按 ${commandShortcut} 随时打开。`} onClose={()=>setCommandOpen(false)}><label className="component-search command-search"><Search size={15}/><input autoFocus placeholder="搜索组件…" value={query} role="combobox" aria-label="搜索快速命令" aria-controls="command-results" aria-expanded="true" aria-activedescendant={matches[commandSelected]?`command-${matches[commandSelected].id}`:undefined} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setCommandSelected(i=>Math.max(0,Math.min(matches.length-1,i+(e.key==='ArrowDown'?1:-1))))}if(e.key==='Enter'&&matches[commandSelected]){e.preventDefault();setCommandOpen(false);insertComponent(matches[commandSelected])}}}/></label><div className="command-results" id="command-results" role="listbox">{matches.map((item,i)=><button key={item.id} id={`command-${item.id}`} role="option" aria-selected={i===commandSelected} className={i===commandSelected?'active':''} onMouseMove={()=>setCommandSelected(i)} onClick={()=>{setCommandOpen(false);insertComponent(item)}}><span className="component-icon">{fa(item.icon)}</span><span><strong>{item.label}</strong><small>{item.description}</small>{item.syntax&&<code className="component-syntax">{item.syntax}</code>}</span><Plus size={14}/></button>)}{!matches.length&&<p className="muted-empty">没有找到匹配的组件。</p>}</div><p className="command-hint">↑ ↓ 选择 · Enter 插入 · Esc 关闭</p></Modal>}
    {componentPicker&&<Modal title={componentPicker==='icon'?'选择行内图标':componentPicker==='badge'?'选择状态标签':'选择图标列表样式'} description="先选择外观，再插入到光标处。" onClose={()=>setComponentPicker(null)} wide><div className="visual-picker">{componentPicker==='icon'&&icons.map(iconName=><button key={iconName} onClick={()=>{insertBlock({type:'inlineIcon',attrs:{id:uid(),icon:iconName,color:'darkblue'}});setComponentPicker(null)}}>{fa(iconName)}<small>{iconName.charAt(0).toUpperCase()+iconName.slice(1)}</small></button>)}{componentPicker==='badge'&&['进行中','已完成','待办','阻塞','已取消','草稿'].map((text,i)=><button key={text} className="badge-choice" onClick={()=>{insertBlock({type:'badge',attrs:{id:uid(),text,color:Object.keys(colors)[i%Object.keys(colors).length]}});setComponentPicker(null)}}><span style={{color:colors[Object.keys(colors)[i%Object.keys(colors).length]]}}>{text}</span><small>{colorName(Object.keys(colors)[i%Object.keys(colors).length])}</small></button>)}{componentPicker==='semantic'&&semanticItems.map(item=><button key={item.key} className="semantic-choice" onClick={()=>{insertBlock({type:'semanticList',attrs:{id:uid()},content:[{type:'semanticItem',attrs:{id:uid(),kind:item.key},content:[p()]}]});setComponentPicker(null)}}><span style={{color:colors[item.color]}}>{fa(item.icon)}</span><strong>{item.label}</strong><small>图标列表</small></button>)}</div></Modal>}
    {appSettings&&<Modal title="设置" description="文档选项与工作空间偏好" onClose={()=>setAppSettings(false)} wide><nav className="settings-tabs" aria-label="设置分类">{['封面','目录','导出','收藏','说明书','通用'].map(tab=><button key={tab} className={settingsTab===tab?'active':''} onClick={()=>{setSettingsTab(tab);if(tab==='导出'&&!exportSettings)configureExport('pdf')}}>{tab}</button>)}</nav><div className="settings-section">
      {settingsTab==='封面'&&<><div className="settings-grid">{(['title','subtitle','author','institute','date'] as const).map(key=><label key={key}>{({title:'文档标题',subtitle:'副标题',author:'作者',institute:'单位',date:'日期'})[key]}<input value={doc.metadata[key]||''} onChange={e=>updateSettings({metadata:{...docRef.current.metadata,[key]:e.target.value}})}/></label>)}<label>作者个人网页<input type="text" placeholder="example.com" value={doc.metadata.authorUrl||''} onChange={e=>updateSettings({metadata:{...docRef.current.metadata,authorUrl:e.target.value}})}/></label><label>封面图片<button className="file-choice" onClick={()=>coverInput.current?.click()}>{doc.metadata.coverAssetId?'已选择封面图片':'选择本地图片'}</button></label><label>页边距（mm）<input type="number" min="10" max="40" step=".1" value={doc.page.margin} onChange={e=>{const margin=Number(e.target.value);if(margin>=10&&margin<=40)updateSettings({page:{...docRef.current.page,margin}})}}/></label><label>页眉<input value={doc.page.header} onChange={e=>updateSettings({page:{...docRef.current.page,header:e.target.value}})}/></label><label>页脚<input value={doc.page.footer} onChange={e=>updateSettings({page:{...docRef.current.page,footer:e.target.value}})}/></label><label className="accent-field">主题强调色<div className="color-palette">{Object.keys(colors).map(c=><button type="button" key={c} title={`${colorName(c)} ${colors[c]}`} className={doc.page.accent===c?'selected':''} style={{'--swatch':colors[c]} as React.CSSProperties} onClick={()=>updateSettings({page:{...docRef.current.page,accent:c}})}><i/>{colorName(c)}</button>)}<label className="custom-color-choice"><input aria-label="自定义 RGB 颜色" type="color" value={accentValue(doc.page.accent)} onChange={e=>updateSettings({page:{...docRef.current.page,accent:e.target.value}})}/><span>自定义</span></label></div><small className="hex-value">RGB / HEX · {accentValue(doc.page.accent)}</small></label><div className="paper-setting">{format.label}<small>{format.width} × {format.height} mm · 本地排版</small></div></div><button className="secondary-button" onClick={()=>toggleDocumentBlock('documentTitle')}>{doc.content.some(n=>n.type==='documentTitle')?'隐藏封面':'显示封面'}</button></>}
      {settingsTab==='目录'&&<div className="settings-grid"><label className="check-row"><input type="checkbox" checked={doc.content.some(n=>n.type==='tableOfContents')} onChange={()=>toggleDocumentBlock('tableOfContents')}/>显示目录页</label><label>目录显示到<select aria-label="目录显示到" value={doc.page.tocDepth??3} onChange={e=>{const content=structuredClone(docRef.current.content);walk(content,n=>{if(n.type==='heading')n.attrs={...n.attrs,toc:true}});updateSettings({page:{...docRef.current.page,tocDepth:Number(e.target.value)},content});resetEditorDocument({...docRef.current,content})}}><option value="1">一级标题</option><option value="2">二级标题</option><option value="3">三级标题</option></select></label><p className="settings-help">目录包含所选层级及其上级标题，页码随正文自动更新。</p></div>}
      {settingsTab==='导出'&&<><nav className="settings-tabs" aria-label="默认导出格式">{(['pdf','beamer','latex'] as const).map(type=><button key={type} className={preferences.exportFormat===type?'active':''} onClick={()=>setPreferences({...preferences,exportFormat:type})}>{({pdf:'纸面 PDF',beamer:'Beamer PDF',latex:'LaTeX 源码包'})[type]}</button>)}</nav><p className="settings-help">选择默认导出格式。右上角“导出”使用这里的配置。</p><div className="settings-grid">{preferences.exportFormat==='beamer'&&<><label>右上角标志<select value={preferences.beamer.branding} onChange={e=>setPreferences({...preferences,beamer:{...preferences.beamer,branding:e.target.value as 'zju'|'text'|'none'}})}><option value="zju">浙江大学 ZJU</option><option value="text">自定义文字</option><option value="none">不显示</option></select></label>{preferences.beamer.branding==='text'&&<label>右上角文字<input aria-label="Beamer 标签" maxLength={24} value={preferences.beamer.tag} onChange={e=>setPreferences({...preferences,beamer:{...preferences.beamer,tag:e.target.value}})}/></label>}<label><input type="checkbox" checked={preferences.beamer.cover} onChange={e=>setPreferences({...preferences,beamer:{...preferences.beamer,cover:e.target.checked}})}/>包含封面</label><label><input type="checkbox" checked={preferences.beamer.footer} onChange={e=>setPreferences({...preferences,beamer:{...preferences.beamer,footer:e.target.checked}})}/>显示页脚与页码</label></>}</div></>}
      {settingsTab==='收藏'&&<div className="favorites-browser"><nav aria-label="收藏分类">{['全部','基础','提示框','多媒体','页面'].map(category=><button key={category} className={favoriteGroup===category?'active':''} onClick={()=>setFavoriteGroup(category)}>{category}<small>{registry.filter(item=>item.id!=='paragraph'&&(category==='全部'||item.group===category)).length}</small></button>)}</nav><div><label className="component-search"><Search size={14}/><input aria-label="搜索收藏样式" placeholder="搜索样式…" value={favoriteQuery} onChange={e=>setFavoriteQuery(e.target.value)}/></label><div className="favorite-grid">{registry.filter(item=>item.id!=='paragraph'&&(favoriteGroup==='全部'||item.group===favoriteGroup)&&item.label.includes(favoriteQuery)).map(item=><label key={item.id}><input type="checkbox" checked={preferences.favorites.includes(item.id)} onChange={e=>setPreferences({...preferences,favorites:e.target.checked?[...preferences.favorites,item.id]:preferences.favorites.filter(id=>id!==item.id)})}/>{fa(item.icon)}{item.label}</label>)}</div></div></div>}
      {settingsTab==='说明书'&&<><h3>Facet 用法大全</h3><p>阅读纸面手册，或打开包含全部组件的可编辑示例。</p><button className="primary-button" onClick={()=>setGuideOpen(true)}>阅读用法大全</button> <button className="secondary-button" onClick={()=>void openGuideDocument()}>打开可编辑示例</button></>}
      {settingsTab==='通用'&&<div className="settings-grid"><label>默认页面方向<select value={preferences.orientation} onChange={e=>setPreferences({...preferences,orientation:e.target.value as PageOrientation})}><option value="portrait">A4 竖版</option><option value="landscape">16:9 横版</option></select></label><label>默认缩放<select value={preferences.fit?'fit':'actual'} onChange={e=>{const value=e.target.value==='fit';setPreferences({...preferences,fit:value});setFit(value);if(!value)setZoom(1)}}><option value="fit">适合宽度</option><option value="actual">100%</option></select></label><label><input type="checkbox" checked={preferences.left} onChange={e=>{setPreferences({...preferences,left:e.target.checked});setLeft(e.target.checked)}}/>显示文档导航</label><label><input type="checkbox" checked={preferences.right} onChange={e=>{setPreferences({...preferences,right:e.target.checked});setRight(e.target.checked)}}/>显示组件工具箱</label></div>}</div><div className="modal-actions"><span>偏好自动保存 · 文档选项随文件保存</span><button className="primary-button" onClick={()=>setAppSettings(false)}>完成</button></div></Modal>}
    {guideOpen&&<Modal title="Facet 用法大全" description="欢迎使用 Facet，可随时从设置中的说明书再次打开。" onClose={closeGuide} wide><iframe className="guide-reader" title="Facet 用法大全 PDF" src={guidePDF}/><div className="modal-actions"><button className="secondary-button" onClick={()=>void openGuideDocument()}>打开可编辑示例</button><button className="primary-button" onClick={closeGuide}>开始使用</button></div></Modal>}
    {pasteMenu&&<div className="paste-menu" role="menu" style={{left:pasteMenu.x,top:pasteMenu.y}} onMouseDown={e=>e.preventDefault()}>{(['rich','match','plain','markdown','image'] as const).map(mode=><button role="menuitem" key={mode} onClick={()=>void pasteFromClipboard(mode)}>{({rich:'粘贴（保留格式）',match:'粘贴并匹配当前样式',image:'粘贴为图片',plain:'粘贴为纯文本',markdown:'粘贴为 Markdown'})[mode]}</button>)}<button role="menuitem" onClick={()=>setPasteMenu(null)}>关闭</button></div>}
    {filesOpen&&<Modal title="文件管理" onClose={()=>setFilesOpen(false)} wide><div className="settings-tabs"><button onClick={()=>void flushRef.current().catch(()=>{})}>保存文档</button><button onClick={()=>void enqueueSave(true,true).catch(()=>{})}>另存为…</button><button onClick={()=>void openDocument()}>打开文件…</button></div><h3>最近文档</h3>{recentFiles.map(f=><div className="file-manager-row" key={f.index}><button onClick={()=>{void openDocument(f.index);setFilesOpen(false)}}>{f.name}<small>{f.directory}</small></button><button onClick={()=>void window.facetDesktop?.revealDocument(f.index)}>显示位置</button><button onClick={()=>void window.facetDesktop?.forgetDocument(f.index).then(updateRecent)}>移出列表</button></div>)}<h3>本机草稿</h3>{recoveries.map(f=><div className="file-manager-row" key={f.id}><button onClick={()=>{void recover(f.id);setFilesOpen(false)}}>{f.name||f.id}<small>{new Date(f.modified).toLocaleString()}</small></button></div>)}{!recentFiles.length&&!recoveries.length&&<p>保存或打开的文档会显示在这里。</p>}</Modal>}

    {tableSize&&<Modal title="插入表格" description="选择网格或填写行列数，再设置每一列的对齐方式。" onClose={()=>setTableSize(null)}><label className="table-style-field">表格样式<select aria-label="新表格样式" value={tableStyle} onChange={e=>setTableStyle(e.target.value)}><option value="academic">三线学术</option><option value="grid">实线网格 · 主题配色</option></select></label><div className="table-picker-grid">{Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=><button key={`${r}-${c}`} className={r<tableSize.rows&&c<tableSize.cols?'active':''} onMouseEnter={()=>{if(!tableLocked.current)setTableSize({rows:r+1,cols:c+1})}} onMouseDown={()=>setTableLocked(true)} onClick={()=>{setTableSize({rows:r+1,cols:c+1});setTableLocked(true)}} aria-label={`${r+1} 行 ${c+1} 列`}/>))}</div><div className="settings-grid table-dimensions"><label>行数<input aria-label="表格行数" type="number" min="1" max="200" value={tableSize.rows||''} onChange={e=>{setTableLocked(true);setTableSize({...tableSize,rows:Number(e.target.value)})}}/></label><label>列数<input aria-label="表格列数" type="number" min="1" max="30" value={tableSize.cols||''} onChange={e=>{setTableLocked(true);setTableSize({...tableSize,cols:Number(e.target.value)})}}/></label></div><p className="command-hint">支持 1–200 行、1–30 列；插入后可增删行列。</p><div className="table-column-alignments">{Array.from({length:Math.max(0,Math.min(30,Math.floor(tableSize.cols)))},(_,i)=><label key={i}>第 {i+1} 列<select aria-label={`第 ${i+1} 列对齐`} value={tableAlignments[i]||'left'} onChange={e=>setTableAlignments(a=>{const next=[...a];next[i]=e.target.value;return next})}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>)}</div><div className="modal-actions"><button className="secondary-button" onClick={()=>setTableSize(null)}>取消</button><button className="primary-button" disabled={!Number.isInteger(tableSize.rows)||!Number.isInteger(tableSize.cols)||tableSize.rows<1||tableSize.rows>200||tableSize.cols<1||tableSize.cols>30} onClick={()=>insertTable(tableSize.rows,tableSize.cols)}>插入表格</button></div></Modal>}
    {imageModal&&<Modal title={imageIntent==='subfigure'?'插入子图排列':'插入图片'} description="拖拽、粘贴截图，或从文件夹选择图片。" onClose={()=>setImageModal(false)}><div className="image-drop" tabIndex={0} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void importImages(e.dataTransfer.files,imageIntent)}} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();void importImages(files,imageIntent)}}}><FolderOpen size={25}/><strong>把图片拖到这里，或直接粘贴</strong><span>支持 PNG、JPEG、WebP，单张不超过 20 MB</span><button className="secondary-button" onClick={()=>imageIntent==='subfigure'?subfigureInput.current?.click():imageInput.current?.click()}>从文件夹选择</button></div>{imageIntent==='subfigure'&&<p className="muted-empty">可以一次选择多张图片，插入后可双击组件后调整列数、间距、整体宽度，并为每张子图填写说明。</p>}<div className="modal-actions"><button className="secondary-button" onClick={()=>setImageModal(false)}>取消</button></div></Modal>}
    {editNode&&<Modal title={editNode.type==='blockquote'?'引用颜色':editNode.type==='heading'?'标题样式':editNode.type==='columns'?'双栏布局':editNode.type==='subfigure'?'子图布局':'编辑样式'} onClose={()=>setEditNode(null)}><div className="settings-grid">{editNode.type==='callout'&&<><label>卡片类型<select value={editNode.attrs.variant} onChange={e=>{const v=variants[e.target.value];setEditNode({...editNode,attrs:{...editNode.attrs,variant:e.target.value,...v}})}}>{Object.entries(variants).map(([k,v])=><option value={k} key={k}>{v.title||'重点段落'}</option>)}</select></label><label>标题<input value={editNode.attrs.title??''} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,title:e.target.value}})}/></label></>}
      {['callout','badge','inlineIcon'].includes(editNode.type)&&<><div className="component-color-field"><span>配色</span><ColorPicker value={editNode.attrs.color||'darkblue'} onChange={color=>setEditNode({...editNode,attrs:{...editNode.attrs,color}})}/></div>{editNode.type!=='badge'&&<label>图标<select value={editNode.attrs.icon||'star'} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,icon:e.target.value}})}>{icons.map(i=><option key={i}>{i}</option>)}</select></label>}</>}
      {editNode.type==='blockquote'&&<div className="component-color-field"><span>引用颜色</span><ColorPicker value={editNode.attrs.color||'darkblue'} onChange={color=>setEditNode({...editNode,attrs:{...editNode.attrs,color}})}/></div>}{editNode.type==='badge'&&<label>标签文字<input value={editNode.attrs.text} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,text:e.target.value}})}/></label>}
      {editNode.type==='heading'&&<><label>图标<select value={editNode.attrs.icon||''} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,icon:e.target.value}})}><option value="">无图标</option>{icons.map(i=><option key={i}>{i}</option>)}</select></label><label><input type="checkbox" checked={!!editNode.attrs.numbered} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,numbered:e.target.checked}})}/>显示编号</label><label><input type="checkbox" checked={editNode.attrs.toc!==false} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,toc:e.target.checked}})}/>进入目录</label></>}
      {editNode.type==='image'&&<><label>图片说明<input value={editNode.attrs.caption||''} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,caption:e.target.value}})}/></label><label>宽度（正文百分比）<input type="range" min="10" max="100" value={editNode.attrs.width} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,width:Number(e.target.value)}})}/>{editNode.attrs.width}%</label></>}
      {editNode.type==='subfigure'&&<><label>图组宽度（正文百分比）<input type="range" min="20" max="100" value={editNode.attrs.width||100} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,width:Number(e.target.value)}})}/>{editNode.attrs.width||100}%</label><label>每行子图数<input type="number" min="1" max="4" value={editNode.attrs.columns||2} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,columns:Math.max(1,Math.min(4,Number(e.target.value)||2))}})}/></label><label>子图间距（px）<input type="range" min="0" max="40" value={editNode.attrs.gap??12} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,gap:Number(e.target.value)}})}/>{editNode.attrs.gap??12}px</label><div className="subfigure-captions">{(editNode.attrs.items??[]).map((item:any,i:number)=><label key={item.assetId||i}><img src={item.src} alt={`子图 ${i+1}`}/><span>子图 ({String.fromCharCode(97+i)}) 说明<input aria-label={`子图 ${i+1} 说明`} value={item.caption||''} placeholder="描述这张子图…" onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,items:editNode.attrs.items.map((entry:any,index:number)=>index===i?{...entry,caption:e.target.value}:entry)}})}/></span></label>)}</div></>}
      {editNode.type==='columns'&&<><label>左栏宽度<input aria-label="左栏宽度" type="range" min="20" max="80" value={editNode.attrs.ratio??50} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,ratio:Number(e.target.value)}})}/>{editNode.attrs.ratio??50}% / {100-(editNode.attrs.ratio??50)}%</label><label>栏间距（px）<input aria-label="栏间距" type="range" min="0" max="60" value={editNode.attrs.gap??24} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,gap:Number(e.target.value)}})}/>{editNode.attrs.gap??24}px</label><p className="columns-help">点击任一栏输入文字，或将图片、表格等组件插入光标处。</p></>}
      {editNode.type==='codeBlock'&&<label>代码语言<select value={editNode.attrs.language||'python'} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,language:e.target.value}})}>{['python','bash','latex','javascript','typescript','json','text'].map(l=><option key={l}>{l}</option>)}</select></label>}
      {editNode.type==='semanticItem'&&<label>条目类型<select value={editNode.attrs.kind} onChange={e=>setEditNode({...editNode,attrs:{...editNode.attrs,kind:e.target.value}})}>{semanticItems.map(i=><option key={i.key} value={i.key}>{i.label}</option>)}</select></label>}
      {!['callout','badge','inlineIcon','heading','image','subfigure','columns','codeBlock','semanticItem','blockquote'].includes(editNode.type)&&<p className="muted-empty">此组件可以直接在纸面上编辑。</p>}</div><div className="modal-actions"><button className="secondary-button" onClick={()=>setEditNode(null)}>取消</button><button className="primary-button" onClick={()=>{if(editor){const tr=editor.state.tr;if(editNode.attrs.id)tr.doc.descendants((node,pos)=>{if(node.attrs.id===editNode.attrs.id)tr.setNodeMarkup(pos,undefined,{...node.attrs,...editNode.attrs})});else tr.setNodeMarkup(editNode.pos,undefined,editNode.attrs);editor.view.dispatch(tr);editor.view.focus()}setEditNode(null)}}>应用</button></div></Modal>}
    {exportOpen&&<Modal title="导出文档" onClose={()=>setExportOpen(false)}><div className="settings-grid"><label>导出格式<select value={exportSettings||'pdf'} onChange={e=>setExportSettings(e.target.value as ExportFormat)}><option value="pdf">纸面 PDF</option><option value="beamer">Beamer PDF</option><option value="latex">LaTeX 源码包</option></select></label><label>文件名称<input value={exportName} onChange={e=>setExportName(e.target.value)}/></label>{exportSettings==='beamer'&&<><label>右上角标志<select value={preferences.beamer.branding} onChange={e=>setPreferences({...preferences,beamer:{...preferences.beamer,branding:e.target.value as 'zju'|'text'|'none'}})}><option value="zju">浙江大学 ZJU</option><option value="text">自定义文字</option><option value="none">不显示</option></select></label>{preferences.beamer.branding==='text'&&<label>右上角文字<input aria-label="Beamer 标签" maxLength={24} value={preferences.beamer.tag} onChange={e=>setPreferences({...preferences,beamer:{...preferences.beamer,tag:e.target.value}})}/></label>}<label><input type="checkbox" checked={preferences.beamer.cover} onChange={e=>setPreferences({...preferences,beamer:{...preferences.beamer,cover:e.target.checked}})}/>包含封面</label><label><input type="checkbox" checked={preferences.beamer.footer} onChange={e=>setPreferences({...preferences,beamer:{...preferences.beamer,footer:e.target.checked}})}/>显示页脚与页码</label></>}</div><div className="modal-actions"><button className="secondary-button" onClick={()=>setExportOpen(false)}>取消</button><button className="primary-button" disabled={busy||!exportName.trim()} onClick={()=>{setExportOpen(false);void exportFile(exportSettings||preferences.exportFormat)}}>开始导出</button></div></Modal>}
    {unsavedOpen&&<Modal title="保存更改？" description={'“'+doc.metadata.title+'”尚未保存。'} onClose={()=>void decideSave('cancel')}><p>保存后再继续，或选择不保存本次更改。</p><div className="modal-actions"><button className="secondary-button" disabled={decisionSaving} onClick={()=>void decideSave('cancel')}>取消</button><button className="secondary-button" disabled={decisionSaving} onClick={()=>void decideSave('discard')}>不保存</button><button className="primary-button" disabled={decisionSaving} onClick={()=>void decideSave('save')}>{decisionSaving?'正在保存…':'保存'}</button></div></Modal>}
    {toast&&<div className="toast" role="status"><Check size={16}/><span>{toast}</span><button onClick={()=>setToast('')} aria-label="关闭通知"><X size={14}/></button></div>}
    {output&&<div className="output-card"><FileText size={17}/><span>{output.name}</span><button onClick={()=>void window.facetDesktop?.openOutput(output.token)}>打开</button><button onClick={()=>void window.facetDesktop?.revealOutput(output.token)}>显示位置</button><button onClick={()=>setOutput(null)}><X size={14}/></button></div>}
    <input hidden type="file" ref={fileInput} accept=".facet,.bak" onChange={async e=>{const f=e.target.files?.[0];if(f)await openData({bytes:Array.from(new Uint8Array(await f.arrayBuffer()))});e.target.value=''}}/>
    <input hidden type="file" ref={imageInput} accept="image/png,image/jpeg,image/webp" onChange={e=>{const files=e.target.files;if(files?.length)void importImages(files,'image');e.target.value=''}}/>
    <input hidden type="file" multiple ref={subfigureInput} accept="image/png,image/jpeg,image/webp" onChange={e=>{const files=e.target.files;if(files?.length)void importImages(files,'subfigure');e.target.value=''}}/>
    <input hidden type="file" ref={coverInput} accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void setCoverImage(f);e.target.value=''}}/>
  </div>
  function commitMath(){if(!math||!editor)return;const node={type:math.inline?'mathInline':'mathBlock',attrs:{id:uid(),latex:normalizeMath(math.latex)}}
    if(math.pos!=null){const old=editor.state.doc.nodeAt(math.pos);if(old){if(old.isInline===math.inline)editor.view.dispatch(editor.state.tr.replaceWith(math.pos,math.pos+old.nodeSize,editor.schema.nodeFromJSON(node)));else{announce('修改现有公式时请保持行内／独立类型；可重新插入另一种类型。');return}}}else insertBlock(node)
    setMath(null);editor.view.focus()
  }
}
function colorName(key:string){return ({darkblue:'学术蓝',harvardcrimson:'深红',emeraldgreen:'翡翠绿',royalpurple:'紫色',goldenyellow:'金黄',orange:'橙色',lightgray:'灰色'} as Record<string,string>)[key]||key}