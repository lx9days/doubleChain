(function(global){
  var TOKENS = {
    patentWidth: 56,
    patentHeight: 44,
    patentGap: 18,
    companyWidth: 176,
    companyHeight: 52,
    companyGap: 18,
    layerGap: 92,
    topPadding: 64,
    leftPadding: 56,
    rightPadding: 56,
    bottomPadding: 96
  };

  function toNumericId(value){
    var num = Number(value);
    return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER;
  }

  function median(values){
    if(!values.length){
      return 0;
    }
    var sorted = values.slice().sort(function(a, b){ return a - b; });
    var mid = Math.floor(sorted.length / 2);
    if(sorted.length % 2){
      return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function buildInvestCanvasLayout(items){
    var patents = (items || []).map(function(item, index){
      return {
        id: 'patent:' + item.id,
        kind: 'patent',
        patentId: String(item.id),
        numericId: Number(item.numericId),
        title: item.title,
        patentType: item.patentType,
        companyCount: item.companyCount,
        companies: item.companies || [],
        x: TOKENS.leftPadding + index * (TOKENS.patentWidth + TOKENS.patentGap),
        y: 0,
        width: TOKENS.patentWidth,
        height: TOKENS.patentHeight
      };
    });

    var companyMap = new Map();
    patents.forEach(function(patent, patentIndex){
      patent.companies.forEach(function(company){
        var key = String(company.id);
        if(!companyMap.has(key)){
          companyMap.set(key, {
            id: 'company:' + key,
            kind: 'company',
            companyId: key,
            name: company.name,
            address: company.address || '',
            patentIds: [],
            patentIndexes: [],
            patentCenters: []
          });
        }

        var companyNode = companyMap.get(key);
        companyNode.patentIds.push(patent.patentId);
        companyNode.patentIndexes.push(patentIndex);
        companyNode.patentCenters.push(patent.x + patent.width / 2);
      });
    });

    var companies = Array.from(companyMap.values()).map(function(company){
      company.degree = company.patentIds.length;
      company.targetCenterX = median(company.patentCenters);
      return company;
    });

    var degreeLevels = Array.from(new Set(companies.map(function(company){
      return company.degree;
    }))).sort(function(a, b){
      return b - a;
    });

    var layerIndexByDegree = new Map();
    degreeLevels.forEach(function(degree, index){
      layerIndexByDegree.set(degree, index);
    });

    var patentBaselineY = TOKENS.topPadding + Math.max(0, degreeLevels.length - 1) * TOKENS.layerGap;
    patents.forEach(function(patent){
      patent.y = patentBaselineY;
    });

    var layerGroups = new Map();
    companies.forEach(function(company){
      var layerIndex = layerIndexByDegree.get(company.degree) || 0;
      company.layerIndex = layerIndex;
      if(!layerGroups.has(layerIndex)){
        layerGroups.set(layerIndex, []);
      }
      layerGroups.get(layerIndex).push(company);
    });

    var maxCompanyRight = TOKENS.leftPadding;
    layerGroups.forEach(function(group, layerIndex){
      var levelOffset = Math.max(0, degreeLevels.length - 1 - layerIndex);
      var y = patentBaselineY - TOKENS.companyHeight - 56 - levelOffset * TOKENS.layerGap;
      var cursorX = TOKENS.leftPadding;
      group.sort(function(a, b){
        if(a.targetCenterX !== b.targetCenterX){
          return a.targetCenterX - b.targetCenterX;
        }
        return toNumericId(a.companyId) - toNumericId(b.companyId);
      });

      group.forEach(function(company){
        var desiredX = company.targetCenterX - TOKENS.companyWidth / 2;
        var x = Math.max(desiredX, cursorX);
        company.x = x;
        company.y = y;
        company.width = TOKENS.companyWidth;
        company.height = TOKENS.companyHeight;
        cursorX = x + TOKENS.companyWidth + TOKENS.companyGap;
        maxCompanyRight = Math.max(maxCompanyRight, x + TOKENS.companyWidth);
      });
    });

    var patentRight = patents.length
      ? patents[patents.length - 1].x + TOKENS.patentWidth
      : TOKENS.leftPadding + TOKENS.patentWidth;
    var worldWidth = Math.max(patentRight, maxCompanyRight) + TOKENS.rightPadding;
    var worldHeight = patentBaselineY + TOKENS.patentHeight + TOKENS.bottomPadding;

    var companyLookup = new Map(companies.map(function(company){
      return [company.companyId, company];
    }));

    var edges = [];
    patents.forEach(function(patent){
      patent.companies.forEach(function(company){
        var companyNode = companyLookup.get(String(company.id));
        if(companyNode){
          edges.push({
            id: 'edge:' + companyNode.companyId + '->' + patent.patentId,
            from: companyNode.id,
            to: patent.id,
            companyId: companyNode.companyId,
            patentId: patent.patentId
          });
        }
      });
    });

    return {
      patents: patents,
      companies: companies,
      edges: edges,
      world: {
        x: 0,
        y: 0,
        width: worldWidth,
        height: worldHeight
      },
      patentBaselineY: patentBaselineY,
      degreeLevels: degreeLevels,
      layoutRule: '专利按 ID 横向排到底部同一基线；企业按当前筛选结果的去重专利数分层，度越大层越高。'
    };
  }

  var api = {
    TOKENS: TOKENS,
    buildInvestCanvasLayout: buildInvestCanvasLayout
  };

  global.DemoInvestCanvasLayout = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
