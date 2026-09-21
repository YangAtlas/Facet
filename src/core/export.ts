import type { Editor } from '@tiptap/core'
import { pageFormat, type PageOrientation } from './model'
import { esc } from '../editor/extensions'
export async function pageSnapshot(editor:Editor,title:string) {
  await document.fonts.ready
  await Promise.all(Array.from(editor.view.dom.querySelectorAll('img')).map(i=>i.decode()))
  const root=editor.view.dom.cloneNode(true) as HTMLElement
  root.classList.add('document-content');root.removeAttribute('contenteditable');root.removeAttribute('tabindex')
  root.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'))
  root.querySelectorAll('.ProseMirror-selectednode').forEach(n=>n.classList.remove('ProseMirror-selectednode'))
  root.querySelectorAll('.ProseMirror-gapcursor,.ProseMirror-widget,.column-resizer').forEach(n=>n.remove())
  root.querySelectorAll('.code-language-bar').forEach(bar=>{bar.textContent=(bar.parentElement as HTMLElement).dataset.language||'text'})
  root.querySelectorAll('input[type=checkbox]').forEach(n=>{const input=n as HTMLInputElement;if(input.checked)input.setAttribute('checked','')})
  const css=await snapshotStyles()
  const computed=getComputedStyle(editor.view.dom)
  const format=pageFormat({orientation:root.querySelector<HTMLElement>('.facet-page')?.dataset.orientation as PageOrientation})
  const print=`@page{size:${format.width}mm ${format.height}mm;margin:0}html,body{margin:0!important;padding:0!important;background:white!important}body{display:block!important;overflow:visible!important}.export-root{--accent:${computed.getPropertyValue('--accent')};--content-height:${computed.getPropertyValue('--content-height')};width:${format.width}mm!important;transform:none!important;zoom:1!important}.export-root .facet-page{box-shadow:none!important;margin:0!important;border:0!important;break-after:page;break-inside:avoid;overflow:hidden}.export-root .facet-page:last-child{break-after:auto}.export-root .code-editor-node>textarea{display:none!important}.manual-page-break{visibility:hidden!important}.ProseMirror-selectednode{outline:none!important}.facet-page{outline:none!important}.export-root .page-content{outline:none!important}`
  root.className+=' export-root'
  return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"><title>${esc(title)}</title><style>${css}\n${print}</style></head><body>${root.outerHTML}</body></html>`
}
export function download(bytes:Uint8Array,name:string,mime:string){const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export async function snapshotStyles(){
  let css=Array.from(document.styleSheets).map(sheet=>{try{return Array.from(sheet.cssRules).map(x=>x.cssText).join('\n')}catch{return ''}}).join('\n')
  // Vite development serves fonts as URLs; packages inline them in production.
  const urls=[...new Set(Array.from(css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)).map(m=>m[1]).filter(x=>!x.startsWith('data:')&&!x.startsWith('#')))]
  for(const url of urls){const response=await fetch(new URL(url,document.baseURI));if(!response.ok)throw new Error('字体资源加载失败，无法导出');const blob=await response.blob();const data=await new Promise<string>(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.readAsDataURL(blob)});css=css.split(url).join(data)}
  return css
}
