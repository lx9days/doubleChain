const $ = id => document.getElementById(id);

const state = {
  keywordInput: '',
  submittedKeyword: '通信',
  page: 1,
  pageSize: 20,
  data: null,
  loading: false,
  error: '',
  selectedPatentId: null,
  selectedCompanyId: null
};

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function readInitialState(){
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const keyword = params.get('q');
  const page = Number.parseInt(params.get('page') || '1', 10);
  const patent = params.get('patent') || hashParams.get('patent');
  const company = params.get('company') || hashParams.get('company');

  if(keyword && keyword.trim()){
    state.submittedKeyword = keyword.trim();
  }
  state.keywordInput = state.submittedKeyword;
  if(Number.isFinite(page) && page > 0){
    state.page = page;
  }
  if(patent){
    state.selectedPatentId = patent;
  }
  if(company){
    state.selectedCompanyId = company;
  }
}

function updateUrl(){
  const params = new URLSearchParams();
  const hashParams = new URLSearchParams();
  if(state.submittedKeyword){
    params.set('q', state.submittedKeyword);
  }
  if(state.page > 1){
    params.set('page', String(state.page));
  }
  if(state.selectedPatentId){
    hashParams.set('patent', state.selectedPatentId);
  }
  if(state.selectedCompanyId){
    hashParams.set('company', state.selectedCompanyId);
  }
  const query = params.toString();
  const hash = hashParams.toString();
  const nextUrl = (query ? `${window.location.pathname}?${query}` : window.location.pathname) + (hash ? `#${hash}` : '');
  window.history.replaceState(null, '', nextUrl);
}

function highlightKeyword(text){
  const keyword = String(state.submittedKeyword || '').trim();
  if(!keyword){
    return esc(text);
  }
  const source = String(text || '');
  const lowerSource = source.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  let cursor = 0;
  let output = '';
  let index = lowerSource.indexOf(lowerKeyword);
  while(index !== -1){
    output += esc(source.slice(cursor, index));
    output += `<mark>${esc(source.slice(index, index + keyword.length))}</mark>`;
    cursor = index + keyword.length;
    index = lowerSource.indexOf(lowerKeyword, cursor);
  }
  output += esc(source.slice(cursor));
  return output;
}

async function fetchSequence(){
  state.loading = true;
  state.error = '';
  render();
  const params = new URLSearchParams({
    keyword: state.submittedKeyword,
    page: String(state.page),
    pageSize: String(state.pageSize)
  });

  try{
    const response = await fetch(`/api/patent-sequence?${params.toString()}`);
    if(!response.ok){
      throw new Error(`查询失败：${response.status}`);
    }
    state.data = await response.json();
    const pagePatentIds = new Set(state.data.items.map(item => item.id));
    const pageCompanyIds = new Set(state.data.items.flatMap(item => item.companies.map(company => company.id)));
    if(state.selectedPatentId && !pagePatentIds.has(state.selectedPatentId)){
      state.selectedPatentId = null;
    }
    if(state.selectedCompanyId && !pageCompanyIds.has(state.selectedCompanyId)){
      state.selectedCompanyId = null;
    }
  } catch (error){
    state.error = error.message || '查询失败';
    state.data = null;
  } finally {
    state.loading = false;
    updateUrl();
    render();
  }
}

function submitQuery(){
  state.submittedKeyword = state.keywordInput.trim();
  state.page = 1;
  state.selectedPatentId = null;
  state.selectedCompanyId = null;
  fetchSequence();
}

function selectPatent(patentId){
  state.selectedPatentId = patentId;
  state.selectedCompanyId = null;
  updateUrl();
  render();
}

function selectCompany(companyId){
  state.selectedCompanyId = companyId;
  state.selectedPatentId = null;
  updateUrl();
  render();
}

function clearSelection(){
  state.selectedPatentId = null;
  state.selectedCompanyId = null;
  updateUrl();
  render();
}

function renderStats(){
  const data = state.data;
  $('keywordBadge').textContent = `当前关键词：${state.submittedKeyword || '未输入'}`;
  $('queryStatus').textContent = state.loading
    ? '正在查询完整 invest 数据…'
    : (state.error || '标题字面包含匹配；中央按专利 ID 数值升序排列。');

  if(!data){
    $('matchedPatents').textContent = '0';
    $('matchedCompanies').textContent = '0';
    $('visiblePatents').textContent = '0';
    $('visibleCompanies').textContent = '0';
    $('sequenceSummary').textContent = '当前未选择节点';
    $('pagerSummary').textContent = '暂无分页结果';
    $('dataRange').textContent = '完整 invest 数据范围将在查询成功后显示。';
    $('clearSequenceSelection').disabled = true;
    $('prevPage').disabled = true;
    $('nextPage').disabled = true;
    return;
  }

  $('matchedPatents').textContent = data.totalPatents.toLocaleString();
  $('matchedCompanies').textContent = data.totalCompanies.toLocaleString();
  $('visiblePatents').textContent = data.visiblePatentCount.toLocaleString();
  $('visibleCompanies').textContent = data.visibleCompanyCount.toLocaleString();
  $('pagerSummary').textContent = data.totalPages
    ? `第 ${data.page} / ${data.totalPages} 页 · 当前显示 ${data.pageStart}-${data.pageEnd} 条`
    : '当前无匹配结果';
  $('dataRange').textContent = `${data.meta.sourceLabel}：${data.meta.patentCount.toLocaleString()} 条专利记录 / ${data.meta.companyCount.toLocaleString()} 家公司 · 本次查询 ${data.queryMs} ms`;
  $('sequenceSummary').textContent = state.selectedPatentId
    ? `已选专利节点：${state.selectedPatentId}`
    : (state.selectedCompanyId ? `已选企业节点：${state.selectedCompanyId}` : '当前未选择节点');
  $('clearSequenceSelection').disabled = !(state.selectedPatentId || state.selectedCompanyId);
  $('prevPage').disabled = !data.totalPages || data.page <= 1 || state.loading;
  $('nextPage').disabled = !data.totalPages || data.page >= data.totalPages || state.loading;
}

function buildPath(start, end){
  const midX = start.x + (end.x - start.x) / 2;
  return ['M', start.x, start.y, 'L', midX, start.y, 'L', midX, end.y, 'L', end.x, end.y].join(' ');
}

function renderGraph(){
  const shell = $('sequenceGraphShell');
  const canvas = $('sequenceCanvas');
  const svg = $('sequenceSvg');
  const nodesLayer = $('sequenceNodes');
  const axisLayer = $('sequenceAxisLabels');

  if(state.loading){
    shell.innerHTML = '<div class="empty">正在加载完整 invest 数据查询结果…</div>';
    return;
  }

  if(state.error){
    shell.innerHTML = `<div class="empty">${esc(state.error)}</div>`;
    return;
  }

  if(!state.data || !state.data.items.length){
    shell.innerHTML = '<div class="empty">当前关键词没有命中专利记录。请修改关键词后重新检索。</div>';
    return;
  }

  shell.innerHTML = '<div id="sequenceGraphScroll" class="sequence-graph-scroll"><div id="sequenceCanvas" class="sequence-canvas"><svg id="sequenceSvg" class="sequence-svg" aria-hidden="true"></svg><div id="sequenceAxisLabels"></div><div id="sequenceNodes"></div></div></div>';

  const layout = DemoPatentSequenceLayout.buildPatentSequenceLayout(state.data.items);
  const patentLookup = new Map(layout.patents.map(node => [node.patentId, node]));
  const companyLookup = new Map(layout.companies.map(node => [node.companyId, node]));

  let activePatentIds = null;
  let activeCompanyIds = null;
  let activeEdgeIds = null;

  if(state.selectedPatentId){
    const item = state.data.items.find(entry => entry.id === state.selectedPatentId);
    activePatentIds = new Set([state.selectedPatentId]);
    activeCompanyIds = new Set((item ? item.companies : []).map(company => company.id));
    activeEdgeIds = new Set((item ? item.companies : []).map(company => `edge:${company.id}->${state.selectedPatentId}`));
  } else if(state.selectedCompanyId){
    const patents = state.data.items.filter(item => item.companies.some(company => company.id === state.selectedCompanyId));
    activePatentIds = new Set(patents.map(item => item.id));
    activeCompanyIds = new Set([state.selectedCompanyId]);
    activeEdgeIds = new Set(patents.map(item => `edge:${state.selectedCompanyId}->${item.id}`));
  }

  $('sequenceCanvas').style.width = `${layout.canvas.width}px`;
  $('sequenceCanvas').style.height = `${layout.canvas.height}px`;
  $('sequenceSvg').setAttribute('viewBox', `0 0 ${layout.canvas.width} ${layout.canvas.height}`);
  $('sequenceSvg').setAttribute('width', String(layout.canvas.width));
  $('sequenceSvg').setAttribute('height', String(layout.canvas.height));

  const axisLine = `<line class="sequence-axis-line" x1="${layout.axis.x}" x2="${layout.axis.x}" y1="${layout.axis.y1}" y2="${layout.axis.y2}"></line>`;
  const edges = layout.edges.map(edge => {
    const company = companyLookup.get(edge.companyId);
    const patent = patentLookup.get(edge.patentId);
    const start = company.side === 'left'
      ? { x: company.x + company.width, y: company.y + company.height / 2 }
      : { x: company.x, y: company.y + company.height / 2 };
    const end = company.side === 'left'
      ? { x: patent.x, y: patent.y + patent.height / 2 }
      : { x: patent.x + patent.width, y: patent.y + patent.height / 2 };
    const active = activeEdgeIds ? activeEdgeIds.has(edge.id) : false;
    const dimmed = activeEdgeIds ? !active : false;
    return `<path class="sequence-edge ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''}" d="${buildPath(start, end)}"></path>`;
  }).join('');
  $('sequenceSvg').innerHTML = axisLine + edges;

  $('sequenceAxisLabels').innerHTML = layout.patents.map(node => {
    return `<div class="axis-chip" style="left:${layout.axis.x}px;top:${node.y - 10}px">ID ${esc(node.patentId)}</div>`;
  }).join('');

  $('sequenceNodes').innerHTML = layout.companies.map(node => {
    const active = activeCompanyIds ? activeCompanyIds.has(node.companyId) : false;
    const dimmed = activeCompanyIds ? !activeCompanyIds.has(node.companyId) : false;
    return `<button class="sequence-node company ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''}" type="button" data-node-kind="company" data-company-id="${esc(node.companyId)}" style="left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px"><span class="node-badge">invest 企业</span><span class="node-title">${esc(node.name)}</span><span class="node-meta">${esc(node.companyId)} · 当前页关联 ${node.patentIds.length} 条</span></button>`;
  }).join('') + layout.patents.map(node => {
    const active = activePatentIds ? activePatentIds.has(node.patentId) : false;
    const dimmed = activePatentIds ? !activePatentIds.has(node.patentId) : false;
    const titleHtml = highlightKeyword(node.title);
    const companyText = node.companyCount ? `${node.companyCount} 家关联企业` : '未关联企业';
    return `<button class="sequence-node patent ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''}" type="button" data-node-kind="patent" data-patent-id="${esc(node.patentId)}" style="left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px"><span class="node-badge">ID 顺序</span><span class="node-title">${titleHtml}</span><span class="node-meta">${esc(node.patentId)} · ${esc(node.patentType)} · ${esc(companyText)}</span></button>`;
  }).join('');

  $('sequenceNodes').addEventListener('click', onSequenceNodeClick, { once: true });
}

function onSequenceNodeClick(event){
  const companyButton = event.target.closest('[data-company-id]');
  if(companyButton){
    selectCompany(companyButton.dataset.companyId);
    return;
  }
  const patentButton = event.target.closest('[data-patent-id]');
  if(patentButton){
    selectPatent(patentButton.dataset.patentId);
  }
}

function renderEvidence(){
  if(state.loading){
    $('sequenceDetail').innerHTML = '<div class="empty">查询完成后可查看命中证据与关联企业。</div>';
    return;
  }
  if(state.error){
    $('sequenceDetail').innerHTML = `<div class="empty">${esc(state.error)}</div>`;
    return;
  }
  if(!state.data || !state.data.items.length){
    $('sequenceDetail').innerHTML = '<div class="empty">当前没有可展示的专利序列证据。</div>';
    return;
  }

  if(state.selectedPatentId){
    const item = state.data.items.find(entry => entry.id === state.selectedPatentId);
    if(item){
      $('sequenceDetail').innerHTML = `<h3>${highlightKeyword(item.title)}</h3><p>专利记录 ID：${esc(item.id)}<br>源类型：${esc(item.patentType)}<br>命中方式：标题字面包含“${esc(state.submittedKeyword)}”</p><p class="muted">中央轴按专利 ID 数值升序排列，仅表示阅读顺序；ID 模拟顺序不是真实时间，也不代表技术继承。</p><p>${item.companyCount ? `当前页关联企业 ${item.companyCount} 家：` : '当前页未关联企业。'}</p><ul>${item.companies.map(company => `<li>${esc(company.name)}（${esc(company.id)}）</li>`).join('') || '<li>未关联企业</li>'}</ul><pre>${esc(JSON.stringify({ '@id': item.id, '@type': 'patent', name: item.title, patentType: item.patentType }, null, 2))}</pre>`;
      return;
    }
  }

  if(state.selectedCompanyId){
    const companyMap = new Map();
    state.data.items.forEach(item => {
      item.companies.forEach(company => {
        if(company.id === state.selectedCompanyId){
          companyMap.set(company.id, {
            company,
            patents: []
          });
        }
      });
    });
    const entry = companyMap.get(state.selectedCompanyId);
    if(entry){
      state.data.items.forEach(item => {
        if(item.companies.some(company => company.id === state.selectedCompanyId)){
          entry.patents.push(item);
        }
      });
      $('sequenceDetail').innerHTML = `<h3>${esc(entry.company.name)}</h3><p>invest 公司 ID：${esc(entry.company.id)}${entry.company.address ? `<br>地址：${esc(entry.company.address)}` : ''}</p><p>当前页关联专利 ${entry.patents.length} 条。企业—专利边来自真实 applyPatent 关系；左右分侧仅用于布局，不表示类别或优劣。</p><ul>${entry.patents.map(item => `<li>${esc(item.id)} · ${highlightKeyword(item.title)}</li>`).join('')}</ul>`;
      return;
    }
  }

  $('sequenceDetail').innerHTML = `<h3>检索摘要</h3><p>当前关键词：${esc(state.submittedKeyword)}<br>匹配专利：${state.data.totalPatents.toLocaleString()} 条<br>匹配企业：${state.data.totalCompanies.toLocaleString()} 家</p><p class="muted">页面展示完整 invest 数据上的标题检索结果。相同专利 ID 共用节点；同标题不同 ID 不合并；共同关联只表示当前数据中存在真实申请关系。</p>`;
}

function render(){
  renderStats();
  renderGraph();
  renderEvidence();
}

$('sequenceKeyword').addEventListener('input', event => {
  state.keywordInput = event.target.value;
});

$('sequenceKeyword').addEventListener('keydown', event => {
  if(event.key === 'Enter'){
    submitQuery();
  }
});

$('runSequenceSearch').addEventListener('click', submitQuery);

$('prevPage').addEventListener('click', () => {
  if(state.data && state.data.page > 1){
    state.page = state.data.page - 1;
    state.selectedPatentId = null;
    state.selectedCompanyId = null;
    fetchSequence();
  }
});

$('nextPage').addEventListener('click', () => {
  if(state.data && state.data.page < state.data.totalPages){
    state.page = state.data.page + 1;
    state.selectedPatentId = null;
    state.selectedCompanyId = null;
    fetchSequence();
  }
});

$('clearSequenceSelection').addEventListener('click', clearSelection);

readInitialState();
$('sequenceKeyword').value = state.keywordInput;
fetchSequence();
