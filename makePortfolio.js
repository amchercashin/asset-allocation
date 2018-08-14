plot.on('plotly_click', function(data){
    document.getElementById('start-date').value = data.points[0].x;
    console.log(data.points[0].x);
    return false;
});

function showModel(form) {
    let modelTrace = {};
    const startDate = form.elements.namedItem("start-date").value; //redo to findClosest date
    const rebalancePeriod = form.elements.namedItem("rebalance-period").value;
    const RTSSTDTRRshare =  parseInt(100 - form.elements.namedItem("balance-slider").value) / 100;
    
    model = makeModel(startDate, rebalancePeriod, RTSSTDTRRshare);
    activeModel = model;
    modelTrace.x = model.x;
    modelTrace.y = model.y;
    modelTrace.type = "scatter";
    modelTrace.name = "Модельный портфель";
    Plotly.addTraces(plot, modelTrace);
    return false;
}

function makeModel(startDate = "2010-12-30", rebalancePeriod = 365, RTSSTDTRRshare = 0.5) {
    const RUGBITR5Pshare = 1 - RTSSTDTRRshare;
    const data = plot.data;
    const model = {
        x: new Array(),
        shareValue: new Array(),
        bondValue: new Array(),
        y: new Array()
    };
    const startIndex = plot.data[0].x.indexOf(startDate);
    let nextRebalanceDate = moment(startDate, "YYYY-MM-DD").add(rebalancePeriod, "d");
    let j = 0;
    for(let i = startIndex; i < data[0].x.length; i++) {
        let shareValue;
        let bondValue;
        let combinedValue;
        let currentDate = data[0].x[i];
        // console.log(nextRebalanceDate)
        model.x.push(currentDate);
        
        if (i === startIndex) {
            // INITIAL BALANCE
            combinedValue = (plot.data[0].y[i] + plot.data[1].y[i]) / 2;
            shareValue = combinedValue * RTSSTDTRRshare;
            bondValue = combinedValue * RUGBITR5Pshare;
            console.log("Initial balance:" + model.x[model.x.length-1]);
        } else if (moment(currentDate, "YYYY-MM-DD") >= nextRebalanceDate && moment(data[0].x[i-1], "YYYY-MM-DD") < nextRebalanceDate) {
            // REBALANCE
            combinedValue = plot.data[0].y[i] / plot.data[0].y[i-1] * model.shareValue[j-1] + plot.data[1].y[i] / plot.data[1].y[i-1] * model.bondValue[j-1];
            shareValue = combinedValue * RTSSTDTRRshare;
            bondValue = combinedValue * RUGBITR5Pshare;
            nextRebalanceDate = moment(currentDate, "YYYY-MM-DD").add(rebalancePeriod, "d")
            console.log("rebalance:" + model.x[model.x.length-1]);
        } else {
            // REGULAR
            shareValue = plot.data[0].y[i] / plot.data[0].y[i-1] * model.shareValue[j-1];
            bondValue = plot.data[1].y[i] / plot.data[1].y[i-1] * model.bondValue[j-1];
            combinedValue = shareValue + bondValue;
        }

        // UPDATE MODEL
        model.shareValue.push(shareValue);
        model.bondValue.push(bondValue);
        model.y.push(combinedValue);
        j++;
    }
    return model;
}


// plot.on('plotly_click', function(data){
//     let pts = '';
//     for(let i=0; i < data.points.length; i++){
//         annotate_text = 'x = '+data.points[i].x +
//                       'y = '+data.points[i].y.toPrecision(4);

//         annotation = {
//           text: annotate_text,
//           x: data.points[i].x,
//           y: parseFloat(data.points[i].y.toPrecision(4))
//         }

//         annotations = [];
//         annotations.push(annotation);
//         Plotly.relayout(plot,{annotations: annotations})
//     }
// });