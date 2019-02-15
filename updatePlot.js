async function updateAllTracesLoop (plot, indices, startDate) {
    let itemsProcessed = 0;
    return indices.map(async (index, indexNum, indices) => {
        let dataUpdate = {};        
        dataUpdate = await maybeGetFromStore(index);
        let promises = [];
        let allDonePromises = [];
        if (dataUpdate) {
            
            allDonePromises.push(
                Plotly.extendTraces(plot, {x: [dataUpdate.x], y: [dataUpdate.y], marketDay: [dataUpdate.marketDay]}, [traceIndexByName(index)]).then(
                x => {
                        console.log("Index: " + index + "loaded frome storage.");                    
                    }
                )
            );
            
        } else {
            console.log("start to build: " + index);
            if (index === "RGBITR") {
                promises.push(updateTraceLoop(plot, index, startDate, engine = "stock"));
                promises.push(updateTraceLoop(plot, index, startDate, engine = "state"));
            } else {
                promises.push(updateTraceLoop(plot, index, startDate, engine = "stock"));
            }

            allDonePromises.push(Promise.all(promises).then(val => {
                        return Promise.all(val.flat()); 
                    }).then(val => {
                        let sortedData = sortByDate(plot.data[traceIndexByName(index)]);                
                        let expandedData = expandTimeseries(sortedData);
                        plot.data[traceIndexByName(index)].x = expandedData.x;
                        plot.data[traceIndexByName(index)].y = expandedData.y;
                        plot.data[traceIndexByName(index)].marketDay = expandedData.marketDay;    

                        maybeStore(index, plot.data[traceIndexByName(index)]);
                        console.log(index + " put to storage.");                
                    }).catch((err) => {
                        throw new Error('Error in maybeStore promise chain' + err.message);
                    })
            )

        }
        return allDonePromises;
    });
}

async function updateTraceLoop (plot, index, startDate, engine) {
    let lastRecord = getLastRecord(index, startDate, engine);
    let firstValue = getFirstValue(index, startDate);
    [lastRecord, firstValue] = await Promise.all([lastRecord, firstValue]);
    
    let promises = [];
    for (let i = 0; i < lastRecord; i += 100) {
        let promise = updateTraceData(plot, index, startDate, i, firstValue, engine);
        promises.push(promise);
    }
    return promises;
}

async function updateTraceData (plot, index, startDate, fromIndex, firstValue, engine) {
    let traceDataChunk = await axios.get("https://iss.moex.com/iss/history/engines/"+engine+"/markets/index/securities/"+index+".json?start="+fromIndex+"&from="+startDate);
    let dataUpdate = await extract(traceDataChunk.data.history.data, 2, engine==="stock" ? 5 : 7 );
    dataUpdate.y = await normalize(dataUpdate.y, firstValue);
    // dataUpdate = expandTimeseries(dataUpdate);
    Plotly.extendTraces(plot, {x: [dataUpdate.x], y: [dataUpdate.y]}, [traceIndexByName(index)]);
    return true;
}