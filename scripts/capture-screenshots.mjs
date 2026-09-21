import { chromium } from '@playwright/test'
import { writeFile, mkdir } from 'node:fs/promises'

const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined})
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 1060}, deviceScaleFactor: 1.5})
  await page.goto('http://127.0.0.1:5173')
  await page.waitForFunction(() => window.__facet?.editor)
  await page.evaluate(async () => {
    const {makeDocument, p, uid, variants} = await import('/src/core/model.ts')
    const doc = makeDocument()
    doc.metadata = {...doc.metadata, title: '从研究笔记，到清晰表达', subtitle: 'One source, many facets.', author: 'Facet', date: '2026-09-21'}
    doc.page = {...doc.page, header: 'FACET · RESEARCH NOTES', footer: '从记录到分享'}
    const text = text => ({type: 'text', text})
    const heading = (title, level) => ({type: 'heading', attrs: {id: uid(), level, numbered: false, toc: true}, content: [text(title)]})
    const card = (variant, content) => ({type: 'callout', attrs: {id: uid(), variant, ...variants[variant]}, content: [p(content)]})
    doc.content = [
      heading('让研究，有迹可循', 1),
      p('从一个值得追问的问题开始。把想法、推导与下一步写在同一份笔记里，再让它成为可以分享的演示。'),
      heading('01  定义一个好问题', 3),
      card('question', '如何让研究笔记自然生长为一次清晰的分享？'),
      p('用标题组织思路，用组件承载证据。写作时专注内容，阅读时保留完整上下文。'),
      heading('02  让推导与洞见相邻', 3),
      {type: 'mathBlock', attrs: {id: uid(), latex: '\\mathcal{L}(\\theta)=\\frac{1}{N}\\sum_{i=1}^{N}\\left(f_{\\theta}(x_i)-y_i\\right)^2'}},
      card('insight', '公式解释关系，文字解释意义。把变量、假设和你的判断放在一起，方便日后回看。'),
      heading('03  从记录走向分享', 3),
      {type: 'taskList', attrs: {id: uid()}, content: [
        {type: 'taskItem', attrs: {id: uid(), checked: true}, content: [p('梳理问题与关键思路')]},
        {type: 'taskItem', attrs: {id: uid(), checked: true}, content: [p('补充公式与解释')]},
        {type: 'taskItem', attrs: {id: uid(), checked: false}, content: [p('导出 PDF，与伙伴讨论')]},
      ]}, p(),
    ]
    window.__facet.load(doc)
    await document.fonts.ready
    window.__facet.paginate()
  })
  await page.waitForTimeout(800)
  await mkdir('docs/images', {recursive: true})
  await page.screenshot({path: 'docs/images/workspace.png'})
  await page.locator('[data-component="equation"]').click()
  await page.locator('.math-source').fill('\\mathcal{L}(\\theta)=\\frac{1}{N}\\sum_{i=1}^{N}\\left(f_{\\theta}(x_i)-y_i\\right)^2')
  await page.screenshot({path: 'docs/images/equation.png'})
  await page.getByRole('button', {name: '取消', exact: true}).click()
  await page.getByRole('button', {name: '导出', exact: true}).click()
  await page.getByRole('button', {name: /^Beamer PDF/}).click()
  await page.screenshot({path: 'docs/images/export.png'})
  const slides = await page.evaluate(() => window.__facet.exportBeamer({branding: 'text', tag: 'FACET', cover: false, footer: true}))
  if (slides.issues?.length) throw new Error(JSON.stringify(slides.issues))
  const preview = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1.5})
  await preview.setContent(slides.html)
  await preview.evaluate(() => document.fonts.ready)
  await preview.locator('.beamer-slide').filter({hasText: '公式解释关系'}).first().screenshot({path: 'docs/images/beamer.png'})
  console.log('Saved four screenshots from the running Facet interface and its Beamer export.')
} finally { await browser.close() }
