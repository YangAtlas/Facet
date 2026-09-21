import katex from 'katex'
export function normalizeMath(value: string) {
  const text = value.trim()
  for(const [start,end] of [['$$','$$'],['\\[','\\]'],['\\(','\\)'],['$','$']]) if(text.startsWith(start)&&text.endsWith(end)&&text.length>=start.length+end.length) return text.slice(start.length,-end.length).trim()
  return text
}
export function renderMath(latex: string, displayMode = false) {
  if(/\\(?:def|gdef|edef|xdef|newcommand|renewcommand|input|include|write|read|openin|openout|catcode|usepackage|documentclass|href|url|html\w*|includegraphics|csname)\b/.test(latex)) throw new Error('仅支持数学表达式，不支持宏定义、链接或外部资源命令。')
  return katex.renderToString(latex || '\\phantom{x}', { displayMode, throwOnError:true, trust:false, strict:'warn', maxExpand:1000, output:'htmlAndMathml' })
}
