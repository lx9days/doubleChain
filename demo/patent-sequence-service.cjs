const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function createQueryError(code, message, details){
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  error.details = details || null;
  return error;
}

function normalizePatentType(value){
  return value && String(value).trim() ? String(value).trim() : '未提供';
}

function normalizeKeyword(value){
  return String(value || '').trim().toLowerCase();
}

function numericId(value){
  const num = Number(value);
  return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER;
}

function parseNumericBound(value, label){
  if(value === undefined || value === null || String(value).trim() === ''){
    return null;
  }

  const text = String(value).trim();
  if(!/^-?\d+$/.test(text)){
    throw createQueryError('invalid-id-bound', `${label}必须是整数`, {
      label,
      value: text
    });
  }

  const num = Number(text);
  if(!Number.isFinite(num)){
    throw createQueryError('invalid-id-bound', `${label}超出可处理范围`, {
      label,
      value: text
    });
  }

  return num;
}

function buildPatentSequenceIndexFromRaw(raw){
  const graph = raw['@graph'] || [];
  const companyNodes = graph.filter(node => node['@type'] === 'company');
  const patentNodes = graph.filter(node => node['@type'] === 'patent');
  const companyRows = [];
  const companyIndexById = new Map();
  const patentCompanyIndexes = new Map();
  let relationCount = 0;

  companyNodes.forEach(company => {
    const id = String(company['@id']);
    const rowIndex = companyRows.length;
    companyRows.push([
      id,
      String(company.name || ''),
      String(company.address || '')
    ]);
    companyIndexById.set(id, rowIndex);

    const patentRefs = (((company.relationship || {}).applyPatent) || []);
    patentRefs.forEach(ref => {
      const patentId = String(ref['@id']);
      if(!patentCompanyIndexes.has(patentId)){
        patentCompanyIndexes.set(patentId, []);
      }
      patentCompanyIndexes.get(patentId).push(rowIndex);
      relationCount += 1;
    });
  });

  const patents = patentNodes
    .map(node => {
      const id = String(node['@id']);
      const companyIndexes = patentCompanyIndexes.has(id)
        ? [...new Set(patentCompanyIndexes.get(id))].sort((a, b) => a - b)
        : [];
      return [
        numericId(id),
        id,
        String(node.name || ''),
        normalizePatentType(node.patentType),
        companyIndexes
      ];
    })
    .sort((a, b) => a[0] - b[0]);

  const linkedPatentCount = patents.filter(row => row[4].length > 0).length;
  const sharedPatentCount = patents.filter(row => row[4].length > 1).length;
  const unlinkedPatentCount = patents.length - linkedPatentCount;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      patentCount: patents.length,
      companyCount: companyRows.length,
      relationCount,
      linkedPatentCount,
      sharedPatentCount,
      unlinkedPatentCount,
      sourceLabel: '完整 invest 数据'
    },
    companies: companyRows,
    patents
  };
}

function buildPatentSequenceIndexFromFile(sourcePath){
  const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  return buildPatentSequenceIndexFromRaw(raw);
}

function writePatentSequenceIndex(filePath, index){
  fs.writeFileSync(filePath, JSON.stringify(index));
}

function loadPatentSequenceIndex(filePath){
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  parsed._titleLower = parsed.patents.map(row => String(row[2] || '').toLowerCase());
  return parsed;
}

function resolvePage(value){
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function resolvePageSize(value){
  const pageSize = Number.parseInt(value, 10);
  if(!Number.isFinite(pageSize) || pageSize <= 0){
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(pageSize, MAX_PAGE_SIZE);
}

function mapCompany(index, companyIndex){
  const row = index.companies[companyIndex];
  return {
    id: row[0],
    name: row[1],
    address: row[2] || ''
  };
}

function rowMatchesFilters(index, row, rowIndex, keywordLower, idStart, idEnd){
  if(keywordLower){
    const titleLower = index._titleLower ? index._titleLower[rowIndex] : String(row[2] || '').toLowerCase();
    if(!titleLower.includes(keywordLower)){
      return false;
    }
  }

  if(idStart !== null && row[0] < idStart){
    return false;
  }

  if(idEnd !== null && row[0] > idEnd){
    return false;
  }

  return true;
}

function queryPatentSequence(index, options){
  const startedAt = Date.now();
  const keyword = String(options.keyword || '').trim();
  const keywordLower = normalizeKeyword(keyword);
  const pageSize = resolvePageSize(options.pageSize);
  const page = resolvePage(options.page);

  if(!keywordLower){
    return {
      keyword,
      matchMode: 'title-contains',
      page,
      pageSize,
      totalPatents: 0,
      totalCompanies: 0,
      totalPages: 0,
      visiblePatentCount: 0,
      visibleCompanyCount: 0,
      pageStart: 0,
      pageEnd: 0,
      queryMs: Date.now() - startedAt,
      meta: index.meta,
      items: []
    };
  }

  const matchedRows = [];
  const globalCompanyIndexes = new Set();

  index.patents.forEach((row, rowIndex) => {
    const titleLower = index._titleLower ? index._titleLower[rowIndex] : String(row[2] || '').toLowerCase();
    if(titleLower.includes(keywordLower)){
      matchedRows.push(row);
      row[4].forEach(companyIndex => globalCompanyIndexes.add(companyIndex));
    }
  });

  const totalPatents = matchedRows.length;
  const totalPages = totalPatents ? Math.ceil(totalPatents / pageSize) : 0;
  const safePage = totalPages ? Math.min(page, totalPages) : 1;
  const start = totalPatents ? (safePage - 1) * pageSize : 0;
  const pageRows = matchedRows.slice(start, start + pageSize);
  const visibleCompanyIndexes = new Set();
  const items = pageRows.map(row => {
    row[4].forEach(companyIndex => visibleCompanyIndexes.add(companyIndex));
    return {
      numericId: row[0],
      id: row[1],
      title: row[2],
      patentType: row[3],
      companyCount: row[4].length,
      companies: row[4].map(companyIndex => mapCompany(index, companyIndex))
    };
  });

  return {
    keyword,
    matchMode: 'title-contains',
    page: safePage,
    pageSize,
    totalPatents,
    totalCompanies: globalCompanyIndexes.size,
    totalPages,
    visiblePatentCount: items.length,
    visibleCompanyCount: visibleCompanyIndexes.size,
    pageStart: totalPatents ? start + 1 : 0,
    pageEnd: totalPatents ? start + items.length : 0,
    queryMs: Date.now() - startedAt,
    meta: index.meta,
    items
  };
}

function queryInvestCanvas(index, options){
  const startedAt = Date.now();
  const keyword = String(options.keyword || '').trim();
  const keywordLower = normalizeKeyword(keyword);
  const idStart = parseNumericBound(options.idStart, 'ID 起点');
  const idEnd = parseNumericBound(options.idEnd, 'ID 终点');

  if(idStart !== null && idEnd !== null && idStart > idEnd){
    throw createQueryError('invalid-id-range', 'ID 起点不能大于 ID 终点', {
      idStart,
      idEnd
    });
  }

  if(!keywordLower && idStart === null && idEnd === null){
    throw createQueryError('query-too-broad', '空条件会触发完整全库大画布，请至少提供关键词或 ID 区间后再检索', {
      keyword,
      idStart,
      idEnd
    });
  }

  const matchedRows = [];
  const globalCompanyIndexes = new Set();
  let relationCount = 0;

  index.patents.forEach((row, rowIndex) => {
    if(!rowMatchesFilters(index, row, rowIndex, keywordLower, idStart, idEnd)){
      return;
    }

    matchedRows.push(row);
    row[4].forEach(companyIndex => globalCompanyIndexes.add(companyIndex));
    relationCount += row[4].length;
  });

  const items = matchedRows.map(row => ({
    numericId: row[0],
    id: row[1],
    title: row[2],
    patentType: row[3],
    companyCount: row[4].length,
    companies: row[4].map(companyIndex => mapCompany(index, companyIndex))
  }));

  return {
    keyword,
    idStart,
    idEnd,
    matchMode: 'title-contains-and-id-range',
    totalPatents: items.length,
    totalCompanies: globalCompanyIndexes.size,
    totalRelations: relationCount,
    queryMs: Date.now() - startedAt,
    meta: index.meta,
    items
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPatentSequenceIndexFromRaw,
  buildPatentSequenceIndexFromFile,
  writePatentSequenceIndex,
  loadPatentSequenceIndex,
  queryPatentSequence,
  queryInvestCanvas
};
