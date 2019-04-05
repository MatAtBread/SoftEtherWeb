/* Utilities to support the Observable interface that abstracts things like Promises, EventSources and Streams into a general
 * event-delivering thing
 */

import { Observable as ObservableBase } from '../vendor/zen-observable.js';

export function Observable(){
    ObservableBase.apply(this,arguments) ;
}
Object.setPrototypeOf(Observable, ObservableBase) ; // For static methods
Observable.prototype = Object.create(ObservableBase.prototype) ;    // Instances inherit from ObservableBase
Observable.prototype.constructor = Observable ; // Fix-up constructor overwritten above

export function fromPromise(promise) {
    return new Observable(observer => {
        var pending = true ;
        promise.then(r => {
            if (pending) {
                observer.next(r) ;
                observer.complete() ;
            }
        },x => {
            if (pending) {
                observer.error(x) ;
            }
        }) ;
        return () => {
            pending = false ;
        };
    });
}

export function fromEventSource(source,eventName) {
    return new Observable(observer => {
        function handler(event) { observer.next(event) }

        function mover(event) {
            unlisten() ;
            source = event.movedTo ;
            if (source) {
                listen() ;
            } else {
                observer.complete() ;
            }
        }

        function listen() {
            source.addEventListener(eventName, handler, true);
            if (source.replacedWith)
                source.addEventListener('replacedWith',mover,true) ;
        }

        function unlisten() {
            source.removeEventListener(eventName, handler, true);
            if (source.replacedWith)
                source.removeEventListener('replacedWith', mover, true);
        }

        listen() ;
        return unlisten ;
    });
}

export function fromArgumentList() {
  var sources = [] ;
  if (arguments.length===0)
      throw new Error("fromArgumentList(...) requires a list of event sources") ;
  else if (arguments.length===1) {
      sources.push([arguments[0], 'change']) ;
  } else if (arguments.length===2 && typeof arguments[1]==='string') {
      sources.push([arguments[0], arguments[1]]) ;
  } else {
      for (var i=0; i<arguments.length; i++) {
          var s = arguments[i] ;
          var ev = arguments[i+1] ;
          if (typeof ev==="string") {
              sources.push([s,ev]) ;
              i += 1 ;
          } else {
              sources.push([s,'change']) ;
          }
      }
  }

  if (sources.some(s => !s || !s[0]))
    throw Object.assign(new Error("At least one observer is null or undefined"),{ NullObserver: true }) ;

  var obs = sources.map(s => from(s[0],s[1])) ;
  if (obs.length>1) {
      obs = merge(obs).rateLimit(150) ;
  } else {
      obs = obs[0].rateLimit(150) ;
  }
  return obs ;
}

export function from(obj,param) {
    if (!obj)
        throw new TypeError("Can't create observable from null/undefined") ;

    if (typeof obj.subscribe === "function")
        return obj ; // Already looks like an Observable

    if (typeof obj.then === "function")
        return fromPromise(obj) ;

    if (typeof obj.addEventListener === "function" && typeof obj.removeEventListener === "function")
        return fromEventSource(obj, param) ;

    return Observable.from(obj) ;
}

export function merge(sources) {
    return new Observable(observer => {
        var unsubs = sources.map(source => source.subscribe(event => observer.next(event))) ;
        return () => unsubs.forEach(unsub => unsub.unsubscribe()) ;
    });
}

Observable.prototype.replace = function replace(fn) {
  var source = this ;
  return new Observable(observer => {
      var unsub = source.subscribe(event => {
        fn.then(data => data && observer.next(data))
      }) ;
      return () => unsub.unsubscribe() ;
  });
}

Observable.prototype.delay = function delay(period,source) {
  source = source || this ;
  return new Observable(observer => {
      var unsub = source.subscribe(event => {
          var timeout = typeof period==='function' ? period(event):(period || 0);
          setTimeout(() => observer.next(event),timeout) ;
      }) ;
      return () => unsub.unsubscribe() ;
  });
}

Observable.prototype.rateLimit = function rateLimit(period,source) {
    source = source || this ;
    return new Observable(observer => {
        var tid ;
        var unsub = source.subscribe(event => {
            if (tid) clearTimeout(tid) ;
            tid = setTimeout(() => {
                tid = null ;
                observer.next(event)
            },period) ;
        }) ;
        return () => ((tid && clearTimeout(tid)), unsub.unsubscribe()) ;
    });
}

if (!Symbol.asyncIterator) {
    Symbol.asyncIterator = Symbol("asyncIterator");
}

function deferred() {
    var o = {} ;
    o.promise = new Promise(function(resolve,reject){
        o.resolve = resolve ;
        o.reject = reject ;
    }) ;
    return o ;
}

Object.defineProperty(Observable.prototype,Symbol.asyncIterator,{
    configurable:true,
    writable:true,
    value:function() {
        var p = deferred() ;

        var sub = this.subscribe({
            next(ev){
                var q = p ;
                p = deferred() ;
                q.resolve({value:ev,done:false}) ;
            },
            error(ex){
                var q = p ;
                p = null ;
                q.reject({value:ex,done:true}) ;
            },
            complete(){
                var q = p ;
                p = null ;
                q.resolve({done:true}) ;
            }
        }) ;

        return {
            next:function(){
                return p.promise ;
            }
        }
    }
});
