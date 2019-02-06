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

function normalize2(arr, normPoint = 0) {
    return arr.map((el, i, arr) => el / arr[normPoint])
}

function traceIndexByName(indexName) {
    return indices.findIndex(function(e) {return e === indexName})
}

function sortByDate(data) {
    let tempArr = [];
    
    for (let i = 0; i < data.x.length; i++) {
        tempArr.push( [data.x[i], data.y[i]] );
    }
    tempArr.sort( function(a,b) { return moment(a[0]) - moment(b[0]) } );
    
    let newX = [];
    let newY = [];
    
    for (let i = 0; i < tempArr.length; i++) {
        newX.push(tempArr[i][0]);
        newY.push(tempArr[i][1]);
    } 
    
    return {x: newX, y: newY};
}

function expandTimeseries(data) {
    const startDate = data.x[0];
    const endDate = data.x[data.x.length - 1];
    let newX = [];
    let newY = [];
    let marketDay = [];
    let days = moment.duration(moment(endDate).diff(moment(startDate))).as("days");
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
    return {x: newX, y: newY, marketDay: marketDay};
}