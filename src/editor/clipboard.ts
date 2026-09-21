/** Normalize document clipboard HTML while retaining editable structure. */
export function normalizeClipboardHTML(source:string,matchStyle=false){
 const fragment=source.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i)?.[1]??source
 const doc=new DOMParser().parseFromString(fragment,'text/html')
 const length=(value:string|null)=>{if(!value||value.includes('%'))return 0;const n=parseFloat(value);return Number.isFinite(n)&&n>0?n*(/pt$/i.test(value)?96/72:/in$/i.test(value)?96:/cm$/i.test(value)?96/2.54:/mm$/i.test(value)?96/25.4:1):0}
 for(const table of Array.from(doc.querySelectorAll('table'))){
  if(!table.hasAttribute('data-table-style'))table.setAttribute('data-table-style','grid')
  const cols=Array.from(table.querySelectorAll(':scope > colgroup > col,:scope > col')).flatMap(c=>Array.from({length:Number(c.getAttribute('span'))||1},()=>length((c as HTMLElement).style.width||c.getAttribute('width'))))
  const rows=Array.from(table.rows).filter(r=>r.closest('table')===table),occupied:number[]=[],cells:{cell:HTMLTableCellElement;col:number;span:number}[]=[]
  rows.forEach((row,r)=>{let col=0;for(const cell of Array.from(row.cells)){while(occupied[col]>r)col++;const span=cell.colSpan||1;cells.push({cell,col,span});const widths=cell.getAttribute('colwidth')?.split(',').map(Number);const width=length(cell.style.width||cell.getAttribute('width'));for(let i=0;i<span;i++){if(widths&&widths[i]>0)cols[col+i]=widths[i];else if(!cols[col+i]&&width)cols[col+i]=width/span;occupied[col+i]=r+(cell.rowSpan||1)}col+=span}})
  for(const {cell,col,span} of cells){const widths=Array.from({length:span},(_,i)=>Math.max(1,Math.round(cols[col+i]||100)));cell.setAttribute('colwidth',widths.join(','));cell.removeAttribute('width');cell.removeAttribute('height');cell.removeAttribute('nowrap');cell.style.removeProperty('width');cell.style.removeProperty('height');cell.style.removeProperty('white-space')}
 }
 doc.querySelectorAll('script,style,meta,link').forEach(e=>e.remove())
 if(matchStyle)doc.querySelectorAll('[style],font').forEach(e=>{e.removeAttribute('style');if(e.tagName==='FONT')e.replaceWith(...Array.from(e.childNodes))})
 return doc.body.innerHTML
}
export function tabularTextHTML(source:string){
 const lines=source.replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n');if(lines.length<2||!lines.every(line=>line.includes('\t')))return null
 const rows=lines.map(line=>line.split('\t')),width=Math.max(...rows.map(r=>r.length));const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
 return '<table data-table-style="grid"><tbody>'+rows.map(row=>'<tr>'+Array.from({length:width},(_,i)=>'<td><p>'+escape(row[i]??'')+'</p></td>').join('')+'</tr>').join('')+'</tbody></table>'
}

export function hasEditableClipboardHTML(html:string){const doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('style,script').forEach(e=>e.remove());return !!doc.querySelector('table,ul,ol')||!!doc.body.textContent?.trim()}
