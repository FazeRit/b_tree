import prisma from '../db/db';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

import TreeService from '../services/tree.service';
import { ApiError } from '../errors/apiError';

export default class TreeController {
    static async addBulkKeys(req: Request, res: Response, next: NextFunction) {
        try {
            const { count = 10000 } = req.body;

            for (let i = 1; i <= count; i++) {
                const key = i;
                const value = `RandomValue_${Math.random().toString(36).substring(2, 15)}`;

                await TreeService.addKey(key, value);
            }


            res.status(201).json({ message: `${count} records added successfully!` });
        } catch (err) {
            next(err);
        }
    }

    static async getData(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await TreeService.fetchBTree(); 
            res.status(200).json({ data });
        } catch (err) {
            next(err);
        }
    }

    static async addRecord(req: Request, res: Response, next: NextFunction) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequestError('Error validating data', errors.array()));
            }

            const { key, value } = req.body;
            await TreeService.addKey(key, value);

            res.status(201).json({ message: 'Record added successfully!' });
        } catch (err) {
            next(err);
        }
    }

    static async deleteRecord(req: Request, res: Response, next: NextFunction) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequestError('Error validating data', errors.array()));
            }

            const { key } = req.body;
            await TreeService.deleteKey(key);

            res.status(200).json({ message: 'Record deleted successfully!' });
        } catch (err) {
            next(err);
        }
    }

    static async editRecord(req: Request, res: Response, next: NextFunction) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequestError('Error validating data', errors.array()));
            }
    
            const { key, newValue } = req.body;
    
            const { oldKey, value } = await TreeService.editKey(parseInt(key, 10), newValue);
    
            res.status(200).json({ message: `Record edited successfully: Key ${oldKey} updated to ${value}` });
        } catch (err) {
            next(err);
        }
    }

    static async searchRecord(req: Request, res: Response, next: NextFunction) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequestError('Validation failed', errors.array()));
            }
    
            const { key } = req.body; 
    
            const record = await TreeService.searchKeyInBTree(key);
    
            if (record) {
                res.status(200).json({
                    message: `Found key: ${record.key}, with value: ${record.value}. Comparisons made: ${record.comparisons}`
                });
            } else {
                res.status(404).json({ message: `Key ${key} not found in the tree.` });
            }
        } catch (err) {
            next(err);
        }
    }
}
