export type ExportFormat = 'pdf' | 'beamer' | 'latex'
export type BeamerSettings = { branding:'zju'|'text'|'none'; tag:string; cover:boolean; footer:boolean }
export type Preferences = { orientation:'portrait'|'landscape'; fit:boolean; left:boolean; right:boolean; beamer:BeamerSettings }
export const defaultPreferences:Preferences = {orientation:'portrait',fit:true,left:true,right:true,beamer:{branding:'zju',tag:'FACET',cover:true,footer:true}}
export function readPreferences():Preferences {
  try {
    const value=JSON.parse(localStorage.getItem('facet-preferences')||'{}'),b=value.beamer||{}
    return {orientation:value.orientation==='landscape'?'landscape':'portrait',fit:typeof value.fit==='boolean'?value.fit:true,left:typeof value.left==='boolean'?value.left:true,right:typeof value.right==='boolean'?value.right:true,beamer:{branding:['zju','text','none'].includes(b.branding)?b.branding:'zju',tag:typeof b.tag==='string'?b.tag.slice(0,24):'FACET',cover:b.cover!==false,footer:b.footer!==false}}
  }catch{return structuredClone(defaultPreferences)}
}
