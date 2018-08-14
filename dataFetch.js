async function getLastRecord(indexID, startDate) {
    const response = await axios.get("https://iss.moex.com/iss/history/engines/stock/markets/index/securities/" + indexID + ".json?limit=1&from=" + startDate);
    const lastRecord = response.data["history.cursor"]["data"][0][1];
    return lastRecord;
}

async function getDataAsync(indexID, startDate = "2010-12-30") {  
    const lastRecord = await getLastRecord(indexID, startDate);
    let promises = [];
    let data = [];
        for (let i = 0; i < lastRecord; i += 100) {
            promises.push(axios.get("https://iss.moex.com/iss/history/engines/stock/markets/index/securities/" + indexID + ".json?start=" + i + "&from=" + startDate));
        }
    const results = await Promise.all(promises);
    data = results.reduce((acc, val) => acc.concat(val.data.history.data), []);
    console.log("Fethed: " + indexID);
    return(data);    
}

async function extractAndNormalize(data, dateCol = 2, valueCol = 5) {
    return { x: data.map(row => row[dateCol]), 
             y: data.map((row, i, arr) => row[valueCol] / arr[0][valueCol]) 
            }
}

