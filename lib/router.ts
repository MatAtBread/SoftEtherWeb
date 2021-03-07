import Koa from 'koa';

type RoutePaths = {
  [path: string]: (ctx: Koa.Context, ...args: string[]) => Promise<{ body: string | Buffer, type: string }>;
};

function route(paths: RoutePaths){
  return async function (ctx: Koa.Context,next: Koa.Next) {
    if (ctx.request.path.indexOf('..')>=0)
      return ctx.throw(401) ;

    for (let path of Object.keys(paths)) {
      let m ;
      if (m = ctx.request.path.match(new RegExp('^/'+path+'$'))) {
        try {
          const result = await paths[path](ctx,...m.slice(1)) ;
          return Object.assign(ctx, result);
        } catch (ex) {
          if (ex.code === 'ENOENT')
            return ctx.throw(404, "Not found", {expose: true});
          return ctx.throw(500, ex ? ex.message : "Error", {expose: true});
        }
      }
    }

    return ctx.throw(404) ;
  }
}

async function asJson<T>(data: T | PromiseLike<T>){
  data = await data ;
  return {
    body: JSON.stringify(data),
    type:'application/json'
  }
}

async function asText<T>(data: T | PromiseLike<T>){
  data = await data ;
  return {
    body: data.toString(),
    type:'text/plain'
  }
}

export { route, asJson, asText }
