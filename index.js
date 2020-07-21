const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore({
    projectId: 'enhanced-burner-283614',
    keyFilename: 'datastore-credentials.json'
});
const kindName = 'last-post';
const keyNameId= 5634161670881280;
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
    'url': process.env.FB_GROUP_LINK_LIST_URL,
    'headers': {
      'Content-Type': 'application/json'
    }
  };
  await request(options, async function (error, response) {
    if (error) {
      res.status(500).send(error);
      throw new Error(error);
    }
    let newPost = JSON.parse(response.body);
    let lastPost = await datastore.get(datastore.key([kindName, keyNameId]));
    if(newPost.data[0].id!= lastPost[0].id){
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
