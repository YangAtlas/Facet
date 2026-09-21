import {Extension} from '@tiptap/core'
import {Plugin,TextSelection,Selection} from '@tiptap/pm/state'
export const pairs:Record<string,string>={'(':')','[':']','{':'}','（':'）','【':'】','《':'》','「':'」','『':'』','“':'”','‘':'’','"':'"',"'":"'",'$':'$','\x60':'\x60'}
export function pairEdit(text:string,from:number,to:number,key:string){
 const before=text.slice(0,from),after=text.slice(to),close=pairs[key]
 if(key==='Backspace'&&from===to&&before.length>0&&after.length>0&&pairs[before.at(-1)||'']===after[0])return {from:from-1,to:to+1,insert:'',anchor:from-1,head:from-1}
 if(key==='$'&&from===to&&before.endsWith('$')&&!before.endsWith('$$')&&after.startsWith('$'))return {from,to,insert:'$$',anchor:from+1,head:from+1}
 if(from===to&&Object.values(pairs).includes(key)&&after.startsWith(key))return {from,to,insert:'',anchor:from+1,head:from+1}
 if(!close||before.endsWith('\\')||((key==="'"||key==='"')&&/[\p{L}\p{N}]$/u.test(before)))return null
 return {from,to,insert:key+text.slice(from,to)+close,anchor:from+1,head:to+1}
}
export function pairTextarea(event:KeyboardEvent,area:HTMLTextAreaElement,commit?:(value:string)=>void){
 if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return false
 const edit=pairEdit(area.value,area.selectionStart,area.selectionEnd,event.key);if(!edit)return false
 event.preventDefault();area.setRangeText(edit.insert,edit.from,edit.to,'end');area.setSelectionRange(edit.anchor,edit.head)
 if(commit){commit(area.value);requestAnimationFrame(()=>area.setSelectionRange(edit.anchor,edit.head))}else area.dispatchEvent(new Event('input',{bubbles:true}))
 return true
}
export const pairedInput=Extension.create({name:'pairedInput',priority:1100,addProseMirrorPlugins(){return [new Plugin({props:{
 handleTextInput(view,from,to,text){
  if(view.composing||text.length!==1)return false
  const $pos=view.state.doc.resolve(from);if(!$pos.parent.isTextblock||$pos.parent.type.name==='codeBlock')return false
  const source=$pos.parent.textBetween(0,$pos.parent.content.size,'','\uFFFC'),offset=$pos.parentOffset,start=$pos.start()
  const before=source.slice(0,offset),after=source.slice(offset)
  if(text==='$'&&after.startsWith('$')){
   if(/^\$\$[\s\S]+\$$/.test(before)&&!before.endsWith('$$')){const node=view.state.schema.nodes.mathBlock.create({latex:before.slice(2,-1)}),pos=$pos.before(),tr=view.state.tr.replaceWith(pos,$pos.after(),node);tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos+node.nodeSize,tr.doc.content.size))));view.dispatch(tr);return true}
   const match=before.match(/(?:^|[^\\$])\$([^$\n]+)$/)
   if(match){const pos=from-match[1].length-1,node=view.state.schema.nodes.mathInline.create({latex:match[1]}),tr=view.state.tr.replaceWith(pos,to+1,node);tr.setSelection(TextSelection.create(tr.doc,pos+1));view.dispatch(tr);return true}
  }
  const edit=pairEdit(source,offset,to-start,text);if(!edit)return false
  let tr=view.state.tr
  if(from!==to&&pairs[text]){tr.insertText(pairs[text],to);tr.insertText(text,from)}else if(edit.insert||edit.from!==edit.to)tr.insertText(edit.insert,start+edit.from,start+edit.to)
  tr.setSelection(TextSelection.create(tr.doc,start+edit.anchor,start+edit.head));view.dispatch(tr);return true
 },
 handleKeyDown(view,event){if(event.key!=='Backspace'||event.isComposing)return false;const {$from,empty}=view.state.selection;if(!empty||!$from.parent.isTextblock)return false;const edit=pairEdit($from.parent.textBetween(0,$from.parent.content.size,'','\uFFFC'),$from.parentOffset,$from.parentOffset,'Backspace');if(!edit)return false;event.preventDefault();view.dispatch(view.state.tr.delete($from.start()+edit.from,$from.start()+edit.to));return true},
 handleDOMEvents:{compositionend(view,event){const key=(event as CompositionEvent).data;if(!pairs[key]||key.length!==1)return false;setTimeout(()=>{const {$from,empty}=view.state.selection;if(empty&&$from.parent.textBetween(0,$from.parentOffset).endsWith(key)&&$from.parent.textBetween($from.parentOffset,$from.parent.content.size).charAt(0)!==pairs[key]){const pos=$from.pos;const tr=view.state.tr.insertText(pairs[key],pos);view.dispatch(tr.setSelection(TextSelection.create(tr.doc,pos))) }},0);return false}}
}})]}})
