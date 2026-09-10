const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
    {
        testId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        state: {
            type: String,
            enum: ["draft", "published", "closed"],
            default: "draft"
        },

        sessionTarget: {
            type: Number,
            default: 12
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Test", testSchema);