import {test,expect} from '@playwright/test'
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('facet-guide-seen','true'));await page.goto('/');await page.waitForFunction(()=>window.__facet?.editor)})
test('every component advertises a working slash alias',async({page})=>{
  const missing=await page.evaluate(async()=>{const path='/src/core/registry.ts';const {registry,searchComponents}=await import(/* @vite-ignore */ path);return registry.filter((c:any)=>c.id!=='paragraph').filter((c:any)=>!c.syntax.includes('/'+c.aliases[0])||!searchComponents(c.aliases[0]).some((m:any)=>m.id===c.id)).map((c:any)=>c.id)})
  expect(missing).toEqual([])
  await page.getByRole('button',{name:'提示框',exact:true}).click();await expect(page.locator('[data-component="info"]')).toContainText('/info')
})
test('app preferences persist and all export formats open an export dialog',async({page})=>{
  await page.getByRole('button',{name:'设置',exact:true}).click()
  await page.getByRole('button',{name:'通用',exact:true}).click();await page.getByLabel('默认页面方向').selectOption('landscape');await page.getByLabel('显示组件工具箱').uncheck();await page.getByRole('button',{name:'完成',exact:true}).click()
  await page.reload();await page.waitForFunction(()=>window.__facet?.editor);await expect(page.locator('.right-panel')).toHaveCount(0)
  await page.getByRole('button',{name:/新建文档/}).click();await expect(page.getByRole('radio',{name:/横版/})).toHaveAttribute('aria-checked','true');await page.getByRole('button',{name:'取消',exact:true}).click()
  for(const label of ['导出 PDF','Beamer PDF','LaTeX 源码包']){
    await page.locator('.top-actions').getByRole('button',{name:'导出',exact:true}).click();await page.getByLabel('导出格式').selectOption(label==='导出 PDF'?'pdf':label==='Beamer PDF'?'beamer':'latex')
    await expect(page.getByRole('dialog',{name:'导出文档'})).toBeVisible()
    if(label==='Beamer PDF'){await expect(page.getByLabel('右上角标志')).toHaveValue('zju');await page.getByLabel('右上角标志').selectOption('text');await page.getByLabel('Beamer 标签').fill('LAB')}
    await page.getByRole('button',{name:'取消',exact:true}).click()
  }
})
test('parts get standalone pages, H2 cannot replace H1 in Beamer headers',async({page})=>{
  const result=await page.evaluate(async()=>{
    const f=window.__facet,d=structuredClone(f.getDocument()),node=(type:string,text:string,attrs={})=>({type,attrs:{id:crypto.randomUUID(),...attrs},content:[{type:'text',text}]})
    d.content=[node('paragraph','前言'),node('part','Part 1'),node('heading','一级 A',{level:1}),node('heading','二级 B',{level:2}),node('heading','主题 C',{level:3}),node('paragraph','内容'),node('part','Part 2'),node('heading','二级 D',{level:2}),node('heading','主题 E',{level:3}),node('paragraph','末尾')];f.load(d)
    const layout=f.getLayout();return {parts:layout.pages.filter((p:any)=>p.content.some((n:any)=>n.type==='part')).map((p:any)=>p.content.map((n:any)=>n.type)),beamer:await f.exportBeamer({branding:'zju',tag:'',cover:false,footer:false})}
  })
  expect(result.parts).toEqual([['part'],['part']]);await page.setContent(result.beamer.html)
  await expect(page.locator('.beamer-cover')).toHaveCount(0)
  await expect(page.locator('.beamer-body').filter({hasText:'内容'})).toHaveCount(1)
  const headers=await page.locator('.beamer-nav>span').allTextContents();expect(headers).toContain('一级 A');expect(headers).not.toContain('二级 B');expect(headers).not.toContain('二级 D')
  await expect(page.locator('.beamer-logo').first()).toBeVisible();expect(await page.locator('.beamer-logo').first().evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
  await expect(page.locator('.beamer-footer').first()).toBeHidden()
  await page.locator('.beamer-body').filter({hasText:'内容'}).locator('..').screenshot({path:'test-results/beamer-h1-zju.png'})
})
