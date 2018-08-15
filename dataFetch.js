async function getLastRecord(indexID, startDate = "2003-02-26", engine = "stock") {
    const response = await axios.get("https://iss.moex.com/iss/history/engines/"+engine+"/markets/index/securities/"+indexID+".json?limit=1&from="+startDate);
    const lastRecord = response.data["history.cursor"]["data"][0][1];
    return lastRecord;
}

async function getDataAsync(indexID, startDate = "2003-02-26", engine = "stock") {
    const lastRecord = await getLastRecord(indexID, startDate);
    let promises = [];
    let data = [];
        for (let i = 0; i < lastRecord; i += 100) {
            promises.push(axios.get("https://iss.moex.com/iss/history/engines/"+engine+"/markets/index/securities/"+indexID+".json?start="+i+"&from="+startDate));
        }
    const results = await Promise.all(promises);
    data = results.reduce((acc, val) => acc.concat(val.data.history.data), []);
    console.log("Fethed: " + indexID);
    return(data);    
}

async function extract(data, dateCol = 2, valueCol = 5) {
    return { x: data.map(row => row[dateCol]), 
             y: data.map(row => row[valueCol]) 
            }
}

async function normalize(arr) {
    return arr.map((el, i, arr) => el / arr[0])
}

function expandTimeseries(data) {
    const startDate = data.x[0];
    const endDate = data.x[data.x.length - 1];
    newX = [];
    newY = [];
    marketDay = [];
    days = moment.duration(moment(endDate).diff(moment(startDate))).as("days");
    let dayName;
    let index;
    for (let day = 0; day <= days; day++) {
        dayName = moment(startDate, "YYYY-MM-DD").add(day, "d").format("YYYY-MM-DD");
        newX.push(dayName);
        index = data.x.indexOf(dayName);
        if (index !== -1) {
            newY.push(data.y[index]);
            marketDay.push(true);
        } else {
            newY.push(newY[day - 1]);
            marketDay.push(false);
        }
    }
    return {x: newX, y: newY, marketDay: marketDay}
}

// function getDateRange(startDate, endDate) {
//     dateRange = [];
//     const days = moment.duration(moment(endDate).diff(moment(startDate))).as("days");
//     for (let day = 0; day <= days; day++) {
//         dayName = moment(startDate, "YYYY-MM-DD").add(day, "d").format("YYYY-MM-DD");
//         dateRange.push(dayName);
//     }
//     return dateRange;
// }
