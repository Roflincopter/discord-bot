module.exports = {
	name: 'kill',
	description: 'kills the bot. Use when the bot is stuck, should come up again.',
	async execute(message) {
		await message.channel.send("Stopping myself, should be back soon.");
		process.exit(1);
	},
};

