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

let server = {};

app.use(body({ limit: '32kb', strict: 'false' }));

app.use(route({
  async 'vpn/isConnected'() {
    let id = this.cookies.get("sevpn") ;
    return asJson({connected:!!server[id]});
  },
  async 'vpn/close'() {
    let id = this.cookies.get("sevpn") ;
    if (server[id]) {
      server[id].close() ;
      delete server[id] ;
    }
    this.cookies.set("sevpn",'',{ expires: new Date('1980-01-01'), secure: true, overwrite: true}) ;
    return asJson({ok:1}) ;
  },
  async 'vpn/connect'() {
    let id = this.cookies.get("sevpn") ;
    if (server[id]) {
      server[id].close() ;
    }
    id = Date.now().toString(36)+(Math.random()).toString(36);
    this.cookies.set("sevpn",id,{ secure: true, httpOnly: true, overwrite: true}) ;
    server[id] = vpnCmd(Object.assign({}, config, this.request.body));
    return asJson(await server[id](fmt.csv,'HubList')) ;
  },
  'vpn/Hub/([a-zA-Z]+)'(hub) {
    let vpn = server[this.cookies.get("sevpn")];
    if (!vpn)
      throw notConnected ;
    return asJson(vpn(fmt.text,'Hub',hub))
  },
  'vpn/([a-zA-Z]+)'(command) {
    let vpn = server[this.cookies.get("sevpn")];
    if (!vpn)
      throw notConnected ;
    return asJson(vpn(fmt.csv,command))
  },
  'vpn/([a-zA-Z]+)/(.+)'(command,session) {
    let vpn = server[this.cookies.get("sevpn")];
    if (!vpn)
      throw notConnected ;
    return asJson(vpn(fmt.csv,command,session))
  },
  '.*':static('./www',{index:'index.html'})
})) ;

const https = require('https');
const fs = require('fs');
https.createServer({
  key: fs.readFileSync(config.SSLcerts+'/server.key'),
  cert: fs.readFileSync(config.SSLcerts+'/server.cert')
},app.callback()).listen(config.port);
