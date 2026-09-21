import {TableView} from '@tiptap/extension-table'
import type {Node} from '@tiptap/pm/model'
import {TableMap} from '@tiptap/pm/tables'
export function tableColumnWeights(node:Node){
 const map=TableMap.get(node),widths=Array<number>(map.width).fill(0),seen=new Set<number>()
 for(let row=0;row<map.height;row++)for(let col=0;col<map.width;col++){const offset=map.map[row*map.width+col];if(seen.has(offset))continue;seen.add(offset);const cell=node.nodeAt(offset);for(let i=0;i<(cell?.attrs.colspan||1);i++){const width=Number(cell?.attrs.colwidth?.[i]);if(Number.isFinite(width)&&width>0&&!widths[col+i])widths[col+i]=width}}
 return widths.map(w=>w||100)
}

export class ResponsiveTableView extends TableView {
 constructor(...args:ConstructorParameters<typeof TableView>){super(...args);this.fit()}
 fit(){const widths=tableColumnWeights(this.node),sum=widths.reduce((a,b)=>a+b,0);this.table.style.width='100%';this.table.style.minWidth='0';this.table.dataset.id=this.node.attrs.id||'';this.table.dataset.tableStyle=this.node.attrs.tableStyle||'academic';this.colgroup.replaceChildren(...widths.map(w=>{const col=document.createElement('col');col.style.width=w/sum*100+'%';return col}))}
 update(node:Node){if(!super.update(node))return false;this.fit();return true}
}
