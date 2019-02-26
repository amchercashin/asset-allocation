function makeModel(startDate = "2010-12-30", rebalancePeriod = 365, sharesPart = 0.5, data = plot.data, showInfo = false) {
    const RUGBITR5Pshare = 1 - sharesPart;
    const startIndex = data[0].x.indexOf(startDate);
    // for (trace in data) {
    //     if (trace < 3) {
    //         // data[trace] = sortByDate(data[trace]);
    //         data[trace].y = normalize2(data[trace].y, startIndex);
    //     }
    //     addCAGRs();
    // }
    const model = {
        x: new Array(),
        shareValue: new Array(),
        bondValue: new Array(),
        y: new Array(),
        rebalanceX: new Array(),
        rebalanceY: new Array()
    };
    
    let nextRebalanceDate = moment(startDate, "YYYY-MM-DD").add(rebalancePeriod, "d");
    let j = 0;
    let shareValue;
    let bondValue;
    let combinedValue;
    let currentDate
    
    // INITIAL BALANCE
    currentDate = data[0].x[startIndex];
    combinedValue = (data[0].y[startIndex] + data[1].y[startIndex]) / 2;
    shareValue = combinedValue * sharesPart;
    bondValue = combinedValue * RUGBITR5Pshare;
    showInfo && console.log("Initial balance:" + model.x[model.x.length-1]);
    model.x.push(currentDate);
    model.shareValue.push(shareValue);
    model.bondValue.push(bondValue);
    model.y.push(combinedValue);
    j++;
    
    for(let i = startIndex + 1; i < data[0].x.length; i++) {
        currentDate = data[0].x[i];
        model.x.push(currentDate);
        
        if (currentDate !== nextRebalanceDate.format("YYYY-MM-DD")) {
            // REGULAR
            shareValue = data[0].y[i] / data[0].y[i-1] * model.shareValue[j-1];
            bondValue = data[1].y[i] / data[1].y[i-1] * model.bondValue[j-1];
            combinedValue = shareValue + bondValue;
        } else {
            //CHECK MARKETDAY AND MOVE REBALANCE DATE
            if (!data[0].marketDay[i]) {
                for (let d = i; d < data[0].x.length; d++) {
                    if (data[0].marketDay[d]) {
                        nextRebalanceDate = moment(data[0].x[d], "YYYY-MM-DD");
                        break;
                    }
                }
                showInfo && console.log("Shifting rebalance day: " + currentDate + "\nto next market day: " + nextRebalanceDate.format("YYYY-MM-DD"))
            } else {
                // REBALANCE
                combinedValue = data[0].y[i] / data[0].y[i-1] * model.shareValue[j-1] + data[1].y[i] / data[1].y[i-1] * model.bondValue[j-1];
                shareValue = combinedValue * sharesPart;
                bondValue = combinedValue * RUGBITR5Pshare;
                nextRebalanceDate = moment(currentDate, "YYYY-MM-DD").add(rebalancePeriod, "d")
                model.rebalanceX.push(currentDate); model.rebalanceY.push(combinedValue);
                showInfo && console.log("rebalance:" + model.x[model.x.length-1]);
            }
        }

        // UPDATE MODEL
        model.shareValue.push(shareValue);
        model.bondValue.push(bondValue);
        model.y.push(combinedValue);
        j++;
    }
    return model;
}