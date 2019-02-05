function addBlankPlot(plotDiv) {
    Plotly.newPlot(plotDiv, [], {showlegend: true, legend: {"orientation": "h"}});
}

function addTracesToPlot (plot, indices) {
    Plotly.addTraces(plot, ipc);
    for (index of indices) {
        let trace =  makeTrace(index);
        Plotly.addTraces(plot, trace);
        console.log("Add blank trace: " + index);
    }
    return true;
    // Plotly.relayout(plot, {showlegend: true, legend: {"orientation": "h", x: 0.5, y: -0.1}})
}

function makeTrace(index) {
    let trace = {};
    trace.type = "scatter";
    trace.name = index;
    trace.x = [];
    trace.y = [];
    trace.transforms = [{
        type: 'sort',
        target: 'x',
        order: 'ascending'
    }];
    return trace;
}