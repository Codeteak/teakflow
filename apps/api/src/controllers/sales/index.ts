import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middlewares/errorHandler/index';
import { assertCanOpenSales } from '../../services/sales/access';
import {
  getSalesDay,
  salesCsv,
  salesDashboard,
  salesSummaryCsv,
  saveSalesDay,
} from '../../services/sales/day';
import { listPayments, patchPayment } from '../../services/sales/payments';
import {
  listDirectory,
  shopTemplateCsv,
  upsertShops,
  upsertShopsFromCsv,
  updateShop,
  deleteShop,
} from '../../services/sales/shops';
import { collectionPeriod } from '@teakflow/shared';
import { getCompanySettings } from '../../services/settings/index';

function requireUser(req: Request) {
  if (!req.userId || !req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  return req.user;
}

export async function shops(req: Request, res: Response, next: NextFunction) {
  try {
    assertCanOpenSales(requireUser(req));
    res.json({ data: await listDirectory() });
  } catch (error) {
    next(error);
  }
}

export async function day(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await getSalesDay(requireUser(req)) });
  } catch (error) {
    next(error);
  }
}

export async function saveDay(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await saveSalesDay(requireUser(req), req.body);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function createShops(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    const confirm = req.body?.confirm === true;
    const data = csv.trim()
      ? await upsertShopsFromCsv(user, csv, confirm)
      : await upsertShops(user, { ...req.body, confirm: req.body?.confirm !== false });
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function editShop(req: Request, res: Response, next: NextFunction) {
  try {
    const shopId = typeof req.params.shopId === 'string' ? req.params.shopId : '';
    res.json({ data: await updateShop(requireUser(req), shopId, req.body) });
  } catch (error) {
    next(error);
  }
}

export async function removeShop(req: Request, res: Response, next: NextFunction) {
  try {
    const shopId = typeof req.params.shopId === 'string' ? req.params.shopId : '';
    res.json({ data: await deleteShop(requireUser(req), shopId) });
  } catch (error) {
    next(error);
  }
}

export async function shopsTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    assertCanOpenSales(requireUser(req));
    const body = shopTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="teakflow-shops-example.csv"',
    );
    res.send(body);
  } catch (error) {
    next(error);
  }
}

export async function dashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const salesmanId =
      typeof req.query.salesmanId === 'string' ? req.query.salesmanId : undefined;
    const settings = await getCompanySettings();
    const period = collectionPeriod(new Date(), settings.timezone);
    const data = await salesDashboard(requireUser(req), from, to, salesmanId);
    data.collectionMonth = period.tab;
    data.collectionYear = period.year;
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function csv(req: Request, res: Response, next: NextFunction) {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const salesmanId =
      typeof req.query.salesmanId === 'string' ? req.query.salesmanId : undefined;
    const body = await salesCsv(requireUser(req), from, to, salesmanId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-daily.csv"');
    res.send(body);
  } catch (error) {
    next(error);
  }
}

export async function summaryCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const salesmanId =
      typeof req.query.salesmanId === 'string' ? req.query.salesmanId : undefined;
    const body = await salesSummaryCsv(requireUser(req), from, to, salesmanId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="shop-summary.csv"');
    res.send(body);
  } catch (error) {
    next(error);
  }
}

export async function payments(req: Request, res: Response, next: NextFunction) {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const year = typeof req.query.year === 'string' ? Number(req.query.year) : undefined;
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    res.json({
      data: await listPayments(requireUser(req), month, year, new Date(), { refresh }),
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await patchPayment(requireUser(req), req.body) });
  } catch (error) {
    next(error);
  }
}
