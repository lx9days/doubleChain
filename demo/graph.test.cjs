const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScripts(files){
  const context = { window: {}, globalThis: {} };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  files.forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    vm.runInContext(source, context);
  });
  return context;
}

const context = loadScripts(['overview.js', 'graph-model.js', 'graph-layout.js']);
const DemoGraphModel = context.DemoGraphModel;
const DemoGraphLayout = context.DemoGraphLayout;

function makeCompany(){
  return {
    invest_id: '12450',
    name: '中兴通讯股份有限公司',
    patents: 6898,
    sources: ['上市', '企业'],
    industry: ['计算机、通信和其他电子设备制造业'],
    ekg_ids: ['企业:base:898', '上市:base:898'],
    address: '深圳市南山区高新技术产业园科技南路中兴通讯大厦',
    records: Array.from({ length: 12 }, (_, index) => ({
      '@id': String(294160 + index),
      '@type': 'patent',
      name: index < 2 ? '光模块以及应用于光模块的光器件' : `专利 ${index + 1}`,
      patentType: index % 2 === 0 ? '发明公布' : '发明授权'
    })),
    events: []
  };
}

function testNodeNamespaceIsolation(){
  const model = DemoGraphModel.buildGraphModel(makeCompany(), {
    patentType: '',
    patentLimit: 2,
    showIndustry: true
  });
  const nodeIds = model.nodes.map(node => node.id);
  assert(nodeIds.includes('industry:0:计算机、通信和其他电子设备制造业'));
  assert(nodeIds.includes('ekg:上市:base:898'));
  assert(nodeIds.includes('invest:12450'));
  assert(nodeIds.includes('patent:294160'));
}

function testDuplicatePatentTitlesStaySeparate(){
  const model = DemoGraphModel.buildGraphModel(makeCompany(), {
    patentType: '',
    patentLimit: 2,
    showIndustry: true
  });
  const patents = model.nodes.filter(node => node.kind === 'patent');
  assert.equal(patents.length, 2);
  assert.equal(patents[0].label, patents[1].label);
  assert.notEqual(patents[0].id, patents[1].id);
}

function testEveryEdgeHasVisibleEndpoints(){
  const model = DemoGraphModel.buildGraphModel(makeCompany(), {
    patentType: '',
    patentLimit: 4,
    showIndustry: true
  });
  const nodeIds = new Set(model.nodes.map(node => node.id));
  model.edges.forEach(edge => {
    assert(nodeIds.has(edge.from));
    assert(nodeIds.has(edge.to));
  });
}

function testHiddenIndustryRemovesIndustryEdges(){
  const model = DemoGraphModel.buildGraphModel(makeCompany(), {
    patentType: '',
    patentLimit: 4,
    showIndustry: false
  });
  assert.equal(model.nodes.some(node => node.kind === 'industry'), false);
  assert.equal(model.edges.some(edge => edge.relation === 'industry'), false);
}

function testPatentSlotsStayStableWhenExpanding(){
  const company = makeCompany();
  const smallLayout = DemoGraphLayout.layoutGraph(
    DemoGraphModel.buildGraphModel(company, {
      patentType: '',
      patentLimit: 6,
      showIndustry: true
    })
  );
  const largeLayout = DemoGraphLayout.layoutGraph(
    DemoGraphModel.buildGraphModel(company, {
      patentType: '',
      patentLimit: 12,
      showIndustry: true
    })
  );
  ['294160', '294161', '294162', '294163', '294164', '294165'].forEach(id => {
    const smallNode = smallLayout.nodes.find(node => node.id === `patent:${id}`);
    const largeNode = largeLayout.nodes.find(node => node.id === `patent:${id}`);
    assert.equal(JSON.stringify(smallNode.frame), JSON.stringify(largeNode.frame));
  });
  ['industry:0:计算机、通信和其他电子设备制造业', 'ekg:上市:base:898', 'invest:12450'].forEach(id => {
    const smallNode = smallLayout.nodes.find(node => node.id === id);
    const largeNode = largeLayout.nodes.find(node => node.id === id);
    assert.equal(JSON.stringify(smallNode.frame), JSON.stringify(largeNode.frame));
  });
}

testNodeNamespaceIsolation();
testDuplicatePatentTitlesStaySeparate();
testEveryEdgeHasVisibleEndpoints();
testHiddenIndustryRemovesIndustryEdges();
testPatentSlotsStayStableWhenExpanding();

console.log('graph.test.cjs passed');
