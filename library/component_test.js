import { assert, assertEquals } from "https://deno.land/std@0.79.0/testing/asserts.ts"

import curry from "https://deno.land/x/ramda@v0.27.2/source/curry.js";

import Task from "http://x.ld:8069/functional/library/Task.js";

import { defineComponent } from "./component.js";

window.HTMLElement = function () {
  return Reflect.construct(
    function () {
    },
    [],
    new.target
  )
};

window.HTMLElement.prototype.hoge = "piyo";

Deno.test(
  "defineComponent: Mock component",
  async () => {
    let ComponentConstructor, componentContext;

    window.HTMLElement.prototype.querySelectorAll = function (selector) {
      assertEquals(selector, "fl-hoge");

      return [ new window.HTMLElement() ];
    };

    window.customElements = {
      define: (componentName, $$component) => (ComponentConstructor = $$component) || null
    }

    const [ binaryPredicate, binaryFunction ] = defineComponent(
      [ "fl-hoge" ],
      context => (componentContext = context) || ({}),
      curry(
        ($$element, state) => {
          assert($$element instanceof window.HTMLElement);
          assertEquals(state, { hoge: "piyo" });

          return Task.of({ hoge: "fuga" })
        }
      )
    );

    assert(binaryPredicate instanceof Function);
    assert(binaryFunction instanceof Function);

    assert(ComponentConstructor instanceof Function);

    const $$component = new ComponentConstructor();

    assertEquals($$component.hoge, "piyo", "The prototype chain is broken.");
    assertEquals(componentContext, {}, "The pre-render function is not called.");

    assert(!binaryPredicate(new window.HTMLElement(), {}), "The state is not different.");
    assert(binaryPredicate(new window.HTMLElement(), { hoge: "piyo" }), "The state is different.");

    assertEquals(
      (await binaryFunction(new window.HTMLElement(), { hoge: "piyo" }).run()).toString(),
      `Either.Right({"hoge": "fuga"})`
    );
  }
);