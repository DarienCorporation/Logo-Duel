const crypto = require("crypto");

function createToken() {
    return crypto.randomBytes(32).toString("hex");
}

function authenticateOwner(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Owner authentication required."
        });
    }

    const token = authorization.substring(7);

    if (!process.env.OWNER_SESSION_TOKEN) {
        return res.status(500).json({
            error: "Owner authentication is not configured."
        });
    }

    if (token !== process.env.OWNER_SESSION_TOKEN) {
        return res.status(401).json({
            error: "Invalid owner session."
        });
    }

    next();
}

module.exports = {
    createToken,
    authenticateOwner
};