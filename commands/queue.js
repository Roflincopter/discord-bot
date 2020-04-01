const { Util } = require("discord.js");
const moment = require("moment");
const momentDurationFormatSetup = require("moment-duration-format");

module.exports = {
  name: "queue",
  description: "Displays the current queue",
  async execute(message) {
    try {
      const args = message.content.split(" ");
      const serverQueue = message.client.queue.get(message.guild.id);

      const voiceChannel = message.member.voice.channel;

      if (!serverQueue) {
        return message.channel.send("There currently is no queue.");
      } else {
	      if (serverQueue.songs.length == 0) {
          message.channel.send("The queue is empty");
        } else {
          
          var queue_entries = serverQueue.songs.map((song, index) => {
            if(index == 0) {
              var currentPlayPosition = moment.duration(serverQueue.connection.dispatcher.streamTime, "milliseconds").format("h:mm:ss", { stopTrim: "m" });
              return `* ${song.title} (${currentPlayPosition}/${song.durationString}), queued by: ${song.queuer} (Now playing)`
            }
            return `* ${song.title} (${song.durationString}), queued by: ${song.queuer}`
          });
          
	        var queue_message = queue_entries.join("\n");
          return message.channel.send(queue_message);
        }
      }
    } catch (error) {
      console.log(error);
      message.channel.send(error.message);
    }
  },
};
