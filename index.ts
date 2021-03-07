import type { Formatter, ConfigOptions } from './types';

import { statics } from './lib/helpers';
import * as https from 'https'
import * as fs from 'fs'
import csv from 'csv-parse/lib/sync'
import vpnCmd from './lib/vpncmd';
import Koa from 'koa';
import { route, asJson } from './lib/router';

console.log("SoftEtherWeb starting...");
const config = require('./config.json') as ConfigOptions;

const body:((opts:{
  fallback?: boolean | string,
  limit?: string,
  strict?: boolean | string
}) => Koa.Middleware) = require('koa-json-body');

const notConnected = new Error("No server connection established") ;
const app = new Koa();


const fmt : { [format: string]: Formatter} = {
  text: x => x.toString(),
  csv: x => x && csv(x,{
   columns: true,
   skip_empty_lines: true
 })
} ;

let server = new Map<string, ReturnType<typeof vpnCmd>>();
function getVpn(ctx: Koa.Context) {
  let vpn = server.get(ctx.cookies.get("sevpn"));
  if (!vpn)
    throw notConnected ;
  return vpn;
}

app.use(body({ limit: '32kb', strict: 'false' }));

app.use(route({
  async 'vpn/isConnected'(ctx) {
    let id = ctx.cookies.get("sevpn") ;
    return asJson({connected:!!server.get(id)});
  },
  async 'vpn/close'(ctx) {
    let id = ctx.cookies.get("sevpn") ;
    if (server.get(id)) {
      server.get(id).close() ;
      server.delete(id) ;
    }
    ctx.cookies.set("sevpn",'',{ expires: new Date('1980-01-01'), secure: true, overwrite: true}) ;
    return asJson({ok:1}) ;
  },
  async 'vpn/connect'(ctx) {
    let id = ctx.cookies.get("sevpn") ;
    if (server.get(id)) {
      server.get(id).close() ;
    }
    id = Date.now().toString(36)+(Math.random()).toString(36);
    ctx.cookies.set("sevpn",id,{ secure: true, httpOnly: true, overwrite: true}) ;
    server.set(id, vpnCmd(Object.assign({}, config, ctx.request.body)));
    return asJson(await server.get(id)(fmt.csv,'HubList')) ;
  },
  'vpn/Hub/([a-zA-Z]+)'(ctx, hub) {
    const vpn = getVpn(ctx);
    return asJson(vpn(fmt.text,'Hub',hub))
  },
  'vpn/([a-zA-Z]+)'(ctx, command) {
    const vpn = getVpn(ctx);
    return asJson(vpn(fmt.csv,command))
  },
  'vpn/([a-zA-Z]+)/(.+)'(ctx, command,session) {
    const vpn = getVpn(ctx);
    return asJson(vpn(fmt.csv,command,session))
  },
  '.*':statics('./www',{index:'index.html'})
})) ;

https.createServer({
  key: fs.readFileSync(config.SSLcerts+'/server.key'),
  cert: fs.readFileSync(config.SSLcerts+'/server.cert')
},app.callback()).listen(config.port,() => console.log("SoftEtherWeb listening on https port "+config.port));
