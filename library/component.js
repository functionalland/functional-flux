import ap from "https://deno.land/x/ramda@v0.27.2/source/ap.js";
import curry from "https://deno.land/x/ramda@v0.27.2/source/curry.js";
import equals from "https://deno.land/x/ramda@v0.27.2/source/equals.js";
import keys from "https://deno.land/x/ramda@v0.27.2/source/keys.js";
import map from "https://deno.land/x/ramda@v0.27.2/source/map.js";
import mergeDeepRight from "https://deno.land/x/ramda@v0.27.2/source/mergeDeepRight.js";
import pipe from "https://deno.land/x/ramda@v0.27.2/source/pipe.js";
import reduce from "https://deno.land/x/ramda@v0.27.2/source/reduce.js";

import Task from "http://x.ld:8069/functional/library/Task.js";
import { evert, log } from "http://x.ld:8069/functional/library/utilities.js";

import Request from "https://deno.land/x/functional_io@v1.1.1/library/Request.js";
import { fetch } from "https://deno.land/x/functional_io@v1.1.1/library/browser_safe.js";

import { streamEvent } from "./state.js";
import { debug } from "./utilities.js";

const $$definedComponents = Symbol.for("DefinedComponents");
const $$component = Symbol.for("Component");

window[$$definedComponents] = [];

const factorizeFunctionalComponentClass = () => (
  class FunctionalComponent extends HTMLElement {
    constructor(unaryFunction) {
      super();
      unaryFunction && unaryFunction(this);
    }
  }
)

/**
 * `*[] -> (DOMElement -> void) -> (DOMElement -> { String: * } -> Task { String: * }) -> [ (DOMElement -> { String: * } -> Boolean, (DOMElement -> { String: * } -> Task { String: * }) ]`
 */
export const defineComponent = curry(
  (
    [
      componentName,
      initialState,
      stateFunction = x => x,
      attributes = [],
      attributeChangedCallback,
      connectedCallback,
      disconnectedCallback,
    ],
    preRenderFunction,
    renderFunction
  ) => {
    const FunctionalComponent = factorizeFunctionalComponentClass();
    const $$component = function () {
      return Reflect.construct(FunctionalComponent, [ preRenderFunction ], new.target);
    };

    Object.setPrototypeOf($$component.prototype, FunctionalComponent.prototype);
    Object.setPrototypeOf($$component, FunctionalComponent);

    if (attributes.length > 0) Object.defineProperty(
      $$component,
      "observedAttributes",
      {
        get() {

          return attributes;
        }
      }
    );

    $$component.prototype.connectedCallback = function () {
      debug("[3] Component is connected")(this);

      if (connectedCallback)
        this.dispatchEvent(
          new CustomEvent("$$fl-render", { bubbles: true, detail: connectedCallback(this) })
        );
    };
    $$component.prototype.disconnectedCallback = function () {
      debug("[3] Component is disconnected")(this);

      if (disconnectedCallback)
        this.dispatchEvent(
          new CustomEvent("$$fl-render", { bubbles: true, detail: disconnectedCallback(this) })
        );
    };
    $$component.prototype.attributeChangedCallback = function (attributeName, oldValue, newValue) {
      debug("[3] Component has new attributes")(this);

      if (oldValue !== newValue && attributeChangedCallback)
        this.dispatchEvent(
          new CustomEvent("$$fl-render", { bubbles: true, detail: attributeChangedCallback(this) })
        );
    };

    $$component.prototype[$$component] = true;

    window[$$definedComponents].push(componentName);

    window.customElements.define(componentName, $$component);

    let previousState = {};

    return [
      ($$element, state) =>
        pipe(
          stateFunction,
          ap(
            curry(
              (newState, isDifferent) => {
                previousState = newState;

                return !isDifferent
              }
            ),
            equals(previousState)
          ),
        )(state),
      ($$element, state) => debug(
        "[2] Rendering component",
        pipe(
          selector => Array.prototype.map.call(
            $$element.querySelectorAll(selector),
            e => renderFunction(e, stateFunction(state))
          ),
          pipe(
            evert(Task),
            map(reduce(mergeDeepRight, {}))
          )
        )
      )(componentName)
    ];
  }
)

export const factorizeShadowFromHTML = curry(
  (html, $$element) => {
    $$element.attachShadow({ mode: 'open' }).innerHTML = html;

    return $$element;
  }
);

export const factorizeShadowFromTemplate = curry(
  (templateID, $$element) => {
    const $$shadowRoot = $$element.attachShadow({ mode: 'open' });
    $$shadowRoot.appendChild(
      document.querySelector(`#${templateID}`).content.cloneNode(true)
    );
  }
);

export const factorizeShadowFromExternalAsset = curry(
  (url, $$element) => {
    map(
      map(
        _buffer => {
          const $$shadowRoot = $$element.attachShadow({ mode: 'open' });
          $$shadowRoot.innerHTML = new TextDecoder().decode(_buffer);
        }
      ),
      fetch(Request.post(url, new Uint8Array({})))
    )
      .run()
      .then(
        container => container.fold({
          Left: error => {
            throw error;
          },
          Right: value => value
        })
      );
  }
);

// export const renderAllDefinedComponents = curry(
//   ($$element, state) => pipe(
//     keys,
//     reduce(
//       (accumulator, selector) =>
//         [
//           ...accumulator,
//           ...Array.prototype.map.call($$element.querySelectorAll(selector), e => e.render($$element, state))
//         ],
//       []
//     ),
//     pipe(
//       evert(Task),
//       map(reduce(mergeDeepRight, {}))
//     )
//   )(window[$$definedComponents])
// );

