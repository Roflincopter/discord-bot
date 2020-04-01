const moment = require("moment");
const momentDurationFormatSetup = require("moment-duration-format");

module.exports = {
	name: 'nowplaying',
	description: 'Get the song that is playing.',
	execute(message) {
		const serverQueue = message.client.queue.get(message.guild.id);
		if (!serverQueue) return message.channel.send('There is nothing playing.');
		var song = serverQueue.songs[0]
		var currentPlayPosition = moment.duration(serverQueue.connection.dispatcher.streamTime, "milliseconds").format("h:mm:ss", { stopTrim: "m" });
		return message.channel.send(`Now playing: ${song.title} (${currentPlayPosition}/${song.durationString})`);
	},
};