import { lookup } from 'mime-types';
import * as fs from 'fs/promises';
import Koa from 'koa';

/* Super simple static file middleware */

export function statics(path: string, {index}:{index?:string} = {}){
  return async function statics(ctx: Koa.Context){
    let target = path+ctx.request.path ;
    if ((await fs.stat(target)).isDirectory())
      target += "/"+index ;
    return {
      body: await fs.readFile(target),
      type: lookup(ctx.request.path) || "application/octet-stream"
    }
  }
}

