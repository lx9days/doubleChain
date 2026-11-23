const assert = require('node:assert/strict');
const { buildPatentSequenceLayout } = require('./patent-sequence-layout.js');

function makeItems(){
  return [
    {
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
      id: '10',
      title: '阀门检测装置',
      patentType: '发明公布',
      companyCount: 1,
      companies: [
        { id: '10', name: '甲公司', address: '地址甲' }
      ]
    },
    {
      id: '12',
      title: '阀门控制系统',
      patentType: '实用新型',
      companyCount: 0,
      companies: []
    }
  ];
}

function testCompanyNodeAppearsOnce(){
  const layout = buildPatentSequenceLayout(makeItems());
  assert.equal(layout.companies.length, 2);
  assert.equal(layout.companies.filter(company => company.companyId === '10').length, 1);
}

function testEveryEdgeEndpointExists(){
  const layout = buildPatentSequenceLayout(makeItems());
  const nodeIds = new Set(layout.patents.map(node => node.id).concat(layout.companies.map(node => node.id)));
  layout.edges.forEach(edge => {
    assert(nodeIds.has(edge.from));
    assert(nodeIds.has(edge.to));
  });
}

function testStableSideAssignment(){
  const first = buildPatentSequenceLayout(makeItems());
  const second = buildPatentSequenceLayout(makeItems());
  const firstSides = Object.fromEntries(first.companies.map(company => [company.companyId, company.side]));
  const secondSides = Object.fromEntries(second.companies.map(company => [company.companyId, company.side]));
  assert.equal(JSON.stringify(firstSides), JSON.stringify(secondSides));
}

function testUnlinkedPatentKeepsNoEdges(){
  const layout = buildPatentSequenceLayout(makeItems());
  assert.equal(layout.edges.some(edge => edge.patentId === '12'), false);
}

testCompanyNodeAppearsOnce();
testEveryEdgeEndpointExists();
testStableSideAssignment();
testUnlinkedPatentKeepsNoEdges();

console.log('patent-sequence-layout.test.cjs passed');
