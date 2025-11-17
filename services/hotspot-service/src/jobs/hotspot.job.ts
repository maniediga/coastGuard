import cron from 'node-cron';
import { updateHotspots } from '../services/hotspot.service';

// We run this once at the start, then every 5 minutes
export const startHotspotJob = () => {
  console.log('Hotspot job scheduler starting...');
  
  // Run immediately on server start
  updateHotspots();

  // Then, run every 5 minutes
  // (Cron syntax: '*/5 * * * *' means "at every 5th minute")
  cron.schedule('*/5 * * * *', () => {
    console.log('Running scheduled 5-minute hotspot update...');
    updateHotspots();
  });
};