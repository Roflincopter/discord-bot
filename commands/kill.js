module.exports = {
	name: 'kill',
	description: 'kills the bot. Use when the bot is stuck, should come up again.',
	execute(message) {
		process.exit(1);
	},
};

