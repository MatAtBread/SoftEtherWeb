/* promisify an object containing functions */
const util = require('util');

function promisify(obj) {
  let cache = {} ;
  switch (typeof obj) {
    case 'function':
    return util.promisify(obj) ;
    case 'object':
    return new Proxy(obj,{
      get(target, prop, receiver){
        if (prop in cache)
          return cache[prop];
        if (typeof target[prop] === 'function')
          return cache[prop] = util.promisify(target[prop]);
        return Reflect.get(...arguments);
      }
    });
  }
}

/* Super simple static file middleware */
const mime = require('mime-types');
const fs = promisify(require('fs'));

function static(path,{index} = {}){
  return async function static(){
    let target = path+this.request.path ;
    if ((await fs.stat(target)).isDirectory())
      target += "/"+index ;
    return {
      body: await fs.readFile(target),
      type: mime.lookup(this.request.path)
    }
  }
}

module.exports = {
  promisify,
  static
}
