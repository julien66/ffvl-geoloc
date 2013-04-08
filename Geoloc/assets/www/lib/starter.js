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
	var tracking_data = []; // Array containing GPS position objects
	var startDate;
	var internet = false;
	var track = false;	
	var ghost = false;	

	var data;
	var key;

	var ioFile = false;
	var gmapFile = false;	

	var iosocket;
	var nodejs = false;

	var lowBat = false;

	// Listen to the battery !!
	document.addEventListener("batterystatus", onBatteryStatus, false);
	function onBatteryStatus(info) { // Handle the battery low event	
		//console.log(info.level);
		alert('test');
		/*stopTracking();
		vibrate(500);
		navigator.notification.confirm(
			'La batterie est faible et le tracking a donc été stopé pour économiser de la batterie !',
			vibrate(500),
			'Attention',
			'OK'
		);
		lowBat = true;*/
	}

	// Listen to the connection !!
	document.addEventListener("online", onOnline, false);
	function onOnline() { 	    // Handle the online event
	    if (internet == false){
	    	$(".internet").buttonMarkup({'theme':"b", 'icon':"check" });
	  	internet = true;
		 if (ioFile == false){
			 loadIO();
		}
		 else{
			connectSocket();
		}

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

	function connectSocket(){
		// Lance la connection au socket.
		iosocket = io.connect("http://91.121.133.40:8080");
	
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

			iosocket.emit('authenticate', authMessage);
		});
	}

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
			'oui,non'
		);
	});

	function clearAll(bouton){
		if (bouton == 1){
			window.localStorage.clear();
			vibrate(500);
			//$.mobile.changePage( $('#history'), { reloadPage: true, transition: "none"} );
			rebuild_track_list();
		}
	}

	// When the user views the history page
	$('#history').live('pageshow', function () {
		  rebuild_track_list(); // Build track list.
	});

	function rebuild_track_list(){
		 // Count the number of entries in localStorage and display this information to the user
		  tracks_recorded = window.localStorage.length;
		  console.log(window.localStorage);
		  if (tracks_recorded <= 1){
		  	$("#tracks_recorded").html("<strong>" + (tracks_recorded) + "</strong> Trace enregistrée");
		  }
		  else{
			$("#tracks_recorded").html("<strong>" + (tracks_recorded) + "</strong> Traces enregistrées");
		  } 
  		  // Empty the list of recorded tracks
  		  $("#history_tracklist").empty();
  		 // Iterate over all of the recorded tracks, populating the list
  		 for(i=0; i<tracks_recorded; i++){
			var realkey = window.localStorage.key(i);
			var data = JSON.parse(window.localStorage.getItem(realkey));
			$("#history_tracklist").append("<li><a id='"+realkey+"' href='#track_info' data-ajax='false'>" + data[0] + "</a></li>"); 
 		}
  		// Tell jQueryMobile to refresh the list
  		$("#history_tracklist").listview('refresh');
	}

	$("#history_tracklist li a").live('click', function(){
		console.log($(this).attr('id'));
		$("#track_info").attr("track_id", $(this).attr('id')); // En cas de clic sur un vol, passe le numéro du vol à la page d'info.
	});

	// When the user views the Track Info page
	$('#track_info').live('pageshow', function(){
  		key = $(this).attr("track_id"); // Récupère le numéro du vol.
  		data = JSON.parse(window.localStorage.getItem(key)); // Get Item and Turn the stringified data back into a JS object
		$("#track_info div[data-role=header] h1").text(data[0]); // Update the Track Info page header to the track_id

		// Total distance !
		total_km = 0;
		for(i = 0; i < data[1].length; i++){
    			if(i == (data[1].length - 1)){
        			break;
    			}
    			total_km += gps_distance(data[1][i].coords.latitude, data[1][i].coords.longitude, data[1][i+1].coords.latitude, data[1][i+1].coords.longitude);
		}		
		total_km_rounded = total_km.toFixed(2);
		
		// Total time travelled
		start_time = new Date(data[1][0].timestamp).getTime();
		end_time = new Date(data[1][data[1].length-1].timestamp).getTime();
		milli = end_time - start_time;
		seconds = Math.floor((milli / 1000) % 60);
      		minutes = Math.floor((milli / (60 * 1000)) % 60);
		
		$("#track_info_info").html('Le vol du <strong> '+data[0]+' </strong> contient <strong>'+data[1].length+'</strong> points GPS parcourant <strong>' + total_km_rounded + '</strong> km en <strong>' + minutes + 'mn</strong> et <strong>' + seconds + 's</strong>');

		/* var myLatLng;
		// Set the initial Lat and Long of the Google Map
		if (data[1].length > 0){
			myLatLng = new google.maps.LatLng(data[1][0].coords.latitude,  data[1][0].coords.longitude);
		}
		else{
			myLatLng = new google.maps.LatLng(42.55, 1.53);
		}

		// Google Map options
		var myOptions = {
  		  zoom: 15,
		  center : myLatLng,
  		  mapTypeId: google.maps.MapTypeId.TERRAIN
		};
		// Create the Google Map, set options
		var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
		var trackCoords = [];
		// Add each GPS entry to an array
		for(i=0; i<data[1].length; i++){
    			trackCoords.push(new google.maps.LatLng(data[1][i].coords.latitude, data[1][i].coords.longitude));
		}
		// Plot the GPS entries as a line on the Google Map
		var trackPath = new google.maps.Polyline({
  		path: trackCoords,
  		strokeColor: "#FF0000",
  		strokeOpacity: 1.0,
  		strokeWeight: 2
		});
		// Apply the line to the map
		trackPath.setMap(map);*/
	});		

	
	// When the user send the fullTrack to the server.
	$('#sendIt').live('click',function(){ // Envoi à un service Drupal... /services-gettrack/gettrack/  ==> POSTGIS
		// Ici tu dois affiher un throbber et/ou freezer jusqu'à ce que l'envoi soit ok ?! - Risqué -> Attention gestion erreur.

		$.post("http://ks201694.kimsufi.com/services-gettrack/gettrack/"+device.uuid, {
			log : data
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
			}
		});		
		//console.log(data[0].timestamp);
		//console.log("touche");
	});
	
	// When the user erase the fulltrack from the local storage.
	$('#deleteIt').live('click',function(){
		navigator.notification.confirm(
			'Souhaitez-vous vraiment effacer cette trace ?', // message
			 onDeleteConfirm, // callback
			 'Attention', // title
			 'OUI, NON' // buttonsName
		);
	});


	function onDeleteConfirm(button) {
		if (button == 1){
			console.log(key);
			window.localStorage.removeItem(key); // Efface le stockage. 
			vibrate(500); // vibre.
			$.mobile.changePage($("#history"),"none");// Retourne à l'historique.
		}
	}


	$("#startTracking").live('pageshow', function(){
		$("#startTracking_stop").closest('.ui-btn').show();
		$('#startTracking_ghost').closest('.ui-btn').show();

		if (track == false){
			$("#startTracking_stop").closest('.ui-btn').hide();
			$('#startTracking_ghost').closest('.ui-btn').hide();
		}
		else if (track == true){
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
		}
	}else{
		navigator.notification.confirm(
			'La batterie est trop basse pour activer le tracking',
			vibrate(500),
			'Attention',
			'Ok'
			);
		
	}
	});

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
				 'OUI, NON' // buttonsName
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
			'OUI, NON'
			);		
	});
		

	var onSuccess = function(position) {
		tracking_data.push(position);

		/*var dat = startDate.getDate().toString() + "/"+ (startDate.getMonth()+1).toString() + "/"+startDate.getFullYear().toString()+" "+startDate.getHours().toString()+":"+(startDate.getMinutes()<10?'0':'') + startDate.getMinutes();

		if (tracking_data.length == 1){ 
			window.localStorage.setItem( (window.localStorage.length).toString(), JSON.stringify([dat, tracking_data])  ); // Test keep every single point to local storage !!
		}
		else{ 
			window.localStorage.setItem( (window.localStorage.length -1).toString(), JSON.stringify([dat, tracking_data])  ); // Test keep every single point to local storage !!
		}*/
		if (tracking_data.length < 3){
			$("#startTracking_status").html("Recherche GPS... Vérifiez que le GPS soit activé et qu'il recoive bien un signal");
			if (track == false){
				track = true;
			}
		}
		else{
			$("#startTracking_status").html(tracking_data.length+" point(s) ont été enregistré(s)<br> Le trackeur fonctionne normalement.");
			$(".isTracking").buttonMarkup({'theme':'b', 'icon':'check'});
		}
		
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
    	  	/*console.log('Latitude: '          + position.coords.latitude          + '\n' +
          'Longitude: '         + position.coords.longitude         + '\n' +
          'Altitude: '          + position.coords.altitude          + '\n' +
          'Accuracy: '          + position.coords.accuracy          + '\n' +
          'Altitude Accuracy: ' + position.coords.altitudeAccuracy  + '\n' +
          'Heading: '           + position.coords.heading           + '\n' +
          'Speed: '             + position.coords.speed             + '\n' +
          'Timestamp: '         + position.timestamp                + '\n');*/
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
		$.getScript("http://91.121.133.40:8080/socket.io/socket.io.js", function(data, textStatus, jqxhr) {	
			ioFile = true;
			connectSocket();
		});
    	}

	function stopTracking(){
		navigator.geolocation.clearWatch(watch_id); // Clear geolocation.
		var dat = startDate.getDate().toString() + "/"+ (startDate.getMonth()+1).toString() + "/"+startDate.getFullYear().toString()+" "+startDate.getHours().toString()+":"+(startDate.getMinutes()<10?'0':'') + startDate.getMinutes();
		window.localStorage.setItem( window.localStorage.length.toString() , JSON.stringify([dat, tracking_data]) ); // Trace stockée.
		$("#startTracking_start").closest('.ui-btn').show();
		$("#startTracking_stop").closest('.ui-btn').hide();
		$('#startTracking_ghost').closest('.ui-btn').hide();
		$("#startTracking_status").html("");
		if (track == true){
			$(".isTracking").buttonMarkup({'theme':'e', 'icon':'delete'});
			track = false;
		}
		watch_id = null;			
		tracking_data = [];
	}

	/*function loadgMap(){
$.getScript("http://maps.googleapis.com/maps/api/js?key=AIzaSyD0j7HUREhDcBlyvPwkLD8ICsfelgoLSIE&sensor=false", function(data, textStatus, jqxhr) {	
			gmapFile = true;
		});
    	}*/

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
