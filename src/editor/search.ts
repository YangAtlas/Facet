import {Extension} from '@tiptap/core'
import {Plugin,PluginKey} from '@tiptap/pm/state'
import {Decoration,DecorationSet} from '@tiptap/pm/view'
import type {Node} from '@tiptap/pm/model'
type Range={from:number;to:number;block:number;code:boolean}
export type Match=Range&{parts:Range[]}
export function findMatches(doc:Node,query:string){
 const matches:Match[]=[];if(!query)return matches
 const groups:{id:string;text:string;ranges:(Range&{offset:number})[]}[]=[]
 doc.descendants((node,pos)=>{if(!node.isTextblock)return;const text=node.textBetween(0,node.content.size,'','\uFFFC'),id=node.attrs.id;let group=groups.at(-1);if(!group||!id||group.id!==id||!node.attrs.continuation){group={id,text:'',ranges:[]};groups.push(group)}group.ranges.push({from:pos+1,to:pos+1+text.length,block:pos,code:node.type.name==='codeBlock',offset:group.text.length});group.text+=text;return false})
 const needle=query.toLocaleLowerCase()
 for(const group of groups){const text=group.text.toLocaleLowerCase();let offset=0;while((offset=text.indexOf(needle,offset))!==-1){const end=offset+query.length,parts=group.ranges.filter(r=>r.offset<end&&r.offset+r.to-r.from>offset).map(r=>({...r,from:r.from+Math.max(0,offset-r.offset),to:r.from+Math.min(r.to-r.from,end-r.offset)}));if(parts.length)matches.push({...parts[0],to:parts.at(-1)!.to,parts});offset=end}}
 return matches
}
export const searchKey=new PluginKey<{query:string;index:number;matches:Match[]}>('facetSearch')
export const documentSearch=Extension.create({name:'documentSearch',addProseMirrorPlugins(){return [new Plugin({key:searchKey,state:{init:()=>({query:'',index:0,matches:[] as Match[]}),apply(tr,value){const meta=tr.getMeta(searchKey);if(!meta&&!tr.docChanged)return value;const query=meta?.query??value.query,matches=findMatches(tr.doc,query);return {query,matches,index:Math.min(Math.max(0,meta?.index??value.index),Math.max(0,matches.length-1))}}},props:{decorations(state){const data=searchKey.getState(state)!;const marks=data.matches.flatMap(m=>m.parts.filter(p=>!p.code).map(p=>Decoration.inline(p.from,p.to,{class:data.matches[data.index]===m?'search-match search-active':'search-match'})));state.doc.descendants((n,pos)=>{if(n.type.name==='codeBlock'&&data.query)marks.push(Decoration.node(pos,pos+n.nodeSize,{'data-search-query':data.query,class:data.matches[data.index]?.parts.some(p=>p.block===pos)?'search-code-active':''}));});return DecorationSet.create(state.doc,marks)}}})]}})
