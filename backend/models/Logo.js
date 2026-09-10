const mongoose = require("mongoose");

const logoSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        version: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        mark: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500
        },

        imageFileId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        imageUrl: {
            type: String,
            default: null
        },

        colorIndex: {
            type: Number,
            default: 0
        },

        order: {
            type: Number,
            default: 0
        },

        active: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Logo", logoSchema);