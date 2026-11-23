(function(global){
  var TOKENS = {
    canvasMinWidth: 1020,
    top: 56,
    leftPadding: 24,
    rightPadding: 36,
    bottomPadding: 48,
    columnX: {
      industry: 24,
      ekg: 212,
      invest: 428,
      patent: 646
    },
    nodeSize: {
      industry: { width: 160, height: 72 },
      ekg: { width: 188, height: 104 },
      invest: { width: 188, height: 104 },
      patent: { width: 220, height: 96 }
    },
    patentGap: 22,
    industryGap: 18,
    companyTop: 150
  };

  function assignNodeFrames(model){
    var patentNodes = model.nodes.filter(function(node){ return node.kind === 'patent'; });
    var industryNodes = model.nodes.filter(function(node){ return node.kind === 'industry'; });
    var ekgNode = model.nodes.find(function(node){ return node.kind === 'ekg'; }) || null;
    var investNode = model.nodes.find(function(node){ return node.kind === 'invest'; }) || null;
    var frames = {};
    var patentHeight = patentNodes.length
      ? patentNodes.length * TOKENS.nodeSize.patent.height + Math.max(patentNodes.length - 1, 0) * TOKENS.patentGap
      : TOKENS.nodeSize.patent.height;
    var patentStartY = TOKENS.top;
    var graphHeight = patentStartY + patentHeight + TOKENS.bottomPadding;
    var companyY = TOKENS.companyTop;
    var industryBlockHeight = industryNodes.length
      ? industryNodes.length * TOKENS.nodeSize.industry.height + Math.max(industryNodes.length - 1, 0) * TOKENS.industryGap
      : 0;
    var industryStartY = Math.max(TOKENS.top, companyY + Math.max(0, (TOKENS.nodeSize.ekg.height - industryBlockHeight) / 2));

    industryNodes.forEach(function(node, index){
      frames[node.id] = {
        x: TOKENS.columnX.industry,
        y: industryStartY + index * (TOKENS.nodeSize.industry.height + TOKENS.industryGap),
        width: TOKENS.nodeSize.industry.width,
        height: TOKENS.nodeSize.industry.height
      };
    });

    if(ekgNode){
      frames[ekgNode.id] = {
        x: TOKENS.columnX.ekg,
        y: companyY,
        width: TOKENS.nodeSize.ekg.width,
        height: TOKENS.nodeSize.ekg.height
      };
    }

    if(investNode){
      frames[investNode.id] = {
        x: TOKENS.columnX.invest,
        y: companyY,
        width: TOKENS.nodeSize.invest.width,
        height: TOKENS.nodeSize.invest.height
      };
    }

    patentNodes.forEach(function(node, index){
      frames[node.id] = {
        x: TOKENS.columnX.patent,
        y: patentStartY + index * (TOKENS.nodeSize.patent.height + TOKENS.patentGap),
        width: TOKENS.nodeSize.patent.width,
        height: TOKENS.nodeSize.patent.height
      };
    });

    return {
      frames: frames,
      width: TOKENS.canvasMinWidth,
      height: Math.max(
        graphHeight,
        companyY + TOKENS.nodeSize.invest.height + TOKENS.bottomPadding,
        industryStartY + industryBlockHeight + TOKENS.bottomPadding
      )
    };
  }

  function getPort(frame, side){
    if(side === 'left'){
      return { x: frame.x, y: frame.y + frame.height / 2 };
    }
    if(side === 'right'){
      return { x: frame.x + frame.width, y: frame.y + frame.height / 2 };
    }
    return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  }

  function buildOrthogonalPath(start, end){
    var midX = start.x + (end.x - start.x) / 2;
    return [
      'M', start.x, start.y,
      'L', midX, start.y,
      'L', midX, end.y,
      'L', end.x, end.y
    ].join(' ');
  }

  function layoutGraph(model){
    var base = assignNodeFrames(model);
    var edges = model.edges.filter(function(edge){
      return base.frames[edge.from] && base.frames[edge.to];
    }).map(function(edge){
      var fromFrame = base.frames[edge.from];
      var toFrame = base.frames[edge.to];
      var start = getPort(fromFrame, 'right');
      var end = getPort(toFrame, 'left');
      var midX = start.x + (end.x - start.x) / 2;
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        relation: edge.relation,
        label: edge.label,
        dashed: edge.dashed,
        path: buildOrthogonalPath(start, end),
        labelX: midX,
        labelY: start.y <= end.y ? start.y - 12 : end.y - 12
      };
    });

    return {
      nodes: model.nodes.filter(function(node){
        return base.frames[node.id];
      }).map(function(node){
        return Object.assign({}, node, {
          frame: base.frames[node.id]
        });
      }),
      edges: edges,
      canvas: {
        width: base.width,
        height: base.height
      }
    };
  }

  var api = {
    TOKENS: TOKENS,
    layoutGraph: layoutGraph
  };

  global.DemoGraphLayout = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
