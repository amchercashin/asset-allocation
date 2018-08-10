let plot = document.getElementById("graphDiv");

let indices = ["RTSSTDTRR", "RUGBITR5+", "RUGBITR10Y", "RUGBITR5Y", "RUGBITR3Y", "RUGBITR1Y"];

addBlankPlot(plot);

addTracesToPlot(plot, indices);

plot.layout = {
    hovermode:'closest',
    title:'Click on Points to add an Annotation on it'
 };


window.onresize = function() {
    Plotly.Plots.resize(plot);
};
