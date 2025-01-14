import express from 'express';
const router = express.Router();
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import loadbalancer from '../util/loadbalancer';

const registry = JSON.parse(fs.readFileSync(path.join(__dirname, './registry.json'), 'utf-8'));

router.post('/enable/:apiName', (req, res) => {
  const apiName = req.params.apiName;
  const requestBody = req.body;
  const instances = registry.services[apiName].instances;
  const index = instances.findIndex((srv: any) => {
    return srv.url === requestBody.url;
  });
  if (index == -1) {
    res.send({ status: 'error', message: "Could not find '" + requestBody.url + "' for service '" + apiName + "'" });
  } else {
    instances[index].enabled = requestBody.enabled;
    fs.writeFile('./routes/registry.json', JSON.stringify(registry), (error) => {
      if (error) {
        res.send("Could not enable/disable '" + requestBody.url + "' for service '" + apiName + ":'\n" + error);
      } else {
        res.send("Successfully enabled/disabled '" + requestBody.url + "' for service '" + apiName + "'\n");
      }
    });
  }
});

router.all('/:apiName/:path', (req: any, res: any) => {
  const service = registry.services[req.params.apiName];
  if (service) {
    if (!service.loadBalanceStrategy) {
      service.loadBalanceStrategy = 'ROUND_ROBIN';
      fs.writeFile('./routes/registry.json', JSON.stringify(registry), (error) => {
        if (error) {
          res.send("Couldn't write load balance strategy" + error);
        }
      });
    }

    const newIndex = loadbalancer[service.loadBalanceStrategy](service);
    const url = service.instances[newIndex].url;
    console.log(url);
    axios({
      method: req.method,
      url: url + req.params.path,
      headers: req.headers,
      data: req.body,
    })
      .then((response) => {
        res.send(response.data);
      })
      .catch((error) => {
        res.send('');
      });
  } else {
    res.send("API Name doesn't exist");
  }
});

router.post('/register', (req, res) => {
  const registrationInfo = req.body;
  registrationInfo.url = registrationInfo.protocol + '://' + registrationInfo.host + ':' + registrationInfo.port + '/';

  if (apiAlreadyExists(registrationInfo)) {
    res.send("Configuration already exists for '" + registrationInfo.apiName + "' at '" + registrationInfo.url + "'");
  } else {
    registry.services[registrationInfo.apiName].instances.push({ ...registrationInfo });
    fs.writeFile('./routes/registry.json', JSON.stringify(registry), (error) => {
      if (error) {
        res.send("Could not register '" + registrationInfo.apiName + "'\n" + error);
      } else {
        res.send("Successfully registered '" + registrationInfo.apiName + "'");
      }
    });
  }
});

router.post('/unregister', (req, res) => {
  const registrationInfo = req.body;

  if (apiAlreadyExists(registrationInfo)) {
    const index = registry.services[registrationInfo.apiName].instances.findIndex((instance: { url: any; }) => {
      return registrationInfo.url === instance.url;
    });
    registry.services[registrationInfo.apiName].instances.splice(index, 1);
    fs.writeFile('./routes/registry.json', JSON.stringify(registry), (error) => {
      if (error) {
        res.send("Could not unregister '" + registrationInfo.apiName + "'\n" + error);
      } else {
        res.send("Successfully unregistered '" + registrationInfo.apiName + "'");
      }
    });
  } else {
    res.send("Configuration does not exist for '" + registrationInfo.apiName + "' at '" + registrationInfo.url + "'");
  }
});

const apiAlreadyExists = (registrationInfo: { apiName: string | number; url: any }) => {
  let exists = false;

  registry.services[registrationInfo.apiName].instances.forEach((instance: { url: any }) => {
    if (instance.url === registrationInfo.url) {
      exists = true;
      return;
    }
  });

  return exists;
};

export default router;
