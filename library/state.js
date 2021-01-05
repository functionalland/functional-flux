import __ from "https://deno.land/x/ramda@v0.27.2/source/__.js";
import ap from "https://deno.land/x/ramda@v0.27.2/source/ap.js";
import always from "https://deno.land/x/ramda@v0.27.2/source/converge.js";
import applySpec from "https://deno.land/x/ramda@v0.27.2/source/applySpec.js"
import applyTo from "https://deno.land/x/ramda@v0.27.2/source/applyTo.js"
import chain from "https://deno.land/x/ramda@v0.27.2/source/chain.js";
import converge from "https://deno.land/x/ramda@v0.27.2/source/converge.js";
import curry from "https://deno.land/x/ramda@v0.27.2/source/curry.js";
import flip from "https://deno.land/x/ramda@v0.27.2/source/flip.js";
import identity from "https://deno.land/x/ramda@v0.27.2/source/identity.js";
import ifElse from "https://deno.land/x/ramda@v0.27.2/source/ifElse.js";
import isEmpty from "https://deno.land/x/ramda@v0.27.2/source/isEmpty.js";
import juxt from "https://deno.land/x/ramda@v0.27.2/source/juxt.js";
import lift from "https://deno.land/x/ramda@v0.27.2/source/lift.js";
import map from "https://deno.land/x/ramda@v0.27.2/source/map.js";
import mergeDeepRight from "https://deno.land/x/ramda@v0.27.2/source/mergeDeepRight.js";
import pipe from "https://deno.land/x/ramda@v0.27.2/source/pipe.js";
import prop from "https://deno.land/x/ramda@v0.27.2/source/prop.js";
import reduce from "https://deno.land/x/ramda@v0.27.2/source/reduce.js";
import useWith from "https://deno.land/x/ramda@v0.27.2/source/useWith.js";

import Task from "https://deno.land/x/functional@v1.3.3/library/Task.js";
import { $$value } from "https://deno.land/x/functional@v1.3.3/library/Symbols.js";
import { factorizeType } from "https://deno.land/x/functional@v1.3.2/library/factories.js";
import { evert } from "../../functional/library/utilities.js";

import { debug } from "./utilities.js";

/**
 * ### `factorizeEventIterator`
 * `DOMElement -> AsyncIterable`
 */
export const factorizeEventIterator = $$element => (
  {
    [Symbol.asyncIterator]() {
      return {
        next() {
          return new Promise(resolve => {
            let eventList = [];
            $$element.addEventListener(
              "$$fl-render",
              event => {
                eventList.push(event);
                resolve({ value: eventList, done: false });
              },
              { once: true }
            );
          });
        }
      };
    }
  }
);

export const forceRender = () => document.dispatchEvent(new CustomEvent("$$fl-render", { detail: _ => Task.of({}) }))
  && undefined

/**
 * ### `stream`
 * `((a, b) -> a) -> a -> AsyncIterable b -> a`
 */
export const stream = curry(
  async (binaryFunction, accumulator, iterator) => {
    for await (const data of iterator) {
      debug("[0] Handling state update", binaryFunction(accumulator))(data)
        .run()
        .then(
          container => container.fold({
            Left: error => console.error(error),
            Right: state => (accumulator = state)
          })
        );
    }

    return accumulator;
  }
);

/**
 * ### `streamEvent`
 * `DOMElement -> AsyncIterator -> ({ String: * } -> (DOMElement -> { String: * } -> Task { String: * })) -> _|_`
 */
export const streamEvent = curry(($$element, iterator) =>
  curry(
    async (initialState, binaryFunction) => {
      stream(
        curry(
          (state, eventList) =>
            pipe(
              map(pipe(prop("detail"), applyTo(state))),
              evert(Task),
              chain(
                pipe(
                  reduce(mergeDeepRight, state),
                  ap(
                    curry(
                      (fragment, task) => task.map(mergeDeepRight(fragment))
                    ),
                    binaryFunction($$element)
                  )
                )
              )
            )(eventList)
        ),
        initialState,
        iterator
      );
    }
  )
);

/**
 * `{ String: DOMElement -> * } -> (DOMElement -> { String: * } -> Task { String: * }) -> DOMElement -> _|_`
 */
export const renderApplication = curry(
  (state, binaryFunction) => pipe(
    ap(
      curry(
        ($$element, state) =>
          ap(streamEvent, factorizeEventIterator)($$element)(state, binaryFunction)
      ),
      applySpec(state)
    ),
    _ => forceRender()
  )
);

/**
 * `([ (DOMElement, { String: * }) -> Boolean, (DOMElement, { String: * }) -> Task{ String: * } ], ...) -> Task  { String: * }[]`
 */
export const processEvents = (...handlerList) => converge(
  (...taskList) => evert(Task, taskList).map(reduce(mergeDeepRight, {})),
  map(
    ([ predicate, handler ]) =>
      curry(
        ($$element, state) => predicate($$element, state) && handler($$element, state) || Task.of({})
      ),
    handlerList
  )
);