function route(paths){
  return async function (ctx,next) {
    if (ctx.request.path.indexOf('..')>=0)
      return ctx.throw(401) ;

    for (let path of Object.keys(paths)) {
      let m ;
      if (m = ctx.request.path.match(new RegExp('^/'+path+'$'))) {
        try {
          let result = await paths[path].call(ctx,...m.slice(1)) ;
          return Object.assign(ctx, result);
        } catch (ex) {
          return ctx.throw(500, ex ? ex.message : "Error", {expose: true});
        }
      }
    }

    return ctx.throw(404) ;
  }
}

async function asJson(data){
  data = await data ;
  return {
    body: JSON.stringify(data),
    type:'application/json'
  }
}

async function asText(data){
  data = await data ;
  return {
    body: data.toString(),
    type:'text/plain'
  }
}

module.exports = { route, asJson, asText }
