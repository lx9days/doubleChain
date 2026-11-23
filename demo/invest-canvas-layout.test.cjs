const assert = require('node:assert/strict');
const { buildInvestCanvasLayout } = require('./invest-canvas-layout.js');

function makeItems(){
  return [
    {
      numericId: 2,
      id: '2',
      title: '阀门检测装置',
      patentType: '未提供',
      companyCount: 2,
      companies: [
        { id: '10', name: '甲公司', address: '地址甲' },
        { id: '11', name: '乙公司', address: '地址乙' }
      ]
    },
    {
      numericId: 10,
      id: '10',
      title: '阀门检测装置',
      patentType: '发明公布',
      companyCount: 1,
      companies: [
        { id: '10', name: '甲公司', address: '地址甲' }
      ]
    },
    {
      numericId: 12,
      id: '12',
      title: '阀门控制系统',
      patentType: '实用新型',
      companyCount: 0,
      companies: []
    },
    {
      numericId: 18,
      id: '18',
      title: '通信切换方法',
      patentType: '发明授权',
      companyCount: 1,
      companies: [
        { id: '11', name: '乙公司', address: '地址乙' }
      ]
    },
    {
      numericId: 21,
      id: '21',
      title: '通信控制装置',
      patentType: '发明公布',
      companyCount: 1,
      companies: [
        { id: '10', name: '甲公司', address: '地址甲' }
      ]
    }
  ];
}

function testPatentsShareOneBaselineAndIncreaseById(){
  const layout = buildInvestCanvasLayout(makeItems());
  const ys = new Set(layout.patents.map(node => node.y));
  assert.equal(ys.size, 1);
  const ids = layout.patents.map(node => node.patentId);
  assert.deepEqual(ids, ['2', '10', '12', '18', '21']);
}

function testCompanyAppearsOnceAndEdgesPointToExistingNodes(){
  const layout = buildInvestCanvasLayout(makeItems());
  assert.equal(layout.companies.filter(company => company.companyId === '10').length, 1);
  const nodeIds = new Set(layout.companies.map(node => node.id).concat(layout.patents.map(node => node.id)));
  layout.edges.forEach(edge => {
    assert(nodeIds.has(edge.from));
    assert(nodeIds.has(edge.to));
  });
}

function testHigherDegreeCompanyIsPlacedHigher(){
  const layout = buildInvestCanvasLayout(makeItems());
  const company10 = layout.companies.find(company => company.companyId === '10');
  const company11 = layout.companies.find(company => company.companyId === '11');
  assert(company10.degree > company11.degree);
  assert(company10.y < company11.y);
}

function testUnlinkedPatentStillPresentWithoutEdges(){
  const layout = buildInvestCanvasLayout(makeItems());
  assert(layout.patents.some(node => node.patentId === '12'));
  assert.equal(layout.edges.some(edge => edge.patentId === '12'), false);
}

testPatentsShareOneBaselineAndIncreaseById();
testCompanyAppearsOnceAndEdgesPointToExistingNodes();
testHigherDegreeCompanyIsPlacedHigher();
testUnlinkedPatentStillPresentWithoutEdges();

console.log('invest-canvas-layout.test.cjs passed');
