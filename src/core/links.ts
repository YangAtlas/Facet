export function normalizeLink(value:string):string {
  const text=value.trim()
  if(!text||/\s/.test(text))return ''
  if(text.startsWith('#'))return text
  if(/^(mailto:|tel:)/i.test(text))return text
  if(/^[^/@]+@[^/@]+\.[^/@]+$/.test(text))return 'mailto:'+text
  const url=text.startsWith('//')?'https:'+text:/^https?:\/\//i.test(text)?text:'https://'+text
  try{const parsed=new URL(url);return ['http:','https:'].includes(parsed.protocol)&&parsed.hostname?parsed.href:''}catch{return ''}
}
