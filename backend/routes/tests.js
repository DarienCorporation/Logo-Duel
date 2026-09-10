const express = require("express");

const Test = require("../models/Test");
const { authenticateOwner } = require("../middleware/auth");

const router = express.Router();

const MAX_TEST_ID_LENGTH = 100;
const MIN_SESSION_TARGET = 1;
const MAX_SESSION_TARGET = 1000;

const VALID_STATES = new Set([
    "draft",
    "published",
    "closed"
]);


/*
 * Validate a test ID.
 */
function normalizeTestId(value) {
    if (typeof value !== "string") {
        return null;
    }

    const testId = value.trim();

    if (
        !testId ||
        testId.length > MAX_TEST_ID_LENGTH
    ) {
        return null;
    }

    /*
     * Test IDs are intentionally restricted to characters
     * that are safe in URLs and MongoDB queries.
     */
    if (!/^[a-zA-Z0-9_-]+$/.test(testId)) {
        return null;
    }

    return testId;
}


/*
 * GET /api/tests/:testId
 *
 * Public.
 *
 * Returns the test configuration.
 *
 * If the test doesn't exist yet, a default draft
 * configuration is returned without creating a database
 * record.
 */
router.get(
    "/:testId",
    async (req, res) => {
        try {
            const testId =
                normalizeTestId(
                    req.params.testId
                );

            if (!testId) {
                return res.status(400).json({
                    error:
                        "Invalid test ID."
                });
            }

            const test =
                await Test.findOne({
                    testId
                }).lean();

            if (!test) {
                return res.json({
                    success: true,
                    test: {
                        testId,
                        state: "draft",
                        sessionTarget: 12
                    }
                });
            }

            res.json({
                success: true,
                test
            });
        } catch (error) {
            console.error(
                "Failed to retrieve test:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to retrieve test."
            });
        }
    }
);


/*
 * PATCH /api/tests/:testId
 *
 * Owner only.
 *
 * Creates or updates a test.
 *
 * Body may contain:
 *
 * {
 *   "state": "draft",
 *   "sessionTarget": 12
 * }
 */
router.patch(
    "/:testId",
    authenticateOwner,
    async (req, res) => {
        try {
            const testId =
                normalizeTestId(
                    req.params.testId
                );

            if (!testId) {
                return res.status(400).json({
                    error:
                        "Invalid test ID."
                });
            }

            const {
                state,
                sessionTarget
            } = req.body;

            const update = {};

            /*
             * Validate state if supplied.
             */
            if (state !== undefined) {
                if (
                    typeof state !== "string" ||
                    !VALID_STATES.has(
                        state
                    )
                ) {
                    return res.status(400).json({
                        error:
                            "State must be draft, published, or closed."
                    });
                }

                update.state = state;
            }

            /*
             * Validate session target if supplied.
             */
            if (
                sessionTarget !== undefined
            ) {
                const target =
                    Number(sessionTarget);

                if (
                    !Number.isInteger(
                        target
                    ) ||
                    target <
                        MIN_SESSION_TARGET ||
                    target >
                        MAX_SESSION_TARGET
                ) {
                    return res.status(400).json({
                        error:
                            `Session target must be an integer between ${MIN_SESSION_TARGET} and ${MAX_SESSION_TARGET}.`
                    });
                }

                update.sessionTarget =
                    target;
            }

            /*
             * Don't allow an empty PATCH request.
             */
            if (
                Object.keys(update).length ===
                0
            ) {
                return res.status(400).json({
                    error:
                        "No valid test settings were provided."
                });
            }

            /*
             * Get the current test so we can validate
             * state transitions.
             */
            const existingTest =
                await Test.findOne({
                    testId
                });

            /*
             * Prevent reopening a closed test.
             *
             * Once a test is closed, create a new test ID
             * if another voting round is required.
             */
            if (
                existingTest &&
                existingTest.state ===
                    "closed" &&
                update.state &&
                update.state !==
                    "closed"
            ) {
                return res.status(409).json({
                    error:
                        "A closed test cannot be reopened."
                });
            }

            let test;

            if (existingTest) {
                Object.assign(
                    existingTest,
                    update
                );

                test =
                    await existingTest.save();
            } else {
                test =
                    await Test.create({
                        testId,
                        state:
                            update.state ||
                            "draft",
                        sessionTarget:
                            update.sessionTarget ||
                            12
                    });
            }

            res.json({
                success: true,
                test
            });
        } catch (error) {
            console.error(
                "Failed to update test:",
                error
            );

            /*
             * Handle duplicate test IDs gracefully.
             */
            if (
                error &&
                error.code === 11000
            ) {
                return res.status(409).json({
                    error:
                        "A test with this ID already exists."
                });
            }

            res.status(500).json({
                error:
                    "Failed to update test."
            });
        }
    }
);


module.exports = router;