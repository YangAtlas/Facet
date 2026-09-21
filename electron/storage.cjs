const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto')
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
async function atomicWrite(file,bytes,expected) {
  let existing=null
  try{existing=await fs.readFile(file)}catch(e){if(e.code!=='ENOENT')throw e}
  if(expected!=null && (existing===null||hash(existing)!==expected))return {conflict:true}
  await fs.mkdir(path.dirname(file),{recursive:true})
  const temporary=`${file}.${crypto.randomUUID()}.tmp`
  try {
    const handle=await fs.open(temporary,'wx',0o600)
    try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}
    if(existing)await fs.writeFile(`${file}.bak`,existing,{mode:0o600})
    // Recheck after preparing the replacement to catch an external writer during the write.
    if(expected!=null){let now=null;try{now=await fs.readFile(file)}catch(e){if(e.code!=='ENOENT')throw e};if(now===null||hash(now)!==expected)return {conflict:true}}
    await fs.rename(temporary,file)
    return {hash:hash(bytes)}
  }finally{await fs.rm(temporary,{force:true}).catch(()=>{})}
}
module.exports={atomicWrite,hash}
