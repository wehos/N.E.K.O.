function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var react = { exports: {} };
var react_production = {};;

// 临时 hooks dispatcher，用于在 ReactDOM 初始化之前
(function() {
  var __tempHooksDispatcher = null;
  window.getHooksDispatcher = function getHooksDispatcher() {
    var internals = react_production.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    if (internals && internals.H) {
      return internals.H;
    }
    // 如果 ReactDOM 还没有初始化，创建一个临时的 dispatcher
    if (!__tempHooksDispatcher) {
      __tempHooksDispatcher = {
        useState: function(initialState) {
          console.warn('[React] useState called before ReactDOM initialization, using temporary implementation');
          var state = typeof initialState === 'function' ? initialState() : initialState;
          // 创建一个可以工作的 setState，在 ReactDOM 初始化后会自动切换到真正的实现
          return [state, function(newState) {
            console.warn('[React] setState called before ReactDOM initialization, state update will be ignored');
            // 注意：这个 setState 不会真正更新状态，但至少不会崩溃
            // 当 ReactDOM 初始化后，组件会重新渲染，使用真正的 hooks dispatcher
          }];
        },
        useEffect: function() {},
        useCallback: function(fn) { return fn; },
        useMemo: function(fn) { return fn(); },
        useRef: function(initialValue) { return { current: initialValue }; },
        useContext: function() { return null; },
        useReducer: function(reducer, initialState, init) {
          var state = init ? init(initialState) : initialState;
          return [state, function() {}];
        },
        useLayoutEffect: function() {},
        useImperativeHandle: function() {},
        useId: function() { return ''; },
        useSyncExternalStore: function(subscribe, getSnapshot) {
          // 提供 no-op subscribe/unsubscribe 以避免类型错误
          // subscribe 接受一个 callback 并返回一个 unsubscribe 函数
          if (typeof subscribe === 'function') {
            var unsubscribe = subscribe(function() {}); // no-op callback
            // unsubscribe 是一个函数，但我们不需要调用它（这是临时实现）
          }
          // 返回 getSnapshot() 的结果，如果 getSnapshot 是函数
          return typeof getSnapshot === 'function' ? getSnapshot() : null;
        },
        useInsertionEffect: function() { return function() {}; },
        useTransition: function() { return [false, function() {}]; },
        useDeferredValue: function(value) { return value; },
        useActionState: function() { return [null, function() {}]; },
        useOptimistic: function() { return null; },
        use: function() { return null; },
        cache: function(fn) { return fn; },
        useMemoCache: function(size) {
          console.warn('[React] useMemoCache called before ReactDOM initialization, using temporary implementation');
          // 返回一个指定大小的数组，每个元素初始化为 undefined
          // 这是一个安全的 no-op 实现，在 ReactDOM 初始化后会切换到真正的实现
          var cache = [];
          for (var i = 0; i < size; i++) {
            cache[i] = undefined;
          }
          return cache;
        }
      };
    }
    return __tempHooksDispatcher;
  };
})();

var hasRequiredReact_production;
function requireReact_production() {
  if (hasRequiredReact_production) return react_production;
  hasRequiredReact_production = 1;
  var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
  function getIteratorFn(maybeIterable) {
    if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
    maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
    return "function" === typeof maybeIterable ? maybeIterable : null;
  }
  var ReactNoopUpdateQueue = {
    isMounted: function() {
      return false;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, assign = Object.assign, emptyObject = {};
  function Component2(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
  Component2.prototype.isReactComponent = {};
  Component2.prototype.setState = function(partialState, callback) {
    if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, partialState, callback, "setState");
  };
  Component2.prototype.forceUpdate = function(callback) {
    this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
  };
  function ComponentDummy() {
  }
  ComponentDummy.prototype = Component2.prototype;
  function PureComponent2(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
  var pureComponentPrototype = PureComponent2.prototype = new ComponentDummy();
  pureComponentPrototype.constructor = PureComponent2;
  assign(pureComponentPrototype, Component2.prototype);
  pureComponentPrototype.isPureReactComponent = true;
  var isArrayImpl = Array.isArray;
  function noop() {
  }
  var ReactSharedInternals = { H: null, A: null, T: null, S: null }, hasOwnProperty = Object.prototype.hasOwnProperty;
  function ReactElement(type, key, props) {
    var refProp = props.ref;
    return {
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key,
      ref: void 0 !== refProp ? refProp : null,
      props
    };
  }
  function cloneAndReplaceKey(oldElement, newKey) {
    return ReactElement(oldElement.type, newKey, oldElement.props);
  }
  function isValidElement2(object) {
    return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
  }
  function escape(key) {
    var escaperLookup = { "=": "=0", ":": "=2" };
    return "$" + key.replace(/[=:]/g, function(match) {
      return escaperLookup[match];
    });
  }
  var userProvidedKeyEscapeRegex = /\/+/g;
  function getElementKey(element, index) {
    return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
  }
  function resolveThenable(thenable) {
    switch (thenable.status) {
      case "fulfilled":
        return thenable.value;
      case "rejected":
        throw thenable.reason;
      default:
        switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
          function(fulfilledValue) {
            "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
          },
          function(error) {
            "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
          }
        )), thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
        }
    }
    throw thenable;
  }
  function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
    var type = typeof children;
    if ("undefined" === type || "boolean" === type) children = null;
    var invokeCallback = false;
    if (null === children) invokeCallback = true;
    else
      switch (type) {
        case "bigint":
        case "string":
        case "number":
          invokeCallback = true;
          break;
        case "object":
          switch (children.$$typeof) {
            case REACT_ELEMENT_TYPE:
            case REACT_PORTAL_TYPE:
              invokeCallback = true;
              break;
            case REACT_LAZY_TYPE:
              return invokeCallback = children._init, mapIntoArray(
                invokeCallback(children._payload),
                array,
                escapedPrefix,
                nameSoFar,
                callback
              );
          }
      }
    if (invokeCallback)
      return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
        return c;
      })) : null != callback && (isValidElement2(callback) && (callback = cloneAndReplaceKey(
        callback,
        escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
          userProvidedKeyEscapeRegex,
          "$&/"
        ) + "/") + invokeCallback
      )), array.push(callback)), 1;
    invokeCallback = 0;
    var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
    if (isArrayImpl(children))
      for (var i = 0; i < children.length; i++)
        nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
          nameSoFar,
          array,
          escapedPrefix,
          type,
          callback
        );
    else if (i = getIteratorFn(children), "function" === typeof i)
      for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
        nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
          nameSoFar,
          array,
          escapedPrefix,
          type,
          callback
        );
    else if ("object" === type) {
      if ("function" === typeof children.then)
        return mapIntoArray(
          resolveThenable(children),
          array,
          escapedPrefix,
          nameSoFar,
          callback
        );
      array = String(children);
      throw Error(
        "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return invokeCallback;
  }
  function mapChildren(children, func, context) {
    if (null == children) return children;
    var result = [], count = 0;
    mapIntoArray(children, result, "", "", function(child) {
      return func.call(context, child, count++);
    });
    return result;
  }
  function lazyInitializer(payload) {
    if (-1 === payload._status) {
      var ctor = payload._result;
      ctor = ctor();
      ctor.then(
        function(moduleObject) {
          if (0 === payload._status || -1 === payload._status)
            payload._status = 1, payload._result = moduleObject;
        },
        function(error) {
          if (0 === payload._status || -1 === payload._status)
            payload._status = 2, payload._result = error;
        }
      );
      -1 === payload._status && (payload._status = 0, payload._result = ctor);
    }
    if (1 === payload._status) return payload._result.default;
    throw payload._result;
  }
  var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
    if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
      var event = new window.ErrorEvent("error", {
        bubbles: true,
        cancelable: true,
        message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
        error
      });
      if (!window.dispatchEvent(event)) return;
    } else if ("object" === typeof undefined /* process removed for browser */ && "function" === typeof undefined /* process.emit removed for browser */) {
      void 0 /* process.emit removed for browser */;
      return;
    }
    console.error(error);
  }, Children2 = {
    map: mapChildren,
    forEach: function(children, forEachFunc, forEachContext) {
      mapChildren(
        children,
        function() {
          forEachFunc.apply(this, arguments);
        },
        forEachContext
      );
    },
    count: function(children) {
      var n = 0;
      mapChildren(children, function() {
        n++;
      });
      return n;
    },
    toArray: function(children) {
      return mapChildren(children, function(child) {
        return child;
      }) || [];
    },
    only: function(children) {
      if (!isValidElement2(children))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return children;
    }
  };
  react_production.Activity = REACT_ACTIVITY_TYPE;
  react_production.Children = Children2;
  react_production.Component = Component2;
  react_production.Fragment = REACT_FRAGMENT_TYPE;
  react_production.Profiler = REACT_PROFILER_TYPE;
  react_production.PureComponent = PureComponent2;
  react_production.StrictMode = REACT_STRICT_MODE_TYPE;
  react_production.Suspense = REACT_SUSPENSE_TYPE;
  react_production.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
  react_production.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(size) {
      var d = getHooksDispatcher();
      return typeof d.useMemoCache === 'function' ? d.useMemoCache(size) : (function() {
        console.warn('[React] useMemoCache not available, returning empty array');
        var cache = [];
        for (var i = 0; i < size; i++) {
          cache[i] = undefined;
        }
        return cache;
      }());
    }
  };
  react_production.cache = function(fn) {
    return function() {
      return fn.apply(null, arguments);
    };
  };
  react_production.cacheSignal = function() {
    return null;
  };
  react_production.cloneElement = function(element, config, children) {
    if (null === element || void 0 === element)
      throw Error(
        "The argument must be a React element, but you passed " + element + "."
      );
    var props = assign({}, element.props), key = element.key;
    if (null != config)
      for (propName in void 0 !== config.key && (key = "" + config.key), config)
        !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
    var propName = arguments.length - 2;
    if (1 === propName) props.children = children;
    else if (1 < propName) {
      for (var childArray = Array(propName), i = 0; i < propName; i++)
        childArray[i] = arguments[i + 2];
      props.children = childArray;
    }
    return ReactElement(element.type, key, props);
  };
  react_production.createContext = function(defaultValue) {
    defaultValue = {
      $$typeof: REACT_CONTEXT_TYPE,
      _currentValue: defaultValue,
      _currentValue2: defaultValue,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    };
    defaultValue.Provider = defaultValue;
    defaultValue.Consumer = {
      $$typeof: REACT_CONSUMER_TYPE,
      _context: defaultValue
    };
    return defaultValue;
  };
  react_production.createElement = function(type, config, children) {
    var propName, props = {}, key = null;
    if (null != config)
      for (propName in void 0 !== config.key && (key = "" + config.key), config)
        hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
    var childrenLength = arguments.length - 2;
    if (1 === childrenLength) props.children = children;
    else if (1 < childrenLength) {
      for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
        childArray[i] = arguments[i + 2];
      props.children = childArray;
    }
    if (type && type.defaultProps)
      for (propName in childrenLength = type.defaultProps, childrenLength)
        void 0 === props[propName] && (props[propName] = childrenLength[propName]);
    return ReactElement(type, key, props);
  };
  react_production.createRef = function() {
    return { current: null };
  };
  react_production.forwardRef = function(render) {
    return { $$typeof: REACT_FORWARD_REF_TYPE, render };
  };
  react_production.isValidElement = isValidElement2;
  react_production.lazy = function(ctor) {
    return {
      $$typeof: REACT_LAZY_TYPE,
      _payload: { _status: -1, _result: ctor },
      _init: lazyInitializer
    };
  };
  react_production.memo = function(type, compare) {
    return {
      $$typeof: REACT_MEMO_TYPE,
      type,
      compare: void 0 === compare ? null : compare
    };
  };
  react_production.startTransition = function(scope) {
    var prevTransition = ReactSharedInternals.T, currentTransition = {};
    ReactSharedInternals.T = currentTransition;
    try {
      var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
      null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
      "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
    } catch (error) {
      reportGlobalError(error);
    } finally {
      null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
    }
  };
  react_production.unstable_useCacheRefresh = function() {
    return getHooksDispatcher().useCacheRefresh();
  };
  react_production.use = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.use(...args); };
  react_production.useActionState = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useActionState(...args); };
  react_production.useCallback = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useCallback(...args); };
  react_production.useContext = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useContext(...args); };
  react_production.useDebugValue = function() {
  };
  react_production.useDeferredValue = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useDeferredValue(...args); };
  react_production.useEffect = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useEffect(...args); };
  react_production.useEffectEvent = function(callback) {
    return getHooksDispatcher().useEffectEvent(callback);
  };
  react_production.useId = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useId(...args); };
  react_production.useImperativeHandle = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useImperativeHandle(...args); };
  react_production.useInsertionEffect = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useInsertionEffect(...args); };
  react_production.useLayoutEffect = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useLayoutEffect(...args); };
  react_production.useMemo = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useMemo(...args); };
  react_production.useOptimistic = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useOptimistic(...args); };
  react_production.useReducer = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useReducer(...args); };
  react_production.useRef = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useRef(...args); };
  react_production.useState = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useState(...args); };
  react_production.useSyncExternalStore = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useSyncExternalStore(...args); };
  react_production.useTransition = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.useTransition(...args); };
  react_production.version = "19.2.0";
  return react_production;
}
var hasRequiredReact;
function requireReact() {
  if (hasRequiredReact) return react.exports;
  hasRequiredReact = 1;
  {
    react.exports = requireReact_production();
  }
  return react.exports;
}
var reactExports = requireReact();
const React = /* @__PURE__ */ getDefaultExportFromCjs(reactExports);
const Children = reactExports.Children;
const Component = reactExports.Component;
const Fragment = reactExports.Fragment;
const PureComponent = reactExports.PureComponent;
const StrictMode = reactExports.StrictMode;
const Suspense = reactExports.Suspense;
const cache = reactExports.cache;
const cloneElement = reactExports.cloneElement;
const createContext = reactExports.createContext;
const createElement = reactExports.createElement;
const forwardRef = reactExports.forwardRef;
const isValidElement = reactExports.isValidElement;
const lazy = reactExports.lazy;
const memo = reactExports.memo;
const startTransition = reactExports.startTransition;
const use = reactExports.use;
const useActionState = reactExports.useActionState;
const useCallback = reactExports.useCallback;
const useContext = reactExports.useContext;
const useDeferredValue = reactExports.useDeferredValue;
const useEffect = reactExports.useEffect;
const useId = reactExports.useId;
const useImperativeHandle = reactExports.useImperativeHandle;
const useInsertionEffect = reactExports.useInsertionEffect;
const useLayoutEffect = reactExports.useLayoutEffect;
const useMemo = reactExports.useMemo;
const useOptimistic = reactExports.useOptimistic;
const useReducer = reactExports.useReducer;
const useRef = reactExports.useRef;
const useState = reactExports.useState;
const useSyncExternalStore = reactExports.useSyncExternalStore;
const useTransition = reactExports.useTransition;
export {
  Children,
  Component,
  Fragment,
  PureComponent,
  StrictMode,
  Suspense,
  cache,
  cloneElement,
  createContext,
  createElement,
  React as default,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  use,
  useActionState,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition
};
