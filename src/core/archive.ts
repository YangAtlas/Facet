import JSZip from 'jszip'
import { validateDocument, type FacetDocument } from './model'
export async function encodeDocument(doc:FacetDocument):Promise<Uint8Array> {
  validateDocument(doc)
  const zip=new JSZip(),metadata=structuredClone(doc)
  const manifests:Record<string,any>={}
  for(const [id,a] of Object.entries(doc.assets)) {
    const path=`assets/${id}.${a.mime==='image/png'?'png':a.mime==='image/webp'?'webp':'jpg'}`
    zip.file(path,a.data,{base64:true});manifests[id]={name:a.name,mime:a.mime,path}
  }
  metadata.assets=manifests
  zip.file('document.json',JSON.stringify(metadata,null,2))
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'})
}
export async function decodeDocument(bytes:Uint8Array):Promise<FacetDocument> {
  if(bytes.byteLength>100*1024*1024)throw new Error('文档超过 100 MB，请拆分后打开。')
  const zip=await JSZip.loadAsync(bytes),entry=zip.file('document.json')
  if(!entry)throw new Error('不是有效的 Facet 文件。')
  const raw=await entry.async('string')
  if(raw.length>10000000)throw new Error('文档数据过大。')
  const doc=JSON.parse(raw)
  if(doc.format!=='facet'||doc.version!==1)throw new Error('此文档版本尚不支持；原文件不会被修改。')
  const assets:FacetDocument['assets']={}
  for(const [id,asset] of Object.entries(doc.assets??{}) as [string,any][]) {
    if(!/^[a-zA-Z0-9-]+$/.test(id)||!['image/png','image/jpeg','image/webp'].includes(asset.mime)||typeof asset.path!=='string'||!/^assets\/[a-zA-Z0-9.-]+$/.test(asset.path)) throw new Error('文档资源无效。')
    const file=zip.file(asset.path);if(!file)throw new Error('文档缺少图片资源。')
    const data=await file.async('uint8array');if(data.byteLength>20000000)throw new Error('单张图片过大。')
    assets[id]={name:String(asset.name),mime:asset.mime,data:await file.async('base64')}
  }
  doc.assets=assets;validateDocument(doc);return doc
}
