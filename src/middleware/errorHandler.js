const { getNZLogTime } = require("../utils/timeUtils");

module.exports = (err, _req, res, _next) => {
    console.error(`[${getNZLogTime()}] Unhandled error:`, err);
    if (!res.headersSent) res.status(500).send("Internal server error");
};
