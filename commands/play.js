const { Util } = require("discord.js");
const ytdl = require("youtube-dl");
const moment = require("moment");
const momentDurationFormatSetup = require("moment-duration-format");
const ytSearch = require('youtube-search');
const fetch = require('node-fetch');
const fs = require('fs');
var memoryStream = require('memorystream');

const {
  ytApiKey,
  highWaterMark
} = require('./playContext.json');

const searchOpts = {
  maxResults: 5,
  key: ytApiKey,
  type: "video"
};

const urlPattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator

const youtubeVideoPrefix = "https://www.youtube.com/watch?v=";

function intOrNaN (x) {
  return /^\d+$/.test(x) ? +x : NaN;
}

function isValidYoutubeVideoId(x) {
  return /[a-zA-Z0-9_-]{11}/.test(x);
}

function isValidURL(str) {
  return !!urlPattern.test(str);
}

function ytGetInfoWrapper(url) {
  return new Promise((resolve, reject) => {
    ytdl.getInfo(url, async function (err, songInfo) {
      if(err) reject(err);
      resolve(songInfo);
    });
  })
  
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

module.exports = {
  name: "play",
  description: "Play a song in your channel!",
  async execute(message) {
    try {
      const args = message.content.match(/[^\s]+/g);

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        return message.channel.send(
          "You need to be in a voice channel to play music!"
        );
      }
      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
          "I need the permissions to join and speak in your voice channel!"
        );
      }

      const playArgs = args.slice(1);
      if(playArgs.every(isValidURL)) {
         await asyncForEach(playArgs, async (item) => {
          await this.queue(item, message);
        });
        return;
      }

      if(playArgs.every(isValidYoutubeVideoId)) {
        await asyncForEach(playArgs, async (item) => {
          await this.queue(`${youtubeVideoPrefix}${item}`, message);
        });
        return;
      }

      const searchIndex = intOrNaN(args[1]);
      if(!isNaN(searchIndex)) {
        var searchResults = message.client.searchResults;
        var username = message.member.user.username;
        
        if(!(username in searchResults)) {
          message.channel.send("You did not perform a search yet.");
          return;
        }
        results = searchResults[username];
        if(searchIndex < 0 || searchIndex >= results.length) {
          message.channel.send("Index out of range for search results");
          return;
        }

        this.queue(results[searchIndex].link, message)
          .catch(reason => {
            console.log(reason);
            message.channel.send(reason);
          });
        return; 
      } 
      
      if(!isNaN(+args[1])) {
        message.channel.send("I'm not sure which integer you meant.");
        return;
      }
      args.shift();
      this.search(args.join(' '), message);
    } catch (error) {
      console.log(error);
      error.message && message.channel.send(error.message);
    }
  },

  search(query, message) {
    try {
      ytSearch(query, searchOpts, async (err, results) => {

        let idQueryStrings = results.map(entry => `${entry.id}`);
        let idQueryPart = `id=${idQueryStrings.join(",")}`;

        let infoUrl = `https://www.googleapis.com/youtube/v3/videos?${idQueryPart}&part=contentDetails&key=${ytApiKey}`

        console.log(infoUrl);

        var durationDict = {};

        try {
          let response = await fetch(infoUrl);
          let json = await response.json();

          json.items.forEach(item => {
            let duration = moment.duration(item.contentDetails.duration);
            durationDict[item.id] = duration.asSeconds();
          })

        } catch(error) {
          console.log(error);
          error && message.channel.send(error);
        }

        var searchResults = message.client.searchResults;
        searchResults[message.member.user.username] = results;

        var resultEntries = results.map((result, index) => `${index}) **${result.title}** (${moment.duration(parseInt(durationDict[result.id]), "seconds").format("h:mm:ss")}), by channel "${result.channelTitle}"`);
        var resultList = resultEntries.join("\n");
        message.channel.send(`Search results:\n${resultList}`);
      });
    } catch (error) {
      console.log(error);
      error.message && message.channel.send(error.message);
    }
  },

  async queue(url, message) {
    try {
      var self = this;
      
      var songInfo = await ytGetInfoWrapper(url); 

      const queue = message.client.queue;
      const serverQueue = message.client.queue.get(message.guild.id);
      const voiceChannel = message.member.voice.channel;

      try {
        const nickname = message.member.nickname || message.member.user.username; 

        const song = {
          title: songInfo.title,
          url: songInfo.url,
          queuer: nickname,
          duration: songInfo._duration_raw,
          durationString: moment.duration(parseInt(songInfo._duration_raw), "seconds").format("h:mm:ss")
        };

        if (!serverQueue) {
          const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 3,
            playing: true
          };

          queue.set(message.guild.id, queueContruct);

          queueContruct.songs.push(song);
          message.channel.send(`**${song.title}** (${song.durationString}) has been added to the queue!`);

          try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            self.play(message, queueContruct.songs[0]);
          } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
          }
        } else {
          serverQueue.songs.push(song);
          return message.channel.send(`**${song.title}** (${song.durationString}) has been added to the queue!`);
        }
      } catch (error) {
        console.log(error);
        error.message && message.channel.send(error.message);
      }
    } catch (error) {
      console.log(error);
      error.message && message.channel.send(error.message);
    }
  },

  play(message, song) {
    const queue = message.client.queue;
    const guild = message.guild;
    const serverQueue = queue.get(message.guild.id);

    if (!song) {
      serverQueue.voiceChannel.leave();
      queue.delete(guild.id);
      return;
    }

    var stream_to_play;

    var stream = ytdl(song.url, ['--restrict-filenames', '--audio-quality', '0', '-x']);

    //If the song is less than an hour we can keep it in memory and guarantee full playback.
    if(song.duration < 60 * 60) {
      var stream_to_play = new memoryStream();

      stream.pipe(stream_to_play)
    } else {
      stream_to_play = stream;
    }
    

    stream.on('error', err => {
      console.log(err);
      if(err.code == 'ESOCKETTIMEDOUT') return;
      message.channel.send(err.stderr);
      serverQueue.songs.shift();
      this.play(message, serverQueue.songs[0]);
      return;
    });

    stream.on('info', () => {
      const dispatcher = serverQueue.connection
        .play(stream_to_play, {filter: "audioonly", highWaterMark: highWaterMark})
        .on("finish", () => {
          serverQueue.songs.shift();
          this.play(message, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
      dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
      serverQueue.textChannel.send(`Start playing: **${song.title}** (${song.durationString})`);
    });
  }
};
