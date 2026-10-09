import express from 'express';
import session from 'express-session';
import sessionFileStore from 'session-file-store';
import rutas from './app/routes/routes.sport.js';
import { ensureCsrfToken } from './app/middleware/csrf.middleware.js';

const app = express();
const PORT = 4000;
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be configured in production');
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'sport-family-local-session-secret';
const SESSION_MAX_AGE = 365 * 24 * 60 * 60 * 1000;
const FileStore = sessionFileStore(session);

app.set('view engine', 'ejs');
app.set('views', './views');
app.set('trust proxy', 1);

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    store: new FileStore({
      path: './.sessions',
      reapInterval: 60 * 60
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: SESSION_MAX_AGE,
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
