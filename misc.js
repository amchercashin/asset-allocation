function updateSliderLables() {
    document.getElementById("MCFTRR-share").innerText = parseInt(100 - this.value);
    document.getElementById("RGBITR-share").innerText = this.value;
}


// a and b are javascript Date objects
// function dateDiffInDays(a, b) {
//     const _MS_PER_DAY = 1000 * 60 * 60 * 24;
//     // Discard the time and time-zone information.
//     const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
//     const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

//     return Math.floor((utc2 - utc1) / _MS_PER_DAY);
// }