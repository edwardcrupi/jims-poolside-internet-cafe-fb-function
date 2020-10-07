const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore({
    projectId: process.env.PROJECT_ID,
    keyFilename: process.env.KEY_FILE_NAME
});
const kindName = process.env.KIND_NAME;
const keyNameId = parseInt(process.env.KEY_NAME_ID);
const fetch = require('node-fetch')

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.helloWorld = async (req, res) => {
  var options = {
    'method': 'GET',
    'headers': {
      'Content-Type': 'application/json'
    }
  };

  // Hit Facebook API and check the last post
  var facebookUrl = process.env.FB_API_URL + process.env.FB_GROUP_ID + process.env.FB_FEED_ENTITY + process.env.FB_API_TOKEN;
  var facebookResult = await fetch(facebookUrl, options).then(res => {
    if(res.ok){
      return res.json();
    } else {
      res.json().then(error => {
        console.error(error.error.message);
        throw new Error("Unable to join social network");
      });
    }
  }).then(fbResponse => {
    let newPosts = fbResponse;
    return newPosts;
  }).catch(fbError => {
    if (fbError) {
      res.status(500).send(fbError);
      throw new Error(fbError);
    }
  });
  let lastPost = await datastore.get(datastore.key([kindName, keyNameId]));

  // If the new post ID is different then search the attachments and update stored ID
  if(facebookResult.data[0].id != lastPost[0].id){

    // Hit Spotify oAuth Refresh token endpoint and store new access token
    var spotifyRefreshTokenOptions = {
      'method': 'POST',
      'headers': {
        'Authorization': 'Basic '+Buffer.from(process.env.SPOTIFY_USERNAME+":"+process.env.SPOTIFY_PASSWORD).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      'form': {
        'grant_type': 'refresh_token',
        'refresh_token': process.env.SPOTIFY_REFRESH_TOKEN
      }
    };
    var spotifyUrl = process.env.SPOTIFY_REFRESH_URL;
    var spotifyResult  = await fetch(spotifyUrl, spotifyRefreshTokenOptions).then(refreshResponse => {
      return JSON.parse(refreshResponse.body).access_token;
    }).catch(refreshError => {
      if (refreshError) throw new Error("Refresh Error: "+refreshError);
    });
    var accessToken = spotifyResult;

    // Search for last post
    let lastPostIndex = newPosts.data.findIndex(x => x.id === lastPost[0].id)
    let postsToSearch = []
    if(lastPostIndex != -1){
      postsToSearch = newPosts.data.slice(0,lastPostIndex+1)
    } else {
      postsToSearch = newPosts.data;
    }
    var i;
    var trackUris = ""

    // Iterate over posts to search
    for(i=0;i<postsToSearch.length; i++){
      // Skip posts without links
      if(!postsToSearch[i].attachments || !postsToSearch[i].attachments.data
        || !postsToSearch[i].attachments.data[0].title){
        continue;
      }

      // Hit spotify track search endpoint
      let linkTitle = postsToSearch[i].attachments.data[0].title;
      var spotifySearchOptions = {
          'method': 'GET',
          'headers': {
            'Authorization': 'Bearer '+ accessToken
          },
          'json': true
      };
      var spotifySearchUrl = process.env.SPOTIFY_SEARCH_URL + linkTitle +'&type=track';
      var trackUri = await fetch(spotifySearchUrl, spotifySearchOptions).then(searchResponseBody => {
        if(!searchResponseBody.tracks.items[0]){
          return "";
        }
        var trackUri = searchResponseBody.tracks.items[0].uri;
        return trackUri;
      }).catch(function(searchError){
        throw new Error("Search Error: " + searchError);
      });
      if(trackUri != ""){
        if(trackUris){
          trackUris+=","+trackUri;
        } else {
          trackUris+=trackUri;
        }
      }
    }

    // Hit add track to playlist endpoint
    var spotifyAddTrackToPlaylistOptions = {
        'method': 'POST',
        'headers': {
          'Authorization': 'Bearer ' + accessToken
        }
    };
    var spotifyAddTrackToPlaylistUrl = process.env.SPOTIFY_PLAYLIST_COLLECTION_URL + process.env.SPOTIFY_PLAYLIST_ID + process.env.SPOTIFY_TRACKS_BY_URI_ENTITY + trackUris;
    fetch(spotifyAddTrackToPlaylistUrl, spotifyAddTrackToPlaylistOptions).then( addTrackToPlaylistResponse => {
      console.log("Added "+trackUris);
    }).catch(addTrackToPlaylistError => {
      if (addTrackToPlaylistError) throw new Error("Add Track Error: "+addTrackToPlaylistError);
    });
    await datastore
    .update({
      key: datastore.key([kindName,keyNameId]),
      data: {
        id: newPosts.data[0].id,
        time_update: (new Date()).getTime(),
        time_update_id: datastore.int(Math.floor(new Date().getTime()/1000))
      }
    })
    .catch(err => {
      console.error('ERROR:', err);
      res.status(500).send(err);
      return;
    });
  }
  res.status(200).send(lastPost);
}