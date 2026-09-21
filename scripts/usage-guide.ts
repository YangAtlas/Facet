import { makeDocument,p,uid,variants,semanticItems,type Block } from '../src/core/model'
const text=(value:string,marks?:any[]):Block=>({type:'text',text:value,...(marks?{marks}:{})})
const b=(type:string,attrs:any={},content?:Block[]):Block=>({type,attrs:{id:uid(),...attrs},...(content?{content}:{})})
const h=(title:string,level=3)=>b('heading',{level,toc:level<3},[text(title)])
const list=(items:string[],ordered=false)=>b(ordered?'orderedList':'bulletList',{},items.map(t=>b('listItem',{},[p(t)])))
const card=(variant:string,value:string)=>b('callout',{variant,...variants[variant]},[p(value)])
const code=(value:string,language='python')=>b('codeBlock',{language},[text(value)])
const table=(rows:string[][],style='academic')=>b('table',{tableStyle:style},rows.map((row,i)=>b('tableRow',{},row.map((cell,j)=>b(i?'tableCell':'tableHeader',{textAlign:j?'center':'left'},[p(cell)])))))
export async function usageGuide(){
 const doc=makeDocument();doc.metadata={...doc.metadata,title:'Facet 用法大全',subtitle:'从研究笔记到 Beamer 演示：全部组件的操作与实例',author:'Facet',institute:'组件手册 · 可编辑示例',date:'2026-09-21'};doc.page.header='FACET · 用法大全';doc.page.footer='Facet 使用手册'
 // Locally generated illustrative assets. These are examples, not measured research results.
 for(const [key,title,color] of [['demo-a','NOTES','#123b78'],['demo-b','SLIDES','#00846c']]){
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=360;const c=canvas.getContext('2d')!;c.fillStyle='#eef3f7';c.fillRect(0,0,960,360);c.fillStyle=color;c.fillRect(0,0,18,360);c.font='bold 42px sans-serif';c.fillText(title,60,80);c.font='22px sans-serif';c.fillStyle='#617282';c.fillText('Facet / Component example',60,121)
  for(let i=0;i<3;i++){c.fillStyle=color;c.globalAlpha=.18+i*.3;c.fillRect(60+i*290,174,240,125);c.globalAlpha=1;c.fillStyle='#fff';c.font='bold 30px sans-serif';c.fillText(['01  WRITE','02  ORGANIZE','03  SHARE'][i],80+i*290,246)}
  doc.assets[key]={name:`${title}.png`,mime:'image/png',data:canvas.toDataURL('image/png').split(',')[1]}
 }
 const image=(assetId='demo-a',caption='示意图：记录、组织与分享',width=85)=>b('image',{assetId,src:`asset:${assetId}`,caption,width})
 doc.content=[b('documentTitle',{cover:true}),b('tableOfContents'),
 b('part',{},[text('Part 1 · 写作与结构')]),h('一份笔记，两种阅读方式',1),h('从页面到组件',2),
 h('开始使用：插入、搜索与保存'),
 p('这份文档既是用法手册，也是可以直接编辑的组件样本。正文里的列表、卡片、公式、表格与图片都是实际组件；你可以修改文字、调整样式，再重新导出。'),
 list(['点击右侧组件卡片，在当前光标处插入。常用、最近使用和分类标签帮助你快速定位。','在空白段落输入 /，键入名称或英文别名，用方向键选择后按 Enter；Esc 关闭菜单。','使用 ⌘⇧P 或“书写命令”搜索组件；工具栏可上移、下移、复制和删除当前组件。','桌面版按 ⌘S 保存 .facet；它同时保存文字、结构和本地图片。恢复草稿可找回上一次编辑。']),
 h('文档标题、目录、页眉和页面设置'),
 p('打开“页面设置”编辑文档标题、副标题、作者、机构、日期与封面图片。本手册首页就是文档标题组件；下一页的目录自动汇总标题和页码，点击条目可跳转。'),
 p('页眉居中显示。新建文档可选 A4 竖版或 16:9 横版，页面设置还可调整页边距、页脚与主题色。纸面 PDF 保留当前分页；Beamer PDF 会重新按标题组织幻灯片。'),
 card('info','本手册目录展示 Part、一级和二级标题；三级标题仍作为 Beamer 的分帧边界。标题的目录显示、编号及图标可在组件设置中调整。'),
 h('部分与三级标题'),
 p('在“基础”选择“部分”，或输入 /part，会生成 Part 1、Part 2 等可编辑的分节标题。Part 居中显示，并作为大纲分组标记；Beamer 导出时生成独立分节页。'),
 list(['一级标题：在段首输入 # 再按空格，概括一个章节。','二级标题：输入 ## 再按空格，为章节建立主题。','三级标题：输入 ### 再按空格，一般对应一张幻灯片的主题；长内容会自动续页。']),
 h('正文与行内强调'),
 b('paragraph',{},[text('同一段文字可以包含 '),text('加粗',[{type:'bold'}]),text('、'),text('斜体',[{type:'italic'}]),text('、'),text('高亮',[{type:'highlight'}]),text('、'),text('行内代码',[{type:'code'}]),text(' 和 '),text('链接',[{type:'link',attrs:{href:'https://example.com'}}]),text('。选中文字后使用工具栏；链接使用 ⌘/Ctrl 点击打开。')]),
 b('paragraph',{},[text('语义样式：'),...['important','success','muted','theme'].flatMap((kind,i)=>[text(['重点结论','已验证结果','补充说明','主题关键词'][i],[{type:'semanticStyle',attrs:{kind}}]),text('  ')])]),
 h('无序列表、有序列表和待办'),
 p('无序列表用“- 空格”，有序列表用“1. 空格”。列表中按 Enter 添加下一项；空列表项再按 Enter 可回到正文。'),
 list(['无序列表适合并列观点。','有序列表适合操作步骤。']),list(['明确问题。','收集证据。','记录可复现的结论。'],true),
 b('taskList',{},[b('taskItem',{checked:true},[p('使用 [ ] 空格或 /todo 插入待办，在复选框右侧填写任务。')]),b('taskItem',{checked:false},[p('点击复选框切换状态，按 Enter 继续创建下一项。')])]),
 h('引用、分隔线与行内标记'),
 b('blockquote',{},[p('引用：用 > 空格或 /quote 插入。摘录观点时，补上来源和自己的解释。')]),b('horizontalRule'),
 p('上方是真实的分隔线组件，可用 --- 或 /hr 插入，用于分开相邻的主题。'),
 b('paragraph',{},[text('/state 插入状态标签：'),b('badge',{text:'进行中',color:'darkblue'}),text('；/icon 插入行内图标：'),b('inlineIcon',{icon:'lightbulb',color:'goldenyellow'}),text('。双击可调整文字、颜色或图标。')]),
 h('图标列表：七种语义'),
 p('用 /iconlist 打开图标列表选择器。图标表示内容的作用，文字仍可直接编辑；点击图标可修改条目类型。'),
 b('semanticList',{},semanticItems.map(s=>b('semanticItem',{kind:s.key},[p(`${s.label}：${({good:'实验已完成并记录结果。',bad:'发现一个需要修复的问题。',tool:'记录使用的工具或方法。',idea:'留下尚待验证的想法。',warning:'明确边界条件。',star:'突出最值得记住的一点。',arrow:'安排下一步行动。'} as Record<string,string>)[s.key]}`)]))),
 b('part',{},[text('Part 2 · 提示框与科研组件')]),h('让观点、证据与边界各有位置',2),
 h('提示框：信息、建议与注意'),
 p('点击对应卡片或输入英文命令即可插入。标题和图标可点击编辑；组件设置支持颜色、自定义标题和图标。'),
 card('info','/info 信息：说明背景、定义和阅读前提。例：下文中的所有数值均为演示数据，不代表真实实验结果。'),
 card('tip','/tip 建议：提供可执行的方法。例：每个三级标题只讲一个主题，便于直接转换为演示文稿。'),
 card('warning','/warning 注意：交代容易遗漏的约束。例：很宽的公式或超高的单个表格行需要先拆分。'),
 h('提示框：重点、思考与自定义'),
 card('important','/important 或 /imp 重点：写出读者应当记住的判断。例：先保证正文完整，再检查演示页的阅读节奏。'),
 card('reflection','/reflection 思考：区分证据和猜想。例：为何相同内容在 A4 与 16:9 页面中的分组不同？'),
 card('highlight','/highlight 重点段落：没有标题的浅色背景，适合强调一段连续文字。'),
 b('callout',{variant:'custom',title:'我的复盘卡片',icon:'star',color:'#466a8f'},[p('/custom 自定义卡片：本例改了标题与颜色，可按项目需求继续调整。')]),
 h('科研：定义、问题与洞见'),
 card('definition','/definition 定义：Beamer 导出的一个内容帧由三级标题及其后的组件构成。'),
 card('question','/question 问题：当一段笔记超过一张演示页时，如何保证内容不丢失？'),
 card('insight','/insight 洞见：标题保留主题，续页保留上下文，读者可以连续读完长内容。'),
 h('科研：实验、结果与结论'),
 card('experiment','/experiment 或 /exp 实验：分别检查短内容、长段落、列表、表格和组合布局的导出。'),
 card('result','/result 结果：观察标题边界、续页标记、表头重复和最后一项是否保留。结果应来自实际检查。'),
 card('conclusion','/conclusion 结论：用可以被检查的陈述总结当前发现，避免把演示数据写成真实研究结论。'),
 h('科研：文献记录'),card('literature','/literature 文献：记录作者、年份、题名、来源、关键结论及与当前研究的关系。本例为用法示范，不虚构参考文献。'),
 p('卡片也可以包含列表、待办或公式。长卡片可以续页，但特别长的单个公式仍应手动分行。'),
 b('part',{},[text('Part 3 · 公式、代码与多媒体')]),h('将证据放入文档',2),
 h('公式：块公式与行内公式'),
 p('用 /eq 或“公式”打开面板，输入 LaTeX 并检查实时预览；可选择行内或独立公式。点击已有公式可以再次编辑。'),
 b('paragraph',{},[text('行内公式示例：平均值 '),b('mathInline',{latex:'\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_i'}),text(' 可以自然嵌入一句话。')]),
 b('mathBlock',{latex:'\\mathcal{L}(\\theta)=\\frac{1}{N}\\sum_{i=1}^{N}\\left(f_{\\theta}(x_i)-y_i\\right)^2'}),
 card('tip','公式过宽时用 aligned 等环境分行。出现红色错误提示时，先修复公式再导出。'),
 h('代码：CodeSnap 风格'),
 p('使用 /code 插入代码块，右上角选择语言，在代码区直接输入。三色圆点、深色背景、行号与语法高亮会一起进入 PDF。'),
 code('# 演示：将观测值汇总为均值\ndef summarize(values):\n    total = sum(values)\n    count = len(values)\n    return total / count if count else 0\n\nsamples = [0.82, 0.86, 0.88]\nprint(summarize(samples))'),
 h('图片：尺寸与题注'),p('用 /img 选择本地图片，也可以粘贴截图。双击图片进入组件设置，调整宽度和题注。此处使用本地生成的示意图。'),image(),
 h('子图排列：并排比较'),p('用 /subfigure 一次选择多张图片，分别填写子图题注，再设置列数、组宽度与间距。下图仅说明两种阅读形式。'),
 b('subfigure',{columns:2,width:100,gap:16,items:[{assetId:'demo-a',caption:'(a) 笔记：完整展开'},{assetId:'demo-b',caption:'(b) 演示：分帧讲述'}]}),
 h('双栏：文字与图片并排'),
 b('columns',{ratio:48,gap:24},[b('column',{},[p('用 /columns 插入双栏。'),list(['在左右栏分别编辑内容。','拖动中间分隔条调整比例。','选中分隔条后可用方向键微调。']),p('适合左侧写结论，右侧放证据。')]),b('column',{},[image('demo-b','右栏：独立图片组件',100)])]),
 h('表格：三线学术样式'),
 p('用 /table 选择行列。点击网格后尺寸固定，也可以手动填写 1–200 行、1–30 列；设置每列对齐，再确认插入。下面的数值仅用于展示排版。'),
 table([['方案','演示分数','状态'],['基线','0.82','待复核'],['方案 A','0.86','已记录'],['方案 B','0.88','已记录']]),
 p('选中单元格后可通过表格工具栏增删行列、切换表头。三线表适合论文式结果汇总。'),
 h('表格：实线网格与主题色'),
 p('插入时选择“实线网格 · 主题配色”，或在已有表格的组件设置中切换。网格表适合任务安排和清单。'),
 table([['组件','使用场景','入口'],['待办清单','行动跟踪','/todo'],['状态标签','进展标记','/state'],['图标列表','语义提示','/iconlist']],'grid'),
 b('part',{},[text('Part 4 · 导出与验收')]),h('用这份手册验证导出',2),
 h('三种导出方式'),list(['PDF：按当前纸面分页导出，保留页眉、页脚和组件样式。','Beamer PDF：按三级标题重新分帧，Part 生成分节页；过长内容自动生成“（续）”标题。','LaTeX 源码包：导出独立排版的源码和资源，使用 XeLaTeX 编译；分页和组件外观不承诺与纸面 PDF 完全相同。']),
 p('Beamer 为 16:9 横版。右上角标签可以填写项目名、实验室名或留空；不使用大校徽。一级和二级标题提供章节上下文，三级标题前的引言也会保留。'),
 h('分页符：主动安排下一页'),p('用 /page 插入分页符。下方的内容会从新的一页开始；Beamer 中同样产生一个续页。'),b('pageBreak'),p('分页符之后：这段文字应出现在下一页，且顺序保持不变。'),
 h('长段落验收：完整读完一个主题'),
 p('这一节有意保留较长的正文，用来检验自动续页。'+[
 '写研究笔记时，先描述问题出现的条件，再解释采用的方法。条件可能包括输入范围、样本来源、参数设置和观察窗口。把这些信息放在正文中，可以避免读者只看到结论，却不知道结论成立的前提。',
 '记录观察时，应区分直接观察到的现象与对现象的解释。前者需要具体、可复查；后者可以保留不同假设。若有尚未排除的替代解释，应在注意或思考卡片中说明，而不是把猜测直接写进结果。',
 '整理证据时，可以先用表格对齐不同方案的指标，再通过图示说明主要差异。图中的数值、表中的数值和正文描述应该一致。本手册的示例数值只服务于排版展示，因此没有把它们包装成真实研究结果。',
 '进入演示阶段后，标题应指出当前页讨论的主题。自动续页仍使用原来的标题，并加上续页标记，这样读者能理解几张页面属于同一段说明。正文不应因为换页而被省略，也不应改变原本的段落顺序。',
 '复核导出时，除了第一页，还要检查中间的续页和最后一页。特别留意最后一句是否出现、列表编号是否连续、表格是否重复表头，以及图片题注是否仍与图片放在一起。这些检查比只看页面总数更有意义。',
 '复用这份手册时，可以删除说明性文字，保留所需的组件结构，逐步替换成自己的内容。修改后再次导出，确认结论、证据与下一步行动之间的关系仍然清楚。文档与演示共享内容，但各自拥有适合阅读的分页。',
 '代码片段应保留必要的输入、处理步骤与输出。为了让读者看懂，尽量使用清楚的变量名，并用简短注释解释为什么这样做。行号有助于讨论具体步骤，颜色帮助区分关键词与字符串，但都不能替代文字解释。遇到很长的代码时，可以按函数或阶段组织说明；自动分页负责完整保留内容，作者仍需要负责安排讲述顺序。',
 '公式应紧接着定义其中的变量和使用条件。如果推导分为多步，建议把等式写成多行，并让每一步的变形依据清楚可见。行内公式适合短表达式，独立公式适合需要强调的关系。检查输出时应同时关注符号、上下标和分式是否完整，而不能只看某个公式是否显示出来。',
 '图片和子图的题注要说明读者应该观察什么。双栏布局可以将解释和图像并排放置，使阅读顺序更清楚。如果一侧内容过长，另一侧内容较短，续页应保持左右栏内容各自的顺序，不把两个栏目的句子混在一起。表格跨页时重复表头，也是在降低读者回看上一页的负担。',
 '最后，检查文档里的行动项是否清楚。已完成的任务应勾选，尚待处理的任务应留下具体动作。状态标签可以说明当前进度，图标列表可以区分问题、工具、想法和下一步。把这些内容留在可编辑的源文档中，后续更新就不需要从导出的图片或 PDF 重新整理。'
 ].join('')+' 长段落结束标记：所有说明均已保留。'),
 h('长列表验收：步骤连续'),
 list(['检查文档标题。','确认副标题和日期。','确认作者与机构。','检查目录链接。','核对 Part 顺序。','检查一级标题。','检查二级标题。','检查三级标题。','检查加粗与高亮。','检查待办状态。','检查状态标签。','检查行内图标。','检查七种图标列表。','检查所有提示框。','检查所有科研卡片。','检查行内公式。','检查块公式。','检查代码缩进。','检查代码行号。','检查图片清晰度。','检查子图题注。','检查双栏内容。','检查表格对齐。','检查重复表头。','确认最后一步：列表结束。'],true),
 h('长表格验收：表头随页重复'),
 table([['序号','检查项目','预期'],...Array.from({length:26},(_,i)=>[String(i+1),`分页检查 ${String(i+1).padStart(2,'0')}`,i===25?'表格结束':'保留内容'])]),
 h('完成检查与下一步'),
 b('taskList',{},['确认所有组件均可编辑。','检查续页标题与内容连续性。','确认导出的最后一页包含下方结束标记。'].map(t=>b('taskItem',{checked:false},[p(t)]))),
 card('conclusion','这份手册覆盖工具箱中的全部组件。将它导出为 Beamer 后，可以逐节检查真实组件的呈现，而不仅是查看一段功能说明。'),
 p('用法大全结束 · FACET-GUIDE-END')]
 return doc
}
