const {contextBridge,ipcRenderer}=require('electron')
const call=channel=>(...args)=>ipcRenderer.invoke(channel,...args)
contextBridge.exposeInMainWorld('facetDesktop',{
  open:call('document:open'),save:call('document:save'),recent:call('document:recent'),
  recoveries:call('document:recoveries'),recover:call('document:recover'),recovery:call('document:recovery'),
  exportPDF:call('export:pdf'),exportArchive:call('export:archive'),openExternal:call('link:open'),openOutput:call('output:open'),revealOutput:call('output:reveal'),
  onClose:callback=>{const handler=()=>callback();ipcRenderer.on('app:closing',handler);return()=>ipcRenderer.removeListener('app:closing',handler)},
  closeReady:()=>ipcRenderer.send('app:close-ready'),cancelClose:()=>ipcRenderer.send('app:close-cancel'),
  onOpen:callback=>{const handler=(_,value)=>callback(value);ipcRenderer.on('document:opened',handler);return()=>ipcRenderer.removeListener('document:opened',handler)},
})
