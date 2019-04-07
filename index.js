const { promisify, static } = require('./lib/helpers');

const app = new (require('koa'))();

const vpnCmd = require('./lib/vpncmd');
async function vpn(command,params){
  return {
    body: JSON.stringify(await vpnCmd(command,params)),
    type:'application/json'
  }
}


const paths = {
  '/(SessionList)':async (command) => vpn(command),
  '/(SessionGet|SessionDisconnect)/(.*)':async (command,session) => vpn(command,session),
  '.*':static('./www',{index:'index.html'})
};

app.use(async (ctx,next) =>{
  if (ctx.request.path.indexOf('..')>=0)
    return ctx.throw(401) ;

  for (let path of Object.keys(paths)) {
    let m ;
    if (m = ctx.request.path.match(new RegExp('^'+path))) {
      try {
        let result = await paths[path].call(ctx,...m.slice(1)) ;
        return Object.assign(ctx, result);
      } catch (ex) {
        return ctx.throw(500, ex ? ex.message : "Error", {expose: true});
      }
    }
  }

  return ctx.throw(404) ;
}) ;

app.listen(8001);
