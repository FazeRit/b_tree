import express from 'express';
import {body} from 'express-validator';

import TreeController from '../controller/tree.controller';

const router = express.Router();

router.get('/', TreeController.getData);
router.post('/add',
    [
        body('key')
        .isInt({min: 0, max: 10000})
        .withMessage('Key is required and should be an integer between 0 and 10000'),
        body('value')
        .isString()
        .isLength({min: 1, max: 100})
        .withMessage('Value is required')
    ]
    ,TreeController.addRecord);
router.delete('/delete', 
    [
        body('key')
        .isInt({min: 0, max: 10000})
        .withMessage('Key is required and should be an integer between 0 and 10000'),
    ]
    ,TreeController.deleteRecord);
    router.put('/edit', 
        [
            body('key')
                .isInt({ min: 0, max: 10000 })
                .withMessage('Key is required and should be an integer between 0 and 10000'),
            body('newValue')
                .isString()
                .isLength({ min: 1, max: 100 })
                .withMessage('New value is required and should be a valid string')
        ], 
        TreeController.editRecord
    );
router.post('/search', 
    [
        body('key')
        .isInt({min: 0, max: 10000})
        .withMessage('Key is required and should be an integer between 0 and 10000'),
    ]
    ,TreeController.searchRecord);

router.post('/add-bulk', TreeController.addBulkKeys);
export { router };
