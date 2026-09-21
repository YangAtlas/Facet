import { test,expect } from '@playwright/test'
import { mkdir,writeFile } from 'node:fs/promises'
test('usage guide covers every component and exports both PDF layouts',async({page,browser})=>{
 test.setTimeout(120000)
 await page.addInitScript(()=>localStorage.setItem('facet-guide-seen','true'));await page.goto('/');await page.waitForFunction(()=>window.__facet?.editor);await page.evaluate(()=>document.fonts.ready)
 const coverage=await page.evaluate(async()=>{
  const guidePath='/scripts/usage-guide.ts',modelPath='/src/core/model.ts',registryPath='/src/core/registry.ts'
  const {usageGuide}=await import(/* @vite-ignore */ guidePath),{walk}=await import(/* @vite-ignore */ modelPath),{registry}=await import(/* @vite-ignore */ registryPath)
  const doc=await usageGuide();window.__facet.load(doc);const types=new Set(),variants=new Set();walk(doc.content,(n:any)=>{types.add(n.type);if(n.type==='callout')variants.add(n.attrs.variant)})
  const map:any={paragraph:'paragraph',part:'part',bullet:'bulletList',ordered:'orderedList',task:'taskList',quote:'blockquote',divider:'horizontalRule',equation:'mathBlock',image:'image',table:'table',code:'codeBlock',semantic:'semanticList',badge:'badge',icon:'inlineIcon',subfigure:'subfigure',columns:'columns',pagebreak:'pageBreak',title:'documentTitle',toc:'tableOfContents'}
  return registry.filter((r:any)=>r.variant?!variants.has(r.variant):!types.has(r.id.startsWith('heading')?'heading':map[r.id])).map((r:any)=>r.id)
 })
 expect(coverage).toEqual([])
 await page.evaluate(async()=>{await Promise.all(Array.from(document.images).map(i=>i.decode()));window.__facet.paginate()})
 expect(await page.evaluate(()=>window.__facet.getLayout().issues)).toEqual([])
 await expect(page.locator('.brand')).toContainText('Facet')
 await expect(page.locator('.document-part').first()).toHaveCSS('text-align','center')
 await expect(page.locator('.page-header').last()).toHaveCSS('text-align','center')
 const source=await page.evaluate(()=>JSON.stringify(window.__facet.getDocument()))
 const archive=await page.evaluate(async()=>Array.from(await window.__facet.encode()))
 await mkdir('output/pdf',{recursive:true})
 await writeFile('output/Facet-用法大全.facet',Buffer.from(archive as number[]))
 const paper=await page.evaluate(()=>window.__facet.exportHTML())
 const beamer=await page.evaluate(()=>window.__facet.exportBeamer('FACET'))
 expect(await page.evaluate(()=>JSON.stringify(window.__facet.getDocument()))).toBe(source)
 const frames=await browser.newPage({viewport:{width:1210,height:681}})
 const stats:any={}
 for(const [kind,html] of [['纸面版',paper],['Beamer',beamer.html]]){
  await frames.setContent(html);await frames.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode()))})
  const pages=frames.locator('.facet-page');stats[kind]=await pages.count()
  await expect(frames.locator('body')).toContainText('FACET-GUIDE-END')
  await expect(frames.locator('.code-editor-node .tok-keyword').first()).toBeVisible()
  expect(await frames.locator('.code-editor-node').first().evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(36, 49, 57)')
  await frames.pdf({path:`output/pdf/Facet-用法大全-${kind}.pdf`,preferCSSPageSize:true,printBackground:true})
  if(kind==='Beamer'){
   expect(await frames.locator('.beamer-body').evaluateAll(nodes=>nodes.every(n=>n.scrollHeight<=n.clientHeight+3&&n.scrollWidth<=n.clientWidth+3))).toBe(true)
   const titles=await frames.locator('.beamer-frame-title').allTextContents();expect(titles.some(t=>t.includes('长段落验收')&&t.includes('续'))).toBe(true);expect(titles.some(t=>t.includes('长表格验收')&&t.includes('续'))).toBe(true)
   const codePage=frames.locator('.beamer-slide').filter({has:frames.locator('.code-editor-node')}).first();await codePage.screenshot({path:'output/pdf/code-preview.png'})
   const mediaPage=frames.locator('.beamer-slide').filter({has:frames.locator('.two-columns')}).first();await mediaPage.screenshot({path:'output/pdf/columns-preview.png'})
  }
 }
 await writeFile('output/verification.json',JSON.stringify({coverage:'all registry components',pages:stats},null,2))
 await frames.close()
})

test('CodeSnap editing keeps code intact through pagination and export',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('facet-guide-seen','true'));await page.goto('/');await page.waitForFunction(()=>window.__facet?.editor)
 await page.getByRole('button',{name:'多媒体',exact:true}).click();await page.locator('[data-component="code"]').click()
 const area=page.getByLabel('代码编辑区');const code='def hello():\n    return "Facet"\n\nprint(hello())'
 await area.fill(code);await expect(area).toHaveValue(code)
 await expect(page.locator('.ProseMirror .code-line')).toHaveCount(4)
 expect(await page.locator('.ProseMirror .code-editor-node').evaluate(e=>{const a=e.querySelector('textarea')!,b=e.querySelector('pre')!;return Math.abs(a.getBoundingClientRect().top-b.getBoundingClientRect().top)})).toBeLessThan(1)
 const html=await page.evaluate(()=>window.__facet.exportHTML());expect(html).toContain('code-line');expect(html).toContain('tok-keyword')
 expect(await page.evaluate(()=>window.__facet.getDocument().content.find((n:any)=>n.type==='codeBlock').content[0].text)).toBe(code)
})
