const $ = id => document.getElementById(id);
const matrix = DemoOverview.buildMatrix(DATA);
const state = {
  selectedCompanyId: DATA[0] ? String(DATA[0].invest_id) : null,
  selectedPatentId: null,
  selectedDetailNodeId: null,
  patentLimit: 6,
  industryExpanded: true,
  patentType: '',
  overviewFilter: null,
  overviewExpanded: false,
  eventsExpanded: false,
  search: ''
};

function readInitialState(){
  const params = new URLSearchParams(window.location.search);
  const company = params.get('company');
  const patent = params.get('patent');
  const type = params.get('type');

  if(company && DATA.some(item => String(item.invest_id) === String(company))){
    state.selectedCompanyId = String(company);
  }
  if(type){
    state.patentType = type;
  }
  if(patent){
    state.selectedPatentId = String(patent);
    state.selectedDetailNodeId = `patent:${patent}`;
  }
}

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getCompanyPatentTypes(company){
  return company ? DemoOverview.getPatentTypes([company]) : [];
}

function getFilteredCompanies(){
  return DemoOverview.filterCompanies(DATA, state.overviewFilter, state.search);
}

function getSelectedCompany(filteredCompanies){
  const selected = filteredCompanies.find(company => String(company.invest_id) === state.selectedCompanyId);
  if(selected){
    return selected;
  }
  const fallback = filteredCompanies[0] || null;
  state.selectedCompanyId = fallback ? String(fallback.invest_id) : null;
  state.selectedPatentId = null;
  state.selectedDetailNodeId = null;
  return fallback;
}

function getTypeFilteredRecords(company){
  if(!company){
    return [];
  }
  return (company.records || []).filter(record => {
    return !state.patentType || DemoOverview.normalizePatentType(record.patentType) === state.patentType;
  });
}

function getCurrentGraph(company){
  return DemoGraphModel.buildGraphModel(company, {
    patentType: state.patentType,
    patentLimit: state.patentLimit,
    showIndustry: state.industryExpanded
  });
}

function getPathState(model){
  if(!state.selectedPatentId){
    return null;
  }
  const patentNodeId = `patent:${state.selectedPatentId}`;
  return model.pathLookup[patentNodeId] || null;
}

function renderOverview(filteredCompanies){
  $('matrixColumns').colSpan = Math.max(matrix.patentTypes.length, 1);
  $('matrixColumns').textContent = '专利源类型（主数值为去重企业数）';
  $('matrixWrap').hidden = !state.overviewExpanded;
  $('toggleOverview').textContent = state.overviewExpanded ? '折叠概览矩阵' : '展开概览矩阵';
  $('toggleOverview').setAttribute('aria-expanded', String(state.overviewExpanded));
  $('matrixBody').innerHTML = matrix.industries.map(industry => {
    const cells = matrix.patentTypes.map(type => {
      const companies = DemoOverview.getCellCompanies(matrix, industry, type);
      const count = companies.length;
      const active = state.overviewFilter && state.overviewFilter.industry === industry && state.overviewFilter.type === type;
      const stateLabel = active ? '已选' : (count ? '可筛选' : '无样本');
      return `<td data-cell><button class="matrix-cell" type="button" data-industry="${esc(industry)}" data-type="${esc(type)}" aria-pressed="${active ? 'true' : 'false'}" ${count ? '' : 'disabled'}><span class="matrix-count">${count}</span><span class="matrix-meta">${esc(type)}<br>企业去重计数</span><span class="matrix-state">${stateLabel}</span></button></td>`;
    }).join('');
    return `<tr><td>${esc(industry)}</td>${cells}</tr>`;
  }).join('');

  const companyCount = filteredCompanies.length;
  $('overviewSummary').textContent = state.overviewFilter
    ? `已筛选：${state.overviewFilter.industry} × ${state.overviewFilter.type}（${companyCount} 家样本企业）`
    : '当前未选择概览单元格';
  $('clearOverview').disabled = !state.overviewFilter;
}

function renderCompanies(filteredCompanies, selectedCompany){
  $('companyScope').textContent = state.overviewFilter
    ? `当前为 ${state.overviewFilter.industry} × ${state.overviewFilter.type} 的 ${filteredCompanies.length} 家样本企业；搜索仅在该候选集合内生效`
    : `按专利关联数选取的 ${DATA.length} 家候选企业`;
  $('companies').innerHTML = filteredCompanies.length
    ? filteredCompanies.map(company => {
        const active = selectedCompany && String(company.invest_id) === String(selectedCompany.invest_id);
        const industryText = (company.industry || []).join(' / ') || '行业未提供';
        return `<button class="company ${active ? 'active' : ''}" type="button" data-company="${esc(company.invest_id)}" aria-pressed="${active ? 'true' : 'false'}">${esc(company.name)}<small>${company.patents.toLocaleString()} 条申请关系 · ${esc(industryText)}</small></button>`;
      }).join('')
    : '<div class="empty">当前筛选条件下没有企业样本。可清除概览筛选或修改搜索词。</div>';
}

function renderTypeSelect(company){
  const types = getCompanyPatentTypes(company);
  $('type').innerHTML = '<option value="">全部源类型</option>' + types.map(type => {
    return `<option value="${esc(type)}">${esc(type)}</option>`;
  }).join('');
  $('type').disabled = !company;
  if(company && state.patentType && !types.includes(state.patentType)){
    state.patentType = '';
  }
  $('type').value = state.patentType;
}

function renderEvidence(company, model){
  if(!company){
    $('detail').innerHTML = '<div class="empty">当前没有可展示的关系证据。请调整概览筛选或搜索条件。</div>';
    return;
  }

  const selectedPatentNodeId = state.selectedPatentId ? `patent:${state.selectedPatentId}` : null;
  const detailNodeId = state.selectedDetailNodeId || selectedPatentNodeId;
  const node = model.nodes.find(item => item.id === detailNodeId) || null;

  if(!node){
    $('detail').innerHTML = `<h3>${esc(company.name)}</h3><p>invest 公司 ID：${esc(company.invest_id)}<br>EKG 来源 ID：${esc((company.ekg_ids || []).join(' / ') || '未提供')}</p><p>匹配依据：规范化企业全名一致。当前仍是同名候选，尚未独立核验。</p><p class="muted">点击关系图中的行业、来源企业或专利节点，可以查看对应证据。当前 demo 只覆盖选取的 30 家样本企业，不能视为全库结果。</p>`;
    return;
  }

  if(node.kind === 'patent'){
    $('detail').innerHTML = `<h3>${esc(node.label)}</h3><p>invest 公司 ID：${esc(company.invest_id)}<br>EKG 来源 ID：${esc((company.ekg_ids || []).join(' / ') || '未提供')}</p><p>关系：applyPatent<br>专利记录 ID：${esc(node.sourceId)}<br>源类型：${esc(node.badge)}</p><p>匹配依据：规范化企业全名一致。跨库对齐仍为同名候选，未自动审核。</p><p class="muted">标题相同的专利记录不会自动合并；当前展示的是 invest 原始源类型，不代表技术主题。</p><pre>${esc(JSON.stringify(node.record, null, 2))}</pre>`;
    return;
  }

  $('detail').innerHTML = `<h3>${esc(node.evidence.title)}</h3><p>${esc(node.evidence.summary)}</p><ul>${node.evidence.lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` + (node.kind === 'ekg'
    ? `<p class="muted">该节点只表示 EKG 来源记录，不代表已完成跨源身份确认。</p>`
    : node.kind === 'invest'
      ? `<p class="muted">该节点展示的是 invest 源属性；行业归属来自 EKG 上市来源记录，而不是 invest 自身字段。</p>`
      : `<p class="muted">该节点是行业分类标签，用于阅读导航，不代表供应方向。</p>`);
}

function renderGraph(company, model){
  if(!company){
    $('graphCanvas').style.height = '240px';
    $('graphCanvas').style.width = '100%';
    $('graphSvg').setAttribute('viewBox', '0 0 1240 240');
    $('graphSvg').innerHTML = '';
    $('graphLabels').innerHTML = '';
    $('graphNodes').innerHTML = '<div class="empty">当前没有关系图可展示。请调整筛选或选择企业。</div>';
    $('graphSummary').textContent = '当前未选择专利路径';
    $('clearPath').disabled = true;
    return;
  }

  const layout = DemoGraphLayout.layoutGraph(model);
  const pathState = getPathState(model);
  const activeNodeIds = pathState ? new Set(pathState.nodeIds) : null;
  const activeEdgeIds = pathState ? new Set(pathState.edgeIds) : null;

  $('graphCanvas').style.width = `${layout.canvas.width}px`;
  $('graphCanvas').style.height = `${layout.canvas.height}px`;
  $('graphSvg').setAttribute('viewBox', `0 0 ${layout.canvas.width} ${layout.canvas.height}`);
  $('graphSvg').setAttribute('width', String(layout.canvas.width));
  $('graphSvg').setAttribute('height', String(layout.canvas.height));

  $('graphSvg').innerHTML = layout.edges.map(edge => {
    const active = activeEdgeIds ? activeEdgeIds.has(edge.id) : false;
    const dimmed = activeEdgeIds ? !active : false;
    return `<path class="graph-edge ${edge.dashed ? 'dashed' : ''} ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''}" data-edge-id="${esc(edge.id)}" d="${edge.path}"></path>`;
  }).join('');

  $('graphLabels').innerHTML = layout.edges.map(edge => {
    const active = activeEdgeIds ? activeEdgeIds.has(edge.id) : false;
    const dimmed = activeEdgeIds ? !active : false;
    return `<div class="edge-label ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''}" style="left:${edge.labelX}px;top:${edge.labelY}px">${esc(edge.label)}</div>`;
  }).join('');

  $('graphNodes').innerHTML = layout.nodes.map(node => {
    const active = activeNodeIds ? activeNodeIds.has(node.id) : (state.selectedDetailNodeId === node.id);
    const dimmed = activeNodeIds ? !activeNodeIds.has(node.id) : false;
    const metaLine = node.kind === 'patent'
      ? `${node.sourceId} · ${node.badge}`
      : node.kind === 'industry'
        ? '分类标签'
        : `${node.sourceId || '来源缺失'}${node.kind === 'ekg' && !node.hasIndustryEvidence ? ' · 无上市归属边' : ''}`;
    return `<button class="graph-node ${esc(node.kind)} ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''}" type="button" data-node-id="${esc(node.id)}" data-node-kind="${esc(node.kind)}" aria-pressed="${active ? 'true' : 'false'}" style="left:${node.frame.x}px;top:${node.frame.y}px;width:${node.frame.width}px;height:${node.frame.height}px"><span class="node-badge">${esc(node.badge)}</span><span class="node-title">${esc(node.shortLabel)}</span><span class="node-meta">${esc(metaLine)}</span></button>`;
  }).join('');

  $('graphSummary').textContent = state.selectedPatentId
    ? `已高亮专利路径：${state.selectedPatentId}`
    : '当前未选择专利路径';
  $('clearPath').disabled = !state.selectedPatentId;
}

function renderEvents(company){
  $('toggleEvents').setAttribute('aria-expanded', String(state.eventsExpanded));
  $('toggleEvents').textContent = state.eventsExpanded ? '收起历史融资事件' : '展开历史融资事件';
  $('eventsBody').hidden = !state.eventsExpanded;

  if(!company){
    $('events').innerHTML = '<p class="muted">暂无可展示的投资事件。</p>';
    return;
  }
  $('events').innerHTML = (company.events || []).length
    ? company.events.map(event => `<div class="event">${esc(event.date)} · ${esc(event.round || '轮次未提供')}<br>${esc(event.investor)}</div>`).join('')
    : '<p class="muted">本样本未观测到该企业的投资事件。不能据此判断企业未获得投资。</p>';
}

function renderWorkspace(company){
  renderTypeSelect(company);

  if(!company){
    $('count').textContent = '0';
    $('shown').textContent = '0 / 0';
    $('eventCount').textContent = '0';
    $('toolbarNote').textContent = state.overviewFilter
      ? `当前概览筛选为 ${state.overviewFilter.industry} × ${state.overviewFilter.type}，但没有命中企业样本。`
      : '请选择企业查看关系图、路径高亮和原始证据。';
    $('left').textContent = state.industryExpanded ? '收起行业侧' : '展开行业侧';
    $('more').disabled = true;
    $('less').disabled = true;
    renderGraph(null, { nodes: [], edges: [], pathLookup: {}, metadata: {} });
    renderEvents(null);
    renderEvidence(null, { nodes: [] });
    return;
  }

  const model = getCurrentGraph(company);
  const visiblePatentIds = new Set(model.nodes.filter(node => node.kind === 'patent').map(node => node.sourceId));
  if(state.selectedPatentId && !visiblePatentIds.has(state.selectedPatentId)){
    state.selectedPatentId = null;
  }
  if(state.selectedDetailNodeId && !model.nodes.find(node => node.id === state.selectedDetailNodeId)){
    state.selectedDetailNodeId = null;
  }

  $('count').textContent = company.patents.toLocaleString();
  $('shown').textContent = `${model.metadata.visiblePatentCount} / ${model.metadata.totalFilteredPatents}`;
  $('eventCount').textContent = (company.events || []).length;
  $('toolbarNote').textContent = state.overviewFilter
    ? `当前概览筛选：${state.overviewFilter.industry} × ${state.overviewFilter.type}。若你手动改动源类型筛选，矩阵筛选会同步取消，避免状态不一致。`
    : (state.patentType
      ? `当前按源类型“${state.patentType}”筛选关系图，只展示该类型下已展开的专利源记录。`
      : '当前展示该企业全部源类型下已展开的专利源记录。行业分类边仅在 EKG 上市来源存在时绘制。');
  $('left').textContent = state.industryExpanded ? '收起行业侧' : '展开行业侧';
  $('more').disabled = model.metadata.visiblePatentCount >= model.metadata.totalFilteredPatents;
  $('less').disabled = model.metadata.visiblePatentCount === 0;

  renderGraph(company, model);
  renderEvents(company);
  renderEvidence(company, model);
}

function render(){
  const filteredCompanies = getFilteredCompanies();
  const selectedCompany = getSelectedCompany(filteredCompanies);
  renderOverview(filteredCompanies);
  renderCompanies(filteredCompanies, selectedCompany);
  renderWorkspace(selectedCompany);
}

function chooseCompany(companyId){
  state.selectedCompanyId = String(companyId);
  state.selectedPatentId = null;
  state.selectedDetailNodeId = null;
  state.patentLimit = 6;
  state.industryExpanded = true;
  render();
}

function applyOverviewFilter(industry, type){
  state.overviewFilter = { industry, type };
  state.overviewExpanded = false;
  state.search = '';
  $('search').value = '';
  state.patentType = type;
  state.selectedPatentId = null;
  state.selectedDetailNodeId = null;
  state.patentLimit = 6;
  render();
}

function clearOverviewFilter(){
  state.overviewFilter = null;
  state.search = '';
  $('search').value = '';
  state.patentType = '';
  state.selectedPatentId = null;
  state.selectedDetailNodeId = null;
  state.patentLimit = 6;
  render();
}

function setPatentType(value){
  if(state.overviewFilter && state.overviewFilter.type !== value){
    state.overviewFilter = null;
  }
  state.patentType = value;
  state.selectedPatentId = null;
  state.selectedDetailNodeId = null;
  state.patentLimit = 6;
  render();
}

$('search').addEventListener('input', event => {
  state.search = event.target.value.trim();
  render();
});

$('companies').addEventListener('click', event => {
  const button = event.target.closest('[data-company]');
  if(button){
    chooseCompany(button.dataset.company);
  }
});

$('matrixBody').addEventListener('click', event => {
  const button = event.target.closest('[data-industry][data-type]');
  if(button && !button.disabled){
    applyOverviewFilter(button.dataset.industry, button.dataset.type);
  }
});

$('graphNodes').addEventListener('click', event => {
  const button = event.target.closest('[data-node-id]');
  if(!button){
    return;
  }
  const nodeId = button.dataset.nodeId;
  const kind = button.dataset.nodeKind;
  state.selectedDetailNodeId = nodeId;
  state.selectedPatentId = kind === 'patent' ? nodeId.replace(/^patent:/, '') : null;
  render();
});

$('more').addEventListener('click', () => {
  state.patentLimit += 6;
  render();
});

$('less').addEventListener('click', () => {
  state.patentLimit = 0;
  state.selectedPatentId = null;
  state.selectedDetailNodeId = null;
  render();
});

$('left').addEventListener('click', () => {
  state.industryExpanded = !state.industryExpanded;
  state.selectedPatentId = null;
  render();
});

$('type').addEventListener('change', event => {
  setPatentType(event.target.value);
});

$('clearOverview').addEventListener('click', clearOverviewFilter);

$('toggleOverview').addEventListener('click', () => {
  state.overviewExpanded = !state.overviewExpanded;
  render();
});

$('clearPath').addEventListener('click', () => {
  state.selectedPatentId = null;
  if(state.selectedDetailNodeId && state.selectedDetailNodeId.startsWith('patent:')){
    state.selectedDetailNodeId = null;
  }
  render();
});

$('toggleEvents').addEventListener('click', () => {
  state.eventsExpanded = !state.eventsExpanded;
  render();
});

readInitialState();
render();
