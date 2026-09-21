const {app,BrowserWindow,ipcMain,dialog,shell,Menu}=require('electron')
const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto')
const {atomicWrite,hash}=require('./storage.cjs')
let main,closing=false,closeRequested=false
const handles=new Map(),outputs=new Map()
const cleanName=s=>String(s||'未命名文档').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,100)
const settingsPath=()=>path.join(app.getPath('userData'),'recent.json')
const recoveryPath=id=>{if(!/^[\w-]{1,80}$/.test(id))throw new Error('无效文档标识');return path.join(app.getPath('userData'),'recovery',`${id}.facet`)}
const readRecent=async()=>{try{return JSON.parse(await fs.readFile(settingsPath(),'utf8'))}catch{return []}}
async function addRecent(file){const r=await readRecent();await fs.writeFile(settingsPath(),JSON.stringify([file,...r.filter(x=>x!==file)].slice(0,12)))}
async function readFile(file){const stat=await fs.stat(file);if(stat.size>100*1024*1024)throw new Error('文档超过 100 MB');const bytes=await fs.readFile(file);const token=crypto.randomUUID();handles.set(token,{file,hash:hash(bytes)});await addRecent(file);return {token,name:path.basename(file),bytes:[...bytes]}}
function register(channel,handler){ipcMain.handle(channel,async(event,...args)=>{if(event.sender!==main.webContents)throw new Error('非法调用来源');try{return await handler(...args)}catch(e){return {error:e.message||String(e)}}})}
function setupIPC(){
  register('document:open',async recentIndex=>{if(Number.isInteger(recentIndex)){const recent=await readRecent();if(!recent[recentIndex])throw new Error('最近文档不存在');return readFile(recent[recentIndex])}const selected=await dialog.showOpenDialog(main,{filters:[{name:'Facet 文档',extensions:['facet','bak']}],properties:['openFile']});if(selected.canceled)return null;return readFile(selected.filePaths[0])})
  register('document:recent',async()=> (await readRecent()).map((p,i)=>({index:i,name:path.basename(p),directory:path.dirname(p)})))
  register('document:save',async({token,name,bytes,saveAs})=>{
    const data=Buffer.from(bytes);if(data.length>100*1024*1024)throw new Error('文档过大')
    let handle=handles.get(token),file=handle?.file
    if(!file||saveAs){const picked=await dialog.showSaveDialog(main,{defaultPath:`${cleanName(name)}.facet`,filters:[{name:'Facet 文档',extensions:['facet']}]});if(picked.canceled)return null;file=picked.filePath;handle=null}
    const result=await atomicWrite(file,data,handle?.hash)
    if(result.conflict)return {conflict:true}
    const nextToken=token&&!saveAs?token:crypto.randomUUID();handles.set(nextToken,{file,hash:result.hash});await addRecent(file)
    return {token:nextToken,name:path.basename(file)}
  })
  register('document:recovery',async({id,bytes})=>{await atomicWrite(recoveryPath(id),Buffer.from(bytes));return {ok:true}})
  register('document:recoveries',async()=>{const dir=path.join(app.getPath('userData'),'recovery');try{const names=await fs.readdir(dir);const entries=await Promise.all(names.filter(n=>n.endsWith('.facet')).map(async n=>({id:n.slice(0,-6),modified:(await fs.stat(path.join(dir,n))).mtimeMs})));return entries.sort((a,b)=>b.modified-a.modified)}catch{return []}})
  register('document:recover',async id=>({bytes:[...await fs.readFile(recoveryPath(id))]}))
  register('export:archive',async({name,bytes})=>{const result=await dialog.showSaveDialog(main,{defaultPath:`${cleanName(name)}-latex.zip`,filters:[{name:'LaTeX 源码包',extensions:['zip']}]});if(result.canceled)return null;await atomicWrite(result.filePath,Buffer.from(bytes));const token=crypto.randomUUID();outputs.set(token,result.filePath);return {token,name:path.basename(result.filePath)}})
  register('export:pdf',async({name,html,pageCount})=>{
    if(typeof html!=='string'||html.length>120*1024*1024||!Number.isInteger(pageCount)||pageCount<1)throw new Error('导出数据无效')
    const result=await dialog.showSaveDialog(main,{defaultPath:`${cleanName(name)}.pdf`,filters:[{name:'PDF 文档',extensions:['pdf']}]});if(result.canceled)return null
    const win=new BrowserWindow({show:false,width:1100,height:1300,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:`export-${crypto.randomUUID()}`}})
    const tempDir=await fs.mkdtemp(path.join(app.getPath('temp'),'facet-export-')),source=path.join(tempDir,'index.html');await fs.writeFile(source,html,'utf8')
    const timer=setTimeout(()=>{if(!win.isDestroyed())win.destroy()},120000)
    try{
      win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
      win.webContents.session.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith('data:')&&!details.url.startsWith('about:')&&!details.url.startsWith('file:')}))
      await win.loadFile(source)
      await win.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.decode())]).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`)
      const count=await win.webContents.executeJavaScript(`document.querySelectorAll('.facet-page').length`)
      if(count!==pageCount)throw new Error('页面快照不完整，已停止导出')
      const pdf=await win.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,scale:1,margins:{top:0,bottom:0,left:0,right:0},displayHeaderFooter:false})
      await atomicWrite(result.filePath,pdf);const token=crypto.randomUUID();outputs.set(token,result.filePath);return {token,name:path.basename(result.filePath)}
    }finally{clearTimeout(timer);if(!win.isDestroyed())win.destroy();await fs.rm(tempDir,{recursive:true,force:true})}
  })
  register('link:open',async value=>{if(typeof value!=='string')return;const url=new URL(value);if(['https:','http:','mailto:'].includes(url.protocol))await shell.openExternal(url.href)})
  register('output:open',async token=>{const p=outputs.get(token);if(p)await shell.openPath(p)})
  register('output:reveal',token=>{const p=outputs.get(token);if(p)shell.showItemInFolder(p)})
  ipcMain.on('app:close-ready',event=>{if(event.sender===main.webContents){closing=true;main.close()}})
  ipcMain.on('app:close-cancel',()=>{closeRequested=false})
}
function createWindow(){
  main=new BrowserWindow({width:1460,height:960,minWidth:900,minHeight:640,title:'Facet',backgroundColor:'#f5f4f0',titleBarStyle:'hiddenInset',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}})
  main.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  main.webContents.on('will-navigate',e=>e.preventDefault())
  const dev=process.env.FACET_DEV_URL
  if(dev&&/^http:\/\/127\.0\.0\.1:\d+$/.test(dev)) main.loadURL(dev);else main.loadFile(path.join(__dirname,'../dist/index.html'))
  main.on('close',e=>{if(!closing){e.preventDefault();if(!closeRequested){closeRequested=true;main.webContents.send('app:closing')}}})
  main.on('closed',()=>{main=null})
}
app.whenReady().then(()=>{setupIPC();Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Facet',submenu:[{role:'about'},{type:'separator'},{role:'quit'}]},{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'窗口',submenu:[{role:'minimize'},{role:'zoom'}]}]));createWindow();app.on('activate',()=>{if(!main){closing=false;closeRequested=false;createWindow()}})})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
app.on('open-file',async(e,file)=>{e.preventDefault();if(main){try{main.webContents.send('document:opened',await readFile(file))}catch{}}})
