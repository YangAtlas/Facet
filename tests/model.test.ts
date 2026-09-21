import {describe,it,expect} from 'vitest'
import {canonicalize,makeDocument,p,uid,validateDocument} from '../src/core/model'
import {encodeDocument,decodeDocument} from '../src/core/archive'
import JSZip from 'jszip'
import {latexArchive} from '../src/core/latex'
import {normalizeMath,renderMath} from '../src/core/math'
describe('document boundaries',()=>{
 it('coalesces paragraph and callout continuations, preserving one logical node',()=>{const id=uid(),child=uid();const pages=[{type:'page',content:[{type:'callout',attrs:{id},content:[{type:'paragraph',attrs:{id:child},content:[{type:'text',text:'第一'}]}]}]},{type:'page',content:[{type:'callout',attrs:{id,continuation:true},content:[{type:'paragraph',attrs:{id:child,continuation:true},content:[{type:'text',text:'第二'}]}]}]}];const result=canonicalize(pages);expect(result).toHaveLength(1);expect(result[0].content).toHaveLength(1);expect(result[0].content![0].content!.map(n=>n.text).join('')).toBe('第一第二');expect(result[0].attrs?.continuation).toBeUndefined()})
 it('does not duplicate repeated table headers',()=>{const id=uid();const row={type:'tableRow',attrs:{id:uid()},content:[{type:'tableHeader',content:[p('标题')]}]};const result=canonicalize([{type:'table',attrs:{id},content:[row]},{type:'table',attrs:{id,continuation:true},content:[{...row,attrs:{...row.attrs,layoutRepeat:true}},{type:'tableRow',content:[{type:'tableCell',content:[p('值')]}]}]}]);expect(result[0].content).toHaveLength(2)})
 it('round trips portable images and content',async()=>{const d=makeDocument(),id=uid();d.assets[id]={name:'tiny.png',mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='};d.content.push({type:'image',attrs:{id:uid(),assetId:id,src:`asset:${id}`,width:100}});expect(await decodeDocument(await encodeDocument(d))).toEqual(d)})
 it('rejects future formats and unknown nodes instead of stripping them',()=>{expect(()=>validateDocument({...makeDocument(),version:2})).toThrow();const d=makeDocument();d.content.push({type:'futureWidget'});expect(()=>validateDocument(d)).toThrow('未知组件')})
 it('normalizes math and rejects executable TeX',()=>{expect(normalizeMath('$$\\frac{1}{2}$$')).toBe('\\frac{1}{2}');expect(renderMath('x^2')).toContain('katex');expect(()=>renderMath('\\input{secret}')).toThrow();expect(()=>renderMath('\\unknown')).toThrow()})
})

it('exports double columns, subfigure captions and table column alignment as valid TeX commands',async()=>{
 const d=makeDocument(),asset=uid();d.assets[asset]={name:'figure.png',mime:'image/png',data:'aGVsbG8='}
 const table={type:'table',attrs:{id:uid()},content:[{type:'tableRow',content:[{type:'tableHeader',attrs:{textAlign:'right'},content:[p('数值')]}]}]}
 d.content=[
  {type:'columns',attrs:{id:uid(),ratio:65,gap:24},content:[
   {type:'column',attrs:{id:uid()},content:[p('左栏')]},
   {type:'column',attrs:{id:uid()},content:[table]},
  ]},
  {type:'subfigure',attrs:{id:uid(),columns:1,items:[{assetId:asset,caption:'重建结果'}]}},
 ]
 validateDocument(d);expect(await decodeDocument(await encodeDocument(d))).toEqual(d)
 const zip=await JSZip.loadAsync(await latexArchive(d)),tex=await zip.file('main.tex')!.async('string')
 expect(tex).toContain('\\begin{minipage}')
 expect(tex).toContain('\\begin{tabular}')
 expect(tex).toContain('\\raggedleft\\arraybackslash')
 expect(tex).toContain('重建结果')
 expect(tex).not.toMatch(/[\x08\x0b\x0c\x0d]/)
})

it('exports grid table rules and defines custom component and theme colors',async()=>{
 const d=makeDocument();d.page.accent='#224466'
 d.content=[{type:'callout',attrs:{id:uid(),variant:'custom',color:'#337799',icon:'star',title:'Custom'},content:[p('Text')]},{type:'table',attrs:{id:uid(),tableStyle:'grid'},content:[{type:'tableRow',attrs:{id:uid()},content:[{type:'tableHeader',attrs:{id:uid()},content:[p('Header')]}]},{type:'tableRow',attrs:{id:uid()},content:[{type:'tableCell',attrs:{id:uid()},content:[p('Value')]}]}]}]
 const zip=await JSZip.loadAsync(await latexArchive(d)),tex=await zip.file('main.tex')!.async('string')
 expect(tex).toContain('\\definecolor{facetcolor0}{HTML}{224466}')
 expect(tex).toContain('\\definecolor{facetcolor1}{HTML}{337799}')
 expect(tex).toContain('\\guidetheme{facetcolor0}')
 expect(tex).toContain('\\rowcolor{facetcolor0}')
 expect(tex).toContain('\\hline')
 expect(tex).toContain('Header \\\\')
})

it('persists landscape pages and accepts legacy portrait documents',async()=>{
 const landscape=makeDocument(false,'landscape')
 expect(landscape.page.orientation).toBe('landscape')
 expect(await decodeDocument(await encodeDocument(landscape))).toEqual(landscape)
 const zip=await JSZip.loadAsync(await latexArchive(landscape)),tex=await zip.file('main.tex')!.async('string')
 expect(tex).toContain('paperwidth=320mm,paperheight=180mm')
 const legacy=makeDocument();delete legacy.page.orientation
 expect(()=>validateDocument(legacy)).not.toThrow()
 expect(await decodeDocument(await encodeDocument(legacy))).toEqual(legacy)
 expect(()=>validateDocument({...legacy,page:{...legacy.page,orientation:'unknown'}})).toThrow('页面方向')
})

it('WebP image assets survive archive round trips',async()=>{
 const d=makeDocument(),id=uid();d.assets[id]={name:'figure.webp',mime:'image/webp',data:'UklGRg=='};d.content=[{type:'image',attrs:{id:uid(),assetId:id,src:'asset:'+id}}];expect(await decodeDocument(await encodeDocument(d))).toEqual(d)
})
