import { Router } from 'express';
import { deliverService } from './deliver.service';

const router = Router();

router.get('/alerts', async (req, res, next) => {
  try {
    const filters = typeof req.query.ruleCode === 'string' ? { ruleCode: req.query.ruleCode } : {};
    const alerts = await deliverService.listAlerts(filters);
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.get('/alerts/:id', async (req, res, next) => {
  try {
    const alert = await deliverService.getAlertById(req.params.id);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

export const deliverRouter = router;
