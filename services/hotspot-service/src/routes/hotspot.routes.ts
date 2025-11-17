import { Router } from 'express';
import * as hotspotController from '../controllers/hotspot.controller';

const router = Router();

// GET /api/v1/hotspots
router.get('/', hotspotController.getActiveHotspots);

export default router;