/**
	A Javascript PhoneGap file by Julien Garcia
**/

$(document).ready( function() {

    document.addEventListener("deviceready", systemReady, true);

    function systemReady(){ // Le système est prêt.	

	/** TO DO LIST **/
	/**  Stocker les bouts de traces en local storage de temps en temps pour ne pas tout perdre en cas de bug **/
	/**  => Est-ce que je peux, sotcker à chaque point ??? TEST ! **/

	var watch_id = null;    // ID of the geolocation
	// var watch_ac = null // ID of the acceleration.
	var tracking_data = []; // Array containing GPS position objects
	// var tracking_ac = []; // Array containing Acceleration objects.
	var startDate; // La date de base au moment de l'activation d'un tracking
	var internet = false; // Internet ou pas.
	var trackRequest = false; // En train de tracker ou de vouloir tracker (pas forcément en fonctionnement).
	var track = false; // En train de tracker ou pas. (En fonctionnement).
	var ghost = false; // En mode fantôme ou pas.
	var connection = ''; // Le mode de connection.

	var timestamp; // Le timestamp de la trace actuellement consultée.
	var data; // Les données de la trace actuellement consultée

	var ioFile = false; // socket.io chargé.

	var iosocket; // Le socket
	var nodejs = false; // nodejs connecté.

	var lowBat = false; // Low Baterie ou pas.
	var minAccuracy = 100; // Précision minimale du point pour qu'il soit retenu.
	var vario = 0; // Le vario durant le tracking;

	var db = window.openDatabase("Database", "1.0", "Tracking", 50000000); // La base de donnée.
	db.transaction(populateDB, errorCB, successCB);

	function populateDB(tx){
		//tx.executeSql('DROP TABLE IF EXISTS tracks');		
		tx.executeSql('CREATE TABLE IF NOT EXISTS tracks (timestamp unique, date TEXT, data TEXT)');
	}

	function errorCB(err){
		 alert("Erreur en manipulant SQL: "+err.code);

	}

	function successCB(){
		console.log("Ok pour SQL");
	}

	// Listen to the battery !!
	window.addEventListener("batterystatus", onBatteryStatus, false);
	function onBatteryStatus(info) { // Handle the battery low event
		//console.log(info.level);
		if (info.isPlugged == false && info.level < 20){
			if (trackRequest == true){
				stopTracking();
				vibrate(500);
				navigator.notification.confirm(
					"La batterie est faible et le tracking a donc été stopé pour économiser de l'énérgie !",
					vibrate(500),
					'Attention',
					'OK'
				);
			}
			lowBat = true;
		}
		else if (info.isPlugged == true){			
			lowBat = false;
		}
	}

	function checkConnection() {
		    connection = navigator.connection.type;

		 /* 
		    var states = {};
		    states[Connection.UNKNOWN]  = 'Unknown connection';
		    states[Connection.ETHERNET] = 'Ethernet connection';
		    states[Connection.WIFI]     = 'WiFi connection';
		    states[Connection.CELL_2G]  = 'Cell 2G connection';
		    states[Connection.CELL_3G]  = 'Cell 3G connection';
		    states[Connection.CELL_4G]  = 'Cell 4G connection';
		    states[Connection.NONE]     = 'No network connection';
		   
  		    return states[networkState];
		*/
		    return connection;
	}

	if ( checkConnection() != 'Connection.NONE'){ // A l'allumage si le téléphone est connecté. Lance l'événement de connection.
		onOnline();
	};


	// Listen to the connection !!
	document.addEventListener("online", onOnline, false );
	function onOnline() { 	    // Handle the online event
	    if (internet == false){
	    	$(".internet").buttonMarkup({'theme':"b", 'icon':"check" });
	  	internet = true;
		/*if (ioFile == false){
			 loadIO();
		}
		 else{
			connectSocket();
		}*/

		/*if (gmapFile == false){
			loadgMap(); // A reprendre !
		}*/
	    } // end if Internet == false
	}

	document.addEventListener("offline",onOffline, false);
	function onOffline(){    // Handle the offline event
	    if (internet == true){
	    	$(".internet").buttonMarkup({ 'theme': "e", 'icon':"delete" });
	    	internet = false;
	    }
	}

	/*function connectSocket(){
		// Lance la connection au socket.
		if (nodejs == false){
			iosocket = io.connect("http://91.121.133.40:4321");
			console.log("Trying to connect ...");	


 			iosocket.on('connect', function () {
				// Gère la connection à nodejs.
				nodejs = true;
				$(".ffvl").buttonMarkup({'theme':"b", 'icon':"check" });
				iosocket.on('disconnect', function() { // Quand cela deconnecte !
					nodejs = false;
					$(".ffvl").buttonMarkup({'theme':"e", 'icon':"delete" });
					iosocket.removeListener('connect');
					iosocket.removeListener('client-authenticated');
					// Gère la déconnection à nodejs.
				});

				var authMessage = {
				    authToken: 'uuid-'+device.uuid,
				    contentTokens: undefined
				};

				iosocket.on('client-authenticated',function(){ // Quand authentifié !
					//console.log("recu");
					//console.log(message);
					alert('auth !');
				});

				iosocket.emit('device-authenticate', authMessage);
			});
		}
	}*/

	$('#geosite').live('tap', function(){
		var url = $(this).attr("rel");
		loadUrl(url);
	});

	function loadUrl(url){
		navigator.app.loadUrl(url, {openExternal:true});
		return false;
	}

	$('#idTrack').html(device.uuid); // Affiche la device uuid sur la page d'accueil.
	

	$("#home_clearstorage_button").live('click', function(){ // Réinitialiser le stockage local.
		navigator.notification.confirm(
			'Voulez-vous vraiment effacer TOUTES les traces ?',
			clearAll,
			'Attention',
			Array('oui','non')
		);
	});

	function clearAll(bouton){
		if (bouton == 1){
			db.transaction(deleteAllTracks);
		}
	}

	function deleteAllTracks(tx){		
		//window.localStorage.clear();
		tx.executeSql('DELETE FROM tracks', [], rebuild_track_list, errorDeleteAllTracks);
	}

	function errorDeleteAllTracks(err){
		alert("Il y a eu un problème en essayant d'effacer toutes les traces : "+ err);
	}

	// When the user views the history page
	$('#history').live('pageshow', function () {
		  db.transaction(queryTracks);
	});

	function queryTracks(tx){
		tx.executeSql('SELECT timestamp, date FROM tracks ORDER BY timestamp', [], rebuild_track_list, errorSelectTracks);
	}

	function queryTracksById(tx){
		//console.log(parseInt($("#track_info").attr("track_id")));
		tx.executeSql('SELECT date, data FROM tracks WHERE timestamp = ?', [ timestamp ], updateTrackInfo , errorSelectTracks);
	}

	function errorSelectTracks(err){
		alert("Erreur en sélectionnant la table tracks: " + err.code);
	}

	function rebuild_track_list(tx, results){
		 tracks_recorded = results.rows.length;		
		 if (tracks_recorded <= 1){
		  	$("#tracks_recorded").html("<strong>" + (tracks_recorded) + "</strong> Trace enregistrée");
		  }
		 else{
			$("#tracks_recorded").html("<strong>" + (tracks_recorded) + "</strong> Traces enregistrées");
		  } 

  		 $("#history_tracklist").empty();  // Empty the list of recorded tracks
  		 
		 for(i=0; i<tracks_recorded; i++){ // Iterate over all of the recorded tracks, populating the list
			$("#history_tracklist").append("<li><a id='"+results.rows.item(i).timestamp+"' href='#track_info' data-ajax='false'>" + results.rows.item(i).date + "</a></li>"); 
		}

  		$("#history_tracklist").listview('refresh'); // Tell jQueryMobile to refresh the list
	}

	$("#history_tracklist li a").live('click', function(){
		$("#track_info").attr("track_id", $(this).attr('id')); // En cas de clic sur un vol, passe le numéro du vol à la page d'info.
		timestamp = parseInt($(this).attr('id'));
		$("#track_info div[data-role=header] h1").html('');
		$("#track_info_info").html('');
		db.transaction(queryTracksById);
	});

	function updateTrackInfo(tx, results){
		var date = results.rows.item(0).date;
		$("#track_info div[data-role=header] h1").html(date); // Update the Track Info page header to the track_id
		// Total distance !
		total_km = 0;
		/*var accelo = JSON.parse(results.rows.item(0).acc);
		var accel = '';
		for (var i = 0; i < accelo.length; i++ ){
			accel = accel + Math.round(accelo[i].x * 100) / 100+' '+Math.round(accelo[i].y * 100) / 100+' '+Math.round(accelo[i].z * 100) / 100+'<br/>'; 
		}
		//console.log(accelo);
		$("#acc_recorded").html("L'accélération enregistrée : <ul>" + accel + '</ul>');*/
		data = JSON.parse(results.rows.item(0).data);		
		for(i = 0; i < data.length; i++){
    			if(i == (data.length - 1)){
        			break;
    			}
    			total_km += gps_distance(data[i].coords.latitude, data[i].coords.longitude, data[i+1].coords.latitude, data[i+1].coords.longitude);
		}		
		total_km_rounded = total_km.toFixed(2);
		
		// Total time travelled
		console.log(data.length);
		if ( data.length > 1){
			start_time = new Date(data[0].timestamp).getTime();
			end_time = new Date(data[data.length-1].timestamp).getTime();
			milli = end_time - start_time;
			seconds = Math.floor((milli / 1000) % 60);
      			minutes = Math.floor((milli / (60 * 1000)) % 60);
		

		$("#track_info_info").html('Le vol du <strong> '+date+' </strong> contient <strong>'+data.length+'</strong> points GPS parcourant <strong>' + total_km_rounded + '</strong> km en <strong>' + minutes + 'mn</strong> et <strong>' + seconds + 's</strong>');
		}
	}
	
	// When the user send the fullTrack to the server.
	$('#sendIt').live('click',function(){ // Envoi à un service Drupal... /services-gettrack/gettrack/  ==> POSTGIS
		$("#deleteIt").closest('.ui-btn').hide();
		$("#sendIt").closest('.ui-btn').hide();
		$("#throbber").show();
		$.post("http://ks201694.kimsufi.com/services-gettrack/gettrack/"+device.uuid, {
			log : Array(timestamp, data)
		},
		function(result){
			if (result == "CREATE OK"){
				navigator.notification.alert(
            				'La trace est bien enregistrée sur le serveur de la FFVL',  // message
            				vibrate(500),         // callback
            				'Merci',            // title
            				'OK'                  // buttonName
        			);
			}
			else{
				console.log(result);
				navigator.notification.alert(
            				"Le serveur FFVL n'est pas parvenu à enregistrer cette trace.",  // message
            				vibrate(500),         // callback
            				'Erreur',            // title
            				'OK'                  // buttonName
        			);
			}
			$("#throbber").hide();
			$("#sendIt").closest('.ui-btn').show();
			$("#deleteIt").closest('.ui-btn').show();
		});		
	});
	
	// When the user erase the fulltrack from the local storage.
	$('#deleteIt').live('click',function(){
		navigator.notification.confirm(
			'Souhaitez-vous vraiment effacer cette trace ?', // message
			 onDeleteConfirm, // callback
			 'Attention', // title
			 Array('OUI', 'NON') // buttonsName
		);
	});


	function onDeleteConfirm(button) {
		if (button == 1){
			db.transaction(deleteTracks, errorDeleteTracks);
			vibrate(500); // vibre.
			$.mobile.changePage($("#history"),"none");// Retourne à l'historique.
		}
	}

	function deleteTracks(tx){
		tx.executeSql('DELETE FROM tracks WHERE timestamp = ?', [timestamp], deleteSuccess, errorDeleteTracks);
	}

	function errorDeleteTracks(err){
		alert("Erreur au moment d'effacer la trace : "+ err.code);
	}

	function deleteSuccess(){
		alert('La trace est effacée');
	}

	$("#startTracking").live('pageshow', function(){
		$("#startTracking_stop").closest('.ui-btn').show();
		$('#startTracking_ghost').closest('.ui-btn').show();

		if (trackRequest == false){
			$("#startTracking_stop").closest('.ui-btn').hide();
			$('#startTracking_ghost').closest('.ui-btn').hide();
		}
		else if (trackRequest == true){
			$("#startTracking_start").closest('.ui-btn').hide();
		}
	});

	// When the user start the tracker.
	$("#startTracking_start").live('click', function(){
	if (lowBat == false){
		if (watch_id == null){
			startDate = new Date();
			$("#startTracking_start").closest('.ui-btn').hide();
			$("#startTracking_stop").closest('.ui-btn').show();
			$('#startTracking_ghost').closest('.ui-btn').show();
			$("#startTracking_ghost").text("Activer le mode fantome");
			$('#startTracking_ghost').button('refresh');			
			$("#startTracking_ghost").buttonMarkup({'theme':'b'});
			ghost = false;
			$("#startTracking_status").html("Recherche GPS.");
			watch_id = navigator.geolocation.watchPosition(onSuccess, onError, { timeout: 5000, maximumAge: 0,enableHighAccuracy: true });
			trackRequest = true;
		}
		/*if (watch_ac == null){
			options = {frequency: 30};
			watch_ac = navigator.accelerometer.watchAcceleration(onAccSuccess, onAccError, options);
		}*/
	}else{
		navigator.notification.confirm(
			'La batterie est trop basse pour activer le tracking',
			vibrate(500),
			'Attention',
			'Ok'
			);
		
	}
	});

	/*function onAccSuccess(acceleration){
		tracking_ac.push(acceleration);
		$('#startTacking_accelero').html(
			    'Acceleration X: ' + Math.round(acceleration.x*100)/100 + '<br />' +
                            'Acceleration Y: ' + Math.round(acceleration.y*100)/100 + '<br />' +
                            'Acceleration Z: ' + Math.round(acceleration.z*100)/100 + '<br />' +
                            'Timestamp: '      + acceleration.timestamp + '<br />'
		);
	}

	function onAccError(){
		console.log("Erreur à la capture de l'acceleration");
	}*/
	

	$("#startTracking_ghost").live('click', function(){ // When the user enable or disable ghost function
		if (ghost == false){
			navigator.notification.confirm(
				"Le mode fantome continue d'envoyer votre position au serveur FFVL mais ne la communique pas publiquement sur le site. Voulez-vous activer ce mode ?", // message
				 function(i){
					if (i == 1){
						$("#startTracking_ghost").text("Désactiver le mode fantome");
						$('#startTracking_ghost').button('refresh');
						$("#startTracking_ghost").buttonMarkup({'theme':'e'});
						ghost = true;
					}
				 }, // callback
				 'Attention', // title
				 Array('OUI', 'NON') // buttonsName
			);
		}
		else {						
			$("#startTracking_ghost").text("Activer le mode fantome");
			$('#startTracking_ghost').button('refresh');			
			$("#startTracking_ghost").buttonMarkup({'theme':'b'});
			ghost = false; 
		}
	});

	// When the user stop the tracker.
	$("#startTracking_stop").live('click', function(){
		navigator.notification.confirm(
			'Voulez-vous vraiment arreter le tracking ?', // message
			function(i){
				if (i == 1){
					stopTracking();	
				}
			}, // callabck
			'Attention',
			Array('OUI', 'NON')
			);		
	});
		

	var onSuccess = function(position) {
		if (position.coords.accuracy < minAccuracy ){
			tracking_data.push(position);			

			if (tracking_data.length < 3){
				$("#startTracking_status").html("Recherche GPS... Vérifiez que le GPS soit activé et qu'il recoive bien un signal");
				if (track == false){
					track = true;
				}
			}
			else{
				$("#startTracking_status").html(tracking_data.length+" point(s) ont été enregistré(s)<br> Le trackeur fonctionne normalement.");
				$(".isTracking").buttonMarkup({'theme':'b', 'icon':'check'});
				vario = (position.coords.altitude - tracking_data[tracking_data.length-2].coords.altitude) / ( (position.timestamp - tracking_data[tracking_data.length-2].timestamp) * 0.001);
			}

			position.coords.vario = vario;
			
			// J'envoi à nodejs :
			if (nodejs){
				var posMessage = { 
					type : 'tracker-location',
					position : position,
					device : device.uuid,
					ghost : ghost,
					basetime : startDate.getTime()*0.001,
					callback : 'nodejsGeoloc',
					channel : 'tracking',
				};
				iosocket.emit('message', posMessage);		
			}
			else{
				$.ajax({
  					url: "http://ks201694.kimsufi.com:4321",
  					type:"POST",
  					data: JSON.stringify({
						"uuid" : 'uuid-'+device.uuid,
						"lat" : Math.round(position.coords.latitude * 10000000)/ 10000000,
						"lon" : Math.round(position.coords.longitude * 10000000)/10000000,
						"altitude" : Math.round(position.coords.altitude),
						"vitesse" : Math.round(position.coords.speed * 3.6 * 100) /100,
						"precision" : Math.round(position.coords.accuracy),
						"vario" : Math.round(position.coords.vario * 100) /100,
						"timestamp" : position.timestamp
					}),
  					contentType:"application/json; charset=utf-8",
  					success: function(){
    						console.log("envoyé");
  					}
				});
			}

			$("#startTracking_debug").html(
				'Latitude: '          + Math.round(position.coords.latitude * 10000000)/ 10000000 + '</br>' +
		          	'Longitude: '         + Math.round(position.coords.longitude * 10000000)/10000000 + '</br>' +
				'Précision: '         + Math.round(position.coords.accuracy) + ' m </br>' +
		          	'Altitude: '          + Math.round(position.coords.altitude) + ' m </br>' +
		          	// 'Précision alti: ' + position.coords.altitudeAccuracy  + '</br>' +
		          	//'Heading: '         + position.coords.heading           + '</br>' +
				'Vario: ' 	      + Math.round(position.coords.vario * 100) /100 + ' m/s </br>' + 
		          	'Vitesse: '           + Math.round(position.coords.speed * 3.6 * 100) /100 + ' Km/h </br>'
		          	//'Timestamp: '         + position.timestamp                + '</br>'
			);
		}
	};
	

	// onError Callback receives a PositionError object
	//
	function onError(error) {
    		/*alert('code: '    + error.code    + '\n' +
          	'message: ' + error.message + '\n');*/
		//console.log("Position foire&eacute;e... " + error);
		if (track == true){
			$(".isTracking").buttonMarkup({ 'theme': "e", 'icon':"delete" });
			track = false;
		}
		$("#startTracking_status").html(tracking_data.length+" point(s) ont été enregistré(s). Le trackeur a échoué en enregistrant le dernier point. Vérifiez le GPS (fonctionnement et reception)");
	}

	function loadIO(){
		console.log(" Requiert socket.io");
		$.get("http://91.121.133.40:4321/socket.io/socket.io.js").done(function() {	
			console.log("Fichier socket.io chagé !");
			ioFile = true;
			connectSocket();
		}).fail(function(jqxhr, settings, exception) {
			console.log("raté, requiert socket.io si Internet");
			if (internet == true){
				loadIO();
			 }
		});
    	}

	function stopTracking(){
		db.transaction(insertTrack);
	}

	function insertTrack(tx){
		if (tracking_data.length > 1){ // Si la trace contient au moins un point... Sauvegarder.
			var baseDate = startDate.getDate().toString() + "/"+ (startDate.getMonth()+1).toString() + "/"+startDate.getFullYear().toString()+" "+startDate.getHours().toString()+":"+(startDate.getMinutes()<10?'0':'') + startDate.getMinutes();
			tx.executeSql('INSERT INTO tracks (timestamp, date, data) VALUES (?,?,?)', [ startDate.getTime(), baseDate,JSON.stringify(tracking_data) ], successInsert, errorInsert);
		}// Sinon...
		else{
			successInsert(false);
		}
		trackRequest = false;
	}
	
	function errorInsert(err){
		alert("Problème à l'insertion de la trace : " +err.code);
	}

	function successInsert(tx){
		// navigator.accelerometer.clearWatch(watch_ac); // Clear accelerometer
		navigator.geolocation.clearWatch(watch_id); // Clear geolocation.
		$("#startTracking_start").closest('.ui-btn').show();
		$("#startTracking_stop").closest('.ui-btn').hide();
		$('#startTracking_ghost').closest('.ui-btn').hide();
		$("#startTracking_status").html("");
		$("#startTracking_debug").html("");
		$("#tracks_recorded").html("");			
		if (track == true){
			$(".isTracking").buttonMarkup({'theme':'e', 'icon':'delete'});
			track = false;
		}
		watch_id = null;			
		// watch_ac = null;
		tracking_data = [];
		// tracking_ac = [];
		if (tx == false){
			alert("la trace ne comporte aucun point et n'a pas été enregistrée.");
		}
		else{
			alert('La trace a bien été insérée');
		}
	}

	function vibrate(tps){
		navigator.notification.vibrate(tps);
	}

	function gps_distance(lat1, lon1, lat2, lon2){
  		// http://www.movable-type.co.uk/scripts/latlong.html
    		var R = 6371; // km
    		var dLat = (lat2-lat1) * (Math.PI / 180);
    		var dLon = (lon2-lon1) * (Math.PI / 180);
    		var lat1 = lat1 * (Math.PI / 180);
    		var lat2 = lat2 * (Math.PI / 180);
    		var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    		var d = R * c;
    		return d;
	}

    } // systemReady

}); // Document ready jQuery.

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
