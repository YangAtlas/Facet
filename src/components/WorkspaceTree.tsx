import {useEffect,useState} from 'react'
import {ChevronDown,ChevronRight,Folder,FolderOpen,FileText,RefreshCw} from 'lucide-react'
type Entry={name:string;path:string;kind:'folder'|'file'}
type Props={refresh:number;currentPath:string;onOpen:(data:any)=>void;onRoot:(name:string)=>void;onError:(message:string)=>void}
export function WorkspaceTree({refresh,currentPath,onOpen,onRoot,onError}:Props){
 const [root,setRoot]=useState(''),[name,setName]=useState(''),[entries,setEntries]=useState<Entry[]>([]),[generation,setGeneration]=useState(0)
 const accept=(data:any)=>{if(data?.error){onError(data.error);return}if(data){setRoot(data.root);setName(data.name);setEntries(data.entries);onRoot(data.name||'本机文档')}}
 useEffect(()=>{void window.facetDesktop?.listFolder?.().then(accept).catch(e=>onError(String(e)))},[refresh,generation])
 async function choose(){try{accept(await window.facetDesktop?.chooseFolder());setGeneration(n=>n+1)}catch(e){onError(String(e))}}
 function item(entry:Entry,level=0){return <TreeEntry key={entry.path} entry={entry} level={level} generation={refresh+generation} currentPath={currentPath} root={root} onOpen={onOpen} onError={onError}/>}
 return <section className="workspace-files"><div className="tree-heading"><button title={root||'选择文件夹'} onClick={()=>void choose()}><FolderOpen size={15}/><span>{name||'打开文件夹'}</span></button><button className="icon-button" aria-label="刷新文件树" onClick={()=>setGeneration(n=>n+1)}><RefreshCw size={13}/></button></div>{root?<div role="tree" aria-label="文件树">{entries.map(e=>item(e))}{!entries.length&&<p className="muted-empty">此文件夹中还没有 Facet 文档。</p>}</div>:<p className="muted-empty">{window.facetDesktop?'选择文件夹，浏览其中的文档。':'在桌面版打开文件夹，浏览本地文档。'}</p>}</section>
}
function TreeEntry({entry,level,generation,currentPath,root,onOpen,onError}: {entry:Entry;level:number;generation:number;currentPath:string;root:string;onOpen:(data:any)=>void;onError:(s:string)=>void}){
 const [expanded,setExpanded]=useState(false),[children,setChildren]=useState<Entry[]>([])
 useEffect(()=>{if(expanded)void window.facetDesktop?.listFolder(entry.path).then(data=>{if(data.error)onError(data.error);else setChildren(data.entries)})},[expanded,generation,entry.path])
 const active=currentPath.replace(/\\/g,'/')===(root+'/'+entry.path).replace(/\\/g,'/')
 return <div><button role="treeitem" aria-expanded={entry.kind==='folder'?expanded:undefined} aria-selected={active} className={'tree-entry'+(active?' active':'')} style={{paddingLeft:8+level*14}} title={entry.name} onClick={()=>{if(entry.kind==='folder')setExpanded(!expanded);else void window.facetDesktop?.openWorkspaceFile(entry.path).then(onOpen).catch(e=>onError(String(e)))}}>{entry.kind==='folder'?expanded?<ChevronDown size={12}/>:<ChevronRight size={12}/>:<span className="tree-indent"/>}{entry.kind==='folder'?<Folder size={14}/>:<FileText size={14}/>}<span>{entry.name}</span></button>{expanded&&<div role="group">{children.map(child=><TreeEntry key={child.path} entry={child} level={level+1} generation={generation} currentPath={currentPath} root={root} onOpen={onOpen} onError={onError}/>)}</div>}</div>
}
