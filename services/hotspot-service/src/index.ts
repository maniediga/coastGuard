import express from 'express';
import 'dotenv/config';
import hotspotRoutes from './routes/hotspot.routes';
import { startHotspotJob } from './jobs/hotspot.job';

const app = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(express.json());

// Routes
// All hotspot routes will be prefixed with /api/v1/hotspots
app.use('/api/v1/hotspots', hotspotRoutes);

app.get('/health', (req, res) => {
  res.status(200).send('Hotspot service is healthy');
});

// Start the server
app.listen(port, () => {
  console.log(`Hotspot service listening on http://localhost:${port}`);
  
  // IMPORTANT: Start the background job
  startHotspotJob();
});