async function getLastRecord(indexID = "RGBITR", startDate = "2003-02-26", engine = "stock") {
    const response = await axios.get("https://iss.moex.com/iss/history/engines/"+engine+"/markets/index/securities/"+indexID+".json?limit=1&from="+startDate);
    const lastRecord = response.data["history.cursor"]["data"][0][1];
    return lastRecord;
}

async function getFirstValue(indexID = "RGBITR", startDate = "2003-02-26", engine = "stock", valueCol = 5) {
    if (indexID === "RGBITR") {
        engine = "state";
        valueCol = 7;
    }
    const response = await axios.get("https://iss.moex.com/iss/history/engines/"+engine+"/markets/index/securities/"+indexID+".json?limit=1&from="+startDate);
    const firstValue = response.data["history"]["data"][0][valueCol];
    return firstValue;
}

async function getDataAsync(indexID = "RGBITR", startDate = "2003-02-26", engine = "stock", fromIndex = 0) {
    let promiseOfData;
    promiseOfData = axios.get("https://iss.moex.com/iss/history/engines/"+engine+"/markets/index/securities/"+indexID+".json?start="+fromIndex+"&from="+startDate);
    console.log("Requested: " + indexID);
    return(promiseOfData);    
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
