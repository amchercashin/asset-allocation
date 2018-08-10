plot.on('plotly_click', function(data){
    let pts = '';
    for(let i=0; i < data.points.length; i++){
        annotate_text = 'x = '+data.points[i].x +
                      'y = '+data.points[i].y.toPrecision(4);

        annotation = {
          text: annotate_text,
          x: data.points[i].x,
          y: parseFloat(data.points[i].y.toPrecision(4))
        }

        annotations = self.layout.annotations || [];
        annotations.push(annotation);
        Plotly.relayout(plot,{annotations: annotations})
    }
});