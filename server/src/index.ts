import express from 'express';
import cors from 'cors';
import {router} from './routes/index';
import { ErrorMiddleware } from './middlewares/errorMiddleware';

const app = express();

app.use(express.json());
app.use(
    cors({
      origin: 'http://localhost:3000',  
      credentials: true,  
    })
  );
  

app.use('/api', router);
app.use(ErrorMiddleware as unknown as express.ErrorRequestHandler);

app.listen(4001, () => {
    console.log('Server is running on port 4001');
});