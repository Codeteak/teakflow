import { Router } from 'express';
import { requireAuth } from '../middlewares/auth/index';
import { csv, createShops, dashboard, day, editShop, payments, removeShop, saveDay, shops, shopsTemplate, summaryCsv, updatePayment } from '../controllers/sales/index';

export const salesRouter = Router();

salesRouter.use(requireAuth);
salesRouter.get('/shops/template.csv', shopsTemplate);
salesRouter.get('/shops', shops);
salesRouter.post('/shops', createShops);
salesRouter.patch('/shops/:shopId', editShop);
salesRouter.delete('/shops/:shopId', removeShop);
salesRouter.get('/day', day);
salesRouter.put('/day', saveDay);
salesRouter.get('/dashboard', dashboard);
salesRouter.get('/export.csv', csv);
salesRouter.get('/summary.csv', summaryCsv);
salesRouter.get('/payments', payments);
salesRouter.patch('/payments', updatePayment);
