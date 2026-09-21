import {Extension} from '@tiptap/core'
import {Plugin} from '@tiptap/pm/state'
import {TableMap} from '@tiptap/pm/tables'
export const tableResize=Extension.create({name:'facetTableResize',addProseMirrorPlugins(){return [new Plugin({view(view){
  let cleanup=()=>{}
  const edge=(event:MouseEvent)=>{const cell=(event.target as HTMLElement).closest('td,th') as HTMLTableCellElement|null;if(!cell||!view.dom.contains(cell))return null;const rect=cell.getBoundingClientRect();return Math.abs(event.clientX-rect.right)<7?cell:null}
  const move=(event:MouseEvent)=>{view.dom.classList.toggle('resize-cursor',!!edge(event))}
  const down=(event:MouseEvent)=>{
    const cell=edge(event);if(!cell||event.button!==0)return
    const table=cell.closest('table')!,id=table.dataset.id;if(!id)return
    let pos=-1;view.state.doc.descendants((node,p)=>{if(node.type.name==='table'&&node.attrs.id===id&&view.nodeDOM(p)?.contains(cell))pos=p})
    if(pos<0)return
    const node=view.state.doc.nodeAt(pos)!,map=TableMap.get(node),cellPos=view.posAtDOM(cell,0)-pos-1
    let col=0;try{col=map.findCell(cellPos-1).right-1}catch{return}
    if(col>=map.width-1)return
    event.preventDefault();cleanup()
    const scale=table.getBoundingClientRect().width/table.offsetWidth
    const widths=Array.from(table.querySelectorAll('col')).map(c=>c.getBoundingClientRect().width/scale)
    const start=event.clientX,total=widths[col]+widths[col+1]
    const resized=(x:number)=>{const next=[...widths];const minimum=Math.min(40,total/3);next[col]=Math.max(minimum,Math.min(total-minimum,Math.round(widths[col]+(x-start)/scale)));next[col+1]=total-next[col];return next}
    const cols=Array.from(table.querySelectorAll('col')),original=cols.map(c=>c.style.width)
    const preview=(e:MouseEvent)=>{const next=resized(e.clientX);cols.forEach((c,i)=>{c.style.width=next[i]/next.reduce((a,b)=>a+b,0)*100+'%'})}
    const up=(end:MouseEvent)=>{cleanup();const next=resized(end.clientX);const tr=view.state.tr;tr.doc.descendants((t,p)=>{if(t.type.name!=='table'||t.attrs.id!==id)return;const m=TableMap.get(t),seen=new Set<number>();for(let r=0;r<m.height;r++)for(let c=0;c<m.width;c++){const offset=m.map[r*m.width+c];if(seen.has(offset))continue;seen.add(offset);const n=t.nodeAt(offset)!;tr.setNodeMarkup(p+1+offset,undefined,{...n.attrs,colwidth:next.slice(c,c+n.attrs.colspan)})}return false});view.dispatch(tr)}
    window.addEventListener('mousemove',preview);window.addEventListener('mouseup',up,{once:true});window.addEventListener('blur',cancel);function cancel(){cleanup()}cleanup=()=>{window.removeEventListener('mousemove',preview);window.removeEventListener('mouseup',up);window.removeEventListener('blur',cancel);cols.forEach((c,i)=>{c.style.width=original[i]});view.dom.classList.remove('resize-cursor')}
  }
  view.dom.addEventListener('mousemove',move);view.dom.addEventListener('mousedown',down)
  return {destroy(){cleanup();view.dom.removeEventListener('mousemove',move);view.dom.removeEventListener('mousedown',down)}}
}})]}})
