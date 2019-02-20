const rebalancePeriods = [7, 30, 90, 182, 365, 182+365, 365*2];
// const rebalancePeriods = [365];
const sharesParts = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

function simulateForEveryPeriod(rebalancePeriod = 365, sharesPart = 0.5, data = plot.data, skipDays = 100) {
    const models = [];
    let i = 0;
    data[0].x.forEach(modelStartDate => {        
        if (i % skipDays === 0) {
            const model = makeModel(modelStartDate, rebalancePeriod, sharesPart, data, showInfo = false);
            model.CAGR = ( model.y[model.y.length-1]/model.y[0] ) ** (364 / (model.y.length-1));
            model.CAGRweight = model.y.length-1;
            models.push(model);
            // Plotly.addTraces(plot, {x: model.x, y: model.y, type: "scatter", showlegend: false});
        }

        i++;
    })
    return models;
}

function weightedCAGR(models) {
    let CAGRweightedSum = 0;
    let CAGRallWeight = 0;
    models.forEach(model => {
        CAGRweightedSum += model.CAGR * model.CAGRweight;
        CAGRallWeight += model.CAGRweight;
    })
    return CAGRweightedSum / CAGRallWeight;
}

function weightedSD(models, mean) {
    let variance = 0;
    let n = 0;
    models.forEach(model => {
        variance += Math.pow(model.CAGR - mean, 2) * model.CAGRweight;
        n += model.CAGRweight;
    })
    variance = variance / n;
    return Math.pow(variance, 1/2);
}

// function meandDiff(models, mean) {
//     let meanDiff = 0;
//     let n = 0;
//     models.forEach(model => {
//         meanDiff += model.CAGR - mean;
//         n += model.CAGRweight;
//     })
//     meanDiff = meanDiff / n;
//     return meanDiff;
// }

function simulate (data = plot.data) {
    const startTime = new Date();
    // const results = [];
    
    for (p of rebalancePeriods) {
        for (s of sharesParts) {
            const weightedModel = {};
            const models = simulateForEveryPeriod(rebalancePeriod = p, sharesPart = s, data = data, skipDays = 60);
            weightedModel.rebalancePeriod = p;
            weightedModel.sharesParts = s;
            weightedModel.weightedCAGR = weightedCAGR(models);
            weightedModel.standardDeviation = weightedSD(models, weightedModel.weightedCAGR);
            // weightedModel.meanDiff = meandDiff(models, weightedModel.weightedCAGR);
            // results.push(weightedModel);
            postMessage(weightedModel)            
        }
    }
    let timeDiff = new Date() - startTime;
    console.log(Math.round(timeDiff/1000) + " seconds");

    // return results;
}

importScripts('https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js'); 
importScripts('makeModel.js'); 
onmessage = function(e) {
    console.log('Message received from main script');
    const workerResult = simulate(e.data);
    // console.log('Posting message back to main script');
    // postMessage(workerResult);
    close();
  }