# jims-poolside-internet-cafe-fb-function
This google cloud function looks up a facebook group and retrieves it's latest comments, then comparing against a datastore it checks to see if the last comment has changed. If it has then it will proceed to look that comments attachments up in Spotify and see if it can add the first result to a Spotify playlist.

## Requirements

- GCP Account with Function and Datastore credentials
- GCP Function Emulator
- Facebook account that is the admin of a Facebook group alongside developer credentials
- NPM

## Setup

run
```npm install```

## Running
run
```npm start```
