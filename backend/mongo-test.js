require("dotenv").config();

const mongoose = require("mongoose");

console.log("1. Starting MongoDB test...");
console.log("2. URI loaded:", Boolean(process.env.MONGODB_URI));

mongoose
    .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 10000,
        family: 4
    })
    .then(() => {
        console.log("3. MongoDB connection OK");
        console.log("4. Database:", mongoose.connection.name);
        process.exit(0);
    })
    .catch((error) => {
        console.log("3. MongoDB connection FAILED");
        console.log("Name:", error.name);
        console.log("Message:", error.message);
        console.log(
            "Reason:",
            error.reason ? error.reason.message : "none"
        );
        process.exit(1);
    });
