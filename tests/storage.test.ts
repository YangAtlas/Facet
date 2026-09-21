import {describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
const {atomicWrite,hash}=createRequire(import.meta.url)('../electron/storage.cjs')
describe('atomic file saving',()=>{
 it('preserves backup and refuses an externally changed file',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'facet-save-'));try{const file=path.join(dir,'test.facet');const first=await atomicWrite(file,Buffer.from('first'));await atomicWrite(file,Buffer.from('second'),first.hash);expect(await readFile(file+'.bak','utf8')).toBe('first');await writeFile(file,'external');expect(await atomicWrite(file,Buffer.from('third'),hash(Buffer.from('second')))).toEqual({conflict:true});expect(await readFile(file,'utf8')).toBe('external')}finally{await rm(dir,{recursive:true,force:true})}})
 it('does not overwrite a file deleted by an external process',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'facet-save-'));try{const file=path.join(dir,'test.facet');const first=await atomicWrite(file,Buffer.from('one'));await rm(file);expect(await atomicWrite(file,Buffer.from('two'),first.hash)).toEqual({conflict:true})}finally{await rm(dir,{recursive:true,force:true})}})
})
