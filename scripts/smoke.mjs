import { chromium } from '@playwright/test'
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const page=await browser.newPage({viewport:{width:1460,height:1000},deviceScaleFactor:1})
page.on('pageerror',e=>console.log('PAGE ERROR:',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE:',m.text().slice(0,300))})
await page.goto('http://127.0.0.1:5173');await page.waitForTimeout(2500);await page.screenshot({path:'test-results/initial.png',fullPage:true});console.log(await page.locator('body').innerText());await browser.close()
