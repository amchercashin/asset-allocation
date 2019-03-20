plot.on('plotly_click', function(data){
    document.getElementById('start-date').style.backgroundColor = "salmon";
    setTimeout(function() {document.getElementById('start-date').style.backgroundColor = "#fff";}, 300);
    document.getElementById('start-date').value = data.points[0].x;
    // console.log(data.points[0].x);
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
            const startIndex = plot.data[trace].x.indexOf(newStartDate);
            if (trace > 1) {
                deleteIndicies.push(parseInt(trace));
            }
            if (trace < 2) {
                // data[trace] = sortByDate(data[trace]);
                const colors = [
                    '#1f77b4',  // muted blue
                    '#ff7f0e',  // safety orange]
                    'grey'
                ]
                plot.data[trace].y = normalize2(plot.data[trace].y, startIndex);
                let startDate = moment(plot.data[trace].x[startIndex], "YYYY-MM-DD");
                let endDate = moment(plot.data[trace].x[plot.data[trace].x.length-1], "YYYY-MM-DD");
                let durationInDays = moment.duration(endDate.diff(startDate)).as("days") + 1;
                let startVal = plot.data[trace].y[startIndex];
                let endVal = plot.data[trace].y[plot.data[trace].y.length-1];
                let CAGR = (endVal / startVal) ** (1 / (durationInDays/365));
                let CAGRtrace = makeCAGRtrace(CAGR, false, "left", startIndex);
                CAGRtrace.line = {};
                CAGRtrace.line.color = colors[trace];
                CAGRtrace.line.dash = "dot";
                CAGRtrace.line.width = 1;
                CAGRtrace.textfont = {color: colors[trace]}
                Plotly.addTraces(plot, CAGRtrace);
            }
        }
        Plotly.deleteTraces(plot, deleteIndicies);
        // addCAGRs();
    }
    const colorInd = plot.data.length == 4? (plot.data.length/2) % 10 : ((plot.data.length-2)/2) % 10;
    let model = makeModel(newStartDate, rebalancePeriod, sharesPart, plot.data, true);
    let activeModel = model;
    modelTrace.x = model.x;
    modelTrace.y = model.y;
    modelTrace.type = "scatter";
    modelTrace.line = {};
    modelTrace.line.color = colors[colorInd];
    modelTrace.name = "Портфель А:" + sharesPart.toString() + " О:" + ((100-sharesPart*100)/100).toString() + " Р:" + rebalancePeriod.toString();
    Plotly.addTraces(plot, modelTrace);
    Plotly.addTraces(plot, {x: activeModel.rebalanceX, y: activeModel.rebalanceY, type: 'scatter', mode: 'markers', showlegend: false, hoverinfo: "skip",
        marker: {
            color: "white",
            size: 9,
            symbol: "circle",
            opacity: 1,
            line: {
                width: 2,
                color: colors[colorInd]
            }            
    }});
    // Plotly.addTraces(plot, rebalances);
    // rebalances = [];
    startDate = newStartDate;
    // Plotly.relayout(plot, {showlegend: true, legend: {"orientation": "h", x: 0.5, y: -0.1}})
    return false;
}

// let rebalances = [];

const colors = [
    '#1f77b4',  // muted blue
    '#ff7f0e',  // safety orange
    '#2ca02c',  // cooked asparagus green
    '#d62728',  // brick red
    '#9467bd',  // muted purple
    '#8c564b',  // chestnut brown
    '#e377c2',  // raspberry yogurt pink
    '#7f7f7f',  // middle gray
    '#bcbd22',  // curry yellow-green
    '#17becf'   // blue-teal
];


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