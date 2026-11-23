const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadOverview(){
  const source = fs.readFileSync(path.join(__dirname, 'overview.js'), 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.DemoOverview;
}

const DemoOverview = loadOverview();

function testDedupByCompanyWithinCell(){
  const fixture = [
    {
      invest_id: 'a',
      name: '甲企业',
      industry: ['电子制造'],
      records: [
        { '@id': 'p1', patentType: '发明公布' },
        { '@id': 'p2', patentType: '发明公布' }
      ]
    },
    {
      invest_id: 'b',
      name: '乙企业',
      industry: ['电子制造'],
      records: [
        { '@id': 'p3', patentType: '发明公布' }
      ]
    }
  ];
  const matrix = DemoOverview.buildMatrix(fixture);
  const companies = DemoOverview.getCellCompanies(matrix, '电子制造', '发明公布');
  assert.equal(companies.length, 2);
  assert.equal(JSON.stringify(companies.map(item => item.invest_id).sort()), JSON.stringify(['a', 'b']));
}

function testNormalizeEmptyPatentType(){
  const fixture = [
    {
      invest_id: 'a',
      name: '甲企业',
      industry: ['电子制造'],
      records: [
        { '@id': 'p1', patentType: '' }
      ]
    }
  ];
  const matrix = DemoOverview.buildMatrix(fixture);
  const companies = DemoOverview.getCellCompanies(matrix, '电子制造', '未提供');
  assert.equal(companies.length, 1);
  assert.equal(companies[0].invest_id, 'a');
}

function testCompanyAppearsInMultipleIndustries(){
  const fixture = [
    {
      invest_id: 'a',
      name: '甲企业',
      industry: ['电子制造', '软件服务'],
      records: [
        { '@id': 'p1', patentType: '实用新型' }
      ]
    }
  ];
  const matrix = DemoOverview.buildMatrix(fixture);
  assert.equal(DemoOverview.getCellCompanies(matrix, '电子制造', '实用新型').length, 1);
  assert.equal(DemoOverview.getCellCompanies(matrix, '软件服务', '实用新型').length, 1);
}

function testZeroResultFilter(){
  const fixture = [
    {
      invest_id: 'a',
      name: '甲企业',
      industry: ['电子制造'],
      records: [
        { '@id': 'p1', patentType: '发明公布' }
      ]
    }
  ];
  const filtered = DemoOverview.filterCompanies(
    fixture,
    { industry: '电子制造', type: '外观设计' },
    ''
  );
  assert.equal(filtered.length, 0);
}

testDedupByCompanyWithinCell();
testNormalizeEmptyPatentType();
testCompanyAppearsInMultipleIndustries();
testZeroResultFilter();

console.log('overview.test.cjs passed');
