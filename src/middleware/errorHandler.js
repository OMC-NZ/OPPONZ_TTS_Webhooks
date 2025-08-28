module.exports = (err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    if (!res.headersSent) res.status(500).send("Internal server error");
};
