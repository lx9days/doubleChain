const assert=require('node:assert/strict');
const NEV=require('./model.js'),d3=require('./d3.min.js');
const data=NEV.exclusive(require('../../data-derived/nev/demo-listed-300-v1/demo-data.json'));
const view=NEV.filter(data,{mode:'real'}),s=NEV.timeLayout(view,d3);
assert.equal(s.patents.length,300);assert.equal(s.companies.length,192);
const dates=view.patents.map(p=>p.application_date).sort();
assert.equal(d3.utcFormat('%Y-%m-%d')(s.extent[0]),dates[0]);
assert.equal(d3.utcFormat('%Y-%m-%d')(s.extent[1]),dates.at(-1));
for(const n of [...s.patents,...s.companies])assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.y>=0&&n.y<=s.height);
assert.ok(d3.mean(s.companies,c=>c.y)<d3.mean(s.patents,p=>p.y));
const filtered=NEV.filter(data,{mode:'real',from:'2020-01-01',to:'2021-12-31'}),f=NEV.timeLayout(filtered,d3);
assert.ok(+f.extent[0]>=+new Date('2020-01-01'));assert.ok(+f.extent[1]<=+new Date('2021-12-31'));
for(const date of ['2020-01-01','']){
 const single=NEV.timeLayout({patents:[{patent_id:'1',application_date:date}],companies:[],edges:[]},d3);
 assert.ok(Number.isFinite(single.patents[0].x));
}
assert.equal(NEV.timeLayout({patents:[],companies:[],edges:[]},d3).extent,null);
console.log('Time force layout: counts, extent, filtered extent, bounds, upward force, single date, missing date, empty passed');

assert.ok(s.patents.every(p=>Math.abs(p.y-s.axisY)<=32.001),'Patents remain near time axis');
