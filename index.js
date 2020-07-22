const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore({
    projectId: process.env.PROJECT_ID,
    keyFilename: process.env.KEY_FILE_NAME
});
const kindName = process.env.KIND_NAME;
const keyNameId= parseInt(process.env.KEY_NAME_ID);
/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.helloWorld = async (req, res) => {
  var request = require('request');
  var options = {
    'method': 'GET',
    'url': process.env.FB_API_URL + process.env.FB_GROUP_ID + process.env.FB_FEED_ENTITY + process.env.FB_API_TOKEN,
    'headers': {
      'Content-Type': 'application/json'
    }
  };
  await request(options, async function (fbError, fbResponse) {
    if (fbError) {
      res.status(500).send(fbError);
      throw new Error(fbError);
    }
    let newPost = JSON.parse(fbResponse.body);
    let lastPost = await datastore.get(datastore.key([kindName, keyNameId]));

    // If the new post ID is different then search the attachments and update stored ID
    if(newPost.data[0].id != lastPost[0].id){
      var spotifyRefreshTokenOptions = {
        'method': 'POST',
        'url': process.env.SPOTIFY_REFRESH_URL,
        'headers': {
          'Authorization': 'Basic '+Buffer.from(process.env.SPOTIFY_USERNAME+":"+process.env.SPOTIFY_PASSWORD).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        'form': {
          'grant_type': 'refresh_token',
          'refresh_token': process.env.SPOTIFY_REFRESH_TOKEN
        }
      };
      request(spotifyRefreshTokenOptions, function (refreshError, refreshResponse) {
        if (refreshError) throw new Error("Refresh Error: "+refreshError);
        var accessToken = JSON.parse(refreshResponse.body).access_token;
        var spotifySearchOptions = {
            'method': 'GET',
            'url': process.env.SPOTIFY_SEARCH_URL + newPost.data[0].attachments.data[0].title +'&type=track',
            'headers': {
              'Authorization': 'Bearer '+ accessToken
            }
        };
        request(spotifySearchOptions, function (searchError, searchResponse) {
          if (searchError) throw new Error("Search Error: " + searchError);
          var trackUri = JSON.parse(searchResponse.body).tracks.items[0].uri;
          var spotifyAddTrackToPlaylistOptions = {
              'method': 'POST',
              'url': process.env.SPOTIFY_PLAYLIST_COLLECTION_URL + process.env.SPOTIFY_PLAYLIST_ID + process.env.SPOTIFY_TRACKS_BY_URI_ENTITY + trackUri,
              'headers': {
                'Authorization': 'Bearer ' + accessToken
              }
          };
          request(spotifyAddTrackToPlaylistOptions, function (addTrackToPlaylistError, addTrackToPlaylistResponse) {
            if (addTrackToPlaylistError) throw new Error("Add Track Error: "+addTrackToPlaylistError);
            console.log("Added "+trackUri);
          });
        });
      });
      await datastore
      .update({
        key: datastore.key([kindName,keyNameId]),
        data: {
          id: newPost.data[0].id,
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
  });
};
