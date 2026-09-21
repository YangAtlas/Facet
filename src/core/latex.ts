import JSZip from 'jszip'
import guide from '../../Tex-Template/guide.sty?raw'
import license from '../../Tex-Template/LICENSE?raw'
import { renderMath } from './math'
import { pageFormat, accentValue, variants, semanticItems, type Block, type FacetDocument } from './model'
export const texEscape=(text:string)=>text.replace(/[\\{}$&#%_^~]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','%':'\\%','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[c]!))
export async function latexArchive(doc:FacetDocument):Promise<Uint8Array> {
  const zip=new JSZip();let codeIndex=0,insideColumn=false
  const customColors=new Map<string,string>()
  const texColor=(value:string)=>{if(!/^#[0-9a-f]{6}$/i.test(value))return value;const hex=value.slice(1).toUpperCase();if(!customColors.has(hex))customColors.set(hex,`facetcolor${customColors.size}`);return customColors.get(hex)!}
  const theme=texColor(doc.page.accent)
  const tableColor=texColor(accentValue(doc.page.accent))
  const inline=(n:Block):string=>{
    if(n.type==='mathInline'){renderMath(n.attrs?.latex??'');return `\\(${n.attrs?.latex??''}\\)`}
    if(n.type==='badge')return `\\badge[${texColor(n.attrs?.color||'darkblue')}]{${texEscape(n.attrs?.text||'')}}`
    if(n.type==='inlineIcon')return `\\icon[${texColor(n.attrs?.color||'darkblue')}]{${texEscape(n.attrs?.icon||'star')}}`
    if(n.type==='hardBreak')return '\\\\ '
    let text=texEscape(n.text??'')
    for(const m of n.marks??[]) {
      const commands:Record<string,string>={bold:'textbf',italic:'textit',code:'texttt',underline:'underline',highlight:'highlight'}
      if(commands[m.type])text=`\\${commands[m.type]}{${text}}`
      if(m.type==='semanticStyle')text=`\\${({theme:'themecolor',important:'important',success:'success',muted:'muted'} as Record<string,string>)[m.attrs?.kind]||'important'}{${text}}`
      if(m.type==='link'&&/^(https?:|mailto:)/.test(m.attrs?.href??''))text=`\\href{${texEscape(m.attrs?.href)}}{${text}}`
    }
    return text
  }
  const content=(n:Block)=> (n.content??[]).map(inline).join('')
  const children=(n:Block):string=>(n.content??[]).map(block).join('\n')
  const block=(n:Block):string=>{
    const a=n.attrs??{}
    switch(n.type){
      case 'part':return `\\clearpage\\thispagestyle{plain}\\vspace*{\\fill}\\begin{center}\\Huge\\bfseries ${content(n)}\\end{center}\\vspace*{\\fill}\\clearpage`
      case 'paragraph':return `${content(n)}\n`
      case 'heading':{const command=['section','subsection','subsubsection'][(a.level??1)-1];return `\\${command}${a.numbered?'':'*'}{${a.icon?`\\icon{${texEscape(a.icon)}}\\enspace `:''}${content(n)}}${!a.numbered&&a.toc!==false?`\n\\addcontentsline{toc}{${command}}{${content(n)}}`:''}`}
      case 'documentTitle':return '\\maketitle'
      case 'tableOfContents':return '\\tableofcontents'
      case 'pageBreak':return '\\clearpage'
      case 'horizontalRule':return '\\par\\noindent\\rule{\\linewidth}{0.4pt}\\par'
      case 'blockquote':return `\\begin{quote}\n${children(n)}\n\\end{quote}`
      case 'bulletList':case 'taskList':case 'semanticList':return `\\begin{itemize}\n${children(n)}\n\\end{itemize}`
      case 'orderedList':return `\\begin{enumerate}\n${children(n)}\n\\end{enumerate}`
      case 'listItem':return `\\item ${children(n)}`
      case 'taskItem':return `\\item[$${a.checked?'\\boxtimes':'\\square'}$] ${children(n)}`
      case 'semanticItem':{const s=semanticItems.find(x=>x.key===a.kind)??semanticItems[0];return `\\${s.key}item ${children(n)}`}
      case 'callout':{
        if(a.variant==='highlight')return `\\begin{highlightbox}\n${children(n)}\n\\end{highlightbox}`
        const v=variants[a.variant]??variants.info
        return `\\begin{guidebox}[${texColor(a.color||v.color)}]{${a.icon||v.icon}}{${texEscape(a.title??v.title)}}\n${children(n)}\n\\end{guidebox}`
      }
      case 'mathBlock':renderMath(a.latex??'',true);return `\\[\n${a.latex??''}\n\\]`
      case 'codeBlock':{const file=`code/code-${++codeIndex}.txt`;zip.file(file,(n.content??[]).map(x=>x.text??'').join(''));return `\\VerbatimInput[breaklines=true,breakanywhere=true,fontsize=\\small]{${file}}`}
      case 'image':{const asset=doc.assets[a.assetId];if(!asset)return '';const file=`assets/${a.assetId}.${asset.mime==='image/png'?'png':'jpg'}`;zip.file(file,asset.data,{base64:true});return `\\begin{center}\n\\includegraphics[width=${Math.max(.1,Math.min(1,(a.width??100)/100)).toFixed(2)}\\linewidth,height=.8\\textheight,keepaspectratio]{${file}}\n${a.caption?`\\par ${texEscape(a.caption)}`:''}\n\\end{center}`}
      case 'columns':{const ratio=Math.max(20,Math.min(80,Number(a.ratio)||50))/100,gap=Math.max(0,Number(a.gap??24))*.75;const previous=insideColumn;insideColumn=true;const parts=(n.content??[]).map((column,i)=>`\\begin{minipage}[t]{\\dimexpr ${(i===0?ratio:1-ratio).toFixed(3)}\\linewidth-${(gap*(i===0?ratio:1-ratio)).toFixed(2)}pt\\relax}\n\\vspace{0pt}\n${children(column)}\n\\end{minipage}`);insideColumn=previous;return `\\par\\noindent\n${parts.join(`%\n\\hspace{${gap.toFixed(2)}pt}%\n`)}\n\\par`}
      case 'subfigure':{const count=Math.max(1,Math.min(4,Number(a.columns)||2)),width=Math.max(.2,Math.min(1,Number(a.width??100)/100)),items=a.items??[];const rows=[];for(let i=0;i<items.length;i+=count)rows.push(items.slice(i,i+count).map((item:any,j:number)=>`\\begin{minipage}[t]{${((width/count)*.95).toFixed(3)}\\linewidth}\n${block({type:'image',attrs:{...item,width:100,caption:item.caption||`(${String.fromCharCode(97+i+j)})`}})}\n\\end{minipage}`).join('\\hfill\n'));return `\\begin{center}\n${rows.join('\\par\\medskip\n')}\n\\end{center}`}
      case 'table':{
        const columns=n.content?.[0]?.content??[],count=columns.length||1,grid=a.tableStyle==='grid'
        const specs=columns.map(cell=>`>{${({left:'\\raggedright',center:'\\centering',right:'\\raggedleft'} as Record<string,string>)[cell.attrs?.textAlign||'left']}\\arraybackslash}p{${(.86/count).toFixed(3)}\\linewidth}`)
        const spec=grid?'|'+specs.join('|')+'|':specs.join('')
        const rows=(n.content??[]).map((row,index)=>{
          const header=(row.content??[]).every(cell=>cell.type==='tableHeader')
          const prefix=grid?(header?`\\rowcolor{${tableColor}}`:index%2===0?`\\rowcolor{${tableColor}!6}`:''):''
          return prefix+(row.content??[]).map(cell=>(grid&&header?'\\color{white}\\bfseries ':'')+children(cell).trim()).join(' & ')+' \\\\'
        })
        const env=insideColumn?'tabular':'longtable',rule=grid?'\\hline':'\\midrule'
        return `\\begin{${env}}{${spec}}\n${grid?'\\hline':'\\toprule'}\n${rows[0]??''}\n${rule}\n${insideColumn?'':'\\endhead\n'}${rows.slice(1).join(grid?'\n\\hline\n':'\n')}\n${grid?'\\hline':'\\bottomrule'}\n\\end{${env}}`
      }
      default:throw new Error(`暂不支持导出组件：${n.type}`)
    }
  }
  const m=doc.metadata,format=pageFormat(doc.page)
  const body=doc.content.map(block).join('\n\n')
  zip.file('main.tex',`% Generated by Facet. Compile with XeLaTeX twice.\n\\documentclass[11pt,a4paper,fontset=fandol]{ctexart}\n\\usepackage{guide}\n\\usepackage{longtable,fvextra,array,colortbl}\n${Array.from(customColors,([hex,name])=>`\\definecolor{${name}}{HTML}{${hex}}`).join('\n')}\n\\geometry{paperwidth=${format.width}mm,paperheight=${format.height}mm,margin=${doc.page.margin}mm}\n\\guidetheme{${theme}}\n\\title{${texEscape(m.title)}}\n\\subtitle{${texEscape(m.subtitle)}}\n\\author{${texEscape(m.author)}}\n\\institute{${texEscape(m.institute)}}\n\\date{${texEscape(m.date)}}\n\\guideheader{${texEscape(doc.page.header)}}{${texEscape(doc.page.footer)}}\n\\begin{document}\n${body}\n\\end{document}\n`)
  zip.file('guide.sty',guide);zip.file('LICENSE',license)
  zip.file('README.txt','使用 XeLaTeX 编译 main.tex 两次。需要 ctex、Fandol、fontawesome5、tcolorbox、fvextra 和 longtable 等宏包。\n这是独立的 LaTeX 排版版本，分页可能不同于 Facet 的所见即所得 PDF。')
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'})
}
