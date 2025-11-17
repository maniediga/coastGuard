import { Request, Response } from 'express';
import * as hotspotService from '../services/hotspot.service';

export const getActiveHotspots = async (req: Request, res: Response) => {
  try {
    // This call is very fast, it just reads the pre-calculated table
    const hotspots = await hotspotService.getActiveHotspots();
    res.status(200).json(hotspots);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: 'Error fetching hotspots', error: error.message });
  }
};