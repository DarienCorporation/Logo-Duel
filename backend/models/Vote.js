const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema(
    {
        testId: {
            type: String,
            required: true,
            index: true
        },

        sessionId: {
            type: String,
            required: true,
            index: true
        },

        winnerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false
        },

        loserId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false
        },

        skipped: {
            type: Boolean,
            default: false
        },

        logoAId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        logoBId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Vote", voteSchema);