const { Util } = require("discord.js");

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
          var queue_entries = serverQueue.songs.map(song => `* ${song.title} (${song.durationString}), queued by: ${song.queuer}`);
          queue_entries[0] = queue_entries[0].concat( " (Now playing)");
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
