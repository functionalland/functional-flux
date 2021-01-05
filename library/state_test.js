import { assert, assertEquals } from "https://deno.land/std@0.79.0/testing/asserts.ts"
import { curry } from "https://deno.land/x/ramda@v0.27.2/mod.ts";

import Task from "https://deno.land/x/functional@v1.3.3/library/Task.js";

import { factorizeEventIterator, streamEvent } from "./state.js";

export const $$inspect = typeof Deno !== "undefined" ? Deno.customInspect : "inspect";

const factorizeMockElement = () => (
  {
    addEventListener: (eventName, unaryFunction) => addEventListener(eventName, unaryFunction),
    dispatchEvent: event => dispatchEvent(event),
    [$$inspect]: () => "MockElement()"
  }
);

Deno.test(
  "streamEvent",
  async () => {
    const $$element = factorizeMockElement();
    const asyncIterator = factorizeEventIterator($$element);

    const initializeRoot = streamEvent($$element, asyncIterator);

    let count = 0;
    const reference = [
      { hoge: "hogefuga", fuga: "fugapiyo" },
      { hoge: "hogefuga", fuga: "fugapiyo", piyo: "piyohoge", number: 42 }
    ];

    initializeRoot(
      { hoge: "piyo" },
      curry(
        ($$element, state) => {
          assertEquals(state, reference[count++]);

          return Task.of({ number: 42 });
        }
      )
    );

    $$element.dispatchEvent(
      new CustomEvent("$$fl-render", { bubbles: false, detail: _ => Task.of({ hoge: "hogefuga" }) })
    );
    $$element.dispatchEvent(
      new CustomEvent("$$fl-render", { bubbles: false, detail: _ => Task.of({ fuga: "fugapiyo" }) })
    );

    setTimeout(
      _ =>
        $$element.dispatchEvent(
          new CustomEvent("$$fl-render", { bubbles: false, detail: _ => Task.of({ piyo: "piyohoge" }) })
        ),
      500
    );

    let interval;

    return new Promise(
      resolve => {
        interval = setInterval(_ => count === 2 && resolve() && clearInterval(this), 1000);
      }
    )
      .then(_ => clearInterval(interval));
  }
);