import { p, uid, variants, type Block } from './model'
export type ComponentItem = { id: string; label: string; description: string; syntax?: string; group: string; icon: string; aliases: string[]; block?: () => Block; action?: string; variant?: string }
const block = (type: string, attrs = {}, content?: Block[]): Block => ({ type, attrs: { id: uid(), ...attrs }, ...(content ? { content } : {}) })
const components: ComponentItem[] = [
  { id:'paragraph',label:'正文',description:'让思考自然流动',group:'基础',icon:'paragraph',aliases:['text','p','文字'],block:()=>p() },
  ...[1,2,3].map(level=>({ id:`heading${level}`,syntax:`${'#'.repeat(level)} 空格`,label:`${['','一','二','三'][level]}级标题`,description:'组织文档层次',group:'基础',icon:'heading',aliases:[`h${level}`,'heading'],block:()=>block('heading',{level},[]) })),
  { id:'part',label:'部分',description:'用 Part 分组文档与大纲',syntax:'/part',group:'基础',icon:'folder',aliases:['part','section','节'] },
  { id:'bullet',syntax:'- 空格',label:'无序列表',description:'整理并列的要点',group:'基础',icon:'list-ul',aliases:['list','ul'],block:()=>block('bulletList',{},[block('listItem',{},[p()])]) },
  { id:'ordered',syntax:'1. 空格',label:'有序列表',description:'一步一步展开',group:'基础',icon:'list-ol',aliases:['ol'],block:()=>block('orderedList',{},[block('listItem',{},[p()])]) },
  { id:'task',syntax:'[ ] 空格',label:'待办清单',description:'记录下一步行动',group:'基础',icon:'tasks',aliases:['todo','check'],block:()=>block('taskList',{},[block('taskItem',{checked:false},[p()])]) },
  { id:'quote',syntax:'> 空格',label:'引用',description:'留下一段值得记住的话',group:'基础',icon:'quote-left',aliases:['quote'],block:()=>block('blockquote',{},[p()]) },
  { id:'divider',syntax:'---',label:'分隔线',description:'为内容留一个停顿',group:'基础',icon:'minus',aliases:['hr'],block:()=>block('horizontalRule') },
  ...Object.entries(variants).map(([key,v])=>({id:key,label:key==='highlight'?'重点段落':key==='custom'?'自定义卡片':v.title,description:({info:'背景、定义与阅读提示',tip:'方法、经验与实用建议',warning:'前提与需要注意的事项',important:'关键结论与核心信息',reflection:'观察、假设与进一步思考'} as Record<string,string>)[key] ?? '用一个卡片承载想法',group:'提示框',icon:v.icon||'highlighter',aliases:[key,...(key==='important'?['imp']:key==='experiment'?['exp']:[])],variant:key,block:()=>block('callout',{variant:key,...v},[p()])})),
  {id:'equation',label:'公式',description:'LaTeX 输入与实时渲染',group:'多媒体',icon:'square-root-alt',aliases:['eq','math','公式'],action:'equation'},
  {id:'image',label:'图片',description:'插入本地图片或粘贴截图',group:'多媒体',icon:'image',aliases:['img','figure'],action:'image'},
  {id:'table',label:'表格',description:'选择行列后插入三线表',group:'多媒体',icon:'table',aliases:['table'],action:'table'},
  {id:'code',label:'代码',description:'保留缩进与语法层次',group:'多媒体',icon:'code',aliases:['code','python'],block:()=>block('codeBlock',{language:'python'},[])},
  {id:'semantic',syntax:'/iconlist',label:'图标列表',description:'完成、问题、想法与下一步',group:'基础',icon:'check-circle',aliases:['iconlist','semantic','good'],block:()=>block('semanticList',{},[block('semanticItem',{kind:'good'},[p()])])},
  {id:'badge',syntax:'/state',label:'状态标签',description:'在行内标记状态',group:'基础',icon:'tag',aliases:['state','badge','tag'],action:'badge'},
  {id:'icon',syntax:'/icon',label:'行内图标',description:'插入简洁的矢量符号',group:'基础',icon:'icons',aliases:['icon'],action:'icon'},
  {id:'subfigure',label:'子图排列',description:'多张图片组成可调大小的图组',group:'多媒体',icon:'images',aliases:['subfigure','figure grid','子图'],action:'subfigure'},
  {id:'columns',label:'双栏',description:'文字与图片并排，自由调整左右比例',group:'多媒体',icon:'columns',aliases:['columns','two columns','双栏','分栏'],block:()=>block('columns',{ratio:50,gap:24},[block('column',{},[p()]),block('column',{},[p()])])},
  {id:'pagebreak',label:'分页符',description:'从新的一页开始',group:'页面',icon:'file',aliases:['page','break'],block:()=>block('pageBreak')},
  {id:'title',label:'文档标题',description:'标题、副标题与作者信息',group:'页面',icon:'file-alt',aliases:['title'],block:()=>block('documentTitle')},
  {id:'toc',label:'目录',description:'自动汇总标题和页码',group:'页面',icon:'list',aliases:['toc','contents'],block:()=>block('tableOfContents')},
]
export const registry:ComponentItem[]=components.map(item=>({...item,syntax:[item.syntax?.startsWith('/')?null:item.syntax,`/${item.aliases[0]}`].filter(Boolean).join(' · ')}))
export function searchComponents(query: string) { const q=query.trim().toLowerCase(); return registry.filter(x=>x.id!=='paragraph').filter(x=>`${x.label} ${x.description} ${x.aliases.join(' ')}`.toLowerCase().includes(q)) }
