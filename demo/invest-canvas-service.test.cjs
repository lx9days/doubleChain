const assert = require('node:assert/strict');
const {
  buildPatentSequenceIndexFromRaw,
  queryInvestCanvas
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
            { '@id': '12' },
            { '@id': '21' }
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
            { '@id': '2' },
            { '@id': '18' }
          ]
        }
      },
      { '@id': '2', '@type': 'patent', name: '阀门检测装置', patentType: '' },
      { '@id': '10', '@type': 'patent', name: '阀门检测装置', patentType: '发明公布' },
      { '@id': '12', '@type': 'patent', name: '阀门控制系统', patentType: '实用新型' },
      { '@id': '18', '@type': 'patent', name: '通信切换方法', patentType: '发明授权' },
      { '@id': '21', '@type': 'patent', name: '通信控制装置', patentType: '发明公布' }
    ]
  };
}

function testKeywordAndRangeIntersection(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  const result = queryInvestCanvas(index, { keyword: '阀门', idStart: '2', idEnd: '9' });
  assert.deepEqual(result.items.map(item => item.id), ['2']);
  assert.equal(result.totalCompanies, 2);
  assert.equal(result.totalRelations, 2);
}

function testRangeOnlyKeepsAllMatchesWithoutPaging(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  const result = queryInvestCanvas(index, { keyword: '', idStart: '1', idEnd: '25' });
  assert.equal(result.totalPatents, 5);
  assert.equal(result.items.length, 5);
}

function testSameTitleDifferentIdStillSeparated(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  const result = queryInvestCanvas(index, { keyword: '阀门检测', idStart: '', idEnd: '' });
  assert.deepEqual(result.items.map(item => item.id), ['2', '10']);
}

function testInvalidRangeThrows(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  assert.throws(() => {
    queryInvestCanvas(index, { keyword: '通信', idStart: '20', idEnd: '10' });
  }, /起点不能大于/);
}

function testEmptyQueryRejected(){
  const index = buildPatentSequenceIndexFromRaw(makeRaw());
  assert.throws(() => {
    queryInvestCanvas(index, { keyword: '', idStart: '', idEnd: '' });
  }, /空条件会触发完整全库大画布/);
}

testKeywordAndRangeIntersection();
testRangeOnlyKeepsAllMatchesWithoutPaging();
testSameTitleDifferentIdStillSeparated();
testInvalidRangeThrows();
testEmptyQueryRejected();

console.log('invest-canvas-service.test.cjs passed');
