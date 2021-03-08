import * as https from 'https';
import * as fs from 'fs';

import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';

const config = JSON.parse(fs.readFileSync('./config.json').toString());

const serve = serveStatic("./www");

https.createServer({
  key: fs.readFileSync(config.SSLcerts+'/server.key'),
  cert: fs.readFileSync(config.SSLcerts+'/server.cert')
},
  (req, res) => { 
    const done = finalhandler(req, res) as (()=>void)    
    serve(req, res, done) 
})
.listen(config.port,() => console.log("SoftEtherWeb listening on https port "+config.port));

