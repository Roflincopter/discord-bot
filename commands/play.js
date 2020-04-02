const { Util } = require("discord.js");
const ytdl = require("youtube-dl");
const moment = require("moment");
const momentDurationFormatSetup = require("moment-duration-format");
const ytSearch = require('youtube-search');

const {
	ytApiKey,
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

function intOrNaN (x) {
  return /^\d+$/.test(x) ? +x : NaN
}

function isValidURL(str) {
  return !!urlPattern.test(str);
}

module.exports = {
  name: "play",
  description: "Play a song in your channel!",
  execute(message) {
    try {
      const args = message.content.split(" ");

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.channel.send(
          "You need to be in a voice channel to play music!"
        );
      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
          "I need the permissions to join and speak in your voice channel!"
        );
      }

      if(isValidURL(args[1])) {
        this.queue(args[1], message);
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
      ytSearch(query, searchOpts, (err, results) => {

        if(err) {
          console.log(err);
          err.message && message.channel.send(err.message)
          err.message
          return;
        }
        
        var searchResults = message.client.searchResults;
        searchResults[message.member.user.username] = results;
  
        var resultEntries = results.map((result, index) => `${index}) "${result.title}", by channel "${result.channelTitle}"`);
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
      const queue = message.client.queue;
      const serverQueue = message.client.queue.get(message.guild.id);
      const voiceChannel = message.member.voice.channel;

      var self = this;
      ytdl.getInfo(url, async function (err, songInfo) {
        try {
          if (err) {
            console.log(err);
            return;
          }

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
            return message.channel.send(
              `${song.title} (${song.durationString}) has been added to the queue!`
            );
          }
        } catch (error) {
          console.log(error);
          error.message && message.channel.send(error.message);
        }
      });
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

    var stream = ytdl(song.url, ['-x', '--audio-format', 'mp3']);

    stream.on('error', err => {
      console.log(err);
      if(err.code == 'ESOCKETTIMEDOUT') return;
      serverQueue.songs.shift();
      this.play(message, serverQueue.songs[0]);
      return;
    });

    stream.on('info', () => {
      const dispatcher = serverQueue.connection
        .play(stream)
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
