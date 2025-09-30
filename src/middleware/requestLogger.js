module.exports = (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const ms = Date.now() - start;
        const nzTime = new Date().toLocaleString("en-NZ", {
            timeZone: "Pacific/Auckland",
            hour12: false,
        });
        console.log(`${nzTime} ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
    });
    next();
};
