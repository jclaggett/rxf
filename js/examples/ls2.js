#!/usr/bin/env node

import * as rxf from '../src/index.js'
import {
  $, takeWhile, mapjoin, map, sink, source, prolog, identity,
  after
} from '../src/index.js'

const dirGraph = ([dirname, ...dirnames], { padding, useTitles }) =>
  rxf.iograph({
    nodes: {
      entries: source('dir', dirname),
      entryNames: rxf.iochain(
        map(x => `${padding}${x.name}`),
        useTitles ? prolog(`\n${dirname}`) : identity
      ),

      log: sink('log'),

      dirRest: after(dirnames),
      dirSink: sink('pipe', 'dirnames'),
      debug: sink('debug')
    },
    links: [
      [$.entries, $.entryNames],
      [$.entryNames, $.log],
      [$.entryNames, $.dirRest],
      [$.dirRest, $.dirSink]
    ]
  })

export const lsGraph = () =>
  rxf.iograph({
    nodes: {
      // Act 1: Collect configuration and start processing dirnames
      init: source('init'),

      config: map(({ argv }) => {
        const dirnames = argv.slice(2)
        const useTitles = dirnames.length > 1
        return {
          useTitles,
          padding: ' '.repeat(useTitles ? 4 : 0),
          dirnames
        }
      }),

      configDirnames: map(x => x.dirnames),

      dirSink: sink('pipe', 'dirnames'),

      // Act 2: process each dirname in sequence (using config as needed)
      dirSource: source('pipe', 'dirnames'),

      dirnames: takeWhile(dirnames => dirnames.length > 0),

      dirGraph: mapjoin(dirGraph, [true, false]),

      run: sink('run'),
      debug: sink('debug')
    },
    links: [
      [$.init, $.config],
      [$.config, $.debug],
      [$.config, $.configDirnames],
      [$.configDirnames, $.dirSink],
      [$.dirSource, $.dirnames],
      [$.dirnames, $.dirGraph[0]],
      [$.config, $.dirGraph[1]],
      [$.dirGraph, $.run]
    ]
  })

const ls = lsGraph()
rxf.pg(ls)
debugger
await rxf.run(ls)
