#!/usr/bin/env node

import * as rxf from '../src/index.js'
import { compose, graph, source, sink, $, dedupe, take, map } from '../src/index.js'

// Define a spinner net
const spinnerString =
  [
    '⠋',
    '⠙',
    '⠹',
    '⠸',
    '⠼',
    '⠴',
    '⠦',
    '⠧',
    '⠇',
    '⠏'
  ]

export const spinner = graph({
  nodes: {
    // freq is 30hz
    time: source('timer', 1000 / 60),

    limitedTime: take(600),

    spinnerIndex: compose(
      map(ts =>
        // each loop of the spinner is on screen for 2000 ms
        Math.floor(ts / (2000 / spinnerString.length)) % spinnerString.length),
      dedupe()
    ),

    spinner: map(i => spinnerString[i]),

    streamFn: map(str =>
      process => {
        process.stdout.cursorTo(40)
        process.stdout.write(' ' + str)
        process.stdout.moveCursor(-2, 0)
      }),

    // TODO: figure out how to 'talk' to the process.stdout sink. I need to
    // give it commands over time.
    stdout: sink('process'),
    log: sink('log')
  },

  links: [
    [$.time, $.limitedTime],
    [$.limitedTime, $.spinnerIndex],
    [$.spinnerIndex, $.spinner],
    // [$.spinnerIndex, $.log],
    [$.spinner, $.streamFn],
    [$.streamFn, $.stdout]
  ]
})

const processEdge = {
  sink: () =>
    rxf.transducer(_ => ({
      [rxf.STEP]: (a, f) => {
        f(process)
        return a
      }
    }))
}
rxf.run(spinner, { edges: { process: processEdge } })
