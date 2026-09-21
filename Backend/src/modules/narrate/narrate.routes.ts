import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { narrateService } from './narrate.service';

const router = Router();

const devOnly = (_req: Request, res: Response, next: NextFunction) => {
  if (env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'Narrate test endpoints are only available in development mode' });
    return;
  }
  next();
};

router.use(devOnly);

router.post('/run', async (_req, res, next) => {
  try {
    const result = await narrateService.run();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const narrateRouter = router;
