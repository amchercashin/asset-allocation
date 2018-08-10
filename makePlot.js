function addBlankPlot(plotDiv) {
    Plotly.newPlot(plotDiv, []);
}

async function addTracesToPlot (plot, indices) {
    for (index of indices) {
        let trace =  await makeTrace(index);
        Plotly.addTraces(plot, trace);
        console.log("Add trace: " + index);
    }
}

async function makeTrace(index) {
    let data = await maybeGetFromStore(index);
    if (data) {
        trace = data;
    } else {
        trace = await extractAndNormalize(await getDataAsync(index));
        maybeStore(index, trace);
    }    
    trace.type = "scatter";
    trace.name = index;
    return trace;
}