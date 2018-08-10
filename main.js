let plot = document.getElementById("graphDiv");

let indices = ["RTSSTDTRR", "RUGBITR5+", "RUGBITR10Y", "RUGBITR5Y", "RUGBITR3Y", "RUGBITR1Y"];

addBlankPlot(plot);

addTracesToPlot(plot, indices);


window.onresize = function() {
    Plotly.Plots.resize(plot);
};

plot.on('plotly_click', function(){
    alert('You clicked this Plotly chart!');
});