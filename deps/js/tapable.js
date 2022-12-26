import*as t from"util";var e,n,o={878:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onResult:e,onDone:n}){let o="";return o+=`var _results = new Array(${this.options.taps.length});\n`,o+="var _checkDone = function() {\n",o+="for(var i = 0; i < _results.length; i++) {\n",o+="var item = _results[i];\n",o+="if(item === undefined) return false;\n",o+="if(item.result !== undefined) {\n",o+=e("item.result"),o+="return true;\n",o+="}\n",o+="if(item.error) {\n",o+=t("item.error"),o+="return true;\n",o+="}\n",o+="}\n",o+="return false;\n",o+="}\n",o+=this.callTapsParallel({onError:(t,e,n,o)=>{let r="";return r+=`if(${t} < _results.length && ((_results.length = ${t+1}), (_results[${t}] = { error: ${e} }), _checkDone())) {\n`,r+=o(!0),r+="} else {\n",r+=n(),r+="}\n",r},onResult:(t,e,n,o)=>{let r="";return r+=`if(${t} < _results.length && (${e} !== undefined && (_results.length = ${t+1}), (_results[${t}] = { result: ${e} }), _checkDone())) {\n`,r+=o(!0),r+="} else {\n",r+=n(),r+="}\n",r},onTap:(t,e,n,o)=>{let r="";return t>0&&(r+=`if(${t} >= _results.length) {\n`,r+=n(),r+="} else {\n"),r+=e(),t>0&&(r+="}\n"),r},onDone:n}),o}},i=function(t){return s.setup(this,t),s.create(t)};function c(t=[],e){const n=new o(t,e);return n.constructor=c,n.compile=i,n._call=void 0,n.call=void 0,n}c.prototype=null,t.exports=c},854:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onDone:e}){return this.callTapsParallel({onError:(e,n,o,r)=>t(n)+r(!0),onDone:e})}},i=function(t){return s.setup(this,t),s.create(t)};function c(t=[],e){const n=new o(t,e);return n.constructor=c,n.compile=i,n._call=void 0,n.call=void 0,n}c.prototype=null,t.exports=c},189:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onResult:e,resultReturns:n,onDone:o}){return this.callTapsSeries({onError:(e,n,o,r)=>t(n)+r(!0),onResult:(t,n,o)=>`if(${n} !== undefined) {\n${e(n)}\n} else {\n${o()}}\n`,resultReturns:n,onDone:o})}},i=function(t){return s.setup(this,t),s.create(t)};function c(t=[],e){const n=new o(t,e);return n.constructor=c,n.compile=i,n._call=void 0,n.call=void 0,n}c.prototype=null,t.exports=c},745:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onDone:e}){return this.callTapsSeries({onError:(e,n,o,r)=>t(n)+r(!0),onDone:e})}},i=function(t){return s.setup(this,t),s.create(t)};function c(t=[],e){const n=new o(t,e);return n.constructor=c,n.compile=i,n._call=void 0,n.call=void 0,n}c.prototype=null,t.exports=c},644:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onDone:e}){return this.callTapsLooping({onError:(e,n,o,r)=>t(n)+r(!0),onDone:e})}},i=function(t){return s.setup(this,t),s.create(t)};function c(t=[],e){const n=new o(t,e);return n.constructor=c,n.compile=i,n._call=void 0,n.call=void 0,n}c.prototype=null,t.exports=c},787:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onResult:e,onDone:n}){return this.callTapsSeries({onError:(e,n,o,r)=>t(n)+r(!0),onResult:(t,e,n)=>{let o="";return o+=`if(${e} !== undefined) {\n`,o+=`${this._args[0]} = ${e};\n`,o+="}\n",o+=n(),o},onDone:()=>e(this._args[0])})}},i=function(t){return s.setup(this,t),s.create(t)};function c(t=[],e){if(t.length<1)throw new Error("Waterfall hooks must have at least one argument");const n=new o(t,e);return n.constructor=c,n.compile=i,n._call=void 0,n.call=void 0,n}c.prototype=null,t.exports=c},107:(t,e,n)=>{const o=n(871).deprecate((()=>{}),"Hook.context is deprecated and will be removed"),r=function(...t){return this.call=this._createCall("sync"),this.call(...t)},s=function(...t){return this.callAsync=this._createCall("async"),this.callAsync(...t)},i=function(...t){return this.promise=this._createCall("promise"),this.promise(...t)};class c{constructor(t=[],e){this._args=t,this.name=e,this.taps=[],this.interceptors=[],this._call=r,this.call=r,this._callAsync=s,this.callAsync=s,this._promise=i,this.promise=i,this._x=void 0,this.compile=this.compile,this.tap=this.tap,this.tapAsync=this.tapAsync,this.tapPromise=this.tapPromise}compile(t){throw new Error("Abstract: should be overridden")}_createCall(t){return this.compile({taps:this.taps,interceptors:this.interceptors,args:this._args,type:t})}_tap(t,e,n){if("string"==typeof e)e={name:e.trim()};else if("object"!=typeof e||null===e)throw new Error("Invalid tap options");if("string"!=typeof e.name||""===e.name)throw new Error("Missing name for tap");void 0!==e.context&&o(),e=Object.assign({type:t,fn:n},e),e=this._runRegisterInterceptors(e),this._insert(e)}tap(t,e){this._tap("sync",t,e)}tapAsync(t,e){this._tap("async",t,e)}tapPromise(t,e){this._tap("promise",t,e)}_runRegisterInterceptors(t){for(const e of this.interceptors)if(e.register){const n=e.register(t);void 0!==n&&(t=n)}return t}withOptions(t){const e=e=>Object.assign({},t,"string"==typeof e?{name:e}:e);return{name:this.name,tap:(t,n)=>this.tap(e(t),n),tapAsync:(t,n)=>this.tapAsync(e(t),n),tapPromise:(t,n)=>this.tapPromise(e(t),n),intercept:t=>this.intercept(t),isUsed:()=>this.isUsed(),withOptions:t=>this.withOptions(e(t))}}isUsed(){return this.taps.length>0||this.interceptors.length>0}intercept(t){if(this._resetCompilation(),this.interceptors.push(Object.assign({},t)),t.register)for(let e=0;e<this.taps.length;e++)this.taps[e]=t.register(this.taps[e])}_resetCompilation(){this.call=this._call,this.callAsync=this._callAsync,this.promise=this._promise}_insert(t){let e;this._resetCompilation(),"string"==typeof t.before?e=new Set([t.before]):Array.isArray(t.before)&&(e=new Set(t.before));let n=0;"number"==typeof t.stage&&(n=t.stage);let o=this.taps.length;for(;o>0;){o--;const t=this.taps[o];this.taps[o+1]=t;const r=t.stage||0;if(e){if(e.has(t.name)){e.delete(t.name);continue}if(e.size>0)continue}if(!(r>n)){o++;break}}this.taps[o]=t}}Object.setPrototypeOf(c.prototype,null),t.exports=c},255:t=>{t.exports=class{constructor(t){this.config=t,this.options=void 0,this._args=void 0}create(t){let e;switch(this.init(t),this.options.type){case"sync":e=new Function(this.args(),'"use strict";\n'+this.header()+this.contentWithInterceptors({onError:t=>`throw ${t};\n`,onResult:t=>`return ${t};\n`,resultReturns:!0,onDone:()=>"",rethrowIfPossible:!0}));break;case"async":e=new Function(this.args({after:"_callback"}),'"use strict";\n'+this.header()+this.contentWithInterceptors({onError:t=>`_callback(${t});\n`,onResult:t=>`_callback(null, ${t});\n`,onDone:()=>"_callback();\n"}));break;case"promise":let t=!1;const n=this.contentWithInterceptors({onError:e=>(t=!0,`_error(${e});\n`),onResult:t=>`_resolve(${t});\n`,onDone:()=>"_resolve();\n"});let o="";o+='"use strict";\n',o+=this.header(),o+="return new Promise((function(_resolve, _reject) {\n",t&&(o+="var _sync = true;\n",o+="function _error(_err) {\n",o+="if(_sync)\n",o+="_resolve(Promise.resolve().then((function() { throw _err; })));\n",o+="else\n",o+="_reject(_err);\n",o+="};\n"),o+=n,t&&(o+="_sync = false;\n"),o+="}));\n",e=new Function(this.args(),o)}return this.deinit(),e}setup(t,e){t._x=e.taps.map((t=>t.fn))}init(t){this.options=t,this._args=t.args.slice()}deinit(){this.options=void 0,this._args=void 0}contentWithInterceptors(t){if(this.options.interceptors.length>0){const e=t.onError,n=t.onResult,o=t.onDone;let r="";for(let t=0;t<this.options.interceptors.length;t++){const e=this.options.interceptors[t];e.call&&(r+=`${this.getInterceptor(t)}.call(${this.args({before:e.context?"_context":void 0})});\n`)}return r+=this.content(Object.assign(t,{onError:e&&(t=>{let n="";for(let e=0;e<this.options.interceptors.length;e++)this.options.interceptors[e].error&&(n+=`${this.getInterceptor(e)}.error(${t});\n`);return n+=e(t),n}),onResult:n&&(t=>{let e="";for(let n=0;n<this.options.interceptors.length;n++)this.options.interceptors[n].result&&(e+=`${this.getInterceptor(n)}.result(${t});\n`);return e+=n(t),e}),onDone:o&&(()=>{let t="";for(let e=0;e<this.options.interceptors.length;e++)this.options.interceptors[e].done&&(t+=`${this.getInterceptor(e)}.done();\n`);return t+=o(),t})})),r}return this.content(t)}header(){let t="";return this.needContext()?t+="var _context = {};\n":t+="var _context;\n",t+="var _x = this._x;\n",this.options.interceptors.length>0&&(t+="var _taps = this.taps;\n",t+="var _interceptors = this.interceptors;\n"),t}needContext(){for(const t of this.options.taps)if(t.context)return!0;return!1}callTap(t,{onError:e,onResult:n,onDone:o,rethrowIfPossible:r}){let s="",i=!1;for(let e=0;e<this.options.interceptors.length;e++){const n=this.options.interceptors[e];n.tap&&(i||(s+=`var _tap${t} = ${this.getTap(t)};\n`,i=!0),s+=`${this.getInterceptor(e)}.tap(${n.context?"_context, ":""}_tap${t});\n`)}s+=`var _fn${t} = ${this.getTapFn(t)};\n`;const c=this.options.taps[t];switch(c.type){case"sync":r||(s+=`var _hasError${t} = false;\n`,s+="try {\n"),s+=n?`var _result${t} = _fn${t}(${this.args({before:c.context?"_context":void 0})});\n`:`_fn${t}(${this.args({before:c.context?"_context":void 0})});\n`,r||(s+="} catch(_err) {\n",s+=`_hasError${t} = true;\n`,s+=e("_err"),s+="}\n",s+=`if(!_hasError${t}) {\n`),n&&(s+=n(`_result${t}`)),o&&(s+=o()),r||(s+="}\n");break;case"async":let i="";i+=n?`(function(_err${t}, _result${t}) {\n`:`(function(_err${t}) {\n`,i+=`if(_err${t}) {\n`,i+=e(`_err${t}`),i+="} else {\n",n&&(i+=n(`_result${t}`)),o&&(i+=o()),i+="}\n",i+="})",s+=`_fn${t}(${this.args({before:c.context?"_context":void 0,after:i})});\n`;break;case"promise":s+=`var _hasResult${t} = false;\n`,s+=`var _promise${t} = _fn${t}(${this.args({before:c.context?"_context":void 0})});\n`,s+=`if (!_promise${t} || !_promise${t}.then)\n`,s+=`  throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise${t} + ')');\n`,s+=`_promise${t}.then((function(_result${t}) {\n`,s+=`_hasResult${t} = true;\n`,n&&(s+=n(`_result${t}`)),o&&(s+=o()),s+=`}), function(_err${t}) {\n`,s+=`if(_hasResult${t}) throw _err${t};\n`,s+=e(`_err${t}`),s+="});\n"}return s}callTapsSeries({onError:t,onResult:e,resultReturns:n,onDone:o,doneReturns:r,rethrowIfPossible:s}){if(0===this.options.taps.length)return o();const i=this.options.taps.findIndex((t=>"sync"!==t.type)),c=n||r;let a="",l=o,p=0;for(let n=this.options.taps.length-1;n>=0;n--){const r=n;l!==o&&("sync"!==this.options.taps[r].type||p++>20)&&(p=0,a+=`function _next${r}() {\n`,a+=l(),a+="}\n",l=()=>`${c?"return ":""}_next${r}();\n`);const u=l,h=t=>t?"":o(),f=this.callTap(r,{onError:e=>t(r,e,u,h),onResult:e&&(t=>e(r,t,u,h)),onDone:!e&&u,rethrowIfPossible:s&&(i<0||r<i)});l=()=>f}return a+=l(),a}callTapsLooping({onError:t,onDone:e,rethrowIfPossible:n}){if(0===this.options.taps.length)return e();const o=this.options.taps.every((t=>"sync"===t.type));let r="";o||(r+="var _looper = (function() {\n",r+="var _loopAsync = false;\n"),r+="var _loop;\n",r+="do {\n",r+="_loop = false;\n";for(let t=0;t<this.options.interceptors.length;t++){const e=this.options.interceptors[t];e.loop&&(r+=`${this.getInterceptor(t)}.loop(${this.args({before:e.context?"_context":void 0})});\n`)}return r+=this.callTapsSeries({onError:t,onResult:(t,e,n,r)=>{let s="";return s+=`if(${e} !== undefined) {\n`,s+="_loop = true;\n",o||(s+="if(_loopAsync) _looper();\n"),s+=r(!0),s+="} else {\n",s+=n(),s+="}\n",s},onDone:e&&(()=>{let t="";return t+="if(!_loop) {\n",t+=e(),t+="}\n",t}),rethrowIfPossible:n&&o}),r+="} while(_loop);\n",o||(r+="_loopAsync = true;\n",r+="});\n",r+="_looper();\n"),r}callTapsParallel({onError:t,onResult:e,onDone:n,rethrowIfPossible:o,onTap:r=((t,e)=>e())}){if(this.options.taps.length<=1)return this.callTapsSeries({onError:t,onResult:e,onDone:n,rethrowIfPossible:o});let s="";s+="do {\n",s+=`var _counter = ${this.options.taps.length};\n`,n&&(s+="var _done = (function() {\n",s+=n(),s+="});\n");for(let i=0;i<this.options.taps.length;i++){const c=()=>n?"if(--_counter === 0) _done();\n":"--_counter;",a=t=>t||!n?"_counter = 0;\n":"_counter = 0;\n_done();\n";s+="if(_counter <= 0) break;\n",s+=r(i,(()=>this.callTap(i,{onError:e=>{let n="";return n+="if(_counter > 0) {\n",n+=t(i,e,c,a),n+="}\n",n},onResult:e&&(t=>{let n="";return n+="if(_counter > 0) {\n",n+=e(i,t,c,a),n+="}\n",n}),onDone:!e&&(()=>c()),rethrowIfPossible:o})),c,a)}return s+="} while(false);\n",s}args({before:t,after:e}={}){let n=this._args;return t&&(n=[t].concat(n)),e&&(n=n.concat(e)),0===n.length?"":n.join(", ")}getTapFn(t){return`_x[${t}]`}getTap(t){return`_taps[${t}]`}getInterceptor(t){return`_interceptors[${t}]`}}},202:(t,e,n)=>{const o=n(871),r=(t,e)=>e;class s{constructor(t,e){this._map=new Map,this.name=e,this._factory=t,this._interceptors=[]}get(t){return this._map.get(t)}for(t){const e=this.get(t);if(void 0!==e)return e;let n=this._factory(t);const o=this._interceptors;for(let e=0;e<o.length;e++)n=o[e].factory(t,n);return this._map.set(t,n),n}intercept(t){this._interceptors.push(Object.assign({factory:r},t))}}s.prototype.tap=o.deprecate((function(t,e,n){return this.for(t).tap(e,n)}),"HookMap#tap(key,…) is deprecated. Use HookMap#for(key).tap(…) instead."),s.prototype.tapAsync=o.deprecate((function(t,e,n){return this.for(t).tapAsync(e,n)}),"HookMap#tapAsync(key,…) is deprecated. Use HookMap#for(key).tapAsync(…) instead."),s.prototype.tapPromise=o.deprecate((function(t,e,n){return this.for(t).tapPromise(e,n)}),"HookMap#tapPromise(key,…) is deprecated. Use HookMap#for(key).tapPromise(…) instead."),t.exports=s},654:(t,e,n)=>{n(107);class o{constructor(t,e){this.hooks=t,this.name=e}tap(t,e){for(const n of this.hooks)n.tap(t,e)}tapAsync(t,e){for(const n of this.hooks)n.tapAsync(t,e)}tapPromise(t,e){for(const n of this.hooks)n.tapPromise(t,e)}isUsed(){for(const t of this.hooks)if(t.isUsed())return!0;return!1}intercept(t){for(const e of this.hooks)e.intercept(t)}withOptions(t){return new o(this.hooks.map((e=>e.withOptions(t))),this.name)}}t.exports=o},867:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onResult:e,resultReturns:n,onDone:o,rethrowIfPossible:r}){return this.callTapsSeries({onError:(e,n)=>t(n),onResult:(t,n,o)=>`if(${n} !== undefined) {\n${e(n)};\n} else {\n${o()}}\n`,resultReturns:n,onDone:o,rethrowIfPossible:r})}},i=()=>{throw new Error("tapAsync is not supported on a SyncBailHook")},c=()=>{throw new Error("tapPromise is not supported on a SyncBailHook")},a=function(t){return s.setup(this,t),s.create(t)};function l(t=[],e){const n=new o(t,e);return n.constructor=l,n.tapAsync=i,n.tapPromise=c,n.compile=a,n}l.prototype=null,t.exports=l},466:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onDone:e,rethrowIfPossible:n}){return this.callTapsSeries({onError:(e,n)=>t(n),onDone:e,rethrowIfPossible:n})}},i=()=>{throw new Error("tapAsync is not supported on a SyncHook")},c=()=>{throw new Error("tapPromise is not supported on a SyncHook")},a=function(t){return s.setup(this,t),s.create(t)};function l(t=[],e){const n=new o(t,e);return n.constructor=l,n.tapAsync=i,n.tapPromise=c,n.compile=a,n}l.prototype=null,t.exports=l},96:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onDone:e,rethrowIfPossible:n}){return this.callTapsLooping({onError:(e,n)=>t(n),onDone:e,rethrowIfPossible:n})}},i=()=>{throw new Error("tapAsync is not supported on a SyncLoopHook")},c=()=>{throw new Error("tapPromise is not supported on a SyncLoopHook")},a=function(t){return s.setup(this,t),s.create(t)};function l(t=[],e){const n=new o(t,e);return n.constructor=l,n.tapAsync=i,n.tapPromise=c,n.compile=a,n}l.prototype=null,t.exports=l},311:(t,e,n)=>{const o=n(107),r=n(255),s=new class extends r{content({onError:t,onResult:e,resultReturns:n,rethrowIfPossible:o}){return this.callTapsSeries({onError:(e,n)=>t(n),onResult:(t,e,n)=>{let o="";return o+=`if(${e} !== undefined) {\n`,o+=`${this._args[0]} = ${e};\n`,o+="}\n",o+=n(),o},onDone:()=>e(this._args[0]),doneReturns:n,rethrowIfPossible:o})}},i=()=>{throw new Error("tapAsync is not supported on a SyncWaterfallHook")},c=()=>{throw new Error("tapPromise is not supported on a SyncWaterfallHook")},a=function(t){return s.setup(this,t),s.create(t)};function l(t=[],e){if(t.length<1)throw new Error("Waterfall hooks must have at least one argument");const n=new o(t,e);return n.constructor=l,n.tapAsync=i,n.tapPromise=c,n.compile=a,n}l.prototype=null,t.exports=l},681:(t,e,n)=>{e.__esModule=!0,e.SyncHook=n(466),e.SyncBailHook=n(867),e.SyncWaterfallHook=n(311),e.SyncLoopHook=n(96),e.AsyncParallelHook=n(854),e.AsyncParallelBailHook=n(878),e.AsyncSeriesHook=n(745),e.AsyncSeriesBailHook=n(189),e.AsyncSeriesLoopHook=n(644),e.AsyncSeriesWaterfallHook=n(787),e.HookMap=n(202),e.MultiHook=n(654)},871:e=>{e.exports=t}},r={};function s(t){var e=r[t];if(void 0!==e)return e.exports;var n=r[t]={exports:{}};return o[t](n,n.exports,s),n.exports}n=Object.getPrototypeOf?t=>Object.getPrototypeOf(t):t=>t.__proto__,s.t=function(t,o){if(1&o&&(t=this(t)),8&o)return t;if("object"==typeof t&&t){if(4&o&&t.__esModule)return t;if(16&o&&"function"==typeof t.then)return t}var r=Object.create(null);s.r(r);var i={};e=e||[null,n({}),n([]),n(n)];for(var c=2&o&&t;"object"==typeof c&&!~e.indexOf(c);c=n(c))Object.getOwnPropertyNames(c).forEach((e=>i[e]=()=>t[e]));return i.default=()=>t,s.d(r,i),r},s.d=(t,e)=>{for(var n in e)s.o(e,n)&&!s.o(t,n)&&Object.defineProperty(t,n,{enumerable:!0,get:e[n]})},s.o=(t,e)=>Object.prototype.hasOwnProperty.call(t,e),s.r=t=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})};var i={};(()=>{var t;s.d(i,{$x:()=>e.AsyncSeriesLoopHook,QX:()=>e.HookMap,S$:()=>e.AsyncSeriesBailHook,ZP:()=>t||(t=s.t(e,2)),cP:()=>e.AsyncParallelBailHook,dm:()=>e.SyncLoopHook,gg:()=>e.SyncWaterfallHook,ni:()=>e.SyncHook,nr:()=>e.AsyncSeriesWaterfallHook,oI:()=>e.SyncBailHook,sX:()=>e.AsyncSeriesHook,tg:()=>e.MultiHook,zj:()=>e.AsyncParallelHook});var e=s(681)})();var c=i.cP,a=i.zj,l=i.S$,p=i.sX,u=i.$x,h=i.nr,f=i.QX,_=i.tg,y=i.oI,d=i.ni,g=i.dm,m=i.gg,w=i.ZP;export{c as AsyncParallelBailHook,a as AsyncParallelHook,l as AsyncSeriesBailHook,p as AsyncSeriesHook,u as AsyncSeriesLoopHook,h as AsyncSeriesWaterfallHook,f as HookMap,_ as MultiHook,y as SyncBailHook,d as SyncHook,g as SyncLoopHook,m as SyncWaterfallHook,w as default};
//# sourceMappingURL=tapable.js.map