function addBlankPlot(plotDiv) {
    Plotly.newPlot(plotDiv, []);
}

async function addTracesToPlot (plot, indices, startDate) {
    for (index of indices) {
        let trace =  await makeTrace(index, startDate);
        Plotly.addTraces(plot, trace);
        console.log("Add trace: " + index);
    }
}

async function makeTrace(index, startDate) {
    let data = await maybeGetFromStore(index);
    if (data) {
        trace = data;
    } else {
        trace = await extractAndNormalize(await getDataAsync(index, startDate));
        maybeStore(index, trace);
    }    
    trace.type = "scatter";
    trace.name = index;
    return trace;
}