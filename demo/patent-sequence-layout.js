(function(global){
  var TOKENS = {
    canvasWidth: 1120,
    axisX: 560,
    top: 72,
    bottom: 56,
    patentWidth: 280,
    patentHeight: 92,
    patentGap: 26,
    companyWidth: 220,
    companyHeight: 84,
    companyGap: 18,
    leftX: 44,
    rightX: 856,
    patentX: 420
  };

  function toNumericId(value){
    var num = Number(value);
    return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER;
  }

  function buildPatentSequenceLayout(items){
    var patents = (items || []).map(function(item, index){
      return {
        id: 'patent:' + item.id,
        patentId: item.id,
        kind: 'patent',
        title: item.title,
        patentType: item.patentType,
        companyCount: item.companyCount,
        x: TOKENS.patentX,
        y: TOKENS.top + index * (TOKENS.patentHeight + TOKENS.patentGap),
        width: TOKENS.patentWidth,
        height: TOKENS.patentHeight,
        companies: item.companies || []
      };
    });

    var companyMap = new Map();
    patents.forEach(function(patent, patentIndex){
      patent.companies.forEach(function(company){
        var key = String(company.id);
        if(!companyMap.has(key)){
          companyMap.set(key, {
            id: 'company:' + company.id,
            companyId: String(company.id),
            kind: 'company',
            name: company.name,
            address: company.address || '',
            patentIds: [],
            patentIndexes: []
          });
        }
        var node = companyMap.get(key);
        node.patentIds.push(patent.patentId);
        node.patentIndexes.push(patentIndex);
      });
    });

    var companies = [...companyMap.values()].map(function(company){
      var avgPatentIndex = company.patentIndexes.reduce(function(sum, value){
        return sum + value;
      }, 0) / company.patentIndexes.length;
      company.avgPatentIndex = avgPatentIndex;
      return company;
    }).sort(function(a, b){
      if(a.avgPatentIndex !== b.avgPatentIndex){
        return a.avgPatentIndex - b.avgPatentIndex;
      }
      return toNumericId(a.companyId) - toNumericId(b.companyId);
    });

    var leftCompanies = [];
    var rightCompanies = [];
    companies.forEach(function(company){
      if(leftCompanies.length <= rightCompanies.length){
        company.side = 'left';
        leftCompanies.push(company);
      } else {
        company.side = 'right';
        rightCompanies.push(company);
      }
    });

    function placeCompanies(group, side){
      var lastBottom = TOKENS.top;
      group.forEach(function(company){
        var targetCenterY = TOKENS.top + company.avgPatentIndex * (TOKENS.patentHeight + TOKENS.patentGap) + TOKENS.patentHeight / 2;
        var y = Math.max(TOKENS.top, targetCenterY - TOKENS.companyHeight / 2, lastBottom);
        company.x = side === 'left' ? TOKENS.leftX : TOKENS.rightX;
        company.y = y;
        company.width = TOKENS.companyWidth;
        company.height = TOKENS.companyHeight;
        lastBottom = y + TOKENS.companyHeight + TOKENS.companyGap;
      });
    }

    placeCompanies(leftCompanies, 'left');
    placeCompanies(rightCompanies, 'right');

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

    var maxPatentBottom = patents.length
      ? patents[patents.length - 1].y + TOKENS.patentHeight
      : TOKENS.top + TOKENS.patentHeight;
    var maxCompanyBottom = companies.reduce(function(max, company){
      return Math.max(max, company.y + TOKENS.companyHeight);
    }, TOKENS.top + TOKENS.companyHeight);

    return {
      patents: patents,
      companies: companies,
      edges: edges,
      axis: {
        x: TOKENS.axisX,
        y1: TOKENS.top - 24,
        y2: Math.max(maxPatentBottom, maxCompanyBottom) + 24
      },
      canvas: {
        width: TOKENS.canvasWidth,
        height: Math.max(maxPatentBottom, maxCompanyBottom) + TOKENS.bottom
      },
      layoutRule: '企业按当前页关联专利的平均顺序位置排序，再交替分配到左右两侧。'
    };
  }

  var api = {
    TOKENS: TOKENS,
    buildPatentSequenceLayout: buildPatentSequenceLayout
  };

  global.DemoPatentSequenceLayout = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
