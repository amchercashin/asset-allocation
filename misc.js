function updateSliderLables() {
    document.getElementById("MCFTRR-share").innerText = parseInt(100 - this.value);
    document.getElementById("RGBITR-share").innerText = this.value;
}

async function extract(data, dateCol = 2, valueCol = 5) {
    return { x: data.map(row => row[dateCol]), 
             y: data.map(row => row[valueCol]) 
            }
}

function normalize(arr, firstValue) {
    return arr.map((el, i, arr) => el / firstValue)
}

function traceIndexByName(indexName) {
    return indices.findIndex(function(e) {return e === indexName}) + 1
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