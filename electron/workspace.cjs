const fs=require('node:fs/promises'),path=require('node:path')
let root=''
module.exports={
 get root(){return root},
 async restore(file){try{root=JSON.parse(await fs.readFile(file,'utf8')).root||''}catch{}},
 async choose(folder,file){root=folder;await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify({root}));return this.list('')},
 resolve(relative){if(!root)throw new Error('请先打开文件夹');return path.join(root,relative)},
 async list(relative=''){if(!root)return {root:'',name:'',entries:[]};const directory=this.resolve(relative);const entries=(await fs.readdir(directory,{withFileTypes:true})).filter(e=>e.isDirectory()&&!e.name.startsWith('.')||e.isFile()&&/\.facet$/i.test(e.name)).map(e=>({name:e.name,path:path.join(relative,e.name),kind:e.isDirectory()?'folder':'file'})).sort((a,b)=>a.kind!==b.kind?a.kind==='folder'?-1:1:a.name.localeCompare(b.name,'zh-CN',{numeric:true}));return {root,name:path.basename(root),entries}}
}
