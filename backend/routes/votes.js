const express = require("express");
const mongoose = require("mongoose");

const Vote = require("../models/Vote");
const Logo = require("../models/Logo");
const Test = require("../models/Test");
const { authenticateOwner } = require("../middleware/auth");

const router = express.Router();

const MAX_TEST_ID_LENGTH = 100;
const MAX_SESSION_ID_LENGTH = 200;


/*
 * Validate a non-empty string with a maximum length.
 */
function isValidString(value, maxLength) {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= maxLength
    );
}


/*
 * POST /api/votes
 *
 * Public.
 *
 * Records one comparison from a participant.
 *
 * A vote can be:
 *
 * 1. Normal vote
 *    {
 *      testId,
 *      sessionId,
 *      logoAId,
 *      logoBId,
 *      winnerId,
 *      loserId,
 *      skipped: false
 *    }
 *
 * 2. Skipped comparison
 *    {
 *      testId,
 *      sessionId,
 *      logoAId,
 *      logoBId,
 *      skipped: true
 *    }
 */
router.post("/", async (req, res) => {
    try {
        const {
            testId,
            sessionId,
            winnerId,
            loserId,
            logoAId,
            logoBId,
            skipped
        } = req.body;

        /*
         * Basic string validation.
         */
        if (
            !isValidString(
                testId,
                MAX_TEST_ID_LENGTH
            )
        ) {
            return res.status(400).json({
                error:
                    "A valid test ID is required."
            });
        }

        if (
            !isValidString(
                sessionId,
                MAX_SESSION_ID_LENGTH
            )
        ) {
            return res.status(400).json({
                error:
                    "A valid session ID is required."
            });
        }

        /*
         * Validate logo IDs.
         */
        if (
            !mongoose.Types.ObjectId.isValid(
                logoAId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                logoBId
            )
        ) {
            return res.status(400).json({
                error:
                    "Invalid logo IDs."
            });
        }

        /*
         * A logo cannot be compared against itself.
         */
        if (
            logoAId.toString() ===
            logoBId.toString()
        ) {
            return res.status(400).json({
                error:
                    "A logo cannot be compared against itself."
            });
        }

        /*
         * Convert skipped strictly to boolean.
         */
        const isSkipped = skipped === true;

        /*
         * If the comparison is not skipped,
         * winner and loser are required.
         */
        if (!isSkipped) {
            if (
                !mongoose.Types.ObjectId.isValid(
                    winnerId
                ) ||
                !mongoose.Types.ObjectId.isValid(
                    loserId
                )
            ) {
                return res.status(400).json({
                    error:
                        "Winner and loser IDs are required."
                });
            }

            /*
             * Winner and loser must be different.
             */
            if (
                winnerId.toString() ===
                loserId.toString()
            ) {
                return res.status(400).json({
                    error:
                        "Winner and loser must be different."
                });
            }

            /*
             * Winner and loser must be the two
             * logos actually presented to the user.
             */
            const presentedLogoIds = new Set([
                logoAId.toString(),
                logoBId.toString()
            ]);

            if (
                !presentedLogoIds.has(
                    winnerId.toString()
                ) ||
                !presentedLogoIds.has(
                    loserId.toString()
                )
            ) {
                return res.status(400).json({
                    error:
                        "Winner and loser must match the compared logos."
                });
            }
        }

        /*
         * Verify that both logos exist and are active.
         *
         * This prevents votes being submitted against
         * deleted/non-existent logos.
         */
        const logos = await Logo.find({
            _id: {
                $in: [
                    logoAId,
                    logoBId
                ]
            },
            active: true
        })
            .select("_id")
            .lean();

        if (logos.length !== 2) {
            return res.status(400).json({
                error:
                    "One or more selected logos are unavailable."
            });
        }

        /*
         * Make sure the test exists.
         *
         * A missing test can still be interpreted as a
         * draft by the GET endpoint, but votes should only
         * be accepted for a real published test.
         */
        const test = await Test.findOne({
            testId: testId.trim()
        })
            .select("testId state")
            .lean();

        if (!test) {
            return res.status(404).json({
                error:
                    "Test not found."
            });
        }

        if (test.state !== "published") {
            return res.status(403).json({
                error:
                    "This test is not currently accepting votes."
            });
        }

        /*
         * Prevent accidental duplicate submissions for the
         * exact same comparison within one session.
         *
         * We intentionally allow the same two logos in the
         * reverse order because the frontend may randomize
         * their positions.
         */
        const existingVote =
            await Vote.findOne({
                testId: testId.trim(),
                sessionId: sessionId.trim(),
                $or: [
                    {
                        logoAId,
                        logoBId
                    },
                    {
                        logoAId: logoBId,
                        logoBId: logoAId
                    }
                ]
            })
                .select("_id")
                .lean();

        if (existingVote) {
            return res.status(409).json({
                error:
                    "This comparison has already been submitted for this session."
            });
        }

        /*
         * Create the vote.
         */
        const vote = await Vote.create({
            testId: testId.trim(),
            sessionId: sessionId.trim(),

            logoAId,
            logoBId,

            winnerId:
                isSkipped
                    ? undefined
                    : winnerId,

            loserId:
                isSkipped
                    ? undefined
                    : loserId,

            skipped: isSkipped
        });

        res.status(201).json({
            success: true,
            vote
        });
    } catch (error) {
        console.error(
            "Failed to save vote:",
            error
        );

        res.status(500).json({
            error:
                "Failed to save vote."
        });
    }
});


/*
 * GET /api/votes/results/:testId
 *
 * Owner only.
 *
 * Returns aggregated results for a test.
 */
router.get(
    "/results/:testId",
    authenticateOwner,
    async (req, res) => {
        try {
            const testId =
                typeof req.params.testId ===
                "string"
                    ? req.params.testId.trim()
                    : "";

            if (
                !testId ||
                testId.length >
                    MAX_TEST_ID_LENGTH
            ) {
                return res.status(400).json({
                    error:
                        "Invalid test ID."
                });
            }

            const votes = await Vote.find({
                testId
            })
                .lean();

            const results = {};

            let totalComparisons = 0;
            let totalVotes = 0;
            let totalSkips = 0;

            for (const vote of votes) {
                totalComparisons += 1;

                const ids = [
                    vote.logoAId,
                    vote.logoBId
                ];

                /*
                 * A skipped comparison counts once
                 * for each displayed logo.
                 */
                for (const id of ids) {
                    const key =
                        id.toString();

                    if (!results[key]) {
                        results[key] = {
                            wins: 0,
                            losses: 0,
                            votes: 0,
                            skips: 0
                        };
                    }

                    results[key].votes += 1;

                    if (vote.skipped) {
                        results[key].skips += 1;
                        continue;
                    }

                    if (
                        vote.winnerId &&
                        vote.winnerId.toString() ===
                            key
                    ) {
                        results[key].wins += 1;
                        totalVotes += 1;
                    }

                    if (
                        vote.loserId &&
                        vote.loserId.toString() ===
                            key
                    ) {
                        results[key].losses += 1;
                    }
                }

                /*
                 * Count each skipped comparison once.
                 */
                if (vote.skipped) {
                    totalSkips += 1;
                }
            }

            /*
             * Fetch the actual logos so the frontend doesn't
             * have to join IDs manually.
             */
            const logoIds =
                Object.keys(results);

            const logos =
                logoIds.length
                    ? await Logo.find({
                          _id: {
                              $in: logoIds
                          }
                      })
                          .select(
                              "_id name version mark imageFileId imageUrl colorIndex order active"
                          )
                          .lean()
                    : [];

            const logoMap =
                new Map(
                    logos.map(
                        (logo) => [
                            logo._id.toString(),
                            logo
                        ]
                    )
                );

            const detailedResults =
                Object.entries(
                    results
                )
                    .map(
                        ([logoId, stats]) => {
                            const logo =
                                logoMap.get(
                                    logoId
                                );

                            return {
                                logoId,
                                logo: logo
                                    ? {
                                          ...logo,
                                          _id:
                                              logo._id.toString(),
                                          imageUrl:
                                              logo.imageFileId
                                                  ? `/api/logos/image/${logo.imageFileId}`
                                                  : logo.imageUrl ||
                                                    null
                                      }
                                    : null,
                                ...stats,
                                winRate:
                                    stats.wins +
                                        stats.losses >
                                    0
                                        ? Number(
                                              (
                                                  (stats.wins /
                                                      (stats.wins +
                                                          stats.losses)) *
                                                  100
                                              ).toFixed(
                                                  2
                                              )
                                          )
                                        : 0
                            };
                        }
                    )
                    .sort(
                        (a, b) => {
                            if (
                                b.wins !==
                                a.wins
                            ) {
                                return (
                                    b.wins -
                                    a.wins
                                );
                            }

                            return (
                                b.winRate -
                                a.winRate
                            );
                        }
                    );

            res.json({
                success: true,
                results: detailedResults,
                totalComparisons,
                totalVotes,
                totalSkips
            });
        } catch (error) {
            console.error(
                "Failed to retrieve results:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to retrieve results."
            });
        }
    }
);


module.exports = router;