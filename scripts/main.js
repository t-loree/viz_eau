proj4.defs("EPSG:2154","+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
ol.proj.proj4.register(proj4)
 var map = new ol.Map({

    target: 'map',
    layers: [
        new ol.layer.Tile({
            source: new ol.source.OSM()
        })
    ],
    view: new ol.View({
        // projection: 'EPSG:3857',
        center: ol.proj.fromLonLat([-2,48]),
        zoom: 7.5
    })
});
$.ajax({
    type: "GET",
    dataType: "json",
    url: "https://hubeau.eaufrance.fr/api/v1/hydrometrie/referentiel/stations",
    data:'code_region=53&size=2500&fields=code_site,coordonnee_x_station,coordonnee_y_station,libelle_cours_eau',
    beforeSend:function() {
        //ecrire message que ça télécharge
    },
    success: function(data){
        //ecrire message que c'est ok

        stationSource = new ol.source.Vector({});

        for (var j = 0; j < data['data'].length; j++) {

            // cree le point en veillant a changer la projection
            var x=data['data'][j]['coordonnee_x_station'];
            var y=data['data'][j]['coordonnee_y_station'];
            var reproj=ol.proj.transform([x, y], 'EPSG:2154','EPSG:3857')
            //var reproj=ol.proj.fromLonLat([y,x],'EPSG:3857')
            var featureGeom = new ol.geom.Point(reproj)
            // cree la feature
            var featureThing = new ol.Feature({
                name: data['data'][j]['code_site'],
                cours_eau:data['data'][j]['libelle_cours_eau'],
                geometry: featureGeom,
                x_:x,
                y_:y
                //////////////////////////////////////////////////AJOUT QUALITE

            });
            // ajoute la feature a la source

            stationSource.addFeature(featureThing);
        }

        var vecteurStationQualite = new ol.layer.Vector({
            name:"stationQuali",
            source: stationSource,
            style:new ol.style.Style({
                image: new ol.style.RegularShape({
                    fill: new ol.style.Fill({
                        color: "#50f015",
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'black',
                        width: 1
                    }),
                    points: 3,
                    radius: 7,
                    angle: 0,
                })

            })
        });

        map.addLayer(vecteurStationQualite);

        selection1 = new ol.Collection();
        selection_station = new ol.interaction.Select({
            layers:[vecteurStationQualite],
            features:selection1
        });

        map.addInteraction(selection_station);

        var displayFeatureInfo = function(pixel) {

            var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
                return feature;
            });

            if (feature) {
                $.ajax({
                    type: "GET",
                    dataType: "json",
                    url: "https://hubeau.eaufrance.fr/api/v1/hydrometrie/observations_tr",
                    data:'code_entite='+feature.get('name')+'&grandeur_hydro=H&fields=code_site,date_obs,resultat_obs&size=1000&timestep=60',
                    success: function(data){
                        if ($("#divPopup1").children().first()){
                            $("#divPopup1").children().remove();
                        }
                        if (data.data.length==0){
                            $("#divPopup1").append([
                                "<br>Station "+feature.get('name')+"</b>",
                                "<ul>",
                                "<span style='padding-top:60px;font-size:20px'>",
                                "<li><i>Pas d'enregistrement</i></li></ul></span>"].join(""));
                        }
                        else {
                            let trace1={
                                name:"Débit",
                                x:[],
                                y:[],
                                mode:"lines",
                                opacity: 0.5,
                                connectgaps:false,
                                type: "scattergl",
                                line: {
                                color:"blue",
                                width: 1
                                }
                            };
                            sum=0
                            data['data'].forEach(function(val) {
                                sum+=val['resultat_obs']/1000
                                trace1.y.push(val['resultat_obs']/1000);
                                trace1.x.push(val['date_obs']);
                            })
                            mean=sum/trace1.y.length
                            res = Math.max.apply(Math,trace1.y.map(function(o){return o}))
                            diff=res/mean
                            _layout = {
                                xaxis: {
                                    title: 'Date',
                                    domain: [0, 0.85]
                                },
                                yaxis: {
                                    title: 'm3/s',
                                    titlefont:{color:"blue"},
                                    tickfont: {color: 'blue'},
                                    rangemode: 'tozero'
                                },
                                shapes: [
                                {
                                    type: 'line',
                                    xref: 'paper',
                                    x0: 0,
                                    y0: mean,
                                    x1: 1,
                                    y1: mean,
                                    line:{
                                        color: 'rgb(255, 0, 0)',
                                        width: 2,
                                        dash:'dot'
                                    }
                                }
                                ]
                            }
                        Plotly.newPlot($("#Flow")[0], [trace1], _layout, {
                        responsive: false,
                        modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
                        scrollZoom: true
                        });

                        $("#divPopup1").append([
                            "<b style='padding-top:60px;font-size:20px' >Cours d'eau : "+feature.get('cours_eau'),
                            "<br>Station "+feature.get('name')+"</b>",
                            "<ul>",
                            "<span style='padding-top:60px;font-size:20px'>",
                            "<li>Premier enregistrement : "+data.data[0].date_obs+"</li>",
                            "<li>Dernier enregistrement : "+data.data[data.data.length-1].date_obs+"</li>",
                            "<li>Nombre d'enregistrement : "+data.data.length+"</li></ul></span>",
                            "<li>Débit max : "+res+" (supérieur à "+Math.round(diff*100)/100+" fois le débit moyen)</li></ul></span>"].join(""));
                        }
                    }
                });
            };
        };
        function show_info(){
            var evtKey=map.on('click', function(evt) {
                if (evt.dragging) {
                    return;
                };
            var pixel = map.getEventPixel(evt.originalEvent);
            displayFeatureInfo(pixel);
            });
            return evtKey;
        };

        key_gap =show_info();

    }
})