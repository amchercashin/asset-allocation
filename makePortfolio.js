plot.on('plotly_click', function(data){
    document.getElementById('start-date').value = data.points[0].x;
    console.log(data.points[0].x);
    return false;
});

function showModel(form) {
    let modelTrace = {};
    const newStartDate = form.elements.namedItem("start-date").value; //redo to findClosest date
    const rebalancePeriod = form.elements.namedItem("rebalance-period").value;
    const sharesPart =  parseInt(100 - form.elements.namedItem("balance-slider").value) / 100;
    if (newStartDate != startDate) {
        let deleteIndicies = [];
        for (trace in plot.data) {
            if (trace > 1) {
                deleteIndicies.push(parseInt(trace));
            }
        }
        Plotly.deleteTraces(plot, deleteIndicies);
    }
    model = makeModel(newStartDate, rebalancePeriod, sharesPart);
    activeModel = model;
    modelTrace.x = model.x;
    modelTrace.y = model.y;
    modelTrace.type = "scatter";
    modelTrace.name = "Портфель А:" + sharesPart.toString() + " О:" + ((100-sharesPart*100)/100).toString() + " Р:" + rebalancePeriod.toString();
    Plotly.addTraces(plot, modelTrace);
    // Plotly.addTraces(plot, rebalances);
    // rebalances = [];
    startDate = newStartDate;
    // Plotly.relayout(plot, {showlegend: true, legend: {"orientation": "h", x: 0.5, y: -0.1}})
    return false;
}

function makeModel(startDate = "2010-12-30", rebalancePeriod = 365, sharesPart = 0.5) {
    const RUGBITR5Pshare = 1 - sharesPart;
    const data = plot.data;
    const startIndex = data[0].x.indexOf(startDate);
    for (trace in data) {
        if (trace < 2) {
            data[trace].y = normalize(data[trace].y, startIndex);
        }
    }
    const model = {
        x: new Array(),
        shareValue: new Array(),
        bondValue: new Array(),
        y: new Array()
    };
    
    let nextRebalanceDate = moment(startDate, "YYYY-MM-DD").add(rebalancePeriod, "d");
    let j = 0;
    for(let i = startIndex; i < data[0].x.length; i++) {
        let shareValue;
        let bondValue;
        let combinedValue;
        let currentDate = data[0].x[i];
        // console.log(nextRebalanceDate)
        model.x.push(currentDate);
        if (currentDate === nextRebalanceDate.format("YYYY-MM-DD") && !data[0].marketDay[i]) {
            for (let d = i; d < data[0].x.length; d++) {
                if (data[0].marketDay[d]) {
                    nextRebalanceDate = moment(data[0].x[d], "YYYY-MM-DD");
                    break;
                }
            }
            console.log("Shifting rebalance day: " + currentDate + "\nto next market day: " + nextRebalanceDate.format("YYYY-MM-DD"))
        }
        if (i === startIndex) {
            // INITIAL BALANCE
            combinedValue = (data[0].y[i] + data[1].y[i]) / 2;
            shareValue = combinedValue * sharesPart;
            bondValue = combinedValue * RUGBITR5Pshare;
            console.log("Initial balance:" + model.x[model.x.length-1]);
        } else if (currentDate === nextRebalanceDate.format("YYYY-MM-DD")) {
            // REBALANCE
            combinedValue = data[0].y[i] / data[0].y[i-1] * model.shareValue[j-1] + data[1].y[i] / data[1].y[i-1] * model.bondValue[j-1];
            shareValue = combinedValue * sharesPart;
            bondValue = combinedValue * RUGBITR5Pshare;
            nextRebalanceDate = moment(currentDate, "YYYY-MM-DD").add(rebalancePeriod, "d")
            // rebalances.push({x: [currentDate, currentDate], y: [1.1, combinedValue], line: {color: lineColors[plot.data.length], dash: "dash"}, showlegend: false});
            console.log("rebalance:" + model.x[model.x.length-1]);
        } else {
            // REGULAR
            shareValue = data[0].y[i] / data[0].y[i-1] * model.shareValue[j-1];
            bondValue = data[1].y[i] / data[1].y[i-1] * model.bondValue[j-1];
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

// let rebalances = [];

// const lineColors = [
//     '#1f77b4',  // muted blue
//     '#ff7f0e',  // safety orange
//     '#2ca02c',  // cooked asparagus green
//     '#d62728',  // brick red
//     '#9467bd',  // muted purple
//     '#8c564b',  // chestnut brown
//     '#e377c2',  // raspberry yogurt pink
//     '#7f7f7f',  // middle gray
//     '#bcbd22',  // curry yellow-green
//     '#17becf'   // blue-teal
// ];


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