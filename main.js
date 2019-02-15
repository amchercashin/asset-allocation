let plot = document.getElementById("graphDiv");
// let bondPlot = document.getElementById("bondPlot");
// let bondIndices = [ "RUGBITR1Y", "RUGBITR3Y", "RUGBITR5Y", "RUGBITR10Y", "RUGBITR5+", "RGBITR"];
// let bondStartDate = "2010-12-30";
            //   2010-12-30
// let indices = ["MCFTRR", "RGBITR", "RUGBITR10Y", "RUGBITR5Y", "RUGBITR3Y", "RUGBITR1Y"];
//               2003-02-26  2002-12-30 2
// let indices = ["RTSSTDTRR", "RUGBITR5+"];
// let startDate = "2010-12-30";
let indices = ["MCFTRR", "RGBITR"];
let startDate = "2003-02-26";
// let indices = ["MCFTRR", "RUGBITR5+", "RGBITR"];
// let startDate = "2010-12-30";

let endDate = "";
let rebalancePeriod = 365;
let activeModel = {};


document.getElementById('start-date').value = startDate;
document.getElementById('start-date').min = startDate;
document.getElementById('rebalance-period').value = rebalancePeriod;
document.getElementById('balance-slider').oninput = updateSliderLables;

// addBlankPlot(bondPlot);
// addTracesToPlot(bondPlot, bondIndices, bondStartDate);

addBlankPlot(plot);
addTracesToPlot(plot, indices);
(async function(){
    let res = await updateAllTracesLoop(plot, indices, startDate);
    console.log(res);
    res = await Promise.all(res);
    console.log(res);
    res = await Promise.all(res.flat());
    console.log(res);
    // res = await Promise.all(res.flat());
    // console.log(res);

    document.getElementById("run-button").disabled = false;
    plot.layout.xaxis.autorange = false;
    addCAGRs();
    let endDate = plot.data[0].x.slice(-1)[0];
    document.getElementById('start-date').max = endDate;
    document.getElementById('rebalance-period').max = moment.duration(moment(endDate).diff(moment(startDate))).as("days");
})()

function addCAGRs() {
    console.log("CAGRS strart")
    const colors = [
        '#1f77b4',  // muted blue
        '#ff7f0e',  // safety orange]
        'grey'
    ]
    for (i=0; i<3; i++) {
        let startDate = moment(plot.data[i].x[0], "YYYY-MM-DD");
        let endDate = moment(plot.data[i].x[plot.data[i].x.length-1], "YYYY-MM-DD");
        let durationInDays = moment.duration(endDate.diff(startDate)).as("days") + 1;
        let startVal = plot.data[i].y[0];
        let endVal = plot.data[i].y[plot.data[i].y.length-1];
        let CAGR = (endVal / startVal) ** (1 / (durationInDays/365));
        let CAGRtrace = makeCAGRtrace(CAGR);
        CAGRtrace.line = {};
        CAGRtrace.line.color = colors[i];
        CAGRtrace.line.dash = "dot";
        CAGRtrace.line.width = 1;
        CAGRtrace.textfont = {color: colors[i]}
        Plotly.addTraces(plot, CAGRtrace);
    }
    return true;
}


let simulationWorker = new Worker('simulation.js');
function startSimulation() {
    simulationWorker.postMessage(plot.data);
    console.log('Message posted to worker');
    return true;
  }

const evaluatedModels = [];
simulationWorker.onmessage = function(e) {
    console.log('Message received from worker');
    let CAGRtrace = makeCAGRtrace(e.data.weightedCAGR);
    CAGRtrace.name = "Share part: " + e.data.sharesParts + "; SD: " + Math.round(e.data.standardDeviation*1000)/1000;
    CAGRtrace.showlegend = true;
    Plotly.addTraces(plot, CAGRtrace);
    evaluatedModels.push(e.data);
    return true;
}

function makeCAGRtrace(CAGR, showLegend = false, textPosition = "left", startIndex = 0, daysPerPoint = 90) {
    const dayCAGR = CAGR**(1/365);
    let newX = plot.data[0].x.slice(startIndex, plot.data[0].x.length);
    let newY = newX.map((x, i) => dayCAGR**i);

    newX = newX.filter((el, i, arr) => {
        if (i===0) {return true} else if (i===arr.length-1) {return true} else if (i % daysPerPoint === 0) {return true}
    });
    newY = newY.filter((el, i, arr) => {
        if (i===0) {return true} else if (i===arr.length-1) {return true} else if (i % daysPerPoint === 0) {return true}
    });
    const annotation = [];
    annotation[newY.length-1] = "CAGR:"+Math.round(CAGR*1000)/1000;
    return {x: newX, y: newY, type: "scatter", mode: 'lines+text', text: annotation, textposition: textPosition, showlegend: showLegend, hoverinfo: "skip"};
}

plot.layout = {
    showlegend: true, 
    legend: {"orientation": "h", x: 0.5, y: -0.1},
    hovermode:'x',
    margin: {
        t: 10, //top margin
        l: 20, //left margin
        r: 20, //right margin
        b: 10 //bottom margin
        }
 };


window.onresize = function() {
    Plotly.Plots.resize(plot);
    // Plotly.Plots.resize(bondPlot);
};
