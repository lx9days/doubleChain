const $ = id => document.getElementById(id);

const CAMERA_LIMITS = {
  minZoom: 0.03,
  maxZoom: 6
};

const state = {
  keywordInput: '通信',
  idStartInput: '',
  idEndInput: '',
  query: {
    keyword: '通信',
    idStart: '',
    idEnd: ''
  },
  data: null,
  model: null,
  layout: null,
  camera: null,
  viewport: { width: 1, height: 1 },
  minimapSize: { width: 220, height: 150 },
  loading: false,
  error: '',
  status: '',
  selection: null,
  layoutMs: 0,
  abortController: null,
  requestId: 0,
  pointer: null,
  minimapPointer: null
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
  const keyword = params.get('q');
  const idStart = params.get('idStart');
  const idEnd = params.get('idEnd');

  if(keyword && keyword.trim()){
    state.query.keyword = keyword.trim();
    state.keywordInput = state.query.keyword;
  }
  if(idStart && idStart.trim()){
    state.query.idStart = idStart.trim();
    state.idStartInput = state.query.idStart;
  }
  if(idEnd && idEnd.trim()){
    state.query.idEnd = idEnd.trim();
    state.idEndInput = state.query.idEnd;
  }
}

function updateUrl(){
  const params = new URLSearchParams();
  if(state.query.keyword){
    params.set('q', state.query.keyword);
  }
  if(state.query.idStart){
    params.set('idStart', state.query.idStart);
  }
  if(state.query.idEnd){
    params.set('idEnd', state.query.idEnd);
  }
  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

function formatCurrentQuery(){
  const parts = [];
  if(state.query.keyword){
    parts.push(`关键词 ${state.query.keyword}`);
  }
  if(state.query.idStart || state.query.idEnd){
    parts.push(`ID 区间 ${state.query.idStart || '-∞'} ~ ${state.query.idEnd || '+∞'}`);
  }
  return parts.length ? parts.join('，') : '未设置';
}

function getCanvasPoint(event, canvas){
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function updateCanvasSize(){
  const canvas = $('canvasSurface');
  const minimap = $('minimapCanvas');
  const dpr = window.devicePixelRatio || 1;

  const canvasRect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(canvasRect.width * dpr));
  canvas.height = Math.max(1, Math.round(canvasRect.height * dpr));
  state.viewport = {
    width: Math.max(1, canvasRect.width),
    height: Math.max(1, canvasRect.height),
    dpr
  };

  const minimapRect = minimap.getBoundingClientRect();
  minimap.width = Math.max(1, Math.round(minimapRect.width * dpr));
  minimap.height = Math.max(1, Math.round(minimapRect.height * dpr));
  state.minimapSize = {
    width: Math.max(1, minimapRect.width),
    height: Math.max(1, minimapRect.height),
    dpr
  };

  if(state.layout && state.camera){
    state.camera = DemoInvestCanvasCamera.clampCamera({
      x: state.camera.x,
      y: state.camera.y,
      zoom: state.camera.zoom
    }, state.layout.world, state.viewport);
  }

  renderAll();
}

function abortActiveRequest(reason){
  if(state.abortController){
    state.abortController.abort(reason || 'cancelled');
    state.abortController = null;
  }
}

function buildModel(data){
  const patentById = new Map();
  const companyById = new Map();
  const companyToPatentIds = new Map();

  data.items.forEach(item => {
    patentById.set(item.id, item);
    item.companies.forEach(company => {
      if(!companyById.has(company.id)){
        companyById.set(company.id, company);
      }
      if(!companyToPatentIds.has(company.id)){
        companyToPatentIds.set(company.id, []);
      }
      companyToPatentIds.get(company.id).push(item.id);
    });
  });

  return {
    patentById,
    companyById,
    companyToPatentIds
  };
}

function buildLayout(data){
  const startedAt = performance.now();
  const layout = DemoInvestCanvasLayout.buildInvestCanvasLayout(data.items);
  state.layoutMs = Math.round((performance.now() - startedAt) * 10) / 10;
  return layout;
}

function setDataResult(data){
  state.data = data;
  state.model = buildModel(data);
  state.layout = buildLayout(data);
  state.selection = null;
  state.camera = DemoInvestCanvasCamera.fitCameraToBounds(state.layout.world, state.viewport, CAMERA_LIMITS);
}

async function fetchCanvasData(){
  abortActiveRequest('new-request');
  const requestId = ++state.requestId;
  const controller = new AbortController();
  state.abortController = controller;
  state.loading = true;
  state.error = '';
  state.status = '正在读取完整 invest 结果并构建全部画布模型…';
  state.data = null;
  state.model = null;
  state.layout = null;
  state.selection = null;
  renderAll();

  const params = new URLSearchParams();
  if(state.query.keyword){
    params.set('keyword', state.query.keyword);
  }
  if(state.query.idStart){
    params.set('idStart', state.query.idStart);
  }
  if(state.query.idEnd){
    params.set('idEnd', state.query.idEnd);
  }

  try{
    const response = await fetch(`/api/invest-canvas?${params.toString()}`, {
      signal: controller.signal
    });
    const payload = await response.json();
    if(requestId !== state.requestId){
      return;
    }
    if(!response.ok){
      throw new Error(payload.message || `查询失败：${response.status}`);
    }
    setDataResult(payload);
    state.status = `查询 ${payload.queryMs} ms，布局 ${state.layoutMs} ms。已加载全部 ${payload.totalPatents.toLocaleString()} 条命中专利。`;
    updateUrl();
  } catch (error){
    if(requestId !== state.requestId){
      return;
    }
    if(error.name === 'AbortError'){
      state.status = '本次查询已取消。';
    } else {
      state.error = error.message || '查询失败';
      state.status = '';
    }
  } finally {
    if(requestId === state.requestId){
      state.loading = false;
      if(state.abortController === controller){
        state.abortController = null;
      }
      renderAll();
    }
  }
}

function submitQuery(){
  state.query.keyword = state.keywordInput.trim();
  state.query.idStart = state.idStartInput.trim();
  state.query.idEnd = state.idEndInput.trim();
  fetchCanvasData();
}

function clearSelection(){
  state.selection = null;
  renderAll();
}

function getSelectionSets(){
  if(!state.selection || !state.model){
    return null;
  }

  if(state.selection.kind === 'patent'){
    const item = state.model.patentById.get(state.selection.id);
    const companyIds = new Set((item ? item.companies : []).map(company => company.id));
    return {
      activePatentIds: new Set([state.selection.id]),
      activeCompanyIds: companyIds,
      activeEdgeIds: new Set(Array.from(companyIds).map(companyId => `edge:${companyId}->${state.selection.id}`))
    };
  }

  if(state.selection.kind === 'company'){
    const patentIds = state.model.companyToPatentIds.get(state.selection.id) || [];
    return {
      activePatentIds: new Set(patentIds),
      activeCompanyIds: new Set([state.selection.id]),
      activeEdgeIds: new Set(patentIds.map(patentId => `edge:${state.selection.id}->${patentId}`))
    };
  }

  return null;
}

function roundRect(ctx, x, y, width, height, radius){
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawNode(ctx, node, selectionSets){
  const topLeft = DemoInvestCanvasCamera.worldToScreen({ x: node.x, y: node.y }, state.camera);
  const width = node.width * state.camera.zoom;
  const height = node.height * state.camera.zoom;
  const visible = topLeft.x + width >= -40 && topLeft.x <= state.viewport.width + 40 && topLeft.y + height >= -40 && topLeft.y <= state.viewport.height + 40;
  if(!visible){
    return;
  }

  const isPatent = node.kind === 'patent';
  const active = selectionSets
    ? (isPatent ? selectionSets.activePatentIds.has(node.patentId) : selectionSets.activeCompanyIds.has(node.companyId))
    : false;
  const dimmed = selectionSets
    ? (isPatent ? !selectionSets.activePatentIds.has(node.patentId) : !selectionSets.activeCompanyIds.has(node.companyId))
    : false;

  ctx.save();
  ctx.globalAlpha = dimmed ? 0.25 : 1;
  ctx.fillStyle = isPatent ? '#ffffff' : '#eef7fb';
  ctx.strokeStyle = active ? '#0a7488' : '#bfd3e0';
  ctx.lineWidth = active ? 2.4 : 1.2;
  roundRect(ctx, topLeft.x, topLeft.y, width, height, Math.max(6, 10 * state.camera.zoom));
  ctx.fill();
  ctx.stroke();

  if(isPatent){
    const baseFont = state.camera.zoom >= 0.55 ? 11 : 10;
    if(state.camera.zoom >= 0.22){
      ctx.fillStyle = '#5f7586';
      ctx.font = `${Math.max(10, baseFont)}px "Microsoft YaHei", sans-serif`;
      ctx.fillText(node.patentId, topLeft.x + 6, topLeft.y + 14);
    }
    if(state.camera.zoom >= 0.8){
      ctx.fillStyle = '#223248';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText(node.title.slice(0, 16), topLeft.x + 6, topLeft.y + 30);
    }
  } else if(state.camera.zoom >= 0.35){
    ctx.fillStyle = '#223248';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillText(node.name.slice(0, 14), topLeft.x + 8, topLeft.y + 18);
    ctx.fillStyle = '#5f7586';
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${node.companyId} · ${node.degree} 条`, topLeft.x + 8, topLeft.y + 34);
  }

  ctx.restore();
}

function drawEdge(ctx, edge, selectionSets, companyLookup, patentLookup){
  const company = companyLookup.get(edge.companyId);
  const patent = patentLookup.get(edge.patentId);
  if(!company || !patent){
    return;
  }

  const start = DemoInvestCanvasCamera.worldToScreen({
    x: company.x + company.width / 2,
    y: company.y + company.height
  }, state.camera);
  const end = DemoInvestCanvasCamera.worldToScreen({
    x: patent.x + patent.width / 2,
    y: patent.y
  }, state.camera);

  const active = selectionSets ? selectionSets.activeEdgeIds.has(edge.id) : false;
  const dimmed = selectionSets ? !active : false;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(start.x, (start.y + end.y) / 2);
  ctx.lineTo(end.x, (start.y + end.y) / 2);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = active ? '#0a7488' : '#9cb1c2';
  ctx.lineWidth = active ? 2.4 : 1;
  ctx.globalAlpha = dimmed ? 0.08 : (active ? 0.95 : 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawCanvasMessage(message){
  const canvas = $('canvasSurface');
  const ctx = canvas.getContext('2d');
  const dpr = state.viewport.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  ctx.fillStyle = '#f6fbfe';
  ctx.fillRect(0, 0, state.viewport.width, state.viewport.height);
  ctx.fillStyle = '#5f7586';
  ctx.font = '14px "Microsoft YaHei", sans-serif';
  ctx.fillText(message, 24, 36);
}

function renderMainCanvas(){
  if(state.loading){
    drawCanvasMessage('正在加载全部命中结果...');
    return;
  }
  if(state.error){
    drawCanvasMessage(state.error);
    return;
  }
  if(!state.layout || !state.camera){
    drawCanvasMessage('等待检索结果。');
    return;
  }

  const canvas = $('canvasSurface');
  const ctx = canvas.getContext('2d');
  const dpr = state.viewport.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  ctx.fillStyle = '#f6fbfe';
  ctx.fillRect(0, 0, state.viewport.width, state.viewport.height);

  const companyLookup = new Map(state.layout.companies.map(company => [company.companyId, company]));
  const patentLookup = new Map(state.layout.patents.map(patent => [patent.patentId, patent]));
  const selectionSets = getSelectionSets();

  const axisStart = DemoInvestCanvasCamera.worldToScreen({ x: 0, y: state.layout.patentBaselineY + 22 }, state.camera);
  const axisEnd = DemoInvestCanvasCamera.worldToScreen({ x: state.layout.world.width, y: state.layout.patentBaselineY + 22 }, state.camera);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(axisStart.x, axisStart.y);
  ctx.lineTo(axisEnd.x, axisEnd.y);
  ctx.strokeStyle = '#d0dce5';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  state.layout.edges.forEach(edge => drawEdge(ctx, edge, selectionSets, companyLookup, patentLookup));
  state.layout.companies.forEach(company => drawNode(ctx, company, selectionSets));
  state.layout.patents.forEach(patent => drawNode(ctx, patent, selectionSets));
}

function renderMinimap(){
  const canvas = $('minimapCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = state.minimapSize.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, state.minimapSize.width, state.minimapSize.height);
  ctx.fillStyle = '#f7fbfe';
  ctx.fillRect(0, 0, state.minimapSize.width, state.minimapSize.height);

  if(!state.layout || !state.camera){
    ctx.fillStyle = '#708592';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillText('等待结果', 12, 22);
    return;
  }

  const bounds = state.layout.world;
  const selectionSets = getSelectionSets();
  const companyLookup = new Map(state.layout.companies.map(company => [company.companyId, company]));
  const patentLookup = new Map(state.layout.patents.map(patent => [patent.patentId, patent]));

  ctx.strokeStyle = '#d3e0e8';
  ctx.strokeRect(0.5, 0.5, state.minimapSize.width - 1, state.minimapSize.height - 1);

  state.layout.edges.forEach(edge => {
    const company = companyLookup.get(edge.companyId);
    const patent = patentLookup.get(edge.patentId);
    if(!company || !patent){
      return;
    }
    const start = DemoInvestCanvasCamera.worldToMinimap({
      x: company.x + company.width / 2,
      y: company.y + company.height
    }, bounds, state.minimapSize);
    const end = DemoInvestCanvasCamera.worldToMinimap({
      x: patent.x + patent.width / 2,
      y: patent.y
    }, bounds, state.minimapSize);
    const active = selectionSets ? selectionSets.activeEdgeIds.has(edge.id) : false;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = active ? '#0a7488' : '#d2dce4';
    ctx.lineWidth = active ? 1.4 : 0.6;
    ctx.globalAlpha = selectionSets ? (active ? 0.9 : 0.25) : 0.6;
    ctx.stroke();
  });

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#dce7ef';
  state.layout.patents.forEach(patent => {
    const point = DemoInvestCanvasCamera.worldToMinimap({ x: patent.x + patent.width / 2, y: patent.y + patent.height / 2 }, bounds, state.minimapSize);
    ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
  });
  ctx.fillStyle = '#a7c8d8';
  state.layout.companies.forEach(company => {
    const point = DemoInvestCanvasCamera.worldToMinimap({ x: company.x + company.width / 2, y: company.y + company.height / 2 }, bounds, state.minimapSize);
    ctx.fillRect(point.x - 1.5, point.y - 1.5, 3, 3);
  });

  const viewportRect = DemoInvestCanvasCamera.getMinimapViewportRect(state.camera, bounds, state.viewport, state.minimapSize);
  ctx.strokeStyle = '#0a7488';
  ctx.lineWidth = 2;
  ctx.strokeRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height);
}

function renderStats(){
  $('queryBadge').textContent = `当前条件：${formatCurrentQuery()}`;
  $('queryStatus').textContent = state.error || state.status || '等待检索。';
  $('cancelQuery').disabled = !state.loading;

  if(!state.data){
    $('totalPatents').textContent = '0';
    $('totalCompanies').textContent = '0';
    $('totalRelations').textContent = '0';
    $('dataRange').textContent = '完整 invest 数据范围将在查询成功后显示。';
    $('selectionSummary').textContent = '当前未选择节点';
    $('zoomSummary').textContent = `缩放 ${Math.round((state.camera ? state.camera.zoom : 1) * 100)}%`;
    $('canvasSummary').textContent = state.loading ? '正在构建全结果画布模型...' : '等待检索结果...';
    return;
  }

  $('totalPatents').textContent = state.data.totalPatents.toLocaleString();
  $('totalCompanies').textContent = state.data.totalCompanies.toLocaleString();
  $('totalRelations').textContent = state.data.totalRelations.toLocaleString();
  $('dataRange').textContent = `${state.data.meta.sourceLabel}：${state.data.meta.patentCount.toLocaleString()} 条专利 / ${state.data.meta.companyCount.toLocaleString()} 家公司 · 查询 ${state.data.queryMs} ms · 布局 ${state.layoutMs} ms`;
  $('selectionSummary').textContent = state.selection
    ? (state.selection.kind === 'patent' ? `已选专利：${state.selection.id}` : `已选企业：${state.selection.id}`)
    : '当前未选择节点';
  $('zoomSummary').textContent = `缩放 ${Math.round((state.camera ? state.camera.zoom : 1) * 100)}%`;
  $('canvasSummary').textContent = `全部结果：${state.layout.patents.length.toLocaleString()} 条专利 / ${state.layout.companies.length.toLocaleString()} 家企业 / ${state.layout.edges.length.toLocaleString()} 条边 · 世界 ${Math.round(state.layout.world.width)} × ${Math.round(state.layout.world.height)}`;
}

function renderDetail(){
  if(state.loading){
    $('detailPanel').innerHTML = '<div class="empty">查询完成后可查看企业或专利的原始证据。</div>';
    return;
  }

  if(state.error){
    $('detailPanel').innerHTML = `<div class="empty">${esc(state.error)}</div>`;
    return;
  }

  if(!state.data || !state.model){
    $('detailPanel').innerHTML = '<div class="empty">当前没有可展示的全结果证据。</div>';
    return;
  }

  if(state.selection && state.selection.kind === 'patent'){
    const item = state.model.patentById.get(state.selection.id);
    if(item){
      $('detailPanel').innerHTML = `<h3>${esc(item.title)}</h3><p>专利记录 ID：${esc(item.id)}<br>源类型：${esc(item.patentType)}<br>当前筛选命中企业：${item.companyCount}</p><p class="muted">底部横轴仅表示按 ID 排序后的阅读顺序，ID 顺序不是真实时间，也不代表技术传承。</p><ul>${item.companies.map(company => `<li>${esc(company.name)}（${esc(company.id)}）</li>`).join('') || '<li>未关联企业</li>'}</ul><pre>${esc(JSON.stringify({ '@id': item.id, '@type': 'patent', name: item.title, patentType: item.patentType }, null, 2))}</pre>`;
      return;
    }
  }

  if(state.selection && state.selection.kind === 'company'){
    const company = state.model.companyById.get(state.selection.id);
    const patentIds = state.model.companyToPatentIds.get(state.selection.id) || [];
    if(company){
      $('detailPanel').innerHTML = `<h3>${esc(company.name)}</h3><p>invest 公司 ID：${esc(company.id)}${company.address ? `<br>地址：${esc(company.address)}` : ''}<br>当前筛选命中去重专利：${patentIds.length}</p><p class="muted">企业高度只由当前筛选结果中的去重专利数决定，不表示企业全库规模或创新实力。</p><ul>${patentIds.slice(0, 40).map(patentId => {
        const patent = state.model.patentById.get(patentId);
        return `<li>${esc(patentId)} · ${esc(patent ? patent.title : '')}</li>`;
      }).join('')}${patentIds.length > 40 ? `<li>... 其余 ${patentIds.length - 40} 条见画布高亮</li>` : ''}</ul>`;
      return;
    }
  }

  $('detailPanel').innerHTML = `<h3>检索摘要</h3><p>当前条件：${esc(formatCurrentQuery())}<br>匹配专利：${state.data.totalPatents.toLocaleString()} 条<br>关联企业：${state.data.totalCompanies.toLocaleString()} 家<br>申请关系：${state.data.totalRelations.toLocaleString()} 条</p><p class="muted">本页不分页。全部命中专利共用一条底部 ID 顺序轴；企业按当前筛选结果中的去重关联专利数分层，同一企业只显示一个节点，同标题不同 ID 不合并。</p>`;
}

function renderAll(){
  renderStats();
  renderMainCanvas();
  renderMinimap();
  renderDetail();
}

function hitTestNode(worldPoint){
  if(!state.layout){
    return null;
  }

  for(let i = state.layout.companies.length - 1; i >= 0; i -= 1){
    const company = state.layout.companies[i];
    if(worldPoint.x >= company.x && worldPoint.x <= company.x + company.width && worldPoint.y >= company.y && worldPoint.y <= company.y + company.height){
      return { kind: 'company', id: company.companyId };
    }
  }

  for(let i = state.layout.patents.length - 1; i >= 0; i -= 1){
    const patent = state.layout.patents[i];
    if(worldPoint.x >= patent.x && worldPoint.x <= patent.x + patent.width && worldPoint.y >= patent.y && worldPoint.y <= patent.y + patent.height){
      return { kind: 'patent', id: patent.patentId };
    }
  }

  return null;
}

function panByButton(dx, dy){
  if(!state.layout || !state.camera){
    return;
  }
  state.camera = DemoInvestCanvasCamera.panCameraByScreenDelta(state.camera, { x: dx, y: dy }, state.layout.world, state.viewport);
  renderAll();
}

$('canvasSurface').addEventListener('pointerdown', event => {
  if(!state.layout || !state.camera){
    return;
  }
  const screenPoint = getCanvasPoint(event, $('canvasSurface'));
  const worldPoint = DemoInvestCanvasCamera.screenToWorld(screenPoint, state.camera);
  state.pointer = {
    id: event.pointerId,
    start: screenPoint,
    previous: screenPoint,
    hit: hitTestNode(worldPoint),
    moved: false
  };
  $('canvasSurface').setPointerCapture(event.pointerId);
});

$('canvasSurface').addEventListener('pointermove', event => {
  if(!state.pointer || state.pointer.id !== event.pointerId || !state.layout || !state.camera){
    return;
  }
  const screenPoint = getCanvasPoint(event, $('canvasSurface'));
  const dx = screenPoint.x - state.pointer.previous.x;
  const dy = screenPoint.y - state.pointer.previous.y;
  if(!state.pointer.moved && Math.hypot(screenPoint.x - state.pointer.start.x, screenPoint.y - state.pointer.start.y) > 3){
    state.pointer.moved = true;
    $('canvasSurface').classList.add('dragging');
  }
  if(state.pointer.moved){
    state.camera = DemoInvestCanvasCamera.panCameraByScreenDelta(state.camera, { x: dx, y: dy }, state.layout.world, state.viewport);
    renderAll();
  }
  state.pointer.previous = screenPoint;
});

function finishCanvasPointer(event){
  if(!state.pointer || state.pointer.id !== event.pointerId){
    return;
  }
  $('canvasSurface').releasePointerCapture(event.pointerId);
  $('canvasSurface').classList.remove('dragging');
  if(!state.pointer.moved && state.pointer.hit){
    state.selection = state.pointer.hit;
    renderAll();
  }
  state.pointer = null;
}

$('canvasSurface').addEventListener('pointerup', finishCanvasPointer);
$('canvasSurface').addEventListener('pointercancel', finishCanvasPointer);

$('canvasSurface').addEventListener('wheel', event => {
  if(!state.layout || !state.camera){
    return;
  }
  event.preventDefault();
  const screenPoint = getCanvasPoint(event, $('canvasSurface'));
  const factor = event.deltaY < 0 ? 1.15 : (1 / 1.15);
  state.camera = DemoInvestCanvasCamera.zoomAtScreenPoint(state.camera, screenPoint, factor, state.layout.world, state.viewport, CAMERA_LIMITS);
  renderAll();
}, { passive: false });

$('canvasSurface').addEventListener('keydown', event => {
  if(!state.layout || !state.camera){
    return;
  }
  if(event.key === 'ArrowLeft'){
    event.preventDefault();
    panByButton(60, 0);
  } else if(event.key === 'ArrowRight'){
    event.preventDefault();
    panByButton(-60, 0);
  } else if(event.key === 'ArrowUp'){
    event.preventDefault();
    panByButton(0, 60);
  } else if(event.key === 'ArrowDown'){
    event.preventDefault();
    panByButton(0, -60);
  } else if(event.key === '+' || event.key === '='){
    event.preventDefault();
    state.camera = DemoInvestCanvasCamera.zoomAtScreenPoint(state.camera, { x: state.viewport.width / 2, y: state.viewport.height / 2 }, 1.15, state.layout.world, state.viewport, CAMERA_LIMITS);
    renderAll();
  } else if(event.key === '-' || event.key === '_'){
    event.preventDefault();
    state.camera = DemoInvestCanvasCamera.zoomAtScreenPoint(state.camera, { x: state.viewport.width / 2, y: state.viewport.height / 2 }, 1 / 1.15, state.layout.world, state.viewport, CAMERA_LIMITS);
    renderAll();
  } else if(event.key === '0'){
    event.preventDefault();
    state.camera = DemoInvestCanvasCamera.clampCamera({ x: 0, y: 0, zoom: 1 }, state.layout.world, state.viewport);
    renderAll();
  } else if(event.key.toLowerCase() === 'f'){
    event.preventDefault();
    state.camera = DemoInvestCanvasCamera.fitCameraToBounds(state.layout.world, state.viewport, CAMERA_LIMITS);
    renderAll();
  }
});

$('minimapCanvas').addEventListener('pointerdown', event => {
  if(!state.layout || !state.camera){
    return;
  }
  const point = getCanvasPoint(event, $('minimapCanvas'));
  const viewportRect = DemoInvestCanvasCamera.getMinimapViewportRect(state.camera, state.layout.world, state.viewport, state.minimapSize);
  const insideRect = point.x >= viewportRect.x && point.x <= viewportRect.x + viewportRect.width && point.y >= viewportRect.y && point.y <= viewportRect.y + viewportRect.height;
  const worldPoint = DemoInvestCanvasCamera.minimapToWorld(point, state.layout.world, state.minimapSize);
  if(!insideRect){
    state.camera = DemoInvestCanvasCamera.centerCameraOnWorldPoint(state.camera, worldPoint, state.layout.world, state.viewport);
    renderAll();
  }
  state.minimapPointer = {
    id: event.pointerId,
    draggingViewport: insideRect,
    offsetX: worldPoint.x - state.camera.x,
    offsetY: worldPoint.y - state.camera.y
  };
  $('minimapCanvas').setPointerCapture(event.pointerId);
});

$('minimapCanvas').addEventListener('pointermove', event => {
  if(!state.minimapPointer || state.minimapPointer.id !== event.pointerId || !state.layout || !state.camera){
    return;
  }
  if(!state.minimapPointer.draggingViewport){
    return;
  }
  const point = getCanvasPoint(event, $('minimapCanvas'));
  const worldPoint = DemoInvestCanvasCamera.minimapToWorld(point, state.layout.world, state.minimapSize);
  state.camera = DemoInvestCanvasCamera.clampCamera({
    x: worldPoint.x - state.minimapPointer.offsetX,
    y: worldPoint.y - state.minimapPointer.offsetY,
    zoom: state.camera.zoom
  }, state.layout.world, state.viewport);
  renderAll();
});

function finishMinimapPointer(event){
  if(!state.minimapPointer || state.minimapPointer.id !== event.pointerId){
    return;
  }
  $('minimapCanvas').releasePointerCapture(event.pointerId);
  state.minimapPointer = null;
}

$('minimapCanvas').addEventListener('pointerup', finishMinimapPointer);
$('minimapCanvas').addEventListener('pointercancel', finishMinimapPointer);

$('keywordInput').addEventListener('input', event => {
  state.keywordInput = event.target.value;
});

$('idStartInput').addEventListener('input', event => {
  state.idStartInput = event.target.value;
});

$('idEndInput').addEventListener('input', event => {
  state.idEndInput = event.target.value;
});

['keywordInput', 'idStartInput', 'idEndInput'].forEach(id => {
  $(id).addEventListener('keydown', event => {
    if(event.key === 'Enter'){
      submitQuery();
    }
  });
});

$('runQuery').addEventListener('click', submitQuery);
$('cancelQuery').addEventListener('click', () => {
  abortActiveRequest('user-cancel');
  state.loading = false;
  state.status = '本次查询已取消。';
  renderAll();
});

$('zoomIn').addEventListener('click', () => {
  if(state.layout && state.camera){
    state.camera = DemoInvestCanvasCamera.zoomAtScreenPoint(state.camera, { x: state.viewport.width / 2, y: state.viewport.height / 2 }, 1.15, state.layout.world, state.viewport, CAMERA_LIMITS);
    renderAll();
  }
});
$('zoomOut').addEventListener('click', () => {
  if(state.layout && state.camera){
    state.camera = DemoInvestCanvasCamera.zoomAtScreenPoint(state.camera, { x: state.viewport.width / 2, y: state.viewport.height / 2 }, 1 / 1.15, state.layout.world, state.viewport, CAMERA_LIMITS);
    renderAll();
  }
});
$('fitView').addEventListener('click', () => {
  if(state.layout){
    state.camera = DemoInvestCanvasCamera.fitCameraToBounds(state.layout.world, state.viewport, CAMERA_LIMITS);
    renderAll();
  }
});
$('resetZoom').addEventListener('click', () => {
  if(state.layout){
    state.camera = DemoInvestCanvasCamera.clampCamera({ x: 0, y: 0, zoom: 1 }, state.layout.world, state.viewport);
    renderAll();
  }
});
$('panLeft').addEventListener('click', () => panByButton(80, 0));
$('panRight').addEventListener('click', () => panByButton(-80, 0));
$('panUp').addEventListener('click', () => panByButton(0, 80));
$('panDown').addEventListener('click', () => panByButton(0, -80));
$('clearSelection').addEventListener('click', clearSelection);

window.addEventListener('resize', updateCanvasSize);

window.__INVEST_CANVAS_DEBUG__ = {
  getSnapshot(){
    return {
      query: { ...state.query },
      loading: state.loading,
      error: state.error,
      status: state.status,
      selection: state.selection ? { ...state.selection } : null,
      camera: state.camera ? { ...state.camera } : null,
      viewport: { ...state.viewport },
      data: state.data ? {
        totalPatents: state.data.totalPatents,
        totalCompanies: state.data.totalCompanies,
        totalRelations: state.data.totalRelations
      } : null,
      layout: state.layout ? {
        patentCount: state.layout.patents.length,
        companyCount: state.layout.companies.length,
        edgeCount: state.layout.edges.length,
        world: { ...state.layout.world },
        patentBaselineY: state.layout.patentBaselineY,
        patents: state.layout.patents.map(node => ({
          patentId: node.patentId,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height
        })),
        companies: state.layout.companies.map(node => ({
          companyId: node.companyId,
          degree: node.degree,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          layerIndex: node.layerIndex
        }))
      } : null
    };
  },
  selectPatent(id){
    state.selection = { kind: 'patent', id: String(id) };
    renderAll();
    return this.getSnapshot();
  },
  selectCompany(id){
    state.selection = { kind: 'company', id: String(id) };
    renderAll();
    return this.getSnapshot();
  },
  zoomAtCenter(factor){
    if(state.layout && state.camera){
      state.camera = DemoInvestCanvasCamera.zoomAtScreenPoint(state.camera, {
        x: state.viewport.width / 2,
        y: state.viewport.height / 2
      }, factor, state.layout.world, state.viewport, CAMERA_LIMITS);
      renderAll();
    }
    return this.getSnapshot();
  },
  panByScreen(dx, dy){
    if(state.layout && state.camera){
      state.camera = DemoInvestCanvasCamera.panCameraByScreenDelta(state.camera, {
        x: dx,
        y: dy
      }, state.layout.world, state.viewport);
      renderAll();
    }
    return this.getSnapshot();
  },
  centerFromMinimap(normalizedX, normalizedY){
    if(state.layout && state.camera){
      const worldPoint = DemoInvestCanvasCamera.minimapToWorld({
        x: normalizedX * state.minimapSize.width,
        y: normalizedY * state.minimapSize.height
      }, state.layout.world, state.minimapSize);
      state.camera = DemoInvestCanvasCamera.centerCameraOnWorldPoint(state.camera, worldPoint, state.layout.world, state.viewport);
      renderAll();
    }
    return this.getSnapshot();
  },
  async runQuery(nextQuery){
    state.keywordInput = String(nextQuery.keyword ?? '');
    state.idStartInput = String(nextQuery.idStart ?? '');
    state.idEndInput = String(nextQuery.idEnd ?? '');
    state.query.keyword = state.keywordInput.trim();
    state.query.idStart = state.idStartInput.trim();
    state.query.idEnd = state.idEndInput.trim();
    await fetchCanvasData();
    return this.getSnapshot();
  }
};

readInitialState();
$('keywordInput').value = state.keywordInput;
$('idStartInput').value = state.idStartInput;
$('idEndInput').value = state.idEndInput;
updateCanvasSize();
fetchCanvasData();
