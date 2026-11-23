const assert = require('node:assert/strict');
const {
  buildPatentSequenceIndexFromRaw,
  queryPatentSequence
} = require('./patent-sequence-service.cjs');

function makeRaw(){
  return {
    '@graph': [
      {
        '@id': '10',
        '@type': 'company',
        name: '甲公司',
        address: '地址甲',
        relationship: {
          applyPatent: [
            { '@id': '2' },
            { '@id': '12' }
          ]
        }
      },
      {
        '@id': '11',
        '@type': 'company',
        name: '乙公司',
        address: '地址乙',
        relationship: {
          applyPatent: [
            { '@id': '2' }
          ]
        }
      },
      { '@id': '2', '@type': 'patent', name: '阀门检测装置', patentType: '' },
      { '@id': '10', '@type': 'patent', name: '阀门检测装置', patentType: '发明公布' },
      { '@id': '12', '@type': 'patent', name: '阀门控制系统', patentType: '实用新型' }
    ]
  };
}

function testNumericSortAndSharedPatent(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  const result = queryPatentSequence(index, { keyword: '阀门', page: 1, pageSize: 20 });
  assert.equal(result.totalPatents, 3);
  assert.deepEqual(result.items.map(item => item.id), ['2', '10', '12']);
  assert.equal(result.items[0].companies.length, 2);
}

function testSameTitleDifferentIdNotMerged(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  const result = queryPatentSequence(index, { keyword: '阀门检测', page: 1, pageSize: 20 });
  assert.equal(result.totalPatents, 2);
  assert.deepEqual(result.items.map(item => item.id), ['2', '10']);
}

function testEmptyTypeAndPagination(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  const result = queryPatentSequence(index, { keyword: '阀门', page: 2, pageSize: 2 });
  assert.equal(result.page, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, '12');
  const firstPage = queryPatentSequence(index, { keyword: '阀门', page: 1, pageSize: 2 });
  assert.equal(firstPage.items[0].patentType, '未提供');
}

function testNoResultKeyword(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  const result = queryPatentSequence(index, { keyword: '不存在', page: 1, pageSize: 20 });
  assert.equal(result.totalPatents, 0);
  assert.equal(result.totalCompanies, 0);
}

testNumericSortAndSharedPatent();
testSameTitleDifferentIdNotMerged();
testEmptyTypeAndPagination();
testNoResultKeyword();

console.log('patent-sequence-service.test.cjs passed');
