(function(global){
  function normalizePatentType(value){
    return value && String(value).trim() ? String(value).trim() : '未提供';
  }

  function uniqSorted(values){
    return [...new Set(values)].sort(function(a,b){
      return String(a).localeCompare(String(b),'zh-CN');
    });
  }

  function getPatentTypes(data){
    return uniqSorted(
      data.flatMap(function(company){
        return (company.records || []).map(function(record){
          return normalizePatentType(record.patentType);
        });
      })
    );
  }

  function getIndustries(data){
    return uniqSorted(
      data.flatMap(function(company){
        return company.industry || [];
      })
    );
  }

  function cellKey(industry, patentType){
    return industry + '\u0000' + patentType;
  }

  function buildMatrix(data){
    var industries = getIndustries(data);
    var patentTypes = getPatentTypes(data);
    var companyLookup = new Map();
    var cells = new Map();

    data.forEach(function(company){
      companyLookup.set(String(company.invest_id), company);
      var types = new Set((company.records || []).map(function(record){
        return normalizePatentType(record.patentType);
      }));

      (company.industry || []).forEach(function(industry){
        types.forEach(function(type){
          var key = cellKey(industry, type);
          if(!cells.has(key)){
            cells.set(key, new Set());
          }
          cells.get(key).add(String(company.invest_id));
        });
      });
    });

    return {
      industries: industries,
      patentTypes: patentTypes,
      cells: cells,
      companyLookup: companyLookup
    };
  }

  function companyMatchesOverview(company, filter){
    if(!filter){
      return true;
    }
    var hasIndustry = (company.industry || []).includes(filter.industry);
    if(!hasIndustry){
      return false;
    }
    return (company.records || []).some(function(record){
      return normalizePatentType(record.patentType) === filter.type;
    });
  }

  function filterCompanies(data, filter, query){
    var text = String(query || '').trim();
    return data.filter(function(company){
      if(!companyMatchesOverview(company, filter)){
        return false;
      }
      return !text || String(company.name || '').includes(text);
    });
  }

  function getCellCompanies(matrix, industry, patentType){
    var ids = matrix.cells.get(cellKey(industry, patentType)) || new Set();
    return [...ids].map(function(id){
      return matrix.companyLookup.get(id);
    }).filter(Boolean);
  }

  global.DemoOverview = {
    buildMatrix: buildMatrix,
    cellKey: cellKey,
    companyMatchesOverview: companyMatchesOverview,
    filterCompanies: filterCompanies,
    getCellCompanies: getCellCompanies,
    getIndustries: getIndustries,
    getPatentTypes: getPatentTypes,
    normalizePatentType: normalizePatentType
  };
})(window);
