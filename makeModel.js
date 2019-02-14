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
            if (showInfo) console.log("Shifting rebalance day: " + currentDate + "\nto next market day: " + nextRebalanceDate.format("YYYY-MM-DD"))
        }
        if (i === startIndex) {
            // INITIAL BALANCE
            combinedValue = (data[0].y[i] + data[1].y[i]) / 2;
            shareValue = combinedValue * sharesPart;
            bondValue = combinedValue * RUGBITR5Pshare;
            if (showInfo) console.log("Initial balance:" + model.x[model.x.length-1]);
        } else if (currentDate === nextRebalanceDate.format("YYYY-MM-DD")) {
            // REBALANCE
            combinedValue = data[0].y[i] / data[0].y[i-1] * model.shareValue[j-1] + data[1].y[i] / data[1].y[i-1] * model.bondValue[j-1];
            shareValue = combinedValue * sharesPart;
            bondValue = combinedValue * RUGBITR5Pshare;
            nextRebalanceDate = moment(currentDate, "YYYY-MM-DD").add(rebalancePeriod, "d")
            model.rebalanceX.push(currentDate); model.rebalanceY.push(combinedValue);
            if (showInfo) console.log("rebalance:" + model.x[model.x.length-1]);
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