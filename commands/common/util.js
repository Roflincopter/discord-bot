
const moment = require("moment");
const momentDurationFormatSetup = require("moment-duration-format");

module.exports = {
    getCurrentPlayTime(dispatcher) {
        if (dispatcher) {
			return moment.duration(dispatcher.streamTime, "milliseconds").format("h:mm:ss", { stopTrim: "m" });
		} else {
			return "0:00"
		}
    }
};