const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");

const Logo = require("../models/Logo");
const { authenticateOwner } = require("../middleware/auth");

const router = express.Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml"
]);

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: MAX_FILE_SIZE
    },

    fileFilter: (req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            return callback(
                new Error(
                    "Only JPEG, PNG, WebP, GIF, and SVG images are allowed."
                )
            );
        }

        callback(null, true);
    }
});


async function getBucket() {
    const db = mongoose.connection.db;

    if (!db) {
        throw new Error(
            "MongoDB database connection is unavailable."
        );
    }

    return new mongoose.mongo.GridFSBucket(db, {
        bucketName: "logoImages"
    });
}


function buildImageUrl(logo) {
    if (logo.imageFileId) {
        return `/api/logos/image/${logo.imageFileId}`;
    }

    return logo.imageUrl || null;
}


function normalizeLogo(logo) {
    const object = logo.toObject
        ? logo.toObject()
        : { ...logo };

    return {
        ...object,
        _id: object._id.toString(),
        imageUrl: buildImageUrl(object)
    };
}


function parseColorIndex(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return 0;
    }

    const number = Number(value);

    if (
        !Number.isInteger(number) ||
        number < 0 ||
        number > 1000
    ) {
        return null;
    }

    return number;
}


/*
 * GET /api/logos
 *
 * Public.
 * Returns all active logos in display order.
 */
router.get("/", async (req, res) => {
    try {
        const logos = await Logo.find({
            active: true
        })
            .sort({
                order: 1,
                createdAt: 1
            })
            .lean();

        res.json({
            success: true,
            logos: logos.map(normalizeLogo)
        });
    } catch (error) {
        console.error(
            "Failed to fetch logos:",
            error
        );

        res.status(500).json({
            error: "Failed to fetch logos."
        });
    }
});


/*
 * POST /api/logos
 *
 * Owner only.
 *
 * Accepts either:
 * - multipart/form-data with an "image" file
 * - JSON with an imageUrl
 */
router.post(
    "/",
    authenticateOwner,
    upload.single("image"),
    async (req, res) => {
        try {
            const name =
                typeof req.body.name === "string"
                    ? req.body.name.trim()
                    : "";

            const version =
                typeof req.body.version === "string"
                    ? req.body.version.trim()
                    : "";

            const mark =
                typeof req.body.mark === "string"
                    ? req.body.mark.trim()
                    : "";

            const imageUrl =
                typeof req.body.imageUrl === "string"
                    ? req.body.imageUrl.trim()
                    : "";

            if (!name || !version) {
                return res.status(400).json({
                    error:
                        "Concept name and version are required."
                });
            }

            if (name.length > 100) {
                return res.status(400).json({
                    error:
                        "Concept name must be 100 characters or fewer."
                });
            }

            if (version.length > 100) {
                return res.status(400).json({
                    error:
                        "Version must be 100 characters or fewer."
                });
            }

            if (mark.length > 500) {
                return res.status(400).json({
                    error:
                        "Mark must be 500 characters or fewer."
                });
            }

            if (
                req.file &&
                imageUrl
            ) {
                return res.status(400).json({
                    error:
                        "Provide either an image file or an image URL, not both."
                });
            }

            if (
                imageUrl &&
                !/^https?:\/\/\S+$/i.test(imageUrl)
            ) {
                return res.status(400).json({
                    error:
                        "Image URL must be a valid HTTP or HTTPS URL."
                });
            }

            const colorIndex =
                parseColorIndex(req.body.colorIndex);

            if (colorIndex === null) {
                return res.status(400).json({
                    error:
                        "Color index must be a non-negative integer."
                });
            }

            const existingCount =
                await Logo.countDocuments();

            let imageFileId = null;

            if (req.file) {
                const bucket = await getBucket();

                imageFileId =
                    await new Promise(
                        (resolve, reject) => {
                            const uploadStream =
                                bucket.openUploadStream(
                                    req.file.originalname,
                                    {
                                        contentType:
                                            req.file.mimetype,

                                        metadata: {
                                            uploadedFor:
                                                "Logo Duel"
                                        }
                                    }
                                );

                            uploadStream.on(
                                "error",
                                reject
                            );

                            uploadStream.on(
                                "finish",
                                () => {
                                    resolve(
                                        uploadStream.id
                                    );
                                }
                            );

                            uploadStream.end(
                                req.file.buffer
                            );
                        }
                    );
            }

            const logo = await Logo.create({
                name,
                version,
                mark,
                colorIndex,
                order: existingCount,
                imageFileId,
                imageUrl:
                    imageFileId
                        ? null
                        : imageUrl || null
            });

            res.status(201).json({
                success: true,
                logo: normalizeLogo(logo)
            });
        } catch (error) {
            console.error(
                "Failed to create logo:",
                error
            );

            res.status(500).json({
                error:
                    error.message ||
                    "Failed to create logo."
            });
        }
    }
);


/*
 * GET /api/logos/image/:id
 *
 * Public GridFS image endpoint.
 */
router.get(
    "/image/:id",
    async (req, res) => {
        try {
            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).send(
                    "Invalid image ID."
                );
            }

            const bucket = await getBucket();

            const fileId =
                new mongoose.Types.ObjectId(
                    req.params.id
                );

            const files =
                await bucket
                    .find({
                        _id: fileId
                    })
                    .toArray();

            if (!files.length) {
                return res.status(404).send(
                    "Image not found."
                );
            }

            const file = files[0];

            res.set(
                "Content-Type",
                file.contentType ||
                    "application/octet-stream"
            );

            res.set(
                "Cache-Control",
                "public, max-age=31536000, immutable"
            );

            const downloadStream =
                bucket.openDownloadStream(
                    fileId
                );

            downloadStream.on(
                "error",
                (error) => {
                    console.error(
                        "GridFS download failed:",
                        error
                    );

                    if (!res.headersSent) {
                        res.status(404).end();
                    }
                }
            );

            downloadStream.pipe(res);
        } catch (error) {
            console.error(
                "Failed to retrieve image:",
                error
            );

            if (!res.headersSent) {
                res.status(500).send(
                    "Failed to retrieve image."
                );
            }
        }
    }
);


/*
 * PUT /api/logos/reorder
 *
 * Owner only.
 *
 * Body:
 * {
 *   "ids": [
 *      "logoId1",
 *      "logoId2",
 *      "logoId3"
 *   ]
 * }
 */
router.put(
    "/reorder",
    authenticateOwner,
    async (req, res) => {
        try {
            const { ids } = req.body;

            if (!Array.isArray(ids)) {
                return res.status(400).json({
                    error:
                        "ids must be an array."
                });
            }

            if (ids.length > 1000) {
                return res.status(400).json({
                    error:
                        "Too many logos."
                });
            }

            const invalidId = ids.find(
                (id) =>
                    !mongoose.Types.ObjectId.isValid(
                        id
                    )
            );

            if (invalidId) {
                return res.status(400).json({
                    error:
                        "One or more logo IDs are invalid."
                });
            }

            const uniqueIds = new Set(
                ids.map(String)
            );

            if (
                uniqueIds.size !== ids.length
            ) {
                return res.status(400).json({
                    error:
                        "Duplicate logo IDs are not allowed."
                });
            }

            const logos =
                await Logo.find({
                    _id: {
                        $in: ids
                    },
                    active: true
                });

            if (logos.length !== ids.length) {
                return res.status(400).json({
                    error:
                        "The reorder list does not match the active logos."
                });
            }

            const operations = ids.map(
                (id, index) => ({
                    updateOne: {
                        filter: {
                            _id: id
                        },
                        update: {
                            $set: {
                                order: index
                            }
                        }
                    }
                })
            );

            await Logo.bulkWrite(
                operations
            );

            const updated =
                await Logo.find({
                    active: true
                })
                    .sort({
                        order: 1,
                        createdAt: 1
                    })
                    .lean();

            res.json({
                success: true,
                logos: updated.map(
                    normalizeLogo
                )
            });
        } catch (error) {
            console.error(
                "Failed to reorder logos:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to reorder logos."
            });
        }
    }
);


/*
 * PATCH /api/logos/:id
 *
 * Owner only.
 */
router.patch(
    "/:id",
    authenticateOwner,
    async (req, res) => {
        try {
            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    error:
                        "Invalid logo ID."
                });
            }

            const allowedFields = [
                "name",
                "version",
                "mark",
                "colorIndex",
                "order",
                "active",
                "imageUrl"
            ];

            const updates = {};

            for (const field of allowedFields) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        req.body,
                        field
                    )
                ) {
                    updates[field] =
                        req.body[field];
                }
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    updates,
                    "name"
                )
            ) {
                if (
                    typeof updates.name !==
                    "string"
                ) {
                    return res.status(400).json({
                        error:
                            "Name must be a string."
                    });
                }

                updates.name =
                    updates.name.trim();

                if (
                    !updates.name ||
                    updates.name.length > 100
                ) {
                    return res.status(400).json({
                        error:
                            "Name must be between 1 and 100 characters."
                    });
                }
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    updates,
                    "version"
                )
            ) {
                if (
                    typeof updates.version !==
                    "string"
                ) {
                    return res.status(400).json({
                        error:
                            "Version must be a string."
                    });
                }

                updates.version =
                    updates.version.trim();

                if (
                    !updates.version ||
                    updates.version.length > 100
                ) {
                    return res.status(400).json({
                        error:
                            "Version must be between 1 and 100 characters."
                    });
                }
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    updates,
                    "mark"
                )
            ) {
                if (
                    typeof updates.mark !==
                    "string"
                ) {
                    return res.status(400).json({
                        error:
                            "Mark must be a string."
                    });
                }

                updates.mark =
                    updates.mark.trim();

                if (
                    updates.mark.length > 500
                ) {
                    return res.status(400).json({
                        error:
                            "Mark must be 500 characters or fewer."
                    });
                }
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    updates,
                    "imageUrl"
                )
            ) {
                if (
                    updates.imageUrl !== null &&
                    typeof updates.imageUrl !==
                        "string"
                ) {
                    return res.status(400).json({
                        error:
                            "Image URL must be a string or null."
                    });
                }

                if (
                    typeof updates.imageUrl ===
                    "string"
                ) {
                    updates.imageUrl =
                        updates.imageUrl.trim();

                    if (
                        updates.imageUrl &&
                        !/^https?:\/\/\S+$/i.test(
                            updates.imageUrl
                        )
                    ) {
                        return res.status(400).json({
                            error:
                                "Image URL must be a valid HTTP or HTTPS URL."
                        });
                    }
                }
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    updates,
                    "colorIndex"
                )
            ) {
                const colorIndex =
                    parseColorIndex(
                        updates.colorIndex
                    );

                if (colorIndex === null) {
                    return res.status(400).json({
                        error:
                            "Color index must be a non-negative integer."
                    });
                }

                updates.colorIndex =
                    colorIndex;
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    updates,
                    "order"
                )
            ) {
                const order =
                    Number(updates.order);

                if (
                    !Number.isInteger(order) ||
                    order < 0
                ) {
                    return res.status(400).json({
                        error:
                            "Order must be a non-negative integer."
                    });
                }

                updates.order = order;
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    updates,
                    "active"
                )
            ) {
                if (
                    typeof updates.active !==
                    "boolean"
                ) {
                    return res.status(400).json({
                        error:
                            "Active must be a boolean."
                    });
                }
            }

            if (
                Object.keys(updates).length === 0
            ) {
                return res.status(400).json({
                    error:
                        "No valid fields were provided."
                });
            }

            const logo =
                await Logo.findByIdAndUpdate(
                    req.params.id,
                    updates,
                    {
                        new: true,
                        runValidators: true
                    }
                );

            if (!logo) {
                return res.status(404).json({
                    error:
                        "Logo not found."
                });
            }

            res.json({
                success: true,
                logo: normalizeLogo(logo)
            });
        } catch (error) {
            console.error(
                "Failed to update logo:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to update logo."
            });
        }
    }
);


/*
 * DELETE /api/logos/:id
 *
 * Owner only.
 *
 * Soft-deletes the logo and attempts
 * to remove its GridFS image.
 */
router.delete(
    "/:id",
    authenticateOwner,
    async (req, res) => {
        try {
            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    error:
                        "Invalid logo ID."
                });
            }

            const logo =
                await Logo.findById(
                    req.params.id
                );

            if (!logo) {
                return res.status(404).json({
                    error:
                        "Logo not found."
                });
            }

            if (logo.imageFileId) {
                const bucket =
                    await getBucket();

                try {
                    await bucket.delete(
                        logo.imageFileId
                    );
                } catch (imageError) {
                    console.warn(
                        "Could not delete GridFS image:",
                        imageError.message
                    );
                }

                logo.imageFileId = null;
            }

            logo.active = false;

            await logo.save();

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "Failed to delete logo:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to delete logo."
            });
        }
    }
);


module.exports = router;