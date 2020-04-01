module.exports = {
	name: 'resume',
	description: 'Resume the playback.',
	execute(message) {
		const serverQueue = message.client.queue.get(message.guild.id);
		if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to stop the music!');
		if (!serverQueue || !serverQueue.connection || !serverQueue.connection.dispatcher) return message.channel.send('There is nothing to resume.');
		if (!serverQueue.connection.dispatcher.paused) return message.channel.send('already playing'); 
		serverQueue.connection.dispatcher.resume();
	},
};
