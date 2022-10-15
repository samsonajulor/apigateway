import express from 'express';
import helmet from 'helmet';
const app = express();
import fs from 'fs';
import path from 'path';
import routes from './routes';

const PORT = 3000;
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, './routes/registry.json'), 'utf-8'));

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(helmet());

const auth = (req: any, res: any, next: any) => {
  const url = req.protocol + '://' + req.hostname + PORT + req.path;
  const authString = Buffer.from(req.headers.authorization, 'base64').toString('utf8');
  const authParts = authString.split(':');
  const username = authParts[0];
  const password = authParts[1];
  console.log(username + ' | ' + password);
  const user = registry.auth.users[username];
  if (user) {
    if (user.username === username && user.password === password) {
      next();
    } else {
      res.send({ authenticated: false, path: url, message: 'Authentication Unsuccessful: Incorrect password.' });
    }
  } else {
    res.send({ authenticated: false, path: url, message: 'Authentication Unsuccessful: User ' + username + ' does not exist.' });
  }
};

app.get('/ui', (req: any, res: any) => {
  res.render('index', { services: registry.services });
});
app.use(auth);
app.use('/', routes);

app.listen(PORT, () => {
  console.log('Gateway has started on port ' + PORT);
});
