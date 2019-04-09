const { promisify, static } = require('./lib/helpers');

const body = require('koa-json-body')
const csv = require('csv-parse/lib/sync');

const config = require('./config.json');
const vpnCmd = require('./lib/vpncmd');
const { route, asJson } = require('./lib/router');
const notConnected = new Error("No server connection established") ;

const app = new (require('koa'))();

const fmt = {
  text: x => x.toString(),
  csv: x => x && csv(x,{
   columns: true,
   skip_empty_lines: true
  })
} ;

let server ;

app.use(body({ limit: '32kb', strict: 'false' }));

app.use(route({
  async 'vpn/connect'(...args) {
    if (server) {
      // TODO: disconnect current service
    }
    server = vpnCmd(Object.assign({}, config, this.request.body));
    return asJson(await server(fmt.csv,'HubList')) ;
  },
  'vpn/Hub/([a-zA-Z]+)'(hub) {
    if (!server)
      throw notConnected ;
    return asJson(server(fmt.text,'Hub',hub))
  },
  'vpn/([a-zA-Z]+)'(command) {
    if (!server)
      throw notConnected ;
    return asJson(server(fmt.csv,command))
  },
  'vpn/([a-zA-Z]+)/(.+)'(command,session) {
    if (!server)
      throw notConnected ;
    return asJson(server(fmt.csv,command,session))
  },
  '.*':static('./www',{index:'index.html'})
})) ;

const https = require('https');
const fs = require('fs');
https.createServer({
  key: fs.readFileSync(config.SSLcerts+'/server.key'),
  cert: fs.readFileSync(config.SSLcerts+'/server.cert')
},app.callback()).listen(config.port);
