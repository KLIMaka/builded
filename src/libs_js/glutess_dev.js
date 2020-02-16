define(["require", "exports"], function(require, exports) {
// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function';
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = function print(x) {
    process['stdout'].write(x + '\n');
  };
  if (!Module['printErr']) Module['printErr'] = function printErr(x) {
    process['stderr'].write(x + '\n');
  };

  var nodeFS = require('fs');
  var nodePath = require('path');

  Module['read'] = function read(filename, binary) {
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };

  Module['readBinary'] = function readBinary(filename) { return Module['read'](filename, true) };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  } else {
    Module['thisProgram'] = 'unknown-program';
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  this['Module'] = Module;

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.log(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WEB) {
    window['Module'] = Module;
  } else {
    Module['load'] = importScripts;
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in: 
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at: 
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [null,null,null,null],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  getAsmConst: function (code, numArgs) {
    // code is a constant string on the heap, so we can cache these
    if (!Runtime.asmConstCache) Runtime.asmConstCache = {};
    var func = Runtime.asmConstCache[code];
    if (func) return func;
    var args = [];
    for (var i = 0; i < numArgs; i++) {
      args.push(String.fromCharCode(36) + i); // $0, $1 etc
    }
    var source = Pointer_stringify(code);
    if (source[0] === '"') {
      // tolerate EM_ASM("..code..") even though EM_ASM(..code..) is correct
      if (source.indexOf('"', 1) === source.length-1) {
        source = source.substr(1, source.length-2);
      } else {
        // something invalid happened, e.g. EM_ASM("..code($0)..", input)
        abort('invalid EM_ASM input |' + source + '|. Please use EM_ASM(..code..) (no quotes) or EM_ASM({ ..code($0).. }, input) (to input values)');
      }
    }
    try {
      // Module is the only 'upvar', which we provide directly. We also provide FS for legacy support.
      var evalled = eval('(function(Module, FS) { return function(' + args.join(',') + '){ ' + source + ' } })')(Module, typeof FS !== 'undefined' ? FS : null);
    } catch(e) {
      Module.printErr('error in executing inline EM_ASM code: ' + e + ' on: \n\n' + source + '\n\nwith args |' + args + '| (make sure to use the right one out of EM_ASM, EM_ASM_ARGS, etc.)');
      throw e;
    }
    return Runtime.asmConstCache[code] = evalled;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return sigCache[func];
  },
  UTF8Processor: function () {
    var buffer = [];
    var needed = 0;
    this.processCChar = function (code) {
      code = code & 0xFF;

      if (buffer.length == 0) {
        if ((code & 0x80) == 0x00) {        // 0xxxxxxx
          return String.fromCharCode(code);
        }
        buffer.push(code);
        if ((code & 0xE0) == 0xC0) {        // 110xxxxx
          needed = 1;
        } else if ((code & 0xF0) == 0xE0) { // 1110xxxx
          needed = 2;
        } else {                            // 11110xxx
          needed = 3;
        }
        return '';
      }

      if (needed) {
        buffer.push(code);
        needed--;
        if (needed > 0) return '';
      }

      var c1 = buffer[0];
      var c2 = buffer[1];
      var c3 = buffer[2];
      var c4 = buffer[3];
      var ret;
      if (buffer.length == 2) {
        ret = String.fromCharCode(((c1 & 0x1F) << 6)  | (c2 & 0x3F));
      } else if (buffer.length == 3) {
        ret = String.fromCharCode(((c1 & 0x0F) << 12) | ((c2 & 0x3F) << 6)  | (c3 & 0x3F));
      } else {
        // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
        var codePoint = ((c1 & 0x07) << 18) | ((c2 & 0x3F) << 12) |
                        ((c3 & 0x3F) << 6)  | (c4 & 0x3F);
        ret = String.fromCharCode(
          (((codePoint - 0x10000) / 0x400)|0) + 0xD800,
          (codePoint - 0x10000) % 0x400 + 0xDC00);
      }
      buffer.length = 0;
      return ret;
    }
    this.processJSString = function processJSString(string) {
      /* TODO: use TextEncoder when present,
        var encoder = new TextEncoder();
        encoder['encoding'] = "utf-8";
        var utf8Array = encoder['encode'](aMsg.data);
      */
      string = unescape(encodeURIComponent(string));
      var ret = [];
      for (var i = 0; i < string.length; i++) {
        ret.push(string.charCodeAt(i));
      }
      return ret;
    }
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + (assert(DYNAMICTOP > 0),size))|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) enlargeMemory();; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}


Module['Runtime'] = Runtime;

function jsCall() {
  var args = Array.prototype.slice.call(arguments);
  return Runtime.functionPointers[args[0]].apply(null, args.slice(1));
}








//========================================
// Runtime essentials
//========================================

var __THREW__ = 0; // Used in checking for thrown exceptions.

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try {
      func = eval('_' + ident); // explicit lookup
    } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var stack = 0;
  var JSfuncs = {
    'stackSave' : function() {
      stack = Runtime.stackSave();
    },
    'stackRestore' : function() {
      Runtime.stackRestore(stack);
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface. 
  ccall = function ccallFunc(ident, returnType, argTypes, args) {
    var func = getCFunc(ident);
    var cArgs = [];
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) JSfuncs['stackRestore']();
    return ret;
  }

  var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }
  var JSsource = {};
  for (var fun in JSfuncs) {
    if (JSfuncs.hasOwnProperty(fun)) {
      // Elements of toCsource are arrays of three items:
      // the code, and the return value
      JSsource[fun] = parseJSFunc(JSfuncs[fun]);
    }
  }

  
  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      funcstr += JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=' + convertCode.returnValue + ';';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      funcstr += JSsource['stackRestore'].body + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["cwrap"] = cwrap;
Module["ccall"] = ccall;


function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module['setValue'] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module['getValue'] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module['ALLOC_NORMAL'] = ALLOC_NORMAL;
Module['ALLOC_STACK'] = ALLOC_STACK;
Module['ALLOC_STATIC'] = ALLOC_STATIC;
Module['ALLOC_DYNAMIC'] = ALLOC_DYNAMIC;
Module['ALLOC_NONE'] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module['allocate'] = allocate;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = false;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    if (t >= 128) hasUtf = true;
    else if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (!hasUtf) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }

  var utf8 = new Runtime.UTF8Processor();
  for (i = 0; i < length; i++) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    ret += utf8.processCChar(t);
  }
  return ret;
}
Module['Pointer_stringify'] = Pointer_stringify;

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}
Module['UTF16ToString'] = UTF16ToString;


function stringToUTF16(str, outPtr) {
  for(var i = 0; i < str.length; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[(((outPtr)+(i*2))>>1)]=codeUnit;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[(((outPtr)+(str.length*2))>>1)]=0;
}
Module['stringToUTF16'] = stringToUTF16;


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}
Module['UTF32ToString'] = UTF32ToString;


function stringToUTF32(str, outPtr) {
  var iChar = 0;
  for(var iCodeUnit = 0; iCodeUnit < str.length; ++iCodeUnit) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    var codeUnit = str.charCodeAt(iCodeUnit); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++iCodeUnit);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[(((outPtr)+(iChar*4))>>2)]=codeUnit;
    ++iChar;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[(((outPtr)+(iChar*4))>>2)]=0;
}
Module['stringToUTF32'] = stringToUTF32;

function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed, we can try ours which may return a partial result
    } catch(e) {
      // failure when using libcxxabi, we can try ours which may return a partial result
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
  }
  var i = 3;
  // params, etc.
  var basicTypes = {
    'v': 'void',
    'b': 'bool',
    'c': 'char',
    's': 'short',
    'i': 'int',
    'l': 'long',
    'f': 'float',
    'd': 'double',
    'w': 'wchar_t',
    'a': 'signed char',
    'h': 'unsigned char',
    't': 'unsigned short',
    'j': 'unsigned int',
    'm': 'unsigned long',
    'x': 'long long',
    'y': 'unsigned long long',
    'z': '...'
  };
  var subs = [];
  var first = true;
  function dump(x) {
    //return;
    if (x) Module.print(x);
    Module.print(func);
    var pre = '';
    for (var a = 0; a < i; a++) pre += ' ';
    Module.print (pre + '^');
  }
  function parseNested() {
    i++;
    if (func[i] === 'K') i++; // ignore const
    var parts = [];
    while (func[i] !== 'E') {
      if (func[i] === 'S') { // substitution
        i++;
        var next = func.indexOf('_', i);
        var num = func.substring(i, next) || 0;
        parts.push(subs[num] || '?');
        i = next+1;
        continue;
      }
      if (func[i] === 'C') { // constructor
        parts.push(parts[parts.length-1]);
        i += 2;
        continue;
      }
      var size = parseInt(func.substr(i));
      var pre = size.toString().length;
      if (!size || !pre) { i--; break; } // counter i++ below us
      var curr = func.substr(i + pre, size);
      parts.push(curr);
      subs.push(curr);
      i += pre + size;
    }
    i++; // skip E
    return parts;
  }
  function parse(rawList, limit, allowVoid) { // main parser
    limit = limit || Infinity;
    var ret = '', list = [];
    function flushList() {
      return '(' + list.join(', ') + ')';
    }
    var name;
    if (func[i] === 'N') {
      // namespaced N-E
      name = parseNested().join('::');
      limit--;
      if (limit === 0) return rawList ? [name] : name;
    } else {
      // not namespaced
      if (func[i] === 'K' || (first && func[i] === 'L')) i++; // ignore const and first 'L'
      var size = parseInt(func.substr(i));
      if (size) {
        var pre = size.toString().length;
        name = func.substr(i + pre, size);
        i += pre + size;
      }
    }
    first = false;
    if (func[i] === 'I') {
      i++;
      var iList = parse(true);
      var iRet = parse(true, 1, true);
      ret += iRet[0] + ' ' + name + '<' + iList.join(', ') + '>';
    } else {
      ret = name;
    }
    paramLoop: while (i < func.length && limit-- > 0) {
      //dump('paramLoop');
      var c = func[i++];
      if (c in basicTypes) {
        list.push(basicTypes[c]);
      } else {
        switch (c) {
          case 'P': list.push(parse(true, 1, true)[0] + '*'); break; // pointer
          case 'R': list.push(parse(true, 1, true)[0] + '&'); break; // reference
          case 'L': { // literal
            i++; // skip basic type
            var end = func.indexOf('E', i);
            var size = end - i;
            list.push(func.substr(i, size));
            i += size + 2; // size + 'EE'
            break;
          }
          case 'A': { // array
            var size = parseInt(func.substr(i));
            i += size.toString().length;
            if (func[i] !== '_') throw '?';
            i++; // skip _
            list.push(parse(true, 1, true)[0] + ' [' + size + ']');
            break;
          }
          case 'E': break paramLoop;
          default: ret += '?' + c; break paramLoop;
        }
      }
    }
    if (!allowVoid && list.length === 1 && list[0] === 'void') list = []; // avoid (void)
    if (rawList) {
      if (ret) {
        list.push(ret + '?');
      }
      return list;
    } else {
      return ret + flushList();
    }
  }
  var final = func;
  try {
    // Special-case the entry point, since its name differs from other name mangling.
    if (func == 'Object._main' || func == '_main') {
      return 'main()';
    }
    if (typeof func === 'number') func = Pointer_stringify(func);
    if (func[0] !== '_') return func;
    if (func[1] !== '_') return func; // C function
    if (func[2] !== 'Z') return func;
    switch (func[3]) {
      case 'n': return 'operator new()';
      case 'd': return 'operator delete()';
    }
    final = parse();
  } catch(e) {
    final += '?';
  }
  if (final.indexOf('?') >= 0 && !hasLibcxxabi) {
    Runtime.warnOnce('warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  }
  return final;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  return demangleAll(jsStackTrace());
}
Module['stackTrace'] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;
function alignMemoryPage(x) {
  return (x+4095)&-4096;
}

var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk

function enlargeMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs.');
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
var FAST_MEMORY = Module['FAST_MEMORY'] || 2097152;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  Module.printErr('increasing TOTAL_MEMORY to ' + totalMemory + ' to be compliant with the asm.js spec');
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'JS engine does not provide full typed array support');

var buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);

// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;

function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module['addOnPreRun'] = Module.addOnPreRun = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module['addOnInit'] = Module.addOnInit = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module['addOnPreMain'] = Module.addOnPreMain = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module['addOnExit'] = Module.addOnExit = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module['addOnPostRun'] = Module.addOnPostRun = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var ret = (new Runtime.UTF8Processor()).processJSString(stringy);
  if (length) {
    ret.length = length;
  }
  if (!dontAddNull) {
    ret.push(0);
  }
  return ret;
}
Module['intArrayFromString'] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module['intArrayToString'] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module['writeStringToMemory'] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[(((buffer)+(i))>>0)]=array[i];
  }
}
Module['writeArrayToMemory'] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; i++) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[(((buffer)+(i))>>0)]=str.charCodeAt(i);
  }
  if (!dontAddNull) HEAP8[(((buffer)+(str.length))>>0)]=0;
}
Module['writeAsciiToMemory'] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module['addRunDependency'] = addRunDependency;
function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module['removeRunDependency'] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data


var memoryInitializer = null;

// === Body ===





STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 2656;
  /* global initializers */ __ATINIT__.push();
  

/* memory initializer */ allocate([86,101,114,116,76,101,113,40,117,44,32,118,41,32,38,38,32,86,101,114,116,76,101,113,40,118,44,32,119,41,0,0,103,101,111,109,46,99,0,0,95,95,103,108,95,101,100,103,101,69,118,97,108,0,0,0,95,95,103,108,95,101,100,103,101,83,105,103,110,0,0,0,84,114,97,110,115,76,101,113,40,117,44,32,118,41,32,38,38,32,84,114,97,110,115,76,101,113,40,118,44,32,119,41,0,0,0,0,0,0,0,0,95,95,103,108,95,116,114,97,110,115,69,118,97,108,0,0,95,95,103,108,95,116,114,97,110,115,83,105,103,110,0,0,102,45,62,112,114,101,118,61,61,102,80,114,101,118,0,0,109,101,115,104,46,99,0,0,95,95,103,108,95,109,101,115,104,67,104,101,99,107,77,101,115,104,0,0,0,0,0,0,101,45,62,83,121,109,33,61,101,0,0,0,0,0,0,0,101,45,62,83,121,109,45,62,83,121,109,61,61,101,0,0,101,45,62,76,110,101,120,116,45,62,79,110,101,120,116,45,62,83,121,109,61,61,101,0,101,45,62,79,110,101,120,116,45,62,83,121,109,45,62,76,110,101,120,116,61,61,101,0,101,45,62,76,102,97,99,101,61,61,102,0,0,0,0,0,102,45,62,112,114,101,118,61,61,102,80,114,101,118,32,38,38,32,102,45,62,97,110,69,100,103,101,61,61,78,85,76,76,32,38,38,32,102,45,62,100,97,116,97,61,61,78,85,76,76,0,0,0,0,0,0,118,45,62,112,114,101,118,61,61,118,80,114,101,118,0,0,101,45,62,79,114,103,61,61,118,0,0,0,0,0,0,0,118,45,62,112,114,101,118,61,61,118,80,114,101,118,32,38,38,32,118,45,62,97,110,69,100,103,101,61,61,78,85,76,76,32,38,38,32,118,45,62,100,97,116,97,61,61,78,85,76,76,0,0,0,0,0,0,101,45,62,83,121,109,45,62,110,101,120,116,61,61,101,80,114,101,118,45,62,83,121,109,0,0,0,0,0,0,0,0,101,45,62,79,114,103,33,61,78,85,76,76,0,0,0,0,101,45,62,68,115,116,33,61,78,85,76,76,0,0,0,0,101,45,62,83,121,109,45,62,110,101,120,116,61,61,101,80,114,101,118,45,62,83,121,109,32,38,38,32,101,45,62,83,121,109,61,61,38,109,101,115,104,45,62,101,72,101,97,100,83,121,109,32,38,38,32,101,45,62,83,121,109,45,62,83,121,109,61,61,101,32,38,38,32,101,45,62,79,114,103,61,61,78,85,76,76,32,38,38,32,101,45,62,68,115,116,61,61,78,85,76,76,32,38,38,32,101,45,62,76,102,97,99,101,61,61,78,85,76,76,32,38,38,32,101,45,62,82,102,97,99,101,61,61,78,85,76,76,0,0,0,0,0,0,0,102,78,101,119,33,61,78,85,76,76,0,0,0,0,0,0,77,97,107,101,70,97,99,101,0,0,0,0,0,0,0,0,118,78,101,119,33,61,78,85,76,76,0,0,0,0,0,0,77,97,107,101,86,101,114,116,101,120,0,0,0,0,0,0,102,114,101,101,33,61,76,79,78,71,95,77,65,88,0,0,46,47,112,114,105,111,114,105,116,121,113,45,104,101,97,112,46,105,0,0,0,0,0,0,95,95,103,108,95,112,113,72,101,97,112,73,110,115,101,114,116,0,0,0,0,0,0,0,104,67,117,114,114,62,61,49,32,38,38,32,104,67,117,114,114,60,61,112,113,45,62,109,97,120,32,38,38,32,104,91,104,67,117,114,114,93,46,107,101,121,33,61,78,85,76,76,0,0,0,0,0,0,0,0,95,95,103,108,95,112,113,72,101,97,112,68,101,108,101,116,101,0,0,0,0,0,0,0,112,113,33,61,78,85,76,76,0,0,0,0,0,0,0,0,112,114,105,111,114,105,116,121,113,46,99,0,0,0,0,0,95,95,103,108,95,112,113,83,111,114,116,68,101,108,101,116,101,80,114,105,111,114,105,116,121,81,0,0,0,0,0,0,76,69,81,40,42,42,40,105,43,49,41,44,32,42,42,105,41,0,0,0,0,0,0,0,95,95,103,108,95,112,113,83,111,114,116,73,110,105,116,0,99,117,114,114,33,61,76,79,78,71,95,77,65,88,0,0,95,95,103,108,95,112,113,83,111,114,116,73,110,115,101,114,116,0,0,0,0,0,0,0,99,117,114,114,60,112,113,45,62,109,97,120,32,38,38,32,112,113,45,62,107,101,121,115,91,99,117,114,114,93,33,61,78,85,76,76,0,0,0,0,95,95,103,108,95,112,113,83,111,114,116,68,101,108,101,116,101,0,0,0,0,0,0,0,99,104,105,108,100,60,61,112,113,45,62,109,97,120,0,0,70,108,111,97,116,68,111,119,110,0,0,0,0,0,0,0,102,45,62,109,97,114,107,101,100,0,0,0,0,0,0,0,114,101,110,100,101,114,46,99,0,0,0,0,0,0,0,0,95,95,103,108,95,114,101,110,100,101,114,77,101,115,104,0,0,0,0,0,0,0,0,0,10,0,0,0,0,0,0,0,115,105,122,101,61,61,48,0,82,101,110,100,101,114,83,116,114,105,112,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,82,101,110,100,101,114,70,97,110,0,0,0,0,0,0,0,115,105,122,101,61,61,49,0,82,101,110,100,101,114,84,114,105,97,110,103,108,101,0,0,101,45,62,76,110,101,120,116,33,61,101,0,0,0,0,0,115,119,101,101,112,46,99,0,82,101,109,111,118,101,68,101,103,101,110,101,114,97,116,101,70,97,99,101,115,0,0,0,114,101,103,45,62,102,105,120,85,112,112,101,114,69,100,103,101,0,0,0,0,0,0,0,68,111,110,101,69,100,103,101,68,105,99,116,0,0,0,0,43,43,102,105,120,101,100,69,100,103,101,115,61,61,49,0,114,101,103,45,62,119,105,110,100,105,110,103,78,117,109,98,101,114,61,61,48,0,0,0,114,101,103,45,62,101,85,112,45,62,119,105,110,100,105,110,103,61,61,48,0,0,0,0,68,101,108,101,116,101,82,101,103,105,111,110,0,0,0,0,86,101,114,116,76,101,113,40,101,45,62,79,114,103,44,32,101,45,62,68,115,116,41,0,65,100,100,82,105,103,104,116,69,100,103,101,115,0,0,0,114,101,103,80,114,101,118,45,62,119,105,110,100,105,110,103,78,117,109,98,101,114,45,101,45,62,119,105,110,100,105,110,103,61,61,114,101,103,45,62,119,105,110,100,105,110,103,78,117,109,98,101,114,0,0,0,33,86,101,114,116,69,113,40,100,115,116,76,111,44,32,100,115,116,85,112,41,0,0,0,67,104,101,99,107,70,111,114,73,110,116,101,114,115,101,99,116,0,0,0,0,0,0,0,69,100,103,101,83,105,103,110,40,100,115,116,85,112,44,32,116,101,115,115,45,62,101,118,101,110,116,44,32,111,114,103,85,112,41,60,61,48,0,0,69,100,103,101,83,105,103,110,40,100,115,116,76,111,44,32,116,101,115,115,45,62,101,118,101,110,116,44,32,111,114,103,76,111,41,62,61,48,0,0,111,114,103,85,112,33,61,116,101,115,115,45,62,101,118,101,110,116,32,38,38,32,111,114,103,76,111,33,61,116,101,115,115,45,62,101,118,101,110,116,0,0,0,0,0,0,0,0,33,114,101,103,85,112,45,62,102,105,120,85,112,112,101,114,69,100,103,101,32,38,38,32,33,114,101,103,76,111,45,62,102,105,120,85,112,112,101,114,69,100,103,101,0,0,0,0,77,73,78,40,111,114,103,85,112,45,62,116,44,32,100,115,116,85,112,45,62,116,41,60,61,105,115,101,99,116,46,116,0,0,0,0,0,0,0,0,105,115,101,99,116,46,116,60,61,77,65,88,40,111,114,103,76,111,45,62,116,44,32,100,115,116,76,111,45,62,116,41,0,0,0,0,0,0,0,0,77,73,78,40,100,115,116,76,111,45,62,115,44,32,100,115,116,85,112,45,62,115,41,60,61,105,115,101,99,116,46,115,0,0,0,0,0,0,0,0,105,115,101,99,116,46,115,60,61,77,65,88,40,111,114,103,76,111,45,62,115,44,32,111,114,103,85,112,45,62,115,41,0,0,0,0,0,0,0,0,33,86,101,114,116,69,113,40,101,85,112,45,62,68,115,116,44,32,101,76,111,45,62,68,115,116,41,0,0,0,0,0,67,104,101,99,107,70,111,114,76,101,102,116,83,112,108,105,99,101,0,0,0,0,0,0,70,65,76,83,69,0,0,0,73,115,87,105,110,100,105,110,103,73,110,115,105,100,101,0,70,105,120,85,112,112,101,114,69,100,103,101,0,0,0,0,84,79,76,69,82,65,78,67,69,95,78,79,78,90,69,82,79,0,0,0,0,0,0,0,67,111,110,110,101,99,116,76,101,102,116,68,101,103,101,110,101,114,97,116,101,0,0,0,0,0,0,63,0,0,0,63,0,0,0,0,0,0,0,0,117,112,45,62,76,110,101,120,116,33,61,117,112,32,38,38,32,117,112,45,62,76,110,101,120,116,45,62,76,110,101,120,116,33,61,117,112,0,0,0,116,101,115,115,109,111,110,111,46,99,0,0,0,0,0,0,95,95,103,108,95,109,101,115,104,84,101,115,115,101,108,108,97,116,101,77,111,110,111,82,101,103,105,111,110,0,0,0,108,111,45,62,76,110,101,120,116,33,61,117,112,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);




var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}


  var _emscripten_prep_setjmp=true;

  
  
  var ___errno_state=0;function ___setErrNo(value) {
      // For convenient setting and returning of errno.
      HEAP32[((___errno_state)>>2)]=value;
      return value;
    }
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 79:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

  function ___errno_location() {
      return ___errno_state;
    }

   
  Module["_memset"] = _memset;

  function _abort() {
      Module['abort']();
    }

  
  
  
  
  
  var FS=undefined;
  
  
  
  var SOCKFS=undefined;function _send(fd, buf, len, flags) {
      var sock = SOCKFS.getSocket(fd);
      if (!sock) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
      // TODO honor flags
      return _write(fd, buf, len);
    }
  
  function _pwrite(fildes, buf, nbyte, offset) {
      // ssize_t pwrite(int fildes, const void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.getStream(fildes);
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
      try {
        var slab = HEAP8;
        return FS.write(stream, slab, buf, nbyte, offset);
      } catch (e) {
        FS.handleFSError(e);
        return -1;
      }
    }function _write(fildes, buf, nbyte) {
      // ssize_t write(int fildes, const void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.getStream(fildes);
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
  
  
      try {
        var slab = HEAP8;
        return FS.write(stream, slab, buf, nbyte);
      } catch (e) {
        FS.handleFSError(e);
        return -1;
      }
    }
  
  function _fileno(stream) {
      // int fileno(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fileno.html
      stream = FS.getStreamFromPtr(stream);
      if (!stream) return -1;
      return stream.fd;
    }function _fputc(c, stream) {
      // int fputc(int c, FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fputc.html
      var chr = unSign(c & 0xFF);
      HEAP8[((_fputc.ret)>>0)]=chr;
      var fd = _fileno(stream);
      var ret = _write(fd, _fputc.ret, 1);
      if (ret == -1) {
        var streamObj = FS.getStreamFromPtr(stream);
        if (streamObj) streamObj.error = true;
        return -1;
      } else {
        return chr;
      }
    }
  
  var _stdout=allocate(1, "i32*", ALLOC_STATIC);function _putchar(c) {
      // int putchar(int c);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/putchar.html
      return _fputc(c, HEAP32[((_stdout)>>2)]);
    } 
  Module["_saveSetjmp"] = _saveSetjmp;
  
   
  Module["_testSetjmp"] = _testSetjmp;function _longjmp(env, value) {
      asm['setThrew'](env, value || 1);
      throw 'longjmp';
    }function _emscripten_longjmp(env, value) {
      _longjmp(env, value);
    }

  function ___assert_fail(condition, filename, line, func) {
      ABORT = true;
      throw 'Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function'] + ' at ' + stackTrace();
    }


   
  Module["_strlen"] = _strlen;

  var _emscripten_check_longjmp=true;

  var _emscripten_setjmp=true;

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) self.alloc(bytes);
      return ret;  // Previous break location.
    }

  var _emscripten_postinvoke=true;

  var _emscripten_preinvoke=true;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;


  
  var PATH=undefined;
  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        console.error('emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.');
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
          setTimeout(Browser.mainLoop.runner, value); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      }
      return 0;
    }function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg) {
      Module['noExitRuntime'] = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          Module.printErr('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(function() {
          if (typeof arg !== 'undefined') {
            Runtime.dynCall('vi', func, [arg]);
          } else {
            Runtime.dynCall('v', func);
          }
        });
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
      else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
      Browser.mainLoop.scheduler();
  
      if (simulateInfiniteLoop) {
        throw 'SimulateInfiniteLoop';
      }
    }var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function () {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function () {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function (func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          assert(typeof url == 'string', 'createObjectURL must return a url as a string');
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            assert(typeof url == 'string', 'createObjectURL must return a url as a string');
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
        // Canvas event setup
  
        var canvas = Module['canvas'];
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas ||
                                document['msPointerLockElement'] === canvas;
        }
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
          
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && canvas.requestPointerLock) {
                canvas.requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          contextHandle = GL.createContext(canvas, contextAttributes);
          if (contextHandle) {
            ctx = GL.getContext(contextHandle).GLctx;
          }
          // Set the background of the WebGL canvas to black
          canvas.style.backgroundColor = "black";
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:function (lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
  
        var canvas = Module['canvas'];
        function fullScreenChange() {
          Browser.isFullScreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
               document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
               document['fullScreenElement'] || document['fullscreenElement'] ||
               document['msFullScreenElement'] || document['msFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.cancelFullScreen = document['cancelFullScreen'] ||
                                      document['mozCancelFullScreen'] ||
                                      document['webkitCancelFullScreen'] ||
                                      document['msExitFullscreen'] ||
                                      document['exitFullscreen'] ||
                                      function() {};
            canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullScreen = true;
            if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
          } else {
            
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
            
            if (Browser.resizeCanvas) Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullScreen);
          Browser.updateCanvasDimensions(canvas);
        }
  
        if (!Browser.fullScreenHandlersInstalled) {
          Browser.fullScreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullScreenChange, false);
          document.addEventListener('mozfullscreenchange', fullScreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
          document.addEventListener('MSFullscreenChange', fullScreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
        
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullScreen = canvasContainer['requestFullScreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
        canvasContainer.requestFullScreen();
      },nextRAF:0,fakeRequestAnimationFrame:function (func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function requestAnimationFrame(func) {
        if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
          Browser.fakeRequestAnimationFrame(func);
        } else {
          if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                           window['mozRequestAnimationFrame'] ||
                                           window['webkitRequestAnimationFrame'] ||
                                           window['msRequestAnimationFrame'] ||
                                           window['oRequestAnimationFrame'] ||
                                           Browser.fakeRequestAnimationFrame;
          }
          window.requestAnimationFrame(func);
        }
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (!ABORT) func();
        });
      },safeSetTimeout:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setTimeout(function() {
          if (!ABORT) func();
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setInterval(function() {
          if (!ABORT) func();
        }, timeout);
      },getMimetype:function (name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function (event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll': 
            delta = event.detail;
            break;
          case 'mousewheel': 
            delta = event.wheelDelta;
            break;
          case 'wheel': 
            delta = event['deltaY'];
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          
          // check if SDL is available
          if (typeof SDL != "undefined") {
          	Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          	Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
          	// just add the mouse delta to the current absolut mouse position
          	// FIXME: ideally this should be clamped against the canvas size and zero
          	Browser.mouseX += Browser.mouseMovementX;
          	Browser.mouseY += Browser.mouseMovementY;
          }        
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
          // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
          // and we have no viable fallback.
          assert((typeof scrollX !== 'undefined') && (typeof scrollY !== 'undefined'), 'Unable to retrieve scroll position, mouse positions likely broken.');
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
            
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              Browser.lastTouches[touch.identifier] = Browser.touches[touch.identifier];
              Browser.touches[touch.identifier] = { x: adjustedX, y: adjustedY };
            } 
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },xhrLoad:function (url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function xhr_onload() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        Browser.xhrLoad(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (!noRunDep) removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (!noRunDep) addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function () {
        // check if SDL is available   
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        // check if SDL is available       
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function (canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
             document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
             document['fullScreenElement'] || document['fullscreenElement'] ||
             document['msFullScreenElement'] || document['msFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function () {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};

  var _emscripten_get_longjmp_result=true;

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }
___errno_state = Runtime.staticAlloc(4); HEAP32[((___errno_state)>>2)]=0;
_fputc.ret = allocate([0], "i8", ALLOC_STATIC);
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas) { Browser.requestFullScreen(lockPointer, resizeCanvas) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");



function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function nullFunc_viiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function nullFunc_vi(x) { Module["printErr"]("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function nullFunc_vii(x) { Module["printErr"]("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function nullFunc_viii(x) { Module["printErr"]("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function nullFunc_v(x) { Module["printErr"]("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function nullFunc_iii(x) { Module["printErr"]("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function nullFunc_viiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info."); abort(x) }

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array };
Module.asmLibraryArg = { "abort": abort, "assert": assert, "min": Math_min, "jsCall": jsCall, "nullFunc_iiii": nullFunc_iiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_vi": nullFunc_vi, "nullFunc_vii": nullFunc_vii, "nullFunc_ii": nullFunc_ii, "nullFunc_viii": nullFunc_viii, "nullFunc_v": nullFunc_v, "nullFunc_iii": nullFunc_iii, "nullFunc_viiii": nullFunc_viiii, "invoke_iiii": invoke_iiii, "invoke_viiiii": invoke_viiiii, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_ii": invoke_ii, "invoke_viii": invoke_viii, "invoke_v": invoke_v, "invoke_iii": invoke_iii, "invoke_viiii": invoke_viiii, "_longjmp": _longjmp, "_putchar": _putchar, "_fputc": _fputc, "_send": _send, "_pwrite": _pwrite, "_emscripten_set_main_loop": _emscripten_set_main_loop, "_abort": _abort, "___setErrNo": ___setErrNo, "_sbrk": _sbrk, "_time": _time, "_emscripten_longjmp": _emscripten_longjmp, "___assert_fail": ___assert_fail, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_fileno": _fileno, "_write": _write, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "_sysconf": _sysconf, "___errno_location": ___errno_location, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "NaN": NaN, "Infinity": Infinity };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'almost asm';
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = +env.NaN, inf = +env.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;

  var tempRet0 = 0;
  var tempRet1 = 0;
  var tempRet2 = 0;
  var tempRet3 = 0;
  var tempRet4 = 0;
  var tempRet5 = 0;
  var tempRet6 = 0;
  var tempRet7 = 0;
  var tempRet8 = 0;
  var tempRet9 = 0;
  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var abort=env.abort;
  var assert=env.assert;
  var Math_min=env.min;
  var jsCall=env.jsCall;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_viiiii=env.nullFunc_viiiii;
  var nullFunc_vi=env.nullFunc_vi;
  var nullFunc_vii=env.nullFunc_vii;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_viii=env.nullFunc_viii;
  var nullFunc_v=env.nullFunc_v;
  var nullFunc_iii=env.nullFunc_iii;
  var nullFunc_viiii=env.nullFunc_viiii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_vi=env.invoke_vi;
  var invoke_vii=env.invoke_vii;
  var invoke_ii=env.invoke_ii;
  var invoke_viii=env.invoke_viii;
  var invoke_v=env.invoke_v;
  var invoke_iii=env.invoke_iii;
  var invoke_viiii=env.invoke_viiii;
  var _longjmp=env._longjmp;
  var _putchar=env._putchar;
  var _fputc=env._fputc;
  var _send=env._send;
  var _pwrite=env._pwrite;
  var _emscripten_set_main_loop=env._emscripten_set_main_loop;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var _sbrk=env._sbrk;
  var _time=env._time;
  var _emscripten_longjmp=env._emscripten_longjmp;
  var ___assert_fail=env.___assert_fail;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var _fileno=env._fileno;
  var _write=env._write;
  var _emscripten_set_main_loop_timing=env._emscripten_set_main_loop_timing;
  var _sysconf=env._sysconf;
  var ___errno_location=env.___errno_location;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS
function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
STACKTOP = (STACKTOP + 15)&-16;
if ((STACKTOP|0) >= (STACK_MAX|0)) abort();

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}
function copyTempFloat(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
}
function copyTempDouble(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
  HEAP8[tempDoublePtr+4>>0] = HEAP8[ptr+4>>0];
  HEAP8[tempDoublePtr+5>>0] = HEAP8[ptr+5>>0];
  HEAP8[tempDoublePtr+6>>0] = HEAP8[ptr+6>>0];
  HEAP8[tempDoublePtr+7>>0] = HEAP8[ptr+7>>0];
}
function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function ___gl_dictListNewDict($frame,$leq) {
 $frame = $frame|0;
 $leq = $leq|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $dict = 0, $head = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $frame;
 $2 = $leq;
 $3 = (_malloc(20)|0);
 $dict = $3;
 $4 = $dict;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $0 = 0;
  $21 = $0;
  STACKTOP = sp;return ($21|0);
 } else {
  $6 = $dict;
  $head = $6;
  $7 = $head;
  HEAP32[$7>>2] = 0;
  $8 = $head;
  $9 = $head;
  $10 = (($9) + 4|0);
  HEAP32[$10>>2] = $8;
  $11 = $head;
  $12 = $head;
  $13 = (($12) + 8|0);
  HEAP32[$13>>2] = $11;
  $14 = $1;
  $15 = $dict;
  $16 = (($15) + 12|0);
  HEAP32[$16>>2] = $14;
  $17 = $2;
  $18 = $dict;
  $19 = (($18) + 16|0);
  HEAP32[$19>>2] = $17;
  $20 = $dict;
  $0 = $20;
  $21 = $0;
  STACKTOP = sp;return ($21|0);
 }
 return 0|0;
}
function ___gl_dictListDeleteDict($dict) {
 $dict = $dict|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $next = 0, $node = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $dict;
 $1 = $0;
 $2 = (($1) + 4|0);
 $3 = HEAP32[$2>>2]|0;
 $node = $3;
 while(1) {
  $4 = $node;
  $5 = $0;
  $6 = ($4|0)!=($5|0);
  if (!($6)) {
   break;
  }
  $7 = $node;
  $8 = (($7) + 4|0);
  $9 = HEAP32[$8>>2]|0;
  $next = $9;
  $10 = $node;
  _free($10);
  $11 = $next;
  $node = $11;
 }
 $12 = $0;
 _free($12);
 STACKTOP = sp;return;
}
function ___gl_dictListInsertBefore($dict,$node,$key) {
 $dict = $dict|0;
 $node = $node|0;
 $key = $key|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $newNode = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $dict;
 $2 = $node;
 $3 = $key;
 while(1) {
  $4 = $2;
  $5 = (($4) + 8|0);
  $6 = HEAP32[$5>>2]|0;
  $2 = $6;
  $7 = $2;
  $8 = HEAP32[$7>>2]|0;
  $9 = ($8|0)!=(0|0);
  if ($9) {
   $10 = $1;
   $11 = (($10) + 16|0);
   $12 = HEAP32[$11>>2]|0;
   $13 = $1;
   $14 = (($13) + 12|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = $2;
   $17 = HEAP32[$16>>2]|0;
   $18 = $3;
   $19 = (FUNCTION_TABLE_iiii[$12 & 63]($15,$17,$18)|0);
   $20 = ($19|0)!=(0);
   $21 = $20 ^ 1;
   $45 = $21;
  } else {
   $45 = 0;
  }
  if (!($45)) {
   break;
  }
 }
 $22 = (_malloc(12)|0);
 $newNode = $22;
 $23 = $newNode;
 $24 = ($23|0)==(0|0);
 if ($24) {
  $0 = 0;
  $44 = $0;
  STACKTOP = sp;return ($44|0);
 } else {
  $25 = $3;
  $26 = $newNode;
  HEAP32[$26>>2] = $25;
  $27 = $2;
  $28 = (($27) + 4|0);
  $29 = HEAP32[$28>>2]|0;
  $30 = $newNode;
  $31 = (($30) + 4|0);
  HEAP32[$31>>2] = $29;
  $32 = $newNode;
  $33 = $2;
  $34 = (($33) + 4|0);
  $35 = HEAP32[$34>>2]|0;
  $36 = (($35) + 8|0);
  HEAP32[$36>>2] = $32;
  $37 = $2;
  $38 = $newNode;
  $39 = (($38) + 8|0);
  HEAP32[$39>>2] = $37;
  $40 = $newNode;
  $41 = $2;
  $42 = (($41) + 4|0);
  HEAP32[$42>>2] = $40;
  $43 = $newNode;
  $0 = $43;
  $44 = $0;
  STACKTOP = sp;return ($44|0);
 }
 return 0|0;
}
function ___gl_dictListDelete($dict,$node) {
 $dict = $dict|0;
 $node = $node|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $dict;
 $1 = $node;
 $2 = $1;
 $3 = (($2) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = $1;
 $6 = (($5) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($7) + 8|0);
 HEAP32[$8>>2] = $4;
 $9 = $1;
 $10 = (($9) + 4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = $1;
 $13 = (($12) + 8|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = (($14) + 4|0);
 HEAP32[$15>>2] = $11;
 $16 = $1;
 _free($16);
 STACKTOP = sp;return;
}
function ___gl_dictListSearch($dict,$key) {
 $dict = $dict|0;
 $key = $key|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $node = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $dict;
 $1 = $key;
 $2 = $0;
 $node = $2;
 while(1) {
  $3 = $node;
  $4 = (($3) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $node = $5;
  $6 = $node;
  $7 = HEAP32[$6>>2]|0;
  $8 = ($7|0)!=(0|0);
  if ($8) {
   $9 = $0;
   $10 = (($9) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = $0;
   $13 = (($12) + 12|0);
   $14 = HEAP32[$13>>2]|0;
   $15 = $1;
   $16 = $node;
   $17 = HEAP32[$16>>2]|0;
   $18 = (FUNCTION_TABLE_iiii[$11 & 63]($14,$15,$17)|0);
   $19 = ($18|0)!=(0);
   $20 = $19 ^ 1;
   $22 = $20;
  } else {
   $22 = 0;
  }
  if (!($22)) {
   break;
  }
 }
 $21 = $node;
 STACKTOP = sp;return ($21|0);
}
function ___gl_vertLeq($u,$v) {
 $u = $u|0;
 $v = $v|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0, $17 = 0, $18 = 0.0, $19 = 0, $2 = 0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0;
 var $4 = 0.0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $u;
 $1 = $v;
 $2 = $0;
 $3 = (($2) + 28|0);
 $4 = +HEAPF32[$3>>2];
 $5 = $1;
 $6 = (($5) + 28|0);
 $7 = +HEAPF32[$6>>2];
 $8 = $4 < $7;
 if ($8) {
  $24 = 1;
  $23 = $24&1;
  STACKTOP = sp;return ($23|0);
 }
 $9 = $0;
 $10 = (($9) + 28|0);
 $11 = +HEAPF32[$10>>2];
 $12 = $1;
 $13 = (($12) + 28|0);
 $14 = +HEAPF32[$13>>2];
 $15 = $11 == $14;
 if ($15) {
  $16 = $0;
  $17 = (($16) + 32|0);
  $18 = +HEAPF32[$17>>2];
  $19 = $1;
  $20 = (($19) + 32|0);
  $21 = +HEAPF32[$20>>2];
  $22 = $18 <= $21;
  $25 = $22;
 } else {
  $25 = 0;
 }
 $24 = $25;
 $23 = $24&1;
 STACKTOP = sp;return ($23|0);
}
function ___gl_edgeEval($u,$v,$w) {
 $u = $u|0;
 $v = $v|0;
 $w = $w|0;
 var $0 = 0.0, $1 = 0, $10 = 0, $100 = 0.0, $101 = 0.0, $102 = 0.0, $103 = 0.0, $104 = 0.0, $105 = 0.0, $106 = 0.0, $107 = 0.0, $108 = 0.0, $109 = 0.0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0;
 var $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0.0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0, $46 = 0, $47 = 0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0.0, $53 = 0;
 var $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0, $64 = 0.0, $65 = 0.0, $66 = 0, $67 = 0, $68 = 0, $69 = 0.0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0.0, $73 = 0.0, $74 = 0, $75 = 0, $76 = 0.0, $77 = 0, $78 = 0, $79 = 0.0, $8 = 0, $80 = 0.0, $81 = 0.0, $82 = 0.0, $83 = 0.0, $84 = 0.0, $85 = 0.0, $86 = 0.0, $87 = 0.0, $88 = 0, $89 = 0, $9 = 0.0;
 var $90 = 0.0, $91 = 0, $92 = 0, $93 = 0.0, $94 = 0.0, $95 = 0, $96 = 0, $97 = 0.0, $98 = 0, $99 = 0, $gapL = 0.0, $gapR = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $u;
 $2 = $v;
 $3 = $w;
 $4 = $1;
 $5 = (($4) + 28|0);
 $6 = +HEAPF32[$5>>2];
 $7 = $2;
 $8 = (($7) + 28|0);
 $9 = +HEAPF32[$8>>2];
 $10 = $6 < $9;
 if (!($10)) {
  $11 = $1;
  $12 = (($11) + 28|0);
  $13 = +HEAPF32[$12>>2];
  $14 = $2;
  $15 = (($14) + 28|0);
  $16 = +HEAPF32[$15>>2];
  $17 = $13 == $16;
  if (!($17)) {
   ___assert_fail((8|0),(40|0),60,(48|0));
   // unreachable;
  }
  $18 = $1;
  $19 = (($18) + 32|0);
  $20 = +HEAPF32[$19>>2];
  $21 = $2;
  $22 = (($21) + 32|0);
  $23 = +HEAPF32[$22>>2];
  $24 = $20 <= $23;
  if (!($24)) {
   ___assert_fail((8|0),(40|0),60,(48|0));
   // unreachable;
  }
 }
 $25 = $2;
 $26 = (($25) + 28|0);
 $27 = +HEAPF32[$26>>2];
 $28 = $3;
 $29 = (($28) + 28|0);
 $30 = +HEAPF32[$29>>2];
 $31 = $27 < $30;
 if (!($31)) {
  $32 = $2;
  $33 = (($32) + 28|0);
  $34 = +HEAPF32[$33>>2];
  $35 = $3;
  $36 = (($35) + 28|0);
  $37 = +HEAPF32[$36>>2];
  $38 = $34 == $37;
  if (!($38)) {
   ___assert_fail((8|0),(40|0),60,(48|0));
   // unreachable;
  }
  $39 = $2;
  $40 = (($39) + 32|0);
  $41 = +HEAPF32[$40>>2];
  $42 = $3;
  $43 = (($42) + 32|0);
  $44 = +HEAPF32[$43>>2];
  $45 = $41 <= $44;
  if (!($45)) {
   ___assert_fail((8|0),(40|0),60,(48|0));
   // unreachable;
  }
 }
 $46 = $2;
 $47 = (($46) + 28|0);
 $48 = +HEAPF32[$47>>2];
 $49 = $1;
 $50 = (($49) + 28|0);
 $51 = +HEAPF32[$50>>2];
 $52 = $48 - $51;
 $gapL = $52;
 $53 = $3;
 $54 = (($53) + 28|0);
 $55 = +HEAPF32[$54>>2];
 $56 = $2;
 $57 = (($56) + 28|0);
 $58 = +HEAPF32[$57>>2];
 $59 = $55 - $58;
 $gapR = $59;
 $60 = $gapL;
 $61 = $gapR;
 $62 = $60 + $61;
 $63 = $62 > 0.0;
 if (!($63)) {
  $0 = 0.0;
  $109 = $0;
  STACKTOP = sp;return (+$109);
 }
 $64 = $gapL;
 $65 = $gapR;
 $66 = $64 < $65;
 if ($66) {
  $67 = $2;
  $68 = (($67) + 32|0);
  $69 = +HEAPF32[$68>>2];
  $70 = $1;
  $71 = (($70) + 32|0);
  $72 = +HEAPF32[$71>>2];
  $73 = $69 - $72;
  $74 = $1;
  $75 = (($74) + 32|0);
  $76 = +HEAPF32[$75>>2];
  $77 = $3;
  $78 = (($77) + 32|0);
  $79 = +HEAPF32[$78>>2];
  $80 = $76 - $79;
  $81 = $gapL;
  $82 = $gapL;
  $83 = $gapR;
  $84 = $82 + $83;
  $85 = $81 / $84;
  $86 = $80 * $85;
  $87 = $73 + $86;
  $0 = $87;
  $109 = $0;
  STACKTOP = sp;return (+$109);
 } else {
  $88 = $2;
  $89 = (($88) + 32|0);
  $90 = +HEAPF32[$89>>2];
  $91 = $3;
  $92 = (($91) + 32|0);
  $93 = +HEAPF32[$92>>2];
  $94 = $90 - $93;
  $95 = $3;
  $96 = (($95) + 32|0);
  $97 = +HEAPF32[$96>>2];
  $98 = $1;
  $99 = (($98) + 32|0);
  $100 = +HEAPF32[$99>>2];
  $101 = $97 - $100;
  $102 = $gapR;
  $103 = $gapL;
  $104 = $gapR;
  $105 = $103 + $104;
  $106 = $102 / $105;
  $107 = $101 * $106;
  $108 = $94 + $107;
  $0 = $108;
  $109 = $0;
  STACKTOP = sp;return (+$109);
 }
 return +0;
}
function ___gl_edgeSign($u,$v,$w) {
 $u = $u|0;
 $v = $v|0;
 $w = $w|0;
 var $0 = 0.0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0.0, $42 = 0, $43 = 0, $44 = 0.0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0.0, $67 = 0, $68 = 0, $69 = 0.0, $7 = 0, $70 = 0.0, $71 = 0.0, $72 = 0.0, $73 = 0, $74 = 0, $75 = 0.0, $76 = 0, $77 = 0, $78 = 0.0, $79 = 0.0, $8 = 0, $80 = 0.0;
 var $81 = 0.0, $82 = 0.0, $83 = 0.0, $9 = 0.0, $gapL = 0.0, $gapR = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $u;
 $2 = $v;
 $3 = $w;
 $4 = $1;
 $5 = (($4) + 28|0);
 $6 = +HEAPF32[$5>>2];
 $7 = $2;
 $8 = (($7) + 28|0);
 $9 = +HEAPF32[$8>>2];
 $10 = $6 < $9;
 if (!($10)) {
  $11 = $1;
  $12 = (($11) + 28|0);
  $13 = +HEAPF32[$12>>2];
  $14 = $2;
  $15 = (($14) + 28|0);
  $16 = +HEAPF32[$15>>2];
  $17 = $13 == $16;
  if (!($17)) {
   ___assert_fail((8|0),(40|0),89,(64|0));
   // unreachable;
  }
  $18 = $1;
  $19 = (($18) + 32|0);
  $20 = +HEAPF32[$19>>2];
  $21 = $2;
  $22 = (($21) + 32|0);
  $23 = +HEAPF32[$22>>2];
  $24 = $20 <= $23;
  if (!($24)) {
   ___assert_fail((8|0),(40|0),89,(64|0));
   // unreachable;
  }
 }
 $25 = $2;
 $26 = (($25) + 28|0);
 $27 = +HEAPF32[$26>>2];
 $28 = $3;
 $29 = (($28) + 28|0);
 $30 = +HEAPF32[$29>>2];
 $31 = $27 < $30;
 if (!($31)) {
  $32 = $2;
  $33 = (($32) + 28|0);
  $34 = +HEAPF32[$33>>2];
  $35 = $3;
  $36 = (($35) + 28|0);
  $37 = +HEAPF32[$36>>2];
  $38 = $34 == $37;
  if (!($38)) {
   ___assert_fail((8|0),(40|0),89,(64|0));
   // unreachable;
  }
  $39 = $2;
  $40 = (($39) + 32|0);
  $41 = +HEAPF32[$40>>2];
  $42 = $3;
  $43 = (($42) + 32|0);
  $44 = +HEAPF32[$43>>2];
  $45 = $41 <= $44;
  if (!($45)) {
   ___assert_fail((8|0),(40|0),89,(64|0));
   // unreachable;
  }
 }
 $46 = $2;
 $47 = (($46) + 28|0);
 $48 = +HEAPF32[$47>>2];
 $49 = $1;
 $50 = (($49) + 28|0);
 $51 = +HEAPF32[$50>>2];
 $52 = $48 - $51;
 $gapL = $52;
 $53 = $3;
 $54 = (($53) + 28|0);
 $55 = +HEAPF32[$54>>2];
 $56 = $2;
 $57 = (($56) + 28|0);
 $58 = +HEAPF32[$57>>2];
 $59 = $55 - $58;
 $gapR = $59;
 $60 = $gapL;
 $61 = $gapR;
 $62 = $60 + $61;
 $63 = $62 > 0.0;
 if ($63) {
  $64 = $2;
  $65 = (($64) + 32|0);
  $66 = +HEAPF32[$65>>2];
  $67 = $3;
  $68 = (($67) + 32|0);
  $69 = +HEAPF32[$68>>2];
  $70 = $66 - $69;
  $71 = $gapL;
  $72 = $70 * $71;
  $73 = $2;
  $74 = (($73) + 32|0);
  $75 = +HEAPF32[$74>>2];
  $76 = $1;
  $77 = (($76) + 32|0);
  $78 = +HEAPF32[$77>>2];
  $79 = $75 - $78;
  $80 = $gapR;
  $81 = $79 * $80;
  $82 = $72 + $81;
  $0 = $82;
  $83 = $0;
  STACKTOP = sp;return (+$83);
 } else {
  $0 = 0.0;
  $83 = $0;
  STACKTOP = sp;return (+$83);
 }
 return +0;
}
function ___gl_transEval($u,$v,$w) {
 $u = $u|0;
 $v = $v|0;
 $w = $w|0;
 var $0 = 0.0, $1 = 0, $10 = 0, $100 = 0.0, $101 = 0.0, $102 = 0.0, $103 = 0.0, $104 = 0.0, $105 = 0.0, $106 = 0.0, $107 = 0.0, $108 = 0.0, $109 = 0.0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0;
 var $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0.0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0, $46 = 0, $47 = 0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0.0, $53 = 0;
 var $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0, $64 = 0.0, $65 = 0.0, $66 = 0, $67 = 0, $68 = 0, $69 = 0.0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0.0, $73 = 0.0, $74 = 0, $75 = 0, $76 = 0.0, $77 = 0, $78 = 0, $79 = 0.0, $8 = 0, $80 = 0.0, $81 = 0.0, $82 = 0.0, $83 = 0.0, $84 = 0.0, $85 = 0.0, $86 = 0.0, $87 = 0.0, $88 = 0, $89 = 0, $9 = 0.0;
 var $90 = 0.0, $91 = 0, $92 = 0, $93 = 0.0, $94 = 0.0, $95 = 0, $96 = 0, $97 = 0.0, $98 = 0, $99 = 0, $gapL = 0.0, $gapR = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $u;
 $2 = $v;
 $3 = $w;
 $4 = $1;
 $5 = (($4) + 32|0);
 $6 = +HEAPF32[$5>>2];
 $7 = $2;
 $8 = (($7) + 32|0);
 $9 = +HEAPF32[$8>>2];
 $10 = $6 < $9;
 if (!($10)) {
  $11 = $1;
  $12 = (($11) + 32|0);
  $13 = +HEAPF32[$12>>2];
  $14 = $2;
  $15 = (($14) + 32|0);
  $16 = +HEAPF32[$15>>2];
  $17 = $13 == $16;
  if (!($17)) {
   ___assert_fail((80|0),(40|0),121,(120|0));
   // unreachable;
  }
  $18 = $1;
  $19 = (($18) + 28|0);
  $20 = +HEAPF32[$19>>2];
  $21 = $2;
  $22 = (($21) + 28|0);
  $23 = +HEAPF32[$22>>2];
  $24 = $20 <= $23;
  if (!($24)) {
   ___assert_fail((80|0),(40|0),121,(120|0));
   // unreachable;
  }
 }
 $25 = $2;
 $26 = (($25) + 32|0);
 $27 = +HEAPF32[$26>>2];
 $28 = $3;
 $29 = (($28) + 32|0);
 $30 = +HEAPF32[$29>>2];
 $31 = $27 < $30;
 if (!($31)) {
  $32 = $2;
  $33 = (($32) + 32|0);
  $34 = +HEAPF32[$33>>2];
  $35 = $3;
  $36 = (($35) + 32|0);
  $37 = +HEAPF32[$36>>2];
  $38 = $34 == $37;
  if (!($38)) {
   ___assert_fail((80|0),(40|0),121,(120|0));
   // unreachable;
  }
  $39 = $2;
  $40 = (($39) + 28|0);
  $41 = +HEAPF32[$40>>2];
  $42 = $3;
  $43 = (($42) + 28|0);
  $44 = +HEAPF32[$43>>2];
  $45 = $41 <= $44;
  if (!($45)) {
   ___assert_fail((80|0),(40|0),121,(120|0));
   // unreachable;
  }
 }
 $46 = $2;
 $47 = (($46) + 32|0);
 $48 = +HEAPF32[$47>>2];
 $49 = $1;
 $50 = (($49) + 32|0);
 $51 = +HEAPF32[$50>>2];
 $52 = $48 - $51;
 $gapL = $52;
 $53 = $3;
 $54 = (($53) + 32|0);
 $55 = +HEAPF32[$54>>2];
 $56 = $2;
 $57 = (($56) + 32|0);
 $58 = +HEAPF32[$57>>2];
 $59 = $55 - $58;
 $gapR = $59;
 $60 = $gapL;
 $61 = $gapR;
 $62 = $60 + $61;
 $63 = $62 > 0.0;
 if (!($63)) {
  $0 = 0.0;
  $109 = $0;
  STACKTOP = sp;return (+$109);
 }
 $64 = $gapL;
 $65 = $gapR;
 $66 = $64 < $65;
 if ($66) {
  $67 = $2;
  $68 = (($67) + 28|0);
  $69 = +HEAPF32[$68>>2];
  $70 = $1;
  $71 = (($70) + 28|0);
  $72 = +HEAPF32[$71>>2];
  $73 = $69 - $72;
  $74 = $1;
  $75 = (($74) + 28|0);
  $76 = +HEAPF32[$75>>2];
  $77 = $3;
  $78 = (($77) + 28|0);
  $79 = +HEAPF32[$78>>2];
  $80 = $76 - $79;
  $81 = $gapL;
  $82 = $gapL;
  $83 = $gapR;
  $84 = $82 + $83;
  $85 = $81 / $84;
  $86 = $80 * $85;
  $87 = $73 + $86;
  $0 = $87;
  $109 = $0;
  STACKTOP = sp;return (+$109);
 } else {
  $88 = $2;
  $89 = (($88) + 28|0);
  $90 = +HEAPF32[$89>>2];
  $91 = $3;
  $92 = (($91) + 28|0);
  $93 = +HEAPF32[$92>>2];
  $94 = $90 - $93;
  $95 = $3;
  $96 = (($95) + 28|0);
  $97 = +HEAPF32[$96>>2];
  $98 = $1;
  $99 = (($98) + 28|0);
  $100 = +HEAPF32[$99>>2];
  $101 = $97 - $100;
  $102 = $gapR;
  $103 = $gapL;
  $104 = $gapR;
  $105 = $103 + $104;
  $106 = $102 / $105;
  $107 = $101 * $106;
  $108 = $94 + $107;
  $0 = $108;
  $109 = $0;
  STACKTOP = sp;return (+$109);
 }
 return +0;
}
function ___gl_transSign($u,$v,$w) {
 $u = $u|0;
 $v = $v|0;
 $w = $w|0;
 var $0 = 0.0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0.0, $42 = 0, $43 = 0, $44 = 0.0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0.0, $67 = 0, $68 = 0, $69 = 0.0, $7 = 0, $70 = 0.0, $71 = 0.0, $72 = 0.0, $73 = 0, $74 = 0, $75 = 0.0, $76 = 0, $77 = 0, $78 = 0.0, $79 = 0.0, $8 = 0, $80 = 0.0;
 var $81 = 0.0, $82 = 0.0, $83 = 0.0, $9 = 0.0, $gapL = 0.0, $gapR = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $u;
 $2 = $v;
 $3 = $w;
 $4 = $1;
 $5 = (($4) + 32|0);
 $6 = +HEAPF32[$5>>2];
 $7 = $2;
 $8 = (($7) + 32|0);
 $9 = +HEAPF32[$8>>2];
 $10 = $6 < $9;
 if (!($10)) {
  $11 = $1;
  $12 = (($11) + 32|0);
  $13 = +HEAPF32[$12>>2];
  $14 = $2;
  $15 = (($14) + 32|0);
  $16 = +HEAPF32[$15>>2];
  $17 = $13 == $16;
  if (!($17)) {
   ___assert_fail((80|0),(40|0),150,(136|0));
   // unreachable;
  }
  $18 = $1;
  $19 = (($18) + 28|0);
  $20 = +HEAPF32[$19>>2];
  $21 = $2;
  $22 = (($21) + 28|0);
  $23 = +HEAPF32[$22>>2];
  $24 = $20 <= $23;
  if (!($24)) {
   ___assert_fail((80|0),(40|0),150,(136|0));
   // unreachable;
  }
 }
 $25 = $2;
 $26 = (($25) + 32|0);
 $27 = +HEAPF32[$26>>2];
 $28 = $3;
 $29 = (($28) + 32|0);
 $30 = +HEAPF32[$29>>2];
 $31 = $27 < $30;
 if (!($31)) {
  $32 = $2;
  $33 = (($32) + 32|0);
  $34 = +HEAPF32[$33>>2];
  $35 = $3;
  $36 = (($35) + 32|0);
  $37 = +HEAPF32[$36>>2];
  $38 = $34 == $37;
  if (!($38)) {
   ___assert_fail((80|0),(40|0),150,(136|0));
   // unreachable;
  }
  $39 = $2;
  $40 = (($39) + 28|0);
  $41 = +HEAPF32[$40>>2];
  $42 = $3;
  $43 = (($42) + 28|0);
  $44 = +HEAPF32[$43>>2];
  $45 = $41 <= $44;
  if (!($45)) {
   ___assert_fail((80|0),(40|0),150,(136|0));
   // unreachable;
  }
 }
 $46 = $2;
 $47 = (($46) + 32|0);
 $48 = +HEAPF32[$47>>2];
 $49 = $1;
 $50 = (($49) + 32|0);
 $51 = +HEAPF32[$50>>2];
 $52 = $48 - $51;
 $gapL = $52;
 $53 = $3;
 $54 = (($53) + 32|0);
 $55 = +HEAPF32[$54>>2];
 $56 = $2;
 $57 = (($56) + 32|0);
 $58 = +HEAPF32[$57>>2];
 $59 = $55 - $58;
 $gapR = $59;
 $60 = $gapL;
 $61 = $gapR;
 $62 = $60 + $61;
 $63 = $62 > 0.0;
 if ($63) {
  $64 = $2;
  $65 = (($64) + 28|0);
  $66 = +HEAPF32[$65>>2];
  $67 = $3;
  $68 = (($67) + 28|0);
  $69 = +HEAPF32[$68>>2];
  $70 = $66 - $69;
  $71 = $gapL;
  $72 = $70 * $71;
  $73 = $2;
  $74 = (($73) + 28|0);
  $75 = +HEAPF32[$74>>2];
  $76 = $1;
  $77 = (($76) + 28|0);
  $78 = +HEAPF32[$77>>2];
  $79 = $75 - $78;
  $80 = $gapR;
  $81 = $79 * $80;
  $82 = $72 + $81;
  $0 = $82;
  $83 = $0;
  STACKTOP = sp;return (+$83);
 } else {
  $0 = 0.0;
  $83 = $0;
  STACKTOP = sp;return (+$83);
 }
 return +0;
}
function ___gl_edgeIntersect($o1,$d1,$o2,$d2,$v) {
 $o1 = $o1|0;
 $d1 = $d1|0;
 $o2 = $o2|0;
 $d2 = $d2|0;
 $v = $v|0;
 var $0 = 0, $1 = 0, $10 = 0.0, $100 = 0, $101 = 0, $102 = 0, $103 = 0.0, $104 = 0, $105 = 0, $106 = 0.0, $107 = 0.0, $108 = 0.0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0.0, $114 = 0, $115 = 0;
 var $116 = 0.0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0.0, $121 = 0, $122 = 0, $123 = 0.0, $124 = 0, $125 = 0, $126 = 0, $127 = 0.0, $128 = 0, $129 = 0, $13 = 0, $130 = 0.0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0.0, $136 = 0, $137 = 0, $138 = 0, $139 = 0.0, $14 = 0.0, $140 = 0.0, $141 = 0.0, $142 = 0.0, $143 = 0, $144 = 0.0, $145 = 0.0, $146 = 0.0, $147 = 0.0, $148 = 0.0, $149 = 0, $15 = 0, $150 = 0.0, $151 = 0.0;
 var $152 = 0.0, $153 = 0, $154 = 0.0, $155 = 0.0, $156 = 0.0, $157 = 0.0, $158 = 0, $159 = 0.0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0.0, $164 = 0, $165 = 0, $166 = 0.0, $167 = 0.0, $168 = 0.0, $169 = 0, $17 = 0.0;
 var $170 = 0, $171 = 0.0, $172 = 0, $173 = 0, $174 = 0.0, $175 = 0, $176 = 0, $177 = 0.0, $178 = 0.0, $179 = 0.0, $18 = 0, $180 = 0.0, $181 = 0.0, $182 = 0.0, $183 = 0.0, $184 = 0.0, $185 = 0.0, $186 = 0, $187 = 0, $188 = 0.0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0.0, $192 = 0, $193 = 0, $194 = 0.0, $195 = 0.0, $196 = 0.0, $197 = 0.0, $198 = 0.0, $199 = 0.0, $2 = 0, $20 = 0, $200 = 0.0, $201 = 0.0, $202 = 0.0, $203 = 0, $204 = 0, $205 = 0.0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0.0, $21 = 0.0, $210 = 0, $211 = 0, $212 = 0, $213 = 0.0, $214 = 0.0, $215 = 0.0, $216 = 0.0, $217 = 0.0, $218 = 0, $219 = 0.0, $22 = 0, $220 = 0.0, $221 = 0.0, $222 = 0.0, $223 = 0.0;
 var $224 = 0, $225 = 0.0, $226 = 0.0, $227 = 0.0, $228 = 0, $229 = 0.0, $23 = 0, $230 = 0.0, $231 = 0.0, $232 = 0.0, $233 = 0, $234 = 0.0, $235 = 0, $236 = 0, $237 = 0, $238 = 0.0, $239 = 0, $24 = 0.0, $240 = 0, $241 = 0.0;
 var $242 = 0.0, $243 = 0.0, $244 = 0, $245 = 0, $246 = 0.0, $247 = 0, $248 = 0, $249 = 0.0, $25 = 0, $250 = 0, $251 = 0, $252 = 0.0, $253 = 0.0, $254 = 0.0, $255 = 0.0, $256 = 0.0, $257 = 0.0, $258 = 0.0, $259 = 0.0, $26 = 0;
 var $260 = 0.0, $261 = 0, $262 = 0, $263 = 0.0, $264 = 0, $265 = 0, $266 = 0.0, $267 = 0, $268 = 0, $269 = 0.0, $27 = 0, $270 = 0.0, $271 = 0.0, $272 = 0.0, $273 = 0.0, $274 = 0.0, $275 = 0.0, $276 = 0.0, $277 = 0.0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0.0, $281 = 0, $282 = 0, $283 = 0.0, $284 = 0, $285 = 0, $286 = 0.0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0.0, $291 = 0, $292 = 0, $293 = 0.0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0.0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0.0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0.0, $308 = 0, $309 = 0, $31 = 0.0, $310 = 0.0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0.0, $315 = 0, $316 = 0, $317 = 0.0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0.0, $322 = 0, $323 = 0, $324 = 0.0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0.0;
 var $332 = 0, $333 = 0, $334 = 0.0, $335 = 0, $336 = 0, $337 = 0, $338 = 0.0, $339 = 0, $34 = 0.0, $340 = 0, $341 = 0.0, $342 = 0, $343 = 0, $344 = 0, $345 = 0.0, $346 = 0, $347 = 0, $348 = 0.0, $349 = 0, $35 = 0;
 var $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0.0, $359 = 0, $36 = 0, $360 = 0, $361 = 0.0, $362 = 0, $363 = 0, $364 = 0, $365 = 0.0, $366 = 0, $367 = 0, $368 = 0.0;
 var $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0.0, $373 = 0, $374 = 0, $375 = 0.0, $376 = 0, $377 = 0, $378 = 0, $379 = 0.0, $38 = 0.0, $380 = 0, $381 = 0, $382 = 0.0, $383 = 0.0, $384 = 0.0, $385 = 0, $386 = 0;
 var $387 = 0, $388 = 0, $389 = 0.0, $39 = 0, $390 = 0, $391 = 0, $392 = 0.0, $393 = 0, $394 = 0, $395 = 0, $396 = 0.0, $397 = 0, $398 = 0, $399 = 0.0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0.0;
 var $404 = 0, $405 = 0, $406 = 0.0, $407 = 0, $408 = 0, $409 = 0, $41 = 0.0, $410 = 0, $411 = 0.0, $412 = 0, $413 = 0, $414 = 0, $415 = 0.0, $416 = 0.0, $417 = 0.0, $418 = 0.0, $419 = 0, $42 = 0, $420 = 0.0, $421 = 0.0;
 var $422 = 0.0, $423 = 0.0, $424 = 0.0, $425 = 0, $426 = 0.0, $427 = 0.0, $428 = 0.0, $429 = 0, $43 = 0, $430 = 0.0, $431 = 0.0, $432 = 0.0, $433 = 0.0, $434 = 0, $435 = 0.0, $436 = 0, $437 = 0, $438 = 0, $439 = 0.0, $44 = 0;
 var $440 = 0, $441 = 0, $442 = 0.0, $443 = 0.0, $444 = 0.0, $445 = 0, $446 = 0, $447 = 0.0, $448 = 0, $449 = 0, $45 = 0.0, $450 = 0.0, $451 = 0, $452 = 0, $453 = 0.0, $454 = 0.0, $455 = 0.0, $456 = 0.0, $457 = 0.0, $458 = 0.0;
 var $459 = 0.0, $46 = 0, $460 = 0.0, $461 = 0.0, $462 = 0, $463 = 0, $464 = 0.0, $465 = 0, $466 = 0, $467 = 0.0, $468 = 0, $469 = 0, $47 = 0, $470 = 0.0, $471 = 0.0, $472 = 0.0, $473 = 0.0, $474 = 0.0, $475 = 0.0, $476 = 0.0;
 var $477 = 0.0, $478 = 0.0, $479 = 0, $48 = 0.0, $480 = 0, $481 = 0.0, $482 = 0, $483 = 0, $484 = 0, $485 = 0.0, $486 = 0, $487 = 0, $488 = 0, $489 = 0.0, $49 = 0, $490 = 0.0, $491 = 0.0, $492 = 0.0, $493 = 0.0, $494 = 0;
 var $495 = 0.0, $496 = 0.0, $497 = 0.0, $498 = 0.0, $499 = 0.0, $5 = 0, $50 = 0, $500 = 0, $501 = 0.0, $502 = 0.0, $503 = 0.0, $504 = 0, $505 = 0.0, $506 = 0.0, $507 = 0.0, $508 = 0.0, $509 = 0, $51 = 0, $510 = 0.0, $511 = 0;
 var $512 = 0, $513 = 0, $514 = 0.0, $515 = 0, $516 = 0, $517 = 0.0, $518 = 0.0, $519 = 0.0, $52 = 0, $520 = 0, $521 = 0, $522 = 0.0, $523 = 0, $524 = 0, $525 = 0.0, $526 = 0, $527 = 0, $528 = 0.0, $529 = 0.0, $53 = 0;
 var $530 = 0.0, $531 = 0.0, $532 = 0.0, $533 = 0.0, $534 = 0.0, $535 = 0.0, $536 = 0.0, $537 = 0, $538 = 0, $539 = 0.0, $54 = 0, $540 = 0, $541 = 0, $542 = 0.0, $543 = 0, $544 = 0, $545 = 0.0, $546 = 0.0, $547 = 0.0, $548 = 0.0;
 var $549 = 0.0, $55 = 0.0, $550 = 0.0, $551 = 0.0, $552 = 0.0, $553 = 0.0, $554 = 0, $555 = 0, $556 = 0.0, $557 = 0.0, $558 = 0.0, $559 = 0.0, $56 = 0, $560 = 0.0, $57 = 0, $58 = 0.0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0.0, $63 = 0, $64 = 0, $65 = 0.0, $66 = 0, $67 = 0, $68 = 0, $69 = 0.0, $7 = 0.0, $70 = 0, $71 = 0, $72 = 0.0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0.0, $83 = 0, $84 = 0, $85 = 0.0, $86 = 0, $87 = 0, $88 = 0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0, $92 = 0.0, $93 = 0, $94 = 0, $95 = 0, $96 = 0.0, $97 = 0, $98 = 0;
 var $99 = 0.0, $t = 0, $t1 = 0, $t2 = 0, $t3 = 0, $t4 = 0, $t5 = 0, $t6 = 0, $t7 = 0, $z1 = 0.0, $z2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $o1;
 $1 = $d1;
 $2 = $o2;
 $3 = $d2;
 $4 = $v;
 $5 = $0;
 $6 = (($5) + 28|0);
 $7 = +HEAPF32[$6>>2];
 $8 = $1;
 $9 = (($8) + 28|0);
 $10 = +HEAPF32[$9>>2];
 $11 = $7 < $10;
 do {
  if (!($11)) {
   $12 = $0;
   $13 = (($12) + 28|0);
   $14 = +HEAPF32[$13>>2];
   $15 = $1;
   $16 = (($15) + 28|0);
   $17 = +HEAPF32[$16>>2];
   $18 = $14 == $17;
   if ($18) {
    $19 = $0;
    $20 = (($19) + 32|0);
    $21 = +HEAPF32[$20>>2];
    $22 = $1;
    $23 = (($22) + 32|0);
    $24 = +HEAPF32[$23>>2];
    $25 = $21 <= $24;
    if ($25) {
     break;
    }
   }
   $26 = $0;
   $t = $26;
   $27 = $1;
   $0 = $27;
   $28 = $t;
   $1 = $28;
  }
 } while(0);
 $29 = $2;
 $30 = (($29) + 28|0);
 $31 = +HEAPF32[$30>>2];
 $32 = $3;
 $33 = (($32) + 28|0);
 $34 = +HEAPF32[$33>>2];
 $35 = $31 < $34;
 do {
  if (!($35)) {
   $36 = $2;
   $37 = (($36) + 28|0);
   $38 = +HEAPF32[$37>>2];
   $39 = $3;
   $40 = (($39) + 28|0);
   $41 = +HEAPF32[$40>>2];
   $42 = $38 == $41;
   if ($42) {
    $43 = $2;
    $44 = (($43) + 32|0);
    $45 = +HEAPF32[$44>>2];
    $46 = $3;
    $47 = (($46) + 32|0);
    $48 = +HEAPF32[$47>>2];
    $49 = $45 <= $48;
    if ($49) {
     break;
    }
   }
   $50 = $2;
   $t1 = $50;
   $51 = $3;
   $2 = $51;
   $52 = $t1;
   $3 = $52;
  }
 } while(0);
 $53 = $0;
 $54 = (($53) + 28|0);
 $55 = +HEAPF32[$54>>2];
 $56 = $2;
 $57 = (($56) + 28|0);
 $58 = +HEAPF32[$57>>2];
 $59 = $55 < $58;
 do {
  if (!($59)) {
   $60 = $0;
   $61 = (($60) + 28|0);
   $62 = +HEAPF32[$61>>2];
   $63 = $2;
   $64 = (($63) + 28|0);
   $65 = +HEAPF32[$64>>2];
   $66 = $62 == $65;
   if ($66) {
    $67 = $0;
    $68 = (($67) + 32|0);
    $69 = +HEAPF32[$68>>2];
    $70 = $2;
    $71 = (($70) + 32|0);
    $72 = +HEAPF32[$71>>2];
    $73 = $69 <= $72;
    if ($73) {
     break;
    }
   }
   $74 = $0;
   $t2 = $74;
   $75 = $2;
   $0 = $75;
   $76 = $t2;
   $2 = $76;
   $77 = $1;
   $t3 = $77;
   $78 = $3;
   $1 = $78;
   $79 = $t3;
   $3 = $79;
  }
 } while(0);
 $80 = $2;
 $81 = (($80) + 28|0);
 $82 = +HEAPF32[$81>>2];
 $83 = $1;
 $84 = (($83) + 28|0);
 $85 = +HEAPF32[$84>>2];
 $86 = $82 < $85;
 do {
  if ($86) {
   label = 17;
  } else {
   $87 = $2;
   $88 = (($87) + 28|0);
   $89 = +HEAPF32[$88>>2];
   $90 = $1;
   $91 = (($90) + 28|0);
   $92 = +HEAPF32[$91>>2];
   $93 = $89 == $92;
   if ($93) {
    $94 = $2;
    $95 = (($94) + 32|0);
    $96 = +HEAPF32[$95>>2];
    $97 = $1;
    $98 = (($97) + 32|0);
    $99 = +HEAPF32[$98>>2];
    $100 = $96 <= $99;
    if ($100) {
     label = 17;
     break;
    }
   }
   $101 = $2;
   $102 = (($101) + 28|0);
   $103 = +HEAPF32[$102>>2];
   $104 = $1;
   $105 = (($104) + 28|0);
   $106 = +HEAPF32[$105>>2];
   $107 = $103 + $106;
   $108 = $107 / 2.0;
   $109 = $4;
   $110 = (($109) + 28|0);
   HEAPF32[$110>>2] = $108;
  }
 } while(0);
 if ((label|0) == 17) {
  $111 = $1;
  $112 = (($111) + 28|0);
  $113 = +HEAPF32[$112>>2];
  $114 = $3;
  $115 = (($114) + 28|0);
  $116 = +HEAPF32[$115>>2];
  $117 = $113 < $116;
  do {
   if ($117) {
    label = 20;
   } else {
    $118 = $1;
    $119 = (($118) + 28|0);
    $120 = +HEAPF32[$119>>2];
    $121 = $3;
    $122 = (($121) + 28|0);
    $123 = +HEAPF32[$122>>2];
    $124 = $120 == $123;
    if ($124) {
     $125 = $1;
     $126 = (($125) + 32|0);
     $127 = +HEAPF32[$126>>2];
     $128 = $3;
     $129 = (($128) + 32|0);
     $130 = +HEAPF32[$129>>2];
     $131 = $127 <= $130;
     if ($131) {
      label = 20;
      break;
     }
    }
    $206 = $0;
    $207 = $2;
    $208 = $1;
    $209 = (+___gl_edgeSign($206,$207,$208));
    $z1 = $209;
    $210 = $0;
    $211 = $3;
    $212 = $1;
    $213 = (+___gl_edgeSign($210,$211,$212));
    $214 = -$213;
    $z2 = $214;
    $215 = $z1;
    $216 = $z2;
    $217 = $215 + $216;
    $218 = $217 < 0.0;
    if ($218) {
     $219 = $z1;
     $220 = -$219;
     $z1 = $220;
     $221 = $z2;
     $222 = -$221;
     $z2 = $222;
    }
    $223 = $z1;
    $224 = $223 < 0.0;
    if ($224) {
     $226 = 0.0;
    } else {
     $225 = $z1;
     $226 = $225;
    }
    $z1 = $226;
    $227 = $z2;
    $228 = $227 < 0.0;
    if ($228) {
     $230 = 0.0;
    } else {
     $229 = $z2;
     $230 = $229;
    }
    $z2 = $230;
    $231 = $z1;
    $232 = $z2;
    $233 = $231 <= $232;
    if ($233) {
     $234 = $z2;
     $235 = $234 == 0.0;
     if ($235) {
      $236 = $2;
      $237 = (($236) + 28|0);
      $238 = +HEAPF32[$237>>2];
      $239 = $3;
      $240 = (($239) + 28|0);
      $241 = +HEAPF32[$240>>2];
      $242 = $238 + $241;
      $243 = $242 / 2.0;
      $558 = $243;
     } else {
      $244 = $2;
      $245 = (($244) + 28|0);
      $246 = +HEAPF32[$245>>2];
      $247 = $3;
      $248 = (($247) + 28|0);
      $249 = +HEAPF32[$248>>2];
      $250 = $2;
      $251 = (($250) + 28|0);
      $252 = +HEAPF32[$251>>2];
      $253 = $249 - $252;
      $254 = $z1;
      $255 = $z1;
      $256 = $z2;
      $257 = $255 + $256;
      $258 = $254 / $257;
      $259 = $253 * $258;
      $260 = $246 + $259;
      $558 = $260;
     }
     $280 = $558;
    } else {
     $261 = $3;
     $262 = (($261) + 28|0);
     $263 = +HEAPF32[$262>>2];
     $264 = $2;
     $265 = (($264) + 28|0);
     $266 = +HEAPF32[$265>>2];
     $267 = $3;
     $268 = (($267) + 28|0);
     $269 = +HEAPF32[$268>>2];
     $270 = $266 - $269;
     $271 = $z2;
     $272 = $z1;
     $273 = $z2;
     $274 = $272 + $273;
     $275 = $271 / $274;
     $276 = $270 * $275;
     $277 = $263 + $276;
     $280 = $277;
    }
    $278 = $4;
    $279 = (($278) + 28|0);
    HEAPF32[$279>>2] = $280;
   }
  } while(0);
  if ((label|0) == 20) {
   $132 = $0;
   $133 = $2;
   $134 = $1;
   $135 = (+___gl_edgeEval($132,$133,$134));
   $z1 = $135;
   $136 = $2;
   $137 = $1;
   $138 = $3;
   $139 = (+___gl_edgeEval($136,$137,$138));
   $z2 = $139;
   $140 = $z1;
   $141 = $z2;
   $142 = $140 + $141;
   $143 = $142 < 0.0;
   if ($143) {
    $144 = $z1;
    $145 = -$144;
    $z1 = $145;
    $146 = $z2;
    $147 = -$146;
    $z2 = $147;
   }
   $148 = $z1;
   $149 = $148 < 0.0;
   if ($149) {
    $151 = 0.0;
   } else {
    $150 = $z1;
    $151 = $150;
   }
   $z1 = $151;
   $152 = $z2;
   $153 = $152 < 0.0;
   if ($153) {
    $155 = 0.0;
   } else {
    $154 = $z2;
    $155 = $154;
   }
   $z2 = $155;
   $156 = $z1;
   $157 = $z2;
   $158 = $156 <= $157;
   if ($158) {
    $159 = $z2;
    $160 = $159 == 0.0;
    if ($160) {
     $161 = $2;
     $162 = (($161) + 28|0);
     $163 = +HEAPF32[$162>>2];
     $164 = $1;
     $165 = (($164) + 28|0);
     $166 = +HEAPF32[$165>>2];
     $167 = $163 + $166;
     $168 = $167 / 2.0;
     $557 = $168;
    } else {
     $169 = $2;
     $170 = (($169) + 28|0);
     $171 = +HEAPF32[$170>>2];
     $172 = $1;
     $173 = (($172) + 28|0);
     $174 = +HEAPF32[$173>>2];
     $175 = $2;
     $176 = (($175) + 28|0);
     $177 = +HEAPF32[$176>>2];
     $178 = $174 - $177;
     $179 = $z1;
     $180 = $z1;
     $181 = $z2;
     $182 = $180 + $181;
     $183 = $179 / $182;
     $184 = $178 * $183;
     $185 = $171 + $184;
     $557 = $185;
    }
    $205 = $557;
   } else {
    $186 = $1;
    $187 = (($186) + 28|0);
    $188 = +HEAPF32[$187>>2];
    $189 = $2;
    $190 = (($189) + 28|0);
    $191 = +HEAPF32[$190>>2];
    $192 = $1;
    $193 = (($192) + 28|0);
    $194 = +HEAPF32[$193>>2];
    $195 = $191 - $194;
    $196 = $z2;
    $197 = $z1;
    $198 = $z2;
    $199 = $197 + $198;
    $200 = $196 / $199;
    $201 = $195 * $200;
    $202 = $188 + $201;
    $205 = $202;
   }
   $203 = $4;
   $204 = (($203) + 28|0);
   HEAPF32[$204>>2] = $205;
  }
 }
 $281 = $0;
 $282 = (($281) + 32|0);
 $283 = +HEAPF32[$282>>2];
 $284 = $1;
 $285 = (($284) + 32|0);
 $286 = +HEAPF32[$285>>2];
 $287 = $283 < $286;
 do {
  if (!($287)) {
   $288 = $0;
   $289 = (($288) + 32|0);
   $290 = +HEAPF32[$289>>2];
   $291 = $1;
   $292 = (($291) + 32|0);
   $293 = +HEAPF32[$292>>2];
   $294 = $290 == $293;
   if ($294) {
    $295 = $0;
    $296 = (($295) + 28|0);
    $297 = +HEAPF32[$296>>2];
    $298 = $1;
    $299 = (($298) + 28|0);
    $300 = +HEAPF32[$299>>2];
    $301 = $297 <= $300;
    if ($301) {
     break;
    }
   }
   $302 = $0;
   $t4 = $302;
   $303 = $1;
   $0 = $303;
   $304 = $t4;
   $1 = $304;
  }
 } while(0);
 $305 = $2;
 $306 = (($305) + 32|0);
 $307 = +HEAPF32[$306>>2];
 $308 = $3;
 $309 = (($308) + 32|0);
 $310 = +HEAPF32[$309>>2];
 $311 = $307 < $310;
 do {
  if (!($311)) {
   $312 = $2;
   $313 = (($312) + 32|0);
   $314 = +HEAPF32[$313>>2];
   $315 = $3;
   $316 = (($315) + 32|0);
   $317 = +HEAPF32[$316>>2];
   $318 = $314 == $317;
   if ($318) {
    $319 = $2;
    $320 = (($319) + 28|0);
    $321 = +HEAPF32[$320>>2];
    $322 = $3;
    $323 = (($322) + 28|0);
    $324 = +HEAPF32[$323>>2];
    $325 = $321 <= $324;
    if ($325) {
     break;
    }
   }
   $326 = $2;
   $t5 = $326;
   $327 = $3;
   $2 = $327;
   $328 = $t5;
   $3 = $328;
  }
 } while(0);
 $329 = $0;
 $330 = (($329) + 32|0);
 $331 = +HEAPF32[$330>>2];
 $332 = $2;
 $333 = (($332) + 32|0);
 $334 = +HEAPF32[$333>>2];
 $335 = $331 < $334;
 do {
  if (!($335)) {
   $336 = $0;
   $337 = (($336) + 32|0);
   $338 = +HEAPF32[$337>>2];
   $339 = $2;
   $340 = (($339) + 32|0);
   $341 = +HEAPF32[$340>>2];
   $342 = $338 == $341;
   if ($342) {
    $343 = $0;
    $344 = (($343) + 28|0);
    $345 = +HEAPF32[$344>>2];
    $346 = $2;
    $347 = (($346) + 28|0);
    $348 = +HEAPF32[$347>>2];
    $349 = $345 <= $348;
    if ($349) {
     break;
    }
   }
   $350 = $0;
   $t6 = $350;
   $351 = $2;
   $0 = $351;
   $352 = $t6;
   $2 = $352;
   $353 = $1;
   $t7 = $353;
   $354 = $3;
   $1 = $354;
   $355 = $t7;
   $3 = $355;
  }
 } while(0);
 $356 = $2;
 $357 = (($356) + 32|0);
 $358 = +HEAPF32[$357>>2];
 $359 = $1;
 $360 = (($359) + 32|0);
 $361 = +HEAPF32[$360>>2];
 $362 = $358 < $361;
 do {
  if (!($362)) {
   $363 = $2;
   $364 = (($363) + 32|0);
   $365 = +HEAPF32[$364>>2];
   $366 = $1;
   $367 = (($366) + 32|0);
   $368 = +HEAPF32[$367>>2];
   $369 = $365 == $368;
   if ($369) {
    $370 = $2;
    $371 = (($370) + 28|0);
    $372 = +HEAPF32[$371>>2];
    $373 = $1;
    $374 = (($373) + 28|0);
    $375 = +HEAPF32[$374>>2];
    $376 = $372 <= $375;
    if ($376) {
     break;
    }
   }
   $377 = $2;
   $378 = (($377) + 32|0);
   $379 = +HEAPF32[$378>>2];
   $380 = $1;
   $381 = (($380) + 32|0);
   $382 = +HEAPF32[$381>>2];
   $383 = $379 + $382;
   $384 = $383 / 2.0;
   $385 = $4;
   $386 = (($385) + 32|0);
   HEAPF32[$386>>2] = $384;
   STACKTOP = sp;return;
  }
 } while(0);
 $387 = $1;
 $388 = (($387) + 32|0);
 $389 = +HEAPF32[$388>>2];
 $390 = $3;
 $391 = (($390) + 32|0);
 $392 = +HEAPF32[$391>>2];
 $393 = $389 < $392;
 do {
  if ($393) {
   label = 70;
  } else {
   $394 = $1;
   $395 = (($394) + 32|0);
   $396 = +HEAPF32[$395>>2];
   $397 = $3;
   $398 = (($397) + 32|0);
   $399 = +HEAPF32[$398>>2];
   $400 = $396 == $399;
   if ($400) {
    $401 = $1;
    $402 = (($401) + 28|0);
    $403 = +HEAPF32[$402>>2];
    $404 = $3;
    $405 = (($404) + 28|0);
    $406 = +HEAPF32[$405>>2];
    $407 = $403 <= $406;
    if ($407) {
     label = 70;
     break;
    }
   }
   $482 = $0;
   $483 = $2;
   $484 = $1;
   $485 = (+___gl_transSign($482,$483,$484));
   $z1 = $485;
   $486 = $0;
   $487 = $3;
   $488 = $1;
   $489 = (+___gl_transSign($486,$487,$488));
   $490 = -$489;
   $z2 = $490;
   $491 = $z1;
   $492 = $z2;
   $493 = $491 + $492;
   $494 = $493 < 0.0;
   if ($494) {
    $495 = $z1;
    $496 = -$495;
    $z1 = $496;
    $497 = $z2;
    $498 = -$497;
    $z2 = $498;
   }
   $499 = $z1;
   $500 = $499 < 0.0;
   if ($500) {
    $502 = 0.0;
   } else {
    $501 = $z1;
    $502 = $501;
   }
   $z1 = $502;
   $503 = $z2;
   $504 = $503 < 0.0;
   if ($504) {
    $506 = 0.0;
   } else {
    $505 = $z2;
    $506 = $505;
   }
   $z2 = $506;
   $507 = $z1;
   $508 = $z2;
   $509 = $507 <= $508;
   if ($509) {
    $510 = $z2;
    $511 = $510 == 0.0;
    if ($511) {
     $512 = $2;
     $513 = (($512) + 32|0);
     $514 = +HEAPF32[$513>>2];
     $515 = $3;
     $516 = (($515) + 32|0);
     $517 = +HEAPF32[$516>>2];
     $518 = $514 + $517;
     $519 = $518 / 2.0;
     $560 = $519;
    } else {
     $520 = $2;
     $521 = (($520) + 32|0);
     $522 = +HEAPF32[$521>>2];
     $523 = $3;
     $524 = (($523) + 32|0);
     $525 = +HEAPF32[$524>>2];
     $526 = $2;
     $527 = (($526) + 32|0);
     $528 = +HEAPF32[$527>>2];
     $529 = $525 - $528;
     $530 = $z1;
     $531 = $z1;
     $532 = $z2;
     $533 = $531 + $532;
     $534 = $530 / $533;
     $535 = $529 * $534;
     $536 = $522 + $535;
     $560 = $536;
    }
    $556 = $560;
   } else {
    $537 = $3;
    $538 = (($537) + 32|0);
    $539 = +HEAPF32[$538>>2];
    $540 = $2;
    $541 = (($540) + 32|0);
    $542 = +HEAPF32[$541>>2];
    $543 = $3;
    $544 = (($543) + 32|0);
    $545 = +HEAPF32[$544>>2];
    $546 = $542 - $545;
    $547 = $z2;
    $548 = $z1;
    $549 = $z2;
    $550 = $548 + $549;
    $551 = $547 / $550;
    $552 = $546 * $551;
    $553 = $539 + $552;
    $556 = $553;
   }
   $554 = $4;
   $555 = (($554) + 32|0);
   HEAPF32[$555>>2] = $556;
  }
 } while(0);
 if ((label|0) == 70) {
  $408 = $0;
  $409 = $2;
  $410 = $1;
  $411 = (+___gl_transEval($408,$409,$410));
  $z1 = $411;
  $412 = $2;
  $413 = $1;
  $414 = $3;
  $415 = (+___gl_transEval($412,$413,$414));
  $z2 = $415;
  $416 = $z1;
  $417 = $z2;
  $418 = $416 + $417;
  $419 = $418 < 0.0;
  if ($419) {
   $420 = $z1;
   $421 = -$420;
   $z1 = $421;
   $422 = $z2;
   $423 = -$422;
   $z2 = $423;
  }
  $424 = $z1;
  $425 = $424 < 0.0;
  if ($425) {
   $427 = 0.0;
  } else {
   $426 = $z1;
   $427 = $426;
  }
  $z1 = $427;
  $428 = $z2;
  $429 = $428 < 0.0;
  if ($429) {
   $431 = 0.0;
  } else {
   $430 = $z2;
   $431 = $430;
  }
  $z2 = $431;
  $432 = $z1;
  $433 = $z2;
  $434 = $432 <= $433;
  if ($434) {
   $435 = $z2;
   $436 = $435 == 0.0;
   if ($436) {
    $437 = $2;
    $438 = (($437) + 32|0);
    $439 = +HEAPF32[$438>>2];
    $440 = $1;
    $441 = (($440) + 32|0);
    $442 = +HEAPF32[$441>>2];
    $443 = $439 + $442;
    $444 = $443 / 2.0;
    $559 = $444;
   } else {
    $445 = $2;
    $446 = (($445) + 32|0);
    $447 = +HEAPF32[$446>>2];
    $448 = $1;
    $449 = (($448) + 32|0);
    $450 = +HEAPF32[$449>>2];
    $451 = $2;
    $452 = (($451) + 32|0);
    $453 = +HEAPF32[$452>>2];
    $454 = $450 - $453;
    $455 = $z1;
    $456 = $z1;
    $457 = $z2;
    $458 = $456 + $457;
    $459 = $455 / $458;
    $460 = $454 * $459;
    $461 = $447 + $460;
    $559 = $461;
   }
   $481 = $559;
  } else {
   $462 = $1;
   $463 = (($462) + 32|0);
   $464 = +HEAPF32[$463>>2];
   $465 = $2;
   $466 = (($465) + 32|0);
   $467 = +HEAPF32[$466>>2];
   $468 = $1;
   $469 = (($468) + 32|0);
   $470 = +HEAPF32[$469>>2];
   $471 = $467 - $470;
   $472 = $z2;
   $473 = $z1;
   $474 = $z2;
   $475 = $473 + $474;
   $476 = $472 / $475;
   $477 = $471 * $476;
   $478 = $464 + $477;
   $481 = $478;
  }
  $479 = $4;
  $480 = (($479) + 32|0);
  HEAPF32[$480>>2] = $481;
 }
 STACKTOP = sp;return;
}
function ___gl_memInit($maxFast) {
 $maxFast = $maxFast|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $maxFast;
 STACKTOP = sp;return 1;
}
function ___gl_meshMakeEdge($mesh) {
 $mesh = $mesh|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0;
 var $newFace = 0, $newVertex1 = 0, $newVertex2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $mesh;
 $2 = (_allocVertex()|0);
 $newVertex1 = $2;
 $3 = (_allocVertex()|0);
 $newVertex2 = $3;
 $4 = (_allocFace()|0);
 $newFace = $4;
 $5 = $newVertex1;
 $6 = ($5|0)==(0|0);
 if (!($6)) {
  $7 = $newVertex2;
  $8 = ($7|0)==(0|0);
  if (!($8)) {
   $9 = $newFace;
   $10 = ($9|0)==(0|0);
   if (!($10)) {
    $20 = $1;
    $21 = (($20) + 64|0);
    $22 = (_MakeEdge($21)|0);
    $e = $22;
    $23 = $e;
    $24 = ($23|0)==(0|0);
    if ($24) {
     $0 = 0;
     $38 = $0;
     STACKTOP = sp;return ($38|0);
    } else {
     $25 = $newVertex1;
     $26 = $e;
     $27 = $1;
     _MakeVertex($25,$26,$27);
     $28 = $newVertex2;
     $29 = $e;
     $30 = (($29) + 4|0);
     $31 = HEAP32[$30>>2]|0;
     $32 = $1;
     _MakeVertex($28,$31,$32);
     $33 = $newFace;
     $34 = $e;
     $35 = $1;
     $36 = (($35) + 40|0);
     _MakeFace($33,$34,$36);
     $37 = $e;
     $0 = $37;
     $38 = $0;
     STACKTOP = sp;return ($38|0);
    }
   }
  }
 }
 $11 = $newVertex1;
 $12 = ($11|0)!=(0|0);
 if ($12) {
  $13 = $newVertex1;
  _free($13);
 }
 $14 = $newVertex2;
 $15 = ($14|0)!=(0|0);
 if ($15) {
  $16 = $newVertex2;
  _free($16);
 }
 $17 = $newFace;
 $18 = ($17|0)!=(0|0);
 if ($18) {
  $19 = $newFace;
  _free($19);
 }
 $0 = 0;
 $38 = $0;
 STACKTOP = sp;return ($38|0);
}
function _MakeEdge($eNext) {
 $eNext = $eNext|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $ePrev = 0, $eSym = 0, $pair = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $eNext;
 $2 = (_malloc(64)|0);
 $pair = $2;
 $3 = $pair;
 $4 = ($3|0)==(0|0);
 if ($4) {
  $0 = 0;
  $67 = $0;
  STACKTOP = sp;return ($67|0);
 }
 $5 = $pair;
 $e = $5;
 $6 = $pair;
 $7 = (($6) + 32|0);
 $eSym = $7;
 $8 = $1;
 $9 = (($8) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = $1;
 $12 = ($10>>>0)<($11>>>0);
 if ($12) {
  $13 = $1;
  $14 = (($13) + 4|0);
  $15 = HEAP32[$14>>2]|0;
  $1 = $15;
 }
 $16 = $1;
 $17 = (($16) + 4|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = HEAP32[$18>>2]|0;
 $ePrev = $19;
 $20 = $ePrev;
 $21 = $eSym;
 HEAP32[$21>>2] = $20;
 $22 = $e;
 $23 = $ePrev;
 $24 = (($23) + 4|0);
 $25 = HEAP32[$24>>2]|0;
 HEAP32[$25>>2] = $22;
 $26 = $1;
 $27 = $e;
 HEAP32[$27>>2] = $26;
 $28 = $eSym;
 $29 = $1;
 $30 = (($29) + 4|0);
 $31 = HEAP32[$30>>2]|0;
 HEAP32[$31>>2] = $28;
 $32 = $eSym;
 $33 = $e;
 $34 = (($33) + 4|0);
 HEAP32[$34>>2] = $32;
 $35 = $e;
 $36 = $e;
 $37 = (($36) + 8|0);
 HEAP32[$37>>2] = $35;
 $38 = $eSym;
 $39 = $e;
 $40 = (($39) + 12|0);
 HEAP32[$40>>2] = $38;
 $41 = $e;
 $42 = (($41) + 16|0);
 HEAP32[$42>>2] = 0;
 $43 = $e;
 $44 = (($43) + 20|0);
 HEAP32[$44>>2] = 0;
 $45 = $e;
 $46 = (($45) + 28|0);
 HEAP32[$46>>2] = 0;
 $47 = $e;
 $48 = (($47) + 24|0);
 HEAP32[$48>>2] = 0;
 $49 = $e;
 $50 = $eSym;
 $51 = (($50) + 4|0);
 HEAP32[$51>>2] = $49;
 $52 = $eSym;
 $53 = $eSym;
 $54 = (($53) + 8|0);
 HEAP32[$54>>2] = $52;
 $55 = $e;
 $56 = $eSym;
 $57 = (($56) + 12|0);
 HEAP32[$57>>2] = $55;
 $58 = $eSym;
 $59 = (($58) + 16|0);
 HEAP32[$59>>2] = 0;
 $60 = $eSym;
 $61 = (($60) + 20|0);
 HEAP32[$61>>2] = 0;
 $62 = $eSym;
 $63 = (($62) + 28|0);
 HEAP32[$63>>2] = 0;
 $64 = $eSym;
 $65 = (($64) + 24|0);
 HEAP32[$65>>2] = 0;
 $66 = $e;
 $0 = $66;
 $67 = $0;
 STACKTOP = sp;return ($67|0);
}
function _MakeVertex($newVertex,$eOrig,$vNext) {
 $newVertex = $newVertex|0;
 $eOrig = $eOrig|0;
 $vNext = $vNext|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $vNew = 0, $vPrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $newVertex;
 $1 = $eOrig;
 $2 = $vNext;
 $3 = $0;
 $vNew = $3;
 $4 = $vNew;
 $5 = ($4|0)!=(0|0);
 if (!($5)) {
  ___assert_fail((680|0),(168|0),146,(696|0));
  // unreachable;
 }
 $6 = $2;
 $7 = (($6) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $vPrev = $8;
 $9 = $vPrev;
 $10 = $vNew;
 $11 = (($10) + 4|0);
 HEAP32[$11>>2] = $9;
 $12 = $vNew;
 $13 = $vPrev;
 HEAP32[$13>>2] = $12;
 $14 = $2;
 $15 = $vNew;
 HEAP32[$15>>2] = $14;
 $16 = $vNew;
 $17 = $2;
 $18 = (($17) + 4|0);
 HEAP32[$18>>2] = $16;
 $19 = $1;
 $20 = $vNew;
 $21 = (($20) + 8|0);
 HEAP32[$21>>2] = $19;
 $22 = $vNew;
 $23 = (($22) + 12|0);
 HEAP32[$23>>2] = 0;
 $24 = $1;
 $e = $24;
 while(1) {
  $25 = $vNew;
  $26 = $e;
  $27 = (($26) + 16|0);
  HEAP32[$27>>2] = $25;
  $28 = $e;
  $29 = (($28) + 8|0);
  $30 = HEAP32[$29>>2]|0;
  $e = $30;
  $31 = $e;
  $32 = $1;
  $33 = ($31|0)!=($32|0);
  if (!($33)) {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _MakeFace($newFace,$eOrig,$fNext) {
 $newFace = $newFace|0;
 $eOrig = $eOrig|0;
 $fNext = $fNext|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $e = 0, $fNew = 0, $fPrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $newFace;
 $1 = $eOrig;
 $2 = $fNext;
 $3 = $0;
 $fNew = $3;
 $4 = $fNew;
 $5 = ($4|0)!=(0|0);
 if (!($5)) {
  ___assert_fail((648|0),(168|0),180,(664|0));
  // unreachable;
 }
 $6 = $2;
 $7 = (($6) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $fPrev = $8;
 $9 = $fPrev;
 $10 = $fNew;
 $11 = (($10) + 4|0);
 HEAP32[$11>>2] = $9;
 $12 = $fNew;
 $13 = $fPrev;
 HEAP32[$13>>2] = $12;
 $14 = $2;
 $15 = $fNew;
 HEAP32[$15>>2] = $14;
 $16 = $fNew;
 $17 = $2;
 $18 = (($17) + 4|0);
 HEAP32[$18>>2] = $16;
 $19 = $1;
 $20 = $fNew;
 $21 = (($20) + 8|0);
 HEAP32[$21>>2] = $19;
 $22 = $fNew;
 $23 = (($22) + 12|0);
 HEAP32[$23>>2] = 0;
 $24 = $fNew;
 $25 = (($24) + 16|0);
 HEAP32[$25>>2] = 0;
 $26 = $fNew;
 $27 = (($26) + 20|0);
 HEAP8[$27>>0] = 0;
 $28 = $2;
 $29 = (($28) + 21|0);
 $30 = HEAP8[$29>>0]|0;
 $31 = $fNew;
 $32 = (($31) + 21|0);
 HEAP8[$32>>0] = $30;
 $33 = $1;
 $e = $33;
 while(1) {
  $34 = $fNew;
  $35 = $e;
  $36 = (($35) + 20|0);
  HEAP32[$36>>2] = $34;
  $37 = $e;
  $38 = (($37) + 12|0);
  $39 = HEAP32[$38>>2]|0;
  $e = $39;
  $40 = $e;
  $41 = $1;
  $42 = ($40|0)!=($41|0);
  if (!($42)) {
   break;
  }
 }
 STACKTOP = sp;return;
}
function ___gl_meshSplice($eOrg,$eDst) {
 $eOrg = $eOrg|0;
 $eDst = $eDst|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $7 = 0, $8 = 0, $9 = 0, $joiningLoops = 0, $joiningVertices = 0, $newFace = 0, $newVertex = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $eOrg;
 $2 = $eDst;
 $joiningLoops = 0;
 $joiningVertices = 0;
 $3 = $1;
 $4 = $2;
 $5 = ($3|0)==($4|0);
 if ($5) {
  $0 = 1;
  $64 = $0;
  STACKTOP = sp;return ($64|0);
 }
 $6 = $2;
 $7 = (($6) + 16|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = $1;
 $10 = (($9) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ($8|0)!=($11|0);
 if ($12) {
  $joiningVertices = 1;
  $13 = $2;
  $14 = (($13) + 16|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = $1;
  $17 = (($16) + 16|0);
  $18 = HEAP32[$17>>2]|0;
  _KillVertex($15,$18);
 }
 $19 = $2;
 $20 = (($19) + 20|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = $1;
 $23 = (($22) + 20|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ($21|0)!=($24|0);
 if ($25) {
  $joiningLoops = 1;
  $26 = $2;
  $27 = (($26) + 20|0);
  $28 = HEAP32[$27>>2]|0;
  $29 = $1;
  $30 = (($29) + 20|0);
  $31 = HEAP32[$30>>2]|0;
  _KillFace($28,$31);
 }
 $32 = $2;
 $33 = $1;
 _Splice($32,$33);
 $34 = $joiningVertices;
 $35 = ($34|0)!=(0);
 do {
  if (!($35)) {
   $36 = (_allocVertex()|0);
   $newVertex = $36;
   $37 = $newVertex;
   $38 = ($37|0)==(0|0);
   if (!($38)) {
    $39 = $newVertex;
    $40 = $2;
    $41 = $1;
    $42 = (($41) + 16|0);
    $43 = HEAP32[$42>>2]|0;
    _MakeVertex($39,$40,$43);
    $44 = $1;
    $45 = $1;
    $46 = (($45) + 16|0);
    $47 = HEAP32[$46>>2]|0;
    $48 = (($47) + 8|0);
    HEAP32[$48>>2] = $44;
    break;
   }
   $0 = 0;
   $64 = $0;
   STACKTOP = sp;return ($64|0);
  }
 } while(0);
 $49 = $joiningLoops;
 $50 = ($49|0)!=(0);
 do {
  if (!($50)) {
   $51 = (_allocFace()|0);
   $newFace = $51;
   $52 = $newFace;
   $53 = ($52|0)==(0|0);
   if (!($53)) {
    $54 = $newFace;
    $55 = $2;
    $56 = $1;
    $57 = (($56) + 20|0);
    $58 = HEAP32[$57>>2]|0;
    _MakeFace($54,$55,$58);
    $59 = $1;
    $60 = $1;
    $61 = (($60) + 20|0);
    $62 = HEAP32[$61>>2]|0;
    $63 = (($62) + 8|0);
    HEAP32[$63>>2] = $59;
    break;
   }
   $0 = 0;
   $64 = $0;
   STACKTOP = sp;return ($64|0);
  }
 } while(0);
 $0 = 1;
 $64 = $0;
 STACKTOP = sp;return ($64|0);
}
function _KillVertex($vDel,$newOrg) {
 $vDel = $vDel|0;
 $newOrg = $newOrg|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $eStart = 0, $vNext = 0, $vPrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $vDel;
 $1 = $newOrg;
 $2 = $0;
 $3 = (($2) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $eStart = $4;
 $5 = $eStart;
 $e = $5;
 while(1) {
  $6 = $1;
  $7 = $e;
  $8 = (($7) + 16|0);
  HEAP32[$8>>2] = $6;
  $9 = $e;
  $10 = (($9) + 8|0);
  $11 = HEAP32[$10>>2]|0;
  $e = $11;
  $12 = $e;
  $13 = $eStart;
  $14 = ($12|0)!=($13|0);
  if (!($14)) {
   break;
  }
 }
 $15 = $0;
 $16 = (($15) + 4|0);
 $17 = HEAP32[$16>>2]|0;
 $vPrev = $17;
 $18 = $0;
 $19 = HEAP32[$18>>2]|0;
 $vNext = $19;
 $20 = $vPrev;
 $21 = $vNext;
 $22 = (($21) + 4|0);
 HEAP32[$22>>2] = $20;
 $23 = $vNext;
 $24 = $vPrev;
 HEAP32[$24>>2] = $23;
 $25 = $0;
 _free($25);
 STACKTOP = sp;return;
}
function _KillFace($fDel,$newLface) {
 $fDel = $fDel|0;
 $newLface = $newLface|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $eStart = 0, $fNext = 0, $fPrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $fDel;
 $1 = $newLface;
 $2 = $0;
 $3 = (($2) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $eStart = $4;
 $5 = $eStart;
 $e = $5;
 while(1) {
  $6 = $1;
  $7 = $e;
  $8 = (($7) + 20|0);
  HEAP32[$8>>2] = $6;
  $9 = $e;
  $10 = (($9) + 12|0);
  $11 = HEAP32[$10>>2]|0;
  $e = $11;
  $12 = $e;
  $13 = $eStart;
  $14 = ($12|0)!=($13|0);
  if (!($14)) {
   break;
  }
 }
 $15 = $0;
 $16 = (($15) + 4|0);
 $17 = HEAP32[$16>>2]|0;
 $fPrev = $17;
 $18 = $0;
 $19 = HEAP32[$18>>2]|0;
 $fNext = $19;
 $20 = $fPrev;
 $21 = $fNext;
 $22 = (($21) + 4|0);
 HEAP32[$22>>2] = $20;
 $23 = $fNext;
 $24 = $fPrev;
 HEAP32[$24>>2] = $23;
 $25 = $0;
 _free($25);
 STACKTOP = sp;return;
}
function _Splice($a,$b) {
 $a = $a|0;
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $aOnext = 0, $bOnext = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $b;
 $2 = $0;
 $3 = (($2) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $aOnext = $4;
 $5 = $1;
 $6 = (($5) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $bOnext = $7;
 $8 = $1;
 $9 = $aOnext;
 $10 = (($9) + 4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = (($11) + 12|0);
 HEAP32[$12>>2] = $8;
 $13 = $0;
 $14 = $bOnext;
 $15 = (($14) + 4|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = (($16) + 12|0);
 HEAP32[$17>>2] = $13;
 $18 = $bOnext;
 $19 = $0;
 $20 = (($19) + 8|0);
 HEAP32[$20>>2] = $18;
 $21 = $aOnext;
 $22 = $1;
 $23 = (($22) + 8|0);
 HEAP32[$23>>2] = $21;
 STACKTOP = sp;return;
}
function ___gl_meshDelete($eDel) {
 $eDel = $eDel|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $eDelSym = 0;
 var $joiningLoops = 0, $newFace = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $eDel;
 $2 = $1;
 $3 = (($2) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $eDelSym = $4;
 $joiningLoops = 0;
 $5 = $1;
 $6 = (($5) + 20|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = $1;
 $9 = (($8) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = (($10) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ($7|0)!=($12|0);
 if ($13) {
  $joiningLoops = 1;
  $14 = $1;
  $15 = (($14) + 20|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = $1;
  $18 = (($17) + 4|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = (($19) + 20|0);
  $21 = HEAP32[$20>>2]|0;
  _KillFace($16,$21);
 }
 $22 = $1;
 $23 = (($22) + 8|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = $1;
 $26 = ($24|0)==($25|0);
 if ($26) {
  $27 = $1;
  $28 = (($27) + 16|0);
  $29 = HEAP32[$28>>2]|0;
  _KillVertex($29,0);
 } else {
  $30 = $1;
  $31 = (($30) + 4|0);
  $32 = HEAP32[$31>>2]|0;
  $33 = (($32) + 12|0);
  $34 = HEAP32[$33>>2]|0;
  $35 = $1;
  $36 = (($35) + 4|0);
  $37 = HEAP32[$36>>2]|0;
  $38 = (($37) + 20|0);
  $39 = HEAP32[$38>>2]|0;
  $40 = (($39) + 8|0);
  HEAP32[$40>>2] = $34;
  $41 = $1;
  $42 = (($41) + 8|0);
  $43 = HEAP32[$42>>2]|0;
  $44 = $1;
  $45 = (($44) + 16|0);
  $46 = HEAP32[$45>>2]|0;
  $47 = (($46) + 8|0);
  HEAP32[$47>>2] = $43;
  $48 = $1;
  $49 = $1;
  $50 = (($49) + 4|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = (($51) + 12|0);
  $53 = HEAP32[$52>>2]|0;
  _Splice($48,$53);
  $54 = $joiningLoops;
  $55 = ($54|0)!=(0);
  do {
   if (!($55)) {
    $56 = (_allocFace()|0);
    $newFace = $56;
    $57 = $newFace;
    $58 = ($57|0)==(0|0);
    if (!($58)) {
     $59 = $newFace;
     $60 = $1;
     $61 = $1;
     $62 = (($61) + 20|0);
     $63 = HEAP32[$62>>2]|0;
     _MakeFace($59,$60,$63);
     break;
    }
    $0 = 0;
    $98 = $0;
    STACKTOP = sp;return ($98|0);
   }
  } while(0);
 }
 $64 = $eDelSym;
 $65 = (($64) + 8|0);
 $66 = HEAP32[$65>>2]|0;
 $67 = $eDelSym;
 $68 = ($66|0)==($67|0);
 if ($68) {
  $69 = $eDelSym;
  $70 = (($69) + 16|0);
  $71 = HEAP32[$70>>2]|0;
  _KillVertex($71,0);
  $72 = $eDelSym;
  $73 = (($72) + 20|0);
  $74 = HEAP32[$73>>2]|0;
  _KillFace($74,0);
 } else {
  $75 = $eDelSym;
  $76 = (($75) + 4|0);
  $77 = HEAP32[$76>>2]|0;
  $78 = (($77) + 12|0);
  $79 = HEAP32[$78>>2]|0;
  $80 = $1;
  $81 = (($80) + 20|0);
  $82 = HEAP32[$81>>2]|0;
  $83 = (($82) + 8|0);
  HEAP32[$83>>2] = $79;
  $84 = $eDelSym;
  $85 = (($84) + 8|0);
  $86 = HEAP32[$85>>2]|0;
  $87 = $eDelSym;
  $88 = (($87) + 16|0);
  $89 = HEAP32[$88>>2]|0;
  $90 = (($89) + 8|0);
  HEAP32[$90>>2] = $86;
  $91 = $eDelSym;
  $92 = $eDelSym;
  $93 = (($92) + 4|0);
  $94 = HEAP32[$93>>2]|0;
  $95 = (($94) + 12|0);
  $96 = HEAP32[$95>>2]|0;
  _Splice($91,$96);
 }
 $97 = $1;
 _KillEdge($97);
 $0 = 1;
 $98 = $0;
 STACKTOP = sp;return ($98|0);
}
function _KillEdge($eDel) {
 $eDel = $eDel|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $eNext = 0, $ePrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $eDel;
 $1 = $0;
 $2 = (($1) + 4|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = $0;
 $5 = ($3>>>0)<($4>>>0);
 if ($5) {
  $6 = $0;
  $7 = (($6) + 4|0);
  $8 = HEAP32[$7>>2]|0;
  $0 = $8;
 }
 $9 = $0;
 $10 = HEAP32[$9>>2]|0;
 $eNext = $10;
 $11 = $0;
 $12 = (($11) + 4|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = HEAP32[$13>>2]|0;
 $ePrev = $14;
 $15 = $ePrev;
 $16 = $eNext;
 $17 = (($16) + 4|0);
 $18 = HEAP32[$17>>2]|0;
 HEAP32[$18>>2] = $15;
 $19 = $eNext;
 $20 = $ePrev;
 $21 = (($20) + 4|0);
 $22 = HEAP32[$21>>2]|0;
 HEAP32[$22>>2] = $19;
 $23 = $0;
 _free($23);
 STACKTOP = sp;return;
}
function ___gl_meshAddEdgeVertex($eOrg) {
 $eOrg = $eOrg|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $eNew = 0, $eNewSym = 0, $newVertex = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $eOrg;
 $2 = $1;
 $3 = (_MakeEdge($2)|0);
 $eNew = $3;
 $4 = $eNew;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $0 = 0;
  $36 = $0;
  STACKTOP = sp;return ($36|0);
 }
 $6 = $eNew;
 $7 = (($6) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $eNewSym = $8;
 $9 = $eNew;
 $10 = $1;
 $11 = (($10) + 12|0);
 $12 = HEAP32[$11>>2]|0;
 _Splice($9,$12);
 $13 = $1;
 $14 = (($13) + 4|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($15) + 16|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = $eNew;
 $19 = (($18) + 16|0);
 HEAP32[$19>>2] = $17;
 $20 = (_allocVertex()|0);
 $newVertex = $20;
 $21 = $newVertex;
 $22 = ($21|0)==(0|0);
 if ($22) {
  $0 = 0;
  $36 = $0;
  STACKTOP = sp;return ($36|0);
 } else {
  $23 = $newVertex;
  $24 = $eNewSym;
  $25 = $eNew;
  $26 = (($25) + 16|0);
  $27 = HEAP32[$26>>2]|0;
  _MakeVertex($23,$24,$27);
  $28 = $1;
  $29 = (($28) + 20|0);
  $30 = HEAP32[$29>>2]|0;
  $31 = $eNewSym;
  $32 = (($31) + 20|0);
  HEAP32[$32>>2] = $30;
  $33 = $eNew;
  $34 = (($33) + 20|0);
  HEAP32[$34>>2] = $30;
  $35 = $eNew;
  $0 = $35;
  $36 = $0;
  STACKTOP = sp;return ($36|0);
 }
 return 0|0;
}
function ___gl_meshSplitEdge($eOrg) {
 $eOrg = $eOrg|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $7 = 0, $8 = 0, $9 = 0, $eNew = 0, $tempHalfEdge = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $eOrg;
 $2 = $1;
 $3 = (___gl_meshAddEdgeVertex($2)|0);
 $tempHalfEdge = $3;
 $4 = $tempHalfEdge;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $0 = 0;
  $63 = $0;
  STACKTOP = sp;return ($63|0);
 } else {
  $6 = $tempHalfEdge;
  $7 = (($6) + 4|0);
  $8 = HEAP32[$7>>2]|0;
  $eNew = $8;
  $9 = $1;
  $10 = (($9) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = $1;
  $13 = (($12) + 4|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = (($14) + 4|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = (($16) + 12|0);
  $18 = HEAP32[$17>>2]|0;
  _Splice($11,$18);
  $19 = $1;
  $20 = (($19) + 4|0);
  $21 = HEAP32[$20>>2]|0;
  $22 = $eNew;
  _Splice($21,$22);
  $23 = $eNew;
  $24 = (($23) + 16|0);
  $25 = HEAP32[$24>>2]|0;
  $26 = $1;
  $27 = (($26) + 4|0);
  $28 = HEAP32[$27>>2]|0;
  $29 = (($28) + 16|0);
  HEAP32[$29>>2] = $25;
  $30 = $eNew;
  $31 = (($30) + 4|0);
  $32 = HEAP32[$31>>2]|0;
  $33 = $eNew;
  $34 = (($33) + 4|0);
  $35 = HEAP32[$34>>2]|0;
  $36 = (($35) + 16|0);
  $37 = HEAP32[$36>>2]|0;
  $38 = (($37) + 8|0);
  HEAP32[$38>>2] = $32;
  $39 = $1;
  $40 = (($39) + 4|0);
  $41 = HEAP32[$40>>2]|0;
  $42 = (($41) + 20|0);
  $43 = HEAP32[$42>>2]|0;
  $44 = $eNew;
  $45 = (($44) + 4|0);
  $46 = HEAP32[$45>>2]|0;
  $47 = (($46) + 20|0);
  HEAP32[$47>>2] = $43;
  $48 = $1;
  $49 = (($48) + 28|0);
  $50 = HEAP32[$49>>2]|0;
  $51 = $eNew;
  $52 = (($51) + 28|0);
  HEAP32[$52>>2] = $50;
  $53 = $1;
  $54 = (($53) + 4|0);
  $55 = HEAP32[$54>>2]|0;
  $56 = (($55) + 28|0);
  $57 = HEAP32[$56>>2]|0;
  $58 = $eNew;
  $59 = (($58) + 4|0);
  $60 = HEAP32[$59>>2]|0;
  $61 = (($60) + 28|0);
  HEAP32[$61>>2] = $57;
  $62 = $eNew;
  $0 = $62;
  $63 = $0;
  STACKTOP = sp;return ($63|0);
 }
 return 0|0;
}
function ___gl_meshConnect($eOrg,$eDst) {
 $eOrg = $eOrg|0;
 $eDst = $eDst|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $7 = 0, $8 = 0, $9 = 0, $eNew = 0, $eNewSym = 0, $joiningLoops = 0, $newFace = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $eOrg;
 $2 = $eDst;
 $joiningLoops = 0;
 $3 = $1;
 $4 = (_MakeEdge($3)|0);
 $eNew = $4;
 $5 = $eNew;
 $6 = ($5|0)==(0|0);
 if ($6) {
  $0 = 0;
  $64 = $0;
  STACKTOP = sp;return ($64|0);
 }
 $7 = $eNew;
 $8 = (($7) + 4|0);
 $9 = HEAP32[$8>>2]|0;
 $eNewSym = $9;
 $10 = $2;
 $11 = (($10) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = $1;
 $14 = (($13) + 20|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ($12|0)!=($15|0);
 if ($16) {
  $joiningLoops = 1;
  $17 = $2;
  $18 = (($17) + 20|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = $1;
  $21 = (($20) + 20|0);
  $22 = HEAP32[$21>>2]|0;
  _KillFace($19,$22);
 }
 $23 = $eNew;
 $24 = $1;
 $25 = (($24) + 12|0);
 $26 = HEAP32[$25>>2]|0;
 _Splice($23,$26);
 $27 = $eNewSym;
 $28 = $2;
 _Splice($27,$28);
 $29 = $1;
 $30 = (($29) + 4|0);
 $31 = HEAP32[$30>>2]|0;
 $32 = (($31) + 16|0);
 $33 = HEAP32[$32>>2]|0;
 $34 = $eNew;
 $35 = (($34) + 16|0);
 HEAP32[$35>>2] = $33;
 $36 = $2;
 $37 = (($36) + 16|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = $eNewSym;
 $40 = (($39) + 16|0);
 HEAP32[$40>>2] = $38;
 $41 = $1;
 $42 = (($41) + 20|0);
 $43 = HEAP32[$42>>2]|0;
 $44 = $eNewSym;
 $45 = (($44) + 20|0);
 HEAP32[$45>>2] = $43;
 $46 = $eNew;
 $47 = (($46) + 20|0);
 HEAP32[$47>>2] = $43;
 $48 = $eNewSym;
 $49 = $1;
 $50 = (($49) + 20|0);
 $51 = HEAP32[$50>>2]|0;
 $52 = (($51) + 8|0);
 HEAP32[$52>>2] = $48;
 $53 = $joiningLoops;
 $54 = ($53|0)!=(0);
 do {
  if (!($54)) {
   $55 = (_allocFace()|0);
   $newFace = $55;
   $56 = $newFace;
   $57 = ($56|0)==(0|0);
   if (!($57)) {
    $58 = $newFace;
    $59 = $eNew;
    $60 = $1;
    $61 = (($60) + 20|0);
    $62 = HEAP32[$61>>2]|0;
    _MakeFace($58,$59,$62);
    break;
   }
   $0 = 0;
   $64 = $0;
   STACKTOP = sp;return ($64|0);
  }
 } while(0);
 $63 = $eNew;
 $0 = $63;
 $64 = $0;
 STACKTOP = sp;return ($64|0);
}
function ___gl_meshZapFace($fZap) {
 $fZap = $fZap|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $8 = 0, $9 = 0, $e = 0;
 var $eNext = 0, $eStart = 0, $eSym = 0, $fNext = 0, $fPrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $fZap;
 $1 = $0;
 $2 = (($1) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $eStart = $3;
 $4 = $eStart;
 $5 = (($4) + 12|0);
 $6 = HEAP32[$5>>2]|0;
 $eNext = $6;
 while(1) {
  $7 = $eNext;
  $e = $7;
  $8 = $e;
  $9 = (($8) + 12|0);
  $10 = HEAP32[$9>>2]|0;
  $eNext = $10;
  $11 = $e;
  $12 = (($11) + 20|0);
  HEAP32[$12>>2] = 0;
  $13 = $e;
  $14 = (($13) + 4|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = (($15) + 20|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = ($17|0)==(0|0);
  if ($18) {
   $19 = $e;
   $20 = (($19) + 8|0);
   $21 = HEAP32[$20>>2]|0;
   $22 = $e;
   $23 = ($21|0)==($22|0);
   if ($23) {
    $24 = $e;
    $25 = (($24) + 16|0);
    $26 = HEAP32[$25>>2]|0;
    _KillVertex($26,0);
   } else {
    $27 = $e;
    $28 = (($27) + 8|0);
    $29 = HEAP32[$28>>2]|0;
    $30 = $e;
    $31 = (($30) + 16|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = (($32) + 8|0);
    HEAP32[$33>>2] = $29;
    $34 = $e;
    $35 = $e;
    $36 = (($35) + 4|0);
    $37 = HEAP32[$36>>2]|0;
    $38 = (($37) + 12|0);
    $39 = HEAP32[$38>>2]|0;
    _Splice($34,$39);
   }
   $40 = $e;
   $41 = (($40) + 4|0);
   $42 = HEAP32[$41>>2]|0;
   $eSym = $42;
   $43 = $eSym;
   $44 = (($43) + 8|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = $eSym;
   $47 = ($45|0)==($46|0);
   if ($47) {
    $48 = $eSym;
    $49 = (($48) + 16|0);
    $50 = HEAP32[$49>>2]|0;
    _KillVertex($50,0);
   } else {
    $51 = $eSym;
    $52 = (($51) + 8|0);
    $53 = HEAP32[$52>>2]|0;
    $54 = $eSym;
    $55 = (($54) + 16|0);
    $56 = HEAP32[$55>>2]|0;
    $57 = (($56) + 8|0);
    HEAP32[$57>>2] = $53;
    $58 = $eSym;
    $59 = $eSym;
    $60 = (($59) + 4|0);
    $61 = HEAP32[$60>>2]|0;
    $62 = (($61) + 12|0);
    $63 = HEAP32[$62>>2]|0;
    _Splice($58,$63);
   }
   $64 = $e;
   _KillEdge($64);
  }
  $65 = $e;
  $66 = $eStart;
  $67 = ($65|0)!=($66|0);
  if (!($67)) {
   break;
  }
 }
 $68 = $0;
 $69 = (($68) + 4|0);
 $70 = HEAP32[$69>>2]|0;
 $fPrev = $70;
 $71 = $0;
 $72 = HEAP32[$71>>2]|0;
 $fNext = $72;
 $73 = $fPrev;
 $74 = $fNext;
 $75 = (($74) + 4|0);
 HEAP32[$75>>2] = $73;
 $76 = $fNext;
 $77 = $fPrev;
 HEAP32[$77>>2] = $76;
 $78 = $0;
 _free($78);
 STACKTOP = sp;return;
}
function ___gl_meshNewMesh() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $eSym = 0, $f = 0, $mesh = 0, $v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = (_malloc(128)|0);
 $mesh = $1;
 $2 = $mesh;
 $3 = ($2|0)==(0|0);
 if ($3) {
  $0 = 0;
  $68 = $0;
  STACKTOP = sp;return ($68|0);
 } else {
  $4 = $mesh;
  $v = $4;
  $5 = $mesh;
  $6 = (($5) + 40|0);
  $f = $6;
  $7 = $mesh;
  $8 = (($7) + 64|0);
  $e = $8;
  $9 = $mesh;
  $10 = (($9) + 96|0);
  $eSym = $10;
  $11 = $v;
  $12 = $v;
  $13 = (($12) + 4|0);
  HEAP32[$13>>2] = $11;
  $14 = $v;
  HEAP32[$14>>2] = $11;
  $15 = $v;
  $16 = (($15) + 8|0);
  HEAP32[$16>>2] = 0;
  $17 = $v;
  $18 = (($17) + 12|0);
  HEAP32[$18>>2] = 0;
  $19 = $f;
  $20 = $f;
  $21 = (($20) + 4|0);
  HEAP32[$21>>2] = $19;
  $22 = $f;
  HEAP32[$22>>2] = $19;
  $23 = $f;
  $24 = (($23) + 8|0);
  HEAP32[$24>>2] = 0;
  $25 = $f;
  $26 = (($25) + 12|0);
  HEAP32[$26>>2] = 0;
  $27 = $f;
  $28 = (($27) + 16|0);
  HEAP32[$28>>2] = 0;
  $29 = $f;
  $30 = (($29) + 20|0);
  HEAP8[$30>>0] = 0;
  $31 = $f;
  $32 = (($31) + 21|0);
  HEAP8[$32>>0] = 0;
  $33 = $e;
  $34 = $e;
  HEAP32[$34>>2] = $33;
  $35 = $eSym;
  $36 = $e;
  $37 = (($36) + 4|0);
  HEAP32[$37>>2] = $35;
  $38 = $e;
  $39 = (($38) + 8|0);
  HEAP32[$39>>2] = 0;
  $40 = $e;
  $41 = (($40) + 12|0);
  HEAP32[$41>>2] = 0;
  $42 = $e;
  $43 = (($42) + 16|0);
  HEAP32[$43>>2] = 0;
  $44 = $e;
  $45 = (($44) + 20|0);
  HEAP32[$45>>2] = 0;
  $46 = $e;
  $47 = (($46) + 28|0);
  HEAP32[$47>>2] = 0;
  $48 = $e;
  $49 = (($48) + 24|0);
  HEAP32[$49>>2] = 0;
  $50 = $eSym;
  $51 = $eSym;
  HEAP32[$51>>2] = $50;
  $52 = $e;
  $53 = $eSym;
  $54 = (($53) + 4|0);
  HEAP32[$54>>2] = $52;
  $55 = $eSym;
  $56 = (($55) + 8|0);
  HEAP32[$56>>2] = 0;
  $57 = $eSym;
  $58 = (($57) + 12|0);
  HEAP32[$58>>2] = 0;
  $59 = $eSym;
  $60 = (($59) + 16|0);
  HEAP32[$60>>2] = 0;
  $61 = $eSym;
  $62 = (($61) + 20|0);
  HEAP32[$62>>2] = 0;
  $63 = $eSym;
  $64 = (($63) + 28|0);
  HEAP32[$64>>2] = 0;
  $65 = $eSym;
  $66 = (($65) + 24|0);
  HEAP32[$66>>2] = 0;
  $67 = $mesh;
  $0 = $67;
  $68 = $0;
  STACKTOP = sp;return ($68|0);
 }
 return 0|0;
}
function ___gl_meshDeleteMesh($mesh) {
 $mesh = $mesh|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $eNext = 0, $f = 0, $fNext = 0, $v = 0, $vNext = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $mesh;
 $1 = $0;
 $2 = (($1) + 40|0);
 $3 = HEAP32[$2>>2]|0;
 $f = $3;
 while(1) {
  $4 = $f;
  $5 = $0;
  $6 = (($5) + 40|0);
  $7 = ($4|0)!=($6|0);
  if (!($7)) {
   break;
  }
  $8 = $f;
  $9 = HEAP32[$8>>2]|0;
  $fNext = $9;
  $10 = $f;
  _free($10);
  $11 = $fNext;
  $f = $11;
 }
 $12 = $0;
 $13 = HEAP32[$12>>2]|0;
 $v = $13;
 while(1) {
  $14 = $v;
  $15 = $0;
  $16 = ($14|0)!=($15|0);
  if (!($16)) {
   break;
  }
  $17 = $v;
  $18 = HEAP32[$17>>2]|0;
  $vNext = $18;
  $19 = $v;
  _free($19);
  $20 = $vNext;
  $v = $20;
 }
 $21 = $0;
 $22 = (($21) + 64|0);
 $23 = HEAP32[$22>>2]|0;
 $e = $23;
 while(1) {
  $24 = $e;
  $25 = $0;
  $26 = (($25) + 64|0);
  $27 = ($24|0)!=($26|0);
  if (!($27)) {
   break;
  }
  $28 = $e;
  $29 = HEAP32[$28>>2]|0;
  $eNext = $29;
  $30 = $e;
  _free($30);
  $31 = $eNext;
  $e = $31;
 }
 $32 = $0;
 _free($32);
 STACKTOP = sp;return;
}
function ___gl_meshCheckMesh($mesh) {
 $mesh = $mesh|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, $99 = 0, $e = 0, $eHead = 0, $ePrev = 0, $f = 0, $fHead = 0, $fPrev = 0, $v = 0, $vHead = 0, $vPrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $mesh;
 $1 = $0;
 $2 = (($1) + 40|0);
 $fHead = $2;
 $3 = $0;
 $vHead = $3;
 $4 = $0;
 $5 = (($4) + 64|0);
 $eHead = $5;
 $6 = $fHead;
 $fPrev = $6;
 $7 = $fHead;
 $fPrev = $7;
 L1: while(1) {
  $8 = $fPrev;
  $9 = HEAP32[$8>>2]|0;
  $f = $9;
  $10 = $fHead;
  $11 = ($9|0)!=($10|0);
  if (!($11)) {
   label = 20;
   break;
  }
  $12 = $f;
  $13 = (($12) + 4|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = $fPrev;
  $16 = ($14|0)==($15|0);
  if (!($16)) {
   label = 4;
   break;
  }
  $17 = $f;
  $18 = (($17) + 8|0);
  $19 = HEAP32[$18>>2]|0;
  $e = $19;
  while(1) {
   $20 = $e;
   $21 = (($20) + 4|0);
   $22 = HEAP32[$21>>2]|0;
   $23 = $e;
   $24 = ($22|0)!=($23|0);
   if (!($24)) {
    label = 7;
    break L1;
   }
   $25 = $e;
   $26 = (($25) + 4|0);
   $27 = HEAP32[$26>>2]|0;
   $28 = (($27) + 4|0);
   $29 = HEAP32[$28>>2]|0;
   $30 = $e;
   $31 = ($29|0)==($30|0);
   if (!($31)) {
    label = 9;
    break L1;
   }
   $32 = $e;
   $33 = (($32) + 12|0);
   $34 = HEAP32[$33>>2]|0;
   $35 = (($34) + 8|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = (($36) + 4|0);
   $38 = HEAP32[$37>>2]|0;
   $39 = $e;
   $40 = ($38|0)==($39|0);
   if (!($40)) {
    label = 11;
    break L1;
   }
   $41 = $e;
   $42 = (($41) + 8|0);
   $43 = HEAP32[$42>>2]|0;
   $44 = (($43) + 4|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = (($45) + 12|0);
   $47 = HEAP32[$46>>2]|0;
   $48 = $e;
   $49 = ($47|0)==($48|0);
   if (!($49)) {
    label = 13;
    break L1;
   }
   $50 = $e;
   $51 = (($50) + 20|0);
   $52 = HEAP32[$51>>2]|0;
   $53 = $f;
   $54 = ($52|0)==($53|0);
   if (!($54)) {
    label = 15;
    break L1;
   }
   $55 = $e;
   $56 = (($55) + 12|0);
   $57 = HEAP32[$56>>2]|0;
   $e = $57;
   $58 = $e;
   $59 = $f;
   $60 = (($59) + 8|0);
   $61 = HEAP32[$60>>2]|0;
   $62 = ($58|0)!=($61|0);
   if (!($62)) {
    break;
   }
  }
  $63 = $f;
  $fPrev = $63;
 }
 if ((label|0) == 4) {
  ___assert_fail((152|0),(168|0),830,(176|0));
  // unreachable;
 }
 else if ((label|0) == 7) {
  ___assert_fail((200|0),(168|0),833,(176|0));
  // unreachable;
 }
 else if ((label|0) == 9) {
  ___assert_fail((216|0),(168|0),834,(176|0));
  // unreachable;
 }
 else if ((label|0) == 11) {
  ___assert_fail((232|0),(168|0),835,(176|0));
  // unreachable;
 }
 else if ((label|0) == 13) {
  ___assert_fail((256|0),(168|0),836,(176|0));
  // unreachable;
 }
 else if ((label|0) == 15) {
  ___assert_fail((280|0),(168|0),837,(176|0));
  // unreachable;
 }
 else if ((label|0) == 20) {
  $64 = $f;
  $65 = (($64) + 4|0);
  $66 = HEAP32[$65>>2]|0;
  $67 = $fPrev;
  $68 = ($66|0)==($67|0);
  if (!($68)) {
   ___assert_fail((296|0),(168|0),841,(176|0));
   // unreachable;
  }
  $69 = $f;
  $70 = (($69) + 8|0);
  $71 = HEAP32[$70>>2]|0;
  $72 = ($71|0)==(0|0);
  if (!($72)) {
   ___assert_fail((296|0),(168|0),841,(176|0));
   // unreachable;
  }
  $73 = $f;
  $74 = (($73) + 12|0);
  $75 = HEAP32[$74>>2]|0;
  $76 = ($75|0)==(0|0);
  if (!($76)) {
   ___assert_fail((296|0),(168|0),841,(176|0));
   // unreachable;
  }
  $77 = $vHead;
  $vPrev = $77;
  $78 = $vHead;
  $vPrev = $78;
  L29: while(1) {
   $79 = $vPrev;
   $80 = HEAP32[$79>>2]|0;
   $v = $80;
   $81 = $vHead;
   $82 = ($80|0)!=($81|0);
   if (!($82)) {
    label = 43;
    break;
   }
   $83 = $v;
   $84 = (($83) + 4|0);
   $85 = HEAP32[$84>>2]|0;
   $86 = $vPrev;
   $87 = ($85|0)==($86|0);
   if (!($87)) {
    label = 27;
    break;
   }
   $88 = $v;
   $89 = (($88) + 8|0);
   $90 = HEAP32[$89>>2]|0;
   $e = $90;
   while(1) {
    $91 = $e;
    $92 = (($91) + 4|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = $e;
    $95 = ($93|0)!=($94|0);
    if (!($95)) {
     label = 30;
     break L29;
    }
    $96 = $e;
    $97 = (($96) + 4|0);
    $98 = HEAP32[$97>>2]|0;
    $99 = (($98) + 4|0);
    $100 = HEAP32[$99>>2]|0;
    $101 = $e;
    $102 = ($100|0)==($101|0);
    if (!($102)) {
     label = 32;
     break L29;
    }
    $103 = $e;
    $104 = (($103) + 12|0);
    $105 = HEAP32[$104>>2]|0;
    $106 = (($105) + 8|0);
    $107 = HEAP32[$106>>2]|0;
    $108 = (($107) + 4|0);
    $109 = HEAP32[$108>>2]|0;
    $110 = $e;
    $111 = ($109|0)==($110|0);
    if (!($111)) {
     label = 34;
     break L29;
    }
    $112 = $e;
    $113 = (($112) + 8|0);
    $114 = HEAP32[$113>>2]|0;
    $115 = (($114) + 4|0);
    $116 = HEAP32[$115>>2]|0;
    $117 = (($116) + 12|0);
    $118 = HEAP32[$117>>2]|0;
    $119 = $e;
    $120 = ($118|0)==($119|0);
    if (!($120)) {
     label = 36;
     break L29;
    }
    $121 = $e;
    $122 = (($121) + 16|0);
    $123 = HEAP32[$122>>2]|0;
    $124 = $v;
    $125 = ($123|0)==($124|0);
    if (!($125)) {
     label = 38;
     break L29;
    }
    $126 = $e;
    $127 = (($126) + 8|0);
    $128 = HEAP32[$127>>2]|0;
    $e = $128;
    $129 = $e;
    $130 = $v;
    $131 = (($130) + 8|0);
    $132 = HEAP32[$131>>2]|0;
    $133 = ($129|0)!=($132|0);
    if (!($133)) {
     break;
    }
   }
   $134 = $v;
   $vPrev = $134;
  }
  if ((label|0) == 27) {
   ___assert_fail((352|0),(168|0),846,(176|0));
   // unreachable;
  }
  else if ((label|0) == 30) {
   ___assert_fail((200|0),(168|0),849,(176|0));
   // unreachable;
  }
  else if ((label|0) == 32) {
   ___assert_fail((216|0),(168|0),850,(176|0));
   // unreachable;
  }
  else if ((label|0) == 34) {
   ___assert_fail((232|0),(168|0),851,(176|0));
   // unreachable;
  }
  else if ((label|0) == 36) {
   ___assert_fail((256|0),(168|0),852,(176|0));
   // unreachable;
  }
  else if ((label|0) == 38) {
   ___assert_fail((368|0),(168|0),853,(176|0));
   // unreachable;
  }
  else if ((label|0) == 43) {
   $135 = $v;
   $136 = (($135) + 4|0);
   $137 = HEAP32[$136>>2]|0;
   $138 = $vPrev;
   $139 = ($137|0)==($138|0);
   if (!($139)) {
    ___assert_fail((384|0),(168|0),857,(176|0));
    // unreachable;
   }
   $140 = $v;
   $141 = (($140) + 8|0);
   $142 = HEAP32[$141>>2]|0;
   $143 = ($142|0)==(0|0);
   if (!($143)) {
    ___assert_fail((384|0),(168|0),857,(176|0));
    // unreachable;
   }
   $144 = $v;
   $145 = (($144) + 12|0);
   $146 = HEAP32[$145>>2]|0;
   $147 = ($146|0)==(0|0);
   if (!($147)) {
    ___assert_fail((384|0),(168|0),857,(176|0));
    // unreachable;
   }
   $148 = $eHead;
   $ePrev = $148;
   $149 = $eHead;
   $ePrev = $149;
   while(1) {
    $150 = $ePrev;
    $151 = HEAP32[$150>>2]|0;
    $e = $151;
    $152 = $eHead;
    $153 = ($151|0)!=($152|0);
    if (!($153)) {
     label = 65;
     break;
    }
    $154 = $e;
    $155 = (($154) + 4|0);
    $156 = HEAP32[$155>>2]|0;
    $157 = HEAP32[$156>>2]|0;
    $158 = $ePrev;
    $159 = (($158) + 4|0);
    $160 = HEAP32[$159>>2]|0;
    $161 = ($157|0)==($160|0);
    if (!($161)) {
     label = 50;
     break;
    }
    $162 = $e;
    $163 = (($162) + 4|0);
    $164 = HEAP32[$163>>2]|0;
    $165 = $e;
    $166 = ($164|0)!=($165|0);
    if (!($166)) {
     label = 52;
     break;
    }
    $167 = $e;
    $168 = (($167) + 4|0);
    $169 = HEAP32[$168>>2]|0;
    $170 = (($169) + 4|0);
    $171 = HEAP32[$170>>2]|0;
    $172 = $e;
    $173 = ($171|0)==($172|0);
    if (!($173)) {
     label = 54;
     break;
    }
    $174 = $e;
    $175 = (($174) + 16|0);
    $176 = HEAP32[$175>>2]|0;
    $177 = ($176|0)!=(0|0);
    if (!($177)) {
     label = 56;
     break;
    }
    $178 = $e;
    $179 = (($178) + 4|0);
    $180 = HEAP32[$179>>2]|0;
    $181 = (($180) + 16|0);
    $182 = HEAP32[$181>>2]|0;
    $183 = ($182|0)!=(0|0);
    if (!($183)) {
     label = 58;
     break;
    }
    $184 = $e;
    $185 = (($184) + 12|0);
    $186 = HEAP32[$185>>2]|0;
    $187 = (($186) + 8|0);
    $188 = HEAP32[$187>>2]|0;
    $189 = (($188) + 4|0);
    $190 = HEAP32[$189>>2]|0;
    $191 = $e;
    $192 = ($190|0)==($191|0);
    if (!($192)) {
     label = 60;
     break;
    }
    $193 = $e;
    $194 = (($193) + 8|0);
    $195 = HEAP32[$194>>2]|0;
    $196 = (($195) + 4|0);
    $197 = HEAP32[$196>>2]|0;
    $198 = (($197) + 12|0);
    $199 = HEAP32[$198>>2]|0;
    $200 = $e;
    $201 = ($199|0)==($200|0);
    if (!($201)) {
     label = 62;
     break;
    }
    $202 = $e;
    $ePrev = $202;
   }
   if ((label|0) == 50) {
    ___assert_fail((440|0),(168|0),862,(176|0));
    // unreachable;
   }
   else if ((label|0) == 52) {
    ___assert_fail((200|0),(168|0),863,(176|0));
    // unreachable;
   }
   else if ((label|0) == 54) {
    ___assert_fail((216|0),(168|0),864,(176|0));
    // unreachable;
   }
   else if ((label|0) == 56) {
    ___assert_fail((472|0),(168|0),865,(176|0));
    // unreachable;
   }
   else if ((label|0) == 58) {
    ___assert_fail((488|0),(168|0),866,(176|0));
    // unreachable;
   }
   else if ((label|0) == 60) {
    ___assert_fail((232|0),(168|0),867,(176|0));
    // unreachable;
   }
   else if ((label|0) == 62) {
    ___assert_fail((256|0),(168|0),868,(176|0));
    // unreachable;
   }
   else if ((label|0) == 65) {
    $203 = $e;
    $204 = (($203) + 4|0);
    $205 = HEAP32[$204>>2]|0;
    $206 = HEAP32[$205>>2]|0;
    $207 = $ePrev;
    $208 = (($207) + 4|0);
    $209 = HEAP32[$208>>2]|0;
    $210 = ($206|0)==($209|0);
    if (!($210)) {
     ___assert_fail((504|0),(168|0),872,(176|0));
     // unreachable;
    }
    $211 = $e;
    $212 = (($211) + 4|0);
    $213 = HEAP32[$212>>2]|0;
    $214 = $0;
    $215 = (($214) + 96|0);
    $216 = ($213|0)==($215|0);
    if (!($216)) {
     ___assert_fail((504|0),(168|0),872,(176|0));
     // unreachable;
    }
    $217 = $e;
    $218 = (($217) + 4|0);
    $219 = HEAP32[$218>>2]|0;
    $220 = (($219) + 4|0);
    $221 = HEAP32[$220>>2]|0;
    $222 = $e;
    $223 = ($221|0)==($222|0);
    if (!($223)) {
     ___assert_fail((504|0),(168|0),872,(176|0));
     // unreachable;
    }
    $224 = $e;
    $225 = (($224) + 16|0);
    $226 = HEAP32[$225>>2]|0;
    $227 = ($226|0)==(0|0);
    if (!($227)) {
     ___assert_fail((504|0),(168|0),872,(176|0));
     // unreachable;
    }
    $228 = $e;
    $229 = (($228) + 4|0);
    $230 = HEAP32[$229>>2]|0;
    $231 = (($230) + 16|0);
    $232 = HEAP32[$231>>2]|0;
    $233 = ($232|0)==(0|0);
    if (!($233)) {
     ___assert_fail((504|0),(168|0),872,(176|0));
     // unreachable;
    }
    $234 = $e;
    $235 = (($234) + 20|0);
    $236 = HEAP32[$235>>2]|0;
    $237 = ($236|0)==(0|0);
    if (!($237)) {
     ___assert_fail((504|0),(168|0),872,(176|0));
     // unreachable;
    }
    $238 = $e;
    $239 = (($238) + 4|0);
    $240 = HEAP32[$239>>2]|0;
    $241 = (($240) + 20|0);
    $242 = HEAP32[$241>>2]|0;
    $243 = ($242|0)==(0|0);
    if ($243) {
     STACKTOP = sp;return;
    } else {
     ___assert_fail((504|0),(168|0),872,(176|0));
     // unreachable;
    }
   }
  }
 }
}
function _allocFace() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_malloc(24)|0);
 STACKTOP = sp;return ($0|0);
}
function _allocVertex() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_malloc(40)|0);
 STACKTOP = sp;return ($0|0);
}
function ___gl_projectPolygon($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0.0, $100 = 0.0, $101 = 0, $102 = 0.0, $103 = 0.0, $104 = 0, $105 = 0, $106 = 0, $107 = 0.0, $108 = 0, $109 = 0, $11 = 0, $110 = 0.0, $111 = 0.0, $112 = 0.0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0.0, $117 = 0, $118 = 0, $119 = 0.0, $12 = 0, $120 = 0.0, $121 = 0.0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0.0, $6 = 0.0, $60 = 0, $61 = 0.0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0;
 var $73 = 0, $74 = 0.0, $75 = 0, $76 = 0.0, $77 = 0.0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0.0, $82 = 0, $83 = 0, $84 = 0.0, $85 = 0.0, $86 = 0.0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0.0;
 var $91 = 0, $92 = 0, $93 = 0.0, $94 = 0.0, $95 = 0.0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $computedNormal = 0, $i = 0, $norm = 0, $sUnit = 0, $tUnit = 0, $v = 0, $vHead = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $norm = sp + 8|0;
 $0 = $tess;
 $1 = $0;
 $2 = (($1) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $vHead = $3;
 $computedNormal = 0;
 $4 = $0;
 $5 = (($4) + 16|0);
 $6 = +HEAPF32[$5>>2];
 HEAPF32[$norm>>2] = $6;
 $7 = $0;
 $8 = (($7) + 16|0);
 $9 = (($8) + 4|0);
 $10 = +HEAPF32[$9>>2];
 $11 = (($norm) + 4|0);
 HEAPF32[$11>>2] = $10;
 $12 = $0;
 $13 = (($12) + 16|0);
 $14 = (($13) + 8|0);
 $15 = +HEAPF32[$14>>2];
 $16 = (($norm) + 8|0);
 HEAPF32[$16>>2] = $15;
 $17 = +HEAPF32[$norm>>2];
 $18 = $17 == 0.0;
 if ($18) {
  $19 = (($norm) + 4|0);
  $20 = +HEAPF32[$19>>2];
  $21 = $20 == 0.0;
  if ($21) {
   $22 = (($norm) + 8|0);
   $23 = +HEAPF32[$22>>2];
   $24 = $23 == 0.0;
   if ($24) {
    $25 = $0;
    _ComputeNormal($25,$norm);
    $computedNormal = 1;
   }
  }
 }
 $26 = $0;
 $27 = (($26) + 28|0);
 $sUnit = $27;
 $28 = $0;
 $29 = (($28) + 40|0);
 $tUnit = $29;
 $30 = (_LongAxis($norm)|0);
 $i = $30;
 $31 = $i;
 $32 = $sUnit;
 $33 = (($32) + ($31<<2)|0);
 HEAPF32[$33>>2] = 0.0;
 $34 = $i;
 $35 = (($34) + 1)|0;
 $36 = (($35|0) % 3)&-1;
 $37 = $sUnit;
 $38 = (($37) + ($36<<2)|0);
 HEAPF32[$38>>2] = 1.0;
 $39 = $i;
 $40 = (($39) + 2)|0;
 $41 = (($40|0) % 3)&-1;
 $42 = $sUnit;
 $43 = (($42) + ($41<<2)|0);
 HEAPF32[$43>>2] = 0.0;
 $44 = $i;
 $45 = $tUnit;
 $46 = (($45) + ($44<<2)|0);
 HEAPF32[$46>>2] = 0.0;
 $47 = $i;
 $48 = (($norm) + ($47<<2)|0);
 $49 = +HEAPF32[$48>>2];
 $50 = $49 > 0.0;
 $51 = $50 ? -0.0 : 0.0;
 $52 = $i;
 $53 = (($52) + 1)|0;
 $54 = (($53|0) % 3)&-1;
 $55 = $tUnit;
 $56 = (($55) + ($54<<2)|0);
 HEAPF32[$56>>2] = $51;
 $57 = $i;
 $58 = (($norm) + ($57<<2)|0);
 $59 = +HEAPF32[$58>>2];
 $60 = $59 > 0.0;
 $61 = $60 ? 1.0 : -1.0;
 $62 = $i;
 $63 = (($62) + 2)|0;
 $64 = (($63|0) % 3)&-1;
 $65 = $tUnit;
 $66 = (($65) + ($64<<2)|0);
 HEAPF32[$66>>2] = $61;
 $67 = $vHead;
 $68 = HEAP32[$67>>2]|0;
 $v = $68;
 while(1) {
  $69 = $v;
  $70 = $vHead;
  $71 = ($69|0)!=($70|0);
  if (!($71)) {
   break;
  }
  $72 = $v;
  $73 = (($72) + 16|0);
  $74 = +HEAPF32[$73>>2];
  $75 = $sUnit;
  $76 = +HEAPF32[$75>>2];
  $77 = $74 * $76;
  $78 = $v;
  $79 = (($78) + 16|0);
  $80 = (($79) + 4|0);
  $81 = +HEAPF32[$80>>2];
  $82 = $sUnit;
  $83 = (($82) + 4|0);
  $84 = +HEAPF32[$83>>2];
  $85 = $81 * $84;
  $86 = $77 + $85;
  $87 = $v;
  $88 = (($87) + 16|0);
  $89 = (($88) + 8|0);
  $90 = +HEAPF32[$89>>2];
  $91 = $sUnit;
  $92 = (($91) + 8|0);
  $93 = +HEAPF32[$92>>2];
  $94 = $90 * $93;
  $95 = $86 + $94;
  $96 = $v;
  $97 = (($96) + 28|0);
  HEAPF32[$97>>2] = $95;
  $98 = $v;
  $99 = (($98) + 16|0);
  $100 = +HEAPF32[$99>>2];
  $101 = $tUnit;
  $102 = +HEAPF32[$101>>2];
  $103 = $100 * $102;
  $104 = $v;
  $105 = (($104) + 16|0);
  $106 = (($105) + 4|0);
  $107 = +HEAPF32[$106>>2];
  $108 = $tUnit;
  $109 = (($108) + 4|0);
  $110 = +HEAPF32[$109>>2];
  $111 = $107 * $110;
  $112 = $103 + $111;
  $113 = $v;
  $114 = (($113) + 16|0);
  $115 = (($114) + 8|0);
  $116 = +HEAPF32[$115>>2];
  $117 = $tUnit;
  $118 = (($117) + 8|0);
  $119 = +HEAPF32[$118>>2];
  $120 = $116 * $119;
  $121 = $112 + $120;
  $122 = $v;
  $123 = (($122) + 32|0);
  HEAPF32[$123>>2] = $121;
  $124 = $v;
  $125 = HEAP32[$124>>2]|0;
  $v = $125;
 }
 $126 = $computedNormal;
 $127 = ($126|0)!=(0);
 if (!($127)) {
  STACKTOP = sp;return;
 }
 $128 = $0;
 _CheckOrientation($128);
 STACKTOP = sp;return;
}
function _ComputeNormal($tess,$norm) {
 $tess = $tess|0;
 $norm = $norm|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0.0, $102 = 0.0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0.0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0.0, $112 = 0.0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0.0, $122 = 0, $123 = 0, $124 = 0.0, $125 = 0.0, $126 = 0, $127 = 0, $128 = 0, $129 = 0.0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0.0;
 var $134 = 0.0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0.0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0.0, $144 = 0.0, $145 = 0, $146 = 0, $147 = 0.0, $148 = 0, $149 = 0.0, $15 = 0, $150 = 0.0, $151 = 0;
 var $152 = 0.0, $153 = 0, $154 = 0.0, $155 = 0.0, $156 = 0.0, $157 = 0, $158 = 0.0, $159 = 0.0, $16 = 0, $160 = 0.0, $161 = 0.0, $162 = 0, $163 = 0.0, $164 = 0.0, $165 = 0.0, $166 = 0, $167 = 0.0, $168 = 0, $169 = 0.0, $17 = 0;
 var $170 = 0.0, $171 = 0, $172 = 0.0, $173 = 0.0, $174 = 0.0, $175 = 0.0, $176 = 0, $177 = 0.0, $178 = 0.0, $179 = 0.0, $18 = 0, $180 = 0, $181 = 0.0, $182 = 0, $183 = 0.0, $184 = 0.0, $185 = 0.0, $186 = 0, $187 = 0.0, $188 = 0;
 var $189 = 0.0, $19 = 0, $190 = 0.0, $191 = 0.0, $192 = 0.0, $193 = 0.0, $194 = 0, $195 = 0.0, $196 = 0.0, $197 = 0, $198 = 0, $199 = 0.0, $2 = 0, $20 = 0.0, $200 = 0, $201 = 0, $202 = 0, $203 = 0.0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0.0, $209 = 0, $21 = 0.0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0.0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0.0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0.0, $51 = 0.0, $52 = 0.0, $53 = 0.0, $54 = 0.0, $55 = 0, $56 = 0, $57 = 0.0, $58 = 0, $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0, $62 = 0, $63 = 0.0, $64 = 0;
 var $65 = 0, $66 = 0.0, $67 = 0.0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0.0, $72 = 0, $73 = 0, $74 = 0.0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0, $92 = 0.0, $93 = 0.0, $94 = 0, $95 = 0, $96 = 0, $97 = 0.0, $98 = 0, $99 = 0, $c = 0.0, $d1 = 0;
 var $d2 = 0, $i = 0, $maxLen2 = 0.0, $maxVal = 0, $maxVert = 0, $minVal = 0, $minVert = 0, $tLen2 = 0.0, $tNorm = 0, $v = 0, $v1 = 0, $v2 = 0, $vHead = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $maxVal = sp + 80|0;
 $minVal = sp + 64|0;
 $d1 = sp + 52|0;
 $d2 = sp + 40|0;
 $tNorm = sp + 28|0;
 $maxVert = sp + 16|0;
 $minVert = sp + 4|0;
 $0 = $tess;
 $1 = $norm;
 $2 = $0;
 $3 = (($2) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $vHead = $4;
 $5 = (($maxVal) + 8|0);
 HEAPF32[$5>>2] = -1.9999999867631625E+37;
 $6 = (($maxVal) + 4|0);
 HEAPF32[$6>>2] = -1.9999999867631625E+37;
 HEAPF32[$maxVal>>2] = -1.9999999867631625E+37;
 $7 = (($minVal) + 8|0);
 HEAPF32[$7>>2] = 1.9999999867631625E+37;
 $8 = (($minVal) + 4|0);
 HEAPF32[$8>>2] = 1.9999999867631625E+37;
 HEAPF32[$minVal>>2] = 1.9999999867631625E+37;
 $9 = $vHead;
 $10 = HEAP32[$9>>2]|0;
 $v = $10;
 while(1) {
  $11 = $v;
  $12 = $vHead;
  $13 = ($11|0)!=($12|0);
  if (!($13)) {
   break;
  }
  $i = 0;
  while(1) {
   $14 = $i;
   $15 = ($14|0)<(3);
   if (!($15)) {
    break;
   }
   $16 = $i;
   $17 = $v;
   $18 = (($17) + 16|0);
   $19 = (($18) + ($16<<2)|0);
   $20 = +HEAPF32[$19>>2];
   $c = $20;
   $21 = $c;
   $22 = $i;
   $23 = (($minVal) + ($22<<2)|0);
   $24 = +HEAPF32[$23>>2];
   $25 = $21 < $24;
   if ($25) {
    $26 = $c;
    $27 = $i;
    $28 = (($minVal) + ($27<<2)|0);
    HEAPF32[$28>>2] = $26;
    $29 = $v;
    $30 = $i;
    $31 = (($minVert) + ($30<<2)|0);
    HEAP32[$31>>2] = $29;
   }
   $32 = $c;
   $33 = $i;
   $34 = (($maxVal) + ($33<<2)|0);
   $35 = +HEAPF32[$34>>2];
   $36 = $32 > $35;
   if ($36) {
    $37 = $c;
    $38 = $i;
    $39 = (($maxVal) + ($38<<2)|0);
    HEAPF32[$39>>2] = $37;
    $40 = $v;
    $41 = $i;
    $42 = (($maxVert) + ($41<<2)|0);
    HEAP32[$42>>2] = $40;
   }
   $43 = $i;
   $44 = (($43) + 1)|0;
   $i = $44;
  }
  $45 = $v;
  $46 = HEAP32[$45>>2]|0;
  $v = $46;
 }
 $i = 0;
 $47 = (($maxVal) + 4|0);
 $48 = +HEAPF32[$47>>2];
 $49 = (($minVal) + 4|0);
 $50 = +HEAPF32[$49>>2];
 $51 = $48 - $50;
 $52 = +HEAPF32[$maxVal>>2];
 $53 = +HEAPF32[$minVal>>2];
 $54 = $52 - $53;
 $55 = $51 > $54;
 if ($55) {
  $i = 1;
 }
 $56 = (($maxVal) + 8|0);
 $57 = +HEAPF32[$56>>2];
 $58 = (($minVal) + 8|0);
 $59 = +HEAPF32[$58>>2];
 $60 = $57 - $59;
 $61 = $i;
 $62 = (($maxVal) + ($61<<2)|0);
 $63 = +HEAPF32[$62>>2];
 $64 = $i;
 $65 = (($minVal) + ($64<<2)|0);
 $66 = +HEAPF32[$65>>2];
 $67 = $63 - $66;
 $68 = $60 > $67;
 if ($68) {
  $i = 2;
 }
 $69 = $i;
 $70 = (($minVal) + ($69<<2)|0);
 $71 = +HEAPF32[$70>>2];
 $72 = $i;
 $73 = (($maxVal) + ($72<<2)|0);
 $74 = +HEAPF32[$73>>2];
 $75 = $71 >= $74;
 if ($75) {
  $76 = $1;
  HEAPF32[$76>>2] = 0.0;
  $77 = $1;
  $78 = (($77) + 4|0);
  HEAPF32[$78>>2] = 0.0;
  $79 = $1;
  $80 = (($79) + 8|0);
  HEAPF32[$80>>2] = 1.0;
  STACKTOP = sp;return;
 }
 $maxLen2 = 0.0;
 $81 = $i;
 $82 = (($minVert) + ($81<<2)|0);
 $83 = HEAP32[$82>>2]|0;
 $v1 = $83;
 $84 = $i;
 $85 = (($maxVert) + ($84<<2)|0);
 $86 = HEAP32[$85>>2]|0;
 $v2 = $86;
 $87 = $v1;
 $88 = (($87) + 16|0);
 $89 = +HEAPF32[$88>>2];
 $90 = $v2;
 $91 = (($90) + 16|0);
 $92 = +HEAPF32[$91>>2];
 $93 = $89 - $92;
 HEAPF32[$d1>>2] = $93;
 $94 = $v1;
 $95 = (($94) + 16|0);
 $96 = (($95) + 4|0);
 $97 = +HEAPF32[$96>>2];
 $98 = $v2;
 $99 = (($98) + 16|0);
 $100 = (($99) + 4|0);
 $101 = +HEAPF32[$100>>2];
 $102 = $97 - $101;
 $103 = (($d1) + 4|0);
 HEAPF32[$103>>2] = $102;
 $104 = $v1;
 $105 = (($104) + 16|0);
 $106 = (($105) + 8|0);
 $107 = +HEAPF32[$106>>2];
 $108 = $v2;
 $109 = (($108) + 16|0);
 $110 = (($109) + 8|0);
 $111 = +HEAPF32[$110>>2];
 $112 = $107 - $111;
 $113 = (($d1) + 8|0);
 HEAPF32[$113>>2] = $112;
 $114 = $vHead;
 $115 = HEAP32[$114>>2]|0;
 $v = $115;
 while(1) {
  $116 = $v;
  $117 = $vHead;
  $118 = ($116|0)!=($117|0);
  if (!($118)) {
   break;
  }
  $119 = $v;
  $120 = (($119) + 16|0);
  $121 = +HEAPF32[$120>>2];
  $122 = $v2;
  $123 = (($122) + 16|0);
  $124 = +HEAPF32[$123>>2];
  $125 = $121 - $124;
  HEAPF32[$d2>>2] = $125;
  $126 = $v;
  $127 = (($126) + 16|0);
  $128 = (($127) + 4|0);
  $129 = +HEAPF32[$128>>2];
  $130 = $v2;
  $131 = (($130) + 16|0);
  $132 = (($131) + 4|0);
  $133 = +HEAPF32[$132>>2];
  $134 = $129 - $133;
  $135 = (($d2) + 4|0);
  HEAPF32[$135>>2] = $134;
  $136 = $v;
  $137 = (($136) + 16|0);
  $138 = (($137) + 8|0);
  $139 = +HEAPF32[$138>>2];
  $140 = $v2;
  $141 = (($140) + 16|0);
  $142 = (($141) + 8|0);
  $143 = +HEAPF32[$142>>2];
  $144 = $139 - $143;
  $145 = (($d2) + 8|0);
  HEAPF32[$145>>2] = $144;
  $146 = (($d1) + 4|0);
  $147 = +HEAPF32[$146>>2];
  $148 = (($d2) + 8|0);
  $149 = +HEAPF32[$148>>2];
  $150 = $147 * $149;
  $151 = (($d1) + 8|0);
  $152 = +HEAPF32[$151>>2];
  $153 = (($d2) + 4|0);
  $154 = +HEAPF32[$153>>2];
  $155 = $152 * $154;
  $156 = $150 - $155;
  HEAPF32[$tNorm>>2] = $156;
  $157 = (($d1) + 8|0);
  $158 = +HEAPF32[$157>>2];
  $159 = +HEAPF32[$d2>>2];
  $160 = $158 * $159;
  $161 = +HEAPF32[$d1>>2];
  $162 = (($d2) + 8|0);
  $163 = +HEAPF32[$162>>2];
  $164 = $161 * $163;
  $165 = $160 - $164;
  $166 = (($tNorm) + 4|0);
  HEAPF32[$166>>2] = $165;
  $167 = +HEAPF32[$d1>>2];
  $168 = (($d2) + 4|0);
  $169 = +HEAPF32[$168>>2];
  $170 = $167 * $169;
  $171 = (($d1) + 4|0);
  $172 = +HEAPF32[$171>>2];
  $173 = +HEAPF32[$d2>>2];
  $174 = $172 * $173;
  $175 = $170 - $174;
  $176 = (($tNorm) + 8|0);
  HEAPF32[$176>>2] = $175;
  $177 = +HEAPF32[$tNorm>>2];
  $178 = +HEAPF32[$tNorm>>2];
  $179 = $177 * $178;
  $180 = (($tNorm) + 4|0);
  $181 = +HEAPF32[$180>>2];
  $182 = (($tNorm) + 4|0);
  $183 = +HEAPF32[$182>>2];
  $184 = $181 * $183;
  $185 = $179 + $184;
  $186 = (($tNorm) + 8|0);
  $187 = +HEAPF32[$186>>2];
  $188 = (($tNorm) + 8|0);
  $189 = +HEAPF32[$188>>2];
  $190 = $187 * $189;
  $191 = $185 + $190;
  $tLen2 = $191;
  $192 = $tLen2;
  $193 = $maxLen2;
  $194 = $192 > $193;
  if ($194) {
   $195 = $tLen2;
   $maxLen2 = $195;
   $196 = +HEAPF32[$tNorm>>2];
   $197 = $1;
   HEAPF32[$197>>2] = $196;
   $198 = (($tNorm) + 4|0);
   $199 = +HEAPF32[$198>>2];
   $200 = $1;
   $201 = (($200) + 4|0);
   HEAPF32[$201>>2] = $199;
   $202 = (($tNorm) + 8|0);
   $203 = +HEAPF32[$202>>2];
   $204 = $1;
   $205 = (($204) + 8|0);
   HEAPF32[$205>>2] = $203;
  }
  $206 = $v;
  $207 = HEAP32[$206>>2]|0;
  $v = $207;
 }
 $208 = $maxLen2;
 $209 = $208 <= 0.0;
 if (!($209)) {
  STACKTOP = sp;return;
 }
 $210 = $1;
 $211 = (($210) + 8|0);
 HEAPF32[$211>>2] = 0.0;
 $212 = $1;
 $213 = (($212) + 4|0);
 HEAPF32[$213>>2] = 0.0;
 $214 = $1;
 HEAPF32[$214>>2] = 0.0;
 $215 = (_LongAxis($d1)|0);
 $216 = $1;
 $217 = (($216) + ($215<<2)|0);
 HEAPF32[$217>>2] = 1.0;
 STACKTOP = sp;return;
}
function _LongAxis($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0, $19 = 0.0, $2 = 0, $20 = 0, $21 = 0.0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0.0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0.0, $3 = 0.0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0.0, $43 = 0.0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0.0, $51 = 0, $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $v;
 $i = 0;
 $1 = $0;
 $2 = (($1) + 4|0);
 $3 = +HEAPF32[$2>>2];
 $4 = $3 < 0.0;
 if ($4) {
  $5 = $0;
  $6 = (($5) + 4|0);
  $7 = +HEAPF32[$6>>2];
  $8 = -$7;
  $21 = $8;
 } else {
  $9 = $0;
  $10 = (($9) + 4|0);
  $11 = +HEAPF32[$10>>2];
  $21 = $11;
 }
 $12 = $0;
 $13 = +HEAPF32[$12>>2];
 $14 = $13 < 0.0;
 if ($14) {
  $15 = $0;
  $16 = +HEAPF32[$15>>2];
  $17 = -$16;
  $22 = $17;
 } else {
  $18 = $0;
  $19 = +HEAPF32[$18>>2];
  $22 = $19;
 }
 $20 = $21 > $22;
 if ($20) {
  $i = 1;
 }
 $23 = $0;
 $24 = (($23) + 8|0);
 $25 = +HEAPF32[$24>>2];
 $26 = $25 < 0.0;
 if ($26) {
  $27 = $0;
  $28 = (($27) + 8|0);
  $29 = +HEAPF32[$28>>2];
  $30 = -$29;
  $49 = $30;
 } else {
  $31 = $0;
  $32 = (($31) + 8|0);
  $33 = +HEAPF32[$32>>2];
  $49 = $33;
 }
 $34 = $i;
 $35 = $0;
 $36 = (($35) + ($34<<2)|0);
 $37 = +HEAPF32[$36>>2];
 $38 = $37 < 0.0;
 if ($38) {
  $39 = $i;
  $40 = $0;
  $41 = (($40) + ($39<<2)|0);
  $42 = +HEAPF32[$41>>2];
  $43 = -$42;
  $50 = $43;
 } else {
  $44 = $i;
  $45 = $0;
  $46 = (($45) + ($44<<2)|0);
  $47 = +HEAPF32[$46>>2];
  $50 = $47;
 }
 $48 = $49 > $50;
 if (!($48)) {
  $51 = $i;
  STACKTOP = sp;return ($51|0);
 }
 $i = 2;
 $51 = $i;
 STACKTOP = sp;return ($51|0);
}
function _CheckOrientation($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0.0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0.0;
 var $45 = 0.0, $46 = 0.0, $47 = 0.0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0.0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0.0, $69 = 0.0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0.0, $77 = 0.0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0.0, $84 = 0.0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0.0, $92 = 0.0, $93 = 0, $94 = 0, $95 = 0, $area = 0.0, $e = 0, $f = 0, $fHead = 0;
 var $v = 0, $vHead = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $0;
 $2 = (($1) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = (($3) + 40|0);
 $fHead = $4;
 $5 = $0;
 $6 = (($5) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $vHead = $7;
 $area = 0.0;
 $8 = $fHead;
 $9 = HEAP32[$8>>2]|0;
 $f = $9;
 while(1) {
  $10 = $f;
  $11 = $fHead;
  $12 = ($10|0)!=($11|0);
  if (!($12)) {
   break;
  }
  $13 = $f;
  $14 = (($13) + 8|0);
  $15 = HEAP32[$14>>2]|0;
  $e = $15;
  $16 = $e;
  $17 = (($16) + 28|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = ($18|0)<=(0);
  if ($19) {
  } else {
   while(1) {
    $20 = $e;
    $21 = (($20) + 16|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = (($22) + 28|0);
    $24 = +HEAPF32[$23>>2];
    $25 = $e;
    $26 = (($25) + 4|0);
    $27 = HEAP32[$26>>2]|0;
    $28 = (($27) + 16|0);
    $29 = HEAP32[$28>>2]|0;
    $30 = (($29) + 28|0);
    $31 = +HEAPF32[$30>>2];
    $32 = $24 - $31;
    $33 = $e;
    $34 = (($33) + 16|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = (($35) + 32|0);
    $37 = +HEAPF32[$36>>2];
    $38 = $e;
    $39 = (($38) + 4|0);
    $40 = HEAP32[$39>>2]|0;
    $41 = (($40) + 16|0);
    $42 = HEAP32[$41>>2]|0;
    $43 = (($42) + 32|0);
    $44 = +HEAPF32[$43>>2];
    $45 = $37 + $44;
    $46 = $32 * $45;
    $47 = $area;
    $48 = $47 + $46;
    $area = $48;
    $49 = $e;
    $50 = (($49) + 12|0);
    $51 = HEAP32[$50>>2]|0;
    $e = $51;
    $52 = $e;
    $53 = $f;
    $54 = (($53) + 8|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = ($52|0)!=($55|0);
    if (!($56)) {
     break;
    }
   }
  }
  $57 = $f;
  $58 = HEAP32[$57>>2]|0;
  $f = $58;
 }
 $59 = $area;
 $60 = $59 < 0.0;
 if (!($60)) {
  STACKTOP = sp;return;
 }
 $61 = $vHead;
 $62 = HEAP32[$61>>2]|0;
 $v = $62;
 while(1) {
  $63 = $v;
  $64 = $vHead;
  $65 = ($63|0)!=($64|0);
  if (!($65)) {
   break;
  }
  $66 = $v;
  $67 = (($66) + 32|0);
  $68 = +HEAPF32[$67>>2];
  $69 = -$68;
  $70 = $v;
  $71 = (($70) + 32|0);
  HEAPF32[$71>>2] = $69;
  $72 = $v;
  $73 = HEAP32[$72>>2]|0;
  $v = $73;
 }
 $74 = $0;
 $75 = (($74) + 40|0);
 $76 = +HEAPF32[$75>>2];
 $77 = -$76;
 $78 = $0;
 $79 = (($78) + 40|0);
 HEAPF32[$79>>2] = $77;
 $80 = $0;
 $81 = (($80) + 40|0);
 $82 = (($81) + 4|0);
 $83 = +HEAPF32[$82>>2];
 $84 = -$83;
 $85 = $0;
 $86 = (($85) + 40|0);
 $87 = (($86) + 4|0);
 HEAPF32[$87>>2] = $84;
 $88 = $0;
 $89 = (($88) + 40|0);
 $90 = (($89) + 8|0);
 $91 = +HEAPF32[$90>>2];
 $92 = -$91;
 $93 = $0;
 $94 = (($93) + 40|0);
 $95 = (($94) + 8|0);
 HEAPF32[$95>>2] = $92;
 STACKTOP = sp;return;
}
function ___gl_pqHeapNewPriorityQ($leq) {
 $leq = $leq|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $pq = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $leq;
 $2 = (_malloc(28)|0);
 $pq = $2;
 $3 = $pq;
 $4 = ($3|0)==(0|0);
 if ($4) {
  $0 = 0;
  $40 = $0;
  STACKTOP = sp;return ($40|0);
 }
 $5 = $pq;
 $6 = (($5) + 8|0);
 HEAP32[$6>>2] = 0;
 $7 = $pq;
 $8 = (($7) + 12|0);
 HEAP32[$8>>2] = 32;
 $9 = (_malloc(132)|0);
 $10 = $pq;
 HEAP32[$10>>2] = $9;
 $11 = $pq;
 $12 = HEAP32[$11>>2]|0;
 $13 = ($12|0)==(0|0);
 if ($13) {
  $14 = $pq;
  _free($14);
  $0 = 0;
  $40 = $0;
  STACKTOP = sp;return ($40|0);
 }
 $15 = (_malloc(264)|0);
 $16 = $pq;
 $17 = (($16) + 4|0);
 HEAP32[$17>>2] = $15;
 $18 = $pq;
 $19 = (($18) + 4|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = ($20|0)==(0|0);
 if ($21) {
  $22 = $pq;
  $23 = HEAP32[$22>>2]|0;
  _free($23);
  $24 = $pq;
  _free($24);
  $0 = 0;
  $40 = $0;
  STACKTOP = sp;return ($40|0);
 } else {
  $25 = $pq;
  $26 = (($25) + 20|0);
  HEAP32[$26>>2] = 0;
  $27 = $pq;
  $28 = (($27) + 16|0);
  HEAP32[$28>>2] = 0;
  $29 = $1;
  $30 = $pq;
  $31 = (($30) + 24|0);
  HEAP32[$31>>2] = $29;
  $32 = $pq;
  $33 = HEAP32[$32>>2]|0;
  $34 = (($33) + 4|0);
  HEAP32[$34>>2] = 1;
  $35 = $pq;
  $36 = (($35) + 4|0);
  $37 = HEAP32[$36>>2]|0;
  $38 = (($37) + 8|0);
  HEAP32[$38>>2] = 0;
  $39 = $pq;
  $0 = $39;
  $40 = $0;
  STACKTOP = sp;return ($40|0);
 }
 return 0|0;
}
function ___gl_pqHeapDeletePriorityQ($pq) {
 $pq = $pq|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pq;
 $1 = $0;
 $2 = (($1) + 4|0);
 $3 = HEAP32[$2>>2]|0;
 _free($3);
 $4 = $0;
 $5 = HEAP32[$4>>2]|0;
 _free($5);
 $6 = $0;
 _free($6);
 STACKTOP = sp;return;
}
function ___gl_pqHeapInit($pq) {
 $pq = $pq|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pq;
 $1 = $0;
 $2 = (($1) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $i = $3;
 while(1) {
  $4 = $i;
  $5 = ($4|0)>=(1);
  if (!($5)) {
   break;
  }
  $6 = $0;
  $7 = $i;
  _FloatDown($6,$7);
  $8 = $i;
  $9 = (($8) + -1)|0;
  $i = $9;
 }
 $10 = $0;
 $11 = (($10) + 20|0);
 HEAP32[$11>>2] = 1;
 STACKTOP = sp;return;
}
function _FloatDown($pq,$curr) {
 $pq = $pq|0;
 $curr = $curr|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0.0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0.0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0.0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0.0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0.0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0.0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0.0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0.0, $child = 0, $h = 0, $hChild = 0, $hCurr = 0, $n = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pq;
 $1 = $curr;
 $2 = $0;
 $3 = HEAP32[$2>>2]|0;
 $n = $3;
 $4 = $0;
 $5 = (($4) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $h = $6;
 $7 = $1;
 $8 = $n;
 $9 = (($8) + ($7<<2)|0);
 $10 = HEAP32[$9>>2]|0;
 $hCurr = $10;
 while(1) {
  $11 = $1;
  $12 = $11 << 1;
  $child = $12;
  $13 = $child;
  $14 = $0;
  $15 = (($14) + 8|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = ($13|0)<($16|0);
  do {
   if ($17) {
    $18 = $child;
    $19 = (($18) + 1)|0;
    $20 = $n;
    $21 = (($20) + ($19<<2)|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = $h;
    $24 = (($23) + ($22<<3)|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = (($25) + 28|0);
    $27 = +HEAPF32[$26>>2];
    $28 = $child;
    $29 = $n;
    $30 = (($29) + ($28<<2)|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = $h;
    $33 = (($32) + ($31<<3)|0);
    $34 = HEAP32[$33>>2]|0;
    $35 = (($34) + 28|0);
    $36 = +HEAPF32[$35>>2];
    $37 = $27 < $36;
    if (!($37)) {
     $38 = $child;
     $39 = (($38) + 1)|0;
     $40 = $n;
     $41 = (($40) + ($39<<2)|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = $h;
     $44 = (($43) + ($42<<3)|0);
     $45 = HEAP32[$44>>2]|0;
     $46 = (($45) + 28|0);
     $47 = +HEAPF32[$46>>2];
     $48 = $child;
     $49 = $n;
     $50 = (($49) + ($48<<2)|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = $h;
     $53 = (($52) + ($51<<3)|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = (($54) + 28|0);
     $56 = +HEAPF32[$55>>2];
     $57 = $47 == $56;
     if (!($57)) {
      break;
     }
     $58 = $child;
     $59 = (($58) + 1)|0;
     $60 = $n;
     $61 = (($60) + ($59<<2)|0);
     $62 = HEAP32[$61>>2]|0;
     $63 = $h;
     $64 = (($63) + ($62<<3)|0);
     $65 = HEAP32[$64>>2]|0;
     $66 = (($65) + 32|0);
     $67 = +HEAPF32[$66>>2];
     $68 = $child;
     $69 = $n;
     $70 = (($69) + ($68<<2)|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = $h;
     $73 = (($72) + ($71<<3)|0);
     $74 = HEAP32[$73>>2]|0;
     $75 = (($74) + 32|0);
     $76 = +HEAPF32[$75>>2];
     $77 = $67 <= $76;
     if (!($77)) {
      break;
     }
    }
    $78 = $child;
    $79 = (($78) + 1)|0;
    $child = $79;
   }
  } while(0);
  $80 = $child;
  $81 = $0;
  $82 = (($81) + 12|0);
  $83 = HEAP32[$82>>2]|0;
  $84 = ($80|0)<=($83|0);
  if (!($84)) {
   label = 8;
   break;
  }
  $85 = $child;
  $86 = $n;
  $87 = (($86) + ($85<<2)|0);
  $88 = HEAP32[$87>>2]|0;
  $hChild = $88;
  $89 = $child;
  $90 = $0;
  $91 = (($90) + 8|0);
  $92 = HEAP32[$91>>2]|0;
  $93 = ($89|0)>($92|0);
  if ($93) {
   break;
  }
  $94 = $hCurr;
  $95 = $h;
  $96 = (($95) + ($94<<3)|0);
  $97 = HEAP32[$96>>2]|0;
  $98 = (($97) + 28|0);
  $99 = +HEAPF32[$98>>2];
  $100 = $hChild;
  $101 = $h;
  $102 = (($101) + ($100<<3)|0);
  $103 = HEAP32[$102>>2]|0;
  $104 = (($103) + 28|0);
  $105 = +HEAPF32[$104>>2];
  $106 = $99 < $105;
  if ($106) {
   break;
  }
  $107 = $hCurr;
  $108 = $h;
  $109 = (($108) + ($107<<3)|0);
  $110 = HEAP32[$109>>2]|0;
  $111 = (($110) + 28|0);
  $112 = +HEAPF32[$111>>2];
  $113 = $hChild;
  $114 = $h;
  $115 = (($114) + ($113<<3)|0);
  $116 = HEAP32[$115>>2]|0;
  $117 = (($116) + 28|0);
  $118 = +HEAPF32[$117>>2];
  $119 = $112 == $118;
  if ($119) {
   $120 = $hCurr;
   $121 = $h;
   $122 = (($121) + ($120<<3)|0);
   $123 = HEAP32[$122>>2]|0;
   $124 = (($123) + 32|0);
   $125 = +HEAPF32[$124>>2];
   $126 = $hChild;
   $127 = $h;
   $128 = (($127) + ($126<<3)|0);
   $129 = HEAP32[$128>>2]|0;
   $130 = (($129) + 32|0);
   $131 = +HEAPF32[$130>>2];
   $132 = $125 <= $131;
   if ($132) {
    break;
   }
  }
  $142 = $hChild;
  $143 = $1;
  $144 = $n;
  $145 = (($144) + ($143<<2)|0);
  HEAP32[$145>>2] = $142;
  $146 = $1;
  $147 = $hChild;
  $148 = $h;
  $149 = (($148) + ($147<<3)|0);
  $150 = (($149) + 4|0);
  HEAP32[$150>>2] = $146;
  $151 = $child;
  $1 = $151;
 }
 if ((label|0) == 8) {
  ___assert_fail((1064|0),(728|0),115,(1080|0));
  // unreachable;
 }
 $133 = $hCurr;
 $134 = $1;
 $135 = $n;
 $136 = (($135) + ($134<<2)|0);
 HEAP32[$136>>2] = $133;
 $137 = $1;
 $138 = $hCurr;
 $139 = $h;
 $140 = (($139) + ($138<<3)|0);
 $141 = (($140) + 4|0);
 HEAP32[$141>>2] = $137;
 STACKTOP = sp;return;
}
function ___gl_pqHeapInsert($pq,$keyNew) {
 $pq = $pq|0;
 $keyNew = $keyNew|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $curr = 0;
 var $free = 0, $saveHandles = 0, $saveNodes = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $pq;
 $2 = $keyNew;
 $3 = $1;
 $4 = (($3) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (($5) + 1)|0;
 HEAP32[$4>>2] = $6;
 $curr = $6;
 $7 = $curr;
 $8 = $7<<1;
 $9 = $1;
 $10 = (($9) + 12|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ($8|0)>($11|0);
 do {
  if ($12) {
   $13 = $1;
   $14 = HEAP32[$13>>2]|0;
   $saveNodes = $14;
   $15 = $1;
   $16 = (($15) + 4|0);
   $17 = HEAP32[$16>>2]|0;
   $saveHandles = $17;
   $18 = $1;
   $19 = (($18) + 12|0);
   $20 = HEAP32[$19>>2]|0;
   $21 = $20 << 1;
   HEAP32[$19>>2] = $21;
   $22 = $1;
   $23 = HEAP32[$22>>2]|0;
   $24 = $1;
   $25 = (($24) + 12|0);
   $26 = HEAP32[$25>>2]|0;
   $27 = (($26) + 1)|0;
   $28 = $27<<2;
   $29 = (_realloc($23,$28)|0);
   $30 = $1;
   HEAP32[$30>>2] = $29;
   $31 = $1;
   $32 = HEAP32[$31>>2]|0;
   $33 = ($32|0)==(0|0);
   if ($33) {
    $34 = $saveNodes;
    $35 = $1;
    HEAP32[$35>>2] = $34;
    $0 = 2147483647;
    $98 = $0;
    STACKTOP = sp;return ($98|0);
   }
   $36 = $1;
   $37 = (($36) + 4|0);
   $38 = HEAP32[$37>>2]|0;
   $39 = $1;
   $40 = (($39) + 12|0);
   $41 = HEAP32[$40>>2]|0;
   $42 = (($41) + 1)|0;
   $43 = $42<<3;
   $44 = (_realloc($38,$43)|0);
   $45 = $1;
   $46 = (($45) + 4|0);
   HEAP32[$46>>2] = $44;
   $47 = $1;
   $48 = (($47) + 4|0);
   $49 = HEAP32[$48>>2]|0;
   $50 = ($49|0)==(0|0);
   if (!($50)) {
    break;
   }
   $51 = $saveHandles;
   $52 = $1;
   $53 = (($52) + 4|0);
   HEAP32[$53>>2] = $51;
   $0 = 2147483647;
   $98 = $0;
   STACKTOP = sp;return ($98|0);
  }
 } while(0);
 $54 = $1;
 $55 = (($54) + 16|0);
 $56 = HEAP32[$55>>2]|0;
 $57 = ($56|0)==(0);
 if ($57) {
  $58 = $curr;
  $free = $58;
 } else {
  $59 = $1;
  $60 = (($59) + 16|0);
  $61 = HEAP32[$60>>2]|0;
  $free = $61;
  $62 = $free;
  $63 = $1;
  $64 = (($63) + 4|0);
  $65 = HEAP32[$64>>2]|0;
  $66 = (($65) + ($62<<3)|0);
  $67 = (($66) + 4|0);
  $68 = HEAP32[$67>>2]|0;
  $69 = $1;
  $70 = (($69) + 16|0);
  HEAP32[$70>>2] = $68;
 }
 $71 = $free;
 $72 = $curr;
 $73 = $1;
 $74 = HEAP32[$73>>2]|0;
 $75 = (($74) + ($72<<2)|0);
 HEAP32[$75>>2] = $71;
 $76 = $curr;
 $77 = $free;
 $78 = $1;
 $79 = (($78) + 4|0);
 $80 = HEAP32[$79>>2]|0;
 $81 = (($80) + ($77<<3)|0);
 $82 = (($81) + 4|0);
 HEAP32[$82>>2] = $76;
 $83 = $2;
 $84 = $free;
 $85 = $1;
 $86 = (($85) + 4|0);
 $87 = HEAP32[$86>>2]|0;
 $88 = (($87) + ($84<<3)|0);
 HEAP32[$88>>2] = $83;
 $89 = $1;
 $90 = (($89) + 20|0);
 $91 = HEAP32[$90>>2]|0;
 $92 = ($91|0)!=(0);
 if ($92) {
  $93 = $1;
  $94 = $curr;
  _FloatUp($93,$94);
 }
 $95 = $free;
 $96 = ($95|0)!=(2147483647);
 if (!($96)) {
  ___assert_fail((712|0),(728|0),218,(752|0));
  // unreachable;
 }
 $97 = $free;
 $0 = $97;
 $98 = $0;
 STACKTOP = sp;return ($98|0);
}
function _FloatUp($pq,$curr) {
 $pq = $pq|0;
 $curr = $curr|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0.0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0.0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $8 = 0, $9 = 0, $h = 0, $hCurr = 0, $hParent = 0;
 var $n = 0, $parent = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pq;
 $1 = $curr;
 $2 = $0;
 $3 = HEAP32[$2>>2]|0;
 $n = $3;
 $4 = $0;
 $5 = (($4) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $h = $6;
 $7 = $1;
 $8 = $n;
 $9 = (($8) + ($7<<2)|0);
 $10 = HEAP32[$9>>2]|0;
 $hCurr = $10;
 while(1) {
  $11 = $1;
  $12 = $11 >> 1;
  $parent = $12;
  $13 = $parent;
  $14 = $n;
  $15 = (($14) + ($13<<2)|0);
  $16 = HEAP32[$15>>2]|0;
  $hParent = $16;
  $17 = $parent;
  $18 = ($17|0)==(0);
  if ($18) {
   break;
  }
  $19 = $hParent;
  $20 = $h;
  $21 = (($20) + ($19<<3)|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($22) + 28|0);
  $24 = +HEAPF32[$23>>2];
  $25 = $hCurr;
  $26 = $h;
  $27 = (($26) + ($25<<3)|0);
  $28 = HEAP32[$27>>2]|0;
  $29 = (($28) + 28|0);
  $30 = +HEAPF32[$29>>2];
  $31 = $24 < $30;
  if ($31) {
   break;
  }
  $32 = $hParent;
  $33 = $h;
  $34 = (($33) + ($32<<3)|0);
  $35 = HEAP32[$34>>2]|0;
  $36 = (($35) + 28|0);
  $37 = +HEAPF32[$36>>2];
  $38 = $hCurr;
  $39 = $h;
  $40 = (($39) + ($38<<3)|0);
  $41 = HEAP32[$40>>2]|0;
  $42 = (($41) + 28|0);
  $43 = +HEAPF32[$42>>2];
  $44 = $37 == $43;
  if ($44) {
   $45 = $hParent;
   $46 = $h;
   $47 = (($46) + ($45<<3)|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = (($48) + 32|0);
   $50 = +HEAPF32[$49>>2];
   $51 = $hCurr;
   $52 = $h;
   $53 = (($52) + ($51<<3)|0);
   $54 = HEAP32[$53>>2]|0;
   $55 = (($54) + 32|0);
   $56 = +HEAPF32[$55>>2];
   $57 = $50 <= $56;
   if ($57) {
    break;
   }
  }
  $67 = $hParent;
  $68 = $1;
  $69 = $n;
  $70 = (($69) + ($68<<2)|0);
  HEAP32[$70>>2] = $67;
  $71 = $1;
  $72 = $hParent;
  $73 = $h;
  $74 = (($73) + ($72<<3)|0);
  $75 = (($74) + 4|0);
  HEAP32[$75>>2] = $71;
  $76 = $parent;
  $1 = $76;
 }
 $58 = $hCurr;
 $59 = $1;
 $60 = $n;
 $61 = (($60) + ($59<<2)|0);
 HEAP32[$61>>2] = $58;
 $62 = $1;
 $63 = $hCurr;
 $64 = $h;
 $65 = (($64) + ($63<<3)|0);
 $66 = (($65) + 4|0);
 HEAP32[$66>>2] = $62;
 STACKTOP = sp;return;
}
function ___gl_pqHeapExtractMin($pq) {
 $pq = $pq|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $h = 0, $hMin = 0, $min = 0, $n = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pq;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $n = $2;
 $3 = $0;
 $4 = (($3) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $h = $5;
 $6 = $n;
 $7 = (($6) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $hMin = $8;
 $9 = $hMin;
 $10 = $h;
 $11 = (($10) + ($9<<3)|0);
 $12 = HEAP32[$11>>2]|0;
 $min = $12;
 $13 = $0;
 $14 = (($13) + 8|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ($15|0)>(0);
 if (!($16)) {
  $50 = $min;
  STACKTOP = sp;return ($50|0);
 }
 $17 = $0;
 $18 = (($17) + 8|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = $n;
 $21 = (($20) + ($19<<2)|0);
 $22 = HEAP32[$21>>2]|0;
 $23 = $n;
 $24 = (($23) + 4|0);
 HEAP32[$24>>2] = $22;
 $25 = $n;
 $26 = (($25) + 4|0);
 $27 = HEAP32[$26>>2]|0;
 $28 = $h;
 $29 = (($28) + ($27<<3)|0);
 $30 = (($29) + 4|0);
 HEAP32[$30>>2] = 1;
 $31 = $hMin;
 $32 = $h;
 $33 = (($32) + ($31<<3)|0);
 HEAP32[$33>>2] = 0;
 $34 = $0;
 $35 = (($34) + 16|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = $hMin;
 $38 = $h;
 $39 = (($38) + ($37<<3)|0);
 $40 = (($39) + 4|0);
 HEAP32[$40>>2] = $36;
 $41 = $hMin;
 $42 = $0;
 $43 = (($42) + 16|0);
 HEAP32[$43>>2] = $41;
 $44 = $0;
 $45 = (($44) + 8|0);
 $46 = HEAP32[$45>>2]|0;
 $47 = (($46) + -1)|0;
 HEAP32[$45>>2] = $47;
 $48 = ($47|0)>(0);
 if ($48) {
  $49 = $0;
  _FloatDown($49,1);
 }
 $50 = $min;
 STACKTOP = sp;return ($50|0);
}
function ___gl_pqHeapDelete($pq,$hCurr) {
 $pq = $pq|0;
 $hCurr = $hCurr|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0.0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0.0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0.0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0;
 var $76 = 0, $77 = 0, $78 = 0.0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0.0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0;
 var $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0.0, $99 = 0, $curr = 0, $h = 0, $n = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pq;
 $1 = $hCurr;
 $2 = $0;
 $3 = HEAP32[$2>>2]|0;
 $n = $3;
 $4 = $0;
 $5 = (($4) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $h = $6;
 $7 = $1;
 $8 = ($7|0)>=(1);
 if (!($8)) {
  ___assert_fail((776|0),(728|0),256,(832|0));
  // unreachable;
 }
 $9 = $1;
 $10 = $0;
 $11 = (($10) + 12|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ($9|0)<=($12|0);
 if (!($13)) {
  ___assert_fail((776|0),(728|0),256,(832|0));
  // unreachable;
 }
 $14 = $1;
 $15 = $h;
 $16 = (($15) + ($14<<3)|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ($17|0)!=(0|0);
 if (!($18)) {
  ___assert_fail((776|0),(728|0),256,(832|0));
  // unreachable;
 }
 $19 = $1;
 $20 = $h;
 $21 = (($20) + ($19<<3)|0);
 $22 = (($21) + 4|0);
 $23 = HEAP32[$22>>2]|0;
 $curr = $23;
 $24 = $0;
 $25 = (($24) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = $n;
 $28 = (($27) + ($26<<2)|0);
 $29 = HEAP32[$28>>2]|0;
 $30 = $curr;
 $31 = $n;
 $32 = (($31) + ($30<<2)|0);
 HEAP32[$32>>2] = $29;
 $33 = $curr;
 $34 = $curr;
 $35 = $n;
 $36 = (($35) + ($34<<2)|0);
 $37 = HEAP32[$36>>2]|0;
 $38 = $h;
 $39 = (($38) + ($37<<3)|0);
 $40 = (($39) + 4|0);
 HEAP32[$40>>2] = $33;
 $41 = $curr;
 $42 = $0;
 $43 = (($42) + 8|0);
 $44 = HEAP32[$43>>2]|0;
 $45 = (($44) + -1)|0;
 HEAP32[$43>>2] = $45;
 $46 = ($41|0)<=($45|0);
 if (!($46)) {
  $113 = $1;
  $114 = $h;
  $115 = (($114) + ($113<<3)|0);
  HEAP32[$115>>2] = 0;
  $116 = $0;
  $117 = (($116) + 16|0);
  $118 = HEAP32[$117>>2]|0;
  $119 = $1;
  $120 = $h;
  $121 = (($120) + ($119<<3)|0);
  $122 = (($121) + 4|0);
  HEAP32[$122>>2] = $118;
  $123 = $1;
  $124 = $0;
  $125 = (($124) + 16|0);
  HEAP32[$125>>2] = $123;
  STACKTOP = sp;return;
 }
 $47 = $curr;
 $48 = ($47|0)<=(1);
 do {
  if ($48) {
   label = 10;
  } else {
   $49 = $curr;
   $50 = $49 >> 1;
   $51 = $n;
   $52 = (($51) + ($50<<2)|0);
   $53 = HEAP32[$52>>2]|0;
   $54 = $h;
   $55 = (($54) + ($53<<3)|0);
   $56 = HEAP32[$55>>2]|0;
   $57 = (($56) + 28|0);
   $58 = +HEAPF32[$57>>2];
   $59 = $curr;
   $60 = $n;
   $61 = (($60) + ($59<<2)|0);
   $62 = HEAP32[$61>>2]|0;
   $63 = $h;
   $64 = (($63) + ($62<<3)|0);
   $65 = HEAP32[$64>>2]|0;
   $66 = (($65) + 28|0);
   $67 = +HEAPF32[$66>>2];
   $68 = $58 < $67;
   if ($68) {
    label = 10;
   } else {
    $69 = $curr;
    $70 = $69 >> 1;
    $71 = $n;
    $72 = (($71) + ($70<<2)|0);
    $73 = HEAP32[$72>>2]|0;
    $74 = $h;
    $75 = (($74) + ($73<<3)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = (($76) + 28|0);
    $78 = +HEAPF32[$77>>2];
    $79 = $curr;
    $80 = $n;
    $81 = (($80) + ($79<<2)|0);
    $82 = HEAP32[$81>>2]|0;
    $83 = $h;
    $84 = (($83) + ($82<<3)|0);
    $85 = HEAP32[$84>>2]|0;
    $86 = (($85) + 28|0);
    $87 = +HEAPF32[$86>>2];
    $88 = $78 == $87;
    if ($88) {
     $89 = $curr;
     $90 = $89 >> 1;
     $91 = $n;
     $92 = (($91) + ($90<<2)|0);
     $93 = HEAP32[$92>>2]|0;
     $94 = $h;
     $95 = (($94) + ($93<<3)|0);
     $96 = HEAP32[$95>>2]|0;
     $97 = (($96) + 32|0);
     $98 = +HEAPF32[$97>>2];
     $99 = $curr;
     $100 = $n;
     $101 = (($100) + ($99<<2)|0);
     $102 = HEAP32[$101>>2]|0;
     $103 = $h;
     $104 = (($103) + ($102<<3)|0);
     $105 = HEAP32[$104>>2]|0;
     $106 = (($105) + 32|0);
     $107 = +HEAPF32[$106>>2];
     $108 = $98 <= $107;
     if ($108) {
      label = 10;
      break;
     }
    }
    $111 = $0;
    $112 = $curr;
    _FloatUp($111,$112);
   }
  }
 } while(0);
 if ((label|0) == 10) {
  $109 = $0;
  $110 = $curr;
  _FloatDown($109,$110);
 }
 $113 = $1;
 $114 = $h;
 $115 = (($114) + ($113<<3)|0);
 HEAP32[$115>>2] = 0;
 $116 = $0;
 $117 = (($116) + 16|0);
 $118 = HEAP32[$117>>2]|0;
 $119 = $1;
 $120 = $h;
 $121 = (($120) + ($119<<3)|0);
 $122 = (($121) + 4|0);
 HEAP32[$122>>2] = $118;
 $123 = $1;
 $124 = $0;
 $125 = (($124) + 16|0);
 HEAP32[$125>>2] = $123;
 STACKTOP = sp;return;
}
function ___gl_pqSortNewPriorityQ($leq) {
 $leq = $leq|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $pq = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $leq;
 $2 = (_malloc(28)|0);
 $pq = $2;
 $3 = $pq;
 $4 = ($3|0)==(0|0);
 if ($4) {
  $0 = 0;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 }
 $5 = $1;
 $6 = (___gl_pqHeapNewPriorityQ($5)|0);
 $7 = $pq;
 HEAP32[$7>>2] = $6;
 $8 = $pq;
 $9 = HEAP32[$8>>2]|0;
 $10 = ($9|0)==(0|0);
 if ($10) {
  $11 = $pq;
  _free($11);
  $0 = 0;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 }
 $12 = (_malloc(128)|0);
 $13 = $pq;
 $14 = (($13) + 4|0);
 HEAP32[$14>>2] = $12;
 $15 = $pq;
 $16 = (($15) + 4|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ($17|0)==(0|0);
 if ($18) {
  $19 = $pq;
  $20 = HEAP32[$19>>2]|0;
  ___gl_pqHeapDeletePriorityQ($20);
  $21 = $pq;
  _free($21);
  $0 = 0;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 } else {
  $22 = $pq;
  $23 = (($22) + 12|0);
  HEAP32[$23>>2] = 0;
  $24 = $pq;
  $25 = (($24) + 16|0);
  HEAP32[$25>>2] = 32;
  $26 = $pq;
  $27 = (($26) + 20|0);
  HEAP32[$27>>2] = 0;
  $28 = $1;
  $29 = $pq;
  $30 = (($29) + 24|0);
  HEAP32[$30>>2] = $28;
  $31 = $pq;
  $0 = $31;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 }
 return 0|0;
}
function ___gl_pqSortDeletePriorityQ($pq) {
 $pq = $pq|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pq;
 $1 = $0;
 $2 = ($1|0)!=(0|0);
 if (!($2)) {
  ___assert_fail((856|0),(872|0),83,(888|0));
  // unreachable;
 }
 $3 = $0;
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)!=(0|0);
 if ($5) {
  $6 = $0;
  $7 = HEAP32[$6>>2]|0;
  ___gl_pqHeapDeletePriorityQ($7);
 }
 $8 = $0;
 $9 = (($8) + 8|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ($10|0)!=(0|0);
 if ($11) {
  $12 = $0;
  $13 = (($12) + 8|0);
  $14 = HEAP32[$13>>2]|0;
  _free($14);
 }
 $15 = $0;
 $16 = (($15) + 4|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ($17|0)!=(0|0);
 if (!($18)) {
  $22 = $0;
  _free($22);
  STACKTOP = sp;return;
 }
 $19 = $0;
 $20 = (($19) + 4|0);
 $21 = HEAP32[$20>>2]|0;
 _free($21);
 $22 = $0;
 _free($22);
 STACKTOP = sp;return;
}
function ___gl_pqSortInit($pq) {
 $pq = $pq|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0.0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0.0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0.0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0.0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0.0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0.0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0.0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0.0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0.0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0.0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0.0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0.0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0.0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0.0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0.0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0.0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0.0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0.0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0.0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0.0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0.0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0.0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0.0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0.0, $97 = 0, $98 = 0, $99 = 0, $Stack = 0;
 var $i = 0, $j = 0, $p = 0, $piv = 0, $r = 0, $seed = 0, $tmp = 0, $tmp1 = 0, $top = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 448|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $Stack = sp + 16|0;
 $1 = $pq;
 $top = $Stack;
 $seed = 2016473283;
 $2 = $1;
 $3 = (($2) + 12|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) + 1)|0;
 $6 = $5<<2;
 $7 = (_malloc($6)|0);
 $8 = $1;
 $9 = (($8) + 8|0);
 HEAP32[$9>>2] = $7;
 $10 = $1;
 $11 = (($10) + 8|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ($12|0)==(0|0);
 if ($13) {
  $0 = 0;
  $314 = $0;
  STACKTOP = sp;return ($314|0);
 }
 $14 = $1;
 $15 = (($14) + 8|0);
 $16 = HEAP32[$15>>2]|0;
 $p = $16;
 $17 = $p;
 $18 = $1;
 $19 = (($18) + 12|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = (($17) + ($20<<2)|0);
 $22 = (($21) + -4|0);
 $r = $22;
 $23 = $1;
 $24 = (($23) + 4|0);
 $25 = HEAP32[$24>>2]|0;
 $piv = $25;
 $26 = $p;
 $i = $26;
 while(1) {
  $27 = $i;
  $28 = $r;
  $29 = ($27>>>0)<=($28>>>0);
  if (!($29)) {
   break;
  }
  $30 = $piv;
  $31 = $i;
  HEAP32[$31>>2] = $30;
  $32 = $piv;
  $33 = (($32) + 4|0);
  $piv = $33;
  $34 = $i;
  $35 = (($34) + 4|0);
  $i = $35;
 }
 $36 = $p;
 $37 = $top;
 HEAP32[$37>>2] = $36;
 $38 = $r;
 $39 = $top;
 $40 = (($39) + 4|0);
 HEAP32[$40>>2] = $38;
 $41 = $top;
 $42 = (($41) + 8|0);
 $top = $42;
 while(1) {
  $43 = $top;
  $44 = (($43) + -8|0);
  $top = $44;
  $45 = ($44>>>0)>=($Stack>>>0);
  if (!($45)) {
   break;
  }
  $46 = $top;
  $47 = HEAP32[$46>>2]|0;
  $p = $47;
  $48 = $top;
  $49 = (($48) + 4|0);
  $50 = HEAP32[$49>>2]|0;
  $r = $50;
  while(1) {
   $51 = $r;
   $52 = $p;
   $53 = (($52) + 40|0);
   $54 = ($51>>>0)>($53>>>0);
   if (!($54)) {
    break;
   }
   $55 = $seed;
   $56 = Math_imul($55, 1539415821)|0;
   $57 = (($56) + 1)|0;
   $seed = $57;
   $58 = $p;
   $59 = $seed;
   $60 = $r;
   $61 = $p;
   $62 = $60;
   $63 = $61;
   $64 = (($62) - ($63))|0;
   $65 = (($64|0) / 4)&-1;
   $66 = (($65) + 1)|0;
   $67 = (($59>>>0) % ($66>>>0))&-1;
   $68 = (($58) + ($67<<2)|0);
   $i = $68;
   $69 = $i;
   $70 = HEAP32[$69>>2]|0;
   $piv = $70;
   $71 = $p;
   $72 = HEAP32[$71>>2]|0;
   $73 = $i;
   HEAP32[$73>>2] = $72;
   $74 = $piv;
   $75 = $p;
   HEAP32[$75>>2] = $74;
   $76 = $p;
   $77 = (($76) + -4|0);
   $i = $77;
   $78 = $r;
   $79 = (($78) + 4|0);
   $j = $79;
   while(1) {
    while(1) {
     $80 = $i;
     $81 = (($80) + 4|0);
     $i = $81;
     $82 = $i;
     $83 = HEAP32[$82>>2]|0;
     $84 = HEAP32[$83>>2]|0;
     $85 = (($84) + 28|0);
     $86 = +HEAPF32[$85>>2];
     $87 = $piv;
     $88 = HEAP32[$87>>2]|0;
     $89 = (($88) + 28|0);
     $90 = +HEAPF32[$89>>2];
     $91 = $86 < $90;
     if ($91) {
      $113 = 1;
     } else {
      $92 = $i;
      $93 = HEAP32[$92>>2]|0;
      $94 = HEAP32[$93>>2]|0;
      $95 = (($94) + 28|0);
      $96 = +HEAPF32[$95>>2];
      $97 = $piv;
      $98 = HEAP32[$97>>2]|0;
      $99 = (($98) + 28|0);
      $100 = +HEAPF32[$99>>2];
      $101 = $96 == $100;
      if ($101) {
       $102 = $i;
       $103 = HEAP32[$102>>2]|0;
       $104 = HEAP32[$103>>2]|0;
       $105 = (($104) + 32|0);
       $106 = +HEAPF32[$105>>2];
       $107 = $piv;
       $108 = HEAP32[$107>>2]|0;
       $109 = (($108) + 32|0);
       $110 = +HEAPF32[$109>>2];
       $111 = $106 <= $110;
       $315 = $111;
      } else {
       $315 = 0;
      }
      $113 = $315;
     }
     $112 = $113 ^ 1;
     if (!($112)) {
      break;
     }
    }
    while(1) {
     $114 = $j;
     $115 = (($114) + -4|0);
     $j = $115;
     $116 = $piv;
     $117 = HEAP32[$116>>2]|0;
     $118 = (($117) + 28|0);
     $119 = +HEAPF32[$118>>2];
     $120 = $j;
     $121 = HEAP32[$120>>2]|0;
     $122 = HEAP32[$121>>2]|0;
     $123 = (($122) + 28|0);
     $124 = +HEAPF32[$123>>2];
     $125 = $119 < $124;
     if ($125) {
      $147 = 1;
     } else {
      $126 = $piv;
      $127 = HEAP32[$126>>2]|0;
      $128 = (($127) + 28|0);
      $129 = +HEAPF32[$128>>2];
      $130 = $j;
      $131 = HEAP32[$130>>2]|0;
      $132 = HEAP32[$131>>2]|0;
      $133 = (($132) + 28|0);
      $134 = +HEAPF32[$133>>2];
      $135 = $129 == $134;
      if ($135) {
       $136 = $piv;
       $137 = HEAP32[$136>>2]|0;
       $138 = (($137) + 32|0);
       $139 = +HEAPF32[$138>>2];
       $140 = $j;
       $141 = HEAP32[$140>>2]|0;
       $142 = HEAP32[$141>>2]|0;
       $143 = (($142) + 32|0);
       $144 = +HEAPF32[$143>>2];
       $145 = $139 <= $144;
       $316 = $145;
      } else {
       $316 = 0;
      }
      $147 = $316;
     }
     $146 = $147 ^ 1;
     if (!($146)) {
      break;
     }
    }
    $148 = $i;
    $149 = HEAP32[$148>>2]|0;
    $tmp = $149;
    $150 = $j;
    $151 = HEAP32[$150>>2]|0;
    $152 = $i;
    HEAP32[$152>>2] = $151;
    $153 = $tmp;
    $154 = $j;
    HEAP32[$154>>2] = $153;
    $155 = $i;
    $156 = $j;
    $157 = ($155>>>0)<($156>>>0);
    if (!($157)) {
     break;
    }
   }
   $158 = $i;
   $159 = HEAP32[$158>>2]|0;
   $tmp1 = $159;
   $160 = $j;
   $161 = HEAP32[$160>>2]|0;
   $162 = $i;
   HEAP32[$162>>2] = $161;
   $163 = $tmp1;
   $164 = $j;
   HEAP32[$164>>2] = $163;
   $165 = $i;
   $166 = $p;
   $167 = $165;
   $168 = $166;
   $169 = (($167) - ($168))|0;
   $170 = (($169|0) / 4)&-1;
   $171 = $r;
   $172 = $j;
   $173 = $171;
   $174 = $172;
   $175 = (($173) - ($174))|0;
   $176 = (($175|0) / 4)&-1;
   $177 = ($170|0)<($176|0);
   if ($177) {
    $178 = $j;
    $179 = (($178) + 4|0);
    $180 = $top;
    HEAP32[$180>>2] = $179;
    $181 = $r;
    $182 = $top;
    $183 = (($182) + 4|0);
    HEAP32[$183>>2] = $181;
    $184 = $top;
    $185 = (($184) + 8|0);
    $top = $185;
    $186 = $i;
    $187 = (($186) + -4|0);
    $r = $187;
   } else {
    $188 = $p;
    $189 = $top;
    HEAP32[$189>>2] = $188;
    $190 = $i;
    $191 = (($190) + -4|0);
    $192 = $top;
    $193 = (($192) + 4|0);
    HEAP32[$193>>2] = $191;
    $194 = $top;
    $195 = (($194) + 8|0);
    $top = $195;
    $196 = $j;
    $197 = (($196) + 4|0);
    $p = $197;
   }
  }
  $198 = $p;
  $199 = (($198) + 4|0);
  $i = $199;
  while(1) {
   $200 = $i;
   $201 = $r;
   $202 = ($200>>>0)<=($201>>>0);
   if (!($202)) {
    break;
   }
   $203 = $i;
   $204 = HEAP32[$203>>2]|0;
   $piv = $204;
   $205 = $i;
   $j = $205;
   while(1) {
    $206 = $j;
    $207 = $p;
    $208 = ($206>>>0)>($207>>>0);
    if ($208) {
     $209 = $piv;
     $210 = HEAP32[$209>>2]|0;
     $211 = (($210) + 28|0);
     $212 = +HEAPF32[$211>>2];
     $213 = $j;
     $214 = (($213) + -4|0);
     $215 = HEAP32[$214>>2]|0;
     $216 = HEAP32[$215>>2]|0;
     $217 = (($216) + 28|0);
     $218 = +HEAPF32[$217>>2];
     $219 = $212 < $218;
     if ($219) {
      $243 = 1;
     } else {
      $220 = $piv;
      $221 = HEAP32[$220>>2]|0;
      $222 = (($221) + 28|0);
      $223 = +HEAPF32[$222>>2];
      $224 = $j;
      $225 = (($224) + -4|0);
      $226 = HEAP32[$225>>2]|0;
      $227 = HEAP32[$226>>2]|0;
      $228 = (($227) + 28|0);
      $229 = +HEAPF32[$228>>2];
      $230 = $223 == $229;
      if ($230) {
       $231 = $piv;
       $232 = HEAP32[$231>>2]|0;
       $233 = (($232) + 32|0);
       $234 = +HEAPF32[$233>>2];
       $235 = $j;
       $236 = (($235) + -4|0);
       $237 = HEAP32[$236>>2]|0;
       $238 = HEAP32[$237>>2]|0;
       $239 = (($238) + 32|0);
       $240 = +HEAPF32[$239>>2];
       $241 = $234 <= $240;
       $318 = $241;
      } else {
       $318 = 0;
      }
      $243 = $318;
     }
     $242 = $243 ^ 1;
     $317 = $242;
    } else {
     $317 = 0;
    }
    if (!($317)) {
     break;
    }
    $244 = $j;
    $245 = (($244) + -4|0);
    $246 = HEAP32[$245>>2]|0;
    $247 = $j;
    HEAP32[$247>>2] = $246;
    $248 = $j;
    $249 = (($248) + -4|0);
    $j = $249;
   }
   $250 = $piv;
   $251 = $j;
   HEAP32[$251>>2] = $250;
   $252 = $i;
   $253 = (($252) + 4|0);
   $i = $253;
  }
 }
 $254 = $1;
 $255 = (($254) + 12|0);
 $256 = HEAP32[$255>>2]|0;
 $257 = $1;
 $258 = (($257) + 16|0);
 HEAP32[$258>>2] = $256;
 $259 = $1;
 $260 = (($259) + 20|0);
 HEAP32[$260>>2] = 1;
 $261 = $1;
 $262 = HEAP32[$261>>2]|0;
 ___gl_pqHeapInit($262);
 $263 = $1;
 $264 = (($263) + 8|0);
 $265 = HEAP32[$264>>2]|0;
 $p = $265;
 $266 = $p;
 $267 = $1;
 $268 = (($267) + 12|0);
 $269 = HEAP32[$268>>2]|0;
 $270 = (($266) + ($269<<2)|0);
 $271 = (($270) + -4|0);
 $r = $271;
 $272 = $p;
 $i = $272;
 while(1) {
  $273 = $i;
  $274 = $r;
  $275 = ($273>>>0)<($274>>>0);
  if (!($275)) {
   label = 55;
   break;
  }
  $276 = $i;
  $277 = (($276) + 4|0);
  $278 = HEAP32[$277>>2]|0;
  $279 = HEAP32[$278>>2]|0;
  $280 = (($279) + 28|0);
  $281 = +HEAPF32[$280>>2];
  $282 = $i;
  $283 = HEAP32[$282>>2]|0;
  $284 = HEAP32[$283>>2]|0;
  $285 = (($284) + 28|0);
  $286 = +HEAPF32[$285>>2];
  $287 = $281 < $286;
  if (!($287)) {
   $288 = $i;
   $289 = (($288) + 4|0);
   $290 = HEAP32[$289>>2]|0;
   $291 = HEAP32[$290>>2]|0;
   $292 = (($291) + 28|0);
   $293 = +HEAPF32[$292>>2];
   $294 = $i;
   $295 = HEAP32[$294>>2]|0;
   $296 = HEAP32[$295>>2]|0;
   $297 = (($296) + 28|0);
   $298 = +HEAPF32[$297>>2];
   $299 = $293 == $298;
   if (!($299)) {
    label = 52;
    break;
   }
   $300 = $i;
   $301 = (($300) + 4|0);
   $302 = HEAP32[$301>>2]|0;
   $303 = HEAP32[$302>>2]|0;
   $304 = (($303) + 32|0);
   $305 = +HEAPF32[$304>>2];
   $306 = $i;
   $307 = HEAP32[$306>>2]|0;
   $308 = HEAP32[$307>>2]|0;
   $309 = (($308) + 32|0);
   $310 = +HEAPF32[$309>>2];
   $311 = $305 <= $310;
   if (!($311)) {
    label = 52;
    break;
   }
  }
  $312 = $i;
  $313 = (($312) + 4|0);
  $i = $313;
 }
 if ((label|0) == 52) {
  ___assert_fail((920|0),(872|0),203,(944|0));
  // unreachable;
 }
 else if ((label|0) == 55) {
  $0 = 1;
  $314 = $0;
  STACKTOP = sp;return ($314|0);
 }
 return 0|0;
}
function ___gl_pqSortInsert($pq,$keyNew) {
 $pq = $pq|0;
 $keyNew = $keyNew|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $curr = 0, $saveKey = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $pq;
 $2 = $keyNew;
 $3 = $1;
 $4 = (($3) + 20|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)!=(0);
 if ($6) {
  $7 = $1;
  $8 = HEAP32[$7>>2]|0;
  $9 = $2;
  $10 = (___gl_pqHeapInsert($8,$9)|0);
  $0 = $10;
  $57 = $0;
  STACKTOP = sp;return ($57|0);
 }
 $11 = $1;
 $12 = (($11) + 12|0);
 $13 = HEAP32[$12>>2]|0;
 $curr = $13;
 $14 = $1;
 $15 = (($14) + 12|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = (($16) + 1)|0;
 HEAP32[$15>>2] = $17;
 $18 = $1;
 $19 = (($18) + 16|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = ($17|0)>=($20|0);
 do {
  if ($21) {
   $22 = $1;
   $23 = (($22) + 4|0);
   $24 = HEAP32[$23>>2]|0;
   $saveKey = $24;
   $25 = $1;
   $26 = (($25) + 16|0);
   $27 = HEAP32[$26>>2]|0;
   $28 = $27 << 1;
   HEAP32[$26>>2] = $28;
   $29 = $1;
   $30 = (($29) + 4|0);
   $31 = HEAP32[$30>>2]|0;
   $32 = $1;
   $33 = (($32) + 16|0);
   $34 = HEAP32[$33>>2]|0;
   $35 = $34<<2;
   $36 = (_realloc($31,$35)|0);
   $37 = $1;
   $38 = (($37) + 4|0);
   HEAP32[$38>>2] = $36;
   $39 = $1;
   $40 = (($39) + 4|0);
   $41 = HEAP32[$40>>2]|0;
   $42 = ($41|0)==(0|0);
   if (!($42)) {
    break;
   }
   $43 = $saveKey;
   $44 = $1;
   $45 = (($44) + 4|0);
   HEAP32[$45>>2] = $43;
   $0 = 2147483647;
   $57 = $0;
   STACKTOP = sp;return ($57|0);
  }
 } while(0);
 $46 = $curr;
 $47 = ($46|0)!=(2147483647);
 if (!($47)) {
  ___assert_fail((960|0),(872|0),236,(976|0));
  // unreachable;
 }
 $48 = $2;
 $49 = $curr;
 $50 = $1;
 $51 = (($50) + 4|0);
 $52 = HEAP32[$51>>2]|0;
 $53 = (($52) + ($49<<2)|0);
 HEAP32[$53>>2] = $48;
 $54 = $curr;
 $55 = (($54) + 1)|0;
 $56 = (0 - ($55))|0;
 $0 = $56;
 $57 = $0;
 STACKTOP = sp;return ($57|0);
}
function ___gl_pqSortExtractMin($pq) {
 $pq = $pq|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0, $43 = 0, $44 = 0.0;
 var $45 = 0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0, $54 = 0.0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $9 = 0, $heapMin = 0, $sortMin = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $pq;
 $2 = $1;
 $3 = (($2) + 12|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0);
 if ($5) {
  $6 = $1;
  $7 = HEAP32[$6>>2]|0;
  $8 = (___gl_pqHeapExtractMin($7)|0);
  $0 = $8;
  $79 = $0;
  STACKTOP = sp;return ($79|0);
 }
 $9 = $1;
 $10 = (($9) + 12|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = (($11) - 1)|0;
 $13 = $1;
 $14 = (($13) + 8|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($15) + ($12<<2)|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = HEAP32[$17>>2]|0;
 $sortMin = $18;
 $19 = $1;
 $20 = HEAP32[$19>>2]|0;
 $21 = (($20) + 8|0);
 $22 = HEAP32[$21>>2]|0;
 $23 = ($22|0)==(0);
 L5: do {
  if (!($23)) {
   $24 = $1;
   $25 = HEAP32[$24>>2]|0;
   $26 = HEAP32[$25>>2]|0;
   $27 = (($26) + 4|0);
   $28 = HEAP32[$27>>2]|0;
   $29 = $1;
   $30 = HEAP32[$29>>2]|0;
   $31 = (($30) + 4|0);
   $32 = HEAP32[$31>>2]|0;
   $33 = (($32) + ($28<<3)|0);
   $34 = HEAP32[$33>>2]|0;
   $heapMin = $34;
   $35 = $heapMin;
   $36 = (($35) + 28|0);
   $37 = +HEAPF32[$36>>2];
   $38 = $sortMin;
   $39 = (($38) + 28|0);
   $40 = +HEAPF32[$39>>2];
   $41 = $37 < $40;
   do {
    if (!($41)) {
     $42 = $heapMin;
     $43 = (($42) + 28|0);
     $44 = +HEAPF32[$43>>2];
     $45 = $sortMin;
     $46 = (($45) + 28|0);
     $47 = +HEAPF32[$46>>2];
     $48 = $44 == $47;
     if ($48) {
      $49 = $heapMin;
      $50 = (($49) + 32|0);
      $51 = +HEAPF32[$50>>2];
      $52 = $sortMin;
      $53 = (($52) + 32|0);
      $54 = +HEAPF32[$53>>2];
      $55 = $51 <= $54;
      if ($55) {
       break;
      }
     }
     break L5;
    }
   } while(0);
   $56 = $1;
   $57 = HEAP32[$56>>2]|0;
   $58 = (___gl_pqHeapExtractMin($57)|0);
   $0 = $58;
   $79 = $0;
   STACKTOP = sp;return ($79|0);
  }
 } while(0);
 while(1) {
  $59 = $1;
  $60 = (($59) + 12|0);
  $61 = HEAP32[$60>>2]|0;
  $62 = (($61) + -1)|0;
  HEAP32[$60>>2] = $62;
  $63 = $1;
  $64 = (($63) + 12|0);
  $65 = HEAP32[$64>>2]|0;
  $66 = ($65|0)>(0);
  if ($66) {
   $67 = $1;
   $68 = (($67) + 12|0);
   $69 = HEAP32[$68>>2]|0;
   $70 = (($69) - 1)|0;
   $71 = $1;
   $72 = (($71) + 8|0);
   $73 = HEAP32[$72>>2]|0;
   $74 = (($73) + ($70<<2)|0);
   $75 = HEAP32[$74>>2]|0;
   $76 = HEAP32[$75>>2]|0;
   $77 = ($76|0)==(0|0);
   $80 = $77;
  } else {
   $80 = 0;
  }
  if (!($80)) {
   break;
  }
 }
 $78 = $sortMin;
 $0 = $78;
 $79 = $0;
 STACKTOP = sp;return ($79|0);
}
function ___gl_pqSortMinimum($pq) {
 $pq = $pq|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0.0, $46 = 0, $47 = 0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0, $59 = 0.0, $6 = 0, $60 = 0, $61 = 0, $62 = 0.0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $7 = 0, $8 = 0, $9 = 0, $heapMin = 0, $sortMin = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $pq;
 $2 = $1;
 $3 = (($2) + 12|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0);
 if ($5) {
  $6 = $1;
  $7 = HEAP32[$6>>2]|0;
  $8 = HEAP32[$7>>2]|0;
  $9 = (($8) + 4|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = $1;
  $12 = HEAP32[$11>>2]|0;
  $13 = (($12) + 4|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = (($14) + ($10<<3)|0);
  $16 = HEAP32[$15>>2]|0;
  $0 = $16;
  $66 = $0;
  STACKTOP = sp;return ($66|0);
 }
 $17 = $1;
 $18 = (($17) + 12|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = (($19) - 1)|0;
 $21 = $1;
 $22 = (($21) + 8|0);
 $23 = HEAP32[$22>>2]|0;
 $24 = (($23) + ($20<<2)|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = HEAP32[$25>>2]|0;
 $sortMin = $26;
 $27 = $1;
 $28 = HEAP32[$27>>2]|0;
 $29 = (($28) + 8|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ($30|0)==(0);
 L5: do {
  if (!($31)) {
   $32 = $1;
   $33 = HEAP32[$32>>2]|0;
   $34 = HEAP32[$33>>2]|0;
   $35 = (($34) + 4|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = $1;
   $38 = HEAP32[$37>>2]|0;
   $39 = (($38) + 4|0);
   $40 = HEAP32[$39>>2]|0;
   $41 = (($40) + ($36<<3)|0);
   $42 = HEAP32[$41>>2]|0;
   $heapMin = $42;
   $43 = $heapMin;
   $44 = (($43) + 28|0);
   $45 = +HEAPF32[$44>>2];
   $46 = $sortMin;
   $47 = (($46) + 28|0);
   $48 = +HEAPF32[$47>>2];
   $49 = $45 < $48;
   do {
    if (!($49)) {
     $50 = $heapMin;
     $51 = (($50) + 28|0);
     $52 = +HEAPF32[$51>>2];
     $53 = $sortMin;
     $54 = (($53) + 28|0);
     $55 = +HEAPF32[$54>>2];
     $56 = $52 == $55;
     if ($56) {
      $57 = $heapMin;
      $58 = (($57) + 32|0);
      $59 = +HEAPF32[$58>>2];
      $60 = $sortMin;
      $61 = (($60) + 32|0);
      $62 = +HEAPF32[$61>>2];
      $63 = $59 <= $62;
      if ($63) {
       break;
      }
     }
     break L5;
    }
   } while(0);
   $64 = $heapMin;
   $0 = $64;
   $66 = $0;
   STACKTOP = sp;return ($66|0);
  }
 } while(0);
 $65 = $sortMin;
 $0 = $65;
 $66 = $0;
 STACKTOP = sp;return ($66|0);
}
function ___gl_pqSortDelete($pq,$curr) {
 $pq = $pq|0;
 $curr = $curr|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pq;
 $1 = $curr;
 $2 = $1;
 $3 = ($2|0)>=(0);
 if ($3) {
  $4 = $0;
  $5 = HEAP32[$4>>2]|0;
  $6 = $1;
  ___gl_pqHeapDelete($5,$6);
  STACKTOP = sp;return;
 }
 $7 = $1;
 $8 = (($7) + 1)|0;
 $9 = (0 - ($8))|0;
 $1 = $9;
 $10 = $1;
 $11 = $0;
 $12 = (($11) + 16|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ($10|0)<($13|0);
 if (!($14)) {
  ___assert_fail((1000|0),(872|0),308,(1040|0));
  // unreachable;
 }
 $15 = $1;
 $16 = $0;
 $17 = (($16) + 4|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = (($18) + ($15<<2)|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = ($20|0)!=(0|0);
 if (!($21)) {
  ___assert_fail((1000|0),(872|0),308,(1040|0));
  // unreachable;
 }
 $22 = $1;
 $23 = $0;
 $24 = (($23) + 4|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = (($25) + ($22<<2)|0);
 HEAP32[$26>>2] = 0;
 while(1) {
  $27 = $0;
  $28 = (($27) + 12|0);
  $29 = HEAP32[$28>>2]|0;
  $30 = ($29|0)>(0);
  if ($30) {
   $31 = $0;
   $32 = (($31) + 12|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = (($33) - 1)|0;
   $35 = $0;
   $36 = (($35) + 8|0);
   $37 = HEAP32[$36>>2]|0;
   $38 = (($37) + ($34<<2)|0);
   $39 = HEAP32[$38>>2]|0;
   $40 = HEAP32[$39>>2]|0;
   $41 = ($40|0)==(0|0);
   $46 = $41;
  } else {
   $46 = 0;
  }
  if (!($46)) {
   break;
  }
  $42 = $0;
  $43 = (($42) + 12|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = (($44) + -1)|0;
  HEAP32[$43>>2] = $45;
 }
 STACKTOP = sp;return;
}
function ___gl_renderMesh($tess,$mesh) {
 $tess = $tess|0;
 $mesh = $mesh|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $f = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $mesh;
 $2 = $0;
 $3 = (($2) + 84|0);
 HEAP32[$3>>2] = 0;
 $4 = $1;
 $5 = (($4) + 40|0);
 $6 = HEAP32[$5>>2]|0;
 $f = $6;
 while(1) {
  $7 = $f;
  $8 = $1;
  $9 = (($8) + 40|0);
  $10 = ($7|0)!=($9|0);
  if (!($10)) {
   break;
  }
  $11 = $f;
  $12 = (($11) + 20|0);
  HEAP8[$12>>0] = 0;
  $13 = $f;
  $14 = HEAP32[$13>>2]|0;
  $f = $14;
 }
 $15 = $1;
 $16 = (($15) + 40|0);
 $17 = HEAP32[$16>>2]|0;
 $f = $17;
 while(1) {
  $18 = $f;
  $19 = $1;
  $20 = (($19) + 40|0);
  $21 = ($18|0)!=($20|0);
  if (!($21)) {
   break;
  }
  $22 = $f;
  $23 = (($22) + 21|0);
  $24 = HEAP8[$23>>0]|0;
  $25 = $24&255;
  $26 = ($25|0)!=(0);
  if ($26) {
   $27 = $f;
   $28 = (($27) + 20|0);
   $29 = HEAP8[$28>>0]|0;
   $30 = ($29<<24>>24)!=(0);
   if (!($30)) {
    $31 = $0;
    $32 = $f;
    _RenderMaximumFaceGroup($31,$32);
    $33 = $f;
    $34 = (($33) + 20|0);
    $35 = HEAP8[$34>>0]|0;
    $36 = $35&255;
    $37 = ($36|0)!=(0);
    if (!($37)) {
     label = 10;
     break;
    }
   }
  }
  $38 = $f;
  $39 = HEAP32[$38>>2]|0;
  $f = $39;
 }
 if ((label|0) == 10) {
  ___assert_fail((1096|0),(1112|0),94,(1128|0));
  // unreachable;
 }
 $40 = $0;
 $41 = (($40) + 84|0);
 $42 = HEAP32[$41>>2]|0;
 $43 = ($42|0)!=(0|0);
 if (!($43)) {
  STACKTOP = sp;return;
 }
 $44 = $0;
 $45 = $0;
 $46 = (($45) + 84|0);
 $47 = HEAP32[$46>>2]|0;
 _RenderLonelyTriangles($44,$47);
 $48 = $0;
 $49 = (($48) + 84|0);
 HEAP32[$49>>2] = 0;
 STACKTOP = sp;return;
}
function _RenderMaximumFaceGroup($tess,$fOrig) {
 $tess = $tess|0;
 $fOrig = $fOrig|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $e = 0, $max = 0, $newFace = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $max = sp + 84|0;
 $newFace = sp + 72|0;
 $2 = sp + 60|0;
 $3 = sp + 36|0;
 $4 = sp + 24|0;
 $5 = sp + 12|0;
 $6 = sp;
 $7 = sp + 48|0;
 $0 = $tess;
 $1 = $fOrig;
 $8 = $1;
 $9 = (($8) + 8|0);
 $10 = HEAP32[$9>>2]|0;
 $e = $10;
 HEAP32[$max>>2] = 1;
 $11 = $e;
 $12 = (($max) + 4|0);
 HEAP32[$12>>2] = $11;
 $13 = (($max) + 8|0);
 HEAP32[$13>>2] = 12;
 $14 = $0;
 $15 = (($14) + 80|0);
 $16 = HEAP8[$15>>0]|0;
 $17 = ($16<<24>>24)!=(0);
 if ($17) {
  $54 = (($max) + 8|0);
  $55 = HEAP32[$54>>2]|0;
  $56 = $0;
  $57 = (($max) + 4|0);
  $58 = HEAP32[$57>>2]|0;
  $59 = HEAP32[$max>>2]|0;
  FUNCTION_TABLE_viii[$55 & 15]($56,$58,$59);
  STACKTOP = sp;return;
 }
 $18 = $e;
 _MaximumFan($2,$18);
 ;HEAP32[$newFace+0>>2]=HEAP32[$2+0>>2]|0;HEAP32[$newFace+4>>2]=HEAP32[$2+4>>2]|0;HEAP32[$newFace+8>>2]=HEAP32[$2+8>>2]|0;
 $19 = HEAP32[$newFace>>2]|0;
 $20 = HEAP32[$max>>2]|0;
 $21 = ($19|0)>($20|0);
 if ($21) {
  ;HEAP32[$max+0>>2]=HEAP32[$newFace+0>>2]|0;HEAP32[$max+4>>2]=HEAP32[$newFace+4>>2]|0;HEAP32[$max+8>>2]=HEAP32[$newFace+8>>2]|0;
 }
 $22 = $e;
 $23 = (($22) + 12|0);
 $24 = HEAP32[$23>>2]|0;
 _MaximumFan($3,$24);
 ;HEAP32[$newFace+0>>2]=HEAP32[$3+0>>2]|0;HEAP32[$newFace+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$newFace+8>>2]=HEAP32[$3+8>>2]|0;
 $25 = HEAP32[$newFace>>2]|0;
 $26 = HEAP32[$max>>2]|0;
 $27 = ($25|0)>($26|0);
 if ($27) {
  ;HEAP32[$max+0>>2]=HEAP32[$newFace+0>>2]|0;HEAP32[$max+4>>2]=HEAP32[$newFace+4>>2]|0;HEAP32[$max+8>>2]=HEAP32[$newFace+8>>2]|0;
 }
 $28 = $e;
 $29 = (($28) + 8|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = (($30) + 4|0);
 $32 = HEAP32[$31>>2]|0;
 _MaximumFan($4,$32);
 ;HEAP32[$newFace+0>>2]=HEAP32[$4+0>>2]|0;HEAP32[$newFace+4>>2]=HEAP32[$4+4>>2]|0;HEAP32[$newFace+8>>2]=HEAP32[$4+8>>2]|0;
 $33 = HEAP32[$newFace>>2]|0;
 $34 = HEAP32[$max>>2]|0;
 $35 = ($33|0)>($34|0);
 if ($35) {
  ;HEAP32[$max+0>>2]=HEAP32[$newFace+0>>2]|0;HEAP32[$max+4>>2]=HEAP32[$newFace+4>>2]|0;HEAP32[$max+8>>2]=HEAP32[$newFace+8>>2]|0;
 }
 $36 = $e;
 _MaximumStrip($5,$36);
 ;HEAP32[$newFace+0>>2]=HEAP32[$5+0>>2]|0;HEAP32[$newFace+4>>2]=HEAP32[$5+4>>2]|0;HEAP32[$newFace+8>>2]=HEAP32[$5+8>>2]|0;
 $37 = HEAP32[$newFace>>2]|0;
 $38 = HEAP32[$max>>2]|0;
 $39 = ($37|0)>($38|0);
 if ($39) {
  ;HEAP32[$max+0>>2]=HEAP32[$newFace+0>>2]|0;HEAP32[$max+4>>2]=HEAP32[$newFace+4>>2]|0;HEAP32[$max+8>>2]=HEAP32[$newFace+8>>2]|0;
 }
 $40 = $e;
 $41 = (($40) + 12|0);
 $42 = HEAP32[$41>>2]|0;
 _MaximumStrip($6,$42);
 ;HEAP32[$newFace+0>>2]=HEAP32[$6+0>>2]|0;HEAP32[$newFace+4>>2]=HEAP32[$6+4>>2]|0;HEAP32[$newFace+8>>2]=HEAP32[$6+8>>2]|0;
 $43 = HEAP32[$newFace>>2]|0;
 $44 = HEAP32[$max>>2]|0;
 $45 = ($43|0)>($44|0);
 if ($45) {
  ;HEAP32[$max+0>>2]=HEAP32[$newFace+0>>2]|0;HEAP32[$max+4>>2]=HEAP32[$newFace+4>>2]|0;HEAP32[$max+8>>2]=HEAP32[$newFace+8>>2]|0;
 }
 $46 = $e;
 $47 = (($46) + 8|0);
 $48 = HEAP32[$47>>2]|0;
 $49 = (($48) + 4|0);
 $50 = HEAP32[$49>>2]|0;
 _MaximumStrip($7,$50);
 ;HEAP32[$newFace+0>>2]=HEAP32[$7+0>>2]|0;HEAP32[$newFace+4>>2]=HEAP32[$7+4>>2]|0;HEAP32[$newFace+8>>2]=HEAP32[$7+8>>2]|0;
 $51 = HEAP32[$newFace>>2]|0;
 $52 = HEAP32[$max>>2]|0;
 $53 = ($51|0)>($52|0);
 if ($53) {
  ;HEAP32[$max+0>>2]=HEAP32[$newFace+0>>2]|0;HEAP32[$max+4>>2]=HEAP32[$newFace+4>>2]|0;HEAP32[$max+8>>2]=HEAP32[$newFace+8>>2]|0;
 }
 $54 = (($max) + 8|0);
 $55 = HEAP32[$54>>2]|0;
 $56 = $0;
 $57 = (($max) + 4|0);
 $58 = HEAP32[$57>>2]|0;
 $59 = HEAP32[$max>>2]|0;
 FUNCTION_TABLE_viii[$55 & 15]($56,$58,$59);
 STACKTOP = sp;return;
}
function _RenderLonelyTriangles($tess,$f) {
 $tess = $tess|0;
 $f = $f|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $e = 0, $edgeState = 0, $newState = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $f;
 $edgeState = -1;
 $2 = $0;
 $3 = (($2) + 1716|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)!=(13|0);
 if ($5) {
  $6 = $0;
  $7 = (($6) + 1716|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = $0;
  $10 = (($9) + 1896|0);
  $11 = HEAP32[$10>>2]|0;
  FUNCTION_TABLE_vii[$8 & 63](4,$11);
 } else {
  $12 = $0;
  $13 = (($12) + 88|0);
  $14 = HEAP32[$13>>2]|0;
  FUNCTION_TABLE_vi[$14 & 63](4);
 }
 while(1) {
  $15 = $1;
  $16 = ($15|0)!=(0|0);
  if (!($16)) {
   break;
  }
  $17 = $1;
  $18 = (($17) + 8|0);
  $19 = HEAP32[$18>>2]|0;
  $e = $19;
  while(1) {
   $20 = $0;
   $21 = (($20) + 80|0);
   $22 = HEAP8[$21>>0]|0;
   $23 = ($22<<24>>24)!=(0);
   if ($23) {
    $24 = $e;
    $25 = (($24) + 4|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = (($26) + 20|0);
    $28 = HEAP32[$27>>2]|0;
    $29 = (($28) + 21|0);
    $30 = HEAP8[$29>>0]|0;
    $31 = ($30<<24>>24)!=(0);
    $32 = $31 ^ 1;
    $33 = $32&1;
    $newState = $33;
    $34 = $edgeState;
    $35 = $newState;
    $36 = ($34|0)!=($35|0);
    if ($36) {
     $37 = $newState;
     $edgeState = $37;
     $38 = $0;
     $39 = (($38) + 1720|0);
     $40 = HEAP32[$39>>2]|0;
     $41 = ($40|0)!=(14|0);
     if ($41) {
      $42 = $0;
      $43 = (($42) + 1720|0);
      $44 = HEAP32[$43>>2]|0;
      $45 = $edgeState;
      $46 = $45&255;
      $47 = $0;
      $48 = (($47) + 1896|0);
      $49 = HEAP32[$48>>2]|0;
      FUNCTION_TABLE_vii[$44 & 63]($46,$49);
     } else {
      $50 = $0;
      $51 = (($50) + 92|0);
      $52 = HEAP32[$51>>2]|0;
      $53 = $edgeState;
      $54 = $53&255;
      FUNCTION_TABLE_vi[$52 & 63]($54);
     }
    }
   }
   $55 = $0;
   $56 = (($55) + 1724|0);
   $57 = HEAP32[$56>>2]|0;
   $58 = ($57|0)!=(15|0);
   if ($58) {
    $59 = $0;
    $60 = (($59) + 1724|0);
    $61 = HEAP32[$60>>2]|0;
    $62 = $e;
    $63 = (($62) + 16|0);
    $64 = HEAP32[$63>>2]|0;
    $65 = (($64) + 12|0);
    $66 = HEAP32[$65>>2]|0;
    $67 = $0;
    $68 = (($67) + 1896|0);
    $69 = HEAP32[$68>>2]|0;
    FUNCTION_TABLE_vii[$61 & 63]($66,$69);
   } else {
    $70 = $0;
    $71 = (($70) + 96|0);
    $72 = HEAP32[$71>>2]|0;
    $73 = $e;
    $74 = (($73) + 16|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = (($75) + 12|0);
    $77 = HEAP32[$76>>2]|0;
    FUNCTION_TABLE_vi[$72 & 63]($77);
   }
   $78 = $e;
   $79 = (($78) + 12|0);
   $80 = HEAP32[$79>>2]|0;
   $e = $80;
   $81 = $e;
   $82 = $1;
   $83 = (($82) + 8|0);
   $84 = HEAP32[$83>>2]|0;
   $85 = ($81|0)!=($84|0);
   if (!($85)) {
    break;
   }
  }
  $86 = $1;
  $87 = (($86) + 16|0);
  $88 = HEAP32[$87>>2]|0;
  $1 = $88;
 }
 $89 = $0;
 $90 = (($89) + 1728|0);
 $91 = HEAP32[$90>>2]|0;
 $92 = ($91|0)!=(16|0);
 if ($92) {
  $93 = $0;
  $94 = (($93) + 1728|0);
  $95 = HEAP32[$94>>2]|0;
  $96 = $0;
  $97 = (($96) + 1896|0);
  $98 = HEAP32[$97>>2]|0;
  FUNCTION_TABLE_vi[$95 & 63]($98);
  STACKTOP = sp;return;
 } else {
  $99 = $0;
  $100 = (($99) + 100|0);
  $101 = HEAP32[$100>>2]|0;
  FUNCTION_TABLE_v[$101 & 31]();
  STACKTOP = sp;return;
 }
}
function ___gl_renderBoundary($tess,$mesh) {
 $tess = $tess|0;
 $mesh = $mesh|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $8 = 0, $9 = 0, $e = 0, $f = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $mesh;
 $2 = $1;
 $3 = (($2) + 40|0);
 $4 = HEAP32[$3>>2]|0;
 $f = $4;
 while(1) {
  $5 = $f;
  $6 = $1;
  $7 = (($6) + 40|0);
  $8 = ($5|0)!=($7|0);
  if (!($8)) {
   break;
  }
  $9 = $f;
  $10 = (($9) + 21|0);
  $11 = HEAP8[$10>>0]|0;
  $12 = ($11<<24>>24)!=(0);
  if ($12) {
   $13 = $0;
   $14 = (($13) + 1716|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = ($15|0)!=(13|0);
   if ($16) {
    $17 = $0;
    $18 = (($17) + 1716|0);
    $19 = HEAP32[$18>>2]|0;
    $20 = $0;
    $21 = (($20) + 1896|0);
    $22 = HEAP32[$21>>2]|0;
    FUNCTION_TABLE_vii[$19 & 63](2,$22);
   } else {
    $23 = $0;
    $24 = (($23) + 88|0);
    $25 = HEAP32[$24>>2]|0;
    FUNCTION_TABLE_vi[$25 & 63](2);
   }
   $26 = $f;
   $27 = (($26) + 8|0);
   $28 = HEAP32[$27>>2]|0;
   $e = $28;
   while(1) {
    $29 = $0;
    $30 = (($29) + 1724|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = ($31|0)!=(15|0);
    if ($32) {
     $33 = $0;
     $34 = (($33) + 1724|0);
     $35 = HEAP32[$34>>2]|0;
     $36 = $e;
     $37 = (($36) + 16|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = (($38) + 12|0);
     $40 = HEAP32[$39>>2]|0;
     $41 = $0;
     $42 = (($41) + 1896|0);
     $43 = HEAP32[$42>>2]|0;
     FUNCTION_TABLE_vii[$35 & 63]($40,$43);
    } else {
     $44 = $0;
     $45 = (($44) + 96|0);
     $46 = HEAP32[$45>>2]|0;
     $47 = $e;
     $48 = (($47) + 16|0);
     $49 = HEAP32[$48>>2]|0;
     $50 = (($49) + 12|0);
     $51 = HEAP32[$50>>2]|0;
     FUNCTION_TABLE_vi[$46 & 63]($51);
    }
    $52 = $e;
    $53 = (($52) + 12|0);
    $54 = HEAP32[$53>>2]|0;
    $e = $54;
    $55 = $e;
    $56 = $f;
    $57 = (($56) + 8|0);
    $58 = HEAP32[$57>>2]|0;
    $59 = ($55|0)!=($58|0);
    if (!($59)) {
     break;
    }
   }
   $60 = $0;
   $61 = (($60) + 1728|0);
   $62 = HEAP32[$61>>2]|0;
   $63 = ($62|0)!=(16|0);
   if ($63) {
    $64 = $0;
    $65 = (($64) + 1728|0);
    $66 = HEAP32[$65>>2]|0;
    $67 = $0;
    $68 = (($67) + 1896|0);
    $69 = HEAP32[$68>>2]|0;
    FUNCTION_TABLE_vi[$66 & 63]($69);
   } else {
    $70 = $0;
    $71 = (($70) + 100|0);
    $72 = HEAP32[$71>>2]|0;
    FUNCTION_TABLE_v[$72 & 31]();
   }
  }
  $73 = $f;
  $74 = HEAP32[$73>>2]|0;
  $f = $74;
 }
 STACKTOP = sp;return;
}
function ___gl_renderCache($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0.0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $18 = 0, $19 = 0.0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0.0, $27 = 0, $28 = 0, $29 = 0.0, $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $norm = 0, $sign = 0, $v0 = 0, $vc = 0, $vn = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $norm = sp + 16|0;
 $1 = $tess;
 $2 = $1;
 $3 = (($2) + 116|0);
 $v0 = $3;
 $4 = $v0;
 $5 = $1;
 $6 = (($5) + 112|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($4) + ($7<<4)|0);
 $vn = $8;
 $9 = $1;
 $10 = (($9) + 112|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ($11|0)<(3);
 if ($12) {
  $0 = 1;
  $169 = $0;
  STACKTOP = sp;return ($169|0);
 }
 $13 = $1;
 $14 = (($13) + 16|0);
 $15 = +HEAPF32[$14>>2];
 HEAPF32[$norm>>2] = $15;
 $16 = $1;
 $17 = (($16) + 16|0);
 $18 = (($17) + 4|0);
 $19 = +HEAPF32[$18>>2];
 $20 = (($norm) + 4|0);
 HEAPF32[$20>>2] = $19;
 $21 = $1;
 $22 = (($21) + 16|0);
 $23 = (($22) + 8|0);
 $24 = +HEAPF32[$23>>2];
 $25 = (($norm) + 8|0);
 HEAPF32[$25>>2] = $24;
 $26 = +HEAPF32[$norm>>2];
 $27 = $26 == 0.0;
 if ($27) {
  $28 = (($norm) + 4|0);
  $29 = +HEAPF32[$28>>2];
  $30 = $29 == 0.0;
  if ($30) {
   $31 = (($norm) + 8|0);
   $32 = +HEAPF32[$31>>2];
   $33 = $32 == 0.0;
   if ($33) {
    $34 = $1;
    (_ComputeNormal30($34,$norm,0)|0);
   }
  }
 }
 $35 = $1;
 $36 = (_ComputeNormal30($35,$norm,1)|0);
 $sign = $36;
 $37 = $sign;
 $38 = ($37|0)==(2);
 if ($38) {
  $0 = 0;
  $169 = $0;
  STACKTOP = sp;return ($169|0);
 }
 $39 = $sign;
 $40 = ($39|0)==(0);
 if ($40) {
  $0 = 1;
  $169 = $0;
  STACKTOP = sp;return ($169|0);
 }
 $41 = $1;
 $42 = (($41) + 56|0);
 $43 = HEAP32[$42>>2]|0;
 L18: do {
  switch ($43|0) {
  case 100134:  {
   $0 = 1;
   $169 = $0;
   STACKTOP = sp;return ($169|0);
   break;
  }
  case 100133:  {
   $46 = $sign;
   $47 = ($46|0)>(0);
   if (!($47)) {
    break L18;
   }
   $0 = 1;
   $169 = $0;
   STACKTOP = sp;return ($169|0);
   break;
  }
  case 100132:  {
   $44 = $sign;
   $45 = ($44|0)<(0);
   if (!($45)) {
    break L18;
   }
   $0 = 1;
   $169 = $0;
   STACKTOP = sp;return ($169|0);
   break;
  }
  case 100131: case 100130:  {
   break;
  }
  default: {
  }
  }
 } while(0);
 $48 = $1;
 $49 = (($48) + 1716|0);
 $50 = HEAP32[$49>>2]|0;
 $51 = ($50|0)!=(13|0);
 if ($51) {
  $52 = $1;
  $53 = (($52) + 1716|0);
  $54 = HEAP32[$53>>2]|0;
  $55 = $1;
  $56 = (($55) + 81|0);
  $57 = HEAP8[$56>>0]|0;
  $58 = $57&255;
  $59 = ($58|0)!=(0);
  if ($59) {
   $68 = 2;
  } else {
   $60 = $1;
   $61 = (($60) + 112|0);
   $62 = HEAP32[$61>>2]|0;
   $63 = ($62|0)>(3);
   $64 = $63 ? 6 : 4;
   $68 = $64;
  }
  $65 = $1;
  $66 = (($65) + 1896|0);
  $67 = HEAP32[$66>>2]|0;
  FUNCTION_TABLE_vii[$54 & 63]($68,$67);
 } else {
  $69 = $1;
  $70 = (($69) + 88|0);
  $71 = HEAP32[$70>>2]|0;
  $72 = $1;
  $73 = (($72) + 81|0);
  $74 = HEAP8[$73>>0]|0;
  $75 = $74&255;
  $76 = ($75|0)!=(0);
  if ($76) {
   $82 = 2;
  } else {
   $77 = $1;
   $78 = (($77) + 112|0);
   $79 = HEAP32[$78>>2]|0;
   $80 = ($79|0)>(3);
   $81 = $80 ? 6 : 4;
   $82 = $81;
  }
  FUNCTION_TABLE_vi[$71 & 63]($82);
 }
 $83 = $1;
 $84 = (($83) + 1724|0);
 $85 = HEAP32[$84>>2]|0;
 $86 = ($85|0)!=(15|0);
 if ($86) {
  $87 = $1;
  $88 = (($87) + 1724|0);
  $89 = HEAP32[$88>>2]|0;
  $90 = $v0;
  $91 = (($90) + 12|0);
  $92 = HEAP32[$91>>2]|0;
  $93 = $1;
  $94 = (($93) + 1896|0);
  $95 = HEAP32[$94>>2]|0;
  FUNCTION_TABLE_vii[$89 & 63]($92,$95);
 } else {
  $96 = $1;
  $97 = (($96) + 96|0);
  $98 = HEAP32[$97>>2]|0;
  $99 = $v0;
  $100 = (($99) + 12|0);
  $101 = HEAP32[$100>>2]|0;
  FUNCTION_TABLE_vi[$98 & 63]($101);
 }
 $102 = $sign;
 $103 = ($102|0)>(0);
 if ($103) {
  $104 = $v0;
  $105 = (($104) + 16|0);
  $vc = $105;
  while(1) {
   $106 = $vc;
   $107 = $vn;
   $108 = ($106>>>0)<($107>>>0);
   if (!($108)) {
    break;
   }
   $109 = $1;
   $110 = (($109) + 1724|0);
   $111 = HEAP32[$110>>2]|0;
   $112 = ($111|0)!=(15|0);
   if ($112) {
    $113 = $1;
    $114 = (($113) + 1724|0);
    $115 = HEAP32[$114>>2]|0;
    $116 = $vc;
    $117 = (($116) + 12|0);
    $118 = HEAP32[$117>>2]|0;
    $119 = $1;
    $120 = (($119) + 1896|0);
    $121 = HEAP32[$120>>2]|0;
    FUNCTION_TABLE_vii[$115 & 63]($118,$121);
   } else {
    $122 = $1;
    $123 = (($122) + 96|0);
    $124 = HEAP32[$123>>2]|0;
    $125 = $vc;
    $126 = (($125) + 12|0);
    $127 = HEAP32[$126>>2]|0;
    FUNCTION_TABLE_vi[$124 & 63]($127);
   }
   $128 = $vc;
   $129 = (($128) + 16|0);
   $vc = $129;
  }
 } else {
  $130 = $vn;
  $131 = (($130) + -16|0);
  $vc = $131;
  while(1) {
   $132 = $vc;
   $133 = $v0;
   $134 = ($132>>>0)>($133>>>0);
   if (!($134)) {
    break;
   }
   $135 = $1;
   $136 = (($135) + 1724|0);
   $137 = HEAP32[$136>>2]|0;
   $138 = ($137|0)!=(15|0);
   if ($138) {
    $139 = $1;
    $140 = (($139) + 1724|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = $vc;
    $143 = (($142) + 12|0);
    $144 = HEAP32[$143>>2]|0;
    $145 = $1;
    $146 = (($145) + 1896|0);
    $147 = HEAP32[$146>>2]|0;
    FUNCTION_TABLE_vii[$141 & 63]($144,$147);
   } else {
    $148 = $1;
    $149 = (($148) + 96|0);
    $150 = HEAP32[$149>>2]|0;
    $151 = $vc;
    $152 = (($151) + 12|0);
    $153 = HEAP32[$152>>2]|0;
    FUNCTION_TABLE_vi[$150 & 63]($153);
   }
   $154 = $vc;
   $155 = (($154) + -16|0);
   $vc = $155;
  }
 }
 $156 = $1;
 $157 = (($156) + 1728|0);
 $158 = HEAP32[$157>>2]|0;
 $159 = ($158|0)!=(16|0);
 if ($159) {
  $160 = $1;
  $161 = (($160) + 1728|0);
  $162 = HEAP32[$161>>2]|0;
  $163 = $1;
  $164 = (($163) + 1896|0);
  $165 = HEAP32[$164>>2]|0;
  FUNCTION_TABLE_vi[$162 & 63]($165);
 } else {
  $166 = $1;
  $167 = (($166) + 100|0);
  $168 = HEAP32[$167>>2]|0;
  FUNCTION_TABLE_v[$168 & 31]();
 }
 $0 = 1;
 $169 = $0;
 STACKTOP = sp;return ($169|0);
}
function _ComputeNormal30($tess,$norm,$check) {
 $tess = $tess|0;
 $norm = $norm|0;
 $check = $check|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0.0, $101 = 0, $102 = 0, $103 = 0.0, $104 = 0.0, $105 = 0.0, $106 = 0, $107 = 0, $108 = 0.0, $109 = 0, $11 = 0, $110 = 0.0, $111 = 0, $112 = 0.0, $113 = 0.0, $114 = 0, $115 = 0.0;
 var $116 = 0, $117 = 0, $118 = 0.0, $119 = 0.0, $12 = 0, $120 = 0, $121 = 0.0, $122 = 0, $123 = 0, $124 = 0.0, $125 = 0.0, $126 = 0.0, $127 = 0, $128 = 0.0, $129 = 0.0, $13 = 0, $130 = 0, $131 = 0.0, $132 = 0, $133 = 0;
 var $134 = 0.0, $135 = 0.0, $136 = 0, $137 = 0.0, $138 = 0, $139 = 0, $14 = 0, $140 = 0.0, $141 = 0.0, $142 = 0.0, $143 = 0, $144 = 0.0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0.0, $24 = 0.0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0.0, $32 = 0, $33 = 0;
 var $34 = 0.0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0.0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0.0, $44 = 0.0, $45 = 0.0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0.0, $51 = 0;
 var $52 = 0, $53 = 0.0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0.0, $58 = 0, $59 = 0, $6 = 0, $60 = 0.0, $61 = 0, $62 = 0, $63 = 0.0, $64 = 0.0, $65 = 0.0, $66 = 0.0, $67 = 0.0, $68 = 0.0, $69 = 0.0, $7 = 0;
 var $70 = 0.0, $71 = 0.0, $72 = 0.0, $73 = 0.0, $74 = 0.0, $75 = 0.0, $76 = 0.0, $77 = 0.0, $78 = 0.0, $79 = 0, $8 = 0, $80 = 0.0, $81 = 0.0, $82 = 0.0, $83 = 0.0, $84 = 0.0, $85 = 0.0, $86 = 0.0, $87 = 0, $88 = 0.0;
 var $89 = 0, $9 = 0, $90 = 0.0, $91 = 0.0, $92 = 0, $93 = 0.0, $94 = 0, $95 = 0, $96 = 0.0, $97 = 0.0, $98 = 0.0, $99 = 0, $dot = 0.0, $n = 0, $sign = 0, $v0 = 0, $vc = 0, $vn = 0, $xc = 0.0, $xp = 0.0;
 var $yc = 0.0, $yp = 0.0, $zc = 0.0, $zp = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $n = sp;
 $1 = $tess;
 $2 = $norm;
 $3 = $check;
 $4 = $1;
 $5 = (($4) + 116|0);
 $v0 = $5;
 $6 = $v0;
 $7 = $1;
 $8 = (($7) + 112|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = (($6) + ($9<<4)|0);
 $vn = $10;
 $sign = 0;
 $11 = $3;
 $12 = ($11|0)!=(0);
 if (!($12)) {
  $13 = $2;
  $14 = (($13) + 8|0);
  HEAPF32[$14>>2] = 0.0;
  $15 = $2;
  $16 = (($15) + 4|0);
  HEAPF32[$16>>2] = 0.0;
  $17 = $2;
  HEAPF32[$17>>2] = 0.0;
 }
 $18 = $v0;
 $19 = (($18) + 16|0);
 $vc = $19;
 $20 = $vc;
 $21 = +HEAPF32[$20>>2];
 $22 = $v0;
 $23 = +HEAPF32[$22>>2];
 $24 = $21 - $23;
 $xc = $24;
 $25 = $vc;
 $26 = (($25) + 4|0);
 $27 = +HEAPF32[$26>>2];
 $28 = $v0;
 $29 = (($28) + 4|0);
 $30 = +HEAPF32[$29>>2];
 $31 = $27 - $30;
 $yc = $31;
 $32 = $vc;
 $33 = (($32) + 8|0);
 $34 = +HEAPF32[$33>>2];
 $35 = $v0;
 $36 = (($35) + 8|0);
 $37 = +HEAPF32[$36>>2];
 $38 = $34 - $37;
 $zc = $38;
 while(1) {
  $39 = $vc;
  $40 = (($39) + 16|0);
  $vc = $40;
  $41 = $vn;
  $42 = ($40>>>0)<($41>>>0);
  if (!($42)) {
   label = 21;
   break;
  }
  $43 = $xc;
  $xp = $43;
  $44 = $yc;
  $yp = $44;
  $45 = $zc;
  $zp = $45;
  $46 = $vc;
  $47 = +HEAPF32[$46>>2];
  $48 = $v0;
  $49 = +HEAPF32[$48>>2];
  $50 = $47 - $49;
  $xc = $50;
  $51 = $vc;
  $52 = (($51) + 4|0);
  $53 = +HEAPF32[$52>>2];
  $54 = $v0;
  $55 = (($54) + 4|0);
  $56 = +HEAPF32[$55>>2];
  $57 = $53 - $56;
  $yc = $57;
  $58 = $vc;
  $59 = (($58) + 8|0);
  $60 = +HEAPF32[$59>>2];
  $61 = $v0;
  $62 = (($61) + 8|0);
  $63 = +HEAPF32[$62>>2];
  $64 = $60 - $63;
  $zc = $64;
  $65 = $yp;
  $66 = $zc;
  $67 = $65 * $66;
  $68 = $zp;
  $69 = $yc;
  $70 = $68 * $69;
  $71 = $67 - $70;
  HEAPF32[$n>>2] = $71;
  $72 = $zp;
  $73 = $xc;
  $74 = $72 * $73;
  $75 = $xp;
  $76 = $zc;
  $77 = $75 * $76;
  $78 = $74 - $77;
  $79 = (($n) + 4|0);
  HEAPF32[$79>>2] = $78;
  $80 = $xp;
  $81 = $yc;
  $82 = $80 * $81;
  $83 = $yp;
  $84 = $xc;
  $85 = $83 * $84;
  $86 = $82 - $85;
  $87 = (($n) + 8|0);
  HEAPF32[$87>>2] = $86;
  $88 = +HEAPF32[$n>>2];
  $89 = $2;
  $90 = +HEAPF32[$89>>2];
  $91 = $88 * $90;
  $92 = (($n) + 4|0);
  $93 = +HEAPF32[$92>>2];
  $94 = $2;
  $95 = (($94) + 4|0);
  $96 = +HEAPF32[$95>>2];
  $97 = $93 * $96;
  $98 = $91 + $97;
  $99 = (($n) + 8|0);
  $100 = +HEAPF32[$99>>2];
  $101 = $2;
  $102 = (($101) + 8|0);
  $103 = +HEAPF32[$102>>2];
  $104 = $100 * $103;
  $105 = $98 + $104;
  $dot = $105;
  $106 = $3;
  $107 = ($106|0)!=(0);
  if ($107) {
   $142 = $dot;
   $143 = $142 != 0.0;
   if ($143) {
    $144 = $dot;
    $145 = $144 > 0.0;
    if ($145) {
     $146 = $sign;
     $147 = ($146|0)<(0);
     if ($147) {
      label = 13;
      break;
     }
     $sign = 1;
    } else {
     $148 = $sign;
     $149 = ($148|0)>(0);
     if ($149) {
      label = 16;
      break;
     }
     $sign = -1;
    }
   }
  } else {
   $108 = $dot;
   $109 = $108 >= 0.0;
   if ($109) {
    $110 = +HEAPF32[$n>>2];
    $111 = $2;
    $112 = +HEAPF32[$111>>2];
    $113 = $112 + $110;
    HEAPF32[$111>>2] = $113;
    $114 = (($n) + 4|0);
    $115 = +HEAPF32[$114>>2];
    $116 = $2;
    $117 = (($116) + 4|0);
    $118 = +HEAPF32[$117>>2];
    $119 = $118 + $115;
    HEAPF32[$117>>2] = $119;
    $120 = (($n) + 8|0);
    $121 = +HEAPF32[$120>>2];
    $122 = $2;
    $123 = (($122) + 8|0);
    $124 = +HEAPF32[$123>>2];
    $125 = $124 + $121;
    HEAPF32[$123>>2] = $125;
   } else {
    $126 = +HEAPF32[$n>>2];
    $127 = $2;
    $128 = +HEAPF32[$127>>2];
    $129 = $128 - $126;
    HEAPF32[$127>>2] = $129;
    $130 = (($n) + 4|0);
    $131 = +HEAPF32[$130>>2];
    $132 = $2;
    $133 = (($132) + 4|0);
    $134 = +HEAPF32[$133>>2];
    $135 = $134 - $131;
    HEAPF32[$133>>2] = $135;
    $136 = (($n) + 8|0);
    $137 = +HEAPF32[$136>>2];
    $138 = $2;
    $139 = (($138) + 8|0);
    $140 = +HEAPF32[$139>>2];
    $141 = $140 - $137;
    HEAPF32[$139>>2] = $141;
   }
  }
 }
 if ((label|0) == 13) {
  $0 = 2;
  $151 = $0;
  STACKTOP = sp;return ($151|0);
 }
 else if ((label|0) == 16) {
  $0 = 2;
  $151 = $0;
  STACKTOP = sp;return ($151|0);
 }
 else if ((label|0) == 21) {
  $150 = $sign;
  $0 = $150;
  $151 = $0;
  STACKTOP = sp;return ($151|0);
 }
 return 0|0;
}
function _RenderTriangle($tess,$e,$size) {
 $tess = $tess|0;
 $e = $e|0;
 $size = $size|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $e;
 $2 = $size;
 $3 = $2;
 $4 = ($3|0)==(1);
 if ($4) {
  $5 = $0;
  $6 = (($5) + 84|0);
  $7 = HEAP32[$6>>2]|0;
  $8 = $1;
  $9 = (($8) + 20|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = (($10) + 16|0);
  HEAP32[$11>>2] = $7;
  $12 = $1;
  $13 = (($12) + 20|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = $0;
  $16 = (($15) + 84|0);
  HEAP32[$16>>2] = $14;
  $17 = $1;
  $18 = (($17) + 20|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = (($19) + 20|0);
  HEAP8[$20>>0] = 1;
  STACKTOP = sp;return;
 } else {
  ___assert_fail((1216|0),(1112|0),283,(1224|0));
  // unreachable;
 }
}
function _MaximumFan($agg$result,$eOrig) {
 $agg$result = $agg$result|0;
 $eOrig = $eOrig|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $9 = 0, $e = 0, $newFace = 0, $trail = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $newFace = sp;
 $0 = $eOrig;
 ;HEAP32[$newFace+0>>2]=HEAP32[1184+0>>2]|0;HEAP32[$newFace+4>>2]=HEAP32[1184+4>>2]|0;HEAP32[$newFace+8>>2]=HEAP32[1184+8>>2]|0;
 $trail = 0;
 $1 = $0;
 $e = $1;
 while(1) {
  $2 = $e;
  $3 = (($2) + 20|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = (($4) + 21|0);
  $6 = HEAP8[$5>>0]|0;
  $7 = ($6<<24>>24)!=(0);
  if ($7) {
   $8 = $e;
   $9 = (($8) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = (($10) + 20|0);
   $12 = HEAP8[$11>>0]|0;
   $13 = $12&255;
   $14 = ($13|0)!=(0);
   $16 = $14;
  } else {
   $16 = 1;
  }
  $15 = $16 ^ 1;
  if (!($15)) {
   break;
  }
  $17 = $trail;
  $18 = $e;
  $19 = (($18) + 20|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = (($20) + 16|0);
  HEAP32[$21>>2] = $17;
  $22 = $e;
  $23 = (($22) + 20|0);
  $24 = HEAP32[$23>>2]|0;
  $trail = $24;
  $25 = $e;
  $26 = (($25) + 20|0);
  $27 = HEAP32[$26>>2]|0;
  $28 = (($27) + 20|0);
  HEAP8[$28>>0] = 1;
  $29 = HEAP32[$newFace>>2]|0;
  $30 = (($29) + 1)|0;
  HEAP32[$newFace>>2] = $30;
  $31 = $e;
  $32 = (($31) + 8|0);
  $33 = HEAP32[$32>>2]|0;
  $e = $33;
 }
 $34 = $0;
 $e = $34;
 while(1) {
  $35 = $e;
  $36 = (($35) + 4|0);
  $37 = HEAP32[$36>>2]|0;
  $38 = (($37) + 20|0);
  $39 = HEAP32[$38>>2]|0;
  $40 = (($39) + 21|0);
  $41 = HEAP8[$40>>0]|0;
  $42 = ($41<<24>>24)!=(0);
  if ($42) {
   $43 = $e;
   $44 = (($43) + 4|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = (($45) + 20|0);
   $47 = HEAP32[$46>>2]|0;
   $48 = (($47) + 20|0);
   $49 = HEAP8[$48>>0]|0;
   $50 = $49&255;
   $51 = ($50|0)!=(0);
   $53 = $51;
  } else {
   $53 = 1;
  }
  $52 = $53 ^ 1;
  if (!($52)) {
   break;
  }
  $54 = $trail;
  $55 = $e;
  $56 = (($55) + 4|0);
  $57 = HEAP32[$56>>2]|0;
  $58 = (($57) + 20|0);
  $59 = HEAP32[$58>>2]|0;
  $60 = (($59) + 16|0);
  HEAP32[$60>>2] = $54;
  $61 = $e;
  $62 = (($61) + 4|0);
  $63 = HEAP32[$62>>2]|0;
  $64 = (($63) + 20|0);
  $65 = HEAP32[$64>>2]|0;
  $trail = $65;
  $66 = $e;
  $67 = (($66) + 4|0);
  $68 = HEAP32[$67>>2]|0;
  $69 = (($68) + 20|0);
  $70 = HEAP32[$69>>2]|0;
  $71 = (($70) + 20|0);
  HEAP8[$71>>0] = 1;
  $72 = HEAP32[$newFace>>2]|0;
  $73 = (($72) + 1)|0;
  HEAP32[$newFace>>2] = $73;
  $74 = $e;
  $75 = (($74) + 4|0);
  $76 = HEAP32[$75>>2]|0;
  $77 = (($76) + 12|0);
  $78 = HEAP32[$77>>2]|0;
  $e = $78;
 }
 $79 = $e;
 $80 = (($newFace) + 4|0);
 HEAP32[$80>>2] = $79;
 while(1) {
  $81 = $trail;
  $82 = ($81|0)!=(0|0);
  if (!($82)) {
   break;
  }
  $83 = $trail;
  $84 = (($83) + 20|0);
  HEAP8[$84>>0] = 0;
  $85 = $trail;
  $86 = (($85) + 16|0);
  $87 = HEAP32[$86>>2]|0;
  $trail = $87;
 }
 ;HEAP32[$agg$result+0>>2]=HEAP32[$newFace+0>>2]|0;HEAP32[$agg$result+4>>2]=HEAP32[$newFace+4>>2]|0;HEAP32[$agg$result+8>>2]=HEAP32[$newFace+8>>2]|0;
 STACKTOP = sp;return;
}
function _MaximumStrip($agg$result,$eOrig) {
 $agg$result = $agg$result|0;
 $eOrig = $eOrig|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $e = 0, $eHead = 0, $eTail = 0, $headSize = 0, $newFace = 0, $tailSize = 0, $trail = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $newFace = sp;
 $0 = $eOrig;
 ;HEAP32[$newFace+0>>2]=HEAP32[1144+0>>2]|0;HEAP32[$newFace+4>>2]=HEAP32[1144+4>>2]|0;HEAP32[$newFace+8>>2]=HEAP32[1144+8>>2]|0;
 $headSize = 0;
 $tailSize = 0;
 $trail = 0;
 $1 = $0;
 $e = $1;
 while(1) {
  $2 = $e;
  $3 = (($2) + 20|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = (($4) + 21|0);
  $6 = HEAP8[$5>>0]|0;
  $7 = ($6<<24>>24)!=(0);
  if ($7) {
   $8 = $e;
   $9 = (($8) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = (($10) + 20|0);
   $12 = HEAP8[$11>>0]|0;
   $13 = $12&255;
   $14 = ($13|0)!=(0);
   $16 = $14;
  } else {
   $16 = 1;
  }
  $15 = $16 ^ 1;
  if (!($15)) {
   break;
  }
  $17 = $trail;
  $18 = $e;
  $19 = (($18) + 20|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = (($20) + 16|0);
  HEAP32[$21>>2] = $17;
  $22 = $e;
  $23 = (($22) + 20|0);
  $24 = HEAP32[$23>>2]|0;
  $trail = $24;
  $25 = $e;
  $26 = (($25) + 20|0);
  $27 = HEAP32[$26>>2]|0;
  $28 = (($27) + 20|0);
  HEAP8[$28>>0] = 1;
  $29 = $tailSize;
  $30 = (($29) + 1)|0;
  $tailSize = $30;
  $31 = $e;
  $32 = (($31) + 12|0);
  $33 = HEAP32[$32>>2]|0;
  $34 = (($33) + 4|0);
  $35 = HEAP32[$34>>2]|0;
  $e = $35;
  $36 = $e;
  $37 = (($36) + 20|0);
  $38 = HEAP32[$37>>2]|0;
  $39 = (($38) + 21|0);
  $40 = HEAP8[$39>>0]|0;
  $41 = ($40<<24>>24)!=(0);
  if (!($41)) {
   label = 7;
   break;
  }
  $42 = $e;
  $43 = (($42) + 20|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = (($44) + 20|0);
  $46 = HEAP8[$45>>0]|0;
  $47 = $46&255;
  $48 = ($47|0)!=(0);
  if ($48) {
   label = 7;
   break;
  }
  $49 = $trail;
  $50 = $e;
  $51 = (($50) + 20|0);
  $52 = HEAP32[$51>>2]|0;
  $53 = (($52) + 16|0);
  HEAP32[$53>>2] = $49;
  $54 = $e;
  $55 = (($54) + 20|0);
  $56 = HEAP32[$55>>2]|0;
  $trail = $56;
  $57 = $e;
  $58 = (($57) + 20|0);
  $59 = HEAP32[$58>>2]|0;
  $60 = (($59) + 20|0);
  HEAP8[$60>>0] = 1;
  $61 = $tailSize;
  $62 = (($61) + 1)|0;
  $tailSize = $62;
  $63 = $e;
  $64 = (($63) + 8|0);
  $65 = HEAP32[$64>>2]|0;
  $e = $65;
 }
 if ((label|0) == 7) {
 }
 $66 = $e;
 $eTail = $66;
 $67 = $0;
 $e = $67;
 while(1) {
  $68 = $e;
  $69 = (($68) + 4|0);
  $70 = HEAP32[$69>>2]|0;
  $71 = (($70) + 20|0);
  $72 = HEAP32[$71>>2]|0;
  $73 = (($72) + 21|0);
  $74 = HEAP8[$73>>0]|0;
  $75 = ($74<<24>>24)!=(0);
  if ($75) {
   $76 = $e;
   $77 = (($76) + 4|0);
   $78 = HEAP32[$77>>2]|0;
   $79 = (($78) + 20|0);
   $80 = HEAP32[$79>>2]|0;
   $81 = (($80) + 20|0);
   $82 = HEAP8[$81>>0]|0;
   $83 = $82&255;
   $84 = ($83|0)!=(0);
   $86 = $84;
  } else {
   $86 = 1;
  }
  $85 = $86 ^ 1;
  if (!($85)) {
   break;
  }
  $87 = $trail;
  $88 = $e;
  $89 = (($88) + 4|0);
  $90 = HEAP32[$89>>2]|0;
  $91 = (($90) + 20|0);
  $92 = HEAP32[$91>>2]|0;
  $93 = (($92) + 16|0);
  HEAP32[$93>>2] = $87;
  $94 = $e;
  $95 = (($94) + 4|0);
  $96 = HEAP32[$95>>2]|0;
  $97 = (($96) + 20|0);
  $98 = HEAP32[$97>>2]|0;
  $trail = $98;
  $99 = $e;
  $100 = (($99) + 4|0);
  $101 = HEAP32[$100>>2]|0;
  $102 = (($101) + 20|0);
  $103 = HEAP32[$102>>2]|0;
  $104 = (($103) + 20|0);
  HEAP8[$104>>0] = 1;
  $105 = $headSize;
  $106 = (($105) + 1)|0;
  $headSize = $106;
  $107 = $e;
  $108 = (($107) + 4|0);
  $109 = HEAP32[$108>>2]|0;
  $110 = (($109) + 12|0);
  $111 = HEAP32[$110>>2]|0;
  $e = $111;
  $112 = $e;
  $113 = (($112) + 4|0);
  $114 = HEAP32[$113>>2]|0;
  $115 = (($114) + 20|0);
  $116 = HEAP32[$115>>2]|0;
  $117 = (($116) + 21|0);
  $118 = HEAP8[$117>>0]|0;
  $119 = ($118<<24>>24)!=(0);
  if (!($119)) {
   label = 16;
   break;
  }
  $120 = $e;
  $121 = (($120) + 4|0);
  $122 = HEAP32[$121>>2]|0;
  $123 = (($122) + 20|0);
  $124 = HEAP32[$123>>2]|0;
  $125 = (($124) + 20|0);
  $126 = HEAP8[$125>>0]|0;
  $127 = $126&255;
  $128 = ($127|0)!=(0);
  if ($128) {
   label = 16;
   break;
  }
  $129 = $trail;
  $130 = $e;
  $131 = (($130) + 4|0);
  $132 = HEAP32[$131>>2]|0;
  $133 = (($132) + 20|0);
  $134 = HEAP32[$133>>2]|0;
  $135 = (($134) + 16|0);
  HEAP32[$135>>2] = $129;
  $136 = $e;
  $137 = (($136) + 4|0);
  $138 = HEAP32[$137>>2]|0;
  $139 = (($138) + 20|0);
  $140 = HEAP32[$139>>2]|0;
  $trail = $140;
  $141 = $e;
  $142 = (($141) + 4|0);
  $143 = HEAP32[$142>>2]|0;
  $144 = (($143) + 20|0);
  $145 = HEAP32[$144>>2]|0;
  $146 = (($145) + 20|0);
  HEAP8[$146>>0] = 1;
  $147 = $headSize;
  $148 = (($147) + 1)|0;
  $headSize = $148;
  $149 = $e;
  $150 = (($149) + 4|0);
  $151 = HEAP32[$150>>2]|0;
  $152 = (($151) + 8|0);
  $153 = HEAP32[$152>>2]|0;
  $154 = (($153) + 4|0);
  $155 = HEAP32[$154>>2]|0;
  $e = $155;
 }
 if ((label|0) == 16) {
 }
 $156 = $e;
 $eHead = $156;
 $157 = $tailSize;
 $158 = $headSize;
 $159 = (($157) + ($158))|0;
 HEAP32[$newFace>>2] = $159;
 $160 = $tailSize;
 $161 = $160 & 1;
 $162 = ($161|0)==(0);
 if ($162) {
  $163 = $eTail;
  $164 = (($163) + 4|0);
  $165 = HEAP32[$164>>2]|0;
  $166 = (($newFace) + 4|0);
  HEAP32[$166>>2] = $165;
 } else {
  $167 = $headSize;
  $168 = $167 & 1;
  $169 = ($168|0)==(0);
  if ($169) {
   $170 = $eHead;
   $171 = (($newFace) + 4|0);
   HEAP32[$171>>2] = $170;
  } else {
   $172 = HEAP32[$newFace>>2]|0;
   $173 = (($172) + -1)|0;
   HEAP32[$newFace>>2] = $173;
   $174 = $eHead;
   $175 = (($174) + 8|0);
   $176 = HEAP32[$175>>2]|0;
   $177 = (($newFace) + 4|0);
   HEAP32[$177>>2] = $176;
  }
 }
 while(1) {
  $178 = $trail;
  $179 = ($178|0)!=(0|0);
  if (!($179)) {
   break;
  }
  $180 = $trail;
  $181 = (($180) + 20|0);
  HEAP8[$181>>0] = 0;
  $182 = $trail;
  $183 = (($182) + 16|0);
  $184 = HEAP32[$183>>2]|0;
  $trail = $184;
 }
 ;HEAP32[$agg$result+0>>2]=HEAP32[$newFace+0>>2]|0;HEAP32[$agg$result+4>>2]=HEAP32[$newFace+4>>2]|0;HEAP32[$agg$result+8>>2]=HEAP32[$newFace+8>>2]|0;
 STACKTOP = sp;return;
}
function _RenderStrip($tess,$e,$size) {
 $tess = $tess|0;
 $e = $e|0;
 $size = $size|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $e;
 $2 = $size;
 $3 = $0;
 $4 = (($3) + 1716|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)!=(13|0);
 if ($6) {
  $7 = $0;
  $8 = (($7) + 1716|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $0;
  $11 = (($10) + 1896|0);
  $12 = HEAP32[$11>>2]|0;
  FUNCTION_TABLE_vii[$9 & 63](5,$12);
 } else {
  $13 = $0;
  $14 = (($13) + 88|0);
  $15 = HEAP32[$14>>2]|0;
  FUNCTION_TABLE_vi[$15 & 63](5);
 }
 $16 = $0;
 $17 = (($16) + 1724|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ($18|0)!=(15|0);
 if ($19) {
  $20 = $0;
  $21 = (($20) + 1724|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = $1;
  $24 = (($23) + 16|0);
  $25 = HEAP32[$24>>2]|0;
  $26 = (($25) + 12|0);
  $27 = HEAP32[$26>>2]|0;
  $28 = $0;
  $29 = (($28) + 1896|0);
  $30 = HEAP32[$29>>2]|0;
  FUNCTION_TABLE_vii[$22 & 63]($27,$30);
 } else {
  $31 = $0;
  $32 = (($31) + 96|0);
  $33 = HEAP32[$32>>2]|0;
  $34 = $1;
  $35 = (($34) + 16|0);
  $36 = HEAP32[$35>>2]|0;
  $37 = (($36) + 12|0);
  $38 = HEAP32[$37>>2]|0;
  FUNCTION_TABLE_vi[$33 & 63]($38);
 }
 $39 = $0;
 $40 = (($39) + 1724|0);
 $41 = HEAP32[$40>>2]|0;
 $42 = ($41|0)!=(15|0);
 if ($42) {
  $43 = $0;
  $44 = (($43) + 1724|0);
  $45 = HEAP32[$44>>2]|0;
  $46 = $1;
  $47 = (($46) + 4|0);
  $48 = HEAP32[$47>>2]|0;
  $49 = (($48) + 16|0);
  $50 = HEAP32[$49>>2]|0;
  $51 = (($50) + 12|0);
  $52 = HEAP32[$51>>2]|0;
  $53 = $0;
  $54 = (($53) + 1896|0);
  $55 = HEAP32[$54>>2]|0;
  FUNCTION_TABLE_vii[$45 & 63]($52,$55);
 } else {
  $56 = $0;
  $57 = (($56) + 96|0);
  $58 = HEAP32[$57>>2]|0;
  $59 = $1;
  $60 = (($59) + 4|0);
  $61 = HEAP32[$60>>2]|0;
  $62 = (($61) + 16|0);
  $63 = HEAP32[$62>>2]|0;
  $64 = (($63) + 12|0);
  $65 = HEAP32[$64>>2]|0;
  FUNCTION_TABLE_vi[$58 & 63]($65);
 }
 while(1) {
  $66 = $1;
  $67 = (($66) + 20|0);
  $68 = HEAP32[$67>>2]|0;
  $69 = (($68) + 21|0);
  $70 = HEAP8[$69>>0]|0;
  $71 = ($70<<24>>24)!=(0);
  if ($71) {
   $72 = $1;
   $73 = (($72) + 20|0);
   $74 = HEAP32[$73>>2]|0;
   $75 = (($74) + 20|0);
   $76 = HEAP8[$75>>0]|0;
   $77 = $76&255;
   $78 = ($77|0)!=(0);
   $80 = $78;
  } else {
   $80 = 1;
  }
  $79 = $80 ^ 1;
  if (!($79)) {
   break;
  }
  $81 = $1;
  $82 = (($81) + 20|0);
  $83 = HEAP32[$82>>2]|0;
  $84 = (($83) + 20|0);
  HEAP8[$84>>0] = 1;
  $85 = $2;
  $86 = (($85) + -1)|0;
  $2 = $86;
  $87 = $1;
  $88 = (($87) + 12|0);
  $89 = HEAP32[$88>>2]|0;
  $90 = (($89) + 4|0);
  $91 = HEAP32[$90>>2]|0;
  $1 = $91;
  $92 = $0;
  $93 = (($92) + 1724|0);
  $94 = HEAP32[$93>>2]|0;
  $95 = ($94|0)!=(15|0);
  if ($95) {
   $96 = $0;
   $97 = (($96) + 1724|0);
   $98 = HEAP32[$97>>2]|0;
   $99 = $1;
   $100 = (($99) + 16|0);
   $101 = HEAP32[$100>>2]|0;
   $102 = (($101) + 12|0);
   $103 = HEAP32[$102>>2]|0;
   $104 = $0;
   $105 = (($104) + 1896|0);
   $106 = HEAP32[$105>>2]|0;
   FUNCTION_TABLE_vii[$98 & 63]($103,$106);
  } else {
   $107 = $0;
   $108 = (($107) + 96|0);
   $109 = HEAP32[$108>>2]|0;
   $110 = $1;
   $111 = (($110) + 16|0);
   $112 = HEAP32[$111>>2]|0;
   $113 = (($112) + 12|0);
   $114 = HEAP32[$113>>2]|0;
   FUNCTION_TABLE_vi[$109 & 63]($114);
  }
  $115 = $1;
  $116 = (($115) + 20|0);
  $117 = HEAP32[$116>>2]|0;
  $118 = (($117) + 21|0);
  $119 = HEAP8[$118>>0]|0;
  $120 = ($119<<24>>24)!=(0);
  if (!($120)) {
   label = 19;
   break;
  }
  $121 = $1;
  $122 = (($121) + 20|0);
  $123 = HEAP32[$122>>2]|0;
  $124 = (($123) + 20|0);
  $125 = HEAP8[$124>>0]|0;
  $126 = $125&255;
  $127 = ($126|0)!=(0);
  if ($127) {
   label = 19;
   break;
  }
  $128 = $1;
  $129 = (($128) + 20|0);
  $130 = HEAP32[$129>>2]|0;
  $131 = (($130) + 20|0);
  HEAP8[$131>>0] = 1;
  $132 = $2;
  $133 = (($132) + -1)|0;
  $2 = $133;
  $134 = $1;
  $135 = (($134) + 8|0);
  $136 = HEAP32[$135>>2]|0;
  $1 = $136;
  $137 = $0;
  $138 = (($137) + 1724|0);
  $139 = HEAP32[$138>>2]|0;
  $140 = ($139|0)!=(15|0);
  if ($140) {
   $141 = $0;
   $142 = (($141) + 1724|0);
   $143 = HEAP32[$142>>2]|0;
   $144 = $1;
   $145 = (($144) + 4|0);
   $146 = HEAP32[$145>>2]|0;
   $147 = (($146) + 16|0);
   $148 = HEAP32[$147>>2]|0;
   $149 = (($148) + 12|0);
   $150 = HEAP32[$149>>2]|0;
   $151 = $0;
   $152 = (($151) + 1896|0);
   $153 = HEAP32[$152>>2]|0;
   FUNCTION_TABLE_vii[$143 & 63]($150,$153);
  } else {
   $154 = $0;
   $155 = (($154) + 96|0);
   $156 = HEAP32[$155>>2]|0;
   $157 = $1;
   $158 = (($157) + 4|0);
   $159 = HEAP32[$158>>2]|0;
   $160 = (($159) + 16|0);
   $161 = HEAP32[$160>>2]|0;
   $162 = (($161) + 12|0);
   $163 = HEAP32[$162>>2]|0;
   FUNCTION_TABLE_vi[$156 & 63]($163);
  }
 }
 if ((label|0) == 19) {
 }
 $164 = $2;
 $165 = ($164|0)==(0);
 if (!($165)) {
  ___assert_fail((1160|0),(1112|0),373,(1168|0));
  // unreachable;
 }
 $166 = $0;
 $167 = (($166) + 1728|0);
 $168 = HEAP32[$167>>2]|0;
 $169 = ($168|0)!=(16|0);
 if ($169) {
  $170 = $0;
  $171 = (($170) + 1728|0);
  $172 = HEAP32[$171>>2]|0;
  $173 = $0;
  $174 = (($173) + 1896|0);
  $175 = HEAP32[$174>>2]|0;
  FUNCTION_TABLE_vi[$172 & 63]($175);
  STACKTOP = sp;return;
 } else {
  $176 = $0;
  $177 = (($176) + 100|0);
  $178 = HEAP32[$177>>2]|0;
  FUNCTION_TABLE_v[$178 & 31]();
  STACKTOP = sp;return;
 }
}
function _RenderFan($tess,$e,$size) {
 $tess = $tess|0;
 $e = $e|0;
 $size = $size|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $14 = 0, $15 = 0;
 var $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $e;
 $2 = $size;
 $3 = $0;
 $4 = (($3) + 1716|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)!=(13|0);
 if ($6) {
  $7 = $0;
  $8 = (($7) + 1716|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $0;
  $11 = (($10) + 1896|0);
  $12 = HEAP32[$11>>2]|0;
  FUNCTION_TABLE_vii[$9 & 63](6,$12);
 } else {
  $13 = $0;
  $14 = (($13) + 88|0);
  $15 = HEAP32[$14>>2]|0;
  FUNCTION_TABLE_vi[$15 & 63](6);
 }
 $16 = $0;
 $17 = (($16) + 1724|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ($18|0)!=(15|0);
 if ($19) {
  $20 = $0;
  $21 = (($20) + 1724|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = $1;
  $24 = (($23) + 16|0);
  $25 = HEAP32[$24>>2]|0;
  $26 = (($25) + 12|0);
  $27 = HEAP32[$26>>2]|0;
  $28 = $0;
  $29 = (($28) + 1896|0);
  $30 = HEAP32[$29>>2]|0;
  FUNCTION_TABLE_vii[$22 & 63]($27,$30);
 } else {
  $31 = $0;
  $32 = (($31) + 96|0);
  $33 = HEAP32[$32>>2]|0;
  $34 = $1;
  $35 = (($34) + 16|0);
  $36 = HEAP32[$35>>2]|0;
  $37 = (($36) + 12|0);
  $38 = HEAP32[$37>>2]|0;
  FUNCTION_TABLE_vi[$33 & 63]($38);
 }
 $39 = $0;
 $40 = (($39) + 1724|0);
 $41 = HEAP32[$40>>2]|0;
 $42 = ($41|0)!=(15|0);
 if ($42) {
  $43 = $0;
  $44 = (($43) + 1724|0);
  $45 = HEAP32[$44>>2]|0;
  $46 = $1;
  $47 = (($46) + 4|0);
  $48 = HEAP32[$47>>2]|0;
  $49 = (($48) + 16|0);
  $50 = HEAP32[$49>>2]|0;
  $51 = (($50) + 12|0);
  $52 = HEAP32[$51>>2]|0;
  $53 = $0;
  $54 = (($53) + 1896|0);
  $55 = HEAP32[$54>>2]|0;
  FUNCTION_TABLE_vii[$45 & 63]($52,$55);
 } else {
  $56 = $0;
  $57 = (($56) + 96|0);
  $58 = HEAP32[$57>>2]|0;
  $59 = $1;
  $60 = (($59) + 4|0);
  $61 = HEAP32[$60>>2]|0;
  $62 = (($61) + 16|0);
  $63 = HEAP32[$62>>2]|0;
  $64 = (($63) + 12|0);
  $65 = HEAP32[$64>>2]|0;
  FUNCTION_TABLE_vi[$58 & 63]($65);
 }
 while(1) {
  $66 = $1;
  $67 = (($66) + 20|0);
  $68 = HEAP32[$67>>2]|0;
  $69 = (($68) + 21|0);
  $70 = HEAP8[$69>>0]|0;
  $71 = ($70<<24>>24)!=(0);
  if ($71) {
   $72 = $1;
   $73 = (($72) + 20|0);
   $74 = HEAP32[$73>>2]|0;
   $75 = (($74) + 20|0);
   $76 = HEAP8[$75>>0]|0;
   $77 = $76&255;
   $78 = ($77|0)!=(0);
   $80 = $78;
  } else {
   $80 = 1;
  }
  $79 = $80 ^ 1;
  if (!($79)) {
   break;
  }
  $81 = $1;
  $82 = (($81) + 20|0);
  $83 = HEAP32[$82>>2]|0;
  $84 = (($83) + 20|0);
  HEAP8[$84>>0] = 1;
  $85 = $2;
  $86 = (($85) + -1)|0;
  $2 = $86;
  $87 = $1;
  $88 = (($87) + 8|0);
  $89 = HEAP32[$88>>2]|0;
  $1 = $89;
  $90 = $0;
  $91 = (($90) + 1724|0);
  $92 = HEAP32[$91>>2]|0;
  $93 = ($92|0)!=(15|0);
  if ($93) {
   $94 = $0;
   $95 = (($94) + 1724|0);
   $96 = HEAP32[$95>>2]|0;
   $97 = $1;
   $98 = (($97) + 4|0);
   $99 = HEAP32[$98>>2]|0;
   $100 = (($99) + 16|0);
   $101 = HEAP32[$100>>2]|0;
   $102 = (($101) + 12|0);
   $103 = HEAP32[$102>>2]|0;
   $104 = $0;
   $105 = (($104) + 1896|0);
   $106 = HEAP32[$105>>2]|0;
   FUNCTION_TABLE_vii[$96 & 63]($103,$106);
  } else {
   $107 = $0;
   $108 = (($107) + 96|0);
   $109 = HEAP32[$108>>2]|0;
   $110 = $1;
   $111 = (($110) + 4|0);
   $112 = HEAP32[$111>>2]|0;
   $113 = (($112) + 16|0);
   $114 = HEAP32[$113>>2]|0;
   $115 = (($114) + 12|0);
   $116 = HEAP32[$115>>2]|0;
   FUNCTION_TABLE_vi[$109 & 63]($116);
  }
 }
 $117 = $2;
 $118 = ($117|0)==(0);
 if (!($118)) {
  ___assert_fail((1160|0),(1112|0),342,(1200|0));
  // unreachable;
 }
 $119 = $0;
 $120 = (($119) + 1728|0);
 $121 = HEAP32[$120>>2]|0;
 $122 = ($121|0)!=(16|0);
 if ($122) {
  $123 = $0;
  $124 = (($123) + 1728|0);
  $125 = HEAP32[$124>>2]|0;
  $126 = $0;
  $127 = (($126) + 1896|0);
  $128 = HEAP32[$127>>2]|0;
  FUNCTION_TABLE_vi[$125 & 63]($128);
  STACKTOP = sp;return;
 } else {
  $129 = $0;
  $130 = (($129) + 100|0);
  $131 = HEAP32[$130>>2]|0;
  FUNCTION_TABLE_v[$131 & 31]();
  STACKTOP = sp;return;
 }
}
function ___gl_computeInterior($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0.0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0.0, $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $7 = 0, $8 = 0, $9 = 0, $v = 0, $vNext = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $tess;
 $2 = $1;
 $3 = (($2) + 60|0);
 HEAP8[$3>>0] = 0;
 $4 = $1;
 _RemoveDegenerateEdges($4);
 $5 = $1;
 $6 = (_InitPriorityQ($5)|0);
 $7 = ($6|0)!=(0);
 if (!($7)) {
  $0 = 0;
  $68 = $0;
  STACKTOP = sp;return ($68|0);
 }
 $8 = $1;
 _InitEdgeDict($8);
 while(1) {
  $9 = $1;
  $10 = (($9) + 68|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = (___gl_pqSortExtractMin($11)|0);
  $v = $12;
  $13 = ($12|0)!=(0|0);
  if (!($13)) {
   break;
  }
  while(1) {
   $14 = $1;
   $15 = (($14) + 68|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = (___gl_pqSortMinimum($16)|0);
   $vNext = $17;
   $18 = $vNext;
   $19 = ($18|0)==(0|0);
   if ($19) {
    break;
   }
   $20 = $vNext;
   $21 = (($20) + 28|0);
   $22 = +HEAPF32[$21>>2];
   $23 = $v;
   $24 = (($23) + 28|0);
   $25 = +HEAPF32[$24>>2];
   $26 = $22 == $25;
   if (!($26)) {
    break;
   }
   $27 = $vNext;
   $28 = (($27) + 32|0);
   $29 = +HEAPF32[$28>>2];
   $30 = $v;
   $31 = (($30) + 32|0);
   $32 = +HEAPF32[$31>>2];
   $33 = $29 == $32;
   if (!($33)) {
    break;
   }
   $34 = $1;
   $35 = (($34) + 68|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = (___gl_pqSortExtractMin($36)|0);
   $vNext = $37;
   $38 = $1;
   $39 = $v;
   $40 = (($39) + 8|0);
   $41 = HEAP32[$40>>2]|0;
   $42 = $vNext;
   $43 = (($42) + 8|0);
   $44 = HEAP32[$43>>2]|0;
   _SpliceMergeVertices($38,$41,$44);
  }
  $45 = $1;
  $46 = $v;
  _SweepEvent($45,$46);
 }
 $47 = $1;
 $48 = (($47) + 64|0);
 $49 = HEAP32[$48>>2]|0;
 $50 = (($49) + 4|0);
 $51 = HEAP32[$50>>2]|0;
 $52 = HEAP32[$51>>2]|0;
 $53 = HEAP32[$52>>2]|0;
 $54 = (($53) + 16|0);
 $55 = HEAP32[$54>>2]|0;
 $56 = $1;
 $57 = (($56) + 72|0);
 HEAP32[$57>>2] = $55;
 $58 = $1;
 _DoneEdgeDict($58);
 $59 = $1;
 _DonePriorityQ($59);
 $60 = $1;
 $61 = (($60) + 8|0);
 $62 = HEAP32[$61>>2]|0;
 $63 = (_RemoveDegenerateFaces($62)|0);
 $64 = ($63|0)!=(0);
 if ($64) {
  $65 = $1;
  $66 = (($65) + 8|0);
  $67 = HEAP32[$66>>2]|0;
  ___gl_meshCheckMesh($67);
  $0 = 1;
  $68 = $0;
  STACKTOP = sp;return ($68|0);
 } else {
  $0 = 0;
  $68 = $0;
  STACKTOP = sp;return ($68|0);
 }
 return 0|0;
}
function _RemoveDegenerateEdges($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0.0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0.0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0.0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $e = 0;
 var $eHead = 0, $eLnext = 0, $eNext = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $0;
 $2 = (($1) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = (($3) + 64|0);
 $eHead = $4;
 $5 = $eHead;
 $6 = HEAP32[$5>>2]|0;
 $e = $6;
 while(1) {
  $7 = $e;
  $8 = $eHead;
  $9 = ($7|0)!=($8|0);
  if (!($9)) {
   label = 25;
   break;
  }
  $10 = $e;
  $11 = HEAP32[$10>>2]|0;
  $eNext = $11;
  $12 = $e;
  $13 = (($12) + 12|0);
  $14 = HEAP32[$13>>2]|0;
  $eLnext = $14;
  $15 = $e;
  $16 = (($15) + 16|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = (($17) + 28|0);
  $19 = +HEAPF32[$18>>2];
  $20 = $e;
  $21 = (($20) + 4|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($22) + 16|0);
  $24 = HEAP32[$23>>2]|0;
  $25 = (($24) + 28|0);
  $26 = +HEAPF32[$25>>2];
  $27 = $19 == $26;
  if ($27) {
   $28 = $e;
   $29 = (($28) + 16|0);
   $30 = HEAP32[$29>>2]|0;
   $31 = (($30) + 32|0);
   $32 = +HEAPF32[$31>>2];
   $33 = $e;
   $34 = (($33) + 4|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = (($35) + 16|0);
   $37 = HEAP32[$36>>2]|0;
   $38 = (($37) + 32|0);
   $39 = +HEAPF32[$38>>2];
   $40 = $32 == $39;
   if ($40) {
    $41 = $e;
    $42 = (($41) + 12|0);
    $43 = HEAP32[$42>>2]|0;
    $44 = (($43) + 12|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = $e;
    $47 = ($45|0)!=($46|0);
    if ($47) {
     $48 = $0;
     $49 = $eLnext;
     $50 = $e;
     _SpliceMergeVertices($48,$49,$50);
     $51 = $e;
     $52 = (___gl_meshDelete($51)|0);
     $53 = ($52|0)!=(0);
     if (!($53)) {
      label = 7;
      break;
     }
     $56 = $eLnext;
     $e = $56;
     $57 = $e;
     $58 = (($57) + 12|0);
     $59 = HEAP32[$58>>2]|0;
     $eLnext = $59;
    }
   }
  }
  $60 = $eLnext;
  $61 = (($60) + 12|0);
  $62 = HEAP32[$61>>2]|0;
  $63 = $e;
  $64 = ($62|0)==($63|0);
  if ($64) {
   $65 = $eLnext;
   $66 = $e;
   $67 = ($65|0)!=($66|0);
   if ($67) {
    $68 = $eLnext;
    $69 = $eNext;
    $70 = ($68|0)==($69|0);
    if ($70) {
     label = 13;
    } else {
     $71 = $eLnext;
     $72 = $eNext;
     $73 = (($72) + 4|0);
     $74 = HEAP32[$73>>2]|0;
     $75 = ($71|0)==($74|0);
     if ($75) {
      label = 13;
     }
    }
    if ((label|0) == 13) {
     label = 0;
     $76 = $eNext;
     $77 = HEAP32[$76>>2]|0;
     $eNext = $77;
    }
    $78 = $eLnext;
    $79 = (___gl_meshDelete($78)|0);
    $80 = ($79|0)!=(0);
    if (!($80)) {
     label = 15;
     break;
    }
   }
   $83 = $e;
   $84 = $eNext;
   $85 = ($83|0)==($84|0);
   if ($85) {
    label = 19;
   } else {
    $86 = $e;
    $87 = $eNext;
    $88 = (($87) + 4|0);
    $89 = HEAP32[$88>>2]|0;
    $90 = ($86|0)==($89|0);
    if ($90) {
     label = 19;
    }
   }
   if ((label|0) == 19) {
    label = 0;
    $91 = $eNext;
    $92 = HEAP32[$91>>2]|0;
    $eNext = $92;
   }
   $93 = $e;
   $94 = (___gl_meshDelete($93)|0);
   $95 = ($94|0)!=(0);
   if (!($95)) {
    label = 21;
    break;
   }
  }
  $98 = $eNext;
  $e = $98;
 }
 if ((label|0) == 7) {
  $54 = $0;
  $55 = (($54) + 1740|0);
  _longjmp(($55|0),1);
  // unreachable;
 }
 else if ((label|0) == 15) {
  $81 = $0;
  $82 = (($81) + 1740|0);
  _longjmp(($82|0),1);
  // unreachable;
 }
 else if ((label|0) == 21) {
  $96 = $0;
  $97 = (($96) + 1740|0);
  _longjmp(($97|0),1);
  // unreachable;
 }
 else if ((label|0) == 25) {
  STACKTOP = sp;return;
 }
}
function _InitPriorityQ($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $pq = 0, $v = 0;
 var $vHead = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $tess;
 $2 = (___gl_pqSortNewPriorityQ(17)|0);
 $3 = $1;
 $4 = (($3) + 68|0);
 HEAP32[$4>>2] = $2;
 $pq = $2;
 $5 = $pq;
 $6 = ($5|0)==(0|0);
 if ($6) {
  $0 = 0;
  $37 = $0;
  STACKTOP = sp;return ($37|0);
 }
 $7 = $1;
 $8 = (($7) + 8|0);
 $9 = HEAP32[$8>>2]|0;
 $vHead = $9;
 $10 = $vHead;
 $11 = HEAP32[$10>>2]|0;
 $v = $11;
 while(1) {
  $12 = $v;
  $13 = $vHead;
  $14 = ($12|0)!=($13|0);
  if (!($14)) {
   break;
  }
  $15 = $pq;
  $16 = $v;
  $17 = (___gl_pqSortInsert($15,$16)|0);
  $18 = $v;
  $19 = (($18) + 36|0);
  HEAP32[$19>>2] = $17;
  $20 = $v;
  $21 = (($20) + 36|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = ($22|0)==(2147483647);
  if ($23) {
   label = 6;
   break;
  }
  $24 = $v;
  $25 = HEAP32[$24>>2]|0;
  $v = $25;
 }
 if ((label|0) == 6) {
 }
 $26 = $v;
 $27 = $vHead;
 $28 = ($26|0)!=($27|0);
 if (!($28)) {
  $29 = $pq;
  $30 = (___gl_pqSortInit($29)|0);
  $31 = ($30|0)!=(0);
  if ($31) {
   $0 = 1;
   $37 = $0;
   STACKTOP = sp;return ($37|0);
  }
 }
 $32 = $1;
 $33 = (($32) + 68|0);
 $34 = HEAP32[$33>>2]|0;
 ___gl_pqSortDeletePriorityQ($34);
 $35 = $1;
 $36 = (($35) + 68|0);
 HEAP32[$36>>2] = 0;
 $0 = 0;
 $37 = $0;
 STACKTOP = sp;return ($37|0);
}
function _InitEdgeDict($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $0;
 $2 = (___gl_dictListNewDict($1,18)|0);
 $3 = $0;
 $4 = (($3) + 64|0);
 HEAP32[$4>>2] = $2;
 $5 = $0;
 $6 = (($5) + 64|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($7|0)==(0|0);
 if ($8) {
  $9 = $0;
  $10 = (($9) + 1740|0);
  _longjmp(($10|0),1);
  // unreachable;
 } else {
  $11 = $0;
  _AddSentinel($11,-3.999999973526325E+37);
  $12 = $0;
  _AddSentinel($12,3.999999973526325E+37);
  STACKTOP = sp;return;
 }
}
function _SpliceMergeVertices($tess,$e1,$e2) {
 $tess = $tess|0;
 $e1 = $e1|0;
 $e2 = $e2|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $data = 0, $weights = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $data = sp + 8|0;
 $weights = sp + 24|0;
 $0 = $tess;
 $1 = $e1;
 $2 = $e2;
 ;HEAP32[$data+0>>2]=0|0;HEAP32[$data+4>>2]=0|0;HEAP32[$data+8>>2]=0|0;HEAP32[$data+12>>2]=0|0;
 ;HEAP32[$weights+0>>2]=HEAP32[2032+0>>2]|0;HEAP32[$weights+4>>2]=HEAP32[2032+4>>2]|0;HEAP32[$weights+8>>2]=HEAP32[2032+8>>2]|0;HEAP32[$weights+12>>2]=HEAP32[2032+12>>2]|0;
 $3 = $1;
 $4 = (($3) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (($5) + 12|0);
 $7 = HEAP32[$6>>2]|0;
 HEAP32[$data>>2] = $7;
 $8 = $2;
 $9 = (($8) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = (($10) + 12|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = (($data) + 4|0);
 HEAP32[$13>>2] = $12;
 $14 = $0;
 $15 = $1;
 $16 = (($15) + 16|0);
 $17 = HEAP32[$16>>2]|0;
 _CallCombine($14,$17,$data,$weights,0);
 $18 = $1;
 $19 = $2;
 $20 = (___gl_meshSplice($18,$19)|0);
 $21 = ($20|0)!=(0);
 if ($21) {
  STACKTOP = sp;return;
 } else {
  $22 = $0;
  $23 = (($22) + 1740|0);
  _longjmp(($23|0),1);
  // unreachable;
 }
}
function _SweepEvent($tess,$vEvent) {
 $tess = $tess|0;
 $vEvent = $vEvent|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $eBottomLeft = 0, $eTopLeft = 0, $reg = 0;
 var $regUp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $vEvent;
 $2 = $1;
 $3 = $0;
 $4 = (($3) + 72|0);
 HEAP32[$4>>2] = $2;
 $5 = $1;
 $6 = (($5) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $e = $7;
 while(1) {
  $8 = $e;
  $9 = (($8) + 24|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($10|0)==(0|0);
  if (!($11)) {
   break;
  }
  $12 = $e;
  $13 = (($12) + 8|0);
  $14 = HEAP32[$13>>2]|0;
  $e = $14;
  $15 = $e;
  $16 = $1;
  $17 = (($16) + 8|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = ($15|0)==($18|0);
  if ($19) {
   label = 4;
   break;
  }
 }
 if ((label|0) == 4) {
  $20 = $0;
  $21 = $1;
  _ConnectLeftVertex($20,$21);
  STACKTOP = sp;return;
 }
 $22 = $e;
 $23 = (($22) + 24|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = (_TopLeftRegion($24)|0);
 $regUp = $25;
 $26 = $regUp;
 $27 = ($26|0)==(0|0);
 if ($27) {
  $28 = $0;
  $29 = (($28) + 1740|0);
  _longjmp(($29|0),1);
  // unreachable;
 }
 $30 = $regUp;
 $31 = (($30) + 4|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = (($32) + 8|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = HEAP32[$34>>2]|0;
 $reg = $35;
 $36 = $reg;
 $37 = HEAP32[$36>>2]|0;
 $eTopLeft = $37;
 $38 = $0;
 $39 = $reg;
 $40 = (_FinishLeftRegions($38,$39,0)|0);
 $eBottomLeft = $40;
 $41 = $eBottomLeft;
 $42 = (($41) + 8|0);
 $43 = HEAP32[$42>>2]|0;
 $44 = $eTopLeft;
 $45 = ($43|0)==($44|0);
 if ($45) {
  $46 = $0;
  $47 = $regUp;
  $48 = $eBottomLeft;
  _ConnectRightVertex($46,$47,$48);
  STACKTOP = sp;return;
 } else {
  $49 = $0;
  $50 = $regUp;
  $51 = $eBottomLeft;
  $52 = (($51) + 8|0);
  $53 = HEAP32[$52>>2]|0;
  $54 = $eTopLeft;
  $55 = $eTopLeft;
  _AddRightEdges($49,$50,$53,$54,$55,1);
  STACKTOP = sp;return;
 }
}
function _DoneEdgeDict($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $fixedEdges = 0, $reg = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $fixedEdges = 0;
 while(1) {
  $1 = $0;
  $2 = (($1) + 64|0);
  $3 = HEAP32[$2>>2]|0;
  $4 = (($3) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = HEAP32[$5>>2]|0;
  $reg = $6;
  $7 = ($6|0)!=(0|0);
  if (!($7)) {
   label = 12;
   break;
  }
  $8 = $reg;
  $9 = (($8) + 13|0);
  $10 = HEAP8[$9>>0]|0;
  $11 = ($10<<24>>24)!=(0);
  if (!($11)) {
   $12 = $reg;
   $13 = (($12) + 15|0);
   $14 = HEAP8[$13>>0]|0;
   $15 = $14&255;
   $16 = ($15|0)!=(0);
   if (!($16)) {
    label = 5;
    break;
   }
   $17 = $fixedEdges;
   $18 = (($17) + 1)|0;
   $fixedEdges = $18;
   $19 = ($18|0)==(1);
   if (!($19)) {
    label = 7;
    break;
   }
  }
  $20 = $reg;
  $21 = (($20) + 8|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = ($22|0)==(0);
  if (!($23)) {
   label = 10;
   break;
  }
  $24 = $0;
  $25 = $reg;
  _DeleteRegion($24,$25);
 }
 if ((label|0) == 5) {
  ___assert_fail((1288|0),(1256|0),1483,(1312|0));
  // unreachable;
 }
 else if ((label|0) == 7) {
  ___assert_fail((1328|0),(1256|0),1484,(1312|0));
  // unreachable;
 }
 else if ((label|0) == 10) {
  ___assert_fail((1344|0),(1256|0),1486,(1312|0));
  // unreachable;
 }
 else if ((label|0) == 12) {
  $26 = $0;
  $27 = (($26) + 64|0);
  $28 = HEAP32[$27>>2]|0;
  ___gl_dictListDeleteDict($28);
  STACKTOP = sp;return;
 }
}
function _DonePriorityQ($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $0;
 $2 = (($1) + 68|0);
 $3 = HEAP32[$2>>2]|0;
 ___gl_pqSortDeletePriorityQ($3);
 STACKTOP = sp;return;
}
function _RemoveDegenerateFaces($mesh) {
 $mesh = $mesh|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $f = 0, $fNext = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $mesh;
 $2 = $1;
 $3 = (($2) + 40|0);
 $4 = HEAP32[$3>>2]|0;
 $f = $4;
 while(1) {
  $5 = $f;
  $6 = $1;
  $7 = (($6) + 40|0);
  $8 = ($5|0)!=($7|0);
  if (!($8)) {
   label = 11;
   break;
  }
  $9 = $f;
  $10 = HEAP32[$9>>2]|0;
  $fNext = $10;
  $11 = $f;
  $12 = (($11) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $e = $13;
  $14 = $e;
  $15 = (($14) + 12|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = $e;
  $18 = ($16|0)!=($17|0);
  if (!($18)) {
   label = 4;
   break;
  }
  $19 = $e;
  $20 = (($19) + 12|0);
  $21 = HEAP32[$20>>2]|0;
  $22 = (($21) + 12|0);
  $23 = HEAP32[$22>>2]|0;
  $24 = $e;
  $25 = ($23|0)==($24|0);
  if ($25) {
   $26 = $e;
   $27 = (($26) + 28|0);
   $28 = HEAP32[$27>>2]|0;
   $29 = $e;
   $30 = (($29) + 8|0);
   $31 = HEAP32[$30>>2]|0;
   $32 = (($31) + 28|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = (($33) + ($28))|0;
   HEAP32[$32>>2] = $34;
   $35 = $e;
   $36 = (($35) + 4|0);
   $37 = HEAP32[$36>>2]|0;
   $38 = (($37) + 28|0);
   $39 = HEAP32[$38>>2]|0;
   $40 = $e;
   $41 = (($40) + 8|0);
   $42 = HEAP32[$41>>2]|0;
   $43 = (($42) + 4|0);
   $44 = HEAP32[$43>>2]|0;
   $45 = (($44) + 28|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = (($46) + ($39))|0;
   HEAP32[$45>>2] = $47;
   $48 = $e;
   $49 = (___gl_meshDelete($48)|0);
   $50 = ($49|0)!=(0);
   if (!($50)) {
    label = 7;
    break;
   }
  }
  $51 = $fNext;
  $f = $51;
 }
 if ((label|0) == 4) {
  ___assert_fail((1240|0),(1256|0),1613,(1264|0));
  // unreachable;
 }
 else if ((label|0) == 7) {
  $0 = 0;
  $52 = $0;
  STACKTOP = sp;return ($52|0);
 }
 else if ((label|0) == 11) {
  $0 = 1;
  $52 = $0;
  STACKTOP = sp;return ($52|0);
 }
 return 0|0;
}
function _DeleteRegion($tess,$reg) {
 $tess = $tess|0;
 $reg = $reg|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $reg;
 $2 = $1;
 $3 = (($2) + 15|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = ($4<<24>>24)!=(0);
 do {
  if ($5) {
   $6 = $1;
   $7 = HEAP32[$6>>2]|0;
   $8 = (($7) + 28|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = ($9|0)==(0);
   if ($10) {
    break;
   } else {
    ___assert_fail((1368|0),(1256|0),160,(1392|0));
    // unreachable;
   }
  }
 } while(0);
 $11 = $1;
 $12 = HEAP32[$11>>2]|0;
 $13 = (($12) + 24|0);
 HEAP32[$13>>2] = 0;
 $14 = $0;
 $15 = (($14) + 64|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = $1;
 $18 = (($17) + 4|0);
 $19 = HEAP32[$18>>2]|0;
 ___gl_dictListDelete($16,$19);
 $20 = $1;
 _free($20);
 STACKTOP = sp;return;
}
function _ConnectLeftVertex($tess,$vEvent) {
 $tess = $tess|0;
 $vEvent = $vEvent|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0.0, $32 = 0;
 var $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0.0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0;
 var $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0.0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0.0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0;
 var $7 = 0, $70 = 0, $71 = 0, $72 = 0.0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0.0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0;
 var $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $eLo = 0, $eNew = 0, $eUp = 0, $reg = 0, $regLo = 0, $regUp = 0, $tempHalfEdge = 0;
 var $tmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $tmp = sp;
 $0 = $tess;
 $1 = $vEvent;
 $2 = $1;
 $3 = (($2) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 HEAP32[$tmp>>2] = $6;
 $7 = $0;
 $8 = (($7) + 64|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = (___gl_dictListSearch($9,$tmp)|0);
 $11 = HEAP32[$10>>2]|0;
 $regUp = $11;
 $12 = $regUp;
 $13 = (($12) + 4|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = (($14) + 8|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = HEAP32[$16>>2]|0;
 $regLo = $17;
 $18 = $regUp;
 $19 = HEAP32[$18>>2]|0;
 $eUp = $19;
 $20 = $regLo;
 $21 = HEAP32[$20>>2]|0;
 $eLo = $21;
 $22 = $eUp;
 $23 = (($22) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = (($24) + 16|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = $1;
 $28 = $eUp;
 $29 = (($28) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = (+___gl_edgeSign($26,$27,$30));
 $32 = $31 == 0.0;
 if ($32) {
  $33 = $0;
  $34 = $regUp;
  $35 = $1;
  _ConnectLeftDegenerate($33,$34,$35);
  STACKTOP = sp;return;
 }
 $36 = $eLo;
 $37 = (($36) + 4|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = (($38) + 16|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = (($40) + 28|0);
 $42 = +HEAPF32[$41>>2];
 $43 = $eUp;
 $44 = (($43) + 4|0);
 $45 = HEAP32[$44>>2]|0;
 $46 = (($45) + 16|0);
 $47 = HEAP32[$46>>2]|0;
 $48 = (($47) + 28|0);
 $49 = +HEAPF32[$48>>2];
 $50 = $42 < $49;
 do {
  if ($50) {
   label = 6;
  } else {
   $51 = $eLo;
   $52 = (($51) + 4|0);
   $53 = HEAP32[$52>>2]|0;
   $54 = (($53) + 16|0);
   $55 = HEAP32[$54>>2]|0;
   $56 = (($55) + 28|0);
   $57 = +HEAPF32[$56>>2];
   $58 = $eUp;
   $59 = (($58) + 4|0);
   $60 = HEAP32[$59>>2]|0;
   $61 = (($60) + 16|0);
   $62 = HEAP32[$61>>2]|0;
   $63 = (($62) + 28|0);
   $64 = +HEAPF32[$63>>2];
   $65 = $57 == $64;
   if ($65) {
    $66 = $eLo;
    $67 = (($66) + 4|0);
    $68 = HEAP32[$67>>2]|0;
    $69 = (($68) + 16|0);
    $70 = HEAP32[$69>>2]|0;
    $71 = (($70) + 32|0);
    $72 = +HEAPF32[$71>>2];
    $73 = $eUp;
    $74 = (($73) + 4|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = (($75) + 16|0);
    $77 = HEAP32[$76>>2]|0;
    $78 = (($77) + 32|0);
    $79 = +HEAPF32[$78>>2];
    $80 = $72 <= $79;
    if ($80) {
     label = 6;
     break;
    }
   }
   $82 = $regLo;
   $83 = $82;
  }
 } while(0);
 if ((label|0) == 6) {
  $81 = $regUp;
  $83 = $81;
 }
 $reg = $83;
 $84 = $regUp;
 $85 = (($84) + 12|0);
 $86 = HEAP8[$85>>0]|0;
 $87 = $86&255;
 $88 = ($87|0)!=(0);
 if (!($88)) {
  $89 = $reg;
  $90 = (($89) + 15|0);
  $91 = HEAP8[$90>>0]|0;
  $92 = $91&255;
  $93 = ($92|0)!=(0);
  if (!($93)) {
   $145 = $0;
   $146 = $regUp;
   $147 = $1;
   $148 = (($147) + 8|0);
   $149 = HEAP32[$148>>2]|0;
   $150 = $1;
   $151 = (($150) + 8|0);
   $152 = HEAP32[$151>>2]|0;
   _AddRightEdges($145,$146,$149,$152,0,1);
   STACKTOP = sp;return;
  }
 }
 $94 = $reg;
 $95 = $regUp;
 $96 = ($94|0)==($95|0);
 do {
  if ($96) {
   $97 = $1;
   $98 = (($97) + 8|0);
   $99 = HEAP32[$98>>2]|0;
   $100 = (($99) + 4|0);
   $101 = HEAP32[$100>>2]|0;
   $102 = $eUp;
   $103 = (($102) + 12|0);
   $104 = HEAP32[$103>>2]|0;
   $105 = (___gl_meshConnect($101,$104)|0);
   $eNew = $105;
   $106 = $eNew;
   $107 = ($106|0)==(0|0);
   if ($107) {
    $108 = $0;
    $109 = (($108) + 1740|0);
    _longjmp(($109|0),1);
    // unreachable;
   } else {
    break;
   }
  } else {
   $110 = $eLo;
   $111 = (($110) + 4|0);
   $112 = HEAP32[$111>>2]|0;
   $113 = (($112) + 8|0);
   $114 = HEAP32[$113>>2]|0;
   $115 = (($114) + 4|0);
   $116 = HEAP32[$115>>2]|0;
   $117 = $1;
   $118 = (($117) + 8|0);
   $119 = HEAP32[$118>>2]|0;
   $120 = (___gl_meshConnect($116,$119)|0);
   $tempHalfEdge = $120;
   $121 = $tempHalfEdge;
   $122 = ($121|0)==(0|0);
   if ($122) {
    $123 = $0;
    $124 = (($123) + 1740|0);
    _longjmp(($124|0),1);
    // unreachable;
   } else {
    $125 = $tempHalfEdge;
    $126 = (($125) + 4|0);
    $127 = HEAP32[$126>>2]|0;
    $eNew = $127;
    break;
   }
  }
 } while(0);
 $128 = $reg;
 $129 = (($128) + 15|0);
 $130 = HEAP8[$129>>0]|0;
 $131 = ($130<<24>>24)!=(0);
 do {
  if ($131) {
   $132 = $reg;
   $133 = $eNew;
   $134 = (_FixUpperEdge($132,$133)|0);
   $135 = ($134|0)!=(0);
   if ($135) {
    break;
   } else {
    $136 = $0;
    $137 = (($136) + 1740|0);
    _longjmp(($137|0),1);
    // unreachable;
   }
  } else {
   $138 = $0;
   $139 = $0;
   $140 = $regUp;
   $141 = $eNew;
   $142 = (_AddRegionBelow($139,$140,$141)|0);
   _ComputeWinding($138,$142);
  }
 } while(0);
 $143 = $0;
 $144 = $1;
 _SweepEvent($143,$144);
 STACKTOP = sp;return;
}
function _TopLeftRegion($reg) {
 $reg = $reg|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $org = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $reg;
 $2 = $1;
 $3 = HEAP32[$2>>2]|0;
 $4 = (($3) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $org = $5;
 while(1) {
  $6 = $1;
  $7 = (($6) + 4|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = (($8) + 4|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = HEAP32[$10>>2]|0;
  $1 = $11;
  $12 = $1;
  $13 = HEAP32[$12>>2]|0;
  $14 = (($13) + 16|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = $org;
  $17 = ($15|0)==($16|0);
  if (!($17)) {
   break;
  }
 }
 $18 = $1;
 $19 = (($18) + 15|0);
 $20 = HEAP8[$19>>0]|0;
 $21 = ($20<<24>>24)!=(0);
 do {
  if ($21) {
   $22 = $1;
   $23 = (($22) + 4|0);
   $24 = HEAP32[$23>>2]|0;
   $25 = (($24) + 8|0);
   $26 = HEAP32[$25>>2]|0;
   $27 = HEAP32[$26>>2]|0;
   $28 = HEAP32[$27>>2]|0;
   $29 = (($28) + 4|0);
   $30 = HEAP32[$29>>2]|0;
   $31 = $1;
   $32 = HEAP32[$31>>2]|0;
   $33 = (($32) + 12|0);
   $34 = HEAP32[$33>>2]|0;
   $35 = (___gl_meshConnect($30,$34)|0);
   $e = $35;
   $36 = $e;
   $37 = ($36|0)==(0|0);
   if ($37) {
    $0 = 0;
    $49 = $0;
    STACKTOP = sp;return ($49|0);
   }
   $38 = $1;
   $39 = $e;
   $40 = (_FixUpperEdge($38,$39)|0);
   $41 = ($40|0)!=(0);
   if ($41) {
    $42 = $1;
    $43 = (($42) + 4|0);
    $44 = HEAP32[$43>>2]|0;
    $45 = (($44) + 4|0);
    $46 = HEAP32[$45>>2]|0;
    $47 = HEAP32[$46>>2]|0;
    $1 = $47;
    break;
   }
   $0 = 0;
   $49 = $0;
   STACKTOP = sp;return ($49|0);
  }
 } while(0);
 $48 = $1;
 $0 = $48;
 $49 = $0;
 STACKTOP = sp;return ($49|0);
}
function _FinishLeftRegions($tess,$regFirst,$regLast) {
 $tess = $tess|0;
 $regFirst = $regFirst|0;
 $regLast = $regLast|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $8 = 0, $9 = 0, $e = 0, $ePrev = 0;
 var $reg = 0, $regPrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $regFirst;
 $2 = $regLast;
 $3 = $1;
 $regPrev = $3;
 $4 = $1;
 $5 = HEAP32[$4>>2]|0;
 $ePrev = $5;
 while(1) {
  $6 = $regPrev;
  $7 = $2;
  $8 = ($6|0)!=($7|0);
  if (!($8)) {
   label = 18;
   break;
  }
  $9 = $regPrev;
  $10 = (($9) + 15|0);
  HEAP8[$10>>0] = 0;
  $11 = $regPrev;
  $12 = (($11) + 4|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = (($13) + 8|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = HEAP32[$15>>2]|0;
  $reg = $16;
  $17 = $reg;
  $18 = HEAP32[$17>>2]|0;
  $e = $18;
  $19 = $e;
  $20 = (($19) + 16|0);
  $21 = HEAP32[$20>>2]|0;
  $22 = $ePrev;
  $23 = (($22) + 16|0);
  $24 = HEAP32[$23>>2]|0;
  $25 = ($21|0)!=($24|0);
  if ($25) {
   $26 = $reg;
   $27 = (($26) + 15|0);
   $28 = HEAP8[$27>>0]|0;
   $29 = ($28<<24>>24)!=(0);
   if (!($29)) {
    label = 5;
    break;
   }
   $32 = $ePrev;
   $33 = (($32) + 8|0);
   $34 = HEAP32[$33>>2]|0;
   $35 = (($34) + 4|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = $e;
   $38 = (($37) + 4|0);
   $39 = HEAP32[$38>>2]|0;
   $40 = (___gl_meshConnect($36,$39)|0);
   $e = $40;
   $41 = $e;
   $42 = ($41|0)==(0|0);
   if ($42) {
    label = 7;
    break;
   }
   $45 = $reg;
   $46 = $e;
   $47 = (_FixUpperEdge($45,$46)|0);
   $48 = ($47|0)!=(0);
   if (!($48)) {
    label = 9;
    break;
   }
  }
  $51 = $ePrev;
  $52 = (($51) + 8|0);
  $53 = HEAP32[$52>>2]|0;
  $54 = $e;
  $55 = ($53|0)!=($54|0);
  if ($55) {
   $56 = $e;
   $57 = (($56) + 4|0);
   $58 = HEAP32[$57>>2]|0;
   $59 = (($58) + 12|0);
   $60 = HEAP32[$59>>2]|0;
   $61 = $e;
   $62 = (___gl_meshSplice($60,$61)|0);
   $63 = ($62|0)!=(0);
   if (!($63)) {
    label = 13;
    break;
   }
   $66 = $ePrev;
   $67 = $e;
   $68 = (___gl_meshSplice($66,$67)|0);
   $69 = ($68|0)!=(0);
   if (!($69)) {
    label = 15;
    break;
   }
  }
  $72 = $0;
  $73 = $regPrev;
  _FinishRegion($72,$73);
  $74 = $reg;
  $75 = HEAP32[$74>>2]|0;
  $ePrev = $75;
  $76 = $reg;
  $regPrev = $76;
 }
 if ((label|0) == 5) {
  $30 = $0;
  $31 = $regPrev;
  _FinishRegion($30,$31);
  $77 = $ePrev;
  STACKTOP = sp;return ($77|0);
 }
 else if ((label|0) == 7) {
  $43 = $0;
  $44 = (($43) + 1740|0);
  _longjmp(($44|0),1);
  // unreachable;
 }
 else if ((label|0) == 9) {
  $49 = $0;
  $50 = (($49) + 1740|0);
  _longjmp(($50|0),1);
  // unreachable;
 }
 else if ((label|0) == 13) {
  $64 = $0;
  $65 = (($64) + 1740|0);
  _longjmp(($65|0),1);
  // unreachable;
 }
 else if ((label|0) == 15) {
  $70 = $0;
  $71 = (($70) + 1740|0);
  _longjmp(($71|0),1);
  // unreachable;
 }
 else if ((label|0) == 18) {
  $77 = $ePrev;
  STACKTOP = sp;return ($77|0);
 }
 return 0|0;
}
function _ConnectRightVertex($tess,$regUp,$eBottomLeft) {
 $tess = $tess|0;
 $regUp = $regUp|0;
 $eBottomLeft = $eBottomLeft|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0.0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0.0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0.0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0.0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0.0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0.0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0.0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0;
 var $33 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0.0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0;
 var $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0;
 var $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0.0, $87 = 0;
 var $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0.0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0.0, $98 = 0, $99 = 0, $degenerate = 0, $eLo = 0, $eNew = 0, $eTopLeft = 0, $eUp = 0, $regLo = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $regUp;
 $2 = $eBottomLeft;
 $3 = $2;
 $4 = (($3) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $eTopLeft = $5;
 $6 = $1;
 $7 = (($6) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) + 8|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = HEAP32[$10>>2]|0;
 $regLo = $11;
 $12 = $1;
 $13 = HEAP32[$12>>2]|0;
 $eUp = $13;
 $14 = $regLo;
 $15 = HEAP32[$14>>2]|0;
 $eLo = $15;
 $degenerate = 0;
 $16 = $eUp;
 $17 = (($16) + 4|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = (($18) + 16|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = $eLo;
 $22 = (($21) + 4|0);
 $23 = HEAP32[$22>>2]|0;
 $24 = (($23) + 16|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = ($20|0)!=($25|0);
 if ($26) {
  $27 = $0;
  $28 = $1;
  (_CheckForIntersect($27,$28)|0);
 }
 $29 = $eUp;
 $30 = (($29) + 16|0);
 $31 = HEAP32[$30>>2]|0;
 $32 = (($31) + 28|0);
 $33 = +HEAPF32[$32>>2];
 $34 = $0;
 $35 = (($34) + 72|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = (($36) + 28|0);
 $38 = +HEAPF32[$37>>2];
 $39 = $33 == $38;
 do {
  if ($39) {
   $40 = $eUp;
   $41 = (($40) + 16|0);
   $42 = HEAP32[$41>>2]|0;
   $43 = (($42) + 32|0);
   $44 = +HEAPF32[$43>>2];
   $45 = $0;
   $46 = (($45) + 72|0);
   $47 = HEAP32[$46>>2]|0;
   $48 = (($47) + 32|0);
   $49 = +HEAPF32[$48>>2];
   $50 = $44 == $49;
   if ($50) {
    $51 = $eTopLeft;
    $52 = (($51) + 4|0);
    $53 = HEAP32[$52>>2]|0;
    $54 = (($53) + 12|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = $eUp;
    $57 = (___gl_meshSplice($55,$56)|0);
    $58 = ($57|0)!=(0);
    if (!($58)) {
     $59 = $0;
     $60 = (($59) + 1740|0);
     _longjmp(($60|0),1);
     // unreachable;
    }
    $61 = $1;
    $62 = (_TopLeftRegion($61)|0);
    $1 = $62;
    $63 = $1;
    $64 = ($63|0)==(0|0);
    if ($64) {
     $65 = $0;
     $66 = (($65) + 1740|0);
     _longjmp(($66|0),1);
     // unreachable;
    } else {
     $67 = $1;
     $68 = (($67) + 4|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = (($69) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = HEAP32[$71>>2]|0;
     $73 = HEAP32[$72>>2]|0;
     $eTopLeft = $73;
     $74 = $0;
     $75 = $1;
     $76 = (($75) + 4|0);
     $77 = HEAP32[$76>>2]|0;
     $78 = (($77) + 8|0);
     $79 = HEAP32[$78>>2]|0;
     $80 = HEAP32[$79>>2]|0;
     $81 = $regLo;
     (_FinishLeftRegions($74,$80,$81)|0);
     $degenerate = 1;
     break;
    }
   }
  }
 } while(0);
 $82 = $eLo;
 $83 = (($82) + 16|0);
 $84 = HEAP32[$83>>2]|0;
 $85 = (($84) + 28|0);
 $86 = +HEAPF32[$85>>2];
 $87 = $0;
 $88 = (($87) + 72|0);
 $89 = HEAP32[$88>>2]|0;
 $90 = (($89) + 28|0);
 $91 = +HEAPF32[$90>>2];
 $92 = $86 == $91;
 do {
  if ($92) {
   $93 = $eLo;
   $94 = (($93) + 16|0);
   $95 = HEAP32[$94>>2]|0;
   $96 = (($95) + 32|0);
   $97 = +HEAPF32[$96>>2];
   $98 = $0;
   $99 = (($98) + 72|0);
   $100 = HEAP32[$99>>2]|0;
   $101 = (($100) + 32|0);
   $102 = +HEAPF32[$101>>2];
   $103 = $97 == $102;
   if ($103) {
    $104 = $2;
    $105 = $eLo;
    $106 = (($105) + 4|0);
    $107 = HEAP32[$106>>2]|0;
    $108 = (($107) + 12|0);
    $109 = HEAP32[$108>>2]|0;
    $110 = (___gl_meshSplice($104,$109)|0);
    $111 = ($110|0)!=(0);
    if ($111) {
     $114 = $0;
     $115 = $regLo;
     $116 = (_FinishLeftRegions($114,$115,0)|0);
     $2 = $116;
     $degenerate = 1;
     break;
    } else {
     $112 = $0;
     $113 = (($112) + 1740|0);
     _longjmp(($113|0),1);
     // unreachable;
    }
   }
  }
 } while(0);
 $117 = $degenerate;
 $118 = ($117|0)!=(0);
 if ($118) {
  $119 = $0;
  $120 = $1;
  $121 = $2;
  $122 = (($121) + 8|0);
  $123 = HEAP32[$122>>2]|0;
  $124 = $eTopLeft;
  $125 = $eTopLeft;
  _AddRightEdges($119,$120,$123,$124,$125,1);
  STACKTOP = sp;return;
 }
 $126 = $eLo;
 $127 = (($126) + 16|0);
 $128 = HEAP32[$127>>2]|0;
 $129 = (($128) + 28|0);
 $130 = +HEAPF32[$129>>2];
 $131 = $eUp;
 $132 = (($131) + 16|0);
 $133 = HEAP32[$132>>2]|0;
 $134 = (($133) + 28|0);
 $135 = +HEAPF32[$134>>2];
 $136 = $130 < $135;
 do {
  if ($136) {
   label = 20;
  } else {
   $137 = $eLo;
   $138 = (($137) + 16|0);
   $139 = HEAP32[$138>>2]|0;
   $140 = (($139) + 28|0);
   $141 = +HEAPF32[$140>>2];
   $142 = $eUp;
   $143 = (($142) + 16|0);
   $144 = HEAP32[$143>>2]|0;
   $145 = (($144) + 28|0);
   $146 = +HEAPF32[$145>>2];
   $147 = $141 == $146;
   if ($147) {
    $148 = $eLo;
    $149 = (($148) + 16|0);
    $150 = HEAP32[$149>>2]|0;
    $151 = (($150) + 32|0);
    $152 = +HEAPF32[$151>>2];
    $153 = $eUp;
    $154 = (($153) + 16|0);
    $155 = HEAP32[$154>>2]|0;
    $156 = (($155) + 32|0);
    $157 = +HEAPF32[$156>>2];
    $158 = $152 <= $157;
    if ($158) {
     label = 20;
     break;
    }
   }
   $164 = $eUp;
   $eNew = $164;
  }
 } while(0);
 if ((label|0) == 20) {
  $159 = $eLo;
  $160 = (($159) + 4|0);
  $161 = HEAP32[$160>>2]|0;
  $162 = (($161) + 12|0);
  $163 = HEAP32[$162>>2]|0;
  $eNew = $163;
 }
 $165 = $2;
 $166 = (($165) + 8|0);
 $167 = HEAP32[$166>>2]|0;
 $168 = (($167) + 4|0);
 $169 = HEAP32[$168>>2]|0;
 $170 = $eNew;
 $171 = (___gl_meshConnect($169,$170)|0);
 $eNew = $171;
 $172 = $eNew;
 $173 = ($172|0)==(0|0);
 if ($173) {
  $174 = $0;
  $175 = (($174) + 1740|0);
  _longjmp(($175|0),1);
  // unreachable;
 }
 $176 = $0;
 $177 = $1;
 $178 = $eNew;
 $179 = $eNew;
 $180 = (($179) + 8|0);
 $181 = HEAP32[$180>>2]|0;
 $182 = $eNew;
 $183 = (($182) + 8|0);
 $184 = HEAP32[$183>>2]|0;
 _AddRightEdges($176,$177,$178,$181,$184,0);
 $185 = $eNew;
 $186 = (($185) + 4|0);
 $187 = HEAP32[$186>>2]|0;
 $188 = (($187) + 24|0);
 $189 = HEAP32[$188>>2]|0;
 $190 = (($189) + 15|0);
 HEAP8[$190>>0] = 1;
 $191 = $0;
 $192 = $1;
 _WalkDirtyRegions($191,$192);
 STACKTOP = sp;return;
}
function _AddRightEdges($tess,$regUp,$eFirst,$eLast,$eTopLeft,$cleanUp) {
 $tess = $tess|0;
 $regUp = $regUp|0;
 $eFirst = $eFirst|0;
 $eLast = $eLast|0;
 $eTopLeft = $eTopLeft|0;
 $cleanUp = $cleanUp|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0.0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0.0, $180 = 0, $181 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0.0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0.0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $e = 0, $ePrev = 0, $firstTime = 0, $reg = 0, $regPrev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $regUp;
 $2 = $eFirst;
 $3 = $eLast;
 $4 = $eTopLeft;
 $5 = $cleanUp;
 $firstTime = 1;
 $6 = $2;
 $e = $6;
 while(1) {
  $7 = $e;
  $8 = (($7) + 16|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = (($9) + 28|0);
  $11 = +HEAPF32[$10>>2];
  $12 = $e;
  $13 = (($12) + 4|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = (($14) + 16|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = (($16) + 28|0);
  $18 = +HEAPF32[$17>>2];
  $19 = $11 < $18;
  if (!($19)) {
   $20 = $e;
   $21 = (($20) + 16|0);
   $22 = HEAP32[$21>>2]|0;
   $23 = (($22) + 28|0);
   $24 = +HEAPF32[$23>>2];
   $25 = $e;
   $26 = (($25) + 4|0);
   $27 = HEAP32[$26>>2]|0;
   $28 = (($27) + 16|0);
   $29 = HEAP32[$28>>2]|0;
   $30 = (($29) + 28|0);
   $31 = +HEAPF32[$30>>2];
   $32 = $24 == $31;
   if (!($32)) {
    label = 5;
    break;
   }
   $33 = $e;
   $34 = (($33) + 16|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = (($35) + 32|0);
   $37 = +HEAPF32[$36>>2];
   $38 = $e;
   $39 = (($38) + 4|0);
   $40 = HEAP32[$39>>2]|0;
   $41 = (($40) + 16|0);
   $42 = HEAP32[$41>>2]|0;
   $43 = (($42) + 32|0);
   $44 = +HEAPF32[$43>>2];
   $45 = $37 <= $44;
   if (!($45)) {
    label = 5;
    break;
   }
  }
  $46 = $0;
  $47 = $1;
  $48 = $e;
  $49 = (($48) + 4|0);
  $50 = HEAP32[$49>>2]|0;
  (_AddRegionBelow($46,$47,$50)|0);
  $51 = $e;
  $52 = (($51) + 8|0);
  $53 = HEAP32[$52>>2]|0;
  $e = $53;
  $54 = $e;
  $55 = $3;
  $56 = ($54|0)!=($55|0);
  if (!($56)) {
   label = 8;
   break;
  }
 }
 if ((label|0) == 5) {
  ___assert_fail((1408|0),(1256|0),405,(1432|0));
  // unreachable;
 }
 else if ((label|0) == 8) {
  $57 = $4;
  $58 = ($57|0)==(0|0);
  if ($58) {
   $59 = $1;
   $60 = (($59) + 4|0);
   $61 = HEAP32[$60>>2]|0;
   $62 = (($61) + 8|0);
   $63 = HEAP32[$62>>2]|0;
   $64 = HEAP32[$63>>2]|0;
   $65 = HEAP32[$64>>2]|0;
   $66 = (($65) + 4|0);
   $67 = HEAP32[$66>>2]|0;
   $68 = (($67) + 8|0);
   $69 = HEAP32[$68>>2]|0;
   $4 = $69;
  }
  $70 = $1;
  $regPrev = $70;
  $71 = $4;
  $ePrev = $71;
  while(1) {
   $72 = $regPrev;
   $73 = (($72) + 4|0);
   $74 = HEAP32[$73>>2]|0;
   $75 = (($74) + 8|0);
   $76 = HEAP32[$75>>2]|0;
   $77 = HEAP32[$76>>2]|0;
   $reg = $77;
   $78 = $reg;
   $79 = HEAP32[$78>>2]|0;
   $80 = (($79) + 4|0);
   $81 = HEAP32[$80>>2]|0;
   $e = $81;
   $82 = $e;
   $83 = (($82) + 16|0);
   $84 = HEAP32[$83>>2]|0;
   $85 = $ePrev;
   $86 = (($85) + 16|0);
   $87 = HEAP32[$86>>2]|0;
   $88 = ($84|0)!=($87|0);
   if ($88) {
    label = 12;
    break;
   }
   $89 = $e;
   $90 = (($89) + 8|0);
   $91 = HEAP32[$90>>2]|0;
   $92 = $ePrev;
   $93 = ($91|0)!=($92|0);
   if ($93) {
    $94 = $e;
    $95 = (($94) + 4|0);
    $96 = HEAP32[$95>>2]|0;
    $97 = (($96) + 12|0);
    $98 = HEAP32[$97>>2]|0;
    $99 = $e;
    $100 = (___gl_meshSplice($98,$99)|0);
    $101 = ($100|0)!=(0);
    if (!($101)) {
     label = 15;
     break;
    }
    $104 = $ePrev;
    $105 = (($104) + 4|0);
    $106 = HEAP32[$105>>2]|0;
    $107 = (($106) + 12|0);
    $108 = HEAP32[$107>>2]|0;
    $109 = $e;
    $110 = (___gl_meshSplice($108,$109)|0);
    $111 = ($110|0)!=(0);
    if (!($111)) {
     label = 17;
     break;
    }
   }
   $114 = $regPrev;
   $115 = (($114) + 8|0);
   $116 = HEAP32[$115>>2]|0;
   $117 = $e;
   $118 = (($117) + 28|0);
   $119 = HEAP32[$118>>2]|0;
   $120 = (($116) - ($119))|0;
   $121 = $reg;
   $122 = (($121) + 8|0);
   HEAP32[$122>>2] = $120;
   $123 = $0;
   $124 = $reg;
   $125 = (($124) + 8|0);
   $126 = HEAP32[$125>>2]|0;
   $127 = (_IsWindingInside($123,$126)|0);
   $128 = $reg;
   $129 = (($128) + 12|0);
   HEAP8[$129>>0] = $127;
   $130 = $regPrev;
   $131 = (($130) + 14|0);
   HEAP8[$131>>0] = 1;
   $132 = $firstTime;
   $133 = ($132|0)!=(0);
   if (!($133)) {
    $134 = $0;
    $135 = $regPrev;
    $136 = (_CheckForRightSplice($134,$135)|0);
    $137 = ($136|0)!=(0);
    if ($137) {
     $138 = $ePrev;
     $139 = (($138) + 28|0);
     $140 = HEAP32[$139>>2]|0;
     $141 = $e;
     $142 = (($141) + 28|0);
     $143 = HEAP32[$142>>2]|0;
     $144 = (($143) + ($140))|0;
     HEAP32[$142>>2] = $144;
     $145 = $ePrev;
     $146 = (($145) + 4|0);
     $147 = HEAP32[$146>>2]|0;
     $148 = (($147) + 28|0);
     $149 = HEAP32[$148>>2]|0;
     $150 = $e;
     $151 = (($150) + 4|0);
     $152 = HEAP32[$151>>2]|0;
     $153 = (($152) + 28|0);
     $154 = HEAP32[$153>>2]|0;
     $155 = (($154) + ($149))|0;
     HEAP32[$153>>2] = $155;
     $156 = $0;
     $157 = $regPrev;
     _DeleteRegion($156,$157);
     $158 = $ePrev;
     $159 = (___gl_meshDelete($158)|0);
     $160 = ($159|0)!=(0);
     if (!($160)) {
      label = 22;
      break;
     }
    }
   }
   $firstTime = 0;
   $163 = $reg;
   $regPrev = $163;
   $164 = $e;
   $ePrev = $164;
  }
  if ((label|0) == 12) {
   $165 = $regPrev;
   $166 = (($165) + 14|0);
   HEAP8[$166>>0] = 1;
   $167 = $regPrev;
   $168 = (($167) + 8|0);
   $169 = HEAP32[$168>>2]|0;
   $170 = $e;
   $171 = (($170) + 28|0);
   $172 = HEAP32[$171>>2]|0;
   $173 = (($169) - ($172))|0;
   $174 = $reg;
   $175 = (($174) + 8|0);
   $176 = HEAP32[$175>>2]|0;
   $177 = ($173|0)==($176|0);
   if (!($177)) {
    ___assert_fail((1448|0),(1256|0),465,(1432|0));
    // unreachable;
   }
   $178 = $5;
   $179 = ($178<<24>>24)!=(0);
   if (!($179)) {
    STACKTOP = sp;return;
   }
   $180 = $0;
   $181 = $regPrev;
   _WalkDirtyRegions($180,$181);
   STACKTOP = sp;return;
  }
  else if ((label|0) == 15) {
   $102 = $0;
   $103 = (($102) + 1740|0);
   _longjmp(($103|0),1);
   // unreachable;
  }
  else if ((label|0) == 17) {
   $112 = $0;
   $113 = (($112) + 1740|0);
   _longjmp(($113|0),1);
   // unreachable;
  }
  else if ((label|0) == 22) {
   $161 = $0;
   $162 = (($161) + 1740|0);
   _longjmp(($162|0),1);
   // unreachable;
  }
 }
}
function _AddRegionBelow($tess,$regAbove,$eNewUp) {
 $tess = $tess|0;
 $regAbove = $regAbove|0;
 $eNewUp = $eNewUp|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $regNew = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $regAbove;
 $2 = $eNewUp;
 $3 = (_malloc(16)|0);
 $regNew = $3;
 $4 = $regNew;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $6 = $0;
  $7 = (($6) + 1740|0);
  _longjmp(($7|0),1);
  // unreachable;
 }
 $8 = $2;
 $9 = $regNew;
 HEAP32[$9>>2] = $8;
 $10 = $0;
 $11 = (($10) + 64|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = $1;
 $14 = (($13) + 4|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = $regNew;
 $17 = (___gl_dictListInsertBefore($12,$15,$16)|0);
 $18 = $regNew;
 $19 = (($18) + 4|0);
 HEAP32[$19>>2] = $17;
 $20 = $regNew;
 $21 = (($20) + 4|0);
 $22 = HEAP32[$21>>2]|0;
 $23 = ($22|0)==(0|0);
 if ($23) {
  $24 = $0;
  $25 = (($24) + 1740|0);
  _longjmp(($25|0),1);
  // unreachable;
 } else {
  $26 = $regNew;
  $27 = (($26) + 15|0);
  HEAP8[$27>>0] = 0;
  $28 = $regNew;
  $29 = (($28) + 13|0);
  HEAP8[$29>>0] = 0;
  $30 = $regNew;
  $31 = (($30) + 14|0);
  HEAP8[$31>>0] = 0;
  $32 = $regNew;
  $33 = $2;
  $34 = (($33) + 24|0);
  HEAP32[$34>>2] = $32;
  $35 = $regNew;
  STACKTOP = sp;return ($35|0);
 }
 return 0|0;
}
function _IsWindingInside($tess,$n) {
 $tess = $tess|0;
 $n = $n|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $tess;
 $2 = $n;
 $3 = $1;
 $4 = (($3) + 56|0);
 $5 = HEAP32[$4>>2]|0;
 switch ($5|0) {
 case 100130:  {
  $6 = $2;
  $7 = $6 & 1;
  $8 = $7&255;
  $0 = $8;
  break;
 }
 case 100133:  {
  $17 = $2;
  $18 = ($17|0)<(0);
  $19 = $18&1;
  $20 = $19&255;
  $0 = $20;
  break;
 }
 case 100131:  {
  $9 = $2;
  $10 = ($9|0)!=(0);
  $11 = $10&1;
  $12 = $11&255;
  $0 = $12;
  break;
 }
 case 100134:  {
  $21 = $2;
  $22 = ($21|0)>=(2);
  if ($22) {
   $26 = 1;
  } else {
   $23 = $2;
   $24 = ($23|0)<=(-2);
   $26 = $24;
  }
  $25 = $26&1;
  $27 = $25&255;
  $0 = $27;
  break;
 }
 case 100132:  {
  $13 = $2;
  $14 = ($13|0)>(0);
  $15 = $14&1;
  $16 = $15&255;
  $0 = $16;
  break;
 }
 default: {
  ___assert_fail((1944|0),(1256|0),273,(1952|0));
  // unreachable;
 }
 }
 $28 = $0;
 STACKTOP = sp;return ($28|0);
}
function _CheckForRightSplice($tess,$regUp) {
 $tess = $tess|0;
 $regUp = $regUp|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0.0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $17 = 0.0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0.0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0.0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0.0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0.0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0.0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0.0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0.0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0.0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, $99 = 0, $eLo = 0, $eUp = 0, $regLo = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $tess;
 $2 = $regUp;
 $3 = $2;
 $4 = (($3) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (($5) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = HEAP32[$7>>2]|0;
 $regLo = $8;
 $9 = $2;
 $10 = HEAP32[$9>>2]|0;
 $eUp = $10;
 $11 = $regLo;
 $12 = HEAP32[$11>>2]|0;
 $eLo = $12;
 $13 = $eUp;
 $14 = (($13) + 16|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($15) + 28|0);
 $17 = +HEAPF32[$16>>2];
 $18 = $eLo;
 $19 = (($18) + 16|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = (($20) + 28|0);
 $22 = +HEAPF32[$21>>2];
 $23 = $17 < $22;
 do {
  if ($23) {
   label = 4;
  } else {
   $24 = $eUp;
   $25 = (($24) + 16|0);
   $26 = HEAP32[$25>>2]|0;
   $27 = (($26) + 28|0);
   $28 = +HEAPF32[$27>>2];
   $29 = $eLo;
   $30 = (($29) + 16|0);
   $31 = HEAP32[$30>>2]|0;
   $32 = (($31) + 28|0);
   $33 = +HEAPF32[$32>>2];
   $34 = $28 == $33;
   if ($34) {
    $35 = $eUp;
    $36 = (($35) + 16|0);
    $37 = HEAP32[$36>>2]|0;
    $38 = (($37) + 32|0);
    $39 = +HEAPF32[$38>>2];
    $40 = $eLo;
    $41 = (($40) + 16|0);
    $42 = HEAP32[$41>>2]|0;
    $43 = (($42) + 32|0);
    $44 = +HEAPF32[$43>>2];
    $45 = $39 <= $44;
    if ($45) {
     label = 4;
     break;
    }
   }
   $124 = $eUp;
   $125 = (($124) + 4|0);
   $126 = HEAP32[$125>>2]|0;
   $127 = (($126) + 16|0);
   $128 = HEAP32[$127>>2]|0;
   $129 = $eLo;
   $130 = (($129) + 16|0);
   $131 = HEAP32[$130>>2]|0;
   $132 = $eUp;
   $133 = (($132) + 16|0);
   $134 = HEAP32[$133>>2]|0;
   $135 = (+___gl_edgeSign($128,$131,$134));
   $136 = $135 < 0.0;
   if ($136) {
    $0 = 0;
    $163 = $0;
    STACKTOP = sp;return ($163|0);
   }
   $137 = $2;
   $138 = (($137) + 14|0);
   HEAP8[$138>>0] = 1;
   $139 = $2;
   $140 = (($139) + 4|0);
   $141 = HEAP32[$140>>2]|0;
   $142 = (($141) + 4|0);
   $143 = HEAP32[$142>>2]|0;
   $144 = HEAP32[$143>>2]|0;
   $145 = (($144) + 14|0);
   HEAP8[$145>>0] = 1;
   $146 = $eUp;
   $147 = (($146) + 4|0);
   $148 = HEAP32[$147>>2]|0;
   $149 = (___gl_meshSplitEdge($148)|0);
   $150 = ($149|0)==(0|0);
   if ($150) {
    $151 = $1;
    $152 = (($151) + 1740|0);
    _longjmp(($152|0),1);
    // unreachable;
   }
   $153 = $eLo;
   $154 = (($153) + 4|0);
   $155 = HEAP32[$154>>2]|0;
   $156 = (($155) + 12|0);
   $157 = HEAP32[$156>>2]|0;
   $158 = $eUp;
   $159 = (___gl_meshSplice($157,$158)|0);
   $160 = ($159|0)!=(0);
   if ($160) {
    break;
   } else {
    $161 = $1;
    $162 = (($161) + 1740|0);
    _longjmp(($162|0),1);
    // unreachable;
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $46 = $eLo;
  $47 = (($46) + 4|0);
  $48 = HEAP32[$47>>2]|0;
  $49 = (($48) + 16|0);
  $50 = HEAP32[$49>>2]|0;
  $51 = $eUp;
  $52 = (($51) + 16|0);
  $53 = HEAP32[$52>>2]|0;
  $54 = $eLo;
  $55 = (($54) + 16|0);
  $56 = HEAP32[$55>>2]|0;
  $57 = (+___gl_edgeSign($50,$53,$56));
  $58 = $57 > 0.0;
  if ($58) {
   $0 = 0;
   $163 = $0;
   STACKTOP = sp;return ($163|0);
  }
  $59 = $eUp;
  $60 = (($59) + 16|0);
  $61 = HEAP32[$60>>2]|0;
  $62 = (($61) + 28|0);
  $63 = +HEAPF32[$62>>2];
  $64 = $eLo;
  $65 = (($64) + 16|0);
  $66 = HEAP32[$65>>2]|0;
  $67 = (($66) + 28|0);
  $68 = +HEAPF32[$67>>2];
  $69 = $63 == $68;
  if ($69) {
   $70 = $eUp;
   $71 = (($70) + 16|0);
   $72 = HEAP32[$71>>2]|0;
   $73 = (($72) + 32|0);
   $74 = +HEAPF32[$73>>2];
   $75 = $eLo;
   $76 = (($75) + 16|0);
   $77 = HEAP32[$76>>2]|0;
   $78 = (($77) + 32|0);
   $79 = +HEAPF32[$78>>2];
   $80 = $74 == $79;
   if ($80) {
    $102 = $eUp;
    $103 = (($102) + 16|0);
    $104 = HEAP32[$103>>2]|0;
    $105 = $eLo;
    $106 = (($105) + 16|0);
    $107 = HEAP32[$106>>2]|0;
    $108 = ($104|0)!=($107|0);
    if ($108) {
     $109 = $1;
     $110 = (($109) + 68|0);
     $111 = HEAP32[$110>>2]|0;
     $112 = $eUp;
     $113 = (($112) + 16|0);
     $114 = HEAP32[$113>>2]|0;
     $115 = (($114) + 36|0);
     $116 = HEAP32[$115>>2]|0;
     ___gl_pqSortDelete($111,$116);
     $117 = $1;
     $118 = $eLo;
     $119 = (($118) + 4|0);
     $120 = HEAP32[$119>>2]|0;
     $121 = (($120) + 12|0);
     $122 = HEAP32[$121>>2]|0;
     $123 = $eUp;
     _SpliceMergeVertices($117,$122,$123);
    }
   } else {
    label = 8;
   }
  } else {
   label = 8;
  }
  do {
   if ((label|0) == 8) {
    $81 = $eLo;
    $82 = (($81) + 4|0);
    $83 = HEAP32[$82>>2]|0;
    $84 = (___gl_meshSplitEdge($83)|0);
    $85 = ($84|0)==(0|0);
    if ($85) {
     $86 = $1;
     $87 = (($86) + 1740|0);
     _longjmp(($87|0),1);
     // unreachable;
    }
    $88 = $eUp;
    $89 = $eLo;
    $90 = (($89) + 4|0);
    $91 = HEAP32[$90>>2]|0;
    $92 = (($91) + 12|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = (___gl_meshSplice($88,$93)|0);
    $95 = ($94|0)!=(0);
    if ($95) {
     $98 = $regLo;
     $99 = (($98) + 14|0);
     HEAP8[$99>>0] = 1;
     $100 = $2;
     $101 = (($100) + 14|0);
     HEAP8[$101>>0] = 1;
     break;
    } else {
     $96 = $1;
     $97 = (($96) + 1740|0);
     _longjmp(($97|0),1);
     // unreachable;
    }
   }
  } while(0);
 }
 $0 = 1;
 $163 = $0;
 STACKTOP = sp;return ($163|0);
}
function _WalkDirtyRegions($tess,$regUp) {
 $tess = $tess|0;
 $regUp = $regUp|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $eLo = 0, $eUp = 0, $regLo = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $regUp;
 $2 = $1;
 $3 = (($2) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = HEAP32[$6>>2]|0;
 $regLo = $7;
 L1: while(1) {
  while(1) {
   $8 = $regLo;
   $9 = (($8) + 14|0);
   $10 = HEAP8[$9>>0]|0;
   $11 = ($10<<24>>24)!=(0);
   if (!($11)) {
    break;
   }
   $12 = $regLo;
   $1 = $12;
   $13 = $regLo;
   $14 = (($13) + 4|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = (($15) + 8|0);
   $17 = HEAP32[$16>>2]|0;
   $18 = HEAP32[$17>>2]|0;
   $regLo = $18;
  }
  $19 = $1;
  $20 = (($19) + 14|0);
  $21 = HEAP8[$20>>0]|0;
  $22 = ($21<<24>>24)!=(0);
  if (!($22)) {
   $23 = $1;
   $regLo = $23;
   $24 = $1;
   $25 = (($24) + 4|0);
   $26 = HEAP32[$25>>2]|0;
   $27 = (($26) + 4|0);
   $28 = HEAP32[$27>>2]|0;
   $29 = HEAP32[$28>>2]|0;
   $1 = $29;
   $30 = $1;
   $31 = ($30|0)==(0|0);
   if ($31) {
    label = 8;
    break;
   }
   $32 = $1;
   $33 = (($32) + 14|0);
   $34 = HEAP8[$33>>0]|0;
   $35 = ($34<<24>>24)!=(0);
   if (!($35)) {
    label = 8;
    break;
   }
  }
  $36 = $1;
  $37 = (($36) + 14|0);
  HEAP8[$37>>0] = 0;
  $38 = $1;
  $39 = HEAP32[$38>>2]|0;
  $eUp = $39;
  $40 = $regLo;
  $41 = HEAP32[$40>>2]|0;
  $eLo = $41;
  $42 = $eUp;
  $43 = (($42) + 4|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = (($44) + 16|0);
  $46 = HEAP32[$45>>2]|0;
  $47 = $eLo;
  $48 = (($47) + 4|0);
  $49 = HEAP32[$48>>2]|0;
  $50 = (($49) + 16|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = ($46|0)!=($51|0);
  if ($52) {
   $53 = $0;
   $54 = $1;
   $55 = (_CheckForLeftSplice($53,$54)|0);
   $56 = ($55|0)!=(0);
   if ($56) {
    $57 = $regLo;
    $58 = (($57) + 15|0);
    $59 = HEAP8[$58>>0]|0;
    $60 = ($59<<24>>24)!=(0);
    if ($60) {
     $61 = $0;
     $62 = $regLo;
     _DeleteRegion($61,$62);
     $63 = $eLo;
     $64 = (___gl_meshDelete($63)|0);
     $65 = ($64|0)!=(0);
     if (!($65)) {
      label = 14;
      break;
     }
     $68 = $1;
     $69 = (($68) + 4|0);
     $70 = HEAP32[$69>>2]|0;
     $71 = (($70) + 8|0);
     $72 = HEAP32[$71>>2]|0;
     $73 = HEAP32[$72>>2]|0;
     $regLo = $73;
     $74 = $regLo;
     $75 = HEAP32[$74>>2]|0;
     $eLo = $75;
    } else {
     $76 = $1;
     $77 = (($76) + 15|0);
     $78 = HEAP8[$77>>0]|0;
     $79 = ($78<<24>>24)!=(0);
     if ($79) {
      $80 = $0;
      $81 = $1;
      _DeleteRegion($80,$81);
      $82 = $eUp;
      $83 = (___gl_meshDelete($82)|0);
      $84 = ($83|0)!=(0);
      if (!($84)) {
       label = 18;
       break;
      }
      $87 = $regLo;
      $88 = (($87) + 4|0);
      $89 = HEAP32[$88>>2]|0;
      $90 = (($89) + 4|0);
      $91 = HEAP32[$90>>2]|0;
      $92 = HEAP32[$91>>2]|0;
      $1 = $92;
      $93 = $1;
      $94 = HEAP32[$93>>2]|0;
      $eUp = $94;
     }
    }
   }
  }
  $95 = $eUp;
  $96 = (($95) + 16|0);
  $97 = HEAP32[$96>>2]|0;
  $98 = $eLo;
  $99 = (($98) + 16|0);
  $100 = HEAP32[$99>>2]|0;
  $101 = ($97|0)!=($100|0);
  if ($101) {
   $102 = $eUp;
   $103 = (($102) + 4|0);
   $104 = HEAP32[$103>>2]|0;
   $105 = (($104) + 16|0);
   $106 = HEAP32[$105>>2]|0;
   $107 = $eLo;
   $108 = (($107) + 4|0);
   $109 = HEAP32[$108>>2]|0;
   $110 = (($109) + 16|0);
   $111 = HEAP32[$110>>2]|0;
   $112 = ($106|0)!=($111|0);
   do {
    if ($112) {
     $113 = $1;
     $114 = (($113) + 15|0);
     $115 = HEAP8[$114>>0]|0;
     $116 = ($115<<24>>24)!=(0);
     if ($116) {
      label = 32;
     } else {
      $117 = $regLo;
      $118 = (($117) + 15|0);
      $119 = HEAP8[$118>>0]|0;
      $120 = ($119<<24>>24)!=(0);
      if ($120) {
       label = 32;
      } else {
       $121 = $eUp;
       $122 = (($121) + 4|0);
       $123 = HEAP32[$122>>2]|0;
       $124 = (($123) + 16|0);
       $125 = HEAP32[$124>>2]|0;
       $126 = $0;
       $127 = (($126) + 72|0);
       $128 = HEAP32[$127>>2]|0;
       $129 = ($125|0)==($128|0);
       if (!($129)) {
        $130 = $eLo;
        $131 = (($130) + 4|0);
        $132 = HEAP32[$131>>2]|0;
        $133 = (($132) + 16|0);
        $134 = HEAP32[$133>>2]|0;
        $135 = $0;
        $136 = (($135) + 72|0);
        $137 = HEAP32[$136>>2]|0;
        $138 = ($134|0)==($137|0);
        if (!($138)) {
         label = 32;
         break;
        }
       }
       $139 = $0;
       $140 = $1;
       $141 = (_CheckForIntersect($139,$140)|0);
       $142 = ($141|0)!=(0);
       if ($142) {
        label = 30;
        break L1;
       }
      }
     }
    } else {
     label = 32;
    }
   } while(0);
   if ((label|0) == 32) {
    label = 0;
    $143 = $0;
    $144 = $1;
    (_CheckForRightSplice($143,$144)|0);
   }
  }
  $145 = $eUp;
  $146 = (($145) + 16|0);
  $147 = HEAP32[$146>>2]|0;
  $148 = $eLo;
  $149 = (($148) + 16|0);
  $150 = HEAP32[$149>>2]|0;
  $151 = ($147|0)==($150|0);
  if ($151) {
   $152 = $eUp;
   $153 = (($152) + 4|0);
   $154 = HEAP32[$153>>2]|0;
   $155 = (($154) + 16|0);
   $156 = HEAP32[$155>>2]|0;
   $157 = $eLo;
   $158 = (($157) + 4|0);
   $159 = HEAP32[$158>>2]|0;
   $160 = (($159) + 16|0);
   $161 = HEAP32[$160>>2]|0;
   $162 = ($156|0)==($161|0);
   if ($162) {
    $163 = $eUp;
    $164 = (($163) + 28|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = $eLo;
    $167 = (($166) + 28|0);
    $168 = HEAP32[$167>>2]|0;
    $169 = (($168) + ($165))|0;
    HEAP32[$167>>2] = $169;
    $170 = $eUp;
    $171 = (($170) + 4|0);
    $172 = HEAP32[$171>>2]|0;
    $173 = (($172) + 28|0);
    $174 = HEAP32[$173>>2]|0;
    $175 = $eLo;
    $176 = (($175) + 4|0);
    $177 = HEAP32[$176>>2]|0;
    $178 = (($177) + 28|0);
    $179 = HEAP32[$178>>2]|0;
    $180 = (($179) + ($174))|0;
    HEAP32[$178>>2] = $180;
    $181 = $0;
    $182 = $1;
    _DeleteRegion($181,$182);
    $183 = $eUp;
    $184 = (___gl_meshDelete($183)|0);
    $185 = ($184|0)!=(0);
    if (!($185)) {
     label = 37;
     break;
    }
    $188 = $regLo;
    $189 = (($188) + 4|0);
    $190 = HEAP32[$189>>2]|0;
    $191 = (($190) + 4|0);
    $192 = HEAP32[$191>>2]|0;
    $193 = HEAP32[$192>>2]|0;
    $1 = $193;
   }
  }
 }
 if ((label|0) == 8) {
  STACKTOP = sp;return;
 }
 else if ((label|0) == 14) {
  $66 = $0;
  $67 = (($66) + 1740|0);
  _longjmp(($67|0),1);
  // unreachable;
 }
 else if ((label|0) == 18) {
  $85 = $0;
  $86 = (($85) + 1740|0);
  _longjmp(($86|0),1);
  // unreachable;
 }
 else if ((label|0) == 30) {
  STACKTOP = sp;return;
 }
 else if ((label|0) == 37) {
  $186 = $0;
  $187 = (($186) + 1740|0);
  _longjmp(($187|0),1);
  // unreachable;
 }
}
function _CheckForLeftSplice($tess,$regUp) {
 $tess = $tess|0;
 $regUp = $regUp|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0.0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0.0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $18 = 0, $19 = 0.0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0.0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0.0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0.0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0.0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0.0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0.0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $e = 0, $eLo = 0;
 var $eUp = 0, $regLo = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $tess;
 $2 = $regUp;
 $3 = $2;
 $4 = (($3) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (($5) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = HEAP32[$7>>2]|0;
 $regLo = $8;
 $9 = $2;
 $10 = HEAP32[$9>>2]|0;
 $eUp = $10;
 $11 = $regLo;
 $12 = HEAP32[$11>>2]|0;
 $eLo = $12;
 $13 = $eUp;
 $14 = (($13) + 4|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($15) + 16|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = (($17) + 28|0);
 $19 = +HEAPF32[$18>>2];
 $20 = $eLo;
 $21 = (($20) + 4|0);
 $22 = HEAP32[$21>>2]|0;
 $23 = (($22) + 16|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = (($24) + 28|0);
 $26 = +HEAPF32[$25>>2];
 $27 = $19 == $26;
 if ($27) {
  $28 = $eUp;
  $29 = (($28) + 4|0);
  $30 = HEAP32[$29>>2]|0;
  $31 = (($30) + 16|0);
  $32 = HEAP32[$31>>2]|0;
  $33 = (($32) + 32|0);
  $34 = +HEAPF32[$33>>2];
  $35 = $eLo;
  $36 = (($35) + 4|0);
  $37 = HEAP32[$36>>2]|0;
  $38 = (($37) + 16|0);
  $39 = HEAP32[$38>>2]|0;
  $40 = (($39) + 32|0);
  $41 = +HEAPF32[$40>>2];
  $42 = $34 == $41;
  if ($42) {
   ___assert_fail((1888|0),(1256|0),679,(1920|0));
   // unreachable;
  }
 }
 $43 = $eUp;
 $44 = (($43) + 4|0);
 $45 = HEAP32[$44>>2]|0;
 $46 = (($45) + 16|0);
 $47 = HEAP32[$46>>2]|0;
 $48 = (($47) + 28|0);
 $49 = +HEAPF32[$48>>2];
 $50 = $eLo;
 $51 = (($50) + 4|0);
 $52 = HEAP32[$51>>2]|0;
 $53 = (($52) + 16|0);
 $54 = HEAP32[$53>>2]|0;
 $55 = (($54) + 28|0);
 $56 = +HEAPF32[$55>>2];
 $57 = $49 < $56;
 do {
  if ($57) {
   label = 7;
  } else {
   $58 = $eUp;
   $59 = (($58) + 4|0);
   $60 = HEAP32[$59>>2]|0;
   $61 = (($60) + 16|0);
   $62 = HEAP32[$61>>2]|0;
   $63 = (($62) + 28|0);
   $64 = +HEAPF32[$63>>2];
   $65 = $eLo;
   $66 = (($65) + 4|0);
   $67 = HEAP32[$66>>2]|0;
   $68 = (($67) + 16|0);
   $69 = HEAP32[$68>>2]|0;
   $70 = (($69) + 28|0);
   $71 = +HEAPF32[$70>>2];
   $72 = $64 == $71;
   if ($72) {
    $73 = $eUp;
    $74 = (($73) + 4|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = (($75) + 16|0);
    $77 = HEAP32[$76>>2]|0;
    $78 = (($77) + 32|0);
    $79 = +HEAPF32[$78>>2];
    $80 = $eLo;
    $81 = (($80) + 4|0);
    $82 = HEAP32[$81>>2]|0;
    $83 = (($82) + 16|0);
    $84 = HEAP32[$83>>2]|0;
    $85 = (($84) + 32|0);
    $86 = +HEAPF32[$85>>2];
    $87 = $79 <= $86;
    if ($87) {
     label = 7;
     break;
    }
   }
   $133 = $eLo;
   $134 = (($133) + 4|0);
   $135 = HEAP32[$134>>2]|0;
   $136 = (($135) + 16|0);
   $137 = HEAP32[$136>>2]|0;
   $138 = $eUp;
   $139 = (($138) + 4|0);
   $140 = HEAP32[$139>>2]|0;
   $141 = (($140) + 16|0);
   $142 = HEAP32[$141>>2]|0;
   $143 = $eLo;
   $144 = (($143) + 16|0);
   $145 = HEAP32[$144>>2]|0;
   $146 = (+___gl_edgeSign($137,$142,$145));
   $147 = $146 > 0.0;
   if ($147) {
    $0 = 0;
    $177 = $0;
    STACKTOP = sp;return ($177|0);
   }
   $148 = $regLo;
   $149 = (($148) + 14|0);
   HEAP8[$149>>0] = 1;
   $150 = $2;
   $151 = (($150) + 14|0);
   HEAP8[$151>>0] = 1;
   $152 = $eLo;
   $153 = (___gl_meshSplitEdge($152)|0);
   $e = $153;
   $154 = $e;
   $155 = ($154|0)==(0|0);
   if ($155) {
    $156 = $1;
    $157 = (($156) + 1740|0);
    _longjmp(($157|0),1);
    // unreachable;
   }
   $158 = $eUp;
   $159 = (($158) + 12|0);
   $160 = HEAP32[$159>>2]|0;
   $161 = $eLo;
   $162 = (($161) + 4|0);
   $163 = HEAP32[$162>>2]|0;
   $164 = (___gl_meshSplice($160,$163)|0);
   $165 = ($164|0)!=(0);
   if ($165) {
    $168 = $2;
    $169 = (($168) + 12|0);
    $170 = HEAP8[$169>>0]|0;
    $171 = $e;
    $172 = (($171) + 4|0);
    $173 = HEAP32[$172>>2]|0;
    $174 = (($173) + 20|0);
    $175 = HEAP32[$174>>2]|0;
    $176 = (($175) + 21|0);
    HEAP8[$176>>0] = $170;
    break;
   } else {
    $166 = $1;
    $167 = (($166) + 1740|0);
    _longjmp(($167|0),1);
    // unreachable;
   }
  }
 } while(0);
 do {
  if ((label|0) == 7) {
   $88 = $eUp;
   $89 = (($88) + 4|0);
   $90 = HEAP32[$89>>2]|0;
   $91 = (($90) + 16|0);
   $92 = HEAP32[$91>>2]|0;
   $93 = $eLo;
   $94 = (($93) + 4|0);
   $95 = HEAP32[$94>>2]|0;
   $96 = (($95) + 16|0);
   $97 = HEAP32[$96>>2]|0;
   $98 = $eUp;
   $99 = (($98) + 16|0);
   $100 = HEAP32[$99>>2]|0;
   $101 = (+___gl_edgeSign($92,$97,$100));
   $102 = $101 < 0.0;
   if ($102) {
    $0 = 0;
    $177 = $0;
    STACKTOP = sp;return ($177|0);
   }
   $103 = $2;
   $104 = (($103) + 14|0);
   HEAP8[$104>>0] = 1;
   $105 = $2;
   $106 = (($105) + 4|0);
   $107 = HEAP32[$106>>2]|0;
   $108 = (($107) + 4|0);
   $109 = HEAP32[$108>>2]|0;
   $110 = HEAP32[$109>>2]|0;
   $111 = (($110) + 14|0);
   HEAP8[$111>>0] = 1;
   $112 = $eUp;
   $113 = (___gl_meshSplitEdge($112)|0);
   $e = $113;
   $114 = $e;
   $115 = ($114|0)==(0|0);
   if ($115) {
    $116 = $1;
    $117 = (($116) + 1740|0);
    _longjmp(($117|0),1);
    // unreachable;
   }
   $118 = $eLo;
   $119 = (($118) + 4|0);
   $120 = HEAP32[$119>>2]|0;
   $121 = $e;
   $122 = (___gl_meshSplice($120,$121)|0);
   $123 = ($122|0)!=(0);
   if ($123) {
    $126 = $2;
    $127 = (($126) + 12|0);
    $128 = HEAP8[$127>>0]|0;
    $129 = $e;
    $130 = (($129) + 20|0);
    $131 = HEAP32[$130>>2]|0;
    $132 = (($131) + 21|0);
    HEAP8[$132>>0] = $128;
    break;
   } else {
    $124 = $1;
    $125 = (($124) + 1740|0);
    _longjmp(($125|0),1);
    // unreachable;
   }
  }
 } while(0);
 $0 = 1;
 $177 = $0;
 STACKTOP = sp;return ($177|0);
}
function _CheckForIntersect($tess,$regUp) {
 $tess = $tess|0;
 $regUp = $regUp|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0.0, $102 = 0, $103 = 0, $104 = 0.0, $105 = 0.0, $106 = 0.0, $107 = 0.0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0.0, $112 = 0, $113 = 0, $114 = 0.0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0.0, $119 = 0, $12 = 0, $120 = 0, $121 = 0.0, $122 = 0, $123 = 0, $124 = 0, $125 = 0.0, $126 = 0, $127 = 0, $128 = 0.0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0.0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0.0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0.0, $147 = 0, $148 = 0, $149 = 0.0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0.0, $154 = 0, $155 = 0, $156 = 0.0, $157 = 0, $158 = 0.0, $159 = 0, $16 = 0, $160 = 0.0, $161 = 0, $162 = 0.0, $163 = 0, $164 = 0, $165 = 0.0, $166 = 0, $167 = 0, $168 = 0.0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0.0, $173 = 0, $174 = 0, $175 = 0.0, $176 = 0, $177 = 0.0, $178 = 0, $179 = 0, $18 = 0, $180 = 0.0, $181 = 0, $182 = 0, $183 = 0.0, $184 = 0, $185 = 0, $186 = 0, $187 = 0.0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0.0, $191 = 0, $192 = 0.0, $193 = 0, $194 = 0.0, $195 = 0, $196 = 0.0, $197 = 0, $198 = 0, $199 = 0.0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0.0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0.0, $207 = 0, $208 = 0, $209 = 0.0, $21 = 0, $210 = 0, $211 = 0.0, $212 = 0, $213 = 0.0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0.0, $219 = 0, $22 = 0, $220 = 0, $221 = 0.0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0.0, $227 = 0, $228 = 0, $229 = 0.0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0.0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0.0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0.0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0.0, $251 = 0, $252 = 0, $253 = 0.0, $254 = 0, $255 = 0, $256 = 0, $257 = 0.0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0.0, $261 = 0, $262 = 0, $263 = 0, $264 = 0.0, $265 = 0, $266 = 0, $267 = 0.0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0.0, $275 = 0, $276 = 0.0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0.0, $281 = 0, $282 = 0.0, $283 = 0, $284 = 0, $285 = 0, $286 = 0.0, $287 = 0, $288 = 0.0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0.0, $293 = 0, $294 = 0, $295 = 0, $296 = 0.0;
 var $297 = 0, $298 = 0, $299 = 0.0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0.0, $303 = 0, $304 = 0, $305 = 0.0, $306 = 0, $307 = 0, $308 = 0.0, $309 = 0, $31 = 0.0, $310 = 0, $311 = 0.0, $312 = 0, $313 = 0;
 var $314 = 0.0, $315 = 0, $316 = 0, $317 = 0.0, $318 = 0, $319 = 0, $32 = 0, $320 = 0.0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0.0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0.0;
 var $332 = 0, $333 = 0, $334 = 0, $335 = 0.0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0.0, $340 = 0.0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0.0, $347 = 0, $348 = 0, $349 = 0, $35 = 0;
 var $350 = 0.0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0.0, $356 = 0, $357 = 0, $358 = 0, $359 = 0.0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0.0, $365 = 0, $366 = 0, $367 = 0, $368 = 0;
 var $369 = 0, $37 = 0, $370 = 0.0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0.0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0;
 var $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0;
 var $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0.0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0;
 var $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0;
 var $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0;
 var $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0;
 var $477 = 0, $478 = 0, $479 = 0, $48 = 0.0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0.0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0;
 var $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0.0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0;
 var $512 = 0, $513 = 0, $514 = 0, $515 = 0.0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0.0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0;
 var $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0.0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0;
 var $549 = 0, $55 = 0.0, $550 = 0.0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0;
 var $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0.0, $581 = 0, $582 = 0, $583 = 0, $584 = 0;
 var $585 = 0, $586 = 0.0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0;
 var $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0;
 var $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0.0, $81 = 0, $82 = 0, $83 = 0.0, $84 = 0, $85 = 0;
 var $86 = 0, $87 = 0.0, $88 = 0, $89 = 0, $9 = 0, $90 = 0.0, $91 = 0.0, $92 = 0, $93 = 0, $94 = 0.0, $95 = 0, $96 = 0, $97 = 0.0, $98 = 0, $99 = 0, $dstLo = 0, $dstUp = 0, $e = 0, $eLo = 0, $eUp = 0;
 var $isect = 0, $orgLo = 0, $orgMin = 0, $orgUp = 0, $regLo = 0, $tMaxLo = 0.0, $tMinUp = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $isect = sp + 8|0;
 $1 = $tess;
 $2 = $regUp;
 $3 = $2;
 $4 = (($3) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (($5) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = HEAP32[$7>>2]|0;
 $regLo = $8;
 $9 = $2;
 $10 = HEAP32[$9>>2]|0;
 $eUp = $10;
 $11 = $regLo;
 $12 = HEAP32[$11>>2]|0;
 $eLo = $12;
 $13 = $eUp;
 $14 = (($13) + 16|0);
 $15 = HEAP32[$14>>2]|0;
 $orgUp = $15;
 $16 = $eLo;
 $17 = (($16) + 16|0);
 $18 = HEAP32[$17>>2]|0;
 $orgLo = $18;
 $19 = $eUp;
 $20 = (($19) + 4|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = (($21) + 16|0);
 $23 = HEAP32[$22>>2]|0;
 $dstUp = $23;
 $24 = $eLo;
 $25 = (($24) + 4|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = (($26) + 16|0);
 $28 = HEAP32[$27>>2]|0;
 $dstLo = $28;
 $29 = $dstLo;
 $30 = (($29) + 28|0);
 $31 = +HEAPF32[$30>>2];
 $32 = $dstUp;
 $33 = (($32) + 28|0);
 $34 = +HEAPF32[$33>>2];
 $35 = $31 == $34;
 if ($35) {
  $36 = $dstLo;
  $37 = (($36) + 32|0);
  $38 = +HEAPF32[$37>>2];
  $39 = $dstUp;
  $40 = (($39) + 32|0);
  $41 = +HEAPF32[$40>>2];
  $42 = $38 == $41;
  if ($42) {
   ___assert_fail((1504|0),(1256|0),748,(1528|0));
   // unreachable;
  }
 }
 $43 = $dstUp;
 $44 = $1;
 $45 = (($44) + 72|0);
 $46 = HEAP32[$45>>2]|0;
 $47 = $orgUp;
 $48 = (+___gl_edgeSign($43,$46,$47));
 $49 = $48 <= 0.0;
 if (!($49)) {
  ___assert_fail((1552|0),(1256|0),749,(1528|0));
  // unreachable;
 }
 $50 = $dstLo;
 $51 = $1;
 $52 = (($51) + 72|0);
 $53 = HEAP32[$52>>2]|0;
 $54 = $orgLo;
 $55 = (+___gl_edgeSign($50,$53,$54));
 $56 = $55 >= 0.0;
 if (!($56)) {
  ___assert_fail((1592|0),(1256|0),750,(1528|0));
  // unreachable;
 }
 $57 = $orgUp;
 $58 = $1;
 $59 = (($58) + 72|0);
 $60 = HEAP32[$59>>2]|0;
 $61 = ($57|0)!=($60|0);
 if (!($61)) {
  ___assert_fail((1632|0),(1256|0),751,(1528|0));
  // unreachable;
 }
 $62 = $orgLo;
 $63 = $1;
 $64 = (($63) + 72|0);
 $65 = HEAP32[$64>>2]|0;
 $66 = ($62|0)!=($65|0);
 if (!($66)) {
  ___assert_fail((1632|0),(1256|0),751,(1528|0));
  // unreachable;
 }
 $67 = $2;
 $68 = (($67) + 15|0);
 $69 = HEAP8[$68>>0]|0;
 $70 = ($69<<24>>24)!=(0);
 if ($70) {
  ___assert_fail((1680|0),(1256|0),752,(1528|0));
  // unreachable;
 }
 $71 = $regLo;
 $72 = (($71) + 15|0);
 $73 = HEAP8[$72>>0]|0;
 $74 = ($73<<24>>24)!=(0);
 if ($74) {
  ___assert_fail((1680|0),(1256|0),752,(1528|0));
  // unreachable;
 }
 $75 = $orgUp;
 $76 = $orgLo;
 $77 = ($75|0)==($76|0);
 if ($77) {
  $0 = 0;
  $634 = $0;
  STACKTOP = sp;return ($634|0);
 }
 $78 = $orgUp;
 $79 = (($78) + 32|0);
 $80 = +HEAPF32[$79>>2];
 $81 = $dstUp;
 $82 = (($81) + 32|0);
 $83 = +HEAPF32[$82>>2];
 $84 = $80 <= $83;
 if ($84) {
  $85 = $orgUp;
  $86 = (($85) + 32|0);
  $87 = +HEAPF32[$86>>2];
  $91 = $87;
 } else {
  $88 = $dstUp;
  $89 = (($88) + 32|0);
  $90 = +HEAPF32[$89>>2];
  $91 = $90;
 }
 $tMinUp = $91;
 $92 = $orgLo;
 $93 = (($92) + 32|0);
 $94 = +HEAPF32[$93>>2];
 $95 = $dstLo;
 $96 = (($95) + 32|0);
 $97 = +HEAPF32[$96>>2];
 $98 = $94 >= $97;
 if ($98) {
  $99 = $orgLo;
  $100 = (($99) + 32|0);
  $101 = +HEAPF32[$100>>2];
  $105 = $101;
 } else {
  $102 = $dstLo;
  $103 = (($102) + 32|0);
  $104 = +HEAPF32[$103>>2];
  $105 = $104;
 }
 $tMaxLo = $105;
 $106 = $tMinUp;
 $107 = $tMaxLo;
 $108 = $106 > $107;
 if ($108) {
  $0 = 0;
  $634 = $0;
  STACKTOP = sp;return ($634|0);
 }
 $109 = $orgUp;
 $110 = (($109) + 28|0);
 $111 = +HEAPF32[$110>>2];
 $112 = $orgLo;
 $113 = (($112) + 28|0);
 $114 = +HEAPF32[$113>>2];
 $115 = $111 < $114;
 do {
  if ($115) {
   label = 27;
  } else {
   $116 = $orgUp;
   $117 = (($116) + 28|0);
   $118 = +HEAPF32[$117>>2];
   $119 = $orgLo;
   $120 = (($119) + 28|0);
   $121 = +HEAPF32[$120>>2];
   $122 = $118 == $121;
   if ($122) {
    $123 = $orgUp;
    $124 = (($123) + 32|0);
    $125 = +HEAPF32[$124>>2];
    $126 = $orgLo;
    $127 = (($126) + 32|0);
    $128 = +HEAPF32[$127>>2];
    $129 = $125 <= $128;
    if ($129) {
     label = 27;
     break;
    }
   }
   $135 = $dstUp;
   $136 = $orgLo;
   $137 = $orgUp;
   $138 = (+___gl_edgeSign($135,$136,$137));
   $139 = $138 < 0.0;
   if (!($139)) {
    break;
   }
   $0 = 0;
   $634 = $0;
   STACKTOP = sp;return ($634|0);
  }
 } while(0);
 do {
  if ((label|0) == 27) {
   $130 = $dstLo;
   $131 = $orgUp;
   $132 = $orgLo;
   $133 = (+___gl_edgeSign($130,$131,$132));
   $134 = $133 > 0.0;
   if (!($134)) {
    break;
   }
   $0 = 0;
   $634 = $0;
   STACKTOP = sp;return ($634|0);
  }
 } while(0);
 $140 = $dstUp;
 $141 = $orgUp;
 $142 = $dstLo;
 $143 = $orgLo;
 ___gl_edgeIntersect($140,$141,$142,$143,$isect);
 $144 = $orgUp;
 $145 = (($144) + 32|0);
 $146 = +HEAPF32[$145>>2];
 $147 = $dstUp;
 $148 = (($147) + 32|0);
 $149 = +HEAPF32[$148>>2];
 $150 = $146 <= $149;
 if ($150) {
  $151 = $orgUp;
  $152 = (($151) + 32|0);
  $153 = +HEAPF32[$152>>2];
  $160 = $153;
 } else {
  $154 = $dstUp;
  $155 = (($154) + 32|0);
  $156 = +HEAPF32[$155>>2];
  $160 = $156;
 }
 $157 = (($isect) + 32|0);
 $158 = +HEAPF32[$157>>2];
 $159 = $160 <= $158;
 if (!($159)) {
  ___assert_fail((1728|0),(1256|0),788,(1528|0));
  // unreachable;
 }
 $161 = (($isect) + 32|0);
 $162 = +HEAPF32[$161>>2];
 $163 = $orgLo;
 $164 = (($163) + 32|0);
 $165 = +HEAPF32[$164>>2];
 $166 = $dstLo;
 $167 = (($166) + 32|0);
 $168 = +HEAPF32[$167>>2];
 $169 = $165 >= $168;
 if ($169) {
  $170 = $orgLo;
  $171 = (($170) + 32|0);
  $172 = +HEAPF32[$171>>2];
  $177 = $172;
 } else {
  $173 = $dstLo;
  $174 = (($173) + 32|0);
  $175 = +HEAPF32[$174>>2];
  $177 = $175;
 }
 $176 = $162 <= $177;
 if (!($176)) {
  ___assert_fail((1768|0),(1256|0),789,(1528|0));
  // unreachable;
 }
 $178 = $dstLo;
 $179 = (($178) + 28|0);
 $180 = +HEAPF32[$179>>2];
 $181 = $dstUp;
 $182 = (($181) + 28|0);
 $183 = +HEAPF32[$182>>2];
 $184 = $180 <= $183;
 if ($184) {
  $185 = $dstLo;
  $186 = (($185) + 28|0);
  $187 = +HEAPF32[$186>>2];
  $194 = $187;
 } else {
  $188 = $dstUp;
  $189 = (($188) + 28|0);
  $190 = +HEAPF32[$189>>2];
  $194 = $190;
 }
 $191 = (($isect) + 28|0);
 $192 = +HEAPF32[$191>>2];
 $193 = $194 <= $192;
 if (!($193)) {
  ___assert_fail((1808|0),(1256|0),790,(1528|0));
  // unreachable;
 }
 $195 = (($isect) + 28|0);
 $196 = +HEAPF32[$195>>2];
 $197 = $orgLo;
 $198 = (($197) + 28|0);
 $199 = +HEAPF32[$198>>2];
 $200 = $orgUp;
 $201 = (($200) + 28|0);
 $202 = +HEAPF32[$201>>2];
 $203 = $199 >= $202;
 if ($203) {
  $204 = $orgLo;
  $205 = (($204) + 28|0);
  $206 = +HEAPF32[$205>>2];
  $211 = $206;
 } else {
  $207 = $orgUp;
  $208 = (($207) + 28|0);
  $209 = +HEAPF32[$208>>2];
  $211 = $209;
 }
 $210 = $196 <= $211;
 if (!($210)) {
  ___assert_fail((1848|0),(1256|0),791,(1528|0));
  // unreachable;
 }
 $212 = (($isect) + 28|0);
 $213 = +HEAPF32[$212>>2];
 $214 = $1;
 $215 = (($214) + 72|0);
 $216 = HEAP32[$215>>2]|0;
 $217 = (($216) + 28|0);
 $218 = +HEAPF32[$217>>2];
 $219 = $213 < $218;
 do {
  if ($219) {
   label = 56;
  } else {
   $220 = (($isect) + 28|0);
   $221 = +HEAPF32[$220>>2];
   $222 = $1;
   $223 = (($222) + 72|0);
   $224 = HEAP32[$223>>2]|0;
   $225 = (($224) + 28|0);
   $226 = +HEAPF32[$225>>2];
   $227 = $221 == $226;
   if (!($227)) {
    break;
   }
   $228 = (($isect) + 32|0);
   $229 = +HEAPF32[$228>>2];
   $230 = $1;
   $231 = (($230) + 72|0);
   $232 = HEAP32[$231>>2]|0;
   $233 = (($232) + 32|0);
   $234 = +HEAPF32[$233>>2];
   $235 = $229 <= $234;
   if ($235) {
    label = 56;
   }
  }
 } while(0);
 if ((label|0) == 56) {
  $236 = $1;
  $237 = (($236) + 72|0);
  $238 = HEAP32[$237>>2]|0;
  $239 = (($238) + 28|0);
  $240 = +HEAPF32[$239>>2];
  $241 = (($isect) + 28|0);
  HEAPF32[$241>>2] = $240;
  $242 = $1;
  $243 = (($242) + 72|0);
  $244 = HEAP32[$243>>2]|0;
  $245 = (($244) + 32|0);
  $246 = +HEAPF32[$245>>2];
  $247 = (($isect) + 32|0);
  HEAPF32[$247>>2] = $246;
 }
 $248 = $orgUp;
 $249 = (($248) + 28|0);
 $250 = +HEAPF32[$249>>2];
 $251 = $orgLo;
 $252 = (($251) + 28|0);
 $253 = +HEAPF32[$252>>2];
 $254 = $250 < $253;
 do {
  if ($254) {
   label = 60;
  } else {
   $255 = $orgUp;
   $256 = (($255) + 28|0);
   $257 = +HEAPF32[$256>>2];
   $258 = $orgLo;
   $259 = (($258) + 28|0);
   $260 = +HEAPF32[$259>>2];
   $261 = $257 == $260;
   if ($261) {
    $262 = $orgUp;
    $263 = (($262) + 32|0);
    $264 = +HEAPF32[$263>>2];
    $265 = $orgLo;
    $266 = (($265) + 32|0);
    $267 = +HEAPF32[$266>>2];
    $268 = $264 <= $267;
    if ($268) {
     label = 60;
     break;
    }
   }
   $270 = $orgLo;
   $271 = $270;
  }
 } while(0);
 if ((label|0) == 60) {
  $269 = $orgUp;
  $271 = $269;
 }
 $orgMin = $271;
 $272 = $orgMin;
 $273 = (($272) + 28|0);
 $274 = +HEAPF32[$273>>2];
 $275 = (($isect) + 28|0);
 $276 = +HEAPF32[$275>>2];
 $277 = $274 < $276;
 do {
  if ($277) {
   label = 65;
  } else {
   $278 = $orgMin;
   $279 = (($278) + 28|0);
   $280 = +HEAPF32[$279>>2];
   $281 = (($isect) + 28|0);
   $282 = +HEAPF32[$281>>2];
   $283 = $280 == $282;
   if (!($283)) {
    break;
   }
   $284 = $orgMin;
   $285 = (($284) + 32|0);
   $286 = +HEAPF32[$285>>2];
   $287 = (($isect) + 32|0);
   $288 = +HEAPF32[$287>>2];
   $289 = $286 <= $288;
   if ($289) {
    label = 65;
   }
  }
 } while(0);
 if ((label|0) == 65) {
  $290 = $orgMin;
  $291 = (($290) + 28|0);
  $292 = +HEAPF32[$291>>2];
  $293 = (($isect) + 28|0);
  HEAPF32[$293>>2] = $292;
  $294 = $orgMin;
  $295 = (($294) + 32|0);
  $296 = +HEAPF32[$295>>2];
  $297 = (($isect) + 32|0);
  HEAPF32[$297>>2] = $296;
 }
 $298 = (($isect) + 28|0);
 $299 = +HEAPF32[$298>>2];
 $300 = $orgUp;
 $301 = (($300) + 28|0);
 $302 = +HEAPF32[$301>>2];
 $303 = $299 == $302;
 if ($303) {
  $304 = (($isect) + 32|0);
  $305 = +HEAPF32[$304>>2];
  $306 = $orgUp;
  $307 = (($306) + 32|0);
  $308 = +HEAPF32[$307>>2];
  $309 = $305 == $308;
  if (!($309)) {
   label = 68;
  }
 } else {
  label = 68;
 }
 do {
  if ((label|0) == 68) {
   $310 = (($isect) + 28|0);
   $311 = +HEAPF32[$310>>2];
   $312 = $orgLo;
   $313 = (($312) + 28|0);
   $314 = +HEAPF32[$313>>2];
   $315 = $311 == $314;
   if ($315) {
    $316 = (($isect) + 32|0);
    $317 = +HEAPF32[$316>>2];
    $318 = $orgLo;
    $319 = (($318) + 32|0);
    $320 = +HEAPF32[$319>>2];
    $321 = $317 == $320;
    if ($321) {
     break;
    }
   }
   $324 = $dstUp;
   $325 = (($324) + 28|0);
   $326 = +HEAPF32[$325>>2];
   $327 = $1;
   $328 = (($327) + 72|0);
   $329 = HEAP32[$328>>2]|0;
   $330 = (($329) + 28|0);
   $331 = +HEAPF32[$330>>2];
   $332 = $326 == $331;
   if ($332) {
    $333 = $dstUp;
    $334 = (($333) + 32|0);
    $335 = +HEAPF32[$334>>2];
    $336 = $1;
    $337 = (($336) + 72|0);
    $338 = HEAP32[$337>>2]|0;
    $339 = (($338) + 32|0);
    $340 = +HEAPF32[$339>>2];
    $341 = $335 == $340;
    if ($341) {
     label = 74;
    } else {
     label = 73;
    }
   } else {
    label = 73;
   }
   if ((label|0) == 73) {
    $342 = $dstUp;
    $343 = $1;
    $344 = (($343) + 72|0);
    $345 = HEAP32[$344>>2]|0;
    $346 = (+___gl_edgeSign($342,$345,$isect));
    $347 = $346 >= 0.0;
    if (!($347)) {
     label = 74;
    }
   }
   do {
    if ((label|0) == 74) {
     $348 = $dstLo;
     $349 = (($348) + 28|0);
     $350 = +HEAPF32[$349>>2];
     $351 = $1;
     $352 = (($351) + 72|0);
     $353 = HEAP32[$352>>2]|0;
     $354 = (($353) + 28|0);
     $355 = +HEAPF32[$354>>2];
     $356 = $350 == $355;
     if ($356) {
      $357 = $dstLo;
      $358 = (($357) + 32|0);
      $359 = +HEAPF32[$358>>2];
      $360 = $1;
      $361 = (($360) + 72|0);
      $362 = HEAP32[$361>>2]|0;
      $363 = (($362) + 32|0);
      $364 = +HEAPF32[$363>>2];
      $365 = $359 == $364;
      if (!($365)) {
       label = 76;
      }
     } else {
      label = 76;
     }
     if ((label|0) == 76) {
      $366 = $dstLo;
      $367 = $1;
      $368 = (($367) + 72|0);
      $369 = HEAP32[$368>>2]|0;
      $370 = (+___gl_edgeSign($366,$369,$isect));
      $371 = $370 <= 0.0;
      if ($371) {
       break;
      }
     }
     $555 = $eUp;
     $556 = (($555) + 4|0);
     $557 = HEAP32[$556>>2]|0;
     $558 = (___gl_meshSplitEdge($557)|0);
     $559 = ($558|0)==(0|0);
     if ($559) {
      $560 = $1;
      $561 = (($560) + 1740|0);
      _longjmp(($561|0),1);
      // unreachable;
     }
     $562 = $eLo;
     $563 = (($562) + 4|0);
     $564 = HEAP32[$563>>2]|0;
     $565 = (___gl_meshSplitEdge($564)|0);
     $566 = ($565|0)==(0|0);
     if ($566) {
      $567 = $1;
      $568 = (($567) + 1740|0);
      _longjmp(($568|0),1);
      // unreachable;
     }
     $569 = $eLo;
     $570 = (($569) + 4|0);
     $571 = HEAP32[$570>>2]|0;
     $572 = (($571) + 12|0);
     $573 = HEAP32[$572>>2]|0;
     $574 = $eUp;
     $575 = (___gl_meshSplice($573,$574)|0);
     $576 = ($575|0)!=(0);
     if (!($576)) {
      $577 = $1;
      $578 = (($577) + 1740|0);
      _longjmp(($578|0),1);
      // unreachable;
     }
     $579 = (($isect) + 28|0);
     $580 = +HEAPF32[$579>>2];
     $581 = $eUp;
     $582 = (($581) + 16|0);
     $583 = HEAP32[$582>>2]|0;
     $584 = (($583) + 28|0);
     HEAPF32[$584>>2] = $580;
     $585 = (($isect) + 32|0);
     $586 = +HEAPF32[$585>>2];
     $587 = $eUp;
     $588 = (($587) + 16|0);
     $589 = HEAP32[$588>>2]|0;
     $590 = (($589) + 32|0);
     HEAPF32[$590>>2] = $586;
     $591 = $1;
     $592 = (($591) + 68|0);
     $593 = HEAP32[$592>>2]|0;
     $594 = $eUp;
     $595 = (($594) + 16|0);
     $596 = HEAP32[$595>>2]|0;
     $597 = (___gl_pqSortInsert($593,$596)|0);
     $598 = $eUp;
     $599 = (($598) + 16|0);
     $600 = HEAP32[$599>>2]|0;
     $601 = (($600) + 36|0);
     HEAP32[$601>>2] = $597;
     $602 = $eUp;
     $603 = (($602) + 16|0);
     $604 = HEAP32[$603>>2]|0;
     $605 = (($604) + 36|0);
     $606 = HEAP32[$605>>2]|0;
     $607 = ($606|0)==(2147483647);
     if ($607) {
      $608 = $1;
      $609 = (($608) + 68|0);
      $610 = HEAP32[$609>>2]|0;
      ___gl_pqSortDeletePriorityQ($610);
      $611 = $1;
      $612 = (($611) + 68|0);
      HEAP32[$612>>2] = 0;
      $613 = $1;
      $614 = (($613) + 1740|0);
      _longjmp(($614|0),1);
      // unreachable;
     }
     $615 = $1;
     $616 = $eUp;
     $617 = (($616) + 16|0);
     $618 = HEAP32[$617>>2]|0;
     $619 = $orgUp;
     $620 = $dstUp;
     $621 = $orgLo;
     $622 = $dstLo;
     _GetIntersectData($615,$618,$619,$620,$621,$622);
     $623 = $regLo;
     $624 = (($623) + 14|0);
     HEAP8[$624>>0] = 1;
     $625 = $2;
     $626 = (($625) + 14|0);
     HEAP8[$626>>0] = 1;
     $627 = $2;
     $628 = (($627) + 4|0);
     $629 = HEAP32[$628>>2]|0;
     $630 = (($629) + 4|0);
     $631 = HEAP32[$630>>2]|0;
     $632 = HEAP32[$631>>2]|0;
     $633 = (($632) + 14|0);
     HEAP8[$633>>0] = 1;
     $0 = 0;
     $634 = $0;
     STACKTOP = sp;return ($634|0);
    }
   } while(0);
   $372 = $dstLo;
   $373 = $1;
   $374 = (($373) + 72|0);
   $375 = HEAP32[$374>>2]|0;
   $376 = ($372|0)==($375|0);
   if ($376) {
    $377 = $eUp;
    $378 = (($377) + 4|0);
    $379 = HEAP32[$378>>2]|0;
    $380 = (___gl_meshSplitEdge($379)|0);
    $381 = ($380|0)==(0|0);
    if ($381) {
     $382 = $1;
     $383 = (($382) + 1740|0);
     _longjmp(($383|0),1);
     // unreachable;
    }
    $384 = $eLo;
    $385 = (($384) + 4|0);
    $386 = HEAP32[$385>>2]|0;
    $387 = $eUp;
    $388 = (___gl_meshSplice($386,$387)|0);
    $389 = ($388|0)!=(0);
    if (!($389)) {
     $390 = $1;
     $391 = (($390) + 1740|0);
     _longjmp(($391|0),1);
     // unreachable;
    }
    $392 = $2;
    $393 = (_TopLeftRegion($392)|0);
    $2 = $393;
    $394 = $2;
    $395 = ($394|0)==(0|0);
    if ($395) {
     $396 = $1;
     $397 = (($396) + 1740|0);
     _longjmp(($397|0),1);
     // unreachable;
    }
    $398 = $2;
    $399 = (($398) + 4|0);
    $400 = HEAP32[$399>>2]|0;
    $401 = (($400) + 8|0);
    $402 = HEAP32[$401>>2]|0;
    $403 = HEAP32[$402>>2]|0;
    $404 = HEAP32[$403>>2]|0;
    $eUp = $404;
    $405 = $1;
    $406 = $2;
    $407 = (($406) + 4|0);
    $408 = HEAP32[$407>>2]|0;
    $409 = (($408) + 8|0);
    $410 = HEAP32[$409>>2]|0;
    $411 = HEAP32[$410>>2]|0;
    $412 = $regLo;
    (_FinishLeftRegions($405,$411,$412)|0);
    $413 = $1;
    $414 = $2;
    $415 = $eUp;
    $416 = (($415) + 4|0);
    $417 = HEAP32[$416>>2]|0;
    $418 = (($417) + 12|0);
    $419 = HEAP32[$418>>2]|0;
    $420 = $eUp;
    $421 = $eUp;
    _AddRightEdges($413,$414,$419,$420,$421,1);
    $0 = 1;
    $634 = $0;
    STACKTOP = sp;return ($634|0);
   }
   $422 = $dstUp;
   $423 = $1;
   $424 = (($423) + 72|0);
   $425 = HEAP32[$424>>2]|0;
   $426 = ($422|0)==($425|0);
   if ($426) {
    $427 = $eLo;
    $428 = (($427) + 4|0);
    $429 = HEAP32[$428>>2]|0;
    $430 = (___gl_meshSplitEdge($429)|0);
    $431 = ($430|0)==(0|0);
    if ($431) {
     $432 = $1;
     $433 = (($432) + 1740|0);
     _longjmp(($433|0),1);
     // unreachable;
    }
    $434 = $eUp;
    $435 = (($434) + 12|0);
    $436 = HEAP32[$435>>2]|0;
    $437 = $eLo;
    $438 = (($437) + 4|0);
    $439 = HEAP32[$438>>2]|0;
    $440 = (($439) + 12|0);
    $441 = HEAP32[$440>>2]|0;
    $442 = (___gl_meshSplice($436,$441)|0);
    $443 = ($442|0)!=(0);
    if (!($443)) {
     $444 = $1;
     $445 = (($444) + 1740|0);
     _longjmp(($445|0),1);
     // unreachable;
    }
    $446 = $2;
    $regLo = $446;
    $447 = $2;
    $448 = (_TopRightRegion($447)|0);
    $2 = $448;
    $449 = $2;
    $450 = (($449) + 4|0);
    $451 = HEAP32[$450>>2]|0;
    $452 = (($451) + 8|0);
    $453 = HEAP32[$452>>2]|0;
    $454 = HEAP32[$453>>2]|0;
    $455 = HEAP32[$454>>2]|0;
    $456 = (($455) + 4|0);
    $457 = HEAP32[$456>>2]|0;
    $458 = (($457) + 8|0);
    $459 = HEAP32[$458>>2]|0;
    $e = $459;
    $460 = $eLo;
    $461 = (($460) + 4|0);
    $462 = HEAP32[$461>>2]|0;
    $463 = (($462) + 12|0);
    $464 = HEAP32[$463>>2]|0;
    $465 = $regLo;
    HEAP32[$465>>2] = $464;
    $466 = $1;
    $467 = $regLo;
    $468 = (_FinishLeftRegions($466,$467,0)|0);
    $eLo = $468;
    $469 = $1;
    $470 = $2;
    $471 = $eLo;
    $472 = (($471) + 8|0);
    $473 = HEAP32[$472>>2]|0;
    $474 = $eUp;
    $475 = (($474) + 4|0);
    $476 = HEAP32[$475>>2]|0;
    $477 = (($476) + 8|0);
    $478 = HEAP32[$477>>2]|0;
    $479 = $e;
    _AddRightEdges($469,$470,$473,$478,$479,1);
    $0 = 1;
    $634 = $0;
    STACKTOP = sp;return ($634|0);
   }
   $480 = $dstUp;
   $481 = $1;
   $482 = (($481) + 72|0);
   $483 = HEAP32[$482>>2]|0;
   $484 = (+___gl_edgeSign($480,$483,$isect));
   $485 = $484 >= 0.0;
   do {
    if ($485) {
     $486 = $2;
     $487 = (($486) + 14|0);
     HEAP8[$487>>0] = 1;
     $488 = $2;
     $489 = (($488) + 4|0);
     $490 = HEAP32[$489>>2]|0;
     $491 = (($490) + 4|0);
     $492 = HEAP32[$491>>2]|0;
     $493 = HEAP32[$492>>2]|0;
     $494 = (($493) + 14|0);
     HEAP8[$494>>0] = 1;
     $495 = $eUp;
     $496 = (($495) + 4|0);
     $497 = HEAP32[$496>>2]|0;
     $498 = (___gl_meshSplitEdge($497)|0);
     $499 = ($498|0)==(0|0);
     if ($499) {
      $500 = $1;
      $501 = (($500) + 1740|0);
      _longjmp(($501|0),1);
      // unreachable;
     } else {
      $502 = $1;
      $503 = (($502) + 72|0);
      $504 = HEAP32[$503>>2]|0;
      $505 = (($504) + 28|0);
      $506 = +HEAPF32[$505>>2];
      $507 = $eUp;
      $508 = (($507) + 16|0);
      $509 = HEAP32[$508>>2]|0;
      $510 = (($509) + 28|0);
      HEAPF32[$510>>2] = $506;
      $511 = $1;
      $512 = (($511) + 72|0);
      $513 = HEAP32[$512>>2]|0;
      $514 = (($513) + 32|0);
      $515 = +HEAPF32[$514>>2];
      $516 = $eUp;
      $517 = (($516) + 16|0);
      $518 = HEAP32[$517>>2]|0;
      $519 = (($518) + 32|0);
      HEAPF32[$519>>2] = $515;
      break;
     }
    }
   } while(0);
   $520 = $dstLo;
   $521 = $1;
   $522 = (($521) + 72|0);
   $523 = HEAP32[$522>>2]|0;
   $524 = (+___gl_edgeSign($520,$523,$isect));
   $525 = $524 <= 0.0;
   do {
    if ($525) {
     $526 = $regLo;
     $527 = (($526) + 14|0);
     HEAP8[$527>>0] = 1;
     $528 = $2;
     $529 = (($528) + 14|0);
     HEAP8[$529>>0] = 1;
     $530 = $eLo;
     $531 = (($530) + 4|0);
     $532 = HEAP32[$531>>2]|0;
     $533 = (___gl_meshSplitEdge($532)|0);
     $534 = ($533|0)==(0|0);
     if ($534) {
      $535 = $1;
      $536 = (($535) + 1740|0);
      _longjmp(($536|0),1);
      // unreachable;
     } else {
      $537 = $1;
      $538 = (($537) + 72|0);
      $539 = HEAP32[$538>>2]|0;
      $540 = (($539) + 28|0);
      $541 = +HEAPF32[$540>>2];
      $542 = $eLo;
      $543 = (($542) + 16|0);
      $544 = HEAP32[$543>>2]|0;
      $545 = (($544) + 28|0);
      HEAPF32[$545>>2] = $541;
      $546 = $1;
      $547 = (($546) + 72|0);
      $548 = HEAP32[$547>>2]|0;
      $549 = (($548) + 32|0);
      $550 = +HEAPF32[$549>>2];
      $551 = $eLo;
      $552 = (($551) + 16|0);
      $553 = HEAP32[$552>>2]|0;
      $554 = (($553) + 32|0);
      HEAPF32[$554>>2] = $550;
      break;
     }
    }
   } while(0);
   $0 = 0;
   $634 = $0;
   STACKTOP = sp;return ($634|0);
  }
 } while(0);
 $322 = $1;
 $323 = $2;
 (_CheckForRightSplice($322,$323)|0);
 $0 = 0;
 $634 = $0;
 STACKTOP = sp;return ($634|0);
}
function _TopRightRegion($reg) {
 $reg = $reg|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $dst = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $reg;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = (($2) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) + 16|0);
 $6 = HEAP32[$5>>2]|0;
 $dst = $6;
 while(1) {
  $7 = $0;
  $8 = (($7) + 4|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = (($9) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = HEAP32[$11>>2]|0;
  $0 = $12;
  $13 = $0;
  $14 = HEAP32[$13>>2]|0;
  $15 = (($14) + 4|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = (($16) + 16|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = $dst;
  $20 = ($18|0)==($19|0);
  if (!($20)) {
   break;
  }
 }
 $21 = $0;
 STACKTOP = sp;return ($21|0);
}
function _GetIntersectData($tess,$isect,$orgUp,$dstUp,$orgLo,$dstLo) {
 $tess = $tess|0;
 $isect = $isect|0;
 $orgUp = $orgUp|0;
 $dstUp = $dstUp|0;
 $orgLo = $orgLo|0;
 $dstLo = $dstLo|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $data = 0, $weights = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $data = sp + 24|0;
 $weights = sp + 40|0;
 $0 = $tess;
 $1 = $isect;
 $2 = $orgUp;
 $3 = $dstUp;
 $4 = $orgLo;
 $5 = $dstLo;
 $6 = $2;
 $7 = (($6) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 HEAP32[$data>>2] = $8;
 $9 = $3;
 $10 = (($9) + 12|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = (($data) + 4|0);
 HEAP32[$12>>2] = $11;
 $13 = $4;
 $14 = (($13) + 12|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($data) + 8|0);
 HEAP32[$16>>2] = $15;
 $17 = $5;
 $18 = (($17) + 12|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = (($data) + 12|0);
 HEAP32[$20>>2] = $19;
 $21 = $1;
 $22 = (($21) + 16|0);
 $23 = (($22) + 8|0);
 HEAPF32[$23>>2] = 0.0;
 $24 = $1;
 $25 = (($24) + 16|0);
 $26 = (($25) + 4|0);
 HEAPF32[$26>>2] = 0.0;
 $27 = $1;
 $28 = (($27) + 16|0);
 HEAPF32[$28>>2] = 0.0;
 $29 = $1;
 $30 = $2;
 $31 = $3;
 _VertexWeights($29,$30,$31,$weights);
 $32 = $1;
 $33 = $4;
 $34 = $5;
 $35 = (($weights) + 8|0);
 _VertexWeights($32,$33,$34,$35);
 $36 = $0;
 $37 = $1;
 _CallCombine($36,$37,$data,$weights,1);
 STACKTOP = sp;return;
}
function _VertexWeights($isect,$org,$dst,$weights) {
 $isect = $isect|0;
 $org = $org|0;
 $dst = $dst|0;
 $weights = $weights|0;
 var $0 = 0, $1 = 0, $10 = 0.0, $100 = 0.0, $101 = 0.0, $102 = 0.0, $103 = 0.0, $104 = 0.0, $105 = 0.0, $106 = 0.0, $107 = 0.0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0.0, $111 = 0.0, $112 = 0.0, $113 = 0.0, $114 = 0.0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0.0, $119 = 0, $12 = 0, $120 = 0, $121 = 0.0, $122 = 0.0, $123 = 0, $124 = 0, $125 = 0.0, $126 = 0, $127 = 0, $128 = 0.0, $129 = 0.0, $13 = 0, $130 = 0.0, $131 = 0, $132 = 0, $133 = 0.0;
 var $134 = 0.0, $135 = 0, $136 = 0.0, $137 = 0, $138 = 0, $139 = 0, $14 = 0.0, $140 = 0.0, $141 = 0.0, $142 = 0, $143 = 0, $144 = 0.0, $145 = 0, $146 = 0, $147 = 0, $148 = 0.0, $149 = 0.0, $15 = 0, $150 = 0.0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0.0, $155 = 0.0, $156 = 0, $157 = 0.0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0.0, $162 = 0.0, $163 = 0, $164 = 0, $165 = 0.0, $166 = 0, $167 = 0, $168 = 0, $169 = 0.0, $17 = 0.0;
 var $170 = 0.0, $171 = 0.0, $172 = 0, $173 = 0, $174 = 0, $175 = 0.0, $176 = 0.0, $18 = 0.0, $19 = 0.0, $2 = 0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0.0, $26 = 0.0, $27 = 0, $28 = 0, $29 = 0.0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0.0, $42 = 0.0, $43 = 0, $44 = 0, $45 = 0.0, $46 = 0, $47 = 0;
 var $48 = 0.0, $49 = 0.0, $5 = 0, $50 = 0.0, $51 = 0.0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0, $61 = 0, $62 = 0, $63 = 0.0, $64 = 0, $65 = 0;
 var $66 = 0.0, $67 = 0.0, $68 = 0.0, $69 = 0, $7 = 0, $70 = 0, $71 = 0.0, $72 = 0, $73 = 0, $74 = 0.0, $75 = 0.0, $76 = 0, $77 = 0, $78 = 0.0, $79 = 0, $8 = 0, $80 = 0, $81 = 0.0, $82 = 0.0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0.0, $87 = 0, $88 = 0, $89 = 0.0, $9 = 0.0, $90 = 0.0, $91 = 0.0, $92 = 0, $93 = 0, $94 = 0.0, $95 = 0, $96 = 0, $97 = 0.0, $98 = 0.0, $99 = 0.0, $t1 = 0.0, $t2 = 0.0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $isect;
 $1 = $org;
 $2 = $dst;
 $3 = $weights;
 $4 = $1;
 $5 = (($4) + 28|0);
 $6 = +HEAPF32[$5>>2];
 $7 = $0;
 $8 = (($7) + 28|0);
 $9 = +HEAPF32[$8>>2];
 $10 = $6 - $9;
 $11 = $10 < 0.0;
 if ($11) {
  $12 = $1;
  $13 = (($12) + 28|0);
  $14 = +HEAPF32[$13>>2];
  $15 = $0;
  $16 = (($15) + 28|0);
  $17 = +HEAPF32[$16>>2];
  $18 = $14 - $17;
  $19 = -$18;
  $52 = $19;
 } else {
  $20 = $1;
  $21 = (($20) + 28|0);
  $22 = +HEAPF32[$21>>2];
  $23 = $0;
  $24 = (($23) + 28|0);
  $25 = +HEAPF32[$24>>2];
  $26 = $22 - $25;
  $52 = $26;
 }
 $27 = $1;
 $28 = (($27) + 32|0);
 $29 = +HEAPF32[$28>>2];
 $30 = $0;
 $31 = (($30) + 32|0);
 $32 = +HEAPF32[$31>>2];
 $33 = $29 - $32;
 $34 = $33 < 0.0;
 if ($34) {
  $35 = $1;
  $36 = (($35) + 32|0);
  $37 = +HEAPF32[$36>>2];
  $38 = $0;
  $39 = (($38) + 32|0);
  $40 = +HEAPF32[$39>>2];
  $41 = $37 - $40;
  $42 = -$41;
  $51 = $42;
 } else {
  $43 = $1;
  $44 = (($43) + 32|0);
  $45 = +HEAPF32[$44>>2];
  $46 = $0;
  $47 = (($46) + 32|0);
  $48 = +HEAPF32[$47>>2];
  $49 = $45 - $48;
  $51 = $49;
 }
 $50 = $52 + $51;
 $t1 = $50;
 $53 = $2;
 $54 = (($53) + 28|0);
 $55 = +HEAPF32[$54>>2];
 $56 = $0;
 $57 = (($56) + 28|0);
 $58 = +HEAPF32[$57>>2];
 $59 = $55 - $58;
 $60 = $59 < 0.0;
 if ($60) {
  $61 = $2;
  $62 = (($61) + 28|0);
  $63 = +HEAPF32[$62>>2];
  $64 = $0;
  $65 = (($64) + 28|0);
  $66 = +HEAPF32[$65>>2];
  $67 = $63 - $66;
  $68 = -$67;
  $101 = $68;
 } else {
  $69 = $2;
  $70 = (($69) + 28|0);
  $71 = +HEAPF32[$70>>2];
  $72 = $0;
  $73 = (($72) + 28|0);
  $74 = +HEAPF32[$73>>2];
  $75 = $71 - $74;
  $101 = $75;
 }
 $76 = $2;
 $77 = (($76) + 32|0);
 $78 = +HEAPF32[$77>>2];
 $79 = $0;
 $80 = (($79) + 32|0);
 $81 = +HEAPF32[$80>>2];
 $82 = $78 - $81;
 $83 = $82 < 0.0;
 if ($83) {
  $84 = $2;
  $85 = (($84) + 32|0);
  $86 = +HEAPF32[$85>>2];
  $87 = $0;
  $88 = (($87) + 32|0);
  $89 = +HEAPF32[$88>>2];
  $90 = $86 - $89;
  $91 = -$90;
  $100 = $91;
 } else {
  $92 = $2;
  $93 = (($92) + 32|0);
  $94 = +HEAPF32[$93>>2];
  $95 = $0;
  $96 = (($95) + 32|0);
  $97 = +HEAPF32[$96>>2];
  $98 = $94 - $97;
  $100 = $98;
 }
 $99 = $101 + $100;
 $t2 = $99;
 $102 = $t2;
 $103 = 0.5 * $102;
 $104 = $t1;
 $105 = $t2;
 $106 = $104 + $105;
 $107 = $103 / $106;
 $108 = $3;
 HEAPF32[$108>>2] = $107;
 $109 = $t1;
 $110 = 0.5 * $109;
 $111 = $t1;
 $112 = $t2;
 $113 = $111 + $112;
 $114 = $110 / $113;
 $115 = $3;
 $116 = (($115) + 4|0);
 HEAPF32[$116>>2] = $114;
 $117 = $3;
 $118 = +HEAPF32[$117>>2];
 $119 = $1;
 $120 = (($119) + 16|0);
 $121 = +HEAPF32[$120>>2];
 $122 = $118 * $121;
 $123 = $3;
 $124 = (($123) + 4|0);
 $125 = +HEAPF32[$124>>2];
 $126 = $2;
 $127 = (($126) + 16|0);
 $128 = +HEAPF32[$127>>2];
 $129 = $125 * $128;
 $130 = $122 + $129;
 $131 = $0;
 $132 = (($131) + 16|0);
 $133 = +HEAPF32[$132>>2];
 $134 = $133 + $130;
 HEAPF32[$132>>2] = $134;
 $135 = $3;
 $136 = +HEAPF32[$135>>2];
 $137 = $1;
 $138 = (($137) + 16|0);
 $139 = (($138) + 4|0);
 $140 = +HEAPF32[$139>>2];
 $141 = $136 * $140;
 $142 = $3;
 $143 = (($142) + 4|0);
 $144 = +HEAPF32[$143>>2];
 $145 = $2;
 $146 = (($145) + 16|0);
 $147 = (($146) + 4|0);
 $148 = +HEAPF32[$147>>2];
 $149 = $144 * $148;
 $150 = $141 + $149;
 $151 = $0;
 $152 = (($151) + 16|0);
 $153 = (($152) + 4|0);
 $154 = +HEAPF32[$153>>2];
 $155 = $154 + $150;
 HEAPF32[$153>>2] = $155;
 $156 = $3;
 $157 = +HEAPF32[$156>>2];
 $158 = $1;
 $159 = (($158) + 16|0);
 $160 = (($159) + 8|0);
 $161 = +HEAPF32[$160>>2];
 $162 = $157 * $161;
 $163 = $3;
 $164 = (($163) + 4|0);
 $165 = +HEAPF32[$164>>2];
 $166 = $2;
 $167 = (($166) + 16|0);
 $168 = (($167) + 8|0);
 $169 = +HEAPF32[$168>>2];
 $170 = $165 * $169;
 $171 = $162 + $170;
 $172 = $0;
 $173 = (($172) + 16|0);
 $174 = (($173) + 8|0);
 $175 = +HEAPF32[$174>>2];
 $176 = $175 + $171;
 HEAPF32[$174>>2] = $176;
 STACKTOP = sp;return;
}
function _CallCombine($tess,$isect,$data,$weights,$needed) {
 $tess = $tess|0;
 $isect = $isect|0;
 $data = $data|0;
 $weights = $weights|0;
 $needed = $needed|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0.0, $8 = 0, $9 = 0, $coords = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $coords = sp + 16|0;
 $0 = $tess;
 $1 = $isect;
 $2 = $data;
 $3 = $weights;
 $4 = $needed;
 $5 = $1;
 $6 = (($5) + 16|0);
 $7 = +HEAPF32[$6>>2];
 HEAPF32[$coords>>2] = $7;
 $8 = $1;
 $9 = (($8) + 16|0);
 $10 = (($9) + 4|0);
 $11 = +HEAPF32[$10>>2];
 $12 = (($coords) + 4|0);
 HEAPF32[$12>>2] = $11;
 $13 = $1;
 $14 = (($13) + 16|0);
 $15 = (($14) + 8|0);
 $16 = +HEAPF32[$15>>2];
 $17 = (($coords) + 8|0);
 HEAPF32[$17>>2] = $16;
 $18 = $1;
 $19 = (($18) + 12|0);
 HEAP32[$19>>2] = 0;
 $20 = $0;
 $21 = (($20) + 1736|0);
 $22 = HEAP32[$21>>2]|0;
 $23 = ($22|0)!=(19|0);
 if ($23) {
  $24 = $0;
  $25 = (($24) + 1736|0);
  $26 = HEAP32[$25>>2]|0;
  $27 = $2;
  $28 = $3;
  $29 = $1;
  $30 = (($29) + 12|0);
  $31 = $0;
  $32 = (($31) + 1896|0);
  $33 = HEAP32[$32>>2]|0;
  FUNCTION_TABLE_viiiii[$26 & 31]($coords,$27,$28,$30,$33);
 } else {
  $34 = $0;
  $35 = (($34) + 76|0);
  $36 = HEAP32[$35>>2]|0;
  $37 = $2;
  $38 = $3;
  $39 = $1;
  $40 = (($39) + 12|0);
  FUNCTION_TABLE_viiii[$36 & 31]($coords,$37,$38,$40);
 }
 $41 = $1;
 $42 = (($41) + 12|0);
 $43 = HEAP32[$42>>2]|0;
 $44 = ($43|0)==(0|0);
 if (!($44)) {
  STACKTOP = sp;return;
 }
 $45 = $4;
 $46 = ($45|0)!=(0);
 if ($46) {
  $51 = $0;
  $52 = (($51) + 60|0);
  $53 = HEAP8[$52>>0]|0;
  $54 = ($53<<24>>24)!=(0);
  if (!($54)) {
   $55 = $0;
   $56 = (($55) + 1732|0);
   $57 = HEAP32[$56>>2]|0;
   $58 = ($57|0)!=(20|0);
   if ($58) {
    $59 = $0;
    $60 = (($59) + 1732|0);
    $61 = HEAP32[$60>>2]|0;
    $62 = $0;
    $63 = (($62) + 1896|0);
    $64 = HEAP32[$63>>2]|0;
    FUNCTION_TABLE_vii[$61 & 63](100156,$64);
   } else {
    $65 = $0;
    $66 = (($65) + 12|0);
    $67 = HEAP32[$66>>2]|0;
    FUNCTION_TABLE_vi[$67 & 63](100156);
   }
   $68 = $0;
   $69 = (($68) + 60|0);
   HEAP8[$69>>0] = 1;
  }
 } else {
  $47 = $2;
  $48 = HEAP32[$47>>2]|0;
  $49 = $1;
  $50 = (($49) + 12|0);
  HEAP32[$50>>2] = $48;
 }
 STACKTOP = sp;return;
}
function _FinishRegion($tess,$reg) {
 $tess = $tess|0;
 $reg = $reg|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $f = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $reg;
 $2 = $1;
 $3 = HEAP32[$2>>2]|0;
 $e = $3;
 $4 = $e;
 $5 = (($4) + 20|0);
 $6 = HEAP32[$5>>2]|0;
 $f = $6;
 $7 = $1;
 $8 = (($7) + 12|0);
 $9 = HEAP8[$8>>0]|0;
 $10 = $f;
 $11 = (($10) + 21|0);
 HEAP8[$11>>0] = $9;
 $12 = $e;
 $13 = $f;
 $14 = (($13) + 8|0);
 HEAP32[$14>>2] = $12;
 $15 = $0;
 $16 = $1;
 _DeleteRegion($15,$16);
 STACKTOP = sp;return;
}
function _FixUpperEdge($reg,$newEdge) {
 $reg = $reg|0;
 $newEdge = $newEdge|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $reg;
 $2 = $newEdge;
 $3 = $1;
 $4 = (($3) + 15|0);
 $5 = HEAP8[$4>>0]|0;
 $6 = $5&255;
 $7 = ($6|0)!=(0);
 if (!($7)) {
  ___assert_fail((1288|0),(1256|0),172,(1968|0));
  // unreachable;
 }
 $8 = $1;
 $9 = HEAP32[$8>>2]|0;
 $10 = (___gl_meshDelete($9)|0);
 $11 = ($10|0)!=(0);
 if ($11) {
  $12 = $1;
  $13 = (($12) + 15|0);
  HEAP8[$13>>0] = 0;
  $14 = $2;
  $15 = $1;
  HEAP32[$15>>2] = $14;
  $16 = $1;
  $17 = $2;
  $18 = (($17) + 24|0);
  HEAP32[$18>>2] = $16;
  $0 = 1;
  $19 = $0;
  STACKTOP = sp;return ($19|0);
 } else {
  $0 = 0;
  $19 = $0;
  STACKTOP = sp;return ($19|0);
 }
 return 0|0;
}
function _ConnectLeftDegenerate($tess,$regUp,$vEvent) {
 $tess = $tess|0;
 $regUp = $regUp|0;
 $vEvent = $vEvent|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0.0, $19 = 0, $2 = 0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0.0, $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0, $43 = 0.0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $8 = 0, $9 = 0.0, $e = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $regUp;
 $2 = $vEvent;
 $3 = $1;
 $4 = HEAP32[$3>>2]|0;
 $e = $4;
 $5 = $e;
 $6 = (($5) + 16|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($7) + 28|0);
 $9 = +HEAPF32[$8>>2];
 $10 = $2;
 $11 = (($10) + 28|0);
 $12 = +HEAPF32[$11>>2];
 $13 = $9 == $12;
 if ($13) {
  $14 = $e;
  $15 = (($14) + 16|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = (($16) + 32|0);
  $18 = +HEAPF32[$17>>2];
  $19 = $2;
  $20 = (($19) + 32|0);
  $21 = +HEAPF32[$20>>2];
  $22 = $18 == $21;
  if ($22) {
   ___assert_fail((1984|0),(1256|0),1190,(2008|0));
   // unreachable;
  }
 }
 $23 = $e;
 $24 = (($23) + 4|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = (($25) + 16|0);
 $27 = HEAP32[$26>>2]|0;
 $28 = (($27) + 28|0);
 $29 = +HEAPF32[$28>>2];
 $30 = $2;
 $31 = (($30) + 28|0);
 $32 = +HEAPF32[$31>>2];
 $33 = $29 == $32;
 if ($33) {
  $34 = $e;
  $35 = (($34) + 4|0);
  $36 = HEAP32[$35>>2]|0;
  $37 = (($36) + 16|0);
  $38 = HEAP32[$37>>2]|0;
  $39 = (($38) + 32|0);
  $40 = +HEAPF32[$39>>2];
  $41 = $2;
  $42 = (($41) + 32|0);
  $43 = +HEAPF32[$42>>2];
  $44 = $40 == $43;
  if ($44) {
   ___assert_fail((1984|0),(1256|0),1222,(2008|0));
   // unreachable;
  }
 }
 $45 = $e;
 $46 = (($45) + 4|0);
 $47 = HEAP32[$46>>2]|0;
 $48 = (___gl_meshSplitEdge($47)|0);
 $49 = ($48|0)==(0|0);
 if ($49) {
  $50 = $0;
  $51 = (($50) + 1740|0);
  _longjmp(($51|0),1);
  // unreachable;
 }
 $52 = $1;
 $53 = (($52) + 15|0);
 $54 = HEAP8[$53>>0]|0;
 $55 = ($54<<24>>24)!=(0);
 do {
  if ($55) {
   $56 = $e;
   $57 = (($56) + 8|0);
   $58 = HEAP32[$57>>2]|0;
   $59 = (___gl_meshDelete($58)|0);
   $60 = ($59|0)!=(0);
   if ($60) {
    $63 = $1;
    $64 = (($63) + 15|0);
    HEAP8[$64>>0] = 0;
    break;
   } else {
    $61 = $0;
    $62 = (($61) + 1740|0);
    _longjmp(($62|0),1);
    // unreachable;
   }
  }
 } while(0);
 $65 = $2;
 $66 = (($65) + 8|0);
 $67 = HEAP32[$66>>2]|0;
 $68 = $e;
 $69 = (___gl_meshSplice($67,$68)|0);
 $70 = ($69|0)!=(0);
 if ($70) {
  $73 = $0;
  $74 = $2;
  _SweepEvent($73,$74);
  STACKTOP = sp;return;
 } else {
  $71 = $0;
  $72 = (($71) + 1740|0);
  _longjmp(($72|0),1);
  // unreachable;
 }
}
function _ComputeWinding($tess,$reg) {
 $tess = $tess|0;
 $reg = $reg|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $reg;
 $2 = $1;
 $3 = (($2) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = HEAP32[$6>>2]|0;
 $8 = (($7) + 8|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = $1;
 $11 = HEAP32[$10>>2]|0;
 $12 = (($11) + 28|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = (($9) + ($13))|0;
 $15 = $1;
 $16 = (($15) + 8|0);
 HEAP32[$16>>2] = $14;
 $17 = $0;
 $18 = $1;
 $19 = (($18) + 8|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = (_IsWindingInside($17,$20)|0);
 $22 = $1;
 $23 = (($22) + 12|0);
 HEAP8[$23>>0] = $21;
 STACKTOP = sp;return;
}
function _EdgeLeq($tess,$reg1,$reg2) {
 $tess = $tess|0;
 $reg1 = $reg1|0;
 $reg2 = $reg2|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0.0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0.0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0.0, $137 = 0.0, $138 = 0.0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0.0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0.0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0.0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0.0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0.0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $e1 = 0, $e2 = 0, $event = 0, $t1 = 0.0, $t2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $tess;
 $2 = $reg1;
 $3 = $reg2;
 $4 = $1;
 $5 = (($4) + 72|0);
 $6 = HEAP32[$5>>2]|0;
 $event = $6;
 $7 = $2;
 $8 = HEAP32[$7>>2]|0;
 $e1 = $8;
 $9 = $3;
 $10 = HEAP32[$9>>2]|0;
 $e2 = $10;
 $11 = $e1;
 $12 = (($11) + 4|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = (($13) + 16|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = $event;
 $17 = ($15|0)==($16|0);
 if (!($17)) {
  $98 = $e2;
  $99 = (($98) + 4|0);
  $100 = HEAP32[$99>>2]|0;
  $101 = (($100) + 16|0);
  $102 = HEAP32[$101>>2]|0;
  $103 = $event;
  $104 = ($102|0)==($103|0);
  if ($104) {
   $105 = $e1;
   $106 = (($105) + 4|0);
   $107 = HEAP32[$106>>2]|0;
   $108 = (($107) + 16|0);
   $109 = HEAP32[$108>>2]|0;
   $110 = $event;
   $111 = $e1;
   $112 = (($111) + 16|0);
   $113 = HEAP32[$112>>2]|0;
   $114 = (+___gl_edgeSign($109,$110,$113));
   $115 = $114 >= 0.0;
   $116 = $115&1;
   $0 = $116;
   $141 = $0;
   STACKTOP = sp;return ($141|0);
  } else {
   $117 = $e1;
   $118 = (($117) + 4|0);
   $119 = HEAP32[$118>>2]|0;
   $120 = (($119) + 16|0);
   $121 = HEAP32[$120>>2]|0;
   $122 = $event;
   $123 = $e1;
   $124 = (($123) + 16|0);
   $125 = HEAP32[$124>>2]|0;
   $126 = (+___gl_edgeEval($121,$122,$125));
   $t1 = $126;
   $127 = $e2;
   $128 = (($127) + 4|0);
   $129 = HEAP32[$128>>2]|0;
   $130 = (($129) + 16|0);
   $131 = HEAP32[$130>>2]|0;
   $132 = $event;
   $133 = $e2;
   $134 = (($133) + 16|0);
   $135 = HEAP32[$134>>2]|0;
   $136 = (+___gl_edgeEval($131,$132,$135));
   $t2 = $136;
   $137 = $t1;
   $138 = $t2;
   $139 = $137 >= $138;
   $140 = $139&1;
   $0 = $140;
   $141 = $0;
   STACKTOP = sp;return ($141|0);
  }
 }
 $18 = $e2;
 $19 = (($18) + 4|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = (($20) + 16|0);
 $22 = HEAP32[$21>>2]|0;
 $23 = $event;
 $24 = ($22|0)==($23|0);
 if (!($24)) {
  $86 = $e2;
  $87 = (($86) + 4|0);
  $88 = HEAP32[$87>>2]|0;
  $89 = (($88) + 16|0);
  $90 = HEAP32[$89>>2]|0;
  $91 = $event;
  $92 = $e2;
  $93 = (($92) + 16|0);
  $94 = HEAP32[$93>>2]|0;
  $95 = (+___gl_edgeSign($90,$91,$94));
  $96 = $95 <= 0.0;
  $97 = $96&1;
  $0 = $97;
  $141 = $0;
  STACKTOP = sp;return ($141|0);
 }
 $25 = $e1;
 $26 = (($25) + 16|0);
 $27 = HEAP32[$26>>2]|0;
 $28 = (($27) + 28|0);
 $29 = +HEAPF32[$28>>2];
 $30 = $e2;
 $31 = (($30) + 16|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = (($32) + 28|0);
 $34 = +HEAPF32[$33>>2];
 $35 = $29 < $34;
 do {
  if (!($35)) {
   $36 = $e1;
   $37 = (($36) + 16|0);
   $38 = HEAP32[$37>>2]|0;
   $39 = (($38) + 28|0);
   $40 = +HEAPF32[$39>>2];
   $41 = $e2;
   $42 = (($41) + 16|0);
   $43 = HEAP32[$42>>2]|0;
   $44 = (($43) + 28|0);
   $45 = +HEAPF32[$44>>2];
   $46 = $40 == $45;
   if ($46) {
    $47 = $e1;
    $48 = (($47) + 16|0);
    $49 = HEAP32[$48>>2]|0;
    $50 = (($49) + 32|0);
    $51 = +HEAPF32[$50>>2];
    $52 = $e2;
    $53 = (($52) + 16|0);
    $54 = HEAP32[$53>>2]|0;
    $55 = (($54) + 32|0);
    $56 = +HEAPF32[$55>>2];
    $57 = $51 <= $56;
    if ($57) {
     break;
    }
   }
   $72 = $e1;
   $73 = (($72) + 4|0);
   $74 = HEAP32[$73>>2]|0;
   $75 = (($74) + 16|0);
   $76 = HEAP32[$75>>2]|0;
   $77 = $e2;
   $78 = (($77) + 16|0);
   $79 = HEAP32[$78>>2]|0;
   $80 = $e1;
   $81 = (($80) + 16|0);
   $82 = HEAP32[$81>>2]|0;
   $83 = (+___gl_edgeSign($76,$79,$82));
   $84 = $83 >= 0.0;
   $85 = $84&1;
   $0 = $85;
   $141 = $0;
   STACKTOP = sp;return ($141|0);
  }
 } while(0);
 $58 = $e2;
 $59 = (($58) + 4|0);
 $60 = HEAP32[$59>>2]|0;
 $61 = (($60) + 16|0);
 $62 = HEAP32[$61>>2]|0;
 $63 = $e1;
 $64 = (($63) + 16|0);
 $65 = HEAP32[$64>>2]|0;
 $66 = $e2;
 $67 = (($66) + 16|0);
 $68 = HEAP32[$67>>2]|0;
 $69 = (+___gl_edgeSign($62,$65,$68));
 $70 = $69 <= 0.0;
 $71 = $70&1;
 $0 = $71;
 $141 = $0;
 STACKTOP = sp;return ($141|0);
}
function _AddSentinel($tess,$t) {
 $tess = $tess|0;
 $t = +$t;
 var $0 = 0, $1 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0.0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $8 = 0, $9 = 0, $e = 0, $reg = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $t;
 $2 = (_malloc(16)|0);
 $reg = $2;
 $3 = $reg;
 $4 = ($3|0)==(0|0);
 if ($4) {
  $5 = $0;
  $6 = (($5) + 1740|0);
  _longjmp(($6|0),1);
  // unreachable;
 }
 $7 = $0;
 $8 = (($7) + 8|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = (___gl_meshMakeEdge($9)|0);
 $e = $10;
 $11 = $e;
 $12 = ($11|0)==(0|0);
 if ($12) {
  $13 = $0;
  $14 = (($13) + 1740|0);
  _longjmp(($14|0),1);
  // unreachable;
 }
 $15 = $e;
 $16 = (($15) + 16|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = (($17) + 28|0);
 HEAPF32[$18>>2] = 3.999999973526325E+37;
 $19 = $1;
 $20 = $e;
 $21 = (($20) + 16|0);
 $22 = HEAP32[$21>>2]|0;
 $23 = (($22) + 32|0);
 HEAPF32[$23>>2] = $19;
 $24 = $e;
 $25 = (($24) + 4|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = (($26) + 16|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = (($28) + 28|0);
 HEAPF32[$29>>2] = -3.999999973526325E+37;
 $30 = $1;
 $31 = $e;
 $32 = (($31) + 4|0);
 $33 = HEAP32[$32>>2]|0;
 $34 = (($33) + 16|0);
 $35 = HEAP32[$34>>2]|0;
 $36 = (($35) + 32|0);
 HEAPF32[$36>>2] = $30;
 $37 = $e;
 $38 = (($37) + 4|0);
 $39 = HEAP32[$38>>2]|0;
 $40 = (($39) + 16|0);
 $41 = HEAP32[$40>>2]|0;
 $42 = $0;
 $43 = (($42) + 72|0);
 HEAP32[$43>>2] = $41;
 $44 = $e;
 $45 = $reg;
 HEAP32[$45>>2] = $44;
 $46 = $reg;
 $47 = (($46) + 8|0);
 HEAP32[$47>>2] = 0;
 $48 = $reg;
 $49 = (($48) + 12|0);
 HEAP8[$49>>0] = 0;
 $50 = $reg;
 $51 = (($50) + 15|0);
 HEAP8[$51>>0] = 0;
 $52 = $reg;
 $53 = (($52) + 13|0);
 HEAP8[$53>>0] = 1;
 $54 = $reg;
 $55 = (($54) + 14|0);
 HEAP8[$55>>0] = 0;
 $56 = $0;
 $57 = (($56) + 64|0);
 $58 = HEAP32[$57>>2]|0;
 $59 = $0;
 $60 = (($59) + 64|0);
 $61 = HEAP32[$60>>2]|0;
 $62 = $reg;
 $63 = (___gl_dictListInsertBefore($58,$61,$62)|0);
 $64 = $reg;
 $65 = (($64) + 4|0);
 HEAP32[$65>>2] = $63;
 $66 = $reg;
 $67 = (($66) + 4|0);
 $68 = HEAP32[$67>>2]|0;
 $69 = ($68|0)==(0|0);
 if ($69) {
  $70 = $0;
  $71 = (($70) + 1740|0);
  _longjmp(($71|0),1);
  // unreachable;
 } else {
  STACKTOP = sp;return;
 }
}
function ___gl_noBeginData($type,$polygonData) {
 $type = $type|0;
 $polygonData = $polygonData|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $type;
 $1 = $polygonData;
 STACKTOP = sp;return;
}
function ___gl_noEdgeFlagData($boundaryEdge,$polygonData) {
 $boundaryEdge = $boundaryEdge|0;
 $polygonData = $polygonData|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $boundaryEdge;
 $1 = $polygonData;
 STACKTOP = sp;return;
}
function ___gl_noVertexData($data,$polygonData) {
 $data = $data|0;
 $polygonData = $polygonData|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $data;
 $1 = $polygonData;
 STACKTOP = sp;return;
}
function ___gl_noEndData($polygonData) {
 $polygonData = $polygonData|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $polygonData;
 STACKTOP = sp;return;
}
function ___gl_noErrorData($errnum,$polygonData) {
 $errnum = $errnum|0;
 $polygonData = $polygonData|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $errnum;
 $1 = $polygonData;
 STACKTOP = sp;return;
}
function ___gl_noCombineData($coords,$data,$weight,$outData,$polygonData) {
 $coords = $coords|0;
 $data = $data|0;
 $weight = $weight|0;
 $outData = $outData|0;
 $polygonData = $polygonData|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $coords;
 $1 = $data;
 $2 = $weight;
 $3 = $outData;
 $4 = $polygonData;
 STACKTOP = sp;return;
}
function _gluNewTess() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $tess = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = (___gl_memInit(64)|0);
 $2 = ($1|0)==(0);
 if ($2) {
  $0 = 0;
  $52 = $0;
  STACKTOP = sp;return ($52|0);
 }
 $3 = (_malloc(1900)|0);
 $tess = $3;
 $4 = $tess;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $0 = 0;
  $52 = $0;
  STACKTOP = sp;return ($52|0);
 } else {
  $6 = $tess;
  HEAP32[$6>>2] = 0;
  $7 = $tess;
  $8 = (($7) + 16|0);
  HEAPF32[$8>>2] = 0.0;
  $9 = $tess;
  $10 = (($9) + 16|0);
  $11 = (($10) + 4|0);
  HEAPF32[$11>>2] = 0.0;
  $12 = $tess;
  $13 = (($12) + 16|0);
  $14 = (($13) + 8|0);
  HEAPF32[$14>>2] = 0.0;
  $15 = $tess;
  $16 = (($15) + 52|0);
  HEAPF32[$16>>2] = 0.0;
  $17 = $tess;
  $18 = (($17) + 56|0);
  HEAP32[$18>>2] = 100130;
  $19 = $tess;
  $20 = (($19) + 80|0);
  HEAP8[$20>>0] = 0;
  $21 = $tess;
  $22 = (($21) + 81|0);
  HEAP8[$22>>0] = 0;
  $23 = $tess;
  $24 = (($23) + 88|0);
  HEAP32[$24>>2] = 21;
  $25 = $tess;
  $26 = (($25) + 92|0);
  HEAP32[$26>>2] = 22;
  $27 = $tess;
  $28 = (($27) + 96|0);
  HEAP32[$28>>2] = 23;
  $29 = $tess;
  $30 = (($29) + 100|0);
  HEAP32[$30>>2] = 24;
  $31 = $tess;
  $32 = (($31) + 12|0);
  HEAP32[$32>>2] = 25;
  $33 = $tess;
  $34 = (($33) + 76|0);
  HEAP32[$34>>2] = 26;
  $35 = $tess;
  $36 = (($35) + 104|0);
  HEAP32[$36>>2] = 27;
  $37 = $tess;
  $38 = (($37) + 1716|0);
  HEAP32[$38>>2] = 13;
  $39 = $tess;
  $40 = (($39) + 1720|0);
  HEAP32[$40>>2] = 14;
  $41 = $tess;
  $42 = (($41) + 1724|0);
  HEAP32[$42>>2] = 15;
  $43 = $tess;
  $44 = (($43) + 1728|0);
  HEAP32[$44>>2] = 16;
  $45 = $tess;
  $46 = (($45) + 1732|0);
  HEAP32[$46>>2] = 20;
  $47 = $tess;
  $48 = (($47) + 1736|0);
  HEAP32[$48>>2] = 19;
  $49 = $tess;
  $50 = (($49) + 1896|0);
  HEAP32[$50>>2] = 0;
  $51 = $tess;
  $0 = $51;
  $52 = $0;
  STACKTOP = sp;return ($52|0);
 }
 return 0|0;
}
function _noBegin($type) {
 $type = $type|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $type;
 STACKTOP = sp;return;
}
function _noEdgeFlag($boundaryEdge) {
 $boundaryEdge = $boundaryEdge|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $boundaryEdge;
 STACKTOP = sp;return;
}
function _noVertex($data) {
 $data = $data|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $data;
 STACKTOP = sp;return;
}
function _noEnd() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = sp;return;
}
function _noError($errnum) {
 $errnum = $errnum|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $errnum;
 STACKTOP = sp;return;
}
function _noCombine($coords,$data,$weight,$dataOut) {
 $coords = $coords|0;
 $data = $data|0;
 $weight = $weight|0;
 $dataOut = $dataOut|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $coords;
 $1 = $data;
 $2 = $weight;
 $3 = $dataOut;
 STACKTOP = sp;return;
}
function _noMesh($mesh) {
 $mesh = $mesh|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $mesh;
 STACKTOP = sp;return;
}
function _gluDeleteTess($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)!=(0);
 if ($3) {
  $4 = $0;
  _GotoState($4,0);
 }
 $5 = $0;
 _free($5);
 STACKTOP = sp;return;
}
function _GotoState($tess,$newState) {
 $tess = $tess|0;
 $newState = $newState|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $newState;
 while(1) {
  $2 = $0;
  $3 = HEAP32[$2>>2]|0;
  $4 = $1;
  $5 = ($3|0)!=($4|0);
  if (!($5)) {
   break;
  }
  $6 = $0;
  $7 = HEAP32[$6>>2]|0;
  $8 = $1;
  $9 = ($7>>>0)<($8>>>0);
  if ($9) {
   $10 = $0;
   $11 = HEAP32[$10>>2]|0;
   if ((($11|0) == 1)) {
    $26 = $0;
    $27 = (($26) + 1732|0);
    $28 = HEAP32[$27>>2]|0;
    $29 = ($28|0)!=(20|0);
    if ($29) {
     $30 = $0;
     $31 = (($30) + 1732|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = $0;
     $34 = (($33) + 1896|0);
     $35 = HEAP32[$34>>2]|0;
     FUNCTION_TABLE_vii[$32 & 63](100152,$35);
    } else {
     $36 = $0;
     $37 = (($36) + 12|0);
     $38 = HEAP32[$37>>2]|0;
     FUNCTION_TABLE_vi[$38 & 63](100152);
    }
    $39 = $0;
    _gluTessBeginContour($39);
   } else if ((($11|0) == 0)) {
    $12 = $0;
    $13 = (($12) + 1732|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($14|0)!=(20|0);
    if ($15) {
     $16 = $0;
     $17 = (($16) + 1732|0);
     $18 = HEAP32[$17>>2]|0;
     $19 = $0;
     $20 = (($19) + 1896|0);
     $21 = HEAP32[$20>>2]|0;
     FUNCTION_TABLE_vii[$18 & 63](100151,$21);
    } else {
     $22 = $0;
     $23 = (($22) + 12|0);
     $24 = HEAP32[$23>>2]|0;
     FUNCTION_TABLE_vi[$24 & 63](100151);
    }
    $25 = $0;
    _gluTessBeginPolygon($25,0);
   } else {
   }
  } else {
   $40 = $0;
   $41 = HEAP32[$40>>2]|0;
   if ((($41|0) == 2)) {
    $42 = $0;
    $43 = (($42) + 1732|0);
    $44 = HEAP32[$43>>2]|0;
    $45 = ($44|0)!=(20|0);
    if ($45) {
     $46 = $0;
     $47 = (($46) + 1732|0);
     $48 = HEAP32[$47>>2]|0;
     $49 = $0;
     $50 = (($49) + 1896|0);
     $51 = HEAP32[$50>>2]|0;
     FUNCTION_TABLE_vii[$48 & 63](100154,$51);
    } else {
     $52 = $0;
     $53 = (($52) + 12|0);
     $54 = HEAP32[$53>>2]|0;
     FUNCTION_TABLE_vi[$54 & 63](100154);
    }
    $55 = $0;
    _gluTessEndContour($55);
   } else if ((($41|0) == 1)) {
    $56 = $0;
    $57 = (($56) + 1732|0);
    $58 = HEAP32[$57>>2]|0;
    $59 = ($58|0)!=(20|0);
    if ($59) {
     $60 = $0;
     $61 = (($60) + 1732|0);
     $62 = HEAP32[$61>>2]|0;
     $63 = $0;
     $64 = (($63) + 1896|0);
     $65 = HEAP32[$64>>2]|0;
     FUNCTION_TABLE_vii[$62 & 63](100153,$65);
    } else {
     $66 = $0;
     $67 = (($66) + 12|0);
     $68 = HEAP32[$67>>2]|0;
     FUNCTION_TABLE_vi[$68 & 63](100153);
    }
    $69 = $0;
    _MakeDormant($69);
   } else {
   }
  }
 }
 STACKTOP = sp;return;
}
function _gluTessProperty($tess,$which,$value) {
 $tess = $tess|0;
 $which = $which|0;
 $value = +$value;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0.0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0.0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $6 = 0.0, $7 = 0, $8 = 0.0, $9 = 0, $windingRule = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $which;
 $2 = $value;
 $3 = $1;
 L1: do {
  if ((($3|0) == 100141)) {
   $21 = $2;
   $22 = $21 != 0.0;
   $23 = $22&1;
   $24 = $23&255;
   $25 = $0;
   $26 = (($25) + 81|0);
   HEAP8[$26>>0] = $24;
   STACKTOP = sp;return;
  } else if ((($3|0) == 100140)) {
   $11 = $2;
   $12 = (~~(($11))>>>0);
   $windingRule = $12;
   $13 = $windingRule;
   $14 = (+($13>>>0));
   $15 = $2;
   $16 = $14 != $15;
   if ($16) {
    break;
   }
   $17 = $windingRule;
   switch ($17|0) {
   case 100134: case 100133: case 100132: case 100131: case 100130:  {
    $18 = $windingRule;
    $19 = $0;
    $20 = (($19) + 56|0);
    HEAP32[$20>>2] = $18;
    STACKTOP = sp;return;
    break;
   }
   default: {
    break L1;
   }
   }
  } else if ((($3|0) == 100142)) {
   $4 = $2;
   $5 = $4 < 0.0;
   if (!($5)) {
    $6 = $2;
    $7 = $6 > 1.0;
    if (!($7)) {
     $8 = $2;
     $9 = $0;
     $10 = (($9) + 52|0);
     HEAPF32[$10>>2] = $8;
     STACKTOP = sp;return;
    }
   }
  } else {
   $27 = $0;
   $28 = (($27) + 1732|0);
   $29 = HEAP32[$28>>2]|0;
   $30 = ($29|0)!=(20|0);
   if ($30) {
    $31 = $0;
    $32 = (($31) + 1732|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = $0;
    $35 = (($34) + 1896|0);
    $36 = HEAP32[$35>>2]|0;
    FUNCTION_TABLE_vii[$33 & 63](100900,$36);
   } else {
    $37 = $0;
    $38 = (($37) + 12|0);
    $39 = HEAP32[$38>>2]|0;
    FUNCTION_TABLE_vi[$39 & 63](100900);
   }
   STACKTOP = sp;return;
  }
 } while(0);
 $40 = $0;
 $41 = (($40) + 1732|0);
 $42 = HEAP32[$41>>2]|0;
 $43 = ($42|0)!=(20|0);
 if ($43) {
  $44 = $0;
  $45 = (($44) + 1732|0);
  $46 = HEAP32[$45>>2]|0;
  $47 = $0;
  $48 = (($47) + 1896|0);
  $49 = HEAP32[$48>>2]|0;
  FUNCTION_TABLE_vii[$46 & 63](100901,$49);
  STACKTOP = sp;return;
 } else {
  $50 = $0;
  $51 = (($50) + 12|0);
  $52 = HEAP32[$51>>2]|0;
  FUNCTION_TABLE_vi[$52 & 63](100901);
  STACKTOP = sp;return;
 }
}
function _gluTessNormal($tess,$x,$y,$z) {
 $tess = $tess|0;
 $x = +$x;
 $y = +$y;
 $z = +$z;
 var $0 = 0, $1 = 0.0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0, $2 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $x;
 $2 = $y;
 $3 = $z;
 $4 = $1;
 $5 = $0;
 $6 = (($5) + 16|0);
 HEAPF32[$6>>2] = $4;
 $7 = $2;
 $8 = $0;
 $9 = (($8) + 16|0);
 $10 = (($9) + 4|0);
 HEAPF32[$10>>2] = $7;
 $11 = $3;
 $12 = $0;
 $13 = (($12) + 16|0);
 $14 = (($13) + 8|0);
 HEAPF32[$14>>2] = $11;
 STACKTOP = sp;return;
}
function _gluTessCallback($tess,$which,$fn) {
 $tess = $tess|0;
 $which = $which|0;
 $fn = $fn|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $which;
 $2 = $fn;
 $3 = $1;
 do {
  switch ($3|0) {
  case 100101:  {
   $40 = $2;
   $41 = ($40|0)==(0|0);
   if ($41) {
    $45 = 23;
   } else {
    $42 = $2;
    $45 = $42;
   }
   $43 = $0;
   $44 = (($43) + 96|0);
   HEAP32[$44>>2] = $45;
   STACKTOP = sp;return;
   break;
  }
  case 100103:  {
   $64 = $2;
   $65 = ($64|0)==(0|0);
   if ($65) {
    $69 = 25;
   } else {
    $66 = $2;
    $69 = $66;
   }
   $67 = $0;
   $68 = (($67) + 12|0);
   HEAP32[$68>>2] = $69;
   STACKTOP = sp;return;
   break;
  }
  case 100107:  {
   $46 = $2;
   $47 = ($46|0)==(0|0);
   if ($47) {
    $51 = 15;
   } else {
    $48 = $2;
    $51 = $48;
   }
   $49 = $0;
   $50 = (($49) + 1724|0);
   HEAP32[$50>>2] = $51;
   STACKTOP = sp;return;
   break;
  }
  case 100102:  {
   $52 = $2;
   $53 = ($52|0)==(0|0);
   if ($53) {
    $57 = 24;
   } else {
    $54 = $2;
    $57 = $54;
   }
   $55 = $0;
   $56 = (($55) + 100|0);
   HEAP32[$56>>2] = $57;
   STACKTOP = sp;return;
   break;
  }
  case 100111:  {
   $82 = $2;
   $83 = ($82|0)==(0|0);
   if ($83) {
    $87 = 19;
   } else {
    $84 = $2;
    $87 = $84;
   }
   $85 = $0;
   $86 = (($85) + 1736|0);
   HEAP32[$86>>2] = $87;
   STACKTOP = sp;return;
   break;
  }
  case 100105:  {
   $76 = $2;
   $77 = ($76|0)==(0|0);
   if ($77) {
    $81 = 26;
   } else {
    $78 = $2;
    $81 = $78;
   }
   $79 = $0;
   $80 = (($79) + 76|0);
   HEAP32[$80>>2] = $81;
   STACKTOP = sp;return;
   break;
  }
  case 100112:  {
   $88 = $2;
   $89 = ($88|0)==(0|0);
   if ($89) {
    $93 = 27;
   } else {
    $90 = $2;
    $93 = $90;
   }
   $91 = $0;
   $92 = (($91) + 104|0);
   HEAP32[$92>>2] = $93;
   STACKTOP = sp;return;
   break;
  }
  case 100109:  {
   $70 = $2;
   $71 = ($70|0)==(0|0);
   if ($71) {
    $75 = 20;
   } else {
    $72 = $2;
    $75 = $72;
   }
   $73 = $0;
   $74 = (($73) + 1732|0);
   HEAP32[$74>>2] = $75;
   STACKTOP = sp;return;
   break;
  }
  case 100104:  {
   $16 = $2;
   $17 = ($16|0)==(0|0);
   if ($17) {
    $21 = 22;
   } else {
    $18 = $2;
    $21 = $18;
   }
   $19 = $0;
   $20 = (($19) + 92|0);
   HEAP32[$20>>2] = $21;
   $22 = $2;
   $23 = ($22|0)!=(0|0);
   $24 = $23&1;
   $25 = $24&255;
   $26 = $0;
   $27 = (($26) + 80|0);
   HEAP8[$27>>0] = $25;
   STACKTOP = sp;return;
   break;
  }
  case 100108:  {
   $58 = $2;
   $59 = ($58|0)==(0|0);
   if ($59) {
    $63 = 16;
   } else {
    $60 = $2;
    $63 = $60;
   }
   $61 = $0;
   $62 = (($61) + 1728|0);
   HEAP32[$62>>2] = $63;
   STACKTOP = sp;return;
   break;
  }
  case 100110:  {
   $28 = $2;
   $29 = ($28|0)==(0|0);
   if ($29) {
    $33 = 14;
   } else {
    $30 = $2;
    $33 = $30;
   }
   $31 = $0;
   $32 = (($31) + 1720|0);
   HEAP32[$32>>2] = $33;
   $34 = $2;
   $35 = ($34|0)!=(0|0);
   $36 = $35&1;
   $37 = $36&255;
   $38 = $0;
   $39 = (($38) + 80|0);
   HEAP8[$39>>0] = $37;
   STACKTOP = sp;return;
   break;
  }
  case 100106:  {
   $10 = $2;
   $11 = ($10|0)==(0|0);
   if ($11) {
    $15 = 13;
   } else {
    $12 = $2;
    $15 = $12;
   }
   $13 = $0;
   $14 = (($13) + 1716|0);
   HEAP32[$14>>2] = $15;
   STACKTOP = sp;return;
   break;
  }
  case 100100:  {
   $4 = $2;
   $5 = ($4|0)==(0|0);
   if ($5) {
    $9 = 21;
   } else {
    $6 = $2;
    $9 = $6;
   }
   $7 = $0;
   $8 = (($7) + 88|0);
   HEAP32[$8>>2] = $9;
   STACKTOP = sp;return;
   break;
  }
  default: {
   $94 = $0;
   $95 = (($94) + 1732|0);
   $96 = HEAP32[$95>>2]|0;
   $97 = ($96|0)!=(20|0);
   if ($97) {
    $98 = $0;
    $99 = (($98) + 1732|0);
    $100 = HEAP32[$99>>2]|0;
    $101 = $0;
    $102 = (($101) + 1896|0);
    $103 = HEAP32[$102>>2]|0;
    FUNCTION_TABLE_vii[$100 & 63](100900,$103);
   } else {
    $104 = $0;
    $105 = (($104) + 12|0);
    $106 = HEAP32[$105>>2]|0;
    FUNCTION_TABLE_vi[$106 & 63](100900);
   }
   STACKTOP = sp;return;
  }
  }
 } while(0);
}
function _gluTessVertex($tess,$coords,$data) {
 $tess = $tess|0;
 $coords = $coords|0;
 $data = $data|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0.0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0.0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $clamped = 0, $i = 0, $tooLarge = 0, $x = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $clamped = sp + 20|0;
 $0 = $tess;
 $1 = $coords;
 $2 = $data;
 $tooLarge = 0;
 $3 = $0;
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)!=(2);
 if ($5) {
  $6 = $0;
  _GotoState($6,2);
 }
 $7 = $0;
 $8 = (($7) + 108|0);
 $9 = HEAP8[$8>>0]|0;
 $10 = ($9<<24>>24)!=(0);
 do {
  if ($10) {
   $11 = $0;
   $12 = (_EmptyCache($11)|0);
   $13 = ($12|0)!=(0);
   if ($13) {
    $27 = $0;
    $28 = (($27) + 4|0);
    HEAP32[$28>>2] = 0;
    break;
   }
   $14 = $0;
   $15 = (($14) + 1732|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = ($16|0)!=(20|0);
   if ($17) {
    $18 = $0;
    $19 = (($18) + 1732|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = $0;
    $22 = (($21) + 1896|0);
    $23 = HEAP32[$22>>2]|0;
    FUNCTION_TABLE_vii[$20 & 63](100902,$23);
   } else {
    $24 = $0;
    $25 = (($24) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    FUNCTION_TABLE_vi[$26 & 63](100902);
   }
   STACKTOP = sp;return;
  }
 } while(0);
 $i = 0;
 while(1) {
  $29 = $i;
  $30 = ($29|0)<(3);
  if (!($30)) {
   break;
  }
  $31 = $i;
  $32 = $1;
  $33 = (($32) + ($31<<2)|0);
  $34 = +HEAPF32[$33>>2];
  $x = $34;
  $35 = $x;
  $36 = $35 < -9.9999999338158125E+36;
  if ($36) {
   $x = -9.9999999338158125E+36;
   $tooLarge = 1;
  }
  $37 = $x;
  $38 = $37 > 9.9999999338158125E+36;
  if ($38) {
   $x = 9.9999999338158125E+36;
   $tooLarge = 1;
  }
  $39 = $x;
  $40 = $i;
  $41 = (($clamped) + ($40<<2)|0);
  HEAPF32[$41>>2] = $39;
  $42 = $i;
  $43 = (($42) + 1)|0;
  $i = $43;
 }
 $44 = $tooLarge;
 $45 = ($44|0)!=(0);
 if ($45) {
  $46 = $0;
  $47 = (($46) + 1732|0);
  $48 = HEAP32[$47>>2]|0;
  $49 = ($48|0)!=(20|0);
  if ($49) {
   $50 = $0;
   $51 = (($50) + 1732|0);
   $52 = HEAP32[$51>>2]|0;
   $53 = $0;
   $54 = (($53) + 1896|0);
   $55 = HEAP32[$54>>2]|0;
   FUNCTION_TABLE_vii[$52 & 63](100155,$55);
  } else {
   $56 = $0;
   $57 = (($56) + 12|0);
   $58 = HEAP32[$57>>2]|0;
   FUNCTION_TABLE_vi[$58 & 63](100155);
  }
 }
 $59 = $0;
 $60 = (($59) + 8|0);
 $61 = HEAP32[$60>>2]|0;
 $62 = ($61|0)==(0|0);
 do {
  if ($62) {
   $63 = $0;
   $64 = (($63) + 112|0);
   $65 = HEAP32[$64>>2]|0;
   $66 = ($65|0)<(100);
   if ($66) {
    $67 = $0;
    $68 = $2;
    _CacheVertex($67,$clamped,$68);
    STACKTOP = sp;return;
   }
   $69 = $0;
   $70 = (_EmptyCache($69)|0);
   $71 = ($70|0)!=(0);
   if ($71) {
    break;
   }
   $72 = $0;
   $73 = (($72) + 1732|0);
   $74 = HEAP32[$73>>2]|0;
   $75 = ($74|0)!=(20|0);
   if ($75) {
    $76 = $0;
    $77 = (($76) + 1732|0);
    $78 = HEAP32[$77>>2]|0;
    $79 = $0;
    $80 = (($79) + 1896|0);
    $81 = HEAP32[$80>>2]|0;
    FUNCTION_TABLE_vii[$78 & 63](100902,$81);
   } else {
    $82 = $0;
    $83 = (($82) + 12|0);
    $84 = HEAP32[$83>>2]|0;
    FUNCTION_TABLE_vi[$84 & 63](100902);
   }
   STACKTOP = sp;return;
  }
 } while(0);
 $85 = $0;
 $86 = $2;
 $87 = (_AddVertex($85,$clamped,$86)|0);
 $88 = ($87|0)!=(0);
 if ($88) {
  STACKTOP = sp;return;
 }
 $89 = $0;
 $90 = (($89) + 1732|0);
 $91 = HEAP32[$90>>2]|0;
 $92 = ($91|0)!=(20|0);
 if ($92) {
  $93 = $0;
  $94 = (($93) + 1732|0);
  $95 = HEAP32[$94>>2]|0;
  $96 = $0;
  $97 = (($96) + 1896|0);
  $98 = HEAP32[$97>>2]|0;
  FUNCTION_TABLE_vii[$95 & 63](100902,$98);
 } else {
  $99 = $0;
  $100 = (($99) + 12|0);
  $101 = HEAP32[$100>>2]|0;
  FUNCTION_TABLE_vi[$101 & 63](100902);
 }
 STACKTOP = sp;return;
}
function _EmptyCache($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $v = 0, $vLast = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $tess;
 $2 = $1;
 $3 = (($2) + 116|0);
 $v = $3;
 $4 = (___gl_meshNewMesh()|0);
 $5 = $1;
 $6 = (($5) + 8|0);
 HEAP32[$6>>2] = $4;
 $7 = $1;
 $8 = (($7) + 8|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ($9|0)==(0|0);
 if ($10) {
  $0 = 0;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 }
 $11 = $v;
 $12 = $1;
 $13 = (($12) + 112|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = (($11) + ($14<<4)|0);
 $vLast = $15;
 while(1) {
  $16 = $v;
  $17 = $vLast;
  $18 = ($16>>>0)<($17>>>0);
  if (!($18)) {
   label = 9;
   break;
  }
  $19 = $1;
  $20 = $v;
  $21 = $v;
  $22 = (($21) + 12|0);
  $23 = HEAP32[$22>>2]|0;
  $24 = (_AddVertex($19,$20,$23)|0);
  $25 = ($24|0)!=(0);
  if (!($25)) {
   label = 6;
   break;
  }
  $26 = $v;
  $27 = (($26) + 16|0);
  $v = $27;
 }
 if ((label|0) == 6) {
  $0 = 0;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 }
 else if ((label|0) == 9) {
  $28 = $1;
  $29 = (($28) + 112|0);
  HEAP32[$29>>2] = 0;
  $30 = $1;
  $31 = (($30) + 108|0);
  HEAP8[$31>>0] = 0;
  $0 = 1;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 }
 return 0|0;
}
function _CacheVertex($tess,$coords,$data) {
 $tess = $tess|0;
 $coords = $coords|0;
 $data = $data|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $coords;
 $2 = $data;
 $3 = $0;
 $4 = (($3) + 112|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $0;
 $7 = (($6) + 116|0);
 $8 = (($7) + ($5<<4)|0);
 $v = $8;
 $9 = $2;
 $10 = $v;
 $11 = (($10) + 12|0);
 HEAP32[$11>>2] = $9;
 $12 = $1;
 $13 = +HEAPF32[$12>>2];
 $14 = $v;
 HEAPF32[$14>>2] = $13;
 $15 = $1;
 $16 = (($15) + 4|0);
 $17 = +HEAPF32[$16>>2];
 $18 = $v;
 $19 = (($18) + 4|0);
 HEAPF32[$19>>2] = $17;
 $20 = $1;
 $21 = (($20) + 8|0);
 $22 = +HEAPF32[$21>>2];
 $23 = $v;
 $24 = (($23) + 8|0);
 HEAPF32[$24>>2] = $22;
 $25 = $0;
 $26 = (($25) + 112|0);
 $27 = HEAP32[$26>>2]|0;
 $28 = (($27) + 1)|0;
 HEAP32[$26>>2] = $28;
 STACKTOP = sp;return;
}
function _AddVertex($tess,$coords,$data) {
 $tess = $tess|0;
 $coords = $coords|0;
 $data = $data|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $tess;
 $2 = $coords;
 $3 = $data;
 $e = 0;
 $4 = $1;
 $5 = (($4) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $e = $6;
 $7 = $e;
 $8 = ($7|0)==(0|0);
 do {
  if ($8) {
   $9 = $1;
   $10 = (($9) + 8|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = (___gl_meshMakeEdge($11)|0);
   $e = $12;
   $13 = $e;
   $14 = ($13|0)==(0|0);
   if ($14) {
    $0 = 0;
    $63 = $0;
    STACKTOP = sp;return ($63|0);
   }
   $15 = $e;
   $16 = $e;
   $17 = (($16) + 4|0);
   $18 = HEAP32[$17>>2]|0;
   $19 = (___gl_meshSplice($15,$18)|0);
   $20 = ($19|0)!=(0);
   if ($20) {
    break;
   }
   $0 = 0;
   $63 = $0;
   STACKTOP = sp;return ($63|0);
  } else {
   $21 = $e;
   $22 = (___gl_meshSplitEdge($21)|0);
   $23 = ($22|0)==(0|0);
   if (!($23)) {
    $24 = $e;
    $25 = (($24) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    $e = $26;
    break;
   }
   $0 = 0;
   $63 = $0;
   STACKTOP = sp;return ($63|0);
  }
 } while(0);
 $27 = $3;
 $28 = $e;
 $29 = (($28) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = (($30) + 12|0);
 HEAP32[$31>>2] = $27;
 $32 = $2;
 $33 = +HEAPF32[$32>>2];
 $34 = $e;
 $35 = (($34) + 16|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = (($36) + 16|0);
 HEAPF32[$37>>2] = $33;
 $38 = $2;
 $39 = (($38) + 4|0);
 $40 = +HEAPF32[$39>>2];
 $41 = $e;
 $42 = (($41) + 16|0);
 $43 = HEAP32[$42>>2]|0;
 $44 = (($43) + 16|0);
 $45 = (($44) + 4|0);
 HEAPF32[$45>>2] = $40;
 $46 = $2;
 $47 = (($46) + 8|0);
 $48 = +HEAPF32[$47>>2];
 $49 = $e;
 $50 = (($49) + 16|0);
 $51 = HEAP32[$50>>2]|0;
 $52 = (($51) + 16|0);
 $53 = (($52) + 8|0);
 HEAPF32[$53>>2] = $48;
 $54 = $e;
 $55 = (($54) + 28|0);
 HEAP32[$55>>2] = 1;
 $56 = $e;
 $57 = (($56) + 4|0);
 $58 = HEAP32[$57>>2]|0;
 $59 = (($58) + 28|0);
 HEAP32[$59>>2] = -1;
 $60 = $e;
 $61 = $1;
 $62 = (($61) + 4|0);
 HEAP32[$62>>2] = $60;
 $0 = 1;
 $63 = $0;
 STACKTOP = sp;return ($63|0);
}
function _gluTessBeginPolygon($tess,$data) {
 $tess = $tess|0;
 $data = $data|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $data;
 $2 = $0;
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)!=(0);
 if ($4) {
  $5 = $0;
  _GotoState($5,0);
 }
 $6 = $0;
 HEAP32[$6>>2] = 1;
 $7 = $0;
 $8 = (($7) + 112|0);
 HEAP32[$8>>2] = 0;
 $9 = $0;
 $10 = (($9) + 108|0);
 HEAP8[$10>>0] = 0;
 $11 = $0;
 $12 = (($11) + 8|0);
 HEAP32[$12>>2] = 0;
 $13 = $1;
 $14 = $0;
 $15 = (($14) + 1896|0);
 HEAP32[$15>>2] = $13;
 STACKTOP = sp;return;
}
function _gluTessBeginContour($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)!=(1);
 if ($3) {
  $4 = $0;
  _GotoState($4,1);
 }
 $5 = $0;
 HEAP32[$5>>2] = 2;
 $6 = $0;
 $7 = (($6) + 4|0);
 HEAP32[$7>>2] = 0;
 $8 = $0;
 $9 = (($8) + 112|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ($10|0)>(0);
 if (!($11)) {
  STACKTOP = sp;return;
 }
 $12 = $0;
 $13 = (($12) + 108|0);
 HEAP8[$13>>0] = 1;
 STACKTOP = sp;return;
}
function _gluTessEndContour($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)!=(2);
 if ($3) {
  $4 = $0;
  _GotoState($4,2);
 }
 $5 = $0;
 HEAP32[$5>>2] = 1;
 STACKTOP = sp;return;
}
function _gluTessEndPolygon($tess) {
 $tess = $tess|0;
 var $$reg2mem64$0 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0;
 var $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0;
 var $133 = 0, $134 = 0, $135 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $rc$0 = 0, _setjmpTable = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 _setjmpTable = STACKTOP; STACKTOP = STACKTOP + 168|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();HEAP32[_setjmpTable>>2]=0;
 $0 = (($tess) + 1740|0);
 _saveSetjmp($0,1,_setjmpTable|0)|0;
 __THREW__ = 0;
 $1 = __THREW__; __THREW__ = 0;
 if ((($1|0) != 0) & ((threwValue|0) != 0)) { $2 = _testSetjmp(HEAP32[$1>>2]|0, _setjmpTable)|0; if (($2|0) == 0) { _longjmp($1|0, threwValue|0); } tempRet0 = threwValue; } else { $2 = -1; };
 $3 = tempRet0;
 if ((($2|0) == 1)) {
  $$reg2mem64$0 = $3;
 } else {
  $$reg2mem64$0 = 0;
 }
 L3: while(1) {
  $4 = ($$reg2mem64$0|0)!=(0);
  if ($4) {
   $5 = (($tess) + 1732|0);
   $6 = HEAP32[$5>>2]|0;
   $7 = ($6|0)!=(20|0);
   if ($7) {
    $8 = (($tess) + 1732|0);
    $9 = HEAP32[$8>>2]|0;
    $10 = (($tess) + 1896|0);
    $11 = HEAP32[$10>>2]|0;
    __THREW__ = 0;
    invoke_vii($9|0,100902,($11|0));
    $12 = __THREW__; __THREW__ = 0;
    if ((($12|0) != 0) & ((threwValue|0) != 0)) { $13 = _testSetjmp(HEAP32[$12>>2]|0, _setjmpTable)|0; if (($13|0) == 0) { _longjmp($12|0, threwValue|0); } tempRet0 = threwValue; } else { $13 = -1; };
    $14 = tempRet0;
    if ((($13|0) == 1)) {
     $$reg2mem64$0 = $14;
     continue;
    } else {
     label = 6;
     break;
    }
   } else {
    $15 = (($tess) + 12|0);
    $16 = HEAP32[$15>>2]|0;
    __THREW__ = 0;
    invoke_vi($16|0,100902);
    $17 = __THREW__; __THREW__ = 0;
    if ((($17|0) != 0) & ((threwValue|0) != 0)) { $18 = _testSetjmp(HEAP32[$17>>2]|0, _setjmpTable)|0; if (($18|0) == 0) { _longjmp($17|0, threwValue|0); } tempRet0 = threwValue; } else { $18 = -1; };
    $19 = tempRet0;
    if ((($18|0) == 1)) {
     $$reg2mem64$0 = $19;
     continue;
    } else {
     label = 8;
     break;
    }
   }
  }
  $20 = HEAP32[$tess>>2]|0;
  $21 = ($20|0)!=(1);
  if ($21) {
   __THREW__ = 0;
   invoke_vii(28,($tess|0),1);
   $22 = __THREW__; __THREW__ = 0;
   if ((($22|0) != 0) & ((threwValue|0) != 0)) { $23 = _testSetjmp(HEAP32[$22>>2]|0, _setjmpTable)|0; if (($23|0) == 0) { _longjmp($22|0, threwValue|0); } tempRet0 = threwValue; } else { $23 = -1; };
   $24 = tempRet0;
   if ((($23|0) == 1)) {
    $$reg2mem64$0 = $24;
    continue;
   }
  }
  HEAP32[$tess>>2] = 0;
  $25 = (($tess) + 8|0);
  $26 = HEAP32[$25>>2]|0;
  $27 = ($26|0)==(0|0);
  do {
   if ($27) {
    $28 = (($tess) + 80|0);
    $29 = HEAP8[$28>>0]|0;
    $30 = ($29<<24>>24)!=(0);
    if (!($30)) {
     $31 = (($tess) + 104|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = ($32|0)==(27|0);
     if ($33) {
      __THREW__ = 0;
      $34 = (invoke_ii(29,($tess|0))|0);
      $35 = __THREW__; __THREW__ = 0;
      if ((($35|0) != 0) & ((threwValue|0) != 0)) { $36 = _testSetjmp(HEAP32[$35>>2]|0, _setjmpTable)|0; if (($36|0) == 0) { _longjmp($35|0, threwValue|0); } tempRet0 = threwValue; } else { $36 = -1; };
      $37 = tempRet0;
      if ((($36|0) == 1)) {
       $$reg2mem64$0 = $37;
       continue L3;
      }
      $38 = ($34<<24>>24)!=(0);
      if ($38) {
       label = 18;
       break L3;
      }
     }
    }
    __THREW__ = 0;
    $40 = (invoke_ii(30,($tess|0))|0);
    $41 = __THREW__; __THREW__ = 0;
    if ((($41|0) != 0) & ((threwValue|0) != 0)) { $42 = _testSetjmp(HEAP32[$41>>2]|0, _setjmpTable)|0; if (($42|0) == 0) { _longjmp($41|0, threwValue|0); } tempRet0 = threwValue; } else { $42 = -1; };
    $43 = tempRet0;
    if ((($42|0) == 1)) {
     $$reg2mem64$0 = $43;
     continue L3;
    }
    $44 = ($40|0)!=(0);
    if ($44) {
     break;
    } else {
     $45 = (($tess) + 1740|0);
     __THREW__ = 0;
     invoke_vii(31,($45|0),1);
     $46 = __THREW__; __THREW__ = 0;
     if ((($46|0) != 0) & ((threwValue|0) != 0)) { $47 = _testSetjmp(HEAP32[$46>>2]|0, _setjmpTable)|0; if (($47|0) == 0) { _longjmp($46|0, threwValue|0); } tempRet0 = threwValue; } else { $47 = -1; };
     $48 = tempRet0;
     if ((($47|0) == 1)) {
      $$reg2mem64$0 = $48;
      continue L3;
     } else {
      label = 23;
      break L3;
     }
    }
   }
  } while(0);
  __THREW__ = 0;
  invoke_vi(32,($tess|0));
  $49 = __THREW__; __THREW__ = 0;
  if ((($49|0) != 0) & ((threwValue|0) != 0)) { $50 = _testSetjmp(HEAP32[$49>>2]|0, _setjmpTable)|0; if (($50|0) == 0) { _longjmp($49|0, threwValue|0); } tempRet0 = threwValue; } else { $50 = -1; };
  $51 = tempRet0;
  if ((($50|0) == 1)) {
   $$reg2mem64$0 = $51;
   continue;
  }
  __THREW__ = 0;
  $52 = (invoke_ii(33,($tess|0))|0);
  $53 = __THREW__; __THREW__ = 0;
  if ((($53|0) != 0) & ((threwValue|0) != 0)) { $54 = _testSetjmp(HEAP32[$53>>2]|0, _setjmpTable)|0; if (($54|0) == 0) { _longjmp($53|0, threwValue|0); } tempRet0 = threwValue; } else { $54 = -1; };
  $55 = tempRet0;
  if ((($54|0) == 1)) {
   $$reg2mem64$0 = $55;
   continue;
  }
  $56 = ($52|0)!=(0);
  if (!($56)) {
   $57 = (($tess) + 1740|0);
   __THREW__ = 0;
   invoke_vii(31,($57|0),1);
   $58 = __THREW__; __THREW__ = 0;
   if ((($58|0) != 0) & ((threwValue|0) != 0)) { $59 = _testSetjmp(HEAP32[$58>>2]|0, _setjmpTable)|0; if (($59|0) == 0) { _longjmp($58|0, threwValue|0); } tempRet0 = threwValue; } else { $59 = -1; };
   $60 = tempRet0;
   if ((($59|0) == 1)) {
    $$reg2mem64$0 = $60;
    continue;
   } else {
    label = 29;
    break;
   }
  }
  $61 = (($tess) + 8|0);
  $62 = HEAP32[$61>>2]|0;
  $63 = (($tess) + 60|0);
  $64 = HEAP8[$63>>0]|0;
  $65 = ($64<<24>>24)!=(0);
  do {
   if (!($65)) {
    $66 = (($tess) + 81|0);
    $67 = HEAP8[$66>>0]|0;
    $68 = ($67<<24>>24)!=(0);
    if ($68) {
     __THREW__ = 0;
     $69 = (invoke_iiii(34,($62|0),1,1)|0);
     $70 = __THREW__; __THREW__ = 0;
     if ((($70|0) != 0) & ((threwValue|0) != 0)) { $71 = _testSetjmp(HEAP32[$70>>2]|0, _setjmpTable)|0; if (($71|0) == 0) { _longjmp($70|0, threwValue|0); } tempRet0 = threwValue; } else { $71 = -1; };
     $72 = tempRet0;
     if ((($71|0) == 1)) {
      $$reg2mem64$0 = $72;
      continue L3;
     }
     $rc$0 = $69;
    } else {
     __THREW__ = 0;
     $73 = (invoke_ii(35,($62|0))|0);
     $74 = __THREW__; __THREW__ = 0;
     if ((($74|0) != 0) & ((threwValue|0) != 0)) { $75 = _testSetjmp(HEAP32[$74>>2]|0, _setjmpTable)|0; if (($75|0) == 0) { _longjmp($74|0, threwValue|0); } tempRet0 = threwValue; } else { $75 = -1; };
     $76 = tempRet0;
     if ((($75|0) == 1)) {
      $$reg2mem64$0 = $76;
      continue L3;
     }
     $rc$0 = $73;
    }
    $77 = ($rc$0|0)==(0);
    if ($77) {
     $78 = (($tess) + 1740|0);
     __THREW__ = 0;
     invoke_vii(31,($78|0),1);
     $79 = __THREW__; __THREW__ = 0;
     if ((($79|0) != 0) & ((threwValue|0) != 0)) { $80 = _testSetjmp(HEAP32[$79>>2]|0, _setjmpTable)|0; if (($80|0) == 0) { _longjmp($79|0, threwValue|0); } tempRet0 = threwValue; } else { $80 = -1; };
     $81 = tempRet0;
     if ((($80|0) == 1)) {
      $$reg2mem64$0 = $81;
      continue L3;
     } else {
      label = 38;
      break L3;
     }
    }
    __THREW__ = 0;
    invoke_vi(36,($62|0));
    $82 = __THREW__; __THREW__ = 0;
    if ((($82|0) != 0) & ((threwValue|0) != 0)) { $83 = _testSetjmp(HEAP32[$82>>2]|0, _setjmpTable)|0; if (($83|0) == 0) { _longjmp($82|0, threwValue|0); } tempRet0 = threwValue; } else { $83 = -1; };
    $84 = tempRet0;
    if ((($83|0) == 1)) {
     $$reg2mem64$0 = $84;
     continue L3;
    }
    $85 = (($tess) + 88|0);
    $86 = HEAP32[$85>>2]|0;
    $87 = ($86|0)!=(21|0);
    do {
     if ($87) {
      label = 48;
     } else {
      $88 = (($tess) + 100|0);
      $89 = HEAP32[$88>>2]|0;
      $90 = ($89|0)!=(24|0);
      if ($90) {
       label = 48;
      } else {
       $91 = (($tess) + 96|0);
       $92 = HEAP32[$91>>2]|0;
       $93 = ($92|0)!=(23|0);
       if ($93) {
        label = 48;
       } else {
        $94 = (($tess) + 92|0);
        $95 = HEAP32[$94>>2]|0;
        $96 = ($95|0)!=(22|0);
        if ($96) {
         label = 48;
        } else {
         $97 = (($tess) + 1716|0);
         $98 = HEAP32[$97>>2]|0;
         $99 = ($98|0)!=(13|0);
         if ($99) {
          label = 48;
         } else {
          $100 = (($tess) + 1728|0);
          $101 = HEAP32[$100>>2]|0;
          $102 = ($101|0)!=(16|0);
          if ($102) {
           label = 48;
          } else {
           $103 = (($tess) + 1724|0);
           $104 = HEAP32[$103>>2]|0;
           $105 = ($104|0)!=(15|0);
           if ($105) {
            label = 48;
            break;
           }
           $106 = (($tess) + 1720|0);
           $107 = HEAP32[$106>>2]|0;
           $108 = ($107|0)!=(14|0);
           if ($108) {
            label = 48;
           }
          }
         }
        }
       }
      }
     }
    } while(0);
    if ((label|0) == 48) {
     label = 0;
     $109 = (($tess) + 81|0);
     $110 = HEAP8[$109>>0]|0;
     $111 = ($110<<24>>24)!=(0);
     if ($111) {
      __THREW__ = 0;
      invoke_vii(37,($tess|0),($62|0));
      $112 = __THREW__; __THREW__ = 0;
      if ((($112|0) != 0) & ((threwValue|0) != 0)) { $113 = _testSetjmp(HEAP32[$112>>2]|0, _setjmpTable)|0; if (($113|0) == 0) { _longjmp($112|0, threwValue|0); } tempRet0 = threwValue; } else { $113 = -1; };
      $114 = tempRet0;
      if ((($113|0) == 1)) {
       $$reg2mem64$0 = $114;
       continue L3;
      }
     } else {
      __THREW__ = 0;
      invoke_vii(38,($tess|0),($62|0));
      $115 = __THREW__; __THREW__ = 0;
      if ((($115|0) != 0) & ((threwValue|0) != 0)) { $116 = _testSetjmp(HEAP32[$115>>2]|0, _setjmpTable)|0; if (($116|0) == 0) { _longjmp($115|0, threwValue|0); } tempRet0 = threwValue; } else { $116 = -1; };
      $117 = tempRet0;
      if ((($116|0) == 1)) {
       $$reg2mem64$0 = $117;
       continue L3;
      }
     }
    }
    $118 = (($tess) + 104|0);
    $119 = HEAP32[$118>>2]|0;
    $120 = ($119|0)!=(27|0);
    if (!($120)) {
     break;
    }
    __THREW__ = 0;
    invoke_vi(39,($62|0));
    $121 = __THREW__; __THREW__ = 0;
    if ((($121|0) != 0) & ((threwValue|0) != 0)) { $122 = _testSetjmp(HEAP32[$121>>2]|0, _setjmpTable)|0; if (($122|0) == 0) { _longjmp($121|0, threwValue|0); } tempRet0 = threwValue; } else { $122 = -1; };
    $123 = tempRet0;
    if ((($122|0) == 1)) {
     $$reg2mem64$0 = $123;
     continue L3;
    }
    $124 = (($tess) + 104|0);
    $125 = HEAP32[$124>>2]|0;
    __THREW__ = 0;
    invoke_vi($125|0,($62|0));
    $126 = __THREW__; __THREW__ = 0;
    if ((($126|0) != 0) & ((threwValue|0) != 0)) { $127 = _testSetjmp(HEAP32[$126>>2]|0, _setjmpTable)|0; if (($127|0) == 0) { _longjmp($126|0, threwValue|0); } tempRet0 = threwValue; } else { $127 = -1; };
    $128 = tempRet0;
    if ((($127|0) == 1)) {
     $$reg2mem64$0 = $128;
     continue L3;
    } else {
     label = 57;
     break L3;
    }
   }
  } while(0);
  __THREW__ = 0;
  invoke_vi(40,($62|0));
  $131 = __THREW__; __THREW__ = 0;
  if ((($131|0) != 0) & ((threwValue|0) != 0)) { $132 = _testSetjmp(HEAP32[$131>>2]|0, _setjmpTable)|0; if (($132|0) == 0) { _longjmp($131|0, threwValue|0); } tempRet0 = threwValue; } else { $132 = -1; };
  $133 = tempRet0;
  if ((($132|0) == 1)) {
   $$reg2mem64$0 = $133;
  } else {
   label = 60;
   break;
  }
 }
 if ((label|0) == 6) {
 }
 else if ((label|0) == 8) {
 }
 else if ((label|0) == 18) {
  $39 = (($tess) + 1896|0);
  HEAP32[$39>>2] = 0;
  STACKTOP = sp;return;
 }
 else if ((label|0) == 23) {
  // unreachable;
 }
 else if ((label|0) == 29) {
  // unreachable;
 }
 else if ((label|0) == 38) {
  // unreachable;
 }
 else if ((label|0) == 57) {
  $129 = (($tess) + 8|0);
  HEAP32[$129>>2] = 0;
  $130 = (($tess) + 1896|0);
  HEAP32[$130>>2] = 0;
  STACKTOP = sp;return;
 }
 else if ((label|0) == 60) {
  $134 = (($tess) + 1896|0);
  HEAP32[$134>>2] = 0;
  $135 = (($tess) + 8|0);
  HEAP32[$135>>2] = 0;
  STACKTOP = sp;return;
 }
 STACKTOP = sp;return;
}
function _MakeDormant($tess) {
 $tess = $tess|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $tess;
 $1 = $0;
 $2 = (($1) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)!=(0|0);
 if ($4) {
  $5 = $0;
  $6 = (($5) + 8|0);
  $7 = HEAP32[$6>>2]|0;
  ___gl_meshDeleteMesh($7);
 }
 $8 = $0;
 HEAP32[$8>>2] = 0;
 $9 = $0;
 $10 = (($9) + 4|0);
 HEAP32[$10>>2] = 0;
 $11 = $0;
 $12 = (($11) + 8|0);
 HEAP32[$12>>2] = 0;
 STACKTOP = sp;return;
}
function ___gl_meshTessellateMonoRegion($face) {
 $face = $face|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0.0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0.0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0.0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0.0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0.0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0.0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0.0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0.0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0.0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0.0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0.0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0.0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0.0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0.0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0.0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0.0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0.0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0.0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0.0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0.0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0.0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0.0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0;
 var $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0;
 var $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0.0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0;
 var $369 = 0, $37 = 0, $370 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0.0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $54 = 0.0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0.0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0.0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0.0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0.0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0.0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0.0, $99 = 0, $lo = 0, $tempHalfEdge = 0, $tempHalfEdge1 = 0, $tempHalfEdge2 = 0, $up = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $face;
 $2 = $1;
 $3 = (($2) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $up = $4;
 $5 = $up;
 $6 = (($5) + 12|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = $up;
 $9 = ($7|0)!=($8|0);
 if (!($9)) {
  ___assert_fail((2048|0),(2088|0),82,(2104|0));
  // unreachable;
 }
 $10 = $up;
 $11 = (($10) + 12|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = (($12) + 12|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $up;
 $16 = ($14|0)!=($15|0);
 if (!($16)) {
  ___assert_fail((2048|0),(2088|0),82,(2104|0));
  // unreachable;
 }
 while(1) {
  $17 = $up;
  $18 = (($17) + 4|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = (($19) + 16|0);
  $21 = HEAP32[$20>>2]|0;
  $22 = (($21) + 28|0);
  $23 = +HEAPF32[$22>>2];
  $24 = $up;
  $25 = (($24) + 16|0);
  $26 = HEAP32[$25>>2]|0;
  $27 = (($26) + 28|0);
  $28 = +HEAPF32[$27>>2];
  $29 = $23 < $28;
  if ($29) {
   $363 = 1;
  } else {
   $30 = $up;
   $31 = (($30) + 4|0);
   $32 = HEAP32[$31>>2]|0;
   $33 = (($32) + 16|0);
   $34 = HEAP32[$33>>2]|0;
   $35 = (($34) + 28|0);
   $36 = +HEAPF32[$35>>2];
   $37 = $up;
   $38 = (($37) + 16|0);
   $39 = HEAP32[$38>>2]|0;
   $40 = (($39) + 28|0);
   $41 = +HEAPF32[$40>>2];
   $42 = $36 == $41;
   if ($42) {
    $43 = $up;
    $44 = (($43) + 4|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = (($45) + 16|0);
    $47 = HEAP32[$46>>2]|0;
    $48 = (($47) + 32|0);
    $49 = +HEAPF32[$48>>2];
    $50 = $up;
    $51 = (($50) + 16|0);
    $52 = HEAP32[$51>>2]|0;
    $53 = (($52) + 32|0);
    $54 = +HEAPF32[$53>>2];
    $55 = $49 <= $54;
    $364 = $55;
   } else {
    $364 = 0;
   }
   $363 = $364;
  }
  if (!($363)) {
   break;
  }
  $56 = $up;
  $57 = (($56) + 8|0);
  $58 = HEAP32[$57>>2]|0;
  $59 = (($58) + 4|0);
  $60 = HEAP32[$59>>2]|0;
  $up = $60;
 }
 while(1) {
  $61 = $up;
  $62 = (($61) + 16|0);
  $63 = HEAP32[$62>>2]|0;
  $64 = (($63) + 28|0);
  $65 = +HEAPF32[$64>>2];
  $66 = $up;
  $67 = (($66) + 4|0);
  $68 = HEAP32[$67>>2]|0;
  $69 = (($68) + 16|0);
  $70 = HEAP32[$69>>2]|0;
  $71 = (($70) + 28|0);
  $72 = +HEAPF32[$71>>2];
  $73 = $65 < $72;
  if ($73) {
   $365 = 1;
  } else {
   $74 = $up;
   $75 = (($74) + 16|0);
   $76 = HEAP32[$75>>2]|0;
   $77 = (($76) + 28|0);
   $78 = +HEAPF32[$77>>2];
   $79 = $up;
   $80 = (($79) + 4|0);
   $81 = HEAP32[$80>>2]|0;
   $82 = (($81) + 16|0);
   $83 = HEAP32[$82>>2]|0;
   $84 = (($83) + 28|0);
   $85 = +HEAPF32[$84>>2];
   $86 = $78 == $85;
   if ($86) {
    $87 = $up;
    $88 = (($87) + 16|0);
    $89 = HEAP32[$88>>2]|0;
    $90 = (($89) + 32|0);
    $91 = +HEAPF32[$90>>2];
    $92 = $up;
    $93 = (($92) + 4|0);
    $94 = HEAP32[$93>>2]|0;
    $95 = (($94) + 16|0);
    $96 = HEAP32[$95>>2]|0;
    $97 = (($96) + 32|0);
    $98 = +HEAPF32[$97>>2];
    $99 = $91 <= $98;
    $366 = $99;
   } else {
    $366 = 0;
   }
   $365 = $366;
  }
  if (!($365)) {
   break;
  }
  $100 = $up;
  $101 = (($100) + 12|0);
  $102 = HEAP32[$101>>2]|0;
  $up = $102;
 }
 $103 = $up;
 $104 = (($103) + 8|0);
 $105 = HEAP32[$104>>2]|0;
 $106 = (($105) + 4|0);
 $107 = HEAP32[$106>>2]|0;
 $lo = $107;
 L29: while(1) {
  $108 = $up;
  $109 = (($108) + 12|0);
  $110 = HEAP32[$109>>2]|0;
  $111 = $lo;
  $112 = ($110|0)!=($111|0);
  if (!($112)) {
   label = 50;
   break;
  }
  $113 = $up;
  $114 = (($113) + 4|0);
  $115 = HEAP32[$114>>2]|0;
  $116 = (($115) + 16|0);
  $117 = HEAP32[$116>>2]|0;
  $118 = (($117) + 28|0);
  $119 = +HEAPF32[$118>>2];
  $120 = $lo;
  $121 = (($120) + 16|0);
  $122 = HEAP32[$121>>2]|0;
  $123 = (($122) + 28|0);
  $124 = +HEAPF32[$123>>2];
  $125 = $119 < $124;
  do {
   if ($125) {
    label = 25;
   } else {
    $126 = $up;
    $127 = (($126) + 4|0);
    $128 = HEAP32[$127>>2]|0;
    $129 = (($128) + 16|0);
    $130 = HEAP32[$129>>2]|0;
    $131 = (($130) + 28|0);
    $132 = +HEAPF32[$131>>2];
    $133 = $lo;
    $134 = (($133) + 16|0);
    $135 = HEAP32[$134>>2]|0;
    $136 = (($135) + 28|0);
    $137 = +HEAPF32[$136>>2];
    $138 = $132 == $137;
    if ($138) {
     $139 = $up;
     $140 = (($139) + 4|0);
     $141 = HEAP32[$140>>2]|0;
     $142 = (($141) + 16|0);
     $143 = HEAP32[$142>>2]|0;
     $144 = (($143) + 32|0);
     $145 = +HEAPF32[$144>>2];
     $146 = $lo;
     $147 = (($146) + 16|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = (($148) + 32|0);
     $150 = +HEAPF32[$149>>2];
     $151 = $145 <= $150;
     if ($151) {
      label = 25;
      break;
     }
    }
    while(1) {
     $240 = $lo;
     $241 = (($240) + 12|0);
     $242 = HEAP32[$241>>2]|0;
     $243 = $up;
     $244 = ($242|0)!=($243|0);
     if ($244) {
      $245 = $up;
      $246 = (($245) + 8|0);
      $247 = HEAP32[$246>>2]|0;
      $248 = (($247) + 4|0);
      $249 = HEAP32[$248>>2]|0;
      $250 = (($249) + 16|0);
      $251 = HEAP32[$250>>2]|0;
      $252 = (($251) + 28|0);
      $253 = +HEAPF32[$252>>2];
      $254 = $up;
      $255 = (($254) + 8|0);
      $256 = HEAP32[$255>>2]|0;
      $257 = (($256) + 4|0);
      $258 = HEAP32[$257>>2]|0;
      $259 = (($258) + 4|0);
      $260 = HEAP32[$259>>2]|0;
      $261 = (($260) + 16|0);
      $262 = HEAP32[$261>>2]|0;
      $263 = (($262) + 28|0);
      $264 = +HEAPF32[$263>>2];
      $265 = $253 < $264;
      do {
       if ($265) {
        $370 = 1;
       } else {
        $266 = $up;
        $267 = (($266) + 8|0);
        $268 = HEAP32[$267>>2]|0;
        $269 = (($268) + 4|0);
        $270 = HEAP32[$269>>2]|0;
        $271 = (($270) + 16|0);
        $272 = HEAP32[$271>>2]|0;
        $273 = (($272) + 28|0);
        $274 = +HEAPF32[$273>>2];
        $275 = $up;
        $276 = (($275) + 8|0);
        $277 = HEAP32[$276>>2]|0;
        $278 = (($277) + 4|0);
        $279 = HEAP32[$278>>2]|0;
        $280 = (($279) + 4|0);
        $281 = HEAP32[$280>>2]|0;
        $282 = (($281) + 16|0);
        $283 = HEAP32[$282>>2]|0;
        $284 = (($283) + 28|0);
        $285 = +HEAPF32[$284>>2];
        $286 = $274 == $285;
        if ($286) {
         $287 = $up;
         $288 = (($287) + 8|0);
         $289 = HEAP32[$288>>2]|0;
         $290 = (($289) + 4|0);
         $291 = HEAP32[$290>>2]|0;
         $292 = (($291) + 16|0);
         $293 = HEAP32[$292>>2]|0;
         $294 = (($293) + 32|0);
         $295 = +HEAPF32[$294>>2];
         $296 = $up;
         $297 = (($296) + 8|0);
         $298 = HEAP32[$297>>2]|0;
         $299 = (($298) + 4|0);
         $300 = HEAP32[$299>>2]|0;
         $301 = (($300) + 4|0);
         $302 = HEAP32[$301>>2]|0;
         $303 = (($302) + 16|0);
         $304 = HEAP32[$303>>2]|0;
         $305 = (($304) + 32|0);
         $306 = +HEAPF32[$305>>2];
         $307 = $295 <= $306;
         if ($307) {
          $370 = 1;
          break;
         }
        }
        $308 = $up;
        $309 = (($308) + 4|0);
        $310 = HEAP32[$309>>2]|0;
        $311 = (($310) + 16|0);
        $312 = HEAP32[$311>>2]|0;
        $313 = $up;
        $314 = (($313) + 16|0);
        $315 = HEAP32[$314>>2]|0;
        $316 = $up;
        $317 = (($316) + 8|0);
        $318 = HEAP32[$317>>2]|0;
        $319 = (($318) + 4|0);
        $320 = HEAP32[$319>>2]|0;
        $321 = (($320) + 16|0);
        $322 = HEAP32[$321>>2]|0;
        $323 = (+___gl_edgeSign($312,$315,$322));
        $324 = $323 >= 0.0;
        $370 = $324;
       }
      } while(0);
      $369 = $370;
     } else {
      $369 = 0;
     }
     if (!($369)) {
      break;
     }
     $325 = $up;
     $326 = $up;
     $327 = (($326) + 8|0);
     $328 = HEAP32[$327>>2]|0;
     $329 = (($328) + 4|0);
     $330 = HEAP32[$329>>2]|0;
     $331 = (___gl_meshConnect($325,$330)|0);
     $tempHalfEdge1 = $331;
     $332 = $tempHalfEdge1;
     $333 = ($332|0)==(0|0);
     if ($333) {
      label = 46;
      break L29;
     }
     $334 = $tempHalfEdge1;
     $335 = (($334) + 4|0);
     $336 = HEAP32[$335>>2]|0;
     $up = $336;
    }
    $337 = $up;
    $338 = (($337) + 12|0);
    $339 = HEAP32[$338>>2]|0;
    $up = $339;
   }
  } while(0);
  if ((label|0) == 25) {
   label = 0;
   while(1) {
    $152 = $lo;
    $153 = (($152) + 12|0);
    $154 = HEAP32[$153>>2]|0;
    $155 = $up;
    $156 = ($154|0)!=($155|0);
    if ($156) {
     $157 = $lo;
     $158 = (($157) + 12|0);
     $159 = HEAP32[$158>>2]|0;
     $160 = (($159) + 4|0);
     $161 = HEAP32[$160>>2]|0;
     $162 = (($161) + 16|0);
     $163 = HEAP32[$162>>2]|0;
     $164 = (($163) + 28|0);
     $165 = +HEAPF32[$164>>2];
     $166 = $lo;
     $167 = (($166) + 12|0);
     $168 = HEAP32[$167>>2]|0;
     $169 = (($168) + 16|0);
     $170 = HEAP32[$169>>2]|0;
     $171 = (($170) + 28|0);
     $172 = +HEAPF32[$171>>2];
     $173 = $165 < $172;
     do {
      if ($173) {
       $368 = 1;
      } else {
       $174 = $lo;
       $175 = (($174) + 12|0);
       $176 = HEAP32[$175>>2]|0;
       $177 = (($176) + 4|0);
       $178 = HEAP32[$177>>2]|0;
       $179 = (($178) + 16|0);
       $180 = HEAP32[$179>>2]|0;
       $181 = (($180) + 28|0);
       $182 = +HEAPF32[$181>>2];
       $183 = $lo;
       $184 = (($183) + 12|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = (($185) + 16|0);
       $187 = HEAP32[$186>>2]|0;
       $188 = (($187) + 28|0);
       $189 = +HEAPF32[$188>>2];
       $190 = $182 == $189;
       if ($190) {
        $191 = $lo;
        $192 = (($191) + 12|0);
        $193 = HEAP32[$192>>2]|0;
        $194 = (($193) + 4|0);
        $195 = HEAP32[$194>>2]|0;
        $196 = (($195) + 16|0);
        $197 = HEAP32[$196>>2]|0;
        $198 = (($197) + 32|0);
        $199 = +HEAPF32[$198>>2];
        $200 = $lo;
        $201 = (($200) + 12|0);
        $202 = HEAP32[$201>>2]|0;
        $203 = (($202) + 16|0);
        $204 = HEAP32[$203>>2]|0;
        $205 = (($204) + 32|0);
        $206 = +HEAPF32[$205>>2];
        $207 = $199 <= $206;
        if ($207) {
         $368 = 1;
         break;
        }
       }
       $208 = $lo;
       $209 = (($208) + 16|0);
       $210 = HEAP32[$209>>2]|0;
       $211 = $lo;
       $212 = (($211) + 4|0);
       $213 = HEAP32[$212>>2]|0;
       $214 = (($213) + 16|0);
       $215 = HEAP32[$214>>2]|0;
       $216 = $lo;
       $217 = (($216) + 12|0);
       $218 = HEAP32[$217>>2]|0;
       $219 = (($218) + 4|0);
       $220 = HEAP32[$219>>2]|0;
       $221 = (($220) + 16|0);
       $222 = HEAP32[$221>>2]|0;
       $223 = (+___gl_edgeSign($210,$215,$222));
       $224 = $223 <= 0.0;
       $368 = $224;
      }
     } while(0);
     $367 = $368;
    } else {
     $367 = 0;
    }
    if (!($367)) {
     break;
    }
    $225 = $lo;
    $226 = (($225) + 12|0);
    $227 = HEAP32[$226>>2]|0;
    $228 = $lo;
    $229 = (___gl_meshConnect($227,$228)|0);
    $tempHalfEdge = $229;
    $230 = $tempHalfEdge;
    $231 = ($230|0)==(0|0);
    if ($231) {
     label = 34;
     break L29;
    }
    $232 = $tempHalfEdge;
    $233 = (($232) + 4|0);
    $234 = HEAP32[$233>>2]|0;
    $lo = $234;
   }
   $235 = $lo;
   $236 = (($235) + 8|0);
   $237 = HEAP32[$236>>2]|0;
   $238 = (($237) + 4|0);
   $239 = HEAP32[$238>>2]|0;
   $lo = $239;
  }
 }
 if ((label|0) == 34) {
  $0 = 0;
  $362 = $0;
  STACKTOP = sp;return ($362|0);
 }
 else if ((label|0) == 46) {
  $0 = 0;
  $362 = $0;
  STACKTOP = sp;return ($362|0);
 }
 else if ((label|0) == 50) {
  $340 = $lo;
  $341 = (($340) + 12|0);
  $342 = HEAP32[$341>>2]|0;
  $343 = $up;
  $344 = ($342|0)!=($343|0);
  if (!($344)) {
   ___assert_fail((2136|0),(2088|0),126,(2104|0));
   // unreachable;
  }
  while(1) {
   $345 = $lo;
   $346 = (($345) + 12|0);
   $347 = HEAP32[$346>>2]|0;
   $348 = (($347) + 12|0);
   $349 = HEAP32[$348>>2]|0;
   $350 = $up;
   $351 = ($349|0)!=($350|0);
   if (!($351)) {
    label = 57;
    break;
   }
   $352 = $lo;
   $353 = (($352) + 12|0);
   $354 = HEAP32[$353>>2]|0;
   $355 = $lo;
   $356 = (___gl_meshConnect($354,$355)|0);
   $tempHalfEdge2 = $356;
   $357 = $tempHalfEdge2;
   $358 = ($357|0)==(0|0);
   if ($358) {
    label = 55;
    break;
   }
   $359 = $tempHalfEdge2;
   $360 = (($359) + 4|0);
   $361 = HEAP32[$360>>2]|0;
   $lo = $361;
  }
  if ((label|0) == 55) {
   $0 = 0;
   $362 = $0;
   STACKTOP = sp;return ($362|0);
  }
  else if ((label|0) == 57) {
   $0 = 1;
   $362 = $0;
   STACKTOP = sp;return ($362|0);
  }
 }
 return 0|0;
}
function ___gl_meshTessellateInterior($mesh) {
 $mesh = $mesh|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $f = 0, $next = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $mesh;
 $2 = $1;
 $3 = (($2) + 40|0);
 $4 = HEAP32[$3>>2]|0;
 $f = $4;
 while(1) {
  $5 = $f;
  $6 = $1;
  $7 = (($6) + 40|0);
  $8 = ($5|0)!=($7|0);
  if (!($8)) {
   label = 9;
   break;
  }
  $9 = $f;
  $10 = HEAP32[$9>>2]|0;
  $next = $10;
  $11 = $f;
  $12 = (($11) + 21|0);
  $13 = HEAP8[$12>>0]|0;
  $14 = ($13<<24>>24)!=(0);
  if ($14) {
   $15 = $f;
   $16 = (___gl_meshTessellateMonoRegion($15)|0);
   $17 = ($16|0)!=(0);
   if (!($17)) {
    label = 5;
    break;
   }
  }
  $18 = $next;
  $f = $18;
 }
 if ((label|0) == 5) {
  $0 = 0;
  $19 = $0;
  STACKTOP = sp;return ($19|0);
 }
 else if ((label|0) == 9) {
  $0 = 1;
  $19 = $0;
  STACKTOP = sp;return ($19|0);
 }
 return 0|0;
}
function ___gl_meshDiscardExterior($mesh) {
 $mesh = $mesh|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $f = 0, $next = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $mesh;
 $1 = $0;
 $2 = (($1) + 40|0);
 $3 = HEAP32[$2>>2]|0;
 $f = $3;
 while(1) {
  $4 = $f;
  $5 = $0;
  $6 = (($5) + 40|0);
  $7 = ($4|0)!=($6|0);
  if (!($7)) {
   break;
  }
  $8 = $f;
  $9 = HEAP32[$8>>2]|0;
  $next = $9;
  $10 = $f;
  $11 = (($10) + 21|0);
  $12 = HEAP8[$11>>0]|0;
  $13 = ($12<<24>>24)!=(0);
  if (!($13)) {
   $14 = $f;
   ___gl_meshZapFace($14);
  }
  $15 = $next;
  $f = $15;
 }
 STACKTOP = sp;return;
}
function ___gl_meshSetWindingNumber($mesh,$value,$keepOnlyBoundary) {
 $mesh = $mesh|0;
 $value = $value|0;
 $keepOnlyBoundary = $keepOnlyBoundary|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $e = 0, $eNext = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $mesh;
 $2 = $value;
 $3 = $keepOnlyBoundary;
 $4 = $1;
 $5 = (($4) + 64|0);
 $6 = HEAP32[$5>>2]|0;
 $e = $6;
 while(1) {
  $7 = $e;
  $8 = $1;
  $9 = (($8) + 64|0);
  $10 = ($7|0)!=($9|0);
  if (!($10)) {
   label = 16;
   break;
  }
  $11 = $e;
  $12 = HEAP32[$11>>2]|0;
  $eNext = $12;
  $13 = $e;
  $14 = (($13) + 4|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = (($15) + 20|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = (($17) + 21|0);
  $19 = HEAP8[$18>>0]|0;
  $20 = $19&255;
  $21 = $e;
  $22 = (($21) + 20|0);
  $23 = HEAP32[$22>>2]|0;
  $24 = (($23) + 21|0);
  $25 = HEAP8[$24>>0]|0;
  $26 = $25&255;
  $27 = ($20|0)!=($26|0);
  if ($27) {
   $28 = $e;
   $29 = (($28) + 20|0);
   $30 = HEAP32[$29>>2]|0;
   $31 = (($30) + 21|0);
   $32 = HEAP8[$31>>0]|0;
   $33 = $32&255;
   $34 = ($33|0)!=(0);
   if ($34) {
    $35 = $2;
    $40 = $35;
   } else {
    $36 = $2;
    $37 = (0 - ($36))|0;
    $40 = $37;
   }
   $38 = $e;
   $39 = (($38) + 28|0);
   HEAP32[$39>>2] = $40;
  } else {
   $41 = $3;
   $42 = ($41<<24>>24)!=(0);
   if ($42) {
    $45 = $e;
    $46 = (___gl_meshDelete($45)|0);
    $47 = ($46|0)!=(0);
    if (!($47)) {
     label = 11;
     break;
    }
   } else {
    $43 = $e;
    $44 = (($43) + 28|0);
    HEAP32[$44>>2] = 0;
   }
  }
  $48 = $eNext;
  $e = $48;
 }
 if ((label|0) == 11) {
  $0 = 0;
  $49 = $0;
  STACKTOP = sp;return ($49|0);
 }
 else if ((label|0) == 16) {
  $0 = 1;
  $49 = $0;
  STACKTOP = sp;return ($49|0);
 }
 return 0|0;
}
function _malloc($bytes) {
 $bytes = $bytes|0;
 var $$$i = 0, $$3$i = 0, $$4$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i25 = 0, $$pre$i25$i = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i26$iZ2D = 0, $$pre$phi$i26Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi58$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre57$i$i = 0, $$rsize$0$i = 0, $$rsize$3$i = 0, $$sum = 0, $$sum$i$i = 0, $$sum$i$i$i = 0;
 var $$sum$i14$i = 0, $$sum$i15$i = 0, $$sum$i18$i = 0, $$sum$i21$i = 0, $$sum$i2334 = 0, $$sum$i32 = 0, $$sum$i35 = 0, $$sum1 = 0, $$sum1$i = 0, $$sum1$i$i = 0, $$sum1$i16$i = 0, $$sum1$i22$i = 0, $$sum1$i24 = 0, $$sum10 = 0, $$sum10$i = 0, $$sum10$i$i = 0, $$sum10$pre$i$i = 0, $$sum107$i = 0, $$sum108$i = 0, $$sum109$i = 0;
 var $$sum11$i = 0, $$sum11$i$i = 0, $$sum11$i24$i = 0, $$sum110$i = 0, $$sum111$i = 0, $$sum1112 = 0, $$sum112$i = 0, $$sum113$i = 0, $$sum114$i = 0, $$sum115$i = 0, $$sum116$i = 0, $$sum117$i = 0, $$sum118$i = 0, $$sum119$i = 0, $$sum12$i = 0, $$sum12$i$i = 0, $$sum120$i = 0, $$sum13$i = 0, $$sum13$i$i = 0, $$sum14$i$i = 0;
 var $$sum14$pre$i = 0, $$sum15$i = 0, $$sum15$i$i = 0, $$sum16$i = 0, $$sum16$i$i = 0, $$sum17$i = 0, $$sum17$i$i = 0, $$sum18$i = 0, $$sum1819$i$i = 0, $$sum2 = 0, $$sum2$i = 0, $$sum2$i$i = 0, $$sum2$i$i$i = 0, $$sum2$i17$i = 0, $$sum2$i19$i = 0, $$sum2$i23$i = 0, $$sum2$pre$i = 0, $$sum20$i$i = 0, $$sum21$i$i = 0, $$sum22$i$i = 0;
 var $$sum23$i$i = 0, $$sum24$i$i = 0, $$sum25$i$i = 0, $$sum26$pre$i$i = 0, $$sum27$i$i = 0, $$sum28$i$i = 0, $$sum29$i$i = 0, $$sum3$i = 0, $$sum3$i$i = 0, $$sum3$i27 = 0, $$sum30$i$i = 0, $$sum3132$i$i = 0, $$sum34$i$i = 0, $$sum3536$i$i = 0, $$sum3738$i$i = 0, $$sum39$i$i = 0, $$sum4 = 0, $$sum4$i = 0, $$sum4$i28 = 0, $$sum40$i$i = 0;
 var $$sum41$i$i = 0, $$sum42$i$i = 0, $$sum5$i = 0, $$sum5$i$i = 0, $$sum56 = 0, $$sum6$i = 0, $$sum67$i$i = 0, $$sum7$i = 0, $$sum8$i = 0, $$sum8$pre = 0, $$sum9 = 0, $$sum9$i = 0, $$sum9$i$i = 0, $$tsize$1$i = 0, $$v$0$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0;
 var $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0;
 var $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0;
 var $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0;
 var $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0;
 var $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0;
 var $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0;
 var $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0;
 var $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0;
 var $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0;
 var $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0;
 var $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0;
 var $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0;
 var $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0;
 var $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0;
 var $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0;
 var $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0;
 var $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0;
 var $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0;
 var $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0;
 var $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0;
 var $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0;
 var $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0;
 var $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0;
 var $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0;
 var $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0;
 var $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0;
 var $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0;
 var $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0;
 var $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0;
 var $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0;
 var $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0;
 var $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0;
 var $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0;
 var $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0;
 var $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0;
 var $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0;
 var $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0;
 var $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0;
 var $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0;
 var $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0;
 var $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0;
 var $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0;
 var $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0;
 var $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0;
 var $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0;
 var $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0;
 var $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0;
 var $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0;
 var $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0;
 var $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0;
 var $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0;
 var $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0;
 var $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0;
 var $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0;
 var $I1$0$c$i$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$025$i = 0, $K2$014$i$i = 0, $K8$052$i$i = 0, $R$0$i = 0, $R$0$i$i = 0, $R$0$i18 = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i20 = 0, $RP$0$i = 0, $RP$0$i$i = 0, $RP$0$i17 = 0, $T$0$lcssa$i = 0, $T$0$lcssa$i$i = 0, $T$0$lcssa$i28$i = 0, $T$013$i$i = 0;
 var $T$024$i = 0, $T$051$i$i = 0, $br$0$i = 0, $cond$i = 0, $cond$i$i = 0, $cond$i21 = 0, $exitcond$i$i = 0, $i$02$i$i = 0, $idx$0$i = 0, $mem$0 = 0, $nb$0 = 0, $notlhs$i = 0, $notrhs$i = 0, $oldfirst$0$i$i = 0, $or$cond$i = 0, $or$cond$i29 = 0, $or$cond1$i = 0, $or$cond10$i = 0, $or$cond19$i = 0, $or$cond2$i = 0;
 var $or$cond49$i = 0, $or$cond5$i = 0, $or$cond6$i = 0, $or$cond8$not$i = 0, $or$cond9$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i15 = 0, $rsize$1$i = 0, $rsize$2$i = 0, $rsize$3$lcssa$i = 0, $rsize$329$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$075$i = 0, $sp$168$i = 0, $ssize$0$$i = 0;
 var $ssize$0$i = 0, $ssize$1$i = 0, $ssize$2$i = 0, $t$0$i = 0, $t$0$i14 = 0, $t$1$i = 0, $t$2$ph$i = 0, $t$2$v$3$i = 0, $t$228$i = 0, $tbase$0$i = 0, $tbase$247$i = 0, $tsize$0$i = 0, $tsize$0323841$i = 0, $tsize$1$i = 0, $tsize$246$i = 0, $v$0$i = 0, $v$0$i16 = 0, $v$1$i = 0, $v$2$i = 0, $v$3$lcssa$i = 0;
 var $v$330$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($bytes>>>0)<(245);
 do {
  if ($0) {
   $1 = ($bytes>>>0)<(11);
   if ($1) {
    $5 = 16;
   } else {
    $2 = (($bytes) + 11)|0;
    $3 = $2 & -8;
    $5 = $3;
   }
   $4 = $5 >>> 3;
   $6 = HEAP32[2152>>2]|0;
   $7 = $6 >>> $4;
   $8 = $7 & 3;
   $9 = ($8|0)==(0);
   if (!($9)) {
    $10 = $7 & 1;
    $11 = $10 ^ 1;
    $12 = (($11) + ($4))|0;
    $13 = $12 << 1;
    $14 = ((2152 + ($13<<2)|0) + 40|0);
    $$sum10 = (($13) + 2)|0;
    $15 = ((2152 + ($$sum10<<2)|0) + 40|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = (($16) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ($14|0)==($18|0);
    do {
     if ($19) {
      $20 = 1 << $12;
      $21 = $20 ^ -1;
      $22 = $6 & $21;
      HEAP32[2152>>2] = $22;
     } else {
      $23 = HEAP32[((2152 + 16|0))>>2]|0;
      $24 = ($18>>>0)<($23>>>0);
      if ($24) {
       _abort();
       // unreachable;
      }
      $25 = (($18) + 12|0);
      $26 = HEAP32[$25>>2]|0;
      $27 = ($26|0)==($16|0);
      if ($27) {
       HEAP32[$25>>2] = $14;
       HEAP32[$15>>2] = $18;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $28 = $12 << 3;
    $29 = $28 | 3;
    $30 = (($16) + 4|0);
    HEAP32[$30>>2] = $29;
    $$sum1112 = $28 | 4;
    $31 = (($16) + ($$sum1112)|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = $32 | 1;
    HEAP32[$31>>2] = $33;
    $mem$0 = $17;
    STACKTOP = sp;return ($mem$0|0);
   }
   $34 = HEAP32[((2152 + 8|0))>>2]|0;
   $35 = ($5>>>0)>($34>>>0);
   if ($35) {
    $36 = ($7|0)==(0);
    if (!($36)) {
     $37 = $7 << $4;
     $38 = 2 << $4;
     $39 = (0 - ($38))|0;
     $40 = $38 | $39;
     $41 = $37 & $40;
     $42 = (0 - ($41))|0;
     $43 = $41 & $42;
     $44 = (($43) + -1)|0;
     $45 = $44 >>> 12;
     $46 = $45 & 16;
     $47 = $44 >>> $46;
     $48 = $47 >>> 5;
     $49 = $48 & 8;
     $50 = $49 | $46;
     $51 = $47 >>> $49;
     $52 = $51 >>> 2;
     $53 = $52 & 4;
     $54 = $50 | $53;
     $55 = $51 >>> $53;
     $56 = $55 >>> 1;
     $57 = $56 & 2;
     $58 = $54 | $57;
     $59 = $55 >>> $57;
     $60 = $59 >>> 1;
     $61 = $60 & 1;
     $62 = $58 | $61;
     $63 = $59 >>> $61;
     $64 = (($62) + ($63))|0;
     $65 = $64 << 1;
     $66 = ((2152 + ($65<<2)|0) + 40|0);
     $$sum4 = (($65) + 2)|0;
     $67 = ((2152 + ($$sum4<<2)|0) + 40|0);
     $68 = HEAP32[$67>>2]|0;
     $69 = (($68) + 8|0);
     $70 = HEAP32[$69>>2]|0;
     $71 = ($66|0)==($70|0);
     do {
      if ($71) {
       $72 = 1 << $64;
       $73 = $72 ^ -1;
       $74 = $6 & $73;
       HEAP32[2152>>2] = $74;
      } else {
       $75 = HEAP32[((2152 + 16|0))>>2]|0;
       $76 = ($70>>>0)<($75>>>0);
       if ($76) {
        _abort();
        // unreachable;
       }
       $77 = (($70) + 12|0);
       $78 = HEAP32[$77>>2]|0;
       $79 = ($78|0)==($68|0);
       if ($79) {
        HEAP32[$77>>2] = $66;
        HEAP32[$67>>2] = $70;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $80 = $64 << 3;
     $81 = (($80) - ($5))|0;
     $82 = $5 | 3;
     $83 = (($68) + 4|0);
     HEAP32[$83>>2] = $82;
     $84 = (($68) + ($5)|0);
     $85 = $81 | 1;
     $$sum56 = $5 | 4;
     $86 = (($68) + ($$sum56)|0);
     HEAP32[$86>>2] = $85;
     $87 = (($68) + ($80)|0);
     HEAP32[$87>>2] = $81;
     $88 = HEAP32[((2152 + 8|0))>>2]|0;
     $89 = ($88|0)==(0);
     if (!($89)) {
      $90 = HEAP32[((2152 + 20|0))>>2]|0;
      $91 = $88 >>> 3;
      $92 = $91 << 1;
      $93 = ((2152 + ($92<<2)|0) + 40|0);
      $94 = HEAP32[2152>>2]|0;
      $95 = 1 << $91;
      $96 = $94 & $95;
      $97 = ($96|0)==(0);
      if ($97) {
       $98 = $94 | $95;
       HEAP32[2152>>2] = $98;
       $$sum8$pre = (($92) + 2)|0;
       $$pre = ((2152 + ($$sum8$pre<<2)|0) + 40|0);
       $$pre$phiZ2D = $$pre;$F4$0 = $93;
      } else {
       $$sum9 = (($92) + 2)|0;
       $99 = ((2152 + ($$sum9<<2)|0) + 40|0);
       $100 = HEAP32[$99>>2]|0;
       $101 = HEAP32[((2152 + 16|0))>>2]|0;
       $102 = ($100>>>0)<($101>>>0);
       if ($102) {
        _abort();
        // unreachable;
       } else {
        $$pre$phiZ2D = $99;$F4$0 = $100;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $90;
      $103 = (($F4$0) + 12|0);
      HEAP32[$103>>2] = $90;
      $104 = (($90) + 8|0);
      HEAP32[$104>>2] = $F4$0;
      $105 = (($90) + 12|0);
      HEAP32[$105>>2] = $93;
     }
     HEAP32[((2152 + 8|0))>>2] = $81;
     HEAP32[((2152 + 20|0))>>2] = $84;
     $mem$0 = $69;
     STACKTOP = sp;return ($mem$0|0);
    }
    $106 = HEAP32[((2152 + 4|0))>>2]|0;
    $107 = ($106|0)==(0);
    if ($107) {
     $nb$0 = $5;
    } else {
     $108 = (0 - ($106))|0;
     $109 = $106 & $108;
     $110 = (($109) + -1)|0;
     $111 = $110 >>> 12;
     $112 = $111 & 16;
     $113 = $110 >>> $112;
     $114 = $113 >>> 5;
     $115 = $114 & 8;
     $116 = $115 | $112;
     $117 = $113 >>> $115;
     $118 = $117 >>> 2;
     $119 = $118 & 4;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = $121 >>> 1;
     $123 = $122 & 2;
     $124 = $120 | $123;
     $125 = $121 >>> $123;
     $126 = $125 >>> 1;
     $127 = $126 & 1;
     $128 = $124 | $127;
     $129 = $125 >>> $127;
     $130 = (($128) + ($129))|0;
     $131 = ((2152 + ($130<<2)|0) + 304|0);
     $132 = HEAP32[$131>>2]|0;
     $133 = (($132) + 4|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = $134 & -8;
     $136 = (($135) - ($5))|0;
     $rsize$0$i = $136;$t$0$i = $132;$v$0$i = $132;
     while(1) {
      $137 = (($t$0$i) + 16|0);
      $138 = HEAP32[$137>>2]|0;
      $139 = ($138|0)==(0|0);
      if ($139) {
       $140 = (($t$0$i) + 20|0);
       $141 = HEAP32[$140>>2]|0;
       $142 = ($141|0)==(0|0);
       if ($142) {
        break;
       } else {
        $144 = $141;
       }
      } else {
       $144 = $138;
      }
      $143 = (($144) + 4|0);
      $145 = HEAP32[$143>>2]|0;
      $146 = $145 & -8;
      $147 = (($146) - ($5))|0;
      $148 = ($147>>>0)<($rsize$0$i>>>0);
      $$rsize$0$i = $148 ? $147 : $rsize$0$i;
      $$v$0$i = $148 ? $144 : $v$0$i;
      $rsize$0$i = $$rsize$0$i;$t$0$i = $144;$v$0$i = $$v$0$i;
     }
     $149 = HEAP32[((2152 + 16|0))>>2]|0;
     $150 = ($v$0$i>>>0)<($149>>>0);
     if ($150) {
      _abort();
      // unreachable;
     }
     $151 = (($v$0$i) + ($5)|0);
     $152 = ($v$0$i>>>0)<($151>>>0);
     if (!($152)) {
      _abort();
      // unreachable;
     }
     $153 = (($v$0$i) + 24|0);
     $154 = HEAP32[$153>>2]|0;
     $155 = (($v$0$i) + 12|0);
     $156 = HEAP32[$155>>2]|0;
     $157 = ($156|0)==($v$0$i|0);
     do {
      if ($157) {
       $167 = (($v$0$i) + 20|0);
       $168 = HEAP32[$167>>2]|0;
       $169 = ($168|0)==(0|0);
       if ($169) {
        $170 = (($v$0$i) + 16|0);
        $171 = HEAP32[$170>>2]|0;
        $172 = ($171|0)==(0|0);
        if ($172) {
         $R$1$i = 0;
         break;
        } else {
         $R$0$i = $171;$RP$0$i = $170;
        }
       } else {
        $R$0$i = $168;$RP$0$i = $167;
       }
       while(1) {
        $173 = (($R$0$i) + 20|0);
        $174 = HEAP32[$173>>2]|0;
        $175 = ($174|0)==(0|0);
        if (!($175)) {
         $R$0$i = $174;$RP$0$i = $173;
         continue;
        }
        $176 = (($R$0$i) + 16|0);
        $177 = HEAP32[$176>>2]|0;
        $178 = ($177|0)==(0|0);
        if ($178) {
         break;
        } else {
         $R$0$i = $177;$RP$0$i = $176;
        }
       }
       $179 = ($RP$0$i>>>0)<($149>>>0);
       if ($179) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$RP$0$i>>2] = 0;
        $R$1$i = $R$0$i;
        break;
       }
      } else {
       $158 = (($v$0$i) + 8|0);
       $159 = HEAP32[$158>>2]|0;
       $160 = ($159>>>0)<($149>>>0);
       if ($160) {
        _abort();
        // unreachable;
       }
       $161 = (($159) + 12|0);
       $162 = HEAP32[$161>>2]|0;
       $163 = ($162|0)==($v$0$i|0);
       if (!($163)) {
        _abort();
        // unreachable;
       }
       $164 = (($156) + 8|0);
       $165 = HEAP32[$164>>2]|0;
       $166 = ($165|0)==($v$0$i|0);
       if ($166) {
        HEAP32[$161>>2] = $156;
        HEAP32[$164>>2] = $159;
        $R$1$i = $156;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $180 = ($154|0)==(0|0);
     do {
      if (!($180)) {
       $181 = (($v$0$i) + 28|0);
       $182 = HEAP32[$181>>2]|0;
       $183 = ((2152 + ($182<<2)|0) + 304|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = ($v$0$i|0)==($184|0);
       if ($185) {
        HEAP32[$183>>2] = $R$1$i;
        $cond$i = ($R$1$i|0)==(0|0);
        if ($cond$i) {
         $186 = 1 << $182;
         $187 = $186 ^ -1;
         $188 = HEAP32[((2152 + 4|0))>>2]|0;
         $189 = $188 & $187;
         HEAP32[((2152 + 4|0))>>2] = $189;
         break;
        }
       } else {
        $190 = HEAP32[((2152 + 16|0))>>2]|0;
        $191 = ($154>>>0)<($190>>>0);
        if ($191) {
         _abort();
         // unreachable;
        }
        $192 = (($154) + 16|0);
        $193 = HEAP32[$192>>2]|0;
        $194 = ($193|0)==($v$0$i|0);
        if ($194) {
         HEAP32[$192>>2] = $R$1$i;
        } else {
         $195 = (($154) + 20|0);
         HEAP32[$195>>2] = $R$1$i;
        }
        $196 = ($R$1$i|0)==(0|0);
        if ($196) {
         break;
        }
       }
       $197 = HEAP32[((2152 + 16|0))>>2]|0;
       $198 = ($R$1$i>>>0)<($197>>>0);
       if ($198) {
        _abort();
        // unreachable;
       }
       $199 = (($R$1$i) + 24|0);
       HEAP32[$199>>2] = $154;
       $200 = (($v$0$i) + 16|0);
       $201 = HEAP32[$200>>2]|0;
       $202 = ($201|0)==(0|0);
       do {
        if (!($202)) {
         $203 = HEAP32[((2152 + 16|0))>>2]|0;
         $204 = ($201>>>0)<($203>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = (($R$1$i) + 16|0);
          HEAP32[$205>>2] = $201;
          $206 = (($201) + 24|0);
          HEAP32[$206>>2] = $R$1$i;
          break;
         }
        }
       } while(0);
       $207 = (($v$0$i) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[((2152 + 16|0))>>2]|0;
        $211 = ($208>>>0)<($210>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = (($R$1$i) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = (($208) + 24|0);
         HEAP32[$213>>2] = $R$1$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($rsize$0$i>>>0)<(16);
     if ($214) {
      $215 = (($rsize$0$i) + ($5))|0;
      $216 = $215 | 3;
      $217 = (($v$0$i) + 4|0);
      HEAP32[$217>>2] = $216;
      $$sum4$i = (($215) + 4)|0;
      $218 = (($v$0$i) + ($$sum4$i)|0);
      $219 = HEAP32[$218>>2]|0;
      $220 = $219 | 1;
      HEAP32[$218>>2] = $220;
     } else {
      $221 = $5 | 3;
      $222 = (($v$0$i) + 4|0);
      HEAP32[$222>>2] = $221;
      $223 = $rsize$0$i | 1;
      $$sum$i35 = $5 | 4;
      $224 = (($v$0$i) + ($$sum$i35)|0);
      HEAP32[$224>>2] = $223;
      $$sum1$i = (($rsize$0$i) + ($5))|0;
      $225 = (($v$0$i) + ($$sum1$i)|0);
      HEAP32[$225>>2] = $rsize$0$i;
      $226 = HEAP32[((2152 + 8|0))>>2]|0;
      $227 = ($226|0)==(0);
      if (!($227)) {
       $228 = HEAP32[((2152 + 20|0))>>2]|0;
       $229 = $226 >>> 3;
       $230 = $229 << 1;
       $231 = ((2152 + ($230<<2)|0) + 40|0);
       $232 = HEAP32[2152>>2]|0;
       $233 = 1 << $229;
       $234 = $232 & $233;
       $235 = ($234|0)==(0);
       if ($235) {
        $236 = $232 | $233;
        HEAP32[2152>>2] = $236;
        $$sum2$pre$i = (($230) + 2)|0;
        $$pre$i = ((2152 + ($$sum2$pre$i<<2)|0) + 40|0);
        $$pre$phi$iZ2D = $$pre$i;$F1$0$i = $231;
       } else {
        $$sum3$i = (($230) + 2)|0;
        $237 = ((2152 + ($$sum3$i<<2)|0) + 40|0);
        $238 = HEAP32[$237>>2]|0;
        $239 = HEAP32[((2152 + 16|0))>>2]|0;
        $240 = ($238>>>0)<($239>>>0);
        if ($240) {
         _abort();
         // unreachable;
        } else {
         $$pre$phi$iZ2D = $237;$F1$0$i = $238;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $228;
       $241 = (($F1$0$i) + 12|0);
       HEAP32[$241>>2] = $228;
       $242 = (($228) + 8|0);
       HEAP32[$242>>2] = $F1$0$i;
       $243 = (($228) + 12|0);
       HEAP32[$243>>2] = $231;
      }
      HEAP32[((2152 + 8|0))>>2] = $rsize$0$i;
      HEAP32[((2152 + 20|0))>>2] = $151;
     }
     $244 = (($v$0$i) + 8|0);
     $mem$0 = $244;
     STACKTOP = sp;return ($mem$0|0);
    }
   } else {
    $nb$0 = $5;
   }
  } else {
   $245 = ($bytes>>>0)>(4294967231);
   if ($245) {
    $nb$0 = -1;
   } else {
    $246 = (($bytes) + 11)|0;
    $247 = $246 & -8;
    $248 = HEAP32[((2152 + 4|0))>>2]|0;
    $249 = ($248|0)==(0);
    if ($249) {
     $nb$0 = $247;
    } else {
     $250 = (0 - ($247))|0;
     $251 = $246 >>> 8;
     $252 = ($251|0)==(0);
     if ($252) {
      $idx$0$i = 0;
     } else {
      $253 = ($247>>>0)>(16777215);
      if ($253) {
       $idx$0$i = 31;
      } else {
       $254 = (($251) + 1048320)|0;
       $255 = $254 >>> 16;
       $256 = $255 & 8;
       $257 = $251 << $256;
       $258 = (($257) + 520192)|0;
       $259 = $258 >>> 16;
       $260 = $259 & 4;
       $261 = $260 | $256;
       $262 = $257 << $260;
       $263 = (($262) + 245760)|0;
       $264 = $263 >>> 16;
       $265 = $264 & 2;
       $266 = $261 | $265;
       $267 = (14 - ($266))|0;
       $268 = $262 << $265;
       $269 = $268 >>> 15;
       $270 = (($267) + ($269))|0;
       $271 = $270 << 1;
       $272 = (($270) + 7)|0;
       $273 = $247 >>> $272;
       $274 = $273 & 1;
       $275 = $274 | $271;
       $idx$0$i = $275;
      }
     }
     $276 = ((2152 + ($idx$0$i<<2)|0) + 304|0);
     $277 = HEAP32[$276>>2]|0;
     $278 = ($277|0)==(0|0);
     L9: do {
      if ($278) {
       $rsize$2$i = $250;$t$1$i = 0;$v$2$i = 0;
      } else {
       $279 = ($idx$0$i|0)==(31);
       if ($279) {
        $283 = 0;
       } else {
        $280 = $idx$0$i >>> 1;
        $281 = (25 - ($280))|0;
        $283 = $281;
       }
       $282 = $247 << $283;
       $rsize$0$i15 = $250;$rst$0$i = 0;$sizebits$0$i = $282;$t$0$i14 = $277;$v$0$i16 = 0;
       while(1) {
        $284 = (($t$0$i14) + 4|0);
        $285 = HEAP32[$284>>2]|0;
        $286 = $285 & -8;
        $287 = (($286) - ($247))|0;
        $288 = ($287>>>0)<($rsize$0$i15>>>0);
        if ($288) {
         $289 = ($286|0)==($247|0);
         if ($289) {
          $rsize$2$i = $287;$t$1$i = $t$0$i14;$v$2$i = $t$0$i14;
          break L9;
         } else {
          $rsize$1$i = $287;$v$1$i = $t$0$i14;
         }
        } else {
         $rsize$1$i = $rsize$0$i15;$v$1$i = $v$0$i16;
        }
        $290 = (($t$0$i14) + 20|0);
        $291 = HEAP32[$290>>2]|0;
        $292 = $sizebits$0$i >>> 31;
        $293 = ((($t$0$i14) + ($292<<2)|0) + 16|0);
        $294 = HEAP32[$293>>2]|0;
        $295 = ($291|0)==(0|0);
        $296 = ($291|0)==($294|0);
        $or$cond$i = $295 | $296;
        $rst$1$i = $or$cond$i ? $rst$0$i : $291;
        $297 = ($294|0)==(0|0);
        $298 = $sizebits$0$i << 1;
        if ($297) {
         $rsize$2$i = $rsize$1$i;$t$1$i = $rst$1$i;$v$2$i = $v$1$i;
         break;
        } else {
         $rsize$0$i15 = $rsize$1$i;$rst$0$i = $rst$1$i;$sizebits$0$i = $298;$t$0$i14 = $294;$v$0$i16 = $v$1$i;
        }
       }
      }
     } while(0);
     $299 = ($t$1$i|0)==(0|0);
     $300 = ($v$2$i|0)==(0|0);
     $or$cond19$i = $299 & $300;
     if ($or$cond19$i) {
      $301 = 2 << $idx$0$i;
      $302 = (0 - ($301))|0;
      $303 = $301 | $302;
      $304 = $248 & $303;
      $305 = ($304|0)==(0);
      if ($305) {
       $nb$0 = $247;
       break;
      }
      $306 = (0 - ($304))|0;
      $307 = $304 & $306;
      $308 = (($307) + -1)|0;
      $309 = $308 >>> 12;
      $310 = $309 & 16;
      $311 = $308 >>> $310;
      $312 = $311 >>> 5;
      $313 = $312 & 8;
      $314 = $313 | $310;
      $315 = $311 >>> $313;
      $316 = $315 >>> 2;
      $317 = $316 & 4;
      $318 = $314 | $317;
      $319 = $315 >>> $317;
      $320 = $319 >>> 1;
      $321 = $320 & 2;
      $322 = $318 | $321;
      $323 = $319 >>> $321;
      $324 = $323 >>> 1;
      $325 = $324 & 1;
      $326 = $322 | $325;
      $327 = $323 >>> $325;
      $328 = (($326) + ($327))|0;
      $329 = ((2152 + ($328<<2)|0) + 304|0);
      $330 = HEAP32[$329>>2]|0;
      $t$2$ph$i = $330;
     } else {
      $t$2$ph$i = $t$1$i;
     }
     $331 = ($t$2$ph$i|0)==(0|0);
     if ($331) {
      $rsize$3$lcssa$i = $rsize$2$i;$v$3$lcssa$i = $v$2$i;
     } else {
      $rsize$329$i = $rsize$2$i;$t$228$i = $t$2$ph$i;$v$330$i = $v$2$i;
      while(1) {
       $332 = (($t$228$i) + 4|0);
       $333 = HEAP32[$332>>2]|0;
       $334 = $333 & -8;
       $335 = (($334) - ($247))|0;
       $336 = ($335>>>0)<($rsize$329$i>>>0);
       $$rsize$3$i = $336 ? $335 : $rsize$329$i;
       $t$2$v$3$i = $336 ? $t$228$i : $v$330$i;
       $337 = (($t$228$i) + 16|0);
       $338 = HEAP32[$337>>2]|0;
       $339 = ($338|0)==(0|0);
       if (!($339)) {
        $rsize$329$i = $$rsize$3$i;$t$228$i = $338;$v$330$i = $t$2$v$3$i;
        continue;
       }
       $340 = (($t$228$i) + 20|0);
       $341 = HEAP32[$340>>2]|0;
       $342 = ($341|0)==(0|0);
       if ($342) {
        $rsize$3$lcssa$i = $$rsize$3$i;$v$3$lcssa$i = $t$2$v$3$i;
        break;
       } else {
        $rsize$329$i = $$rsize$3$i;$t$228$i = $341;$v$330$i = $t$2$v$3$i;
       }
      }
     }
     $343 = ($v$3$lcssa$i|0)==(0|0);
     if ($343) {
      $nb$0 = $247;
     } else {
      $344 = HEAP32[((2152 + 8|0))>>2]|0;
      $345 = (($344) - ($247))|0;
      $346 = ($rsize$3$lcssa$i>>>0)<($345>>>0);
      if ($346) {
       $347 = HEAP32[((2152 + 16|0))>>2]|0;
       $348 = ($v$3$lcssa$i>>>0)<($347>>>0);
       if ($348) {
        _abort();
        // unreachable;
       }
       $349 = (($v$3$lcssa$i) + ($247)|0);
       $350 = ($v$3$lcssa$i>>>0)<($349>>>0);
       if (!($350)) {
        _abort();
        // unreachable;
       }
       $351 = (($v$3$lcssa$i) + 24|0);
       $352 = HEAP32[$351>>2]|0;
       $353 = (($v$3$lcssa$i) + 12|0);
       $354 = HEAP32[$353>>2]|0;
       $355 = ($354|0)==($v$3$lcssa$i|0);
       do {
        if ($355) {
         $365 = (($v$3$lcssa$i) + 20|0);
         $366 = HEAP32[$365>>2]|0;
         $367 = ($366|0)==(0|0);
         if ($367) {
          $368 = (($v$3$lcssa$i) + 16|0);
          $369 = HEAP32[$368>>2]|0;
          $370 = ($369|0)==(0|0);
          if ($370) {
           $R$1$i20 = 0;
           break;
          } else {
           $R$0$i18 = $369;$RP$0$i17 = $368;
          }
         } else {
          $R$0$i18 = $366;$RP$0$i17 = $365;
         }
         while(1) {
          $371 = (($R$0$i18) + 20|0);
          $372 = HEAP32[$371>>2]|0;
          $373 = ($372|0)==(0|0);
          if (!($373)) {
           $R$0$i18 = $372;$RP$0$i17 = $371;
           continue;
          }
          $374 = (($R$0$i18) + 16|0);
          $375 = HEAP32[$374>>2]|0;
          $376 = ($375|0)==(0|0);
          if ($376) {
           break;
          } else {
           $R$0$i18 = $375;$RP$0$i17 = $374;
          }
         }
         $377 = ($RP$0$i17>>>0)<($347>>>0);
         if ($377) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$RP$0$i17>>2] = 0;
          $R$1$i20 = $R$0$i18;
          break;
         }
        } else {
         $356 = (($v$3$lcssa$i) + 8|0);
         $357 = HEAP32[$356>>2]|0;
         $358 = ($357>>>0)<($347>>>0);
         if ($358) {
          _abort();
          // unreachable;
         }
         $359 = (($357) + 12|0);
         $360 = HEAP32[$359>>2]|0;
         $361 = ($360|0)==($v$3$lcssa$i|0);
         if (!($361)) {
          _abort();
          // unreachable;
         }
         $362 = (($354) + 8|0);
         $363 = HEAP32[$362>>2]|0;
         $364 = ($363|0)==($v$3$lcssa$i|0);
         if ($364) {
          HEAP32[$359>>2] = $354;
          HEAP32[$362>>2] = $357;
          $R$1$i20 = $354;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $378 = ($352|0)==(0|0);
       do {
        if (!($378)) {
         $379 = (($v$3$lcssa$i) + 28|0);
         $380 = HEAP32[$379>>2]|0;
         $381 = ((2152 + ($380<<2)|0) + 304|0);
         $382 = HEAP32[$381>>2]|0;
         $383 = ($v$3$lcssa$i|0)==($382|0);
         if ($383) {
          HEAP32[$381>>2] = $R$1$i20;
          $cond$i21 = ($R$1$i20|0)==(0|0);
          if ($cond$i21) {
           $384 = 1 << $380;
           $385 = $384 ^ -1;
           $386 = HEAP32[((2152 + 4|0))>>2]|0;
           $387 = $386 & $385;
           HEAP32[((2152 + 4|0))>>2] = $387;
           break;
          }
         } else {
          $388 = HEAP32[((2152 + 16|0))>>2]|0;
          $389 = ($352>>>0)<($388>>>0);
          if ($389) {
           _abort();
           // unreachable;
          }
          $390 = (($352) + 16|0);
          $391 = HEAP32[$390>>2]|0;
          $392 = ($391|0)==($v$3$lcssa$i|0);
          if ($392) {
           HEAP32[$390>>2] = $R$1$i20;
          } else {
           $393 = (($352) + 20|0);
           HEAP32[$393>>2] = $R$1$i20;
          }
          $394 = ($R$1$i20|0)==(0|0);
          if ($394) {
           break;
          }
         }
         $395 = HEAP32[((2152 + 16|0))>>2]|0;
         $396 = ($R$1$i20>>>0)<($395>>>0);
         if ($396) {
          _abort();
          // unreachable;
         }
         $397 = (($R$1$i20) + 24|0);
         HEAP32[$397>>2] = $352;
         $398 = (($v$3$lcssa$i) + 16|0);
         $399 = HEAP32[$398>>2]|0;
         $400 = ($399|0)==(0|0);
         do {
          if (!($400)) {
           $401 = HEAP32[((2152 + 16|0))>>2]|0;
           $402 = ($399>>>0)<($401>>>0);
           if ($402) {
            _abort();
            // unreachable;
           } else {
            $403 = (($R$1$i20) + 16|0);
            HEAP32[$403>>2] = $399;
            $404 = (($399) + 24|0);
            HEAP32[$404>>2] = $R$1$i20;
            break;
           }
          }
         } while(0);
         $405 = (($v$3$lcssa$i) + 20|0);
         $406 = HEAP32[$405>>2]|0;
         $407 = ($406|0)==(0|0);
         if (!($407)) {
          $408 = HEAP32[((2152 + 16|0))>>2]|0;
          $409 = ($406>>>0)<($408>>>0);
          if ($409) {
           _abort();
           // unreachable;
          } else {
           $410 = (($R$1$i20) + 20|0);
           HEAP32[$410>>2] = $406;
           $411 = (($406) + 24|0);
           HEAP32[$411>>2] = $R$1$i20;
           break;
          }
         }
        }
       } while(0);
       $412 = ($rsize$3$lcssa$i>>>0)<(16);
       L87: do {
        if ($412) {
         $413 = (($rsize$3$lcssa$i) + ($247))|0;
         $414 = $413 | 3;
         $415 = (($v$3$lcssa$i) + 4|0);
         HEAP32[$415>>2] = $414;
         $$sum18$i = (($413) + 4)|0;
         $416 = (($v$3$lcssa$i) + ($$sum18$i)|0);
         $417 = HEAP32[$416>>2]|0;
         $418 = $417 | 1;
         HEAP32[$416>>2] = $418;
        } else {
         $419 = $247 | 3;
         $420 = (($v$3$lcssa$i) + 4|0);
         HEAP32[$420>>2] = $419;
         $421 = $rsize$3$lcssa$i | 1;
         $$sum$i2334 = $247 | 4;
         $422 = (($v$3$lcssa$i) + ($$sum$i2334)|0);
         HEAP32[$422>>2] = $421;
         $$sum1$i24 = (($rsize$3$lcssa$i) + ($247))|0;
         $423 = (($v$3$lcssa$i) + ($$sum1$i24)|0);
         HEAP32[$423>>2] = $rsize$3$lcssa$i;
         $424 = $rsize$3$lcssa$i >>> 3;
         $425 = ($rsize$3$lcssa$i>>>0)<(256);
         if ($425) {
          $426 = $424 << 1;
          $427 = ((2152 + ($426<<2)|0) + 40|0);
          $428 = HEAP32[2152>>2]|0;
          $429 = 1 << $424;
          $430 = $428 & $429;
          $431 = ($430|0)==(0);
          do {
           if ($431) {
            $432 = $428 | $429;
            HEAP32[2152>>2] = $432;
            $$sum14$pre$i = (($426) + 2)|0;
            $$pre$i25 = ((2152 + ($$sum14$pre$i<<2)|0) + 40|0);
            $$pre$phi$i26Z2D = $$pre$i25;$F5$0$i = $427;
           } else {
            $$sum17$i = (($426) + 2)|0;
            $433 = ((2152 + ($$sum17$i<<2)|0) + 40|0);
            $434 = HEAP32[$433>>2]|0;
            $435 = HEAP32[((2152 + 16|0))>>2]|0;
            $436 = ($434>>>0)<($435>>>0);
            if (!($436)) {
             $$pre$phi$i26Z2D = $433;$F5$0$i = $434;
             break;
            }
            _abort();
            // unreachable;
           }
          } while(0);
          HEAP32[$$pre$phi$i26Z2D>>2] = $349;
          $437 = (($F5$0$i) + 12|0);
          HEAP32[$437>>2] = $349;
          $$sum15$i = (($247) + 8)|0;
          $438 = (($v$3$lcssa$i) + ($$sum15$i)|0);
          HEAP32[$438>>2] = $F5$0$i;
          $$sum16$i = (($247) + 12)|0;
          $439 = (($v$3$lcssa$i) + ($$sum16$i)|0);
          HEAP32[$439>>2] = $427;
          break;
         }
         $440 = $rsize$3$lcssa$i >>> 8;
         $441 = ($440|0)==(0);
         if ($441) {
          $I7$0$i = 0;
         } else {
          $442 = ($rsize$3$lcssa$i>>>0)>(16777215);
          if ($442) {
           $I7$0$i = 31;
          } else {
           $443 = (($440) + 1048320)|0;
           $444 = $443 >>> 16;
           $445 = $444 & 8;
           $446 = $440 << $445;
           $447 = (($446) + 520192)|0;
           $448 = $447 >>> 16;
           $449 = $448 & 4;
           $450 = $449 | $445;
           $451 = $446 << $449;
           $452 = (($451) + 245760)|0;
           $453 = $452 >>> 16;
           $454 = $453 & 2;
           $455 = $450 | $454;
           $456 = (14 - ($455))|0;
           $457 = $451 << $454;
           $458 = $457 >>> 15;
           $459 = (($456) + ($458))|0;
           $460 = $459 << 1;
           $461 = (($459) + 7)|0;
           $462 = $rsize$3$lcssa$i >>> $461;
           $463 = $462 & 1;
           $464 = $463 | $460;
           $I7$0$i = $464;
          }
         }
         $465 = ((2152 + ($I7$0$i<<2)|0) + 304|0);
         $$sum2$i = (($247) + 28)|0;
         $466 = (($v$3$lcssa$i) + ($$sum2$i)|0);
         HEAP32[$466>>2] = $I7$0$i;
         $$sum3$i27 = (($247) + 16)|0;
         $467 = (($v$3$lcssa$i) + ($$sum3$i27)|0);
         $$sum4$i28 = (($247) + 20)|0;
         $468 = (($v$3$lcssa$i) + ($$sum4$i28)|0);
         HEAP32[$468>>2] = 0;
         HEAP32[$467>>2] = 0;
         $469 = HEAP32[((2152 + 4|0))>>2]|0;
         $470 = 1 << $I7$0$i;
         $471 = $469 & $470;
         $472 = ($471|0)==(0);
         if ($472) {
          $473 = $469 | $470;
          HEAP32[((2152 + 4|0))>>2] = $473;
          HEAP32[$465>>2] = $349;
          $$sum5$i = (($247) + 24)|0;
          $474 = (($v$3$lcssa$i) + ($$sum5$i)|0);
          HEAP32[$474>>2] = $465;
          $$sum6$i = (($247) + 12)|0;
          $475 = (($v$3$lcssa$i) + ($$sum6$i)|0);
          HEAP32[$475>>2] = $349;
          $$sum7$i = (($247) + 8)|0;
          $476 = (($v$3$lcssa$i) + ($$sum7$i)|0);
          HEAP32[$476>>2] = $349;
          break;
         }
         $477 = HEAP32[$465>>2]|0;
         $478 = ($I7$0$i|0)==(31);
         if ($478) {
          $486 = 0;
         } else {
          $479 = $I7$0$i >>> 1;
          $480 = (25 - ($479))|0;
          $486 = $480;
         }
         $481 = (($477) + 4|0);
         $482 = HEAP32[$481>>2]|0;
         $483 = $482 & -8;
         $484 = ($483|0)==($rsize$3$lcssa$i|0);
         L108: do {
          if ($484) {
           $T$0$lcssa$i = $477;
          } else {
           $485 = $rsize$3$lcssa$i << $486;
           $K12$025$i = $485;$T$024$i = $477;
           while(1) {
            $493 = $K12$025$i >>> 31;
            $494 = ((($T$024$i) + ($493<<2)|0) + 16|0);
            $489 = HEAP32[$494>>2]|0;
            $495 = ($489|0)==(0|0);
            if ($495) {
             break;
            }
            $487 = $K12$025$i << 1;
            $488 = (($489) + 4|0);
            $490 = HEAP32[$488>>2]|0;
            $491 = $490 & -8;
            $492 = ($491|0)==($rsize$3$lcssa$i|0);
            if ($492) {
             $T$0$lcssa$i = $489;
             break L108;
            } else {
             $K12$025$i = $487;$T$024$i = $489;
            }
           }
           $496 = HEAP32[((2152 + 16|0))>>2]|0;
           $497 = ($494>>>0)<($496>>>0);
           if ($497) {
            _abort();
            // unreachable;
           } else {
            HEAP32[$494>>2] = $349;
            $$sum11$i = (($247) + 24)|0;
            $498 = (($v$3$lcssa$i) + ($$sum11$i)|0);
            HEAP32[$498>>2] = $T$024$i;
            $$sum12$i = (($247) + 12)|0;
            $499 = (($v$3$lcssa$i) + ($$sum12$i)|0);
            HEAP32[$499>>2] = $349;
            $$sum13$i = (($247) + 8)|0;
            $500 = (($v$3$lcssa$i) + ($$sum13$i)|0);
            HEAP32[$500>>2] = $349;
            break L87;
           }
          }
         } while(0);
         $501 = (($T$0$lcssa$i) + 8|0);
         $502 = HEAP32[$501>>2]|0;
         $503 = HEAP32[((2152 + 16|0))>>2]|0;
         $504 = ($T$0$lcssa$i>>>0)<($503>>>0);
         if ($504) {
          _abort();
          // unreachable;
         }
         $505 = ($502>>>0)<($503>>>0);
         if ($505) {
          _abort();
          // unreachable;
         } else {
          $506 = (($502) + 12|0);
          HEAP32[$506>>2] = $349;
          HEAP32[$501>>2] = $349;
          $$sum8$i = (($247) + 8)|0;
          $507 = (($v$3$lcssa$i) + ($$sum8$i)|0);
          HEAP32[$507>>2] = $502;
          $$sum9$i = (($247) + 12)|0;
          $508 = (($v$3$lcssa$i) + ($$sum9$i)|0);
          HEAP32[$508>>2] = $T$0$lcssa$i;
          $$sum10$i = (($247) + 24)|0;
          $509 = (($v$3$lcssa$i) + ($$sum10$i)|0);
          HEAP32[$509>>2] = 0;
          break;
         }
        }
       } while(0);
       $510 = (($v$3$lcssa$i) + 8|0);
       $mem$0 = $510;
       STACKTOP = sp;return ($mem$0|0);
      } else {
       $nb$0 = $247;
      }
     }
    }
   }
  }
 } while(0);
 $511 = HEAP32[((2152 + 8|0))>>2]|0;
 $512 = ($nb$0>>>0)>($511>>>0);
 if (!($512)) {
  $513 = (($511) - ($nb$0))|0;
  $514 = HEAP32[((2152 + 20|0))>>2]|0;
  $515 = ($513>>>0)>(15);
  if ($515) {
   $516 = (($514) + ($nb$0)|0);
   HEAP32[((2152 + 20|0))>>2] = $516;
   HEAP32[((2152 + 8|0))>>2] = $513;
   $517 = $513 | 1;
   $$sum2 = (($nb$0) + 4)|0;
   $518 = (($514) + ($$sum2)|0);
   HEAP32[$518>>2] = $517;
   $519 = (($514) + ($511)|0);
   HEAP32[$519>>2] = $513;
   $520 = $nb$0 | 3;
   $521 = (($514) + 4|0);
   HEAP32[$521>>2] = $520;
  } else {
   HEAP32[((2152 + 8|0))>>2] = 0;
   HEAP32[((2152 + 20|0))>>2] = 0;
   $522 = $511 | 3;
   $523 = (($514) + 4|0);
   HEAP32[$523>>2] = $522;
   $$sum1 = (($511) + 4)|0;
   $524 = (($514) + ($$sum1)|0);
   $525 = HEAP32[$524>>2]|0;
   $526 = $525 | 1;
   HEAP32[$524>>2] = $526;
  }
  $527 = (($514) + 8|0);
  $mem$0 = $527;
  STACKTOP = sp;return ($mem$0|0);
 }
 $528 = HEAP32[((2152 + 12|0))>>2]|0;
 $529 = ($nb$0>>>0)<($528>>>0);
 if ($529) {
  $530 = (($528) - ($nb$0))|0;
  HEAP32[((2152 + 12|0))>>2] = $530;
  $531 = HEAP32[((2152 + 24|0))>>2]|0;
  $532 = (($531) + ($nb$0)|0);
  HEAP32[((2152 + 24|0))>>2] = $532;
  $533 = $530 | 1;
  $$sum = (($nb$0) + 4)|0;
  $534 = (($531) + ($$sum)|0);
  HEAP32[$534>>2] = $533;
  $535 = $nb$0 | 3;
  $536 = (($531) + 4|0);
  HEAP32[$536>>2] = $535;
  $537 = (($531) + 8|0);
  $mem$0 = $537;
  STACKTOP = sp;return ($mem$0|0);
 }
 $538 = HEAP32[2624>>2]|0;
 $539 = ($538|0)==(0);
 do {
  if ($539) {
   $540 = (_sysconf(30)|0);
   $541 = (($540) + -1)|0;
   $542 = $541 & $540;
   $543 = ($542|0)==(0);
   if ($543) {
    HEAP32[((2624 + 8|0))>>2] = $540;
    HEAP32[((2624 + 4|0))>>2] = $540;
    HEAP32[((2624 + 12|0))>>2] = -1;
    HEAP32[((2624 + 16|0))>>2] = -1;
    HEAP32[((2624 + 20|0))>>2] = 0;
    HEAP32[((2152 + 444|0))>>2] = 0;
    $544 = (_time((0|0))|0);
    $545 = $544 & -16;
    $546 = $545 ^ 1431655768;
    HEAP32[2624>>2] = $546;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $547 = (($nb$0) + 48)|0;
 $548 = HEAP32[((2624 + 8|0))>>2]|0;
 $549 = (($nb$0) + 47)|0;
 $550 = (($548) + ($549))|0;
 $551 = (0 - ($548))|0;
 $552 = $550 & $551;
 $553 = ($552>>>0)>($nb$0>>>0);
 if (!($553)) {
  $mem$0 = 0;
  STACKTOP = sp;return ($mem$0|0);
 }
 $554 = HEAP32[((2152 + 440|0))>>2]|0;
 $555 = ($554|0)==(0);
 if (!($555)) {
  $556 = HEAP32[((2152 + 432|0))>>2]|0;
  $557 = (($556) + ($552))|0;
  $558 = ($557>>>0)<=($556>>>0);
  $559 = ($557>>>0)>($554>>>0);
  $or$cond1$i = $558 | $559;
  if ($or$cond1$i) {
   $mem$0 = 0;
   STACKTOP = sp;return ($mem$0|0);
  }
 }
 $560 = HEAP32[((2152 + 444|0))>>2]|0;
 $561 = $560 & 4;
 $562 = ($561|0)==(0);
 L269: do {
  if ($562) {
   $563 = HEAP32[((2152 + 24|0))>>2]|0;
   $564 = ($563|0)==(0|0);
   L271: do {
    if ($564) {
     label = 182;
    } else {
     $sp$0$i$i = ((2152 + 448|0));
     while(1) {
      $565 = HEAP32[$sp$0$i$i>>2]|0;
      $566 = ($565>>>0)>($563>>>0);
      if (!($566)) {
       $567 = (($sp$0$i$i) + 4|0);
       $568 = HEAP32[$567>>2]|0;
       $569 = (($565) + ($568)|0);
       $570 = ($569>>>0)>($563>>>0);
       if ($570) {
        break;
       }
      }
      $571 = (($sp$0$i$i) + 8|0);
      $572 = HEAP32[$571>>2]|0;
      $573 = ($572|0)==(0|0);
      if ($573) {
       label = 182;
       break L271;
      } else {
       $sp$0$i$i = $572;
      }
     }
     $574 = ($sp$0$i$i|0)==(0|0);
     if ($574) {
      label = 182;
     } else {
      $597 = HEAP32[((2152 + 12|0))>>2]|0;
      $598 = (($550) - ($597))|0;
      $599 = $598 & $551;
      $600 = ($599>>>0)<(2147483647);
      if ($600) {
       $601 = (_sbrk(($599|0))|0);
       $602 = HEAP32[$sp$0$i$i>>2]|0;
       $603 = HEAP32[$567>>2]|0;
       $604 = (($602) + ($603)|0);
       $605 = ($601|0)==($604|0);
       $$3$i = $605 ? $599 : 0;
       $$4$i = $605 ? $601 : (-1);
       $br$0$i = $601;$ssize$1$i = $599;$tbase$0$i = $$4$i;$tsize$0$i = $$3$i;
       label = 191;
      } else {
       $tsize$0323841$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 182) {
     $575 = (_sbrk(0)|0);
     $576 = ($575|0)==((-1)|0);
     if ($576) {
      $tsize$0323841$i = 0;
     } else {
      $577 = $575;
      $578 = HEAP32[((2624 + 4|0))>>2]|0;
      $579 = (($578) + -1)|0;
      $580 = $579 & $577;
      $581 = ($580|0)==(0);
      if ($581) {
       $ssize$0$i = $552;
      } else {
       $582 = (($579) + ($577))|0;
       $583 = (0 - ($578))|0;
       $584 = $582 & $583;
       $585 = (($552) - ($577))|0;
       $586 = (($585) + ($584))|0;
       $ssize$0$i = $586;
      }
      $587 = HEAP32[((2152 + 432|0))>>2]|0;
      $588 = (($587) + ($ssize$0$i))|0;
      $589 = ($ssize$0$i>>>0)>($nb$0>>>0);
      $590 = ($ssize$0$i>>>0)<(2147483647);
      $or$cond$i29 = $589 & $590;
      if ($or$cond$i29) {
       $591 = HEAP32[((2152 + 440|0))>>2]|0;
       $592 = ($591|0)==(0);
       if (!($592)) {
        $593 = ($588>>>0)<=($587>>>0);
        $594 = ($588>>>0)>($591>>>0);
        $or$cond2$i = $593 | $594;
        if ($or$cond2$i) {
         $tsize$0323841$i = 0;
         break;
        }
       }
       $595 = (_sbrk(($ssize$0$i|0))|0);
       $596 = ($595|0)==($575|0);
       $ssize$0$$i = $596 ? $ssize$0$i : 0;
       $$$i = $596 ? $575 : (-1);
       $br$0$i = $595;$ssize$1$i = $ssize$0$i;$tbase$0$i = $$$i;$tsize$0$i = $ssize$0$$i;
       label = 191;
      } else {
       $tsize$0323841$i = 0;
      }
     }
    }
   } while(0);
   L291: do {
    if ((label|0) == 191) {
     $606 = (0 - ($ssize$1$i))|0;
     $607 = ($tbase$0$i|0)==((-1)|0);
     if (!($607)) {
      $tbase$247$i = $tbase$0$i;$tsize$246$i = $tsize$0$i;
      label = 202;
      break L269;
     }
     $608 = ($br$0$i|0)!=((-1)|0);
     $609 = ($ssize$1$i>>>0)<(2147483647);
     $or$cond5$i = $608 & $609;
     $610 = ($ssize$1$i>>>0)<($547>>>0);
     $or$cond6$i = $or$cond5$i & $610;
     do {
      if ($or$cond6$i) {
       $611 = HEAP32[((2624 + 8|0))>>2]|0;
       $612 = (($549) - ($ssize$1$i))|0;
       $613 = (($612) + ($611))|0;
       $614 = (0 - ($611))|0;
       $615 = $613 & $614;
       $616 = ($615>>>0)<(2147483647);
       if ($616) {
        $617 = (_sbrk(($615|0))|0);
        $618 = ($617|0)==((-1)|0);
        if ($618) {
         (_sbrk(($606|0))|0);
         $tsize$0323841$i = $tsize$0$i;
         break L291;
        } else {
         $619 = (($615) + ($ssize$1$i))|0;
         $ssize$2$i = $619;
         break;
        }
       } else {
        $ssize$2$i = $ssize$1$i;
       }
      } else {
       $ssize$2$i = $ssize$1$i;
      }
     } while(0);
     $620 = ($br$0$i|0)==((-1)|0);
     if ($620) {
      $tsize$0323841$i = $tsize$0$i;
     } else {
      $tbase$247$i = $br$0$i;$tsize$246$i = $ssize$2$i;
      label = 202;
      break L269;
     }
    }
   } while(0);
   $621 = HEAP32[((2152 + 444|0))>>2]|0;
   $622 = $621 | 4;
   HEAP32[((2152 + 444|0))>>2] = $622;
   $tsize$1$i = $tsize$0323841$i;
   label = 199;
  } else {
   $tsize$1$i = 0;
   label = 199;
  }
 } while(0);
 if ((label|0) == 199) {
  $623 = ($552>>>0)<(2147483647);
  if ($623) {
   $624 = (_sbrk(($552|0))|0);
   $625 = (_sbrk(0)|0);
   $notlhs$i = ($624|0)!=((-1)|0);
   $notrhs$i = ($625|0)!=((-1)|0);
   $or$cond8$not$i = $notrhs$i & $notlhs$i;
   $626 = ($624>>>0)<($625>>>0);
   $or$cond9$i = $or$cond8$not$i & $626;
   if ($or$cond9$i) {
    $627 = $625;
    $628 = $624;
    $629 = (($627) - ($628))|0;
    $630 = (($nb$0) + 40)|0;
    $631 = ($629>>>0)>($630>>>0);
    $$tsize$1$i = $631 ? $629 : $tsize$1$i;
    if ($631) {
     $tbase$247$i = $624;$tsize$246$i = $$tsize$1$i;
     label = 202;
    }
   }
  }
 }
 if ((label|0) == 202) {
  $632 = HEAP32[((2152 + 432|0))>>2]|0;
  $633 = (($632) + ($tsize$246$i))|0;
  HEAP32[((2152 + 432|0))>>2] = $633;
  $634 = HEAP32[((2152 + 436|0))>>2]|0;
  $635 = ($633>>>0)>($634>>>0);
  if ($635) {
   HEAP32[((2152 + 436|0))>>2] = $633;
  }
  $636 = HEAP32[((2152 + 24|0))>>2]|0;
  $637 = ($636|0)==(0|0);
  L311: do {
   if ($637) {
    $638 = HEAP32[((2152 + 16|0))>>2]|0;
    $639 = ($638|0)==(0|0);
    $640 = ($tbase$247$i>>>0)<($638>>>0);
    $or$cond10$i = $639 | $640;
    if ($or$cond10$i) {
     HEAP32[((2152 + 16|0))>>2] = $tbase$247$i;
    }
    HEAP32[((2152 + 448|0))>>2] = $tbase$247$i;
    HEAP32[((2152 + 452|0))>>2] = $tsize$246$i;
    HEAP32[((2152 + 460|0))>>2] = 0;
    $641 = HEAP32[2624>>2]|0;
    HEAP32[((2152 + 36|0))>>2] = $641;
    HEAP32[((2152 + 32|0))>>2] = -1;
    $i$02$i$i = 0;
    while(1) {
     $642 = $i$02$i$i << 1;
     $643 = ((2152 + ($642<<2)|0) + 40|0);
     $$sum$i$i = (($642) + 3)|0;
     $644 = ((2152 + ($$sum$i$i<<2)|0) + 40|0);
     HEAP32[$644>>2] = $643;
     $$sum1$i$i = (($642) + 2)|0;
     $645 = ((2152 + ($$sum1$i$i<<2)|0) + 40|0);
     HEAP32[$645>>2] = $643;
     $646 = (($i$02$i$i) + 1)|0;
     $exitcond$i$i = ($646|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $i$02$i$i = $646;
     }
    }
    $647 = (($tsize$246$i) + -40)|0;
    $648 = (($tbase$247$i) + 8|0);
    $649 = $648;
    $650 = $649 & 7;
    $651 = ($650|0)==(0);
    if ($651) {
     $655 = 0;
    } else {
     $652 = (0 - ($649))|0;
     $653 = $652 & 7;
     $655 = $653;
    }
    $654 = (($tbase$247$i) + ($655)|0);
    $656 = (($647) - ($655))|0;
    HEAP32[((2152 + 24|0))>>2] = $654;
    HEAP32[((2152 + 12|0))>>2] = $656;
    $657 = $656 | 1;
    $$sum$i14$i = (($655) + 4)|0;
    $658 = (($tbase$247$i) + ($$sum$i14$i)|0);
    HEAP32[$658>>2] = $657;
    $$sum2$i$i = (($tsize$246$i) + -36)|0;
    $659 = (($tbase$247$i) + ($$sum2$i$i)|0);
    HEAP32[$659>>2] = 40;
    $660 = HEAP32[((2624 + 16|0))>>2]|0;
    HEAP32[((2152 + 28|0))>>2] = $660;
   } else {
    $sp$075$i = ((2152 + 448|0));
    while(1) {
     $661 = HEAP32[$sp$075$i>>2]|0;
     $662 = (($sp$075$i) + 4|0);
     $663 = HEAP32[$662>>2]|0;
     $664 = (($661) + ($663)|0);
     $665 = ($tbase$247$i|0)==($664|0);
     if ($665) {
      label = 214;
      break;
     }
     $666 = (($sp$075$i) + 8|0);
     $667 = HEAP32[$666>>2]|0;
     $668 = ($667|0)==(0|0);
     if ($668) {
      break;
     } else {
      $sp$075$i = $667;
     }
    }
    if ((label|0) == 214) {
     $669 = (($sp$075$i) + 12|0);
     $670 = HEAP32[$669>>2]|0;
     $671 = $670 & 8;
     $672 = ($671|0)==(0);
     if ($672) {
      $673 = ($636>>>0)>=($661>>>0);
      $674 = ($636>>>0)<($tbase$247$i>>>0);
      $or$cond49$i = $673 & $674;
      if ($or$cond49$i) {
       $675 = (($663) + ($tsize$246$i))|0;
       HEAP32[$662>>2] = $675;
       $676 = HEAP32[((2152 + 12|0))>>2]|0;
       $677 = (($676) + ($tsize$246$i))|0;
       $678 = (($636) + 8|0);
       $679 = $678;
       $680 = $679 & 7;
       $681 = ($680|0)==(0);
       if ($681) {
        $685 = 0;
       } else {
        $682 = (0 - ($679))|0;
        $683 = $682 & 7;
        $685 = $683;
       }
       $684 = (($636) + ($685)|0);
       $686 = (($677) - ($685))|0;
       HEAP32[((2152 + 24|0))>>2] = $684;
       HEAP32[((2152 + 12|0))>>2] = $686;
       $687 = $686 | 1;
       $$sum$i18$i = (($685) + 4)|0;
       $688 = (($636) + ($$sum$i18$i)|0);
       HEAP32[$688>>2] = $687;
       $$sum2$i19$i = (($677) + 4)|0;
       $689 = (($636) + ($$sum2$i19$i)|0);
       HEAP32[$689>>2] = 40;
       $690 = HEAP32[((2624 + 16|0))>>2]|0;
       HEAP32[((2152 + 28|0))>>2] = $690;
       break;
      }
     }
    }
    $691 = HEAP32[((2152 + 16|0))>>2]|0;
    $692 = ($tbase$247$i>>>0)<($691>>>0);
    if ($692) {
     HEAP32[((2152 + 16|0))>>2] = $tbase$247$i;
    }
    $693 = (($tbase$247$i) + ($tsize$246$i)|0);
    $sp$168$i = ((2152 + 448|0));
    while(1) {
     $694 = HEAP32[$sp$168$i>>2]|0;
     $695 = ($694|0)==($693|0);
     if ($695) {
      label = 224;
      break;
     }
     $696 = (($sp$168$i) + 8|0);
     $697 = HEAP32[$696>>2]|0;
     $698 = ($697|0)==(0|0);
     if ($698) {
      break;
     } else {
      $sp$168$i = $697;
     }
    }
    if ((label|0) == 224) {
     $699 = (($sp$168$i) + 12|0);
     $700 = HEAP32[$699>>2]|0;
     $701 = $700 & 8;
     $702 = ($701|0)==(0);
     if ($702) {
      HEAP32[$sp$168$i>>2] = $tbase$247$i;
      $703 = (($sp$168$i) + 4|0);
      $704 = HEAP32[$703>>2]|0;
      $705 = (($704) + ($tsize$246$i))|0;
      HEAP32[$703>>2] = $705;
      $706 = (($tbase$247$i) + 8|0);
      $707 = $706;
      $708 = $707 & 7;
      $709 = ($708|0)==(0);
      if ($709) {
       $713 = 0;
      } else {
       $710 = (0 - ($707))|0;
       $711 = $710 & 7;
       $713 = $711;
      }
      $712 = (($tbase$247$i) + ($713)|0);
      $$sum107$i = (($tsize$246$i) + 8)|0;
      $714 = (($tbase$247$i) + ($$sum107$i)|0);
      $715 = $714;
      $716 = $715 & 7;
      $717 = ($716|0)==(0);
      if ($717) {
       $720 = 0;
      } else {
       $718 = (0 - ($715))|0;
       $719 = $718 & 7;
       $720 = $719;
      }
      $$sum108$i = (($720) + ($tsize$246$i))|0;
      $721 = (($tbase$247$i) + ($$sum108$i)|0);
      $722 = $721;
      $723 = $712;
      $724 = (($722) - ($723))|0;
      $$sum$i21$i = (($713) + ($nb$0))|0;
      $725 = (($tbase$247$i) + ($$sum$i21$i)|0);
      $726 = (($724) - ($nb$0))|0;
      $727 = $nb$0 | 3;
      $$sum1$i22$i = (($713) + 4)|0;
      $728 = (($tbase$247$i) + ($$sum1$i22$i)|0);
      HEAP32[$728>>2] = $727;
      $729 = HEAP32[((2152 + 24|0))>>2]|0;
      $730 = ($721|0)==($729|0);
      L348: do {
       if ($730) {
        $731 = HEAP32[((2152 + 12|0))>>2]|0;
        $732 = (($731) + ($726))|0;
        HEAP32[((2152 + 12|0))>>2] = $732;
        HEAP32[((2152 + 24|0))>>2] = $725;
        $733 = $732 | 1;
        $$sum42$i$i = (($$sum$i21$i) + 4)|0;
        $734 = (($tbase$247$i) + ($$sum42$i$i)|0);
        HEAP32[$734>>2] = $733;
       } else {
        $735 = HEAP32[((2152 + 20|0))>>2]|0;
        $736 = ($721|0)==($735|0);
        if ($736) {
         $737 = HEAP32[((2152 + 8|0))>>2]|0;
         $738 = (($737) + ($726))|0;
         HEAP32[((2152 + 8|0))>>2] = $738;
         HEAP32[((2152 + 20|0))>>2] = $725;
         $739 = $738 | 1;
         $$sum40$i$i = (($$sum$i21$i) + 4)|0;
         $740 = (($tbase$247$i) + ($$sum40$i$i)|0);
         HEAP32[$740>>2] = $739;
         $$sum41$i$i = (($738) + ($$sum$i21$i))|0;
         $741 = (($tbase$247$i) + ($$sum41$i$i)|0);
         HEAP32[$741>>2] = $738;
         break;
        }
        $$sum2$i23$i = (($tsize$246$i) + 4)|0;
        $$sum109$i = (($$sum2$i23$i) + ($720))|0;
        $742 = (($tbase$247$i) + ($$sum109$i)|0);
        $743 = HEAP32[$742>>2]|0;
        $744 = $743 & 3;
        $745 = ($744|0)==(1);
        if ($745) {
         $746 = $743 & -8;
         $747 = $743 >>> 3;
         $748 = ($743>>>0)<(256);
         L356: do {
          if ($748) {
           $$sum3738$i$i = $720 | 8;
           $$sum119$i = (($$sum3738$i$i) + ($tsize$246$i))|0;
           $749 = (($tbase$247$i) + ($$sum119$i)|0);
           $750 = HEAP32[$749>>2]|0;
           $$sum39$i$i = (($tsize$246$i) + 12)|0;
           $$sum120$i = (($$sum39$i$i) + ($720))|0;
           $751 = (($tbase$247$i) + ($$sum120$i)|0);
           $752 = HEAP32[$751>>2]|0;
           $753 = $747 << 1;
           $754 = ((2152 + ($753<<2)|0) + 40|0);
           $755 = ($750|0)==($754|0);
           do {
            if (!($755)) {
             $756 = HEAP32[((2152 + 16|0))>>2]|0;
             $757 = ($750>>>0)<($756>>>0);
             if ($757) {
              _abort();
              // unreachable;
             }
             $758 = (($750) + 12|0);
             $759 = HEAP32[$758>>2]|0;
             $760 = ($759|0)==($721|0);
             if ($760) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $761 = ($752|0)==($750|0);
           if ($761) {
            $762 = 1 << $747;
            $763 = $762 ^ -1;
            $764 = HEAP32[2152>>2]|0;
            $765 = $764 & $763;
            HEAP32[2152>>2] = $765;
            break;
           }
           $766 = ($752|0)==($754|0);
           do {
            if ($766) {
             $$pre57$i$i = (($752) + 8|0);
             $$pre$phi58$i$iZ2D = $$pre57$i$i;
            } else {
             $767 = HEAP32[((2152 + 16|0))>>2]|0;
             $768 = ($752>>>0)<($767>>>0);
             if ($768) {
              _abort();
              // unreachable;
             }
             $769 = (($752) + 8|0);
             $770 = HEAP32[$769>>2]|0;
             $771 = ($770|0)==($721|0);
             if ($771) {
              $$pre$phi58$i$iZ2D = $769;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $772 = (($750) + 12|0);
           HEAP32[$772>>2] = $752;
           HEAP32[$$pre$phi58$i$iZ2D>>2] = $750;
          } else {
           $$sum34$i$i = $720 | 24;
           $$sum110$i = (($$sum34$i$i) + ($tsize$246$i))|0;
           $773 = (($tbase$247$i) + ($$sum110$i)|0);
           $774 = HEAP32[$773>>2]|0;
           $$sum5$i$i = (($tsize$246$i) + 12)|0;
           $$sum111$i = (($$sum5$i$i) + ($720))|0;
           $775 = (($tbase$247$i) + ($$sum111$i)|0);
           $776 = HEAP32[$775>>2]|0;
           $777 = ($776|0)==($721|0);
           do {
            if ($777) {
             $$sum67$i$i = $720 | 16;
             $$sum117$i = (($$sum2$i23$i) + ($$sum67$i$i))|0;
             $788 = (($tbase$247$i) + ($$sum117$i)|0);
             $789 = HEAP32[$788>>2]|0;
             $790 = ($789|0)==(0|0);
             if ($790) {
              $$sum118$i = (($$sum67$i$i) + ($tsize$246$i))|0;
              $791 = (($tbase$247$i) + ($$sum118$i)|0);
              $792 = HEAP32[$791>>2]|0;
              $793 = ($792|0)==(0|0);
              if ($793) {
               $R$1$i$i = 0;
               break;
              } else {
               $R$0$i$i = $792;$RP$0$i$i = $791;
              }
             } else {
              $R$0$i$i = $789;$RP$0$i$i = $788;
             }
             while(1) {
              $794 = (($R$0$i$i) + 20|0);
              $795 = HEAP32[$794>>2]|0;
              $796 = ($795|0)==(0|0);
              if (!($796)) {
               $R$0$i$i = $795;$RP$0$i$i = $794;
               continue;
              }
              $797 = (($R$0$i$i) + 16|0);
              $798 = HEAP32[$797>>2]|0;
              $799 = ($798|0)==(0|0);
              if ($799) {
               break;
              } else {
               $R$0$i$i = $798;$RP$0$i$i = $797;
              }
             }
             $800 = HEAP32[((2152 + 16|0))>>2]|0;
             $801 = ($RP$0$i$i>>>0)<($800>>>0);
             if ($801) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$RP$0$i$i>>2] = 0;
              $R$1$i$i = $R$0$i$i;
              break;
             }
            } else {
             $$sum3536$i$i = $720 | 8;
             $$sum112$i = (($$sum3536$i$i) + ($tsize$246$i))|0;
             $778 = (($tbase$247$i) + ($$sum112$i)|0);
             $779 = HEAP32[$778>>2]|0;
             $780 = HEAP32[((2152 + 16|0))>>2]|0;
             $781 = ($779>>>0)<($780>>>0);
             if ($781) {
              _abort();
              // unreachable;
             }
             $782 = (($779) + 12|0);
             $783 = HEAP32[$782>>2]|0;
             $784 = ($783|0)==($721|0);
             if (!($784)) {
              _abort();
              // unreachable;
             }
             $785 = (($776) + 8|0);
             $786 = HEAP32[$785>>2]|0;
             $787 = ($786|0)==($721|0);
             if ($787) {
              HEAP32[$782>>2] = $776;
              HEAP32[$785>>2] = $779;
              $R$1$i$i = $776;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $802 = ($774|0)==(0|0);
           if ($802) {
            break;
           }
           $$sum30$i$i = (($tsize$246$i) + 28)|0;
           $$sum113$i = (($$sum30$i$i) + ($720))|0;
           $803 = (($tbase$247$i) + ($$sum113$i)|0);
           $804 = HEAP32[$803>>2]|0;
           $805 = ((2152 + ($804<<2)|0) + 304|0);
           $806 = HEAP32[$805>>2]|0;
           $807 = ($721|0)==($806|0);
           do {
            if ($807) {
             HEAP32[$805>>2] = $R$1$i$i;
             $cond$i$i = ($R$1$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $808 = 1 << $804;
             $809 = $808 ^ -1;
             $810 = HEAP32[((2152 + 4|0))>>2]|0;
             $811 = $810 & $809;
             HEAP32[((2152 + 4|0))>>2] = $811;
             break L356;
            } else {
             $812 = HEAP32[((2152 + 16|0))>>2]|0;
             $813 = ($774>>>0)<($812>>>0);
             if ($813) {
              _abort();
              // unreachable;
             }
             $814 = (($774) + 16|0);
             $815 = HEAP32[$814>>2]|0;
             $816 = ($815|0)==($721|0);
             if ($816) {
              HEAP32[$814>>2] = $R$1$i$i;
             } else {
              $817 = (($774) + 20|0);
              HEAP32[$817>>2] = $R$1$i$i;
             }
             $818 = ($R$1$i$i|0)==(0|0);
             if ($818) {
              break L356;
             }
            }
           } while(0);
           $819 = HEAP32[((2152 + 16|0))>>2]|0;
           $820 = ($R$1$i$i>>>0)<($819>>>0);
           if ($820) {
            _abort();
            // unreachable;
           }
           $821 = (($R$1$i$i) + 24|0);
           HEAP32[$821>>2] = $774;
           $$sum3132$i$i = $720 | 16;
           $$sum114$i = (($$sum3132$i$i) + ($tsize$246$i))|0;
           $822 = (($tbase$247$i) + ($$sum114$i)|0);
           $823 = HEAP32[$822>>2]|0;
           $824 = ($823|0)==(0|0);
           do {
            if (!($824)) {
             $825 = HEAP32[((2152 + 16|0))>>2]|0;
             $826 = ($823>>>0)<($825>>>0);
             if ($826) {
              _abort();
              // unreachable;
             } else {
              $827 = (($R$1$i$i) + 16|0);
              HEAP32[$827>>2] = $823;
              $828 = (($823) + 24|0);
              HEAP32[$828>>2] = $R$1$i$i;
              break;
             }
            }
           } while(0);
           $$sum115$i = (($$sum2$i23$i) + ($$sum3132$i$i))|0;
           $829 = (($tbase$247$i) + ($$sum115$i)|0);
           $830 = HEAP32[$829>>2]|0;
           $831 = ($830|0)==(0|0);
           if ($831) {
            break;
           }
           $832 = HEAP32[((2152 + 16|0))>>2]|0;
           $833 = ($830>>>0)<($832>>>0);
           if ($833) {
            _abort();
            // unreachable;
           } else {
            $834 = (($R$1$i$i) + 20|0);
            HEAP32[$834>>2] = $830;
            $835 = (($830) + 24|0);
            HEAP32[$835>>2] = $R$1$i$i;
            break;
           }
          }
         } while(0);
         $$sum9$i$i = $746 | $720;
         $$sum116$i = (($$sum9$i$i) + ($tsize$246$i))|0;
         $836 = (($tbase$247$i) + ($$sum116$i)|0);
         $837 = (($746) + ($726))|0;
         $oldfirst$0$i$i = $836;$qsize$0$i$i = $837;
        } else {
         $oldfirst$0$i$i = $721;$qsize$0$i$i = $726;
        }
        $838 = (($oldfirst$0$i$i) + 4|0);
        $839 = HEAP32[$838>>2]|0;
        $840 = $839 & -2;
        HEAP32[$838>>2] = $840;
        $841 = $qsize$0$i$i | 1;
        $$sum10$i$i = (($$sum$i21$i) + 4)|0;
        $842 = (($tbase$247$i) + ($$sum10$i$i)|0);
        HEAP32[$842>>2] = $841;
        $$sum11$i24$i = (($qsize$0$i$i) + ($$sum$i21$i))|0;
        $843 = (($tbase$247$i) + ($$sum11$i24$i)|0);
        HEAP32[$843>>2] = $qsize$0$i$i;
        $844 = $qsize$0$i$i >>> 3;
        $845 = ($qsize$0$i$i>>>0)<(256);
        if ($845) {
         $846 = $844 << 1;
         $847 = ((2152 + ($846<<2)|0) + 40|0);
         $848 = HEAP32[2152>>2]|0;
         $849 = 1 << $844;
         $850 = $848 & $849;
         $851 = ($850|0)==(0);
         do {
          if ($851) {
           $852 = $848 | $849;
           HEAP32[2152>>2] = $852;
           $$sum26$pre$i$i = (($846) + 2)|0;
           $$pre$i25$i = ((2152 + ($$sum26$pre$i$i<<2)|0) + 40|0);
           $$pre$phi$i26$iZ2D = $$pre$i25$i;$F4$0$i$i = $847;
          } else {
           $$sum29$i$i = (($846) + 2)|0;
           $853 = ((2152 + ($$sum29$i$i<<2)|0) + 40|0);
           $854 = HEAP32[$853>>2]|0;
           $855 = HEAP32[((2152 + 16|0))>>2]|0;
           $856 = ($854>>>0)<($855>>>0);
           if (!($856)) {
            $$pre$phi$i26$iZ2D = $853;$F4$0$i$i = $854;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i26$iZ2D>>2] = $725;
         $857 = (($F4$0$i$i) + 12|0);
         HEAP32[$857>>2] = $725;
         $$sum27$i$i = (($$sum$i21$i) + 8)|0;
         $858 = (($tbase$247$i) + ($$sum27$i$i)|0);
         HEAP32[$858>>2] = $F4$0$i$i;
         $$sum28$i$i = (($$sum$i21$i) + 12)|0;
         $859 = (($tbase$247$i) + ($$sum28$i$i)|0);
         HEAP32[$859>>2] = $847;
         break;
        }
        $860 = $qsize$0$i$i >>> 8;
        $861 = ($860|0)==(0);
        do {
         if ($861) {
          $I7$0$i$i = 0;
         } else {
          $862 = ($qsize$0$i$i>>>0)>(16777215);
          if ($862) {
           $I7$0$i$i = 31;
           break;
          }
          $863 = (($860) + 1048320)|0;
          $864 = $863 >>> 16;
          $865 = $864 & 8;
          $866 = $860 << $865;
          $867 = (($866) + 520192)|0;
          $868 = $867 >>> 16;
          $869 = $868 & 4;
          $870 = $869 | $865;
          $871 = $866 << $869;
          $872 = (($871) + 245760)|0;
          $873 = $872 >>> 16;
          $874 = $873 & 2;
          $875 = $870 | $874;
          $876 = (14 - ($875))|0;
          $877 = $871 << $874;
          $878 = $877 >>> 15;
          $879 = (($876) + ($878))|0;
          $880 = $879 << 1;
          $881 = (($879) + 7)|0;
          $882 = $qsize$0$i$i >>> $881;
          $883 = $882 & 1;
          $884 = $883 | $880;
          $I7$0$i$i = $884;
         }
        } while(0);
        $885 = ((2152 + ($I7$0$i$i<<2)|0) + 304|0);
        $$sum12$i$i = (($$sum$i21$i) + 28)|0;
        $886 = (($tbase$247$i) + ($$sum12$i$i)|0);
        HEAP32[$886>>2] = $I7$0$i$i;
        $$sum13$i$i = (($$sum$i21$i) + 16)|0;
        $887 = (($tbase$247$i) + ($$sum13$i$i)|0);
        $$sum14$i$i = (($$sum$i21$i) + 20)|0;
        $888 = (($tbase$247$i) + ($$sum14$i$i)|0);
        HEAP32[$888>>2] = 0;
        HEAP32[$887>>2] = 0;
        $889 = HEAP32[((2152 + 4|0))>>2]|0;
        $890 = 1 << $I7$0$i$i;
        $891 = $889 & $890;
        $892 = ($891|0)==(0);
        if ($892) {
         $893 = $889 | $890;
         HEAP32[((2152 + 4|0))>>2] = $893;
         HEAP32[$885>>2] = $725;
         $$sum15$i$i = (($$sum$i21$i) + 24)|0;
         $894 = (($tbase$247$i) + ($$sum15$i$i)|0);
         HEAP32[$894>>2] = $885;
         $$sum16$i$i = (($$sum$i21$i) + 12)|0;
         $895 = (($tbase$247$i) + ($$sum16$i$i)|0);
         HEAP32[$895>>2] = $725;
         $$sum17$i$i = (($$sum$i21$i) + 8)|0;
         $896 = (($tbase$247$i) + ($$sum17$i$i)|0);
         HEAP32[$896>>2] = $725;
         break;
        }
        $897 = HEAP32[$885>>2]|0;
        $898 = ($I7$0$i$i|0)==(31);
        if ($898) {
         $906 = 0;
        } else {
         $899 = $I7$0$i$i >>> 1;
         $900 = (25 - ($899))|0;
         $906 = $900;
        }
        $901 = (($897) + 4|0);
        $902 = HEAP32[$901>>2]|0;
        $903 = $902 & -8;
        $904 = ($903|0)==($qsize$0$i$i|0);
        L445: do {
         if ($904) {
          $T$0$lcssa$i28$i = $897;
         } else {
          $905 = $qsize$0$i$i << $906;
          $K8$052$i$i = $905;$T$051$i$i = $897;
          while(1) {
           $913 = $K8$052$i$i >>> 31;
           $914 = ((($T$051$i$i) + ($913<<2)|0) + 16|0);
           $909 = HEAP32[$914>>2]|0;
           $915 = ($909|0)==(0|0);
           if ($915) {
            break;
           }
           $907 = $K8$052$i$i << 1;
           $908 = (($909) + 4|0);
           $910 = HEAP32[$908>>2]|0;
           $911 = $910 & -8;
           $912 = ($911|0)==($qsize$0$i$i|0);
           if ($912) {
            $T$0$lcssa$i28$i = $909;
            break L445;
           } else {
            $K8$052$i$i = $907;$T$051$i$i = $909;
           }
          }
          $916 = HEAP32[((2152 + 16|0))>>2]|0;
          $917 = ($914>>>0)<($916>>>0);
          if ($917) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$914>>2] = $725;
           $$sum23$i$i = (($$sum$i21$i) + 24)|0;
           $918 = (($tbase$247$i) + ($$sum23$i$i)|0);
           HEAP32[$918>>2] = $T$051$i$i;
           $$sum24$i$i = (($$sum$i21$i) + 12)|0;
           $919 = (($tbase$247$i) + ($$sum24$i$i)|0);
           HEAP32[$919>>2] = $725;
           $$sum25$i$i = (($$sum$i21$i) + 8)|0;
           $920 = (($tbase$247$i) + ($$sum25$i$i)|0);
           HEAP32[$920>>2] = $725;
           break L348;
          }
         }
        } while(0);
        $921 = (($T$0$lcssa$i28$i) + 8|0);
        $922 = HEAP32[$921>>2]|0;
        $923 = HEAP32[((2152 + 16|0))>>2]|0;
        $924 = ($T$0$lcssa$i28$i>>>0)<($923>>>0);
        if ($924) {
         _abort();
         // unreachable;
        }
        $925 = ($922>>>0)<($923>>>0);
        if ($925) {
         _abort();
         // unreachable;
        } else {
         $926 = (($922) + 12|0);
         HEAP32[$926>>2] = $725;
         HEAP32[$921>>2] = $725;
         $$sum20$i$i = (($$sum$i21$i) + 8)|0;
         $927 = (($tbase$247$i) + ($$sum20$i$i)|0);
         HEAP32[$927>>2] = $922;
         $$sum21$i$i = (($$sum$i21$i) + 12)|0;
         $928 = (($tbase$247$i) + ($$sum21$i$i)|0);
         HEAP32[$928>>2] = $T$0$lcssa$i28$i;
         $$sum22$i$i = (($$sum$i21$i) + 24)|0;
         $929 = (($tbase$247$i) + ($$sum22$i$i)|0);
         HEAP32[$929>>2] = 0;
         break;
        }
       }
      } while(0);
      $$sum1819$i$i = $713 | 8;
      $930 = (($tbase$247$i) + ($$sum1819$i$i)|0);
      $mem$0 = $930;
      STACKTOP = sp;return ($mem$0|0);
     }
    }
    $sp$0$i$i$i = ((2152 + 448|0));
    while(1) {
     $931 = HEAP32[$sp$0$i$i$i>>2]|0;
     $932 = ($931>>>0)>($636>>>0);
     if (!($932)) {
      $933 = (($sp$0$i$i$i) + 4|0);
      $934 = HEAP32[$933>>2]|0;
      $935 = (($931) + ($934)|0);
      $936 = ($935>>>0)>($636>>>0);
      if ($936) {
       break;
      }
     }
     $937 = (($sp$0$i$i$i) + 8|0);
     $938 = HEAP32[$937>>2]|0;
     $sp$0$i$i$i = $938;
    }
    $$sum$i15$i = (($934) + -47)|0;
    $$sum1$i16$i = (($934) + -39)|0;
    $939 = (($931) + ($$sum1$i16$i)|0);
    $940 = $939;
    $941 = $940 & 7;
    $942 = ($941|0)==(0);
    if ($942) {
     $945 = 0;
    } else {
     $943 = (0 - ($940))|0;
     $944 = $943 & 7;
     $945 = $944;
    }
    $$sum2$i17$i = (($$sum$i15$i) + ($945))|0;
    $946 = (($931) + ($$sum2$i17$i)|0);
    $947 = (($636) + 16|0);
    $948 = ($946>>>0)<($947>>>0);
    $949 = $948 ? $636 : $946;
    $950 = (($949) + 8|0);
    $951 = (($tsize$246$i) + -40)|0;
    $952 = (($tbase$247$i) + 8|0);
    $953 = $952;
    $954 = $953 & 7;
    $955 = ($954|0)==(0);
    if ($955) {
     $959 = 0;
    } else {
     $956 = (0 - ($953))|0;
     $957 = $956 & 7;
     $959 = $957;
    }
    $958 = (($tbase$247$i) + ($959)|0);
    $960 = (($951) - ($959))|0;
    HEAP32[((2152 + 24|0))>>2] = $958;
    HEAP32[((2152 + 12|0))>>2] = $960;
    $961 = $960 | 1;
    $$sum$i$i$i = (($959) + 4)|0;
    $962 = (($tbase$247$i) + ($$sum$i$i$i)|0);
    HEAP32[$962>>2] = $961;
    $$sum2$i$i$i = (($tsize$246$i) + -36)|0;
    $963 = (($tbase$247$i) + ($$sum2$i$i$i)|0);
    HEAP32[$963>>2] = 40;
    $964 = HEAP32[((2624 + 16|0))>>2]|0;
    HEAP32[((2152 + 28|0))>>2] = $964;
    $965 = (($949) + 4|0);
    HEAP32[$965>>2] = 27;
    ;HEAP32[$950+0>>2]=HEAP32[((2152 + 448|0))+0>>2]|0;HEAP32[$950+4>>2]=HEAP32[((2152 + 448|0))+4>>2]|0;HEAP32[$950+8>>2]=HEAP32[((2152 + 448|0))+8>>2]|0;HEAP32[$950+12>>2]=HEAP32[((2152 + 448|0))+12>>2]|0;
    HEAP32[((2152 + 448|0))>>2] = $tbase$247$i;
    HEAP32[((2152 + 452|0))>>2] = $tsize$246$i;
    HEAP32[((2152 + 460|0))>>2] = 0;
    HEAP32[((2152 + 456|0))>>2] = $950;
    $966 = (($949) + 28|0);
    HEAP32[$966>>2] = 7;
    $967 = (($949) + 32|0);
    $968 = ($967>>>0)<($935>>>0);
    if ($968) {
     $970 = $966;
     while(1) {
      $969 = (($970) + 4|0);
      HEAP32[$969>>2] = 7;
      $971 = (($970) + 8|0);
      $972 = ($971>>>0)<($935>>>0);
      if ($972) {
       $970 = $969;
      } else {
       break;
      }
     }
    }
    $973 = ($949|0)==($636|0);
    if (!($973)) {
     $974 = $949;
     $975 = $636;
     $976 = (($974) - ($975))|0;
     $977 = (($636) + ($976)|0);
     $$sum3$i$i = (($976) + 4)|0;
     $978 = (($636) + ($$sum3$i$i)|0);
     $979 = HEAP32[$978>>2]|0;
     $980 = $979 & -2;
     HEAP32[$978>>2] = $980;
     $981 = $976 | 1;
     $982 = (($636) + 4|0);
     HEAP32[$982>>2] = $981;
     HEAP32[$977>>2] = $976;
     $983 = $976 >>> 3;
     $984 = ($976>>>0)<(256);
     if ($984) {
      $985 = $983 << 1;
      $986 = ((2152 + ($985<<2)|0) + 40|0);
      $987 = HEAP32[2152>>2]|0;
      $988 = 1 << $983;
      $989 = $987 & $988;
      $990 = ($989|0)==(0);
      do {
       if ($990) {
        $991 = $987 | $988;
        HEAP32[2152>>2] = $991;
        $$sum10$pre$i$i = (($985) + 2)|0;
        $$pre$i$i = ((2152 + ($$sum10$pre$i$i<<2)|0) + 40|0);
        $$pre$phi$i$iZ2D = $$pre$i$i;$F$0$i$i = $986;
       } else {
        $$sum11$i$i = (($985) + 2)|0;
        $992 = ((2152 + ($$sum11$i$i<<2)|0) + 40|0);
        $993 = HEAP32[$992>>2]|0;
        $994 = HEAP32[((2152 + 16|0))>>2]|0;
        $995 = ($993>>>0)<($994>>>0);
        if (!($995)) {
         $$pre$phi$i$iZ2D = $992;$F$0$i$i = $993;
         break;
        }
        _abort();
        // unreachable;
       }
      } while(0);
      HEAP32[$$pre$phi$i$iZ2D>>2] = $636;
      $996 = (($F$0$i$i) + 12|0);
      HEAP32[$996>>2] = $636;
      $997 = (($636) + 8|0);
      HEAP32[$997>>2] = $F$0$i$i;
      $998 = (($636) + 12|0);
      HEAP32[$998>>2] = $986;
      break;
     }
     $999 = $976 >>> 8;
     $1000 = ($999|0)==(0);
     if ($1000) {
      $I1$0$i$i = 0;
     } else {
      $1001 = ($976>>>0)>(16777215);
      if ($1001) {
       $I1$0$i$i = 31;
      } else {
       $1002 = (($999) + 1048320)|0;
       $1003 = $1002 >>> 16;
       $1004 = $1003 & 8;
       $1005 = $999 << $1004;
       $1006 = (($1005) + 520192)|0;
       $1007 = $1006 >>> 16;
       $1008 = $1007 & 4;
       $1009 = $1008 | $1004;
       $1010 = $1005 << $1008;
       $1011 = (($1010) + 245760)|0;
       $1012 = $1011 >>> 16;
       $1013 = $1012 & 2;
       $1014 = $1009 | $1013;
       $1015 = (14 - ($1014))|0;
       $1016 = $1010 << $1013;
       $1017 = $1016 >>> 15;
       $1018 = (($1015) + ($1017))|0;
       $1019 = $1018 << 1;
       $1020 = (($1018) + 7)|0;
       $1021 = $976 >>> $1020;
       $1022 = $1021 & 1;
       $1023 = $1022 | $1019;
       $I1$0$i$i = $1023;
      }
     }
     $1024 = ((2152 + ($I1$0$i$i<<2)|0) + 304|0);
     $1025 = (($636) + 28|0);
     $I1$0$c$i$i = $I1$0$i$i;
     HEAP32[$1025>>2] = $I1$0$c$i$i;
     $1026 = (($636) + 20|0);
     HEAP32[$1026>>2] = 0;
     $1027 = (($636) + 16|0);
     HEAP32[$1027>>2] = 0;
     $1028 = HEAP32[((2152 + 4|0))>>2]|0;
     $1029 = 1 << $I1$0$i$i;
     $1030 = $1028 & $1029;
     $1031 = ($1030|0)==(0);
     if ($1031) {
      $1032 = $1028 | $1029;
      HEAP32[((2152 + 4|0))>>2] = $1032;
      HEAP32[$1024>>2] = $636;
      $1033 = (($636) + 24|0);
      HEAP32[$1033>>2] = $1024;
      $1034 = (($636) + 12|0);
      HEAP32[$1034>>2] = $636;
      $1035 = (($636) + 8|0);
      HEAP32[$1035>>2] = $636;
      break;
     }
     $1036 = HEAP32[$1024>>2]|0;
     $1037 = ($I1$0$i$i|0)==(31);
     if ($1037) {
      $1045 = 0;
     } else {
      $1038 = $I1$0$i$i >>> 1;
      $1039 = (25 - ($1038))|0;
      $1045 = $1039;
     }
     $1040 = (($1036) + 4|0);
     $1041 = HEAP32[$1040>>2]|0;
     $1042 = $1041 & -8;
     $1043 = ($1042|0)==($976|0);
     L499: do {
      if ($1043) {
       $T$0$lcssa$i$i = $1036;
      } else {
       $1044 = $976 << $1045;
       $K2$014$i$i = $1044;$T$013$i$i = $1036;
       while(1) {
        $1052 = $K2$014$i$i >>> 31;
        $1053 = ((($T$013$i$i) + ($1052<<2)|0) + 16|0);
        $1048 = HEAP32[$1053>>2]|0;
        $1054 = ($1048|0)==(0|0);
        if ($1054) {
         break;
        }
        $1046 = $K2$014$i$i << 1;
        $1047 = (($1048) + 4|0);
        $1049 = HEAP32[$1047>>2]|0;
        $1050 = $1049 & -8;
        $1051 = ($1050|0)==($976|0);
        if ($1051) {
         $T$0$lcssa$i$i = $1048;
         break L499;
        } else {
         $K2$014$i$i = $1046;$T$013$i$i = $1048;
        }
       }
       $1055 = HEAP32[((2152 + 16|0))>>2]|0;
       $1056 = ($1053>>>0)<($1055>>>0);
       if ($1056) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$1053>>2] = $636;
        $1057 = (($636) + 24|0);
        HEAP32[$1057>>2] = $T$013$i$i;
        $1058 = (($636) + 12|0);
        HEAP32[$1058>>2] = $636;
        $1059 = (($636) + 8|0);
        HEAP32[$1059>>2] = $636;
        break L311;
       }
      }
     } while(0);
     $1060 = (($T$0$lcssa$i$i) + 8|0);
     $1061 = HEAP32[$1060>>2]|0;
     $1062 = HEAP32[((2152 + 16|0))>>2]|0;
     $1063 = ($T$0$lcssa$i$i>>>0)<($1062>>>0);
     if ($1063) {
      _abort();
      // unreachable;
     }
     $1064 = ($1061>>>0)<($1062>>>0);
     if ($1064) {
      _abort();
      // unreachable;
     } else {
      $1065 = (($1061) + 12|0);
      HEAP32[$1065>>2] = $636;
      HEAP32[$1060>>2] = $636;
      $1066 = (($636) + 8|0);
      HEAP32[$1066>>2] = $1061;
      $1067 = (($636) + 12|0);
      HEAP32[$1067>>2] = $T$0$lcssa$i$i;
      $1068 = (($636) + 24|0);
      HEAP32[$1068>>2] = 0;
      break;
     }
    }
   }
  } while(0);
  $1069 = HEAP32[((2152 + 12|0))>>2]|0;
  $1070 = ($1069>>>0)>($nb$0>>>0);
  if ($1070) {
   $1071 = (($1069) - ($nb$0))|0;
   HEAP32[((2152 + 12|0))>>2] = $1071;
   $1072 = HEAP32[((2152 + 24|0))>>2]|0;
   $1073 = (($1072) + ($nb$0)|0);
   HEAP32[((2152 + 24|0))>>2] = $1073;
   $1074 = $1071 | 1;
   $$sum$i32 = (($nb$0) + 4)|0;
   $1075 = (($1072) + ($$sum$i32)|0);
   HEAP32[$1075>>2] = $1074;
   $1076 = $nb$0 | 3;
   $1077 = (($1072) + 4|0);
   HEAP32[$1077>>2] = $1076;
   $1078 = (($1072) + 8|0);
   $mem$0 = $1078;
   STACKTOP = sp;return ($mem$0|0);
  }
 }
 $1079 = (___errno_location()|0);
 HEAP32[$1079>>2] = 12;
 $mem$0 = 0;
 STACKTOP = sp;return ($mem$0|0);
}
function _free($mem) {
 $mem = $mem|0;
 var $$pre = 0, $$pre$phi68Z2D = 0, $$pre$phi70Z2D = 0, $$pre$phiZ2D = 0, $$pre67 = 0, $$pre69 = 0, $$sum = 0, $$sum16$pre = 0, $$sum17 = 0, $$sum18 = 0, $$sum19 = 0, $$sum2 = 0, $$sum20 = 0, $$sum2324 = 0, $$sum25 = 0, $$sum26 = 0, $$sum28 = 0, $$sum29 = 0, $$sum3 = 0, $$sum30 = 0;
 var $$sum31 = 0, $$sum32 = 0, $$sum33 = 0, $$sum34 = 0, $$sum35 = 0, $$sum36 = 0, $$sum37 = 0, $$sum5 = 0, $$sum67 = 0, $$sum8 = 0, $$sum9 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0;
 var $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0;
 var $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0;
 var $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0;
 var $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0;
 var $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0;
 var $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0;
 var $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0;
 var $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0;
 var $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0;
 var $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0;
 var $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0;
 var $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0;
 var $322 = 0, $323 = 0, $324 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F16$0 = 0, $I18$0 = 0, $I18$0$c = 0, $K19$057 = 0;
 var $R$0 = 0, $R$1 = 0, $R7$0 = 0, $R7$1 = 0, $RP$0 = 0, $RP9$0 = 0, $T$0$lcssa = 0, $T$056 = 0, $cond = 0, $cond54 = 0, $p$0 = 0, $psize$0 = 0, $psize$1 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($mem|0)==(0|0);
 if ($0) {
  STACKTOP = sp;return;
 }
 $1 = (($mem) + -8|0);
 $2 = HEAP32[((2152 + 16|0))>>2]|0;
 $3 = ($1>>>0)<($2>>>0);
 if ($3) {
  _abort();
  // unreachable;
 }
 $4 = (($mem) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & 3;
 $7 = ($6|0)==(1);
 if ($7) {
  _abort();
  // unreachable;
 }
 $8 = $5 & -8;
 $$sum = (($8) + -8)|0;
 $9 = (($mem) + ($$sum)|0);
 $10 = $5 & 1;
 $11 = ($10|0)==(0);
 do {
  if ($11) {
   $12 = HEAP32[$1>>2]|0;
   $13 = ($6|0)==(0);
   if ($13) {
    STACKTOP = sp;return;
   }
   $$sum2 = (-8 - ($12))|0;
   $14 = (($mem) + ($$sum2)|0);
   $15 = (($12) + ($8))|0;
   $16 = ($14>>>0)<($2>>>0);
   if ($16) {
    _abort();
    // unreachable;
   }
   $17 = HEAP32[((2152 + 20|0))>>2]|0;
   $18 = ($14|0)==($17|0);
   if ($18) {
    $$sum3 = (($8) + -4)|0;
    $104 = (($mem) + ($$sum3)|0);
    $105 = HEAP32[$104>>2]|0;
    $106 = $105 & 3;
    $107 = ($106|0)==(3);
    if (!($107)) {
     $p$0 = $14;$psize$0 = $15;
     break;
    }
    HEAP32[((2152 + 8|0))>>2] = $15;
    $108 = HEAP32[$104>>2]|0;
    $109 = $108 & -2;
    HEAP32[$104>>2] = $109;
    $110 = $15 | 1;
    $$sum26 = (($$sum2) + 4)|0;
    $111 = (($mem) + ($$sum26)|0);
    HEAP32[$111>>2] = $110;
    HEAP32[$9>>2] = $15;
    STACKTOP = sp;return;
   }
   $19 = $12 >>> 3;
   $20 = ($12>>>0)<(256);
   if ($20) {
    $$sum36 = (($$sum2) + 8)|0;
    $21 = (($mem) + ($$sum36)|0);
    $22 = HEAP32[$21>>2]|0;
    $$sum37 = (($$sum2) + 12)|0;
    $23 = (($mem) + ($$sum37)|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = $19 << 1;
    $26 = ((2152 + ($25<<2)|0) + 40|0);
    $27 = ($22|0)==($26|0);
    if (!($27)) {
     $28 = ($22>>>0)<($2>>>0);
     if ($28) {
      _abort();
      // unreachable;
     }
     $29 = (($22) + 12|0);
     $30 = HEAP32[$29>>2]|0;
     $31 = ($30|0)==($14|0);
     if (!($31)) {
      _abort();
      // unreachable;
     }
    }
    $32 = ($24|0)==($22|0);
    if ($32) {
     $33 = 1 << $19;
     $34 = $33 ^ -1;
     $35 = HEAP32[2152>>2]|0;
     $36 = $35 & $34;
     HEAP32[2152>>2] = $36;
     $p$0 = $14;$psize$0 = $15;
     break;
    }
    $37 = ($24|0)==($26|0);
    if ($37) {
     $$pre69 = (($24) + 8|0);
     $$pre$phi70Z2D = $$pre69;
    } else {
     $38 = ($24>>>0)<($2>>>0);
     if ($38) {
      _abort();
      // unreachable;
     }
     $39 = (($24) + 8|0);
     $40 = HEAP32[$39>>2]|0;
     $41 = ($40|0)==($14|0);
     if ($41) {
      $$pre$phi70Z2D = $39;
     } else {
      _abort();
      // unreachable;
     }
    }
    $42 = (($22) + 12|0);
    HEAP32[$42>>2] = $24;
    HEAP32[$$pre$phi70Z2D>>2] = $22;
    $p$0 = $14;$psize$0 = $15;
    break;
   }
   $$sum28 = (($$sum2) + 24)|0;
   $43 = (($mem) + ($$sum28)|0);
   $44 = HEAP32[$43>>2]|0;
   $$sum29 = (($$sum2) + 12)|0;
   $45 = (($mem) + ($$sum29)|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ($46|0)==($14|0);
   do {
    if ($47) {
     $$sum31 = (($$sum2) + 20)|0;
     $57 = (($mem) + ($$sum31)|0);
     $58 = HEAP32[$57>>2]|0;
     $59 = ($58|0)==(0|0);
     if ($59) {
      $$sum30 = (($$sum2) + 16)|0;
      $60 = (($mem) + ($$sum30)|0);
      $61 = HEAP32[$60>>2]|0;
      $62 = ($61|0)==(0|0);
      if ($62) {
       $R$1 = 0;
       break;
      } else {
       $R$0 = $61;$RP$0 = $60;
      }
     } else {
      $R$0 = $58;$RP$0 = $57;
     }
     while(1) {
      $63 = (($R$0) + 20|0);
      $64 = HEAP32[$63>>2]|0;
      $65 = ($64|0)==(0|0);
      if (!($65)) {
       $R$0 = $64;$RP$0 = $63;
       continue;
      }
      $66 = (($R$0) + 16|0);
      $67 = HEAP32[$66>>2]|0;
      $68 = ($67|0)==(0|0);
      if ($68) {
       break;
      } else {
       $R$0 = $67;$RP$0 = $66;
      }
     }
     $69 = ($RP$0>>>0)<($2>>>0);
     if ($69) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$0>>2] = 0;
      $R$1 = $R$0;
      break;
     }
    } else {
     $$sum35 = (($$sum2) + 8)|0;
     $48 = (($mem) + ($$sum35)|0);
     $49 = HEAP32[$48>>2]|0;
     $50 = ($49>>>0)<($2>>>0);
     if ($50) {
      _abort();
      // unreachable;
     }
     $51 = (($49) + 12|0);
     $52 = HEAP32[$51>>2]|0;
     $53 = ($52|0)==($14|0);
     if (!($53)) {
      _abort();
      // unreachable;
     }
     $54 = (($46) + 8|0);
     $55 = HEAP32[$54>>2]|0;
     $56 = ($55|0)==($14|0);
     if ($56) {
      HEAP32[$51>>2] = $46;
      HEAP32[$54>>2] = $49;
      $R$1 = $46;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $70 = ($44|0)==(0|0);
   if ($70) {
    $p$0 = $14;$psize$0 = $15;
   } else {
    $$sum32 = (($$sum2) + 28)|0;
    $71 = (($mem) + ($$sum32)|0);
    $72 = HEAP32[$71>>2]|0;
    $73 = ((2152 + ($72<<2)|0) + 304|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = ($14|0)==($74|0);
    if ($75) {
     HEAP32[$73>>2] = $R$1;
     $cond = ($R$1|0)==(0|0);
     if ($cond) {
      $76 = 1 << $72;
      $77 = $76 ^ -1;
      $78 = HEAP32[((2152 + 4|0))>>2]|0;
      $79 = $78 & $77;
      HEAP32[((2152 + 4|0))>>2] = $79;
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    } else {
     $80 = HEAP32[((2152 + 16|0))>>2]|0;
     $81 = ($44>>>0)<($80>>>0);
     if ($81) {
      _abort();
      // unreachable;
     }
     $82 = (($44) + 16|0);
     $83 = HEAP32[$82>>2]|0;
     $84 = ($83|0)==($14|0);
     if ($84) {
      HEAP32[$82>>2] = $R$1;
     } else {
      $85 = (($44) + 20|0);
      HEAP32[$85>>2] = $R$1;
     }
     $86 = ($R$1|0)==(0|0);
     if ($86) {
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    }
    $87 = HEAP32[((2152 + 16|0))>>2]|0;
    $88 = ($R$1>>>0)<($87>>>0);
    if ($88) {
     _abort();
     // unreachable;
    }
    $89 = (($R$1) + 24|0);
    HEAP32[$89>>2] = $44;
    $$sum33 = (($$sum2) + 16)|0;
    $90 = (($mem) + ($$sum33)|0);
    $91 = HEAP32[$90>>2]|0;
    $92 = ($91|0)==(0|0);
    do {
     if (!($92)) {
      $93 = HEAP32[((2152 + 16|0))>>2]|0;
      $94 = ($91>>>0)<($93>>>0);
      if ($94) {
       _abort();
       // unreachable;
      } else {
       $95 = (($R$1) + 16|0);
       HEAP32[$95>>2] = $91;
       $96 = (($91) + 24|0);
       HEAP32[$96>>2] = $R$1;
       break;
      }
     }
    } while(0);
    $$sum34 = (($$sum2) + 20)|0;
    $97 = (($mem) + ($$sum34)|0);
    $98 = HEAP32[$97>>2]|0;
    $99 = ($98|0)==(0|0);
    if ($99) {
     $p$0 = $14;$psize$0 = $15;
    } else {
     $100 = HEAP32[((2152 + 16|0))>>2]|0;
     $101 = ($98>>>0)<($100>>>0);
     if ($101) {
      _abort();
      // unreachable;
     } else {
      $102 = (($R$1) + 20|0);
      HEAP32[$102>>2] = $98;
      $103 = (($98) + 24|0);
      HEAP32[$103>>2] = $R$1;
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    }
   }
  } else {
   $p$0 = $1;$psize$0 = $8;
  }
 } while(0);
 $112 = ($p$0>>>0)<($9>>>0);
 if (!($112)) {
  _abort();
  // unreachable;
 }
 $$sum25 = (($8) + -4)|0;
 $113 = (($mem) + ($$sum25)|0);
 $114 = HEAP32[$113>>2]|0;
 $115 = $114 & 1;
 $116 = ($115|0)==(0);
 if ($116) {
  _abort();
  // unreachable;
 }
 $117 = $114 & 2;
 $118 = ($117|0)==(0);
 if ($118) {
  $119 = HEAP32[((2152 + 24|0))>>2]|0;
  $120 = ($9|0)==($119|0);
  if ($120) {
   $121 = HEAP32[((2152 + 12|0))>>2]|0;
   $122 = (($121) + ($psize$0))|0;
   HEAP32[((2152 + 12|0))>>2] = $122;
   HEAP32[((2152 + 24|0))>>2] = $p$0;
   $123 = $122 | 1;
   $124 = (($p$0) + 4|0);
   HEAP32[$124>>2] = $123;
   $125 = HEAP32[((2152 + 20|0))>>2]|0;
   $126 = ($p$0|0)==($125|0);
   if (!($126)) {
    STACKTOP = sp;return;
   }
   HEAP32[((2152 + 20|0))>>2] = 0;
   HEAP32[((2152 + 8|0))>>2] = 0;
   STACKTOP = sp;return;
  }
  $127 = HEAP32[((2152 + 20|0))>>2]|0;
  $128 = ($9|0)==($127|0);
  if ($128) {
   $129 = HEAP32[((2152 + 8|0))>>2]|0;
   $130 = (($129) + ($psize$0))|0;
   HEAP32[((2152 + 8|0))>>2] = $130;
   HEAP32[((2152 + 20|0))>>2] = $p$0;
   $131 = $130 | 1;
   $132 = (($p$0) + 4|0);
   HEAP32[$132>>2] = $131;
   $133 = (($p$0) + ($130)|0);
   HEAP32[$133>>2] = $130;
   STACKTOP = sp;return;
  }
  $134 = $114 & -8;
  $135 = (($134) + ($psize$0))|0;
  $136 = $114 >>> 3;
  $137 = ($114>>>0)<(256);
  do {
   if ($137) {
    $138 = (($mem) + ($8)|0);
    $139 = HEAP32[$138>>2]|0;
    $$sum2324 = $8 | 4;
    $140 = (($mem) + ($$sum2324)|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = $136 << 1;
    $143 = ((2152 + ($142<<2)|0) + 40|0);
    $144 = ($139|0)==($143|0);
    if (!($144)) {
     $145 = HEAP32[((2152 + 16|0))>>2]|0;
     $146 = ($139>>>0)<($145>>>0);
     if ($146) {
      _abort();
      // unreachable;
     }
     $147 = (($139) + 12|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($148|0)==($9|0);
     if (!($149)) {
      _abort();
      // unreachable;
     }
    }
    $150 = ($141|0)==($139|0);
    if ($150) {
     $151 = 1 << $136;
     $152 = $151 ^ -1;
     $153 = HEAP32[2152>>2]|0;
     $154 = $153 & $152;
     HEAP32[2152>>2] = $154;
     break;
    }
    $155 = ($141|0)==($143|0);
    if ($155) {
     $$pre67 = (($141) + 8|0);
     $$pre$phi68Z2D = $$pre67;
    } else {
     $156 = HEAP32[((2152 + 16|0))>>2]|0;
     $157 = ($141>>>0)<($156>>>0);
     if ($157) {
      _abort();
      // unreachable;
     }
     $158 = (($141) + 8|0);
     $159 = HEAP32[$158>>2]|0;
     $160 = ($159|0)==($9|0);
     if ($160) {
      $$pre$phi68Z2D = $158;
     } else {
      _abort();
      // unreachable;
     }
    }
    $161 = (($139) + 12|0);
    HEAP32[$161>>2] = $141;
    HEAP32[$$pre$phi68Z2D>>2] = $139;
   } else {
    $$sum5 = (($8) + 16)|0;
    $162 = (($mem) + ($$sum5)|0);
    $163 = HEAP32[$162>>2]|0;
    $$sum67 = $8 | 4;
    $164 = (($mem) + ($$sum67)|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = ($165|0)==($9|0);
    do {
     if ($166) {
      $$sum9 = (($8) + 12)|0;
      $177 = (($mem) + ($$sum9)|0);
      $178 = HEAP32[$177>>2]|0;
      $179 = ($178|0)==(0|0);
      if ($179) {
       $$sum8 = (($8) + 8)|0;
       $180 = (($mem) + ($$sum8)|0);
       $181 = HEAP32[$180>>2]|0;
       $182 = ($181|0)==(0|0);
       if ($182) {
        $R7$1 = 0;
        break;
       } else {
        $R7$0 = $181;$RP9$0 = $180;
       }
      } else {
       $R7$0 = $178;$RP9$0 = $177;
      }
      while(1) {
       $183 = (($R7$0) + 20|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = ($184|0)==(0|0);
       if (!($185)) {
        $R7$0 = $184;$RP9$0 = $183;
        continue;
       }
       $186 = (($R7$0) + 16|0);
       $187 = HEAP32[$186>>2]|0;
       $188 = ($187|0)==(0|0);
       if ($188) {
        break;
       } else {
        $R7$0 = $187;$RP9$0 = $186;
       }
      }
      $189 = HEAP32[((2152 + 16|0))>>2]|0;
      $190 = ($RP9$0>>>0)<($189>>>0);
      if ($190) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP9$0>>2] = 0;
       $R7$1 = $R7$0;
       break;
      }
     } else {
      $167 = (($mem) + ($8)|0);
      $168 = HEAP32[$167>>2]|0;
      $169 = HEAP32[((2152 + 16|0))>>2]|0;
      $170 = ($168>>>0)<($169>>>0);
      if ($170) {
       _abort();
       // unreachable;
      }
      $171 = (($168) + 12|0);
      $172 = HEAP32[$171>>2]|0;
      $173 = ($172|0)==($9|0);
      if (!($173)) {
       _abort();
       // unreachable;
      }
      $174 = (($165) + 8|0);
      $175 = HEAP32[$174>>2]|0;
      $176 = ($175|0)==($9|0);
      if ($176) {
       HEAP32[$171>>2] = $165;
       HEAP32[$174>>2] = $168;
       $R7$1 = $165;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $191 = ($163|0)==(0|0);
    if (!($191)) {
     $$sum18 = (($8) + 20)|0;
     $192 = (($mem) + ($$sum18)|0);
     $193 = HEAP32[$192>>2]|0;
     $194 = ((2152 + ($193<<2)|0) + 304|0);
     $195 = HEAP32[$194>>2]|0;
     $196 = ($9|0)==($195|0);
     if ($196) {
      HEAP32[$194>>2] = $R7$1;
      $cond54 = ($R7$1|0)==(0|0);
      if ($cond54) {
       $197 = 1 << $193;
       $198 = $197 ^ -1;
       $199 = HEAP32[((2152 + 4|0))>>2]|0;
       $200 = $199 & $198;
       HEAP32[((2152 + 4|0))>>2] = $200;
       break;
      }
     } else {
      $201 = HEAP32[((2152 + 16|0))>>2]|0;
      $202 = ($163>>>0)<($201>>>0);
      if ($202) {
       _abort();
       // unreachable;
      }
      $203 = (($163) + 16|0);
      $204 = HEAP32[$203>>2]|0;
      $205 = ($204|0)==($9|0);
      if ($205) {
       HEAP32[$203>>2] = $R7$1;
      } else {
       $206 = (($163) + 20|0);
       HEAP32[$206>>2] = $R7$1;
      }
      $207 = ($R7$1|0)==(0|0);
      if ($207) {
       break;
      }
     }
     $208 = HEAP32[((2152 + 16|0))>>2]|0;
     $209 = ($R7$1>>>0)<($208>>>0);
     if ($209) {
      _abort();
      // unreachable;
     }
     $210 = (($R7$1) + 24|0);
     HEAP32[$210>>2] = $163;
     $$sum19 = (($8) + 8)|0;
     $211 = (($mem) + ($$sum19)|0);
     $212 = HEAP32[$211>>2]|0;
     $213 = ($212|0)==(0|0);
     do {
      if (!($213)) {
       $214 = HEAP32[((2152 + 16|0))>>2]|0;
       $215 = ($212>>>0)<($214>>>0);
       if ($215) {
        _abort();
        // unreachable;
       } else {
        $216 = (($R7$1) + 16|0);
        HEAP32[$216>>2] = $212;
        $217 = (($212) + 24|0);
        HEAP32[$217>>2] = $R7$1;
        break;
       }
      }
     } while(0);
     $$sum20 = (($8) + 12)|0;
     $218 = (($mem) + ($$sum20)|0);
     $219 = HEAP32[$218>>2]|0;
     $220 = ($219|0)==(0|0);
     if (!($220)) {
      $221 = HEAP32[((2152 + 16|0))>>2]|0;
      $222 = ($219>>>0)<($221>>>0);
      if ($222) {
       _abort();
       // unreachable;
      } else {
       $223 = (($R7$1) + 20|0);
       HEAP32[$223>>2] = $219;
       $224 = (($219) + 24|0);
       HEAP32[$224>>2] = $R7$1;
       break;
      }
     }
    }
   }
  } while(0);
  $225 = $135 | 1;
  $226 = (($p$0) + 4|0);
  HEAP32[$226>>2] = $225;
  $227 = (($p$0) + ($135)|0);
  HEAP32[$227>>2] = $135;
  $228 = HEAP32[((2152 + 20|0))>>2]|0;
  $229 = ($p$0|0)==($228|0);
  if ($229) {
   HEAP32[((2152 + 8|0))>>2] = $135;
   STACKTOP = sp;return;
  } else {
   $psize$1 = $135;
  }
 } else {
  $230 = $114 & -2;
  HEAP32[$113>>2] = $230;
  $231 = $psize$0 | 1;
  $232 = (($p$0) + 4|0);
  HEAP32[$232>>2] = $231;
  $233 = (($p$0) + ($psize$0)|0);
  HEAP32[$233>>2] = $psize$0;
  $psize$1 = $psize$0;
 }
 $234 = $psize$1 >>> 3;
 $235 = ($psize$1>>>0)<(256);
 if ($235) {
  $236 = $234 << 1;
  $237 = ((2152 + ($236<<2)|0) + 40|0);
  $238 = HEAP32[2152>>2]|0;
  $239 = 1 << $234;
  $240 = $238 & $239;
  $241 = ($240|0)==(0);
  if ($241) {
   $242 = $238 | $239;
   HEAP32[2152>>2] = $242;
   $$sum16$pre = (($236) + 2)|0;
   $$pre = ((2152 + ($$sum16$pre<<2)|0) + 40|0);
   $$pre$phiZ2D = $$pre;$F16$0 = $237;
  } else {
   $$sum17 = (($236) + 2)|0;
   $243 = ((2152 + ($$sum17<<2)|0) + 40|0);
   $244 = HEAP32[$243>>2]|0;
   $245 = HEAP32[((2152 + 16|0))>>2]|0;
   $246 = ($244>>>0)<($245>>>0);
   if ($246) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $243;$F16$0 = $244;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $p$0;
  $247 = (($F16$0) + 12|0);
  HEAP32[$247>>2] = $p$0;
  $248 = (($p$0) + 8|0);
  HEAP32[$248>>2] = $F16$0;
  $249 = (($p$0) + 12|0);
  HEAP32[$249>>2] = $237;
  STACKTOP = sp;return;
 }
 $250 = $psize$1 >>> 8;
 $251 = ($250|0)==(0);
 if ($251) {
  $I18$0 = 0;
 } else {
  $252 = ($psize$1>>>0)>(16777215);
  if ($252) {
   $I18$0 = 31;
  } else {
   $253 = (($250) + 1048320)|0;
   $254 = $253 >>> 16;
   $255 = $254 & 8;
   $256 = $250 << $255;
   $257 = (($256) + 520192)|0;
   $258 = $257 >>> 16;
   $259 = $258 & 4;
   $260 = $259 | $255;
   $261 = $256 << $259;
   $262 = (($261) + 245760)|0;
   $263 = $262 >>> 16;
   $264 = $263 & 2;
   $265 = $260 | $264;
   $266 = (14 - ($265))|0;
   $267 = $261 << $264;
   $268 = $267 >>> 15;
   $269 = (($266) + ($268))|0;
   $270 = $269 << 1;
   $271 = (($269) + 7)|0;
   $272 = $psize$1 >>> $271;
   $273 = $272 & 1;
   $274 = $273 | $270;
   $I18$0 = $274;
  }
 }
 $275 = ((2152 + ($I18$0<<2)|0) + 304|0);
 $276 = (($p$0) + 28|0);
 $I18$0$c = $I18$0;
 HEAP32[$276>>2] = $I18$0$c;
 $277 = (($p$0) + 20|0);
 HEAP32[$277>>2] = 0;
 $278 = (($p$0) + 16|0);
 HEAP32[$278>>2] = 0;
 $279 = HEAP32[((2152 + 4|0))>>2]|0;
 $280 = 1 << $I18$0;
 $281 = $279 & $280;
 $282 = ($281|0)==(0);
 L199: do {
  if ($282) {
   $283 = $279 | $280;
   HEAP32[((2152 + 4|0))>>2] = $283;
   HEAP32[$275>>2] = $p$0;
   $284 = (($p$0) + 24|0);
   HEAP32[$284>>2] = $275;
   $285 = (($p$0) + 12|0);
   HEAP32[$285>>2] = $p$0;
   $286 = (($p$0) + 8|0);
   HEAP32[$286>>2] = $p$0;
  } else {
   $287 = HEAP32[$275>>2]|0;
   $288 = ($I18$0|0)==(31);
   if ($288) {
    $296 = 0;
   } else {
    $289 = $I18$0 >>> 1;
    $290 = (25 - ($289))|0;
    $296 = $290;
   }
   $291 = (($287) + 4|0);
   $292 = HEAP32[$291>>2]|0;
   $293 = $292 & -8;
   $294 = ($293|0)==($psize$1|0);
   L204: do {
    if ($294) {
     $T$0$lcssa = $287;
    } else {
     $295 = $psize$1 << $296;
     $K19$057 = $295;$T$056 = $287;
     while(1) {
      $303 = $K19$057 >>> 31;
      $304 = ((($T$056) + ($303<<2)|0) + 16|0);
      $299 = HEAP32[$304>>2]|0;
      $305 = ($299|0)==(0|0);
      if ($305) {
       break;
      }
      $297 = $K19$057 << 1;
      $298 = (($299) + 4|0);
      $300 = HEAP32[$298>>2]|0;
      $301 = $300 & -8;
      $302 = ($301|0)==($psize$1|0);
      if ($302) {
       $T$0$lcssa = $299;
       break L204;
      } else {
       $K19$057 = $297;$T$056 = $299;
      }
     }
     $306 = HEAP32[((2152 + 16|0))>>2]|0;
     $307 = ($304>>>0)<($306>>>0);
     if ($307) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$304>>2] = $p$0;
      $308 = (($p$0) + 24|0);
      HEAP32[$308>>2] = $T$056;
      $309 = (($p$0) + 12|0);
      HEAP32[$309>>2] = $p$0;
      $310 = (($p$0) + 8|0);
      HEAP32[$310>>2] = $p$0;
      break L199;
     }
    }
   } while(0);
   $311 = (($T$0$lcssa) + 8|0);
   $312 = HEAP32[$311>>2]|0;
   $313 = HEAP32[((2152 + 16|0))>>2]|0;
   $314 = ($T$0$lcssa>>>0)<($313>>>0);
   if ($314) {
    _abort();
    // unreachable;
   }
   $315 = ($312>>>0)<($313>>>0);
   if ($315) {
    _abort();
    // unreachable;
   } else {
    $316 = (($312) + 12|0);
    HEAP32[$316>>2] = $p$0;
    HEAP32[$311>>2] = $p$0;
    $317 = (($p$0) + 8|0);
    HEAP32[$317>>2] = $312;
    $318 = (($p$0) + 12|0);
    HEAP32[$318>>2] = $T$0$lcssa;
    $319 = (($p$0) + 24|0);
    HEAP32[$319>>2] = 0;
    break;
   }
  }
 } while(0);
 $320 = HEAP32[((2152 + 32|0))>>2]|0;
 $321 = (($320) + -1)|0;
 HEAP32[((2152 + 32|0))>>2] = $321;
 $322 = ($321|0)==(0);
 if ($322) {
  $sp$0$in$i = ((2152 + 456|0));
 } else {
  STACKTOP = sp;return;
 }
 while(1) {
  $sp$0$i = HEAP32[$sp$0$in$i>>2]|0;
  $323 = ($sp$0$i|0)==(0|0);
  $324 = (($sp$0$i) + 8|0);
  if ($323) {
   break;
  } else {
   $sp$0$in$i = $324;
  }
 }
 HEAP32[((2152 + 32|0))>>2] = -1;
 STACKTOP = sp;return;
}
function _realloc($oldmem,$bytes) {
 $oldmem = $oldmem|0;
 $bytes = $bytes|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $mem$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($oldmem|0)==(0|0);
 do {
  if ($0) {
   $1 = (_malloc($bytes)|0);
   $mem$0 = $1;
  } else {
   $2 = ($bytes>>>0)>(4294967231);
   if ($2) {
    $3 = (___errno_location()|0);
    HEAP32[$3>>2] = 12;
    $mem$0 = 0;
    break;
   }
   $4 = ($bytes>>>0)<(11);
   if ($4) {
    $8 = 16;
   } else {
    $5 = (($bytes) + 11)|0;
    $6 = $5 & -8;
    $8 = $6;
   }
   $7 = (($oldmem) + -8|0);
   $9 = (_try_realloc_chunk($7,$8)|0);
   $10 = ($9|0)==(0|0);
   if (!($10)) {
    $11 = (($9) + 8|0);
    $mem$0 = $11;
    break;
   }
   $12 = (_malloc($bytes)|0);
   $13 = ($12|0)==(0|0);
   if ($13) {
    $mem$0 = 0;
   } else {
    $14 = (($oldmem) + -4|0);
    $15 = HEAP32[$14>>2]|0;
    $16 = $15 & -8;
    $17 = $15 & 3;
    $18 = ($17|0)==(0);
    $19 = $18 ? 8 : 4;
    $20 = (($16) - ($19))|0;
    $21 = ($20>>>0)<($bytes>>>0);
    $22 = $21 ? $20 : $bytes;
    _memcpy(($12|0),($oldmem|0),($22|0))|0;
    _free($oldmem);
    $mem$0 = $12;
   }
  }
 } while(0);
 STACKTOP = sp;return ($mem$0|0);
}
function _try_realloc_chunk($p,$nb) {
 $p = $p|0;
 $nb = $nb|0;
 var $$pre = 0, $$pre$phiZ2D = 0, $$sum = 0, $$sum11 = 0, $$sum12 = 0, $$sum13 = 0, $$sum14 = 0, $$sum15 = 0, $$sum16 = 0, $$sum17 = 0, $$sum19 = 0, $$sum2 = 0, $$sum20 = 0, $$sum22 = 0, $$sum23 = 0, $$sum2728 = 0, $$sum3 = 0, $$sum4 = 0, $$sum5 = 0, $$sum78 = 0;
 var $$sum910 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0;
 var $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0;
 var $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0;
 var $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0;
 var $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $R$0 = 0, $R$1 = 0, $RP$0 = 0;
 var $cond = 0, $newp$0 = 0, $or$cond = 0, $storemerge = 0, $storemerge21 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (($p) + 4|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = $1 & -8;
 $3 = (($p) + ($2)|0);
 $4 = HEAP32[((2152 + 16|0))>>2]|0;
 $5 = ($p>>>0)<($4>>>0);
 if ($5) {
  _abort();
  // unreachable;
 }
 $6 = $1 & 3;
 $7 = ($6|0)!=(1);
 $8 = ($p>>>0)<($3>>>0);
 $or$cond = $7 & $8;
 if (!($or$cond)) {
  _abort();
  // unreachable;
 }
 $$sum2728 = $2 | 4;
 $9 = (($p) + ($$sum2728)|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = $10 & 1;
 $12 = ($11|0)==(0);
 if ($12) {
  _abort();
  // unreachable;
 }
 $13 = ($6|0)==(0);
 if ($13) {
  $14 = ($nb>>>0)<(256);
  if ($14) {
   $newp$0 = 0;
   STACKTOP = sp;return ($newp$0|0);
  }
  $15 = (($nb) + 4)|0;
  $16 = ($2>>>0)<($15>>>0);
  if (!($16)) {
   $17 = (($2) - ($nb))|0;
   $18 = HEAP32[((2624 + 8|0))>>2]|0;
   $19 = $18 << 1;
   $20 = ($17>>>0)>($19>>>0);
   if (!($20)) {
    $newp$0 = $p;
    STACKTOP = sp;return ($newp$0|0);
   }
  }
  $newp$0 = 0;
  STACKTOP = sp;return ($newp$0|0);
 }
 $21 = ($2>>>0)<($nb>>>0);
 if (!($21)) {
  $22 = (($2) - ($nb))|0;
  $23 = ($22>>>0)>(15);
  if (!($23)) {
   $newp$0 = $p;
   STACKTOP = sp;return ($newp$0|0);
  }
  $24 = (($p) + ($nb)|0);
  $25 = $1 & 1;
  $26 = $25 | $nb;
  $27 = $26 | 2;
  HEAP32[$0>>2] = $27;
  $$sum23 = (($nb) + 4)|0;
  $28 = (($p) + ($$sum23)|0);
  $29 = $22 | 3;
  HEAP32[$28>>2] = $29;
  $30 = HEAP32[$9>>2]|0;
  $31 = $30 | 1;
  HEAP32[$9>>2] = $31;
  _dispose_chunk($24,$22);
  $newp$0 = $p;
  STACKTOP = sp;return ($newp$0|0);
 }
 $32 = HEAP32[((2152 + 24|0))>>2]|0;
 $33 = ($3|0)==($32|0);
 if ($33) {
  $34 = HEAP32[((2152 + 12|0))>>2]|0;
  $35 = (($34) + ($2))|0;
  $36 = ($35>>>0)>($nb>>>0);
  if (!($36)) {
   $newp$0 = 0;
   STACKTOP = sp;return ($newp$0|0);
  }
  $37 = (($35) - ($nb))|0;
  $38 = (($p) + ($nb)|0);
  $39 = $1 & 1;
  $40 = $39 | $nb;
  $41 = $40 | 2;
  HEAP32[$0>>2] = $41;
  $$sum22 = (($nb) + 4)|0;
  $42 = (($p) + ($$sum22)|0);
  $43 = $37 | 1;
  HEAP32[$42>>2] = $43;
  HEAP32[((2152 + 24|0))>>2] = $38;
  HEAP32[((2152 + 12|0))>>2] = $37;
  $newp$0 = $p;
  STACKTOP = sp;return ($newp$0|0);
 }
 $44 = HEAP32[((2152 + 20|0))>>2]|0;
 $45 = ($3|0)==($44|0);
 if ($45) {
  $46 = HEAP32[((2152 + 8|0))>>2]|0;
  $47 = (($46) + ($2))|0;
  $48 = ($47>>>0)<($nb>>>0);
  if ($48) {
   $newp$0 = 0;
   STACKTOP = sp;return ($newp$0|0);
  }
  $49 = (($47) - ($nb))|0;
  $50 = ($49>>>0)>(15);
  if ($50) {
   $51 = (($p) + ($nb)|0);
   $52 = (($p) + ($47)|0);
   $53 = $1 & 1;
   $54 = $53 | $nb;
   $55 = $54 | 2;
   HEAP32[$0>>2] = $55;
   $$sum19 = (($nb) + 4)|0;
   $56 = (($p) + ($$sum19)|0);
   $57 = $49 | 1;
   HEAP32[$56>>2] = $57;
   HEAP32[$52>>2] = $49;
   $$sum20 = (($47) + 4)|0;
   $58 = (($p) + ($$sum20)|0);
   $59 = HEAP32[$58>>2]|0;
   $60 = $59 & -2;
   HEAP32[$58>>2] = $60;
   $storemerge = $51;$storemerge21 = $49;
  } else {
   $61 = $1 & 1;
   $62 = $61 | $47;
   $63 = $62 | 2;
   HEAP32[$0>>2] = $63;
   $$sum17 = (($47) + 4)|0;
   $64 = (($p) + ($$sum17)|0);
   $65 = HEAP32[$64>>2]|0;
   $66 = $65 | 1;
   HEAP32[$64>>2] = $66;
   $storemerge = 0;$storemerge21 = 0;
  }
  HEAP32[((2152 + 8|0))>>2] = $storemerge21;
  HEAP32[((2152 + 20|0))>>2] = $storemerge;
  $newp$0 = $p;
  STACKTOP = sp;return ($newp$0|0);
 }
 $67 = $10 & 2;
 $68 = ($67|0)==(0);
 if (!($68)) {
  $newp$0 = 0;
  STACKTOP = sp;return ($newp$0|0);
 }
 $69 = $10 & -8;
 $70 = (($69) + ($2))|0;
 $71 = ($70>>>0)<($nb>>>0);
 if ($71) {
  $newp$0 = 0;
  STACKTOP = sp;return ($newp$0|0);
 }
 $72 = (($70) - ($nb))|0;
 $73 = $10 >>> 3;
 $74 = ($10>>>0)<(256);
 do {
  if ($74) {
   $$sum15 = (($2) + 8)|0;
   $75 = (($p) + ($$sum15)|0);
   $76 = HEAP32[$75>>2]|0;
   $$sum16 = (($2) + 12)|0;
   $77 = (($p) + ($$sum16)|0);
   $78 = HEAP32[$77>>2]|0;
   $79 = $73 << 1;
   $80 = ((2152 + ($79<<2)|0) + 40|0);
   $81 = ($76|0)==($80|0);
   if (!($81)) {
    $82 = ($76>>>0)<($4>>>0);
    if ($82) {
     _abort();
     // unreachable;
    }
    $83 = (($76) + 12|0);
    $84 = HEAP32[$83>>2]|0;
    $85 = ($84|0)==($3|0);
    if (!($85)) {
     _abort();
     // unreachable;
    }
   }
   $86 = ($78|0)==($76|0);
   if ($86) {
    $87 = 1 << $73;
    $88 = $87 ^ -1;
    $89 = HEAP32[2152>>2]|0;
    $90 = $89 & $88;
    HEAP32[2152>>2] = $90;
    break;
   }
   $91 = ($78|0)==($80|0);
   if ($91) {
    $$pre = (($78) + 8|0);
    $$pre$phiZ2D = $$pre;
   } else {
    $92 = ($78>>>0)<($4>>>0);
    if ($92) {
     _abort();
     // unreachable;
    }
    $93 = (($78) + 8|0);
    $94 = HEAP32[$93>>2]|0;
    $95 = ($94|0)==($3|0);
    if ($95) {
     $$pre$phiZ2D = $93;
    } else {
     _abort();
     // unreachable;
    }
   }
   $96 = (($76) + 12|0);
   HEAP32[$96>>2] = $78;
   HEAP32[$$pre$phiZ2D>>2] = $76;
  } else {
   $$sum = (($2) + 24)|0;
   $97 = (($p) + ($$sum)|0);
   $98 = HEAP32[$97>>2]|0;
   $$sum2 = (($2) + 12)|0;
   $99 = (($p) + ($$sum2)|0);
   $100 = HEAP32[$99>>2]|0;
   $101 = ($100|0)==($3|0);
   do {
    if ($101) {
     $$sum4 = (($2) + 20)|0;
     $111 = (($p) + ($$sum4)|0);
     $112 = HEAP32[$111>>2]|0;
     $113 = ($112|0)==(0|0);
     if ($113) {
      $$sum3 = (($2) + 16)|0;
      $114 = (($p) + ($$sum3)|0);
      $115 = HEAP32[$114>>2]|0;
      $116 = ($115|0)==(0|0);
      if ($116) {
       $R$1 = 0;
       break;
      } else {
       $R$0 = $115;$RP$0 = $114;
      }
     } else {
      $R$0 = $112;$RP$0 = $111;
     }
     while(1) {
      $117 = (($R$0) + 20|0);
      $118 = HEAP32[$117>>2]|0;
      $119 = ($118|0)==(0|0);
      if (!($119)) {
       $R$0 = $118;$RP$0 = $117;
       continue;
      }
      $120 = (($R$0) + 16|0);
      $121 = HEAP32[$120>>2]|0;
      $122 = ($121|0)==(0|0);
      if ($122) {
       break;
      } else {
       $R$0 = $121;$RP$0 = $120;
      }
     }
     $123 = ($RP$0>>>0)<($4>>>0);
     if ($123) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$0>>2] = 0;
      $R$1 = $R$0;
      break;
     }
    } else {
     $$sum14 = (($2) + 8)|0;
     $102 = (($p) + ($$sum14)|0);
     $103 = HEAP32[$102>>2]|0;
     $104 = ($103>>>0)<($4>>>0);
     if ($104) {
      _abort();
      // unreachable;
     }
     $105 = (($103) + 12|0);
     $106 = HEAP32[$105>>2]|0;
     $107 = ($106|0)==($3|0);
     if (!($107)) {
      _abort();
      // unreachable;
     }
     $108 = (($100) + 8|0);
     $109 = HEAP32[$108>>2]|0;
     $110 = ($109|0)==($3|0);
     if ($110) {
      HEAP32[$105>>2] = $100;
      HEAP32[$108>>2] = $103;
      $R$1 = $100;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $124 = ($98|0)==(0|0);
   if (!($124)) {
    $$sum11 = (($2) + 28)|0;
    $125 = (($p) + ($$sum11)|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ((2152 + ($126<<2)|0) + 304|0);
    $128 = HEAP32[$127>>2]|0;
    $129 = ($3|0)==($128|0);
    if ($129) {
     HEAP32[$127>>2] = $R$1;
     $cond = ($R$1|0)==(0|0);
     if ($cond) {
      $130 = 1 << $126;
      $131 = $130 ^ -1;
      $132 = HEAP32[((2152 + 4|0))>>2]|0;
      $133 = $132 & $131;
      HEAP32[((2152 + 4|0))>>2] = $133;
      break;
     }
    } else {
     $134 = HEAP32[((2152 + 16|0))>>2]|0;
     $135 = ($98>>>0)<($134>>>0);
     if ($135) {
      _abort();
      // unreachable;
     }
     $136 = (($98) + 16|0);
     $137 = HEAP32[$136>>2]|0;
     $138 = ($137|0)==($3|0);
     if ($138) {
      HEAP32[$136>>2] = $R$1;
     } else {
      $139 = (($98) + 20|0);
      HEAP32[$139>>2] = $R$1;
     }
     $140 = ($R$1|0)==(0|0);
     if ($140) {
      break;
     }
    }
    $141 = HEAP32[((2152 + 16|0))>>2]|0;
    $142 = ($R$1>>>0)<($141>>>0);
    if ($142) {
     _abort();
     // unreachable;
    }
    $143 = (($R$1) + 24|0);
    HEAP32[$143>>2] = $98;
    $$sum12 = (($2) + 16)|0;
    $144 = (($p) + ($$sum12)|0);
    $145 = HEAP32[$144>>2]|0;
    $146 = ($145|0)==(0|0);
    do {
     if (!($146)) {
      $147 = HEAP32[((2152 + 16|0))>>2]|0;
      $148 = ($145>>>0)<($147>>>0);
      if ($148) {
       _abort();
       // unreachable;
      } else {
       $149 = (($R$1) + 16|0);
       HEAP32[$149>>2] = $145;
       $150 = (($145) + 24|0);
       HEAP32[$150>>2] = $R$1;
       break;
      }
     }
    } while(0);
    $$sum13 = (($2) + 20)|0;
    $151 = (($p) + ($$sum13)|0);
    $152 = HEAP32[$151>>2]|0;
    $153 = ($152|0)==(0|0);
    if (!($153)) {
     $154 = HEAP32[((2152 + 16|0))>>2]|0;
     $155 = ($152>>>0)<($154>>>0);
     if ($155) {
      _abort();
      // unreachable;
     } else {
      $156 = (($R$1) + 20|0);
      HEAP32[$156>>2] = $152;
      $157 = (($152) + 24|0);
      HEAP32[$157>>2] = $R$1;
      break;
     }
    }
   }
  }
 } while(0);
 $158 = ($72>>>0)<(16);
 if ($158) {
  $159 = HEAP32[$0>>2]|0;
  $160 = $159 & 1;
  $161 = $70 | $160;
  $162 = $161 | 2;
  HEAP32[$0>>2] = $162;
  $$sum910 = $70 | 4;
  $163 = (($p) + ($$sum910)|0);
  $164 = HEAP32[$163>>2]|0;
  $165 = $164 | 1;
  HEAP32[$163>>2] = $165;
  $newp$0 = $p;
  STACKTOP = sp;return ($newp$0|0);
 } else {
  $166 = (($p) + ($nb)|0);
  $167 = HEAP32[$0>>2]|0;
  $168 = $167 & 1;
  $169 = $168 | $nb;
  $170 = $169 | 2;
  HEAP32[$0>>2] = $170;
  $$sum5 = (($nb) + 4)|0;
  $171 = (($p) + ($$sum5)|0);
  $172 = $72 | 3;
  HEAP32[$171>>2] = $172;
  $$sum78 = $70 | 4;
  $173 = (($p) + ($$sum78)|0);
  $174 = HEAP32[$173>>2]|0;
  $175 = $174 | 1;
  HEAP32[$173>>2] = $175;
  _dispose_chunk($166,$72);
  $newp$0 = $p;
  STACKTOP = sp;return ($newp$0|0);
 }
 return 0|0;
}
function _dispose_chunk($p,$psize) {
 $p = $p|0;
 $psize = $psize|0;
 var $$0 = 0, $$02 = 0, $$1 = 0, $$pre = 0, $$pre$phi63Z2D = 0, $$pre$phi65Z2D = 0, $$pre$phiZ2D = 0, $$pre62 = 0, $$pre64 = 0, $$sum = 0, $$sum1 = 0, $$sum12$pre = 0, $$sum13 = 0, $$sum14 = 0, $$sum15 = 0, $$sum16 = 0, $$sum17 = 0, $$sum18 = 0, $$sum19 = 0, $$sum2 = 0;
 var $$sum20 = 0, $$sum22 = 0, $$sum23 = 0, $$sum24 = 0, $$sum25 = 0, $$sum26 = 0, $$sum27 = 0, $$sum28 = 0, $$sum29 = 0, $$sum3 = 0, $$sum30 = 0, $$sum31 = 0, $$sum4 = 0, $$sum5 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0;
 var $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0;
 var $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0;
 var $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0;
 var $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0;
 var $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0;
 var $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0;
 var $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F16$0 = 0, $I19$0 = 0, $I19$0$c = 0, $K20$049 = 0, $R$0 = 0, $R$1 = 0, $R7$0 = 0, $R7$1 = 0, $RP$0 = 0, $RP9$0 = 0, $T$0$lcssa = 0, $T$048 = 0, $cond = 0, $cond46 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $0 = (($p) + ($psize)|0);
 $1 = (($p) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = $2 & 1;
 $4 = ($3|0)==(0);
 do {
  if ($4) {
   $5 = HEAP32[$p>>2]|0;
   $6 = $2 & 3;
   $7 = ($6|0)==(0);
   if ($7) {
    STACKTOP = sp;return;
   }
   $8 = (0 - ($5))|0;
   $9 = (($p) + ($8)|0);
   $10 = (($5) + ($psize))|0;
   $11 = HEAP32[((2152 + 16|0))>>2]|0;
   $12 = ($9>>>0)<($11>>>0);
   if ($12) {
    _abort();
    // unreachable;
   }
   $13 = HEAP32[((2152 + 20|0))>>2]|0;
   $14 = ($9|0)==($13|0);
   if ($14) {
    $$sum = (($psize) + 4)|0;
    $100 = (($p) + ($$sum)|0);
    $101 = HEAP32[$100>>2]|0;
    $102 = $101 & 3;
    $103 = ($102|0)==(3);
    if (!($103)) {
     $$0 = $9;$$02 = $10;
     break;
    }
    HEAP32[((2152 + 8|0))>>2] = $10;
    $104 = HEAP32[$100>>2]|0;
    $105 = $104 & -2;
    HEAP32[$100>>2] = $105;
    $106 = $10 | 1;
    $$sum20 = (4 - ($5))|0;
    $107 = (($p) + ($$sum20)|0);
    HEAP32[$107>>2] = $106;
    HEAP32[$0>>2] = $10;
    STACKTOP = sp;return;
   }
   $15 = $5 >>> 3;
   $16 = ($5>>>0)<(256);
   if ($16) {
    $$sum30 = (8 - ($5))|0;
    $17 = (($p) + ($$sum30)|0);
    $18 = HEAP32[$17>>2]|0;
    $$sum31 = (12 - ($5))|0;
    $19 = (($p) + ($$sum31)|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = $15 << 1;
    $22 = ((2152 + ($21<<2)|0) + 40|0);
    $23 = ($18|0)==($22|0);
    if (!($23)) {
     $24 = ($18>>>0)<($11>>>0);
     if ($24) {
      _abort();
      // unreachable;
     }
     $25 = (($18) + 12|0);
     $26 = HEAP32[$25>>2]|0;
     $27 = ($26|0)==($9|0);
     if (!($27)) {
      _abort();
      // unreachable;
     }
    }
    $28 = ($20|0)==($18|0);
    if ($28) {
     $29 = 1 << $15;
     $30 = $29 ^ -1;
     $31 = HEAP32[2152>>2]|0;
     $32 = $31 & $30;
     HEAP32[2152>>2] = $32;
     $$0 = $9;$$02 = $10;
     break;
    }
    $33 = ($20|0)==($22|0);
    if ($33) {
     $$pre64 = (($20) + 8|0);
     $$pre$phi65Z2D = $$pre64;
    } else {
     $34 = ($20>>>0)<($11>>>0);
     if ($34) {
      _abort();
      // unreachable;
     }
     $35 = (($20) + 8|0);
     $36 = HEAP32[$35>>2]|0;
     $37 = ($36|0)==($9|0);
     if ($37) {
      $$pre$phi65Z2D = $35;
     } else {
      _abort();
      // unreachable;
     }
    }
    $38 = (($18) + 12|0);
    HEAP32[$38>>2] = $20;
    HEAP32[$$pre$phi65Z2D>>2] = $18;
    $$0 = $9;$$02 = $10;
    break;
   }
   $$sum22 = (24 - ($5))|0;
   $39 = (($p) + ($$sum22)|0);
   $40 = HEAP32[$39>>2]|0;
   $$sum23 = (12 - ($5))|0;
   $41 = (($p) + ($$sum23)|0);
   $42 = HEAP32[$41>>2]|0;
   $43 = ($42|0)==($9|0);
   do {
    if ($43) {
     $$sum24 = (16 - ($5))|0;
     $$sum25 = (($$sum24) + 4)|0;
     $53 = (($p) + ($$sum25)|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = ($54|0)==(0|0);
     if ($55) {
      $56 = (($p) + ($$sum24)|0);
      $57 = HEAP32[$56>>2]|0;
      $58 = ($57|0)==(0|0);
      if ($58) {
       $R$1 = 0;
       break;
      } else {
       $R$0 = $57;$RP$0 = $56;
      }
     } else {
      $R$0 = $54;$RP$0 = $53;
     }
     while(1) {
      $59 = (($R$0) + 20|0);
      $60 = HEAP32[$59>>2]|0;
      $61 = ($60|0)==(0|0);
      if (!($61)) {
       $R$0 = $60;$RP$0 = $59;
       continue;
      }
      $62 = (($R$0) + 16|0);
      $63 = HEAP32[$62>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       break;
      } else {
       $R$0 = $63;$RP$0 = $62;
      }
     }
     $65 = ($RP$0>>>0)<($11>>>0);
     if ($65) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$0>>2] = 0;
      $R$1 = $R$0;
      break;
     }
    } else {
     $$sum29 = (8 - ($5))|0;
     $44 = (($p) + ($$sum29)|0);
     $45 = HEAP32[$44>>2]|0;
     $46 = ($45>>>0)<($11>>>0);
     if ($46) {
      _abort();
      // unreachable;
     }
     $47 = (($45) + 12|0);
     $48 = HEAP32[$47>>2]|0;
     $49 = ($48|0)==($9|0);
     if (!($49)) {
      _abort();
      // unreachable;
     }
     $50 = (($42) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($51|0)==($9|0);
     if ($52) {
      HEAP32[$47>>2] = $42;
      HEAP32[$50>>2] = $45;
      $R$1 = $42;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $66 = ($40|0)==(0|0);
   if ($66) {
    $$0 = $9;$$02 = $10;
   } else {
    $$sum26 = (28 - ($5))|0;
    $67 = (($p) + ($$sum26)|0);
    $68 = HEAP32[$67>>2]|0;
    $69 = ((2152 + ($68<<2)|0) + 304|0);
    $70 = HEAP32[$69>>2]|0;
    $71 = ($9|0)==($70|0);
    if ($71) {
     HEAP32[$69>>2] = $R$1;
     $cond = ($R$1|0)==(0|0);
     if ($cond) {
      $72 = 1 << $68;
      $73 = $72 ^ -1;
      $74 = HEAP32[((2152 + 4|0))>>2]|0;
      $75 = $74 & $73;
      HEAP32[((2152 + 4|0))>>2] = $75;
      $$0 = $9;$$02 = $10;
      break;
     }
    } else {
     $76 = HEAP32[((2152 + 16|0))>>2]|0;
     $77 = ($40>>>0)<($76>>>0);
     if ($77) {
      _abort();
      // unreachable;
     }
     $78 = (($40) + 16|0);
     $79 = HEAP32[$78>>2]|0;
     $80 = ($79|0)==($9|0);
     if ($80) {
      HEAP32[$78>>2] = $R$1;
     } else {
      $81 = (($40) + 20|0);
      HEAP32[$81>>2] = $R$1;
     }
     $82 = ($R$1|0)==(0|0);
     if ($82) {
      $$0 = $9;$$02 = $10;
      break;
     }
    }
    $83 = HEAP32[((2152 + 16|0))>>2]|0;
    $84 = ($R$1>>>0)<($83>>>0);
    if ($84) {
     _abort();
     // unreachable;
    }
    $85 = (($R$1) + 24|0);
    HEAP32[$85>>2] = $40;
    $$sum27 = (16 - ($5))|0;
    $86 = (($p) + ($$sum27)|0);
    $87 = HEAP32[$86>>2]|0;
    $88 = ($87|0)==(0|0);
    do {
     if (!($88)) {
      $89 = HEAP32[((2152 + 16|0))>>2]|0;
      $90 = ($87>>>0)<($89>>>0);
      if ($90) {
       _abort();
       // unreachable;
      } else {
       $91 = (($R$1) + 16|0);
       HEAP32[$91>>2] = $87;
       $92 = (($87) + 24|0);
       HEAP32[$92>>2] = $R$1;
       break;
      }
     }
    } while(0);
    $$sum28 = (($$sum27) + 4)|0;
    $93 = (($p) + ($$sum28)|0);
    $94 = HEAP32[$93>>2]|0;
    $95 = ($94|0)==(0|0);
    if ($95) {
     $$0 = $9;$$02 = $10;
    } else {
     $96 = HEAP32[((2152 + 16|0))>>2]|0;
     $97 = ($94>>>0)<($96>>>0);
     if ($97) {
      _abort();
      // unreachable;
     } else {
      $98 = (($R$1) + 20|0);
      HEAP32[$98>>2] = $94;
      $99 = (($94) + 24|0);
      HEAP32[$99>>2] = $R$1;
      $$0 = $9;$$02 = $10;
      break;
     }
    }
   }
  } else {
   $$0 = $p;$$02 = $psize;
  }
 } while(0);
 $108 = HEAP32[((2152 + 16|0))>>2]|0;
 $109 = ($0>>>0)<($108>>>0);
 if ($109) {
  _abort();
  // unreachable;
 }
 $$sum1 = (($psize) + 4)|0;
 $110 = (($p) + ($$sum1)|0);
 $111 = HEAP32[$110>>2]|0;
 $112 = $111 & 2;
 $113 = ($112|0)==(0);
 if ($113) {
  $114 = HEAP32[((2152 + 24|0))>>2]|0;
  $115 = ($0|0)==($114|0);
  if ($115) {
   $116 = HEAP32[((2152 + 12|0))>>2]|0;
   $117 = (($116) + ($$02))|0;
   HEAP32[((2152 + 12|0))>>2] = $117;
   HEAP32[((2152 + 24|0))>>2] = $$0;
   $118 = $117 | 1;
   $119 = (($$0) + 4|0);
   HEAP32[$119>>2] = $118;
   $120 = HEAP32[((2152 + 20|0))>>2]|0;
   $121 = ($$0|0)==($120|0);
   if (!($121)) {
    STACKTOP = sp;return;
   }
   HEAP32[((2152 + 20|0))>>2] = 0;
   HEAP32[((2152 + 8|0))>>2] = 0;
   STACKTOP = sp;return;
  }
  $122 = HEAP32[((2152 + 20|0))>>2]|0;
  $123 = ($0|0)==($122|0);
  if ($123) {
   $124 = HEAP32[((2152 + 8|0))>>2]|0;
   $125 = (($124) + ($$02))|0;
   HEAP32[((2152 + 8|0))>>2] = $125;
   HEAP32[((2152 + 20|0))>>2] = $$0;
   $126 = $125 | 1;
   $127 = (($$0) + 4|0);
   HEAP32[$127>>2] = $126;
   $128 = (($$0) + ($125)|0);
   HEAP32[$128>>2] = $125;
   STACKTOP = sp;return;
  }
  $129 = $111 & -8;
  $130 = (($129) + ($$02))|0;
  $131 = $111 >>> 3;
  $132 = ($111>>>0)<(256);
  do {
   if ($132) {
    $$sum18 = (($psize) + 8)|0;
    $133 = (($p) + ($$sum18)|0);
    $134 = HEAP32[$133>>2]|0;
    $$sum19 = (($psize) + 12)|0;
    $135 = (($p) + ($$sum19)|0);
    $136 = HEAP32[$135>>2]|0;
    $137 = $131 << 1;
    $138 = ((2152 + ($137<<2)|0) + 40|0);
    $139 = ($134|0)==($138|0);
    if (!($139)) {
     $140 = ($134>>>0)<($108>>>0);
     if ($140) {
      _abort();
      // unreachable;
     }
     $141 = (($134) + 12|0);
     $142 = HEAP32[$141>>2]|0;
     $143 = ($142|0)==($0|0);
     if (!($143)) {
      _abort();
      // unreachable;
     }
    }
    $144 = ($136|0)==($134|0);
    if ($144) {
     $145 = 1 << $131;
     $146 = $145 ^ -1;
     $147 = HEAP32[2152>>2]|0;
     $148 = $147 & $146;
     HEAP32[2152>>2] = $148;
     break;
    }
    $149 = ($136|0)==($138|0);
    if ($149) {
     $$pre62 = (($136) + 8|0);
     $$pre$phi63Z2D = $$pre62;
    } else {
     $150 = ($136>>>0)<($108>>>0);
     if ($150) {
      _abort();
      // unreachable;
     }
     $151 = (($136) + 8|0);
     $152 = HEAP32[$151>>2]|0;
     $153 = ($152|0)==($0|0);
     if ($153) {
      $$pre$phi63Z2D = $151;
     } else {
      _abort();
      // unreachable;
     }
    }
    $154 = (($134) + 12|0);
    HEAP32[$154>>2] = $136;
    HEAP32[$$pre$phi63Z2D>>2] = $134;
   } else {
    $$sum2 = (($psize) + 24)|0;
    $155 = (($p) + ($$sum2)|0);
    $156 = HEAP32[$155>>2]|0;
    $$sum3 = (($psize) + 12)|0;
    $157 = (($p) + ($$sum3)|0);
    $158 = HEAP32[$157>>2]|0;
    $159 = ($158|0)==($0|0);
    do {
     if ($159) {
      $$sum5 = (($psize) + 20)|0;
      $169 = (($p) + ($$sum5)|0);
      $170 = HEAP32[$169>>2]|0;
      $171 = ($170|0)==(0|0);
      if ($171) {
       $$sum4 = (($psize) + 16)|0;
       $172 = (($p) + ($$sum4)|0);
       $173 = HEAP32[$172>>2]|0;
       $174 = ($173|0)==(0|0);
       if ($174) {
        $R7$1 = 0;
        break;
       } else {
        $R7$0 = $173;$RP9$0 = $172;
       }
      } else {
       $R7$0 = $170;$RP9$0 = $169;
      }
      while(1) {
       $175 = (($R7$0) + 20|0);
       $176 = HEAP32[$175>>2]|0;
       $177 = ($176|0)==(0|0);
       if (!($177)) {
        $R7$0 = $176;$RP9$0 = $175;
        continue;
       }
       $178 = (($R7$0) + 16|0);
       $179 = HEAP32[$178>>2]|0;
       $180 = ($179|0)==(0|0);
       if ($180) {
        break;
       } else {
        $R7$0 = $179;$RP9$0 = $178;
       }
      }
      $181 = ($RP9$0>>>0)<($108>>>0);
      if ($181) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP9$0>>2] = 0;
       $R7$1 = $R7$0;
       break;
      }
     } else {
      $$sum17 = (($psize) + 8)|0;
      $160 = (($p) + ($$sum17)|0);
      $161 = HEAP32[$160>>2]|0;
      $162 = ($161>>>0)<($108>>>0);
      if ($162) {
       _abort();
       // unreachable;
      }
      $163 = (($161) + 12|0);
      $164 = HEAP32[$163>>2]|0;
      $165 = ($164|0)==($0|0);
      if (!($165)) {
       _abort();
       // unreachable;
      }
      $166 = (($158) + 8|0);
      $167 = HEAP32[$166>>2]|0;
      $168 = ($167|0)==($0|0);
      if ($168) {
       HEAP32[$163>>2] = $158;
       HEAP32[$166>>2] = $161;
       $R7$1 = $158;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $182 = ($156|0)==(0|0);
    if (!($182)) {
     $$sum14 = (($psize) + 28)|0;
     $183 = (($p) + ($$sum14)|0);
     $184 = HEAP32[$183>>2]|0;
     $185 = ((2152 + ($184<<2)|0) + 304|0);
     $186 = HEAP32[$185>>2]|0;
     $187 = ($0|0)==($186|0);
     if ($187) {
      HEAP32[$185>>2] = $R7$1;
      $cond46 = ($R7$1|0)==(0|0);
      if ($cond46) {
       $188 = 1 << $184;
       $189 = $188 ^ -1;
       $190 = HEAP32[((2152 + 4|0))>>2]|0;
       $191 = $190 & $189;
       HEAP32[((2152 + 4|0))>>2] = $191;
       break;
      }
     } else {
      $192 = HEAP32[((2152 + 16|0))>>2]|0;
      $193 = ($156>>>0)<($192>>>0);
      if ($193) {
       _abort();
       // unreachable;
      }
      $194 = (($156) + 16|0);
      $195 = HEAP32[$194>>2]|0;
      $196 = ($195|0)==($0|0);
      if ($196) {
       HEAP32[$194>>2] = $R7$1;
      } else {
       $197 = (($156) + 20|0);
       HEAP32[$197>>2] = $R7$1;
      }
      $198 = ($R7$1|0)==(0|0);
      if ($198) {
       break;
      }
     }
     $199 = HEAP32[((2152 + 16|0))>>2]|0;
     $200 = ($R7$1>>>0)<($199>>>0);
     if ($200) {
      _abort();
      // unreachable;
     }
     $201 = (($R7$1) + 24|0);
     HEAP32[$201>>2] = $156;
     $$sum15 = (($psize) + 16)|0;
     $202 = (($p) + ($$sum15)|0);
     $203 = HEAP32[$202>>2]|0;
     $204 = ($203|0)==(0|0);
     do {
      if (!($204)) {
       $205 = HEAP32[((2152 + 16|0))>>2]|0;
       $206 = ($203>>>0)<($205>>>0);
       if ($206) {
        _abort();
        // unreachable;
       } else {
        $207 = (($R7$1) + 16|0);
        HEAP32[$207>>2] = $203;
        $208 = (($203) + 24|0);
        HEAP32[$208>>2] = $R7$1;
        break;
       }
      }
     } while(0);
     $$sum16 = (($psize) + 20)|0;
     $209 = (($p) + ($$sum16)|0);
     $210 = HEAP32[$209>>2]|0;
     $211 = ($210|0)==(0|0);
     if (!($211)) {
      $212 = HEAP32[((2152 + 16|0))>>2]|0;
      $213 = ($210>>>0)<($212>>>0);
      if ($213) {
       _abort();
       // unreachable;
      } else {
       $214 = (($R7$1) + 20|0);
       HEAP32[$214>>2] = $210;
       $215 = (($210) + 24|0);
       HEAP32[$215>>2] = $R7$1;
       break;
      }
     }
    }
   }
  } while(0);
  $216 = $130 | 1;
  $217 = (($$0) + 4|0);
  HEAP32[$217>>2] = $216;
  $218 = (($$0) + ($130)|0);
  HEAP32[$218>>2] = $130;
  $219 = HEAP32[((2152 + 20|0))>>2]|0;
  $220 = ($$0|0)==($219|0);
  if ($220) {
   HEAP32[((2152 + 8|0))>>2] = $130;
   STACKTOP = sp;return;
  } else {
   $$1 = $130;
  }
 } else {
  $221 = $111 & -2;
  HEAP32[$110>>2] = $221;
  $222 = $$02 | 1;
  $223 = (($$0) + 4|0);
  HEAP32[$223>>2] = $222;
  $224 = (($$0) + ($$02)|0);
  HEAP32[$224>>2] = $$02;
  $$1 = $$02;
 }
 $225 = $$1 >>> 3;
 $226 = ($$1>>>0)<(256);
 if ($226) {
  $227 = $225 << 1;
  $228 = ((2152 + ($227<<2)|0) + 40|0);
  $229 = HEAP32[2152>>2]|0;
  $230 = 1 << $225;
  $231 = $229 & $230;
  $232 = ($231|0)==(0);
  if ($232) {
   $233 = $229 | $230;
   HEAP32[2152>>2] = $233;
   $$sum12$pre = (($227) + 2)|0;
   $$pre = ((2152 + ($$sum12$pre<<2)|0) + 40|0);
   $$pre$phiZ2D = $$pre;$F16$0 = $228;
  } else {
   $$sum13 = (($227) + 2)|0;
   $234 = ((2152 + ($$sum13<<2)|0) + 40|0);
   $235 = HEAP32[$234>>2]|0;
   $236 = HEAP32[((2152 + 16|0))>>2]|0;
   $237 = ($235>>>0)<($236>>>0);
   if ($237) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $234;$F16$0 = $235;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$0;
  $238 = (($F16$0) + 12|0);
  HEAP32[$238>>2] = $$0;
  $239 = (($$0) + 8|0);
  HEAP32[$239>>2] = $F16$0;
  $240 = (($$0) + 12|0);
  HEAP32[$240>>2] = $228;
  STACKTOP = sp;return;
 }
 $241 = $$1 >>> 8;
 $242 = ($241|0)==(0);
 if ($242) {
  $I19$0 = 0;
 } else {
  $243 = ($$1>>>0)>(16777215);
  if ($243) {
   $I19$0 = 31;
  } else {
   $244 = (($241) + 1048320)|0;
   $245 = $244 >>> 16;
   $246 = $245 & 8;
   $247 = $241 << $246;
   $248 = (($247) + 520192)|0;
   $249 = $248 >>> 16;
   $250 = $249 & 4;
   $251 = $250 | $246;
   $252 = $247 << $250;
   $253 = (($252) + 245760)|0;
   $254 = $253 >>> 16;
   $255 = $254 & 2;
   $256 = $251 | $255;
   $257 = (14 - ($256))|0;
   $258 = $252 << $255;
   $259 = $258 >>> 15;
   $260 = (($257) + ($259))|0;
   $261 = $260 << 1;
   $262 = (($260) + 7)|0;
   $263 = $$1 >>> $262;
   $264 = $263 & 1;
   $265 = $264 | $261;
   $I19$0 = $265;
  }
 }
 $266 = ((2152 + ($I19$0<<2)|0) + 304|0);
 $267 = (($$0) + 28|0);
 $I19$0$c = $I19$0;
 HEAP32[$267>>2] = $I19$0$c;
 $268 = (($$0) + 20|0);
 HEAP32[$268>>2] = 0;
 $269 = (($$0) + 16|0);
 HEAP32[$269>>2] = 0;
 $270 = HEAP32[((2152 + 4|0))>>2]|0;
 $271 = 1 << $I19$0;
 $272 = $270 & $271;
 $273 = ($272|0)==(0);
 if ($273) {
  $274 = $270 | $271;
  HEAP32[((2152 + 4|0))>>2] = $274;
  HEAP32[$266>>2] = $$0;
  $275 = (($$0) + 24|0);
  HEAP32[$275>>2] = $266;
  $276 = (($$0) + 12|0);
  HEAP32[$276>>2] = $$0;
  $277 = (($$0) + 8|0);
  HEAP32[$277>>2] = $$0;
  STACKTOP = sp;return;
 }
 $278 = HEAP32[$266>>2]|0;
 $279 = ($I19$0|0)==(31);
 if ($279) {
  $287 = 0;
 } else {
  $280 = $I19$0 >>> 1;
  $281 = (25 - ($280))|0;
  $287 = $281;
 }
 $282 = (($278) + 4|0);
 $283 = HEAP32[$282>>2]|0;
 $284 = $283 & -8;
 $285 = ($284|0)==($$1|0);
 L194: do {
  if ($285) {
   $T$0$lcssa = $278;
  } else {
   $286 = $$1 << $287;
   $K20$049 = $286;$T$048 = $278;
   while(1) {
    $294 = $K20$049 >>> 31;
    $295 = ((($T$048) + ($294<<2)|0) + 16|0);
    $290 = HEAP32[$295>>2]|0;
    $296 = ($290|0)==(0|0);
    if ($296) {
     break;
    }
    $288 = $K20$049 << 1;
    $289 = (($290) + 4|0);
    $291 = HEAP32[$289>>2]|0;
    $292 = $291 & -8;
    $293 = ($292|0)==($$1|0);
    if ($293) {
     $T$0$lcssa = $290;
     break L194;
    } else {
     $K20$049 = $288;$T$048 = $290;
    }
   }
   $297 = HEAP32[((2152 + 16|0))>>2]|0;
   $298 = ($295>>>0)<($297>>>0);
   if ($298) {
    _abort();
    // unreachable;
   }
   HEAP32[$295>>2] = $$0;
   $299 = (($$0) + 24|0);
   HEAP32[$299>>2] = $T$048;
   $300 = (($$0) + 12|0);
   HEAP32[$300>>2] = $$0;
   $301 = (($$0) + 8|0);
   HEAP32[$301>>2] = $$0;
   STACKTOP = sp;return;
  }
 } while(0);
 $302 = (($T$0$lcssa) + 8|0);
 $303 = HEAP32[$302>>2]|0;
 $304 = HEAP32[((2152 + 16|0))>>2]|0;
 $305 = ($T$0$lcssa>>>0)<($304>>>0);
 if ($305) {
  _abort();
  // unreachable;
 }
 $306 = ($303>>>0)<($304>>>0);
 if ($306) {
  _abort();
  // unreachable;
 }
 $307 = (($303) + 12|0);
 HEAP32[$307>>2] = $$0;
 HEAP32[$302>>2] = $$0;
 $308 = (($$0) + 8|0);
 HEAP32[$308>>2] = $303;
 $309 = (($$0) + 12|0);
 HEAP32[$309>>2] = $T$0$lcssa;
 $310 = (($$0) + 24|0);
 HEAP32[$310>>2] = 0;
 STACKTOP = sp;return;
}
function runPostSets() {
 
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
    stop = (ptr + num)|0;
    if ((num|0) >= 20) {
      // This is unaligned, but quite large, so work hard to get to aligned settings
      value = value & 0xff;
      unaligned = ptr & 3;
      value4 = value | (value << 8) | (value << 16) | (value << 24);
      stop4 = stop & ~3;
      if (unaligned) {
        unaligned = (ptr + 4 - unaligned)|0;
        while ((ptr|0) < (unaligned|0)) { // no need to check for stop, since we have large num
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
      }
      while ((ptr|0) < (stop4|0)) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    while ((ptr|0) < (stop|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (ptr-num)|0;
}
function _saveSetjmp(env, label, table) {
    // Not particularly fast: slow table lookup of setjmpId to label. But setjmp
    // prevents relooping anyhow, so slowness is to be expected. And typical case
    // is 1 setjmp per invocation, or less.
    env = env|0;
    label = label|0;
    table = table|0;
    var i = 0;
    setjmpId = (setjmpId+1)|0;
    HEAP32[((env)>>2)]=setjmpId;
    while ((i|0) < 20) {
      if (((HEAP32[(((table)+((i<<3)))>>2)])|0) == 0) {
        HEAP32[(((table)+((i<<3)))>>2)]=setjmpId;
        HEAP32[(((table)+((i<<3)+4))>>2)]=label;
        // prepare next slot
        HEAP32[(((table)+((i<<3)+8))>>2)]=0;
        return 0;
      }
      i = i+1|0;
    }
    _putchar(116);_putchar(111);_putchar(111);_putchar(32);_putchar(109);_putchar(97);_putchar(110);_putchar(121);_putchar(32);_putchar(115);_putchar(101);_putchar(116);_putchar(106);_putchar(109);_putchar(112);_putchar(115);_putchar(32);_putchar(105);_putchar(110);_putchar(32);_putchar(97);_putchar(32);_putchar(102);_putchar(117);_putchar(110);_putchar(99);_putchar(116);_putchar(105);_putchar(111);_putchar(110);_putchar(32);_putchar(99);_putchar(97);_putchar(108);_putchar(108);_putchar(44);_putchar(32);_putchar(98);_putchar(117);_putchar(105);_putchar(108);_putchar(100);_putchar(32);_putchar(119);_putchar(105);_putchar(116);_putchar(104);_putchar(32);_putchar(97);_putchar(32);_putchar(104);_putchar(105);_putchar(103);_putchar(104);_putchar(101);_putchar(114);_putchar(32);_putchar(118);_putchar(97);_putchar(108);_putchar(117);_putchar(101);_putchar(32);_putchar(102);_putchar(111);_putchar(114);_putchar(32);_putchar(77);_putchar(65);_putchar(88);_putchar(95);_putchar(83);_putchar(69);_putchar(84);_putchar(74);_putchar(77);_putchar(80);_putchar(83);_putchar(10);
    abort(0);
    return 0;
}
function _testSetjmp(id, table) {
    id = id|0;
    table = table|0;
    var i = 0, curr = 0;
    while ((i|0) < 20) {
      curr = ((HEAP32[(((table)+((i<<3)))>>2)])|0);
      if ((curr|0) == 0) break;
      if ((curr|0) == (id|0)) {
        return ((HEAP32[(((table)+((i<<3)+4))>>2)])|0);
      }
      i = i+1|0;
    }
    return 0;
}
function _strlen(ptr) {
    ptr = ptr|0;
    var curr = 0;
    curr = ptr;
    while (((HEAP8[((curr)>>0)])|0)) {
      curr = (curr + 1)|0;
    }
    return (curr - ptr)|0;
}
function _memcpy(dest, src, num) {

    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if ((num|0) >= 4096) return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    ret = dest|0;
    if ((dest&3) == (src&3)) {
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      while ((num|0) >= 4) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
        num = (num-4)|0;
      }
    }
    while ((num|0) > 0) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
      num = (num-1)|0;
    }
    return ret|0;
}

// EMSCRIPTEN_END_FUNCS

  
  function dynCall_iiii(index,a1,a2,a3) {
    index = index|0;
    a1=a1|0; a2=a2|0; a3=a3|0;
    return FUNCTION_TABLE_iiii[index&63](a1|0,a2|0,a3|0)|0;
  }


  function jsCall_iiii_0(a1,a2,a3) {
    a1=a1|0; a2=a2|0; a3=a3|0;
    return jsCall(0,a1|0,a2|0,a3|0)|0;
  }



  function jsCall_iiii_1(a1,a2,a3) {
    a1=a1|0; a2=a2|0; a3=a3|0;
    return jsCall(1,a1|0,a2|0,a3|0)|0;
  }



  function jsCall_iiii_2(a1,a2,a3) {
    a1=a1|0; a2=a2|0; a3=a3|0;
    return jsCall(2,a1|0,a2|0,a3|0)|0;
  }



  function jsCall_iiii_3(a1,a2,a3) {
    a1=a1|0; a2=a2|0; a3=a3|0;
    return jsCall(3,a1|0,a2|0,a3|0)|0;
  }



  function dynCall_viiiii(index,a1,a2,a3,a4,a5) {
    index = index|0;
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
    FUNCTION_TABLE_viiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0);
  }


  function jsCall_viiiii_0(a1,a2,a3,a4,a5) {
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
    jsCall(0,a1|0,a2|0,a3|0,a4|0,a5|0);
  }



  function jsCall_viiiii_1(a1,a2,a3,a4,a5) {
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
    jsCall(1,a1|0,a2|0,a3|0,a4|0,a5|0);
  }



  function jsCall_viiiii_2(a1,a2,a3,a4,a5) {
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
    jsCall(2,a1|0,a2|0,a3|0,a4|0,a5|0);
  }



  function jsCall_viiiii_3(a1,a2,a3,a4,a5) {
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
    jsCall(3,a1|0,a2|0,a3|0,a4|0,a5|0);
  }



  function dynCall_vi(index,a1) {
    index = index|0;
    a1=a1|0;
    FUNCTION_TABLE_vi[index&63](a1|0);
  }


  function jsCall_vi_0(a1) {
    a1=a1|0;
    jsCall(0,a1|0);
  }



  function jsCall_vi_1(a1) {
    a1=a1|0;
    jsCall(1,a1|0);
  }



  function jsCall_vi_2(a1) {
    a1=a1|0;
    jsCall(2,a1|0);
  }



  function jsCall_vi_3(a1) {
    a1=a1|0;
    jsCall(3,a1|0);
  }



  function dynCall_vii(index,a1,a2) {
    index = index|0;
    a1=a1|0; a2=a2|0;
    FUNCTION_TABLE_vii[index&63](a1|0,a2|0);
  }


  function jsCall_vii_0(a1,a2) {
    a1=a1|0; a2=a2|0;
    jsCall(0,a1|0,a2|0);
  }



  function jsCall_vii_1(a1,a2) {
    a1=a1|0; a2=a2|0;
    jsCall(1,a1|0,a2|0);
  }



  function jsCall_vii_2(a1,a2) {
    a1=a1|0; a2=a2|0;
    jsCall(2,a1|0,a2|0);
  }



  function jsCall_vii_3(a1,a2) {
    a1=a1|0; a2=a2|0;
    jsCall(3,a1|0,a2|0);
  }



  function dynCall_ii(index,a1) {
    index = index|0;
    a1=a1|0;
    return FUNCTION_TABLE_ii[index&63](a1|0)|0;
  }


  function jsCall_ii_0(a1) {
    a1=a1|0;
    return jsCall(0,a1|0)|0;
  }



  function jsCall_ii_1(a1) {
    a1=a1|0;
    return jsCall(1,a1|0)|0;
  }



  function jsCall_ii_2(a1) {
    a1=a1|0;
    return jsCall(2,a1|0)|0;
  }



  function jsCall_ii_3(a1) {
    a1=a1|0;
    return jsCall(3,a1|0)|0;
  }



  function dynCall_viii(index,a1,a2,a3) {
    index = index|0;
    a1=a1|0; a2=a2|0; a3=a3|0;
    FUNCTION_TABLE_viii[index&15](a1|0,a2|0,a3|0);
  }


  function jsCall_viii_0(a1,a2,a3) {
    a1=a1|0; a2=a2|0; a3=a3|0;
    jsCall(0,a1|0,a2|0,a3|0);
  }



  function jsCall_viii_1(a1,a2,a3) {
    a1=a1|0; a2=a2|0; a3=a3|0;
    jsCall(1,a1|0,a2|0,a3|0);
  }



  function jsCall_viii_2(a1,a2,a3) {
    a1=a1|0; a2=a2|0; a3=a3|0;
    jsCall(2,a1|0,a2|0,a3|0);
  }



  function jsCall_viii_3(a1,a2,a3) {
    a1=a1|0; a2=a2|0; a3=a3|0;
    jsCall(3,a1|0,a2|0,a3|0);
  }



  function dynCall_v(index) {
    index = index|0;
    
    FUNCTION_TABLE_v[index&31]();
  }


  function jsCall_v_0() {
    
    jsCall(0);
  }



  function jsCall_v_1() {
    
    jsCall(1);
  }



  function jsCall_v_2() {
    
    jsCall(2);
  }



  function jsCall_v_3() {
    
    jsCall(3);
  }



  function dynCall_iii(index,a1,a2) {
    index = index|0;
    a1=a1|0; a2=a2|0;
    return FUNCTION_TABLE_iii[index&31](a1|0,a2|0)|0;
  }


  function jsCall_iii_0(a1,a2) {
    a1=a1|0; a2=a2|0;
    return jsCall(0,a1|0,a2|0)|0;
  }



  function jsCall_iii_1(a1,a2) {
    a1=a1|0; a2=a2|0;
    return jsCall(1,a1|0,a2|0)|0;
  }



  function jsCall_iii_2(a1,a2) {
    a1=a1|0; a2=a2|0;
    return jsCall(2,a1|0,a2|0)|0;
  }



  function jsCall_iii_3(a1,a2) {
    a1=a1|0; a2=a2|0;
    return jsCall(3,a1|0,a2|0)|0;
  }



  function dynCall_viiii(index,a1,a2,a3,a4) {
    index = index|0;
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
    FUNCTION_TABLE_viiii[index&31](a1|0,a2|0,a3|0,a4|0);
  }


  function jsCall_viiii_0(a1,a2,a3,a4) {
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
    jsCall(0,a1|0,a2|0,a3|0,a4|0);
  }



  function jsCall_viiii_1(a1,a2,a3,a4) {
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
    jsCall(1,a1|0,a2|0,a3|0,a4|0);
  }



  function jsCall_viiii_2(a1,a2,a3,a4) {
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
    jsCall(2,a1|0,a2|0,a3|0,a4|0);
  }



  function jsCall_viiii_3(a1,a2,a3,a4) {
    a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
    jsCall(3,a1|0,a2|0,a3|0,a4|0);
  }


function b0(p0,p1,p2) { p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(0);return 0; }
  function b1(p0,p1,p2,p3,p4) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_viiiii(1); }
  function b2(p0) { p0 = p0|0; nullFunc_vi(2); }
  function b3(p0,p1) { p0 = p0|0;p1 = p1|0; nullFunc_vii(3); }
  function _emscripten_longjmp__wrapper(p0,p1) { p0 = p0|0;p1 = p1|0; _emscripten_longjmp(p0|0,p1|0); }
  function b4(p0) { p0 = p0|0; nullFunc_ii(4);return 0; }
  function b5(p0,p1,p2) { p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_viii(5); }
  function b6() { ; nullFunc_v(6); }
  function b7(p0,p1) { p0 = p0|0;p1 = p1|0; nullFunc_iii(7);return 0; }
  function b8(p0,p1,p2,p3) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_viiii(8); }
  // EMSCRIPTEN_END_FUNCS
  var FUNCTION_TABLE_iiii = [b0,b0,jsCall_iiii_0,b0,jsCall_iiii_1,b0,jsCall_iiii_2,b0,jsCall_iiii_3,b0,b0,b0,b0,b0,b0,b0,b0,b0,_EdgeLeq,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
  ,b0,b0,b0,b0,b0,___gl_meshSetWindingNumber,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
  ,b0,b0,b0,b0,b0];
  var FUNCTION_TABLE_viiiii = [b1,b1,jsCall_viiiii_0,b1,jsCall_viiiii_1,b1,jsCall_viiiii_2,b1,jsCall_viiiii_3,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,___gl_noCombineData,b1,b1,b1,b1,b1,b1,b1,b1,b1
  ,b1,b1,b1];
  var FUNCTION_TABLE_vi = [b2,b2,jsCall_vi_0,b2,jsCall_vi_1,b2,jsCall_vi_2,b2,jsCall_vi_3,b2,b2,b2,b2,b2,b2,b2,___gl_noEndData,b2,b2,b2,b2,_noBegin,_noEdgeFlag,_noVertex,b2,_noError,b2,_noMesh,b2
  ,b2,b2,b2,___gl_projectPolygon,b2,b2,b2,___gl_meshCheckMesh,b2,b2,___gl_meshDiscardExterior,___gl_meshDeleteMesh,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
  ,b2,b2,b2,b2,b2];
  var FUNCTION_TABLE_vii = [b3,b3,jsCall_vii_0,b3,jsCall_vii_1,b3,jsCall_vii_2,b3,jsCall_vii_3,b3,b3,b3,b3,___gl_noBeginData,___gl_noEdgeFlagData,___gl_noVertexData,b3,b3,b3,b3,___gl_noErrorData,b3,b3,b3,b3,b3,b3,b3,_GotoState
  ,b3,b3,_emscripten_longjmp__wrapper,b3,b3,b3,b3,b3,___gl_renderBoundary,___gl_renderMesh,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
  ,b3,b3,b3,b3,b3];
  var FUNCTION_TABLE_ii = [b4,b4,jsCall_ii_0,b4,jsCall_ii_1,b4,jsCall_ii_2,b4,jsCall_ii_3,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
  ,___gl_renderCache,_EmptyCache,b4,b4,___gl_computeInterior,b4,___gl_meshTessellateInterior,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
  ,b4,b4,b4,b4,b4];
  var FUNCTION_TABLE_viii = [b5,b5,jsCall_viii_0,b5,jsCall_viii_1,b5,jsCall_viii_2,b5,jsCall_viii_3,b5,_RenderStrip,_RenderFan,_RenderTriangle,b5,b5,b5];
  var FUNCTION_TABLE_v = [b6,b6,jsCall_v_0,b6,jsCall_v_1,b6,jsCall_v_2,b6,jsCall_v_3,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,_noEnd,b6,b6,b6,b6
  ,b6,b6,b6];
  var FUNCTION_TABLE_iii = [b7,b7,jsCall_iii_0,b7,jsCall_iii_1,b7,jsCall_iii_2,b7,jsCall_iii_3,b7,b7,b7,b7,b7,b7,b7,b7,___gl_vertLeq,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7
  ,b7,b7,b7];
  var FUNCTION_TABLE_viiii = [b8,b8,jsCall_viiii_0,b8,jsCall_viiii_1,b8,jsCall_viiii_2,b8,jsCall_viiii_3,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,_noCombine,b8,b8
  ,b8,b8,b8];

  return { _testSetjmp: _testSetjmp, _saveSetjmp: _saveSetjmp, _gluTessNormal: _gluTessNormal, _free: _free, _gluNewTess: _gluNewTess, _gluTessProperty: _gluTessProperty, _gluDeleteTess: _gluDeleteTess, _strlen: _strlen, _memset: _memset, _malloc: _malloc, _memcpy: _memcpy, _gluTessBeginContour: _gluTessBeginContour, _gluTessEndContour: _gluTessEndContour, _realloc: _realloc, _gluTessVertex: _gluTessVertex, _gluTessBeginPolygon: _gluTessBeginPolygon, _gluTessEndPolygon: _gluTessEndPolygon, _gluTessCallback: _gluTessCallback, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_iiii: dynCall_iiii, dynCall_viiiii: dynCall_viiiii, dynCall_vi: dynCall_vi, dynCall_vii: dynCall_vii, dynCall_ii: dynCall_ii, dynCall_viii: dynCall_viii, dynCall_v: dynCall_v, dynCall_iii: dynCall_iii, dynCall_viiii: dynCall_viiii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var real__testSetjmp = asm["_testSetjmp"]; asm["_testSetjmp"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__testSetjmp.apply(null, arguments);
};

var real__saveSetjmp = asm["_saveSetjmp"]; asm["_saveSetjmp"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__saveSetjmp.apply(null, arguments);
};

var real__gluTessNormal = asm["_gluTessNormal"]; asm["_gluTessNormal"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluTessNormal.apply(null, arguments);
};

var real__gluNewTess = asm["_gluNewTess"]; asm["_gluNewTess"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluNewTess.apply(null, arguments);
};

var real__gluTessProperty = asm["_gluTessProperty"]; asm["_gluTessProperty"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluTessProperty.apply(null, arguments);
};

var real__gluDeleteTess = asm["_gluDeleteTess"]; asm["_gluDeleteTess"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluDeleteTess.apply(null, arguments);
};

var real__strlen = asm["_strlen"]; asm["_strlen"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__strlen.apply(null, arguments);
};

var real__gluTessBeginContour = asm["_gluTessBeginContour"]; asm["_gluTessBeginContour"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluTessBeginContour.apply(null, arguments);
};

var real__gluTessEndContour = asm["_gluTessEndContour"]; asm["_gluTessEndContour"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluTessEndContour.apply(null, arguments);
};

var real__realloc = asm["_realloc"]; asm["_realloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__realloc.apply(null, arguments);
};

var real__gluTessVertex = asm["_gluTessVertex"]; asm["_gluTessVertex"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluTessVertex.apply(null, arguments);
};

var real__gluTessBeginPolygon = asm["_gluTessBeginPolygon"]; asm["_gluTessBeginPolygon"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluTessBeginPolygon.apply(null, arguments);
};

var real__gluTessEndPolygon = asm["_gluTessEndPolygon"]; asm["_gluTessEndPolygon"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluTessEndPolygon.apply(null, arguments);
};

var real__gluTessCallback = asm["_gluTessCallback"]; asm["_gluTessCallback"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__gluTessCallback.apply(null, arguments);
};

var real_runPostSets = asm["runPostSets"]; asm["runPostSets"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_runPostSets.apply(null, arguments);
};
var _testSetjmp = Module["_testSetjmp"] = asm["_testSetjmp"];
var _saveSetjmp = Module["_saveSetjmp"] = asm["_saveSetjmp"];
var _gluTessNormal = Module["_gluTessNormal"] = asm["_gluTessNormal"];
var _free = Module["_free"] = asm["_free"];
var _gluNewTess = Module["_gluNewTess"] = asm["_gluNewTess"];
var _gluTessProperty = Module["_gluTessProperty"] = asm["_gluTessProperty"];
var _gluDeleteTess = Module["_gluDeleteTess"] = asm["_gluDeleteTess"];
var _strlen = Module["_strlen"] = asm["_strlen"];
var _memset = Module["_memset"] = asm["_memset"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _gluTessBeginContour = Module["_gluTessBeginContour"] = asm["_gluTessBeginContour"];
var _gluTessEndContour = Module["_gluTessEndContour"] = asm["_gluTessEndContour"];
var _realloc = Module["_realloc"] = asm["_realloc"];
var _gluTessVertex = Module["_gluTessVertex"] = asm["_gluTessVertex"];
var _gluTessBeginPolygon = Module["_gluTessBeginPolygon"] = asm["_gluTessBeginPolygon"];
var _gluTessEndPolygon = Module["_gluTessEndPolygon"] = asm["_gluTessEndPolygon"];
var _gluTessCallback = Module["_gluTessCallback"] = asm["_gluTessCallback"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];


// Warning: printing of i64 values may be slightly rounded! No deep i64 math used, so precise i64 code not included
var i64Math = null;

// === Auto-generated postamble setup entry stuff ===

if (memoryInitializer) {
  if (typeof Module['locateFile'] === 'function') {
    memoryInitializer = Module['locateFile'](memoryInitializer);
  } else if (Module['memoryInitializerPrefixURL']) {
    memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, STATIC_BASE);
  } else {
    addRunDependency('memory initializer');
    Browser.asyncLoad(memoryInitializer, function(data) {
      for (var i = 0; i < data.length; i++) {
        assert(HEAPU8[STATIC_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
      }
      HEAPU8.set(data, STATIC_BASE);
      removeRunDependency('memory initializer');
    }, function(data) {
      throw 'could not load memory initializer ' + memoryInitializer;
    });
  }
}

function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun'] && shouldRunNow) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);

  initialStackTop = STACKTOP;

  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return;
  }

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return; 

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['_main'] && shouldRunNow) {
      Module['callMain'](args);
    }

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status) {
  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so not exiting');
    return;
  }

  ABORT = true;
  EXITSTATUS = status;
  STACKTOP = initialStackTop;

  // exit the runtime
  exitRuntime();

  if (ENVIRONMENT_IS_NODE) {
    // Work around a node.js bug where stdout buffer is not flushed at process exit:
    // Instead of process.exit() directly, wait for stdout flush event.
    // See https://github.com/joyent/node/issues/1669 and https://github.com/kripken/emscripten/issues/2582
    // Workaround is based on https://github.com/RReverser/acorn/commit/50ab143cecc9ed71a2d66f78b4aec3bb2e9844f6
    process['stdout']['once']('drain', function () {
      process['exit'](status);
    });
    console.log(' '); // Make sure to print something to force the drain event to occur, in case the stdout buffer was empty.
    // Work around another node bug where sometimes 'drain' is never fired - make another effort
    // to emit the exit status, after a significant delay (if node hasn't fired drain by then, give up)
    setTimeout(function() {
      process['exit'](status);
    }, 500);
  } else
  if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

function abort(text) {
  if (text) {
    Module.print(text);
    Module.printErr(text);
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  throw 'abort() at ' + stackTrace() + extra;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}






// {{MODULE_ADDITIONS}}




var gluNewTess = Module.cwrap('gluNewTess', 'number', []);
var gluDeleteTess = Module.cwrap('gluDeleteTess', 'void', ['number']);
var gluTessProperty = Module.cwrap('gluTessProperty', 'void', ['number', 'number', 'number']);
var gluTessNormal = Module.cwrap('gluTessNormal', 'void', ['number', 'number', 'number', 'number']);
var gluTessCallback = Module.cwrap('gluTessCallback', 'void', ['number', 'number', 'number']);
var gluTessVertex = Module.cwrap('gluTessVertex', 'void', ['number', 'number', 'number']);
var gluTessBeginPolygon = Module.cwrap('gluTessBeginPolygon', 'void', ['number', 'number']);
var gluTessBeginContour = Module.cwrap('gluTessBeginContour', 'void', ['number']);
var gluTessEndContour = Module.cwrap('gluTessEndContour', 'void', ['number']);
var gluTessEndPolygon = Module.cwrap('gluTessEndPolygon', 'void', ['number']);

var res = [];
var vertexCallback = Runtime.addFunction(function(vtxptr) {
  var x = Module.HEAPF32[vtxptr>>2];
  var y = Module.HEAPF32[(vtxptr>>2)+1];
  res.push([x ,y]);
});

var combineCallback = Runtime.addFunction(function(vtx, neighbor, weight, out) {
	var buf = Module._malloc(3*4);
	Module.HEAPU32[out>>2] = buf;
	Module.HEAPF32[(buf>>2)] = Module.HEAPF32[(vtx>>2)];
	Module.HEAPF32[(buf>>2)+1] = Module.HEAPF32[(vtx>>2)+1];
});

var edgeCallback = Runtime.addFunction(function() {
});

var errorCallback = Runtime.addFunction(function(error) {
  console.log('Error ' + error);
});

var tess = gluNewTess();
gluTessProperty(tess, 100140, 100132);
gluTessNormal(tess, 0, 0, 1);
gluTessCallback(tess, 100101, vertexCallback);
gluTessCallback(tess, 100103, errorCallback);
gluTessCallback(tess, 100104, edgeCallback);
gluTessCallback(tess, 100105, combineCallback);

function alloc(contours) {
  var arr = [];
  for (var i = 0; i < contours.length; i++) {
    var c = contours[i];
    for (v = 0; v < c.length; v+=2) {
      arr.push(c[v], c[v+1], 0);
    }
  }
  var buf = Module._malloc(arr.length*4);
  Module.HEAPF32.set(arr, buf>>2);
  return buf;
}

function free(buf) {
  Module._free(buf);
}

exports.tesselate = function(contours) {
  res = [];
  var buf = alloc(contours);
  var vtx = buf;
  gluTessBeginPolygon(tess, 0);
  for (var i = 0; i < contours.length; i++) {
    var c = contours[i];
    gluTessBeginContour(tess);
    for (var v = 0; v < c.length/2; v++) {
      gluTessVertex(tess, vtx, vtx);
      vtx += 12;
    }
    gluTessEndContour(tess);
  }
  gluTessEndPolygon(tess);
  free(buf);
  return res;
}

});
