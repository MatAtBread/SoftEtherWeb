import * as observable from './observers.js';

var construct = 'constructed' ;
var exports = {} ;
/* tag */
exports.tag = function tag(obj,tags,tagPrototypes){
    // Map an object by key
    function map(o,fn){
        var r = {} ;
        Object.keys(o).forEach(k => r[k] = fn.apply(o,[k,o])) ;
        return r ;
    }

    // Check is a value is thenable (i.e. a Promise)
    function isThenable(x) {
        return x!==null && x!==undefined && typeof x.then==='function'
    }

    // Avoid v8 deopt
    function argsAsArray(a,n) {
        n = n || 0 ;
        var i = 0, r = new Array(a.length-n) ;
        while (n<a.length)
            r[i++] = a[n++] ;
        return r ;
    }

    /** Routines to assign properties to an element: deepAssign() and assignProps() **/
    function deepAssign(d,s) {
        if (!s || typeof s !=='object') return d ;
        Object.keys(s).forEach(function(k){
            try {
                var desc = Object.getOwnPropertyDescriptor(s,k) ;
                if (!desc) {
                    console.warn("Illegal key ",k," in ",s)
                } else {
                    if ('value' in desc) {
                        // This has a real value, which might be an object
                        var v = desc.value ;
                        if (typeof v==='object' && k[0]!=='@') {
                            if (!(k in d)) {
                                Object.defineProperty(d,k,desc) ;
                            } else {
                                if (v instanceof Node) {
                                    console.warn("Having DOM Nodes as properties of other DOM Nodes is a bad idea as it makes the DOM tree into a cyclic graph. You should reference nodes by ID or as a child",k,v) ;
                                    d[k] = v ;
                                } else {
                                    // Note - if we're copying to ourself, we're decoupling
                                    // common object references, so we need a clean object to
                                    // assign into
                                    if (d[k] === v)
                                        d[k] = {} ;
                                    deepAssign(d[k],v) ;
                                }
                            }
                        } else {
                            d[k] = s[k] ;
                        }
                    } else {
                        // Copy the definition of the getter/setter
                        Object.defineProperty(d,k,desc) ;
                    }
                }
            } catch (ex) {
                console.warn("deepAssign",k,s[k],ex,ex.stack) ;
                throw ex ;
            }
        }) ;
        return d ;
    }

    function assignProps(e,props) {
        // Copy (and remove HTML ATTRIBUTES)
        var calls = [] ;
        Object.keys(props).forEach(function(k){
            if (k[0]==='@') {
                calls.push({fn:k.slice(1),args:props[k]}) ;
                delete props[k] ;
            }
        }) ;
        // Copy prop hierarchy onto the element
        deepAssign(e,props) ;

        // Apply subfunctions
        calls.forEach(function(call){
            e[call.fn].apply(e,Array.isArray(call.args)?call.args:call.args===undefined?[]:[call.args]) ;
        }) ;
    }

    /* Logic to "deafen" dynamic elements. Specifically, this refers to the process of unsubscribing event listeners when:
     *
     * 1) They (or a parent) are removed from the DOM (done by a MutationObserver)
     * 2) They (or a parent) are never added to the DOM (because a parent was replaced before it was added to the DOM)
     *
     * The logic is centralised in the 'deafener' object with add() and remove() methods. You 'add' an element together
     * with a routine that unsubscribes, and 'remove' an element that calls the unsubscribe (once and once only)
     */

    var deafeners = {
        add(elt,subscription){
            var prev = this.m.get(elt) ;
            if (!document.body.contains(elt)) {
                console.warn("Added non-DOM element",elt,prev,subscription) ;
                subscription.unsubscribe() ;
                return ;
            }
            if (prev){
                console.warn("Attempt to re-deafen element",elt,subscription,prev) ;
                prev.unsubscribe() ;
            }
            this.m.set(elt,subscription) ;
        },
        remove(elt){
            var sub  = this.m.get(elt) ;
            if (sub) {
                sub.unsubscribe() ;
            }
            this.m.delete(elt) ;
        },
        m:new WeakMap()
    } ;
    var regens = new WeakMap() ;

    new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            var i,j ;
            if (m.type==='childList') {
                for (i=0; i<m.addedNodes.length; i++) {
                    if (m.addedNodes[i].getElementsByTagName) {
                        var check = m.addedNodes[i].getElementsByTagName("DOMPlaceHolder") ;
                        for (j = 0; j<=check.length; j++) {
                            var e = (j == check.length) ? m.addedNodes[i] : check[j] ;
//if (e.hasClass && e.hasClass("Chart")) console.log("add ",e) ;
                            var deference ;
                            if (deference = regens.get(e)) {
                                defer(deference) ;
                            }
                        }
                    }
                }

                for (i=0; i<m.removedNodes.length; i++) {
                    if (m.removedNodes[i].getElementsByTagName) {
                        var check = m.removedNodes[i].getElementsByTagName("*") ;
                        for (j = 0; j<=check.length; j++) {
                            var e = (j == check.length) ? m.removedNodes[i] : check[j] ;
//if (e.hasClass && e.hasClass("Chart")) console.log("remove ",e) ;
                            deafeners.remove(e) ;
                        }
                    }
                }
            }
        });
    }).observe(document.body, {subtree:true, childList:true});

    const deferAttempts = 10;
    var deferredFunctions = [] ;
    function defer(what) {
        deferredFunctions.push(what) ;
        if (deferredFunctions.length<2) {
            window.requestAnimationFrame(()=>{
                while (deferredFunctions.length) {
                    const what = deferredFunctions.shift();
                    if (what.count > 10) {
                        what.err('Too many deferral attempts') ;
                    } else {
                        what.count = (what.count || 0) + 1;
                        what.fn();
                    }
                }
            }) ;
        }
    }

    var classPrototypes = {
        extended:extended,
        augment:augmentTag
    };

    tagPrototypes = tagPrototypes || {} ;
    tagPrototypes.replacedWith = function replacedWith(dest) {
        var ev = new Event('replacedWith') ;
        ev.movedTo = dest ;
        this.dispatchEvent(ev) ;
    };
    tagPrototypes.addClass = function addClass(cl) {
        if (!this.classList.contains(cl))
            this.classList.add(cl) ;
    };
    tagPrototypes.removeClass = function removeClass(cl) {
        this.classList.remove(cl) ;
    };
    tagPrototypes.hasClass = function hasClass(cl) {
        return this.classList.contains(cl) ;
    };
    tagPrototypes.appender = function(before){
        return appender(this,before) ;
    };
    tagPrototypes.replaceChildren = function(){
    		this.remove(this.childNodes) ;
    		this.append.apply(this,arguments) ;
    };
    tagPrototypes.replace = function replace() {
        var repl = argsAsArray(arguments) ;
        if (!this.parentElement || !this.parentElement.appender)
            return repl ;
        var r = this.parentElement.appender(this)(repl) ;
        if (r && r.indexOf(this)<0)
            this.parentNode.removeChild(this) ;
        else
            console.log("SELF REPLACEMENT (1)",this) ;
        return r ;
    };
    Object.defineProperty(tagPrototypes,"ids",{
        get:function(){
            return exports.getElementIdMap(this,Object.create(this.defaults||null));
        },
        set:function(v){
            throw new Error('Cannot set ids on '+this.valueOf()) ;
        },
        enumerable:true,
        writeable:true,
        configurable:true
    }) ;
    tagPrototypes.remove = function() {
        var t = this ;
        argsAsArray(arguments).map(function x(e){
            if (e) {
                if (Array.isArray(e))
                    return e.map(x) ;
                if (e instanceof Node && t.contains(e))
                    return tagPrototypes.replace.call(e) ;
                var maybeCollection = [].slice.call(e) ;
                if (maybeCollection)
                    return maybeCollection.map(x) ;
                // e is not a node or a collection - just ignore it?
                console.warn('Non-node in pojs.remove()',e) ;
            }
        }) ;
    };
    tagPrototypes.append = function append(){
        return this.appender()(argsAsArray(arguments));
    };
    tagPrototypes.insertAt = function insertAt(at){
        return this.appender(at||this.firstChild)(argsAsArray(arguments,1));
    };

    var DOMPlaceHolder = createTag('DOMPlaceHolder').extended({
        [construct](){this.append("\u22EF")},
        prototype:{style:{color:'#999',textAlign:'center'}}
    }) ;
    var DyamicElementError = createTag('DyamicElementError').extended({prototype:{style:{color:'#c44'}}}) ;
    var DOMPromiseContainer = createTag('DOMPromiseContainer') ;

    var dynamicElements = new WeakMap() ;

    function replaceElementArray(a,repl) {
        if (repl.every(r => r===undefined))
            repl = [DOMPlaceHolder()] ;

        var e  = dynamicElements.get(a),
            replaced = tagPrototypes.replace.apply(a,repl) ;

        if (e) {
            var newIDs = replaced.reduce((a,d)=>((d.id && (a[d.id] = d)),a),{}) ;
            e.forEach(d => {
                d.parentNode && d.parentNode.removeChild(d) ;
                if (d.id)
                    d.replacedWith(newIDs[d.id]) ;
            }) ;
        }

        var result = replaced.shift() ;

        if (replaced.length)
            dynamicElements.set(result,replaced) ;

        a.replacedWith && a.replacedWith(result) ;
        return result ;
    }

    function createDynamicElement(onWhat) {
        // Create a placeholder for the node
        var dynamicElt = DOMPlaceHolder() ;
        regens.set(dynamicElt, {fn:regenerateNode,err:deferError}) ;
        return dynamicElt ;

        function deferError(err){
            var errMsg = err.toString()+"\n"+onWhat.toString() ;
            console.warn(errMsg) ;
            dynamicElt = dynamicElt.replace(DyamicElementError(err.toString()))[0];
        }

        async function regenerateNode(){
            if (!dynamicElt.parentNode) {
                console.warn("Orphan nodes cannot regenerate, and maybe awaiting deafening",dynamicElt) ;
                return ;
            }

            try {
                var self = onWhat() ;
                if (isThenable(self))
                    self = await self ;

            } catch (ex) {
                if (ex===eventSource.regenerate) {
//console.log("Deferring node regeneration:",dynamicElt) ;
                    var deference = regens.get(dynamicElt) ;
                    if (!deference)
                        console.warn("Missing defernce",dynamicElt);
                    else
                        defer(deference) ;
                    return ;
                }
                self = DyamicElementError(ex.toString()) ;
            }

            if (typeof self.subscribe === 'function') {
                if (self.result===undefined || self.result===null)
                    return ;
                // A function that generated an "eventSource" containing an array of nodes (self.result, passed to .replace/.append)
                // and an event to listen for (self.src)
                deafeners.remove(dynamicElt) ;
                dynamicElt = replaceElementArray(dynamicElt,self.result) ;
                self.result = undefined ;
                deafeners.add(dynamicElt,self.subscribe({
                    next:updateDynamicElement
                })) ;
            } else {
                // Just a function that generated an element, not an event-driven element
                dynamicElt = dynamicElt.replace(self)[0] ;
            }
        }

        async function updateDynamicElement(ev){
            deafeners.remove(dynamicElt) ;

            var self = onWhat(ev) ;

            if (isThenable(self))
                self = await self ;

            dynamicElt = replaceElementArray(dynamicElt,self.result) ;
            self.result = undefined ;

            deafeners.add(dynamicElt,self.subscribe({
                next:updateDynamicElement
            })) ;
        }
    }

    function appender(e,before) {
        if (before===undefined)
            before = null ;
        var appended = [] ;
        return function children(c) {
            if (c===undefined || c===null)
                return appended ;
            if (isThenable(c)) {
                var g = DOMPromiseContainer() ;
                e.insertBefore(g,before) ;
                appended.push(g) ;
                c.then(r => {
                    g.replacedWith(g.replace(r)[0]) ;
                },x => {
                    console.warn(x) ;
                    g.append(DyamicElementError(x.toString())) ;
                }) ;
                return appended ;
            }
            if (c instanceof Function) {
                var g = createDynamicElement(c) ;
                e.insertBefore(g,before) ;
                appended.push(g) ;
                return appended ;
            }
            if (Array.isArray(c)) {
                c.map(children) ;
                return appended ;
            }
            if (c instanceof NodeList || c instanceof HTMLCollection) {
                [].slice.call(c).map(children) ;
                return appended ;
            }
            if (c instanceof Node) {
                e.insertBefore(c,before) ;
                appended.push(c) ;
                return appended ;
            }
            var t = document.createTextNode(c.toString()) ;
            e.insertBefore(t,before) ;
            appended.push(t) ;
            return appended ;
        }
    }

    // 'Instance' data associated with an extended element
    function Instance() {}
    Instance.prototype.destroy = function () {
        var self = this ;
        Object.keys(self).forEach(k => delete self[k]) ;
    } ;

    // Extend a component class with create a new component class factory
    // var NewDiv = Div.extended({overrides}) ;
    // var eltNewDiv = NewDiv({attrs},...children) ;
    function extended(overrides,___templateChildren) {
        if (typeof overrides!=='function') {
            var attrs = overrides ;
            overrides = function() { return attrs } ;
        }

        var staticStyles ;
        /* "Statically" create any styles required by this widget */
        if (overrides && (staticStyles = overrides().styles)) {
            var style = document.createElement("STYLE") ;
            style.appendChild(document.createTextNode(staticStyles)) ;
            document.head.appendChild(style) ;
        }

        if (___templateChildren)
            console.error("Providing templateChildren for (tag).extended is no longer supported") ;
        var base = this ;

        var extendTag = function tagExtender(attrs, ___children) {
            var e, baseElement = overrides(new Instance()) ;
            var baseAttrs = deepAssign({prototype:deepAssign({},baseElement.prototype)},baseElement.prototype) ;
            if (attrs && typeof attrs==="object" && !Array.isArray(attrs) && !(attrs instanceof Node) && !isThenable(attrs)) {
                deepAssign(baseAttrs,baseAttrs) ;
                e = base.apply(null,[deepAssign(baseAttrs,attrs)].concat(argsAsArray(arguments,1))) ;
            } else {
                attrs = null ;
                e = base.apply(null,[baseAttrs].concat(argsAsArray(arguments))) ;
            }
//            e.extender = extendTag ;
            baseElement[construct] && baseElement[construct].call(e) ; // TODO: Pass attrs to constructed()
            return e ;
        }
        extendTag.super = base ; // Needed for augmentTag()
        extendTag.instanceOverride = overrides ;
        return deepAssign(extendTag,classPrototypes) ;
    }

    // Augment an existing element with the behaviours associated with a specific class
    // e.g 	Div.augment(anElement,{overrides})
    function augmentTag(e,overrides) {
        var props = {} ;
        var creators = [] ;

        // Augment with global tag prototypes
        deepAssign(props,tagPrototypes) ;
        creators.push(tagPrototypes[construct]) ;

        // Augment with element specific prototypes
        deepAssign(props,this.prototype) ;
        for (var c = this; c ; c = c.super) {
            creators.splice(1,0,c.prototype && c.prototype[construct], c.instanceOverride && c.instanceOverride({})[construct]) ;
        }

        if (this.instanceOverride) {
            var o = this.instanceOverride({}) ;
            deepAssign(props,o.prototype) ;
        }

        // Set attributes
        if (overrides) {
            deepAssign(props,overrides.prototype) ;
            creators.push(overrides[construct]) ;
        }

        delete props[construct] ;

        // Copy prop hierarchy onto the element
        deepAssign(e,props) ;

        // Call the oncreation stack
        creators.forEach(c=>c && c.call(e)) ; // TODO: Pass props to constructed()
        return e ;
    }

    function createTag(k){
        var bits = k.split("::") ;
        k = bits[0] ;
        obj[k] = function tagCreator(attrs,___children){
            var idx = 0 ;
            if (attrs && typeof attrs==="object" && !Array.isArray(attrs) && !(attrs instanceof Node) && !isThenable(attrs)) {
                idx = 1 ;
            }
            var props = {} ;
            var creators = [] ;

            // Augment with global tag prototypes
            deepAssign(props,tagPrototypes) ;
            creators.push(tagPrototypes[construct]) ;

            // Augment with element specific prototypes
            deepAssign(props,obj[k].prototype) ;
            creators.push(obj[k][construct]) ;

            // Set attributes
            if (idx) {
                deepAssign(props,attrs) ;
                creators.push(attrs[construct]) ;
            }

            delete props[construct] ;

            // Create element
            var e ;
            if (bits.length>1) {
                e = document.createElementNS(bits[1],k.toLowerCase()) ;
            } else {
                e = document.createElement(k) ;
            }

            assignProps(e,props) ;

            // Append any children
            e.appender()(argsAsArray(arguments,idx)) ;
            // Call the oncreation stack
            creators.forEach(function(c){c && c.call(e)}) ;
            return e ;
        };
        obj[k].valueOf = function(){ return "po.js::"+k } ;
        deepAssign(obj[k], classPrototypes) ;
        obj[k].createTagFor = k ;
        return obj[k] ;
    }

    var eventSource = { regenerate: {} } ;

    // Wrap a function result inside an Observable (in the field .result)
    obj.on = function on() {
      try {
        var obs = observable.fromArgumentList.apply(this,arguments);
        return function() {
          obs.result = argsAsArray(arguments) ;
          return obs ;
        }
      } catch (ex) {
        if (ex.NullObserver)
          throw eventSource.regenerate ;
        throw ex ;
      }
    };

    if (tags.urn) {
      tags.tags.split(",").forEach(function(tag){createTag(tag+"::"+tags.urn)}) ;
    } else {
      tags.split(",").forEach(createTag) ;
    }
    exports.tag.prototypes = tagPrototypes ;
    return obj;
} ;

exports.enableOnRemovedFromDOM = function enableOnRemovedFromDOM() {
    exports.enableOnRemovedFromDOM = function() {} ; // Only create the observer once
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            if (m.type==='childList') {
                [].slice.call(m.removedNodes).forEach(
                    removed => removed &&
                    removed.getElementsByTagName &&
                    [].slice.call(removed.getElementsByTagName("*")).concat([removed]).filter(elt=>!document.contains(elt)).forEach(
                        elt => {
                            elt.onRemovedFromDOM && elt.onRemovedFromDOM()
                        }
                    )) ;
            }
        });
    }).observe(document.body, {subtree:true, childList:true});
} ;

exports.getElementIdMap = function getElementIdMap(node,ids){
    node = node || document ;
    ids = ids || {} ;
    if (node.getElementsByTagName) {
        [].slice.call(node.getElementsByTagName("*")).forEach(function(elt){
            if (elt.id) {
                if (!ids[elt.id])
                    ids[elt.id] = elt ;
            }
        });
    }
    return ids ;
}

export default exports ;
