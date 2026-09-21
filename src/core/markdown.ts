import {p,uid,type Block} from './model'
import {normalizeLink} from './links'
export function inlineMarkdown(text:string):Block[]{
  const out:Block[]=[];const pattern=/(?<!\\)\$([^$\n]+)\$|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\x60([^\x60]+)\x60/g;let last=0
  for(const m of text.matchAll(pattern)){if(m.index!>last)out.push({type:'text',text:text.slice(last,m.index)});if(m[1])out.push({type:'mathInline',attrs:{latex:m[1]}});else if(m[2])out.push({type:'text',text:m[2],marks:normalizeLink(m[3])?[{type:'link',attrs:{href:normalizeLink(m[3])}}]:[]});else out.push({type:'text',text:m[4]||m[5],marks:[{type:m[4]?'bold':'code'}]});last=m.index!+m[0].length}
  if(last<text.length)out.push({type:'text',text:text.slice(last)});return out
}
export function parseMarkdown(source:string):Block[]{
  const lines=source.replace(/\r\n?/g,'\n').split('\n'),out:Block[]=[]
  const block=(type:string,attrs:any={},content?:Block[]):Block=>({type,attrs:{id:uid(),...attrs},...(content?{content}:{})})
  for(let i=0;i<lines.length;i++){
    const line=lines[i];let m:RegExpMatchArray|null
    if((m=line.match(/^\s*\x60{3}(.*)$/))){const body=[];while(++i<lines.length&&!/^\s*\x60{3}\s*$/.test(lines[i]))body.push(lines[i]);out.push(block('codeBlock',{language:m[1].trim()||'text'},body.length?[{type:'text',text:body.join('\n')}]:[]));continue}
    if(line.trim().startsWith('$$')){let formula=line.trim().slice(2),end=i,closed=formula.endsWith('$$');if(closed)formula=formula.slice(0,-2);else{while(end+1<lines.length){const next=lines[++end];if(next.trim().endsWith('$$')){formula+='\n'+next.trim().slice(0,-2);closed=true;break}formula+='\n'+next}}if(closed){i=end;out.push(block('mathBlock',{latex:formula.trim()}));continue}}
    if((m=line.match(/^(#{1,3})\s+(.*)$/)))out.push(block('heading',{level:m[1].length},inlineMarkdown(m[2])))
    else if((m=line.match(/^>\s?(.*)$/)))out.push(block('blockquote',{},[{...p(),content:inlineMarkdown(m[1])}]))
    else if((m=line.match(/^\s*([-*]|\d+\.)\s+(.*)$/))){const type=/\d/.test(m[1])?'orderedList':'bulletList',item=block('listItem',{},[{...p(),content:inlineMarkdown(m[2])}]);if(out.at(-1)?.type===type)out.at(-1)!.content!.push(item);else out.push(block(type,{},[item]))}
    else out.push({...p(),content:inlineMarkdown(line)})
  }
  return out.length?out:[p()]
}
