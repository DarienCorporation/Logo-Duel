const mongoose = require("mongoose");

let connectionPromise = null;

async function connectDatabase() {
    /*
     * If Mongoose is already connected, reuse the
     * existing connection.
     *
     * This is especially important for serverless
     * environments such as Vercel.
     */
    if (
        mongoose.connection.readyState === 1
    ) {
        return mongoose.connection;
    }

    /*
     * If a connection is already being established,
     * wait for that same connection instead of
     * creating another one.
     */
    if (connectionPromise) {
        return connectionPromise;
    }

    const mongoUri =
        process.env.MONGODB_URI;

    if (
        typeof mongoUri !== "string" ||
        !mongoUri.trim()
    ) {
        throw new Error(
            "MONGODB_URI is not defined in the environment."
        );
    }

    connectionPromise =
        mongoose
            .connect(mongoUri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                maxPoolSize: 10,
                minPoolSize: 0,
                maxIdleTimeMS: 30000,
                family: 4
            })
            .then(() => {
                console.log(
                    "MongoDB connected successfully."
                );

                console.log(
                    `Database: ${mongoose.connection.name}`
                );

                return mongoose.connection;
            })
            .catch((error) => {
                /*
                 * Allow a future request/start attempt
                 * to retry after a failed connection.
                 */
                connectionPromise = null;

                console.error(
                    "MongoDB connection failed:",
                    error.message
                );

                throw error;
            });

    return connectionPromise;
}


/*
 * Useful for health checks.
 */
function getDatabaseStatus() {
    const states = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };

    return {
        connected:
            mongoose.connection.readyState ===
            1,
        state:
            states[
                mongoose.connection
                    .readyState
            ] || "unknown",
        database:
            mongoose.connection.name ||
            null
    };
}


/*
 * Graceful shutdown for local development
 * and traditional Node deployments.
 */
async function disconnectDatabase() {
    connectionPromise = null;

    if (
        mongoose.connection.readyState !==
        0
    ) {
        await mongoose.disconnect();
    }
}


module.exports = {
    connectDatabase,
    getDatabaseStatus,
    disconnectDatabase
};