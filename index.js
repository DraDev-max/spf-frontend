import crypto from 'node:crypto';
import express from 'express';
import session from 'express-session';
import rutas from './app/routes/routes.sport.js';
import { ensureCsrfToken } from './app/middleware/csrf.middleware.js';

const app = express();
const PORT = 4000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

app.set('view engine', 'ejs');
app.set('views', './views');
app.set('trust proxy', 1);

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

app.use(ensureCsrfToken);
app.use('/', rutas);

app.listen(PORT, () => {
  console.log(`Frontend running on http://localhost:${PORT}`);
  console.log('Make sure that the backend is running on port 3000.');
});
