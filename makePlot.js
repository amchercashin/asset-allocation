function addBlankPlot(plotDiv) {
    Plotly.newPlot(plotDiv, [], {showlegend: true, legend: {"orientation": "h"}});
}

function addTracesToPlot (plot, indices) {
    for (index of indices) {
        let trace =  makeTrace(index);
        Plotly.addTraces(plot, trace);
        console.log("Add blank trace: " + index);
    }
    Plotly.addTraces(plot, ipc);
    //Plotly.relayout(plot, {showlegend: true, legend: {"orientation": "h", x: 0.5, y: -0.1}})
    return true;
}

function makeTrace(index) {
    let trace = {};
    trace.type = "scatter";
    trace.name = index;
    trace.x = [];
    trace.y = [];
    trace.marketDay = [];
    trace.transforms = [{
        type: 'sort',
        target: 'x',
        order: 'ascending'
    }];
    return trace;
}