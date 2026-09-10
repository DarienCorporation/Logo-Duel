require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const {
    connectDatabase,
    getDatabaseStatus,
    disconnectDatabase
} = require("./config/database");

const authRoutes = require("./routes/auth");
const logoRoutes = require("./routes/logos");
const voteRoutes = require("./routes/votes");
const testRoutes = require("./routes/tests");

const app = express();

const PORT = Number(process.env.PORT) || 5050;


/*
 * Trust the first proxy.
 */
app.set("trust proxy", 1);


/*
 * Security headers.
 */
app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        }
    })
);


/*
 * CORS configuration.
 */
const configuredOrigins =
    process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL
              .split(",")
              .map((origin) => origin.trim())
              .filter(Boolean)
        : [];


app.use(
    cors({
        origin(origin, callback) {
            /*
             * Requests without an Origin header,
             * such as curl and some API clients,
             * are allowed.
             */
            if (!origin) {
                return callback(null, true);
            }

            /*
             * During local development, if no
             * FRONTEND_URL is configured, allow
             * browser requests.
             */
            if (configuredOrigins.length === 0) {
                return callback(null, true);
            }

            if (configuredOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(
                new Error(
                    "Origin is not allowed by CORS."
                )
            );
        },

        methods: [
            "GET",
            "POST",
            "PATCH",
            "PUT",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ],

        credentials: false
    })
);


/*
 * Request body parsing.
 */
app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);


/*
 * General API rate limiter.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        error:
            "Too many requests. Please try again later."
    }
});


app.use(
    "/api",
    generalLimiter
);


/*
 * Health check.
 */
app.get(
    "/api/health",
    (req, res) => {
        const database =
            getDatabaseStatus();

        res.status(
            database.connected
                ? 200
                : 503
        ).json({
            success:
                database.connected,

            service:
                "Logo Duel API",

            status:
                database.connected
                    ? "healthy"
                    : "database unavailable",

            database
        });
    }
);


/*
 * API routes.
 */
app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/logos",
    logoRoutes
);

app.use(
    "/api/votes",
    voteRoutes
);

app.use(
    "/api/tests",
    testRoutes
);


/*
 * API 404 handler.
 */
app.use(
    "/api",
    (req, res) => {
        res.status(404).json({
            error:
                "API endpoint not found."
        });
    }
);


/*
 * Global error handler.
 */
app.use(
    (error, req, res, next) => {
        console.error(
            "Unhandled server error:",
            error
        );

        if (
            error &&
            error.code === "LIMIT_FILE_SIZE"
        ) {
            return res.status(413).json({
                error:
                    "Logo image must be 10 MB or smaller."
            });
        }

        if (
            error &&
            error.message ===
                "Origin is not allowed by CORS."
        ) {
            return res.status(403).json({
                error:
                    "Origin is not allowed."
            });
        }

        if (
            error instanceof SyntaxError &&
            error.status === 400 &&
            "body" in error
        ) {
            return res.status(400).json({
                error:
                    "Invalid JSON request body."
            });
        }

        const isProduction =
            process.env.NODE_ENV ===
            "production";

        res.status(500).json({
            error:
                isProduction
                    ? "Internal server error."
                    : error.message ||
                      "Internal server error."
        });
    }
);


/*
 * Start the server.
 */
async function startServer() {
    console.log(
        "Starting Logo Duel API..."
    );

    await connectDatabase();

    app.listen(
        PORT,
        () => {
            console.log(
                `Logo Duel API running on port ${PORT}`
            );
        }
    );
}


/*
 * Graceful shutdown.
 */
async function shutdown(signal) {
    console.log(
        `${signal} received. Shutting down...`
    );

    try {
        await disconnectDatabase();

        console.log(
            "MongoDB connection closed."
        );

        process.exit(0);
    } catch (error) {
        console.error(
            "Shutdown error:",
            error
        );

        process.exit(1);
    }
}


process.once(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.once(
    "SIGTERM",
    () => shutdown("SIGTERM")
);


/*
 * Start the application.
 */
startServer().catch(
    (error) => {
        console.error(
            "Server startup failed:",
            error
        );

        process.exit(1);
    }
);


module.exports = app;