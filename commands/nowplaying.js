const util = require("./util")

module.exports = {
	name: 'nowplaying',
	description: 'Get the song that is playing.',
	execute(message) {
		const serverQueue = message.client.queue.get(message.guild.id);
		if (!serverQueue || !serverQueue.connection) return message.channel.send('There is nothing playing.');
		let song = serverQueue.songs[0]
		let currentPlayPosition = util.getCurrentPlayTime(serverQueue.connection.dispatcher);
		return message.channel.send(`Now playing: ${song.title} (${currentPlayPosition}/${song.durationString})`);
	},
};