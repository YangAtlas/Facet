import { defineConfig } from '@playwright/test'
export default defineConfig({testDir:'./tests/e2e',timeout:60000,workers:1,use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1460,height:1000},launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'},screenshot:'only-on-failure'},reporter:'list'})
