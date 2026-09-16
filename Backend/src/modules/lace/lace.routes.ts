import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { laceCallAnalysisIngestionService } from './ingestion/call-analysis.ingestion';
import { laceAgentPerformanceIngestionService } from './ingestion/agent-performance.ingestion';
import { callAnalysisCanonicalService } from './canonical/call-analysis.canonical.service';

const router = Router();

// Manual sync triggers are for development/testing only; production ingestion
// runs on a schedule (see the ingestion services' .run() method).
const devOnly = (_req: Request, res: Response, next: NextFunction) => {
  if (env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'Integration test endpoints are only available in development mode' });
    return;
  }
  next();
};

router.use(devOnly);

router.post('/sync/call-analysis', async (_req, res, next) => {
  try {
    const result = await laceCallAnalysisIngestionService.run();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/sync/agent-performance', async (_req, res, next) => {
  try {
    const result = await laceAgentPerformanceIngestionService.run();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/sync/call-analysis-canonical', async (_req, res, next) => {
  try {
    const result = await callAnalysisCanonicalService.sync();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const laceRouter = router;
