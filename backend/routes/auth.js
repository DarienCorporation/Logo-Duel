const express = require("express");
const crypto = require("crypto");
const { createToken } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
    const { passcode } = req.body;

    if (
        typeof passcode !== "string" ||
        !passcode ||
        passcode.length > 200
    ) {
        return res.status(400).json({
            error: "Invalid passcode."
        });
    }

    const configuredPassword = process.env.OWNER_PASSCODE;

    if (!configuredPassword) {
        return res.status(500).json({
            error: "Owner authentication is not configured."
        });
    }

    const supplied = Buffer.from(passcode);
    const expected = Buffer.from(configuredPassword);

    if (
        supplied.length !== expected.length ||
        !crypto.timingSafeEqual(supplied, expected)
    ) {
        return res.status(401).json({
            error: "Incorrect passcode."
        });
    }

    const token = createToken();

    res.json({
        success: true,
        token
    });
});

module.exports = router;