import express from "express";
import { getPosts, getPostById } from "../controllers/posts.controller.js";
import { getTrends } from "../controllers/trends.controller.js";
import { getNearbyPosts } from "../controllers/nearby.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { ApiError } from "../utils/api.error.js";

const router = express.Router();

/**
 * @openapi
 * /social-posts:
 *   get:
 *     summary: Get all social posts
 *     tags:
 *       - Social Posts
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Optional keyword filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Limit number of results
 *     responses:
 *       200:
 *         description: A list of social posts
 */
router.get("/", authMiddleware, getPosts);

/**
 * @openapi
 * /social-posts/trends:
 *   get:
 *     summary: Get social media trends
 *     tags:
 *       - Social Posts
 *     responses:
 *       200:
 *         description: Trending insights
 */
router.get("/trends", authMiddleware, getTrends);

/**
 * @openapi
 * /social-posts/nearby:
 *   get:
 *     summary: Get nearby social media posts based on location and radius
 *     tags:
 *       - Social Posts
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           example: 12.9716
 *         description: Latitude of the location to search from
 *
 *       - in: query
 *         name: lon
 *         required: true
 *         schema:
 *           type: number
 *           example: 77.5946
 *         description: Longitude of the location to search from
 *
 *       - in: query
 *         name: radius
 *         required: false
 *         schema:
 *           type: number
 *           default: 5
 *           example: 10
 *         description: Search radius in kilometers (default is 5 km)
 *
 *     responses:
 *       200:
 *         description: List of nearby social media posts ordered by distance
 *       400:
 *         description: Invalid latitude or longitude
 *       500:
 *         description: Internal server error
 */
router.get("/nearby", authMiddleware, getNearbyPosts);

/**
 * @openapi
 * /social-posts/{id}:
 *   get:
 *     summary: Get a single post by ID
 *     tags:
 *       - Social Posts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Single post details
 */
router.get("/byId/:id", authMiddleware, getPostById);


export default router;
