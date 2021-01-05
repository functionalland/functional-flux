import Task from "https://deno.land/x/functional@v1.3.3/library/Task.js";

export const $$debug = Symbol.for("Debug");

window[$$debug] = false;

export const debug = (message, unaryFunction) => x => {
  if (!window[$$debug]) return unaryFunction ? unaryFunction(x) : x;

  if (!!unaryFunction) {
    const time = performance.now();

    const container = unaryFunction(x);

    if (Task.is(container))
      return container.map(x => console.debug(`${message} [${performance.now() - time}ms]`, x) || x);
    else return container;
  } else {
    console.debug(message, x);

    return x;
  }
};