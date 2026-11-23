(function(global){
  function normalizePatentType(value){
    return global.DemoOverview.normalizePatentType(value);
  }

  function findPreferredEkgId(company){
    var ekgIds = company.ekg_ids || [];
    return ekgIds.find(function(id){
      return String(id).startsWith('上市:');
    }) || null;
  }

  function buildGraphModel(company, options){
    var config = options || {};
    var patentType = config.patentType || '';
    var patentLimit = Math.max(0, config.patentLimit || 0);
    var showIndustry = config.showIndustry !== false;
    var nodes = [];
    var edges = [];
    var pathLookup = {};
    var metadata = {
      company: company || null,
      showIndustry: showIndustry,
      patentType: patentType,
      totalFilteredPatents: 0,
      visiblePatentCount: 0,
      primaryEkgId: null,
      allEkgIds: [],
      hiddenPatentCount: 0,
      hasIndustryEdge: false
    };

    if(!company){
      return {
        nodes: nodes,
        edges: edges,
        pathLookup: pathLookup,
        metadata: metadata
      };
    }

    var ekgIds = company.ekg_ids || [];
    var preferredEkgId = findPreferredEkgId(company);
    var fallbackEkgId = ekgIds[0] || null;
    var primaryEkgId = preferredEkgId || fallbackEkgId;
    var primarySourceType = preferredEkgId ? '上市' : (fallbackEkgId ? String(fallbackEkgId).split(':')[0] : null);
    var primaryRoleLabel = preferredEkgId
      ? 'EKG 上市企业记录'
      : (fallbackEkgId ? ('EKG ' + primarySourceType + '记录') : 'EKG 来源缺失');
    var filteredRecords = (company.records || []).filter(function(record){
      return !patentType || normalizePatentType(record.patentType) === patentType;
    });
    var visibleRecords = filteredRecords.slice(0, patentLimit);
    var investNodeId = 'invest:' + company.invest_id;
    var ekgNodeId = primaryEkgId ? ('ekg:' + primaryEkgId) : 'ekg:missing:' + company.invest_id;

    metadata.totalFilteredPatents = filteredRecords.length;
    metadata.visiblePatentCount = visibleRecords.length;
    metadata.primaryEkgId = primaryEkgId;
    metadata.allEkgIds = ekgIds.slice();
    metadata.hiddenPatentCount = Math.max(filteredRecords.length - visibleRecords.length, 0);

    nodes.push({
      id: ekgNodeId,
      kind: 'ekg',
      label: company.name,
      shortLabel: company.name,
      badge: primaryRoleLabel,
      sourceId: primaryEkgId,
      sourceType: primarySourceType,
      hasIndustryEvidence: Boolean(preferredEkgId),
      otherSourceIds: ekgIds.filter(function(id){
        return id !== primaryEkgId;
      }),
      evidence: {
        title: primaryRoleLabel,
        summary: primaryEkgId
          ? ('来源 ID：' + primaryEkgId)
          : '当前样本未提供可展示的 EKG 来源 ID',
        lines: [
          '企业名称：' + company.name,
          '展示角色：' + primaryRoleLabel,
          '所有 EKG 来源 ID：' + (ekgIds.length ? ekgIds.join(' / ') : '未提供'),
          preferredEkgId
            ? '行业归属边基于 EKG 上市企业记录展示。'
            : '当前未命中可直接承载行业归属的 EKG 上市来源，因此不生成无依据的行业归属边。'
        ]
      }
    });

    nodes.push({
      id: investNodeId,
      kind: 'invest',
      label: company.name,
      shortLabel: company.name,
      badge: 'invest 企业记录',
      sourceId: company.invest_id,
      evidence: {
        title: 'invest 企业记录',
        summary: '来源 ID：' + company.invest_id,
        lines: [
          '企业名称：' + company.name,
          'invest 公司 ID：' + company.invest_id,
          '地址：' + (company.address || '未提供'),
          '同名匹配状态：待审核候选',
          '匹配依据：规范化企业全名一致'
        ]
      }
    });

    if(showIndustry){
      (company.industry || []).forEach(function(industry, index){
        var industryNodeId = 'industry:' + index + ':' + industry;
        nodes.push({
          id: industryNodeId,
          kind: 'industry',
          label: industry,
          shortLabel: industry,
          badge: '行业分类',
          sourceId: industry,
          evidence: {
            title: '行业分类',
            summary: industry,
            lines: [
              '来源字段：company.industry',
              '这是分类标签，不代表产业上下游或供应方向。'
            ]
          }
        });

        if(preferredEkgId){
          metadata.hasIndustryEdge = true;
          edges.push({
            id: 'edge:' + industryNodeId + '->' + ekgNodeId,
            from: industryNodeId,
            to: ekgNodeId,
            relation: 'industry',
            label: '行业归属',
            lineStyle: 'solid',
            dashed: false
          });
        }
      });
    }

    edges.push({
      id: 'edge:' + ekgNodeId + '->' + investNodeId,
      from: ekgNodeId,
      to: investNodeId,
      relation: 'candidate',
      label: '同名候选',
      lineStyle: 'dashed',
      dashed: true
    });

    visibleRecords.forEach(function(record, index){
      var patentNodeId = 'patent:' + record['@id'];
      nodes.push({
        id: patentNodeId,
        kind: 'patent',
        label: record.name,
        shortLabel: record.name,
        badge: normalizePatentType(record.patentType),
        sourceId: record['@id'],
        record: record,
        slotIndex: index,
        evidence: {
          title: record.name,
          summary: '专利记录 ID：' + record['@id'],
          lines: [
            '源类型：' + normalizePatentType(record.patentType),
            '关系：applyPatent',
            '缺少申请号、摘要和申请日期；标题相同的记录未自动合并。'
          ]
        }
      });

      edges.push({
        id: 'edge:' + investNodeId + '->' + patentNodeId,
        from: investNodeId,
        to: patentNodeId,
        relation: 'applyPatent',
        label: '申请关系 / applyPatent',
        lineStyle: 'solid',
        dashed: false
      });

      pathLookup[patentNodeId] = {
        nodeIds: nodes.filter(function(node){
          return node.kind === 'industry';
        }).map(function(node){
          return node.id;
        }).concat([ekgNodeId, investNodeId, patentNodeId]),
        edgeIds: edges.filter(function(edge){
          return edge.to === patentNodeId || edge.to === ekgNodeId || edge.to === investNodeId;
        }).map(function(edge){
          return edge.id;
        })
      };
    });

    return {
      nodes: nodes,
      edges: edges,
      pathLookup: pathLookup,
      metadata: metadata
    };
  }

  var api = {
    buildGraphModel: buildGraphModel,
    findPreferredEkgId: findPreferredEkgId
  };

  global.DemoGraphModel = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
